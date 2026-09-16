import { Controller, Post, Get, Body, Headers, UnauthorizedException, HttpCode, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DealSyncService } from "./deal-sync.service"
import { CouponSyncService } from "./coupon-sync.service"
import { PlatformSyncService } from "../platforms/platform-sync.service"

@Controller("sync")
export class SyncController {
  private readonly log = new Logger(SyncController.name);

  constructor(
    private readonly cfg: ConfigService,
    private readonly dealSync: DealSyncService,
    private readonly couponSync: CouponSyncService,
    private readonly platformSync: PlatformSyncService,
  ) {}

  private checkAuth(auth: string | undefined): void {
    const secret = this.cfg.get<string>("API_INTERNAL_SECRET")
    if (!secret) return // no secret = open (dev convenience)
    const token = (auth ?? "").replace(/^Bearer\s+/i, "").trim()
    if (token !== secret) throw new UnauthorizedException("Invalid internal token")
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
    const source = (["all", "shopee", "accesstrade", "tiki", "lazada"].includes(body.source ?? ""))
      ? (body.source as "all" | "shopee" | "accesstrade" | "tiki" | "lazada")
      : "all"
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
