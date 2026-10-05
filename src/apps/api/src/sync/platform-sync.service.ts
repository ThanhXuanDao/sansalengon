import { Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client";
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types";
import { LazadaAdapter } from "../platforms/lazada/lazada.adapter";
import type { NormalizedProduct } from "../platforms/platform.adapter";
import { AppLogService } from "../shared/app-log.service";
import type { Trigger } from "../shared/app-log.service";
import { AtCampaignService } from "../shared/at-campaign.service";
import { BotSafeFetcher } from "../shared/bot-safe-fetcher";
import { ScraperSyncService } from "../scraper/scraper-sync.service"
import { GraphQLSyncService } from "./graphql-sync.service"
import type { GraphQLProduct } from "./graphql-sync.service";
import { ATFeedSyncService } from "./at-feed-sync.service"
import { sleep } from "./sync.constants"
import type { AffiliateStrategy, ExtensionProduct, FetchedProduct, SyncSourceConfig } from "./sync.constants"

interface NicheConfig {
  id: string;
  name: string;
  status: string;
}

interface NicheIntegration {
  enabled: boolean;
  atEnabled: boolean;
  directEnabled: boolean;
  directFallback: boolean;
  campaignId: string | null;
}

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
const SRC = "deal-sync"
// ── Lazada constants ─────────────────────────────────────────────────────────
const LAZADA_DEFAULT_PAGE_SIZE = 40;
const LAZADA_DEFAULT_MAX_KEYWORDS = 5;
const LAZADA_INTER_KEYWORD_DELAY_MS = 1500;

// ── Shopee flash sale constants ──────────────────────────────────────────────
const SHOPEE_FLASH_SESSIONS_API = "https://shopee.vn/api/v4/flash_sale/get_all_sessions";
const SHOPEE_FLASH_ITEMS_API = "https://shopee.vn/api/v4/flash_sale/flash_sale_get_items";
const SHOPEE_CDN_BASE = "https://cf.shopee.vn/file";
const SHOPEE_PRODUCT_BASE = "https://shopee.vn";
const SHOPEE_PRICE_DIVISOR = 100_000;
const SHOPEE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const SHOPEE_DEFAULT_MAX_SESSIONS = 3;
const SHOPEE_DEFAULT_ITEMS_PER_SESSION = 20;
const SHOPEE_SESSIONS_FETCH_TIMEOUT_MS = 15_000;
const SHOPEE_ITEMS_FETCH_TIMEOUT_MS = 20_000;
const SHOPEE_AT_SUB1 = "shopee-flash";
const SHOPEE_AT_SUB2 = "web";

// Keyword defaults — dùng khi source config không override shopeeNicheKeywords
// Key = category.id trong DB, value = mảng từ khoá substring-match trên tên sản phẩm
const SHOPEE_DEFAULT_NICHE_KEYWORDS: Record<string, string[]> = {
  electronics: ["tai nghe", "earphone", "headphone", "điện thoại", "smartphone", "laptop", "máy tính", "iphone", "samsung", "xiaomi", "oppo", "sạc dự phòng", "pin dự phòng", "cáp usb", "chuột gaming", "bàn phím"],
  fashion:     ["váy", "quần áo", "áo thun", "áo khoác", "giày", "dép", "túi xách", "ví da", "balo", "nón", "mũ lưỡi trai"],
  beauty:      ["son môi", "kem dưỡng", "serum", "toner", "mặt nạ", "nước hoa", "sữa rửa mặt", "kem chống nắng", "mascara", "phấn nền", "mỹ phẩm"],
  food:        ["bánh", "kẹo", "snack", "sữa tươi", "nước uống", "trà", "cà phê", "thực phẩm", "gạo", "dầu ăn", "mì gói", "bún", "phở"],
  kids:        ["sữa bột", "bỉm tã", "đồ chơi", "xe đẩy em bé", "quần áo trẻ em", "mẹ bầu"],
  sports:      ["tạ dumbbell", "thảm yoga", "xe đạp thể thao", "vợt cầu lông", "bóng đá", "gym", "dây kháng lực", "giày chạy bộ"],
  home:        ["nồi chiên", "chảo", "bếp điện", "tủ lạnh", "máy giặt", "quạt điện", "điều hòa", "đèn led", "nội thất", "giường", "sofa"],
  health:      ["vitamin", "thực phẩm chức năng", "khẩu trang", "nhiệt kế", "sức khỏe", "omega"],
  pets:        ["thức ăn chó", "thức ăn mèo", "thú cưng", "phụ kiện chó", "phụ kiện mèo"],
};

interface ShopeeFlashSaleSession {
  promotionid: string;
  name: string;
  start_time: number;
  end_time: number;
}

interface ShopeeFlashSaleItem {
  itemid: number;
  shopid: number;
  name: string;
  image: string;
  price: number;
  price_before_discount: number;
  raw_discount: number;
  item_rating: { rating_star: number } | null;
}

// "product-scraper" → ScraperSyncService (KingFoodMart, Vascara — scrape HTML/Next.js)
function isScraperSource(cfg: SyncSourceConfig): boolean {
  return cfg.type === "product-scraper"
}

function graphQLProductToFetched(p: GraphQLProduct): FetchedProduct {
  return {
    externalId: p.externalId,
    source: p.source,
    name: p.name,
    imageUrl: p.imageUrl,
    shopUrl: p.shopUrl,
    affiliateUrl: p.affiliateUrl,
    currentPrice: p.currentPrice,
    originalPrice: p.originalPrice,
    commissionRate: p.commissionRate,
    rating: p.rating,
  }
}

const TIKI_SEARCH_API = "https://tiki.vn/api/v2/products";
const TIKI_PRODUCT_BASE = "https://tiki.vn";


// Tiki category IDs được cấu hình trong SyncSource (slug="tiki") config.categoryIds.
// Key = niche slug, value = mảng category ID Tiki.
// Niches không có entry → keyword search tự động.

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

// ── Shopee flash sale helpers ────────────────────────────────────────────────

function buildShopeeProductUrl(name: string, shopid: number, itemid: number): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${SHOPEE_PRODUCT_BASE}/${slug}-i.${shopid}.${itemid}`;
}

function inferNicheFromProductName(name: string, keywords: Record<string, string[]>): string | null {
  const n = name.toLowerCase();
  for (const [nicheId, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => n.includes(kw.toLowerCase()))) return nicheId;
  }
  return null;
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
export class PlatformSyncService {
  private readonly log = new Logger(PlatformSyncService.name);
  private readonly prisma = new PrismaClient();
  // UA rotation index — incremented before retry pass so blocked niches use different fingerprint
  private tikiUaIndex = 0;
  // Set to true khi phát hiện IP bị Tiki ban toàn bộ trong một run
  private tikiIpBanned = false;
  // Concurrency guard + status snapshot for web polling
  private syncRunning = false;
  readonly syncStatus: SyncStatusPayload = { running: false, completedAt: null, result: null };

  constructor(
    private readonly cfg: ConfigService,
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly lazada: LazadaAdapter,
    private readonly appLog: AppLogService,
    private readonly scraperSync: ScraperSyncService,
    private readonly graphQLSync: GraphQLSyncService,
    private readonly atCampaignSvc: AtCampaignService,
    private readonly atFeedSync: ATFeedSyncService,
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

    if (!isScraperSource(sourceConfig)) {
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

    // Shopee flash sale: không iterate theo niche — chạy một lần, tự infer niche per product
    if (source === "shopee") {
      const report = await this.syncShopeeFlashSale(sourceConfig, trigger);
      const result = { niches: 1, fetched: report.fetched, priceChanges: report.priceChanges, newDeals: report.newDeals, skipped: report.skipped, durationMs: report.durationMs, bySource: report.bySource };
      this.syncStatus.result = result;
      this.syncStatus.completedAt = new Date();
      return result;
    }

    const allNiches = await this.loadActiveNiches();
    const targets = (nicheId && nicheId !== "all")
      ? allNiches.filter((n) => n.id === nicheId)
      : allNiches;

    if (!isScraperSource(sourceConfig)) {
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
    if (isScraperSource(sourceConfig)) {
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

    if (isScraperSource(sourceConfig)) {
      this.log.log(`[${source}] Chạy scraper sync...`);
      const scraperResult = await this.scraperSync.syncAll(trigger, source);
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

    const [tikiProducts, lazadaProducts, cellphonesProducts] = await Promise.all([
      runSource("tiki")        ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Tiki...`),        this.fetchTikiProducts(niche, tikiIntegration))  : Promise.resolve([]),
      runSource("lazada")      ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy Lazada...`),      this.fetchLazadaProducts(niche, lazadaIntegration)) : Promise.resolve([]),
      runSource("cellphones") && cellphonesIntegration?.enabled ? (this.log.log(`[${source}] Ngách: ${niche.name} — lấy CellphoneS...`), this.graphQLSync.fetchForNiche(niche, atCampaign ?? null).then((ps) => ps.map(graphQLProductToFetched))) : Promise.resolve([]),
    ]);

    const bySourceRaw: Record<string, FetchedProduct[]> = {
      tiki:       tikiProducts,
      lazada:     lazadaProducts,
      cellphones: cellphonesProducts,
    };
    const fetched = [...tikiProducts, ...lazadaProducts, ...cellphonesProducts];
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

  // ── Shopee affiliate URL helpers ────────────────────────────────────────────

  /** Build Shopee an_redir affiliate link từ shopee.vn product URL + affiliate ID */
  private buildShopeeDirectUrl(productUrl: string, affiliateId: string, sub1: string): string {
    const params = new URLSearchParams({ origin_link: productUrl, pid: affiliateId, sub_id: sub1 })
    return `https://s.shopee.vn/an_redir?${params}`
  }

  /**
   * Resolve affiliate URL map cho danh sách sản phẩm Shopee.
   *
   * Hai chế độ (đọc từ sourceConfig.shopeeLinkMode, mặc định "at"):
   *   "at"     → wrapUrls qua AccessTrade campaign
   *   "direct" → build s.shopee.vn/an_redir với SHOPEE_AFFILIATE_ID
   *
   * Trả về:
   *   urlMap     — Map<shopUrl, affiliateUrl>
   *   campaignId — AT campaign ID (null nếu direct mode)
   *   fatal      — true nếu AT mode không tìm được campaign (caller nên abort)
   */
  private async resolveShopeeAffiliateUrls(
    shopUrls: string[],
    sourceConfig: SyncSourceConfig,
    trigger: Trigger,
    sub1: string,
    sub2: string,
  ): Promise<{ urlMap: Map<string, string>; campaign: AccessTradeCampaign | null; fatal: boolean }> {
    const linkMode = sourceConfig.shopeeLinkMode ?? "at"
    const rawMap = () => new Map(shopUrls.map((u) => [u, u]))

    if (linkMode === "direct") {
      const affiliateId =
        sourceConfig.shopeeAffiliateId ?? this.cfg.get<string>("SHOPEE_AFFILIATE_ID") ?? ""
      if (!affiliateId) {
        this.log.warn("[Shopee] shopeeLinkMode=direct nhưng SHOPEE_AFFILIATE_ID chưa set — dùng raw URL")
        return { urlMap: rawMap(), campaign: null, fatal: false }
      }
      const urlMap = new Map(shopUrls.map((u) => [u, this.buildShopeeDirectUrl(u, affiliateId, sub1)]))
      this.log.log(`[Shopee] direct mode — affiliate ID: ${affiliateId.slice(0, 6)}*** (${urlMap.size} links)`)
      return { urlMap, campaign: null, fatal: false }
    }

    // AT mode
    const { campaign, campaignType } = await this.findCampaignForSource("shopee", sourceConfig.atCampaignId, true)
    if (!campaign) {
      this.log.warn("[Shopee] AT mode: không tìm thấy AT campaign")
      await this.slog.warn("[Shopee] Không tìm thấy AT campaign", SRC, {}, trigger)
      return { urlMap: rawMap(), campaign: null, fatal: true }
    }
    if (campaignType !== "tracking") {
      this.log.warn(`[Shopee] Campaign "${campaign.name}" (${campaign.id}) không phải tracking type — wrapUrls có thể thất bại`)
    }
    this.log.log(`[Shopee] AT campaign: "${campaign.name}" (${campaign.id})`)
    try {
      const urlMap = await this.atCampaignSvc.wrapUrls(campaign.id, shopUrls, { sub1, sub2 })
      return { urlMap, campaign, fatal: false }
    } catch (e: any) {
      this.log.error(`[Shopee] wrapUrls thất bại: ${e.message}`)
      await this.slog.error("[Shopee] wrapUrls thất bại", SRC, { error: e.message }, trigger)
      return { urlMap: rawMap(), campaign, fatal: true }
    }
  }

  // ── Shopee flash sale sync ───────────────────────────────────────────────

  private async syncShopeeFlashSale(
    sourceConfig: SyncSourceConfig,
    trigger: Trigger = "manual",
  ): Promise<SyncReport> {
    const start = Date.now();
    const maxSessions = sourceConfig.shopeeMaxSessions ?? SHOPEE_DEFAULT_MAX_SESSIONS;
    const itemsPerSession = sourceConfig.shopeeItemsPerSession ?? SHOPEE_DEFAULT_ITEMS_PER_SESSION;
    const nicheKeywords = sourceConfig.shopeeNicheKeywords ?? SHOPEE_DEFAULT_NICHE_KEYWORDS;

    this.log.log(`[Shopee] Flash sale sync — maxSessions=${maxSessions}, items/session=${itemsPerSession}`);

    this.log.log(`[Shopee] linkMode=${sourceConfig.shopeeLinkMode ?? "at"}`);

    // Fetch flash sale sessions
    let sessions: ShopeeFlashSaleSession[];
    try {
      sessions = await this.getShopeeFlashSaleSessions();
    } catch (e: any) {
      this.log.error(`[Shopee] Lấy flash sale sessions thất bại: ${e.message}`);
      await this.slog.error("[Shopee] Lấy flash sale sessions thất bại", SRC, { error: e.message }, trigger);
      return { niche: "shopee", fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: Date.now() - start, bySource: {} };
    }
    if (sessions.length === 0) {
      this.log.warn("[Shopee] Không có flash sale session nào đang chạy");
      return { niche: "shopee", fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: Date.now() - start, bySource: {} };
    }

    // Collect unique items across target sessions (deduplicate by itemid)
    const targetSessions = sessions.slice(0, maxSessions);
    const itemMap = new Map<number, ShopeeFlashSaleItem>();
    for (const session of targetSessions) {
      try {
        const items = await this.getShopeeFlashSaleItems(session.promotionid, itemsPerSession);
        for (const item of items) {
          if (!itemMap.has(item.itemid)) itemMap.set(item.itemid, item);
        }
        this.log.log(`[Shopee] Session "${session.name}": ${items.length} items`);
      } catch (e: any) {
        this.log.warn(`[Shopee] Session ${session.promotionid} ("${session.name}") thất bại: ${e.message}`);
      }
    }

    const uniqueItems = [...itemMap.values()];
    if (uniqueItems.length === 0) {
      this.log.warn("[Shopee] Không lấy được sản phẩm flash sale nào");
      return { niche: "shopee", fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: Date.now() - start, bySource: {} };
    }
    this.log.log(`[Shopee] ${uniqueItems.length} sản phẩm unique từ ${targetSessions.length} session(s)`);

    // Resolve affiliate URLs (AT wrap hoặc Shopee direct — tuỳ sourceConfig.shopeeLinkMode)
    const shopUrls = uniqueItems.map((i) => buildShopeeProductUrl(i.name, i.shopid, i.itemid));
    const { urlMap, campaign, fatal } = await this.resolveShopeeAffiliateUrls(shopUrls, sourceConfig, trigger, SHOPEE_AT_SUB1, SHOPEE_AT_SUB2);
    if (fatal) {
      return { niche: "shopee", fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: Date.now() - start, bySource: {} };
    }

    // Resolve active niches for category inference
    const allNiches = await this.loadActiveNiches();
    const nicheIds = new Set(allNiches.map((n) => n.id));
    const defaultNicheId = sourceConfig.shopeeDefaultNicheId ?? allNiches[0]?.id ?? allNiches[0]?.id;
    if (!defaultNicheId) {
      this.log.error("[Shopee] Không có niche nào active — bỏ qua sync");
      return { niche: "shopee", fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: Date.now() - start, bySource: {} };
    }

    // Build FetchedProduct list — each product infers its own niche
    const products: FetchedProduct[] = uniqueItems.map((item, idx) => {
      const shopUrl = shopUrls[idx];
      const affiliateUrl = urlMap.get(shopUrl) ?? shopUrl;
      const currentPrice = Math.round(item.price / SHOPEE_PRICE_DIVISOR);
      const rawOriginal = item.price_before_discount ?? 0;
      const originalPrice = rawOriginal > item.price ? Math.round(rawOriginal / SHOPEE_PRICE_DIVISOR) : null;
      const discountPct = item.raw_discount > 0 ? item.raw_discount : undefined;
      const inferredNiche = inferNicheFromProductName(item.name, nicheKeywords);
      const categoryId = (inferredNiche && nicheIds.has(inferredNiche)) ? inferredNiche : defaultNicheId;

      return {
        externalId: `${item.shopid}_${item.itemid}`,
        source: "shopee" as const,
        name: item.name.slice(0, 255),
        imageUrl: item.image ? `${SHOPEE_CDN_BASE}/${item.image}` : "",
        shopUrl,
        affiliateUrl,
        currentPrice,
        originalPrice,
        discountPct,
        commissionRate: 0,
        rating: item.item_rating?.rating_star ?? null,
        atCampaignId: campaign?.id,
        categoryId,
      };
    });

    // Upsert all products + track price changes / new deals
    const lastPriceMap = await this.fetchLastRecordedPricesBySource("shopee");
    const priceHistoryBatch: { productId: string; price: number }[] = [];
    let newDeals = 0;
    let skipped = 0;

    for (const p of products) {
      try {
        const product = await this.upsertProduct(p, defaultNicheId, campaign?.logoUrl ?? null, campaign?.brandId ?? null, campaign?.id ?? null);
        const lastPrice = lastPriceMap.get(product.id);
        if (lastPrice !== p.currentPrice) {
          priceHistoryBatch.push({ productId: product.id, price: p.currentPrice });
        }
        const discountPct = (p.discountPct != null && p.discountPct > 0)
          ? p.discountPct
          : (p.originalPrice && p.originalPrice > p.currentPrice
              ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
              : 0);
        await this.prisma.product.update({ where: { id: product.id }, data: { discountPct } });
        if (lastPrice === undefined) newDeals++;
      } catch (e: any) {
        this.log.warn(`[Shopee] Upsert thất bại ${p.externalId}: ${e.message}`);
        skipped++;
      }
    }

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({
        data: priceHistoryBatch.map((r) => ({ ...r, recordedAt: new Date() })),
        skipDuplicates: true,
      });
    }

    await this.pruneOldPriceHistory();

    const durationMs = Date.now() - start;
    const fetched = products.length - skipped;
    this.log.log(`[Shopee] Hoàn tất — ${fetched} sản phẩm, ${newDeals} mới, ${priceHistoryBatch.length} thay đổi giá, ${skipped} bỏ qua (${durationMs}ms)`);
    await this.slog.info("[Shopee] Flash sale sync hoàn tất", SRC, { fetched, newDeals, priceChanges: priceHistoryBatch.length, skipped, durationMs }, trigger);

    return {
      niche: "shopee",
      fetched,
      priceChanges: priceHistoryBatch.length,
      newDeals,
      skipped,
      durationMs,
      bySource: { shopee: { fetched, skipped } },
    };
  }

  private async getShopeeFlashSaleSessions(): Promise<ShopeeFlashSaleSession[]> {
    const res = await fetch(SHOPEE_FLASH_SESSIONS_API, {
      headers: {
        "User-Agent": SHOPEE_UA,
        "Accept": "application/json",
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Referer": "https://shopee.vn/flash_sale",
        "x-api-source": "pc",
        "x-shopee-language": "vi",
      },
      signal: AbortSignal.timeout(SHOPEE_SESSIONS_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data?: { sessions?: ShopeeFlashSaleSession[] } };
    return json.data?.sessions ?? [];
  }

  private async getShopeeFlashSaleItems(promotionId: string, limit: number): Promise<ShopeeFlashSaleItem[]> {
    const url = new URL(SHOPEE_FLASH_ITEMS_API);
    url.searchParams.set("promotionid", promotionId);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", "0");
    url.searchParams.set("need_personalize", "false");
    url.searchParams.set("with_dp_items", "true");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": SHOPEE_UA,
        "Accept": "application/json",
        "Accept-Language": "vi-VN,vi;q=0.9",
        "Referer": `https://shopee.vn/flash_sale`,
        "x-api-source": "pc",
        "x-shopee-language": "vi",
      },
      signal: AbortSignal.timeout(SHOPEE_ITEMS_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data?: { items?: ShopeeFlashSaleItem[] } };
    return (json.data?.items ?? []).filter((i) => i.itemid && i.name && i.price > 0);
  }

  private async fetchLastRecordedPricesBySource(source: string): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<{ productId: string; price: number }[]>`
      SELECT DISTINCT ON (ph."productId") ph."productId", ph.price
      FROM "PriceHistory" ph
      INNER JOIN "Product" p ON p.id = ph."productId"
      WHERE p.source = ${source}
      ORDER BY ph."productId", ph."recordedAt" DESC
    `;
    return new Map(rows.map((r) => [r.productId, r.price]));
  }


  private async upsertProduct(
    p: FetchedProduct,
    categoryId: string,
    sourceLogoUrl: string | null = null,
    brandId: string | null = null,
    atCampaignId: string | null = null,
  ) {
    // Per-product overrides take precedence over outer sync context
    const resolvedCategoryId = p.categoryId ?? categoryId;
    const resolvedAtCampaignId = p.atCampaignId ?? atCampaignId;

    return this.prisma.product.upsert({
      where: { source_externalId: { source: p.source, externalId: p.externalId } },
      update: {
        name: p.name,
        productUrl: p.shopUrl,
        categoryId: resolvedCategoryId,
        price: p.currentPrice,
        originalPrice: p.originalPrice ?? null,
        affiliateUrl: p.affiliateUrl,
        lastSyncedAt: new Date(),
        isSoldOut: false,
        ...(sourceLogoUrl && { sourceLogoUrl }),
        ...(brandId && { brandId }),
        ...(resolvedAtCampaignId && { atCampaignId: resolvedAtCampaignId }),
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
        categoryId: resolvedCategoryId,
        sourceLogoUrl,
        ...(brandId && { brandId }),
        ...(resolvedAtCampaignId && { atCampaignId: resolvedAtCampaignId }),
      },
    });
  }

  // Bulk capture từ Chrome extension — nhận danh sách sản phẩm Shopee đã parse sẵn,
  // wrap URL qua AT rồi upsert vào DB. Không cần scraper, không cần browser session.
  async extensionBulkCapture(products: ExtensionProduct[]): Promise<{
    saved: number;
    total: number;
    errors: string[];
    campaignId: string | null;
  }> {
    if (products.length === 0) return { saved: 0, total: 0, errors: [], campaignId: null };

    this.log.log(`[ext-bulk] Nhận ${products.length} sản phẩm từ extension`);

    // Resolve categories từ DB (dùng chung logic với flash sale sync)
    const dbCategories = await this.prisma.category.findMany({ select: { id: true, name: true } });
    const nicheIds = new Set(dbCategories.map((c) => c.id));
    const defaultNicheId = dbCategories[0]?.id ?? "shopee";

    // Load shopee source config để đọc shopeeLinkMode
    const shopeeSource = await this.prisma.syncSource.findFirst({
      where: { slug: "shopee" },
      select: { config: true },
    });
    let shopeeSourceConfig: SyncSourceConfig = {};
    try {
      shopeeSourceConfig = shopeeSource?.config ? JSON.parse(shopeeSource.config as string) : {};
    } catch { /* malformed config — dùng defaults */ }

    // Extension có thể config độc lập với flash sale (extensionLinkMode / extensionAtCampaignId)
    // Nếu không set → kế thừa shopeeLinkMode / atCampaignId của source
    const extConfig: SyncSourceConfig = {
      ...shopeeSourceConfig,
      ...(shopeeSourceConfig.extensionLinkMode !== undefined && { shopeeLinkMode: shopeeSourceConfig.extensionLinkMode }),
      ...(shopeeSourceConfig.extensionAtCampaignId !== undefined && { atCampaignId: shopeeSourceConfig.extensionAtCampaignId }),
    };

    this.log.log(`[ext-bulk] linkMode=${extConfig.shopeeLinkMode ?? "at"} campaign=${extConfig.atCampaignId ?? "auto"}`);

    // Resolve affiliate URLs (AT wrap hoặc Shopee direct — tuỳ source config)
    const shopUrls = products.map((p) => p.url);
    const { urlMap, campaign } = await this.resolveShopeeAffiliateUrls(shopUrls, extConfig, "manual", "ext-bulk", "ext");

    let saved = 0;
    const errors: string[] = [];

    for (const p of products) {
      try {
        const externalId = `${p.shopId}_${p.itemId}`;
        const affiliateUrl = urlMap.get(p.url) ?? p.url;
        const inferredNiche = inferNicheFromProductName(p.name, SHOPEE_DEFAULT_NICHE_KEYWORDS);
        const categoryId = inferredNiche && nicheIds.has(inferredNiche) ? inferredNiche : defaultNicheId;

        const fetchedProduct: FetchedProduct = {
          externalId,
          source: "shopee",
          name: p.name.slice(0, 255),
          imageUrl: p.image,
          shopUrl: p.url,
          affiliateUrl,
          currentPrice: p.price,
          originalPrice: p.originalPrice ?? null,
          discountPct: p.discountPct ?? undefined,
          commissionRate: 0,
          rating: p.rating ?? null,
          categoryId,
          atCampaignId: campaign?.id,
        };
        await this.upsertProduct(fetchedProduct, categoryId, null, null, campaign?.id ?? null);
        if (p.isFlashSale) {
          await this.prisma.product.updateMany({
            where: { source: "shopee", externalId },
            data: { isFeatured: true },
          });
        }
        saved++;
      } catch (e: any) {
        const label = `${p.name.slice(0, 30)} (${p.itemId})`;
        errors.push(`${label}: ${e?.message ?? "error"}`);
        this.log.warn(`[ext-bulk] upsert thất bại ${p.itemId}: ${e?.message}`);
      }
    }

    this.log.log(`[ext-bulk] Hoàn tất: ${saved}/${products.length} saved, ${errors.length} errors, campaign=${campaign?.id ?? "none"}`);
    return { saved, total: products.length, errors, campaignId: campaign?.id ?? null };
  }

  // Tạo AT tracking link cho 1 product URL đơn lẻ (dùng từ admin form).
  // Source slug + atCampaignId lấy từ SyncSource DB — không hardcode.
  // Delegate campaign resolution về findCampaignForSource (logic dùng chung với auto-sync).
  async createAtLinkForProduct(productUrl: string, campaignId?: string): Promise<{ affiliateUrl: string; campaignId: string }> {
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
      const { campaigns: all } = await this.atCampaignSvc.getCampaigns()
      throw new Error(
        `Không tìm thấy AT campaign cho "${sourceSlug}". Các campaign hiện có: ${all.map((c) => c.name).join(", ") || "không có"}`,
      )
    }

    this.log.log(`[create-at-link] campaign="${campaign.name}" id=${campaign.id} url=${productUrl}`)
    const affiliateUrl = await this.atCampaignSvc.wrapUrl(campaign.id, productUrl, { sub1: "manual" })
    return { affiliateUrl, campaignId: campaign.id }
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

  // Tìm AT campaign phù hợp với source slug (theo tên/merchant) + trả về campaignType từ DB
  // preferTracking=true: ưu tiên campaign loại "tracking" (Smartlink) — dùng cho flash sale URL wrapping
  private async findCampaignForSource(
    sourceSlug: string,
    atCampaignIdOverride?: string,
    preferTracking = false,
  ): Promise<{ campaign: AccessTradeCampaign | null; campaignType: "product" | "tracking" }> {
    this.log.log(`[${sourceSlug}] Lấy danh sách AT campaign (DB-first 4h TTL)...`);
    const { campaigns, typeMap } = await this.atCampaignSvc.getCampaigns()
    this.log.log(`[${sourceSlug}] Tổng ${campaigns.length} AT campaign approved`);
    if (campaigns.length === 0) return { campaign: null, campaignType: "product" };

    // Explicit override từ config — dùng trực tiếp, không ưu tiên theo loại
    if (atCampaignIdOverride) {
      const found = campaigns.find((c) => c.id === atCampaignIdOverride);
      if (found) return { campaign: found, campaignType: (typeMap.get(found.id) ?? "product") as "product" | "tracking" };
    }

    // Auto-match: slug hoặc tên slug (dấu gạch ngang → khoảng trắng)
    const slugVariants = [sourceSlug, sourceSlug.replace(/-/g, " ")].map((s) => s.toLowerCase());
    const allMatched = campaigns.filter((c) => {
      const lower = `${c.name} ${c.merchant}`.toLowerCase();
      return slugVariants.some((v) => lower.includes(v));
    });

    if (allMatched.length === 0) return { campaign: null, campaignType: "product" };

    // Nếu preferTracking: ưu tiên campaign có campaignType="tracking" (Smartlink)
    // vì /product_link/create chỉ hoạt động đúng với tracking campaign
    if (preferTracking) {
      const trackingCampaign = allMatched.find((c) => (typeMap.get(c.id) ?? "") === "tracking");
      if (trackingCampaign) {
        this.log.log(`[${sourceSlug}] Dùng tracking campaign "${trackingCampaign.name}" (id=${trackingCampaign.id})`);
        return { campaign: trackingCampaign, campaignType: "tracking" };
      }
      this.log.warn(`[${sourceSlug}] Không tìm thấy tracking campaign — dùng campaign đầu tiên "${allMatched[0].name}" (loại=${typeMap.get(allMatched[0].id) ?? "?"})`);
    }

    const matched = allMatched[0];
    return {
      campaign: matched,
      campaignType: (typeMap.get(matched.id) ?? "product") as "product" | "tracking",
    };
  }

  // Chiến lược affiliate dựa vào config nguồn + loại AT campaign
  private resolveAffiliateStrategy(
    sourceSlug: string,
    config: SyncSourceConfig,
    campaignType: "product" | "tracking",
  ): AffiliateStrategy {
    if (config.hasDirectAffiliate) return "direct";
    if (sourceSlug === "lazada" && !config.atCampaignId) return "direct";
    return "at_wrap";
  }


  // ── Lazada integration ──────────────────────────────────────────────────────

  private async fetchLazadaProducts(niche: NicheConfig, _integration: NicheIntegration | null): Promise<FetchedProduct[]> {
    const config = await this.readLazadaConfig();

    if (config.syncMode === "at") {
      const { campaigns: allCampaigns } = await this.atCampaignSvc.getCampaigns()
      const lazadaCampaigns = allCampaigns.filter((c) =>
        c.name.toLowerCase().includes("lazada") ||
        c.merchant.toLowerCase().includes("lazada"),
      );
      if (lazadaCampaigns.length === 0) {
        this.log.warn(`[Lazada] Không có AT campaign Lazada — bỏ qua ngách "${niche.name}"`);
        return [];
      }
      const results = await this.atFeedSync.fetchOffersForCampaigns(lazadaCampaigns, niche);
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
      const { campaigns: allCampaigns } = await this.atCampaignSvc.getCampaigns()
      const tikiCampaigns = tikiCampaignId
        ? allCampaigns.filter((c) => c.id === tikiCampaignId)
        : allCampaigns.filter((c) =>
            c.name.toLowerCase().includes("tiki") ||
            c.merchant.toLowerCase().includes("tiki"),
          );

      if (tikiCampaigns.length > 0) {
        atResults = await this.atFeedSync.fetchOffersForCampaigns(tikiCampaigns, niche);
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

  private async fetchTikiDirect(niche: NicheConfig, integration: NicheIntegration): Promise<FetchedProduct[]> {
    const results: FetchedProduct[] = [];

    // Tìm Tiki AT campaign để tạo tracking link nếu có
    const { campaigns: allCampaigns } = await this.atCampaignSvc.getCampaigns()
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
    const keywords = [niche.name];

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
        parsed.affiliateUrl = await this.atCampaignSvc.wrapUrl(
          tikiCampaign.id, parsed.shopUrl, { sub1: niche.id, sub2: "tiki-direct" },
        );
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


  async loadActiveNiches(): Promise<NicheConfig[]> {
    const rows = await this.prisma.category.findMany({
      where: { status: "active", syncEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({ id: r.id, name: r.name, status: r.status }));
  }
}
