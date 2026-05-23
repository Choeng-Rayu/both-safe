import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
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
  LEDGER_ENTRY_TYPES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
} from '../common/constants';
import { WalletsService } from '../wallets/wallets.service';
import { LedgerService } from '../ledger/ledger.service';
import { assertCurrency, toMinorUnits } from '../wallets/helpers/money';
import { CreateDealDto } from './dto/create-deal.dto';
import { JoinDealDto } from './dto/join-deal.dto';
import {
  UpdateDeliveryDto,
  UpdateParticipantDto,
  UpdateProductDto,
} from './dto/update-sections.dto';
import { computeMissingFields, type DealLike } from './missing-fields';
import {
  assertTransition,
  canCancel,
  canConfirmReceived,
  canOpenDispute,
  canUploadPaymentProof,
  canUploadShippingProof,
  isPostPayment,
  isTerminal,
} from './status.engine';
import type { RequestActor } from '../common/decorators/current-actor.decorator';

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: ConfigService,
    private readonly audit: AuditService,
    private readonly notif: NotificationService,
    private readonly wallets: WalletsService,
    private readonly ledger: LedgerService,
    private readonly logger: WinstonLoggerService,
  ) {}

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
    if (!deal)
      throw new NotFoundException({ messageKey: MESSAGE_KEYS.DEAL_NOT_FOUND });
    return deal;
  }

  private allowedActions(deal: DealLike, actor: RequestActor): string[] {
    const status = deal.status as DealStatus;
    const role = actor.role;
    const acts: string[] = [];

    if (
      status === DEAL_STATUS.DRAFT ||
      status === DEAL_STATUS.AWAITING_COUNTERPARTY
    ) {
      acts.push('share_invite_link', 'update_product', 'update_participant');
    }
    if (status === DEAL_STATUS.AWAITING_BOTH_APPROVAL) {
      acts.push('approve');
      if (role) acts.push('update_product', 'update_participant');
    }
    if (status === DEAL_STATUS.READY_FOR_PAYMENT && role === 'buyer') {
      acts.push('upload_payment_proof');
    }
    if (canCancel(status) && role === 'buyer') acts.push('cancel');
    if (
      (status === DEAL_STATUS.PAID_ESCROWED ||
        status === DEAL_STATUS.SELLER_PREPARING) &&
      role === 'seller'
    ) {
      acts.push('upload_shipping_proof');
    }
    // Buyer can confirm receipt as soon as the seller is preparing (no
    // shipping proof required) — the act of confirming is what releases
    // the funds.
    if (
      role === 'buyer' &&
      (status === DEAL_STATUS.SELLER_PREPARING ||
        status === DEAL_STATUS.SHIPPED)
    ) {
      acts.push('confirm_received', 'open_dispute');
    }
    if (canOpenDispute(status)) acts.push('open_dispute');
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
      missing_fields: missing,
      allowed_actions: this.allowedActions(deal, actor),
    };
  }

  async createDeal(dto: CreateDealDto, userId?: string) {
    // The wallet-enabled flow requires every deal participant to be a
    // registered user. The Telegram bot path uses chat-id-based identity
    // and is exempt from this guard for now.
    if (dto.source === 'web' && !userId) {
      throw new BadRequestException({ messageKey: 'auth.login_required' });
    }
    const publicId = generatePublicId();
    const inviteToken = generateOpaqueToken();
    const creatorAccess = generateOpaqueToken();
    const inviteTtlH = Number(
      this.cfg.get<string>('INVITE_TOKEN_TTL_HOURS') ?? '72',
    );
    const dealTtlH = Number(
      this.cfg.get<string>('DEAL_EXPIRES_HOURS') ?? '720',
    );

    // Start as DRAFT, transition to AWAITING_COUNTERPARTY if minimum fields present
    const hasMinimumFields = !!(
      dto.product_title &&
      dto.amount &&
      dto.amount > 0 &&
      dto.creator_name
    );
    const initialStatus = hasMinimumFields
      ? DEAL_STATUS.AWAITING_COUNTERPARTY
      : DEAL_STATUS.DRAFT;

    const deal = await this.prisma.deal.create({
      data: {
        publicId,
        creatorRole: dto.creator_role,
        source: dto.source,
        status: initialStatus,
        currency:
          dto.currency ?? this.cfg.get<string>('DEFAULT_CURRENCY') ?? 'USD',
        amount: dto.amount ?? null,
        createdByUserId: userId ?? null,
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

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      action: 'deal.created',
      details: { source: dto.source, creator_role: dto.creator_role },
    });
    this.logger.action('deal.created', {
      public_id: publicId,
      creator_role: dto.creator_role,
      source: dto.source,
    });

    const urls = this.buildUrls(publicId, creatorAccess, inviteToken);
    const fresh = await this.loadDeal(publicId);
    const missing = computeMissingFields(fresh);
    return {
      public_id: publicId,
      status: fresh.status,
      ...urls,
      missing_fields: missing,
      allowed_actions: this.allowedActions(fresh, {
        type: 'participant',
        role: dto.creator_role,
        participantId: deal.participants[0].id,
      }),
      message_key: MESSAGE_KEYS.DEAL_CREATED,
    };
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
    return {
      payment_id: latest.id,
      admin_status: latest.adminStatus,
      paid_amount: latest.paidAmount,
      expected_amount: latest.expectedAmount,
      receiver_account_label: latest.receiverAccountLabel,
      proof_image_url: this.fileUrl(latest.proofImageUrl),
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
      package_photo_url: this.fileUrl(s.packagePhotoUrl),
      delivery_receipt_url: this.fileUrl(s.deliveryReceiptUrl),
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

  async joinDeal(
    publicId: string,
    dto: JoinDealDto,
    actor: RequestActor,
    userId?: string,
  ) {
    if (actor.type !== 'invite')
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.INVALID_TOKEN });
    const deal = await this.loadDeal(publicId);
    if (deal.source === 'web' && !userId && !dto.telegram_chat_id) {
      // Web-originated deals require the joining party to be authenticated
      // so the wallet model has a known participant identity.
      throw new BadRequestException({ messageKey: 'auth.login_required' });
    }

    // Validate invite token
    if (deal.inviteTokenHash !== hashToken(dto.invite_token)) {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.INVITE_EXPIRED });
    }
    if (deal.inviteExpiresAt && deal.inviteExpiresAt < new Date()) {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.INVITE_EXPIRED });
    }

    // Counterparty role is opposite of creator
    const counterpartyRole = deal.creatorRole === 'buyer' ? 'seller' : 'buyer';
    if (dto.role !== counterpartyRole) {
      throw new BadRequestException({
        messageKey: 'deal.role_conflict',
        details: { expected_role: counterpartyRole },
      });
    }

    const existing = deal.participants.find((p) => p.role === counterpartyRole);
    if (existing?.joinedAt)
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.ALREADY_JOINED,
      });

    const accessToken = generateOpaqueToken();
    let participant: any;
    if (existing) {
      participant = await this.prisma.participant.update({
        where: { id: existing.id },
        data: {
          userId: userId ?? existing.userId,
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
          userId: userId ?? null,
          role: counterpartyRole,
          name: sanitizeText(dto.name) ?? '',
          phone: sanitizeText(dto.phone) ?? null,
          telegramChatId: dto.telegram_chat_id ?? null,
          preferredLanguage: dto.preferred_language,
          accessTokenHash: hashToken(accessToken),
          joinedAt: new Date(),
        },
      });
    }

    // Transition to AWAITING_BOTH_APPROVAL and invalidate invite token
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: {
        status: DEAL_STATUS.AWAITING_BOTH_APPROVAL,
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: participant.id,
      action: 'participant.joined',
      details: { role: counterpartyRole },
    });
    this.logger.action('participant.joined', {
      public_id: publicId,
      role: counterpartyRole,
      participant_id: participant.id,
    });

    const creator = deal.participants.find((p) => p.role === deal.creatorRole);
    await this.notif.notify({
      dealId: deal.id,
      eventKey: NOTIFICATION_EVENTS.COUNTERPARTY_JOINED,
      messageKey: MESSAGE_KEYS.COUNTERPARTY_JOINED,
      recipients: [
        { channel: 'inapp', ref: creator?.id ?? null },
        ...(creator?.telegramChatId
          ? [{ channel: 'telegram' as const, ref: creator.telegramChatId }]
          : []),
      ],
    });

    const after = await this.loadDeal(publicId);
    const missing = computeMissingFields(after);
    return {
      participant_access_url: `${this.appBase()}/d/${publicId}?access=${accessToken}`,
      access_token: accessToken,
      status: after.status,
      missing_fields: missing,
      allowed_actions: this.allowedActions(after, {
        ...actor,
        type: 'participant',
        role: counterpartyRole,
        participantId: participant.id,
      }),
      message_key: MESSAGE_KEYS.COUNTERPARTY_JOINED,
    };
  }

  /** Participant approves the deal terms */
  async approveDeal(publicId: string, actor: RequestActor) {
    if (!actor.role)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);

    if (deal.status !== DEAL_STATUS.AWAITING_BOTH_APPROVAL) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.INVALID_TRANSITION,
      });
    }

    const participant = deal.participants.find((p) => p.role === actor.role);
    if (!participant)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });

    // Record approval timestamp
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
    this.logger.action('deal.approved', {
      public_id: publicId,
      role: actor.role,
      participant_id: participant.id,
    });

    // Check if both approved and all fields complete
    const fresh = await this.loadDeal(publicId);
    const missing = computeMissingFields(fresh);
    const allApproved = fresh.participants.every((p) => p.approvedAt != null);

    if (allApproved && missing.length === 0) {
      await this.prisma.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.READY_FOR_PAYMENT },
      });
      await this.audit.record({
        dealId: deal.id,
        actorType: 'system',
        action: 'status.transition',
        details: {
          from: DEAL_STATUS.AWAITING_BOTH_APPROVAL,
          to: DEAL_STATUS.READY_FOR_PAYMENT,
        },
      });
      this.logger.action('status.transition', {
        public_id: publicId,
        from: DEAL_STATUS.AWAITING_BOTH_APPROVAL,
        to: DEAL_STATUS.READY_FOR_PAYMENT,
      });

      // Notify both inapp and Telegram channels. The buyer needs the
      // amount and receiving account so they can pay (Req 14.3).
      const buyer = fresh.participants.find((p) => p.role === 'buyer');
      const recipients = [
        ...fresh.participants.map((p) => ({
          channel: 'inapp' as const,
          ref: p.id,
        })),
        ...(buyer?.telegramChatId
          ? [{ channel: 'telegram' as const, ref: buyer.telegramChatId }]
          : []),
      ];
      await this.notif.notify({
        dealId: deal.id,
        eventKey: NOTIFICATION_EVENTS.BOTH_APPROVED,
        messageKey: MESSAGE_KEYS.BOTH_APPROVED,
        recipients,
        payload: {
          amount: fresh.amount,
          currency: fresh.currency,
          receiver_account_label:
            this.cfg.get<string>('BAKONG_MERCHANT_NAME') ?? 'BothSafe',
        },
      });
    }

    const updated = await this.loadDeal(publicId);
    return {
      status: updated.status,
      message_key:
        allApproved && missing.length === 0
          ? MESSAGE_KEYS.BOTH_APPROVED
          : MESSAGE_KEYS.APPROVED,
      missing_fields: computeMissingFields(updated),
      allowed_actions: this.allowedActions(updated, actor),
    };
  }

  private assertCanEdit(
    deal: DealLike,
    field: 'product' | 'participant' | 'delivery',
  ) {
    if (isPostPayment(deal.status as DealStatus)) {
      if (field === 'product' || field === 'participant') {
        throw new ForbiddenException({
          messageKey: MESSAGE_KEYS.CANNOT_UPDATE_LOCKED,
        });
      }
    }
  }

  async updateProduct(
    publicId: string,
    dto: UpdateProductDto,
    actor: RequestActor,
  ) {
    const deal = await this.loadDeal(publicId);
    if (!actor.role)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    this.assertCanEdit(deal, 'product');
    const productData: any = {};
    if (dto.title !== undefined) productData.title = sanitizeText(dto.title);
    if (dto.type !== undefined) productData.type = sanitizeText(dto.type);
    if (dto.description !== undefined)
      productData.description = sanitizeText(dto.description);
    if (dto.image_url !== undefined) productData.imageUrl = dto.image_url;
    if (dto.quantity !== undefined) productData.quantity = dto.quantity;
    if (dto.condition !== undefined)
      productData.condition = sanitizeText(dto.condition);
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
    this.logger.action('product.updated', {
      public_id: publicId,
      participant_id: actor.participantId,
    });
    await this.recomputeStatusAfterEdit(deal.id);
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateParticipant(
    publicId: string,
    dto: UpdateParticipantDto,
    actor: RequestActor,
  ) {
    const deal = await this.loadDeal(publicId);
    this.assertCanEdit(deal, 'participant');
    if (!actor.role)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const participant = deal.participants.find((p) => p.role === actor.role);
    if (!participant)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    await this.prisma.participant.update({
      where: { id: participant.id },
      data: {
        name:
          dto.name !== undefined
            ? (sanitizeText(dto.name) ?? participant.name)
            : participant.name,
        phone:
          dto.phone !== undefined ? sanitizeText(dto.phone) : participant.phone,
        telegramChatId: dto.telegram_chat_id ?? participant.telegramChatId,
        wechatId: dto.wechat_id ?? participant.wechatId,
        messengerName: dto.messenger_name ?? participant.messengerName,
        preferredLanguage:
          dto.preferred_language ?? participant.preferredLanguage,
      },
    });
    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: participant.id,
      action: 'participant.updated',
      details: dto as any,
    });
    this.logger.action('participant.updated', {
      public_id: publicId,
      participant_id: participant.id,
    });
    return this.summary(await this.loadDeal(publicId), actor);
  }

  async updateDelivery(
    publicId: string,
    _dto: UpdateDeliveryDto,
    actor: RequestActor,
  ) {
    if (!actor.role)
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    return this.summary(await this.loadDeal(publicId), actor);
  }

  /** Buyer cancels deal — only allowed before both approve */
  async buyerCancel(publicId: string, actor: RequestActor) {
    if (actor.role !== 'buyer')
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    const deal = await this.loadDeal(publicId);
    if (!canCancel(deal.status as DealStatus))
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.INVALID_TRANSITION,
      });

    const buyer = deal.participants.find((p) => p.role === 'buyer');
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { status: DEAL_STATUS.CANCELLED },
    });
    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: buyer?.id ?? null,
      action: 'deal.cancelled_by_buyer',
    });
    this.logger.action('deal.cancelled_by_buyer', {
      public_id: publicId,
      buyer_id: buyer?.id,
    });

    const fresh = await this.loadDeal(publicId);
    return { status: fresh.status, message_key: MESSAGE_KEYS.DEAL_CANCELLED };
  }

  /**
   * Buyer confirms receipt. This is the canonical release trigger:
   *   1. Status moves from SELLER_PREPARING (or SHIPPED) → BUYER_CONFIRMED.
   *   2. The seller's wallet is credited atomically with the net seller
   *      amount (deal.netSellerAmount, falling back to the gross amount
   *      minus the platform fee if the verify path did not set it).
   *   3. Status moves to RELEASED.
   *
   * No admin step is required for the happy path — the flow.deal.md spec
   * says "the buyer approve that product they order is acceptable [and]
   * the money will release to the seller".
   */
  async confirmReceived(publicId: string, actor: RequestActor) {
    if (actor.role !== 'buyer') {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    const deal = await this.loadDeal(publicId);
    if (!canConfirmReceived(deal.status as DealStatus)) {
      throw new BadRequestException({ messageKey: 'confirmation.not_shipped' });
    }

    const buyer = deal.participants.find((p) => p.role === 'buyer');
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
    const grossMajor = deal.amount ?? 0;
    if (grossMajor <= 0) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
      });
    }
    const fee = +(grossMajor * (this.feePercent() / 100)).toFixed(2);
    const netMajor = deal.netSellerAmount ?? +(grossMajor - fee).toFixed(2);
    const amountMinor = toMinorUnits(netMajor, currency);
    const walletIdempotencyKey = `deal_release:${deal.id}`;

    await this.wallets.getOrCreateWallet(sellerUserId);

    // Atomic: BUYER_CONFIRMED → RELEASED with wallet credit.
    await this.prisma.$transaction(async (tx) => {
      // status.transition: SELLER_PREPARING|SHIPPED → BUYER_CONFIRMED
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: DEAL_STATUS.BUYER_CONFIRMED },
      });
      // Credit seller wallet.
      await this.wallets.creditInTx(tx, {
        userId: sellerUserId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: amountMinor,
        currency,
        idempotencyKey: walletIdempotencyKey,
        dealId: deal.id,
        description: `Deal ${deal.publicId} buyer-confirmed release`,
      });
      // Finalise status.
      await tx.deal.update({
        where: { id: deal.id },
        data: {
          status: DEAL_STATUS.RELEASED,
          netSellerAmount: netMajor,
          feeAmount: fee,
        },
      });
    });

    // Deal-level audit log + post-transaction ledger entry (outside the
    // wallet transaction so a logger hiccup does not roll back money).
    if (
      !(await this.ledger.hasEntry(
        deal.id,
        LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT,
      ))
    ) {
      await this.ledger.append({
        dealId: deal.id,
        entryType: LEDGER_ENTRY_TYPES.SELLER_PAYOUT_SENT,
        amount: netMajor,
        currency: deal.currency,
        reference: walletIdempotencyKey,
      });
    }
    await this.audit.record({
      dealId: deal.id,
      actorType: 'participant',
      actorId: buyer?.id ?? null,
      action: 'buyer.confirmed_received_auto_released',
      details: {
        amount_minor: amountMinor.toString(),
        currency,
      },
    });
    this.logger.action('buyer.confirmed_received', {
      public_id: publicId,
      buyer_id: buyer?.id,
      released_to_wallet: true,
    });

    // Notify seller + Telegram.
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
        amount_minor: amountMinor.toString(),
        currency,
      },
    });

    const fresh = await this.loadDeal(publicId);
    return {
      status: fresh.status,
      message_key: MESSAGE_KEYS.RELEASED_TO_WALLET,
      allowed_actions: this.allowedActions(fresh, actor),
    };
  }

  /**
   * Look up the BothSafe user id for a participant — prefers the linked
   * userId, falls back to TelegramIdentity.linkedUserId for legacy
   * bot-created deals where the participant row predates auto-linking.
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

  async transitionStatus(dealId: string, from: DealStatus, to: DealStatus) {
    assertTransition(from, to);
    await this.prisma.deal.update({
      where: { id: dealId },
      data: { status: to },
    });
    await this.audit.record({
      dealId,
      actorType: 'system',
      action: 'status.transition',
      details: { from, to },
    });
    this.logger.action('status.transition', { deal_id: dealId, from, to });
  }

  private async recomputeStatusAfterEdit(dealId: string) {
    const fresh = (await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { participants: true, product: true },
    })) as DealLike;
    if (!fresh) return;
    const status = fresh.status as DealStatus;

    // Only recompute from DRAFT
    if (status !== DEAL_STATUS.DRAFT) return;

    // Advance DRAFT to AWAITING_COUNTERPARTY once product + amount + creator name are ready
    if (fresh.product?.title && fresh.amount && fresh.amount > 0) {
      await this.transitionStatus(
        dealId,
        status,
        DEAL_STATUS.AWAITING_COUNTERPARTY,
      );
      this.logger.action('status.auto_advance', {
        deal_id: dealId,
        from: status,
        to: DEAL_STATUS.AWAITING_COUNTERPARTY,
      });
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

    const ACTIVE_STATUSES = [
      DEAL_STATUS.AWAITING_COUNTERPARTY,
      DEAL_STATUS.AWAITING_BOTH_APPROVAL,
      DEAL_STATUS.READY_FOR_PAYMENT,
      DEAL_STATUS.PAYMENT_PENDING_VERIFICATION,
      DEAL_STATUS.PAID_ESCROWED,
      DEAL_STATUS.SELLER_PREPARING,
      DEAL_STATUS.SHIPPED,
      DEAL_STATUS.BUYER_CONFIRMED,
      DEAL_STATUS.RELEASE_PENDING,
      DEAL_STATUS.DISPUTED,
    ];

    for (const deal of deals) {
      const card = {
        public_id: deal.publicId,
        status: deal.status,
        creator_role: deal.creatorRole,
        amount: deal.amount,
        currency: deal.currency,
        product_title: deal.product?.title ?? null,
        participants: deal.participants.map((p) => ({
          role: p.role,
          name: p.name,
        })),
        updated_at: deal.updatedAt,
      };
      if (deal.createdByUserId === userId) created.push(card);

      // "Waiting my approval" = deal is in the approval gate AND the
      // current user is a participant who hasn't approved yet.
      if (deal.status === DEAL_STATUS.AWAITING_BOTH_APPROVAL) {
        const me = deal.participants.find((p) => p.userId === userId);
        if (me && me.approvedAt == null) {
          waitingMyApproval.push(card);
        }
      }

      if (ACTIVE_STATUSES.includes(deal.status as any)) {
        active.push(card);
      } else if (isTerminal(deal.status as DealStatus)) {
        completedCancelled.push(card);
      }
    }

    return {
      created,
      waiting_my_approval: waitingMyApproval,
      active,
      completed_cancelled: completedCancelled,
    };
  }
}
