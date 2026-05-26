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
  // Withdrawal lifecycle: COMPLETED is dispatched once the admin has
  // paid externally and uploaded the proof image — at that point the
  // wallet has been debited and the user is notified with the proof.
  // REJECTED unlocks the funds back into the wallet.
  WITHDRAWAL_COMPLETED: 'WITHDRAWAL_COMPLETED',
  WITHDRAWAL_REJECTED: 'WITHDRAWAL_REJECTED',
  USER_DISABLED: 'USER_DISABLED',
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
  WITHDRAWAL_QR: 'withdrawal_qr',
  // Screenshot the admin uploads as proof that they actually sent
  // the user's withdrawal payment externally (Bakong receipt, bank
  // app confirmation, etc.). Surfaced to the user in the success
  // notification so they can verify the payment landed.
  WITHDRAWAL_PROOF: 'withdrawal_proof',
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
  WALLET_NOT_FOUND: 'wallet.not_found',
  WALLET_INSUFFICIENT_FUNDS: 'wallet.insufficient_funds',
  WALLET_CONCURRENT_MODIFICATION: 'wallet.concurrent_modification',
  WITHDRAWAL_NOT_FOUND: 'withdrawal.not_found',
  WITHDRAWAL_INVALID_STATUS: 'withdrawal.invalid_status',
  WITHDRAWAL_CREATED: 'withdrawal.created',
  WITHDRAWAL_COMPLETED: 'withdrawal.completed',
  WITHDRAWAL_REJECTED: 'withdrawal.rejected',
  WITHDRAWAL_CANCELLED: 'withdrawal.cancelled',
  RELEASED_TO_WALLET: 'deal.released_to_wallet',
  REFUNDED_TO_WALLET: 'deal.refunded_to_wallet',
  PAID_FROM_WALLET: 'payment.paid_from_wallet',
} as const;

export const CURRENCIES = { USD: 'USD', KHR: 'KHR' } as const;
export type Currency = (typeof CURRENCIES)[keyof typeof CURRENCIES];

export const WALLET_LEDGER_ENTRY_TYPES = {
  DEAL_PAYMENT_DEBIT: 'DEAL_PAYMENT_DEBIT',
  DEAL_RELEASE_CREDIT: 'DEAL_RELEASE_CREDIT',
  DEAL_REFUND_CREDIT: 'DEAL_REFUND_CREDIT',
  WITHDRAWAL_LOCK: 'WITHDRAWAL_LOCK',
  WITHDRAWAL_UNLOCK: 'WITHDRAWAL_UNLOCK',
  WITHDRAWAL_DEBIT: 'WITHDRAWAL_DEBIT',
  ADMIN_ADJUSTMENT_CREDIT: 'ADMIN_ADJUSTMENT_CREDIT',
  ADMIN_ADJUSTMENT_DEBIT: 'ADMIN_ADJUSTMENT_DEBIT',
} as const;
export type WalletLedgerEntryType =
  (typeof WALLET_LEDGER_ENTRY_TYPES)[keyof typeof WALLET_LEDGER_ENTRY_TYPES];

export const WALLET_LEDGER_DIRECTIONS = {
  CREDIT: 'credit',
  DEBIT: 'debit',
  LOCK: 'lock',
  UNLOCK: 'unlock',
} as const;
export type WalletLedgerDirection =
  (typeof WALLET_LEDGER_DIRECTIONS)[keyof typeof WALLET_LEDGER_DIRECTIONS];

export const WITHDRAWAL_STATUS = {
  // Awaiting admin action. Funds are held under a WITHDRAWAL_LOCK
  // ledger entry — they remain in availableUsd/availableKhr but are
  // excluded from the user's *effective* available balance, so the
  // user cannot double-spend the same money on a deal payment while
  // a withdrawal is pending. The lock is released when the
  // withdrawal transitions to a terminal status.
  PENDING_REVIEW: 'PENDING_REVIEW',
  // Admin paid externally and uploaded a proof image. Wallet has
  // been unlocked and debited in the same transaction. There is
  // intentionally no separate "user confirms receipt" step —
  // disputes are handled by reviewing the user's submitted
  // bank/QR info against the admin's proof image.
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type WithdrawalStatus =
  (typeof WITHDRAWAL_STATUS)[keyof typeof WITHDRAWAL_STATUS];

export const WITHDRAWAL_ACTIVE_STATUSES: WithdrawalStatus[] = [
  WITHDRAWAL_STATUS.PENDING_REVIEW,
];

export const WITHDRAWAL_TERMINAL_STATUSES: WithdrawalStatus[] = [
  WITHDRAWAL_STATUS.COMPLETED,
  WITHDRAWAL_STATUS.REJECTED,
  WITHDRAWAL_STATUS.FAILED,
  WITHDRAWAL_STATUS.CANCELLED,
];

export const PAYMENT_METHODS = {
  BAKONG_KHQR: 'bakong_khqr',
  WALLET_INTERNAL: 'wallet_internal',
} as const;
export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const WITHDRAWAL_DESTINATION_TYPES = {
  BAKONG_KHQR: 'bakong_khqr',
  BANK_ACCOUNT: 'bank_account',
} as const;
export type WithdrawalDestinationType =
  (typeof WITHDRAWAL_DESTINATION_TYPES)[keyof typeof WITHDRAWAL_DESTINATION_TYPES];
