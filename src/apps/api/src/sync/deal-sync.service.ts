import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { ShopeeAffiliateClient } from "../affiliate/shopee/client";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types";
import { LazadaAdapter } from "../platforms/lazada/lazada.adapter";
import type { NormalizedProduct } from "../platforms/platform.adapter";
import { AppLogService } from "../shared/app-log.service";
import type { Trigger } from "../shared/app-log.service";
import { BotSafeFetcher } from "../shared/bot-safe-fetcher";
import { ScraperSyncService } from "../scraper/scraper-sync.service";

interface NicheConfig {
  id: string;
  name: string;
  status: string;
  shopee?: { keyword_seeds: string[] };
}

interface NicheIntegration {
  enabled: boolean;
  atEnabled: boolean;
  directEnabled: boolean;
  directFallback: boolean;
  campaignId: string | null;
}

interface FetchedProduct {
  externalId: string;
  source: "shopee" | "accesstrade" | "tiki" | "lazada" | "cellphones";
  name: string;
  imageUrl: string;
  shopUrl: string;
  affiliateUrl: string;
  currentPrice: number;
  originalPrice: number | null;
  discountPct?: number; // provided directly by source API (e.g. Tiki discount_rate)
  commissionRate: number;
  rating: number | null;
}

import type { AffiliateStrategy, SyncSourceConfig } from "./sync.constants"

export interface SourceCount { fetched: number; skipped: number }

interface SyncReport {
  niche: string;
  fetched: number;
  priceChanges: number;
  newDeals: number;
  skipped: number;
  durationMs: number;
  bySource: Record<string, SourceCount>;
}

const PRICE_HISTORY_RETENTION_DAYS = 90;
const SRC = "deal-sync";
const AT_OFFERS_API = "https://api.accesstrade.vn/v1/offers";

// ── Lazada constants ─────────────────────────────────────────────────────────
const LAZADA_DEFAULT_PAGE_SIZE = 40;
const LAZADA_DEFAULT_MAX_KEYWORDS = 5;
const LAZADA_INTER_KEYWORD_DELAY_MS = 1500;

// ── Shopee scrape constants ──────────────────────────────────────────────────
// Internal JSON API — Shopee website frontend tự gọi
const SHOPEE_SEARCH_API = "https://shopee.vn/api/v4/search/search_items";
// Cookie warm-up — seed SPC_F + csrftoken mà không cần login (pattern từ akherlan/onlineshop)
const SHOPEE_WARMUP_URL = "https://shopee.vn/api/v4/pages/is_short_url/";
const SHOPEE_AN_REDIR_BASE = "https://s.shopee.vn/an_redir";
const SHOPEE_CDN_BASE = "https://cf.shopee.vn/file";
const SHOPEE_PRODUCT_BASE = "https://shopee.vn";
// Cookie session TTL — 25 phút (SPC_F cookie expires ~30 phút)
const SHOPEE_SESSION_TTL_MS = 25 * 60 * 1000;
// Rotate UA để tránh fingerprinting
const SHOPEE_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
];

interface ShopeeScrapedItem {
  itemId: string;
  shopId: string;
  name: string;
  imageUrl: string;
  productUrl: string;
  price: number;
  originalPrice: number | null;
  rating: number | null;
}

function toBrandSlug(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
const TIKI_SEARCH_API = "https://tiki.vn/api/v2/products";
const TIKI_PRODUCT_BASE = "https://tiki.vn";

const CPS_GRAPHQL_URL = "https://api.cellphones.com.vn/v2/graphql/query";
const CPS_PRODUCT_BASE = "https://cellphones.com.vn";
const CPS_IMAGE_CDN = "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product";
const CPS_DEFAULT_PROVINCE_ID = 30; // HCM city

// Tiki category IDs được cấu hình trong SyncSource (slug="tiki") config.categoryIds.
// Key = niche slug, value = mảng category ID Tiki.
// Niches không có entry → keyword search tự động.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// UA pool paired with matching Sec-CH-UA hints — rotate per-batch to vary fingerprint
const TIKI_UA_POOL: Array<{ ua: string; chUA: string; platform: string }> = [
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    chUA: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    platform: '"Windows"',
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    chUA: '"Google Chrome";v="124", "Chromium";v="124", "Not.A/Brand";v="24"',
    platform: '"macOS"',
  },
  {
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    chUA: '"Microsoft Edge";v="126", "Chromium";v="126", "Not.A/Brand";v="24"',
    platform: '"Windows"',
  },
  {
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    chUA: '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    platform: '"macOS"',
  },
];

function buildTikiHeaders(uaIndex: number): Record<string, string> {
  const profile = TIKI_UA_POOL[uaIndex % TIKI_UA_POOL.length];
  return {
    "User-Agent": profile.ua,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://tiki.vn/",
    "Origin": "https://tiki.vn",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Sec-CH-UA": profile.chUA,
    "Sec-CH-UA-Mobile": "?0",
    "Sec-CH-UA-Platform": profile.platform,
  };
}

export interface SyncStatusPayload {
  running: boolean;
  completedAt: Date | null;
  result: {
    niches: number; fetched: number; priceChanges: number;
    newDeals: number; skipped: number; durationMs: number;
    bySource: Record<string, SourceCount>;
  } | null;
}

@Injectable()
export class DealSyncService {
  private readonly log = new Logger(DealSyncService.name);
  private readonly prisma = new PrismaClient();
  // Campaign list cache — refresh cùng chu kỳ sync (4h)
  private atCampaignsCache: { campaigns: AccessTradeCampaign[]; fetchedAt: number } | null = null;
  // UA rotation index — incremented before retry pass so blocked niches use different fingerprint
  private tikiUaIndex = 0;
  // Set to true khi phát hiện IP bị Tiki ban toàn bộ trong một run
  private tikiIpBanned = false;
  private readonly AT_CAMPAIGNS_CACHE_TTL = 4 * 60 * 60 * 1000;
  // Concurrency guard + status snapshot for web polling
  private syncRunning = false;
  readonly syncStatus: SyncStatusPayload = { running: false, completedAt: null, result: null };

  // Shopee session — cookie warm-up cache (SPC_F + csrftoken)
  private shopeeSession: { cookies: string; csrfToken: string; expiresAt: number } | null = null;
  // Fast-fail: khi phát hiện IP block, bỏ qua toàn bộ Shopee sync trong 1 giờ
  private shopeeBlockedUntil = 0;

