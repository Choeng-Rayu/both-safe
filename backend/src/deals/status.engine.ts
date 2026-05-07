import { DEAL_STATUS, DealStatus } from '../common/constants';

/**
 * Full status transition map for the BothSafe deal flow.
 *
 * Case 1 (Buyer creates first):
 *   DRAFT → PENDING_SELLER_APPROVAL → PAYMENT_PENDING_VERIFICATION
 *         → PAID_WAITING_SELLER_APPROVAL → SELLER_ACCEPTED_PACKING → SHIPPED
 *         → BUYER_CONFIRMED → RELEASE_PENDING → RELEASED
 *
 * Case 2 (Seller creates first):
 *   DRAFT → PENDING_BUYER_PAYMENT → PAYMENT_PENDING_VERIFICATION
 *         → PAID_ESCROWED → SHIPPED → BUYER_CONFIRMED → RELEASE_PENDING → RELEASED
 */
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['PENDING_BUYER_PAYMENT', 'PENDING_SELLER_APPROVAL', 'CANCELLED', 'EXPIRED'],

  // Seller-created flow: waiting for buyer to pay
  PENDING_BUYER_PAYMENT: ['PAYMENT_PENDING_VERIFICATION', 'CANCELLED', 'EXPIRED'],

  // Buyer-created flow: waiting for seller to join & accept (buyer may pay before seller joins)
  PENDING_SELLER_APPROVAL: ['PAYMENT_PENDING_VERIFICATION', 'CANCELLED', 'EXPIRED'],

  // Admin verifying payment
  PAYMENT_PENDING_VERIFICATION: [
    'PAID_WAITING_SELLER_APPROVAL', // buyer-created: payment verified, seller still must accept
    'PAID_ESCROWED',                // seller-created: payment verified, seller can pack immediately
    'PENDING_BUYER_PAYMENT',        // admin rejected (seller-created flow)
    'PENDING_SELLER_APPROVAL',      // admin rejected (buyer-created flow)
    'DISPUTED',
    'CANCELLED',
  ],

  // Buyer-created: money in escrow, seller has not accepted yet
  PAID_WAITING_SELLER_APPROVAL: [
    'SELLER_ACCEPTED_PACKING', // seller clicks "Accept & Commit to Ship"
    'SELLER_REJECTED',         // seller rejects the deal
    'CANCELLED',               // buyer cancels in this window
  ],

  // Seller rejected → must refund
  SELLER_REJECTED: ['REFUNDED'],

  // Seller accepted (buyer-created flow) — now packing
  SELLER_ACCEPTED_PACKING: ['SHIPPED', 'DISPUTED', 'REFUNDED'],

  // Seller-created flow: payment verified — seller packs immediately
  PAID_ESCROWED: ['SHIPPED', 'DISPUTED', 'REFUNDED'],

  SHIPPED: ['BUYER_CONFIRMED', 'DISPUTED', 'REFUNDED'],
  BUYER_CONFIRMED: ['RELEASE_PENDING'],

  DISPUTED: [
    'RELEASE_PENDING',
    'REFUNDED',
    'PAID_ESCROWED',
    'SELLER_ACCEPTED_PACKING',
    'SHIPPED',
  ],

  RELEASE_PENDING: ['RELEASED', 'DISPUTED'],

  // Terminal states
  RELEASED: [],
  REFUNDED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: DealStatus, to: DealStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: DealStatus, to: DealStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`invalid transition: ${from} -> ${to}`);
  }
}

// ─── Status Group Helpers ──────────────────────────────────────────────────────

/** Statuses where the deal is effectively locked (post-payment verified). */
const POST_PAYMENT: DealStatus[] = [
  'PAID_WAITING_SELLER_APPROVAL',
  'SELLER_ACCEPTED_PACKING',
  'PAID_ESCROWED',
  'SHIPPED',
  'BUYER_CONFIRMED',
  'DISPUTED',
  'RELEASE_PENDING',
  'RELEASED',
  'REFUNDED',
];

export function isPostPayment(status: DealStatus): boolean {
  return POST_PAYMENT.includes(status);
}

/** Whether buyer can upload payment proof at this status. */
export function canUploadPaymentProof(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PENDING_BUYER_PAYMENT ||
    status === DEAL_STATUS.PENDING_SELLER_APPROVAL
  );
}

/** Whether seller can upload shipping proof. */
export function canUploadShippingProof(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.SELLER_ACCEPTED_PACKING ||
    status === DEAL_STATUS.PAID_ESCROWED
  );
}

/** Whether buyer can confirm received. */
export function canConfirmReceived(status: DealStatus): boolean {
  return status === DEAL_STATUS.SHIPPED;
}

/** Whether either side can open a dispute. */
export function canOpenDispute(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PAYMENT_PENDING_VERIFICATION ||
    status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL ||
    status === DEAL_STATUS.SELLER_ACCEPTED_PACKING ||
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SHIPPED
  );
}

/** Whether seller can accept the deal. */
export function canSellerAccept(status: DealStatus): boolean {
  return status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL;
}

/** Whether seller can reject the deal. */
export function canSellerReject(status: DealStatus): boolean {
  return status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL;
}

/** Whether buyer can cancel (before seller has accepted). */
export function canBuyerCancel(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PENDING_SELLER_APPROVAL ||
    status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL ||
    status === DEAL_STATUS.DRAFT
  );
}

/** Whether the deal is in a terminal/final state. */
export function isTerminal(status: DealStatus): boolean {
  return ['RELEASED', 'REFUNDED', 'CANCELLED', 'EXPIRED', 'SELLER_REJECTED'].includes(status);
}
