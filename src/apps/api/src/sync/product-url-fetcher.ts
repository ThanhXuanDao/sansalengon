/**
 * Standalone functions để lấy thông tin sản phẩm từ affiliate URL.
 * Không phụ thuộc vào PlatformSyncService hay bất kỳ injectable nào.
 * Dùng cho tính năng "import từ URL" (bán tự động).
 */

const SHOPEE_CDN = "https://cf.shopee.vn/file"

// ── Return type ───────────────────────────────────────────────────────────────

export interface FetchedProductInfo {
  name: string
  price: number              // VND
  originalPrice: number | null
  discountPct: number | null
  imageUrl: string           // ảnh chính
  imageUrls: string[]        // tất cả ảnh
  rating: number | null
  shopUrl: string            // URL sản phẩm chuẩn (sau khi resolve redirect)
  source: "shopee" | "lazada"
  externalId: string         // key dùng cho upsert (shopId_itemId / lazadaItemId)
  categoryHint: string | null // category name từ platform → dùng để auto-assign
}

// ── Shared helper ─────────────────────────────────────────────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

/**
 * Follow HTTP redirects, trả về URL cuối cùng.
 * Dùng cho short link (shope.ee/xxx, c.lazada.vn/t/xxx).
 * Node.js fetch theo mặc định follow redirect và response.url = URL đích.
 */
async function resolveRedirect(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": BROWSER_UA },
    signal: AbortSignal.timeout(12_000),
  })
  // Body không cần đọc — chỉ cần URL cuối sau redirect
  res.body?.cancel().catch(() => {})
  return res.url
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SHOPEE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse shopId + itemId từ URL shopee.vn.
 *
 * Các pattern được support:
 *   - Standard:  /product-name-i.{shopId}.{itemId}
 *   - Mobile:    /{username}/{shopId}/{itemId}   (redirect từ s.shopee.vn trên mobile UA)
 *   - Short path: /{shopId}/{itemId}
 */
