-- ============================================================
-- Database schema — chạy file này 1 lần để tạo toàn bộ DB
-- PostgreSQL 14+
--
-- Cách dùng:
--   psql $DATABASE_URL -f prisma/schema.sql
-- ============================================================

-- Enum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- ── Niche ────────────────────────────────────────────────────
CREATE TABLE "Niche" (
    "id"             TEXT         NOT NULL,
    "name"           TEXT         NOT NULL,
    "emoji"          TEXT         NOT NULL DEFAULT '🏷️',
    "status"         TEXT         NOT NULL DEFAULT 'draft',
    "description"    TEXT,
    "metaKeywords"   TEXT,
    "sortOrder"      INTEGER      NOT NULL DEFAULT 0,
    "shopeeKeywords" JSONB        NOT NULL DEFAULT '[]',
    "atCampaignIds"  JSONB        NOT NULL DEFAULT '[]',
    "atKeywords"     JSONB        NOT NULL DEFAULT '[]',
    "minDiscountPct" INTEGER      NOT NULL DEFAULT 0,
    "minPrice"       INTEGER      NOT NULL DEFAULT 0,
    "maxPrice"       INTEGER      NOT NULL DEFAULT 10000000,
    "postPrefix"     TEXT,
    "hashtags"       TEXT,
    "zaloOaId"       TEXT,
    "launchedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- ── Category ─────────────────────────────────────────────────
CREATE TABLE "Category" (
    "id"   TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'LayoutGrid',
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- ── Platform ─────────────────────────────────────────────────
CREATE TABLE "Platform" (
    "id"       TEXT    NOT NULL,
    "name"     TEXT    NOT NULL,
    "logoUrl"  TEXT,
    "baseUrl"  TEXT    NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- ── Product ──────────────────────────────────────────────────
CREATE TABLE "Product" (
    "id"          TEXT      NOT NULL,
    "name"        TEXT      NOT NULL,
    "price"       INTEGER   NOT NULL,
    "commission"  INTEGER   NOT NULL DEFAULT 0,
    "rating"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPct" INTEGER,
    "imageUrl"    TEXT      NOT NULL,
    "imageAlt"    TEXT      NOT NULL,
    "productUrl"   TEXT NOT NULL,
    "affiliateUrl" TEXT,
    "source"       TEXT NOT NULL DEFAULT 'shopee',
    "externalId"   TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "categoryId"   TEXT NOT NULL,
    "isFeatured"  BOOLEAN   NOT NULL DEFAULT false,
    "isSoldOut"   BOOLEAN   NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Product_source_externalId_key" ON "Product"("source", "externalId");

ALTER TABLE "Product"
    ADD CONSTRAINT "Product_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── PriceHistory ─────────────────────────────────────────────
CREATE TABLE "PriceHistory" (
    "id"         TEXT         NOT NULL,
    "productId"  TEXT         NOT NULL,
    "price"      INTEGER      NOT NULL,
    "platformId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriceHistory_productId_recordedAt_idx"
    ON "PriceHistory"("productId", "recordedAt");

CREATE INDEX "PriceHistory_productId_platformId_recordedAt_idx"
    ON "PriceHistory"("productId", "platformId", "recordedAt");

ALTER TABLE "PriceHistory"
    ADD CONSTRAINT "PriceHistory_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PriceHistory"
    ADD CONSTRAINT "PriceHistory_platformId_fkey"
    FOREIGN KEY ("platformId") REFERENCES "Platform"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PlatformProduct ──────────────────────────────────────────
CREATE TABLE "PlatformProduct" (
    "id"                TEXT      NOT NULL,
    "productId"         TEXT      NOT NULL,
    "platformId"        TEXT      NOT NULL,
    "platformProductId" TEXT      NOT NULL,
    "platformUrl"       TEXT      NOT NULL,
    "currentPrice"      INTEGER   NOT NULL,
    "originalPrice"     INTEGER,
    "inStock"           BOOLEAN   NOT NULL DEFAULT true,
    "rating"            DOUBLE PRECISION,
    "soldCount"         INTEGER,
    "lastChecked"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformProduct_productId_platformId_key"
    ON "PlatformProduct"("productId", "platformId");

CREATE INDEX "PlatformProduct_productId_idx" ON "PlatformProduct"("productId");
CREATE INDEX "PlatformProduct_platformId_idx" ON "PlatformProduct"("platformId");

ALTER TABLE "PlatformProduct"
    ADD CONSTRAINT "PlatformProduct_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformProduct"
    ADD CONSTRAINT "PlatformProduct_platformId_fkey"
    FOREIGN KEY ("platformId") REFERENCES "Platform"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── ProductMatch ─────────────────────────────────────────────
CREATE TABLE "ProductMatch" (
    "id"             TEXT         NOT NULL,
    "productId"      TEXT         NOT NULL,
    "platformId"     TEXT         NOT NULL,
    "candidateUrl"   TEXT         NOT NULL,
    "candidateName"  TEXT,
    "candidatePrice" INTEGER,
    "confidence"     DOUBLE PRECISION NOT NULL,
    "status"         "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedBy"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductMatch_productId_platformId_idx"
    ON "ProductMatch"("productId", "platformId");

CREATE INDEX "ProductMatch_status_idx" ON "ProductMatch"("status");

ALTER TABLE "ProductMatch"
    ADD CONSTRAINT "ProductMatch_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClickLog ─────────────────────────────────────────────────
CREATE TABLE "ClickLog" (
    "id"        TEXT         NOT NULL,
    "productId" TEXT         NOT NULL,
    "source"    TEXT,
    "referer"   TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClickLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClickLog_productId_clickedAt_idx" ON "ClickLog"("productId", "clickedAt");
CREATE INDEX "ClickLog_clickedAt_idx" ON "ClickLog"("clickedAt");

ALTER TABLE "ClickLog"
    ADD CONSTRAINT "ClickLog_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── AppSetting ───────────────────────────────────────────────
CREATE TABLE "AppSetting" (
    "id"    TEXT NOT NULL,
    "key"   TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_key_key" ON "AppSetting"("key");

-- ── ProductEmbedding ─────────────────────────────────────────
CREATE TABLE "ProductEmbedding" (
    "id"        TEXT         NOT NULL,
    "productId" TEXT         NOT NULL,
    "embedding" TEXT         NOT NULL,
    "model"     TEXT         NOT NULL,
    "dims"      INTEGER      NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductEmbedding_productId_key" ON "ProductEmbedding"("productId");

ALTER TABLE "ProductEmbedding"
    ADD CONSTRAINT "ProductEmbedding_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Feedback ─────────────────────────────────────────────────
CREATE TABLE "Feedback" (
    "id"             TEXT             NOT NULL,
    "name"           TEXT             NOT NULL,
    "email"          TEXT             NOT NULL,
    "message"        TEXT             NOT NULL,
    "sentiment"      TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- ── Coupon ───────────────────────────────────────────────────
CREATE TABLE "Coupon" (
    "id"            TEXT         NOT NULL,
    "source"        TEXT         NOT NULL DEFAULT 'accesstrade',
    "platform"      TEXT,
    "externalId"    TEXT,
    "nicheId"       TEXT,
    "merchant"      TEXT         NOT NULL,
    "merchantLogo"  TEXT,
    "code"          TEXT,
    "description"   TEXT         NOT NULL,
    "discountValue" INTEGER      NOT NULL,
    "discountType"  TEXT         NOT NULL DEFAULT 'percent',
    "minOrderValue" INTEGER,
    "maxDiscount"   INTEGER,
    "affiliateUrl"  TEXT         NOT NULL,
    "expiresAt"     TIMESTAMP(3),
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "clickCount"    INTEGER      NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Coupon_nicheId_isActive_expiresAt_idx"
    ON "Coupon"("nicheId", "isActive", "expiresAt");

CREATE INDEX "Coupon_isActive_expiresAt_idx" ON "Coupon"("isActive", "expiresAt");

-- ── BroadcastLog ─────────────────────────────────────────────
CREATE TABLE "BroadcastLog" (
    "id"          TEXT         NOT NULL,
    "channel"     TEXT         NOT NULL,
    "nicheId"     TEXT,
    "productIds"  TEXT         NOT NULL,
    "messageText" TEXT         NOT NULL,
    "status"      TEXT         NOT NULL,
    "error"       TEXT,
    "sentAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BroadcastLog_channel_sentAt_idx" ON "BroadcastLog"("channel", "sentAt");

-- ── AppLog ───────────────────────────────────────────────────
CREATE TABLE "AppLog" (
    "id"        TEXT         NOT NULL,
    "level"     TEXT         NOT NULL,
    "message"   TEXT         NOT NULL,
    "context"   TEXT,
    "source"    TEXT,
    "app"       TEXT,
    "trigger"   TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppLog_level_createdAt_idx"  ON "AppLog"("level",  "createdAt");
CREATE INDEX "AppLog_app_createdAt_idx"    ON "AppLog"("app",    "createdAt");
CREATE INDEX "AppLog_source_createdAt_idx" ON "AppLog"("source", "createdAt");
CREATE INDEX "AppLog_createdAt_idx"        ON "AppLog"("createdAt");

-- ── RateLimit ─────────────────────────────────────────────────
CREATE TABLE "RateLimit" (
    "key"     TEXT         NOT NULL,
    "count"   INTEGER      NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- ── AtCampaign ───────────────────────────────────────────────
CREATE TABLE "AtCampaign" (
    "id"             TEXT         NOT NULL,
    "name"           TEXT         NOT NULL,
    "merchant"       TEXT         NOT NULL,
    "url"            TEXT         NOT NULL,
    "approval"       TEXT         NOT NULL,
    "cookieDuration" INTEGER,
    "status"         INTEGER      NOT NULL,
    "lastSeenAt"     TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AtCampaignNicheMatch" (
    "id"         TEXT         NOT NULL,
    "campaignId" TEXT         NOT NULL,
    "nicheId"    TEXT         NOT NULL,
    "matchedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AtCampaignNicheMatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AtCampaignNicheMatch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AtCampaign"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "AtCampaignNicheMatch_campaignId_nicheId_key" ON "AtCampaignNicheMatch"("campaignId", "nicheId");
CREATE INDEX "AtCampaignNicheMatch_nicheId_idx" ON "AtCampaignNicheMatch"("nicheId");

-- ── NicheIntegration ─────────────────────────────────────────
CREATE TABLE "NicheIntegration" (
    "id"             TEXT         NOT NULL,
    "nicheId"        TEXT         NOT NULL,
    "platform"       TEXT         NOT NULL,
    "enabled"        BOOLEAN      NOT NULL DEFAULT true,
    "atEnabled"      BOOLEAN      NOT NULL DEFAULT true,
    "directEnabled"  BOOLEAN      NOT NULL DEFAULT true,
    "directFallback" BOOLEAN      NOT NULL DEFAULT true,
    "campaignId"     TEXT,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NicheIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NicheIntegration_nicheId_platform_key" ON "NicheIntegration"("nicheId", "platform");
CREATE INDEX "NicheIntegration_nicheId_idx" ON "NicheIntegration"("nicheId");

-- ── SyncJob ──────────────────────────────────────────────────
CREATE TABLE "SyncJob" (
    "id"                TEXT         NOT NULL,
    "key"               TEXT         NOT NULL,
    "name"              TEXT         NOT NULL,
    "description"       TEXT,
    "config"            TEXT         NOT NULL DEFAULT '{}',
    "isEnabled"         BOOLEAN      NOT NULL DEFAULT true,
    "scheduleEnabled"   BOOLEAN      NOT NULL DEFAULT false,
    "scheduleCron"      TEXT,
    "scheduleNextRunAt" TIMESTAMP(3),
    "lastRunAt"         TIMESTAMP(3),
    "lastStatus"        TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncJob_key_key" ON "SyncJob"("key");
CREATE INDEX "SyncJob_scheduleEnabled_scheduleNextRunAt_idx"
    ON "SyncJob"("scheduleEnabled", "scheduleNextRunAt");

-- ── SyncJobRun ────────────────────────────────────────────────
CREATE TABLE "SyncJobRun" (
    "id"           TEXT         NOT NULL,
    "jobId"        TEXT         NOT NULL,
    "triggerType"  TEXT         NOT NULL DEFAULT 'manual',
    "triggeredBy"  TEXT,
    "status"       TEXT         NOT NULL DEFAULT 'running',
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt"   TIMESTAMP(3),
    "durationMs"   INTEGER,
    "itemsTotal"   INTEGER,
    "itemsSuccess" INTEGER,
    "itemsFailed"  INTEGER,
    "source"       TEXT,
    "niche"        TEXT,
    "summary"      TEXT,
    "errors"       TEXT,
    "meta"         TEXT,
    CONSTRAINT "SyncJobRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncJobRun_jobId_startedAt_idx" ON "SyncJobRun"("jobId", "startedAt" DESC);
CREATE INDEX "SyncJobRun_startedAt_idx"        ON "SyncJobRun"("startedAt" DESC);

ALTER TABLE "SyncJobRun"
    ADD CONSTRAINT "SyncJobRun_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Seed: Platform ───────────────────────────────────────────
INSERT INTO "Platform" ("id", "name", "baseUrl", "isActive") VALUES
    ('shopee', 'Shopee',      'https://shopee.vn',           true),
    ('lazada', 'Lazada',      'https://www.lazada.vn',       true),
    ('tiki',   'Tiki',        'https://tiki.vn',             true),
    ('tiktok', 'TikTok Shop', 'https://www.tiktok.com/shop', false);
