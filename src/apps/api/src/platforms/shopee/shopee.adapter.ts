import { Injectable } from "@nestjs/common"
import { PlatformAdapter, NormalizedProduct, PriceUpdate } from "../platform.adapter"

@Injectable()
export class ShopeeAdapter extends PlatformAdapter {
  readonly platformId = "shopee"

  constructor() {
    super()
  }

  async searchByName(_query: string, _limit = 10): Promise<NormalizedProduct[]> {
    return []
  }

  async fetchPrice(platformProductId: string): Promise<PriceUpdate> {
    throw new Error(`ShopeeAdapter.fetchPrice not implemented for item ${platformProductId}`)
  }

  async fetchProduct(platformProductId: string): Promise<NormalizedProduct> {
    throw new Error(`ShopeeAdapter.fetchProduct not implemented for item ${platformProductId}`)
  }
}
