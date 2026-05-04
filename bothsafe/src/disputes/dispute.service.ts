import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DealStatus, EntitlementStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputeService {
  constructor(private readonly prisma: PrismaService) {}

  async openDispute(input: {
    dealId: string;
    openedById: string;
    reason: string;
  }) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: input.dealId },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    if (
      deal.status === DealStatus.COMPLETED ||
      deal.status === DealStatus.REFUNDED
    ) {
      throw new BadRequestException(
        'Completed or refunded deals cannot be disputed',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({
        data: {
          dealId: input.dealId,
          openedById: input.openedById,
          reason: input.reason,
        },
      });

      await tx.deal.update({
        where: { id: input.dealId },
        data: { status: DealStatus.DISPUTED },
      });

      await tx.entitlement.updateMany({
        where: { sourceId: input.dealId, status: EntitlementStatus.ACTIVE },
        data: { status: EntitlementStatus.DISPUTED },
      });

      return dispute;
    });
  }

  addMessage(input: {
    disputeId: string;
    senderId: string;
    message: string;
    evidenceUrl?: string;
  }) {
    return this.prisma.disputeMessage.create({
      data: input,
    });
  }

  listDisputes() {
    return this.prisma.dispute.findMany({
      include: { deal: true, messages: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
