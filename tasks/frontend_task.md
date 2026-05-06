# BothSafe MVP - Frontend Task Breakdown

## 1. Frontend Goal

Build a clean, mobile-first Next.js web app for the BothSafe MVP Deal Room Link.

The frontend must allow:

1. Buyer or seller to create a Deal Room.
2. Creator to share the link in Telegram, Messenger, WeChat, Facebook, or any chat.
3. Counterparty to open the link and join the deal.
4. Both parties to fill missing information.
5. Both parties to approve the deal.
6. Buyer to view local Bakong/KHQR payment instructions.
7. Buyer to upload payment proof.
8. Seller to upload shipping proof.
9. Buyer to confirm received or open dispute.
10. Admin to manually verify payment and release/refund money.

Frontend must support three languages from MVP:

```txt
km - Khmer
en - English
zh - Chinese
```

---

## 2. Product Decision

### MVP uses Deal Room Link, not iframe embed

For MVP, the shareable link is the product.

Example:

```txt
https://bothsafe.app/d/ABCD123?invite=xxxxx
```

Reason:

- Cambodian sellers already sell through chat.
- Link sharing is easier than real embed integration.
- No need for seller website.
- The same page can later become iframe embed, merchant checkout, or Telegram Mini App.

---

## 3. UX Principles For Cambodia MVP

### Mobile first

Most users will open the link from chat apps on mobile.

Requirements:

- fast loading
- large buttons
- simple forms
- clear status labels
- image upload from phone gallery/camera
- sticky bottom action button on deal pages

### Trust first

Every checkout page must clearly explain:

- buyer pays to BothSafe, not seller
- seller receives money after buyer confirmation
- BothSafe fee if any
- what happens if there is a dispute

### No forced login

MVP must support anonymous buyer/seller through secure access token.

Requirements:

- do not block deal flow with account creation
- allow optional login later
- store participant access token in secure cookie/local storage
- show warning: keep this link safe

### Local language support

Requirements:

- language switcher visible on all public pages
- default language from browser or previous selection
- support km, en, zh
- avoid long technical words
- use short labels and step-by-step guidance

---

## 4. Shared Status Enum

Frontend must use the exact backend status enum.

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

Frontend must not invent separate statuses.

Render user-friendly labels through i18n keys.

Example keys:

```txt
deal.status.draft
deal.status.awaiting_counterparty
deal.status.ready_for_payment
```

---

## 5. Main Frontend Routes

### 5.1 Public landing page

```txt
/
```

Purpose:

- explain BothSafe briefly
- show call to action: Create Protected Deal
- show language switcher

Main actions:

- Create as Seller
- Create as Buyer
- Open existing Deal Room link

Acceptance criteria:

- user understands product in less than 10 seconds
- page works on mobile
- language switcher works

---

### 5.2 Create Deal page

```txt
/deals/new
```

Purpose:

Allow buyer or seller to create a Deal Room.

Step 1: choose role

```txt
I am the seller
I am the buyer
```

Step 2A: seller-created deal fields

```txt
seller name
seller phone optional
product title
product type
product description optional
price
currency
seller payout KHQR/account label optional for draft, required before approval
```

Step 2B: buyer-created deal fields

```txt
buyer name
buyer phone optional
requested product title
product type optional
expected price
currency
note to seller optional
```

Step 3: create link

Frontend calls:

```txt
POST /v1/deals
```

Response shows:

```txt
creator private link
invite link
copy link button
open deal room button
```

Acceptance criteria:

- buyer can create and share seller invite link
- seller can create and share buyer invite link
- user can copy link easily
- form validates required fields before submit

---

### 5.3 Deal Room page

```txt
/d/[publicId]
```

Purpose:

Main shared page for buyer and seller.

Sections:

1. Deal status card
2. Product card
3. Buyer and seller card
4. Price and fee card
5. Payment card
6. Shipping card
7. Timeline card
8. Next action card

Frontend calls:

```txt
GET /v1/deals/{publicId}
```

Render from backend response:

```txt
status
current_user_role
participants
product
amount
fee_amount
net_seller_amount
missing_fields
allowed_actions
timeline
```

Acceptance criteria:

- page renders correctly for creator access token
- page renders correctly for invite token
- page renders correctly for participant access token
- page shows only actions allowed by backend

