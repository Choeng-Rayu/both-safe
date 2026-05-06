# BothSafe MVP - Telegram Bot Task Breakdown

## 1. Bot Goal

Build a Telegram bot that helps users create and manage BothSafe Deal Room Links quickly from chat.

The bot is not a separate product logic system.

The bot must use the same backend Deal Room system as the website.

Main bot purpose:

1. Create a Deal Room as buyer or seller.
2. Generate invite link.
3. Let user send the link to the other party.
4. Notify users about deal status changes.
5. Push users to the website for sensitive or complex actions.

---

## 2. Technical Decision

### Use NestJS for Telegram bot in MVP

Telegram bot should be implemented inside the NestJS backend as a separate module.

Reason:

- same codebase
- same database
- same deal service
- same validation rules
- same notification service
- faster MVP development

### Do not use Go for MVP bot

Go is not needed now.

Go can be considered later if:

- bot traffic becomes high
- payment polling needs high concurrency
- event workers need independent scaling
- payout workers need extra reliability

For MVP, NestJS is enough.

---

## 3. Bot Scope

### Bot includes for MVP

- `/start`
- `/newdeal`
- create deal as seller
- create deal as buyer
- collect minimal deal fields
- call same backend deal service/API
- return creator link and invite link
- show deal status summary
- send status notifications
- language preference: km, en, zh
- open website Deal Room via button

### Bot excludes for MVP

Keep these as future:

- Telegram Mini App
- full payment proof upload inside Telegram
- full payout KHQR form inside Telegram
- admin bot commands for money release
- automatic Bakong payment verification
- Binance payment
- digital subscription automation

---

## 4. Shared Deal Status Enum

Bot must use the same status enum as backend and frontend.

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

Bot messages must map these statuses to localized text keys.

---

## 5. Bot Product Rule

The bot creates links. The website completes actions.

For MVP, avoid collecting too much sensitive information in Telegram chat.

Recommended bot behavior:

- collect only simple fields in bot
- create draft Deal Room
- send user to website to complete missing fields
- use Telegram for reminders and notifications

Reason:

- less risk exposing payout info in chat
- simpler UX
- fewer bot conversation errors
- website forms are easier for image upload and review

---

## 6. Bot Commands

### 6.1 `/start`

Purpose:

Welcome user and explain BothSafe.

Bot should show buttons:

```txt
Create Protected Deal
My Deals
Language
Help
```

Acceptance criteria:

- new user understands bot purpose
- user can select language
- Telegram chat id is stored or updated

---

### 6.2 `/newdeal`

Purpose:

Start creating Deal Room.

Bot asks:

```txt
Are you the buyer or seller?
```

Buttons:

```txt
I am Seller
I am Buyer
```

Acceptance criteria:

- selected role is sent to backend as creator_role
- bot conversation state is stored safely

---

### 6.3 `/mydeals`

Purpose:

Show latest deals connected to Telegram chat id.

Display:

```txt
Deal public id
Product title
Amount
Status
Open Deal Room button
```

Acceptance criteria:

- user sees only deals linked to their Telegram chat id
- button opens website Deal Room

---

### 6.4 `/help`

Purpose:

Explain how escrow works in simple language.

Must explain:

- buyer pays BothSafe
- seller ships after payment verified
- buyer confirms received
- admin releases seller payout
- dispute option exists

Acceptance criteria:

- help text is available in km, en, zh

---

## 7. Bot Creation Flows

### 7.1 Seller creates deal from bot

Flow:

1. User sends `/newdeal`.
2. User selects `I am Seller`.
3. Bot asks product title.
4. Bot asks price.
5. Bot asks optional product type.
6. Bot calls backend create deal.
7. Bot returns:
   - creator private link
   - buyer invite link
   - button: Open Deal Room
   - button: Share Buyer Link
8. Seller opens website to complete missing fields such as payout KHQR if not collected by bot.

Backend API/service:

```txt
POST /v1/deals
```

Payload:

```txt
source: telegram
creator_role: seller
telegram_chat_id
language
product_title
amount
product_type optional
```

Acceptance criteria:

- seller can create deal within bot
- deal appears in backend with source=telegram
- invite link can be sent to buyer in current chat
- website can continue the same deal

---

### 7.2 Buyer creates deal from bot

Flow:

1. User sends `/newdeal`.
2. User selects `I am Buyer`.
3. Bot asks requested product title.
4. Bot asks expected price.
5. Bot asks optional note to seller.
6. Bot calls backend create deal.
7. Bot returns:
   - creator private link
   - seller invite link
   - button: Open Deal Room
   - button: Share Seller Link
8. Seller opens link and fills seller information and payout details on website.

Backend API/service:

```txt
POST /v1/deals
```

Payload:

```txt
source: telegram
creator_role: buyer
telegram_chat_id
language
product_title
amount
product_description optional
```

Acceptance criteria:

- buyer can create deal within bot
- seller can join from invite link
- both sides later approve on website

---

## 8. Bot Link Behavior

### Creator private link

Bot sends only to creator.

Format:

```txt
https://bothsafe.app/d/{publicId}?access={creatorAccessToken}
```

Purpose:

- creator can reopen deal
- creator can edit allowed fields
- creator can approve deal

### Invite link

Bot tells creator to send this to the other party.

Format:

```txt
https://bothsafe.app/d/{publicId}?invite={inviteToken}
```

Purpose:

- other party joins deal
- other party receives their own participant access token after joining

Acceptance criteria:

- bot never sends creator access token to counterparty intentionally
- bot clearly labels which link is private and which link is for sharing

---

## 9. Bot Notifications

Bot receives events from backend Notification Module.

Events and messages:

| Backend event | Bot message target | Bot action |
|---|---|---|
| COUNTERPARTY_JOINED | creator | Other party joined your deal. Open Deal Room. |
| DEAL_UPDATED | relevant participant | Deal information changed. Review again. |
| BOTH_APPROVED | buyer | Deal approved. You can pay now. |
| PAYMENT_PROOF_UPLOADED | seller optional | Buyer submitted payment proof. Waiting admin verification. |
| PAYMENT_VERIFIED | seller | Payment verified. Please ship item. |
| PAYMENT_REJECTED | buyer | Payment proof rejected. Please check and upload again. |
| SHIPPING_UPLOADED | buyer | Seller uploaded shipping proof. |
| BUYER_CONFIRMED | seller | Buyer confirmed received. Waiting payout release. |
| DISPUTE_OPENED | both sides | Dispute opened. Admin will review. |
| PAYOUT_RELEASED | seller | Payout marked released. |
| REFUND_COMPLETED | buyer | Refund marked completed. |

Acceptance criteria:

- bot notifications are sent only to linked Telegram chat ids
- notification failure does not break backend status update
- each notification includes Open Deal Room button

---

## 10. Bot API Alignment

Bot must align with backend APIs below.

| Bot action | Backend API or service |
|---|---|
| Create seller deal | POST /v1/deals |
| Create buyer deal | POST /v1/deals |
| Show deal summary | GET /v1/deals/{publicId} |
| List my deals | GET internal service by telegram_chat_id |
| Notify status change | Notification service event |
| Open website | frontend /d/[publicId] |

Important:

- Since bot runs inside NestJS, it may call backend services directly instead of HTTP.
- The request/response shape must still match the public API contract.
- Do not create bot-only deal logic.

---

## 11. Bot Conversation State

Store temporary bot state for `/newdeal`.

State fields:

```txt
telegram_chat_id
current_flow newdeal
creator_role buyer|seller
language km|en|zh
step
product_title nullable
amount nullable
product_type nullable
note nullable
created_at
expires_at
```

Requirements:

- expire unfinished bot flow after short time
- allow cancel command
- allow restart safely
- validate amount
- avoid duplicate deal creation on repeated messages

Acceptance criteria:

- user can cancel and restart
- accidental duplicate messages do not create duplicate deals easily

---

## 12. Bot Security Requirements

### Webhook security

Requirements:

- configure Telegram webhook secret
- validate webhook source according to framework capability
- keep bot token in environment variable
- never log bot token

### User data security

Requirements:

- store Telegram chat id safely
- do not expose private creator access link to others
- do not ask for high-risk sensitive data in Telegram chat if website can collect it better
- do not show full seller payout KHQR to buyer through bot

### Abuse protection

Requirements:

- rate limit deal creation per Telegram chat id
- block spammy repeated commands
- limit number of open draft deals per chat id

Acceptance criteria:

- public cannot fake bot notification events
- one Telegram user cannot access another user's deals via `/mydeals`
- bot handles invalid input gracefully

---

## 13. Bot Localization

Bot must support:

```txt
km
en
zh
```

Language selection:

- ask on first `/start`
- allow change from Language button
- store preferred language linked to Telegram chat id
- send language to backend during deal creation

Message key examples:

```txt
bot.start.title
bot.menu.create_deal
bot.role.ask
bot.role.seller
bot.role.buyer
bot.deal.created
bot.link.private_warning
bot.link.share_this
bot.status.ready_for_payment
bot.error.invalid_amount
bot.help.escrow_explain
```

Acceptance criteria:

- all bot public messages use translation keys
- fallback language is English if translation missing

---

## 14. Bot Task List

### T-01 Bot module setup

Requirements:

- create Telegram bot module in NestJS
- configure bot token from environment
- configure webhook or long polling for development
- implement `/start`
- store Telegram identity

Acceptance criteria:

- bot responds to `/start`
- chat id is stored
- no bot token appears in logs

---

### T-02 Language selection

Requirements:

- language buttons: km, en, zh
- store preference
- use preference for future messages

Acceptance criteria:

- user can change language anytime
- bot messages switch language correctly

---

### T-03 New deal conversation

Requirements:

- implement `/newdeal`
- ask role
- collect product title
- collect amount
- collect optional product type/note
- validate amount
- allow cancel

Acceptance criteria:

- user can complete seller-created flow
- user can complete buyer-created flow
- invalid amount asks user to retry

---

### T-04 Create deal integration

Requirements:

- call Deal Service or POST /v1/deals with source=telegram
- include telegram_chat_id
- include creator_role
- include language
- receive creator_access_url and invite_url

Acceptance criteria:

- created bot deal is visible in admin dashboard
- created bot deal opens correctly in frontend

---

### T-05 Link response UI

Requirements:

- show private creator link warning
- show invite link for sharing
- show Open Deal Room button
- show copy/share friendly text

Acceptance criteria:

- creator understands which link to keep private
- creator understands which link to send to other party

---

### T-06 My Deals command

Requirements:

- implement `/mydeals`
- list latest deals linked to telegram_chat_id
- include product title, amount, status
- include Open Deal Room button

Acceptance criteria:

- user sees only own linked deals
- status matches frontend/backend status

---

### T-07 Notification adapter

Requirements:

- subscribe to backend notification events
- map event to bot message key
- send message to correct Telegram chat id
- include Open Deal Room button

Acceptance criteria:

- seller is notified when payment verified
- buyer is notified when seller ships
- both are notified when dispute opens

---

### T-08 Error handling

Requirements:

- handle invalid command
- handle expired conversation state
- handle backend service error
- handle Telegram send failure

Acceptance criteria:

- bot never crashes on user input
- user receives friendly retry message

---

### T-09 Bot admin tools for development only

Requirements:

- optional development command to inspect current chat id
- disable in production or restrict to admin Telegram ids

Acceptance criteria:

- no public admin command in production

---

### T-10 Bot testing

Requirements:

- test seller-created deal flow
- test buyer-created deal flow
- test cancel/restart
- test invalid amount
- test notification mapping

Acceptance criteria:

- bot flow creates same backend deal as frontend flow
- all notification event mappings work

---

## 15. Future Bot Roadmap

### Phase 2

- payment reminder messages
- auto-release countdown reminders
- dispute reminder messages
- admin payment verification alert

### Phase 3

- Telegram Mini App version of Deal Room
- payment proof upload through Mini App
- richer bot notifications
- seller profile bot command

### Phase 4

- subscription escrow bot flow
- digital product escrow bot flow
- freelancer milestone escrow bot flow
- international payment notification flow

