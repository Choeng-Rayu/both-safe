import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENCIES,
  Currency,
  MESSAGE_KEYS,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
  WITHDRAWAL_ACTIVE_STATUSES,
  WalletLedgerDirection,
  WalletLedgerEntryType,
} from '../common/constants';

type Tx = Prisma.TransactionClient;

export interface WalletBalanceSnapshot {
  walletId: string;
  userId: string;
  availableUsd: bigint;
  availableKhr: bigint;
  effectiveUsd: bigint;
  effectiveKhr: bigint;
}

export interface LedgerWriteInput {
  userId: string;
  entryType: WalletLedgerEntryType;
  direction: WalletLedgerDirection;
  amount: bigint;
  currency: Currency;
  idempotencyKey: string;
  dealId?: string | null;
  withdrawalId?: string | null;
  paymentId?: string | null;
  description?: string | null;
  createdByAdminId?: string | null;
}

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    try {
      return await this.prisma.wallet.create({ data: { userId } });
    } catch {
      const retry = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!retry) {
        throw new ConflictException({
          messageKey: MESSAGE_KEYS.WALLET_NOT_FOUND,
        });
      }
      return retry;
    }
  }

  async getSnapshot(userId: string): Promise<WalletBalanceSnapshot> {
    const wallet = await this.getOrCreateWallet(userId);
    const pendingByCurrency = await this.pendingWithdrawalsByCurrency(userId);
    const lockedUsd = pendingByCurrency.get(CURRENCIES.USD) ?? 0n;
    const lockedKhr = pendingByCurrency.get(CURRENCIES.KHR) ?? 0n;

    return {
      walletId: wallet.id,
      userId,
      availableUsd: wallet.availableUsd,
      availableKhr: wallet.availableKhr,
      effectiveUsd: wallet.availableUsd - lockedUsd,
      effectiveKhr: wallet.availableKhr - lockedKhr,
    };
  }

  async getEffectiveAvailable(
    userId: string,
    currency: Currency,
  ): Promise<bigint> {
    const snapshot = await this.getSnapshot(userId);
    return currency === CURRENCIES.USD
      ? snapshot.effectiveUsd
      : snapshot.effectiveKhr;
  }

  // ─── Core balance operations (must be called inside an outer transaction
  //     whenever the caller bundles other DB writes). When called directly,
  //     wraps in its own transaction. ──────────────────────────────────────

  async credit(input: LedgerWriteInput): Promise<bigint> {
    return this.runInTx((tx) => this.creditInTx(tx, input));
  }

  async debit(input: LedgerWriteInput): Promise<bigint> {
    return this.runInTx((tx) => this.debitInTx(tx, input));
  }

  async lock(input: LedgerWriteInput): Promise<void> {
    await this.runInTx((tx) => this.lockInTx(tx, input));
  }

  async unlock(input: LedgerWriteInput): Promise<void> {
    await this.runInTx((tx) => this.unlockInTx(tx, input));
  }

  // ─── Variants that participate in the caller's transaction ───────────────

  async creditInTx(tx: Tx, input: LedgerWriteInput): Promise<bigint> {
    if (input.amount <= 0n) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { reason: 'amount must be positive' },
      });
    }
    if (await this.entryExists(tx, input.idempotencyKey)) {
      const wallet = await this.requireWallet(tx, input.userId);
      return this.balanceFor(wallet, input.currency);
    }
    const wallet = await this.requireWalletForUpdate(tx, input.userId);
    const newBalance = this.balanceFor(wallet, input.currency) + input.amount;
    await this.updateWalletBalance(
      tx,
      wallet.id,
      wallet.version,
      input.currency,
      newBalance,
    );
    await this.writeEntry(tx, wallet.id, newBalance, input);
    return newBalance;
  }

  async debitInTx(tx: Tx, input: LedgerWriteInput): Promise<bigint> {
    if (input.amount <= 0n) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { reason: 'amount must be positive' },
      });
    }
    if (await this.entryExists(tx, input.idempotencyKey)) {
      const wallet = await this.requireWallet(tx, input.userId);
      return this.balanceFor(wallet, input.currency);
    }
    const wallet = await this.requireWalletForUpdate(tx, input.userId);
    const currentBalance = this.balanceFor(wallet, input.currency);
    const effectiveAvailable =
      currentBalance -
      (await this.lockedAmount(
        tx,
        input.userId,
        input.currency,
        input.withdrawalId,
      ));
    if (effectiveAvailable < input.amount) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.WALLET_INSUFFICIENT_FUNDS,
        details: {
          currency: input.currency,
          requested: input.amount.toString(),
          effective_available: effectiveAvailable.toString(),
        },
      });
    }
    const newBalance = currentBalance - input.amount;
    await this.updateWalletBalance(
      tx,
      wallet.id,
      wallet.version,
      input.currency,
      newBalance,
    );
    await this.writeEntry(tx, wallet.id, newBalance, input);
    return newBalance;
  }

  async lockInTx(tx: Tx, input: LedgerWriteInput): Promise<void> {
    if (input.amount <= 0n) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.VALIDATION_FAILED,
        details: { reason: 'amount must be positive' },
      });
    }
    if (await this.entryExists(tx, input.idempotencyKey)) return;
    const wallet = await this.requireWallet(tx, input.userId);
    const balance = this.balanceFor(wallet, input.currency);
    const locked = await this.lockedAmount(
      tx,
      input.userId,
      input.currency,
      input.withdrawalId,
    );
    const effective = balance - locked;
    if (effective < input.amount) {
      throw new BadRequestException({
        messageKey: MESSAGE_KEYS.WALLET_INSUFFICIENT_FUNDS,
        details: {
          currency: input.currency,
          requested: input.amount.toString(),
          effective_available: effective.toString(),
        },
      });
    }
    await this.writeEntry(tx, wallet.id, balance, {
      ...input,
      direction: WALLET_LEDGER_DIRECTIONS.LOCK,
    });
  }

  async unlockInTx(tx: Tx, input: LedgerWriteInput): Promise<void> {
    if (await this.entryExists(tx, input.idempotencyKey)) return;
    const wallet = await this.requireWallet(tx, input.userId);
    const balance = this.balanceFor(wallet, input.currency);
    await this.writeEntry(tx, wallet.id, balance, {
      ...input,
      direction: WALLET_LEDGER_DIRECTIONS.UNLOCK,
    });
  }

  async listLedger(
    userId: string,
    currency: Currency | null,
    limit = 50,
    cursor?: string,
  ) {
    const where: Prisma.WalletLedgerEntryWhereInput = { userId };
    if (currency) where.currency = currency;
    return this.prisma.walletLedgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  // ─── Internal helpers ────────────────────────────────────────────────────

  private async runInTx<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => work(tx as unknown as Tx));
  }

  private async entryExists(tx: Tx, idempotencyKey: string): Promise<boolean> {
    const found = await tx.walletLedgerEntry.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    return !!found;
  }

  private async requireWallet(tx: Tx, userId: string) {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException({
        messageKey: MESSAGE_KEYS.WALLET_NOT_FOUND,
      });
    }
    return wallet;
  }

  private async requireWalletForUpdate(tx: Tx, userId: string) {
    return this.requireWallet(tx, userId);
  }

  private balanceFor(
    wallet: { availableUsd: bigint; availableKhr: bigint },
    currency: Currency,
  ): bigint {
    return currency === CURRENCIES.USD
      ? wallet.availableUsd
      : wallet.availableKhr;
  }

  private async updateWalletBalance(
    tx: Tx,
    walletId: string,
    expectedVersion: number,
    currency: Currency,
    newBalance: bigint,
  ): Promise<void> {
    const field = currency === CURRENCIES.USD ? 'availableUsd' : 'availableKhr';
    const result = await tx.wallet.updateMany({
      where: { id: walletId, version: expectedVersion },
      data: { [field]: newBalance, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ConflictException({
        messageKey: MESSAGE_KEYS.WALLET_CONCURRENT_MODIFICATION,
      });
    }
  }

  private async writeEntry(
    tx: Tx,
    walletId: string,
    balanceAfter: bigint,
    input: LedgerWriteInput,
  ): Promise<void> {
    await tx.walletLedgerEntry.create({
      data: {
        walletId,
        userId: input.userId,
        entryType: input.entryType,
        direction: input.direction,
        amount: input.amount,
        currency: input.currency,
        balanceAfter,
        dealId: input.dealId ?? null,
        withdrawalId: input.withdrawalId ?? null,
        paymentId: input.paymentId ?? null,
        idempotencyKey: input.idempotencyKey,
        description: input.description ?? null,
        createdByAdminId: input.createdByAdminId ?? null,
      },
    });
  }

  private async pendingWithdrawalsByCurrency(
    userId: string,
  ): Promise<Map<string, bigint>> {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId, status: { in: [...WITHDRAWAL_ACTIVE_STATUSES] } },
      select: { amount: true, currency: true },
    });
    const map = new Map<string, bigint>();
    for (const row of rows) {
      const prev = map.get(row.currency) ?? 0n;
      map.set(row.currency, prev + row.amount);
    }
    return map;
  }

  private async lockedAmount(
    tx: Tx,
    userId: string,
    currency: Currency,
    excludeWithdrawalId?: string | null,
  ): Promise<bigint> {
    const where: Prisma.WithdrawalWhereInput = {
      userId,
      currency,
      status: { in: [...WITHDRAWAL_ACTIVE_STATUSES] },
    };
    if (excludeWithdrawalId) {
      // Skip the withdrawal currently being processed in this same
      // transaction. Without this, the freshly inserted PENDING_REVIEW
      // row counts itself as "locked", causing every withdraw to fail
      // with insufficient funds even when the wallet has the money.
      where.id = { not: excludeWithdrawalId };
    }
    const rows = await tx.withdrawal.findMany({
      where,
      select: { amount: true },
    });
    return rows.reduce((acc, row) => acc + row.amount, 0n);
  }
}
