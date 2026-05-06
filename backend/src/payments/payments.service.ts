import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  DEAL_STATUS,
  FILE_CATEGORIES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';
import { canUploadPaymentProof } from '../deals/status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { UploadPaymentProofDto } from './dto/upload-payment-proof.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly files: FilesService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  async paymentInstruction(publicId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true, product: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (!canUploadPaymentProof(deal.status as any)) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.PAYMENT_NOT_READY });
    }
    return {
      method: 'bakong_khqr',
      receiver_account_label: this.cfg.get<string>('RECEIVER_ACCOUNT_LABEL'),
      currency: deal.currency,
      expected_amount: deal.amount,
      reference_note: `BothSafe Deal ${deal.publicId}`,
      // For MVP we return a placeholder QR string. Real QR generation is a phase-2 task.
      khqr_payload_placeholder: `KHQR://bothsafe.app/${deal.publicId}/${deal.amount}`,
    };
  }

  async uploadProof(
    publicId: string,
    file: Express.Multer.File,
    dto: UploadPaymentProofDto,
    actor: RequestActor,
  ) {
    if (actor.role !== 'buyer') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (!canUploadPaymentProof(deal.status as any)) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.PAYMENT_NOT_READY });
    }

    if (dto.idempotency_key) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotency_key },
      });
      if (existing) {
        return {
          payment_id: existing.id,
          status: deal.status,
          message_key: MESSAGE_KEYS.PAYMENT_PROOF_UPLOADED,
        };
      }
    }

    const stored = await this.files.store(file, {
      dealId: deal.id,
      category: FILE_CATEGORIES.PAYMENT_PROOF,
      isPublic: false,
      uploadedBy: actor.participantId ?? 'buyer',
    });

    const payment = await this.prisma.payment.create({
      data: {
        dealId: deal.id,
        expectedAmount: deal.amount ?? 0,
        paidAmount: dto.paid_amount,
        currency: deal.currency,
        paymentMethod: 'bakong_khqr',
        receiverAccountLabel: this.cfg.get<string>('RECEIVER_ACCOUNT_LABEL') ?? 'BothSafe Escrow',
        proofImageUrl: this.files.signedUrlFor(stored),
        buyerNote: dto.buyer_note ?? null,
        adminStatus: 'pending',
        idempotencyKey: dto.idempotency_key ?? null,
      },
    });

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: actor.participantId ?? null,
      action: 'payment.proof_uploaded',
      details: { payment_id: payment.id, paid_amount: dto.paid_amount },
    });

    // notify admin (channel: inapp; admin dashboard can list pending verifications)
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYMENT_PROOF_UPLOADED,
      messageKey: MESSAGE_KEYS.PAYMENT_PROOF_UPLOADED,
      recipients: [{ channel: 'inapp', ref: 'admin' }],
    });

    return {
      payment_id: payment.id,
      status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
      message_key: MESSAGE_KEYS.PAYMENT_PROOF_UPLOADED,
    };
  }

  // --- admin actions ---

  async adminVerify(paymentId: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ messageKey: 'payment.not_found' });
    if (payment.adminStatus !== 'pending') {
      throw new ConflictException({ messageKey: 'payment.already_decided' });
    }

    const deal = await this.prisma.deal.findUnique({ where: { id: payment.dealId }, include: { participants: true } });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

    const platformFeePct = Number(this.cfg.get<string>('PLATFORM_FEE_PERCENT') ?? '2');
    const fee = +((payment.paidAmount ?? deal.amount ?? 0) * (platformFeePct / 100)).toFixed(2);
    const sellerNet = +((payment.paidAmount ?? deal.amount ?? 0) - fee).toFixed(2);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { adminStatus: 'verified', verifiedByAdminId: adminId, verifiedAt: new Date() },
      }),
      this.prisma.deal.update({
        where: { id: deal.id },
        data: {
          status: DEAL_STATUS.SELLER_PREPARING,
          feeAmount: fee,
          netSellerAmount: sellerNet,
        },
      }),
    ]);

    await this.ledger.append({
      dealId: deal.id,
      entryType: 'ESCROW_RECEIVED',
      amount: payment.paidAmount ?? deal.amount ?? 0,
      currency: payment.currency,
      reference: payment.id,
      createdByAdminId: adminId,
    });
    await this.ledger.append({
      dealId: deal.id,
      entryType: 'PLATFORM_FEE_RESERVED',
      amount: fee,
      currency: payment.currency,
      reference: payment.id,
      createdByAdminId: adminId,
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'admin',
      actorId: adminId,
      action: 'payment.verified',
      details: { payment_id: payment.id },
    });

    const seller = deal.participants.find((p) => p.role === 'seller');
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYMENT_VERIFIED,
      messageKey: MESSAGE_KEYS.PAYMENT_VERIFIED,
      recipients: [
        ...deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })),
        ...(seller?.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
      ],
    });

    return {
      deal_status: DEAL_STATUS.SELLER_PREPARING,
      ledger_entries: await this.ledger.list(deal.id),
    };
  }

  async adminReject(paymentId: string, reason: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ messageKey: 'payment.not_found' });
    if (payment.adminStatus !== 'pending') {
      throw new ConflictException({ messageKey: 'payment.already_decided' });
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { adminStatus: 'rejected', rejectedReason: reason, verifiedByAdminId: adminId, verifiedAt: new Date() },
      }),
      this.prisma.deal.update({
        where: { id: payment.dealId },
        data: { status: DEAL_STATUS.READY_FOR_PAYMENT },
      }),
    ]);

    await this.audit.record({
      dealId: payment.dealId,
      actorType: 'admin',
      actorId: adminId,
      action: 'payment.rejected',
      details: { payment_id: payment.id, reason },
    });

    const deal = await this.prisma.deal.findUnique({ where: { id: payment.dealId }, include: { participants: true } });
    const buyer = deal?.participants.find((p) => p.role === 'buyer');
    if (deal) {
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.PAYMENT_REJECTED,
        messageKey: MESSAGE_KEYS.PAYMENT_REJECTED,
        recipients: [
          ...(buyer ? [{ channel: 'inapp' as const, ref: buyer.id }] : []),
          ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : []),
        ],
        payload: { reason },
      });
    }

    return {
      deal_status: DEAL_STATUS.READY_FOR_PAYMENT,
      rejected_reason: reason,
    };
  }
}
