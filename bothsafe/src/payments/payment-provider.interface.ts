import { PaymentProviderName, PaymentStatus } from '@prisma/client';

export type PaymentRail = 'binance' | 'payway_bakong' | 'bakong';

export interface CreateOrderInput {
  dealId: string;
  merchantTradeNo: string;
  amountMinor: bigint;
  currency: string;
  productId: string;
  productName: string;
  buyerId: string;
  returnUrl?: string;
}

export interface ProviderOrder {
  provider: PaymentProviderName;
  providerOrderId?: string;
  merchantTradeNo: string;
  checkoutUrl?: string;
  qrPayload?: string;
  rawProviderJson?: Record<string, unknown>;
}

export interface WebhookVerification {
  valid: boolean;
  providerEventId: string;
  eventType: string;
  merchantTradeNo?: string;
  providerOrderId?: string;
  normalizedStatus?: PaymentStatus;
}

export interface PaymentProviderCapabilities {
  supportsCheckout: boolean;
  supportsRefund: boolean;
  supportsPayout: boolean;
  supportsSplit: boolean;
  supportsRecurring: boolean;
  requiresManualRelease: boolean;
}

export interface VerifyWebhookInput {
  rawBody: string;
  parsedBody: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}

export interface PaymentProvider {
  readonly rail: PaymentRail;
  readonly providerName: PaymentProviderName;

  createOrder(input: CreateOrderInput): Promise<ProviderOrder>;
  queryOrder(merchantTradeNo: string): Promise<{
    status: PaymentStatus;
    providerOrderId?: string;
    rawProviderJson?: Record<string, unknown>;
  }>;
  verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerification>;
  refundOrder(input: {
    merchantTradeNo: string;
    amountMinor: bigint;
    reason: string;
  }): Promise<{
    providerReference: string;
    rawProviderJson?: Record<string, unknown>;
  }>;
  createPayout(input: {
    merchantTradeNo: string;
    sellerPayoutIdentifier: string;
    amountMinor: bigint;
    currency: string;
  }): Promise<{
    providerReference: string;
    rawProviderJson?: Record<string, unknown>;
  }>;
  submitSplit(input: {
    merchantTradeNo: string;
    receiverId: string;
    amountMinor: bigint;
    currency: string;
  }): Promise<{
    providerReference: string;
    rawProviderJson?: Record<string, unknown>;
  }>;
  reconcile(): Promise<
    Array<{ merchantTradeNo: string; status: PaymentStatus }>
  >;
  getCapabilities(): PaymentProviderCapabilities;
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
