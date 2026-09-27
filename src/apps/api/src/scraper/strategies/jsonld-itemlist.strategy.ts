import { load as cheerioLoad } from "cheerio"
import { BaseScraper } from "./base.scraper"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "../scraper.types"

const DEFAULT_DISCOUNT_SELECTOR = ".style-percent-product"

export class JsonLdItemListStrategy extends BaseScraper {
  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const html = await this.fetchPage(category.url, config)
    if (!html) return []

    const $ = cheerioLoad(html)
    const products: ScrapedProduct[] = []
    const idPattern = config.jsonld?.idPattern ? new RegExp(config.jsonld.idPattern) : null

    // Build url → discountPct map from HTML product cards (if cardSelector is configured)
    const discountMap = config.jsonld?.cardSelector
      ? this.buildDiscountMap($, category.url, config.jsonld.cardSelector, config.jsonld.discountSelector)
      : new Map<string, number>()

    if (discountMap.size > 0) {
      this.log.debug(`[jsonld-itemlist] ${category.id}: tìm thấy ${discountMap.size} sản phẩm có discount trong HTML`)
    }

    $('script[type="application/ld+json"]').each((_, el) => {
      let data: unknown
      try { data = JSON.parse($(el).text()) } catch { return }

      // Support both a plain object and an array of LD objects in one script tag
      const candidates = Array.isArray(data) ? data : [data]

      for (const candidate of candidates) {
        if ((candidate as any)?.["@type"] !== "ItemList") continue

        const items: any[] = (candidate as any).itemListElement ?? []
        for (const listItem of items) {
          // ItemList items can be ListItem (has .item) or Product directly
          const product = listItem?.item ?? listItem
          if (!product) continue

          const name = String(product.name ?? "").trim()
          if (!name) continue

          const url = String(product.url ?? product["@id"] ?? "").trim()
          if (!url) continue

          // image: string or string[]
          const rawImg = Array.isArray(product.image) ? product.image[0] : product.image
          const imageUrl = String(rawImg ?? "").trim()

          // offers: object or array
          const offersRaw = Array.isArray(product.offers) ? product.offers[0] : product.offers
          const price = Number(offersRaw?.price ?? 0)
          if (price <= 0) continue

          // externalId: regex capture group from URL, or last path segment
          let externalId: string
          if (idPattern) {
            const m = url.match(idPattern)
            externalId = m?.[1] ?? url
          } else {
            try {
              const parts = new URL(url).pathname.split("/").filter(Boolean)
              externalId = parts[parts.length - 1] || url
            } catch { externalId = url }
          }

          // Look up discount % from HTML and calculate originalPrice
          const discountPct = discountMap.get(url)
          let originalPrice: number | undefined
          if (discountPct && discountPct > 0 && discountPct < 100) {
            originalPrice = Math.round(price / (1 - discountPct / 100))
          }

          products.push({
            sourceSlug,
            categoryId: category.id,
            nicheSlug: category.nicheSlug,
            externalId,
            name,
            url,
            imageUrl,
            price,
            originalPrice,
            inStock: true,
          })
        }
      }
    })

    this.log.debug(`[jsonld-itemlist] ${category.id}: ${products.length} sản phẩm`)
    return products
  }

  /**
   * Scan HTML product cards to build a map of productUrl → discountPct.
   * Each card (matching cardSelector) must contain a link <a href> and a discount badge.
   */
  private buildDiscountMap(
    $: ReturnType<typeof cheerioLoad>,
    pageUrl: string,
    cardSelector: string,
    discountSelector = DEFAULT_DISCOUNT_SELECTOR,
  ): Map<string, number> {
    const map = new Map<string, number>()
    const origin = (() => { try { return new URL(pageUrl).origin } catch { return "" } })()

    $(cardSelector).each((_, card) => {
      const discountEl = $(card).find(discountSelector).first()
      if (!discountEl.length) return

      // Extract numeric value from text like "-50%", "-50", "-29.3%"
      const raw = discountEl.text().replace(/[^0-9.]/g, "")
      const pct = parseFloat(raw)
      if (isNaN(pct) || pct <= 0 || pct >= 100) return

      const href = $(card).find("a[href]").first().attr("href") ?? ""
      if (!href) return

      const url = href.startsWith("http") ? href
        : href.startsWith("/") ? `${origin}${href}`
        : ""
      if (url) map.set(url, pct)
    })

    return map
  }
}
