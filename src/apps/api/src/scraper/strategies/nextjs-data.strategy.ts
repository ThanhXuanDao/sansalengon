import { BaseScraper } from "./base.scraper"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "../scraper.types"

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Resolve a dot-path like "a.b.c" against an object safely. */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur == null || typeof cur !== "object") return undefined
    return (cur as Record<string, unknown>)[key]
  }, obj)
}

export class NextjsDataStrategy extends BaseScraper {
  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    const { nextjsDataPath: dataPath, nextjsFieldMap: fieldMap, nextjsPaginationPath: paginationPath } = config

    if (!dataPath || !fieldMap) {
      this.log.warn(`[nextjs-data] Thiếu nextjsDataPath + nextjsFieldMap cho ${category.id}`)
      return []
    }

    const allProducts: ScrapedProduct[] = []
    const delayMs = config.delayMs ?? 2000
    const configMaxPages = config.pagination?.maxPages ?? 5
    let page = 1
    let lastPage = 1

    do {
      if (page > 1) await sleep(Math.round(delayMs * (0.7 + Math.random() * 0.6)))

      const url = this.buildPageUrl(category.url, page)
      this.log.debug(`[nextjs-data] Fetching: ${url}`)

      const html = await this.fetchPage(url, config)
      if (!html) break

      const nextData = this.extractNextData(html)
      if (!nextData) {
        this.log.warn(`[nextjs-data] Không tìm thấy __NEXT_DATA__ tại ${url}`)
        break
      }

      const rawProducts = getPath(nextData, dataPath)
      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        this.log.debug(`[nextjs-data] Mảng sản phẩm rỗng tại page ${page}`)
        break
      }

      if (paginationPath && page === 1) {
        const pag = getPath(nextData, paginationPath) as Record<string, number> | undefined
        const siteLast = pag?.last_page ?? 1
        lastPage = Math.min(siteLast, configMaxPages)
        this.log.debug(`[nextjs-data] ${category.id}: ${pag?.total ?? "?"} sản phẩm, ${siteLast} trang, giới hạn ${lastPage}`)
      }

      const baseUrl = new URL(category.url).origin

      for (const raw of rawProducts) {
        if (config.skipWhen) {
          if (getPath(raw, config.skipWhen)) continue
        }

        const product = this.mapProduct(sourceSlug, category, fieldMap, config.productUrlTemplate ?? "", baseUrl, raw)
        if (product) allProducts.push(product)
      }

      page++
    } while (page <= lastPage)

    return allProducts
  }

  private buildPageUrl(baseUrl: string, page: number): string {
    if (page === 1) return baseUrl
    const url = new URL(baseUrl)
    url.searchParams.set("page", String(page))
    return url.toString()
  }

  private extractNextData(html: string): unknown {
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
    if (!match) return null
    try { return JSON.parse(match[1]) } catch { return null }
  }

  private mapProduct(
    sourceSlug: string,
    category: ScraperCategory,
    fieldMap: NonNullable<ScraperSourceConfig["nextjsFieldMap"]>,
    urlTemplate: string,
    baseUrl: string,
    raw: unknown,
  ): ScrapedProduct | null {
    const externalId = String(getPath(raw, fieldMap.externalId) ?? "").trim()
    const name = String(getPath(raw, fieldMap.name) ?? "").trim()
    const price = Number(getPath(raw, fieldMap.price) ?? 0)

    if (!externalId || !name || price <= 0) return null

    const originalPrice = fieldMap.originalPrice ? Number(getPath(raw, fieldMap.originalPrice) ?? 0) : 0
    const imageUrl = String(getPath(raw, fieldMap.imageUrl) ?? "")
    const inStock = fieldMap.inStock ? Boolean(getPath(raw, fieldMap.inStock)) : true

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
      price,
      originalPrice: originalPrice > price ? originalPrice : undefined,
      inStock,
    }
  }
}
