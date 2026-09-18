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
  source: "shopee" | "accesstrade" | "tiki" | "lazada";
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
const TIKI_SEARCH_API = "https://tiki.vn/api/v2/products";
const TIKI_PRODUCT_BASE = "https://tiki.vn";

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
      const campaignResult = await this.findCampaignForSource(source, sourceConfig);
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

    await this.prisma.category.upsert({
      where: { id: niche.id },
      update: {},
      create: { id: niche.id, name: niche.name, slug: niche.id },
    });

    const runSource = (s: string) => source === s;

    const [tikiIntegration, lazadaIntegration] = await Promise.all([
      runSource("tiki")   ? this.loadNicheIntegration(niche.id, "tiki")   : Promise.resolve(null),
      runSource("lazada") ? this.loadNicheIntegration(niche.id, "lazada") : Promise.resolve(null),
    ]);

    // at_feed: lấy sản phẩm từ AT product feed thay vì fetch trực tiếp từ platform
    const atFeedProducts = strategy === "at_feed"
      ? await this.fetchAtFeedForNiche(niche, source)
      : [];
    if (atFeedProducts.length > 0) {
      this.log.log(`[${source}] Ngách: ${niche.name} — AT product feed: ${atFeedProducts.length} sản phẩm`);
    }

    const [shopeeProducts, tikiProducts, lazadaProducts] = await Promise.all([
      runSource("shopee")      ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Shopee...`),  this.fetchShopeeProducts(niche))         : Promise.resolve([]),
      runSource("tiki")        ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Tiki...`),    this.fetchTikiProducts(niche, tikiIntegration))  : Promise.resolve([]),
      runSource("lazada")      ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Lazada...`),  this.fetchLazadaProducts(niche, lazadaIntegration)) : Promise.resolve([]),
    ]);

    const bySourceRaw: Record<string, FetchedProduct[]> = {
      shopee:      shopeeProducts,
      accesstrade: atFeedProducts,
      tiki:        tikiProducts,
      lazada:      lazadaProducts,
    };
    const fetched = [...shopeeProducts, ...atFeedProducts, ...tikiProducts, ...lazadaProducts];
    const lastPriceMap = await this.fetchLastRecordedPrices(niche.id);

    const priceHistoryBatch: { productId: string; price: number }[] = [];
    let newDeals = 0;
    let skipped = 0;

    for (const p of fetched) {
      const product = await this.upsertProduct(p, niche.id);

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
    await this.slog.info(`Đồng bộ ngách "${niche.name}" hoàn tất`, SRC, report);
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

  private async fetchShopeeProducts(niche: NicheConfig): Promise<FetchedProduct[]> {
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

          const currentPrice = Math.round(node.priceMin * 100);
          const originalPrice = node.priceMax > node.priceMin
            ? Math.round(node.priceMax * 100)
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
        this.log.warn(`Shopee search failed for keyword "${keyword}": ${e.message}`);
        await this.slog.warn(`Shopee search thất bại`, SRC, {
          niche: niche.id,
          keyword,
          error: e.message,
          code: e.code,
        });
      }
    }

    return results;
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
            currentPrice: Math.round(node.priceMin * 100),
            originalPrice: node.priceMax > node.priceMin ? Math.round(node.priceMax * 100) : null,
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


  private async upsertProduct(p: FetchedProduct, categoryId: string) {
    return this.prisma.product.upsert({
      where: { source_externalId: { source: p.source, externalId: p.externalId } },
      update: {
        categoryId,
        price: p.currentPrice,
        affiliateUrl: p.affiliateUrl,
        lastSyncedAt: new Date(),
        isSoldOut: false,
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
        commission: Math.round(p.commissionRate),
        rating: p.rating ?? 0,
        categoryId,
      },
    });
  }

  async getApprovedCampaigns(): Promise<AccessTradeCampaign[]> {
    if (this.atCampaignsCache && Date.now() - this.atCampaignsCache.fetchedAt < this.AT_CAMPAIGNS_CACHE_TTL) {
      return this.atCampaignsCache.campaigns;
    }
    try {
      const campaigns = await this.accesstrade.listCampaigns({ approval: "successful" });
      this.atCampaignsCache = { campaigns, fetchedAt: Date.now() };
      this.log.log(`AT API: ${campaigns.length} approved campaigns loaded, saved to DB cache`);
      await this.upsertCampaignsToDB(campaigns);
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
    // Chỉ nhận "product" cho các platform lớn có product feed thật sự qua AT /v1/offers
    const productFeedPlatforms = ["lazada", "shopee", "sendo"];
    if (productFeedPlatforms.some((p) => lower.includes(p))) return "product";
    // Mặc định "tracking" — hầu hết merchant nhỏ dùng CPS tracking link
    return "tracking";
  }

  private async upsertCampaignsToDB(campaigns: AccessTradeCampaign[]): Promise<void> {
    if (campaigns.length === 0) return;
    const now = new Date();
    try {
      await this.prisma.$transaction(
        campaigns.map((c) =>
          this.prisma.atCampaign.upsert({
            where: { id: c.id },
            update: {
              name: c.name,
              merchant: c.merchant,
              url: c.url,
              approval: c.approval,
              cookieDuration: c.cookieDuration ?? null,
              status: c.status,
              lastSeenAt: now,
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
            },
          }),
        ),
      );
    } catch (e: any) {
      this.log.warn(`Failed to persist AT campaigns to DB: ${e.message}`);
    }
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
      }));
    }

    this.log.log(`AT campaigns: cache cũ hơn 4h — gọi AT API để cập nhật`);
    return this.getApprovedCampaigns();
  }

  // Tìm AT campaign phù hợp với source slug (theo tên/merchant) + trả về campaignType từ DB
  private async findCampaignForSource(
    sourceSlug: string,
    config: SyncSourceConfig,
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
    if (config.atCampaignId) {
      const found = campaigns.find((c) => c.id === config.atCampaignId);
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
          // Lazada: chỉ fetch nếu lazadaMode = "at" (Option 2)
          // Khi source="lazada", fetchLazadaProducts() đã xử lý riêng → skip ở đây
          if (source === "lazada") {
            this.log.debug(`[${niche.name}] Tracking/Lazada skip — lazada source already running separately`);
          } else if (srcSettings.lazadaMode === "at") {
            const integration: NicheIntegration = {
              enabled: true, atEnabled: false, directEnabled: true,
              directFallback: false, campaignId: campaign.id,
            };
            const r = await this.fetchLazadaDirect(niche, integration);
            this.log.log(`[${niche.name}] Tracking/Lazada AT (${campaign.name}): ${r.length} products`);
            results.push(...r);
          } else {
            this.log.debug(`[${niche.name}] Tracking/Lazada skipped — lazadaMode=affiliate`);
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

      // AccessTrade prices are typically in VND (not divided by 100 like Shopee cents)
      const rawPrice = Number(item.price ?? item.sale_price ?? item.current_price ?? 0);
      if (rawPrice <= 0) return null;
      const currentPrice = Math.round(rawPrice * 100); // store as cents

      const rawOriginal = item.original_price ?? item.price_before_discount ?? item.regular_price ?? null;
      const originalPrice = rawOriginal ? Math.round(Number(rawOriginal) * 100) : null;

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

  private async fetchLazadaProducts(niche: NicheConfig, integration: NicheIntegration | null): Promise<FetchedProduct[]> {
    if (!integration?.enabled) return [];

    let atResults: FetchedProduct[] = [];

    // Cách 1: tìm AT campaign có merchant/tên chứa "lazada"
    if (integration.atEnabled) {
      const allCampaigns = await this.getApprovedCampaigns();
      const lazadaCampaigns = integration.campaignId
        ? allCampaigns.filter((c) => c.id === integration.campaignId)
        : allCampaigns.filter((c) =>
            c.name.toLowerCase().includes("lazada") ||
            c.merchant.toLowerCase().includes("lazada"),
          );

      if (lazadaCampaigns.length > 0) {
        atResults = await this.fetchOffersForCampaigns(lazadaCampaigns, niche);
        this.log.log(`[${niche.name}] Lazada via AT: ${atResults.length} products from ${lazadaCampaigns.length} campaigns`);
      }
    }

    // Cách 2: gọi Lazada Affiliate API qua LazadaAdapter
    if (integration.directEnabled) {
      const shouldRunDirect = !integration.directFallback || atResults.length === 0;
      if (shouldRunDirect) {
        const directResults = await this.fetchLazadaDirect(niche, integration);
        this.log.log(`[${niche.name}] Lazada direct API: ${directResults.length} products`);
        return [...atResults, ...directResults];
      }
    }

    return atResults;
  }

  private async fetchLazadaDirect(niche: NicheConfig, integration: NicheIntegration): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];
    const keywords = niche.shopee?.keyword_seeds?.slice(0, 3) ?? [niche.name];

    const allCampaigns = await this.getApprovedCampaigns();
    const lazadaCampaign = integration.campaignId
      ? allCampaigns.find((c) => c.id === integration.campaignId) ?? null
      : allCampaigns.find((c) =>
          c.name.toLowerCase().includes("lazada") ||
          c.merchant.toLowerCase().includes("lazada"),
        ) ?? null;

    for (let ki = 0; ki < keywords.length; ki++) {
      const keyword = keywords[ki];
      if (ki > 0) await sleep(1500);

      try {
        const items = await this.lazada.searchByName(keyword, 40);

        for (const item of items) {
          const parsed = this.normalizeLazadaProduct(item);
          if (!parsed) continue;

          // Wrap với AT tracking link nếu có Lazada campaign
          if (lazadaCampaign) {
            try {
              const link = await this.accesstrade.createTrackingLink({
                campaignId: lazadaCampaign.id,
                urls: [parsed.shopUrl],
                subIds: { sub1: niche.id, sub2: "lazada-direct" },
              });
              parsed.affiliateUrl = link.shortLink ?? link.affiliateLink;
            } catch { /* keep raw URL */ }
          }

          results.push(parsed);
          await sleep(100);
        }
      } catch (e: any) {
        this.log.warn(`[${niche.name}] Lazada direct fetch failed for "${keyword}": ${e.message}`);
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
      currentPrice: item.price,       // LazadaAdapter đã lưu dạng cents (price × 100)
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
      const currentPrice = Math.round(price * 100); // lưu dạng cents như các source khác

      // Check multiple price fields — Tiki uses different keys depending on API version/endpoint
      const listPrice = Number(item.list_price ?? item.original_price ?? item.price_before_discount ?? item.real_price ?? 0);
      const originalPrice = listPrice > price ? Math.round(listPrice * 100) : null;
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

  async loadActiveNiches(): Promise<NicheConfig[]> {
    const [rows, shopeeSource] = await Promise.all([
      this.prisma.niche.findMany({
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
