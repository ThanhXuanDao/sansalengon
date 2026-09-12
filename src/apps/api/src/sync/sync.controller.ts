import { Controller, Post, Body, Headers, UnauthorizedException, HttpCode } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DealSyncService } from "./deal-sync.service"
import { CouponSyncService } from "./coupon-sync.service"
import { PlatformSyncService } from "../platforms/platform-sync.service"

@Controller("sync")
export class SyncController {
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

  // POST /sync/deals — trigger product sync for one niche or all
  @Post("deals")
  @HttpCode(200)
  async triggerDeals(
    @Headers("authorization") auth: string | undefined,
    @Body() body: { niche?: string } = {},
  ) {
    this.checkAuth(auth)
    const result = await this.dealSync.triggerSync(body.niche)
    return {
      ok: true,
      ...result,
      summary: `${result.niches} ngách — ${result.fetched} sản phẩm, ${result.newDeals} deal mới, ${result.priceChanges} thay đổi giá`,
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
