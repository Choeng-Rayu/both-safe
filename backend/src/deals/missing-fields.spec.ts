import { computeMissingFields, DealLike } from './missing-fields';
import { DEAL_STATUS } from '../common/constants';

describe('MissingFieldsCalculator (Kiro spec)', () => {
  const baseDeal = (overrides?: Partial<DealLike>): DealLike =>
    ({
      id: 'deal-1',
      publicId: 'abc123',
      creatorRole: 'buyer',
      source: 'web',
      status: DEAL_STATUS.DRAFT,
      currency: 'USD',
      amount: null,
      feeAmount: null,
      netSellerAmount: null,
      createdByUserId: null,
      createdByTelegramChatId: null,
      inviteTokenHash: null,
      creatorAccessTokenHash: 'hash',
      inviteExpiresAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [],
      product: null,
      ...overrides,
    } as DealLike);

  it('should identify missing product title', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: null, type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('product.title');
  });

  it('should identify missing product type', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: null } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('product.type');
  });

  it('should identify missing amount', () => {
    const deal = baseDeal({
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('product.amount');
  });

  it('should identify missing buyer', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('buyer');
  });

  it('should identify missing buyer name', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: null } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('buyer.name');
  });

  it('should identify missing seller', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('seller');
  });

  it('should identify missing seller name', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: null, payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('seller.name');
  });

  it('should identify missing seller payout KHQR', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: null, payoutBankName: null, payoutAccountNumber: null } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toContain('seller.payout_khqr');
  });

  it('should NOT flag payout missing if bank details provided', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: null, payoutBankName: 'ABA', payoutAccountNumber: '12345' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).not.toContain('seller.payout_khqr');
  });

  it('should return empty array when all fields complete', () => {
    const deal = baseDeal({
      amount: 100,
      participants: [{ role: 'buyer', name: 'John' } as any, { role: 'seller', name: 'Jane', payoutKhqrImage: 'https://img' } as any],
      product: { title: 'iPhone', type: 'electronics' } as any,
    });
    const missing = computeMissingFields(deal);
    expect(missing).toEqual([]);
  });
});
