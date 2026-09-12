"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Flame } from "lucide-react"
import type { Product } from "@/types"
import { GalleryGrid, GalleryGridCell } from "@/components/blocks/CtaSectionWithGallery"
import { NICHES } from "@/lib/niches"

interface HeroProps {
  featuredProducts?: Product[]
  onBuyProduct?: (productId: string, shopeeUrl: string) => void
  isFeaturedLoading?: boolean
  storeName?: string
  tagline?: string
}

const defaultFeatured: Product[] = [
  {
    id: "3",
    name: "Smart Home Security Camera",
    price: 280000,
    commission: 0,
    rating: 4.9,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/camera/400/400",
    imageAlt: "Smart home security camera",
    shopeeUrl: "#",
    categoryId: "cat1",
    category: { id: "cat1", name: "Điện tử", slug: "dien-tu" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Wireless Earbuds ANC",
    price: 350000,
    commission: 0,
    rating: 4.5,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/earbuds/400/400",
    imageAlt: "Wireless earbuds with ANC",
    shopeeUrl: "#",
    categoryId: "cat3",
    category: { id: "cat3", name: "Gia dụng", slug: "gia-dung" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "4",
    name: "Smartwatch Pro Max",
    price: 899000,
    commission: 0,
    rating: 4.7,
    discountPct: null,
    imageUrl: "https://picsum.photos/seed/smartwatch/400/400",
    imageAlt: "Modern smartwatch",
    shopeeUrl: "#",
    categoryId: "cat1",
    category: { id: "cat1", name: "Điện tử", slug: "dien-tu" },
    isFeatured: true,
    isSoldOut: false,
    number: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "5",
    name: "Minimalist Desk Lamp",
    price: 180000,
    commission: 0,
    rating: 4.3,
    discountPct: null,
    imageUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=2487&auto=format&fit=crop",
    imageAlt: "Minimalist desk lamp",
    shopeeUrl: "#",
    categoryId: "cat3",
    category: { id: "cat3", name: "Gia dụng", slug: "gia-dung" },
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

  const handleCardClick = (productId: string, shopeeUrl: string) => {
    if (!onBuyProduct || shopeeUrl === "#") return
    onBuyProduct(productId, shopeeUrl)
  }

  return (
    <header>
      {/* ── Mobile hero ─────────────────────────────────────────── */}
      <div className="md:hidden bg-[#1a1c1b] pt-28">
        {/* Top strip */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-mono text-[18px] font-bold text-white uppercase tracking-tighter" translate="no">
            {storeName || "SanSaleNgon"}
          </span>
          <span className="flex items-center gap-1 font-mono text-[10px] text-[#fdc73a] border border-[#fdc73a]/30 px-2 py-0.5">
            <Flame className="size-3 fill-[#fdc73a]" />
            Deal hôm nay
          </span>
        </div>

        {/* Tagline */}
        <div className="px-4 pt-4 pb-3">
          <h1 className="font-mono text-[22px] font-bold text-white leading-tight mb-1">
            Mua thông minh,<br />
            <span className="text-[#fdc73a]">giá thấp nhất 30 ngày</span>
          </h1>
          <p className="font-mono text-[11px] text-white/50 leading-relaxed">
            {tagline || "Deal tổng hợp từ Shopee · cập nhật tự động mỗi 4 giờ"}
          </p>
        </div>

        {/* Niche quick-links */}
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-4 pt-1 scrollbar-hide"
          aria-label="Danh mục nhanh"
        >
          {NICHES.map((n) => (
            <Link
              key={n.id}
              href={`/${n.id}`}
              className="flex items-center gap-1.5 shrink-0 bg-white/8 border border-white/15 px-3 py-2 font-mono text-[11px] text-white/80 hover:bg-white/15 hover:text-white active:scale-95 transition-all"
            >
              <span className="text-[15px] leading-none">{n.emoji}</span>
              {n.name}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="px-4 pb-5">
          <a
            href="#products"
            className="flex items-center justify-center gap-2 w-full bg-[#b51c00] text-white font-mono text-[13px] font-bold py-3.5 active:scale-[.98] transition-transform"
          >
            Xem tất cả deal
            <ArrowRight className="size-4" />
          </a>
        </div>

        {/* Featured product thumbnails — horizontal scroll preview */}
        {!isFeaturedLoading && displayProducts.length > 0 && (
          <div
            className="flex gap-0.5 overflow-x-hidden border-t border-white/10"
            aria-hidden="true"
          >
            {displayProducts.slice(0, 4).map((p) => (
              <div key={p.id} className="relative flex-1 aspect-[3/2]">
                <Image
                  src={p.imageUrl}
                  alt=""
                  fill
                  className="object-cover brightness-[0.55]"
                  sizes="25vw"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop hero (unchanged) ─────────────────────────────── */}
      <div className="hidden md:block pt-40 pb-20 px-4 md:px-8 max-w-[1200px] mx-auto w-full relative overflow-hidden">
        <div className="hero-scan-line" />
        <div className="grid grid-cols-2 gap-12 items-center">
          <div className="space-y-6 z-10">
            <h1 className="font-sans text-display-lg text-ink leading-none uppercase text-pretty">
              {storeName || "Săn Sale Ngon"},
              <br />
              Tiết Kiệm Thật
            </h1>
            <p className="text-ink/60 max-w-md">
              {tagline || "Deal tổng hợp từ Shopee · tuyển chọn kỹ · cập nhật tự động mỗi 4 giờ"}
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
                      onClick={() => handleCardClick(product.id, product.shopeeUrl)}
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
