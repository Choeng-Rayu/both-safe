export const DEAL_STATUSES = [
  'DRAFT',
  'AWAITING_COUNTERPARTY',
  'AWAITING_BOTH_APPROVAL',
  'READY_FOR_PAYMENT',
  'PAYMENT_PENDING_VERIFICATION',
  'PAID_ESCROWED',
  'SELLER_PREPARING',
  'SHIPPED',
  'BUYER_CONFIRMED',
  'RELEASE_PENDING',
  'RELEASED',
  'REFUNDED',
  'CANCELLED',
  'EXPIRED',
  'DISPUTED',
] as const;

export const ROLES = ["buyer", "seller", "admin"] as const;
export const LOCALES = ["km", "en", "zh"] as const;
export const SOURCES = ["web", "telegram"] as const;
export const DISPUTE_REASONS = [
  "ITEM_NOT_RECEIVED",
  "WRONG_ITEM",
  "DAMAGED_ITEM",
  "FAKE_ITEM",
  "PAYMENT_PROBLEM",
  "OTHER",
] as const;

export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;

export const DEAL_ALLOWED_ACTIONS = [
  'share_invite_link',
  'update_product',
  'update_participant',
  'approve',
  'cancel',
  'upload_payment_proof',
  'upload_shipping_proof',
  'confirm_received',
  'open_dispute',
  'admin_review',
] as const;
