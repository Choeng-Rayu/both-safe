import type { Deal, Participant, Product } from '@prisma/client';
import { DEAL_STATUS } from '../common/constants';

export interface DealLike extends Deal {
  participants: Participant[];
  product: Product | null;
}

export interface MissingFieldReport {
  missing_fields: string[];
  next_required_action: string;
  has_buyer: boolean;
  has_seller: boolean;
}

export function computeMissingFields(deal: DealLike): MissingFieldReport {
  const missing: string[] = [];
  const buyer = deal.participants.find((p) => p.role === 'buyer');
  const seller = deal.participants.find((p) => p.role === 'seller');
  const status = deal.status;

  if (!buyer) missing.push('buyer.identity');
  if (!seller) missing.push('seller.identity');
  if (buyer && !buyer.name) missing.push('buyer.name');
  if (seller && !seller.name) missing.push('seller.name');
  if (!deal.product?.title) missing.push('product.title');
  if (!deal.amount || deal.amount <= 0) missing.push('deal.amount');

  // Payout required for seller — but only surface this warning when seller exists
  if (seller && !seller.payoutKhqr && !(seller.payoutAccountNumber && seller.payoutBankName)) {
    // Payout is optional until seller accepts; show as soft warning
    if ([DEAL_STATUS.SELLER_ACCEPTED_PACKING, DEAL_STATUS.PAID_ESCROWED, DEAL_STATUS.SHIPPED].includes(status as any)) {
      missing.push('seller.payout');
    }
  }

  // Determine next required action for UI hint
  let next = 'deal.complete';
  if (!deal.product?.title || !deal.amount) next = 'fill.product_details';
  else if (!buyer) next = 'invite.buyer';
  else if (!seller) next = 'invite.seller';
  else if (status === DEAL_STATUS.PENDING_BUYER_PAYMENT) next = 'buyer.pay';
  else if (status === DEAL_STATUS.PENDING_SELLER_APPROVAL) next = 'buyer.pay_or_wait_seller';
  else if (status === DEAL_STATUS.PAYMENT_PENDING_VERIFICATION) next = 'wait.payment_auto_verify';
  else if (status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL) next = 'wait.seller_accept';
  else if (status === DEAL_STATUS.SELLER_ACCEPTED_PACKING) next = 'seller.ship';
  else if (status === DEAL_STATUS.PAID_ESCROWED) next = 'seller.ship';
  else if (status === DEAL_STATUS.SHIPPED) next = 'buyer.confirm';
  else if (status === DEAL_STATUS.DISPUTED) next = 'wait.admin_dispute';
  else next = 'deal.complete';

  return {
    missing_fields: missing,
    next_required_action: next,
    has_buyer: !!buyer,
    has_seller: !!seller,
  };
}
