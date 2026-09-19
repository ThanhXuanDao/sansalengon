"use client"

import { useRef, useCallback } from "react"
import { useTrending } from "@/hooks/useTrending"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"

const ANIM_DURATION = 40 // seconds

interface TrendingWidgetProps {
  onBuyProduct?: (productId: string) => void
}

export default function TrendingWidget({ onBuyProduct }: TrendingWidgetProps) {
  const { data, isLoading } = useTrending()
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startTranslate: number } | null>(null)

  const handleBuy = (productId: string) => {
    window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
    onBuyProduct?.(productId)
  }

  const getComputedTranslateX = (): number => {
    if (!trackRef.current) return 0
    const matrix = new DOMMatrix(window.getComputedStyle(trackRef.current).transform)
    return matrix.m41
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const track = trackRef.current
    if (!track) return
    const currentX = getComputedTranslateX()
    track.style.animation = "none"
    track.style.transform = `translateX(${currentX}px)`
    dragRef.current = { startX: e.clientX, startTranslate: currentX }
    track.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !trackRef.current) return
    const delta = e.clientX - dragRef.current.startX
    let next = dragRef.current.startTranslate + delta
    // Keep within one loop length for seamless wrap
    const halfWidth = trackRef.current.scrollWidth / 2
    if (next > 0) next -= halfWidth
    if (next < -halfWidth) next += halfWidth
    trackRef.current.style.transform = `translateX(${next}px)`
  }, [])

  const handlePointerUp = useCallback(() => {
    const track = trackRef.current
    if (!track || !dragRef.current) return
    const currentX = getComputedTranslateX()
    const halfWidth = track.scrollWidth / 2
    // Normalize to [-halfWidth, 0]
    let normalized = currentX % halfWidth
    if (normalized > 0) normalized -= halfWidth
    // Compute animation-delay so animation continues from this point
    const pct = Math.abs(normalized) / halfWidth
    const delay = -(pct * ANIM_DURATION)
    track.style.transform = ""
    track.style.animation = `trending-scroll ${ANIM_DURATION}s linear ${delay}s infinite`
    dragRef.current = null
  }, [])

  if (!isLoading && (!data || data.total === 0)) return null

  const products = data?.data ?? []
  const windowLabel = data?.windowHours === 1 ? "1 giờ qua" : "24 giờ qua"
  const loopItems = products.length > 0 ? [...products, ...products] : []

  return (
    <section
      aria-label="Đang xem nhiều"
      className="w-full border-b border-dashed border-border-color bg-[#fffdf5]"
    >
      <div className="max-w-[1320px] mx-auto px-3 pt-5 pb-3">
        <h2 className="font-sans font-extrabold text-lg text-ink tracking-tight">
          🔥 Đang xem nhiều
        </h2>
        <p className="font-mono text-xs text-ink/50 mt-0.5 mb-4">
          Sản phẩm đang được nhiều người quan tâm{!isLoading && data ? ` · ${windowLabel}` : ""}
        </p>
      </div>

      <div className="overflow-hidden pb-5 select-none cursor-grab active:cursor-grabbing">
        {isLoading ? (
          <div className="flex gap-3 md:gap-4 px-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[calc(50vw-18px)] md:w-[calc(25vw-18px)] max-w-[312px]">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        ) : (
          <div
            ref={trackRef}
            className="flex gap-3 md:gap-4 trending-track"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {loopItems.map((product, i) => (
              <div
                key={`${product.id}-${i}`}
                className="shrink-0 w-[calc(50vw-18px)] md:w-[calc(25vw-18px)] max-w-[312px]"
              >
                <ProductCard product={product} onBuy={handleBuy} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
