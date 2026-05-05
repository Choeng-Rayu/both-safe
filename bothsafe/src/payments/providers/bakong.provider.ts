import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderName, PaymentStatus } from '@prisma/client';
import { createHash } from 'crypto';
import {
  headerToString,
  sha256Hex,
  timingSafeStringEqual,
} from '../../common/security/signature.util';
import {
  CreateOrderInput,
  PaymentProvider,
  PaymentProviderCapabilities,
  ProviderOrder,
  VerifyWebhookInput,
  WebhookVerification,
} from '../payment-provider.interface';

// ---------------------------------------------------------------------------
// EMV KHQR constants – mirrors BakongKHQR.js from the reference repo
// ---------------------------------------------------------------------------
const EMV = {
  PAYLOAD_FORMAT_INDICATOR: '00',
  DEFAULT_PAYLOAD_FORMAT_INDICATOR: '01',
  POINT_OF_INITIATION_METHOD: '01',
  STATIC_QR: '11',
  DYNAMIC_QR: '12',
  MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL: '29',
  MERCHANT_CATEGORY_CODE: '52',
  DEFAULT_MERCHANT_CATEGORY_CODE: '5999',
  TRANSACTION_CURRENCY: '53',
  TRANSACTION_CURRENCY_USD: '840',
  TRANSACTION_CURRENCY_KHR: '116',
  TRANSACTION_AMOUNT: '54',
  COUNTRY_CODE: '58',
  DEFAULT_COUNTRY_CODE: 'KH',
  MERCHANT_NAME: '59',
  MERCHANT_CITY: '60',
  DEFAULT_MERCHANT_CITY: 'Phnom Penh',
  ADDITION_DATA_TAG: '62',
  BILLNUMBER_TAG: '01',
  ADDITION_DATA_FIELD_MOBILE_NUMBER: '02',
  STORE_LABEL: '03',
  TERMINAL_LABEL: '07',
  TIMESTAMP_TAG: '99',
  CRC: '63',
  CRC_LENGTH: '04',
  DEFAULT_CRC_TAG: '6304',
} as const;

// ---------------------------------------------------------------------------
// Internal KHQR builder (pure TypeScript port of BakongKHQR.js)
// ---------------------------------------------------------------------------
class KhqrBuilder {
  private fv(tag: string, value: string | number): string {
    const v = String(value);
    return `${tag}${v.length.toString().padStart(2, '0')}${v}`;
  }

