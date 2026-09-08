-- DropForeignKey
ALTER TABLE "PagePermission" DROP CONSTRAINT "PagePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- AlterTable
ALTER TABLE "ShareLink" ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "roleId";

-- DropTable
DROP TABLE "PagePermission";

-- DropTable
DROP TABLE "Role";

-- CreateTable
CREATE TABLE "ShareOtp" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareOtp_shareLinkId_idx" ON "ShareOtp"("shareLinkId");

-- AddForeignKey
ALTER TABLE "ShareOtp" ADD CONSTRAINT "ShareOtp_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

