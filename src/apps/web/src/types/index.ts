export interface Product {
  id: string
  name: string
  price: number
  originalPrice: number | null
  commission: number
  rating: number
  discountPct: number | null
  imageUrl: string
  imageAlt: string
  productUrl: string
  affiliateUrl: string | null
  source: string
  sourceLogoUrl?: string | null
  externalId?: string | null
  lastSyncedAt?: string | null
  categoryId: string
  category: { id: string; name: string; emoji: string }
  isFeatured: boolean
  isSoldOut: boolean
  number: number
  createdAt: string
  clicks?: { id: string }[]
}

export interface Category {
  id: string
  name: string
  emoji: string
  status: string
  description?: string | null
  sortOrder?: number
}
