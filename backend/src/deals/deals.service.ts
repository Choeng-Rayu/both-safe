import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import { generateOpaqueToken, generatePublicId, hashToken } from '../common/utils/tokens';
import { sanitizeText } from '../common/utils/sanitize';
import { DEAL_STATUS, DealStatus, MESSAGE_KEYS, NOTIFICATION_EVENTS } from '../common/constants';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import { UpdateDeliveryDto, UpdateParticipantDto, UpdatePayoutDto, UpdateProductDto } from './dto/update-sections.dto';
import { SellerAcceptDto } from './dto/seller-accept.dto';
import { computeMissingFields, type DealLike } from './missing-fields';
import { assertTransition, canBuyerCancel, canSellerAccept, canSellerReject, isPostPayment } from './status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';
import { TransfersService } from '../transfers/transfers.service';

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly transfers: TransfersService,
  ) {}

  private appBase(): string { return this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000'; }
  private feePercent(): number { return Number(this.cfg.get<string>('PLATFORM_FEE_PERCENT') ?? '2'); }

  private buildUrls(publicId: string, creatorAccess: string, invite: string) {
    const base = this.appBase();
    return {
      creator_access_url: `${base}/d/${publicId}?access=${creatorAccess}`,
      invite_url: `${base}/d/${publicId}?invite=${invite}`,
    };
  }

  private async loadDeal(publicId: string): Promise<DealLike> {
    const deal = await this.prisma.deal.findUnique({ where: { publicId }, include: { participants: true, product: true } });
    if (!deal) throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    return deal as DealLike;
  }

  private allowedActions(deal: DealLike, actor: RequestActor): string[] {
    const status = deal.status as DealStatus;
    const role = actor.role;
    const acts: string[] = [];

    if (status === DEAL_STATUS.DRAFT) {
      acts.push('share_invite_link', 'update_product', 'update_participant');
    }
    if (status === DEAL_STATUS.PENDING_BUYER_PAYMENT || status === DEAL_STATUS.PENDING_SELLER_APPROVAL) {
      acts.push('share_invite_link');
      if (role === 'buyer') acts.push('upload_payment_proof');
    }
    if (canBuyerCancel(status) && role === 'buyer') acts.push('buyer_cancel');
    if (canSellerAccept(status) && role === 'seller') acts.push('seller_accept');
    if (canSellerReject(status) && role === 'seller') acts.push('seller_reject');
    if ((status === DEAL_STATUS.SELLER_ACCEPTED_PACKING || status === DEAL_STATUS.PAID_ESCROWED) && role === 'seller') {
      acts.push('upload_shipping_proof');
    }
    if (status === DEAL_STATUS.SHIPPED && role === 'buyer') acts.push('confirm_received', 'open_dispute');
    if (['PAID_WAITING_SELLER_APPROVAL','SELLER_ACCEPTED_PACKING','PAID_ESCROWED','SHIPPED'].includes(status)) {
      acts.push('open_dispute');
    }
    if (actor.type === 'admin') acts.push('admin_review');
    return [...new Set(acts)];
  }

  private summary(deal: DealLike, actor: RequestActor) {
    const fee = this.feePercent();
    const amount = deal.amount ?? 0;
    const feeAmount = +(amount * (fee / 100)).toFixed(2);
    const netSeller = +(amount - feeAmount).toFixed(2);
    const missing = computeMissingFields(deal);
    return {
      public_id: deal.publicId,
      status: deal.status,
      creator_role: deal.creatorRole,
      currency: deal.currency,
      amount: deal.amount,
      fee_amount: feeAmount,
      net_seller_amount: netSeller,
      current_user_role: actor.role ?? null,
      participants: deal.participants.map((p) => ({
        role: p.role,
        name: p.name,
        preferred_language: p.preferredLanguage,
        approved_at: p.approvedAt,
        joined_at: p.joinedAt,
        has_payout: !!(p.payoutKhqr || p.payoutKhqrImage || (p.payoutBankName && p.payoutAccountNumber)),
      })),
      product: deal.product ? {
        title: deal.product.title,
        type: deal.product.type,
        description: deal.product.description,
        image_url: deal.product.imageUrl,
        quantity: deal.product.quantity,
        condition: deal.product.condition,
      } : null,
      ...missing,
      allowed_actions: this.allowedActions(deal, actor),
    };
  }

  async createDeal(dto: CreateDealDto, userId?: string) {
    const publicId = generatePublicId();
    const inviteToken = generateOpaqueToken();
    const creatorAccess = generateOpaqueToken();
    const inviteTtlH = Number(this.cfg.get<string>('INVITE_TOKEN_TTL_HOURS') ?? '72');
    const dealTtlH = Number(this.cfg.get<string>('DEAL_EXPIRES_HOURS') ?? '720');

    // Determine initial status based on creator role
    const initialStatus = dto.creator_role === 'seller'
      ? DEAL_STATUS.PENDING_BUYER_PAYMENT
      : DEAL_STATUS.PENDING_SELLER_APPROVAL;

    const deal = await this.prisma.deal.create({
      data: {
        publicId,
        creatorRole: dto.creator_role,
        source: dto.source,
        status: (dto.product_title && dto.amount && dto.amount > 0) ? initialStatus : DEAL_STATUS.DRAFT,
        currency: dto.currency ?? this.cfg.get<string>('DEFAULT_CURRENCY') ?? 'USD',
        amount: dto.amount ?? null,
        createdByUserId: userId ?? null,
        createdByTelegramChatId: dto.telegram_chat_id ?? null,
        inviteTokenHash: hashToken(inviteToken),
        creatorAccessTokenHash: hashToken(creatorAccess),
        inviteExpiresAt: new Date(Date.now() + inviteTtlH * 3600 * 1000),
        expiresAt: new Date(Date.now() + dealTtlH * 3600 * 1000),
        product: dto.product_title ? {
          create: {
            title: sanitizeText(dto.product_title) ?? undefined,
            type: sanitizeText(dto.product_type) ?? undefined,
            description: sanitizeText(dto.product_description) ?? undefined,
          },
        } : undefined,
        participants: {
          create: {
            role: dto.creator_role,
            userId: userId ?? null,
            name: sanitizeText(dto.creator_name) ?? null,
            phone: sanitizeText(dto.creator_phone) ?? null,
            telegramChatId: dto.telegram_chat_id ?? null,
            preferredLanguage: dto.language,
            accessTokenHash: hashToken(creatorAccess),
            joinedAt: new Date(),
          },
        },
      },
      include: { participants: true, product: true },
    });

    await this.audit.record({ dealId: deal.id, actorType: 'participant', action: 'deal.created', details: { source: dto.source, creator_role: dto.creator_role } });

    const urls = this.buildUrls(publicId, creatorAccess, inviteToken);
    const fresh = await this.loadDeal(publicId);
    const missing = computeMissingFields(fresh);
    return { public_id: publicId, status: fresh.status, ...urls, ...missing, message_key: MESSAGE_KEYS.DEAL_CREATED };
  }

  async getDeal(publicId: string, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    return {
      ...this.summary(deal, actor),
      payment_summary: await this.paymentSummary(deal.id),
      shipping_summary: await this.shippingSummary(deal.id),
      dispute_summary: await this.disputeSummary(deal.id),
      timeline: await this.notif.timeline(deal.id),
    };
  }

  /** Ensure file URLs are absolute (handles old relative paths stored before the fix). */
  private fileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const apiBase = this.cfg.get<string>('API_URL') ?? 'http://localhost:3001';
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  private async paymentSummary(dealId: string) {
    const payments = await this.prisma.payment.findMany({ where: { dealId } });
    if (!payments.length) return null;
    const latest = payments[payments.length - 1];
    return { payment_id: latest.id, admin_status: latest.adminStatus, paid_amount: latest.paidAmount, expected_amount: latest.expectedAmount, receiver_account_label: latest.receiverAccountLabel, proof_image_url: this.fileUrl(latest.proofImageUrl), rejected_reason: latest.rejectedReason };
  }

  private async shippingSummary(dealId: string) {
    const s = await this.prisma.shipping.findUnique({ where: { dealId } });
    if (!s) return null;
    return { shipping_id: s.id, delivery_company: s.deliveryCompany, tracking_number: s.trackingNumber, package_photo_url: this.fileUrl(s.packagePhotoUrl), delivery_receipt_url: this.fileUrl(s.deliveryReceiptUrl), seller_note: s.sellerNote };
  }

  private async disputeSummary(dealId: string) {
    const list = await this.prisma.dispute.findMany({ where: { dealId }, orderBy: { createdAt: 'desc' } });
    if (!list.length) return null;
    return list.map((d) => ({ dispute_id: d.id, reason: d.reason, message: d.message, status: d.status, opened_by_role: d.openedByRole, created_at: d.createdAt, resolved_at: d.resolvedAt }));
  }

  async joinDeal(publicId: string, dto: JoinDealDto, actor: RequestActor, userId?: string) {
    if (actor.type !== 'invite') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.INVALID_TOKEN });
    const deal = await this.loadDeal(publicId);
    if (dto.role === deal.creatorRole) throw new BadRequestException({ messageKey: 'deal.role_conflict', details: { creator_role: deal.creatorRole } });

    const existing = deal.participants.find((p) => p.role === dto.role);
    if (existing?.joinedAt) throw new BadRequestException({ messageKey: MESSAGE_KEYS.ALREADY_JOINED });

    const accessToken = generateOpaqueToken();
    let participant: any;
    if (existing) {
      participant = await this.prisma.participant.update({ where: { id: existing.id }, data: { userId: userId ?? existing.userId, name: sanitizeText(dto.name) ?? existing.name, phone: sanitizeText(dto.phone) ?? existing.phone, telegramChatId: dto.telegram_chat_id ?? existing.telegramChatId, preferredLanguage: dto.preferred_language, accessTokenHash: hashToken(accessToken), joinedAt: new Date() } });
    } else {
      participant = await this.prisma.participant.create({ data: { dealId: deal.id, userId: userId ?? null, role: dto.role, name: sanitizeText(dto.name) ?? '', phone: sanitizeText(dto.phone) ?? null, telegramChatId: dto.telegram_chat_id ?? null, preferredLanguage: dto.preferred_language, accessTokenHash: hashToken(accessToken), joinedAt: new Date() } });
    }

    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: participant.id, action: 'participant.joined', details: { role: dto.role } });

    const creator = deal.participants.find((p) => p.role === deal.creatorRole);
    await this.notif.notify({ dealId: deal.id, eventKey: NOTIFICATION_EVENTS.COUNTERPARTY_JOINED, messageKey: MESSAGE_KEYS.COUNTERPARTY_JOINED, recipients: [{ channel: 'inapp', ref: creator?.id ?? null }, ...(creator?.telegramChatId ? [{ channel: 'telegram' as const, ref: creator.telegramChatId }] : [])] });

    const after = await this.loadDeal(publicId);
    const missing = computeMissingFields(after);
    return {
      participant_access_url: `${this.appBase()}/d/${publicId}?access=${accessToken}`,
      access_token: accessToken,
      status: after.status,
      ...missing,
      allowed_actions: this.allowedActions(after, { ...actor, type: 'participant', role: dto.role, participantId: participant.id }),
    };
  }

  private assertCanEdit(deal: DealLike, field: 'product' | 'participant' | 'payout' | 'delivery') {
    if (isPostPayment(deal.status as DealStatus)) {
      if (field === 'product' || field === 'payout' || field === 'participant') {
        throw new ForbiddenException({ messageKey: MESSAGE_KEYS.CANNOT_UPDATE_LOCKED });
      }
    }
  }

  async updateProduct(publicId: string, dto: UpdateProductDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    this.assertCanEdit(deal, 'product');
    const productData: any = {};
    if (dto.title !== undefined) productData.title = sanitizeText(dto.title);
    if (dto.type !== undefined) productData.type = sanitizeText(dto.type);
    if (dto.description !== undefined) productData.description = sanitizeText(dto.description);
    if (dto.image_url !== undefined) productData.imageUrl = dto.image_url;
    if (dto.quantity !== undefined) productData.quantity = dto.quantity;
    if (dto.condition !== undefined) productData.condition = sanitizeText(dto.condition);
    await this.prisma.deal.update({ where: { id: deal.id }, data: { amount: dto.amount ?? deal.amount, currency: dto.currency ?? deal.currency, product: deal.product ? { update: productData } : { create: { ...productData, quantity: productData.quantity ?? 1 } } } });
    if (dto.title !== undefined || dto.description !== undefined || dto.amount !== undefined || dto.currency !== undefined) {
      await this.prisma.participant.updateMany({ where: { dealId: deal.id }, data: { approvedAt: null } });
    }
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: actor.participantId ?? null, action: 'product.updated', details: dto as any });
    await this.recomputeStatusAfterEdit(deal.id);
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateParticipant(publicId: string, dto: UpdateParticipantDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    this.assertCanEdit(deal, 'participant');
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const participant = deal.participants.find((p) => p.role === actor.role);
    if (!participant) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    await this.prisma.participant.update({ where: { id: participant.id }, data: { name: dto.name !== undefined ? sanitizeText(dto.name) ?? participant.name : participant.name, phone: dto.phone !== undefined ? sanitizeText(dto.phone) : participant.phone, telegramChatId: dto.telegram_chat_id ?? participant.telegramChatId, wechatId: dto.wechat_id ?? participant.wechatId, messengerName: dto.messenger_name ?? participant.messengerName, preferredLanguage: dto.preferred_language ?? participant.preferredLanguage } });
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: participant.id, action: 'participant.updated', details: dto as any });
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updatePayout(publicId: string, dto: UpdatePayoutDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    if (actor.role !== 'seller') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    if (isPostPayment(deal.status as DealStatus)) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.CANNOT_UPDATE_LOCKED });
    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    await this.prisma.participant.update({ where: { id: seller.id }, data: { payoutKhqr: dto.payout_khqr ?? seller.payoutKhqr, payoutBankName: dto.payout_bank_name ?? seller.payoutBankName, payoutAccountName: dto.payout_account_name ?? seller.payoutAccountName, payoutAccountNumber: dto.payout_account_number ?? seller.payoutAccountNumber, payoutKhqrImage: dto.payout_khqr_image ?? seller.payoutKhqrImage } });
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: seller.id, action: 'payout.updated' });
    await this.recomputeStatusAfterEdit(deal.id);
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateDelivery(publicId: string, _dto: UpdateDeliveryDto, actor: RequestActor) {
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    return this.summary(await this.loadDeal(publicId), actor);
  }

  /** Seller accepts the deal — transitions PAID_WAITING_SELLER_APPROVAL → SELLER_ACCEPTED_PACKING */
  async sellerAccept(publicId: string, dto: SellerAcceptDto, actor: RequestActor) {
    if (actor.role !== 'seller') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);
    if (!canSellerAccept(deal.status as DealStatus)) throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    // Save payout if provided
    if (dto.payout_khqr || dto.payout_bank_name || dto.payout_account_number || dto.payout_khqr_image) {
      await this.prisma.participant.update({ where: { id: seller.id }, data: { payoutKhqr: dto.payout_khqr ?? seller.payoutKhqr, payoutBankName: dto.payout_bank_name ?? seller.payoutBankName, payoutAccountName: dto.payout_account_name ?? seller.payoutAccountName, payoutAccountNumber: dto.payout_account_number ?? seller.payoutAccountNumber, payoutKhqrImage: dto.payout_khqr_image ?? seller.payoutKhqrImage } });
    }

    await this.transitionStatus(deal.id, deal.status as DealStatus, DEAL_STATUS.SELLER_ACCEPTED_PACKING);
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: seller.id, action: 'seller.accepted', details: { expected_shipping_date: dto.expected_shipping_date } });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.notif.notify({ dealId: deal.id, eventKey: NOTIFICATION_EVENTS.SELLER_ACCEPTED, messageKey: MESSAGE_KEYS.SELLER_ACCEPTED, recipients: [{ channel: 'inapp', ref: buyer?.id ?? null }, ...(buyer?.telegramChatId ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }] : [])] });

    const fresh = await this.loadDeal(publicId);
    return { status: fresh.status, message_key: MESSAGE_KEYS.SELLER_ACCEPTED, allowed_actions: this.allowedActions(fresh, actor) };
  }

  /** Seller rejects a paid buyer-created deal; refund must succeed before REFUNDED is stored. */
  async sellerReject(publicId: string, actor: RequestActor) {
    if (actor.role !== 'seller') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);
    if (!canSellerReject(deal.status as DealStatus)) throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });

    const seller = deal.participants.find((p) => p.role === 'seller');
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: seller?.id ?? null, action: 'seller.rejected' });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.notif.notify({ dealId: deal.id, eventKey: NOTIFICATION_EVENTS.SELLER_REJECTED_DEAL, messageKey: MESSAGE_KEYS.SELLER_REJECTED, recipients: [{ channel: 'inapp', ref: buyer?.id ?? null }] });

    return this.transfers.refundBuyer(deal.id, 'seller_rejected');
  }

  /** Buyer cancels deal — only allowed before seller accepts */
  async buyerCancel(publicId: string, actor: RequestActor) {
    if (actor.role !== 'buyer') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);
    if (!canBuyerCancel(deal.status as DealStatus)) throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });

    const payment = await this.prisma.payment.findFirst({ where: { dealId: deal.id, adminStatus: 'verified' } });
    if (payment) {
      await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: actor.participantId ?? null, action: 'deal.cancelled_by_buyer_refund_requested' });
      await this.notif.notify({ dealId: deal.id, eventKey: NOTIFICATION_EVENTS.DEAL_CANCELLED_BY_BUYER, messageKey: MESSAGE_KEYS.DEAL_CANCELLED, recipients: deal.participants.map((p) => ({ channel: 'inapp' as const, ref: p.id })) });
      return this.transfers.refundBuyer(deal.id, 'buyer_cancelled_before_seller_accept');
    }

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.transitionStatus(deal.id, deal.status as DealStatus, DEAL_STATUS.CANCELLED);
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: buyer?.id ?? null, action: 'deal.cancelled_by_buyer' });

    const fresh = await this.loadDeal(publicId);
    return { status: fresh.status, message_key: MESSAGE_KEYS.DEAL_CANCELLED, refund_required: false };
  }

  /** Buyer confirms receipt; seller payout must succeed before RELEASED is stored. */
  async confirmReceived(publicId: string, actor: RequestActor) {
    if (actor.role !== 'buyer') throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);
    if (deal.status !== 'SHIPPED') throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.audit.record({ dealId: deal.id, actorType: 'participant', actorId: buyer?.id ?? null, action: 'buyer.confirmed_received' });

    const seller = deal.participants.find((p) => p.role === 'seller');

    // 1. Notify seller that buyer confirmed
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.BUYER_CONFIRMED,
      messageKey: MESSAGE_KEYS.BUYER_CONFIRMED,
      recipients: [
        ...(seller ? [{ channel: 'inapp' as const, ref: seller.id }] : []),
        ...(seller?.telegramChatId ? [{ channel: 'telegram' as const, ref: seller.telegramChatId }] : []),
      ],
    });

    // 2. Alert admin to process seller payout via Bakong deeplink
    const adminChatId = this.cfg.get<string>('ADMIN_TELEGRAM_CHAT_ID');
    const appBase = this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
    if (adminChatId) {
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.BUYER_CONFIRMED_PAYOUT_REQUIRED,
        messageKey: 'admin.payout_required',
        recipients: [{ channel: 'telegram' as const, ref: adminChatId }],
        payload: {
          deal_public_id: deal.publicId,
          seller_name: seller?.name ?? 'Unknown',
          amount: deal.netSellerAmount ?? deal.amount ?? 0,
          currency: deal.currency,
          admin_url: `${appBase}/admin/deals/${deal.id}`,
          payout_khqr: seller?.payoutKhqr ?? null,
          payout_bank: seller?.payoutBankName ?? null,
          payout_account: seller?.payoutAccountNumber ?? null,
        },
      });
    }

    return this.transfers.payoutSeller(deal.id, 'buyer_confirmed_received');
  }

