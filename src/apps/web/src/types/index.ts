export interface Product {
  id: string
  name: string
  price: number
  commission: number
  rating: number
  discountPct: number | null
  imageUrl: string
  imageAlt: string
  productUrl: string
  affiliateUrl: string | null
  source: string
  externalId?: string | null
  lastSyncedAt?: string | null
  categoryId: string
  category: { id: string; name: string; slug: string }
  isFeatured: boolean
  isSoldOut: boolean
  number: number
  createdAt: string
  clicks?: { id: string }[]
}

export interface Category {
  id: string
  name: string
  slug: string
  icon?: string
}
