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
}
