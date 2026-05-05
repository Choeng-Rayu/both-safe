# BothSafe Setup Guide

This guide explains how to set up, run, and test the current BothSafe backend.

The actual NestJS project is here:

```bash
/home/rayu/both-safe/bothsafe
```

Run almost all commands from inside that folder.

---

## 1. Requirements

Install these first:

- Node.js 20 or newer
- npm 10 or newer
- Docker Desktop or Docker Engine
- curl, optional but useful for testing API endpoints

Check:

```bash
node --version
npm --version
docker --version
```

---

## 2. Enter The Backend Project

```bash
cd /home/rayu/both-safe/bothsafe
```

---

## 3. Install Dependencies

```bash
npm install
```

This installs NestJS, Prisma, Fastify, BullMQ, AWS S3 SDK, grammy, and test tools.

---

## 4. Create Local `.env`

If `.env` does not exist:

```bash
cp .env.example .env
```

For local development, use this minimum setup:

```bash
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
ADMIN_URL=http://localhost:3000/admin
NODE_ENV=development
PORT=3001

DATABASE_URL=postgresql://bothsafe:bothsafe@localhost:5432/bothsafe?schema=public
REDIS_URL=redis://localhost:6379

JWT_SECRET=change_this_to_a_long_random_secret
SESSION_SECRET=change_this_to_a_long_random_secret
ENCRYPTION_MASTER_KEY=change_this_to_32_byte_base64_later

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

BINANCE_PAY_BASE_URL=https://bpay.binanceapi.com
BINANCE_PAY_API_KEY=
BINANCE_PAY_SECRET_KEY=
BINANCE_PAY_MERCHANT_ID=
BINANCE_PAY_WEBHOOK_URL=http://localhost:3001/webhooks/binance
BINANCE_PAY_WEBHOOK_PUBLIC_KEY=
BINANCE_PAY_CERTIFICATE_SN=

PAYWAY_BASE_URL=https://checkout-sandbox.payway.com.kh
PAYWAY_MERCHANT_ID=
PAYWAY_API_KEY=
PAYWAY_PUBLIC_KEY=
PAYWAY_WEBHOOK_SECRET=dev_payway_webhook_secret

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_REGION=auto
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=

CLAMAV_URL=
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
AUTO_RELEASE_MODE=manual_approval
SUPPORTED_PAYMENT_RAILS=binance,payway_bakong
```

Do not commit `.env`. It is ignored by git.

---

## 5. Start Local Database And Redis

```bash
docker compose up -d postgres redis
```

Check status:

```bash
docker compose ps
```

You should see:

- `postgres` healthy on port `5432`
- `redis` healthy on port `6379`

If you need to stop them:

```bash
docker compose down
```

If you want to delete local database data completely:

```bash
docker compose down -v
```

---

## 6. Run Prisma Migration

```bash
npm run prisma:migrate
```

This creates the database tables from:

```text
prisma/schema.prisma
```

If it asks for a migration name, use:

```text
init
```

Generate Prisma client manually if needed:

```bash
npm run prisma:generate
```

Open Prisma Studio:

```bash
npm run prisma:studio
```

Prisma Studio lets you inspect users, sellers, products, deals, payments, entitlements, disputes, admin tasks, and ledger entries.

---

## 7. Run The API

```bash
npm run start:dev
```

The API runs on:

```text
http://localhost:3001
```

You should see NestJS route logs and:

```text
Nest application successfully started
```

If `TELEGRAM_BOT_TOKEN` is empty, you will see:

```text
Telegram bot disabled because TELEGRAM_BOT_TOKEN is not set
```

That is okay for local development.

If `REDIS_URL` is set, you should see:

```text
BullMQ queues ready
```

---

## 8. Test The API With curl

Health check:

```bash
curl http://localhost:3001/
```

Expected:

```json
{"name":"bothsafe-api","status":"ok","custodyModel":"manual_release_first","releaseMode":"manual_approval"}
```

Payment provider capabilities:

```bash
curl http://localhost:3001/payments/capabilities
```

Expected providers:

- `BINANCE`
- `PAYWAY_BAKONG`

Both should show:

```json
"requiresManualRelease": true
```

---

