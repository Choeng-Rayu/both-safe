# BothSafe Architecture

BothSafe is implemented as an npm workspace with a NestJS API and a Next.js web app.

## System Shape

```mermaid
flowchart LR
  Buyer[Buyer / Telegram / Embed] --> Web[Next.js App]
  Seller[Seller / Telegram] --> Web
  Admin[Admin Console] --> Web
  Web --> API[NestJS Fastify API]
  Telegram[grammy Bot] --> API
  API --> DB[(PostgreSQL)]
  API --> Redis[(Redis / BullMQ)]
  API --> Storage[(Private S3/R2)]
  API --> Binance[Binance Pay]
  API --> PayWay[PayWay / Bakong]
```

## Safety Boundary

BothSafe stores commercial state, entitlements, evidence, and ledger obligations. It does not treat database balances as money. Provider-confirmed payment records are the source of truth for paid/refunded/payout states, and V1 creates admin approval tasks before money release.

## Implementation Highlights

- Payment providers implement one interface with capability flags.
- Webhooks are verified, stored, and processed idempotently.
- Entitlements are the source of truth for downloads, license reveals, and subscription access.
- Ledger entries are append-only; corrections are reversal entries.
- Auto-release creates manual admin review tasks in V1.
