import { Injectable } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async recordBuyerPayment(input: {
    dealId: string;
    amountMinor: bigint;
    currency: string;
    providerReference?: string;
    sourceEventId?: string;
  }) {
    const existing = await this.prisma.ledgerEntry.findFirst({
      where: {
        dealId: input.dealId,
        entryType: LedgerEntryType.BUYER_PAYMENT,
        sourceEventId: input.sourceEventId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.ledgerEntry.create({
      data: {
        dealId: input.dealId,
        entryType: LedgerEntryType.BUYER_PAYMENT,
        debitAccount: 'provider_protected_funds',
        creditAccount: 'buyer_payment_obligation',
        amountMinor: input.amountMinor,
        currency: input.currency,
        providerReference: input.providerReference,
        sourceEventId: input.sourceEventId,
      },
    });
  }

  async recordSellerPayable(input: {
    dealId: string;
    amountMinor: bigint;
    currency: string;
    sourceEventId?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: {
        dealId: input.dealId,
        entryType: LedgerEntryType.SELLER_PAYABLE,
        debitAccount: 'buyer_payment_obligation',
        creditAccount: 'seller_payable_pending_manual_release',
        amountMinor: input.amountMinor,
        currency: input.currency,
        sourceEventId: input.sourceEventId,
      },
    });
  }

  async recordRelease(input: {
    dealId: string;
    amountMinor: bigint;
    currency: string;
    providerReference?: string;
    createdBy?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: {
        dealId: input.dealId,
        entryType: LedgerEntryType.PAYOUT_SENT,
        debitAccount: 'seller_payable_pending_manual_release',
        creditAccount: 'provider_payout_sent',
        amountMinor: input.amountMinor,
        currency: input.currency,
        providerReference: input.providerReference,
        createdBy: input.createdBy,
      },
    });
  }

  async recordRefund(input: {
    dealId: string;
    amountMinor: bigint;
    currency: string;
    providerReference?: string;
    createdBy?: string;
  }) {
    return this.prisma.ledgerEntry.create({
      data: {
        dealId: input.dealId,
        entryType: LedgerEntryType.REFUND_SENT,
        debitAccount: 'refund_liability',
        creditAccount: 'provider_refund_sent',
        amountMinor: input.amountMinor,
        currency: input.currency,
        providerReference: input.providerReference,
        createdBy: input.createdBy,
      },
    });
  }

  listDealLedger(dealId: string) {
    return this.prisma.ledgerEntry.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
