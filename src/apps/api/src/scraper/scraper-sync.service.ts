import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PrismaClient } from "@prisma/client"
import type { Trigger } from "../shared/app-log.service"
import { AppLogService } from "../shared/app-log.service"
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client"
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types"
import { ScraperEngine } from "./scraper-engine"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "./scraper.types"

const SRC = "scraper-sync"
const AT_OFFERS_API = "https://api.accesstrade.vn/v1/offers"
const AT_TTL_MS = 4 * 60 * 60 * 1000
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function normalizeSlug(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]+/g, "")
}

function domainSlug(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host.split(".")[0] ?? ""
  } catch { return "" }
}

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
    private readonly accesstrade: AccessTradePublisherClient,
    private readonly cfg: ConfigService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync") }

  // ── Entry point ─────────────────────────────────────────────────────────────

  async syncAll(trigger: Trigger = "manual"): Promise<ScraperSyncResult> {
    const t0 = Date.now()

    const allSources = await this.prisma.syncSource.findMany({ where: { enabled: true } })
    const scraperSources = allSources.filter((s) => {
      try { return (JSON.parse(s.config as string) as ScraperSourceConfig).type === "scraper" }
      catch { return false }
    })

    if (scraperSources.length === 0) {
      return { sources: 0, fetched: 0, newDeals: 0, skipped: 0, durationMs: 0 }
    }

    this.log.log(`[Scraper] Bắt đầu — ${scraperSources.length} nguồn: ${scraperSources.map((s) => s.slug).join(", ")}`)
    await this.slog.info(`Bắt đầu scraper sync`, SRC, { sources: scraperSources.map((s) => s.slug) }, trigger)

    const { campaigns: atCampaigns, atTypeMap } = await this.loadAtCampaigns()

    let totalFetched = 0
    let totalNew = 0
    let totalSkipped = 0

    for (const source of scraperSources) {
      const config = JSON.parse(source.config as string) as ScraperSourceConfig
      const slug = source.slug

      this.log.log(`[${slug}] Bắt đầu — ${source.name}`)
      await this.slog.info(`[${slug}] Bắt đầu scrape source "${source.name}"`, SRC, {}, trigger)

      const { saved, skipped } = await this.syncSource(source.slug, config, atCampaigns, atTypeMap, trigger)
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
    atCampaigns: AccessTradeCampaign[],
    atTypeMap: Map<string, string>,
    trigger: Trigger,
  ): Promise<{ saved: number; skipped: number }> {
    // Step 1: Find matching AT campaign
    const campaign = this.matchAtCampaign(slug, config, atCampaigns)
    if (!campaign) {
      this.log.log(`[${slug}] Không tìm thấy AT campaign — bỏ qua (không có link hoa hồng)`)
      await this.slog.info(`[${slug}] Không tìm thấy AT campaign → bỏ qua`, SRC, {})
      return { saved: 0, skipped: 0 }
    }

    // Step 2: Determine strategy
    const campaignType = atTypeMap.get(campaign.id) ?? "cps"
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
      // Tạo AT tracking link cho từng sản phẩm (CPS strategy)
      this.log.log(`[${slug}] Tạo AT tracking link cho ${products.length} sản phẩm...`)
      affiliateMap = await this.buildAffiliateMap(campaign.id, products)
      const wrapped = [...affiliateMap.entries()].filter(([k, v]) => v !== k).length
      this.log.log(`[${slug}] Wrap AT link: ${wrapped}/${affiliateMap.size} thành công`)
      await this.slog.info(
        `[${slug}] Wrap AT link: ${wrapped}/${affiliateMap.size} — campaign "${campaign.name}"`,
        SRC, { campaign: campaign.name, wrapped, total: affiliateMap.size },
      )
    }

    return this.upsertProducts(products, affiliateMap)
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
          price: Math.round(rawPrice * 100),
          originalPrice: item.original_price ? Math.round(Number(item.original_price) * 100) : undefined,
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

  // ── AT tracking link builder: proven, giống Tiki/deal-sync ──────────────────

  private async buildAffiliateMap(
    campaignId: string,
    products: ScrapedProduct[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const seen = new Set<string>()

    for (const product of products) {
      if (seen.has(product.url)) continue
      seen.add(product.url)

      try {
        const link = await this.accesstrade.createTrackingLink({ campaignId, urls: [product.url] })
        result.set(product.url, link.shortLink ?? link.affiliateLink)
      } catch {
        result.set(product.url, product.url)
      }
    }

    return result
  }

  // ── DB upsert: nơi DUY NHẤT ghi sản phẩm vào DB ────────────────────────────

  private async upsertProducts(
    products: ScrapedProduct[],
    affiliateMap: Map<string, string> | null,
  ): Promise<{ saved: number; skipped: number }> {
    let saved = 0
    let skipped = 0

    for (const p of products) {
      if (!p.name || p.price <= 0 || !p.url) { skipped++; continue }

      const affiliateUrl = affiliateMap?.get(p.url) ?? p.url

      try {
        await this.prisma.category.upsert({
          where: { id: p.nicheSlug },
          update: {},
          create: { id: p.nicheSlug, name: p.nicheSlug, slug: p.nicheSlug },
        })

        await this.prisma.product.upsert({
          where: { source_externalId: { source: p.sourceSlug, externalId: p.externalId } },
          update: {
            categoryId: p.nicheSlug,
            price: p.price,
            productUrl: p.url,
            affiliateUrl,
            lastSyncedAt: new Date(),
            isSoldOut: false,
          },
          create: {
            source: p.sourceSlug,
            externalId: p.externalId,
            name: p.name,
            imageUrl: p.imageUrl,
            imageAlt: p.name,
            productUrl: p.url,
            affiliateUrl,
            price: p.price,
            commission: 0,
            rating: 0,
            categoryId: p.nicheSlug,
          },
        })

        if (p.originalPrice && p.originalPrice > p.price) {
          const discountPct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
          await this.prisma.product.update({
            where: { source_externalId: { source: p.sourceSlug, externalId: p.externalId } },
            data: {
              discountPct: discountPct > 0 ? discountPct : null,
              isFeatured: discountPct >= 40,
            },
          })
        }

        saved++
      } catch (e: any) {
        this.log.warn(`[Scraper] Upsert failed (${p.sourceSlug}/${p.externalId}): ${e.message}`)
        skipped++
      }
    }

    return { saved, skipped }
  }

  // ── AT campaign loader: DB-first 4h TTL ─────────────────────────────────────

  private async loadAtCampaigns(): Promise<{
    campaigns: AccessTradeCampaign[]
    atTypeMap: Map<string, string>
  }> {
    const agg = await this.prisma.atCampaign.aggregate({
      _max: { lastSeenAt: true },
      where: { approval: "successful" },
    })
    const maxLastSeen = agg._max.lastSeenAt
    const isFresh = maxLastSeen && (Date.now() - maxLastSeen.getTime()) < AT_TTL_MS

    if (isFresh) {
      this.log.log(`[Scraper] AT campaigns: DB cache còn hiệu lực (${maxLastSeen!.toISOString()})`)
      const rows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } })
      const campaigns = rows.map((r) => ({
        id: r.id, name: r.name, merchant: r.merchant, url: r.url,
        approval: r.approval, scope: null, cookieDuration: r.cookieDuration ?? null, status: r.status,
      }))
      this.log.log(`[Scraper] AT campaigns: ${campaigns.length} từ DB cache`)
      return { campaigns, atTypeMap: new Map(rows.map((r) => [r.id, r.campaignType ?? "cps"])) }
    }

    const reason = maxLastSeen ? "cache > 4h" : "DB trống"
    this.log.log(`[Scraper] AT campaigns: ${reason} → gọi AT API...`)
    await this.slog.info(`[Scraper] AT campaigns: ${reason} → gọi AT API`, SRC, {})

    let apiCampaigns: AccessTradeCampaign[] = []
    try {
      apiCampaigns = await this.accesstrade.listCampaigns({ approval: "successful" })
      this.log.log(`[Scraper] AT campaigns: tải ${apiCampaigns.length} từ API`)
      await this.slog.info(`[Scraper] AT campaigns: tải ${apiCampaigns.length} từ AT API`, SRC, { count: apiCampaigns.length })
    } catch (e: any) {
      this.log.warn(`[Scraper] AT API lỗi: ${e.message} — dùng DB`)
      const rows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } })
      const campaigns = rows.map((r) => ({
        id: r.id, name: r.name, merchant: r.merchant, url: r.url,
        approval: r.approval, scope: null, cookieDuration: r.cookieDuration ?? null, status: r.status,
      }))
      return { campaigns, atTypeMap: new Map(rows.map((r) => [r.id, r.campaignType ?? "cps"])) }
    }

    if (apiCampaigns.length > 0) {
      const now = new Date()
      await this.prisma.$transaction(
        apiCampaigns.map((c) =>
          this.prisma.atCampaign.upsert({
            where: { id: c.id },
            update: { name: c.name, merchant: c.merchant, url: c.url, approval: c.approval, lastSeenAt: now },
            create: {
              id: c.id, name: c.name, merchant: c.merchant, url: c.url,
              approval: c.approval, status: c.status ?? 0, lastSeenAt: now,
              campaignType: "cps",
            },
          })
        )
      )
      this.log.log(`[Scraper] AT campaigns: upsert ${apiCampaigns.length} vào DB`)
    }

    const rows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } })
    return { campaigns: apiCampaigns, atTypeMap: new Map(rows.map((r) => [r.id, r.campaignType ?? "cps"])) }
  }

  // ── Campaign matcher: 3-tier fallback ───────────────────────────────────────

  private matchAtCampaign(
    sourceSlug: string,
    config: ScraperSourceConfig,
    campaigns: AccessTradeCampaign[],
  ): AccessTradeCampaign | null {
    if (campaigns.length === 0) return null
    const explicit = config.atMerchantSlug?.trim()

    for (const c of campaigns) {
      const merchantNorm = normalizeSlug(c.merchant)
      if (explicit && merchantNorm === explicit) return c
      if (!explicit && merchantNorm === normalizeSlug(sourceSlug)) return c
      if (!explicit && domainSlug(c.url) === sourceSlug) return c
    }

    return null
  }
}
