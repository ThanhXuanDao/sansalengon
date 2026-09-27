import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct } from "./scraper.types"
import { HtmlSelectorsStrategy, NextjsDataStrategy, JsonLdItemListStrategy } from "./strategies"

const htmlSelectors  = new HtmlSelectorsStrategy()
const nextjsData     = new NextjsDataStrategy()
const jsonLdItemList = new JsonLdItemListStrategy()

export class ScraperEngine {
  scrapeCategory(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProduct[]> {
    switch (config.strategy ?? "html-selectors") {
      case "nextjs-data":     return nextjsData.scrape(sourceSlug, category, config)
      case "jsonld-itemlist": return jsonLdItemList.scrape(sourceSlug, category, config)
      default:                return htmlSelectors.scrape(sourceSlug, category, config)
    }
  }
}
