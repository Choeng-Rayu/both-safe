# Wallet Integration Design

> Status: **Design — approved 2026-05-19**
> Scope: integrate an internal stored-value wallet into the existing BothSafe escrow flow.
> Owner: backend/frontend integration.
> See also: [CLAUDE.md](./CLAUDE.md), [AGENTS.md](./AGENTS.md).

---

## 1. Goals & Non-Goals

### Goals

- Every BothSafe user has an internal wallet with **separate USD and KHR balances**.
- When a deal is `RELEASED`, the seller's `netSellerAmount` credits their wallet (replacing the current direct external payout).
- When a deal is `REFUNDED`, the buyer's amount credits their wallet (replacing direct external refund).
- Buyers can fund a deal **from their wallet balance** as an alternative to KHQR payment.
- External cashout is a **separate user-initiated Withdrawal flow** with admin review.
- All deals require registered users; anonymous deal creation/join is removed from the wallet-enabled flow.
- Wallet money is **real money in real currency units**, stored as `BigInt` in the smallest unit per currency (USD cents, KHR riels) — no synthetic credits, no `Float` for money.

### Non-Goals (MVP)

- KYC / identity verification.
- Hold periods on incoming credits.
- Automatic withdrawal execution — every withdrawal is admin-reviewed and manually paid.
- Daily/monthly withdrawal caps.
- FX conversion between USD and KHR.
- Wallet-to-wallet transfers between users outside a deal.

These are deferred. The wallet schema is designed so they can be added later without breaking changes.

---

## 2. Roles & Trust Model

**Important contract:** the labels `buyer` and `seller` are **per-deal roles**, not account-level identities. Any registered user can be the buyer in one deal and the seller in another. The wallet is owned by the **user**, not the role.

The MVP trust model rests on two pillars:

1. **All deal participants are registered users.** Every actor is identifiable, every action is attributable. Anonymous deals are removed.
2. **Admin manually approves every withdrawal** before any money leaves the platform. Admin has full visibility into the user's deal history, wallet ledger, and counterparty patterns and can reject suspicious withdrawals.

No KYC, hold periods, or transaction caps are enforced in MVP. The admin review gate is the safety net.

---

## 3. Data Model

### 3.1 New tables

```prisma
model Wallet {
  id            String   @id @default(uuid())
  userId        String   @unique
  availableUsd  BigInt   @default(0)   // USD cents
  availableKhr  BigInt   @default(0)   // KHR riels (smallest unit)
  version       Int      @default(0)   // optimistic concurrency
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  entries       WalletLedgerEntry[]
  withdrawals   Withdrawal[]
}

model WalletLedgerEntry {
  id              String   @id @default(uuid())
  walletId        String
  userId          String                          // denormalized for query convenience
  entryType       String                          // see WALLET_LEDGER_ENTRY_TYPES below
  direction       String                          // "credit" | "debit" | "lock" | "unlock"
  amount          BigInt                          // always positive, minor units
  currency        String                          // "USD" | "KHR"
  balanceAfter    BigInt                          // snapshot of available* for this currency
  dealId          String?                         // when entry originated from a deal
  withdrawalId    String?                         // when entry originated from a withdrawal
  paymentId       String?                         // when entry originated from a buyer-paid-from-wallet payment
  idempotencyKey  String   @unique                // deterministic, prevents double-write
  description     String?
  createdByAdminId String?
  createdAt       DateTime @default(now())

  wallet          Wallet      @relation(fields: [walletId], references: [id], onDelete: Cascade)
  deal            Deal?       @relation(fields: [dealId], references: [id], onDelete: SetNull)
  withdrawal      Withdrawal? @relation(fields: [withdrawalId], references: [id], onDelete: SetNull)

  @@index([walletId, createdAt])
  @@index([userId, currency, createdAt])
  @@index([dealId])
  @@index([withdrawalId])
}

model Withdrawal {
  id                    String   @id @default(uuid())
  publicId              String   @unique
  userId                String
  walletId              String
  amount                BigInt                       // minor units, > 0
  currency              String                       // "USD" | "KHR"
  destinationType       String                       // "bakong_khqr" | "bank_account"
  destinationKhqr       String?                      // raw KHQR string
  destinationKhqrImage  String?                      // uploaded KHQR image URL
  destinationBankName   String?
  destinationAccountName String?
  destinationAccountNumber String?
  status                String   @default("PENDING_REVIEW")
                                                      // PENDING_REVIEW | APPROVED | PROCESSING |
                                                      // COMPLETED | REJECTED | FAILED | CANCELLED
  reviewedByAdminId     String?
  reviewedAt            DateTime?
  rejectionReason       String?
  providerReference     String?
  providerResponseJson  String?
  failureReason         String?
  transferAttemptId     String?  @unique
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  wallet                Wallet           @relation(fields: [walletId], references: [id], onDelete: Cascade)
  entries               WalletLedgerEntry[]
  transferAttempt       TransferAttempt? @relation(fields: [transferAttemptId], references: [id])

  @@index([userId, status])
  @@index([status, createdAt])
}
```

