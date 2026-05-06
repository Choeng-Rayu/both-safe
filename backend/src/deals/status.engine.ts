import { DEAL_STATUS, DealStatus } from '../common/constants';

// Allowed forward transitions. Backwards transitions go through specific actions
// (admin reject takes PAYMENT_PENDING_VERIFICATION → READY_FOR_PAYMENT, etc.).
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: ['AWAITING_COUNTERPARTY', 'CANCELLED', 'EXPIRED'],
  AWAITING_COUNTERPARTY: ['AWAITING_BOTH_APPROVAL', 'CANCELLED', 'EXPIRED'],
  AWAITING_BOTH_APPROVAL: ['READY_FOR_PAYMENT', 'CANCELLED', 'EXPIRED'],
  READY_FOR_PAYMENT: ['PAYMENT_PENDING_VERIFICATION', 'CANCELLED', 'EXPIRED'],
  PAYMENT_PENDING_VERIFICATION: ['PAID_ESCROWED', 'READY_FOR_PAYMENT', 'DISPUTED', 'CANCELLED'],
  PAID_ESCROWED: ['SELLER_PREPARING', 'DISPUTED', 'REFUNDED'],
  SELLER_PREPARING: ['SHIPPED', 'DISPUTED', 'REFUNDED'],
  SHIPPED: ['BUYER_CONFIRMED', 'DISPUTED', 'REFUNDED'],
  BUYER_CONFIRMED: ['RELEASE_PENDING'],
  DISPUTED: ['RELEASE_PENDING', 'REFUNDED', 'PAID_ESCROWED', 'SELLER_PREPARING', 'SHIPPED'],
  RELEASE_PENDING: ['RELEASED', 'DISPUTED'],
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

// Fields that are locked once payment is verified (PAID_ESCROWED or beyond).
const PAYMENT_REACHED: DealStatus[] = [
  'PAID_ESCROWED',
  'SELLER_PREPARING',
  'SHIPPED',
  'BUYER_CONFIRMED',
  'DISPUTED',
  'RELEASE_PENDING',
  'RELEASED',
  'REFUNDED',
];

export function isPostPayment(status: DealStatus): boolean {
  return PAYMENT_REACHED.includes(status);
}

// Whether the buyer can upload payment proof at this status.
export function canUploadPaymentProof(status: DealStatus): boolean {
  return status === DEAL_STATUS.READY_FOR_PAYMENT;
}

// Whether seller can upload shipping proof.
export function canUploadShippingProof(status: DealStatus): boolean {
  return status === DEAL_STATUS.PAID_ESCROWED || status === DEAL_STATUS.SELLER_PREPARING;
}

// Whether buyer can confirm received.
export function canConfirmReceived(status: DealStatus): boolean {
  return status === DEAL_STATUS.SHIPPED;
}

// Whether either side can open a dispute.
export function canOpenDispute(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PAYMENT_PENDING_VERIFICATION ||
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SELLER_PREPARING ||
    status === DEAL_STATUS.SHIPPED
  );
}
