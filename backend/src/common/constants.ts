export const DEAL_STATUS = {
  // Deal just created, missing fields
  DRAFT: 'DRAFT',

  // Seller created deal first — waiting buyer to pay
  PENDING_BUYER_PAYMENT: 'PENDING_BUYER_PAYMENT',

  // Buyer created deal first — waiting seller to join & accept (buyer may or may not have paid yet)
  PENDING_SELLER_APPROVAL: 'PENDING_SELLER_APPROVAL',

  // Buyer uploaded payment proof — admin is verifying
  PAYMENT_PENDING_VERIFICATION: 'PAYMENT_PENDING_VERIFICATION',

  // Admin verified payment (buyer-created flow) — seller still needs to accept
  PAID_WAITING_SELLER_APPROVAL: 'PAID_WAITING_SELLER_APPROVAL',

  // Seller rejected the deal — triggers refund
  SELLER_REJECTED: 'SELLER_REJECTED',

  // Seller accepted and committed to ship (buyer-created flow, after payment verified)
  SELLER_ACCEPTED_PACKING: 'SELLER_ACCEPTED_PACKING',

  // Admin verified payment (seller-created flow) — seller can now pack immediately
  PAID_ESCROWED: 'PAID_ESCROWED',

  // Seller uploaded shipping proof
  SHIPPED: 'SHIPPED',

  // Buyer confirmed delivery
  BUYER_CONFIRMED: 'BUYER_CONFIRMED',

  // Dispute opened
  DISPUTED: 'DISPUTED',

  // Admin is about to release funds
  RELEASE_PENDING: 'RELEASE_PENDING',

  // Money sent to seller
  RELEASED: 'RELEASED',

  // Money returned to buyer
  REFUNDED: 'REFUNDED',

  // Buyer cancelled before seller accepted
  CANCELLED: 'CANCELLED',

  // Deal expired
  EXPIRED: 'EXPIRED',
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
  SELLER_ACCEPTED: 'SELLER_ACCEPTED',
  SELLER_REJECTED_DEAL: 'SELLER_REJECTED_DEAL',
  DEAL_CANCELLED_BY_BUYER: 'DEAL_CANCELLED_BY_BUYER',
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
  SELLER_ACCEPTED: 'deal.seller_accepted',
  SELLER_REJECTED: 'deal.seller_rejected',
  DEAL_CANCELLED: 'deal.cancelled',
  PAYMENT_NOT_READY: 'payment.not_ready',
  PAYMENT_PROOF_UPLOADED: 'payment.proof_uploaded',
  PAYMENT_VERIFIED: 'payment.verified',
  PAYMENT_REJECTED: 'payment.rejected',
  SHIPPING_UPLOADED: 'shipping.uploaded',
  BUYER_CONFIRMED: 'buyer.confirmed',
  DISPUTE_OPENED: 'dispute.opened',
  RELEASED: 'deal.released',
  REFUNDED: 'deal.refunded',
  FORBIDDEN: 'auth.forbidden',
  RATE_LIMITED: 'auth.rate_limited',
  VALIDATION_FAILED: 'validation.failed',
} as const;
