# Research Report: BothSafe International Binance Pay Digital Escrow

## Executive Summary

- **Best first markets:** Brazil and South Africa are the strongest first targets. Brazil has official VASP rules taking effect on February 2, 2026, and Pix reached more than 170 million individual users and more than 7 billion transactions in January 2026 [9], [10]. South Africa requires CASP licensing and has visible Binance Pay QR-payment momentum through local partners [15], [17], [18].
- **Best second wave:** Argentina is attractive for stablecoin-heavy digital commerce, but CNV PSAV rules require local legal review before BothSafe touches transfer, custody, or administration of virtual assets [12], [13], [14].
- **Strategic markets:** El Salvador is useful for a crypto-native compliance pilot because CNAD lists Binance Services El Salvador in its public registry [19]. UAE/Dubai is a high-compliance premium market because VARA lists Binance FZE as an active VASP licensee [21].
- **Avoid first:** Turkey, Thailand, and Indonesia should not be first choices because official or regulator-backed materials restrict or prohibit crypto assets as a means of payment for goods and services [23], [24], [25].

**Primary Recommendation:** Build BothSafe International first as a digital product escrow and entitlement platform in Brazil or South Africa, using Binance Pay as a payment rail while partnering with a licensed local VASP/payment entity for custody, seller payout, AML/KYC, and refunds.

**Confidence Level:** Medium-high. The payment API capabilities and major market/regulatory signals are well sourced, but Binance Pay country and merchant approval is still merchant-specific and must be confirmed during Binance Merchant onboarding.

---

## Introduction

### Research Question

The research question is: which countries outside Cambodia are suitable for BothSafe to build Binance-powered payments, with the product focused on escrow payment and digital product management.

This matters because crypto payments create a very different risk profile from Cambodia's Bakong/KHQR plan. Binance Pay can confirm payments, create checkout links, send webhooks, process refunds, support payouts, and support whitelisted direct debit flows, but Binance Pay is not a complete legal escrow provider by itself [1], [2], [3], [4], [5], [6].

### Scope and Methodology

This report covers country prioritization, Binance Pay capability, escrow architecture, digital product custody, subscription and entitlement tracking, and an implementation plan. The scope excludes legal advice, tax advice, token issuance, securities offerings, gambling, adult content, hacked accounts, and gray-market digital services. Those categories would materially increase regulatory, fraud, and platform-risk exposure.

Sources were selected from official payment/API documentation, official regulators, central banks, government registries, and established market data sources. Binance developer documentation was used for API primitives. Government and regulator sources were used for country decisions. Chainalysis was used for market adoption context, and OWASP/AWS/Stripe/RevenueCat were used for implementation patterns around secure uploads, expiring access links, and entitlement tracking.

### Key Assumptions

- BothSafe should not directly hold customer funds at launch unless it has the required local license, because holding, transferring, or controlling virtual assets can trigger VASP/payment licensing in many countries [9], [12], [13], [15].
- Binance Pay merchant approval, available features, and country access can vary by jurisdiction, merchant category, and compliance status, because Binance states Binance Pay is available only to eligible users in supported countries after identity verification [8].
- The first product should focus on legitimate digital files and keys: ebooks, templates, course files, private community access, SaaS downloads, design assets, and seller-owned software licenses.
- The first version should avoid resold social accounts, gaming accounts, SIM services, exchange accounts, hacked credentials, financial advice products, and unlicensed investment signals.

---

## Main Analysis

### Finding 1: Binance Pay Can Power Checkout, Status, Refunds, Payouts, and Splits, But BothSafe Must Build the Escrow Layer

Binance Pay's merchant documentation describes Binance Pay as a cryptocurrency payment technology for QR-code merchant acquiring and crypto transfers, and the C2B flow lets users scan a merchant QR code, confirm payment in Binance, and receive payment-status notifications [1]. For BothSafe, this means Binance Pay is suitable as a payment acceptance layer for digital product deals, especially where buyers already hold USDT, USDC, BNB, BTC, or other Binance-supported assets [8].

The Create Order V2 API supports a merchant order ID, checkout URL, deeplink, QR code, webhook URL, buyer metadata, and goods metadata [2]. Importantly for BothSafe's digital product model, the API includes `goodsType`, where `02` is "Virtual Goods" [2]. This makes the payment object naturally map to a BothSafe digital deal: `merchantTradeNo` becomes `dealId`, `referenceGoodsId` becomes `digitalProductId`, `passThroughInfo` can carry a signed internal reference, and `webhookUrl` becomes the bridge into BothSafe's state machine [2].

The Query Order API returns order status values including `INITIAL`, `PENDING`, `PAID`, `CANCELED`, `ERROR`, `REFUNDING`, `REFUNDED`, and `EXPIRED` [3]. BothSafe should never unlock a digital product based only on a frontend redirect, because the redirect can be spoofed or abandoned. The backend should unlock content only after a verified Binance webhook and a fallback Query Order reconciliation both show a paid state [3], [4].

