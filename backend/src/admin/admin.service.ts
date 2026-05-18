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
import {
  DEAL_STATUS,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async listDeals(query: { status?: string; from_date?: string; to_date?: string; search?: string; page?: string; pageSize?: string }) {
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
        { participants: { some: { name: { contains: query.search, mode: 'insensitive' } } } },
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
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    return deal;
  }

  async listPendingPayments() {
    return this.prisma.payment.findMany({
      where: { adminStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { deal: { include: { participants: true, product: true } } },
    });
  }

  async release(dealId: string, body: { payout_reference: string; admin_note?: string; idempotency_key?: string }, adminId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId }, include: { participants: true } });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

    if (body.idempotency_key) {
      const found = await this.prisma.idempotencyKey.findUnique({ where: { key: body.idempotency_key } });
      if (found && found.scope === 'admin.release') {
        return found.responseJson ? JSON.parse(found.responseJson) : { status: deal.status };
      }
    }

    if (deal.status === DEAL_STATUS.RELEASED) {
      throw new ConflictException({ messageKey: 'admin.already_released' });
    }
    if (deal.status !== DEAL_STATUS.RELEASE_PENDING && deal.status !== DEAL_STATUS.DISPUTED) {
      throw new BadRequestException({ messageKey: 'admin.not_ready_for_release' });
    }

    if (!(await this.ledger.hasEntry(deal.id, 'SELLER_PAYOUT_PENDING'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'SELLER_PAYOUT_PENDING',
        amount: deal.netSellerAmount ?? deal.amount ?? 0,
        currency: deal.currency,
        reference: body.payout_reference,
        createdByAdminId: adminId,
      });
    }

    if (!(await this.ledger.hasEntry(deal.id, 'SELLER_PAYOUT_SENT'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'SELLER_PAYOUT_SENT',
        amount: deal.netSellerAmount ?? deal.amount ?? 0,
        currency: deal.currency,
        reference: body.payout_reference,
        createdByAdminId: adminId,
      });
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.RELEASED },
    });
    await this.prisma.dispute.updateMany({
      where: { dealId: deal.id, status: { in: ['open', 'under_review'] } },
      data: { status: 'resolved_release', adminNote: body.admin_note ?? null, resolvedAt: new Date() },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'admin',
      actorId: adminId,
      action: 'admin.released',
      details: { reference: body.payout_reference, note: body.admin_note },
    });
    this.logger.action('admin.release', { deal_id: deal.id, admin_id: adminId, reference: body.payout_reference });

    const seller = deal.participants.find((p) => p.role === 'seller');
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
      messageKey: MESSAGE_KEYS.RELEASED,
      recipients: [
        ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
        ...(seller?.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
      ],
    });

    const result = {
      status: DEAL_STATUS.RELEASED,
      ledger_entries: await this.ledger.list(deal.id),
    };

    if (body.idempotency_key) {
      await this.prisma.idempotencyKey.upsert({
        where: { key: body.idempotency_key },
        update: { scope: 'admin.release', responseJson: JSON.stringify(result) },
        create: { key: body.idempotency_key, scope: 'admin.release', responseJson: JSON.stringify(result) },
      });
    }

    return result;
  }

  async refund(dealId: string, body: { refund_reference: string; admin_note?: string; idempotency_key?: string }, adminId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId }, include: { participants: true } });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

    if (body.idempotency_key) {
      const found = await this.prisma.idempotencyKey.findUnique({ where: { key: body.idempotency_key } });
      if (found && found.scope === 'admin.refund') {
        return found.responseJson ? JSON.parse(found.responseJson) : { status: deal.status };
      }
    }

    if (deal.status === DEAL_STATUS.REFUNDED) {
      throw new ConflictException({ messageKey: 'admin.already_refunded' });
    }
    if (deal.status !== DEAL_STATUS.DISPUTED && deal.status !== DEAL_STATUS.RELEASE_PENDING) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_PENDING'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'BUYER_REFUND_PENDING',
        amount: deal.amount ?? 0,
        currency: deal.currency,
        reference: body.refund_reference,
        createdByAdminId: adminId,
      });
    }
    if (!(await this.ledger.hasEntry(deal.id, 'BUYER_REFUND_SENT'))) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: 'BUYER_REFUND_SENT',
        amount: deal.amount ?? 0,
        currency: deal.currency,
        reference: body.refund_reference,
        createdByAdminId: adminId,
      });
    }

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.REFUNDED },
    });
    await this.prisma.dispute.updateMany({
      where: { dealId: deal.id, status: { in: ['open', 'under_review'] } },
      data: { status: 'resolved_refund', adminNote: body.admin_note ?? null, resolvedAt: new Date() },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'admin',
      actorId: adminId,
      action: 'admin.refunded',
      details: { reference: body.refund_reference, note: body.admin_note },
    });
    this.logger.action('admin.refund', { deal_id: deal.id, admin_id: adminId, reference: body.refund_reference });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.REFUND_COMPLETED,
      messageKey: MESSAGE_KEYS.REFUNDED,
      recipients: [
        ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
        ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
      ],
    });

    const result = {
      status: DEAL_STATUS.REFUNDED,
      ledger_entries: await this.ledger.list(deal.id),
    };

    if (body.idempotency_key) {
      await this.prisma.idempotencyKey.upsert({
        where: { key: body.idempotency_key },
        update: { scope: 'admin.refund', responseJson: JSON.stringify(result) },
        create: { key: body.idempotency_key, scope: 'admin.refund', responseJson: JSON.stringify(result) },
      });
    }

    return result;
  }

  async resolveDispute(disputeId: string, dto: { decision: 'release' | 'refund'; admin_note?: string; payout_reference?: string; refund_reference?: string }, adminId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, include: { deal: { include: { participants: true } } } });
    if (!dispute) throw new NotFoundException({ messageKey: 'dispute.not_found' });
    if (dispute.status !== 'open' && dispute.status !== 'under_review') {
      throw new ConflictException({ messageKey: 'dispute.already_resolved' });
    }

    const deal = dispute.deal;

    if (dto.decision === 'release') {
      if (!dto.payout_reference) throw new BadRequestException({ messageKey: 'admin.payout_reference_required' });

      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'resolved_release', adminNote: dto.admin_note ?? null, resolvedAt: new Date() },
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
        details: { dispute_id: disputeId, note: dto.admin_note, payout_reference: dto.payout_reference },
      });
      this.logger.action('dispute.resolved_release', { deal_id: deal.id, admin_id: adminId, dispute_id: disputeId });

      const seller = deal.participants.find((p) => p.role === 'seller');
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.PAYOUT_RELEASED,
        messageKey: MESSAGE_KEYS.RELEASED,
        recipients: [
          ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
          ...(seller?.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
        ],
      });

      return { status: DEAL_STATUS.RELEASE_PENDING, dispute_status: 'resolved_release' };
    } else {
      // refund decision
      if (!dto.refund_reference) throw new BadRequestException({ messageKey: 'admin.refund_reference_required' });

      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: 'resolved_refund', adminNote: dto.admin_note ?? null, resolvedAt: new Date() },
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
        details: { dispute_id: disputeId, note: dto.admin_note, refund_reference: dto.refund_reference },
      });
      this.logger.action('dispute.resolved_refund', { deal_id: deal.id, admin_id: adminId, dispute_id: disputeId });

      const buyer = deal.participants.find((p) => p.role === 'buyer');
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.REFUND_COMPLETED,
        messageKey: MESSAGE_KEYS.REFUNDED,
        recipients: [
          ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
          ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
        ],
      });

      return { status: DEAL_STATUS.REFUNDED, dispute_status: 'resolved_refund' };
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

  async checkBakongByPaymentId(paymentId: string, payments: PaymentsService) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ messageKey: 'payment.not_found' });
    const deal = await this.prisma.deal.findUnique({ where: { id: payment.dealId } });
    if (!deal) throw new NotFoundException({ messageKey: 'deal.not_found' });

    return payments.checkBakongTransaction(paymentId);
  }
}
