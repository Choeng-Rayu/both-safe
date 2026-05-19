import type { Deal, Participant, Product } from '@prisma/client';

export interface DealLike extends Deal {
  participants: Participant[];
  product: Product | null;
}

/**
 * Compute missing required fields per Kiro spec Requirement 4.
 * Checked fields: product_title, product_type, amount, buyer_name, seller_name
 *
 * Payout details are no longer required — released funds go to the seller's
 * internal BothSafe wallet automatically. Sellers withdraw via /wallet/withdraw.
 */
export function computeMissingFields(deal: DealLike): string[] {
  const missing: string[] = [];

  // Product fields
  if (!deal.product?.title) missing.push('product.title');
  if (!deal.product?.type) missing.push('product.type');
  if (!deal.amount || deal.amount <= 0) missing.push('product.amount');

  // Participant fields
  const buyer = deal.participants.find((p) => p.role === 'buyer');
  const seller = deal.participants.find((p) => p.role === 'seller');

  if (!buyer) {
    missing.push('buyer');
  } else if (!buyer.name) {
    missing.push('buyer.name');
  }

  if (!seller) {
    missing.push('seller');
  } else if (!seller.name) {
    missing.push('seller.name');
  }

  return missing;
}