Binance Pay's webhook rules require HTTPS, JSON payloads, RSA signature verification, certificate retrieval, and transaction-status judgment [4]. Its order notification endpoint sends final order status such as `PAY_SUCCESS` and retries failed webhook delivery up to six times [4]. For BothSafe, this supports a reliable payment-confirmation pipeline, but it also creates the need for idempotent webhook ingestion, raw event storage, replay protection, and periodic reconciliation.

Binance Pay supports refunds for successful payments, including partial refunds whose cumulative total cannot exceed the order amount [5]. It also supports batch payout to Binance IDs or email addresses for whitelisted/non-Binance-user flows, with transfer details and maximum batch size constraints [6]. Profit sharing can split a paid order to receiver accounts, but it requires the order to be created with the profit-sharing tag and receivers to be registered first [7]. These are useful escrow-adjacent primitives, but they do not remove the need for a legal custody model.

**Implication for BothSafe:** Treat Binance Pay as a payment processor and settlement toolkit, not as the escrow product. BothSafe's moat is the escrow state machine, seller verification, content-locking, evidence tracking, dispute rules, risk scoring, and entitlement ledger wrapped around Binance Pay.

### Finding 2: Brazil Is the Best First Market If BothSafe Wants Scale, Stablecoin Demand, and a Familiar Instant-Payment Bridge

Brazil is the strongest scale candidate. Banco Central do Brasil reported that Pix had more than 170 million individual users, more than 7 billion transactions in January 2026, and more than R$3 trillion in October 2025 volume [10]. That matters because Binance Pay's Brazil Pix integration gives users a familiar payment pattern while using crypto balances behind the scenes [11].

Brazil also has one of the clearest current virtual asset frameworks in Latin America. BCB reported that Resolutions BCB 519, 520, and 521 regulate authorization and provision of virtual asset services, create VASPs, and establish rules for virtual-asset activities treated as foreign exchange and international capital operations [9]. Resolution BCB 520 governs which institutions may provide virtual asset services and extends requirements on client protection, transparency, AML/CFT, governance, security, internal controls, and information disclosure [9].

The regulatory clarity is not a free pass. BCB states VASPs will operate by classification, including intermediary, custodian, and virtual asset broker categories [9]. If BothSafe touches custody, controls release, or facilitates transfers, it should assume a licensed partner or local authorization is required. The safest entry model is to integrate Binance Pay through a merchant account or licensed partner, keep buyer funds with the regulated entity, and let BothSafe control only content access, release instructions, and dispute metadata.

Brazil's market signal is also strong. Chainalysis reported that Brazil accounted for $318.8 billion in crypto value received from July 2022 to June 2025, roughly one-third of all Latin America crypto activity [14]. Chainalysis also stated that stablecoin purchases made up more than half of exchange purchases for Brazilian real, Argentine peso, and Colombian peso pairs between July 2024 and June 2025 [14]. This supports a USDT/USDC-denominated digital product marketplace where sellers can price globally while buyers pay locally through Binance Pay.

**Recommendation for Brazil:** Use Brazil as the first serious international market if the goal is scale. Launch with low-risk digital goods, Portuguese localization, Pix/Binance Pay checkout, seller KYB, tax invoice research, and a licensed VASP/payment partner before touching escrow custody.

### Finding 3: South Africa Is the Best First Market If BothSafe Wants Easier English Launch and Visible Binance Pay Merchant Momentum

South Africa is a strong first-market candidate because it combines English usability, growing crypto acceptance, and a clearer licensing path. The FSCA states that people and entities must obtain authorization before providing financial services and that crypto asset service providers must obtain a license to conduct business [15]. The South African government's official notice page links the declaration of crypto assets as financial products under the Financial Advisory and Intermediary Services Act [16].

South Africa also has visible Binance Pay payment adoption. Zapper reported that its partnership with MoneyBadger, Luno Pay, Binance Pay, and AltCoin Pay lets crypto holders spend through Zapper-supported merchants, and it states customers can pay at more than 31,000 merchants across South Africa [17]. IT-Online reported in February 2026 that Binance Pay partnered with Scan To Pay, whose network has more than 650,000 merchants able to accept cryptocurrency payments through Binance Pay via MoneyBadger integration [18].

These sources are more about merchant acceptance than digital escrow, but they matter for trust. A buyer who has already seen Binance Pay in everyday checkout is more likely to understand a digital escrow payment link. The South African model also has a practical settlement pattern: the customer pays from a crypto wallet, while merchants can receive rand settlement through local partners [17]. That reduces seller volatility anxiety, which is one of the biggest objections to crypto commerce.

The main compliance risk is that BothSafe's escrow layer may look like custody, transfer, settlement, or financial intermediation if it controls the release of value. That means BothSafe should not present itself as a South African crypto custodian without local authorization. The safer architecture is to use a licensed CASP/payment partner and make BothSafe the transaction workflow, entitlement, and dispute system.

**Recommendation for South Africa:** Use South Africa as the fastest English-language Binance Pay pilot. Start with creators, templates, ebooks, software downloads, and course assets. Keep the escrow balance with a licensed provider, use BothSafe for content locking and seller payout rules, and design buyer support around QR-code familiarity.