---

### 5.4 Join Deal page/state

```txt
/d/[publicId]?invite=xxxxx
```

Purpose:

Let counterparty join the deal.

Behavior:

- frontend detects invite token
- calls GET deal for preview
- shows safe preview, not private data
- asks user to confirm role and fill info
- calls join API

API:

```txt
POST /v1/deals/{publicId}/join
```

Required fields:

```txt
name
phone optional
preferred_language
```

Acceptance criteria:

- buyer invite joins as buyer
- seller invite joins as seller
- invalid invite shows clear error page
- after join, participant access token is stored

---

### 5.5 Edit Deal sections

Use modal or inline editing inside Deal Room.

Frontend calls:

```txt
PATCH /v1/deals/{publicId}/sections/product
PATCH /v1/deals/{publicId}/sections/participant
PATCH /v1/deals/{publicId}/sections/delivery
PATCH /v1/deals/{publicId}/sections/payout
```

Rules:

- only show editable fields allowed by backend
- show missing field checklist
- after each update, refresh Deal Room state

Acceptance criteria:

- buyer can update only buyer fields
- seller can update only seller/payout fields
- locked fields cannot be edited after payment stage
- backend validation errors are shown clearly

---

### 5.6 Approval section

Visible when status is:

```txt
AWAITING_BOTH_APPROVAL
```

Action:

```txt
POST /v1/deals/{publicId}/approval
```

UI must show:

- final product title
- final price
- buyer name
- seller name
- payout warning for seller
- escrow rule summary
- approve button

Acceptance criteria:

- buyer approval is visible in timeline
- seller approval is visible in timeline
- after both approve, page changes to READY_FOR_PAYMENT

---

### 5.7 Payment page/section

Visible when status is:

```txt
READY_FOR_PAYMENT
```

Purpose:

Buyer pays BothSafe local KHQR/Bakong receiving account.

UI elements:

- amount to pay
- currency
- BothSafe receiving KHQR image or account label
- payment instruction
- upload receipt screenshot
- paid amount field
- submit proof button

API:

```txt
POST /v1/deals/{publicId}/payment-proofs
```

After upload:

- show status PAYMENT_PENDING_VERIFICATION
- explain admin is checking payment

Acceptance criteria:

- only buyer sees upload payment proof action
- seller sees waiting for buyer payment or verification
- uploaded image preview works
- file size/type validation works before submit

---

### 5.8 Shipping page/section

Visible for seller when status is:

```txt
PAID_ESCROWED
SELLER_PREPARING
```

API:

```txt
POST /v1/deals/{publicId}/shipping-proofs
```

Fields:

```txt
delivery_company optional
tracking_number optional
package_photo optional
delivery_receipt optional
seller_note optional
```

After submit:

- status becomes SHIPPED
- buyer can see shipping proof

Acceptance criteria:

- only seller can submit shipping proof
- buyer gets clear next step: wait for delivery then confirm

---

### 5.9 Buyer confirmation section

Visible for buyer when status is:

```txt
SHIPPED
```

Actions:

```txt
Confirm Received
Open Dispute
```

Confirm API:

```txt
POST /v1/deals/{publicId}/confirm-received
```

Dispute API:

```txt
POST /v1/deals/{publicId}/disputes
```

Acceptance criteria:

- buyer can confirm received
- buyer can open dispute with reason and evidence
- seller cannot confirm on buyer behalf

---

### 5.10 Dispute page/section

Visible if user opens dispute or status is DISPUTED.

Allowed reasons:

```txt
ITEM_NOT_RECEIVED
WRONG_ITEM
DAMAGED_ITEM
FAKE_ITEM
PAYMENT_PROBLEM
OTHER
```

Fields:

```txt
reason
message
evidence images optional
```

Acceptance criteria:

- evidence upload works
- status changes to DISPUTED
- normal release buttons disappear
- timeline shows dispute event

---

### 5.11 Admin dashboard

```txt
/admin
/admin/deals
/admin/deals/[dealId]
```

Purpose:

Manual MVP operations.

Admin features:

- login
- list deals by status
- view deal detail
- view payment proof
- verify or reject payment
- view shipping proof
- view dispute evidence
- mark release completed
- mark refund completed
- add admin note

Admin APIs:

