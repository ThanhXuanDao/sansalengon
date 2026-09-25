import { Injectable, Logger } from "@nestjs/common"
import { PrismaClient } from "@prisma/client"
import type { AccessTradeCampaign } from "../affiliate/accesstrade/types"
import { AppLogService } from "../shared/app-log.service"
import { AtCampaignService } from "../shared/at-campaign.service"
import type { SyncSourceConfig } from "./sync.constants"

const SRC = "graphql-sync"
const CPS_GRAPHQL_URL = "https://api.cellphones.com.vn/v2/graphql/query"
const CPS_PRODUCT_BASE = "https://cellphones.com.vn"
const CPS_IMAGE_CDN = "https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product"
const CPS_DEFAULT_PROVINCE_ID = 30

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export interface GraphQLProduct {
  externalId: string
  source: "cellphones"
  name: string
  imageUrl: string
  shopUrl: string
  affiliateUrl: string
  currentPrice: number
  originalPrice: number | null
  commissionRate: number
  rating: number | null
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class GraphQLSyncService {
  private readonly log = new Logger(GraphQLSyncService.name)
  private readonly prisma = new PrismaClient()

  constructor(
    private readonly atCampaignSvc: AtCampaignService,
    private readonly appLog: AppLogService,
  ) {}

  private get slog() { return this.appLog.scope("api-sync") }

  // Fetch sản phẩm CellphoneS cho một niche, wrap AT tracking link nếu có campaign
  async fetchForNiche(
    niche: { id: string; name: string },
    atCampaign: AccessTradeCampaign | null,
  ): Promise<GraphQLProduct[]> {
    const dbSource = await this.prisma.syncSource.findUnique({ where: { slug: "cellphones" } })
    if (!dbSource) return []

    const cfg: SyncSourceConfig = dbSource.config
      ? (() => { try { return JSON.parse(dbSource.config as string) } catch { return {} } })()
      : {}

    const categories = cfg.categories ?? []
    const pageSize = cfg.pageSize ?? 20
    const maxPages = cfg.maxPages ?? 2
    const provinceId = cfg.provinceId ?? CPS_DEFAULT_PROVINCE_ID

    const matchingCategory = categories.find((c) => c.nicheSlug === niche.id)
    if (!matchingCategory || matchingCategory.categoryIds.length === 0) return []

    const results: GraphQLProduct[] = []

    for (const categoryId of matchingCategory.categoryIds) {
      for (let page = 1; page <= maxPages; page++) {
        if (page > 1) await sleep(1500)
        try {
          const items = await this.fetchCategory(categoryId, page, pageSize, provinceId)
          if (items.length === 0) break

          for (const item of items) {
            const parsed = this.normalizeProduct(item)
            if (parsed) results.push(parsed)
          }

          if (items.length < pageSize) break
        } catch (e: any) {
          this.log.warn(`[CellphoneS] Category ${categoryId} page ${page} lỗi: ${e.message}`)
          await this.slog.warn(`CellphoneS fetch lỗi`, SRC, {
            niche: niche.id, categoryId, page, error: e.message,
          })
          break
        }
      }
      await sleep(1200)
    }

    this.log.log(`[CellphoneS] Ngách: ${niche.name} — ${results.length} sản phẩm`)

    if (atCampaign && results.length > 0) {
      this.log.log(`[CellphoneS] Tạo AT tracking link cho ${results.length} sản phẩm...`)
      let wrapped = 0
      for (const p of results) {
        const wrappedUrl = await this.atCampaignSvc.wrapUrl(
          atCampaign.id, p.shopUrl, { sub1: niche.id, sub2: "graphql" },
        )
        if (wrappedUrl !== p.shopUrl) wrapped++
        p.affiliateUrl = wrappedUrl
      }
      this.log.log(`[CellphoneS] Wrap AT link: ${wrapped}/${results.length} thành công`)
      await this.slog.info(
        `[CellphoneS] Wrap AT link: ${wrapped}/${results.length} — campaign "${atCampaign.name}"`,
        SRC, { campaign: atCampaign.name, wrapped, total: results.length },
      )
    }

    return results
  }

  private async fetchCategory(
    categoryId: string,
    page: number,
    size: number,
    provinceId: number,
  ): Promise<any[]> {
    const query = `
      query GetProductsByCateId {
        products(
          filter: {
            static: {
              categories: ["${categoryId}"]
              province_id: ${provinceId}
              stock: { from: 1 }
              company_stock_id: [46, 152, 4920]
            }
          }
          page: ${page}
          size: ${size}
          sort: [{ view: desc }]
        ) {
          general { product_id name sku url_path review { average_rating } }
          filterable { price special_price display_price thumbnail stock }
        }
      }
    `

    const resp = await fetch(CPS_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": CPS_PRODUCT_BASE,
        "Referer": `${CPS_PRODUCT_BASE}/`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query, variables: {} }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!resp.ok) throw new Error(`CPS HTTP ${resp.status}`)
    const body = await resp.json() as any
    if (body.errors?.length) throw new Error(body.errors[0].message)
    return body.data?.products ?? []
  }

  private normalizeProduct(item: any): GraphQLProduct | null {
    try {
      const g = item.general
      const f = item.filterable
      if (!g || !f) return null

      const name = String(g.name ?? "").trim()
      if (!name) return null

      const urlPath = String(g.url_path ?? "").trim()
      if (!urlPath) return null

      const rawPrice = Number(f.display_price || f.special_price || f.price || 0)
      if (rawPrice <= 0) return null
      const currentPrice = Math.round(rawPrice)
      const rawOriginal = Number(f.price || 0)
      const originalPrice = rawOriginal > rawPrice ? Math.round(rawOriginal) : null

      const thumbnail = String(f.thumbnail ?? "").trim()
      const imageUrl = thumbnail ? `${CPS_IMAGE_CDN}${thumbnail}` : ""
      const shopUrl = `${CPS_PRODUCT_BASE}/${urlPath}`
      const externalId = String(g.product_id ?? g.sku ?? urlPath)

      return {
        externalId,
        source: "cellphones",
        name: name.slice(0, 255),
        imageUrl,
        shopUrl,
        affiliateUrl: shopUrl,
        currentPrice,
        originalPrice,
        commissionRate: 0,
        rating: g.review?.average_rating ? Number(g.review.average_rating) : null,
      }
    } catch {
      return null
    }
  }
}
