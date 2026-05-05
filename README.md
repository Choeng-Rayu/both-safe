# BOTH SAFE

Plan

BothSafe Secure Digital Escrow Architecture Plan
Summary
Build BothSafe as a Telegram-first protected digital commerce platform with both one-time digital escrow and subscription entitlements in V1. Use a modular NestJS monolith, PostgreSQL, Redis queues, private object storage, provider adapters for Binance Pay and Bakong/PayWay, and an admin-controlled release workflow for the first live version.

No implementation should start until you explicitly confirm this plan.

Key Decisions
V1 scope: one-time digital products plus subscription access.
Payment rails: dual provider architecture from day one:
BinancePayProvider for international digital purchases.
PayWayBakongProvider for Cambodia KHQR/Bakong/PayWay.
Custody model: manual release first for seller payout/refund approval. Payment/access automation runs fully, but payout/refund execution requires admin confirmation until legal/provider capability is proven.
Product wording: use “protected checkout” and “secured digital delivery,” not “licensed escrow,” unless legal counsel and payment partners approve escrow language.
Digital product policy: allow ebooks, templates, course files, design assets, software downloads, and seller-owned license keys. Block accounts, credentials, hacked services, gambling, financial signals, adult content, and illegal downloads.
Technology Stack
Backend: NestJS + TypeScript + Fastify, modular monolith.
Database: PostgreSQL with Prisma migrations; money stored as integer minor units, not floats.
Queue/jobs: Redis + BullMQ for webhook retries, reconciliation, scan jobs, renewal reminders, expiry, and auto-release candidates.
Frontend: Next.js + TypeScript for buyer/seller web app, admin console, and embeddable checkout page.
Telegram: grammy bot for deal creation, product links, payment notifications, delivery/access alerts, and buyer confirmation.
Storage: Cloudflare R2 or S3-compatible private bucket with short-lived signed URLs.
Security/ops: Cloudflare WAF, Sentry, Pino logs, OpenTelemetry, encrypted secrets, admin MFA, append-only audit logs.
Low-cost deployment: start with managed Postgres, Upstash Redis, Cloudflare R2, and one small API/worker host; split services only after real usage demands it.
Core Architecture
AuthModule: email/phone/Telegram login, sessions, admin MFA.
UserModule / SellerModule: profiles, verification, payout identifiers, risk tier.
DigitalProductModule: product listing, versions, malware scan status, file hash, license inventory.
SubscriptionModule: plans, subscriptions, renewal invoices, grace periods, cancellation.
EntitlementModule: source of truth for access; exposes canAccess(userId, productId, action).
PaymentModule: provider abstraction, signed webhook ingestion, order query, refund/payout/split capability flags.
EscrowModule: deal state machine, buyer confirmation, dispute freeze, release candidate creation.
LedgerModule: append-only obligation ledger for paid, fee, seller payable, refund liability, reserve, payout sent.
DisputeModule: evidence, buyer/seller messages, admin decision, immutable resolution record.
AdminModule: review queue, release/refund approval, reconciliation dashboard, seller risk review.
EmbedModule: signed checkout links and embeddable “Buy with BothSafe” button that opens the hosted secure checkout.
Main Flows
One-time digital escrow: seller uploads product → scan/hash/approve → buyer pays via Binance or Bakong/PayWay → verified webhook plus provider query confirms payment → entitlement/access grant is created → buyer downloads/reveals key → buyer confirms or timer creates release candidate → admin approves payout/refund/split.
Subscription V1: seller creates plan → buyer pays first period → entitlement is active until current_period_end → renewal invoice is generated before expiry → successful renewal extends entitlement → failed renewal enters grace then expires. Auto-debit stays behind a provider capability flag.
Dispute flow: buyer opens dispute before release → access and payout freeze → evidence collected from download logs, file hashes, reveal logs, screenshots, and messages → admin chooses refund, release, split, or more evidence → ledger records reversal/release entries.
Automation boundary: access delivery, entitlement checks, reconciliation, reminders, expiry, and release eligibility are automated. Actual money release/refund is manual approval in V1.
Public Interfaces
PaymentProvider:
createOrder, queryOrder, verifyWebhook, refundOrder, createPayout, submitSplit, reconcile, getCapabilities.
EntitlementService:
canAccess, grantOneTimeAccess, grantSubscriptionAccess, revokeAccess, recordUsage.
API surface:
/auth/*, /products/*, /plans/*, /subscriptions/*, /deals/*, /payments/*, /webhooks/binance, /webhooks/payway, /disputes/*, /admin/*, /embed/*.
Environment Draft
Create .env.example with placeholders for:

APP_URL=
API_URL=
ADMIN_URL=
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
SESSION_SECRET=
ENCRYPTION_MASTER_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

BINANCE_PAY_BASE_URL=
BINANCE_PAY_API_KEY=
BINANCE_PAY_SECRET_KEY=
BINANCE_PAY_MERCHANT_ID=
BINANCE_PAY_WEBHOOK_URL=

PAYWAY_BASE_URL=
PAYWAY_MERCHANT_ID=
PAYWAY_API_KEY=
PAYWAY_PUBLIC_KEY=
PAYWAY_WEBHOOK_SECRET=

OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY_ID=
OBJECT_STORAGE_SECRET_ACCESS_KEY=

CLAMAV_URL=
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
AUTO_RELEASE_MODE=manual_approval
SUPPORTED_PAYMENT_RAILS=binance,payway_bakong
Test Plan
Webhook signature verification rejects spoofed Binance/PayWay callbacks.
Duplicate webhooks are idempotent and do not double-grant access or double-write ledger entries.
Frontend redirects never unlock access without verified backend payment confirmation.
Digital file upload rejects unsafe file types, failed malware scans, and oversized files.
Signed download URLs expire and enforce download/reveal limits.
Subscription renewal extends entitlement; failed renewal enters grace then expires.
Dispute freezes release and prevents payout approval.
Auto-release creates an admin approval task, not an automatic payout, in V1.
Ledger entries remain append-only and balanced for payment, fee, refund, reserve, and payout scenarios.
Reconciliation detects provider/order mismatch and sends it to admin review.
Assumptions
Binance Pay merchant approval, recurring/direct-debit support, payout, and split features depend on merchant eligibility and country approval.
Bakong/PayWay release/refund behavior must be confirmed with ABA PayWay or another licensed Cambodian payment partner before production.
Direct custody is out of scope for V1.
Official references checked: Binance Pay Create Order, Webhook, Query Order, and Profit Sharing docs; PayWay KHQR, Pre-auth, Payout, and Refund docs; Bakong KHQR documentation.
