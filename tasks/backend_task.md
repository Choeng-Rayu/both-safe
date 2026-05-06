# BothSafe MVP - Backend Task Breakdown

## 1. Backend Goal

Build the backend source of truth for the BothSafe MVP Deal Room Link.

The backend must support this MVP flow:

1. Either buyer or seller creates a Deal Room from website or Telegram bot.
2. The creator sends the Deal Room link inside an existing chat app.
3. The other side opens the link and fills missing deal information.
4. Both sides review and approve the deal.
5. Buyer pays to BothSafe local Bakong/KHQR receiving account.
6. Buyer uploads payment proof.
7. Admin manually verifies payment for MVP.
8. Seller ships and uploads shipping proof.
9. Buyer confirms received or opens dispute.
10. Admin manually releases or refunds money.

Backend must be clean, secure, scalable, and ready for future automation, but MVP should stay simple.

---

## 2. Technical Decision

### Use NestJS for MVP backend

Use NestJS as the main backend framework.

Reason:

- You already plan to use NestJS.
- Website, admin dashboard, payment flow, and Telegram bot can share the same service layer.
- Telegram Bot API integration can run safely inside a NestJS module for MVP.
- Faster development than splitting into multiple services too early.

### Do not use Go for MVP

Go is not required for the first version.

Go can be considered later for:

- high volume payment workers
- payout processing workers
- delivery tracking workers
- event streaming services
- fraud scoring services

For now, use one clean NestJS backend with separated modules.

---

## 3. MVP Scope

### Backend includes

- Deal Room creation from website
- Deal Room creation from Telegram bot
- anonymous or logged-in participant support
- role selection: buyer or seller
- invite link generation
- deal form update
- both-side approval
- manual KHQR payment proof upload
- admin payment verification
- seller shipping proof upload
- buyer confirmation
- simple dispute creation
- admin release or refund decision
- notifications for website and Telegram bot
- audit logs
- multi-language message keys: km, en, zh

### Backend excludes for MVP

Keep these as future features:

- automatic Bakong/KHQR payment verification
- automatic bank payout
- Binance or international payments
- real iframe embed widget
- merchant API or SDK
- delivery company API integration
- Telegram Mini App
- advanced KYC
- AI fraud detection
- automatic dispute decision
- subscription escrow
- digital product escrow

---

## 4. Core Product Concept

Use the term `Deal Room Link` for MVP.

Do not call it a real embed yet.

MVP behavior:

- The creator creates a deal link.
- The link is shared in Telegram, Messenger, WeChat, Facebook, or any chat.
- The other party opens the link in the browser.
- Both parties complete and approve the same deal.

Future behavior:

- Same Deal Room can become an iframe widget.
- Same Deal Room can become a merchant checkout API.
- Same Deal Room can be opened inside Telegram Mini App.

---

## 5. Shared Domain Rules

These rules must be used by backend, frontend, and bot.

### Rule 1: Buyer pays BothSafe, not seller

Buyer must pay to BothSafe receiving KHQR/account.

Seller KHQR is payout information only.

If buyer pays directly to seller, escrow does not work.

### Rule 2: Either side can create the Deal Room

The creator can be:

- buyer
- seller

The creator role is stored as `creator_role`.

### Rule 3: The other side must join before final approval

A deal cannot enter payment stage until:

- buyer information exists
- seller information exists
- product information exists
- price exists
- seller payout info exists
- both sides approve

### Rule 4: Lock critical fields after payment

After payment is verified, these fields cannot be changed without admin action:

- price
- product title
- product description
- seller payout KHQR
- buyer identity/contact
- seller identity/contact

### Rule 5: Admin operations are manual in MVP

MVP must not automatically move money.

Admin manually:

- verifies buyer payment proof
- releases seller payout
- refunds buyer
- resolves disputes

### Rule 6: Every important action must be audited

Record who did what and when.

Examples:

- deal created
- participant joined
- product updated
- approval submitted
- payment proof uploaded
- admin verified payment
- shipping proof uploaded
- buyer confirmed received
- dispute opened
- money released
- refund completed

---

## 6. Shared Deal Status Enum

Use this exact status list across backend, frontend, and bot.

```txt
DRAFT
AWAITING_COUNTERPARTY
AWAITING_BOTH_APPROVAL
READY_FOR_PAYMENT
PAYMENT_PENDING_VERIFICATION
PAID_ESCROWED
SELLER_PREPARING
SHIPPED
BUYER_CONFIRMED
DISPUTED
RELEASE_PENDING
RELEASED
REFUNDED
CANCELLED
EXPIRED
```

### Status meaning

