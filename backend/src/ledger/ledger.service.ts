import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type EntryType =
  | 'ESCROW_RECEIVED'
  | 'PLATFORM_FEE_RESERVED'
  | 'SELLER_PAYOUT_PENDING'
  | 'SELLER_PAYOUT_SENT'
  | 'BUYER_REFUND_PENDING'
  | 'BUYER_REFUND_SENT'
  | 'ADJUSTMENT';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: {
    dealId: string;
    entryType: EntryType;
    amount: number;
    currency: string;
    reference?: string;
    createdByAdminId?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: {
        dealId: input.dealId,
        entryType: input.entryType,
        amount: input.amount,
        currency: input.currency,
        reference: input.reference ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      },
    });
  }

  async list(dealId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Returns whether a given entry type already exists for a deal — used for idempotency.
  async hasEntry(dealId: string, entryType: EntryType): Promise<boolean> {
    const found = await this.prisma.ledgerEntry.findFirst({
      where: { dealId, entryType },
    });
    return !!found;
  }
}
