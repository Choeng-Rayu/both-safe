import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderName, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  headerToString,
  hmacSha512Hex,
  sha256Hex,
  verifyRsaSha256Signature,
} from '../../common/security/signature.util';
import {
  CreateOrderInput,
  PaymentProvider,
  PaymentProviderCapabilities,
  ProviderOrder,
  VerifyWebhookInput,
  WebhookVerification,
} from '../payment-provider.interface';

@Injectable()
export class BinancePayProvider implements PaymentProvider {
  readonly rail = 'binance' as const;
  readonly providerName = PaymentProviderName.BINANCE;

  constructor(private readonly config: ConfigService) {}

  async createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const baseUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const apiKey = this.config.get<string>('BINANCE_PAY_API_KEY');

    if (!apiKey) {
      return {
        provider: this.providerName,
        providerOrderId: `binance_dev_${randomUUID()}`,
        merchantTradeNo: input.merchantTradeNo,
        checkoutUrl: `${baseUrl}/embed/${input.productId}?deal=${input.dealId}&rail=binance`,
        rawProviderJson: {
          mode: 'development_stub',
          goodsType: '02',
        },
      };
    }

    const body = {
      env: { terminalType: 'WEB' },
      merchantTradeNo: input.merchantTradeNo,
      orderAmount: Number(input.amountMinor) / 100,
      currency: input.currency,
      goods: {
        goodsType: '02',
        goodsCategory: '0000',
        referenceGoodsId: input.productId,
        goodsName: input.productName,
      },
      passThroughInfo: JSON.stringify({
        dealId: input.dealId,
        buyerId: input.buyerId,
      }),
      returnUrl: input.returnUrl,
      webhookUrl: this.config.get<string>('BINANCE_PAY_WEBHOOK_URL'),
    };

    const response = await this.signedPost(
      '/binancepay/openapi/v3/order',
      body,
    );
    const data = response.data as Record<string, unknown>;

