import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletsService } from './wallets.service';
import {
  CURRENCIES,
  WALLET_LEDGER_DIRECTIONS,
  WALLET_LEDGER_ENTRY_TYPES,
  WITHDRAWAL_STATUS,
} from '../common/constants';

// Tests focus on security invariants:
//   1. Atomic balance update + ledger write
//   2. Idempotency (unique key prevents double credit/debit)
//   3. Negative-balance refusal (in absolute terms and relative to pending locks)
//   4. Optimistic concurrency control via version field
//   5. Locks reduce effective available without changing materialized balance

interface WalletRow {
  id: string;
  userId: string;
  availableUsd: bigint;
  availableKhr: bigint;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface LedgerRow {
  id: string;
  walletId: string;
  userId: string;
  entryType: string;
  direction: string;
  amount: bigint;
  currency: string;
  balanceAfter: bigint;
  dealId: string | null;
  withdrawalId: string | null;
  paymentId: string | null;
  idempotencyKey: string;
  description: string | null;
  createdByAdminId: string | null;
  createdAt: Date;
}

interface WithdrawalRow {
  userId: string;
  amount: bigint;
  currency: string;
  status: string;
}

/**
 * In-memory Prisma stand-in. Just enough surface area to exercise the wallet
 * code paths under test — not a general Prisma mock.
 */
function makePrismaMock() {
  const wallets = new Map<string, WalletRow>();
  const ledger = new Map<string, LedgerRow>();
  const withdrawals: WithdrawalRow[] = [];

  const walletClient = {
    findUnique: async ({
      where,
    }: {
      where: { userId?: string; id?: string };
    }) => {
      if (where.userId) {
        for (const wallet of wallets.values()) {
          if (wallet.userId === where.userId) return wallet;
        }
        return null;
      }
      if (where.id) return wallets.get(where.id) ?? null;
      return null;
    },
    create: async ({ data }: { data: { userId: string } }) => {
      for (const wallet of wallets.values()) {
        if (wallet.userId === data.userId) {
          throw new Error('unique constraint userId');
        }
      }
      const row: WalletRow = {
        id: `wallet_${wallets.size + 1}`,
        userId: data.userId,
        availableUsd: 0n,
        availableKhr: 0n,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      wallets.set(row.id, row);
      return row;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; version: number };
      data: Record<string, unknown>;
    }) => {
      const wallet = wallets.get(where.id);
      if (!wallet || wallet.version !== where.version) {
        return { count: 0 };
      }
      const updated: WalletRow = { ...wallet };
      if ('availableUsd' in data)
        updated.availableUsd = data.availableUsd as bigint;
      if ('availableKhr' in data)
        updated.availableKhr = data.availableKhr as bigint;
      if (data.version && typeof data.version === 'object') {
        const v = data.version as { increment?: number };
        if (v.increment) updated.version = wallet.version + v.increment;
      }
      updated.updatedAt = new Date();
      wallets.set(wallet.id, updated);
      return { count: 1 };
    },
  };

  const ledgerClient = {
    findUnique: async ({ where }: { where: { idempotencyKey: string } }) => {
      for (const row of ledger.values()) {
        if (row.idempotencyKey === where.idempotencyKey) return row;
      }
      return null;
    },
    create: async ({ data }: { data: Omit<LedgerRow, 'id' | 'createdAt'> }) => {
      for (const row of ledger.values()) {
        if (row.idempotencyKey === data.idempotencyKey) {
          throw Object.assign(
            new Error(
              `Unique constraint failed: idempotencyKey=${data.idempotencyKey}`,
            ),
            { code: 'P2002' },
          );
        }
      }
      const row: LedgerRow = {
        id: `entry_${ledger.size + 1}`,
        ...data,
        createdAt: new Date(),
      };
      ledger.set(row.id, row);
      return row;
    },
    findMany: async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const rows = Array.from(ledger.values()).filter((row) => {
        if (!where) return true;
        if (where.userId && row.userId !== where.userId) return false;
        if (where.currency && row.currency !== where.currency) return false;
        return true;
      });
      return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
  };

  const withdrawalClient = {
    findMany: async ({
      where,
    }: {
      where: {
        userId: string;
        currency?: string;
        status: { in: string[] };
      };
    }) => {
      return withdrawals.filter((w) => {
        if (w.userId !== where.userId) return false;
        if (where.currency && w.currency !== where.currency) return false;
        return where.status.in.includes(w.status);
      });
    },
  };