### Finding 4: Argentina Is a Good Second-Wave Market for Stablecoin-Native Buyers, But Local PSAV Rules Need Care

Argentina is attractive because stablecoins are already part of user behavior in Latin America. Chainalysis reported that Argentina ranked second in Latin America with $93.9 billion in transaction volume from July 2022 to June 2025 [14]. Chainalysis also reported that stablecoin purchases made up more than half of exchange purchases for Argentine peso, Colombian peso, and Brazilian real pairs between July 2024 and June 2025 [14].

Argentina has a real regulatory perimeter for virtual asset service providers. The CNV states that it created the Registro de Proveedores de Servicios de Activos Virtuales through RG 994 and that providers not registered cannot operate in the country [12]. The official PSAV registry page states that from May 26, 2025, applications for registration and cancellation under RG 1058 must be submitted through the TAD platform [12].

Resolution General 1058/2025 is directly relevant to BothSafe because it lists PSAV categories including exchange between virtual assets and fiat, exchange between virtual assets, transfer of virtual assets, custody or administration of virtual assets or instruments that control them, and financial services related to offering or selling a virtual asset [13]. A digital product escrow that holds USDT, controls release, or administers a Binance payout workflow may touch category 3 or 4 activities [13].

Argentina is therefore a good market, but not the easiest first launch. The best strategy is a light entry: allow Argentine buyers to buy from international sellers using Binance Pay only where Binance supports the user and merchant flow, avoid local custody, and test Spanish-language digital goods. A deeper Argentina launch should follow a local legal opinion and PSAV partner onboarding.

**Recommendation for Argentina:** Make Argentina the second-wave Latin America expansion after Brazil. Start buyer-side, not custody-side. Use stablecoin pricing, Spanish localization, and strict category rules for digital products.

### Finding 5: El Salvador and UAE Are Strategic, But They Solve Different Problems

El Salvador is useful for a crypto-native compliance pilot because CNAD maintains a public registry of digital asset service providers, and that registry lists Binance Services El Salvador [19]. This suggests a regulatory environment where digital asset service-provider licensing is legible and public. El Salvador can be useful for company learning, regulated partner discovery, and crypto-native seller onboarding.

El Salvador is not the best scale market. The IMF's February 2025 program announcement states that reforms made Bitcoin acceptance voluntary and ensured tax payments are made only in U.S. dollars [20]. This is still compatible with crypto payments, but it means the old "Bitcoin legal tender" narrative should not be treated as the current launch thesis. The launch thesis should be regulated digital asset services, not mandatory merchant Bitcoin acceptance.

UAE/Dubai is the opposite: high-income, sophisticated, and compliance-heavy. VARA's public register lists Binance FZE as an active VASP licensee with broker-dealer, management and investment, lending and borrowing, and exchange services [21]. VARA also issued a market alert explaining that virtual asset activities and VASPs remain under SCA or VARA frameworks, except where activities fall within payment services, stored-value services, retail payments, or digital money services [22].

For BothSafe, UAE is not the cheap MVP. It is a premium regulated market where the product can eventually serve high-value digital assets, B2B templates, enterprise datasets, online education, and token-gated commercial licenses. The compliance cost is likely higher, but credibility is higher too.

**Recommendation for strategic markets:** Use El Salvador for a crypto-compliance pilot only if a licensed partner is available. Use UAE later for premium B2B digital escrow after proving product-market fit in Brazil or South Africa.

### Finding 6: Turkey, Thailand, and Indonesia Should Not Be First Launch Markets for a Crypto-Payment Escrow Product

Turkey should be excluded from the first wave. The Central Bank of the Republic of Turkey regulation on the disuse of crypto assets in payments prohibits the direct or indirect use of crypto assets in payments and prohibits payment service providers from developing models that use crypto assets in payment services [23]. A Binance-powered escrow checkout for digital goods would be hard to reconcile with that payment restriction.

Thailand should also be excluded from the first wave. The Thai SEC announced regulations prohibiting digital asset business operators from facilitating the use of digital assets as a means of payment for goods and services, effective April 1, 2022, after coordination with the Bank of Thailand [24]. The Bank of Thailand has also stated that digital assets are not legal tender and that widespread use as payment may create risks to consumers and financial stability [24].

Indonesia should be excluded from the first wave. Bank Indonesia has repeatedly stated through official and state news channels that cryptocurrency is not a lawful payment instrument and that rupiah is the only legal payment instrument for Indonesian payments [25]. Crypto asset trading may exist as an investment activity, but a merchant escrow checkout is a payment use case.

These countries may still have large crypto adoption, and Chainalysis ranked Indonesia, Thailand, and Turkey in its 2025 top 20 global adoption index [14]. Adoption does not equal payment legality. For BothSafe, the correct filter is not only "many people use crypto"; it is "can BothSafe legally use crypto to collect payment for digital goods and release/refund funds."

