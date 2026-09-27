"use client"

import Image from "next/image"
import { ArrowRight } from "lucide-react"
import type { Product } from "@/types"
import { GalleryGrid, GalleryGridCell } from "@/components/blocks/CtaSectionWithGallery"

interface HeroProps {
  featuredProducts?: Product[]
  onBuyProduct?: (productId: string) => void
  isFeaturedLoading?: boolean
  storeName?: string
  tagline?: string
}

const defaultFeatured: Product[] = [
  {
    id: "3",
    name: "Smart Home Security Camera",
    price: 280000,
    originalPrice: null,
    commission: 0,
    rating: 4.9,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/camera/400/400",
    imageAlt: "Smart home security camera",
    productUrl: "#",
    affiliateUrl: null,
    platformAffiliateUrl: null,
    source: "shopee",
    categoryId: "cat1",
    category: { id: "cat1", name: "Điện tử", emoji: "📱" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Wireless Earbuds ANC",
    price: 350000,
    originalPrice: null,
    commission: 0,
    rating: 4.5,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/earbuds/400/400",
    imageAlt: "Wireless earbuds with ANC",
    productUrl: "#",
    affiliateUrl: null,
    platformAffiliateUrl: null,
    source: "shopee",
    categoryId: "cat3",
    category: { id: "cat3", name: "Gia dụng", emoji: "🏠" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "4",
    name: "Smartwatch Pro Max",
    price: 899000,
    originalPrice: null,
    commission: 0,
    rating: 4.7,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/smartwatch/400/400",
    imageAlt: "Modern smartwatch",
    productUrl: "#",
    affiliateUrl: null,
    platformAffiliateUrl: null,
    source: "shopee",
    categoryId: "cat1",
    category: { id: "cat1", name: "Điện tử", emoji: "📱" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "5",
    name: "Minimalist Desk Lamp",
    price: 180000,
    originalPrice: null,
    commission: 0,
    rating: 4.3,
    discountPct: null,
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2487&auto=format&fit=crop",
    imageAlt: "Minimalist desk lamp",
    productUrl: "#",
    affiliateUrl: null,
    platformAffiliateUrl: null,
    source: "shopee",
    categoryId: "cat3",
    category: { id: "cat3", name: "Gia dụng", emoji: "🏠" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

export default function Hero({
  featuredProducts,
  onBuyProduct,
  isFeaturedLoading,
  storeName,
  tagline,
}: HeroProps) {
  const displayProducts = featuredProducts?.length ? featuredProducts : defaultFeatured
  const gridProducts = displayProducts.slice(0, 4)

  const handleCardClick = (productId: string) => {
    if (!onBuyProduct || productId === "#") return
    onBuyProduct(productId)
  }

  return (
    <header>
      <div className="pt-28 pb-8 md:pt-40 md:pb-20 px-3 max-w-[1320px] mx-auto w-full relative overflow-hidden">
        <div className="hero-scan-line" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div className="space-y-6 z-10 min-h-[323px] flex flex-col justify-center">
            <h1 className="font-sans text-display-lg text-ink leading-none uppercase text-pretty">
              {storeName || "Săn Sale Ngon"},
              <br />
              Tiết Kiệm Thật
            </h1>
            <p className="text-ink/60 max-w-md">
              {tagline || "Deal tổng hợp từ nhiều nguồn · tuyển chọn kỹ · cập nhật tự động mỗi 4 giờ"}
            </p>
            <a
              href="#products"
              className="inline-block bg-primary text-ink px-8 py-4 font-bold rounded-full brutalist-shadow text-lg uppercase tracking-wider mt-4 focus-visible:ring-2 focus-visible:ring-primary"
            >
              Xem Tất Cả Deal
            </a>
          </div>

          <div>
            {isFeaturedLoading ? (
              <GalleryGrid className="animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`relative overflow-hidden rounded-xl bg-[#e8e8e5] shadow-xl ${[
                      "col-start-2 col-end-3 row-start-1 row-end-3",
                      "col-start-1 col-end-2 row-start-2 row-end-4",
                      "col-start-1 col-end-2 row-start-4 row-end-6",
                      "col-start-2 col-end-3 row-start-3 row-end-5",
                    ][i]}`}
                  />
                ))}
              </GalleryGrid>
            ) : (
              <GalleryGrid>
                {gridProducts.map((product, index) => (
                  <GalleryGridCell key={product.id} index={index}>
                    <button
                      onClick={() => handleCardClick(product.id)}
                      className="group relative size-full cursor-pointer text-left overflow-hidden rounded-xl"
                      aria-label={`Xem ${product.name}`}
                    >
                      <Image
                        src={product.imageUrl}
                        alt={product.imageAlt}
                        fill
                        loading={index < 2 ? "eager" : "lazy"}
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 768px) 100vw, 300px"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <span className="font-mono text-[10px] uppercase text-white/70 tracking-wider">
                          {product.category.name}
                        </span>
                        <p className="font-sans text-sm font-bold text-white leading-tight mt-0.5 line-clamp-1">
                          {product.name}
                        </p>
                        <span className="font-mono text-xs text-white/90 mt-1 block">
                          {(product.price / 1000).toFixed(0)}k₫
                        </span>
                      </div>
                      <ArrowRight className="absolute top-3 right-3 size-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                    </button>
                  </GalleryGridCell>
                ))}
              </GalleryGrid>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