### 3.2 Changes to existing models

```prisma
model User {
  // existing fields...
  wallet        Wallet?
  withdrawals   Withdrawal[]
  walletEntries WalletLedgerEntry[]
}

model Deal {
  // existing fields...
  walletEntries WalletLedgerEntry[]
}

model Payment {
  // existing fields...
  // No new column. The existing `paymentMethod` String field gains a new
  // accepted value: "wallet_internal". Documented in PAYMENT_METHODS constant.
}

model TransferAttempt {
  // existing fields...
  withdrawalId  String?  @unique
  withdrawal    Withdrawal?
}
```

### 3.3 Currency-unit convention

| Currency | Field type | Smallest unit  | Example: 12.50 USD | Example: 5000 KHR |
| -------- | ---------- | -------------- | ------------------ | ----------------- |
| USD      | `BigInt`   | cent (1/100)   | `1250`             | n/a               |
| KHR      | `BigInt`   | riel (1 KHR=1) | n/a                | `5000`            |

All new wallet code uses minor units. Conversion to/from human-readable amounts happens at the API/UI boundary (`formatCurrency`). Existing `Deal.amount`, `Payment.expectedAmount`, etc. remain `Float` for backward compatibility; conversion happens in `WalletsService.toMinorUnits(amount, currency)`.

---

## 4. Wallet Ledger Semantics

### 4.1 Entry types (`backend/src/common/constants.ts`)

```typescript
export const WALLET_LEDGER_ENTRY_TYPES = {
  DEAL_PAYMENT_DEBIT:        'DEAL_PAYMENT_DEBIT',        // buyer paid a deal from wallet
  DEAL_RELEASE_CREDIT:       'DEAL_RELEASE_CREDIT',       // seller credited from deal release
  DEAL_REFUND_CREDIT:        'DEAL_REFUND_CREDIT',        // buyer credited from refund
  WITHDRAWAL_LOCK:           'WITHDRAWAL_LOCK',           // funds locked when withdrawal queued
  WITHDRAWAL_UNLOCK:         'WITHDRAWAL_UNLOCK',         // funds unlocked (rejected/cancelled/failed)
  WITHDRAWAL_DEBIT:          'WITHDRAWAL_DEBIT',          // funds debited when admin marks completed
  ADMIN_ADJUSTMENT_CREDIT:   'ADMIN_ADJUSTMENT_CREDIT',
  ADMIN_ADJUSTMENT_DEBIT:    'ADMIN_ADJUSTMENT_DEBIT',
} as const;
```

### 4.2 Idempotency keys (deterministic)

| Trigger                       | Key format                                       |
| ----------------------------- | ------------------------------------------------ |
| Buyer pays deal from wallet   | `deal_payment:{dealId}`                          |
| Seller release credit         | `deal_release:{dealId}`                          |
| Buyer refund credit           | `deal_refund:{dealId}`                           |
| Withdrawal lock               | `withdrawal_lock:{withdrawalId}`                 |
| Withdrawal unlock (rejected)  | `withdrawal_unlock:{withdrawalId}`               |
| Withdrawal debit (completed)  | `withdrawal_debit:{withdrawalId}`                |
| Admin adjustment              | `admin_adj:{adjustmentRef}`                      |

The `WalletLedgerEntry.idempotencyKey` column has `@unique`, so any retry that tries to write the same entry twice fails at the DB level and is converted to a no-op by `WalletsService`.

### 4.3 Append-only invariants

- Ledger entries are never updated or deleted.
- Wallet balance fields (`availableUsd`, `availableKhr`) are the materialized sum of credits minus debits and locked-then-debited withdrawals; locks alone do not affect the materialized balance — they affect *effective available* (see §5).
- Every balance update and its corresponding ledger entry happen inside a single `prisma.$transaction()`.

### 4.4 Concurrency control

