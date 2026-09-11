import { Injectable } from "@nestjs/common"
import { PlatformAdapter, NormalizedProduct, PriceUpdate } from "../platform.adapter"
import { ShopeeAffiliateClient } from "../../affiliate/shopee/client"

@Injectable()
export class ShopeeAdapter extends PlatformAdapter {
  readonly platformId = "shopee"

  constructor(private readonly client: ShopeeAffiliateClient) {
    super()
  }

  async searchByName(query: string, limit = 10): Promise<NormalizedProduct[]> {
    const { nodes } = await this.client.productSearch({
      keyword: query,
      pageSize: Math.min(limit, 20),
      sort: "SALES_DESC",
    })

    return nodes.map((n) => ({
      platformProductId: String(n.itemId),
      platformUrl: n.productLink,
      name: n.productName,
      price: Math.round(n.priceMin * 100),
      imageUrl: n.imageUrl,
      inStock: true,
    }))
  }

  async fetchPrice(platformProductId: string): Promise<PriceUpdate> {
    // Shopee doesn't have a lightweight price endpoint in affiliate API;
    // do a productSearch with the item name as fallback, or use productOfferV2.
    // For now return a stub — price updates come from the main sync cycle.
    throw new Error(`ShopeeAdapter.fetchPrice not implemented for item ${platformProductId}`)
  }

  async fetchProduct(platformProductId: string): Promise<NormalizedProduct> {
    throw new Error(`ShopeeAdapter.fetchProduct not implemented for item ${platformProductId}`)
  }
}
