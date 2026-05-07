export const DEAL_STATUSES = [
  'DRAFT',
  'PENDING_BUYER_PAYMENT',
  'PENDING_SELLER_APPROVAL',
  'PAYMENT_PENDING_VERIFICATION',
  'PAID_WAITING_SELLER_APPROVAL',
  'SELLER_ACCEPTED_PACKING',
  'PAID_ESCROWED',
  'SHIPPED',
  'DISPUTED',
  'RELEASED',
  'REFUNDED',
  'CANCELLED',
  'EXPIRED',
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
  'upload_payment_proof',
  'seller_accept',
  'seller_reject',
  'buyer_cancel',
  'upload_shipping_proof',
  'confirm_received',
  'open_dispute',
  'admin_review',
] as const;
