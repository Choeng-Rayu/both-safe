-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "autoVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "khqrMd5" TEXT;
