-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableUsd" BIGINT NOT NULL DEFAULT 0,
    "availableKhr" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLedgerEntry" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "dealId" TEXT,
    "withdrawalId" TEXT,
    "paymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "destinationKhqr" TEXT,
    "destinationKhqrImage" TEXT,
    "destinationBankName" TEXT,
    "destinationAccountName" TEXT,
    "destinationAccountNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedByAdminId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "providerReference" TEXT,
    "providerResponseJson" TEXT,
    "failureReason" TEXT,
    "transferAttemptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLedgerEntry_idempotencyKey_key" ON "WalletLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_walletId_createdAt_idx" ON "WalletLedgerEntry"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_userId_currency_createdAt_idx" ON "WalletLedgerEntry"("userId", "currency", "createdAt");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_dealId_idx" ON "WalletLedgerEntry"("dealId");

-- CreateIndex
CREATE INDEX "WalletLedgerEntry_withdrawalId_idx" ON "WalletLedgerEntry"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_publicId_key" ON "Withdrawal"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_transferAttemptId_key" ON "Withdrawal"("transferAttemptId");

-- CreateIndex
CREATE INDEX "Withdrawal_userId_status_idx" ON "Withdrawal"("userId", "status");

-- CreateIndex
CREATE INDEX "Withdrawal_status_createdAt_idx" ON "Withdrawal"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLedgerEntry" ADD CONSTRAINT "WalletLedgerEntry_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_transferAttemptId_fkey" FOREIGN KEY ("transferAttemptId") REFERENCES "TransferAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