`Wallet` carries a `version` integer. All balance-changing operations:

1. Read `wallet` row inside the transaction.
2. Compute new balance.
3. Update with `WHERE id = ? AND version = ?`, incrementing `version`.
4. If the row is missing (`updateMany` returns `count: 0`), abort the transaction and retry once. After one retry, fail with `wallet.concurrent_modification`.

This protects against two concurrent debits both seeing the same starting balance.

### 4.5 Negative-balance protection

Before any debit or lock, inside the transaction:

```
effectiveAvailable = wallet.availableX - sum(pending withdrawal locks in currency X)
require(effectiveAvailable >= amount, throw INSUFFICIENT_FUNDS)
```

---

## 5. Pending-Lock Mechanism

When a user requests a withdrawal:

1. `Withdrawal` row created with `status = PENDING_REVIEW`.
2. `WalletLedgerEntry` written with `entryType = WITHDRAWAL_LOCK`, `direction = "lock"`. **No change to `availableUsd`/`availableKhr`** at this point — the lock is informational and used only by the `getEffectiveAvailable` query.
3. From now on, `getEffectiveAvailable(userId, currency)` returns:

   ```
   wallet.available{Currency} - sum(amount of withdrawals where userId=user, currency=cur, status in [PENDING_REVIEW, APPROVED, PROCESSING])
   ```

   This is the value displayed to the user as "Available to spend" and is the value checked when the user tries to pay a deal from their wallet or create another withdrawal.

4. On admin completion: balance is reduced via `WITHDRAWAL_DEBIT` entry, withdrawal status → `COMPLETED`. The lock for that withdrawal becomes inactive (`status != PENDING_REVIEW|APPROVED|PROCESSING`), so the deduction is now reflected in `availableUsd`/`availableKhr` and the lock is no longer subtracted by `getEffectiveAvailable`.
5. On reject/cancel/fail: `WITHDRAWAL_UNLOCK` entry written; withdrawal moves to a terminal non-completed status; balance untouched and effective available recovers automatically.

This avoids a separate `WalletReservation` table while still giving us correct concurrent-safety semantics.

---

## 6. Deal-Flow Integration

The wallet plugs into the existing deal status machine at three points. **No new deal statuses are introduced**; the status enum stays exactly as documented in `CLAUDE.md`.

### 6.1 Buyer pays a deal from wallet (alternative to KHQR)

**Trigger:** deal is in `READY_FOR_PAYMENT`. Buyer is the authenticated user with sufficient effective available balance in deal currency.

**Endpoint:** `POST /v1/deals/:dealId/payments/wallet`

**Transaction:**

```
BEGIN
  wallet := SELECT FOR UPDATE wallet WHERE userId = buyer.userId
  assert getEffectiveAvailable(buyer, deal.currency) >= deal.amount
  payment := INSERT Payment (
    dealId = deal.id,
    expectedAmount = deal.amount,
    paidAmount = deal.amount,
    currency = deal.currency,
    paymentMethod = 'wallet_internal',
    adminStatus = 'verified',
    autoVerified = true,
    verifiedAt = now(),
  )
  INSERT WalletLedgerEntry (
    walletId, userId,
    entryType = DEAL_PAYMENT_DEBIT,
    direction = 'debit',
    amount = toMinor(deal.amount, deal.currency),
    currency = deal.currency,
    balanceAfter = wallet.balance - amount,
    dealId, paymentId,
    idempotencyKey = 'deal_payment:'||dealId,
  )
  UPDATE Wallet SET availableX = availableX - amount, version = version + 1
  INSERT existing-deal-Ledger Entry (ESCROW_RECEIVED)
  UPDATE Deal SET status = PAID_ESCROWED
COMMIT
```

Then notification + audit are emitted outside the transaction (existing pattern).

### 6.2 Seller release (replaces external payout)

**Trigger:** existing release path — admin or buyer-confirmation routes call `TransfersService.payoutSeller(dealId)`.

**Current behavior:** calls external transfer provider with seller's KHQR/bank details.

**New behavior:**

