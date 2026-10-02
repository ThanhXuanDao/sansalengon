import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { ConfigService } from "@nestjs/config"
import type { Trigger } from "../shared/app-log.service"
import { AppLogService } from "../shared/app-log.service"
import { AtCampaignService } from "../shared/at-campaign.service"
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types"
import type { FetchedProduct } from "./sync.constants"
import { AT_OFFERS_API, sleep } from "./sync.constants"

const SRC = "at-feed-sync"

interface NicheConfig { id: string; name: string }

export interface ATFeedSyncResult {
  niches: number
  fetched: number
  priceChanges: number
  newDeals: number
  skipped: number
  durationMs: number
}

// ─── Status ───────────────────────────────────────────────────────────────────

export interface ATFeedSyncStatus {
  running: boolean
  completedAt: Date | null
  result: ATFeedSyncResult | null
}

// ─────────────────────────────────────────────────────────────────────────────
// ATFeedSyncService — lấy sản phẩm từ AccessTrade /v1/offers (offer-sync type)
//
// Mỗi source có type = "offer-sync" sẽ dùng service này.
// Source vẫn là tên platform (lazada, sendo…); dữ liệu lấy từ AT product feed.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ATFeedSyncService {
  private readonly log = new Logger(ATFeedSyncService.name)
  private readonly prisma = new PrismaClient()

  syncRunning = false
  syncStatus: ATFeedSyncStatus = { running: false, completedAt: null, result: null }

  constructor(
    private readonly cfg: ConfigService,
    private readonly appLog: AppLogService,
    private readonly atCampaignSvc: AtCampaignService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync") }

  async syncSource(
    slug: string,
    trigger: Trigger = "manual",
    nicheId?: string,
  ): Promise<ATFeedSyncResult> {
    if (this.syncRunning) {
      this.log.warn(`[${slug}] offer-sync đang chạy — bỏ qua`)
      return { niches: 0, fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0, durationMs: 0 }
    }
    this.syncRunning = true
    this.syncStatus.running = true
    this.syncStatus.result = null

    try {
      const t0 = Date.now()
      const allNiches = await this.loadActiveNiches()
      const targets = (nicheId && nicheId !== "all")
        ? allNiches.filter((n) => n.id === nicheId)
        : allNiches

      this.log.log(`[${slug}] offer-sync: ${targets.length} ngách`)
      await this.slog.info(`[${slug}] Bắt đầu offer-sync`, SRC, { slug, niches: targets.map((n) => n.id) }, trigger)

      let totalFetched = 0, priceChanges = 0, newDeals = 0, skipped = 0

      for (const niche of targets) {
        try {
          const r = await this.syncNiche(niche, slug)
          totalFetched += r.fetched
          priceChanges += r.priceChanges
          newDeals += r.newDeals
          skipped += r.skipped
        } catch (e: any) {
          this.log.error(`[${slug}] Niche "${niche.id}" lỗi: ${e.message}`)
        }
      }

      const result: ATFeedSyncResult = {
        niches: targets.length, fetched: totalFetched,
        priceChanges, newDeals, skipped, durationMs: Date.now() - t0,
      }

      this.log.log(`[${slug}] offer-sync hoàn tất: ${totalFetched} sản phẩm, ${newDeals} mới, ${priceChanges} thay đổi giá`)
      await this.slog.info(`[${slug}] offer-sync hoàn tất`, SRC, result, trigger)

      this.syncStatus.result = result
      this.syncStatus.completedAt = new Date()
      return result
    } finally {
      this.syncRunning = false
      this.syncStatus.running = false
    }
  }

  private async syncNiche(
    niche: NicheConfig,
    slug: string,
  ): Promise<{ fetched: number; priceChanges: number; newDeals: number; skipped: number }> {
    const campaignIds = await this.resolveCampaignIds(niche)
    if (campaignIds.length === 0) {
      this.log.debug(`[${slug}] Ngách: ${niche.name} — không match campaign nào`)
      return { fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0 }
    }

    const { campaigns, typeMap } = await this.atCampaignSvc.getCampaigns()
    const feedCampaigns = campaigns.filter(
      (c) => campaignIds.includes(c.id) && typeMap.get(c.id) !== "tracking",
    )
    if (feedCampaigns.length === 0) return { fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0 }

    this.log.log(`[${slug}] Ngách: ${niche.name} — ${feedCampaigns.length} campaign(s)`)
    const offers = await this.fetchOffersForCampaigns(feedCampaigns, niche)
    if (offers.length === 0) return { fetched: 0, priceChanges: 0, newDeals: 0, skipped: 0 }

    // Load giá hiện tại để detect thay đổi
    const existing = await this.prisma.product.findMany({
      where: { OR: offers.map((o) => ({ source: o.source, externalId: o.externalId })) },
      select: { id: true, source: true, externalId: true, price: true },
    })
    const lastPriceMap = new Map<string, { id: string; source: string; externalId: string; price: number }>(
      existing.map((p) => [`${p.source}:${p.externalId}`, p]),
    )

    let fetched = 0, priceChanges = 0, newDeals = 0, skipped = 0
    const priceHistoryBatch: { productId: string; price: number }[] = []

    for (const offer of offers) {
      try {
        const product = await this.upsertProduct(offer, niche.id)
        const prev = lastPriceMap.get(`${offer.source}:${offer.externalId}`)
        if (!prev) {
          newDeals++
        } else if (prev.price !== offer.currentPrice) {
          priceHistoryBatch.push({ productId: product.id, price: offer.currentPrice })
          priceChanges++
        }
        fetched++
      } catch {
        skipped++
      }
    }

    if (priceHistoryBatch.length > 0) {
      await this.prisma.priceHistory.createMany({ data: priceHistoryBatch })
      this.log.log(`[${slug}] PriceHistory: ${priceHistoryBatch.length} thay đổi giá`)
    }

    return { fetched, priceChanges, newDeals, skipped }
  }

  private async resolveCampaignIds(niche: NicheConfig): Promise<string[]> {
    const { campaigns } = await this.atCampaignSvc.getCampaigns()
    if (campaigns.length === 0) return []

    const keywords = [niche.name, niche.id].map((k) => k.toLowerCase().trim()).filter(Boolean)
    const matched = campaigns.filter((c) =>
      keywords.some((kw) =>
        c.name.toLowerCase().includes(kw) || c.merchant.toLowerCase().includes(kw),
      ),
    )

    if (matched.length > 0) {
      this.log.log(`[${niche.name}] Matched ${matched.length} campaign(s): ${matched.map((c) => c.name).join(", ")}`)
    }

    return matched.map((c) => c.id)
  }

  async fetchOffersForCampaigns(
    campaigns: AccessTradeCampaign[],
    niche: NicheConfig,
  ): Promise<FetchedProduct[]> {
    const accessKey = this.cfg.get<string>("ACCESSTRADE_ACCESS_KEY")
    if (!accessKey) return []

    const results: FetchedProduct[] = []

    for (let i = 0; i < campaigns.length; i++) {
      const campaign = campaigns[i]
      if (i > 0) await sleep(1500)

      try {
        const url = new URL(AT_OFFERS_API)
        url.searchParams.set("campaign_id", campaign.id)
        url.searchParams.set("limit", "50")

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Token ${accessKey}` },
          signal: AbortSignal.timeout(15_000),
        })
        if (res.status === 404) continue
        if (res.status === 429) break
        if (!res.ok) continue

        const body = await res.json()
        const items: any[] = body?.data ?? body?.offers ?? (Array.isArray(body) ? body : [])

        for (const item of items) {
          const offer = this.parseOffer(item, campaign.id)
          if (!offer) continue
          offer.affiliateUrl = await this.atCampaignSvc.wrapUrl(
            campaign.id, offer.shopUrl, { sub1: niche.id, sub2: "at-feed" },
          )
          results.push(offer)
          await sleep(300)
        }
      } catch (e: any) {
        this.log.warn(`AT /v1/offers lỗi campaign "${campaign.id}": ${e.message}`)
      }
    }

    return results
  }

  private parseOffer(item: any, campaignId: string): FetchedProduct | null {
    try {
      const name = item.name ?? item.product_name ?? item.title ?? ""
      if (!name) return null

      const shopUrl = item.url ?? item.product_url ?? item.link ?? item.landing_url ?? ""
      if (!shopUrl) return null

      const rawPrice = Number(item.price ?? item.sale_price ?? item.current_price ?? 0)
      if (rawPrice <= 0) return null

      const externalId = String(
        item.id ?? item.product_id ?? item.offer_id ??
        `${campaignId}-${Buffer.from(String(shopUrl)).toString("base64").slice(0, 16)}`,
      )

      return {
        externalId,
        source: "accesstrade",
        name: String(name).slice(0, 255),
        imageUrl: item.image ?? item.image_url ?? item.thumbnail ?? "",
        shopUrl: String(shopUrl),
        affiliateUrl: String(shopUrl),
        currentPrice: Math.round(rawPrice),
        originalPrice: item.original_price ? Math.round(Number(item.original_price)) : null,
        commissionRate: Number(item.commission_rate ?? item.commission ?? 0),
        rating: item.rating ? Number(item.rating) : null,
      }
    } catch {
      return null
    }
  }

  private async upsertProduct(offer: FetchedProduct, categoryId: string) {
    return this.prisma.product.upsert({
      where: { source_externalId: { source: offer.source, externalId: offer.externalId } },
      update: {
        name: offer.name,
        categoryId,
        price: offer.currentPrice,
        originalPrice: offer.originalPrice ?? null,
        affiliateUrl: offer.affiliateUrl,
        lastSyncedAt: new Date(),
      },
      create: {
        source: offer.source,
        externalId: offer.externalId,
        name: offer.name,
        imageUrl: offer.imageUrl,
        imageAlt: offer.name,
        productUrl: offer.shopUrl,
        affiliateUrl: offer.affiliateUrl,
        price: offer.currentPrice,
        originalPrice: offer.originalPrice ?? null,
        commission: Math.round(offer.commissionRate),
        rating: offer.rating ?? 0,
        categoryId,
      },
      select: { id: true },
    })
  }

  private async loadActiveNiches(): Promise<NicheConfig[]> {
    const rows = await this.prisma.category.findMany({ where: { status: "active" } })
    return rows.map((r) => ({ id: r.id, name: r.name }))
  }
}