  constructor(
    private readonly cfg: ConfigService,
    private readonly shopee: ShopeeAffiliateClient,
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly lazada: LazadaAdapter,
    private readonly appLog: AppLogService,
    private readonly scraperSync: ScraperSyncService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync"); }

  // Returns all enabled SyncSource slugs from DB — used by controller for validation
  async getValidSourceSlugs(): Promise<string[]> {
    const rows = await this.prisma.syncSource.findMany({
      where: { enabled: true },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  }

  // Public method called by SyncController (manual / web-scheduled trigger)
  async triggerSync(nicheId: string | undefined, source: string, trigger: Trigger = "manual"): Promise<{
    niches: number;
    fetched: number;
    priceChanges: number;
    newDeals: number;
    skipped: number;
    durationMs: number;
    bySource: Record<string, SourceCount>;
  }> {
    if (this.syncRunning) {
      this.log.warn("triggerSync: already running — skipping concurrent call");
      return { niches: 0, fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: 0, bySource: {} };
    }
    this.syncRunning = true;
    this.syncStatus.running = true;
    this.syncStatus.result = null;

    try {
    // Load SyncSource config from DB (graceful — not all slugs have a DB record yet)
    const dbSource = await this.prisma.syncSource.findFirst({ where: { slug: source } });
    const sourceConfig: SyncSourceConfig = dbSource?.config ? (() => { try { return JSON.parse(dbSource.config as string) } catch { return {} } })() : {};
    const sourceName = dbSource?.name ?? source;

    this.log.log(`[${source}] Khởi tạo đồng bộ — ${sourceName}`);
    await this.slog.info(`[${source}] Khởi tạo đồng bộ nguồn "${sourceName}"`, SRC, { source }, trigger);

    // Scraper sources: campaign/strategy resolution và niche loop do ScraperSyncService đảm nhận
    let atCampaign: import("../affiliate/accesstrade/types").AccessTradeCampaign | null = null;
    let strategy: import("./sync.constants").AffiliateStrategy = "direct";

    if (sourceConfig.type !== "scraper") {
      // Determine AT campaign + affiliate strategy
      const campaignResult = await this.findCampaignForSource(source, sourceConfig.atCampaignId);
      atCampaign = campaignResult.campaign;
      const campaignType = campaignResult.campaignType;
      if (atCampaign) {
        const typeLabel = campaignType === "tracking" ? "tracking (wrap URL)" : "product feed (không wrap URL)";
        this.log.log(`[${source}] AT campaign: "${atCampaign.name}" — loại: ${typeLabel}`);
        await this.slog.info(
          `[${source}] AT campaign: "${atCampaign.name}" — loại: ${typeLabel}`,
          SRC, { campaignId: atCampaign.id, campaignType },
        );
      } else {
        this.log.log(`[${source}] Không tìm thấy AT campaign — sẽ dùng URL trực tiếp`);
        await this.slog.info(`[${source}] Không tìm thấy AT campaign`, SRC, {});
      }
      strategy = this.resolveAffiliateStrategy(source, sourceConfig, campaignType);
      const strategyLabel: Record<string, string> = {
        direct: "direct (affiliate API riêng của platform)",
        at_feed: "at_feed (lấy sản phẩm từ AT product feed)",
        at_wrap: "at_wrap (fetch từ platform + bọc AT tracking link)",
      };
      this.log.log(`[${source}] Chiến lược: ${strategy} — ${strategyLabel[strategy] ?? strategy}`);
      await this.slog.info(
        `[${source}] Chiến lược affiliate: ${strategyLabel[strategy] ?? strategy}`,
        SRC, { strategy, campaign: atCampaign?.name ?? null }, trigger,
      );
    }

    const allNiches = await this.loadActiveNiches();
    const targets = (nicheId && nicheId !== "all")
      ? allNiches.filter((n) => n.id === nicheId)
      : allNiches;

    if (sourceConfig.type !== "scraper") {
      this.log.log(`[${source}] ${targets.length} ngách sẽ được đồng bộ`);
      await this.slog.info(`[${source}] Bắt đầu đồng bộ theo ngách`, SRC, { niches: targets.map((n) => n.id), source, strategy }, trigger);
    }

    const t0 = Date.now();
    const reports: SyncReport[] = [];
    this.tikiIpBanned = false; // reset mỗi run

    const runNiche = async (niche: NicheConfig): Promise<SyncReport> =>
      this.syncNiche(niche, source, strategy, atCampaign).catch(async (e): Promise<SyncReport> => {
        this.log.error(`Sync failed for niche "${niche.id}": ${e.message}`);
        await this.slog.error(`Sync thất bại cho ngách "${niche.name}"`, SRC, {
          niche: niche.id, error: e.message, stack: e.stack?.slice(0, 500),
        }, trigger);
        return { niche: niche.id, fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: 0, bySource: {} };
      });

    const isTikiSync = source === "tiki";
    if (sourceConfig.type === "scraper") {
      // Scraper sources có category→niche mapping riêng trong ScraperSyncService, không chạy niche loop
      this.log.log(`[${source}] Scraper source — bỏ qua niche loop`);
    } else if (isTikiSync && targets.length > 1) {
      // Paged cursor mode: mỗi run chỉ lấy 1 page/ngách → request rate thấp, không cần batch pause.
      // Trang tiếp theo được lưu trong SyncSource.config.pageState, cập nhật sau mỗi run.
      const cfg = await this.readTikiSyncConfig();
      const interNicheMs = cfg.tikiInterNicheDelaySec * 1_000;

      // Niche resume cursor: nếu run trước bị gián đoạn (IP ban), lần này bắt đầu từ
      // niche đầu tiên bị fail → đảm bảo mọi ngách đều được sync dần qua các run.
      let rotatedTargets = [...targets];
      if (cfg.nicheResumeFromId) {
        const resumeIdx = rotatedTargets.findIndex((n) => n.id === cfg.nicheResumeFromId);
        if (resumeIdx > 0) {
          rotatedTargets = [...rotatedTargets.slice(resumeIdx), ...rotatedTargets.slice(0, resumeIdx)];
          this.log.log(`[Tiki] Resuming from niche "${cfg.nicheResumeFromId}" (rotated ${resumeIdx} position(s))`);
        }
      }

      this.log.log(`[Tiki] Paged sync: ${rotatedTargets.length} niches, inter-niche=${cfg.tikiInterNicheDelaySec}s`);

      // Abort chỉ khi 2 ngách liên tiếp đều bị block hoàn toàn — tránh false-positive do
      // 1 niche đơn lẻ bị rate-limit tạm thời khiến skip các niche sau.
      let consecutiveBlocked = 0;
      let firstFailedNicheId: string | null = null;

      for (let i = 0; i < rotatedTargets.length; i++) {
        if (i > 0) {
          if (consecutiveBlocked >= 2) {
            const remaining = rotatedTargets.length - i;
            if (!firstFailedNicheId) firstFailedNicheId = rotatedTargets[i].id;
            this.log.error(`[Tiki] IP ban confirmed (2 consecutive blocked) — aborting ${remaining} remaining niche(s).`);
            await this.slog.error(`[Tiki] IP bị ban (2 ngách liên tiếp) — bỏ qua ${remaining} ngách còn lại`, SRC, { remaining }, trigger);
            break;
          }
          await sleep(interNicheMs);
          this.tikiUaIndex++; // rotate UA fingerprint mỗi ngách
        }
        this.tikiIpBanned = false; // reset trước mỗi niche để đo per-niche
        reports.push(await runNiche(rotatedTargets[i]));
        if (this.tikiIpBanned) {
          consecutiveBlocked++;
          if (!firstFailedNicheId) firstFailedNicheId = rotatedTargets[i].id;
        } else {
          consecutiveBlocked = 0;
        }
      }

      // Lưu cursor để run tiếp theo biết bắt đầu từ đâu
      await this.saveTikiNicheResumeFrom(firstFailedNicheId);
      if (firstFailedNicheId) {
        this.log.log(`[Tiki] Next run will resume from niche "${firstFailedNicheId}"`);
      } else {
        this.log.log(`[Tiki] All niches completed — resume cursor cleared`);
      }
    } else {
      for (const niche of targets) {
        reports.push(await runNiche(niche));
      }
    }

    await this.pruneOldPriceHistory();

    if (sourceConfig.type === "scraper") {
      this.log.log(`[${source}] Chạy scraper sync...`);
      const scraperResult = await this.scraperSync.syncAll(trigger);
      if (scraperResult.sources > 0) {
        reports.push({
          niche: "__scraper__",
          fetched: scraperResult.fetched,
          priceChanges: 0,
          newDeals: scraperResult.newDeals,
          skipped: scraperResult.skipped,
          durationMs: scraperResult.durationMs,
          bySource: { scraper: { fetched: scraperResult.fetched, skipped: scraperResult.skipped } },
        });
      }
    }

    // Aggregate totals + merge bySource across all niches
    const bySource: Record<string, SourceCount> = {};
    const total = reports.reduce(
      (acc, r) => {
        for (const [src, cnt] of Object.entries(r.bySource)) {
          bySource[src] = {
            fetched: (bySource[src]?.fetched ?? 0) + cnt.fetched,
            skipped: (bySource[src]?.skipped ?? 0) + cnt.skipped,
          };
        }
        return {
          fetched:      acc.fetched      + r.fetched,
          priceChanges: acc.priceChanges + r.priceChanges,
          newDeals:     acc.newDeals     + r.newDeals,
          skipped:      acc.skipped      + r.skipped,
        };
      },
      { fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0 },
    );

    this.log.log(`Sync complete — ${total.fetched} products, ${total.priceChanges} price changes, ${total.newDeals} new deals`);
    await this.slog.info(`Hoàn tất đồng bộ sản phẩm`, SRC, {
      niches: targets.length, source, ...total, bySource, perNiche: reports,
    }, trigger);

    const finalResult = { niches: targets.length, ...total, bySource, durationMs: Date.now() - t0 };
    this.syncStatus.result = finalResult;
    this.syncStatus.completedAt = new Date();
    return finalResult;
    } finally {
      this.syncRunning = false;
      this.syncStatus.running = false;
    }
  }

  async syncNiche(niche: NicheConfig, source: string, strategy?: AffiliateStrategy, atCampaign?: AccessTradeCampaign | null): Promise<SyncReport> {
    const start = Date.now();
    this.log.log(`[${source}] Ngách: ${niche.name} — bắt đầu`);

    const runSource = (s: string) => source === s;

    const [tikiIntegration, lazadaIntegration, cellphonesIntegration] = await Promise.all([
      runSource("tiki")        ? this.loadNicheIntegration(niche.id, "tiki")        : Promise.resolve(null),
      runSource("lazada")      ? this.loadNicheIntegration(niche.id, "lazada")      : Promise.resolve(null),
      runSource("cellphones")  ? this.loadNicheIntegration(niche.id, "cellphones")  : Promise.resolve(null),
    ]);

    // at_feed: lấy sản phẩm từ AT product feed thay vì fetch trực tiếp từ platform
    const atFeedProducts = strategy === "at_feed"
      ? await this.fetchAtFeedForNiche(niche, source)
      : [];
    if (atFeedProducts.length > 0) {
      this.log.log(`[${source}] Ngách: ${niche.name} — AT product feed: ${atFeedProducts.length} sản phẩm`);
    }

    const [shopeeProducts, tikiProducts, lazadaProducts, cellphonesProducts] = await Promise.all([
      runSource("shopee")      ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Shopee...`),      this.fetchShopeeProducts(niche))         : Promise.resolve([]),
      runSource("tiki")        ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Tiki...`),        this.fetchTikiProducts(niche, tikiIntegration))  : Promise.resolve([]),
      runSource("lazada")      ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Lazada...`),      this.fetchLazadaProducts(niche, lazadaIntegration)) : Promise.resolve([]),
      runSource("cellphones") && cellphonesIntegration?.enabled ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy CellphoneS...`), this.fetchCellphonesProducts(niche, cellphonesIntegration, atCampaign ?? null)) : Promise.resolve([]),
    ]);

    const bySourceRaw: Record<string, FetchedProduct[]> = {
      shopee:      shopeeProducts,
      accesstrade: atFeedProducts,
      tiki:        tikiProducts,
      lazada:      lazadaProducts,
      cellphones:  cellphonesProducts,
    };
    const fetched = [...shopeeProducts, ...atFeedProducts, ...tikiProducts, ...lazadaProducts, ...cellphonesProducts];
    const lastPriceMap = await this.fetchLastRecordedPrices(niche.id);

    const priceHistoryBatch: { productId: string; price: number }[] = [];
    let newDeals = 0;
    let skipped = 0;

