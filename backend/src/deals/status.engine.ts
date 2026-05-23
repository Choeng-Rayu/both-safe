import { DEAL_STATUS, DealStatus } from '../common/constants';

/**
 * Unified escrow state machine.
 *
 * Happy path (no shipping-proof friction, no admin release step):
 *   DRAFT → AWAITING_COUNTERPARTY → AWAITING_BOTH_APPROVAL → READY_FOR_PAYMENT
 *   → PAYMENT_PENDING_VERIFICATION → PAID_ESCROWED → SELLER_PREPARING
 *   → BUYER_CONFIRMED → RELEASED (auto-credit seller wallet)
 *
 * Optional shipping-proof branch (seller chooses to attach tracking):
 *   ... → SELLER_PREPARING → SHIPPED → BUYER_CONFIRMED → RELEASED
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
  AWAITING_COUNTERPARTY: [
    DEAL_STATUS.AWAITING_BOTH_APPROVAL,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
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
  PAID_ESCROWED: [DEAL_STATUS.SELLER_PREPARING, DEAL_STATUS.DISPUTED],
  // Buyer can confirm receipt without waiting for a shipping-proof upload.
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
  return (
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SELLER_PREPARING
  );
}

export function canConfirmReceived(status: DealStatus): boolean {
  // Shipping proof is optional — buyer can confirm receipt as soon as the
  // seller is preparing (or after shipping proof has been uploaded).
  return (
    status === DEAL_STATUS.SHIPPED || status === DEAL_STATUS.SELLER_PREPARING
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
  return (
    status === DEAL_STATUS.DRAFT ||
    status === DEAL_STATUS.AWAITING_COUNTERPARTY ||
    status === DEAL_STATUS.AWAITING_BOTH_APPROVAL
  );
}

export function canApprove(status: DealStatus): boolean {
  return status === DEAL_STATUS.AWAITING_BOTH_APPROVAL;
}

export function canJoin(status: DealStatus): boolean {
  return status === DEAL_STATUS.AWAITING_COUNTERPARTY;
}