**Recommendation for excluded markets:** Do not launch payment-based digital escrow in Turkey, Thailand, or Indonesia until a local legal opinion confirms a compliant model, such as fiat-only payment with crypto only for off-platform seller settlement.

---

## Synthesis & Insights

The expansion pattern is clear: BothSafe should select countries by the legality of crypto payment workflows, not only by crypto adoption. Chainalysis ranked several payment-restricted countries in the 2025 global adoption top 20, including Indonesia, Turkey, and Thailand [14]. Those countries may have many crypto users, but a Binance Pay checkout for digital goods creates a payment use case, and regulator-backed materials in those markets create avoidable launch risk [23], [24], [25].

The best opportunity is not "Binance escrow." The best opportunity is "Binance-powered protected digital commerce." Binance Pay provides checkout URLs, order statuses, webhooks, refunds, payouts, profit-share/split tools, and direct debit fields for whitelisted recurring payment flows [2], [3], [4], [5], [6], [7]. BothSafe must supply the missing trust layer: seller screening, digital product locking, access grants, dispute evidence, buyer confirmation, auto-release timing, and an append-only ledger.

Brazil and South Africa solve different go-to-market problems. Brazil has the larger payment infrastructure and crypto-market upside, especially because Pix is deeply embedded in daily payments and Binance Pay has publicly announced Pix integration [10], [11]. South Africa is likely easier operationally for an English-language pilot and has visible Binance Pay merchant acceptance through Zapper, Scan To Pay, and MoneyBadger [17], [18]. This suggests a two-track launch plan: validate product workflow quickly in South Africa, then pursue scale in Brazil after legal and partner setup.

The product should be designed as an entitlement platform from day one. This is the bridge between one-time digital product purchases and subscriptions. External payment events should update internal entitlements, and internal entitlements should control downloads, license reveals, course access, and subscription features [28], [29], [30]. That pattern prevents the payment provider from becoming the application permission system and gives BothSafe an auditable record for disputes.

The most defensible startup wedge is narrow. BothSafe should not begin with every kind of digital product. The safest initial categories are ebooks, templates, course files, design assets, software downloads, and seller-owned license keys. These products can be scanned, hashed, versioned, delivered through signed URLs, and evaluated quickly. Riskier categories such as accounts, credentials, investment signals, or gray-market services would create fraud and compliance load before the escrow system has trust.

---

## Product Architecture: Binance-Powered Digital Escrow

### Core Principle

BothSafe should build "escrow logic" even when funds are held by Binance, a partner VASP, or a merchant-of-record. The user experience can say "protected payment" or "secured checkout"; the legal wording should avoid "licensed escrow" unless a licensed escrow/custody arrangement is actually in place.

### Recommended V1 Flow

1. Seller creates a digital product listing with title, category, description, price, refund rules, file/license type, support period, and allowed countries.
2. Seller uploads the file, link, or license keys into private storage.
3. The platform scans the upload, computes a hash, classifies file type, stores metadata, and keeps the asset locked.
4. Buyer opens a deal page and pays through a Binance Pay order created with `goodsType = 02`.
5. Binance sends a signed webhook with `PAY_SUCCESS`.
6. BothSafe verifies signature, stores raw webhook data, queries order status, and marks the payment `PAID_HELD`.
7. BothSafe grants access using a short-lived download token or reveal token.
8. Buyer either confirms satisfaction or the deal auto-releases after a window such as 24 or 48 hours.
9. If the buyer disputes, BothSafe freezes seller payout in the internal ledger and uses refund/payout/split workflows based on the licensed partner's allowed process.
10. If no dispute remains, the seller receives payout, profit split, or settlement according to the country model.

### State Machines

**Deal states:** `DRAFT`, `AWAITING_PAYMENT`, `PAID_HELD`, `ACCESS_GRANTED`, `BUYER_CONFIRMED`, `AUTO_RELEASE_READY`, `COMPLETED`, `DISPUTED`, `REFUNDED`, `CANCELED`.

**Payment states:** `ORDER_CREATED`, `PENDING`, `PAID`, `REFUND_REQUESTED`, `REFUNDING`, `REFUNDED`, `PAYOUT_PENDING`, `PAYOUT_SENT`, `RECONCILIATION_FAILED`.

**Digital product states:** `DRAFT`, `SUBMITTED`, `SCANNING`, `REJECTED`, `APPROVED`, `LISTED`, `SOLD_LOCKED`, `ARCHIVED`.

**Access grant states:** `LOCKED`, `GRANTED`, `VIEWED`, `DOWNLOADED`, `EXPIRED`, `REVOKED`, `REFUNDED_REVOKED`.

**Dispute states:** `OPENED`, `EVIDENCE_REQUESTED`, `SELLER_RESPONDED`, `ADMIN_REVIEW`, `BUYER_REFUND`, `SELLER_RELEASE`, `SPLIT_DECISION`, `CLOSED`.

### Backend Modules

Use a NestJS modular monolith first:

- `AuthModule`: login, 2FA, email/phone, Telegram login later.
- `UserModule`: buyer/seller profiles, KYC/KYB status, trust score.
- `SellerModule`: seller onboarding, risk tier, payout identifiers, country.
- `DigitalProductModule`: listing, product versions, file metadata, license inventory.
- `StorageModule`: private object storage, upload sessions, virus scan, hash, signed URL.
- `PaymentModule`: provider abstraction, Binance Pay adapter, order creation, query, refund, payout.
- `EscrowModule`: state machine, hold/release rules, auto-release jobs.
- `LedgerModule`: append-only accounting entries, balances, fees, reserves, payout obligations.
- `AccessGrantModule`: entitlements, download tokens, reveal logs, expiry windows.
- `SubscriptionModule`: recurring access plans, renewal state, grace periods, cancellation.
- `DisputeModule`: evidence, admin decisions, buyer/seller messages.
- `RiskModule`: velocity checks, banned product detection, country restrictions, seller reserve rules.
- `AdminModule`: dispute queue, payment reconciliation, seller review, manual override.
- `NotificationModule`: email, Telegram, in-app, webhook audit.

### Data Model

Core tables:

- `users(id, email, phone, telegram_id, country, kyc_status, role, trust_score)`
- `sellers(id, user_id, business_name, country, verification_status, payout_provider, risk_tier)`
- `digital_products(id, seller_id, title, type, status, price_amount, price_currency, category, refund_policy)`
- `digital_product_versions(id, product_id, storage_key, sha256, file_size, mime_type, scan_status)`
- `license_keys(id, product_id, encrypted_secret, status, assigned_deal_id, revealed_at)`
- `deals(id, buyer_id, seller_id, product_id, status, release_at, dispute_deadline_at)`
- `payments(id, deal_id, provider, provider_order_id, merchant_trade_no, status, amount, currency)`
- `payment_events(id, payment_id, provider, event_type, raw_payload, signature_valid, received_at)`
- `ledger_entries(id, deal_id, account_id, entry_type, debit, credit, asset, provider_ref, created_at)`
- `access_grants(id, deal_id, buyer_id, product_id, status, expires_at, download_limit)`
- `download_events(id, access_grant_id, ip_hash, device_hash, user_agent_hash, downloaded_at)`
- `subscriptions(id, buyer_id, seller_id, product_id, plan_id, status, current_period_end, provider_contract_id)`
- `entitlements(id, user_id, product_id, source, status, starts_at, ends_at, usage_limit, usage_count)`
- `disputes(id, deal_id, opened_by, reason, status, admin_decision, decision_at)`

### Secure Digital Product Management

Digital product upload is a security problem, not just a storage problem. OWASP recommends allow-listed extensions, validating file type instead of trusting the `Content-Type` header, generating server-side filenames, setting file size limits, allowing only authorized uploads, storing files outside the webroot or on a different host, and scanning files with antivirus or sandbox tools where possible [26].

For download delivery, use short-lived signed URLs rather than public object URLs. AWS states that S3 presigned URLs can grant temporary object access without exposing credentials and can expire as high as seven days when created by CLI or SDKs [27]. For BothSafe, the default should be much shorter: 5 to 30 minutes per click, regenerated after checking entitlement state.

For license keys, store encrypted secrets and reveal only once. Store the reveal timestamp, user ID, deal ID, IP hash, device hash, and admin-readable audit event. This does not prove the key works, but it gives dispute evidence and prevents sellers from claiming a key was never delivered.

For links, avoid storing unverified external URLs as the product itself. A safer pattern is seller-owned content uploaded to BothSafe storage. If external links are needed, gate them behind access grants, periodically check availability, and require seller evidence that the buyer received the promised thing.

---

## Subscription and Entitlement Tracking

For subscriptions, BothSafe should not treat "payment happened" as the source of truth. The source of truth should be an internal `entitlements` table that says exactly what a user can access, when it expires, and how much usage remains.

Stripe's subscription docs recommend storing an access expiration timestamp internally and updating access through payment webhooks when invoices are paid or subscription states change [28]. Stripe's Entitlements product also sends `entitlements.active_entitlement_summary.updated` when active entitlements change and recommends persisting entitlements internally for faster resolution [29]. Even if BothSafe uses Binance rather than Stripe, the design principle is the same: external payment provider events should update internal entitlement records.

RevenueCat describes webhooks as a way to sync subscription status across systems and maintain an up-to-date backend record of subscriptions and purchases [30]. That pattern is useful if BothSafe later sells mobile app subscriptions through Apple/Google while still supporting Binance Pay on the web.

### Short Subscription Architecture

- `plans`: what the seller sells, such as monthly access, yearly access, lifetime access, or pay-per-download.
- `subscriptions`: buyer's recurring contract, provider ID, current period, renewal status, grace period, and cancellation status.
- `entitlements`: normalized access record used by the app, independent from payment provider.
- `usage_events`: downloads, views, API calls, license reveals, seats, or course unlocks.
- `billing_events`: raw Binance/Stripe/RevenueCat/webhook events.
- `access_checks`: fast read model cached in Redis for "can this user download this product now?"

