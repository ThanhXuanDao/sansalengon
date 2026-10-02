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
  // Override fields — nếu set sẽ được ưu tiên hơn giá trị từ outer sync context
  atCampaignId?: string
  categoryId?: string
}

// Sản phẩm từ Chrome extension (đã parse từ Shopee recommend_v2 / search_items)
export interface ExtensionProduct {
  itemId: string
  shopId: string
  name: string
  price: number          // VND (đã ÷ 100,000 từ raw Shopee unit)
  originalPrice: number | null
  discountPct: number | null
  sold: string           // "Đã bán 40k+" — chỉ dùng để log, không lưu DB
  sellerType: string     // "MALL" | "PREFERRED" | ""
  image: string          // URL đầy đủ
  images: string[]
  url: string            // shopee.vn product URL
  rating: number | null  // item_rating.rating_star (0–5)
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

  // platform-sync: Shopee flash sale
  shopeeMaxSessions?: number      // số session cần lấy (default: 3)
  shopeeItemsPerSession?: number  // số sản phẩm mỗi session (default: 20)
  shopeeDefaultNicheId?: string   // niche fallback khi không infer được (default: niche đầu tiên)
  // niche slug → mảng từ khoá tiếng Việt để infer category từ tên sản phẩm
  shopeeNicheKeywords?: Record<string, string[]>

  // ── Affiliate link mode cho Shopee ──────────────────────────────────────────
  // Flash sale sync:
  //   "at"     → wrap qua AccessTrade Smartlink campaign (mặc định)
  //   "direct" → build an_redir link trực tiếp với SHOPEE_AFFILIATE_ID
  // atCampaignId (ở trên) pin campaign cụ thể khi có nhiều Shopee Smartlink trong AT
  shopeeLinkMode?: "at" | "direct"
  // Override env SHOPEE_AFFILIATE_ID cho flash sale direct mode
  shopeeAffiliateId?: string

  // Extension bulk capture (config độc lập với flash sale):
  //   mặc định: kế thừa shopeeLinkMode + atCampaignId ở trên
  extensionLinkMode?: "at" | "direct"
  // AT campaign ID cụ thể cho extension bulk (override auto-match)
  extensionAtCampaignId?: string

}
