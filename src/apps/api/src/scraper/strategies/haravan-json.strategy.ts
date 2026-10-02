import { Logger } from "@nestjs/common"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "../scraper.types"
import { DEFAULT_HEADERS } from "./base.scraper"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const LIMIT = 50

/** Fetches product listings from Haravan / Shopify-compatible stores via /collections/{handle}/products.json */
export class HaravanJsonStrategy {
  protected readonly log = new Logger(HaravanJsonStrategy.name)

  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const allProducts: ScrapedProduct[] = []
    const delayMs = config.delayMs ?? 2000
    const maxPages = config.pagination?.maxPages ?? 10

    const baseUrl = new URL(category.url).origin

    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) await sleep(Math.round(delayMs * (0.7 + Math.random() * 0.6)))

      const url = `${category.url}?limit=${LIMIT}&page=${page}`
      this.log.debug(`[haravan-json] Fetching: ${url}`)

      let products: HaravanProduct[] = []
      try {
        const res = await fetch(url, {
          headers: { ...DEFAULT_HEADERS, Accept: "application/json" },
          signal: AbortSignal.timeout(20_000),
        })
        if (!res.ok) {
          this.log.warn(`[haravan-json] HTTP ${res.status} for ${url}`)
          break
        }
        const json = (await res.json()) as { products?: HaravanProduct[] }
        products = json.products ?? []
      } catch (e: any) {
        this.log.warn(`[haravan-json] Fetch failed: ${e.message} — ${url}`)
        break
      }

      if (products.length === 0) break

      for (const p of products) {
        const product = this.mapProduct(sourceSlug, category, p, baseUrl)
        if (product) allProducts.push(product)
      }

      if (products.length < LIMIT) break
    }

    this.log.log(`[haravan-json][${sourceSlug}] ${category.id}: ${allProducts.length} sản phẩm`)
    return allProducts
  }

  private mapProduct(
    sourceSlug: string,
    category: ScraperCategory,
    p: HaravanProduct,
    baseUrl: string,
  ): ScrapedProduct | null {
    const name = String(p.title ?? "").trim()
    if (!name || !p.id) return null

    const variant = p.variants?.[0]
    if (!variant) return null

    const price = Math.round(parseFloat(String(variant.price)) || 0)
    if (price <= 0) return null

    const compareAt = Math.round(parseFloat(String(variant.compare_at_price ?? "0")) || 0)

    const externalId = String(p.id)
    const handle = String(p.handle ?? externalId)
    const productUrl = `${baseUrl}/products/${handle}`

    let imageUrl = String(p.images?.[0]?.src ?? "")
    if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`

    const inStock = Array.isArray(p.variants)
      ? p.variants.some((v) => v.available)
      : true

    return {
      sourceSlug,
      categoryId: category.id,
      nicheSlug: category.nicheSlug,
      externalId,
      name,
      url: productUrl,
      imageUrl,
      price,
      originalPrice: compareAt > price ? compareAt : undefined,
      inStock,
    }
  }
}

interface HaravanVariant {
  price: string
  compare_at_price?: string | null
  available?: boolean
}

interface HaravanProduct {
  id: number
  handle: string
  title: string
  variants: HaravanVariant[]
  images: Array<{ src: string }>
}
