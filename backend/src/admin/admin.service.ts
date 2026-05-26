import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../common/services/audit.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import { NotificationService } from '../notifications/notification.service';
import { WalletsService } from '../wallets/wallets.service';
import { assertCurrency, toMinorUnits } from '../wallets/helpers/money';
import {
  DEAL_STATUS,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
} from '../common/constants';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly wallets: WalletsService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async listDeals(query: {
    status?: string;
    from_date?: string;
    to_date?: string;
    search?: string;
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? '20')));
    const where: any = {};

    if (query.status) where.status = query.status;
    if (query.from_date || query.to_date) {
      where.createdAt = {};
      if (query.from_date) where.createdAt.gte = new Date(query.from_date);
      if (query.to_date) where.createdAt.lte = new Date(query.to_date);
    }
    if (query.search) {
      where.OR = [
        { publicId: { contains: query.search, mode: 'insensitive' } },
        {
          participants: {
            some: { name: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { participants: true, product: true },
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async getDeal(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        participants: true,
        product: true,
        payments: true,
        shipping: true,
        disputes: true,
        ledgerEntries: true,
      },
    });
    if (!deal)
      throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    return deal;
  }

  async listPendingPayments() {
    return this.prisma.payment.findMany({
      where: { adminStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { deal: { include: { participants: true, product: true } } },
    });
  }

  async release(
    dealId: string,
    body: {
      payout_reference: string;
      admin_note?: string;
      idempotency_key?: string;
    },
    adminId: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal)
      throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

    if (body.idempotency_key) {
      const found = await this.prisma.idempotencyKey.findUnique({
        where: { key: body.idempotency_key },
      });
      if (found && found.scope === 'admin.release') {
        return found.responseJson
          ? JSON.parse(found.responseJson)
          : { status: deal.status };
      }
    }

    if (deal.status === DEAL_STATUS.RELEASED) {
      throw new ConflictException({ messageKey: 'admin.already_released' });
    }
    if (
      deal.status !== DEAL_STATUS.RELEASE_PENDING &&
      deal.status !== DEAL_STATUS.DISPUTED
    ) {
      throw new BadRequestException({
        messageKey: 'admin.not_ready_for_release',
      });
    }

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller) {
      throw new BadRequestException({
        messageKey: 'transfer.missing_seller_user',
      });
    }
    const sellerUserId = await this.resolveParticipantUserId(seller);
    if (!sellerUserId) {
      throw new BadRequestException({
        messageKey: 'transfer.missing_seller_user',
      });
    }

    const currency = assertCurrency(deal.currency);
    const amountMajor = deal.netSellerAmount ?? deal.amount ?? 0;
    if (amountMajor <= 0) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
      });
    }
    const amountMinor = toMinorUnits(amountMajor, currency);
    const walletIdempotencyKey = `deal_release:${deal.id}`;

    // Pre-create wallet outside transaction to avoid nested concurrency issues.
    await this.wallets.getOrCreateWallet(sellerUserId);

    if (!(await this.ledger.hasEntry(deal.id, 'SELLER_PAYOUT_PENDING'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'SELLER_PAYOUT_PENDING',
        amount: amountMajor,
        currency: deal.currency,
        reference: body.payout_reference,
        createdByAdminId: adminId,
      });
    }

    // Atomically credit the seller's wallet, mark deal RELEASED, resolve disputes.
    await this.prisma.$transaction(async (tx) => {
      await this.wallets.creditInTx(tx, {
        userId: sellerUserId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: amountMinor,
        currency,
        idempotencyKey: walletIdempotencyKey,
        dealId: deal.id,
        createdByAdminId: adminId,
        description: `Deal ${deal.publicId} release`,
      });
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.RELEASED },
      });
      await tx.dispute.updateMany({
        where: { dealId: deal.id, status: { in: ['open', 'under_review'] } },
        data: {
          status: 'resolved_release',
          adminNote: body.admin_note ?? null,
          resolvedAt: new Date(),
        },
      });
    });

    if (!(await this.ledger.hasEntry(deal.id, 'SELLER_PAYOUT_SENT'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'SELLER_PAYOUT_SENT',
        amount: amountMajor,
        currency: deal.currency,
        reference: body.payout_reference,
        createdByAdminId: adminId,
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'admin',
      actorId: adminId,
      action: 'admin.released_to_wallet',
      details: {
        reference: body.payout_reference,
        note: body.admin_note,
        wallet_idempotency_key: walletIdempotencyKey,
        amount_minor: amountMinor.toString(),
        currency,
      },
    });
    this.logger.action('admin.release', {
      deal_id: deal.id,
      admin_id: adminId,
      reference: body.payout_reference,
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
      messageKey: MESSAGE_KEYS.RELEASED_TO_WALLET,
      recipients: [
        { channel: 'inapp' as const, ref: seller.id },
        ...(seller.telegramChatId
          ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }]
          : []),
      ],
      payload: {
        currency,
        amount_minor: amountMinor.toString(),
      },
    });

    const result = {
      status: DEAL_STATUS.RELEASED,
      ledger_entries: await this.ledger.list(deal.id),
    };

    if (body.idempotency_key) {
      await this.prisma.idempotencyKey.upsert({
        where: { key: body.idempotency_key },
        update: {
          scope: 'admin.release',
          responseJson: JSON.stringify(result),
        },
        create: {
          key: body.idempotency_key,
          scope: 'admin.release',
          responseJson: JSON.stringify(result),
        },
      });
    }

    return result;
  }

  async refund(
    dealId: string,
    body: {
      refund_reference: string;
      admin_note?: string;
      idempotency_key?: string;
    },
    adminId: string,
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true },
    });
    if (!deal)
      throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

    if (body.idempotency_key) {
      const found = await this.prisma.idempotencyKey.findUnique({
        where: { key: body.idempotency_key },
      });
      if (found && found.scope === 'admin.refund') {
        return found.responseJson
          ? JSON.parse(found.responseJson)
          : { status: deal.status };
      }
    }

    if (deal.status === DEAL_STATUS.REFUNDED) {
      throw new ConflictException({ messageKey: 'admin.already_refunded' });
    }
    if (
      deal.status !== DEAL_STATUS.DISPUTED &&
      deal.status !== DEAL_STATUS.RELEASE_PENDING
    ) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.INVALID_TRANSITION,
      });
    }

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    if (!buyer) {
      throw new BadRequestException({
        messageKey: 'transfer.missing_buyer_user',
      });
    }
    const buyerUserId = await this.resolveParticipantUserId(buyer);
    if (!buyerUserId) {
      throw new BadRequestException({
        messageKey: 'transfer.missing_buyer_user',
      });
    }

    const currency = assertCurrency(deal.currency);
    const amountMajor = deal.amount ?? 0;
    if (amountMajor <= 0) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
      });
    }
    const amountMinor = toMinorUnits(amountMajor, currency);
    const walletIdempotencyKey = `deal_refund:${deal.id}`;

    await this.wallets.getOrCreateWallet(buyerUserId);

    if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_PENDING'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'BUYER_REFUND_PENDING',
        amount: amountMajor,
        currency: deal.currency,
        reference: body.refund_reference,
        createdByAdminId: adminId,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await this.wallets.creditInTx(tx, {
        userId: buyerUserId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_REFUND_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: amountMinor,
        currency,
        idempotencyKey: walletIdempotencyKey,
        dealId: deal.id,
        createdByAdminId: adminId,
        description: `Deal ${deal.publicId} refund`,
      });
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.REFUNDED },
      });
      await tx.dispute.updateMany({
        where: { dealId: deal.id, status: { in: ['open', 'under_review'] } },
        data: {
          status: 'resolved_refund',
          adminNote: body.admin_note ?? null,
          resolvedAt: new Date(),
        },
      });
    });

    if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_SENT'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'BUYER_REFUND_SENT',
        amount: amountMajor,
        currency: deal.currency,
        reference: body.refund_reference,
        createdByAdminId: adminId,
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'admin',
      actorId: adminId,
      action: 'admin.refunded_to_wallet',
      details: {
        reference: body.refund_reference,
        note: body.admin_note,
        wallet_idempotency_key: walletIdempotencyKey,
        amount_minor: amountMinor.toString(),
        currency,
      },
    });
    this.logger.action('admin.refund', {
      deal_id: deal.id,
      admin_id: adminId,
      reference: body.refund_reference,
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
      payload: {
        currency,
        amount_minor: amountMinor.toString(),
      },
    });

    const result = {
      status: DEAL_STATUS.REFUNDED,
      ledger_entries: await this.ledger.list(deal.id),
    };

    if (body.idempotency_key) {
      await this.prisma.idempotencyKey.upsert({
        where: { key: body.idempotency_key },
        update: { scope: 'admin.refund', responseJson: JSON.stringify(result) },
        create: {
          key: body.idempotency_key,
          scope: 'admin.refund',
          responseJson: JSON.stringify(result),
        },
      });
    }

    return result;
  }

  async resolveDispute(
    disputeId: string,
    dto: {
      decision: 'release' | 'refund';
      admin_note?: string;
      payout_reference?: string;
      refund_reference?: string;
    },
    adminId: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { deal: { include: { participants: true } } },
    });
    if (!dispute)
      throw new NotFoundException({ messageKey: 'dispute.not_found' });
    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new ConflictException({ messageKey: 'dispute.already_resolved' });
    }

    const deal = dispute.deal;

    if (dto.decision === 'release') {
      if (!dto.payout_reference)
        throw new BadRequestException({
          messageKey: 'admin.payout_reference_required',
        });

      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'resolved_release',
          adminNote: dto.admin_note ?? null,
          resolvedAt: new Date(),
        },
      });

      // Create ledger entry for seller payout
      if (!(await this.ledger.hasEntry(deal.id, 'SELLER_PAYOUT_PENDING'))) {
        await this.ledger.append({
          dealId: deal.id,
          entryType: 'SELLER_PAYOUT_PENDING',
          amount: deal.netSellerAmount ?? deal.amount ?? 0,
          currency: deal.currency,
          reference: dto.payout_reference,
          createdByAdminId: adminId,
        });
      }

      await this.prisma.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.RELEASE_PENDING },
      });

      await this.audit.record({
        dealId: deal.id,
        actorType: 'admin',
        actorId: adminId,
        action: 'dispute.resolved_release',
        details: {
          dispute_id: disputeId,
          note: dto.admin_note,
          payout_reference: dto.payout_reference,
        },
      });
      this.logger.action('dispute.resolved_release', {
        deal_id: deal.id,
        admin_id: adminId,
        dispute_id: disputeId,
      });

      const seller = deal.participants.find((p) => p.role === 'seller');
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
        messageKey: MESSAGE_KEYS.RELEASED,
        recipients: [
          ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
          ...(seller?.telegramChatId
            ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }]
            : []),
        ],
      });

      return {
        status: DEAL_STATUS.RELEASE_PENDING,
        dispute_status: 'resolved_release',
      };
    } else {
      // refund decision
      if (!dto.refund_reference)
        throw new BadRequestException({
          messageKey: 'admin.refund_reference_required',
        });

      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'resolved_refund',
          adminNote: dto.admin_note ?? null,
          resolvedAt: new Date(),
        },
      });

      if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_PENDING'))) {
        await this.ledger.append({
          dealId: deal.id,
          entryType: 'BUYER_REFUND_PENDING',
          amount: deal.amount ?? 0,
          currency: deal.currency,
          reference: dto.refund_reference,
          createdByAdminId: adminId,
        });
      }
      if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_SENT'))) {
        await this.ledger.append({
          dealId: deal.id,
          entryType: 'BUYER_REFUND_SENT',
          amount: deal.amount ?? 0,
          currency: deal.currency,
          reference: dto.refund_reference,
          createdByAdminId: adminId,
        });
      }

      await this.prisma.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.REFUNDED },
      });

      await this.audit.record({
        dealId: deal.id,
        actorType: 'admin',
        actorId: adminId,
        action: 'dispute.resolved_refund',
        details: {
          dispute_id: disputeId,
          note: dto.admin_note,
          refund_reference: dto.refund_reference,
        },
      });
      this.logger.action('dispute.resolved_refund', {
        deal_id: deal.id,
        admin_id: adminId,
        dispute_id: disputeId,
      });

      const buyer = deal.participants.find((p) => p.role === 'buyer');
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.REFUND_COMPLETED,
        messageKey: MESSAGE_KEYS.REFUNDED,
        recipients: [
          ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
          ...(buyer?.telegramChatId
            ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }]
            : []),
        ],
      });

      return {
        status: DEAL_STATUS.REFUNDED,
        dispute_status: 'resolved_refund',
      };
    }
  }

  async addNote(dealId: string, note: string, adminId: string) {
    return this.audit.record({
      dealId,
      actorType: 'admin',
      actorId: adminId,
      action: 'admin.note',
      details: { note },
    });
  }

  async auditLog(dealId: string) {
    return this.prisma.auditLog.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Paginated admin view of every piece of feedback users have left
   * across all deals. Supports filtering by minimum rating and by
   * role so the team can spot dissatisfied users quickly.
   */
  /**
   * High-level dashboard counters surfaced to the admin landing page.
   * Single round-trip: every figure here is a small COUNT/SUM that
   * Postgres can answer in milliseconds even at scale.
   */
  async overviewStats() {
    const dealStatuses = [
      'DRAFT',
      'AWAITING_COUNTERPARTY',
      'AWAITING_BOTH_APPROVAL',
      'READY_FOR_PAYMENT',
      'PAYMENT_PENDING_VERIFICATION',
      'PAID_ESCROWED',
      'SELLER_PREPARING',
      'SHIPPED',
      'BUYER_CONFIRMED',
      'RELEASE_PENDING',
      'RELEASED',
      'REFUNDED',
      'CANCELLED',
      'EXPIRED',
      'DISPUTED',
    ] as const;
    const withdrawalStatuses = [
      'PENDING_REVIEW',
      'APPROVED',
      'PROCESSING',
      'COMPLETED',
      'REJECTED',
      'FAILED',
      'CANCELLED',
    ] as const;

    const [
      userTotal,
      userActive,
      userDisabled,
      adminCount,
      dealTotal,
      walletTotals,
      walletWithBalance,
      feedbackAgg,
      lowFeedbackCount,
      ...counts
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { disabled: false, role: 'USER' } }),
      this.prisma.user.count({ where: { disabled: true } }),
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.deal.count(),
      this.prisma.wallet.aggregate({
        _sum: { availableUsd: true, availableKhr: true },
      }),
      this.prisma.wallet.count({
        where: {
          OR: [{ availableUsd: { gt: 0n } }, { availableKhr: { gt: 0n } }],
        },
      }),
      this.prisma.dealFeedback.aggregate({
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.dealFeedback.count({ where: { rating: { lte: 2 } } }),
      ...dealStatuses.map((status) =>
        this.prisma.deal.count({ where: { status } }),
      ),
      ...withdrawalStatuses.map((status) =>
        this.prisma.withdrawal.count({ where: { status } }),
      ),
      ...withdrawalStatuses.map((status) =>
        this.prisma.withdrawal.aggregate({
          where: { status },
          _sum: { amount: true },
        }),
      ),
    ]);

    const dealCountResults = counts.slice(0, dealStatuses.length) as number[];
    const withdrawalCountResults = counts.slice(
      dealStatuses.length,
      dealStatuses.length + withdrawalStatuses.length,
    ) as number[];
    const withdrawalAggResults = counts.slice(
      dealStatuses.length + withdrawalStatuses.length,
    ) as { _sum: { amount: bigint | null } }[];

    const dealsByStatus: Record<string, number> = {};
    dealStatuses.forEach((status, i) => {
      dealsByStatus[status] = dealCountResults[i];
    });

    const withdrawalsByStatus: Record<
      string,
      { count: number; amount_minor: string }
    > = {};
    withdrawalStatuses.forEach((status, i) => {
      withdrawalsByStatus[status] = {
        count: withdrawalCountResults[i],
        amount_minor: (withdrawalAggResults[i]._sum.amount ?? 0n).toString(),
      };
    });

    // "In escrow" = deals where the buyer has paid but the seller
    // hasn't been credited yet. These are the funds BothSafe is
    // currently holding on behalf of users.
    const inEscrowStatuses = [
      'PAID_ESCROWED',
      'SELLER_PREPARING',
      'SHIPPED',
      'BUYER_CONFIRMED',
      'RELEASE_PENDING',
      'DISPUTED',
    ];
    const inEscrowCount = inEscrowStatuses.reduce(
      (acc, status) => acc + (dealsByStatus[status] ?? 0),
      0,
    );

    return {
      users: {
        total: userTotal,
        active: userActive,
        disabled: userDisabled,
        admins: adminCount,
      },
      deals: {
        total: dealTotal,
        in_escrow: inEscrowCount,
        by_status: dealsByStatus,
      },
      wallets: {
        total_usd_minor: (walletTotals._sum.availableUsd ?? 0n).toString(),
        total_khr_minor: (walletTotals._sum.availableKhr ?? 0n).toString(),
        users_with_balance: walletWithBalance,
      },
      withdrawals: {
        pending_review: withdrawalsByStatus['PENDING_REVIEW']?.count ?? 0,
        approved: withdrawalsByStatus['APPROVED']?.count ?? 0,
        processing: withdrawalsByStatus['PROCESSING']?.count ?? 0,
        completed: withdrawalsByStatus['COMPLETED']?.count ?? 0,
        rejected: withdrawalsByStatus['REJECTED']?.count ?? 0,
        cancelled: withdrawalsByStatus['CANCELLED']?.count ?? 0,
        by_status: withdrawalsByStatus,
      },
      feedback: {
        total: feedbackAgg._count,
        avg_rating: feedbackAgg._avg.rating
          ? +feedbackAgg._avg.rating.toFixed(2)
          : null,
        low_rating_count: lowFeedbackCount,
      },
    };
  }

  async listFeedback(query: {
    minRating?: string;
    role?: string;
    page?: string;
    pageSize?: string;
  }) {
    const page = Math.max(1, Number(query.page ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? '25')));

    const where: any = {};
    if (query.minRating) {
      const min = Number(query.minRating);
      if (Number.isFinite(min)) where.rating = { gte: min };
    }
    if (query.role === 'buyer' || query.role === 'seller') {
      where.role = query.role;
    }

    const [items, total, summary] = await this.prisma.$transaction([
      this.prisma.dealFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          deal: { select: { id: true, publicId: true, status: true } },
          user: { select: { id: true, email: true, name: true } },
          participant: { select: { id: true, name: true } },
        },
      }),
      this.prisma.dealFeedback.count({ where }),
      this.prisma.dealFeedback.aggregate({
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    return {
      items: items.map((f) => ({
        id: f.id,
        deal_id: f.dealId,
        deal_public_id: f.deal?.publicId ?? null,
        deal_status: f.deal?.status ?? null,
        role: f.role,
        rating: f.rating,
        comment: f.comment,
        user_id: f.userId,
        user_email: f.user?.email ?? null,
        user_name: f.user?.name ?? f.participant?.name ?? null,
        created_at: f.createdAt.toISOString(),
        updated_at: f.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      summary: {
        total: summary._count._all,
        avg_rating: summary._avg.rating
          ? +summary._avg.rating.toFixed(2)
          : null,
      },
    };
  }

  async checkBakongByPaymentId(paymentId: string, payments: PaymentsService) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment)
      throw new NotFoundException({ messageKey: 'payment.not_found' });
    const deal = await this.prisma.deal.findUnique({
      where: { id: payment.dealId },
    });
    if (!deal) throw new NotFoundException({ messageKey: 'deal.not_found' });

    return payments.checkBakongTransaction(paymentId);
  }

  /**
   * Look up the BothSafe user id for a participant. Prefers the directly
   * linked participant.userId; falls back to the user linked to the
   * participant's Telegram identity (bot-created legacy deals where the
   * participant row was created before TelegramIdentity → User linking).
   * If a fallback user is found, the participant row is patched so the
   * lookup is one-time.
   */
  private async resolveParticipantUserId(participant: {
    id: string;
    userId: string | null;
    telegramChatId: string | null;
  }): Promise<string | null> {
    if (participant.userId) return participant.userId;
    if (!participant.telegramChatId) return null;

    const identity = await this.prisma.telegramIdentity.findUnique({
      where: { chatId: participant.telegramChatId },
    });
    if (!identity?.linkedUserId) return null;

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: { userId: identity.linkedUserId },
    });
    return identity.linkedUserId;
  }
}