| Status | Meaning |
|---|---|
| DRAFT | Creator started the deal but has not shared or completed required fields. |
| AWAITING_COUNTERPARTY | Deal has enough data to invite the other party. |
| AWAITING_BOTH_APPROVAL | Buyer and seller exist, but one or both have not approved. |
| READY_FOR_PAYMENT | Both approved and buyer can pay. |
| PAYMENT_PENDING_VERIFICATION | Buyer uploaded payment proof. Admin must verify. |
| PAID_ESCROWED | Payment is verified and money is held by BothSafe. |
| SELLER_PREPARING | Seller should pack and prepare delivery. |
| SHIPPED | Seller uploaded shipping proof. |
| BUYER_CONFIRMED | Buyer confirmed the item was received correctly. |
| DISPUTED | Buyer or seller opened a dispute. |
| RELEASE_PENDING | Admin is preparing manual payout to seller. |
| RELEASED | Seller payout completed. Deal is done. |
| REFUNDED | Buyer refund completed. Deal is closed. |
| CANCELLED | Deal was cancelled before completion. |
| EXPIRED | Deal link expired or payment window expired. |

---

## 7. Main Backend Modules

### 7.1 Auth Module

Purpose:

- support optional login
- support anonymous participant access tokens
- support admin login

MVP requirements:

- buyer and seller can use Deal Room without full account
- creator receives a private creator access token
- counterparty receives participant token after joining
- admin must login securely

Tasks:

- implement optional phone/email login abstraction
- implement anonymous participant token generation
- implement token validation guard
- implement admin role guard
- implement refresh or session strategy for logged-in users

Acceptance criteria:

- anonymous buyer can access only their deal
- anonymous seller can access only their deal
- admin endpoints cannot be accessed by public users
- lost anonymous token does not expose admin or other deal data

---

### 7.2 Deal Module

Purpose:

Manage Deal Room lifecycle.

Tasks:

- create deal from website or bot
- store creator source: `web` or `telegram`
- store creator role: `buyer` or `seller`
- generate public deal id
- generate invite token
- generate creator access token
- allow counterparty to join
- allow buyer/seller to update allowed sections
- calculate missing required fields
- calculate status transition
- support approval by both sides
- prevent invalid status transition

Required deal fields:

```txt
id
public_id
creator_role
source
status
currency
amount
fee_amount
net_seller_amount
created_by_user_id nullable
created_by_telegram_chat_id nullable
expires_at
created_at
updated_at
```

Required product fields:

```txt
deal_id
product_title
product_type
product_description
product_image_url nullable
quantity
condition nullable
```

Required participant fields:

```txt
deal_id
role buyer|seller
name
phone nullable
telegram_chat_id nullable
wechat_id nullable
messenger_name nullable
preferred_language km|en|zh
access_token_hash
approved_at nullable
joined_at nullable
```

Acceptance criteria:

- buyer can create a deal and invite seller
- seller can create a deal and invite buyer
- deal cannot move to READY_FOR_PAYMENT until both approve
- frontend and bot receive same status and missing field list

---

### 7.3 Invite Link Module

Purpose:

Generate secure share links.

MVP link format:

```txt
https://bothsafe.app/d/{publicId}?invite={inviteToken}
```

Creator private link format:

```txt
https://bothsafe.app/d/{publicId}?access={creatorAccessToken}
```

Tasks:

- generate short public id
- generate secure invite token
- generate secure participant access token
- hash tokens in database
- expire invite token after configurable time
- support regenerating invite link by creator
- prevent random guessing with rate limiting

Acceptance criteria:

- public id alone does not allow private actions
- invite token allows joining only as missing counterparty
- creator token is not shown to the other party
- expired invite returns clear error message key

---

### 7.4 Payment Module

Purpose:

Handle MVP payment proof workflow.

MVP payment model:

- buyer pays to BothSafe static local KHQR/Bakong receiving account
- buyer uploads screenshot or receipt
- admin manually checks bank app/account
- admin verifies or rejects payment proof

Payment fields:

```txt
id
deal_id
expected_amount
paid_amount nullable
currency
payment_method bakong_khqr
receiver_account_label
proof_image_url
buyer_note nullable
admin_status pending|verified|rejected
verified_by_admin_id nullable
verified_at nullable
rejected_reason nullable
created_at
```

Tasks:

- expose payment instruction for READY_FOR_PAYMENT deal
- accept payment proof upload
- validate file type and size
- set deal status to PAYMENT_PENDING_VERIFICATION
- admin verifies payment proof
- if verified, set deal status to PAID_ESCROWED then SELLER_PREPARING
- if rejected, return to READY_FOR_PAYMENT with rejection reason
- create ledger record after verification