### Best Tracking Method

Use event sourcing for billing and access changes. Every payment, refund, renewal, cancelation, download, reveal, dispute, and admin override becomes an append-only event. The current subscription or access status is a projection from those events. This gives BothSafe an audit trail for disputes and makes it easier to rebuild access state after a webhook bug.

---

## Implementation Roadmap

### Phase 0: Legal and Partner Precheck

Choose one first country. Brazil is best for scale; South Africa is best for a faster English-language pilot. Before writing production payment code, get written answers from Binance Merchant or a Binance Pay channel partner on merchant eligibility, digital-goods acceptance, payout options, refund support, direct debit availability, and whether profit sharing or seller payout can be enabled for your entity.

At the same time, get a short legal memo for the target country. The memo should answer whether BothSafe is providing custody, money transmission, VASP services, payment services, escrow, marketplace services, or only digital content access management. This answer determines whether you can launch as a software platform or need a licensed partner.

### Phase 1: Digital Goods MVP

Build the digital product module first. Sellers can upload files, create products, set price, and submit for approval. The admin can approve, reject, or request changes. Buyers can view product pages but cannot access files until payment is verified.

Use private object storage, malware scanning, SHA-256 hashes, generated filenames, and product versioning. Create access grants only from backend payment confirmation, not from frontend callback URLs.

### Phase 2: Binance Pay Checkout

Implement `PaymentProvider` as an interface, then create `BinancePayProvider`. Required methods are `createOrder`, `verifyWebhook`, `queryOrder`, `refundOrder`, `payout`, `split`, and `reconcile`.

Store every webhook raw. Verify RSA signatures. Use idempotency keys for order creation, refunds, payouts, and split submissions. Add a reconciliation job that queries Binance Pay for orders that are still pending or whose webhook was missed.

### Phase 3: Escrow Rules and Ledger

Create an append-only ledger before adding seller payout. At minimum, each paid deal needs entries for buyer payment, platform fee, seller payable, reserve hold, refund liability, and payout sent. Never calculate money owed only from current deal status.

For the first release rule, use buyer confirmation or auto-release after 24 to 48 hours. Digital products need a shorter release window than physical goods, but not instant seller payout, because malware, wrong files, invalid keys, and fake courses are real digital product risks.

### Phase 4: Disputes and Evidence

Disputes should capture reason, screenshots, chat messages, file metadata, download logs, reveal logs, product hash, seller response, and admin notes. Admin decisions should write immutable ledger and entitlement events.

Simple decisions are full refund, seller release, or split. For high-risk sellers, require a reserve until their trust score improves.

### Phase 5: Subscriptions

Add subscriptions only after one-time digital purchases work. If Binance Pay direct debit is available to your merchant account, test whitelisted direct debit for recurring payments. If not, use manual renewal links first or add Stripe/RevenueCat for card/app-store subscriptions while keeping Binance Pay for one-time purchases.

Subscription access should always resolve through internal entitlements, not directly through Binance status. The app asks `AccessGrantService.canAccess(userId, productId)`, and that service reads active entitlements, usage limits, disputes, and account status.

---

## Country Decision Matrix

| Country | Market attractiveness | Regulatory clarity | Binance Pay fit | Launch priority | Recommended entry |
|---|---:|---:|---:|---:|---|
| Brazil | Very high | High but regulated | High with Pix integration | 1 | Licensed partner, digital goods, stablecoin checkout |
| South Africa | High | Medium-high | High with Zapper/Scan To Pay momentum | 1 | English pilot, licensed CASP/payment partner |
| Argentina | High | Medium | Medium-high | 2 | Buyer-side launch first, PSAV partner later |
| El Salvador | Medium-low scale | High crypto-service clarity | Medium | 3 | Crypto-native compliance pilot |
| UAE/Dubai | High value | High but expensive | Medium, compliance-sensitive | 3 | Premium regulated B2B launch |
| Turkey | High adoption but payment-restricted | High restriction | Low | Avoid first | Do not launch crypto payment escrow |
| Thailand | High adoption but payment-restricted | High restriction | Low | Avoid first | Do not launch crypto payment escrow |
| Indonesia | High adoption but payment-restricted | High restriction | Low | Avoid first | Do not launch crypto payment escrow |

---

## Limitations and Caveats

The biggest uncertainty is Binance Pay merchant approval. Public API docs show the features, but they do not guarantee that every merchant, country, category, or feature is approved for a new startup. Direct debit, payer identity details, non-Binance user payouts, and some compliance fields are whitelisted or merchant-contract-dependent in Binance documentation [2], [4], [6].

The second uncertainty is legal classification. A product that "holds funds until both sides are satisfied" may be legally different from a product that "locks digital content while a licensed partner holds funds." BothSafe should use the second model first. The user experience can still deliver buyer protection, but the money movement should sit with a licensed provider.

The third uncertainty is digital product fraud. Digital escrow is harder than physical escrow in one way: after the buyer downloads a file or reveals a key, the product can be copied. Refund rules must account for this. The first product categories should therefore prefer files that can be evaluated quickly and sellers with clear identity.

