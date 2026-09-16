import { Injectable, Logger } from "@nestjs/common"
import { PlatformAdapter, NormalizedProduct, PriceUpdate } from "../platform.adapter"
import { BotSafeFetcher } from "../../shared/bot-safe-fetcher"

const BASE_URL = "https://tiki.vn/api/v2"

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://tiki.vn/",
  "Origin": "https://tiki.vn",
  "x-guest-token": "",
}

interface TikiProduct {
  id: number
  name: string
  url_key: string
  price: number
  list_price: number
  original_price?: number
  thumbnail_url: string
  rating_average: number
  review_count: number
  quantity_sold?: { value: number }
  sku?: string
}

@Injectable()
export class TikiAdapter extends PlatformAdapter {
  readonly platformId = "tiki"
  private readonly log = new Logger(TikiAdapter.name)
  private readonly fetcher = new BotSafeFetcher({
    baseDelayMs: 800,
    jitterFactor: 0.5,
    blockBackoffMs: 3000,
    timeoutMs: 15_000,
    loggerName: "TikiAdapter",
  })

  async searchByName(query: string, limit = 10): Promise<NormalizedProduct[]> {
    const url = new URL(`${BASE_URL}/products`)
    url.searchParams.set("q", query)
    url.searchParams.set("sort", "top_seller")
    url.searchParams.set("limit", String(Math.min(limit, 40)))

    const data = await this.get(url.toString())
    const items: TikiProduct[] = data?.data ?? []

    return items.map((item) => this.normalize(item))
  }

  async fetchPrice(platformProductId: string): Promise<PriceUpdate> {
    const product = await this.fetchProduct(platformProductId)
    return { price: product.price, inStock: true }
  }

  async fetchProduct(platformProductId: string): Promise<NormalizedProduct> {
    const url = `${BASE_URL}/products/${platformProductId}`
    const data = await this.get(url)
    if (!data) throw new Error(`Tiki: product ${platformProductId} not found`)
    return this.normalize(data)
  }

  private normalize(item: TikiProduct): NormalizedProduct {
    return {
      platformProductId: String(item.id),
      platformUrl: `https://tiki.vn/${item.url_key}.html`,
      name: item.name,
      price: item.price,
      originalPrice: item.list_price > item.price ? item.list_price : undefined,
      imageUrl: item.thumbnail_url,
      rating: item.rating_average,
      soldCount: item.quantity_sold?.value,
      inStock: true,
      barcode: item.sku,
    }
  }

  private async get(url: string): Promise<any> {
    const { data } = await this.fetcher.fetchJson(url, BROWSER_HEADERS)
    return data
  }
}
