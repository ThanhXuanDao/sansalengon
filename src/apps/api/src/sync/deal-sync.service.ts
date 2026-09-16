import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
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

interface NicheConfig {
  id: string;
  name: string;
  status: string;
  shopee?: { keyword_seeds: string[] };
  accesstrade?: {
    campaign_ids: string[];
    campaign_keywords?: string[]; // auto-match nếu campaign_ids trống
  };
  filters: { min_discount_pct: number; min_price: number; max_price: number };
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

type SyncSource = "all" | "shopee" | "accesstrade" | "tiki" | "lazada";

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

// Tiki category IDs đã xác nhận trả về sản phẩm đúng ngành.
// Niches KHÔNG có trong map → keyword search (keyword_seeds[0]).
// Confirmed working: electronics(4221), beauty(1520), home(1883),
//   sports(1975), kids(2549), food(4384), books(8322)
//   fashion: array [931, 1703, 1686] = thời trang nữ + giày nữ + giày nam
// Confirmed broken (total=0): pets(13768), tools(11659), gaming(6216), health(6757)
// NOTE: home was 1703 (now "Giày - Dép nữ" — Tiki repurposed it), correct ID is 1883
const TIKI_CATEGORY_IDS: Record<string, number | number[]> = {
  electronics: 4221,          // Thiết bị điện tử & Điện lạnh
  beauty:      1520,          // Làm Đẹp & Sức Khỏe
  home:        1883,          // Nhà Cửa - Đời Sống
  sports:      1975,          // Thể Thao & Dã Ngoại
  kids:        2549,          // Mẹ & Bé
  food:        4384,          // Thực Phẩm & Đồ Uống
  books:       8322,          // Sách, Văn Phòng & Quà Tặng
  fashion:     [931, 1703, 1686], // Thời trang nữ + Giày-Dép nữ + Giày-Dép nam
  // pets, tools, gaming, health: category IDs không có data → keyword search
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rotate UA between sync passes so retry uses a different browser fingerprint
const TIKI_UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
];

function buildTikiHeaders(uaIndex: number): Record<string, string> {
  return {
    "User-Agent": TIKI_UA_POOL[uaIndex % TIKI_UA_POOL.length],
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://tiki.vn/",
    "Origin": "https://tiki.vn",
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
  ) {}

  private get slog() { return this.appLog.scope("api-sync"); }

  @Cron("0 */4 * * *")
  async syncAllNiches() {
    if (this.syncRunning) {
      this.log.warn("[Cron] Sync already in progress — skipping scheduled run");
      return;
    }
    await this.triggerSync(undefined, "all", "cron");
  }

  // Public method called by SyncController (manual / web-scheduled trigger)
  async triggerSync(nicheId?: string, source: SyncSource = "all", trigger: Trigger = "manual"): Promise<{
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
    const allNiches = await this.loadActiveNiches();
    const targets = (nicheId && nicheId !== "all")
      ? allNiches.filter((n) => n.id === nicheId)
      : allNiches;

    this.log.log(`triggerSync — ${targets.length} niche(s), source=${source}${nicheId && nicheId !== "all" ? ` (${nicheId})` : ""}`);
    await this.slog.info(`Bắt đầu đồng bộ sản phẩm`, SRC, { niches: targets.map((n) => n.id), source }, trigger);

    const t0 = Date.now();
    const reports: SyncReport[] = [];

    const runNiche = async (niche: NicheConfig): Promise<SyncReport> =>
      this.syncNiche(niche, source).catch(async (e): Promise<SyncReport> => {
        this.log.error(`Sync failed for niche "${niche.id}": ${e.message}`);
        await this.slog.error(`Sync thất bại cho ngách "${niche.name}"`, SRC, {
          niche: niche.id, error: e.message, stack: e.stack?.slice(0, 500),
        }, trigger);
        return { niche: niche.id, fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: 0, bySource: {} };
      });

    const isTikiSync = source === "all" || source === "tiki";
    if (isTikiSync && targets.length > 1) {
      // Batched mode: group niches into batches, long pause between batches to avoid Tiki IP ban.
      // Config is read from AppSetting (key "sync_config") — fallback to safe defaults.
      const cfg = await this.readTikiSyncConfig();
      const batchPauseMs = cfg.tikiBatchPauseMin * 60_000;
      const interNicheMs = cfg.tikiInterNicheDelaySec * 1_000;

      this.log.log(
        `[Tiki] Batch sync: ${targets.length} niches, batch=${cfg.tikiBatchSize}, pause=${cfg.tikiBatchPauseMin}min, inter-niche=${cfg.tikiInterNicheDelaySec}s`
      );

      for (let batchStart = 0; batchStart < targets.length; batchStart += cfg.tikiBatchSize) {
        const batchNum = Math.floor(batchStart / cfg.tikiBatchSize) + 1;
        const totalBatches = Math.ceil(targets.length / cfg.tikiBatchSize);
        if (batchStart > 0) {
          this.log.log(`[Tiki] Batch ${batchNum}/${totalBatches}: pausing ${cfg.tikiBatchPauseMin}min to let rate-limit reset...`);
          await sleep(batchPauseMs);
        }
        const batch = targets.slice(batchStart, batchStart + cfg.tikiBatchSize);
        this.log.log(`[Tiki] Batch ${batchNum}/${totalBatches}: syncing ${batch.map((n) => n.name).join(", ")}`);
        for (let i = 0; i < batch.length; i++) {
          if (i > 0) await sleep(interNicheMs);
          reports.push(await runNiche(batch[i]));
        }
      }
    } else {
      for (const niche of targets) {
        reports.push(await runNiche(niche));
      }
    }

    await this.pruneOldPriceHistory();

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

  async syncNiche(niche: NicheConfig, source: SyncSource = "all"): Promise<SyncReport> {
    const start = Date.now();
    this.log.log(`Syncing niche: ${niche.name} [source=${source}]`);

    await this.prisma.category.upsert({
      where: { id: niche.id },
      update: {},
      create: { id: niche.id, name: niche.name, slug: niche.id },
    });

    const runSource = (s: SyncSource) => source === "all" || source === s;

    const [tikiIntegration, lazadaIntegration] = await Promise.all([
      runSource("tiki")   ? this.loadNicheIntegration(niche.id, "tiki")   : Promise.resolve(null),
      runSource("lazada") ? this.loadNicheIntegration(niche.id, "lazada") : Promise.resolve(null),
    ]);
    const [shopeeProducts, atProducts, tikiProducts, lazadaProducts] = await Promise.all([
      runSource("shopee")      ? this.fetchShopeeProducts(niche)                        : Promise.resolve([]),
      runSource("accesstrade") ? this.fetchAccessTradeProducts(niche)                   : Promise.resolve([]),
      runSource("tiki")        ? this.fetchTikiProducts(niche, tikiIntegration)         : Promise.resolve([]),
      runSource("lazada")      ? this.fetchLazadaProducts(niche, lazadaIntegration)     : Promise.resolve([]),
    ]);

    const bySourceRaw: Record<string, FetchedProduct[]> = {
      shopee:      shopeeProducts,
      accesstrade: atProducts,
      tiki:        tikiProducts,
      lazada:      lazadaProducts,
    };
    const fetched = [...shopeeProducts, ...atProducts, ...tikiProducts, ...lazadaProducts];
    const lastPriceMap = await this.fetchLastRecordedPrices(niche.id);

    const priceHistoryBatch: { productId: string; price: number }[] = [];
    let newDeals = 0;
    let skipped = 0;

    for (const p of fetched) {
      if (!this.passesFilter(p, niche.filters)) { skipped++; continue; }

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
      if (discountPct >= niche.filters.min_discount_pct) {
        newDeals++;
      }
    }

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({ data: priceHistoryBatch });
    }

    // Build per-source counts (fetched before filter, skipped = filtered out)
    const bySource: Record<string, SourceCount> = {};
    for (const [src, products] of Object.entries(bySourceRaw)) {
      if (products.length === 0 && source !== "all" && source !== src) continue;
      const srcSkipped = products.filter((p) => !this.passesFilter(p, niche.filters)).length;
      bySource[src] = { fetched: products.length, skipped: srcSkipped };
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
    this.log.log(`[${niche.name}] ${srcSummary || "0 products"} → newDeals=${report.newDeals} priceChanges=${report.priceChanges} skipped=${report.skipped} (${report.durationMs}ms)`);
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

  private async readTikiSyncConfig(): Promise<{ tikiBatchSize: number; tikiBatchPauseMin: number; tikiInterNicheDelaySec: number }> {
    const defaults = { tikiBatchSize: 3, tikiBatchPauseMin: 10, tikiInterNicheDelaySec: 10 };
    try {
      const row = await this.prisma.appSetting.findUnique({ where: { key: "sync_config" } });
      if (!row) return defaults;
      return { ...defaults, ...JSON.parse(row.value) };
    } catch {
      return defaults;
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

  private passesFilter(p: Pick<FetchedProduct, "currentPrice">, filters: { min_price: number; max_price: number }): boolean {
    // currentPrice is stored as cents (VND × 100); filter bounds are in VND — multiply to match
    return p.currentPrice >= filters.min_price * 100 && p.currentPrice <= filters.max_price * 100;
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
        shopeeUrl: p.shopUrl,
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
      this.log.log(`AccessTrade: ${campaigns.length} approved campaigns loaded`);
      await this.slog.info(`Tải danh sách campaign AccessTrade`, SRC, { count: campaigns.length });
      // Persist to DB for admin visibility and offline debugging
      await this.upsertCampaignsToDB(campaigns);
      return campaigns;
    } catch (e: any) {
      this.log.warn(`Failed to load AccessTrade campaigns: ${e.message}`);
      await this.slog.warn(`Không thể tải danh sách campaign AccessTrade`, SRC, { error: e.message });
      return this.atCampaignsCache?.campaigns ?? [];
    }
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
            },
          }),
        ),
      );
    } catch (e: any) {
      this.log.warn(`Failed to persist AT campaigns to DB: ${e.message}`);
    }
  }

  private async resolveCampaignIds(niche: NicheConfig): Promise<string[]> {
    const explicit = niche.accesstrade?.campaign_ids ?? [];
    if (explicit.length > 0) return explicit; // manual override → dùng luôn

    // Auto-discover: lấy tất cả campaign đã duyệt → match theo tên/merchant
    const allCampaigns = await this.getApprovedCampaigns();
    if (allCampaigns.length === 0) return [];

    const keywords = [
      ...(niche.accesstrade?.campaign_keywords ?? []),
      niche.name,   // fallback: tên ngách ("Thời trang", "Điện tử", v.v.)
      niche.id,     // fallback: id ngách ("fashion", "electronics", v.v.)
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

  private async fetchAccessTradeProducts(niche: NicheConfig): Promise<FetchedProduct[]> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY");
    if (!accessKey) return [];

    const campaignIds = await this.resolveCampaignIds(niche);
    if (campaignIds.length === 0) return [];

    const allCampaigns = await this.getApprovedCampaigns();
    const campaigns = allCampaigns.filter((c) => campaignIds.includes(c.id));

    const results = await this.fetchOffersForCampaigns(campaigns, niche);

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
      baseDelayMs: 1200,
      jitterFactor: 0.4,
      blockBackoffMs: 6000,
      loggerName: `DealSync/Tiki/${niche.name}`,
    });
    const tikiHeaders = buildTikiHeaders(this.tikiUaIndex);

    const categoryEntry = TIKI_CATEGORY_IDS[niche.id] ?? null;
    const categoryIds: number[] | null = categoryEntry == null
      ? null
      : Array.isArray(categoryEntry) ? categoryEntry : [categoryEntry];

    // MAX_PAGES: tối đa số trang Tiki mỗi lần sync.
    // Tiki sort=discount_rate:desc → trang đầu = deal ngon nhất.
    // Early-stop khi discount rate page hiện tại < min_discount_pct của ngách.
    const MAX_PAGES = 3; // = 120 sản phẩm/ngách tối đa
    const PAGE_DELAY_MS = 2_000; // delay giữa các trang trong cùng ngách

    if (categoryIds) {
      // ─── Category search với pagination — hỗ trợ nhiều category IDs ───
      // Confirmed working IDs only — không fallback keyword khi trả 0
      // để tránh extra requests cascade block cho các ngách sau.
      for (const categoryId of categoryIds) {
        let totalAvailable = 0;

        for (let page = 1; page <= MAX_PAGES; page++) {
          if (page > 1) await sleep(PAGE_DELAY_MS);
          await fetcher.delay();

          const url = new URL(TIKI_SEARCH_API);
          url.searchParams.set("limit", "40");
          url.searchParams.set("sort", "discount_rate:desc");
          url.searchParams.set("category", String(categoryId));
          url.searchParams.set("page", String(page));

          const { data: body, blocked } = await fetcher.fetchJson(url.toString(), tikiHeaders);
          if (blocked) {
            this.log.warn(`[${niche.name}] Tiki category ${categoryId} blocked at page ${page}`);
            break;
          }
          if (!body) break;

          const paging = (body as any)?.paging ?? {};
          totalAvailable = paging.total ?? totalAvailable;
          // Tiki không luôn trả về last_page — tính từ total nếu thiếu
          const lastPage: number = paging.last_page ?? (totalAvailable > 0 ? Math.ceil(totalAvailable / 40) : page);
          const items: any[] = (body as any)?.data ?? [];
          if (items.length === 0) break;

          // Early-stop: nếu discount rate cao nhất trang này < min_discount_pct → không còn deal ngon
          const minDiscountNeeded = niche.filters.min_discount_pct;
          const pageMaxDiscount = Math.max(...items.map((i: any) => Number(i.discount_rate ?? 0)));
          await this.attachTikiTrackingLinks(items, results, tikiCampaign, niche);

          if (page >= lastPage) break; // hết trang
          if (minDiscountNeeded > 0 && pageMaxDiscount < minDiscountNeeded) {
            this.log.debug(`[${niche.name}] Early-stop at page ${page}: max discount ${pageMaxDiscount}% < threshold ${minDiscountNeeded}%`);
            break;
          }
        }

        if (totalAvailable > 0) {
          this.log.log(`[${niche.name}] Tiki category ${categoryId}: ${results.length} fetched so far / ${totalAvailable} total`);
        }
        if (categoryIds.length > 1) await sleep(PAGE_DELAY_MS); // delay giữa các category
      }
      return results;
    }

    // ─── Keyword search: chỉ cho niches không có category ID xác nhận ───
    // 1 keyword mỗi niche để giảm tổng request rate.
    const keywords = niche.shopee?.keyword_seeds?.slice(0, 1) ?? [niche.name];

    for (const keyword of keywords) {
      const minDiscountNeeded = niche.filters.min_discount_pct;

      for (let page = 1; page <= MAX_PAGES; page++) {
        if (page > 1) await sleep(PAGE_DELAY_MS);
        await fetcher.delay();

        const url = new URL(TIKI_SEARCH_API);
        url.searchParams.set("q", keyword);
        url.searchParams.set("limit", "40");
        url.searchParams.set("sort", "discount_rate:desc");
        url.searchParams.set("page", String(page));

        const { data: body, blocked } = await fetcher.fetchJson(url.toString(), tikiHeaders);
        if (!body || blocked) {
          if (blocked) this.log.warn(`[${niche.name}] Tiki keyword "${keyword}" blocked at page ${page}`);
          break;
        }

        const items: any[] = (body as any)?.data ?? [];
        if (items.length === 0) {
          this.log.debug(`[${niche.name}] Tiki keyword "${keyword}" returned 0 at page ${page} — possible soft-block`);
          break;
        }

        const paging = (body as any)?.paging ?? {};
        const kwTotal: number = paging.total ?? 0;
        const kwLastPage: number = paging.last_page ?? (kwTotal > 0 ? Math.ceil(kwTotal / 40) : page);

        if (page === 1) {
          this.log.log(`[${niche.name}] Tiki keyword "${keyword}": ${items.length} fetched / ${kwTotal} total`);
        }

        const pageMaxDiscount = Math.max(...items.map((i: any) => Number(i.discount_rate ?? 0)));
        await this.attachTikiTrackingLinks(items, results, tikiCampaign, niche);

        if (page >= kwLastPage) break;
        if (minDiscountNeeded > 0 && pageMaxDiscount < minDiscountNeeded) {
          this.log.debug(`[${niche.name}] Keyword early-stop at page ${page}: max discount ${pageMaxDiscount}% < threshold ${minDiscountNeeded}%`);
          break;
        }
      }
    }

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
    const rows = await this.prisma.niche.findMany({
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      shopee: { keyword_seeds: (r.shopeeKeywords as string[]) ?? [] },
      accesstrade: {
        campaign_ids: (r.atCampaignIds as string[]) ?? [],
        campaign_keywords: (r.atKeywords as string[]) ?? [],
      },
      filters: {
        min_discount_pct: r.minDiscountPct,
        min_price: r.minPrice,
        max_price: r.maxPrice,
      },
    }));
  }
}