---

## Recommendations

1. **Pick Brazil or South Africa for the first Binance Pay pilot.** Brazil gives scale and Pix familiarity; South Africa gives English operations and visible Binance Pay QR acceptance.
2. **Do not hold crypto directly in V1.** Use Binance Pay and a licensed local partner or merchant-of-record for money movement while BothSafe controls product access and disputes.
3. **Start with one-time digital goods, not subscriptions.** One-time digital purchases are simpler to dispute, simpler to refund, and easier to reconcile.
4. **Use entitlements as the source of truth.** Payments create or renew entitlements; entitlements control access; download and reveal logs provide dispute evidence.
5. **Create a strict digital goods policy.** Allow ebooks, files, templates, courses, design assets, and seller-owned license keys. Block accounts, credentials, hacked services, financial signals, adult content, gambling, and illegal downloads.
6. **Build reconciliation before launch.** Every paid order, refund, payout, split, and access grant must be reconcilable from raw provider events.

---

## Appendix: Methodology

### Research Process

This report used standard-mode deep research. The scope was narrowed to Binance Pay as a payment rail, international country selection, digital-product escrow architecture, and subscription/access tracking. Research prioritized official Binance documentation, government/regulatory sources, central banks, and current market adoption research.

The country matrix was built by comparing market demand, Binance Pay payment fit, crypto-payment legality, regulatory clarity, launch complexity, and product risk. Countries with high crypto adoption but explicit payment restrictions were excluded from the first-wave launch list.

### Claims-Evidence Table

| Claim ID | Major Claim | Supporting Sources | Confidence |
|---|---|---|---|
| C1 | Binance Pay supports checkout, order query, webhooks, refunds, payouts, and split primitives, but not full escrow by itself. | [1], [2], [3], [4], [5], [6], [7] | High |
| C2 | Brazil is the best scale market for Binance-powered digital escrow. | [9], [10], [11], [14] | High |
| C3 | South Africa is the best English-language pilot market. | [15], [16], [17], [18] | Medium-high |
| C4 | Argentina is attractive but requires careful PSAV review. | [12], [13], [14] | High |
| C5 | El Salvador and UAE are strategic but not the simplest low-cost MVP markets. | [19], [20], [21], [22] | Medium-high |
| C6 | Turkey, Thailand, and Indonesia should not be first-wave crypto-payment escrow markets. | [23], [24], [25] | High |
| C7 | Secure digital goods need private storage, malware scanning, file validation, expiring download links, and entitlement-based access. | [26], [27], [28], [29], [30] | High |

### Report Metadata

**Research Mode:** Standard  
**Total Sources:** 30 bibliography entries across official documentation, regulators, market data, and implementation references  
**Generated:** 2026-05-03 Asia/Phnom_Penh  
**Validation Status:** Revised for automated validation

---

## Bibliography

[1] Binance Developers (2026). "Merchant API References: What is Binance Pay." https://developers.binance.com/docs/binance-pay/introduction (Retrieved: 2026-05-03)

[2] Binance Developers (2026). "Create Order V2." https://developers.binance.com/docs/binance-pay/api-order-create-v2 (Retrieved: 2026-05-03)

[3] Binance Developers (2026). "Query Order." https://developers.binance.com/docs/binance-pay/api-order-query (Retrieved: 2026-05-03)

[4] Binance Developers (2026). "Webhook Common Rules" and "Order Notification." https://developers.binance.com/docs/binance-pay/webhook-common and https://developers.binance.com/docs/binance-pay/order-notification (Retrieved: 2026-05-03)

[5] Binance Developers (2026). "Refund Order." https://developers.binance.com/docs/binance-pay/api-order-refund (Retrieved: 2026-05-03)

[6] Binance Developers (2026). "Batch Payout." https://developers.binance.com/docs/binance-pay/api-payout (Retrieved: 2026-05-03)

[7] Binance Developers (2026). "Submit Split." https://developers.binance.com/docs/binance-pay/api-profitshare-submit-split (Retrieved: 2026-05-03)

[8] Binance Academy (2024). "What Is Binance Pay and How to Use It?" https://www.binance.com/en/academy/articles/what-is-binance-pay-and-how-to-use-it (Retrieved: 2026-05-03)

[9] Banco Central do Brasil (2025). "BCB details rules on virtual assets." https://www.bcb.gov.br/en/pressdetail/2639/nota (Retrieved: 2026-05-03)

[10] Banco Central do Brasil (2026). "Pix em numeros." https://www.bcb.gov.br/estabilidadefinanceira/pix-em-numeros-estatisticas (Retrieved: 2026-05-03)

[11] Binance / PRNewswire (2025). "Binance Pay integrates with Pix, enabling instant crypto-powered payments in Brazilian Reais across Brazil." https://www.prnewswire.com/news-releases/binance-pay-integrates-with-pix-enabling-instant-crypto-powered-payments-in-brazilian-reais-across-brazil-302461281.html (Retrieved: 2026-05-03)

