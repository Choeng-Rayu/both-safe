import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderName, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  headerToString,
  hmacSha256Hex,
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

@Injectable()
export class PayWayBakongProvider implements PaymentProvider {
  readonly rail = 'payway_bakong' as const;
  readonly providerName = PaymentProviderName.PAYWAY_BAKONG;

  constructor(private readonly config: ConfigService) {}

  createOrder(input: CreateOrderInput): Promise<ProviderOrder> {
    const baseUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

    return Promise.resolve({
      provider: this.providerName,
      providerOrderId: `payway_dev_${randomUUID()}`,
      merchantTradeNo: input.merchantTradeNo,
      checkoutUrl: `${baseUrl}/embed/${input.productId}?deal=${input.dealId}&rail=payway_bakong`,
      qrPayload: `KHQR_DEV:${input.merchantTradeNo}:${input.amountMinor.toString()}:${input.currency}`,
      rawProviderJson: {
        mode: 'development_stub',
        rail: 'bakong_khqr',
      },
    });
  }

  queryOrder(merchantTradeNo: string) {
    return Promise.resolve({
      status: PaymentStatus.PAID,
      providerOrderId: `payway_query_${merchantTradeNo}`,
      rawProviderJson: { mode: 'development_stub' },
    });
  }

  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification> {
    const signature = headerToString(
      input.headers['x-payway-signature'] ?? input.headers['hash'],
    );
    const secret = this.config.get<string>('PAYWAY_WEBHOOK_SECRET') ?? '';
    const expected = secret ? hmacSha256Hex(secret, input.rawBody) : undefined;
    const valid =
      Boolean(signature && expected) &&
      timingSafeStringEqual(signature!.toLowerCase(), expected!.toLowerCase());

    const body = input.parsedBody;
    const providerEventId =
      this.asOptionalString(body.tran_id) ??
      this.asOptionalString(body.transaction_id) ??
      this.asOptionalString(body.id) ??
      sha256Hex(input.rawBody);
    const merchantTradeNo =
      this.asOptionalString(body.req_time) ??
      this.asOptionalString(body.merchant_ref_no) ??
      this.asOptionalString(body.merchantTradeNo);
    const status =
      this.asOptionalString(body.status) ??
      this.asOptionalString(body.payment_status) ??
      'PENDING';

    return Promise.resolve({
      valid,
      providerEventId,
      eventType: this.asOptionalString(body.type) ?? 'PAYMENT_NOTIFICATION',
      merchantTradeNo,
      providerOrderId: providerEventId,
      normalizedStatus: this.mapPayWayStatus(status),
    });
  }

  refundOrder() {
    return Promise.resolve({
      providerReference: `payway_refund_manual_${randomUUID()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  createPayout() {
    return Promise.resolve({
      providerReference: `payway_payout_manual_${randomUUID()}`,
      rawProviderJson: { manualApprovalRequired: true },
    });
  }

  submitSplit() {
    return Promise.resolve({
      providerReference: `payway_split_manual_${randomUUID()}`,
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

  private mapPayWayStatus(status: string): PaymentStatus {
    const normalized = status.toUpperCase();

    if (['0', 'APPROVED', 'SUCCESS', 'PAID'].includes(normalized)) {
      return PaymentStatus.PAID;
    }

    if (['REFUNDED'].includes(normalized)) {
      return PaymentStatus.REFUNDED;
    }

    if (['EXPIRED'].includes(normalized)) {
      return PaymentStatus.EXPIRED;
    }

    if (['CANCELLED', 'CANCELED'].includes(normalized)) {
      return PaymentStatus.CANCELED;
    }

    if (['FAILED', 'DECLINED'].includes(normalized)) {
      return PaymentStatus.FAILED;
    }

    return PaymentStatus.PENDING;
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
}
