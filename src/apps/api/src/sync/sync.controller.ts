import { Controller, Post, Get, Param, Body, Headers, UnauthorizedException, BadRequestException, HttpCode, Logger, InternalServerErrorException } from "@nestjs/common"
import { fetchShopeeProductInfo, fetchLazadaProductInfo } from "./product-url-fetcher"
import { ConfigService } from "@nestjs/config"
import { DealSyncService } from "./deal-sync.service"
import { CouponSyncService } from "./coupon-sync.service"
import { PlatformSyncService } from "../platforms/platform-sync.service"
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client"

@Controller("sync")
export class SyncController {
  private readonly log = new Logger(SyncController.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly dealSync: DealSyncService,
    private readonly couponSync: CouponSyncService,
    private readonly platformSync: PlatformSyncService,
    private readonly atClient: AccessTradePublisherClient,
  ) {}

  private checkAuth(auth: string | undefined): void {
    const secret = this.cfg.get<string>("API_INTERNAL_SECRET")
    if (!secret) return // no secret = open (dev convenience)
    const token = (auth ?? "").replace(/^Bearer\s+/i, "").trim()
    if (token !== secret) throw new UnauthorizedException("Invalid internal token")
  }

  // GET /sync/campaigns/:id/banners — banner images của 1 campaign (live from AT API)
  @Get("campaigns/:id/banners")
  async getCampaignBanners(
    @Param("id") id: string,
    @Headers("authorization") auth: string | undefined,
  ) {
    this.checkAuth(auth)
    if (!id) throw new BadRequestException("campaign id is required")
    const banners = await this.atClient.getBanners(id)
    return { ok: true, banners, total: banners.length }
  }

  // GET /sync/campaigns — danh sách AT campaigns đã approve (từ cache hoặc DB)
  @Get("campaigns")
  async getCampaigns(
    @Headers("authorization") auth: string | undefined,
  ) {
    this.checkAuth(auth)
    const campaigns = await this.dealSync.getApprovedCampaigns()
    return { ok: true, campaigns, total: campaigns.length }
  }

  // POST /sync/deals — fire-and-forget trigger (returns 202 immediately, sync runs in background)
  // Web handler polls GET /sync/status for completion and result.
  @Post("deals")
  @HttpCode(202)
  async triggerDeals(
    @Headers("authorization") auth: string | undefined,
    @Body() body: { niche?: string; source?: string } = {},
  ) {
    this.checkAuth(auth)
    if (this.dealSync.syncStatus.running) {
      return { ok: false, inProgress: true, message: "Sync đang chạy, vui lòng đợi" }
    }
    const rawSource = body.source
    if (!rawSource) {
      throw new BadRequestException(`source is required`)
    }
    const validSlugs = await this.dealSync.getValidSourceSlugs()
    if (!validSlugs.includes(rawSource)) {
      throw new BadRequestException(`source không hợp lệ: "${rawSource}". Các nguồn hợp lệ: ${validSlugs.join(", ")}`)
    }
    const source = rawSource
    // Fire-and-forget: don't await so the HTTP response is sent immediately
    void this.dealSync.triggerSync(body.niche, source, "manual").catch((e: Error) => {
      this.log.error(`[sync/deals] Background sync error: ${e.message}`)
    })
    return { ok: true, started: true, startedAt: new Date().toISOString() }
  }

  // GET /sync/status — poll for sync completion and result
  @Get("status")
  async getSyncStatus(
    @Headers("authorization") auth: string | undefined,
  ) {
    this.checkAuth(auth)
    const s = this.dealSync.syncStatus
    if (s.running) {
      return { ok: true, inProgress: true, result: null }
    }
    if (!s.result) {
      return { ok: true, inProgress: false, result: null }
    }
    const srcLine = Object.entries(s.result.bySource)
      .filter(([, c]) => c.fetched > 0)
      .map(([src, c]) => `${src}:${c.fetched}`)
      .join(", ")
    return {
      ok: true,
      inProgress: false,
      completedAt: s.completedAt?.toISOString(),
      result: {
        ...s.result,
        summary: `${s.result.niches} ngách — ${s.result.fetched} sản phẩm (${srcLine || "0"}), ${s.result.newDeals} deal mới, ${s.result.priceChanges} thay đổi giá`,
      },
    }
  }

