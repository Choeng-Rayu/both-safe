# BothSafe API

NestJS API for BothSafe protected digital commerce: one-time digital product checkout, subscription entitlements, Binance Pay and Bakong/PayWay provider adapters, manual release review, disputes, append-only ledger, Telegram notifications, and private object storage signed URLs.

## Quick Start

```bash
npm install
docker compose up -d postgres redis
cp .env.example .env
npm run prisma:migrate
npm run start:dev
```

Local API:

```text
http://localhost:3001
```

Health check:

```bash
curl http://localhost:3001/
```

## Important V1 Safety Rules

- BothSafe does not directly custody buyer funds in V1.
- Payment webhooks must be verified and reconciled before access is granted.
- Entitlements are the source of truth for downloads, license reveals, and subscription access.
- Auto-release creates an admin review task; seller payout/refund remains manually approved.
- Ledger entries are append-only; use reversal entries instead of edits.

## Main Modules

- `PaymentModule`: provider abstraction, Binance Pay, PayWay/Bakong, webhooks, reconciliation hooks.
- `EntitlementModule`: `canAccess`, one-time grants, subscription grants, revocation, usage logging.
- `EscrowModule`: deal state machine, buyer confirmation, release candidate creation.
- `LedgerModule`: protected-funds obligation ledger.
- `DisputeModule`: dispute freeze, evidence messages, admin review handoff.
- `AdminModule`: release/refund decision queue.
- `DigitalProductModule`: product policy, scan metadata, private file versions.
- `StorageModule`: S3/R2 signed upload and entitlement-gated download URLs.
- `TelegramModule`: grammy bot shell, disabled until `TELEGRAM_BOT_TOKEN` is set.

## Verification

```bash
npm run build
npm run lint -- --max-warnings=0
npm test -- --runInBand
npm audit --omit=dev
DATABASE_URL='postgresql://bothsafe:bothsafe@localhost:5432/bothsafe?schema=public' npx prisma validate --schema prisma/schema.prisma
```

## Environment

Use `.env.example` as the checklist. Keep real values in `.env`; it is ignored by git.
