import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaClient, Prisma } from "@prisma/client"
import type { Trigger } from "../shared/app-log.service"
import { AppLogService } from "../shared/app-log.service"
import { AtCampaignService } from "../shared/at-campaign.service"
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types"
import { ScraperEngine } from "./scraper-engine"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "./scraper.types"
import { AT_OFFERS_API, sleep } from "../sync/sync.constants"

const SRC = "scraper-sync"

export interface ScraperSyncResult {
  sources: number
  fetched: number
  newDeals: number
  skipped: number
  durationMs: number
}

// ─── Return type for AT feed fetcher ─────────────────────────────────────────

type AtFeedOutcome =
  | { status: "ok"; products: ScrapedProduct[]; affiliateMap: Map<string, string> }
  | { status: "not_found" }
  | { status: "error"; message: string }

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ScraperSyncService {
  private readonly log = new Logger(ScraperSyncService.name)
  private readonly prisma = new PrismaClient()
  private readonly engine = new ScraperEngine()

  constructor(
    private readonly appLog: AppLogService,
    private readonly cfg: ConfigService,
    private readonly atCampaignSvc: AtCampaignService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync") }

  // ── Entry point ─────────────────────────────────────────────────────────────

  async syncAll(trigger: Trigger = "manual", slugFilter?: string): Promise<ScraperSyncResult> {
    const t0 = Date.now()

    const allSources = await this.prisma.syncSource.findMany({ where: { enabled: true } })
    // "product-scraper" + có categories → ScraperEngine (KingFoodMart, Vascara…)
    // "product-scraper" không có categories → platform API (CellphoneS) → bỏ qua
    let scraperSources = allSources.filter((s) => {
      try {
        const cfg = JSON.parse(s.config as string) as Record<string, unknown>
        return cfg["type"] === "product-scraper" && Array.isArray(cfg["categories"]) && (cfg["categories"] as unknown[]).length > 0
      } catch { return false }
    })

    // Nếu caller chỉ định slug cụ thể (vd: trigger từ 1 source), chỉ chạy source đó
    if (slugFilter) {
      scraperSources = scraperSources.filter((s) => s.slug === slugFilter)
    }

    if (scraperSources.length === 0) {
      return { sources: 0, fetched: 0, newDeals: 0, skipped: 0, durationMs: 0 }
    }

    this.log.log(`[Scraper] Bắt đầu — ${scraperSources.length} nguồn: ${scraperSources.map((s) => s.slug).join(", ")}`)
    await this.slog.info(`Bắt đầu scraper sync`, SRC, { sources: scraperSources.map((s) => s.slug) }, trigger)

    let totalFetched = 0
    let totalNew = 0
    let totalSkipped = 0

    for (const source of scraperSources) {
      const config = JSON.parse(source.config as string) as ScraperSourceConfig
      const slug = source.slug

      this.log.log(`[${slug}] Bắt đầu — ${source.name}`)
      await this.slog.info(`[${slug}] Bắt đầu scrape source "${source.name}"`, SRC, {}, trigger)

      const { saved, skipped } = await this.syncSource(source.slug, config, trigger)
      totalFetched += saved
      totalNew += saved
      totalSkipped += skipped

      this.log.log(`[${slug}] Hoàn tất — ${saved} sản phẩm`)
    }

    const durationMs = Date.now() - t0
    this.log.log(`[Scraper] Xong tất cả — fetched=${totalFetched}, skipped=${totalSkipped}, duration=${durationMs}ms`)
    await this.slog.info(`Hoàn tất scraper sync`, SRC, {
      sources: scraperSources.length, fetched: totalFetched, skipped: totalSkipped, durationMs,
    }, trigger)

    return { sources: scraperSources.length, fetched: totalFetched, newDeals: totalNew, skipped: totalSkipped, durationMs }
  }

  // ── Per-source orchestration ─────────────────────────────────────────────────
  //
  // Flow: find campaign → determine strategy → dispatch to fetcher → run pipeline
  // Adding a new source type = add a new fetchXxx() method + dispatch case here.

  private async syncSource(
    slug: string,
    config: ScraperSourceConfig,
    trigger: Trigger,
  ): Promise<{ saved: number; skipped: number }> {
    // Step 1: Find matching AT campaign (DB-first 4h TTL, same call as syncAll — cached)
    const { campaign, campaignType } = await this.atCampaignSvc.matchCampaign(slug, config.atMerchantSlug)
    if (!campaign) {
      this.log.log(`[${slug}] Không tìm thấy AT campaign — bỏ qua (không có link hoa hồng)`)
      await this.slog.info(`[${slug}] Không tìm thấy AT campaign → bỏ qua`, SRC, {})
      return { saved: 0, skipped: 0 }
    }

    // Step 2: Determine strategy
    const typeLabel = campaignType === "product_feed" ? "product feed (AT /v1/offers)" : "CPS tracking link"
    this.log.log(`[${slug}] AT campaign: "${campaign.name}" — loại: ${typeLabel}`)
    await this.slog.info(
      `[${slug}] AT campaign: "${campaign.name}" — loại: ${typeLabel}`,
      SRC, { campaignId: campaign.id, campaignType },
    )

    // Step 3: Fetch products using the appropriate strategy
    if (campaignType === "product_feed") {
      this.log.log(`[${slug}] Chiến lược: product_feed → gọi AT /v1/offers`)
      await this.slog.info(`[${slug}] Chiến lược: product_feed — nhận sản phẩm + affiliate link từ AT`, SRC, {}, trigger)

      const outcome = await this.fetchFromAtFeed(campaign, slug, config)

      if (outcome.status === "not_found") {
        // AT feed 404 → campaign thực ra là CPS, tự sửa DB + fallback
        this.log.warn(`[${slug}] AT /v1/offers 404 → sửa DB campaignType → "cps", fallback sang scrape + wrap`)
        await this.slog.info(`[${slug}] AT /v1/offers 404 → chuyển sang CPS tracking`, SRC, { campaignId: campaign.id })
        await this.prisma.atCampaign.update({ where: { id: campaign.id }, data: { campaignType: "cps" } }).catch(() => {})
        return this.scrapeAllCategories(campaign, slug, config, trigger)
      }

      if (outcome.status === "error") {
        this.log.error(`[${slug}] AT product feed lỗi: ${outcome.message}`)
        await this.slog.error(`[${slug}] Lỗi AT product feed: ${outcome.message}`, SRC, { error: outcome.message }, trigger)
        return { saved: 0, skipped: 0 }
      }

      // Step 4 + 5: pipeline — affiliate URLs đã có sẵn từ feed, không cần wrap thêm
      return this.runPipeline(outcome.products, campaign, slug, trigger, outcome.affiliateMap)
    }

    // CPS: scrape website + wrap AT tracking link
    this.log.log(`[${slug}] Chiến lược: cps → scrape website + wrap AT tracking link`)
    await this.slog.info(`[${slug}] Chiến lược: cps — scrape platform + bọc AT tracking link`, SRC, {}, trigger)
    return this.scrapeAllCategories(campaign, slug, config, trigger)
  }

  // ── Shared pipeline: wrap links (nếu chưa có) + lưu DB ──────────────────────
  //
  // Đây là nơi DUY NHẤT tạo AT tracking link và upsert products.
  // fetchFromAtFeed truyền prebuiltAffiliateMap → không gọi createTrackingLink.
  // scrapeCategory không truyền → tự động gọi buildAffiliateMap.

  private async runPipeline(
    products: ScrapedProduct[],
    campaign: AccessTradeCampaign,
    slug: string,
    trigger: Trigger,
    prebuiltAffiliateMap?: Map<string, string>,
  ): Promise<{ saved: number; skipped: number }> {
    if (products.length === 0) return { saved: 0, skipped: 0 }

    let affiliateMap = prebuiltAffiliateMap

    if (!affiliateMap) {
      // Tạo AT tracking link — batch 20 URLs/request (qua wrapUrls)
      this.log.log(`[${slug}] Tạo AT tracking link cho ${products.length} sản phẩm...`)
      affiliateMap = await this.atCampaignSvc.wrapUrls(
        campaign.id,
        products.map((p) => p.url),
        { sub1: slug, sub2: "scraper" },
      )
      const wrapped = [...affiliateMap.entries()].filter(([k, v]) => v !== k).length
      this.log.log(`[${slug}] Wrap AT link: ${wrapped}/${affiliateMap.size} thành công`)
      await this.slog.info(
        `[${slug}] Wrap AT link: ${wrapped}/${affiliateMap.size} — campaign "${campaign.name}"`,
        SRC, { campaign: campaign.name, wrapped, total: affiliateMap.size },
      )
    }

    return this.upsertProducts(products, affiliateMap, campaign.logoUrl ?? null, campaign.brandId ?? null, campaign.id)
  }

  // ── Scraper-specific fetcher: loop categories, call scraper engine ────────────
  //
  // Đây là nơi DUY NHẤT biết về config.categories và ScraperEngine.
  // Lỗi chỉ xảy ra ở đây nếu website thay đổi cấu trúc hoặc bị block.

  private async scrapeAllCategories(
    campaign: AccessTradeCampaign,
    slug: string,
    config: ScraperSourceConfig,
    trigger: Trigger,
  ): Promise<{ saved: number; skipped: number }> {
    let saved = 0
    let skipped = 0

    for (let i = 0; i < config.categories.length; i++) {
      const category = config.categories[i]
      if (i > 0) await sleep(config.delayMs ?? 2000)

      try {
        const products = await this.fetchFromScraper(slug, category, config)
        this.log.log(`[${slug}] Category "${category.name ?? category.id}": ${products.length} sản phẩm`)

        const result = await this.runPipeline(products, campaign, slug, trigger)
        saved += result.saved
        skipped += result.skipped

        this.log.log(`[${slug}] Category "${category.name ?? category.id}": lưu ${result.saved}, bỏ qua ${result.skipped}`)
      } catch (e: any) {
        this.log.error(`[${slug}] Category "${category.name ?? category.id}" lỗi: ${e.message}`)
        await this.slog.error(`[${slug}] Lỗi scrape category`, SRC, { category: category.id, error: e.message }, trigger)
      }
    }

    return { saved, skipped }
  }

  // ── AT feed fetcher: chỉ biết về AT /v1/offers API ─────────────────────────
  //
  // Trả về discriminated union — caller xử lý từng trường hợp.
  // Lỗi 404, parse lỗi, thiếu config: tất cả trả về trong return type, không throw.

  private async fetchFromAtFeed(
    campaign: AccessTradeCampaign,
    slug: string,
    config: ScraperSourceConfig,
  ): Promise<AtFeedOutcome> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY")
    if (!accessKey) {
      return { status: "error", message: "Thiếu ACCESSTRADE_ACCESS_KEY" }
    }

    const defaultCategory = config.categories[0]
    const defaultNicheSlug = defaultCategory?.nicheSlug ?? slug
    const defaultCategoryId = defaultCategory?.id ?? slug

    this.log.log(`[${slug}] Gọi AT /v1/offers — campaign "${campaign.name}"...`)

    try {
      const url = `${AT_OFFERS_API}?campaign_id=${encodeURIComponent(campaign.id)}&limit=100`
      const res = await fetch(url, {
        headers: { Authorization: `Token ${accessKey}` },
        signal: AbortSignal.timeout(15_000),
      })

      if (res.status === 404) return { status: "not_found" }
      if (!res.ok) return { status: "error", message: `AT API HTTP ${res.status}` }

      const body: any = await res.json()
      const items: any[] = body?.data ?? body?.offers ?? (Array.isArray(body) ? body : [])

      this.log.log(`[${slug}] AT /v1/offers: ${items.length} offer`)
      await this.slog.info(`[${slug}] AT product feed: ${items.length} offer`, SRC, { count: items.length })

      const products: ScrapedProduct[] = []
      const affiliateMap = new Map<string, string>()

      for (const item of items) {
        const name = item.name ?? item.product_name ?? item.title ?? ""
        if (!name) continue

        const productUrl = String(item.url ?? item.product_url ?? item.link ?? item.landing_url ?? "")
        if (!productUrl) continue

        const affiliateUrl = String(item.aff_link ?? item.affiliateLink ?? item.affiliate_link ?? item.short_link ?? productUrl)
        const rawPrice = Number(item.price ?? item.sale_price ?? item.current_price ?? 0)
        if (rawPrice <= 0) continue

        const externalId = String(
          item.id ?? item.product_id ?? item.offer_id ??
          `${campaign.id}-${Buffer.from(productUrl).toString("base64").slice(0, 16)}`,
        )

        products.push({
          sourceSlug: slug,
          categoryId: defaultCategoryId,
          nicheSlug: defaultNicheSlug,
          externalId,
          name: String(name).slice(0, 255),
          url: productUrl,
          imageUrl: String(item.image ?? item.image_url ?? item.thumbnail ?? ""),
          price: Math.round(rawPrice),
          originalPrice: item.original_price ? Math.round(Number(item.original_price)) : undefined,
          inStock: true,
        })

        if (affiliateUrl !== productUrl) {
          affiliateMap.set(productUrl, affiliateUrl)
        }
      }

      this.log.log(`[${slug}] AT feed parse xong: ${products.length} sản phẩm, ${affiliateMap.size} có affiliate URL`)
      return { status: "ok", products, affiliateMap }
    } catch (e: any) {
      return { status: "error", message: e.message }
    }
  }

  // ── Scraper engine fetcher: chỉ biết về ScraperEngine ───────────────────────
  //
  // Wrapper gọn — lỗi ở đây = website thay đổi cấu trúc hoặc bị block.
  // scrapeAllCategories bắt exception từ hàm này và log riêng.

  private async fetchFromScraper(
    slug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    this.log.log(`[${slug}] Lấy sản phẩm từ category: ${category.name ?? category.id}...`)
    return this.engine.scrapeCategory(slug, category, config)
  }

  // ── DB upsert: nơi DUY NHẤT ghi sản phẩm vào DB ────────────────────────────
  //
  // Dùng batch INSERT ... ON CONFLICT DO UPDATE để tối thiểu round-trips tới Supabase.
  // 120 sản phẩm = 3 queries (findMany + 1 INSERT batch + createMany price history)
  // thay vì 120+ queries tuần tự trước đó.

  private async upsertProducts(
    products: ScrapedProduct[],
    affiliateMap: Map<string, string> | null,
    sourceLogoUrl: string | null = null,
    brandId: string | null = null,
    atCampaignId: string | null = null,
  ): Promise<{ saved: number; skipped: number }> {
    const valid = products.filter((p) => p.name && p.price > 0 && p.url)
    const invalidCount = products.length - valid.length
    if (valid.length === 0) return { saved: 0, skipped: invalidCount }

    // Load giá hiện tại để phát hiện thay đổi — 1 query
    const existing = await this.prisma.product.findMany({
      where: { OR: valid.map((p) => ({ source: p.sourceSlug, externalId: p.externalId })) },
      select: { source: true, externalId: true, price: true },
    })
    const lastPriceMap = new Map(existing.map((p) => [`${p.source}:${p.externalId}`, p.price]))
    const validMap = new Map(valid.map((p) => [`${p.sourceSlug}:${p.externalId}`, p]))

    const now = new Date()
    const CHUNK = 100
    const allUpserted: { id: string; source: string; externalId: string }[] = []
    let skipped = invalidCount

    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK)
      try {
        const rows = chunk.map((p) => {
          const affiliateUrl = affiliateMap?.get(p.url) ?? p.url
          const discountPct = (p.originalPrice && p.originalPrice > p.price)
            ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
            : null
          const isSoldOut = p.inStock !== undefined ? !p.inStock : false
          return Prisma.sql`(
            ${p.sourceSlug}, ${p.externalId}, ${p.name.slice(0, 255)},
            ${p.imageUrl}, ${p.name.slice(0, 255)}, ${p.url}, ${affiliateUrl},
            ${p.price}, ${p.originalPrice ?? null}, ${0}, ${0},
            ${p.nicheSlug}, ${sourceLogoUrl}, ${discountPct},
            ${discountPct != null && discountPct >= 40}, ${isSoldOut},
            ${brandId}, ${atCampaignId}, ${now}
          )`
        })

        // 1 round-trip cho toàn bộ chunk — ON CONFLICT DO UPDATE thay thế loop upsert
        const upserted = await this.prisma.$queryRaw<{ id: string; source: string; externalId: string }[]>`
          INSERT INTO "Product" (
            source, "externalId", name, "imageUrl", "imageAlt", "productUrl", "affiliateUrl",
            price, "originalPrice", commission, rating, "categoryId", "sourceLogoUrl",
            "discountPct", "isFeatured", "isSoldOut", "brandId", "atCampaignId", "createdAt"
          )
          VALUES ${Prisma.join(rows)}
          ON CONFLICT (source, "externalId") DO UPDATE SET
            name            = EXCLUDED.name,
            "categoryId"    = EXCLUDED."categoryId",
            price           = EXCLUDED.price,
            "originalPrice" = EXCLUDED."originalPrice",
            "productUrl"    = EXCLUDED."productUrl",
            "affiliateUrl"  = EXCLUDED."affiliateUrl",
            "lastSyncedAt"  = NOW(),
            "discountPct"   = EXCLUDED."discountPct",
            "isSoldOut"     = EXCLUDED."isSoldOut",
            "sourceLogoUrl" = COALESCE(EXCLUDED."sourceLogoUrl", "Product"."sourceLogoUrl"),
            "brandId"       = COALESCE(EXCLUDED."brandId",       "Product"."brandId"),
            "atCampaignId"  = COALESCE(EXCLUDED."atCampaignId",  "Product"."atCampaignId")
          RETURNING id, source, "externalId"
        `
        allUpserted.push(...upserted)
      } catch (e: any) {
        this.log.warn(`[Scraper] Batch upsert chunk ${Math.floor(i / CHUNK) + 1} thất bại: ${e.message}`)
        skipped += chunk.length
      }
    }

    // Batch price history — 1 query
    const priceHistoryBatch = allUpserted
      .filter((u) => {
        const lastPrice = lastPriceMap.get(`${u.source}:${u.externalId}`)
        const newPrice = validMap.get(`${u.source}:${u.externalId}`)?.price
        return newPrice !== undefined && lastPrice !== newPrice
      })
      .map((u) => ({
        productId: u.id,
        price: validMap.get(`${u.source}:${u.externalId}`)!.price,
      }))

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({ data: priceHistoryBatch })
      this.log.log(`[Scraper] PriceHistory: ${priceHistoryBatch.length} thay đổi giá ghi nhận`)
    }

    return { saved: allUpserted.length, skipped }
  }

  // ── AT campaign loader: DB-first 4h TTL ─────────────────────────────────────

}
