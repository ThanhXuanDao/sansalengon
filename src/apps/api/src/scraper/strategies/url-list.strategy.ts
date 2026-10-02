import { Logger } from "@nestjs/common"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "../scraper.types"
import { DEFAULT_HEADERS } from "./base.scraper"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function extractJsonLd(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try {
      const p: unknown = JSON.parse(m[1])
      if (Array.isArray(p)) blocks.push(...p)
      else blocks.push(p)
    } catch { /* skip malformed block */ }
  }
  return blocks
}

function ogContent(html: string, prop: string): string {
  const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, "i"))
           ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, "i"))
  return m ? m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim() : ""
}

function deriveExternalId(url: string): string {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean)
    return segments[segments.length - 1] ?? url
  } catch {
    return url
  }
}

function parseFromJsonLd(
  html: string,
  sourceSlug: string,
  category: ScraperCategory,
  url: string,
  nicheSlug: string,
  externalId: string,
): ScrapedProduct | null {
  const blocks = extractJsonLd(html)
  const block = blocks.find(
    (b): b is Record<string, unknown> =>
      typeof b === "object" && b !== null && (b as Record<string, unknown>)["@type"] === "Product"
  )
  if (!block) return null

  const name = String(block.name ?? "").trim()
  if (!name) return null

  const offers = (block.offers ?? {}) as Record<string, unknown>
  const rawPrice = parseFloat(String(offers.price ?? "0").replace(/[^\d.]/g, ""))
  if (rawPrice <= 0) return null

  const price = Math.round(rawPrice)

  const rawHigh = parseFloat(String(offers.highPrice ?? "0").replace(/[^\d.]/g, ""))
  const originalPrice = rawHigh > rawPrice ? Math.round(rawHigh) : undefined

  const imgRaw = block.image
  const imageUrl = Array.isArray(imgRaw) ? String(imgRaw[0] ?? "") : String(imgRaw ?? "")

  const availability = String(offers.availability ?? "").toLowerCase()
  const inStock = !availability || availability.includes("instock") || availability.includes("in_stock")

  return { sourceSlug, categoryId: category.id, nicheSlug, externalId, name, url, imageUrl, price, originalPrice, inStock }
}

function parseFromOg(
  html: string,
  sourceSlug: string,
  category: ScraperCategory,
  url: string,
  nicheSlug: string,
  externalId: string,
): ScrapedProduct | null {
  const name = ogContent(html, "og:title").replace(/\s*\|.*$/, "").trim()
  if (!name) return null

  const rawPrice = parseFloat(ogContent(html, "product:price:amount").replace(/[^\d.]/g, ""))
  if (rawPrice <= 0) return null

  const imageUrl = ogContent(html, "og:image")

  return { sourceSlug, categoryId: category.id, nicheSlug, externalId, name, url, imageUrl, price: Math.round(rawPrice), inStock: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// UrlListStrategy — lấy sản phẩm từ danh sách URL cố định trong config.urlList
//
// Extraction ưu tiên: JSON-LD @type=Product → OG product:price:amount meta tags
//
// Dùng cho merchant không thể scrape category page (CSR/WAF) nhưng
// có thể biết trước URL của từng sản phẩm muốn theo dõi.
//
// Trường cần cập nhật thủ công khi site thay đổi:
//   - urlList[].url         — khi URL sản phẩm thay đổi (slug đổi, SP mới thay thế)
//   - urlList[].externalId  — chỉ khi SKU/ID thay đổi (tự parse từ URL nếu bỏ trống)
//   - urlList[].nicheSlug   — chỉ khi danh mục thay đổi (mặc định dùng categories[0].nicheSlug)
// ─────────────────────────────────────────────────────────────────────────────

export class UrlListStrategy {
  protected readonly log = new Logger(UrlListStrategy.name)

  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const entries = config.urlList ?? []
    if (entries.length === 0) {
      this.log.warn(`[url-list][${sourceSlug}] urlList rỗng — không có sản phẩm để fetch`)
      return []
    }

    const delayMs = config.delayMs ?? 1500
    const results: ScrapedProduct[] = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (i > 0) await sleep(Math.round(delayMs * (0.8 + Math.random() * 0.4)))

      this.log.debug(`[url-list][${sourceSlug}] (${i + 1}/${entries.length}) ${entry.url}`)

      try {
        const res = await fetch(entry.url, {
          headers: { ...DEFAULT_HEADERS, ...(config.headers ?? {}) },
          signal: AbortSignal.timeout(20_000),
          redirect: "follow",
        })

        if (!res.ok) {
          this.log.warn(`[url-list][${sourceSlug}] HTTP ${res.status} — ${entry.url}`)
          continue
        }

        const html = await res.text()
        const nicheSlug = entry.nicheSlug ?? category.nicheSlug
        const externalId = entry.externalId ?? deriveExternalId(entry.url)

        const product =
          parseFromJsonLd(html, sourceSlug, category, entry.url, nicheSlug, externalId) ??
          parseFromOg(html, sourceSlug, category, entry.url, nicheSlug, externalId)

        if (product) {
          results.push(product)
        } else {
          this.log.warn(`[url-list][${sourceSlug}] Không extract được data: ${entry.url}`)
        }
      } catch (e: any) {
        this.log.warn(`[url-list][${sourceSlug}] Fetch lỗi: ${e.message} — ${entry.url}`)
      }
    }

    this.log.log(`[url-list][${sourceSlug}] ${results.length}/${entries.length} sản phẩm`)
    return results
  }
}
