-- DealFeedback: optional rating + comment from buyer or seller after
-- a deal reaches a terminal status. Used by the admin dashboard to
-- surface improvement signals.

CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFeedback_pkey" PRIMARY KEY ("id")
);

-- One feedback per role per deal.
CREATE UNIQUE INDEX "DealFeedback_dealId_role_key" ON "DealFeedback"("dealId", "role");

CREATE INDEX "DealFeedback_dealId_idx" ON "DealFeedback"("dealId");
CREATE INDEX "DealFeedback_userId_idx" ON "DealFeedback"("userId");
CREATE INDEX "DealFeedback_rating_idx" ON "DealFeedback"("rating");
CREATE INDEX "DealFeedback_createdAt_idx" ON "DealFeedback"("createdAt");

-- Foreign keys with cascade on Deal/Participant; SET NULL on User
-- so deleting a user doesn't take their old feedback rows away.
ALTER TABLE "DealFeedback"
  ADD CONSTRAINT "DealFeedback_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealFeedback"
  ADD CONSTRAINT "DealFeedback_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DealFeedback"
  ADD CONSTRAINT "DealFeedback_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