Acceptance criteria:

- buyer cannot upload proof before READY_FOR_PAYMENT
- proof upload changes status correctly
- admin verification changes status correctly
- seller is notified only after payment is verified

---

### 7.5 Ledger Module

Purpose:

Keep money records clean, even if payout is manual.

Ledger entry types:

```txt
ESCROW_RECEIVED
PLATFORM_FEE_RESERVED
SELLER_PAYOUT_PENDING
SELLER_PAYOUT_SENT
BUYER_REFUND_PENDING
BUYER_REFUND_SENT
ADJUSTMENT
```

Tasks:

- create ledger entries when payment verified
- create payout pending entry when buyer confirms
- create payout sent entry when admin marks released
- create refund pending and sent entries when admin refunds
- make ledger append-only

Acceptance criteria:

- total deal amount can be reconciled
- admin can see expected seller payout
- no ledger entry is deleted or silently changed

---

### 7.6 Shipping Module

Purpose:

Handle seller delivery proof.

Shipping fields:

```txt
id
deal_id
delivery_company nullable
tracking_number nullable
package_photo_url nullable
delivery_receipt_url nullable
seller_note nullable
created_at
```

Tasks:

- allow shipping proof only after PAID_ESCROWED or SELLER_PREPARING
- upload package photo and receipt
- store delivery company and tracking number
- update deal status to SHIPPED
- notify buyer

Acceptance criteria:

- seller cannot upload shipping proof before payment verified
- buyer sees shipping proof in Deal Room
- bot sends notification to buyer if buyer came from Telegram

---

### 7.7 Confirmation Module

Purpose:

Handle buyer confirmation.

Tasks:

- allow buyer to confirm received only after SHIPPED
- set status to BUYER_CONFIRMED
- create payout pending ledger entry
- set status to RELEASE_PENDING
- notify admin and seller

Acceptance criteria:

- only buyer can confirm received
- confirmation cannot happen before SHIPPED
- seller cannot self-confirm

---

### 7.8 Dispute Module

Purpose:

Handle simple MVP disputes.

Allowed dispute reasons:

```txt
ITEM_NOT_RECEIVED
WRONG_ITEM
DAMAGED_ITEM
FAKE_ITEM
PAYMENT_PROBLEM
OTHER
```

Dispute fields:

```txt
id
deal_id
opened_by_role buyer|seller
reason
message
evidence_urls
status open|under_review|resolved_release|resolved_refund
admin_note nullable
created_at
resolved_at nullable
```

Tasks:

- allow dispute after PAYMENT_PENDING_VERIFICATION, PAID_ESCROWED, SELLER_PREPARING, or SHIPPED
- set deal status to DISPUTED
- pause normal release flow
- allow admin to resolve by release or refund

Acceptance criteria:

- disputed deal cannot be released by normal buyer confirmation flow
- admin must make final decision
- dispute timeline is visible to both sides

---

### 7.9 Admin Module

Purpose:

Operate MVP manually.

Admin pages consume backend APIs.

Admin capabilities:

- view all deals
- filter by status
- inspect payment proof
- verify or reject payment
- inspect shipping proof
- inspect disputes
- mark payout as released
- mark refund as completed
- add internal admin note
- export basic CSV report in future

Acceptance criteria:

- admin actions are role protected
- admin actions create audit log
- admin cannot release unpaid deal
- admin cannot refund already released deal without special override

---

### 7.10 Notification Module

Purpose:

Notify website and bot clients.

Notification channels:

- in-app timeline
- Telegram message if participant has Telegram chat id
- email/SMS future

Events to notify:

```txt
COUNTERPARTY_JOINED
DEAL_UPDATED
BOTH_APPROVED
PAYMENT_PROOF_UPLOADED
PAYMENT_VERIFIED
PAYMENT_REJECTED
SELLER_SHOULD_SHIP
SHIPPING_UPLOADED
BUYER_CONFIRMED
DISPUTE_OPENED
PAYOUT_RELEASED
REFUND_COMPLETED
```

Acceptance criteria:

- frontend can render timeline from backend
- bot can notify relevant Telegram user
- notification failure does not break deal status update

---

### 7.11 File Storage Module

Purpose:

Handle uploads safely.

File types:

- product image
- payment proof
- package photo
- delivery receipt
- dispute evidence

Tasks:

- upload to object storage
- validate file type
- validate file size
- generate private or signed URLs for sensitive files
- block executable uploads
- store file metadata

Acceptance criteria:

- payment proof is not public
- dispute evidence is not public
- only authorized participant or admin can access files

---

## 8. API Contract Shared With Frontend And Bot

