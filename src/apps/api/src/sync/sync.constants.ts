export type AffiliateStrategy = "direct" | "at_feed" | "at_wrap"

export interface SyncSourceConfig {
  // "scraper" → dùng ScraperSyncService; undefined → API-based platform
  type?: "scraper"
  // true nếu platform có affiliate API riêng (shopee, lazada)
  hasDirectAffiliate?: boolean
  // override AT campaign ID — bỏ qua auto-match nếu set
  atCampaignId?: string
  // scraper: danh sách category slug để fetch
  categories?: string[]
  // Tiki-specific
  categoryIds?: Record<string, number[]>
  tikiInterNicheDelaySec?: number
  tikiMaxPages?: number
  pageState?: Record<string, { currentPage: number; totalPages: number }>
  nicheResumeFromId?: string | null
  // CellphoneS-specific
  // Key = niche slug, value = mảng string category ID CellphoneS
  cpsCategories?: Record<string, string[]>
  cpsPageSize?: number
  cpsMaxPages?: number
  cpsProvinceId?: number
  // Lazada-specific ─────────────────────────────────────────────────────────
  // syncMode:
  //   "api" — Lazada Affiliate Open Platform API (cần LAZADA_APP_KEY + APP_SECRET)
  //   "at"  — wrap URL bằng AccessTrade tracking link (không cần Lazada key)
  lazadaSyncMode?: "api" | "at"
  // Số sản phẩm mỗi keyword (default 40, max 50 theo Lazada API)
  lazadaPageSize?: number
  // Số keyword tối đa per niche (default 5)
  lazadaMaxKeywords?: number
  // keywords: niche slug → mảng keyword search Lazada
  lazadaKeywords?: Record<string, string[]>
  // Shopee-specific ─────────────────────────────────────────────────────────
  // syncMode:
  //   "api"    — Shopee Affiliate Open API (cần SHOPEE_AFFILIATE_APP_ID + APP_SECRET)
  //   "scrape" — Googlebot scrape shopee.vn + tạo link via an_redir (chỉ cần affiliateId)
  // Khi có app_id/secret: đổi syncMode thành "api" để dùng API chính thức
  syncMode?: "api" | "scrape"
  // affiliateId: Shopee Affiliate ID cho an_redir (syncMode="scrape")
  // Lấy từ affiliate.shopee.vn → Tài khoản của tôi → ID
  // Fallback: env var SHOPEE_AFFILIATE_ID
  affiliateId?: string
  // Số page tối đa scrape mỗi keyword (default 2, mỗi page ~20 sản phẩm)
  scrapeMaxPages?: number
  // Delay ms giữa các request scrape để tránh rate limit (default 2000)
  scrapeDelayMs?: number
  // keywords: niche slug → mảng keyword search Shopee
  // (dùng chung cho cả "api" và "scrape" mode)
  keywords?: Record<string, string[]>
}
