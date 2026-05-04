import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminTaskType, DealStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  async createDigitalDeal(input: { buyerId: string; productId: string }) {
    const product = await this.prisma.digitalProduct.findUnique({
      where: { id: input.productId },
      include: { seller: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== 'LISTED' && product.status !== 'APPROVED') {
      throw new BadRequestException(
        'Product is not available for protected checkout',
      );
    }

    return this.prisma.deal.create({
      data: {
        publicCode: this.makePublicCode(),
        buyerId: input.buyerId,
        sellerId: product.seller.userId,
        productId: product.id,
        amountMinor: product.priceMinor,
        currency: product.currency,
        status: DealStatus.AWAITING_PAYMENT,
      },
      include: { product: true },
    });
  }

  listDeals() {
    return this.prisma.deal.findMany({
      include: {
        product: true,
        payments: true,
        disputes: true,
        adminTasks: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  getDeal(id: string) {
    return this.prisma.deal.findUnique({
      where: { id },
      include: {
        product: true,
        payments: true,
        accessGrants: true,
        disputes: true,
        adminTasks: true,
      },
    });
  }

  async buyerConfirm(dealId: string, buyerId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { disputes: true },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    if (deal.buyerId !== buyerId) {
      throw new BadRequestException('Only the buyer can confirm this deal');
    }

    if (deal.disputes.some((dispute) => dispute.status !== 'CLOSED')) {
      throw new BadRequestException(
        'Cannot confirm a deal while dispute is open',
      );
    }

    if (deal.status !== DealStatus.ACCESS_GRANTED) {
      throw new BadRequestException('Deal is not ready for buyer confirmation');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deal.update({
        where: { id: dealId },
        data: { status: DealStatus.RELEASE_REVIEW },
      });

      await tx.adminTask.create({
        data: {
          dealId,
          type: AdminTaskType.RELEASE_REVIEW,
          reason:
            'Buyer confirmed secured digital delivery. Manual release approval required in V1.',
        },
      });

      return updated;
    });
  }

  async createAutoReleaseCandidates(now = new Date()) {
    const deals = await this.prisma.deal.findMany({
      where: {
        status: DealStatus.ACCESS_GRANTED,
        releaseAt: { lte: now },
        disputes: { none: { status: { not: 'CLOSED' } } },
      },
      take: 100,
    });

    for (const deal of deals) {
      await this.prisma.$transaction(async (tx) => {
        await tx.deal.update({
          where: { id: deal.id },
          data: { status: DealStatus.RELEASE_REVIEW },
        });
        await tx.adminTask.create({
          data: {
            dealId: deal.id,
            type: AdminTaskType.RELEASE_REVIEW,
            reason:
              'Auto-release window elapsed. Manual release approval required in V1.',
          },
        });
      });
    }

    return { created: deals.length };
  }

  private makePublicCode(): string {
    return `BS-${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
