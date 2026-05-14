# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BothSafe is an escrow-based payment protection platform for Cambodia's social commerce ecosystem. Buyers and sellers transact through chat apps; BothSafe holds payment in escrow until delivery is confirmed. The product is a shareable **Deal Room Link** that both parties use to complete a protected transaction.

## Monorepo Structure

```
/backend    NestJS API + Telegram bot module (same process)
/frontend   Next.js web app (App Router, Tailwind v4)
/bothsafe   Docker compose for PostgreSQL + Redis
/tasks      Detailed per-layer task breakdowns
```

## Common Commands

### Backend (`cd backend`)

```bash
npm run start:dev          # Dev server with watch (port 3003)
npm run build              # Production build
npm run test               # Run Jest unit tests
npm run test:e2e           # Run e2e tests (jest --config ./test/jest-e2e.json)
npm run test:watch         # Watch mode
npm run lint               # ESLint with auto-fix

npx prisma migrate dev     # Run migrations in dev
npx prisma migrate deploy  # Run migrations in production/Docker
npx prisma db seed         # Seed test data
npx prisma generate        # Regenerate Prisma client
```

### Frontend (`cd frontend`)

```bash
npm run dev                # Dev server (port 3000)
npm run build              # Production build
npm run lint               # ESLint
npm run test:e2e           # Playwright tests
```

### Infrastructure (`cd backend`)

```bash
docker compose up -d       # Start PostgreSQL (5432) + Redis (6379)
docker compose down -v     # Stop and remove volumes (resets DB)
```

**Do not** create a new PostgreSQL service — it already runs via the Docker compose above.

## Environment Setup

- **Backend**: `backend/.env` (no `.env.example`; copy from existing `.env` and fill secrets)
- **Frontend**: `frontend/.env.local` (see `.env.example` — only `NEXT_PUBLIC_API_BASE_URL`)
- Backend Swagger docs available at `http://localhost:3003/docs`

## Architecture

### Three-Layer Deal Status Contract

The deal status enum is the single source of truth shared across backend, frontend, and Telegram bot. **Never** add intermediate statuses or invent new ones in any layer.

```
DRAFT → AWAITING_COUNTERPARTY → AWAITING_BOTH_APPROVAL → READY_FOR_PAYMENT
→ PAYMENT_PENDING_VERIFICATION → PAID_ESCROWED → SELLER_PREPARING → SHIPPED
→ BUYER_CONFIRMED → RELEASE_PENDING → RELEASED
```

Terminal states: `RELEASED`, `REFUNDED`, `CANCELLED`, `EXPIRED`, `DISPUTED`.

All status transitions are enforced by `backend/src/deals/status.engine.ts`. Never perform transitions outside this engine.

### API Response Shape

Every deal endpoint returns:
- `message_key` — i18n key, never hardcoded text
- `missing_fields` — computed by `missing-fields.ts`
- `allowed_actions` — computed per actor/role/status
- `status` — the canonical deal status enum value

The frontend renders actions from `allowed_actions` in the API response; never hardcode permission logic client-side.

### Token Strategy

- **Anonymous participants**: Hashed opaque access tokens (`creator_access_token`, `participant_access_token`). Raw token returned only once at creation/join.
- **Admin**: JWT via `POST /v1/auth/admin/login`.
- **Registered users**: OAuth (Google, Telegram OIDC) + server-side sessions stored in `UserSession` table.
- Tokens are stored as hashes in DB. Never log raw tokens.

### NestJS Module Architecture

```
AppModule
├── PrismaModule (global, shared DB client)
├── AuthModule (OAuth + admin JWT)
├── DealsModule (core business logic, status engine)
├── PaymentsModule (proof upload, Bakong/KHQR integration)
├── ShippingModule (seller shipping proof)
├── DisputesModule
├── AdminModule (admin-only endpoints)
├── LedgerModule (append-only financial records)
├── FilesModule (upload validation, signed URLs)
├── NotificationModule (in-app + Telegram adapter)
├── BotModule (Telegram bot commands, runs in same process)
├── BakongModule (KHQR generation, Bakong API polling)
├── UsersModule
├── TransfersModule
├── HealthModule / SeedModule / AuditModule
```

Global guards/filters/interceptors applied in `AppModule`:
- `HttpThrottlerGuard` — rate limiting (120 req/min)
- `AllExceptionsFilter` — unified error response shape
- `LoggingInterceptor` — request logging

### Telegram Bot

The bot runs **inside the NestJS backend** as a module (`BotModule`). It calls `DealService` directly (same process), not via HTTP. The request/response shape must still match the public API contract. Bot commands: `/start`, `/newdeal`, `/mydeals`, `/help`.

### Frontend Architecture

- **Next.js 16** with App Router, **React 19**, **Tailwind CSS v4**
- **i18n**: `next-intl` pattern with `messages/index.ts`, supports `km`, `en`, `zh`
- **API client**: `lib/api.ts` — all API calls go through `apiGet`/`apiSend` which handle auth query params and `message_key` error extraction
- **Auth**: `middleware.ts` protects `/deals/new` and `/dashboard` routes via `bothsafe_session` cookie
- **Admin routes**: `/admin/*` — server-side session check required
- No hardcoded strings in components — all text uses translation keys

### Prisma Schema Conventions

- Prisma client output: `../node_modules/.prisma/client` (custom output path)
- Key models: `User`, `Deal`, `Participant`, `Product`, `PaymentProof`, `ShippingProof`, `Dispute`, `LedgerEntry`, `AuditLog`, `TelegramIdentity`, `OAuthAccount`, `UserSession`
- Seed script: `prisma/seed.ts`

### Bakong / KHQR Integration

The backend generates dynamic KHQR strings for buyer payment. Configured via `BAKONG_ACCOUNT_ID`, `BAKONG_API_TOKEN`, `BAKONG_MERCHANT_NAME`. The `BakongPollService` polls the Bakong API for transaction verification. Payout to sellers uses deep links generated via `BakongDeeplinkService`.

## Key Files for Understanding the System

- `backend/src/deals/deals.service.ts` — Core deal lifecycle
- `backend/src/deals/status.engine.ts` — Status transition rules
- `backend/src/deals/missing-fields.ts` — Missing field computation
- `backend/src/common/constants.ts` — Status enum, message keys, notification events
- `frontend/lib/api.ts` — Frontend API client
- `frontend/middleware.ts` — Route protection
- `AGENTS.md` — Full module map, API contract, coding rules, and task reference
- `DOCKER.md` — Docker setup and troubleshooting

## Important Constraints

- Lock price, product, and payout info after payment. Admin override only.
- Admin manually verifies payments and releases money. No automatic movement in MVP.
- Every important action is audited via `AuditService`.
- Ledger is append-only. Never delete or silently update entries.
- Notification failure must not roll back a deal status update.
- CORS allows all in dev when `CORS_ORIGINS` is empty; restrict in production.
