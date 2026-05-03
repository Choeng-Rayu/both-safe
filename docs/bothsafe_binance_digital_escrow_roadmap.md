# BothSafe Binance Digital Escrow Roadmap

## Short Answer

Build the international version around **digital product escrow**, not physical delivery. Use Binance Pay for checkout and payment confirmation, but make BothSafe the system that locks the product, verifies payment, grants access, tracks downloads, handles disputes, and releases or refunds funds through a licensed partner.

The best first countries are:

1. **Brazil**: best for scale because Pix is massive and Binance Pay has a Pix integration.
2. **South Africa**: best for a fast English-language pilot because Binance Pay has visible QR merchant adoption through local payment partners.
3. **Argentina**: good second wave because stablecoin usage is strong, but PSAV rules need legal review.
4. **El Salvador**: good crypto-compliance pilot, small market.
5. **UAE/Dubai**: premium regulated market, not cheap MVP.

Avoid Turkey, Thailand, and Indonesia for a first Binance payment launch because regulators restrict crypto as a payment method.

## V1 Product

Focus on one-time digital purchases:

- ebooks
- templates
- courses
- design assets
- software downloads
- seller-owned license keys
- paid community access codes

Avoid:

- social media accounts
- exchange accounts
- hacked credentials
- gambling
- investment signals
- adult content
- illegal downloads

## Payment Flow

1. Seller uploads digital product.
2. BothSafe scans and locks it.
3. Buyer pays with Binance Pay.
4. Binance webhook confirms payment.
5. BothSafe marks deal as `PAID_HELD`.
6. Buyer gets secure download or key reveal.
7. Buyer confirms or auto-release happens after 24-48 hours.
8. If dispute opens, payout freezes.
9. Admin decides refund, release, or split.

## Tracking Subscriptions and Digital Products

Use an internal **entitlement system**.

Payments should not directly control access. Instead:

- Payment event comes in.
- Backend verifies it.
- Backend writes an entitlement.
- App checks entitlement before every download, view, license reveal, or course access.

Core tables:

- `products`
- `product_versions`
- `license_keys`
- `deals`
- `payments`
- `payment_events`
- `access_grants`
- `download_events`
- `subscriptions`
- `entitlements`
- `usage_events`
- `disputes`

## Subscription Model

For subscription products:

- `plans`: monthly, yearly, lifetime, pay-per-download.
- `subscriptions`: current billing state.
- `entitlements`: actual access state.
- `usage_events`: downloads, reveals, seats, API calls.
- `billing_events`: raw payment webhooks.

The app should ask:

```text
Can user X access product Y right now?
```

The answer should come from `entitlements`, not directly from Binance.

## Architecture

Use NestJS modular monolith first:

- `AuthModule`
- `UserModule`
- `SellerModule`
- `DigitalProductModule`
- `StorageModule`
- `PaymentModule`
- `BinancePayProvider`
- `EscrowModule`
- `LedgerModule`
- `AccessGrantModule`
- `SubscriptionModule`
- `DisputeModule`
- `RiskModule`
- `AdminModule`
- `NotificationModule`

## Build Order

1. Seller onboarding and digital product upload.
2. Private storage, file hash, malware scan, admin approval.
3. Binance Pay order creation and signed webhook verification.
4. Access grant and expiring download links.
5. Append-only ledger.
6. Refund and payout workflow through licensed partner.
7. Dispute center.
8. Subscription and entitlement tracking.
9. Seller trust score and reserve rules.
10. Country expansion rules.

## Most Important Rule

Do not hold customer crypto directly at the start. Use Binance Pay plus a licensed local partner or merchant-of-record. BothSafe should own the trust workflow, product lock, entitlement system, evidence trail, and dispute process.