  const txClient = {
    wallet: walletClient,
    walletLedgerEntry: ledgerClient,
    withdrawal: withdrawalClient,
  };

  return {
    prisma: {
      wallet: walletClient,
      walletLedgerEntry: ledgerClient,
      withdrawal: withdrawalClient,
      $transaction: async (work: (tx: typeof txClient) => Promise<unknown>) => {
        return work(txClient);
      },
    } as unknown as PrismaService,
    // Test affordances:
    pushWithdrawal: (row: WithdrawalRow) => withdrawals.push(row),
    getWallet: (userId: string) => {
      for (const wallet of wallets.values()) {
        if (wallet.userId === userId) return wallet;
      }
      return null;
    },
    getLedger: () => Array.from(ledger.values()),
  };
}

describe('WalletsService', () => {
  let service: WalletsService;
  let mocks: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    mocks = makePrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: PrismaService, useValue: mocks.prisma },
      ],
    }).compile();
    service = module.get(WalletsService);
  });

  describe('credit', () => {
    it('creates ledger entry and increases balance', async () => {
      await service.getOrCreateWallet('user-1');
      const newBalance = await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1250n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'deal_release:deal-1',
      });
      expect(newBalance).toBe(1250n);
      expect(mocks.getWallet('user-1')?.availableUsd).toBe(1250n);
      const entries = mocks.getLedger();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        entryType: 'DEAL_RELEASE_CREDIT',
        direction: 'credit',
        amount: 1250n,
        balanceAfter: 1250n,
        currency: 'USD',
      });
    });

    it('is idempotent on repeated key (no double credit)', async () => {
      await service.getOrCreateWallet('user-1');
      const first = await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'deal_release:deal-1',
      });
      const second = await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'deal_release:deal-1',
      });
      expect(first).toBe(1000n);
      expect(second).toBe(1000n);
      expect(mocks.getWallet('user-1')?.availableUsd).toBe(1000n);
      expect(mocks.getLedger()).toHaveLength(1);
    });

    it('rejects non-positive amounts', async () => {
      await service.getOrCreateWallet('user-1');
      await expect(
        service.credit({
          userId: 'user-1',
          entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
          direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
          amount: 0n,
          currency: CURRENCIES.USD,
          idempotencyKey: 'bad-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('routes USD vs KHR to the correct balance column', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 500n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'k1',
      });
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 20000n,
        currency: CURRENCIES.KHR,
        idempotencyKey: 'k2',
      });
      const wallet = mocks.getWallet('user-1');
      expect(wallet?.availableUsd).toBe(500n);
      expect(wallet?.availableKhr).toBe(20000n);
    });
  });

  describe('debit', () => {
    it('refuses to go negative', async () => {
      await service.getOrCreateWallet('user-1');
      await expect(
        service.debit({
          userId: 'user-1',
          entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_PAYMENT_DEBIT,
          direction: WALLET_LEDGER_DIRECTIONS.DEBIT,
          amount: 100n,
          currency: CURRENCIES.USD,
          idempotencyKey: 'debit-no-funds',
        }),
      ).rejects.toMatchObject({
        response: { messageKey: 'wallet.insufficient_funds' },
      });
      expect(mocks.getLedger()).toHaveLength(0);
    });

    it('subtracts on success and is idempotent on retry', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 500n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'credit-1',
      });
      const first = await service.debit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_PAYMENT_DEBIT,
        direction: WALLET_LEDGER_DIRECTIONS.DEBIT,
        amount: 300n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'debit-1',
      });
      const second = await service.debit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_PAYMENT_DEBIT,
        direction: WALLET_LEDGER_DIRECTIONS.DEBIT,
        amount: 300n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'debit-1',
      });
      expect(first).toBe(200n);
      expect(second).toBe(200n);
      expect(mocks.getWallet('user-1')?.availableUsd).toBe(200n);
      // Two ledger rows total: one credit, one debit (the second debit is
      // detected as a no-op via the idempotency key check).
      expect(
        mocks.getLedger().filter((e) => e.direction === 'debit'),
      ).toHaveLength(1);
    });
  });

  describe('lock and effective available', () => {
    it('lock does not change materialized balance but reduces effective available', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'credit-1',
      });
      // Simulate the user submitting a pending withdrawal: the withdrawal
      // row goes in withdrawals table AND the lock entry goes in ledger.
      mocks.pushWithdrawal({
        userId: 'user-1',
        amount: 400n,
        currency: 'USD',
        status: WITHDRAWAL_STATUS.PENDING_REVIEW,
      });
      await service.lock({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.WITHDRAWAL_LOCK,
        direction: WALLET_LEDGER_DIRECTIONS.LOCK,
        amount: 400n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'withdrawal_lock:w1',
        withdrawalId: 'w1',
      });
      // Materialized balance unchanged
      expect(mocks.getWallet('user-1')?.availableUsd).toBe(1000n);
      // Effective available = balance - active locks
      const snapshot = await service.getSnapshot('user-1');
      expect(snapshot.availableUsd).toBe(1000n);
      expect(snapshot.effectiveUsd).toBe(600n);
    });

    it('debit refuses when locked funds would push effective negative', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'credit-1',
      });
      mocks.pushWithdrawal({
        userId: 'user-1',
        amount: 800n,
        currency: 'USD',
        status: WITHDRAWAL_STATUS.PENDING_REVIEW,
      });
      // Effective available is only 200; trying to debit 500 must fail.
      await expect(
        service.debit({
          userId: 'user-1',
          entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_PAYMENT_DEBIT,
          direction: WALLET_LEDGER_DIRECTIONS.DEBIT,
          amount: 500n,
          currency: CURRENCIES.USD,
          idempotencyKey: 'debit-conflict',
        }),
      ).rejects.toMatchObject({
        response: { messageKey: 'wallet.insufficient_funds' },
      });
      // Balance untouched
      expect(mocks.getWallet('user-1')?.availableUsd).toBe(1000n);
    });

    it('terminal withdrawals do not reduce effective available', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'credit-1',
      });
      // A previously rejected withdrawal should not affect spendable balance.
      mocks.pushWithdrawal({
        userId: 'user-1',
        amount: 400n,
        currency: 'USD',
        status: WITHDRAWAL_STATUS.REJECTED,
      });
      const effective = await service.getEffectiveAvailable(
        'user-1',
        CURRENCIES.USD,
      );
      expect(effective).toBe(1000n);
    });
  });

  describe('optimistic concurrency', () => {
    it('throws ConflictException when wallet row is modified mid-flight', async () => {
      await service.getOrCreateWallet('user-1');
      await service.credit({
        userId: 'user-1',
        entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
        direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
        amount: 1000n,
        currency: CURRENCIES.USD,
        idempotencyKey: 'credit-1',
      });
      // Drive the wallet forward an extra version behind the service's back
      // so the next updateMany sees a version mismatch.
      const wallet = mocks.getWallet('user-1');
      if (!wallet) throw new Error('wallet missing');
      const originalVersion = wallet.version;
      // Force a stale read by spying on findUnique to return the original version
      // even though the underlying row will have advanced.
      const realFindUnique = mocks.prisma.wallet.findUnique;
      let firstCall = true;
      jest
        .spyOn(mocks.prisma.wallet, 'findUnique')
        .mockImplementation(async (args: any) => {
          const fresh = await realFindUnique.call(mocks.prisma.wallet, args);
          if (firstCall && fresh) {
            firstCall = false;
            // While the service is "in flight", bump the underlying row.
            await mocks.prisma.wallet.updateMany({
              where: { id: fresh.id, version: fresh.version },
              data: {
                availableUsd: fresh.availableUsd + 1n,
                version: { increment: 1 },
              },
            });
            // Return the stale snapshot to the service.
            return { ...fresh, version: originalVersion };
          }
          return fresh;
        });
      await expect(
        service.credit({
          userId: 'user-1',
          entryType: WALLET_LEDGER_ENTRY_TYPES.DEAL_RELEASE_CREDIT,
          direction: WALLET_LEDGER_DIRECTIONS.CREDIT,
          amount: 100n,
          currency: CURRENCIES.USD,
          idempotencyKey: 'credit-conflict',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getOrCreateWallet', () => {
    it('creates a wallet on first call and reuses it after', async () => {
      const first = await service.getOrCreateWallet('user-1');
      const second = await service.getOrCreateWallet('user-1');
      expect(first.id).toBe(second.id);
      expect(first.availableUsd).toBe(0n);
      expect(first.availableKhr).toBe(0n);
    });
  });
});