async transitionStatus(dealId: string, from: DealStatus, to: DealStatus) {
    assertTransition(from, to);
    await this.prisma.deal.update({ where: { id: dealId }, data: { status: to } });
    await this.audit.record({ dealId, actorType: 'system', action: 'status.transition', details: { from, to } });
  }

  private async recomputeStatusAfterEdit(dealId: string) {
    const fresh = await this.prisma.deal.findUnique({ where: { id: dealId }, include: { participants: true, product: true } }) as DealLike;
    if (!fresh) return;
    const status = fresh.status as DealStatus;
    if (isPostPayment(status)) return;
    if (['CANCELLED', 'EXPIRED'].includes(status)) return;
    if (status !== DEAL_STATUS.DRAFT) return;

    // Advance DRAFT to proper initial status once product + amount are ready
    if (fresh.product?.title && fresh.amount && fresh.amount > 0) {
      const next = fresh.creatorRole === 'seller' ? DEAL_STATUS.PENDING_BUYER_PAYMENT : DEAL_STATUS.PENDING_SELLER_APPROVAL;
      await this.transitionStatus(dealId, status, next);
    }
  }

  /** Get all deals for a user grouped by state */
  async getMyDeals(userId: string) {
    const deals = await this.prisma.deal.findMany({
      where: {
        OR: [
          { createdByUserId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: { participants: true, product: true },
      orderBy: { updatedAt: 'desc' },
    });

    const created: any[] = [];
    const waitingMyApproval: any[] = [];
    const active: any[] = [];
    const completedCancelled: any[] = [];

    const ACTIVE_STATUSES = [DEAL_STATUS.PAYMENT_PENDING_VERIFICATION, DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL, DEAL_STATUS.SELLER_ACCEPTED_PACKING, DEAL_STATUS.PAID_ESCROWED, DEAL_STATUS.SHIPPED, DEAL_STATUS.DISPUTED];
    const TERMINAL_STATUSES = [DEAL_STATUS.RELEASED, DEAL_STATUS.REFUNDED, DEAL_STATUS.CANCELLED, DEAL_STATUS.EXPIRED];

    for (const deal of deals) {
      const currentParticipant = deal.participants.find((p) => p.userId === userId);
      const card = {
        public_id: deal.publicId,
        status: deal.status,
        creator_role: deal.creatorRole,
        amount: deal.amount,
        currency: deal.currency,
        product_title: deal.product?.title ?? null,
        participants: deal.participants.map((p) => ({ role: p.role, name: p.name })),
        updated_at: deal.updatedAt,
      };
      if (deal.createdByUserId === userId) created.push(card);
      if (currentParticipant && currentParticipant.role !== deal.creatorRole && deal.status === DEAL_STATUS.PAID_WAITING_SELLER_APPROVAL) {
        waitingMyApproval.push(card);
      } else if (ACTIVE_STATUSES.includes(deal.status as any)) {
        active.push(card);
      } else if (TERMINAL_STATUSES.includes(deal.status as any)) {
        completedCancelled.push(card);
      }
    }

    return { created, waiting_my_approval: waitingMyApproval, active, completed_cancelled: completedCancelled };
  }
}
