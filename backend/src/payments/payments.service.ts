import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BakongKHQR, IndividualInfo, khqrData } = require('bakong-khqr');
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
  private readonly logger = new Logger(PaymentsService.name);
  private readonly baker = new BakongKHQR();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly files: FilesService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  private generateKhqr(amount: number | null, publicId: string): { khqr_string: string; khqr_md5: string } | null {
    const accountId = this.cfg.get<string>('BAKONG_ACCOUNT_ID');
    const merchantName = this.cfg.get<string>('BAKONG_MERCHANT_NAME') ?? 'BothSafe Escrow';
    const merchantCity = this.cfg.get<string>('BAKONG_MERCHANT_CITY') ?? 'Phnom Penh';

    if (!accountId) {
      this.logger.warn('BAKONG_ACCOUNT_ID is not configured — KHQR generation skipped');
      return null;
    }

    try {
      const expirationTimestamp = Date.now() + 60 * 60 * 1000;
      const optional: Record<string, unknown> = {
        currency: khqrData.currency.usd,
        storeLabel: 'BothSafe',
        billNumber: publicId.slice(0, 25),
      };

      if (amount && amount > 0) {
        optional.amount = amount;
        optional.expirationTimestamp = expirationTimestamp;
      }

      const info = new IndividualInfo(accountId, merchantName, merchantCity, optional);
      const result = this.baker.generateIndividual(info);

      if (result.status.code !== 0 || !result.data) {
        this.logger.warn(`KHQR generation failed: ${result.status.message}`);
        return null;
      }

      return { khqr_string: result.data.qr, khqr_md5: result.data.md5 };
    } catch (err) {
      this.logger.error('KHQR generation error', err);
      return null;
    }
  }

  async paymentInstruction(publicId: string, actor: RequestActor) {
    if (actor.role !== 'buyer') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true, product: true },
    });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    if (!canUploadPaymentProof(deal.status as any)) {
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.PAYMENT_NOT_READY });
    }

    const payment = await this.ensurePaymentIntent(deal);

    return {
      method: 'bakong_khqr',
      receiver_account_label: this.cfg.get<string>('RECEIVER_ACCOUNT_LABEL'),
      receiver_account_id: this.cfg.get<string>('BAKONG_ACCOUNT_ID'),
      currency: deal.currency,
      expected_amount: deal.amount,
      reference_note: `BothSafe Deal ${deal.publicId}`,
      payment_id: payment.id,
      khqr_string: payment.khqrString ?? null,
      khqr_md5: payment.khqrMd5 ?? null,
    };
  }

  async uploadProof(
    publicId: string,
    file: Express.Multer.File | undefined,
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

    let proofImageUrl: string | undefined;
    if (file) {
      const stored = await this.files.store(file, {
        dealId: deal.id,
        category: FILE_CATEGORIES.PAYMENT_PROOF,
        isPublic: false,
        uploadedBy: actor.participantId ?? 'buyer',
      });
      proofImageUrl = this.files.signedUrlFor(stored);
    }

    const intent = await this.ensurePaymentIntent(deal);
    const payment = await this.prisma.payment.update({
      where: { id: intent.id },
      data: {
        paidAmount: dto.paid_amount ?? intent.paidAmount,
        proofImageUrl: proofImageUrl ?? intent.proofImageUrl,
        buyerNote: dto.buyer_note ?? intent.buyerNote,
        idempotencyKey: dto.idempotency_key ?? intent.idempotencyKey,
        khqrMd5: dto.khqr_md5 ?? intent.khqrMd5,
      },
    });

    // Transition deal to PAYMENT_PENDING_VERIFICATION
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: actor.participantId ?? null,
      action: proofImageUrl ? 'payment.receipt_uploaded' : 'payment.intent_confirmed',
      details: { payment_id: payment.id, paid_amount: dto.paid_amount },
    });

    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.PAYMENT_PROOF_UPLOADED,
      messageKey: MESSAGE_KEYS.PAYMENT_PROOF_UPLOADED,
      recipients: deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })),
    });

    return {
      payment_id: payment.id,
      status: DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
      message_key: MESSAGE_KEYS.PAYMENT_PROOF_UPLOADED,
    };
  }

  private async ensurePaymentIntent(deal: {
    id: string;
    publicId: string;
    amount: number | null;
    currency: string;
    status: string;
  }) {
    const existing = await this.prisma.payment.findFirst({
      where: {
        dealId: deal.id,
        adminStatus: { in: ['pending', 'verified'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return existing;
    }

    const khqr = this.generateKhqr(deal.amount, deal.publicId);
    const payment = await this.prisma.payment.create({
      data: {
        dealId: deal.id,
        expectedAmount: deal.amount ?? 0,
        currency: deal.currency,
        paymentMethod: 'bakong_khqr',
        receiverAccountLabel: this.cfg.get<string>('RECEIVER_ACCOUNT_LABEL') ?? 'BothSafe Escrow',
        adminStatus: 'pending',
        khqrMd5: khqr?.khqr_md5 ?? null,
        khqrString: khqr?.khqr_string ?? null,
        autoVerified: false,
      },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'system',
      action: 'payment.intent_created',
      details: { payment_id: payment.id, khqr_md5: payment.khqrMd5 },
    });

    return payment;
  }

  // --- admin actions ---

  async adminVerify(paymentId: string, adminId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException({ messageKey: 'payment.not_found' });
    if (payment.adminStatus === 'verified') {
      throw new ConflictException({ messageKey: 'payment.already_verified' });
    }
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
          status: DEAL_STATUS.PAID_ESCROWED,
          feeAmount: fee,
          netSellerAmount: sellerNet,
        },
      }),
    ]);

    // Auto-transition to SELLER_PREPARING
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.SELLER_PREPARING },
    });

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

    // Notify seller to ship
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.SELLER_SHOULD_SHIP,
      messageKey: 'seller.should_ship',
      recipients: [
        ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
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

    const deal = await this.prisma.deal.findUnique({ where: { id: payment.dealId }, include: { participants: true } });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });

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

    const buyer = deal.participants.find((p) => p.role === 'buyer');
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

    return { deal_status: DEAL_STATUS.READY_FOR_PAYMENT, rejected_reason: reason };
  }

  /**
   * Check a Bakong transaction by MD5 hash via the Bakong Open API.
   */
  async checkBakongTransaction(md5: string): Promise<{ confirmed: boolean; data: unknown }> {
    const token = this.cfg.get<string>('BAKONG_API_TOKEN');
    if (!token) {
      return { confirmed: false, data: { error: 'BAKONG_API_TOKEN not configured' } };
    }

    try {
      const url = 'https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ md5 }),
      });

      const json = (await response.json()) as { responseCode?: number; data?: unknown };
      const confirmed = response.ok && json.responseCode === 0;
      return { confirmed, data: json };
    } catch (err) {
      this.logger.error('Bakong API check failed', err);
      return { confirmed: false, data: { error: 'API request failed' } };
    }
  }
}
