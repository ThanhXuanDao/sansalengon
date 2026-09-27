// Explicit type values for SyncSource.config.type
export const SYNC_SOURCE_TYPE = {
  PRODUCT_SCRAPER: "product-scraper",  // KingFoodMart, Vascara — scrapes products only
  GRAPHQL_SYNC:    "graphql-sync",     // CellphoneS — products via GraphQL
  PLATFORM_SYNC:   "platform-sync",    // Shopee, Tiki — products + coupons via AT feed
  OFFER_SYNC:      "offer-sync",       // Lazada — products via AT /v1/offers feed
  COUPON_SCRAPER:  "coupon-scraper",   // TCH — coupons only
  LEAD_CAMPAIGN:   "lead-campaign",    // VPBank — dịch vụ/lead, không có sản phẩm
} as const

export type SyncSourceType = (typeof SYNC_SOURCE_TYPE)[keyof typeof SYNC_SOURCE_TYPE]

function parseConfigType(config: unknown): SyncSourceType | undefined {
  try {
    const parsed = typeof config === "string" ? JSON.parse(config) : config
    return (parsed as { type?: SyncSourceType } | null)?.type
  } catch {
    return undefined
  }
}

/** True nếu source này sync sản phẩm (product-scraper, graphql-sync, platform-sync, offer-sync). */
export function syncSourceHasProducts(config: unknown): boolean {
  const t = parseConfigType(config)
  return t !== SYNC_SOURCE_TYPE.COUPON_SCRAPER && t !== SYNC_SOURCE_TYPE.LEAD_CAMPAIGN
}

/** True nếu source này sync coupon/mã giảm giá (coupon-scraper, platform-sync, hoặc scraper có embedded coupon config). */
export function syncSourceHasCoupons(config: unknown): boolean {
  try {
    const parsed = typeof config === "string" ? JSON.parse(config) : config
    const cfg = parsed as Record<string, unknown> | null
    if (!cfg) return false
    const t = cfg.type as SyncSourceType | undefined
    if (t === SYNC_SOURCE_TYPE.COUPON_SCRAPER || t === SYNC_SOURCE_TYPE.PLATFORM_SYNC) return true
    return Boolean(cfg.coupon) // scraper source với embedded coupon sub-config
  } catch {
    return false
  }
}

/** True nếu source này là dịch vụ/lead campaign (không có sản phẩm, không có coupon). */
export function syncSourceHasLeads(config: unknown): boolean {
  return parseConfigType(config) === SYNC_SOURCE_TYPE.LEAD_CAMPAIGN
}

/**
 * Which sync handler to run when manually triggering this source from admin.
 * coupon-scraper → "coupon"; lead-campaign → "lead"; everything else → "product".
 */
export function getSyncHandlerType(config: unknown): "coupon" | "product" | "lead" {
  const t = parseConfigType(config)
  if (t === SYNC_SOURCE_TYPE.COUPON_SCRAPER) return "coupon"
  if (t === SYNC_SOURCE_TYPE.LEAD_CAMPAIGN)  return "lead"
  return "product"
}

/** Human-readable label for display in admin UI. */
export function getSyncSourceLabel(config: unknown): "PRODUCT" | "PLATFORM" | "COUPON" | "LEAD" {
  const t = parseConfigType(config)
  if (t === SYNC_SOURCE_TYPE.COUPON_SCRAPER) return "COUPON"
  if (t === SYNC_SOURCE_TYPE.PLATFORM_SYNC)  return "PLATFORM"
  if (t === SYNC_SOURCE_TYPE.LEAD_CAMPAIGN)  return "LEAD"
  return "PRODUCT"
}
