// Explicit type values for SyncSource.config.type
export const SYNC_SOURCE_TYPE = {
  PRODUCT_SCRAPER: "product-scraper",  // KingFoodMart — scrapes products only
  PLATFORM_SYNC:   "platform-sync",    // Shopee, Tiki, Lazada, CellphoneS — products + coupons
  COUPON_SCRAPER:  "coupon-scraper",   // TCH and other brand coupon scrapers — coupons only
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

/** True if this source syncs products (product-scraper, platform-sync, or unknown/legacy). */
export function syncSourceHasProducts(config: unknown): boolean {
  return parseConfigType(config) !== SYNC_SOURCE_TYPE.COUPON_SCRAPER
}

/** True if this source syncs coupons (coupon-scraper or platform-sync). */
export function syncSourceHasCoupons(config: unknown): boolean {
  const t = parseConfigType(config)
  return t === SYNC_SOURCE_TYPE.COUPON_SCRAPER || t === SYNC_SOURCE_TYPE.PLATFORM_SYNC
}

/**
 * Which sync handler to run when manually triggering this source from admin.
 * coupon-scraper → "coupon"; lead-campaign / offer-sync → "lead"; everything else → "product".
 */
export function getSyncHandlerType(config: unknown): "coupon" | "product" | "lead" {
  const t = parseConfigType(config)
  if (t === SYNC_SOURCE_TYPE.COUPON_SCRAPER) return "coupon"
  if (t === ("lead-campaign" as string) || t === ("offer-sync" as string)) return "lead"
  return "product"
}

/** Human-readable label for display in admin UI. */
export function getSyncSourceLabel(config: unknown): "PRODUCT" | "PLATFORM" | "COUPON" {
  const t = parseConfigType(config)
  if (t === SYNC_SOURCE_TYPE.COUPON_SCRAPER) return "COUPON"
  if (t === SYNC_SOURCE_TYPE.PLATFORM_SYNC)  return "PLATFORM"
  return "PRODUCT"
}