  // POST /sync/coupons — trigger coupon/voucher sync
  @Post("coupons")
  @HttpCode(200)
  async triggerCoupons(
    @Headers("authorization") auth: string | undefined,
    @Body() body: { sources?: string } = {},
  ) {
    this.checkAuth(auth)
    const sources = (body.sources ?? "all") as "all" | "accesstrade" | "platforms"
    const result = await this.couponSync.triggerSync(sources)
    return {
      ok: true,
      ...result,
      summary: `${result.total} coupon đã đồng bộ (${sources})`,
    }
  }

  // POST /sync/fetch-product-info — lấy thông tin sản phẩm từ Shopee/Lazada affiliate URL
  @Post("fetch-product-info")
  @HttpCode(200)
  async fetchProductInfo(
    @Headers("authorization") auth: string | undefined,
    @Body() body: { url: string },
  ) {
    this.checkAuth(auth)
    if (!body.url?.trim()) throw new BadRequestException("url is required")

    let hostname: string
    try {
      hostname = new URL(body.url).hostname
    } catch {
      throw new BadRequestException("URL không hợp lệ")
    }

    const source = hostname.includes("shopee") || hostname === "shope.ee" ? "shopee"
      : hostname.includes("lazada") || hostname.includes("accesstrade") ? "lazada"
      : null
    this.log.log(`[fetch-product-info] source=${source ?? "unknown"} url=${body.url}`)

    try {
      if (source === "shopee") {
        const info = await fetchShopeeProductInfo(body.url)
        const priceNote = info.price === 0 ? " price=UNKNOWN(OG fallback)" : ` price=${info.price}`
        this.log.log(`[fetch-product-info] ok name="${info.name}" externalId=${info.externalId}${priceNote}`)
        return { ok: true, info }
      }
      if (source === "lazada") {
        const info = await fetchLazadaProductInfo(body.url)
        this.log.log(`[fetch-product-info] ok name="${info.name}" externalId=${info.externalId}`)
        return { ok: true, info }
      }
      throw new BadRequestException("URL phải từ Shopee hoặc Lazada (shope.ee, s.shopee.vn, lazada.vn, c.lazada.vn, accesstrade.vn)")
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e
      this.log.error(`[fetch-product-info] FAILED source=${source ?? "unknown"} url=${body.url} error=${e?.message}`)
      throw new InternalServerErrorException(e?.message ?? "Không lấy được thông tin sản phẩm")
    }
  }

  // POST /sync/create-at-link — tạo AccessTrade tracking link cho 1 product URL
  @Post("create-at-link")
  @HttpCode(200)
  async createAtLink(
    @Headers("authorization") auth: string | undefined,
    @Body() body: { productUrl: string; campaignId?: string },
  ) {
    this.checkAuth(auth)
    if (!body.productUrl?.trim()) throw new BadRequestException("productUrl is required")
    try {
      const affiliateUrl = await this.dealSync.createAtLinkForProduct(body.productUrl, body.campaignId)
      this.log.log(`[create-at-link] ok url=${body.productUrl} → ${affiliateUrl}`)
      return { ok: true, affiliateUrl }
    } catch (e: any) {
      this.log.error(`[create-at-link] FAILED url=${body.productUrl} error=${e?.message}`)
      if (e instanceof BadRequestException) throw e
      throw new InternalServerErrorException(e?.message ?? "Không tạo được AT link")
    }
  }

  // POST /sync/platform-match — trigger cross-platform product matching
  @Post("platform-match")
  @HttpCode(200)
  async triggerPlatformMatch(
    @Headers("authorization") auth: string | undefined,
  ) {
    this.checkAuth(auth)
    const result = await this.platformSync.triggerMatch()
    const totalMatched = Object.values(result.byPlatform).reduce((s, p) => s + p.matched, 0)
    const totalConfirmed = Object.values(result.byPlatform).reduce((s, p) => s + p.autoConfirmed, 0)
    return {
      ok: true,
      ...result,
      summary: `${totalMatched} sản phẩm matched, ${totalConfirmed} auto-confirmed (${Object.keys(result.byPlatform).join(", ")})`,
    }
  }
}
