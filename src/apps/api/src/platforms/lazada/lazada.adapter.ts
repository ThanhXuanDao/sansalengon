import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import * as crypto from "crypto"
import { PlatformAdapter, NormalizedProduct, PriceUpdate } from "../platform.adapter"

const BASE_URL = "https://api.lazada.vn/rest"
const TIMEOUT_MS = 10_000

interface LazadaProduct {
  item_id: number
  name: string
  sku_id?: number
  price: string          // e.g. "250000"
  original_price?: string
  item_url: string
  image: string
  review_count?: number
  rating_score?: string
  sold_quantity?: number
}

@Injectable()
export class LazadaAdapter extends PlatformAdapter {
  readonly platformId = "lazada"
  private readonly log = new Logger(LazadaAdapter.name)

  constructor(private readonly cfg: ConfigService) {
    super()
  }

  async searchByName(query: string, limit = 10): Promise<NormalizedProduct[]> {
    const params: Record<string, string> = {
      method: "lazada.affiliate.products.query",
      keywords: query,
      page_size: String(Math.min(limit, 50)),
      page_no: "1",
    }

    const data = await this.call(params)
    const items: LazadaProduct[] = data?.result?.data ?? []

    return items.map((item) => this.normalize(item))
  }

  async fetchPrice(platformProductId: string): Promise<PriceUpdate> {
    const params: Record<string, string> = {
      method: "lazada.affiliate.products.query",
      keywords: platformProductId,
      page_size: "1",
    }

    const data = await this.call(params)
    const item: LazadaProduct | undefined = data?.result?.data?.[0]

    if (!item) throw new Error(`Lazada: product ${platformProductId} not found`)

    return {
      price: Math.round(parseFloat(item.price)),
      inStock: true,
    }
  }

  async fetchProduct(platformProductId: string): Promise<NormalizedProduct> {
    const params: Record<string, string> = {
      method: "lazada.affiliate.products.query",
      keywords: platformProductId,
      page_size: "1",
    }

    const data = await this.call(params)
    const item: LazadaProduct | undefined = data?.result?.data?.[0]
    if (!item) throw new Error(`Lazada: product ${platformProductId} not found`)

    return this.normalize(item)
  }

  private normalize(item: LazadaProduct): NormalizedProduct {
    return {
      platformProductId: String(item.item_id),
      platformUrl: item.item_url,
      name: item.name,
      price: Math.round(parseFloat(item.price)),
      originalPrice: item.original_price
        ? Math.round(parseFloat(item.original_price))
        : undefined,
      imageUrl: item.image,
      rating: item.rating_score ? parseFloat(item.rating_score) : undefined,
      soldCount: item.sold_quantity,
      inStock: true,
    }
  }

  private async call(params: Record<string, string>): Promise<any> {
    const appKey = this.cfg.get<string>("LAZADA_APP_KEY")
    const appSecret = this.cfg.get<string>("LAZADA_APP_SECRET")

    if (!appKey || !appSecret) {
      this.log.warn("LAZADA_APP_KEY/SECRET not configured — skipping Lazada")
      return null
    }

    const timestamp = Date.now()
    const allParams: Record<string, string> = {
      ...params,
      app_key: appKey,
      timestamp: String(timestamp),
      sign_method: "sha256",
      format: "json",
      v: "2.0",
    }

    allParams.sign = this.sign(allParams, appSecret)

    const qs = new URLSearchParams(allParams).toString()
    const url = `${BASE_URL}?${qs}`

    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (res.status === 429) throw new Error("Lazada rate limit exceeded")
    if (!res.ok) throw new Error(`Lazada API error: ${res.status}`)

    const body = await res.json()

    if (body.code && body.code !== "0") {
      this.log.warn(`Lazada error code ${body.code}: ${body.message}`)
      return null
    }

    return body
  }

  private sign(params: Record<string, string>, secret: string): string {
    // Lazada HMAC-SHA256 signature: concatenate sorted key-value pairs
    const sortedKeys = Object.keys(params).filter((k) => k !== "sign").sort()
    const base = sortedKeys.map((k) => `${k}${params[k]}`).join("")
    return crypto.createHmac("sha256", secret).update(base).digest("hex").toUpperCase()
  }
}
