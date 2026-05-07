-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "khqrString" TEXT;

-- CreateTable
CREATE TABLE "TransferAttempt" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotencyKey" TEXT NOT NULL,
    "providerReference" TEXT,
    "providerRequestJson" TEXT,
    "providerResponseJson" TEXT,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferAttempt_idempotencyKey_key" ON "TransferAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferAttempt_dealId_purpose_idx" ON "TransferAttempt"("dealId", "purpose");

-- CreateIndex
CREATE INDEX "TransferAttempt_status_idx" ON "TransferAttempt"("status");

-- CreateIndex
CREATE INDEX "Participant_userId_idx" ON "Participant"("userId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