## 9. Run Automated Tests

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint -- --max-warnings=0
```

Unit tests:

```bash
npm test -- --runInBand
```

E2E test:

```bash
npm run test:e2e
```

Security audit for production dependencies:

```bash
npm audit --omit=dev
```

Prisma schema validation:

```bash
DATABASE_URL='postgresql://bothsafe:bothsafe@localhost:5432/bothsafe?schema=public' npx prisma validate --schema prisma/schema.prisma
```

---

## 10. Current Main API Routes

Health:

```text
GET /
```

Auth:

```text
GET  /auth/status
POST /auth/telegram
```

Users and sellers:

```text
GET  /users
GET  /users/:id
GET  /sellers
POST /sellers
```

Digital products:

```text
GET  /products
GET  /products/:id
POST /products
POST /products/:id/versions
POST /products/:id/submit
```

Subscriptions:

```text
GET  /plans
POST /plans
GET  /subscriptions
POST /subscriptions
```

Deals:

```text
GET  /deals
GET  /deals/:id
POST /deals
POST /deals/:id/buyer-confirm
POST /deals/jobs/auto-release-candidates
```

Payments:

```text
GET  /payments
GET  /payments/capabilities
POST /payments/checkout
POST /webhooks/binance
POST /webhooks/payway
```

Entitlements:

```text
GET  /entitlements/access
POST /entitlements/usage
```

Disputes:

```text
GET  /disputes
POST /deals/:dealId/disputes
POST /disputes/:id/messages
```

Admin:

```text
GET  /admin/review-queue
POST /admin/deals/:dealId/decision
```

Storage:

```text
POST /storage/upload-url
GET  /storage/download-url
```

Embed:

```text
GET /embed/:productId
GET /embed/:productId/button.js
```

---

## 11. How To Get Real Provider Keys

### Binance Pay

These are Binance Pay Merchant credentials, not normal trading API keys.

Keep:

```bash
BINANCE_PAY_BASE_URL=https://bpay.binanceapi.com
```

Get these from Binance Pay Merchant after merchant verification:

```bash
BINANCE_PAY_API_KEY=
BINANCE_PAY_SECRET_KEY=
BINANCE_PAY_MERCHANT_ID=
BINANCE_PAY_CERTIFICATE_SN=
```

For local webhook testing, Binance cannot call `localhost`. Use ngrok:

```bash
ngrok http 3001
```

Then set:

```bash
BINANCE_PAY_WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/webhooks/binance
```

Get the Binance webhook public key by querying Binance Pay certificate API:

```text
POST /binancepay/openapi/certificates
```

Put returned public key into:

```bash
BINANCE_PAY_WEBHOOK_PUBLIC_KEY=
```

### PayWay / Bakong

Sandbox:

```bash
PAYWAY_BASE_URL=https://checkout-sandbox.payway.com.kh
```

Register sandbox here:

```text
https://developer.payway.com.kh/
```

PayWay sends sandbox credentials by email:

```bash
PAYWAY_MERCHANT_ID=
PAYWAY_API_KEY=
PAYWAY_PUBLIC_KEY=
```

For production credentials, contact ABA PayWay merchant acquisition.

For local testing, use:

```bash
PAYWAY_WEBHOOK_SECRET=dev_payway_webhook_secret
```

Replace it with the official production webhook/hash secret when PayWay gives it to you.

### Cloudflare R2 Object Storage

Create a Cloudflare R2 bucket for private product files.

Example:

```bash
OBJECT_STORAGE_BUCKET=bothsafe-products-dev
OBJECT_STORAGE_REGION=auto
```

Endpoint format:

```bash
OBJECT_STORAGE_ENDPOINT=https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
```

Create an R2 token with Object Read & Write permission, scoped to your bucket:

```bash
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=
```

The Secret Access Key is shown only once. Save it safely.

### Telegram Bot

Talk to BotFather in Telegram:

```text
@BotFather
```

Create a bot, then copy the token:

```bash
TELEGRAM_BOT_TOKEN=
```

For now, the bot runs in polling mode when the token is set.

### Sentry

Create a Sentry Node.js/NestJS project:

```bash
SENTRY_DSN=
```

Current code has the placeholder; full Sentry initialization can be added later.

### OpenTelemetry

For local or hosted tracing:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=
```

Example local endpoint:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

Current code has the placeholder; full tracing export can be added later.

### ClamAV

For malware scanning:

```bash
CLAMAV_URL=
```

This is not fully wired yet. Current product upload implementation stores scan metadata and validates file metadata. Full ClamAV scanning is a next implementation step.

---

## 12. Development Flow

Use this flow each time you work locally:

```bash
cd /home/rayu/both-safe/bothsafe
docker compose up -d postgres redis
npm install
npm run prisma:migrate
npm run start:dev
```

In another terminal:

```bash
curl http://localhost:3001/
npm test -- --runInBand
```

---

## 13. Troubleshooting

### Port already in use

If port `3001` is busy:

```bash
lsof -i :3001
```

Stop the old process or change `PORT` in `.env`.

### Database connection failed

Check Docker:

```bash
docker compose ps
```

Restart:

```bash
docker compose restart postgres
```

Confirm `.env` has:

```bash
DATABASE_URL=postgresql://bothsafe:bothsafe@localhost:5432/bothsafe?schema=public
```

### Prisma migration failed first time

Postgres may not have been healthy yet. Run again:

```bash
npm run prisma:migrate
```

### Redis queues disabled

Set:

```bash
REDIS_URL=redis://localhost:6379
```

Then restart:

```bash
npm run start:dev
```

### Binance webhook cannot reach local machine

Use ngrok:

```bash
ngrok http 3001
```

Then set:

```bash
BINANCE_PAY_WEBHOOK_URL=https://your-ngrok-url/webhooks/binance
```

---

## 14. Production Safety Reminder

For V1:

- Do not directly hold customer funds.
- Keep `AUTO_RELEASE_MODE=manual_approval`.
- Let payment providers confirm payment.
- Let BothSafe create access grants and admin release review tasks.
- Only approve payout/refund after admin review.
- Never unlock digital products from a frontend redirect alone.
