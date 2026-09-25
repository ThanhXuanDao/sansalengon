import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import { AccessTradePublisherClient } from "../affiliate/accesstrade/client"
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types"

const AT_TTL_MS = 4 * 60 * 60 * 1000 // 4 giờ

export interface AtCampaignBundle {
  campaigns: AccessTradeCampaign[]
  // campaignId → "cps" | "product_feed" | "tracking" (tuỳ từng service dùng)
  typeMap: Map<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────
// AtCampaignService — single source of truth cho AT campaign loading
//
// Tất cả service (DealSync, ScraperSync, GraphQLSync, CouponSync) đều dùng chung.
// Quy tắc: DB-first 4h TTL → gọi AT API khi cần refresh → upsert brands + campaigns
//           → đánh dấu expired → trigger scrapeOgImages async.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AtCampaignService {
  private readonly log = new Logger(AtCampaignService.name)
  private readonly prisma = new PrismaClient()

  constructor(private readonly accesstrade: AccessTradePublisherClient) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  // DB-first 4h TTL: trả về campaigns + typeMap.
  // Gọi AT API để refresh khi cache hết hạn hoặc DB trống.
  async getCampaigns(): Promise<AtCampaignBundle> {
    const agg = await this.prisma.atCampaign.aggregate({
      _max: { lastSeenAt: true },
      where: { approval: "successful" },
    })
    const maxLastSeen = agg._max.lastSeenAt
    const isFresh = maxLastSeen && (Date.now() - maxLastSeen.getTime()) < AT_TTL_MS

    if (isFresh) {
      this.log.log(`AT campaigns: DB cache còn hiệu lực (${maxLastSeen!.toISOString()})`)
      return this.readFromDB()
    }

    const reason = maxLastSeen ? "cache > 4h" : "DB trống"
    this.log.log(`AT campaigns: ${reason} → gọi AT API...`)

    let apiCampaigns: AccessTradeCampaign[] = []
    try {
      apiCampaigns = await this.accesstrade.listCampaigns({ approval: "successful" })
      this.log.log(`AT campaigns: tải ${apiCampaigns.length} từ AT API`)
    } catch (e: any) {
      this.log.warn(`AT API lỗi: ${e.message} — dùng DB`)
      return this.readFromDB()
    }

    if (apiCampaigns.length > 0) {
      await this.refreshDB(apiCampaigns)
      void this.scrapeOgImages(apiCampaigns).catch((e: Error) =>
        this.log.warn(`scrapeOgImages failed: ${e.message}`)
      )
    }

    return this.readFromDB()
  }

  // Wrap một URL với AT tracking link — fallback về raw URL nếu lỗi
  async wrapUrl(
    campaignId: string,
    url: string,
    subIds?: { sub1?: string; sub2?: string },
  ): Promise<string> {
    try {
      const link = await this.accesstrade.createTrackingLink({ campaignId, urls: [url], subIds })
      return link.shortLink ?? link.affiliateLink
    } catch {
      return url
    }
  }

  // Wrap nhiều URL — dedup, serial, fallback về raw URL nếu lỗi
  async wrapUrls(
    campaignId: string,
    urls: string[],
    subIds?: { sub1?: string; sub2?: string },
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    const seen = new Set<string>()
    for (const url of urls) {
      if (seen.has(url)) continue
      seen.add(url)
      result.set(url, await this.wrapUrl(campaignId, url, subIds))
    }
    return result
  }

  // Tìm campaign khớp với source slug hoặc atMerchantSlug
  async matchCampaign(
    sourceSlug: string,
    atMerchantSlug?: string,
  ): Promise<{ campaign: AccessTradeCampaign | null; campaignType: string }> {
    const { campaigns, typeMap } = await this.getCampaigns()
    if (campaigns.length === 0) return { campaign: null, campaignType: "cps" }

    const explicit = atMerchantSlug ? normalizeSlug(atMerchantSlug) : null
    const slugNorm = normalizeSlug(sourceSlug)

    const matched = campaigns.find((c) => {
      const merchantNorm = normalizeSlug(c.merchant)
      if (explicit) return merchantNorm === explicit
      if (merchantNorm === slugNorm) return true
      if (domainSlug(c.url) === sourceSlug) return true
      return false
    })

    return {
      campaign: matched ?? null,
      campaignType: matched ? (typeMap.get(matched.id) ?? "cps") : "cps",
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async readFromDB(): Promise<AtCampaignBundle> {
    const rows = await this.prisma.atCampaign.findMany({ where: { approval: "successful" } })
    const campaigns: AccessTradeCampaign[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      merchant: r.merchant,
      url: r.url,
      approval: r.approval,
      scope: null,
      cookieDuration: r.cookieDuration ?? null,
      status: r.status,
      logoUrl: r.logoUrl ?? null,
      description: r.description ?? null,
      category: r.category ?? null,
      commission: r.commission ?? null,
      brandId: r.brandId ?? null,
    }))
    const typeMap = new Map<string, string>(rows.map((r) => [r.id, r.campaignType ?? "cps"]))
    this.log.log(`AT campaigns: ${campaigns.length} từ DB`)
    return { campaigns, typeMap }
  }

