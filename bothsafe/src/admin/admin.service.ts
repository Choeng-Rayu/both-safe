import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminTaskStatus, DealStatus, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { EntitlementService } from '../entitlements/entitlement.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly entitlements: EntitlementService,
  ) {}

  listReviewQueue() {
    return this.prisma.adminTask.findMany({
      where: { status: AdminTaskStatus.OPEN },
      include: { deal: { include: { product: true, disputes: true } } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }

  async decideDeal(input: {
    dealId: string;
    adminId: string;
    decision: 'release' | 'refund';
    note?: string;
  }) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
      include: { disputes: true, payments: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    const hasOpenDispute = deal.disputes.some(
      (dispute) => dispute.status !== 'CLOSED',
    );

    if (input.decision === 'release' && hasOpenDispute) {
      throw new BadRequestException('Cannot release while a dispute is open');
    }

    if (input.decision === 'release') {
      await this.ledger.recordRelease({
        dealId: deal.id,
        amountMinor: deal.amountMinor,
        currency: deal.currency,
        providerReference: `manual_release_${randomUUID()}`,
        createdBy: input.adminId,
      });
      return this.closeDealReview({
        dealId: deal.id,
        adminId: input.adminId,
        status: DealStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAYOUT_SENT,
        note: input.note,
      });
    }

    await this.ledger.recordRefund({
      dealId: deal.id,
      amountMinor: deal.amountMinor,
      currency: deal.currency,
      providerReference: `manual_refund_${randomUUID()}`,
      createdBy: input.adminId,
    });
    await this.entitlements.revokeAccess({
      userId: deal.buyerId,
      productId: deal.productId,
      sourceId: deal.id,
    });

    return this.closeDealReview({
      dealId: deal.id,
      adminId: input.adminId,
      status: DealStatus.REFUNDED,
      paymentStatus: PaymentStatus.REFUNDED,
      note: input.note,
    });
  }

  private async closeDealReview(input: {
    dealId: string;
    adminId: string;
    status: DealStatus;
    paymentStatus: PaymentStatus;
    note?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.update({
        where: { id: input.dealId },
        data: { status: input.status },
      });

      await tx.payment.updateMany({
        where: { dealId: input.dealId },
        data: { status: input.paymentStatus },
      });

      await tx.adminTask.updateMany({
        where: { dealId: input.dealId, status: AdminTaskStatus.OPEN },
        data: {
          status: AdminTaskStatus.APPROVED,
          decidedBy: input.adminId,
          decidedAt: new Date(),
          metadata: input.note ? { note: input.note } : undefined,
        },
      });

      return deal;
    });
  }
}
