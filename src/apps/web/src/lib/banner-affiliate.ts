/**
 * Detect platform và build affiliate URL cho banner.
 * Chỉ chạy server-side (dùng process.env).
 */

export type BannerPlatform = "shopee" | "lazada" | "tiki" | "accesstrade" | null

export function detectBannerPlatform(url: string): BannerPlatform {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes("shopee.vn")) return "shopee"
    if (hostname.includes("lazada.vn")) return "lazada"
    if (hostname.includes("tiki.vn")) return "tiki"
    if (hostname.includes("accesstrade")) return "accesstrade"
  } catch {
    // invalid URL
  }
  return null
}

/** Xóa toàn bộ query params khỏi URL — giữ scheme + host + path */
export function cleanDestinationUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url
  }
}

export function buildBannerAffiliateUrl(destinationUrl: string): string | null {
  const platform = detectBannerPlatform(destinationUrl)
  const cleanUrl = cleanDestinationUrl(destinationUrl)

  if (platform === "shopee") {
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID
    if (!affiliateId) return null
    const params = new URLSearchParams({
      origin_link: cleanUrl,
      pid: affiliateId,
      sub_id: "banner",
    })
    return `https://s.shopee.vn/an_redir?${params}`
  }

  if (platform === "lazada") {
    const trackingId = process.env.LAZADA_AFFILIATE_API_KEY
    if (!trackingId) return null
    return `https://c.lazada.vn/t/c.${trackingId}?url=${encodeURIComponent(cleanUrl)}`
  }

  if (platform === "tiki") {
    const apiKey = process.env.TIKI_AFFILIATE_API_KEY
    if (!apiKey) return null
    return `https://tiki.vn/cps/click?aff_sid=${apiKey}&url=${encodeURIComponent(cleanUrl)}`
  }

  return null
}

export const PLATFORM_AFFILIATE_LABEL: Record<NonNullable<BannerPlatform>, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiki: "Tiki",
  accesstrade: "AccessTrade",
}
