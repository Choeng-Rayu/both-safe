import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserAuthService } from '../auth/user-auth.service';
import { WalletsService } from '../wallets/wallets.service';
import { AuditService } from '../common/services/audit.service';
import { WinstonLoggerService } from '../common/logger/winston-logger.service';
import {
  Currency,
  MESSAGE_KEYS,
  WITHDRAWAL_ACTIVE_STATUSES,
} from '../common/constants';

export interface AdminUserListQuery {
  search?: string;
  role?: 'USER' | 'ADMIN' | 'all';
  status?: 'all' | 'active' | 'disabled';
  page?: string;
  pageSize?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAuth: UserAuthService,
    private readonly wallets: WalletsService,
    private readonly audit: AuditService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async listUsers(query: AdminUserListQuery) {
    const page = Math.max(1, Number(query.page ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? '25')));

    const where: Prisma.UserWhereInput = {};
    if (query.role && query.role !== 'all') where.role = query.role;
    if (query.status === 'active') where.disabled = false;
    if (query.status === 'disabled') where.disabled = true;

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { id: { equals: term } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          wallet: {
            select: {
              id: true,
              availableUsd: true,
              availableKhr: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              deals: true,
              withdrawals: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.toListItem(u)),
      total,
      page,
      pageSize,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
        oauthAccounts: {
          select: {
            id: true,
            provider: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, expiresAt: true, createdAt: true },
        },
        _count: {
          select: { deals: true, withdrawals: true, participants: true },
        },
      },
    });
    if (!user) {
      throw new NotFoundException({ messageKey: 'user.not_found' });
    }

    const walletSnapshot = await this.wallets
      .getSnapshot(user.id)
      .catch(() => null);

    const recentDeals = await this.prisma.deal.findMany({
      where: {
        OR: [
          { createdByUserId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        product: { select: { title: true } },
        participants: { select: { role: true, name: true, userId: true } },
      },
    });

    const recentWithdrawals = await this.prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      user: this.toDetail(user),
      wallet: walletSnapshot
        ? {
            wallet_id: walletSnapshot.walletId,
            available_usd_minor: walletSnapshot.availableUsd.toString(),
            available_khr_minor: walletSnapshot.availableKhr.toString(),
            effective_usd_minor: walletSnapshot.effectiveUsd.toString(),
            effective_khr_minor: walletSnapshot.effectiveKhr.toString(),
          }
        : null,
      recent_deals: recentDeals.map((d) => ({
        id: d.id,
        public_id: d.publicId,
        status: d.status,
        amount: d.amount,
        currency: d.currency,
        title: d.product?.title ?? null,
        created_at: d.createdAt.toISOString(),
        my_role:
          d.createdByUserId === user.id
            ? d.creatorRole
            : (d.participants.find((p) => p.userId === user.id)?.role ?? null),
      })),
      recent_withdrawals: recentWithdrawals.map((w) => ({
        id: w.id,
        public_id: w.publicId,
        amount_minor: w.amount.toString(),
        currency: w.currency,
        status: w.status,
        created_at: w.createdAt.toISOString(),
      })),
    };
  }

  async getUserWalletLedger(
    userId: string,
    options: { currency?: Currency; limit?: number; cursor?: string },
  ) {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException({ messageKey: 'user.not_found' });

    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const rows = await this.wallets.listLedger(
      userId,
      options.currency ?? null,
      limit,
      options.cursor,
    );
    return {
      entries: rows.map((row) => ({
        id: row.id,
        entry_type: row.entryType,
        direction: row.direction,
        amount_minor: row.amount.toString(),
        currency: row.currency,
        balance_after_minor: row.balanceAfter.toString(),
        deal_id: row.dealId,
        withdrawal_id: row.withdrawalId,
        payment_id: row.paymentId,
        description: row.description,
        created_at: row.createdAt.toISOString(),
      })),
      next_cursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  }

  async setDisabled(
    targetUserId: string,
    actingAdminId: string,
    disabled: boolean,
    reason?: string,
  ) {
    if (targetUserId === actingAdminId) {
      throw new BadRequestException({
        messageKey: 'admin.cannot_disable_self',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException({ messageKey: 'user.not_found' });
    if (target.role === 'ADMIN') {
      // Disabling another admin is dangerous and out of scope for the
      // MVP — the bootstrap admin is the operations owner and there is
      // no rotation flow yet. Reject explicitly so the UI can surface
      // a clear error instead of silently appearing to succeed.
      throw new ConflictException({ messageKey: 'admin.cannot_disable_admin' });
    }
    if (target.disabled === disabled) {
      return this.toDetail(target);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { disabled },
      include: {
        wallet: true,
      },
    });

    if (disabled) {
      // Force-logout: kill every active session for the user so the
      // ban takes effect immediately rather than at next login.
      await this.userAuth.revokeAllSessionsForUser(targetUserId);
    }

    await this.audit.record({
      actorType: 'admin',
      actorId: actingAdminId,
      action: disabled ? 'admin.user_disabled' : 'admin.user_enabled',
      details: {
        target_user_id: targetUserId,
        reason: reason ?? null,
      },
    });
    this.logger.action(
      disabled ? 'admin.user_disabled' : 'admin.user_enabled',
      {
        admin_id: actingAdminId,
        target_user_id: targetUserId,
      },
    );

    return this.toDetail(updated);
  }

  // ─── Mapping helpers ─────────────────────────────────────────────────────

  private toListItem(user: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    role: 'USER' | 'ADMIN';
    disabled: boolean;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    wallet: {
      id: string;
      availableUsd: bigint;
      availableKhr: bigint;
      updatedAt: Date;
    } | null;
    _count: { deals: number; withdrawals: number };
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      disabled: user.disabled,
      email_verified: user.emailVerified,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
      wallet: user.wallet
        ? {
            wallet_id: user.wallet.id,
            available_usd_minor: user.wallet.availableUsd.toString(),
            available_khr_minor: user.wallet.availableKhr.toString(),
            updated_at: user.wallet.updatedAt.toISOString(),
          }
        : null,
      deal_count: user._count.deals,
      withdrawal_count: user._count.withdrawals,
    };
  }

  private toDetail(user: {
    id: string;
    email: string | null;
    name: string | null;
    phone: string | null;
    role: 'USER' | 'ADMIN';
    disabled: boolean;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar_url: user.avatarUrl,
      role: user.role,
      disabled: user.disabled,
      email_verified: user.emailVerified,
      created_at: user.createdAt.toISOString(),
      updated_at: user.updatedAt.toISOString(),
    };
  }
}

export { WITHDRAWAL_ACTIVE_STATUSES, MESSAGE_KEYS };
