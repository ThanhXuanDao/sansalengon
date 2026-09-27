import { Logger } from "@nestjs/common"
import type { ScraperSourceConfig } from "../scraper.types"

export const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
}

export abstract class BaseScraper {
  protected readonly log = new Logger(this.constructor.name)

  protected async fetchPage(url: string, config: ScraperSourceConfig): Promise<string | null> {
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
