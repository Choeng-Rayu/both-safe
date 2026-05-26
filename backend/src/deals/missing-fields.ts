import type { Deal, Participant, Product } from '@prisma/client';

export interface DealLike extends Deal {
  participants: Participant[];
  product: Product | null;
}

/**
 * Required fields before the buyer can pay.
 *
 * The flow has been simplified to remove all unnecessary friction:
 * the only items truly needed before money changes hands are the
 * product title, the amount, the buyer name and the seller name.
 * Product type / description / phone numbers are now optional and
 * can be filled in later inside the deal room without blocking the
 * payment step.
 *
 * Payout details are not collected at all — released funds go to the
 * seller's BothSafe wallet automatically.
 */
export function computeMissingFields(deal: DealLike): string[] {
  const missing: string[] = [];

  // Product fields
  if (!deal.product?.title) missing.push('product.title');
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