```
seller := deal.participants.find(role=='seller')
sellerUserId := seller.userId    // required — anonymous sellers no longer allowed
wallet := getOrCreateWallet(sellerUserId)
amount := toMinor(deal.netSellerAmount ?? deal.amount, deal.currency)

BEGIN
  wallet := SELECT FOR UPDATE Wallet WHERE userId = sellerUserId
  INSERT WalletLedgerEntry (
    entryType = DEAL_RELEASE_CREDIT,
    direction = 'credit',
    amount, currency = deal.currency,
    balanceAfter = wallet.balance + amount,
    dealId,
    idempotencyKey = 'deal_release:'||dealId,
  )
  UPDATE Wallet SET availableX = availableX + amount, version = version + 1
  INSERT existing Deal LedgerEntry (SELLER_PAYOUT_SENT)
  UPDATE Deal SET status = RELEASED
COMMIT
```

`TransferAttempt` is **not** created on release — there is no external transfer. The deal `LedgerEntry` `SELLER_PAYOUT_SENT` is still recorded so deal-level reconciliation is unchanged.

Notification message updated: `MESSAGE_KEYS.RELEASED_TO_WALLET = 'deal.released_to_wallet'` with translated copy "Funds released to your BothSafe wallet".

### 6.3 Buyer refund

Same shape as seller release but credits buyer's wallet with the original `paidAmount`.

```
buyer := deal.participants.find(role=='buyer')
buyerUserId := buyer.userId
amount := toMinor(payment.paidAmount ?? deal.amount, deal.currency)
idempotencyKey := 'deal_refund:'||dealId
entryType := DEAL_REFUND_CREDIT
```

Deal status → `REFUNDED`. Deal `LedgerEntry` `BUYER_REFUND_SENT` still written.

---

## 7. Withdrawal Flow

### 7.1 User submits a withdrawal request

**Endpoint:** `POST /v1/wallet/withdrawals`

**Body:**

```json
{
  "currency": "USD",
  "amount_minor": 1250,
  "destination": {
    "type": "bakong_khqr",
    "khqr": "00020101..."
  }
}
```

(Alternative `destination.type = "bank_account"` with bank fields.)

**Server logic:**

1. Validate body (Zod / class-validator DTO).
2. Look up wallet for `req.actor.userId`.
3. Compute `effectiveAvailable`. Reject if `< amount_minor` → `MESSAGE_KEYS.INSUFFICIENT_FUNDS`.
4. Inside a transaction:
   - Insert `Withdrawal { status: PENDING_REVIEW }`.
   - Insert `WalletLedgerEntry { entryType: WITHDRAWAL_LOCK, direction: 'lock', amount, idempotencyKey: 'withdrawal_lock:'||withdrawalId }`.
5. Audit + notify admin queue.

### 7.2 User cancels a pending withdrawal

**Endpoint:** `POST /v1/wallet/withdrawals/:id/cancel` (only allowed while `status = PENDING_REVIEW`).

Sets status to `CANCELLED` and writes a `WITHDRAWAL_UNLOCK` entry. Funds become spendable immediately.

### 7.3 Admin reviews & marks paid

**Admin endpoints (require `AdminGuard`):**

```
POST /v1/admin/withdrawals/:id/approve
POST /v1/admin/withdrawals/:id/complete   { provider_reference: string }
POST /v1/admin/withdrawals/:id/reject     { reason: string }
```

Flow:

1. Admin opens `/admin/withdrawals?status=PENDING_REVIEW`.
2. Admin reviews destination details, user history, recent deals.
3. **Approve:** marks status `APPROVED`. UI guides admin to pay manually via Bakong app or bank app.
4. **Mark Paid:** transaction below.
5. **Reject:** records reason, status `REJECTED`, writes unlock entry.

**Mark-paid transaction:**

```
BEGIN
  withdrawal := SELECT FOR UPDATE Withdrawal WHERE id=?
  assert status in (APPROVED, PROCESSING)
  wallet := SELECT FOR UPDATE Wallet WHERE id=withdrawal.walletId
  INSERT WalletLedgerEntry (
    entryType = WITHDRAWAL_DEBIT,
    direction = 'debit',
    amount = withdrawal.amount,
    currency = withdrawal.currency,
    balanceAfter = wallet.balance - amount,
    withdrawalId,
    idempotencyKey = 'withdrawal_debit:'||withdrawalId,
  )
  UPDATE Wallet SET availableX = availableX - amount, version = version + 1
  UPDATE Withdrawal SET status = COMPLETED, providerReference = ?, updatedAt = now()
COMMIT
```

### 7.4 Optional auto-execution (deferred for MVP)

If/when admin wants automatic provider calls, the existing `TransfersService.callProvider` flow can be reused. The schema already supports it via `Withdrawal.transferAttemptId`. Disabled in MVP per design direction.

---

## 8. API Surface

### 8.1 User routes (`AuthGuard`)

