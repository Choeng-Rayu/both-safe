import type { Deal, Participant, Product } from '@prisma/client';

export interface DealLike extends Deal {
  participants: Participant[];
  product: Product | null;
}

export interface MissingFieldReport {
  missing_fields: string[];
  next_required_action: string;
  has_buyer: boolean;
  has_seller: boolean;
  buyer_approved: boolean;
  seller_approved: boolean;
}

export function computeMissingFields(deal: DealLike): MissingFieldReport {
  const missing: string[] = [];
  const buyer = deal.participants.find((p) => p.role === 'buyer');
  const seller = deal.participants.find((p) => p.role === 'seller');

  if (!buyer) missing.push('buyer.identity');
  if (!seller) missing.push('seller.identity');
  if (buyer && !buyer.name) missing.push('buyer.name');
  if (seller && !seller.name) missing.push('seller.name');
  if (!deal.product?.title) missing.push('product.title');
  if (!deal.product?.description) missing.push('product.description');
  if (!deal.amount || deal.amount <= 0) missing.push('deal.amount');
  if (
    seller &&
    !seller.payoutKhqr &&
    !(seller.payoutAccountNumber && seller.payoutBankName)
  ) {
    missing.push('seller.payout');
  }
  if (buyer && !buyer.approvedAt) missing.push('buyer.approval');
  if (seller && !seller.approvedAt) missing.push('seller.approval');

  let next = 'deal.complete';
  if (!buyer || !seller) next = 'invite.counterparty';
  else if (missing.some((m) => m.startsWith('product.') || m === 'deal.amount' || m === 'seller.payout')) {
    next = 'fill.required_fields';
  } else if (!buyer.approvedAt || !seller.approvedAt) next = 'wait.approvals';
  else next = 'deal.complete';

  return {
    missing_fields: missing,
    next_required_action: next,
    has_buyer: !!buyer,
    has_seller: !!seller,
    buyer_approved: !!buyer?.approvedAt,
    seller_approved: !!seller?.approvedAt,
  };
}

export function isReadyForPayment(deal: DealLike): boolean {
  const report = computeMissingFields(deal);
  return (
    report.has_buyer &&
    report.has_seller &&
    report.buyer_approved &&
    report.seller_approved &&
    report.missing_fields.filter(
      (m) => m !== 'buyer.approval' && m !== 'seller.approval',
    ).length === 0
  );
}
