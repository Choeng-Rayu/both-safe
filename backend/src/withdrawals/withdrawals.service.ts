import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuditService } from '../common/services/audit.service';
import { NotificationService } from '../notifications/notification.service';
import {
  CURRENCIES,
  Currency,
  FILE_CATEGORIES,
  MESSAGE_KEYS,
  NOTIFICATION_EVENTS,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
  WITHDRAWAL_DESTINATION_TYPES,
  WITHDRAWAL_STATUS,
  WITHDRAWAL_TERMINAL_STATUSES,
  WithdrawalDestinationType,
  WithdrawalStatus,
} from '../common/constants';
import { FilesService } from '../files/files.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  CompleteWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/admin-action.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallets: WalletsService,
    private readonly audit: AuditService,
    private readonly files: FilesService,
    private readonly notif: NotificationService,
  ) {}

  /**
   * Simplified path: user uploads a QR image (Bakong, Binance, AcleDA, any
   * supported wallet) plus the amount. The image is stored privately, its
   * signed URL is recorded as the destination, and the withdrawal queues
   * for admin review. The admin opens the request, scans the QR with their
   * own wallet app, pays, then marks the withdrawal completed which debits
   * the user's BothSafe wallet.
   */
  async createWithQrUpload(
    userId: string,
    input: {
      currency: string;
      amount_minor: number | string;
      provider_label?: string;
    },
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { field: 'qr_image', reason: 'required' },
      });
    }
    if (
      input.currency !== CURRENCIES.USD &&
      input.currency !== CURRENCIES.KHR
    ) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { field: 'currency', allowed: Object.values(CURRENCIES) },
      });
    }
    const amountMinor = Number(input.amount_minor);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { field: 'amount_minor' },
      });
    }

    // Withdrawal QR images are marked public so the admin's <img> tag and
    // the user's own wallet view can render them without juggling auth
    // headers. Security boundary is the 16-byte random storage key in the
    // signed URL — same model used for shareable deal invite tokens.
    const stored = await this.files.store(file, {
      category: FILE_CATEGORIES.WITHDRAWAL_QR,
      uploadedBy: userId,
      isPublic: true,
    });
    const imageUrl = this.files.signedUrlFor(stored);

    return this.createForUser(userId, {
      currency: input.currency,
      amount_minor: amountMinor,
      destination: {
        type: WITHDRAWAL_DESTINATION_TYPES.BAKONG_KHQR,
        khqr_image: imageUrl,
        // Provider label is optional context for admin — stored as bank_name
        // since the schema doesn't have a dedicated label column. Admin UI
        // surfaces it next to the QR image.
        bank_name: input.provider_label?.trim() || undefined,
      },
    });
  }

  // ─── User-side ──────────────────────────────────────────────────────────

  async createForUser(userId: string, dto: CreateWithdrawalDto) {
    this.assertDestinationProvided(dto);
    const amount = BigInt(dto.amount_minor);
    if (amount <= 0n) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { field: 'amount_minor' },
      });
    }
    const currency = dto.currency;

    const wallet = await this.wallets.getOrCreateWallet(userId);
    const effective = await this.wallets.getEffectiveAvailable(
      userId,
      currency,
    );
    if (effective < amount) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.WALLET_INSUFFICIENT_FUNDS,
        details: {
          currency,
          requested: amount.toString(),
          effective_available: effective.toString(),
        },
      });
    }

    const publicId = this.generatePublicId();
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.withdrawal.create({
        data: {
          publicId,
          userId,
          walletId: wallet.id,
          amount,
          currency,
          destinationType: dto.destination.type,
          destinationKhqr: dto.destination.khqr ?? null,
          destinationKhqrImage: dto.destination.khqr_image ?? null,
          destinationBankName: dto.destination.bank_name ?? null,
          destinationAccountName: dto.destination.account_name ?? null,
          destinationAccountNumber: dto.destination.account_number ?? null,
          status: WITHDRAWAL_STATUS.PENDING_REVIEW,
        },
      });
      await this.wallets.lockInTx(tx, {
        userId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.WITHDRAWAL_LOCK,
        direction: WALLET_LEDGER_DIRECTIONS.LOCK,
        amount,
        currency,
        idempotencyKey: `withdrawal_lock:${created.id}`,
        withdrawalId: created.id,
        description: `Withdrawal ${created.publicId} locked`,
      });
      return created;
    });

    await this.audit.record({
      actorType: 'participant',
      actorId: userId,
      action: 'withdrawal.created',
      details: {
        withdrawal_id: withdrawal.id,
        currency,
        amount_minor: amount.toString(),
      },
    });

    return this.toApi(withdrawal);
  }

  async cancelForUser(userId: string, withdrawalId: string) {
    const withdrawal = await this.requireOwn(userId, withdrawalId);
    if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING_REVIEW) {
      throw new ConflictException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_INVALID_STATUS,
        details: { current: withdrawal.status },
      });
    }
    await this.transitionToTerminal(
      withdrawal.id,
      withdrawal.userId,
      withdrawal.amount,
      withdrawal.currency as Currency,
      WITHDRAWAL_STATUS.CANCELLED,
      { rejectionReason: 'user_cancelled' },
    );
    await this.audit.record({
      actorType: 'participant',
      actorId: userId,
      action: 'withdrawal.cancelled',
      details: { withdrawal_id: withdrawal.id },
    });
    return this.toApi(await this.requireOwn(userId, withdrawalId));
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.toApi(row));
  }

  async getForUser(userId: string, withdrawalId: string) {
    return this.toApi(await this.requireOwn(userId, withdrawalId));
  }

  // ─── Admin-side ─────────────────────────────────────────────────────────

  async adminList(status?: string) {
    const where: Prisma.WithdrawalWhereInput = {};
    if (status) where.status = status;
    const rows = await this.prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    return rows.map((row) => ({
      ...this.toApi(row),
      user: row.user,
    }));
  }

  async adminGet(withdrawalId: string) {
    const row = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        entries: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_NOT_FOUND,
      });
    }
    return {
      ...this.toApi(row),
      user: row.user,
      entries: row.entries.map((entry) => ({
        id: entry.id,
        entry_type: entry.entryType,
        direction: entry.direction,
        amount_minor: entry.amount.toString(),
        balance_after_minor: entry.balanceAfter.toString(),
        created_at: entry.createdAt.toISOString(),
      })),
    };
  }

  async approve(adminId: string, withdrawalId: string) {
    const withdrawal = await this.requireById(withdrawalId);
    if (withdrawal.status !== WITHDRAWAL_STATUS.PENDING_REVIEW) {
      throw new ConflictException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_INVALID_STATUS,
        details: { current: withdrawal.status },
      });
    }
    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: WITHDRAWAL_STATUS.APPROVED,
        reviewedByAdminId: adminId,
        reviewedAt: new Date(),
      },
    });
    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'withdrawal.approved',
      details: { withdrawal_id: withdrawal.id },
    });

    await this.notifyWithdrawalEvent(
      withdrawal.id,
      NOTIFICATION_EVENTS.WITHDRAWAL_APPROVED,
      MESSAGE_KEYS.WITHDRAWAL_APPROVED,
    );

    return this.toApi(updated);
  }

  async complete(
    adminId: string,
    withdrawalId: string,
    dto: CompleteWithdrawalDto,
  ) {
    const withdrawal = await this.requireById(withdrawalId);
    if (
      withdrawal.status !== WITHDRAWAL_STATUS.APPROVED &&
      withdrawal.status !== WITHDRAWAL_STATUS.PROCESSING
    ) {
      throw new ConflictException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_INVALID_STATUS,
        details: { current: withdrawal.status },
      });
    }
    const currency = withdrawal.currency as Currency;
    const amount = withdrawal.amount;
    const debitKey = `withdrawal_debit:${withdrawal.id}`;
    const unlockKey = `withdrawal_unlock:${withdrawal.id}`;

    await this.prisma.$transaction(async (tx) => {
      // Mark withdrawal terminal first; this removes it from the pending set
      // so debit/unlock calculations downstream see the post-state.
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: WITHDRAWAL_STATUS.COMPLETED,
          providerReference: dto.provider_reference ?? null,
          reviewedByAdminId: adminId,
          reviewedAt: withdrawal.reviewedAt ?? new Date(),
          updatedAt: new Date(),
        },
      });
      // Write the unlock entry for ledger completeness.
      await this.wallets.unlockInTx(tx, {
        userId: withdrawal.userId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.WITHDRAWAL_UNLOCK,
        direction: WALLET_LEDGER_DIRECTIONS.UNLOCK,
        amount,
        currency,
        idempotencyKey: unlockKey,
        withdrawalId: withdrawal.id,
        description: `Withdrawal ${withdrawal.publicId} unlock`,
      });
      // Apply the actual balance debit.
      await this.wallets.debitInTx(tx, {
        userId: withdrawal.userId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.WITHDRAWAL_DEBIT,
        direction: WALLET_LEDGER_DIRECTIONS.DEBIT,
        amount,
        currency,
        idempotencyKey: debitKey,
        withdrawalId: withdrawal.id,
        createdByAdminId: adminId,
        description: `Withdrawal ${withdrawal.publicId} debit`,
      });
    });

    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'withdrawal.completed',
      details: {
        withdrawal_id: withdrawal.id,
        provider_reference: dto.provider_reference,
        admin_note: dto.admin_note,
      },
    });

    // Withdrawal completion is now surfaced to the user via the
    // generic notification stream (in-app + Telegram). The wallet
    // UI consumes the same feed via /v1/users/me/notifications.
    await this.notifyWithdrawalEvent(
      withdrawal.id,
      NOTIFICATION_EVENTS.WITHDRAWAL_COMPLETED,
      MESSAGE_KEYS.WITHDRAWAL_COMPLETED,
      { provider_reference: dto.provider_reference ?? null },
    );

    return this.toApi(await this.requireById(withdrawalId));
  }

  async reject(
    adminId: string,
    withdrawalId: string,
    dto: RejectWithdrawalDto,
  ) {
    const withdrawal = await this.requireById(withdrawalId);
    if (
      withdrawal.status !== WITHDRAWAL_STATUS.PENDING_REVIEW &&
      withdrawal.status !== WITHDRAWAL_STATUS.APPROVED
    ) {
      throw new ConflictException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_INVALID_STATUS,
        details: { current: withdrawal.status },
      });
    }
    await this.transitionToTerminal(
      withdrawal.id,
      withdrawal.userId,
      withdrawal.amount,
      withdrawal.currency as Currency,
      WITHDRAWAL_STATUS.REJECTED,
      { rejectionReason: dto.reason, reviewedByAdminId: adminId },
    );
    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'withdrawal.rejected',
      details: { withdrawal_id: withdrawal.id, reason: dto.reason },
    });

    await this.notifyWithdrawalEvent(
      withdrawal.id,
      NOTIFICATION_EVENTS.WITHDRAWAL_REJECTED,
      MESSAGE_KEYS.WITHDRAWAL_REJECTED,
      { reason: dto.reason },
    );

    return this.toApi(await this.requireById(withdrawalId));
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  /**
   * Dispatch an in-app + (optional) Telegram notification for a
   * withdrawal lifecycle event. Looks up the user's most recent
   * Telegram identity so the user is notified on the channel they
   * actually use. Failures here are swallowed — admin actions
   * should not be rolled back if the notification path fails.
   */
  private async notifyWithdrawalEvent(
    withdrawalId: string,
    eventKey: string,
    messageKey: string,
    extra: Record<string, unknown> = {},
  ) {
    try {
      const w = await this.prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: {
          id: true,
          publicId: true,
          userId: true,
          amount: true,
          currency: true,
          status: true,
        },
      });
      if (!w) return;
      const telegramIdentity = await this.prisma.telegramIdentity.findFirst({
        where: { linkedUserId: w.userId },
        orderBy: { createdAt: 'desc' },
        select: { chatId: true },
      });
      await this.notif.notifyUser({
        userId: w.userId,
        eventKey,
        messageKey,
        telegramChatId: telegramIdentity?.chatId ?? null,
        payload: {
          withdrawal_id: w.id,
          public_id: w.publicId,
          amount_minor: w.amount.toString(),
          currency: w.currency,
          status: w.status,
          ...extra,
        },
      });
    } catch {
      // best-effort; never block admin action.
    }
  }

  private async transitionToTerminal(
    withdrawalId: string,
    userId: string,
    amount: bigint,
    currency: Currency,
    nextStatus: WithdrawalStatus,
    extra: {
      rejectionReason?: string | null;
      reviewedByAdminId?: string;
    },
  ) {
    if (!WITHDRAWAL_TERMINAL_STATUSES.includes(nextStatus)) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: nextStatus,
          rejectionReason: extra.rejectionReason ?? null,
          reviewedByAdminId: extra.reviewedByAdminId ?? null,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      await this.wallets.unlockInTx(tx, {
        userId,
        entryType: WALLET_LEDGER_ENTRY_TYPES.WITHDRAWAL_UNLOCK,
        direction: WALLET_LEDGER_DIRECTIONS.UNLOCK,
        amount,
        currency,
        idempotencyKey: `withdrawal_unlock:${withdrawalId}`,
        withdrawalId,
        description: `Withdrawal unlocked (${nextStatus})`,
      });
    });
  }

  private async requireOwn(userId: string, withdrawalId: string) {
    const row = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) {
      throw new NotFoundException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_NOT_FOUND,
      });
    }
    if (row.userId !== userId) {
      throw new ForbiddenException({ messageKey: MESSAGE_KEYS.FORBIDDEN });
    }
    return row;
  }

  private async requireById(withdrawalId: string) {
    const row = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });
    if (!row) {
      throw new NotFoundException({
        messageKey: MESSAGE_KEYS.WITHDRAWAL_NOT_FOUND,
      });
    }
    return row;
  }

  private assertDestinationProvided(dto: CreateWithdrawalDto) {
    const d = dto.destination;
    if (d.type === WITHDRAWAL_DESTINATION_TYPES.BAKONG_KHQR) {
      if (!d.khqr && !d.khqr_image) {
        throw new BadRequestException({
          messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
          details: {
            field: 'destination',
            reason: 'khqr or khqr_image required',
          },
        });
      }
    } else if (d.type === WITHDRAWAL_DESTINATION_TYPES.BANK_ACCOUNT) {
      if (!d.bank_name || !d.account_number) {
        throw new BadRequestException({
          messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
          details: {
            field: 'destination',
            reason: 'bank_name and account_number required',
          },
        });
      }
    }
  }

  private generatePublicId(): string {
    return `WD_${crypto.randomBytes(6).toString('base64url').toUpperCase()}`;
  }

  private toApi(row: {
    id: string;
    publicId: string;
    userId: string;
    amount: bigint;
    currency: string;
    destinationType: string;
    destinationKhqr: string | null;
    destinationKhqrImage: string | null;
    destinationBankName: string | null;
    destinationAccountName: string | null;
    destinationAccountNumber: string | null;
    status: string;
    rejectionReason: string | null;
    providerReference: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      public_id: row.publicId,
      user_id: row.userId,
      amount_minor: row.amount.toString(),
      currency: row.currency,
      destination: {
        type: row.destinationType as WithdrawalDestinationType,
        khqr: row.destinationKhqr,
        khqr_image: row.destinationKhqrImage,
        bank_name: row.destinationBankName,
        account_name: row.destinationAccountName,
        account_number: this.maskAccountNumber(row.destinationAccountNumber),
      },
      status: row.status,
      rejection_reason: row.rejectionReason,
      provider_reference: row.providerReference,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private maskAccountNumber(value: string | null): string | null {
    if (!value) return null;
    if (value.length <= 4) return value;
    return `••••${value.slice(-4)}`;
  }
}