```
GET    /v1/wallet
GET    /v1/wallet/ledger?currency=&limit=&cursor=
POST   /v1/wallet/withdrawals
GET    /v1/wallet/withdrawals
GET    /v1/wallet/withdrawals/:id
POST   /v1/wallet/withdrawals/:id/cancel

POST   /v1/deals/:id/payments/wallet
```

`GET /v1/wallet` response:

```json
{
  "message_key": "wallet.summary",
  "wallet": {
    "available_usd_minor": 1250,
    "available_khr_minor": 50000,
    "effective_usd_minor": 1250,
    "effective_khr_minor": 30000,
    "currency_display": { "USD": "$12.50", "KHR": "៛50,000" }
  },
  "pending_withdrawals": [ /* ... */ ]
}
```

### 8.2 Admin routes (`AdminGuard`)

```
GET    /v1/admin/withdrawals?status=
GET    /v1/admin/withdrawals/:id
POST   /v1/admin/withdrawals/:id/approve
POST   /v1/admin/withdrawals/:id/complete
POST   /v1/admin/withdrawals/:id/reject
GET    /v1/admin/wallets/:userId
GET    /v1/admin/wallets/:userId/ledger
POST   /v1/admin/wallets/:userId/adjust   { direction, currency, amount_minor, reason }
```

### 8.3 Response envelope

All routes follow the existing convention with `message_key`, `missing_fields` (where applicable), and typed payloads. Money fields ending in `_minor` are integers; the frontend formats them via `formatCurrencyMinor(value, currency)`.

---

## 9. Module Structure

```
backend/src/wallets/
  wallets.module.ts
  wallets.service.ts          // ports: getOrCreate, summary, credit, debit, lock, unlock,
                              //         getEffectiveAvailable, listLedger
  wallets.controller.ts       // user routes
  dto/
    wallet-summary.dto.ts
    wallet-ledger-query.dto.ts
  helpers/
    money.ts                  // toMinor, fromMinor, formatCurrencyMinor

backend/src/withdrawals/
  withdrawals.module.ts
  withdrawals.service.ts
  withdrawals.controller.ts          // user routes
  admin-withdrawals.controller.ts    // admin routes
  dto/
    create-withdrawal.dto.ts
    complete-withdrawal.dto.ts
    reject-withdrawal.dto.ts

backend/src/transfers/transfers.service.ts        // refactored (release/refund -> wallet)
backend/src/deals/deals.service.ts                // add payFromWallet()
backend/src/deals/deals.controller.ts             // add POST /:dealId/payments/wallet
backend/src/common/constants.ts                   // WALLET_LEDGER_ENTRY_TYPES, WITHDRAWAL_STATUS,
                                                  //   PAYMENT_METHODS, new MESSAGE_KEYS
backend/src/users/users.service.ts                // hook: on user create -> ensure wallet exists

frontend/app/wallet/page.tsx                      // balance + ledger + withdrawal list
frontend/app/wallet/withdraw/page.tsx             // new withdrawal form
frontend/app/admin/withdrawals/page.tsx           // admin queue
frontend/app/admin/withdrawals/[id]/page.tsx     // admin detail + actions
frontend/components/deal/pay-with-wallet.tsx     // CTA on deal room
frontend/lib/api.ts                               // new endpoints + types
frontend/lib/format-currency.ts                   // helpers for minor-unit formatting
frontend/messages/index.ts                        // new keys in km, en, zh
```

---

## 10. Security Checklist

| Concern                          | Control                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Atomic balance updates           | All balance changes in `prisma.$transaction` with row-level lock or optimistic version check.   |
| Double-credit / double-debit     | `WalletLedgerEntry.idempotencyKey @unique` with deterministic keys per operation.                |
| Negative balance                 | Pre-check `effectiveAvailable >= amount` inside the transaction; rollback if violated.           |
| Concurrent debit race            | Optimistic concurrency on `Wallet.version`; one retry then fail.                                 |
| Identity-based fraud             | All deals require authenticated users; anonymous join disabled in wallet-enabled flow.           |
| Withdrawal abuse                 | Admin manual review of every withdrawal; reject with reason; manual adjustments for clawback.    |
| Rate limit                       | Global `HttpThrottlerGuard` + per-route limit on `POST /v1/wallet/withdrawals` (5/hour/user).    |
| Authorization                    | All wallet/withdrawal routes scoped by `req.actor.userId`; admin routes behind `AdminGuard`.     |
| Audit trail                      | Every wallet-affecting action records to `AuditLog` with actor type, actor id, IP.               |
| Logging hygiene                  | Never log full destination account numbers, KHQR images, or admin tokens.                        |
| Idempotent admin actions         | Mark-paid/reject/approve all use the withdrawal id; repeat clicks are no-ops.                    |
| Money precision                  | `BigInt` minor units throughout; no `Float` arithmetic in new code.                              |

