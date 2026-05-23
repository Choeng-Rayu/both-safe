-- Drop legacy seller payout columns from Participant.
-- Released funds now flow directly into the seller's BothSafe wallet
-- (see Wallet, WalletLedgerEntry, Withdrawal). Sellers cash out via
-- the dedicated withdrawal flow, so per-deal payout details are no
-- longer collected.

ALTER TABLE "Participant" DROP COLUMN IF EXISTS "payoutKhqr";
ALTER TABLE "Participant" DROP COLUMN IF EXISTS "payoutBankName";
ALTER TABLE "Participant" DROP COLUMN IF EXISTS "payoutAccountName";
ALTER TABLE "Participant" DROP COLUMN IF EXISTS "payoutAccountNumber";
ALTER TABLE "Participant" DROP COLUMN IF EXISTS "payoutKhqrImage";