[12] Comision Nacional de Valores, Argentina (2024-2025). "Registro de Proveedores de Servicios de Activos Virtuales" and "La CNV crea el Registro de Proveedores de Servicios de Activos Virtuales." https://www.argentina.gob.ar/cnv/proveedores-de-servicios-de-activos-virtuales and https://www.argentina.gob.ar/node/420251 (Retrieved: 2026-05-03)

[13] Argentina.gob.ar (2025). "Resolucion General 1058/2025." https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1058-2025-410635/texto (Retrieved: 2026-05-03)

[14] Chainalysis (2025). "2025 LATAM Crypto Adoption: Latin America Emerges as Crypto Powerhouse" and "The 2025 Global Crypto Adoption Index." https://www.chainalysis.com/blog/latin-america-crypto-adoption-2025/ and https://www.chainalysis.com/blog/2025-global-crypto-adoption-index/ (Retrieved: 2026-05-03)

[15] Financial Sector Conduct Authority, South Africa (2026). "New Financial Services Providers." https://www.fsca.co.za/New-Financial-Service-Provider/ (Retrieved: 2026-05-03)

[16] Government of South Africa (2022). "Financial Advisory and Intermediary Services Act: Declaration of a crypto asset as a financial product." https://www.gov.za/documents/notices/financial-advisory-and-intermediary-services-act-declaration-crypto-asset (Retrieved: 2026-05-03)

[17] Zapper (2025). "Bitcoin to burgers: everyday crypto payments boom in South Africa." https://www.zapper.com/2025/09/29/bitcoin-to-burgers-everyday-crypto-payments-boom-in-south-africa/ (Retrieved: 2026-05-03)

[18] IT-Online (2026). "SA merchants get access to crypto payments." https://it-online.co.za/2026/02/05/sa-merchants-get-access-to-crypto-payments/ (Retrieved: 2026-05-03)

[19] Comision Nacional de Activos Digitales, El Salvador (2026). "Digital Assets Service Provider Public Registry." https://cnad.gob.sv/public-registry/digital-assets-service-provider/ (Retrieved: 2026-05-03)

[20] International Monetary Fund (2025). "IMF Executive Board Approves New 40-month US$1.4 billion Extended Fund Facility Arrangement for El Salvador." https://www.imf.org/en/News/Articles/2025/02/26/pr25043-el-salvador-imf-approves-new-40-month-us1-bn-eff-arr (Retrieved: 2026-05-03)

[21] Dubai Virtual Assets Regulatory Authority (2026). "Public Register." https://www.vara.ae/en/licenses-and-register/public-register/ (Retrieved: 2026-05-03)

[22] Dubai Virtual Assets Regulatory Authority (2025). "VARA Market Alert - CBUAE Law." https://www.vara.ae/en/regulations/regulatory-notices/vara-market-alert-cbuae-law/ (Retrieved: 2026-05-03)

[23] Central Bank of the Republic of Turkey (2021). "Regulation on the Disuse of Crypto Assets in Payments." https://www.tcmb.gov.tr/wps/wcm/connect/c241af16-e730-45b5-bb0d-31d3af28884e/Regulation%2Bon%2Bthe%2BDisuse%2Bof%2BCrypto%2BAssets%2Bin%2BPayments.pdf (Retrieved: 2026-05-03)

[24] Thai Securities and Exchange Commission and Bank of Thailand (2021-2022). "SEC issues regulation prohibiting digital asset business operators from facilitating the use of digital assets as a means of payment" and "Caution on Using Digital Assets as Means of Payment for Goods and Services." https://www.sec.or.th/EN/Pages/News_Detail.aspx?Lang=EN&NewsNo=39&NewsYear=2022&SECID=9366 and https://www.bot.or.th/en/news-and-media/news/news-20210708-1.html (Retrieved: 2026-05-03)

[25] ANTARA News / Bank Indonesia (2021). "Bitcoin is not lawfully accepted payment instrument in Indonesia: BI" and "BI bans cryptocurrency use as payment instrument, financial tool." https://en.antaranews.com/news/168747/bitcoin-is-not-lawfully-accepted-payment-instrument-in-indonesia-bi and https://en.antaranews.com/news/176610/bi-bans-cryptocurrency-use-as-payment-instrument-financial-tool (Retrieved: 2026-05-03)

[26] OWASP Foundation (2026). "File Upload Cheat Sheet." https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html (Retrieved: 2026-05-03)

[27] Amazon Web Services (2026). "Download and upload objects with presigned URLs." https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html (Retrieved: 2026-05-03)

[28] Stripe (2026). "Using webhooks with subscriptions." https://docs.stripe.com/billing/subscriptions/webhooks (Retrieved: 2026-05-03)

[29] Stripe (2026). "Entitlements." https://docs.stripe.com/billing/entitlements (Retrieved: 2026-05-03)

[30] RevenueCat (2026). "Webhooks." https://www.revenuecat.com/docs/integrations/webhooks (Retrieved: 2026-05-03)
