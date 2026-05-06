import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Deal, Participant, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  generateOpaqueToken,
  generatePublicId,
  hashToken,
} from '../common/utils/tokens';
import { sanitizeText } from '../common/utils/sanitize';
import {
  DEAL_STATUS,
  DealStatus,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
} from '../common/constants';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import {
  UpdateDeliveryDto,
  UpdateParticipantDto,
  UpdatePayoutDto,
  UpdateProductDto,
} from './dto/update-sections.dto';
import {
  computeMissingFields,
  isReadyForPayment,
  type DealLike,
} from './missing-fields';
import { assertTransition, isPostPayment } from './status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
  ) {}

  // --- helpers ---

  private appBase(): string {
    return this.cfg.get<string>('APP_BASE_URL') ?? 'http://localhost:3000';
  }

  private feePercent(): number {
    return Number(this.cfg.get<string>('PLATFORM_FEE_PERCENT') ?? '2');
  }

  private buildUrls(publicId: string, creatorAccess: string, invite: string) {
    const base = this.appBase();
    return {
      creator_access_url: `${base}/d/${publicId}?access=${creatorAccess}`,
      invite_url: `${base}/d/${publicId}?invite=${invite}`,
    };
  }

  private async loadDeal(publicId: string): Promise<DealLike> {
    const deal = await this.prisma.deal.findUnique({
      where: { publicId },
      include: { participants: true, product: true },
    });
    if (!deal) {
      throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    }
    return deal as DealLike;
  }

  private allowedActions(deal: DealLike, actor: RequestActor): string[] {
    const status = deal.status as DealStatus;
    const acts: string[] = [];
    const role = actor.role;
    if (status === DEAL_STATUS.DRAFT || status === DEAL_STATUS.AWAITING_COUNTERPARTY) {
      acts.push('share_invite_link', 'update_product', 'update_participant');
    }
    if (status === DEAL_STATUS.AWAITING_BOTH_APPROVAL) {
      acts.push('update_product', 'update_participant', 'approve');
    }
    if (status === DEAL_STATUS.READY_FOR_PAYMENT && role === 'buyer') {
      acts.push('upload_payment_proof');
    }
    if (
      (status === DEAL_STATUS.PAID_ESCROWED || status === DEAL_STATUS.SELLER_PREPARING) &&
      role === 'seller'
    ) {
      acts.push('upload_shipping_proof');
    }
    if (status === DEAL_STATUS.SHIPPED && role === 'buyer') {
      acts.push('confirm_received', 'open_dispute');
    }
    if (
      [
        DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
        DEAL_STATUS.PAID_ESCROWED,
        DEAL_STATUS.SELLER_PREPARING,
        DEAL_STATUS.SHIPPED,
      ].includes(status as any)
    ) {
      acts.push('open_dispute');
    }
    if (actor.type === 'admin') acts.push('admin_review');
    return acts;
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
        has_payout: !!(p.payoutKhqr || (p.payoutBankName && p.payoutAccountNumber)),
      })),
      product: deal.product
        ? {
            title: deal.product.title,
            type: deal.product.type,
            description: deal.product.description,
            image_url: deal.product.imageUrl,
            quantity: deal.product.quantity,
            condition: deal.product.condition,
          }
        : null,
      ...missing,
      allowed_actions: this.allowedActions(deal, actor),
    };
  }

  // --- create ---

  async createDeal(dto: CreateDealDto) {
    const publicId = generatePublicId();
    const inviteToken = generateOpaqueToken();
    const creatorAccess = generateOpaqueToken();

    const inviteTtlH = Number(this.cfg.get<string>('INVITE_TOKEN_TTL_HOURS') ?? '72');
    const dealTtlH = Number(this.cfg.get<string>('DEAL_EXPIRES_HOURS') ?? '720');

    const deal = await this.prisma.deal.create({
      data: {
        publicId,
        creatorRole: dto.creator_role,
        source: dto.source,
        status: DEAL_STATUS.DRAFT,
        currency: dto.currency ?? this.cfg.get<string>('DEFAULT_CURRENCY') ?? 'USD',
        amount: dto.amount ?? null,
        createdByTelegramChatId: dto.telegram_chat_id ?? null,
        inviteTokenHash: hashToken(inviteToken),
        creatorAccessTokenHash: hashToken(creatorAccess),
        inviteExpiresAt: new Date(Date.now() + inviteTtlH * 3600 * 1000),
        expiresAt: new Date(Date.now() + dealTtlH * 3600 * 1000),
        product: dto.product_title
          ? {
              create: {
                title: sanitizeText(dto.product_title) ?? undefined,
                type: sanitizeText(dto.product_type) ?? undefined,
                description: sanitizeText(dto.product_description) ?? undefined,
              },
            }
          : undefined,
        participants: {
          create: {
            role: dto.creator_role,
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

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      action: 'deal.created',
      details: { source: dto.source, creator_role: dto.creator_role },
    });

    // After creation, deal is in DRAFT. If product+amount exist we can advance to AWAITING_COUNTERPARTY.
    let nextStatus: DealStatus = DEAL_STATUS.DRAFT;
    if (deal.product?.title && deal.amount && deal.amount > 0) {
      nextStatus = DEAL_STATUS.AWAITING_COUNTERPARTY;
      await this.prisma.deal.update({
        where: { id: deal.id },
        data: { status: nextStatus },
      });
    }

    const urls = this.buildUrls(publicId, creatorAccess, inviteToken);
    const fresh = await this.loadDeal(publicId);
    const missing = computeMissingFields(fresh);
    return {
      public_id: publicId,
      status: fresh.status,
      ...urls,
      ...missing,
      message_key: MESSAGE_KEYS.DEAL_CREATED,
    };
  }

  // --- get ---

  async getDeal(publicId: string, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    // Anyone with valid invite/creator/participant/admin token has been authorized via guard.
    return {
      ...this.summary(deal, actor),
      payment_summary: await this.paymentSummary(deal.id),
      shipping_summary: await this.shippingSummary(deal.id),
      dispute_summary: await this.disputeSummary(deal.id),
      timeline: await this.notif.timeline(deal.id),
    };
  }

  private async paymentSummary(dealId: string) {
    const payments = await this.prisma.payment.findMany({ where: { dealId } });
    if (!payments.length) return null;
    const latest = payments[payments.length - 1];
    return {
      payment_id: latest.id,
      admin_status: latest.adminStatus,
      paid_amount: latest.paidAmount,
      expected_amount: latest.expectedAmount,
      receiver_account_label: latest.receiverAccountLabel,
      proof_image_url: latest.proofImageUrl,
      rejected_reason: latest.rejectedReason,
    };
  }

  private async shippingSummary(dealId: string) {
    const s = await this.prisma.shipping.findUnique({ where: { dealId } });
    if (!s) return null;
    return {
      shipping_id: s.id,
      delivery_company: s.deliveryCompany,
      tracking_number: s.trackingNumber,
      package_photo_url: s.packagePhotoUrl,
      delivery_receipt_url: s.deliveryReceiptUrl,
      seller_note: s.sellerNote,
    };
  }

  private async disputeSummary(dealId: string) {
    const list = await this.prisma.dispute.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    });
    if (!list.length) return null;
    return list.map((d) => ({
      dispute_id: d.id,
      reason: d.reason,
      message: d.message,
      status: d.status,
      opened_by_role: d.openedByRole,
      created_at: d.createdAt,
      resolved_at: d.resolvedAt,
    }));
  }

  // --- join ---

  async joinDeal(publicId: string, dto: JoinDealDto, actor: RequestActor) {
    if (actor.type !== 'invite') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.INVALID_TOKEN });
    }

    const deal = await this.loadDeal(publicId);

    // Cannot join with the same role as creator. The invite role must be the missing counterparty.
    if (dto.role === deal.creatorRole) {
      throw new BadRequestException({
        messageKey: 'deal.role_conflict',
        details: { creator_role: deal.creatorRole },
      });
    }

    const existing = deal.participants.find((p) => p.role === dto.role);
    if (existing && existing.joinedAt) {
      throw new ConflictException({ messageKey: MESSAGE_KEYS.ALREADY_JOINED });
    }

    const accessToken = generateOpaqueToken();
    let participant;
    if (existing) {
      participant = await this.prisma.participant.update({
        where: { id: existing.id },
        data: {
          name: sanitizeText(dto.name) ?? existing.name,
          phone: sanitizeText(dto.phone) ?? existing.phone,
          telegramChatId: dto.telegram_chat_id ?? existing.telegramChatId,
          preferredLanguage: dto.preferred_language,
          accessTokenHash: hashToken(accessToken),
          joinedAt: new Date(),
        },
      });
    } else {
      participant = await this.prisma.participant.create({
        data: {
          dealId: deal.id,
          role: dto.role,
          name: sanitizeText(dto.name) ?? '',
          phone: sanitizeText(dto.phone) ?? null,
          telegramChatId: dto.telegram_chat_id ?? null,
          preferredLanguage: dto.preferred_language,
          accessTokenHash: hashToken(accessToken),
          joinedAt: new Date(),
        },
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: participant.id,
      action: 'participant.joined',
      details: { role: dto.role },
    });

    // Status transition: once both participants exist, advance to AWAITING_BOTH_APPROVAL.
    // If deal is still in DRAFT, first step through AWAITING_COUNTERPARTY.
    const fresh = await this.loadDeal(publicId);
    const bothJoined =
      fresh.participants.some((p) => p.role === 'buyer' && p.joinedAt) &&
      fresh.participants.some((p) => p.role === 'seller' && p.joinedAt);
    if (bothJoined && [DEAL_STATUS.DRAFT, DEAL_STATUS.AWAITING_COUNTERPARTY].includes(fresh.status as any)) {
      let currentStatus = fresh.status as DealStatus;
      if (currentStatus === DEAL_STATUS.DRAFT) {
        await this.transitionStatus(fresh.id, currentStatus, DEAL_STATUS.AWAITING_COUNTERPARTY);
        currentStatus = DEAL_STATUS.AWAITING_COUNTERPARTY;
      }
      await this.transitionStatus(fresh.id, currentStatus, DEAL_STATUS.AWAITING_BOTH_APPROVAL);
    }

    // Notify creator
    const creator = fresh.participants.find((p) => p.role === fresh.creatorRole);
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.COUNTERPARTY_JOINED,
      messageKey: MESSAGE_KEYS.COUNTERPARTY_JOINED,
      recipients: [
        { channel: 'inapp', ref: creator?.id ?? null },
        ...(creator?.telegramChatId ? [{ channel: 'telegram' as const, ref: creator.telegramChatId }] : []),
      ],
    });

    const after = await this.loadDeal(publicId);
    const missing = computeMissingFields(after);
    return {
      participant_access_url: `${this.appBase()}/d/${publicId}?access=${accessToken}`,
      access_token: accessToken,
      status: after.status,
      ...missing,
      allowed_actions: this.allowedActions(after, {
        ...actor,
        type: 'participant',
        role: dto.role,
        participantId: participant.id,
      }),
    };
  }

  // --- section updates ---

  private assertCanEdit(deal: DealLike, field: 'product' | 'participant' | 'payout' | 'delivery') {
    const status = deal.status as DealStatus;
    if (isPostPayment(status)) {
      // Locked critical fields after payment
      if (field === 'product' || field === 'payout' || field === 'participant') {
        throw new ForbiddenException({ messageKey: MESSAGE_KEYS.CANNOT_UPDATE_LOCKED });
      }
    }
  }

  async updateProduct(publicId: string, dto: UpdateProductDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    this.assertCanEdit(deal, 'product');

    const productData: any = {};
    if (dto.title !== undefined) productData.title = sanitizeText(dto.title);
    if (dto.type !== undefined) productData.type = sanitizeText(dto.type);
    if (dto.description !== undefined) productData.description = sanitizeText(dto.description);
    if (dto.image_url !== undefined) productData.imageUrl = dto.image_url;
    if (dto.quantity !== undefined) productData.quantity = dto.quantity;
    if (dto.condition !== undefined) productData.condition = sanitizeText(dto.condition);

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        amount: dto.amount ?? deal.amount,
        currency: dto.currency ?? deal.currency,
        product: deal.product
          ? { update: productData }
          : { create: { ...productData, quantity: productData.quantity ?? 1 } },
      },
    });

    // Approvals reset on substantive change
    if (
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.amount !== undefined ||
      dto.currency !== undefined
    ) {
      await this.prisma.participant.updateMany({
        where: { dealId: deal.id },
        data: { approvedAt: null },
      });
    }

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: actor.participantId ?? null,
      action: 'product.updated',
      details: dto as any,
    });

    await this.recomputeStatusAfterEdit(deal.id);
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateParticipant(publicId: string, dto: UpdateParticipantDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    this.assertCanEdit(deal, 'participant');
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    const participant = deal.participants.find((p) => p.role === actor.role);
    if (!participant) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        name: dto.name !== undefined ? sanitizeText(dto.name) ?? participant.name : participant.name,
        phone: dto.phone !== undefined ? sanitizeText(dto.phone) : participant.phone,
        telegramChatId: dto.telegram_chat_id ?? participant.telegramChatId,
        wechatId: dto.wechat_id ?? participant.wechatId,
        messengerName: dto.messenger_name ?? participant.messengerName,
        preferredLanguage: dto.preferred_language ?? participant.preferredLanguage,
      },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: participant.id,
      action: 'participant.updated',
      details: dto as any,
    });

    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updatePayout(publicId: string, dto: UpdatePayoutDto, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    if (actor.role !== 'seller') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    // payout can be updated until payment proof is uploaded
    if (
      [DEAL_STATUS.PAYMENT_PENDING_VERIFICATION as string, ...['PAID_ESCROWED','SELLER_PREPARING','SHIPPED','BUYER_CONFIRMED','RELEASE_PENDING','RELEASED','REFUNDED']].includes(deal.status)
    ) {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.CANNOT_UPDATE_LOCKED });
    }

    const seller = deal.participants.find((p) => p.role === 'seller');
    if (!seller) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    await this.prisma.participant.update({
      where: { id: seller.id },
      data: {
        payoutKhqr: dto.payout_khqr ?? seller.payoutKhqr,
        payoutBankName: dto.payout_bank_name ?? seller.payoutBankName,
        payoutAccountName: dto.payout_account_name ?? seller.payoutAccountName,
        payoutAccountNumber: dto.payout_account_number ?? seller.payoutAccountNumber,
      },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: seller.id,
      action: 'payout.updated',
    });

    await this.recomputeStatusAfterEdit(deal.id);
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateDelivery(publicId: string, _dto: UpdateDeliveryDto, actor: RequestActor) {
    // MVP: no-op store. Could persist on Deal in future.
    return this.summary(await this.loadDeal(publicId), actor);
  }

  // --- approval ---

  async approve(publicId: string, actor: RequestActor) {
    const deal = await this.loadDeal(publicId);
    if (!actor.role) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    const participant = deal.participants.find((p) => p.role === actor.role);
    if (!participant) throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    if (
      ![DEAL_STATUS.AWAITING_BOTH_APPROVAL, DEAL_STATUS.AWAITING_COUNTERPARTY, DEAL_STATUS.DRAFT].includes(
        deal.status as any,
      )
    ) {
      // already past approval stage
      throw new BadRequestException({ messageKey: MESSAGE_KEYS.INVALID_TRANSITION });
    }

    await this.prisma.participant.update({
      where: { id: participant.id },
      data: { approvedAt: new Date() },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: participant.id,
      action: 'deal.approved',
      details: { role: actor.role },
    });

    await this.recomputeStatusAfterEdit(deal.id);
    const fresh = await this.loadDeal(publicId);
    const missing = computeMissingFields(fresh);
    return {
      status: fresh.status,
      approved_by: actor.role,
      missing_approvals: missing.missing_fields.filter((m) => m.endsWith('.approval')),
      allowed_actions: this.allowedActions(fresh, actor),
    };
  }

  async transitionStatus(dealId: string, from: DealStatus, to: DealStatus) {
    assertTransition(from, to);
    await this.prisma.deal.update({ where: { id: dealId }, data: { status: to } });
    await this.audit.record({
      dealId,
      actorType: 'system',
      action: 'status.transition',
      details: { from, to },
    });
  }

  private async recomputeStatusAfterEdit(dealId: string) {
    const fresh = (await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true, product: true },
    })) as DealLike;
    if (!fresh) return;

    const status = fresh.status as DealStatus;
    if (isPostPayment(status)) return;
    if ([DEAL_STATUS.CANCELLED, DEAL_STATUS.EXPIRED].includes(status as any)) return;

    if (isReadyForPayment(fresh) && status !== DEAL_STATUS.READY_FOR_PAYMENT) {
      await this.transitionStatus(dealId, status, DEAL_STATUS.READY_FOR_PAYMENT);
      await this.notif.notify({
        dealId,
        eventKey: NOTIFICATION_EVENTS.BOTH_APPROVED,
        messageKey: MESSAGE_KEYS.BOTH_APPROVED,
        recipients: fresh.participants.map((p) => ({
          channel: 'inapp' as const,
          ref: p.id,
        })),
      });
      return;
    }

    // If both joined but missing fields exist → AWAITING_BOTH_APPROVAL
    const both = fresh.participants.some((p) => p.role === 'buyer' && p.joinedAt) &&
      fresh.participants.some((p) => p.role === 'seller' && p.joinedAt);
    if (both && status === DEAL_STATUS.AWAITING_COUNTERPARTY) {
      await this.transitionStatus(dealId, status, DEAL_STATUS.AWAITING_BOTH_APPROVAL);
      return;
    }

    // If product+amount exist but no counterparty yet
    if (
      status === DEAL_STATUS.DRAFT &&
      fresh.product?.title &&
      fresh.amount &&
      fresh.amount > 0
    ) {
      await this.transitionStatus(dealId, status, DEAL_STATUS.AWAITING_COUNTERPARTY);
    }
  }
}
