"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { ExternalLink, Star, ImageOff, ChevronDown, ChevronUp, LineChart, ArrowLeftRight } from "lucide-react"
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
  onBuy?: (productId: string) => void
  viewCount?: number // click count in recent window — shows 🔥 badge if > 0
}


const SOURCE_LABEL: Record<string, string> = {
  shopee:      "Shopee",
  tiki:        "Tiki",
  lazada:      "Lazada",
  accesstrade: "AccessTrade",
}

const SOURCE_BRAND_COLOR: Record<string, string> = {
  tiki:        "#1B9CE5",
  shopee:      "#EE4D2D",
  lazada:      "#0F146D",
  accesstrade: "#00B67A",
}

function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating)
  const hasHalfStar = rating - fullStars >= 0.25
  const halfFill = rating - fullStars
  const shineClass = rating > 4.5 ? "star-shine-high" : rating > 4 ? "star-shine-mid" : ""

  return (
    <div className="flex items-center gap-0.5 mt-1" aria-label={rating > 0 ? `Đánh giá ${rating.toFixed(1)} trên 5` : "Chưa có đánh giá"}>
      {[1, 2, 3, 4, 5].map((s) => {
        if (s <= fullStars) {
          return (
            <Star
              key={s}
              className={`size-3 text-sale-blob fill-sale-blob ${shineClass}`}
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
                <Star className={`size-3 text-sale-blob fill-sale-blob ${shineClass}`} />
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
  onBuy,
  viewCount,
}: ProductCardProps) {
  const formatPrice = useFormatPrice()
  const niche = useNicheByCategory(product.category?.slug ?? "")
  const isSoldOut = product.isSoldOut
  const [imgError, setImgError] = useState(false)
  const [showPriceHistory, setShowPriceHistory] = useState(false)

  const handleBuy = () => {
    if (isSoldOut) return
    onBuy?.(product.id)
  }

  return (
    <div
      className="receipt-card p-3 flex flex-col justify-between hover-lift h-full"
    >
      <div
        className="absolute top-0 left-0 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full pointer-events-none"
        style={{ background: SOURCE_BRAND_COLOR[product.source] ?? "#1D8CE8" }}
      >
        <span className="font-bold text-white text-xs leading-none tracking-wide">{sourceLabel(product.source)}</span>
      </div>
      {product.discountPct && product.discountPct > 0 && !isSoldOut && (
        <div className="absolute top-0 right-0 z-30 w-[50px] h-[50px] pointer-events-none" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/blob-bg.webp" alt="" className="absolute inset-0 w-full h-full object-contain" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-sans font-extrabold text-white text-[8px] leading-none">Giảm</span>
            <span className="font-sans font-extrabold text-white text-sm leading-tight">{product.discountPct}%</span>
          </div>
        </div>
      )}

      <div>
        <div
          className="relative w-full mb-3 overflow-hidden aspect-[4/3] cursor-pointer"
          onClick={!isSoldOut ? handleBuy : undefined}
          onKeyDown={(e) => { if (!isSoldOut && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleBuy(); } }}
          role="link"
          tabIndex={0}
          aria-label={`Xem ${product.name} trên ${sourceLabel(product.source)}`}
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
              sizes="(max-width: 768px) 50vw, 25vw"
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
            <h3
              className="font-medium text-sm text-ink leading-tight line-clamp-2 mt-1 cursor-pointer"
              onClick={!isSoldOut ? handleBuy : undefined}
            >
              {product.name}
            </h3>
            <StarRating rating={product.rating} />
          </div>
        </div>
      </div>
      <div className="mt-1">
        {product.discountPct && product.discountPct > 0 ? (
          <div className="flex items-baseline gap-2 mb-2">
            <p className="font-mono font-bold text-sale-blob tabular-nums text-lg">
              {formatPrice(Math.round(product.price * (1 - product.discountPct / 100)))}
            </p>
            <p className="font-mono text-xs text-ink/40 line-through tabular-nums shrink-0">
              {formatPrice(product.price)}
            </p>
          </div>
        ) : (
          <p
            className="font-mono font-bold text-ink mb-2 tabular-nums text-lg"
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
                : "bg-[#e8e8e5] text-ink hover:bg-primary hover:text-white cursor-pointer"
            }`}
          >
            {isSoldOut ? "Hết hàng" : "Mua ngay"}
            {!isSoldOut && <ExternalLink className="size-3" aria-hidden="true" />}
          </button>

          {/* Nút xem lịch sử giá */}
          <button
            onClick={() => setShowPriceHistory((p) => !p)}
            aria-expanded={showPriceHistory}
            aria-label="Xem lịch sử giá"
            title="Xem lịch sử giá — tránh sale ảo"
            className="px-2 py-1 brutalist-border bg-[#e8e8e5] text-ink hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
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
