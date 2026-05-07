import { DEAL_STATUS, DealStatus } from '../common/constants';

/**
 * Automated escrow state machine.
 *
 * Buyer-created:
 *   DRAFT -> PENDING_SELLER_APPROVAL -> PAYMENT_PENDING_VERIFICATION
 *         -> PAID_WAITING_SELLER_APPROVAL -> SELLER_ACCEPTED_PACKING
 *         -> SHIPPED -> RELEASED
 *
 * Seller-created:
 *   DRAFT -> PENDING_BUYER_PAYMENT -> PAYMENT_PENDING_VERIFICATION
 *         -> PAID_ESCROWED -> SHIPPED -> RELEASED
 */
const TRANSITIONS: Record<DealStatus, DealStatus[]> = {
  DRAFT: [
    DEAL_STATUS.PENDING_BUYER_PAYMENT,
    DEAL_STATUS.PENDING_SELLER_APPROVAL,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  PENDING_BUYER_PAYMENT: [
    DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  PENDING_SELLER_APPROVAL: [
    DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
    DEAL_STATUS.CANCELLED,
    DEAL_STATUS.EXPIRED,
  ],
  PAYMENT_PENDING_VERIFICATION: [
    DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL,
    DEAL_STATUS.PAID_ESCROWED,
    DEAL_STATUS.DISPUTED,
    DEAL_STATUS.CANCELLED,
  ],
  PAID_WAITING_SELLER_APPROVAL: [
    DEAL_STATUS.SELLER_ACCEPTED_PACKING,
    DEAL_STATUS.REFUNDED,
    DEAL_STATUS.DISPUTED,
  ],
  SELLER_ACCEPTED_PACKING: [
    DEAL_STATUS.SHIPPED,
    DEAL_STATUS.DISPUTED,
  ],
  PAID_ESCROWED: [
    DEAL_STATUS.SHIPPED,
    DEAL_STATUS.DISPUTED,
  ],
  SHIPPED: [
    DEAL_STATUS.RELEASED,
    DEAL_STATUS.DISPUTED,
  ],
  DISPUTED: [
    DEAL_STATUS.RELEASED,
    DEAL_STATUS.REFUNDED,
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

const MONEY_RECEIVED: DealStatus[] = [
  DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL,
  DEAL_STATUS.SELLER_ACCEPTED_PACKING,
  DEAL_STATUS.PAID_ESCROWED,
  DEAL_STATUS.SHIPPED,
  DEAL_STATUS.DISPUTED,
  DEAL_STATUS.RELEASED,
  DEAL_STATUS.REFUNDED,
];

export function isPostPayment(status: DealStatus): boolean {
  return MONEY_RECEIVED.includes(status);
}

export function canStartPayment(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PENDING_BUYER_PAYMENT ||
    status === DEAL_STATUS.PENDING_SELLER_APPROVAL ||
    status === DEAL_STATUS.PAYMENT_PENDING_VERIFICATION
  );
}

export function canUploadPaymentProof(status: DealStatus): boolean {
  return canStartPayment(status);
}

export function canUploadShippingProof(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.SELLER_ACCEPTED_PACKING ||
    status === DEAL_STATUS.PAID_ESCROWED
  );
}

export function canConfirmReceived(status: DealStatus): boolean {
  return status === DEAL_STATUS.SHIPPED;
}

export function canOpenDispute(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL ||
    status === DEAL_STATUS.SELLER_ACCEPTED_PACKING ||
    status === DEAL_STATUS.PAID_ESCROWED ||
    status === DEAL_STATUS.SHIPPED
  );
}

export function canSellerAccept(status: DealStatus): boolean {
  return status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL;
}

export function canSellerReject(status: DealStatus): boolean {
  return status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL;
}

export function canBuyerCancel(status: DealStatus): boolean {
  return (
    status === DEAL_STATUS.DRAFT ||
    status === DEAL_STATUS.PENDING_SELLER_APPROVAL ||
    status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL
  );
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
