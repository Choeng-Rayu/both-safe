# BothSafe V1 Threat Model

## Protected Assets

- Payment provider credentials and webhook secrets.
- Product files, license keys, and signed download URLs.
- User identity, Telegram IDs, evidence, and admin actions.
- Ledger, payment events, dispute decisions, and entitlement history.

## Main Trust Boundaries

- Browser or Telegram user to API.
- Payment provider webhook to API.
- API to PostgreSQL and Redis.
- API to private object storage.
- Admin console to privileged release/refund actions.

## STRIDE Risks and V1 Controls

| Risk | Control |
|---|---|
| Spoofed payment webhook | Binance RSA verification, PayWay HMAC placeholder, timestamp tolerance, raw event storage |
| Duplicate webhook replay | Provider event idempotency keys and unique indexes |
| Frontend redirect unlock | Access grants only created by backend payment confirmation |
| Malicious file upload | Allow-listed MIME/extensions, size limits, scan state, private storage |
| Seller payout while disputed | Dispute freeze and admin approval task gate |
| Silent admin tampering | Append-only audit events and ledger reversal entries |
| Secret leakage | `.env.example` placeholders only; secrets excluded by `.gitignore` |
