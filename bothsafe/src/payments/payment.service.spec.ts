/* eslint-disable @typescript-eslint/unbound-method */
import { PaymentProviderName, PaymentStatus } from '@prisma/client';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { PaymentProvider } from './payment-provider.interface';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
  function makeService(overrides?: {
    paymentEventFindUnique?: jest.Mock;
    provider?: Partial<PaymentProvider>;
  }) {
    const prisma = {
      paymentEvent: {
        findUnique:
          overrides?.paymentEventFindUnique ??
          jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'evt_1' }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'pay_1',
          dealId: 'deal_1',
          merchantTradeNo: 'order_1',
          providerOrderId: 'provider_order_1',
          amountMinor: 1000n,
          currency: 'USD',
        }),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'pay_1',
          dealId: 'deal_1',
          merchantTradeNo: 'order_1',
          providerOrderId: 'provider_order_1',
          amountMinor: 1000n,
          currency: 'USD',
          deal: {
            buyerId: 'buyer_1',
            productId: 'product_1',
            disputeDeadlineAt: new Date(),
          },
        }),
      },
      entitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      adminTask: {
        create: jest.fn(),
      },
    } as unknown as PrismaService;
    const ledger = {
      recordBuyerPayment: jest.fn(),
      recordSellerPayable: jest.fn(),
    } as unknown as LedgerService;
    const entitlements = {
      grantOneTimeAccess: jest.fn(),
    } as unknown as EntitlementService;
    const provider = {
      rail: 'binance',
      providerName: PaymentProviderName.BINANCE,
      verifyWebhook: jest.fn().mockResolvedValue({
        valid: true,
        providerEventId: 'evt_1',
        eventType: 'PAY',
        merchantTradeNo: 'order_1',
        providerOrderId: 'provider_order_1',
        normalizedStatus: PaymentStatus.PAID,
      }),
      queryOrder: jest.fn().mockResolvedValue({ status: PaymentStatus.PAID }),
      getCapabilities: jest.fn(),
      ...overrides?.provider,
    } as unknown as PaymentProvider;

    return {
      service: new PaymentService(prisma, entitlements, ledger, [provider]),
      prisma,
      ledger,
      entitlements,
      provider,
    };
  }

  it('does not process duplicate webhooks twice', async () => {
    const existingEvent = { id: 'evt_existing' };
    const { service, prisma } = makeService({
      paymentEventFindUnique: jest.fn().mockResolvedValue(existingEvent),
    });

    const result = await service.handleWebhook({
      providerName: PaymentProviderName.BINANCE,
      rawBody: '{}',
      parsedBody: {},
      headers: {},
    });

    expect(result).toEqual({ duplicate: true, paymentEventId: 'evt_existing' });
    const createPaymentEvent = prisma.paymentEvent.create as jest.Mock;
    expect(createPaymentEvent).not.toHaveBeenCalled();
  });

  it('grants access only after verified webhook and provider query both say paid', async () => {
    const { service, ledger, entitlements, provider } = makeService();

    await service.handleWebhook({
      providerName: PaymentProviderName.BINANCE,
      rawBody: '{}',
      parsedBody: {},
      headers: {},
    });

    const queryOrder = provider.queryOrder as jest.Mock;
    const recordBuyerPayment = ledger.recordBuyerPayment as jest.Mock;
    const recordSellerPayable = ledger.recordSellerPayable as jest.Mock;
    const grantOneTimeAccess = entitlements.grantOneTimeAccess as jest.Mock;

    expect(queryOrder).toHaveBeenCalledWith('order_1');
    expect(recordBuyerPayment).toHaveBeenCalled();
    expect(recordSellerPayable).toHaveBeenCalled();
    expect(grantOneTimeAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: 'deal_1',
        buyerId: 'buyer_1',
        productId: 'product_1',
      }),
    );
  });
});
