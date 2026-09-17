"use client"

import { useRef } from "react"
import Image from "next/image"
import { Flame, ChevronLeft, ChevronRight, Eye, ImageOff } from "lucide-react"
import { useTrending, type TrendingProduct } from "@/hooks/useTrending"
import { useFormatPrice } from "@/lib/currency-context"

// ── Individual card ──────────────────────────────────────────────────────────

function TrendingCard({ product, onBuy }: { product: TrendingProduct; onBuy: (p: TrendingProduct) => void }) {
  const formatPrice = useFormatPrice()
  const salePrice = product.discountPct
    ? Math.round(product.price * (1 - product.discountPct / 100))
    : product.price

  return (
    <button
      onClick={() => onBuy(product)}
      className="group flex-shrink-0 w-[140px] sm:w-[160px] text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      aria-label={`Xem ${product.name}`}
    >
      {/* Image container */}
      <div className="relative w-full aspect-square overflow-hidden border border-border-color mb-2 bg-[#e2e3e0]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            loading="lazy"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff className="size-6 text-[#5c403a]/30" />
          </div>
        )}

        {/* Discount badge */}
        {product.discountPct && product.discountPct > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-primary text-white font-mono text-[9px] font-bold px-1.5 py-0.5">
            -{product.discountPct}%
          </span>
        )}

        {/* View count badge */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-4 pb-1.5">
          <span className="flex items-center gap-1 font-mono text-[10px] text-white">
            <Eye className="size-3 shrink-0" aria-hidden="true" />
            <span>
              {product.viewCount >= 100
                ? `${Math.floor(product.viewCount / 10) * 10}+`
                : product.viewCount}{" "}
              xem
            </span>
          </span>
        </div>
      </div>

      {/* Name */}
      <p className="font-sans text-[12px] font-semibold text-ink leading-tight line-clamp-2 mb-1 group-hover:text-primary transition-colors">
        {product.name}
      </p>

      {/* Price */}
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="font-mono text-[13px] font-bold text-ink tabular-nums">
          {formatPrice(salePrice)}
        </span>
        {product.discountPct && product.discountPct > 0 && (
          <span className="font-mono text-[10px] text-ink/40 line-through tabular-nums">
            {formatPrice(product.price)}
          </span>
        )}
      </div>
    </button>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function TrendingCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[140px] sm:w-[160px] animate-pulse">
      <div className="w-full aspect-square bg-[#e2e3e0] mb-2" />
      <div className="h-3 bg-[#e2e3e0] rounded w-full mb-1" />
      <div className="h-3 bg-[#e2e3e0] rounded w-2/3" />
    </div>
  )
}

// ── Widget ───────────────────────────────────────────────────────────────────

interface TrendingWidgetProps {
  onBuyProduct?: (productId: string) => void
}

export default function TrendingWidget({ onBuyProduct }: TrendingWidgetProps) {
  const { data, isLoading } = useTrending()
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return
    scrollRef.current.scrollBy({ left: dir === "right" ? 320 : -320, behavior: "smooth" })
  }

  const handleBuy = (product: TrendingProduct) => {
    window.open(`/api/affiliate/redirect/${product.id}?src=website`, "_blank")
    onBuyProduct?.(product.id)
  }

  // Don't render anything if no data and not loading
  if (!isLoading && (!data || data.total === 0)) return null

  const windowLabel = data?.windowHours === 1 ? "1 giờ qua" : "24 giờ qua"

  return (
    <section
      aria-label="Đang xem nhiều"
      className="w-full border-b border-dashed border-border-color bg-[#fffdf5]"
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-primary fill-primary" aria-hidden="true" />
            <h2 className="font-sans text-[16px] sm:text-[18px] font-extrabold text-ink uppercase tracking-tight">
              Đang xem nhiều
            </h2>
            {!isLoading && data && (
              <span className="font-mono text-[10px] text-ink/40 hidden sm:block">
                · {windowLabel}
              </span>
            )}
          </div>

          {/* Scroll controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll("left")}
              aria-label="Cuộn sang trái"
              className="size-7 flex items-center justify-center border border-border-color bg-white hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Cuộn sang phải"
              className="size-7 flex items-center justify-center border border-border-color bg-white hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-hide"
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <TrendingCardSkeleton key={i} />)
            : data?.data.map((product) => (
                <TrendingCard key={product.id} product={product} onBuy={handleBuy} />
              ))}
        </div>
      </div>
    </section>
  )
}
