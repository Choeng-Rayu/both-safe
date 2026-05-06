-- CreateTable
CREATE TABLE "BotState" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "flow" TEXT,
    "step" TEXT,
    "creatorRole" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "productTitle" TEXT,
    "amount" TEXT,
    "productType" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BotState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotState_chatId_key" ON "BotState"("chatId");
