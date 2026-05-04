import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DealStatus,
  PaymentProviderName,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { sha256Hex } from '../common/security/signature.util';
import { EntitlementService } from '../entitlements/entitlement.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PAYMENT_PROVIDERS,
  PaymentProvider,
  PaymentRail,
} from './payment-provider.interface';

@Injectable()
export class PaymentService {
  private readonly providersByRail: Map<PaymentRail, PaymentProvider>;
  private readonly providersByName: Map<PaymentProviderName, PaymentProvider>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly ledger: LedgerService,
    @Inject(PAYMENT_PROVIDERS)
    providers: PaymentProvider[],
  ) {
    this.providersByRail = new Map(
      providers.map((provider) => [provider.rail, provider]),
    );
    this.providersByName = new Map(
      providers.map((provider) => [provider.providerName, provider]),
    );
  }

  getCapabilities() {
    return Array.from(this.providersByRail.values()).map((provider) => ({
      rail: provider.rail,
      provider: provider.providerName,
      ...provider.getCapabilities(),
    }));
  }

  async createCheckoutOrder(dealId: string, rail: PaymentRail) {
    const provider = this.providersByRail.get(rail);

    if (!provider) {
      throw new BadRequestException(`Unsupported payment rail: ${rail}`);
    }

    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { product: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    if (deal.status !== DealStatus.AWAITING_PAYMENT) {
      throw new BadRequestException('Deal is not awaiting payment');
    }

    const merchantTradeNo = `${rail}_${deal.publicCode}_${Date.now()}`;
    const providerOrder = await provider.createOrder({
      dealId: deal.id,
      merchantTradeNo,
      amountMinor: deal.amountMinor,
      currency: deal.currency,
      productId: deal.productId,
      productName: deal.product.title,
      buyerId: deal.buyerId,
    });

    return this.prisma.payment.create({
      data: {
        dealId: deal.id,
        provider: provider.providerName,
        providerOrderId: providerOrder.providerOrderId,
        merchantTradeNo,
        amountMinor: deal.amountMinor,
        currency: deal.currency,
        checkoutUrl: providerOrder.checkoutUrl,
        qrPayload: providerOrder.qrPayload,
        rawProviderJson: providerOrder.rawProviderJson as Prisma.InputJsonValue,
      },
    });
  }

  async handleWebhook(input: {
    providerName: PaymentProviderName;
    rawBody: string;
    parsedBody: Record<string, unknown>;
    headers: Record<string, string | string[] | undefined>;
  }) {
    const provider = this.providersByName.get(input.providerName);

    if (!provider) {
      throw new BadRequestException(
        `Unsupported provider: ${input.providerName}`,
      );
    }

    const verification = await provider.verifyWebhook(input);

    if (!verification.valid) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    const duplicate = await this.prisma.paymentEvent.findUnique({
      where: { providerEventId: verification.providerEventId },
    });

    if (duplicate) {
      return { duplicate: true, paymentEventId: duplicate.id };
    }

    const payment = await this.findPaymentForWebhook({
      providerName: input.providerName,
      merchantTradeNo: verification.merchantTradeNo,
      providerOrderId: verification.providerOrderId,
    });

    const paymentEvent = await this.prisma.paymentEvent.create({
      data: {
        paymentId: payment?.id,
        provider: input.providerName,
        providerEventId: verification.providerEventId,
        eventType: verification.eventType,
        normalizedStatus: verification.normalizedStatus,
        rawPayload: input.parsedBody as Prisma.InputJsonValue,
        rawBodySha256: sha256Hex(input.rawBody),
        signatureValid: true,
        processedAt: new Date(),
      },
    });

    if (!payment) {
      await this.prisma.adminTask.create({
        data: {
          type: 'RECONCILIATION_REVIEW',
          reason: 'Verified webhook could not be matched to a payment',
          metadata: {
            providerEventId: verification.providerEventId,
            providerOrderId: verification.providerOrderId,
            merchantTradeNo: verification.merchantTradeNo,
          },
        },
      });

      return { matched: false, paymentEventId: paymentEvent.id };
    }

    if (verification.normalizedStatus === PaymentStatus.PAID) {
      const providerStatus = await provider.queryOrder(payment.merchantTradeNo);

      if (providerStatus.status !== PaymentStatus.PAID) {
        await this.prisma.adminTask.create({
          data: {
            dealId: payment.dealId,
            type: 'RECONCILIATION_REVIEW',
            reason: 'Webhook says paid but provider query did not confirm paid',
            metadata: {
              webhookStatus: verification.normalizedStatus,
              queryStatus: providerStatus.status,
            },
          },
        });

        return {
          matched: true,
          paymentEventId: paymentEvent.id,
          reconciled: false,
        };
      }

      await this.markPaymentPaid(payment.id, paymentEvent.id);
    }

    if (verification.normalizedStatus === PaymentStatus.REFUNDED) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    return { matched: true, paymentEventId: paymentEvent.id };
  }

  async listPayments() {
    return this.prisma.payment.findMany({
      include: { deal: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async findPaymentForWebhook(input: {
    providerName: PaymentProviderName;
    merchantTradeNo?: string;
    providerOrderId?: string;
  }) {
    if (input.merchantTradeNo) {
      const payment = await this.prisma.payment.findUnique({
        where: { merchantTradeNo: input.merchantTradeNo },
      });

      if (payment) {
        return payment;
      }
    }

    if (input.providerOrderId) {
      return this.prisma.payment.findFirst({
        where: {
          provider: input.providerName,
          providerOrderId: input.providerOrderId,
        },
      });
    }

    return null;
  }

  private async markPaymentPaid(paymentId: string, sourceEventId: string) {
    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        confirmedAt: new Date(),
        deal: {
          update: {
            status: DealStatus.ACCESS_GRANTED,
            releaseAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            disputeDeadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          },
        },
      },
      include: { deal: true },
    });

    await this.ledger.recordBuyerPayment({
      dealId: payment.dealId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      providerReference: payment.providerOrderId ?? payment.merchantTradeNo,
      sourceEventId,
    });
    await this.ledger.recordSellerPayable({
      dealId: payment.dealId,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      sourceEventId,
    });

    const existingEntitlement = await this.prisma.entitlement.findFirst({
      where: {
        sourceId: payment.dealId,
      },
    });

    if (!existingEntitlement) {
      await this.entitlements.grantOneTimeAccess({
        dealId: payment.dealId,
        buyerId: payment.deal.buyerId,
        productId: payment.deal.productId,
        expiresAt: payment.deal.disputeDeadlineAt ?? undefined,
      });
    }
  }
}
