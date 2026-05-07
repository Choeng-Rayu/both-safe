import { DEAL_STATUS } from '../common/constants';
import {
  canBuyerCancel,
  canConfirmReceived,
  canOpenDispute,
  canSellerAccept,
  canTransition,
  canUploadPaymentProof,
  canUploadShippingProof,
} from './status.engine';

describe('automated deal status engine', () => {
  it('supports buyer-created paid-then-seller-accept flow', () => {
    expect(canTransition(DEAL_STATUS.PENDING_SELLER_APPROVAL, DEAL_STATUS.PAYMENT_PENDING_VERIFICATION)).toBe(true);
    expect(canTransition(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION, DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL)).toBe(true);
    expect(canSellerAccept(DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL)).toBe(true);
    expect(canTransition(DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL, DEAL_STATUS.SELLER_ACCEPTED_PACKING)).toBe(true);
  });

  it('supports seller-created buyer-payment flow', () => {
    expect(canUploadPaymentProof(DEAL_STATUS.PENDING_BUYER_PAYMENT)).toBe(true);
    expect(canTransition(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION, DEAL_STATUS.PAID_ESCROWED)).toBe(true);
    expect(canUploadShippingProof(DEAL_STATUS.PAID_ESCROWED)).toBe(true);
  });

  it('supports ship-confirm-auto-payout without release pending status', () => {
    expect(canTransition(DEAL_STATUS.SELLER_ACCEPTED_PACKING, DEAL_STATUS.SHIPPED)).toBe(true);
    expect(canConfirmReceived(DEAL_STATUS.SHIPPED)).toBe(true);
    expect(canTransition(DEAL_STATUS.SHIPPED, DEAL_STATUS.RELEASED)).toBe(true);
  });

  it('supports pre-accept cancellation/refund and dispute hold rules', () => {
    expect(canBuyerCancel(DEAL_STATUS.PENDING_SELLER_APPROVAL)).toBe(true);
    expect(canTransition(DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL, DEAL_STATUS.REFUNDED)).toBe(true);
    expect(canOpenDispute(DEAL_STATUS.SELLER_ACCEPTED_PACKING)).toBe(true);
    expect(canBuyerCancel(DEAL_STATUS.SELLER_ACCEPTED_PACKING)).toBe(false);
  });
});
