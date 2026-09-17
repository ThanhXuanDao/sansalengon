"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { ExternalLink, Star, ImageOff, ChevronDown, ChevronUp, LineChart, Flame, ArrowLeftRight } from "lucide-react"
import Link from "next/link"
import type { Product } from "@/types"
import { useFormatPrice } from "@/lib/currency-context"
import { useNicheByCategory } from "@/lib/niche-context"

const PriceHistoryChart = dynamic(() => import("./PriceHistoryChart"), {
  loading: () => <div className="mt-3 pt-3 border-t border-dashed border-border-color h-24 skeleton-shimmer rounded" />,
})
const PlatformPriceBar = dynamic(() => import("@/components/compare/PlatformPriceBar"), {
  loading: () => null,
})

interface ProductCardProps {
  product: Product
  variant?: "highlight" | "compact"
  onBuy?: (productId: string) => void
  viewCount?: number // click count in recent window — shows 🔥 badge if > 0
}

const MAX_NAME_LENGTH = 60

function StarRating({ rating }: { rating: number }) {
  if (rating <= 0) return null
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating - fullStars >= 0.25
  const halfFill = rating - fullStars
  const shineClass = rating > 4.5 ? "star-shine-high" : rating > 4 ? "star-shine-mid" : ""

  return (
    <div className="flex items-center gap-0.5 mt-1" aria-label={`Đánh giá ${rating.toFixed(1)} trên 5`}>
      {[1, 2, 3, 4, 5].map((s) => {
        if (s <= fullStars) {
          return (
            <Star
              key={s}
              className={`size-3 text-[#f59e0b] fill-[#f59e0b] ${shineClass}`}
              aria-hidden="true"
            />
          )
        }
        if (hasHalfStar && s === fullStars + 1) {
          return (
            <span key={s} className="relative size-3" aria-hidden="true">
              <Star className="absolute inset-0 size-3 text-[#e2e3e0]" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${halfFill * 100}%` }}
              >
                <Star className={`size-3 text-[#f59e0b] fill-[#f59e0b] ${shineClass}`} />
              </span>
            </span>
          )
        }
        return (
          <Star
            key={s}
            className="size-3 text-[#e2e3e0]"
            aria-hidden="true"
          />
        )
      })}
      <span className="font-mono text-[10px] text-ink/50 ml-0.5">
        {rating.toFixed(1)}
      </span>
    </div>
  )
}

export default function ProductCard({
  product,
  variant = "compact",
  onBuy,
  viewCount,
}: ProductCardProps) {
  const formatPrice = useFormatPrice()
  const niche = useNicheByCategory(product.category?.slug ?? "")
  const isHighlight = variant === "highlight"
  const isSoldOut = product.isSoldOut
  const [nameExpanded, setNameExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)
  const nameNeedsTruncation = product.name.length > MAX_NAME_LENGTH

  const handleBuy = () => {
    if (isSoldOut) return
    onBuy?.(product.id)
  }

  return (
    <div
      className="receipt-card p-3 flex flex-col justify-between hover-lift h-full clip-bevel-tl-sm"
    >
      <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-bg border border-border-color z-20" />
      {isHighlight && !isSoldOut && (
        <span className="absolute top-2 right-2 bg-primary text-white font-mono text-[9px] font-bold uppercase px-2 py-0.5 z-30 tag-pulse">
          Hot Deal
        </span>
      )}
      {viewCount && viewCount > 0 && !isSoldOut && (
        <span className="absolute top-2 left-8 flex items-center gap-1 bg-black/70 text-white font-mono text-[9px] px-1.5 py-0.5 z-30">
          <Flame className="size-2.5 text-[#fdc73a] fill-[#fdc73a]" aria-hidden="true" />
          {viewCount >= 100 ? `${Math.floor(viewCount / 10) * 10}+` : viewCount} xem
        </span>
      )}
      <div>
        <div
          className="relative w-full border border-border-color mb-3 overflow-hidden aspect-[4/3] cursor-pointer"
          onClick={!isSoldOut ? handleBuy : undefined}
          onKeyDown={(e) => { if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleBuy(); } }}
          role="link"
          tabIndex={0}
          aria-label={`Xem ${product.name} trên Shopee`}
        >
          {imgError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[#e2e3e0]">
              <div className="text-center">
                <ImageOff className="size-8 mx-auto text-[#5c403a]/40" aria-hidden="true" />
                <p className="font-mono text-[10px] text-[#5c403a]/50 mt-1">No Image</p>
              </div>
            </div>
          ) : (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt}
              fill
              loading="lazy"
              fetchPriority="low"
              unoptimized
              className={`object-cover pointer-events-none ${isSoldOut ? "opacity-50" : ""}`}
              sizes={isHighlight ? "(max-width: 768px) 100vw, 33vw" : "(max-width: 768px) 50vw, 25vw"}
              onError={() => setImgError(true)}
            />
          )}
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="font-mono text-sm text-white font-bold uppercase tracking-wider bg-ink/60 px-3 py-1 border border-white/30">
                Hết hàng
              </span>
            </div>
          )}
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {isHighlight && (
              <span className="font-mono text-xs text-ink/60 uppercase">
                {product.category.name}
              </span>
            )}
            <StarRating rating={product.rating} />
            <h3
              className={`font-bold text-ink leading-tight ${isHighlight ? "" : "text-sm"} ${product.rating > 0 ? "mt-0" : "mt-1"} cursor-pointer hover:underline`}
              onClick={!isSoldOut ? handleBuy : undefined}
              onKeyDown={(e) => { if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleBuy(); } }}
              role="link"
              tabIndex={0}
              aria-label={`Xem ${product.name} trên Shopee`}
            >
              {nameNeedsTruncation && !nameExpanded
                ? `${product.name.slice(0, MAX_NAME_LENGTH)}...`
                : product.name}
            </h3>
            {nameNeedsTruncation && (
              <button
                onClick={() => setNameExpanded((p) => !p)}
                className="font-mono text-[10px] text-primary/70 hover:text-primary mt-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                aria-expanded={nameExpanded}
              >
                {nameExpanded ? "Thu gọn" : "Xem thêm"}
              </button>
            )}
          </div>
          {product.number > 0 && (
            <span className="font-mono text-[13px] font-bold text-ink/70 uppercase shrink-0 mt-1">
              #{product.number}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-dashed border-border-color">
        {product.discountPct && product.discountPct > 0 ? (
          <div className="flex items-start gap-2 mb-2">
            <div>
              <p className="font-mono text-xs text-ink/40 line-through tabular-nums">
                {formatPrice(product.price)}
              </p>
              <p
                className={`font-mono text-ink tabular-nums ${isHighlight ? "text-2xl" : "text-lg"}`}
              >
                {formatPrice(Math.round(product.price * (1 - product.discountPct / 100)))}
              </p>
            </div>
            <span className="font-mono text-[10px] font-bold text-white bg-[#ba1a1a] px-1.5 py-0.5 shrink-0">
              -{product.discountPct}%
            </span>
          </div>
        ) : (
          <p
            className={`font-mono text-ink mb-2 tabular-nums ${isHighlight ? "text-2xl" : "text-lg"}`}
          >
            {formatPrice(product.price)}
          </p>
        )}
        {/* Dual CTA */}
        <div className="flex gap-1.5">
          <button
            onClick={handleBuy}
            disabled={isSoldOut}
            aria-disabled={isSoldOut}
            className={`flex-1 py-1 font-bold text-xs uppercase brutalist-border transition-colors flex justify-center items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary ${
              isSoldOut
                ? "bg-[#e2e3e0] text-[#906f69] cursor-not-allowed"
                : isHighlight
                  ? "bg-primary text-white hover:bg-ink"
                  : "bg-[#e8e8e5] text-ink hover:bg-primary hover:text-white"
            }`}
          >
            {isSoldOut ? "Hết hàng" : isHighlight ? "Mua ngay" : "Mua ngay"}
            {!isSoldOut && <ExternalLink className="size-3" aria-hidden="true" />}
          </button>

          {/* Nút xem lịch sử giá */}
          <button
            onClick={() => setShowPriceHistory((p) => !p)}
            aria-expanded={showPriceHistory}
            aria-label="Xem lịch sử giá"
            title="Xem lịch sử giá — tránh sale ảo"
            className="px-2 py-1 brutalist-border bg-[#e8e8e5] text-ink hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LineChart className="size-3" aria-hidden="true" />
            {showPriceHistory
              ? <ChevronUp className="size-3" aria-hidden="true" />
              : <ChevronDown className="size-3" aria-hidden="true" />
            }
          </button>
        </div>

        {/* So sánh giá đa sàn */}
        <PlatformPriceBar productId={product.id} className="mt-2" />
        {(() => {
          return niche ? (
            <Link
              href={`/${niche.id}/compare/${product.id}`}
              className="flex items-center gap-1 font-mono text-[10px] text-ink/30 hover:text-primary mt-1.5 transition-colors w-fit"
            >
              <ArrowLeftRight className="size-3" aria-hidden="true" />
              So sánh giá đa sàn
            </Link>
          ) : null
        })()}

        {/* Lịch sử giá — lazy load khi mở */}
        {showPriceHistory && <PriceHistoryChart productId={product.id} />}
      </div>
      <div className="scan-line" />
    </div>
  )
}
