-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'accesstrade',
    "externalId" TEXT,
    "nicheId" TEXT,
    "merchant" TEXT NOT NULL,
    "merchantLogo" TEXT,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "discountValue" INTEGER NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "minOrderValue" INTEGER,
    "maxDiscount" INTEGER,
    "affiliateUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Coupon_nicheId_isActive_expiresAt_idx" ON "Coupon"("nicheId", "isActive", "expiresAt");
CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");