  private crc16(data: string): string {
    let crc = 0xffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /** Build the full EMV KHQR payload string */
  build(opts: {
    bankAccount: string; // e.g. "choeng_rayu@aclb"
    merchantName: string;
    merchantCity?: string;
    amount: number; // in major currency units (e.g. 10.50)
    currency: 'USD' | 'KHR';
    phoneNumber: string;
    billNumber: string;
    storeLabel?: string;
    terminalLabel?: string;
    isStatic?: boolean;
  }): string {
    const city = (opts.merchantCity ?? EMV.DEFAULT_MERCHANT_CITY).slice(0, 15);
    const storeLabel = (opts.storeLabel ?? 'BOTHSAFE').slice(0, 25);
    const terminalLabel = (opts.terminalLabel ?? 'POS-01').slice(0, 25);
    const billNumber = opts.billNumber.slice(0, 25);
    const phoneNumber = opts.phoneNumber.slice(0, 25);

    // Merchant account info
    const accountInfo = this.fv(EMV.PAYLOAD_FORMAT_INDICATOR, opts.bankAccount);
    const merchantAccount = this.fv(EMV.MERCHANT_ACCOUNT_INFORMATION_INDIVIDUAL, accountInfo);

    // Amount – padded to 11 chars (matching reference repo logic)
    let amountStr = parseFloat(opts.amount.toFixed(2)).toString().replace(/\.?0+$/, '');
    amountStr = amountStr.padStart(11, '0');

    // Transaction currency
    const currencyCode =
      opts.currency === 'USD' ? EMV.TRANSACTION_CURRENCY_USD : EMV.TRANSACTION_CURRENCY_KHR;

    // Timestamp field (tag 99)
    const tsMs = Date.now().toString();
    const langPref = '00';
    const tsInner = langPref + tsMs.length.toString().padStart(2, '0') + tsMs;
    const timestampField = EMV.TIMESTAMP_TAG + tsInner.length.toString().padStart(2, '0') + tsInner;

    // Additional data
    const additionalInner =
      this.fv(EMV.BILLNUMBER_TAG, billNumber) +
      this.fv(EMV.ADDITION_DATA_FIELD_MOBILE_NUMBER, phoneNumber) +
      this.fv(EMV.STORE_LABEL, storeLabel) +
      this.fv(EMV.TERMINAL_LABEL, terminalLabel);
    const additionalData = this.fv(EMV.ADDITION_DATA_TAG, additionalInner);

    let qr = '';
    qr += this.fv(EMV.PAYLOAD_FORMAT_INDICATOR, EMV.DEFAULT_PAYLOAD_FORMAT_INDICATOR);
    qr += this.fv(EMV.POINT_OF_INITIATION_METHOD, opts.isStatic ? EMV.STATIC_QR : EMV.DYNAMIC_QR);
    qr += merchantAccount;
    qr += this.fv(EMV.MERCHANT_CATEGORY_CODE, EMV.DEFAULT_MERCHANT_CATEGORY_CODE);
    qr += this.fv(EMV.TRANSACTION_CURRENCY, currencyCode);
    if (!opts.isStatic) {
      qr += this.fv(EMV.TRANSACTION_AMOUNT, amountStr);
    }
    qr += this.fv(EMV.COUNTRY_CODE, EMV.DEFAULT_COUNTRY_CODE);
    qr += this.fv(EMV.MERCHANT_NAME, opts.merchantName.slice(0, 25));
    qr += this.fv(EMV.MERCHANT_CITY, city);
    qr += timestampField;
    qr += additionalData;

    // CRC
    const dataWithTag = qr + EMV.DEFAULT_CRC_TAG;
    qr += EMV.DEFAULT_CRC_TAG + this.crc16(dataWithTag);

    return qr;
  }

  md5(qr: string): string {
    return createHash('md5').update(qr).digest('hex');
  }
}

// ---------------------------------------------------------------------------
// Response shapes from Bakong NBC API
// ---------------------------------------------------------------------------
interface BakongApiResponse {
  responseCode: number; // 0 = success / paid
  responseMessage: string;
  data?: {
    hash?: string;
    fromAccountId?: string;
    toAccountId?: string;
    amount?: number;
    currency?: string;
    description?: string;
    createdDateMs?: number;
    acknowledgedDateMs?: number;
    externalRef?: string;
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
@Injectable()
export class BakongProvider implements PaymentProvider {
  readonly rail = 'bakong' as const;
  readonly providerName = PaymentProviderName.BAKONG;

  private readonly logger = new Logger(BakongProvider.name);
  private readonly khqr = new KhqrBuilder();

  constructor(private readonly config: ConfigService) {}

  // -------------------------------------------------------------------------
  // createOrder – generates KHQR locally, returns md5 as providerOrderId
  // -------------------------------------------------------------------------
  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const baseUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const token = this.config.get<string>('BAKONG_DEVELOPER_TOKEN');
    const apiUrl = this.config.get<string>('BAKONG_API_URL');

    // Development stub when credentials are missing
    if (!token || !apiUrl) {
      this.logger.warn('Bakong credentials not configured – returning dev stub');
      const stubQr = `BAKONG_DEV:${input.merchantTradeNo}:${input.amountMinor.toString()}:${input.currency}`;
      return {
        provider: this.providerName,
        providerOrderId: `bakong_dev_${input.merchantTradeNo}`,
        merchantTradeNo: input.merchantTradeNo,
        checkoutUrl: `${baseUrl}/embed/${input.productId}?deal=${input.dealId}&rail=bakong`,
        qrPayload: stubQr,
        rawProviderJson: { mode: 'development_stub', rail: 'bakong_khqr' },
      };
    }

    const merchantId = this.config.get<string>('BAKONG_MERCHANT_ID') ?? '';
    const phoneNumber = this.config.get<string>('BAKONG_PHONE_NUMBER') ?? '';

    // Amount: amountMinor is in cents (e.g. 1050 = $10.50)
    const amountMajor = Number(input.amountMinor) / 100;

    const currency = input.currency.toUpperCase() === 'KHR' ? 'KHR' : 'USD';

    const qrPayload = this.khqr.build({
      bankAccount: merchantId,
      merchantName: merchantId.split('@')[0] ?? 'BOTHSAFE',
      amount: amountMajor,
      currency,
      phoneNumber,
      billNumber: input.merchantTradeNo.slice(0, 25),
      storeLabel: input.productName.slice(0, 25),
      terminalLabel: input.dealId.slice(0, 25),
      isStatic: false,
    });

    const md5Hash = this.khqr.md5(qrPayload);

    // Optionally request a deep link from the Bakong API so users can open
    // the Bakong app directly from a mobile browser.
    let deepLink: string | undefined;
    try {
      deepLink = await this.requestDeepLink(qrPayload, apiUrl, token, baseUrl);
    } catch (err) {
      this.logger.warn(`Deep link generation failed (non-fatal): ${(err as Error).message}`);
    }

    return {
      provider: this.providerName,
      providerOrderId: md5Hash,
      merchantTradeNo: input.merchantTradeNo,
      checkoutUrl:
        deepLink ?? `${baseUrl}/embed/${input.productId}?deal=${input.dealId}&rail=bakong`,
      qrPayload,
      rawProviderJson: {
        md5: md5Hash,
        deepLink,
        merchantId,
        amountMajor,
        currency,
      },
    };
  }

  // -------------------------------------------------------------------------
  // queryOrder – polls Bakong NBC API using the MD5 stored as providerOrderId.
  //
  // IMPORTANT: The payment.service.ts calls queryOrder(payment.merchantTradeNo).
  // For Bakong, the MD5 of the QR string is stored as `providerOrderId`, NOT
  // merchantTradeNo. Two strategies are supported:
  //   1. Pass the MD5 directly (32-char hex) – used when the service is updated
  //      to call queryOrder(payment.providerOrderId) for BAKONG.
  //   2. Pass a URL-encoded MD5 embedded in merchantTradeNo via the prefix
  //      "bakong_md5:" – for forward-compat.
  // -------------------------------------------------------------------------
  async queryOrder(merchantTradeNo: string): Promise<{
    status: PaymentStatus;
    providerOrderId?: string;
    rawProviderJson?: Record<string, unknown>;
  }> {
    const token = this.config.get<string>('BAKONG_DEVELOPER_TOKEN');
    const apiUrl = this.config.get<string>('BAKONG_API_URL');

    if (!token || !apiUrl) {
      return {
        status: PaymentStatus.PAID,
        providerOrderId: `bakong_query_${merchantTradeNo}`,
        rawProviderJson: { mode: 'development_stub' },
      };
    }

    // Resolve the MD5: if the value is a 32-char hex string treat it as MD5,
    // otherwise it cannot be checked via KHQR (return PENDING).
    const md5Match = merchantTradeNo.match(/^[0-9a-f]{32}$/i);
    const md5 = md5Match ? merchantTradeNo.toLowerCase() : null;

    if (!md5) {
      this.logger.warn(
        `queryOrder called with merchantTradeNo "${merchantTradeNo}" which is not an MD5 hash. ` +
        'For Bakong KHQR polling, pass the providerOrderId (MD5) instead. Returning PENDING.',
      );
      return { status: PaymentStatus.PENDING, providerOrderId: merchantTradeNo };
    }

    const response = await fetch(`${apiUrl}/check_transaction_by_md5`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'user-agent': 'bothsafe-bakong/1.0',
      },
      body: JSON.stringify({ md5 }),
    });