Use versioned API prefix:

```txt
/v1
```

### 8.1 Create Deal

```txt
POST /v1/deals
```

Used by:

- frontend new deal page
- Telegram bot `/newdeal`

Request fields:

```txt
source: web|telegram
creator_role: buyer|seller
language: km|en|zh
product_title optional
product_type optional
product_description optional
amount optional
currency default KHR or USD based on app config
creator_name optional
creator_phone optional
telegram_chat_id optional
```

Response fields:

```txt
public_id
status
creator_access_url
invite_url
missing_fields
next_required_action
```

---

### 8.2 Get Deal Room

```txt
GET /v1/deals/{publicId}
```

Used by:

- frontend Deal Room
- bot notifications summary

Request auth options:

```txt
access token
invite token
logged-in session
admin token
```

Response fields:

```txt
public_id
status
creator_role
current_user_role nullable
participants
product
amount
fee_amount
net_seller_amount
payment_summary
shipping_summary
dispute_summary
timeline
missing_fields
allowed_actions
```

---

### 8.3 Join Deal

```txt
POST /v1/deals/{publicId}/join
```

Used by:

- frontend when counterparty opens invite link
- future Mini App

Request fields:

```txt
invite_token
role buyer|seller
name
phone optional
preferred_language km|en|zh
```

Response fields:

```txt
participant_access_url
status
missing_fields
allowed_actions
```

---

### 8.4 Update Deal Sections

```txt
PATCH /v1/deals/{publicId}/sections/product
PATCH /v1/deals/{publicId}/sections/participant
PATCH /v1/deals/{publicId}/sections/delivery
PATCH /v1/deals/{publicId}/sections/payout
```

Used by:

- frontend forms
- bot only for simple fields

Rules:

- buyer can update buyer participant fields
- seller can update seller participant and payout fields
- product fields can be updated before both approve
- price can be updated before both approve
- payout can be updated before payment proof upload

---

### 8.5 Approve Deal

```txt
POST /v1/deals/{publicId}/approval
```

Used by:

- frontend approval button
- bot quick approval future

Request fields:

```txt
access_token
approve true
```

Response fields:

```txt
status
approved_by
missing_approvals
allowed_actions
```

Rule:

- when both buyer and seller approve, backend changes status to READY_FOR_PAYMENT

---

### 8.6 Upload Payment Proof

```txt
POST /v1/deals/{publicId}/payment-proofs
```

Used by:

- frontend buyer payment page

Request fields:

```txt
proof_image
paid_amount
buyer_note optional
```

Response fields:

```txt
payment_id
status PAYMENT_PENDING_VERIFICATION
message_key
```

---

### 8.7 Admin Verify Payment

```txt
POST /v1/admin/payment-proofs/{paymentId}/verify
POST /v1/admin/payment-proofs/{paymentId}/reject
```

Used by:

- admin dashboard

Verify response:

```txt
deal_status SELLER_PREPARING
ledger_entries
```

Reject response:

```txt
deal_status READY_FOR_PAYMENT
rejected_reason
```

---

### 8.8 Upload Shipping Proof

```txt
POST /v1/deals/{publicId}/shipping-proofs
```

Used by:

- frontend seller shipping page
- bot can send web link to this page

Request fields:

```txt
delivery_company optional
tracking_number optional
package_photo optional
delivery_receipt optional
seller_note optional
```

Response fields:

```txt
status SHIPPED
shipping_id
```

---

### 8.9 Buyer Confirm Received

```txt
POST /v1/deals/{publicId}/confirm-received
```

Used by:

- frontend buyer confirmation page

Response fields:

```txt
status RELEASE_PENDING
message_key
```

---

### 8.10 Open Dispute

```txt
POST /v1/deals/{publicId}/disputes
```

Used by:

- frontend dispute page

Request fields:

```txt
reason
message
evidence_files optional
```

Response fields:

```txt
status DISPUTED
dispute_id
```

---

### 8.11 Admin Release Or Refund

```txt
POST /v1/admin/deals/{dealId}/release
POST /v1/admin/deals/{dealId}/refund
```

Used by:

- admin dashboard

Release request:

```txt
payout_reference
admin_note optional
```

Refund request:

```txt
refund_reference
admin_note optional
```

Response:

```txt
status RELEASED or REFUNDED
ledger_entries
```

---

## 9. Backend Task List

### B-01 Project setup

Requirements:

- initialize NestJS backend
- configure environment variables
- configure PostgreSQL
- configure Prisma or TypeORM
- configure validation pipe
- configure API version prefix `/v1`
- configure request logging
- configure global error response format

Acceptance criteria:

