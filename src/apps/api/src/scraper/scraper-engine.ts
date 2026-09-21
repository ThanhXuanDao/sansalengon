import { load as cheerioLoad } from "cheerio"
import { Logger } from "@nestjs/common"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "./scraper.types"
import { parseViPrice } from "./price-parser"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
}

/** Resolve a dot-path like "a.b.c" against an object safely. */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined
    return (cur as Record<string, unknown>)[key]
  }, obj)
}

export class ScraperEngine {
  private readonly log = new Logger(ScraperEngine.name)

  async scrapeCategory(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const strategy = config.strategy ?? "html-selectors"
    return strategy === "nextjs-data"
      ? this.scrapeNextjsCategory(sourceSlug, category, config)
      : this.scrapeHtmlCategory(sourceSlug, category, config)
  }

  // ── nextjs-data strategy ─────────────────────────────────────────────────

  private async scrapeNextjsCategory(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const allProducts: ScrapedProduct[] = []
    const delayMs = config.delayMs ?? 2000
    const paginationPath = config.nextjsPaginationPath
    const dataPath = config.nextjsDataPath
    const fieldMap = config.nextjsFieldMap

    if (!dataPath || !fieldMap) {
      this.log.warn(`[Scraper] nextjs-data strategy requires nextjsDataPath + nextjsFieldMap for ${category.id}`)
      return []
    }

    const configMaxPages = config.pagination?.maxPages ?? 5
    let page = 1
    let lastPage = 1

    do {
      if (page > 1) {
        await sleep(Math.round(delayMs * (0.7 + Math.random() * 0.6)))
      }

      const url = this.buildPageUrl(category.url, page)
      this.log.debug(`[Scraper/nextjs] Fetching: ${url}`)

      const html = await this.fetchPage(url, config)
      if (!html) break

      const nextData = this.extractNextData(html)
      if (!nextData) {
        this.log.warn(`[Scraper/nextjs] No __NEXT_DATA__ found in ${url}`)
        break
      }

      const rawProducts = getPath(nextData, dataPath)
      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        this.log.debug(`[Scraper/nextjs] Empty products array at page ${page}`)
        break
      }

      if (paginationPath && page === 1) {
        const pag = getPath(nextData, paginationPath) as Record<string, number> | undefined
        const siteLast = pag?.last_page ?? 1
        lastPage = Math.min(siteLast, configMaxPages)
        this.log.debug(`[Scraper/nextjs] ${category.id}: ${pag?.total ?? "?"} products, site=${siteLast} pages, capped at ${lastPage}`)
      }

      const baseUrl = new URL(category.url).origin

      for (const raw of rawProducts) {
        if (config.skipWhen) {
          const shouldSkip = getPath(raw, config.skipWhen)
          if (shouldSkip) continue
        }

        const product = this.mapNextjsProduct(sourceSlug, category, fieldMap, config.productUrlTemplate ?? "", baseUrl, raw)
        if (product) allProducts.push(product)
      }

      page++
    } while (page <= lastPage)

    return allProducts
  }

  private extractNextData(html: string): unknown {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!match) return null
    try { return JSON.parse(match[1]) } catch { return null }
  }

  private buildPageUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl
    const url = new URL(baseUrl)
    url.searchParams.set("page", String(page))
    return url.toString()
  }

  private mapNextjsProduct(
    sourceSlug: string,
    category: ScraperCategory,
    fieldMap: NonNullable<ScraperSourceConfig["nextjsFieldMap"]>,
    urlTemplate: string,
    baseUrl: string,
    raw: unknown,
  ): ScrapedProduct | null {
    const externalId = String(getPath(raw, fieldMap.externalId) ?? "").trim()
    const name = String(getPath(raw, fieldMap.name) ?? "").trim()
    const priceVnd = Number(getPath(raw, fieldMap.price) ?? 0)

    if (!externalId || !name || priceVnd <= 0) return null

    const origVnd = fieldMap.originalPrice ? Number(getPath(raw, fieldMap.originalPrice) ?? 0) : 0

    const imageUrl = String(getPath(raw, fieldMap.imageUrl) ?? "")
    const inStockRaw = fieldMap.inStock ? getPath(raw, fieldMap.inStock) : true
    const inStock = Boolean(inStockRaw)

    // Build product URL from template — replace {baseUrl} and any {fieldName}
    let productUrl = urlTemplate.replace("{baseUrl}", baseUrl)
    const rawObj = raw as Record<string, unknown>
    for (const [k, v] of Object.entries(rawObj)) {
      productUrl = productUrl.replaceAll(`{${k}}`, String(v ?? ""))
    }

    if (!productUrl || productUrl === baseUrl) return null

    return {
      sourceSlug,
      categoryId: category.id,
      nicheSlug: category.nicheSlug,
      externalId,
      name,
      url: productUrl,
      imageUrl,
      price: priceVnd,
      originalPrice: origVnd > priceVnd ? origVnd : undefined,
      inStock,
    }
  }

  // ── html-selectors strategy ───────────────────────────────────────────────

  private async scrapeHtmlCategory(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    if (!config.selectors) {
      this.log.warn(`[Scraper] html-selectors strategy requires selectors config for ${category.id}`)
      return []
    }

    const maxPages = config.pagination?.maxPages ?? 1
    const delayMs = config.delayMs ?? 2000
    const allProducts: ScrapedProduct[] = []

    for (let page = 1; page <= maxPages; page++) {
      if (page > 1) {
        await sleep(Math.round(delayMs * (0.7 + Math.random() * 0.6)))
      }

      const url = this.buildHtmlPageUrl(category.url, config, page)
      this.log.debug(`[Scraper/html] Fetching: ${url}`)

      const html = await this.fetchPage(url, config)
      if (!html) break

      const products = this.extractHtmlProducts(sourceSlug, category, config, html, url)
      if (products.length === 0) break
      allProducts.push(...products)
    }

    return allProducts
  }

  private buildHtmlPageUrl(baseUrl: string, config: ScraperSourceConfig, page: number): string {
    if (page === 1 || !config.pagination) return baseUrl
    const p = config.pagination

    if (p.type === "page-param") {
      const param = p.pageParam ?? "page"
      const url = new URL(baseUrl)
      url.searchParams.set(param, String(page))
      return url.toString()
    }

    if (p.type === "offset-param") {
      const param = p.offsetParam ?? "offset"
      const size = p.pageSize ?? 20
      const url = new URL(baseUrl)
      url.searchParams.set(param, String((page - 1) * size))
      return url.toString()
    }

    return baseUrl
  }

  private extractHtmlProducts(
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

  // ── shared ────────────────────────────────────────────────────────────────

  private async fetchPage(url: string, config: ScraperSourceConfig): Promise<string | null> {
    const headers = { ...DEFAULT_HEADERS, ...(config.headers ?? {}) }
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      })
      if (!res.ok) {
        this.log.warn(`[Scraper] HTTP ${res.status} for ${url}`)
        return null
      }
      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("html")) {
        this.log.warn(`[Scraper] Non-HTML response (${ct}) for ${url}`)
        return null
      }
      return res.text()
    } catch (e: any) {
      this.log.warn(`[Scraper] Fetch failed: ${e.message} — ${url}`)
      return null
    }
  }
}
