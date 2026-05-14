export const DEAL_STATUS = {
  DRAFT: 'DRAFT',
  AWAITING_COUNTERPARTY: 'AWAITING_COUNTERPARTY',
  AWAITING_BOTH_APPROVAL: 'AWAITING_BOTH_APPROVAL',
  READY_FOR_PAYMENT: 'READY_FOR_PAYMENT',
  PAYMENT_PENDING_VERIFICATION: 'PAYMENT_PENDING_VERIFICATION',
  PAID_ESCROWED: 'PAID_ESCROWED',
  SELLER_PREPARING: 'SELLER_PREPARING',
  SHIPPED: 'SHIPPED',
  BUYER_CONFIRMED: 'BUYER_CONFIRMED',
  RELEASE_PENDING: 'RELEASE_PENDING',
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  DISPUTED: 'DISPUTED',
} as const;

export type DealStatus = (typeof DEAL_STATUS)[keyof typeof DEAL_STATUS];

export const ROLES = { BUYER: 'buyer', SELLER: 'seller' } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const SOURCES = { WEB: 'web', TELEGRAM: 'telegram' } as const;
export type Source = (typeof SOURCES)[keyof typeof SOURCES];

export const LANGUAGES = { KM: 'km', EN: 'en', ZH: 'zh' } as const;
export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];

export const LEDGER_ENTRY_TYPES = {
  ESCROW_RECEIVED: 'ESCROW_RECEIVED',
  PLATFORM_FEE_RESERVED: 'PLATFORM_FEE_RESERVED',
  SELLER_PAYOUT_PENDING: 'SELLER_PAYOUT_PENDING',
  SELLER_PAYOUT_SENT: 'SELLER_PAYOUT_SENT',
  BUYER_REFUND_PENDING: 'BUYER_REFUND_PENDING',
  BUYER_REFUND_SENT: 'BUYER_REFUND_SENT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export const NOTIFICATION_EVENTS = {
  COUNTERPARTY_JOINED: 'COUNTERPARTY_JOINED',
  DEAL_UPDATED: 'DEAL_UPDATED',
  BOTH_APPROVED: 'BOTH_APPROVED',
  PAYMENT_PROOF_UPLOADED: 'PAYMENT_PROOF_UPLOADED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  SELLER_SHOULD_SHIP: 'SELLER_SHOULD_SHIP',
  SHIPPING_UPLOADED: 'SHIPPING_UPLOADED',
  BUYER_CONFIRMED: 'BUYER_CONFIRMED',
  DISPUTE_OPENED: 'DISPUTE_OPENED',
  PAYOUT_RELEASED: 'PAYOUT_RELEASED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
} as const;

export const DISPUTE_REASONS = [
  'ITEM_NOT_RECEIVED',
  'WRONG_ITEM',
  'DAMAGED_ITEM',
  'FAKE_ITEM',
  'PAYMENT_PROBLEM',
  'OTHER',
] as const;

export const FILE_CATEGORIES = {
  PRODUCT: 'product',
  PAYMENT_PROOF: 'payment_proof',
  PACKAGE_PHOTO: 'package_photo',
  DELIVERY_RECEIPT: 'delivery_receipt',
  DISPUTE_EVIDENCE: 'dispute_evidence',
} as const;

export const MESSAGE_KEYS = {
  DEAL_CREATED: 'deal.created',
  DEAL_NOT_FOUND: 'deal.not_found',
  INVALID_TOKEN: 'auth.invalid_token',
  INVITE_EXPIRED: 'invite.expired',
  COUNTERPARTY_JOINED: 'deal.counterparty_joined',
  ALREADY_JOINED: 'deal.already_joined',
  CANNOT_UPDATE_LOCKED: 'deal.cannot_update_locked',
  INVALID_TRANSITION: 'deal.invalid_transition',
  APPROVED: 'deal.approved',
  BOTH_APPROVED: 'deal.both_approved',
  PAYMENT_NOT_READY: 'payment.not_ready',
  PAYMENT_PROOF_UPLOADED: 'payment.proof_uploaded',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_REJECTED: 'payment.rejected',
  PAYMENT_INTENT_READY: 'payment.intent_ready',
  SHIPPING_UPLOADED: 'shipping.uploaded',
  BUYER_CONFIRMED: 'buyer.confirmed',
  DISPUTE_OPENED: 'dispute.opened',
  RELEASED: 'deal.released',
  REFUNDED: 'deal.refunded',
  DEAL_CANCELLED: 'deal.cancelled',
  TRANSFER_FAILED: 'transfer.failed',
  FORBIDDEN: 'auth.forbidden',
  RATE_LIMITED: 'auth.rate_limited',
  VALIDATION_FAILED: 'validation.failed',
} as const;