---

## 11. Migration & Rollout

| Phase | Scope                                                                                  |
| ----- | -------------------------------------------------------------------------------------- |
| **1** | Prisma migration: add `Wallet`, `WalletLedgerEntry`, `Withdrawal`. Backfill empty wallet rows for all existing users. Wire `WalletsModule` but expose no behavior changes. Add `WALLET_ENABLED` env flag, default off in production. |
| **2** | Refactor `TransfersService.payoutSeller` and `refundBuyer` to credit wallets. New notification keys. Update existing deal frontend to surface "Funds in your wallet" message. |
| **3** | `WithdrawalsModule` user + admin routes. Admin queue UI. User wallet & withdraw UI. |
| **4** | `POST /v1/deals/:id/payments/wallet` + "Pay with Wallet" CTA on deal room (gated on auth + sufficient balance). |
| **5** | Tighten registration requirement: backend rejects unauthenticated deal create / join. Frontend redirects to login. Existing anonymous deals continue via opaque tokens until resolved; no new ones created. |

Feature flag `WALLET_ENABLED` gates Phase 2 onward at the controller level so a rollback is a config change, not a code revert.

---

## 12. Testing Strategy

### Unit (Jest)

- `WalletsService.credit` / `debit` / `lock` / `unlock`: idempotency (same key twice → no-op), negative-balance rejection, currency routing, balance snapshot correctness.
- `WalletsService.getEffectiveAvailable`: balance minus locks; ignores terminal-status withdrawals.
- `WithdrawalsService.create` / `cancel` / `complete` / `reject`: state transitions, ledger entries, error paths.
- `TransfersService.payoutSeller`: credits seller's wallet, idempotent on retry, audit + notification still emitted.
- Money helpers: `toMinor`, `fromMinor`, `formatCurrencyMinor` for both currencies.

### Integration (Jest + real Prisma DB)

- End-to-end deal: register → create deal → both approve → buyer pays from wallet → seller release → seller wallet credited.
- Concurrent debits: two parallel withdrawals on a wallet with exactly enough for one — only one succeeds.
- Refund flow: KHQR payment → admin verify → dispute → admin refund → buyer wallet credited.
- Cancel-then-spend race: pending withdrawal locks funds → user tries to pay deal from wallet → rejected with INSUFFICIENT_FUNDS until cancel.

### E2E (Playwright)

- Logged-in user opens `/wallet` and sees balance.
- User submits withdrawal → pending state visible in list.
- Admin logs in, opens queue, approves, marks paid → user sees balance reduced.
- Buyer pays deal from wallet → deal advances to `PAID_ESCROWED`.
- Seller wallet credited on release; notification visible.

Coverage target: **80% minimum** across new wallet/withdrawal code, in line with existing project policy.

---

## 13. Open / Deferred Items

| Topic                         | Note                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| KYC                           | Schema-ready via future `User.kycStatus`; gate withdrawals when needed.                   |
| Hold period on incoming credit| Schema-ready via future `WalletLedgerEntry.availableAt`; exclude entries when in future.  |
| Withdrawal caps               | Add `WithdrawalLimit` config table per user / per tier when needed.                       |
| FX swap (USD↔KHR)             | Not in scope.                                                                             |
| Wallet-to-wallet transfers    | Not in scope.                                                                             |
| Auto-execute withdrawals      | Reuse `TransfersService.callProvider` path when admin wants automation; off in MVP.       |

---

## 14. Glossary

- **Effective available** — wallet balance minus the sum of pending withdrawal locks for the same currency. This is what the user can actually spend.
- **Minor units** — currency's smallest indivisible unit. USD cent; KHR riel.
- **Pending withdrawal** — `Withdrawal` with `status ∈ { PENDING_REVIEW, APPROVED, PROCESSING }`.
- **Terminal withdrawal** — `Withdrawal` with `status ∈ { COMPLETED, REJECTED, CANCELLED, FAILED }`.
- **Idempotency key** — deterministic unique string on each `WalletLedgerEntry`; guarantees retries are safe.
