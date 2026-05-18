import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../common/services/audit.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { NotificationService } from '../notifications/notification.service';
import { WalletsService } from '../wallets/wallets.service';
import { assertCurrency, toMinorUnits } from '../wallets/helpers/money';
import {
  DEAL_STATUS,
  LEDGER_ENTRY_TYPES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
} from '../common/constants';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly wallets: WalletsService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async payoutSeller(dealId: string, reason = 'buyer_confirmed') {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal) throw new BadRequestException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (
      deal.status !== DEAL_STATUS.RELEASE_PENDING &&
      deal.status !== DEAL_STATUS.DISPUTED
    ) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller?.userId) {
      throw new BadRequestException({ messageKey: 'transfer.missing_seller_user' });
    }

    const currency = assertCurrency(deal.currency);
    const amountMajor = deal.netSellerAmount ?? deal.amount ?? 0;
    if (amountMajor <= 0) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.VALIDATION_FAILED });
    }
    const amountMinor = toMinorUnits(amountMajor, currency);
    const idempotencyKey = `deal_release:${deal.id}`;

    // Ensure wallet exists for seller before entering the transaction.
    await this.wallets.getOrCreateWallet(seller.userId);

    await this.prisma.$transaction(async (tx) => {
      await this.wallets.creditInTx(tx, {
        userId: seller.userId!,
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: amountMinor,
        currency,
        idempotencyKey,
        dealId: deal.id,
        description: `Deal ${deal.publicId} release`,
      });
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.RELEASED },
      });
    });

    if (!(await this.ledger.hasEntry(deal.id, LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT,
        amount: amountMajor,
        currency: deal.currency,
        reference: idempotencyKey,
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'transfer.seller_payout_to_wallet',
      details: { reason, currency, amount_minor: amountMinor.toString() },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
      messageKey: MESSAGE_KEYS.RELEASED_TO_WALLET,
      recipients: [
        ...deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })),
        ...(seller.telegramChatId
          ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }]
          : []),
      ],
      payload: { reference: idempotencyKey, currency, amount_minor: amountMinor.toString() },
    });

    this.logger.log(
      `Released deal ${deal.publicId} to seller wallet (${currency} ${amountMinor})`,
      TransfersService.name,
    );

    return {
      status: DEAL_STATUS.RELEASED,
      provider_reference: idempotencyKey,
      destination: 'wallet',
    };
  }

  async refundBuyer(dealId: string, reason: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true, payments: true },
    });
    if (!deal) throw new BadRequestException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (
      deal.status !== DEAL_STATUS.DISPUTED &&
      deal.status !== DEAL_STATUS.RELEASE_PENDING
    ) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    if (!buyer?.userId) {
      throw new BadRequestException({ messageKey: 'transfer.missing_buyer_user' });
    }

    const payment = deal.payments.find((p) => p.adminStatus === 'verified');
    if (!payment) {
      throw new BadRequestException({ messageKey: 'transfer.no_verified_payment' });
    }

    const currency = assertCurrency(deal.currency);
    const amountMajor = payment.paidAmount ?? deal.amount ?? 0;
    if (amountMajor <= 0) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.VALIDATION_FAILED });
    }
    const amountMinor = toMinorUnits(amountMajor, currency);
    const idempotencyKey = `deal_refund:${deal.id}`;

    await this.wallets.getOrCreateWallet(buyer.userId);

    await this.prisma.$transaction(async (tx) => {
      await this.wallets.creditInTx(tx, {
        userId: buyer.userId!,
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_REFUND_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: amountMinor,
        currency,
        idempotencyKey,
        dealId: deal.id,
        description: `Deal ${deal.publicId} refund`,
      });
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.REFUNDED },
      });
    });

    for (const entryType of [
      LEDGER_ENTRY_TYPES.BUYER_REFUND_PENDING,
      LEDGER_ENTRY_TYPES.BUYER_REFUND_SENT,
    ] as const) {
      if (!(await this.ledger.hasEntry(deal.id, entryType))) {
        await this.ledger.append({
          dealId: deal.id,
          entryType,
          amount: amountMajor,
          currency: deal.currency,
          reference: idempotencyKey,
        });
      }
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'transfer.buyer_refund_to_wallet',
      details: { reason, currency, amount_minor: amountMinor.toString() },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.REFUND_COMPLETED,
      messageKey: MESSAGE_KEYS.REFUNDED_TO_WALLET,
      recipients: [
        { channel: 'inapp' as const, ref: buyer.id },
        ...(buyer.telegramChatId
          ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }]
          : []),
      ],
      payload: { reference: idempotencyKey, currency, amount_minor: amountMinor.toString() },
    });

    this.logger.log(
      `Refunded deal ${deal.publicId} to buyer wallet (${currency} ${amountMinor})`,
      TransfersService.name,
    );

    return {
      status: DEAL_STATUS.REFUNDED,
      provider_reference: idempotencyKey,
      destination: 'wallet',
    };
  }
}
