import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import type { Trigger } from "../shared/app-log.service"
import { AppLogService } from "../shared/app-log.service"
import { AtCampaignService } from "../shared/at-campaign.service"

const SRC = "lead-campaign-sync"

export interface LeadSyncResult {
  slug: string
  campaignId: string | null
  affiliateUrl: string | null
  durationMs: number
}

export interface LeadSyncStatus {
  running: boolean
  completedAt: Date | null
  result: LeadSyncResult | null
}

// ─────────────────────────────────────────────────────────────────────────────
// LeadCampaignSyncService — xử lý nguồn type = "lead-campaign"
//
// Lead campaign là CPS service campaign (ngân hàng, bảo hiểm, spa...):
//   - Không có product feed
//   - Landing page ổn định, cookie duration > 0
//
// Nhiệm vụ: match AT campaign → tạo tracking link → upsert vào Coupon
//   (discountType = "lead", discountValue = 0) để public site hiển thị.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class LeadCampaignSyncService {
  private readonly log = new Logger(LeadCampaignSyncService.name)
  private readonly prisma = new PrismaClient()

  syncRunning = false
  syncStatus: LeadSyncStatus = { running: false, completedAt: null, result: null }

  constructor(
    private readonly appLog: AppLogService,
    private readonly atCampaignSvc: AtCampaignService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync") }

  async syncSource(slug: string, trigger: Trigger = "manual"): Promise<LeadSyncResult> {
    if (this.syncRunning) {
      this.log.warn(`[${slug}] lead-campaign sync đang chạy — bỏ qua`)
      return { slug, campaignId: null, affiliateUrl: null, durationMs: 0 }
    }
    this.syncRunning = true
    this.syncStatus.running = true
    this.syncStatus.result = null

    const t0 = Date.now()

    try {
      const src = await this.prisma.syncSource.findFirst({
        where: { slug },
        select: { config: true, name: true, description: true },
      })
      if (!src) {
        this.log.warn(`[${slug}] Không tìm thấy SyncSource`)
        return { slug, campaignId: null, affiliateUrl: null, durationMs: Date.now() - t0 }
      }

      let config: Record<string, any> = {}
      try { config = JSON.parse(src.config as string) } catch { /* giữ nguyên */ }

      const atMerchantSlug: string | undefined = config.atMerchantSlug
      const landingUrl: string | undefined = config.landingUrl
      const nicheId: string | undefined = config.nicheId

      if (!landingUrl) {
        this.log.warn(`[${slug}] Config thiếu landingUrl`)
        return { slug, campaignId: null, affiliateUrl: null, durationMs: Date.now() - t0 }
      }

      const { campaign } = await this.atCampaignSvc.matchCampaign(slug, atMerchantSlug)
      if (!campaign) {
        this.log.warn(`[${slug}] Không match được AT campaign (merchant: ${atMerchantSlug ?? slug})`)
        await this.slog.warn(`[${slug}] Không match AT campaign`, SRC, { slug, atMerchantSlug }, trigger)
        await this.prisma.syncSource.update({
          where: { slug },
          data: { lastRunAt: new Date(), lastRunStatus: "no_campaign" },
        }).catch(() => {})
        return { slug, campaignId: null, affiliateUrl: null, durationMs: Date.now() - t0 }
      }

      this.log.log(`[${slug}] Matched campaign: "${campaign.name}" (${campaign.id})`)

      // fixedAffiliateUrl: link AT đã được tạo sẵn (e.g. referral link cá nhân) — dùng thẳng, không wrap lại
      const fixedAffiliateUrl: string | undefined = config.fixedAffiliateUrl
      // Dùng campaign.url (AT đã whitelist) để wrap; landingUrl chỉ là fallback hiển thị
      const urlToWrap = campaign.url ?? landingUrl
      const affiliateUrl = fixedAffiliateUrl
        ?? await this.atCampaignSvc.wrapUrl(campaign.id, urlToWrap, { sub1: slug, sub2: "lead" })

      // Upsert vào Coupon (discountType = "lead") để public site query được
      const couponId = `lead_${campaign.id}`
      const cookieDays = campaign.cookieDuration ? Math.round(campaign.cookieDuration / 86400) : null
      const terms = [
        campaign.commission ? `Hoa hồng: ${campaign.commission}` : null,
        cookieDays ? `Cookie: ${cookieDays} ngày` : null,
      ].filter(Boolean).join(" | ") || null

      // src.description = user-facing copy (từ seed); AT campaign.description là nội bộ cho affiliate
      const userDescription = src.description ?? campaign.description ?? src.name

      await this.prisma.coupon.upsert({
        where: { id: couponId },
        update: {
          affiliateUrl,
          description: userDescription,
          merchantLogo: campaign.logoUrl ?? null,
          terms,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          id: couponId,
          source: "accesstrade",
          platform: slug,
          externalId: campaign.id,
          nicheId: nicheId ?? null,
          merchant: campaign.name,
          merchantLogo: campaign.logoUrl ?? null,
          code: null,
          description: userDescription,
          discountValue: 0,
          discountType: "lead",
          affiliateUrl,
          imageUrl: (config.imageUrl as string | undefined) ?? campaign.logoUrl ?? null,
          terms,
          isActive: true,
          updatedAt: new Date(),
        },
      })

      // Cập nhật lastRunAt/Status trên SyncSource (không ghi data vào config)
      await this.prisma.syncSource.update({
        where: { slug },
        data: { lastRunAt: new Date(), lastRunStatus: "success" },
      })

      this.log.log(`[${slug}] Coupon upserted: ${couponId} → ${affiliateUrl}`)
      await this.slog.info(`[${slug}] lead-campaign synced`, SRC, {
        slug, campaignId: campaign.id, couponId, affiliateUrl,
      }, trigger)

      const result: LeadSyncResult = { slug, campaignId: campaign.id, affiliateUrl, durationMs: Date.now() - t0 }
      this.syncStatus.result = result
      this.syncStatus.completedAt = new Date()
      return result
    } catch (e: any) {
      this.log.error(`[${slug}] Lỗi: ${e.message}`)
      await this.prisma.syncSource.update({
        where: { slug },
        data: { lastRunAt: new Date(), lastRunStatus: "error" },
      }).catch(() => {})
      return { slug, campaignId: null, affiliateUrl: null, durationMs: Date.now() - t0 }
    } finally {
      this.syncRunning = false
      this.syncStatus.running = false
    }
  }
}
