import { DEAL_STATUS } from '../common/constants';
import {
  canCancel,
  canConfirmReceived,
  canJoin,
  canOpenDispute,
  canTransition,
  canUploadPaymentProof,
  canUploadShippingProof,
  isTerminal,
} from './status.engine';

describe('StatusEngine (Kiro spec)', () => {
  describe('valid transitions', () => {
    it('should allow DRAFT → AWAITING_COUNTERPARTY', () => {
      expect(canTransition(DEAL_STATUS.DRAFT, DEAL_STATUS.AWAITING_COUNTERPARTY)).toBe(true);
    });

    it('should allow AWAITING_COUNTERPARTY → AWAITING_BOTH_APPROVAL', () => {
      expect(canTransition(DEAL_STATUS.AWAITING_COUNTERPARTY, DEAL_STATUS.AWAITING_BOTH_APPROVAL)).toBe(true);
    });

    it('should allow AWAITING_BOTH_APPROVAL → READY_FOR_PAYMENT', () => {
      expect(canTransition(DEAL_STATUS.AWAITING_BOTH_APPROVAL, DEAL_STATUS.READY_FOR_PAYMENT)).toBe(true);
    });

    it('should allow READY_FOR_PAYMENT → PAYMENT_PENDING_VERIFICATION', () => {
      expect(canTransition(DEAL_STATUS.READY_FOR_PAYMENT, DEAL_STATUS.PAYMENT_PENDING_VERIFICATION)).toBe(true);
    });

    it('should allow PAYMENT_PENDING_VERIFICATION → PAID_ESCROWED', () => {
      expect(canTransition(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION, DEAL_STATUS.PAID_ESCROWED)).toBe(true);
    });

    it('should allow PAID_ESCROWED → SELLER_PREPARING', () => {
      expect(canTransition(DEAL_STATUS.PAID_ESCROWED, DEAL_STATUS.SELLER_PREPARING)).toBe(true);
    });

    it('should allow SELLER_PREPARING → SHIPPED', () => {
      expect(canTransition(DEAL_STATUS.SELLER_PREPARING, DEAL_STATUS.SHIPPED)).toBe(true);
    });

    it('should allow SHIPPED → BUYER_CONFIRMED', () => {
      expect(canTransition(DEAL_STATUS.SHIPPED, DEAL_STATUS.BUYER_CONFIRMED)).toBe(true);
    });

    it('should allow BUYER_CONFIRMED → RELEASE_PENDING', () => {
      expect(canTransition(DEAL_STATUS.BUYER_CONFIRMED, DEAL_STATUS.RELEASE_PENDING)).toBe(true);
    });

    it('should allow RELEASE_PENDING → RELEASED', () => {
      expect(canTransition(DEAL_STATUS.RELEASE_PENDING, DEAL_STATUS.RELEASED)).toBe(true);
    });

    it('should allow DISPUTED → RELEASE_PENDING', () => {
      expect(canTransition(DEAL_STATUS.DISPUTED, DEAL_STATUS.RELEASE_PENDING)).toBe(true);
    });

    it('should allow DISPUTED → REFUNDED', () => {
      expect(canTransition(DEAL_STATUS.DISPUTED, DEAL_STATUS.REFUNDED)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should reject SHIPPED → DRAFT', () => {
      expect(canTransition(DEAL_STATUS.SHIPPED, DEAL_STATUS.DRAFT)).toBe(false);
    });

    it('should reject RELEASED → any', () => {
      expect(canTransition(DEAL_STATUS.RELEASED, DEAL_STATUS.DRAFT)).toBe(false);
      expect(canTransition(DEAL_STATUS.RELEASED, DEAL_STATUS.SHIPPED)).toBe(false);
    });

    it('should reject REFUNDED → any', () => {
      expect(canTransition(DEAL_STATUS.REFUNDED, DEAL_STATUS.DRAFT)).toBe(false);
    });

    it('should reject DRAFT → RELEASED', () => {
      expect(canTransition(DEAL_STATUS.DRAFT, DEAL_STATUS.RELEASED)).toBe(false);
    });
  });

  describe('status helpers', () => {
    it('should identify terminal statuses', () => {
      expect(isTerminal(DEAL_STATUS.RELEASED)).toBe(true);
      expect(isTerminal(DEAL_STATUS.REFUNDED)).toBe(true);
      expect(isTerminal(DEAL_STATUS.CANCELLED)).toBe(true);
      expect(isTerminal(DEAL_STATUS.EXPIRED)).toBe(true);
      expect(isTerminal(DEAL_STATUS.DRAFT)).toBe(false);
    });

    it('should identify post-payment statuses', () => {
      expect(canUploadPaymentProof(DEAL_STATUS.READY_FOR_PAYMENT)).toBe(true);
      expect(canUploadPaymentProof(DEAL_STATUS.DRAFT)).toBe(false);
    });

    it('should identify shipping-upload statuses', () => {
      expect(canUploadShippingProof(DEAL_STATUS.PAID_ESCROWED)).toBe(true);
      expect(canUploadShippingProof(DEAL_STATUS.SELLER_PREPARING)).toBe(true);
      expect(canUploadShippingProof(DEAL_STATUS.SHIPPED)).toBe(false);
    });

    it('should identify confirm-received status', () => {
      expect(canConfirmReceived(DEAL_STATUS.SHIPPED)).toBe(true);
      expect(canConfirmReceived(DEAL_STATUS.PAID_ESCROWED)).toBe(false);
    });

    it('should identify dispute-openable statuses', () => {
      expect(canOpenDispute(DEAL_STATUS.PAYMENT_PENDING_VERIFICATION)).toBe(true);
      expect(canOpenDispute(DEAL_STATUS.PAID_ESCROWED)).toBe(true);
      expect(canOpenDispute(DEAL_STATUS.SELLER_PREPARING)).toBe(true);
      expect(canOpenDispute(DEAL_STATUS.SHIPPED)).toBe(true);
      expect(canOpenDispute(DEAL_STATUS.DRAFT)).toBe(false);
    });

    it('should identify cancellable statuses', () => {
      expect(canCancel(DEAL_STATUS.DRAFT)).toBe(true);
      expect(canCancel(DEAL_STATUS.AWAITING_COUNTERPARTY)).toBe(true);
      expect(canCancel(DEAL_STATUS.AWAITING_BOTH_APPROVAL)).toBe(true);
      expect(canCancel(DEAL_STATUS.READY_FOR_PAYMENT)).toBe(false);
    });

    it('should identify joinable status', () => {
      expect(canJoin(DEAL_STATUS.AWAITING_COUNTERPARTY)).toBe(true);
      expect(canJoin(DEAL_STATUS.DRAFT)).toBe(false);
    });
  });
});