    const json = (await response.json()) as BakongApiResponse;

    if (!response.ok && response.status !== 200) {
      throw new Error(`Bakong API error: ${response.status} – ${JSON.stringify(json)}`);
    }

    // responseCode 0 means the transaction is found (PAID)
    const isPaid = json.responseCode === 0;

    return {
      status: isPaid ? PaymentStatus.PAID : PaymentStatus.PENDING,
      providerOrderId: md5,
      rawProviderJson: json as unknown as Record<string, unknown>,
    };
  }

  // -------------------------------------------------------------------------
  // verifyWebhook – Bakong does not push webhooks in KHQR mode; we accept
  // the internal polling callback from our own payment-monitor service.
  // -------------------------------------------------------------------------
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    // Optional HMAC-SHA256 check when BAKONG_WEBHOOK_SECRET is configured
    const signature = headerToString(
      input.headers['x-bakong-signature'] ?? input.headers['bakong-signature'],
    );
    const secret = this.config.get<string>('BAKONG_WEBHOOK_SECRET') ?? '';

    const expected = secret ? sha256Hex(`${secret}:${input.rawBody}`) : undefined;
    const valid =
      Boolean(signature && expected) &&
      timingSafeStringEqual(signature!.toLowerCase(), expected!.toLowerCase());

