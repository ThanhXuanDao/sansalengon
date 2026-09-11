import { Injectable, Logger } from "@nestjs/common"
import { PlatformAdapter, NormalizedProduct, PriceUpdate } from "../platform.adapter"

const BASE_URL = "https://tiki.vn/api/v2"
const TIMEOUT_MS = 10_000
const USER_AGENT = "Mozilla/5.0 (compatible; PriceBot/1.0)"

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
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (res.status === 429) throw new Error("Tiki rate limit exceeded")
      if (!res.ok) throw new Error(`Tiki API error: ${res.status}`)

      return await res.json()
    } catch (e) {
      this.log.warn(`Tiki fetch error: ${(e as Error).message} — ${url}`)
      return null
    }
  }
}
