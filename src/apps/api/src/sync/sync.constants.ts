export type AffiliateStrategy = "direct" | "at_wrap"

export const AT_OFFERS_API = "https://api.accesstrade.vn/v1/offers"
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export interface FetchedProduct {
  externalId: string
  source: "shopee" | "accesstrade" | "tiki" | "lazada" | "cellphones"
  name: string
  imageUrl: string
  shopUrl: string
  affiliateUrl: string
  currentPrice: number
  originalPrice: number | null
  discountPct?: number
  commissionRate: number
  rating: number | null
}

export type SyncSourceType = "platform-sync" | "product-scraper" | "graphql-sync" | "coupon-scraper" | "offer-sync" | "lead-campaign"

// Category entry cho graphql-sync (CellphoneS): niche → danh sách category ID GraphQL
export interface GraphQLCategory {
  id: string
  name: string
  nicheSlug: string
  categoryIds: string[]
}

export interface SyncSourceConfig {
  type?: SyncSourceType
  // true nếu platform có affiliate API riêng (shopee, lazada)
  hasDirectAffiliate?: boolean
  // override AT campaign ID — bỏ qua auto-match nếu set
  atCampaignId?: string

  // graphql-sync (CellphoneS): danh sách category theo ngách
  categories?: GraphQLCategory[]
  pageSize?: number
  maxPages?: number
  provinceId?: number

  // platform-sync: Tiki-specific
  categoryIds?: Record<string, number[]>
  tikiInterNicheDelaySec?: number
  tikiMaxPages?: number
  pageState?: Record<string, { currentPage: number; totalPages: number }>
  nicheResumeFromId?: string | null

  // platform-sync: Lazada-specific
  lazadaSyncMode?: "api" | "at"
  lazadaPageSize?: number
  lazadaMaxKeywords?: number
  lazadaKeywords?: Record<string, string[]>

  // platform-sync: Shopee-specific
  syncMode?: "api" | "scrape"
  affiliateId?: string
  scrapeMaxPages?: number
  scrapeDelayMs?: number
  keywords?: Record<string, string[]>
}
