export interface NormalizedProduct {
  platformProductId: string
  platformUrl: string
  name: string
  price: number        // VND, integer
  originalPrice?: number
  imageUrl: string
  rating?: number
  soldCount?: number
  inStock: boolean
  barcode?: string
}

export interface PriceUpdate {
  price: number
  inStock: boolean
}

export abstract class PlatformAdapter {
  abstract readonly platformId: string

  /** Search by keyword, returns top candidates */
  abstract searchByName(query: string, limit?: number): Promise<NormalizedProduct[]>

  /** Lightweight price+stock check for already-matched products */
  abstract fetchPrice(platformProductId: string): Promise<PriceUpdate>

  /** Full product detail fetch */
  abstract fetchProduct(platformProductId: string): Promise<NormalizedProduct>
}
