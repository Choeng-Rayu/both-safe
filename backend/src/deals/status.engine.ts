import { DEAL_STATUS, DealStatus } from '../common/constants';

/**
 * Unified escrow state machine — simplified happy path.
 *
 * The platform follows a "shorter is better" flow per the product
 * spec: paying *is* the buyer's approval, shipping *is* the seller's
 * approval, and confirm-received *is* the release trigger. There is
 * no separate "Approve deal" step for either side, and no
 * "SELLER_PREPARING" intermediate after payment. Admin only acts on
 * withdrawal requests.
 *
 * Happy path:
 *   DRAFT → AWAITING_COUNTERPARTY → READY_FOR_PAYMENT
 *   → PAYMENT_PENDING_VERIFICATION → PAID_ESCROWED → SHIPPED
 *   → BUYER_CONFIRMED → RELEASED  (auto-credit seller wallet)
 *
 * The legacy AWAITING_BOTH_APPROVAL and SELLER_PREPARING values are
 * still listed as sources for back-compat with rows created before
 * the simplification, but we never transition *into* them in the new
 * code.
 *
 * Terminal: RELEASED, REFUNDED, CANCELLED, EXPIRED.
 * RELEASE_PENDING remains for the admin-resolved dispute flow only.
 */
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: [
    DEAL_STATUS.AWAITING_COUNTERPARTY,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  // Counterparty join transitions straight to READY_FOR_PAYMENT —
  // no separate "both approve" step. The CANCELLED / EXPIRED escape
  // hatches stay for safety.
  AWAITING_COUNTERPARTY: [
    DEAL_STATUS.READY_FOR_PAYMENT,
    DEAL_STATUS.AWAITING_BOTH_APPROVAL, // legacy back-compat only
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  // Legacy: existing rows in AWAITING_BOTH_APPROVAL can still move on.
  AWAITING_BOTH_APPROVAL: [
    DEAL_STATUS.READY_FOR_PAYMENT,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  // Wallet payment skips PAYMENT_PENDING_VERIFICATION entirely; Bakong
  // KHQR auto-verify still goes through it.
  READY_FOR_PAYMENT: [
    DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
    DEAL_STATUS.PAID_ESCROWED,
    DEAL_STATUS.EXPIRED,
  ],
  PAYMENT_PENDING_VERIFICATION: [
    DEAL_STATUS.PAID_ESCROWED,
    DEAL_STATUS.READY_FOR_PAYMENT,
    DEAL_STATUS.DISPUTED,
  ],
  // Once funds are escrowed the seller ships directly. SELLER_PREPARING
  // is only kept as a target for legacy rows.
  PAID_ESCROWED: [
    DEAL_STATUS.SHIPPED,
    DEAL_STATUS.SELLER_PREPARING, // legacy back-compat only
    DEAL_STATUS.BUYER_CONFIRMED,
    DEAL_STATUS.DISPUTED,
  ],
  SELLER_PREPARING: [
    DEAL_STATUS.SHIPPED,
    DEAL_STATUS.BUYER_CONFIRMED,
    DEAL_STATUS.DISPUTED,
  ],
  SHIPPED: [DEAL_STATUS.BUYER_CONFIRMED, DEAL_STATUS.DISPUTED],
  // Buyer confirmation auto-credits the seller's wallet and moves to
  // RELEASED in the same transaction.
  BUYER_CONFIRMED: [DEAL_STATUS.RELEASED, DEAL_STATUS.RELEASE_PENDING],
  RELEASE_PENDING: [DEAL_STATUS.RELEASED, DEAL_STATUS.REFUNDED],
  DISPUTED: [
    DEAL_STATUS.RELEASE_PENDING,
    DEAL_STATUS.REFUNDED,
    DEAL_STATUS.RELEASED,
  ],
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

export function isTerminal(status: DealStatus): boolean {
  const terminal: DealStatus[] = [
    DEAL_STATUS.RELEASED,
    DEAL_STATUS.REFUNDED,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ];
  return terminal.includes(status);
}

export function isPostPayment(status: DealStatus): boolean {
  const postPayment: DealStatus[] = [
    DEAL_STATUS.PAID_ESCROWED,
    DEAL_STATUS.SELLER_PREPARING,
    DEAL_STATUS.SHIPPED,
    DEAL_STATUS.BUYER_CONFIRMED,
    DEAL_STATUS.RELEASE_PENDING,
    DEAL_STATUS.RELEASED,
    DEAL_STATUS.REFUNDED,
    DEAL_STATUS.DISPUTED,
  ];
  return postPayment.includes(status);
}

export function canUploadPaymentProof(status: DealStatus): boolean {
  return status === DEAL_STATUS.READY_FOR_PAYMENT;
}

export function canUploadShippingProof(status: DealStatus): boolean {
  // Shipping is allowed once the buyer has paid. Both PAID_ESCROWED
  // (new flow) and SELLER_PREPARING (legacy rows) qualify.
  return (
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SELLER_PREPARING
  );
}

export function canConfirmReceived(status: DealStatus): boolean {
  // Buyer can confirm receipt at any post-payment stage where the
  // seller is expected to deliver — that includes "paid but not yet
  // shipped" so the buyer is never blocked if the seller forgot to
  // upload tracking.
  return (
    status === DEAL_STATUS.SHIPPED ||
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SELLER_PREPARING
  );
}

export function canOpenDispute(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PAYMENT_PENDING_VERIFICATION ||
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SELLER_PREPARING ||
    status === DEAL_STATUS.SHIPPED
  );
}

export function canCancel(status: DealStatus): boolean {
  // Cancel is available before the buyer pays. After payment the
  // dispute flow takes over.
  return (
    status === DEAL_STATUS.DRAFT ||
    status === DEAL_STATUS.AWAITING_COUNTERPARTY ||
    status === DEAL_STATUS.AWAITING_BOTH_APPROVAL || // legacy
    status === DEAL_STATUS.READY_FOR_PAYMENT
  );
}

/**
 * Approval is deprecated. Paying is the buyer's implicit approval and
 * shipping is the seller's. Returns false universally so the legacy
 * frontend Approve button stays disabled.
 */
export function canApprove(_status: DealStatus): boolean {
  return false;
}

export function canJoin(status: DealStatus): boolean {
  return status === DEAL_STATUS.AWAITING_COUNTERPARTY;
}