```txt
GET /v1/admin/deals
POST /v1/admin/payment-proofs/{paymentId}/verify
POST /v1/admin/payment-proofs/{paymentId}/reject
POST /v1/admin/deals/{dealId}/release
POST /v1/admin/deals/{dealId}/refund
```

Acceptance criteria:

- public user cannot access admin pages
- admin can operate the full MVP manually
- admin action result is visible in deal timeline

---

## 6. Frontend Component Design

### Shared components

```txt
LanguageSwitcher
StatusBadge
DealStatusCard
ProductCard
ParticipantCard
PriceSummaryCard
EscrowExplanationCard
MissingFieldsChecklist
Timeline
PrimaryActionBar
CopyLinkButton
ImageUploader
ReceiptUploader
ConfirmDialog
DisputeForm
```

### Admin components

```txt
AdminDealTable
AdminDealFilters
PaymentProofViewer
ShippingProofViewer
DisputeEvidenceViewer
AdminActionPanel
AdminNoteBox
```

Acceptance criteria:

- components are reusable
- no page contains duplicated status logic
- components use backend `allowed_actions` instead of hardcoded permissions

---

## 7. API Integration Contract

Frontend must align with backend endpoints below.

| Frontend action | Backend API |
|---|---|
| Create deal | POST /v1/deals |
| Load deal | GET /v1/deals/{publicId} |
| Join deal | POST /v1/deals/{publicId}/join |
| Update product | PATCH /v1/deals/{publicId}/sections/product |
| Update participant | PATCH /v1/deals/{publicId}/sections/participant |
| Update delivery | PATCH /v1/deals/{publicId}/sections/delivery |
| Update payout | PATCH /v1/deals/{publicId}/sections/payout |
| Approve deal | POST /v1/deals/{publicId}/approval |
| Upload payment proof | POST /v1/deals/{publicId}/payment-proofs |
| Upload shipping proof | POST /v1/deals/{publicId}/shipping-proofs |
| Confirm received | POST /v1/deals/{publicId}/confirm-received |
| Open dispute | POST /v1/deals/{publicId}/disputes |
| Admin verify payment | POST /v1/admin/payment-proofs/{paymentId}/verify |
| Admin reject payment | POST /v1/admin/payment-proofs/{paymentId}/reject |
| Admin release | POST /v1/admin/deals/{dealId}/release |
| Admin refund | POST /v1/admin/deals/{dealId}/refund |

---

## 8. Localization Tasks

### F-i18n-01 Setup i18n

Requirements:

- support km, en, zh
- language switcher
- persist language preference
- allow backend to store participant preferred language

Acceptance criteria:

- user can switch language without losing form data
- all main Deal Room text uses translation keys

### F-i18n-02 Translation key structure

Use consistent keys.

Examples:

```txt
common.next
common.back
common.cancel
deal.create.title
deal.role.buyer
deal.role.seller
deal.status.ready_for_payment
payment.upload_proof
shipping.upload_proof
dispute.reason.wrong_item
admin.payment.verify
```

Acceptance criteria:

- no hardcoded public UI text in components
- missing translation keys are easy to detect

---

## 9. Frontend Task List

### Implementation Status — 2026-05-06

| Task | Status | Notes |
|---|---|---|
| F-01 Next.js project setup | DONE | Shared app shell, env-aware API client, i18n foundation, routes boot correctly |
| F-02 Design system MVP | DONE | Mobile-first cards, buttons, forms, sticky action bar, reusable status components |
| F-03 Create Deal flow | DONE | Buyer/seller creation flow, validation, copy/open/share links |
| F-04 Deal Room state renderer | DONE | Status-driven shared deal room renderer with timeline, cards, missing fields, safe fallback |
| F-05 Join Deal flow | DONE | Invite detection, preview mode, join form, participant token storage |
| F-06 Edit sections | DONE | Inline product / participant / payout / delivery editors wired to backend |
| F-07 Approval UI | DONE | Approval action rendered from backend `allowed_actions` |
| F-08 Payment proof UI | DONE | Payment instruction, receipt upload, buyer-only proof submission |
| F-09 Shipping proof UI | DONE | Seller shipping proof upload and buyer-visible shipping summary |
| F-10 Buyer confirmation and dispute UI | DONE | Confirm received, dispute form, evidence upload flow |
| F-11 Admin dashboard UI | DONE | Admin login, deal list, detail view, payment review, release/refund/note actions |
| F-12 Bot link compatibility | DONE | Deal room resolves `access` / `invite` query links from web or bot-created URLs |
| F-13 Frontend security and privacy | DONE | Token storage without logging, admin cookie session, seller payout hidden from buyer |