    return {
      provider: this.providerName,
      providerOrderId: this.asOptionalString(data.prepayId),
      merchantTradeNo: input.merchantTradeNo,
      checkoutUrl: this.asOptionalString(data.checkoutUrl),
      qrPayload: this.asOptionalString(data.qrcodeLink),
      rawProviderJson: response,
    };
  }

  async queryOrder(merchantTradeNo: string) {
    const apiKey = this.config.get<string>('BINANCE_PAY_API_KEY');

    if (!apiKey) {
      return {
        status: PaymentStatus.PAID,
        providerOrderId: `binance_query_${merchantTradeNo}`,
        rawProviderJson: { mode: 'development_stub' },
      };
    }

    const response = await this.signedPost(
      '/binancepay/openapi/v2/order/query',
      {
        merchantTradeNo,
      },
    );
    const data = response.data as Record<string, unknown>;

    return {
      status: this.mapBinanceStatus(
        this.asOptionalString(data.status) ?? 'PENDING',
      ),
      providerOrderId: this.asOptionalString(data.prepayId),
      rawProviderJson: response,
    };
  }

  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    const signature = headerToString(
      input.headers['binancepay-signature'] ??
        input.headers['x-binancepay-signature'],
    );
    const timestamp = headerToString(
      input.headers['binancepay-timestamp'] ??
        input.headers['x-binancepay-timestamp'],
    );
    const nonce = headerToString(
      input.headers['binancepay-nonce'] ?? input.headers['x-binancepay-nonce'],
    );
    const publicKey = this.config.get<string>('BINANCE_PAY_WEBHOOK_PUBLIC_KEY');

    const payload = `${timestamp ?? ''}\n${nonce ?? ''}\n${input.rawBody}\n`;
    const valid =
      Boolean(signature && timestamp && nonce && publicKey) &&
      verifyRsaSha256Signature(publicKey!, payload, signature!);

    const body = input.parsedBody;
    const bizId =
      this.asOptionalString(body.bizId) ??
      this.asOptionalString(body.biz_id) ??
      sha256Hex(input.rawBody);
    const eventType =
      this.asOptionalString(body.bizType) ??
      this.asOptionalString(body.eventType) ??
      'UNKNOWN';
    const data = this.extractData(body);
    const merchantTradeNo = this.pickString(data, [
      'merchantTradeNo',
      'merchant_trade_no',
    ]);
    const providerOrderId = this.pickString(data, [
      'prepayId',
      'transactionId',
    ]);
    const status = this.pickString(data, [
      'status',
      'orderStatus',
      'bizStatus',
    ]);

    return Promise.resolve({
      valid,
      providerEventId: bizId,
      eventType,
      merchantTradeNo,
      providerOrderId,
      normalizedStatus: status ? this.mapBinanceStatus(status) : undefined,
    });
  }

  refundOrder() {
    return Promise.resolve({
      providerReference: `binance_refund_manual_${randomUUID()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  createPayout() {
    return Promise.resolve({
      providerReference: `binance_payout_manual_${randomUUID()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  submitSplit() {
    return Promise.resolve({
      providerReference: `binance_split_manual_${randomUUID()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  reconcile() {
    return Promise.resolve([]);
  }

  getCapabilities(): PaymentProviderCapabilities {
    return {
      supportsCheckout: true,
      supportsRefund: true,
      supportsPayout: true,
      supportsSplit: true,
      supportsRecurring: false,
      requiresManualRelease: true,
    };
  }

  private async signedPost(path: string, body: Record<string, unknown>) {
    const baseUrl = this.config.get<string>('BINANCE_PAY_BASE_URL') ?? '';
    const apiKey = this.config.get<string>('BINANCE_PAY_API_KEY') ?? '';
    const secretKey = this.config.get<string>('BINANCE_PAY_SECRET_KEY') ?? '';
    const timestamp = Date.now().toString();
    const nonce = randomUUID().replace(/-/g, '');
    const bodyJson = JSON.stringify(body);
    const payload = `${timestamp}\n${nonce}\n${bodyJson}\n`;
    const signature = hmacSha512Hex(secretKey, payload);

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'binancepay-timestamp': timestamp,
        'binancepay-nonce': nonce,
        'binancepay-certificate-sn': apiKey,
        'binancepay-signature': signature,
      },
      body: bodyJson,
    });

    const json = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(`Binance Pay request failed: ${response.status}`);
    }

    return json;
  }

  private extractData(body: Record<string, unknown>): Record<string, unknown> {
    const rawData = body.data;

    if (typeof rawData === 'string') {
      try {
        return JSON.parse(rawData) as Record<string, unknown>;
      } catch {
        return {};
      }
    }

    if (rawData && typeof rawData === 'object') {
      return rawData as Record<string, unknown>;
    }

    return body;
  }

  private pickString(
    source: Record<string, unknown>,
    keys: string[],
  ): string | undefined {
    const value = keys.map((key) => source[key]).find((item) => item != null);
    return this.asOptionalString(value);
  }

  private asOptionalString(value: unknown): string | undefined {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return undefined;
  }

  private mapBinanceStatus(status: string): PaymentStatus {
    const normalized = status.toUpperCase();

    if (['PAID', 'PAY_SUCCESS', 'SUCCESS'].includes(normalized)) {
      return PaymentStatus.PAID;
    }

    if (['REFUNDED', 'REFUND_SUCCESS'].includes(normalized)) {
      return PaymentStatus.REFUNDED;
    }

    if (['REFUNDING'].includes(normalized)) {
      return PaymentStatus.REFUNDING;
    }

    if (['EXPIRED'].includes(normalized)) {
      return PaymentStatus.EXPIRED;
    }

    if (['CANCELED', 'CANCELLED'].includes(normalized)) {
      return PaymentStatus.CANCELED;
    }

    if (['ERROR', 'FAILED'].includes(normalized)) {
      return PaymentStatus.FAILED;
    }

    return PaymentStatus.PENDING;
  }
}