    for (const p of fetched) {
      const product = await this.upsertProduct(p, niche.id, atCampaign?.logoUrl ?? null, atCampaign?.brandId ?? null, atCampaign?.id ?? null);

      const lastPrice = lastPriceMap.get(product.id);
      if (lastPrice !== p.currentPrice) {
        priceHistoryBatch.push({ productId: product.id, price: p.currentPrice });
      }

      // Use discount_rate when > 0; fall back to price diff when discount_rate is 0/null
      const discountPct = (p.discountPct != null && p.discountPct > 0)
        ? p.discountPct
        : (p.originalPrice && p.originalPrice > p.currentPrice
            ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
            : 0);

      // Always persist discountPct so UI shows correct value (0 = no discount info)
      await this.prisma.product.update({
        where: { id: product.id },
        data: {
          discountPct: discountPct > 0 ? discountPct : null,
          isFeatured: discountPct >= 40,
        },
      });
      newDeals++;
    }

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({ data: priceHistoryBatch });
    }

    // Build per-source counts (fetched before filter, skipped = filtered out)
    const bySource: Record<string, SourceCount> = {};
    for (const [src, products] of Object.entries(bySourceRaw)) {
      if (products.length === 0 && source !== src) continue;
      bySource[src] = { fetched: products.length, skipped: 0 };
    }

    const report: SyncReport = {
      niche: niche.id,
      fetched: fetched.length,
      priceChanges: priceHistoryBatch.length,
      newDeals,
      skipped,
      durationMs: Date.now() - start,
      bySource,
    };

    const srcSummary = Object.entries(bySource)
      .filter(([, c]) => c.fetched > 0)
      .map(([s, c]) => `${s}:${c.fetched}`)
      .join(" ")
    this.log.log(`[${source}] Ngách: ${niche.name} — hoàn tất: ${srcSummary || "0 sản phẩm"} | newDeals=${report.newDeals} priceChanges=${report.priceChanges} (${report.durationMs}ms)`);
    if (report.fetched > 0) {
      await this.slog.info(`Đồng bộ ngách "${niche.name}" hoàn tất`, SRC, report);
    }
    return report;
  }

  private async fetchLastRecordedPrices(categoryId: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ productId: string; price: number }[]>`
      SELECT DISTINCT ON (ph."productId") ph."productId", ph.price
      FROM "PriceHistory" ph
      INNER JOIN "Product" p ON p.id = ph."productId"
      WHERE p."categoryId" = ${categoryId}
      ORDER BY ph."productId", ph."recordedAt" DESC
    `;
    return new Map(rows.map((r) => [r.productId, r.price]));
  }

  private async readSourceSettings(): Promise<{ shopeeMode: "affiliate" | "at"; lazadaMode: "affiliate" | "at" }> {
    const defaults = { shopeeMode: "affiliate" as const, lazadaMode: "affiliate" as const };
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key: "source_settings" } });
      if (!row) return defaults;
      const parsed = JSON.parse(row.value);
      return {
        shopeeMode: parsed.shopeeMode === "at" ? "at" : "affiliate",
        lazadaMode: parsed.lazadaMode === "at" ? "at" : "affiliate",
      };
    } catch {
      return defaults;
    }
  }

  private async readLazadaConfig(): Promise<{
    syncMode: "api" | "at";
    pageSize: number;
    maxKeywords: number;
    keywords: Record<string, string[]>;
  }> {
    const defaults = {
      syncMode: "api" as const,
      pageSize: LAZADA_DEFAULT_PAGE_SIZE,
      maxKeywords: LAZADA_DEFAULT_MAX_KEYWORDS,
      keywords: {} as Record<string, string[]>,
    };
    try {
      const row = await this.prisma.syncSource.findUnique({ where: { slug: "lazada" } });
      if (!row?.config) return defaults;
      const cfg = JSON.parse(row.config as string);
      return {
        syncMode: cfg.lazadaSyncMode === "at" ? "at" : "api",
        pageSize: Number(cfg.lazadaPageSize) || LAZADA_DEFAULT_PAGE_SIZE,
        maxKeywords: Number(cfg.lazadaMaxKeywords) || LAZADA_DEFAULT_MAX_KEYWORDS,
        keywords: cfg.lazadaKeywords || {},
      };
    } catch {
      return defaults;
    }
  }

  private async readTikiSyncConfig(): Promise<{
    tikiBatchSize: number;
    tikiBatchPauseMin: number;
    tikiInterNicheDelaySec: number;
    tikiMaxPages: number;
    categoryIds: Record<string, number[]>;
    pageState: Record<string, { currentPage: number; totalPages: number }>;
    nicheResumeFromId: string | null;
  }> {
    const defaults = {
      tikiBatchSize: 2,
      tikiBatchPauseMin: 15,
      tikiInterNicheDelaySec: 15,
      tikiMaxPages: 2,
      categoryIds: {} as Record<string, number[]>,
      pageState: {} as Record<string, { currentPage: number; totalPages: number }>,
      nicheResumeFromId: null as string | null,
    };
    try {
      const row = await this.prisma.syncSource.findUnique({ where: { slug: "tiki" } });
      if (!row) return defaults;
      return { ...defaults, ...JSON.parse(row.config) };
    } catch {
      return defaults;
    }
  }

  private async saveTikiPageState(
    pageState: Record<string, { currentPage: number; totalPages: number }>,
  ): Promise<void> {
    try {
      const row = await this.prisma.syncSource.findUnique({ where: { slug: "tiki" } });
      if (!row) return;
      const config = JSON.parse(row.config as string);
      config.pageState = pageState;
      await this.prisma.syncSource.update({
        where: { slug: "tiki" },
        data: { config: JSON.stringify(config) },
      });
    } catch (e: any) {
      this.log.warn(`[Tiki] Failed to save page state: ${e.message}`);
    }
  }

  private async saveTikiNicheResumeFrom(nicheId: string | null): Promise<void> {
    try {
      const row = await this.prisma.syncSource.findUnique({ where: { slug: "tiki" } });
      if (!row) return;
      const config = JSON.parse(row.config as string);
      if (nicheId === null) {
        delete config.nicheResumeFromId;
      } else {
        config.nicheResumeFromId = nicheId;
      }
      await this.prisma.syncSource.update({
        where: { slug: "tiki" },
        data: { config: JSON.stringify(config) },
      });
    } catch (e: any) {
      this.log.warn(`[Tiki] Failed to save niche resume point: ${e.message}`);
    }
  }

  private async pruneOldPriceHistory() {
    const cutoff = new Date(Date.now() - PRICE_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.priceHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.log.log(`Pruned ${count} price history records older than ${PRICE_HISTORY_RETENTION_DAYS} days`);
      await this.slog.info(`Dọn lịch sử giá cũ`, SRC, { deleted: count, retentionDays: PRICE_HISTORY_RETENTION_DAYS });
    }
  }

  // ── Shopee config reader ─────────────────────────────────────────────────

  private async readShopeeConfig(): Promise<{
    syncMode: "api" | "scrape";
    affiliateId: string;
    scrapeMaxPages: number;
    scrapeDelayMs: number;
    keywords: Record<string, string[]>;
  }> {
    const defaults = {
      syncMode: "api" as const,
      affiliateId: this.cfg.get<string>("SHOPEE_AFFILIATE_ID") ?? "",
      scrapeMaxPages: 2,
      scrapeDelayMs: 2000,
      keywords: {} as Record<string, string[]>,
    };
    try {
      const row = await this.prisma.syncSource.findUnique({ where: { slug: "shopee" } });
      if (!row) return defaults;
      const cfg = JSON.parse(row.config as string);
      return {
        syncMode: cfg.syncMode === "scrape" ? "scrape" : "api",
        affiliateId: cfg.affiliateId ?? this.cfg.get<string>("SHOPEE_AFFILIATE_ID") ?? "",
        scrapeMaxPages: cfg.scrapeMaxPages ?? 2,
        scrapeDelayMs: cfg.scrapeDelayMs ?? 2000,
        keywords: cfg.keywords ?? {},
      };
    } catch {
      return defaults;
    }
  }

  // ── Shopee dispatcher ─────────────────────────────────────────────────────

  private async fetchShopeeProducts(niche: NicheConfig): Promise<FetchedProduct[]> {
    const config = await this.readShopeeConfig();
    if (config.syncMode === "scrape") {
      if (!config.affiliateId) {
        this.log.warn(`[Shopee] syncMode=scrape nhưng affiliateId chưa được set — bỏ qua sync`);
        await this.slog.warn(`[Shopee] Thiếu affiliateId cho scrape mode`, SRC, { niche: niche.id });
        return [];
      }
      // Fast-fail: nếu đã biết IP bị block trong session này, bỏ qua ngay
      if (Date.now() < this.shopeeBlockedUntil) {
        this.log.warn(`[Shopee] IP đang bị block — bỏ qua ngách "${niche.name}" (cần SHOPEE_PROXY_URL)`);
        return [];
      }
      this.log.log(`[Shopee] Ngách: ${niche.name} — mode=scrape (JSON API + an_redir)`);
      return this.fetchShopeeViaScrape(niche, config);
    }
    this.log.log(`[Shopee] Ngách: ${niche.name} — mode=api (Affiliate Open API)`);
    return this.fetchShopeeViaApi(niche);
  }

  // ── Shopee mode=api (cũ — cần SHOPEE_AFFILIATE_APP_ID + APP_SECRET) ────────

  private async fetchShopeeViaApi(niche: NicheConfig): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];
    const keywords = niche.shopee?.keyword_seeds ?? [];

    for (const keyword of keywords) {
      try {
        const { nodes } = await this.shopee.productSearch({ keyword, pageSize: 20, sort: "SALES_DESC" });

        for (const node of nodes) {
          let affiliateUrl = node.productLink;
          try {
            const { shortLink } = await this.shopee.generateShortLink({ originUrl: node.productLink, subIds: [niche.id, "web"] });
            affiliateUrl = shortLink;
          } catch { /* fallback to original link */ }

          const currentPrice = Math.round(node.priceMin);
          const originalPrice = node.priceMax > node.priceMin
            ? Math.round(node.priceMax)
            : null;
          results.push({
            externalId: String(node.itemId),
            source: "shopee",
            name: node.productName,
            imageUrl: node.imageUrl ?? "",
            shopUrl: node.productLink,
            affiliateUrl,
            currentPrice,
            originalPrice,
            commissionRate: Number(node.commissionRate),
            rating: null,
          });
        }
      } catch (e: any) {
        this.log.warn(`[Shopee API] keyword "${keyword}" thất bại: ${e.message}`);
        await this.slog.warn(`Shopee API search thất bại`, SRC, {
          niche: niche.id, keyword, error: e.message, code: (e as any).code,
        });
      }
    }

    return results;
  }

  // ── Shopee mode=scrape (Googlebot + an_redir) ─────────────────────────────

  private async fetchShopeeViaScrape(
    niche: NicheConfig,
    config: { affiliateId: string; scrapeMaxPages: number; scrapeDelayMs: number; keywords: Record<string, string[]> },
  ): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];
    const keywords = config.keywords[niche.id] ?? niche.shopee?.keyword_seeds ?? [niche.name];
    let ipBlocked = false;

    for (let ki = 0; ki < keywords.length; ki++) {
      if (ipBlocked) break;
      const keyword = keywords[ki];
      if (ki > 0) await sleep(config.scrapeDelayMs);

      for (let page = 0; page < config.scrapeMaxPages; page++) {
        if (page > 0) await sleep(config.scrapeDelayMs);
        try {
          const items = await this.scrapeShopeeSearchPage(keyword, page);
          if (items.length === 0) break;

          for (const item of items) {
            results.push({
              externalId: `${item.shopId}_${item.itemId}`,
              source: "shopee",
              name: item.name.slice(0, 255),
              imageUrl: item.imageUrl,
              shopUrl: item.productUrl,
              affiliateUrl: this.buildShopeeAffiliateUrl(item.productUrl, config.affiliateId),
              currentPrice: item.price,
              originalPrice: item.originalPrice,
              commissionRate: 0,
              rating: item.rating,
            });
          }

          this.log.log(`[Shopee scrape] kw="${keyword}" page=${page}: ${items.length} sản phẩm`);
          if (items.length < 20) break;
        } catch (e: any) {
          const msg: string = e.message ?? "";
          // Khi bị block IP: set flag, dừng ngay — không thử thêm keywords hay pages
          if (msg.includes("403") && !this.cfg.get("SHOPEE_PROXY_URL")) {
            this.shopeeBlockedUntil = Date.now() + 60 * 60 * 1000; // block 1 tiếng
            this.log.warn(`[Shopee] IP bị block — dừng sync Shopee. Cần SHOPEE_PROXY_URL để tiếp tục`);
            await this.slog.warn(`[Shopee] IP bị block — dừng toàn bộ sync Shopee`, SRC, {
              niche: niche.id, hint: "Set SHOPEE_PROXY_URL (residential proxy) trong .env",
            });
            ipBlocked = true;
          } else {
            this.log.warn(`[Shopee scrape] kw="${keyword}" page=${page} lỗi: ${msg}`);
            await this.slog.warn(`Shopee scrape thất bại`, SRC, { niche: niche.id, keyword, page, error: msg });
          }
          break;
        }
      }
    }

    return results;
  }

  private buildShopeeAffiliateUrl(productUrl: string, affiliateId: string): string {
    return `${SHOPEE_AN_REDIR_BASE}?origin_link=${encodeURIComponent(productUrl)}&affiliate_id=${affiliateId}`;
  }

  // Cookie warm-up: seed SPC_F + csrftoken từ Shopee mà không cần login
  // Pattern từ github.com/akherlan/onlineshop — cookies này đủ cho public search endpoints
  private async getShopeeCookies(): Promise<{ cookies: string; csrfToken: string }> {
    if (this.shopeeSession && Date.now() < this.shopeeSession.expiresAt) {
      return this.shopeeSession;
    }

    const proxyUrl = this.cfg.get<string>("SHOPEE_PROXY_URL");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dispatcher = proxyUrl ? new (require("undici").ProxyAgent)(proxyUrl) : undefined;

    try {
      const res = await fetch(SHOPEE_WARMUP_URL, {
        method: "GET",
        // @ts-expect-error undici dispatcher
        dispatcher,
        headers: {
          "User-Agent": SHOPEE_UAS[0],
          "Accept": "application/json",
          "Referer": "https://shopee.vn/",
        },
        signal: AbortSignal.timeout(10_000),
      });

      // Collect all Set-Cookie headers
      const setCookies: string[] = [];
      res.headers.forEach((value, name) => {
        if (name.toLowerCase() === "set-cookie") setCookies.push(value);
      });
      // Node 18+ fetch exposes raw headers differently — try getSetCookie too
      const rawSetCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? setCookies;

      const cookieStr = rawSetCookie.map((c) => c.split(";")[0]).join("; ");
      const csrfToken = rawSetCookie
        .map((c) => c.split(";")[0])
        .find((c) => c.startsWith("csrftoken="))
        ?.replace("csrftoken=", "") ?? "";

      this.shopeeSession = { cookies: cookieStr, csrfToken, expiresAt: Date.now() + SHOPEE_SESSION_TTL_MS };
      this.log.log(`[Shopee] Session seed OK — SPC_F=${cookieStr.includes("SPC_F") ? "✓" : "✗"} csrftoken=${csrfToken ? "✓" : "✗"}`);
      return this.shopeeSession;
    } catch (e: any) {
      this.log.warn(`[Shopee] Cookie warm-up thất bại: ${e.message} — tiếp tục không có cookie`);
      return { cookies: "", csrfToken: "" };
    }
  }

  // Gọi Shopee internal JSON API (endpoint website frontend dùng)
  // Shopee lưu giá dưới dạng micro-VND (price × 100000)
  // Yêu cầu SHOPEE_PROXY_URL khi deploy trên server (Shopee block datacenter IP)
  private async scrapeShopeeSearchPage(keyword: string, page: number): Promise<ShopeeScrapedItem[]> {
    const newest = page * 20;
    const ua = SHOPEE_UAS[page % SHOPEE_UAS.length];
    const referer = `https://shopee.vn/search?keyword=${encodeURIComponent(keyword)}&order=desc&page=${page}&rating_filter=0&scenario=PAGE_GLOBAL_SEARCH&sortBy=relevancy`;

    const { cookies, csrfToken } = await this.getShopeeCookies();

    const url = new URL(SHOPEE_SEARCH_API);
    url.searchParams.set("by", "relevancy");
    url.searchParams.set("keyword", keyword);
    url.searchParams.set("limit", "20");
    url.searchParams.set("newest", String(newest));
    url.searchParams.set("order", "desc");
    url.searchParams.set("page_type", "search");
    url.searchParams.set("scenario", "PAGE_GLOBAL_SEARCH");
    url.searchParams.set("version", "2");

    // Route qua proxy nếu có — cần trên server vì Shopee block datacenter IP
    const proxyUrl = this.cfg.get<string>("SHOPEE_PROXY_URL");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dispatcher = proxyUrl ? new (require("undici").ProxyAgent)(proxyUrl) : undefined;

    const headers: Record<string, string> = {
      "User-Agent": ua,
      "Accept": "application/json",
      "Accept-Language": "vi-VN,vi;q=0.9",
      "Referer": referer,
      "x-api-source": "pc",
      "x-shopee-language": "vi",
      "x-requested-with": "XMLHttpRequest",
    };
    if (cookies) headers["Cookie"] = cookies;
    if (csrfToken) headers["X-CSRFToken"] = csrfToken;

    const res = await fetch(url.toString(), {
      // @ts-expect-error undici dispatcher — Node 18+ built-in fetch hỗ trợ
      dispatcher,
      headers,
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      if (res.status === 403 && !proxyUrl) {
        throw new Error(`HTTP 403 — Shopee block datacenter IP. Set SHOPEE_PROXY_URL để dùng residential proxy`);
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const json = await res.json() as Record<string, unknown>;

    // Response: { items: [{ item_basic: {...} }], ... }
    const rawItems = (json.items as unknown[]) ?? [];
    if (rawItems.length === 0) return [];

    return rawItems.flatMap((raw) => {
      const item = ((raw as Record<string, unknown>).item_basic ?? raw) as Record<string, unknown>;
      const parsed = this.normalizeShopeeApiItem(item);
      return parsed ? [parsed] : [];
    });
  }

  private normalizeShopeeApiItem(i: Record<string, unknown>): ShopeeScrapedItem | null {
    try {
      const itemId = String(i.itemid ?? i.item_id ?? "");
      const shopId = String(i.shopid ?? i.shop_id ?? "");
      if (!itemId || !shopId) return null;

      const name = String(i.name ?? "").trim();
      if (!name) return null;

      // Shopee API returns price in micro-VND (price * 100000)
      const rawPrice = Number(i.price ?? i.price_min ?? 0);
      if (rawPrice <= 0) return null;
      const price = Math.round(rawPrice / 100000);

      const rawOriginal = Number(i.price_before_discount ?? 0);
      const originalPrice = rawOriginal > rawPrice
        ? Math.round(rawOriginal / 100000)
        : null;

      const imgPath = String(i.image ?? "");
      const imageUrl = imgPath ? `${SHOPEE_CDN_BASE}/${imgPath}` : "";

      const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
      const productUrl = `${SHOPEE_PRODUCT_BASE}/${nameSlug}-i.${shopId}.${itemId}`;

      const ratingData = i.item_rating as Record<string, unknown> | undefined;
      const rating = ratingData ? (Number(ratingData.rating_star) || null) : null;

      return { itemId, shopId, name, imageUrl, productUrl, price, originalPrice, rating };
    } catch {
      return null;
    }
  }

  private async fetchShopeeWithAtTracking(niche: NicheConfig, campaign: AccessTradeCampaign): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];
    const keywords = niche.shopee?.keyword_seeds ?? [];

    for (const keyword of keywords) {
      try {
        const { nodes } = await this.shopee.productSearch({ keyword, pageSize: 20, sort: "SALES_DESC" });

        for (const node of nodes) {
          let affiliateUrl = node.productLink;
          try {
            const link = await this.accesstrade.createTrackingLink({
              campaignId: campaign.id,
              urls: [node.productLink],
              subIds: { sub1: niche.id, sub2: "shopee-at" },
            });
            affiliateUrl = link.shortLink ?? link.affiliateLink;
          } catch { /* keep original URL */ }

          results.push({
            externalId: String(node.itemId),
            source: "shopee",
            name: node.productName,
            imageUrl: node.imageUrl ?? "",
            shopUrl: node.productLink,
            affiliateUrl,
            currentPrice: Math.round(node.priceMin),
            originalPrice: node.priceMax > node.priceMin ? Math.round(node.priceMax) : null,
            commissionRate: Number(node.commissionRate),
            rating: null,
          });
        }
      } catch (e: any) {
        this.log.warn(`[${niche.name}] Shopee+AT search failed for "${keyword}": ${e.message}`);
      }
    }
    return results;
  }


  private async upsertProduct(
    p: FetchedProduct,
    categoryId: string,
    sourceLogoUrl: string | null = null,
    brandId: string | null = null,
    atCampaignId: string | null = null,
  ) {
    return this.prisma.product.upsert({
      where: { source_externalId: { source: p.source, externalId: p.externalId } },
      update: {
        categoryId,
        price: p.currentPrice,
        originalPrice: p.originalPrice ?? null,
        affiliateUrl: p.affiliateUrl,
        lastSyncedAt: new Date(),
        isSoldOut: false,
        ...(sourceLogoUrl && { sourceLogoUrl }),
        ...(brandId && { brandId }),
        ...(atCampaignId && { atCampaignId }),
      },
      create: {
        source: p.source,
        externalId: p.externalId,
        name: p.name,
        imageUrl: p.imageUrl,
        imageAlt: p.name,
        productUrl: p.shopUrl,
        affiliateUrl: p.affiliateUrl,
        price: p.currentPrice,
        originalPrice: p.originalPrice ?? null,
        commission: Math.round(p.commissionRate),
        rating: p.rating ?? 0,
        categoryId,
        sourceLogoUrl,
        ...(brandId && { brandId }),
        ...(atCampaignId && { atCampaignId }),
      },
    });
  }

  // Tạo AT tracking link cho 1 product URL đơn lẻ (dùng từ admin form).
  // Source slug + atCampaignId lấy từ SyncSource DB — không hardcode.
  // Delegate campaign resolution về findCampaignForSource (logic dùng chung với auto-sync).
  async createAtLinkForProduct(productUrl: string, campaignId?: string): Promise<string> {
    let hostname: string
    try {
      hostname = new URL(productUrl).hostname.replace(/^www\./, "")
    } catch {
      throw new Error("productUrl không hợp lệ")
    }

    // Tìm SyncSource khớp với hostname — tránh hardcode tên platform
    const dbSource = await this.prisma.syncSource.findFirst({
      where: { baseUrl: { contains: hostname } },
      select: { slug: true, config: true },
    })
    const sourceSlug = dbSource?.slug ?? hostname.split(".")[0]

    // campaignId ưu tiên: param > SyncSource.config.atCampaignId > auto-match
    let atCampaignIdOverride = campaignId
    if (!atCampaignIdOverride && dbSource?.config) {
      try {
        const cfg = JSON.parse(dbSource.config) as SyncSourceConfig
        atCampaignIdOverride = cfg.atCampaignId
      } catch { /* ignore malformed config */ }
    }

    const { campaign } = await this.findCampaignForSource(sourceSlug, atCampaignIdOverride)
    if (!campaign) {
      const all = await this.getApprovedCampaigns()
      throw new Error(
        `Không tìm thấy AT campaign cho "${sourceSlug}". Các campaign hiện có: ${all.map((c) => c.name).join(", ") || "không có"}`,
      )
    }

    this.log.log(`[create-at-link] campaign="${campaign.name}" id=${campaign.id} url=${productUrl}`)
    const link = await this.accesstrade.createTrackingLink({
      campaignId: campaign.id,
      urls: [productUrl],
      subIds: { sub1: "manual" },
    })
    return link.shortLink ?? link.affiliateLink
  }

  async getApprovedCampaigns(): Promise<AccessTradeCampaign[]> {
    if (this.atCampaignsCache && Date.now() - this.atCampaignsCache.fetchedAt < this.AT_CAMPAIGNS_CACHE_TTL) {
      return this.atCampaignsCache.campaigns;
    }
    try {
      const campaigns = await this.accesstrade.listCampaigns({ approval: "successful" });
      this.log.log(`AT API: ${campaigns.length} approved campaigns loaded, saved to DB cache`);
      const merchantBrandId = await this.upsertCampaignsToDB(campaigns);
      // Attach brandId so callers can store it on products
      for (const c of campaigns) {
        c.brandId = merchantBrandId.get(c.merchant) ?? null;
      }
      this.atCampaignsCache = { campaigns, fetchedAt: Date.now() };
      void this.scrapeOgImages(campaigns).catch((e: Error) =>
        this.log.warn(`[AT] scrapeOgImages failed: ${e.message}`)
      );
      return campaigns;
    } catch (e: any) {
      this.log.warn(`Failed to load AccessTrade campaigns: ${e.message} — falling back to DB`);
      await this.slog.warn(`Không thể tải danh sách campaign AccessTrade, dùng dữ liệu DB`, SRC, { error: e.message });
      // Fallback: đọc từ DB thay vì RAM cache (RAM bị xóa khi restart)
      const dbRows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } });
      const campaigns: AccessTradeCampaign[] = dbRows.map((r) => ({
        id: r.id,
        name: r.name,
        merchant: r.merchant,
        url: r.url,
        approval: r.approval,
        scope: null,
        cookieDuration: r.cookieDuration ?? null,
        status: r.status,
        logoUrl: r.logoUrl ?? null,
        description: r.description ?? null,
        category: r.category ?? null,
        commission: r.commission ?? null,
        brandId: r.brandId ?? null,
      }));
      if (campaigns.length > 0) {
        this.atCampaignsCache = { campaigns, fetchedAt: Date.now() - this.AT_CAMPAIGNS_CACHE_TTL + 5 * 60 * 1000 };
      }
      return campaigns;
    }
  }

  // Các platform lớn trên AT đều là "tracking type" — không có product feed qua /v1/offers.
  // Detect khi lần đầu lưu vào DB; update sau không override để bảo toàn setting thủ công.
  private detectCampaignType(name: string, merchant: string): string {
    const lower = `${name} ${merchant}`.toLowerCase();
    // "Smartlink" / "smart link" = URL wrapping, luôn là tracking dù platform nào
    if (lower.includes("smartlink") || lower.includes("smart link")) return "tracking";
    // Chỉ nhận "product" cho các platform lớn có product feed thật sự qua AT /v1/offers
    const productFeedPlatforms = ["lazada", "shopee", "sendo"];
    if (productFeedPlatforms.some((p) => lower.includes(p))) return "product";
    // Mặc định "tracking" — hầu hết merchant nhỏ dùng CPS tracking link
    return "tracking";
  }

  private async scrapeOgImage(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AffiliateBot/1.0)" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const html = await res.text();
      const m =
        /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
        /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html);
      const imgUrl = m?.[1]?.trim();
      return imgUrl && imgUrl.startsWith("http") ? imgUrl : null;
    } catch {
      return null;
    }
  }

  private async scrapeOgImages(campaigns: AccessTradeCampaign[]): Promise<void> {
    const needScrape = await this.prisma.atCampaign.findMany({
      where: { id: { in: campaigns.map((c) => c.id) }, ogImageUrl: null },
      select: { id: true, url: true },
    });
    if (needScrape.length === 0) return;
    this.log.log(`[AT] Scraping og:image cho ${needScrape.length} campaign(s)...`);
    for (let i = 0; i < needScrape.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 300));
      const { id, url } = needScrape[i];
      const ogImageUrl = await this.scrapeOgImage(url);
      if (!ogImageUrl) { this.log.debug(`[AT] og:image ${id}: không tìm thấy`); continue; }
      try {
        await this.prisma.atCampaign.update({ where: { id }, data: { ogImageUrl } });
        this.log.debug(`[AT] og:image ${id}: ${ogImageUrl}`);
      } catch { /* bỏ qua */ }
    }
  }

  private async upsertBannersToDB(campaigns: AccessTradeCampaign[]): Promise<void> {
    for (let i = 0; i < campaigns.length; i++) {
      const c = campaigns[i];
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 200));
      try {
        const banners = await this.accesstrade.getBanners(c.id);
        if (banners.length === 0) { this.log.debug(`[AT] Banners: campaign ${c.id} (${c.name}) → 0`); continue; }
        const now = new Date();
        await this.prisma.$transaction([
          this.prisma.atCampaignBanner.deleteMany({ where: { campaignId: c.id } }),
          ...banners.map((b) =>
            this.prisma.atCampaignBanner.create({
              data: {
                id: b.id,
                campaignId: c.id,
                imageUrl: b.imageUrl,
                width: b.width ?? null,
                height: b.height ?? null,
                type: b.type ?? null,
                affiliateLink: b.affiliateLink ?? null,
                syncedAt: now,
              },
            })
          ),
        ]);
        this.log.debug(`[AT] Banners: campaign ${c.id} → ${banners.length} banner(s) lưu DB`);
      } catch (e: any) {
        this.log.warn(`[AT] Bỏ qua banner campaign ${c.id}: ${e.message}`);
      }
    }
  }

  private async upsertCampaignsToDB(campaigns: AccessTradeCampaign[]): Promise<Map<string, string>> {
    const merchantBrandId = new Map<string, string>();
    if (campaigns.length === 0) return merchantBrandId;
    const now = new Date();

    // 1. Upsert unique brands derived from merchant name
    const uniqueMerchants = [...new Set(campaigns.map((c) => c.merchant))];
    for (const merchant of uniqueMerchants) {
      const slug = toBrandSlug(merchant);
      const firstCampaign = campaigns.find((c) => c.merchant === merchant);
      try {
        const brand = await this.prisma.brand.upsert({
          where: { slug },
          update: { name: merchant, ...(firstCampaign?.logoUrl && { logoUrl: firstCampaign.logoUrl }) },
          create: { name: merchant, slug, logoUrl: firstCampaign?.logoUrl ?? null },
          select: { id: true },
        });
        merchantBrandId.set(merchant, brand.id);
      } catch (e: any) {
        this.log.warn(`[AT] Không upsert được brand "${merchant}": ${e.message}`);
      }
    }

    // 2. Upsert AtCampaign rows with brandId
    try {
      await this.prisma.$transaction(
        campaigns.map((c) => {
          const brandId = merchantBrandId.get(c.merchant) ?? null;
          return this.prisma.atCampaign.upsert({
            where: { id: c.id },
            update: {
              name: c.name,
              merchant: c.merchant,
              url: c.url,
              approval: c.approval,
              cookieDuration: c.cookieDuration ?? null,
              status: c.status,
              lastSeenAt: now,
              ...(brandId && { brandId }),
              ...(c.logoUrl !== undefined && { logoUrl: c.logoUrl }),
              ...(c.description !== undefined && { description: c.description }),
              ...(c.category !== undefined && { category: c.category }),
              ...(c.commission !== undefined && { commission: c.commission }),
              // Auto-promote sang "tracking" nếu detect được — không tự demote (bảo toàn setting thủ công)
              ...(this.detectCampaignType(c.name, c.merchant) === "tracking" && { campaignType: "tracking" }),
            },
            create: {
              id: c.id,
              name: c.name,
              merchant: c.merchant,
              url: c.url,
              approval: c.approval,
              cookieDuration: c.cookieDuration ?? null,
              status: c.status,
              lastSeenAt: now,
              campaignType: this.detectCampaignType(c.name, c.merchant),
              logoUrl: c.logoUrl ?? null,
              description: c.description ?? null,
              category: c.category ?? null,
              commission: c.commission ?? null,
              ...(brandId && { brandId }),
            },
          });
        }),
      );
    } catch (e: any) {
      this.log.warn(`Failed to persist AT campaigns to DB: ${e.message}`);
    }

    return merchantBrandId;
  }

  // DB-first campaign loader: nếu MAX(lastSeenAt) < 4h → dùng DB; còn lại → gọi AT API
  private async getAtCampaignsWithFreshnessCheck(): Promise<AccessTradeCampaign[]> {
    const agg = await this.prisma.atCampaign.aggregate({
      _max: { lastSeenAt: true },
      where: { approval: "successful" },
    });
    const maxLastSeen = agg._max.lastSeenAt;
    const isFresh = maxLastSeen && (Date.now() - maxLastSeen.getTime()) < this.AT_CAMPAIGNS_CACHE_TTL;

    if (isFresh) {
      this.log.log(`AT campaigns: dùng DB cache (cập nhật lúc ${maxLastSeen!.toISOString()})`);
      const dbRows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } });
      return dbRows.map((r) => ({
        id: r.id,
        name: r.name,
        merchant: r.merchant,
        url: r.url,
        approval: r.approval,
        scope: null,
        cookieDuration: r.cookieDuration ?? null,
        status: r.status,
        logoUrl: r.logoUrl ?? null,
        description: r.description ?? null,
        category: r.category ?? null,
        commission: r.commission ?? null,
        brandId: r.brandId ?? null,
      }));
    }

    this.log.log(`AT campaigns: cache cũ hơn 4h — gọi AT API để cập nhật`);
    return this.getApprovedCampaigns();
  }

  // Tìm AT campaign phù hợp với source slug (theo tên/merchant) + trả về campaignType từ DB
  private async findCampaignForSource(
    sourceSlug: string,
    atCampaignIdOverride?: string,
  ): Promise<{ campaign: AccessTradeCampaign | null; campaignType: "product" | "tracking" }> {
    this.log.log(`[${sourceSlug}] Lấy danh sách AT campaign (DB-first 4h TTL)...`);
    const campaigns = await this.getAtCampaignsWithFreshnessCheck();
    this.log.log(`[${sourceSlug}] Tổng ${campaigns.length} AT campaign approved`);
    if (campaigns.length === 0) return { campaign: null, campaignType: "product" };

    const dbTypes = await this.prisma.atCampaign.findMany({
      select: { id: true, campaignType: true },
    });
    const typeMap = new Map(dbTypes.map((r) => [r.id, (r.campaignType ?? "product") as "product" | "tracking"]));

    // Explicit override từ config
    if (atCampaignIdOverride) {
      const found = campaigns.find((c) => c.id === atCampaignIdOverride);
      if (found) return { campaign: found, campaignType: (typeMap.get(found.id) ?? "product") as "product" | "tracking" };
    }

    // Auto-match: slug hoặc tên slug (dấu gạch ngang → khoảng trắng)
    const slugVariants = [sourceSlug, sourceSlug.replace(/-/g, " ")].map((s) => s.toLowerCase());
    const matched = campaigns.find((c) => {
      const lower = `${c.name} ${c.merchant}`.toLowerCase();
      return slugVariants.some((v) => lower.includes(v));
    });

    return {
      campaign: matched ?? null,
      campaignType: (matched ? (typeMap.get(matched.id) ?? "product") : "product") as "product" | "tracking",
    };
  }

  // Chiến lược affiliate dựa vào config nguồn + loại AT campaign
  private resolveAffiliateStrategy(
    sourceSlug: string,
    config: SyncSourceConfig,
    campaignType: "product" | "tracking",
  ): AffiliateStrategy {
    if (config.hasDirectAffiliate) return "direct";
    // Shopee/Lazada mặc định dùng direct affiliate API của riêng họ
    if ((sourceSlug === "shopee" || sourceSlug === "lazada") && !config.atCampaignId) return "direct";
    if (campaignType === "product") return "at_feed";
    return "at_wrap";
  }

  // Lấy sản phẩm từ AT product feed cho 1 ngách (dùng khi strategy = at_feed)
  private async fetchAtFeedForNiche(niche: NicheConfig, sourceSlug: string): Promise<FetchedProduct[]> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) return [];

    const campaignIds = await this.resolveCampaignIds(niche);
    const allCampaigns = await this.getApprovedCampaigns();
    const dbTypes = await this.prisma.atCampaign.findMany({ select: { id: true, campaignType: true } });
    const typeMap = new Map(dbTypes.map((r) => [r.id, r.campaignType ?? "product"]));

    const feedCampaigns = allCampaigns.filter(
      (c) => campaignIds.includes(c.id) && typeMap.get(c.id) !== "tracking",
    );

    if (feedCampaigns.length === 0) return [];

    this.log.log(`[${sourceSlug}] Ngách: ${niche.name} — AT product feed: ${feedCampaigns.length} campaign(s)`);
    return this.fetchOffersForCampaigns(feedCampaigns, niche);
  }

  private async resolveCampaignIds(niche: NicheConfig): Promise<string[]> {
    const allCampaigns = await this.getApprovedCampaigns();
    if (allCampaigns.length === 0) return [];

    const keywords = [
      niche.name,
      niche.id,
    ].map((k) => k.toLowerCase().trim()).filter(Boolean);

    const matched = allCampaigns.filter((c) =>
      keywords.some(
        (kw) =>
          c.name.toLowerCase().includes(kw) ||
          c.merchant.toLowerCase().includes(kw),
      ),
    );

    if (matched.length > 0) {
      this.log.log(`[${niche.name}] Auto-matched ${matched.length} AT campaigns: ${matched.map((c) => c.name).join(", ")}`);
      await this.slog.info(`Auto-match campaign AccessTrade cho ngách "${niche.name}"`, SRC, {
        matched: matched.map((c) => ({ id: c.id, name: c.name, merchant: c.merchant })),
      });
      await this.upsertNicheMatchesToDB(niche.id, matched.map((c) => c.id));
    } else {
      this.log.debug(`[${niche.name}] No AccessTrade campaigns matched — skipping AT product fetch`);
    }

    return matched.map((c) => c.id);
  }

  private async upsertNicheMatchesToDB(nicheId: string, campaignIds: string[]): Promise<void> {
    if (campaignIds.length === 0) return;
    try {
      await this.prisma.$transaction(
        campaignIds.map((campaignId) =>
          this.prisma.atCampaignNicheMatch.upsert({
            where: { campaignId_nicheId: { campaignId, nicheId } },
            update: { matchedAt: new Date() },
            create: { id: `${campaignId}_${nicheId}`, campaignId, nicheId },
          }),
        ),
      );
    } catch (e: any) {
      this.log.warn(`Failed to persist niche matches to DB: ${e.message}`);
    }
  }

  private async fetchAccessTradeProducts(niche: NicheConfig, source: string = "accesstrade", tikiIntegration?: NicheIntegration | null): Promise<FetchedProduct[]> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) return [];

    const allCampaigns = await this.getApprovedCampaigns();

    // Load campaignType từ DB — AT API không trả về loại này
    const dbTypes = await this.prisma.atCampaign.findMany({
      select: { id: true, campaignType: true },
    });
    const typeMap = new Map(dbTypes.map((r) => [r.id, r.campaignType ?? "product"]));

    // "tracking" campaigns: fetch từ API nguồn rồi wrap AT link — match toàn bộ ngách
    const trackingCampaigns = allCampaigns.filter((c) => typeMap.get(c.id) === "tracking");

    // "product" campaigns: lấy từ AT /v1/offers, match theo keyword ngách
    const campaignIds = await this.resolveCampaignIds(niche);
    const feedCampaigns = allCampaigns.filter(
      (c) => campaignIds.includes(c.id) && typeMap.get(c.id) !== "tracking",
    );

    const results: FetchedProduct[] = [];

    if (trackingCampaigns.length > 0) {
      const srcSettings = await this.readSourceSettings();

      // Lấy tikiIntegration nếu chưa được truyền vào (source="accesstrade" không load trước)
      const resolvedTikiIntegration = tikiIntegration !== undefined
        ? tikiIntegration
        : await this.loadNicheIntegration(niche.id, "tiki");

      for (const campaign of trackingCampaigns) {
        const nameLower = `${campaign.name} ${campaign.merchant}`.toLowerCase();

        if (nameLower.includes("tiki")) {
          // Chỉ skip khi fetchTikiProducts() thực sự đang xử lý niche này (integration active).
          // Nếu integration null/disabled, fetchTikiProducts() trả [] → phải fetch ở đây.
          const tikiRunsExternally = source === "tiki" && resolvedTikiIntegration?.enabled;
          if (tikiRunsExternally) {
            this.log.debug(`[${niche.name}] Tracking/Tiki skip — tiki source already running separately`);
          } else {
            // source="accesstrade": Tiki không chạy riêng → fetch ở đây
            // Dùng tikiIntegration (từ DB) nếu có để lấy platformCategoryIds; fallback integration rỗng
            const integration: NicheIntegration = {
              enabled: true, atEnabled: true, directEnabled: true,
              directFallback: false, campaignId: campaign.id,
            };
            const r = await this.fetchTikiDirect(niche, integration);
            this.log.log(`[${niche.name}] Tracking/Tiki (${campaign.name}): ${r.length} products`);
            results.push(...r);
          }

        } else if (nameLower.includes("shopee")) {
          // Shopee: chỉ fetch nếu shopeeMode = "at" (Option 2)
          // Nếu "affiliate" → bỏ qua, Shopee Affiliate API lo riêng
          if (srcSettings.shopeeMode === "at") {
            const r = await this.fetchShopeeWithAtTracking(niche, campaign);
            this.log.log(`[${niche.name}] Tracking/Shopee AT (${campaign.name}): ${r.length} products`);
            results.push(...r);
          } else {
            this.log.debug(`[${niche.name}] Tracking/Shopee skipped — shopeeMode=affiliate`);
          }

        } else if (nameLower.includes("lazada")) {
          // Lazada: khi source="lazada", fetchLazadaProducts() đã xử lý riêng → skip
          if (source === "lazada") {
            this.log.debug(`[${niche.name}] Tracking/Lazada skip — lazada source already running separately`);
          } else {
            // source="accesstrade": fetch sản phẩm Lazada từ AT offer feed của campaign này
            const r = await this.fetchOffersForCampaigns([campaign], niche);
            this.log.log(`[${niche.name}] Tracking/Lazada AT (${campaign.name}): ${r.length} products`);
            results.push(...r);
          }
        }
        // Thêm nguồn tracking khác tại đây khi cần
      }
    }

    // Product feed type
    if (feedCampaigns.length > 0) {
      const feedResults = await this.fetchOffersForCampaigns(feedCampaigns, niche);
      results.push(...feedResults);
    }

    if (results.length > 0) {
      await this.slog.info(`Lấy sản phẩm AccessTrade hoàn tất`, SRC, {
        niche: niche.id, count: results.length,
      });
    }

    return results;
  }

  private parseAccessTradeOffer(item: any, campaignId: string): FetchedProduct | null {
    try {
      const name = item.name ?? item.product_name ?? item.title ?? "";
      if (!name) return null;

      const shopUrl = item.url ?? item.product_url ?? item.link ?? item.landing_url ?? "";
      if (!shopUrl) return null;

      const rawPrice = Number(item.price ?? item.sale_price ?? item.current_price ?? 0);
      if (rawPrice <= 0) return null;
      const currentPrice = Math.round(rawPrice);

      const rawOriginal = item.original_price ?? item.price_before_discount ?? item.regular_price ?? null;
      const originalPrice = rawOriginal ? Math.round(Number(rawOriginal)) : null;

      const externalId = String(
        item.id ?? item.product_id ?? item.offer_id ??
        `${campaignId}-${Buffer.from(shopUrl).toString("base64").slice(0, 16)}`,
      );

      return {
        externalId,
        source: "accesstrade",
        name: String(name).slice(0, 255),
        imageUrl: item.image ?? item.image_url ?? item.thumbnail ?? "",
        shopUrl: String(shopUrl),
        affiliateUrl: String(shopUrl), // overwritten by createTrackingLink above
        currentPrice,
        originalPrice,
        commissionRate: Number(item.commission_rate ?? item.commission ?? 0),
        rating: item.rating ? Number(item.rating) : null,
      };
    } catch {
      return null;
    }
  }

  // ── Lazada integration ──────────────────────────────────────────────────────

  private async fetchLazadaProducts(niche: NicheConfig, _integration: NicheIntegration | null): Promise<FetchedProduct[]> {
    const config = await this.readLazadaConfig();

    if (config.syncMode === "at") {
      const allCampaigns = await this.getApprovedCampaigns();
      const lazadaCampaigns = allCampaigns.filter((c) =>
        c.name.toLowerCase().includes("lazada") ||
        c.merchant.toLowerCase().includes("lazada"),
      );
      if (lazadaCampaigns.length === 0) {
        this.log.warn(`[Lazada] Không có AT campaign Lazada — bỏ qua ngách "${niche.name}"`);
        return [];
      }
      const results = await this.fetchOffersForCampaigns(lazadaCampaigns, niche);
      this.log.log(`[Lazada] "${niche.name}" via AT: ${results.length} sản phẩm từ ${lazadaCampaigns.length} campaign`);
      return results;
    }

    // syncMode = "api" — Lazada Affiliate Open Platform
    const appKey = this.cfg.get<string>("LAZADA_APP_KEY");
    const appSecret = this.cfg.get<string>("LAZADA_APP_SECRET");
    if (!appKey || !appSecret) {
      this.log.warn(`[Lazada] LAZADA_APP_KEY/APP_SECRET chưa cấu hình — bỏ qua ngách "${niche.name}". Xem .env.example`);
      return [];
    }

    const keywords = (config.keywords[niche.id] ?? []).slice(0, config.maxKeywords);
    if (keywords.length === 0) {
      this.log.debug(`[Lazada] Không có keyword cho ngách "${niche.name}" — bỏ qua`);
      return [];
    }

    return this.fetchLazadaDirect(niche, keywords, config.pageSize);
  }

  private async fetchLazadaDirect(
    niche: NicheConfig,
    keywords: string[],
    pageSize: number,
  ): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];

    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki];
      if (ki > 0) await sleep(LAZADA_INTER_KEYWORD_DELAY_MS);

      try {
        const items = await this.lazada.searchByName(keyword, pageSize);
        let added = 0;
        for (const item of items) {
          const parsed = this.normalizeLazadaProduct(item);
          if (parsed) { results.push(parsed); added++; }
        }
        this.log.debug(`[Lazada] "${keyword}": ${added} sản phẩm`);
      } catch (e: any) {
        this.log.warn(`[Lazada] "${niche.name}" fetch thất bại cho "${keyword}": ${e.message}`);
        await this.slog.warn(`Lazada API lỗi khi tìm "${keyword}"`, SRC, {
          niche: niche.id, keyword, error: e.message,
        });
      }
    }

    return results;
  }

  private normalizeLazadaProduct(item: NormalizedProduct): FetchedProduct | null {
    if (!item.name || !item.platformUrl || item.price <= 0) return null;

    return {
      externalId: item.platformProductId,
      source: "lazada",
      name: item.name.slice(0, 255),
      imageUrl: item.imageUrl,
      shopUrl: item.platformUrl,
      affiliateUrl: item.platformUrl, // overwritten by AT tracking link nếu có
      currentPrice: item.price,
      originalPrice: item.originalPrice ?? null,
      commissionRate: 0,
      rating: item.rating ?? null,
    };
  }

  // ── Tiki integration ────────────────────────────────────────────────────────

  private async loadNicheIntegration(nicheId: string, platform: string): Promise<NicheIntegration | null> {
    try {
      const row = await this.prisma.nicheIntegration.findUnique({
        where: { nicheId_platform: { nicheId, platform } },
      });
      return row ?? null;
    } catch {
      return null;
    }
  }

  private async fetchTikiProducts(niche: NicheConfig, integration: NicheIntegration | null): Promise<FetchedProduct[]> {
    if (!integration?.enabled) return [];

    let atResults: FetchedProduct[] = [];

    // Cách 1: tìm AT campaign có merchant/tên chứa "tiki"
    if (integration.atEnabled) {
      const tikiCampaignId = integration.campaignId ?? null;
      const allCampaigns = await this.getApprovedCampaigns();
      const tikiCampaigns = tikiCampaignId
        ? allCampaigns.filter((c) => c.id === tikiCampaignId)
        : allCampaigns.filter((c) =>
            c.name.toLowerCase().includes("tiki") ||
            c.merchant.toLowerCase().includes("tiki"),
          );

      if (tikiCampaigns.length > 0) {
        atResults = await this.fetchOffersForCampaigns(tikiCampaigns, niche);
        this.log.log(`[${niche.name}] Tiki via AT: ${atResults.length} products from ${tikiCampaigns.length} campaigns`);
      }
    }

    // Cách 2: gọi thẳng Tiki API — chỉ chạy nếu directEnabled
    // và nếu directFallback=true thì chỉ chạy khi Cách 1 có 0 kết quả
    if (integration.directEnabled) {
      const shouldRunDirect = !integration.directFallback || atResults.length === 0;
      if (shouldRunDirect) {
        const directResults = await this.fetchTikiDirect(niche, integration);
        this.log.log(`[${niche.name}] Tiki direct API: ${directResults.length} products`);
        return [...atResults, ...directResults];
      }
    }

    return atResults;
  }

  // Tách riêng để dùng chung cho Tiki (Cách 1) và AT thường
  private async fetchOffersForCampaigns(campaigns: AccessTradeCampaign[], niche: NicheConfig): Promise<FetchedProduct[]> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) return [];

    const results: FetchedProduct[] = [];
    for (let i = 0; i < campaigns.length; i++) {
      const campaignId = campaigns[i].id;
      if (i > 0) await sleep(1500);

      try {
        const url = new URL(AT_OFFERS_API);
        url.searchParams.set("campaign_id", campaignId);
        url.searchParams.set("limit", "50");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Token ${accessKey}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (res.status === 404) continue;
        if (res.status === 429) break;
        if (!res.ok) continue;

        const body = await res.json();
        const items: any[] = body?.data ?? body?.offers ?? (Array.isArray(body) ? body : []);

        for (const item of items) {
          const parsed = this.parseAccessTradeOffer(item, campaignId);
          if (!parsed) continue;
          try {
            const link = await this.accesstrade.createTrackingLink({
              campaignId,
              urls: [parsed.shopUrl],
              subIds: { sub1: niche.id, sub2: "web" },
            });
            parsed.affiliateUrl = link.shortLink ?? link.affiliateLink;
          } catch { /* keep original URL */ }
          results.push(parsed);
          await sleep(300);
        }
      } catch (e: any) {
        this.log.warn(`AT offers fetch failed for campaign "${campaignId}": ${e.message}`);
      }
    }
    return results;
  }

  private async fetchTikiDirect(niche: NicheConfig, integration: NicheIntegration): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];

    // Tìm Tiki AT campaign để tạo tracking link nếu có
    const allCampaigns = await this.getApprovedCampaigns();
    const tikiCampaign = integration.campaignId
      ? allCampaigns.find((c) => c.id === integration.campaignId) ?? null
      : allCampaigns.find((c) =>
          c.name.toLowerCase().includes("tiki") ||
          c.merchant.toLowerCase().includes("tiki"),
        ) ?? null;

    const fetcher = new BotSafeFetcher({
      baseDelayMs: 3000,
      jitterFactor: 0.4,
      blockBackoffMs: 8000,
      loggerName: `DealSync/Tiki/${niche.name}`,
    });
    const tikiHeaders = buildTikiHeaders(this.tikiUaIndex);

    const tikiConfig = await this.readTikiSyncConfig();
    const configuredIds: number[] = tikiConfig.categoryIds[niche.id] ?? [];
    const categoryIds: number[] | null = configuredIds.length > 0 ? configuredIds : null;

    // Rolling page cursor — mỗi run lấy đúng 1 trang, trang tiếp theo được lưu trong SyncSource.config.pageState.
    // Key: "{nicheId}_{categoryId}" hoặc "{nicheId}_kw_{keyword}"
    const pageState = { ...tikiConfig.pageState };

    const CAT_DELAY_MS = 3_000; // delay giữa các category trong cùng ngách

    if (categoryIds) {
      // ─── Category search — 1 page/category/run theo cursor ───
      let blockedCount = 0;
      for (let ci = 0; ci < categoryIds.length; ci++) {
        if (ci > 0) await sleep(CAT_DELAY_MS);
        const categoryId = categoryIds[ci];
        const stateKey = `${niche.id}_${categoryId}`;
        const cat = pageState[stateKey];

        // Tính trang cần fetch:
        // • Chưa có state → page 1 (lần đầu tiên)
        // • Đã hết page (currentPage >= totalPages) → về lại page 1 và refresh totalPages
        // • Ngược lại → trang kế tiếp
        const targetPage = !cat || cat.currentPage >= cat.totalPages ? 1 : cat.currentPage + 1;
        const isReset = !cat || cat.currentPage >= cat.totalPages;

        await fetcher.delay();

        const url = new URL(TIKI_SEARCH_API);
        url.searchParams.set("limit", "40");
        url.searchParams.set("sort", "discount_rate:desc");
        url.searchParams.set("category", String(categoryId));
        url.searchParams.set("page", String(targetPage));

        const { data: body, blocked } = await fetcher.fetchJson(url.toString(), tikiHeaders);
        if (blocked) {
          blockedCount++;
          this.log.warn(`[${niche.name}] Tiki category ${categoryId} BLOCKED (page ${targetPage})`);
          continue;
        }
        if (!body) continue;

        const paging = (body as any)?.paging ?? {};
        const totalAvailable: number = paging.total ?? 0;
        const totalPages: number = paging.last_page ?? (totalAvailable > 0 ? Math.ceil(totalAvailable / 40) : targetPage);
        const items: any[] = (body as any)?.data ?? [];

        if (items.length === 0) {
          this.log.debug(`[${niche.name}] Tiki category ${categoryId} page ${targetPage}: 0 items`);
          pageState[stateKey] = { currentPage: targetPage, totalPages: Math.max(totalPages, 1) };
          continue;
        }

        await this.attachTikiTrackingLinks(items, results, tikiCampaign, niche);

        pageState[stateKey] = { currentPage: targetPage, totalPages };
        this.log.log(
          `[${niche.name}] Tiki cat ${categoryId}: page ${targetPage}/${totalPages}` +
          `${isReset ? " (reset)" : ""}, ${items.length} items (${totalAvailable} total)`,
        );
      }

      // Tất cả categories đều bị block → IP ban toàn bộ
      if (blockedCount === categoryIds.length && results.length === 0) {
        this.tikiIpBanned = true;
        this.log.error(`[Tiki] IP BAN detected on niche "${niche.name}" — all ${categoryIds.length} categories returned HTML. IP is rate-limited.`);
      }
      await this.saveTikiPageState(pageState);
      return results;
    }

    // ─── Keyword search: chỉ cho niches không có category ID xác nhận ───
    const keywords = niche.shopee?.keyword_seeds?.slice(0, 1) ?? [niche.name];

    let kwBlockedCount = 0;
    for (const keyword of keywords) {
      const stateKey = `${niche.id}_kw_${keyword}`;
      const kw = pageState[stateKey];
      const targetPage = !kw || kw.currentPage >= kw.totalPages ? 1 : kw.currentPage + 1;
      const isReset = !kw || kw.currentPage >= kw.totalPages;

      await fetcher.delay();

      const url = new URL(TIKI_SEARCH_API);
      url.searchParams.set("q", keyword);
      url.searchParams.set("limit", "40");
      url.searchParams.set("sort", "discount_rate:desc");
      url.searchParams.set("page", String(targetPage));

      const { data: body, blocked } = await fetcher.fetchJson(url.toString(), tikiHeaders);
      if (!body || blocked) {
        if (blocked) {
          kwBlockedCount++;
          this.log.warn(`[${niche.name}] Tiki keyword "${keyword}" BLOCKED (page ${targetPage})`);
        }
        continue;
      }

      const items: any[] = (body as any)?.data ?? [];
      if (items.length === 0) {
        this.log.debug(`[${niche.name}] Tiki keyword "${keyword}" page ${targetPage}: 0 items`);
        pageState[stateKey] = { currentPage: targetPage, totalPages: Math.max(kw?.totalPages ?? 1, 1) };
        continue;
      }

      const paging = (body as any)?.paging ?? {};
      const kwTotal: number = paging.total ?? 0;
      const totalPages: number = paging.last_page ?? (kwTotal > 0 ? Math.ceil(kwTotal / 40) : targetPage);

      await this.attachTikiTrackingLinks(items, results, tikiCampaign, niche);

      pageState[stateKey] = { currentPage: targetPage, totalPages };
      this.log.log(
        `[${niche.name}] Tiki kw "${keyword}": page ${targetPage}/${totalPages}` +
        `${isReset ? " (reset)" : ""}, ${items.length} items (${kwTotal} total)`,
      );
    }

    // Tất cả keywords đều bị block AND không có kết quả → IP ban thực sự
    if (kwBlockedCount === keywords.length && results.length === 0) {
      this.tikiIpBanned = true;
      this.log.error(`[Tiki] IP BAN detected on niche "${niche.name}" — all ${keywords.length} keyword(s) returned HTML. IP is rate-limited.`);
    }

    await this.saveTikiPageState(pageState);
    return results;
  }

  private async attachTikiTrackingLinks(
    items: any[],
    results: FetchedProduct[],
    tikiCampaign: { id: string } | null,
    niche: NicheConfig,
  ): Promise<void> {
    for (const item of items) {
      const parsed = this.parseTikiProduct(item);
      if (!parsed) continue;
      if (tikiCampaign) {
        try {
          const link = await this.accesstrade.createTrackingLink({
            campaignId: tikiCampaign.id,
            urls: [parsed.shopUrl],
            subIds: { sub1: niche.id, sub2: "tiki-direct" },
          });
          parsed.affiliateUrl = link.shortLink ?? link.affiliateLink;
        } catch { /* keep raw URL — no commission */ }
      }
      results.push(parsed);
    }
  }

  private parseTikiProduct(item: any): FetchedProduct | null {
    try {
      const name = item.name ?? "";
      if (!name) return null;

      const urlPath = item.url_path ?? item.url_key ?? "";
      if (!urlPath) return null;
      const shopUrl = `${TIKI_PRODUCT_BASE}/${urlPath}`;

      const price = Number(item.price ?? 0);
      if (price <= 0) return null;
      const currentPrice = Math.round(price);

      // Check multiple price fields — Tiki uses different keys depending on API version/endpoint
      const listPrice = Number(item.list_price ?? item.original_price ?? item.price_before_discount ?? item.real_price ?? 0);
      const originalPrice = listPrice > price ? Math.round(listPrice) : null;
      // Prefer Tiki's discount_rate; if 0 or absent the sync loop will recompute from originalPrice
      const apiDiscountRate = (item.discount_rate != null && Number(item.discount_rate) > 0)
        ? Number(item.discount_rate)
        : undefined;

      const externalId = String(
        item.id ?? `tiki-${Buffer.from(shopUrl).toString("base64").slice(0, 16)}`,
      );

      return {
        externalId,
        source: "tiki",
        name: String(name).slice(0, 255),
        imageUrl: item.thumbnail_url ?? item.thumbnail ?? "",
        shopUrl,
        affiliateUrl: shopUrl, // sẽ được overwrite bởi AT tracking link nếu có
        currentPrice,
        originalPrice,
        discountPct: apiDiscountRate,
        commissionRate: 0,
        rating: item.rating_average ? Number(item.rating_average) : null,
      };
    } catch {
      return null;
    }
  }

  // ── CellphoneS integration ──────────────────────────────────────────────────

  private async fetchCellphonesProducts(
    niche: NicheConfig,
    integration: NicheIntegration | null,
    atCampaign: import("../affiliate/accesstrade/types").AccessTradeCampaign | null,
  ): Promise<FetchedProduct[]> {
    if (!integration?.enabled) return [];

    // Load per-niche category config từ SyncSource.config hoặc dùng default
    const dbSource = await this.prisma.syncSource.findUnique({ where: { slug: "cellphones" } });
    const cfg = dbSource?.config
      ? (() => { try { return JSON.parse(dbSource.config as string) as import("./sync.constants").SyncSourceConfig } catch { return {} } })()
      : {};

    const categoryMap: Record<string, string[]> = cfg.cpsCategories ?? {};
    const categoryIds: string[] = categoryMap[niche.id] ?? [];
    if (categoryIds.length === 0) return [];

    const pageSize = cfg.cpsPageSize ?? 20;
    const maxPages = cfg.cpsMaxPages ?? 2;
    const provinceId = cfg.cpsProvinceId ?? CPS_DEFAULT_PROVINCE_ID;

    const results: FetchedProduct[] = [];

    for (const categoryId of categoryIds) {
      for (let page = 1; page <= maxPages; page++) {
        if (page > 1) await sleep(1500);
        try {
          const items = await this.fetchCpsCategory(categoryId, page, pageSize, provinceId);
          if (items.length === 0) break;

          for (const item of items) {
            const parsed = this.normalizeCpsProduct(item);
            if (parsed) results.push(parsed);
          }

          if (items.length < pageSize) break; // last page
        } catch (e: any) {
          this.log.warn(`[CellphoneS] Category ${categoryId} page ${page} error: ${e.message}`);
          await this.slog.warn(`CellphoneS fetch lỗi`, SRC, {
            niche: niche.id, categoryId, page, error: e.message,
          });
          break;
        }
      }
      await sleep(1200);
    }

    this.log.log(`[CellphoneS] Ngách: ${niche.name} — ${results.length} sản phẩm`);

    // Wrap AT tracking link batch sau khi collect đủ — cùng pattern KingFood
    if (atCampaign && results.length > 0) {
      this.log.log(`[CellphoneS] Tạo AT tracking link cho ${results.length} sản phẩm...`);
      let wrapped = 0;
      for (const p of results) {
        try {
          const link = await this.accesstrade.createTrackingLink({
            campaignId: atCampaign.id,
            urls: [p.shopUrl],
            subIds: { sub1: niche.id, sub2: "cps" },
          });
          p.affiliateUrl = link.shortLink ?? link.affiliateLink;
          wrapped++;
        } catch { /* keep raw URL */ }
      }
      this.log.log(`[CellphoneS] Wrap AT link: ${wrapped}/${results.length} thành công`);
      await this.slog.info(
        `[CellphoneS] Wrap AT link: ${wrapped}/${results.length} — campaign "${atCampaign.name}"`,
        SRC, { campaign: atCampaign.name, wrapped, total: results.length },
      );
    }

    return results;
  }

  private async fetchCpsCategory(
    categoryId: string,
    page: number,
    size: number,
    provinceId: number,
  ): Promise<any[]> {
    const query = `
      query GetProductsByCateId {
        products(
          filter: {
            static: {
              categories: ["${categoryId}"]
              province_id: ${provinceId}
              stock: { from: 1 }
              company_stock_id: [46, 152, 4920]
            }
          }
          page: ${page}
          size: ${size}
          sort: [{ view: desc }]
        ) {
          general { product_id name sku url_path review { average_rating } }
          filterable { price special_price display_price thumbnail stock }
        }
      }
    `;

    const resp = await fetch(CPS_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": CPS_PRODUCT_BASE,
        "Referer": `${CPS_PRODUCT_BASE}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query, variables: {} }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) throw new Error(`CPS HTTP ${resp.status}`);
    const body = await resp.json() as any;
    if (body.errors?.length) throw new Error(body.errors[0].message);
    return body.data?.products ?? [];
  }

  private normalizeCpsProduct(item: any): FetchedProduct | null {
    try {
      const g = item.general;
      const f = item.filterable;
      if (!g || !f) return null;

      const name = String(g.name ?? "").trim();
      if (!name) return null;

      const urlPath = String(g.url_path ?? "").trim();
      if (!urlPath) return null;

      // Dùng display_price (giá hiển thị sau khuyến mãi) hoặc special_price, fallback về price
      const rawPrice = Number(f.display_price || f.special_price || f.price || 0);
      if (rawPrice <= 0) return null;
      const currentPrice = Math.round(rawPrice);
      const rawOriginal = Number(f.price || 0);
      const originalPrice = rawOriginal > rawPrice ? Math.round(rawOriginal) : null;

      const thumbnail = String(f.thumbnail ?? "").trim();
      const imageUrl = thumbnail ? `${CPS_IMAGE_CDN}${thumbnail}` : "";

      const shopUrl = `${CPS_PRODUCT_BASE}/${urlPath}`;
      const externalId = String(g.product_id ?? g.sku ?? urlPath);

      return {
        externalId,
        source: "cellphones",
        name: name.slice(0, 255),
        imageUrl,
        shopUrl,
        affiliateUrl: shopUrl,
        currentPrice,
        originalPrice,
        commissionRate: 0,
        rating: g.review?.average_rating ? Number(g.review.average_rating) : null,
      };
    } catch {
      return null;
    }
  }

  async loadActiveNiches(): Promise<NicheConfig[]> {
    const [rows, shopeeSource] = await Promise.all([
      this.prisma.category.findMany({
        where: { status: "active", syncEnabled: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      this.prisma.syncSource.findFirst({ where: { slug: "shopee", enabled: true } }),
    ]);

    const shopeeKeywords: Record<string, string[]> =
      shopeeSource
        ? ((JSON.parse(shopeeSource.config as string) as Record<string, unknown>).keywords as Record<string, string[]> ?? {})
        : {};

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      shopee: { keyword_seeds: shopeeKeywords[r.id] ?? [] },
    }));
  }
}