  private async refreshDB(campaigns: AccessTradeCampaign[]): Promise<void> {
    const now = new Date()

    // 1. Upsert Brand cho mỗi merchant (chỉ tạo mới, không override name thủ công)
    const uniqueMerchants = [...new Set(campaigns.map((c) => c.merchant))]
    const merchantBrandId = new Map<string, string>()
    for (const merchant of uniqueMerchants) {
      const slug = toBrandSlug(merchant)
      const firstCampaign = campaigns.find((c) => c.merchant === merchant)
      try {
        const brand = await this.prisma.brand.upsert({
          where: { slug },
          update: { name: merchant, ...(firstCampaign?.logoUrl && { logoUrl: firstCampaign.logoUrl }) },
          create: { name: merchant, slug, logoUrl: firstCampaign?.logoUrl ?? null },
          select: { id: true },
        })
        merchantBrandId.set(merchant, brand.id)
      } catch (e: any) {
        this.log.warn(`Không upsert được brand "${merchant}": ${e.message}`)
      }
    }

    // 2. Upsert AtCampaign rows
    try {
      await this.prisma.$transaction(
        campaigns.map((c) => {
          const brandId = merchantBrandId.get(c.merchant) ?? null
          const detectedType = detectCampaignType(c.name, c.merchant)
          return this.prisma.atCampaign.upsert({
            where: { id: c.id },
            update: {
              name: c.name,
              merchant: c.merchant,
              url: c.url,
              approval: c.approval,
              cookieDuration: c.cookieDuration ?? null,
              status: c.status,
              lastSeenAt: now,
              ...(brandId && { brandId }),
              ...(c.logoUrl !== undefined && { logoUrl: c.logoUrl }),
              ...(c.description !== undefined && { description: c.description }),
              ...(c.category !== undefined && { category: c.category }),
              ...(c.commission !== undefined && { commission: c.commission }),
              // chỉ promote lên "tracking" — không tự demote, bảo toàn setting thủ công
              ...(detectedType === "tracking" && { campaignType: "tracking" }),
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
              campaignType: detectedType,
              logoUrl: c.logoUrl ?? null,
              description: c.description ?? null,
              category: c.category ?? null,
              commission: c.commission ?? null,
              ...(brandId && { brandId }),
            },
          })
        }),
      )
      this.log.log(`AT campaigns: upsert ${campaigns.length} vào DB`)
    } catch (e: any) {
      this.log.warn(`Không upsert được AT campaigns: ${e.message}`)
    }

    // 3. Mark campaigns không còn trong AT response → "ended"
    try {
      const activeIds = campaigns.map((c) => c.id)
      const { count } = await this.prisma.atCampaign.updateMany({
        where: { approval: "successful", id: { notIn: activeIds } },
        data: { approval: "ended" },
      })
      if (count > 0) this.log.log(`AT campaigns: đánh dấu ${count} campaign hết hạn`)
    } catch (e: any) {
      this.log.warn(`Không thể mark expired campaigns: ${e.message}`)
    }
  }

  private async scrapeOgImages(campaigns: AccessTradeCampaign[]): Promise<void> {
    const needScrape = await this.prisma.atCampaign.findMany({
      where: { id: { in: campaigns.map((c) => c.id) }, ogImageUrl: null },
      select: { id: true, url: true },
    })
    if (needScrape.length === 0) return
    this.log.log(`Scraping og:image cho ${needScrape.length} campaign(s)...`)
    for (let i = 0; i < needScrape.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 300))
      const { id, url } = needScrape[i]
      const ogImageUrl = await fetchOgImage(url)
      if (!ogImageUrl) { this.log.debug(`og:image ${id}: không tìm thấy`); continue }
      try {
        await this.prisma.atCampaign.update({ where: { id }, data: { ogImageUrl } })
        this.log.debug(`og:image ${id}: ${ogImageUrl}`)
      } catch { /* bỏ qua */ }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AffiliateBot/1.0)" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const m =
      /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html) ??
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html)
    const imgUrl = m?.[1]?.trim()
    return imgUrl && imgUrl.startsWith("http") ? imgUrl : null
  } catch {
    return null
  }
}

function normalizeSlug(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.]+/g, "")
}

function domainSlug(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host.split(".")[0] ?? ""
  } catch { return "" }
}

function toBrandSlug(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function detectCampaignType(name: string, merchant: string): string {
  const lower = `${name} ${merchant}`.toLowerCase()
  if (lower.includes("smartlink") || lower.includes("smart link")) return "tracking"
  const productFeedPlatforms = ["lazada", "shopee", "sendo"]
  if (productFeedPlatforms.some((p) => lower.includes(p))) return "product"
  return "cps"
}