function parseShopeeIds(url: string): { shopId: string; itemId: string } | null {
  try {
    const path = new URL(url).pathname
    // Standard pattern: /product-name-i.{shopId}.{itemId}
    const m = path.match(/-i\.(\d+)\.(\d+)/)
    if (m) return { shopId: m[1], itemId: m[2] }
    // Mobile/short pattern: last two path segments are both numeric digits
    // e.g. /opaanlp/193849872/5928790652  →  shopId=193849872, itemId=5928790652
    const segments = path.split("/").filter(Boolean)
    if (segments.length >= 2) {
      const itemId = segments[segments.length - 1]
      const shopId = segments[segments.length - 2]
      if (/^\d+$/.test(itemId) && /^\d+$/.test(shopId)) {
        return { shopId, itemId }
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Resolve Shopee affiliate URL → canonical shopee.vn product URL.
 *
 * Các format được support:
 *   - https://shope.ee/XXXXX                               → follow redirect
 *   - https://s.shopee.vn/XXXXX                            → follow redirect
 *   - https://s.shopee.vn/an_redir?origin_link=...&...    → decode origin_link param trực tiếp
 *   - https://shopee.vn/{slug}-i.{shopId}.{itemId}?...    → dùng nguyên
 */
async function resolveShopeeUrl(affiliateUrl: string): Promise<string> {
  try {
    const parsed = new URL(affiliateUrl)

    // an_redir: decode origin_link param → không cần HTTP request
    if (parsed.hostname === "s.shopee.vn" && parsed.pathname === "/an_redir") {
      const originLink = parsed.searchParams.get("origin_link")
      if (originLink) return decodeURIComponent(originLink)
    }

    // Đã là URL shopee.vn thật → dùng ngay
    if (parsed.hostname === "shopee.vn" || parsed.hostname === "www.shopee.vn") {
      return affiliateUrl
    }

    // Short link (shope.ee, s.shopee.vn) → follow redirect
    return resolveRedirect(affiliateUrl)
  } catch {
    // URL parse lỗi → thử follow redirect
    return resolveRedirect(affiliateUrl)
  }
}

/**
 * Parse raw Shopee item object (từ API hoặc __NEXT_DATA__) → FetchedProductInfo.
 */
function parseShopeeItemData(
  item: Record<string, unknown>,
  shopId: string,
  itemId: string,
): FetchedProductInfo {
  const name = String(item.name ?? "").trim()
  if (!name) throw new Error("Shopee: sản phẩm không có tên")

  // Shopee lưu giá dạng micro-VND (giá VND × 100000)
  const rawPrice = Number(item.price ?? item.price_min ?? 0)
  if (rawPrice <= 0) throw new Error(`Shopee: giá sản phẩm không hợp lệ (raw=${rawPrice})`)
  const price = Math.round(rawPrice / 100000)

  const rawOriginal = Number(item.price_before_discount ?? 0)
  const originalPrice = rawOriginal > rawPrice ? Math.round(rawOriginal / 100000) : null

  const discountPct =
    originalPrice && originalPrice > price
      ? Math.round((1 - price / originalPrice) * 100)
      : null

  // Images: item.image = ảnh chính (hash), item.images = array hash
  const mainHash = String(item.image ?? "")
  const allHashes: string[] = Array.isArray(item.images)
    ? (item.images as unknown[]).map(String)
    : mainHash ? [mainHash] : []
  const imageUrls = allHashes.map((h) => `${SHOPEE_CDN}/${h}`)
  const imageUrl = imageUrls[0] ?? ""

  const ratingRaw = (item.item_rating as Record<string, unknown> | undefined)?.rating_star
  const rating = ratingRaw != null ? Number(ratingRaw) || null : null

  const cats = Array.isArray(item.categories) ? (item.categories as Record<string, unknown>[]) : []
  const categoryHint = cats.length > 0 ? String(cats[cats.length - 1]?.display_name ?? "") || null : null

  const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)
  const shopUrl = `https://shopee.vn/${nameSlug}-i.${shopId}.${itemId}`

  return { name, price, originalPrice, discountPct, imageUrl, imageUrls, rating, shopUrl, source: "shopee", externalId: `${shopId}_${itemId}`, categoryHint }
}

/**
 * Fetch qua Shopee item API (/api/v4/item/get).
 *
 * Ưu tiên:
 *   1. SHOPEE_PROXY_URL — proxy forward toàn bộ request (bypass anti-bot)
 *   2. SHOPEE_COOKIES   — session cookie từ browser đã đăng nhập Shopee
 *   3. Không có gì      — gọi thẳng, dễ bị 403
 *
 * Trả về raw item object hoặc throw với .status nếu bị block.
 */
async function fetchShopeeItemApi(shopId: string, itemId: string): Promise<Record<string, unknown>> {
  const proxyBase = process.env.SHOPEE_PROXY_URL?.replace(/\/$/, "")
  const apiUrl = proxyBase
    ? `${proxyBase}?itemid=${itemId}&shopid=${shopId}`
    : `https://shopee.vn/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`

  const cookies = process.env.SHOPEE_COOKIES ?? ""

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Referer": "https://shopee.vn/",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
      ...(cookies ? { Cookie: cookies } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }

  const body = await res.json() as Record<string, unknown>
  const item = (body?.data as Record<string, unknown> | undefined)?.item as Record<string, unknown> | undefined
  if (!item) throw new Error(`Shopee API trả về dữ liệu trống (shopId=${shopId} itemId=${itemId})`)
  return item
}

/**
 * Fallback: fetch OG meta tags từ trang sản phẩm Shopee.
 * Shopee server-render OG tags khi dùng UA "facebookexternalhit".
 * Chỉ cần shopId + itemId — placeholder slug vẫn resolve đúng sản phẩm.
 *
 * Trả về FetchedProductInfo với price=0 (user cần tự điền giá).
 */
async function fetchShopeeItemFromOg(shopId: string, itemId: string): Promise<FetchedProductInfo> {
  const pageUrl = `https://shopee.vn/placeholder-i.${shopId}.${itemId}`
  const res = await fetch(pageUrl, {
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) throw new Error(`Shopee OG page trả về HTTP ${res.status}`)

  const html = await res.text()

  function ogMeta(prop: string): string {
    const m = html.match(new RegExp(`<meta[^>]+property="og:${prop}"[^>]+content="([^"]*)"`, "i"))
            ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="og:${prop}"`, "i"))
    return m ? m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : ""
  }

  const rawTitle = ogMeta("title")
  const name = rawTitle.replace(/\s*\|\s*Shopee\s.*$/i, "").trim()
  if (!name) throw new Error("Không lấy được tên sản phẩm từ Shopee (OG tags trống)")

  const imageUrl = ogMeta("image")
  const shopUrl = ogMeta("url") || pageUrl

  return {
    name,
    price: 0,           // OG không trả price — user điền thủ công
    originalPrice: null,
    discountPct: null,
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
    rating: null,
    shopUrl,
    source: "shopee",
    externalId: `${shopId}_${itemId}`,
    categoryHint: null,
  }
}

/**
 * Lấy thông tin sản phẩm từ Shopee affiliate URL.
 *
 * Chiến lược:
 *   1. Resolve URL → lấy shopId + itemId
 *   2. Thử Shopee item API (đầy đủ: name, price, images, rating, category)
 *      - Dùng SHOPEE_COOKIES nếu có (bypass 403)
 *      - Dùng SHOPEE_PROXY_URL nếu có
 *   3. Nếu API trả 403 → fallback OG meta tags (chỉ có name + image, price=0)
 */
export async function fetchShopeeProductInfo(affiliateUrl: string): Promise<FetchedProductInfo> {
  // Step 1: Resolve về URL chứa shopId + itemId
  const productUrl = await resolveShopeeUrl(affiliateUrl)
  const ids = parseShopeeIds(productUrl)
  if (!ids) {
    throw new Error(
      `Không parse được shopId/itemId từ URL Shopee.\n` +
      `URL sau redirect: ${productUrl}\n` +
      `Đảm bảo link dẫn đến trang sản phẩm (pattern: shopee.vn/...-i.shopId.itemId)`
    )
  }

  // Step 2: Thử API, fallback OG nếu 403
  try {
    const item = await fetchShopeeItemApi(ids.shopId, ids.itemId)
    return parseShopeeItemData(item, ids.shopId, ids.itemId)
  } catch (apiErr: unknown) {
    const status = (apiErr as { status?: number }).status
    if (status !== 403) throw apiErr
    // 403 → thử OG fallback (không cần credentials)
  }

  return fetchShopeeItemFromOg(ids.shopId, ids.itemId)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LAZADA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Lazada itemId từ product URL.
 * Pattern: /products/{slug}-i{itemId}-s{skuId}.html
 */
function parseLazadaItemId(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/-i(\d+)-s\d+\.html/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

/**
 * Resolve Lazada affiliate URL → canonical product URL.
 *
 * Các format được support:
 *   - https://c.lazada.vn/t/XXXXX                         → follow redirect
 *   - https://accesstrade.vn/in_v2?id=...&url=encodedUrl  → decode url param
 *   - https://www.lazada.vn/products/{slug}-i{id}-s{id}.html → dùng nguyên
 */
async function resolveLazadaUrl(affiliateUrl: string): Promise<string> {
  try {
    const parsed = new URL(affiliateUrl)

    // AccessTrade tracking link: url param chứa product URL
    if (parsed.hostname.includes("accesstrade")) {
      const inner = parsed.searchParams.get("url")
      if (inner) return decodeURIComponent(inner)
    }

    // Đã là URL lazada.vn thật → dùng ngay
    if (parsed.hostname.includes("lazada.vn") && parsed.pathname.includes("/products/")) {
      return affiliateUrl
    }

    // Short link (c.lazada.vn/t/xxx) hoặc link khác → follow redirect
    return resolveRedirect(affiliateUrl)
  } catch {
    return resolveRedirect(affiliateUrl)
  }
}

/**
 * Extract tất cả JSON-LD blocks từ HTML.
 */
function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(m[1])
      if (Array.isArray(parsed)) blocks.push(...parsed)
      else blocks.push(parsed)
    } catch {
      // skip malformed block
    }
  }
  return blocks
}

/**
 * Lấy thông tin sản phẩm từ Lazada affiliate URL.
 *
 * Lazada affiliate links:
 *   - https://c.lazada.vn/t/XXXXX           (Lazada affiliate program)
 *   - https://accesstrade.vn/in_v2?...&url= (AccessTrade wrap)
 *
 * Dùng JSON-LD (application/ld+json) trong HTML sản phẩm.
 * Không cần API key hay cookie.
 */
export async function fetchLazadaProductInfo(affiliateUrl: string): Promise<FetchedProductInfo> {
  // Step 1: Resolve về product URL chuẩn
  const productUrl = await resolveLazadaUrl(affiliateUrl)
  const itemId = parseLazadaItemId(productUrl)
  if (!itemId) {
    throw new Error(
      `Không parse được itemId từ URL Lazada.\n` +
      `URL sau redirect: ${productUrl}\n` +
      `Đảm bảo link dẫn đến trang sản phẩm (pattern: lazada.vn/products/...-i{id}-s{id}.html)`
    )
  }

  // Step 2: Fetch product page HTML
  const res = await fetch(productUrl, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    throw new Error(`Lazada product page trả về HTTP ${res.status}`)
  }

  const html = await res.text()

  // Step 3: Parse JSON-LD
  const ldBlocks = extractJsonLd(html)

  const productBlock = ldBlocks.find(
    (b): b is Record<string, unknown> =>
      typeof b === "object" && b !== null && (b as Record<string, unknown>)["@type"] === "Product"
  )
  if (!productBlock) {
    throw new Error(
      `Không tìm thấy JSON-LD Product trong trang Lazada. ` +
      `Trang có thể đã thay đổi cấu trúc hoặc bị chặn.`
    )
  }

  // Step 4: Parse product fields

  const name = String(productBlock.name ?? "").trim()
  if (!name) throw new Error("Lazada: sản phẩm không có tên trong JSON-LD")

  const offers = (productBlock.offers ?? {}) as Record<string, unknown>
  const rawPrice = parseFloat(String(offers.price ?? "0").replace(/[^\d.]/g, ""))
  if (rawPrice <= 0) throw new Error(`Lazada: giá sản phẩm không hợp lệ (price="${offers.price}")`)
  const price = Math.round(rawPrice)

  // originalPrice: JSON-LD dùng offers.highPrice nếu có range, không thì fallback window.__g
  let originalPrice: number | null = null
  const rawHigh = parseFloat(String(offers.highPrice ?? "0").replace(/[^\d.]/g, ""))
  if (rawHigh > rawPrice) {
    originalPrice = Math.round(rawHigh)
  } else {
    // Fallback: parse window.__g hoặc JSON embedded trong HTML
    // Lazada đôi khi có: "originalPrice":"580000" hoặc "originalPrice":580000
    const gpMatch = html.match(/"originalPrice"\s*:\s*"?(\d{4,})"?/)
    if (gpMatch) {
      const raw = Number(gpMatch[1])
      if (raw > price) originalPrice = raw
    }
  }

  const discountPct =
    originalPrice && originalPrice > price
      ? Math.round((1 - price / originalPrice) * 100)
      : null

  // Images
  const imgRaw = productBlock.image
  const imageUrls: string[] = Array.isArray(imgRaw)
    ? imgRaw.map(String)
    : imgRaw
    ? [String(imgRaw)]
    : []
  const imageUrl = imageUrls[0] ?? ""

  // Rating
  const aggRating = productBlock.aggregateRating as Record<string, unknown> | undefined
  const rating = aggRating ? Number(aggRating.ratingValue) || null : null

  // Category hint từ BreadcrumbList (lấy category lá — bỏ "Lazada" ở đầu và brand ở cuối)
  let categoryHint: string | null = null
  const breadcrumb = ldBlocks.find(
    (b): b is Record<string, unknown> =>
      typeof b === "object" && b !== null && (b as Record<string, unknown>)["@type"] === "BreadcrumbList"
  )
  if (breadcrumb) {
    const items = (breadcrumb.itemListElement as Record<string, unknown>[] | undefined) ?? []
    // Bỏ item đầu (Lazada homepage) và item cuối (tên sản phẩm/brand nếu có)
    // Lấy item áp cuối → category lá (ví dụ: "Điện thoại di động")
    const candidates = items.slice(1, -1)
    if (candidates.length > 0) {
      const leaf = candidates[candidates.length - 1]
      categoryHint = String(leaf?.name ?? "") || null
    }
  }

  return {
    name,
    price,
    originalPrice,
    discountPct,
    imageUrl,
    imageUrls,
    rating,
    shopUrl: productUrl,
    source: "lazada",
    externalId: itemId,
    categoryHint,
  }
}
