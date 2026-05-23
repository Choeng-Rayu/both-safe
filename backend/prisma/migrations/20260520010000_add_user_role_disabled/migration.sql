-- Add admin/user role enum + soft-disable flag on User.
-- Admins are bootstrapped from ADMIN_BOOTSTRAP_EMAIL/PASSWORD via
-- SeedService and manage the platform via the same login form as
-- regular users. Self-registration always creates a USER row.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_disabled_idx" ON "User"("disabled");