- backend starts locally
- health check endpoint works
- validation errors use consistent structure

---

### B-02 Database schema

Requirements:

- create tables for deals, participants, payments, ledger, shipping, disputes, files, audit logs, notifications, telegram identities
- add indexes for public_id, status, created_at, telegram_chat_id
- add enum constraints for status and roles

Acceptance criteria:

- migrations run cleanly
- rollback works in development
- seed creates sample buyer-created and seller-created deals

---

### B-03 Deal creation service

Requirements:

- create deal from web or bot
- support creator role buyer or seller
- generate public id
- generate invite token
- generate creator access token
- return creator and invite URLs

Acceptance criteria:

- website can create deal
- bot can create deal
- same API response works for frontend and bot

---

### B-04 Counterparty join service

Requirements:

- validate invite token
- assign missing role automatically if creator role is known
- create participant access token
- update status to AWAITING_BOTH_APPROVAL when both sides exist

Acceptance criteria:

- buyer-created deal can be joined by seller
- seller-created deal can be joined by buyer
- same invite token cannot create unlimited duplicate participants

---

### B-05 Deal update and missing field engine

Requirements:

- allow updating product, participant, delivery, and payout sections
- return `missing_fields` and `allowed_actions`
- prevent locked field updates after payment stage

Acceptance criteria:

- frontend can show checklist from backend response
- bot can show short next action message from backend response

---

### B-06 Approval and status transition engine

Requirements:

- buyer approval
- seller approval
- transition to READY_FOR_PAYMENT only when all required fields are complete
- reject invalid transition

Acceptance criteria:

- no deal can skip approval
- no payment proof can be uploaded before READY_FOR_PAYMENT

---

### B-07 Payment proof workflow

Requirements:

- return BothSafe KHQR payment instruction
- accept proof image upload
- set status to PAYMENT_PENDING_VERIFICATION
- notify admin
- admin verify/reject payment
- create ledger entries on verify

Acceptance criteria:

- admin can verify payment from dashboard
- seller receives notification only after admin verification

---

### B-08 Shipping workflow

Requirements:

- seller uploads shipping proof
- update status to SHIPPED
- notify buyer

Acceptance criteria:

- buyer sees proof
- non-seller cannot upload shipping proof

---

### B-09 Confirmation and release pending workflow

Requirements:

- buyer confirms received
- set status to RELEASE_PENDING
- create payout pending ledger entry
- notify admin

Acceptance criteria:

- seller cannot confirm for buyer
- admin sees deal in release queue

---

### B-10 Dispute workflow

Requirements:

- buyer or seller opens dispute
- upload evidence
- set status DISPUTED
- admin resolves by release or refund

Acceptance criteria:

- disputed deal cannot be released accidentally through normal flow
- timeline shows dispute event

---

### B-11 Admin dashboard API

Requirements:

- list deals with filters
- view detail
- verify/reject payment
- release/refund
- add note
- view audit log

Acceptance criteria:

- all admin actions require admin role
- admin action is audited

---

### B-12 Notification service

Requirements:

- create notification records
- support Telegram notification adapter
- expose timeline for frontend

Acceptance criteria:

- failed Telegram send does not rollback deal update
- timeline remains accurate

---

### B-13 Security hardening

Requirements:

- rate limit public endpoints
- validate all DTOs
- sanitize text fields
- store token hashes, not raw tokens
- protect file URLs
- restrict admin APIs
- configure CORS only for allowed frontend domains
- add idempotency for payment proof upload and admin release/refund

Acceptance criteria:

- basic abuse tests pass
- repeated release request cannot create duplicate payout ledger

---

### B-14 Localization support

Requirements:

- return language-independent status enums
- return message keys, not hardcoded UI text
- support participant preferred language: km, en, zh

Acceptance criteria:

- frontend controls final text rendering
- bot can map backend message keys into correct language

---

### B-15 Testing

Requirements:

- unit tests for status transitions
- unit tests for role permissions
- integration tests for buyer-created flow
- integration tests for seller-created flow
- integration tests for dispute flow
- integration tests for admin release/refund

Acceptance criteria:

- core flow tests pass before MVP launch
- invalid transition tests pass

---

## 10. Future Backend Roadmap

### Phase 2

- dynamic KHQR generation
- payment status polling
- automatic payment verification
- seller rating
- auto-release timeout

### Phase 3

- Telegram Mini App
- real iframe embed widget
- delivery API integration
- stronger seller verification
- merchant API keys

### Phase 4

- Binance or international payment route
- subscription escrow
- freelancer milestone escrow
- digital product escrow
- separate Go workers for high-volume jobs if needed

