-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "permission" TEXT NOT NULL DEFAULT 'read';