    const devMode = this.config.get<string>('NODE_ENV') === 'development';
    const finalValid = valid || (devMode && !secret);

    const body = input.parsedBody;
    const md5 =
      this.asStr(body.md5) ??
      this.asStr(body.order_id) ??
      this.asStr(body.transaction_id) ??
      sha256Hex(input.rawBody);

    const merchantTradeNo = this.asStr(body.order_id) ?? this.asStr(body.merchantTradeNo);

    const statusStr = this.asStr(body.status) ?? this.asStr(body.payment_status) ?? 'PENDING';

    return Promise.resolve({
      valid: finalValid,
      providerEventId: md5,
      eventType: this.asStr(body.event_type) ?? 'PAYMENT_NOTIFICATION',
      merchantTradeNo,
      providerOrderId: md5,
      normalizedStatus: this.mapStatus(statusStr),
    });
  }

  refundOrder() {
    return Promise.resolve({
      providerReference: `bakong_refund_manual_${Date.now()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  createPayout() {
    return Promise.resolve({
      providerReference: `bakong_payout_manual_${Date.now()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  submitSplit() {
    return Promise.resolve({
      providerReference: `bakong_split_manual_${Date.now()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  reconcile() {
    return Promise.resolve([]);
  }

  getCapabilities(): PaymentProviderCapabilities {
    return {
      supportsCheckout: true,
      supportsRefund: false,   // KHQR has no server-side refund API
      supportsPayout: false,
      supportsSplit: false,
      supportsRecurring: false,
      requiresManualRelease: true,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Request a Bakong short deep-link for the generated QR string */
  private async requestDeepLink(
    qr: string,
    apiUrl: string,
    token: string,
    appCallback: string,
  ): Promise<string | undefined> {
    const res = await fetch(`${apiUrl}/generate_deeplink_by_qr`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'user-agent': 'bothsafe-bakong/1.0',
      },
      body: JSON.stringify({
        qr,
        sourceInfo: {
          appIconUrl: `${appCallback}/favicon.ico`,
          appName: 'BothSafe',
          appDeepLinkCallback: appCallback,
        },
      }),
    });

    const json = (await res.json()) as { responseCode: number; data?: { shortLink?: string } };
    return json.responseCode === 0 ? json.data?.shortLink : undefined;
  }

  private mapStatus(status: string): PaymentStatus {
    const s = status.toUpperCase();
    if (['PAID', 'SUCCESS', 'APPROVED', 'COMPLETED'].includes(s)) return PaymentStatus.PAID;
    if (['REFUNDED', 'REFUND_SUCCESS'].includes(s)) return PaymentStatus.REFUNDED;
    if (['REFUNDING'].includes(s)) return PaymentStatus.REFUNDING;
    if (['EXPIRED'].includes(s)) return PaymentStatus.EXPIRED;
    if (['CANCELED', 'CANCELLED'].includes(s)) return PaymentStatus.CANCELED;
    if (['FAILED', 'DECLINED', 'REJECTED'].includes(s)) return PaymentStatus.FAILED;
    return PaymentStatus.PENDING;
  }

  private asStr(value: unknown): string | undefined {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return undefined;
  }
}