### Verification Status — 2026-05-06

- `frontend`: `npm run lint`
- `frontend`: `npm run build`
- `backend`: `npm run build`
- Runtime smoke: homepage `200`, deal page `200`, admin session login `200`, backend API live on `http://localhost:3003`

### F-01 Next.js project setup

Requirements:

- initialize Next.js app
- configure TypeScript
- configure linting and formatting
- configure environment variables
- configure API base URL
- configure i18n foundation

Acceptance criteria:

- app runs locally
- routes work
- language switcher works

---

### F-02 Design system MVP

Requirements:

- define mobile-first layout
- define typography scale
- define button styles
- define form styles
- define status badge component
- define card layout

Acceptance criteria:

- all core pages look consistent
- main actions are easy to tap on mobile

---

### F-03 Create Deal flow

Requirements:

- role selection
- seller-created form
- buyer-created form
- call POST /v1/deals
- show invite link and copy button
- show open Deal Room button

Acceptance criteria:

- buyer-created deal works
- seller-created deal works
- generated invite link can be shared in chat

---

### F-04 Deal Room state renderer

Requirements:

- call GET /v1/deals/{publicId}
- render all cards
- render timeline
- render missing field checklist
- render next allowed action

Acceptance criteria:

- every backend status has a frontend UI state
- unknown status fails safely

---

### F-05 Join Deal flow

Requirements:

- detect invite token from URL
- show deal preview
- submit join form
- store participant access token
- refresh deal state

Acceptance criteria:

- counterparty can join from chat link
- invalid invite token shows friendly error

---

### F-06 Edit sections

Requirements:

- product edit form
- participant edit form
- delivery edit form
- payout edit form
- use backend validation errors

Acceptance criteria:

- forms update backend correctly
- locked fields are not editable

---

### F-07 Approval UI

Requirements:

- show final review before approve
- submit approval API
- show approval state for each side

Acceptance criteria:

- both approvals move deal to READY_FOR_PAYMENT

---

### F-08 Payment proof UI

Requirements:

- show BothSafe KHQR/payment instruction
- upload receipt screenshot
- submit paid amount
- show pending verification state

Acceptance criteria:

- buyer can upload proof
- seller cannot upload buyer proof
- frontend handles upload error clearly

---

### F-09 Shipping proof UI

Requirements:

- seller upload package photo/receipt
- seller input tracking number
- submit shipping proof API
- show proof to buyer

Acceptance criteria:

- shipping proof changes status to SHIPPED

---

### F-10 Buyer confirmation and dispute UI

Requirements:

- confirm received button
- dispute form
- evidence upload
- status update after submit

Acceptance criteria:

- buyer can confirm or dispute
- normal confirmation action hides after dispute

---

### F-11 Admin dashboard UI

Requirements:

- admin login page
- deal table
- status filters
- deal detail
- payment proof review
- release/refund action
- admin note

Acceptance criteria:

- admin can operate MVP without backend console

---

### F-12 Bot link compatibility

Requirements:

- support links created from Telegram bot
- preserve source=telegram in backend only
- open same Deal Room page from bot buttons
- store token correctly from URL

Acceptance criteria:

- deal created by bot can be completed in website
- website-created deal can still notify Telegram if chat id exists

---

### F-13 Frontend security and privacy

Requirements:

- do not expose raw access token in logs
- hide seller payout details from buyer if not needed
- protect admin routes
- validate upload file client-side
- use HTTPS only in production

Acceptance criteria:

- sensitive data is not shown to wrong role
- admin page is not accessible publicly

---

## 10. Future Frontend Roadmap

### Phase 2

- better seller profile page
- seller rating display
- auto-release countdown UI
- dynamic KHQR payment status UI

### Phase 3

- real embeddable widget
- merchant checkout page
- Telegram Mini App wrapper
- delivery tracking UI

### Phase 4

- Binance/international payment UI
- subscription escrow UI
- freelancer milestone escrow UI
- digital product delivery UI
