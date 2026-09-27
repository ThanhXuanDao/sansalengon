import { load as cheerioLoad } from "cheerio"
import { BaseScraper } from "./base.scraper"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "../scraper.types"
import { parseViPrice } from "../price-parser"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class HtmlSelectorsStrategy extends BaseScraper {
  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    if (!config.selectors) {
      this.log.warn(`[html-selectors] Thiếu selectors config cho ${category.id}`)
      return []
    }

    const maxPages = config.pagination?.maxPages ?? 1
    const delayMs = config.delayMs ?? 2000
    const allProducts: ScrapedProduct[] = []

    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) await sleep(Math.round(delayMs * (0.7 + Math.random() * 0.6)))

      const url = this.buildPageUrl(category.url, config, page)
      this.log.debug(`[html-selectors] Fetching: ${url}`)

      const html = await this.fetchPage(url, config)
      if (!html) break

      const products = this.extractProducts(sourceSlug, category, config, html, url)
      if (products.length === 0) break
      allProducts.push(...products)
    }

    return allProducts
  }

  private buildPageUrl(baseUrl: string, config: ScraperSourceConfig, page: number): string {
    if (page === 1 || !config.pagination) return baseUrl
    const p = config.pagination

    if (p.type === "page-param") {
      const url = new URL(baseUrl)
      url.searchParams.set(p.pageParam ?? "page", String(page))
      return url.toString()
    }

    if (p.type === "offset-param") {
      const url = new URL(baseUrl)
      url.searchParams.set(p.offsetParam ?? "offset", String((page - 1) * (p.pageSize ?? 20)))
      return url.toString()
    }

    return baseUrl
  }

  private extractProducts(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
    html: string,
    pageUrl: string,
  ): ScrapedProduct[] {
    const $ = cheerioLoad(html)
    const sel = config.selectors!
    const products: ScrapedProduct[] = []
    const baseOrigin = new URL(pageUrl).origin

    $(sel.productCard).each((_, el) => {
      const card = $(el)

      const name = card.find(sel.name).first().text().trim()
      const priceText = card.find(sel.price).first().text().trim()
      const price = parseViPrice(priceText)

      const origText = sel.originalPrice ? card.find(sel.originalPrice).first().text().trim() : ""
      const originalPrice = origText ? parseViPrice(origText) : undefined

      const imgEl = card.find(sel.image).first()
      const rawImg = imgEl.attr("src") || imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("data-original") || ""
      const imageUrl = rawImg.startsWith("//") ? `https:${rawImg}`
        : rawImg.startsWith("/") ? `${baseOrigin}${rawImg}`
        : rawImg

      const linkEl = card.find(sel.linkUrl).first()
      const rawHref = linkEl.attr("href") || ""
      const productUrl = rawHref.startsWith("http") ? rawHref
        : rawHref.startsWith("//") ? `https:${rawHref}`
        : rawHref.startsWith("/") ? `${baseOrigin}${rawHref}`
        : ""

      if (!name || price <= 0 || !productUrl) return

      let externalId: string
      try {
        const parts = new URL(productUrl).pathname.split("/").filter(Boolean)
        externalId = parts[parts.length - 1] || productUrl
      } catch { externalId = productUrl }

      products.push({
        sourceSlug,
        categoryId: category.id,
        nicheSlug: category.nicheSlug,
        externalId,
        name,
        url: productUrl,
        imageUrl,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
      })
    })

    return products
  }
}
