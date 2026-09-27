"use client"

import { useRef, useCallback, useEffect } from "react"
import { useTrending } from "@/hooks/useTrending"
import ProductCard from "./ProductCard"
import ProductCardSkeleton from "@/components/ui/ProductCardSkeleton"
import { useCouponCounts } from "@/hooks/useCouponCounts"

const PX_PER_SEC = 50   // scroll speed in pixels/second
const MIN_COPIES = 4    // minimum number of item-set copies

interface TrendingWidgetProps {
  onBuyProduct?: (productId: string) => void
}

export default function TrendingWidget({ onBuyProduct }: TrendingWidgetProps) {
  const { data, isLoading } = useTrending()
  const couponCounts = useCouponCounts()
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startTranslate: number; isDragging: boolean } | null>(null)
  const hoverRef = useRef(false)

  const handleBuy = (productId: string) => {
    window.open(`/api/affiliate/redirect/${productId}?src=website`, "_blank")
    onBuyProduct?.(productId)
  }

  const getComputedTranslateX = (): number => {
    if (!trackRef.current) return 0
    const matrix = new DOMMatrix(window.getComputedStyle(trackRef.current).transform)
    return matrix.m41
  }

  const DRAG_THRESHOLD = 5

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!trackRef.current) return
    // Record start position only — don't capture yet so clicks reach child elements
    dragRef.current = { startX: e.clientX, startTranslate: getComputedTranslateX(), isDragging: false }
  }, [])

  const copiesRef = useRef(MIN_COPIES)

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current || !trackRef.current) return
    const delta = e.clientX - dragRef.current.startX

    if (!dragRef.current.isDragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD) return
      // Threshold exceeded — enter drag mode now
      dragRef.current.isDragging = true
      const currentX = getComputedTranslateX()
      trackRef.current.style.animation = "none"
      trackRef.current.style.transform = `translateX(${currentX}px)`
      dragRef.current.startTranslate = currentX
      trackRef.current.setPointerCapture(e.pointerId)
    }

    let next = dragRef.current.startTranslate + delta
    const oneSet = trackRef.current.scrollWidth / copiesRef.current
    if (next > 0) next -= oneSet
    if (next < -oneSet) next += oneSet
    trackRef.current.style.transform = `translateX(${next}px)`
  }, [])

  const handlePointerUp = useCallback(() => {
    const track = trackRef.current
    if (!track || !dragRef.current) return
    if (dragRef.current.isDragging) {
      const currentX = getComputedTranslateX()
      const oneSet = track.scrollWidth / copiesRef.current
      if (oneSet > 0) {
        let normalized = currentX % oneSet
        if (normalized > 0) normalized -= oneSet
        const duration = oneSet / PX_PER_SEC
        const pct = Math.abs(normalized) / oneSet
        const delay = -(pct * duration)
        track.style.setProperty("--trending-scroll-dist", `-${oneSet}px`)
        track.style.transform = ""
        track.style.animation = `trending-scroll ${duration}s linear ${delay}s infinite`
        if (hoverRef.current) track.style.animationPlayState = "paused"
      }
    }
    dragRef.current = null
  }, [])

  const products = data?.data ?? []

  // Repeat copies enough so track is always > 2× viewport — prevents white-space gap
  const copies = products.length > 0
    ? Math.max(MIN_COPIES, Math.ceil((typeof window !== "undefined" ? window.innerWidth * 3 : 4800) / (products.length * 220)) + 1)
    : MIN_COPIES
  const loopItems = products.length > 0
    ? Array.from({ length: copies }).flatMap(() => products)
    : []

  // After items render: measure one-set pixel width exactly, start animation via inline style
  useEffect(() => {
    const track = trackRef.current
    if (!track || products.length === 0) return

    copiesRef.current = copies
    const raf = requestAnimationFrame(() => {
      const oneSet = track.scrollWidth / copies
      if (oneSet <= 0) return
      const duration = oneSet / PX_PER_SEC
      track.style.setProperty("--trending-scroll-dist", `-${oneSet}px`)
      track.style.animation = `trending-scroll ${duration}s linear infinite`
    })
    return () => cancelAnimationFrame(raf)
  }, [products, copies])

  const MIN_DISTINCT = 3
  if (!isLoading && (!data || data.total === 0 || products.length < MIN_DISTINCT)) return null

  const windowLabel = data?.windowHours === 1 ? "1 giờ qua" : "24 giờ qua"

  return (
    <section
      aria-label="Đang xem nhiều"
      className="w-full bg-white isolate"
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
              <div key={i} className="shrink-0 w-[calc(33vw-12px)] md:w-[calc(16.7vw-12px)] max-w-[208px]">
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
            onMouseEnter={() => {
              hoverRef.current = true
              if (trackRef.current && !dragRef.current) {
                trackRef.current.style.animationPlayState = "paused"
              }
            }}
            onMouseLeave={() => {
              hoverRef.current = false
              if (trackRef.current && !dragRef.current) {
                trackRef.current.style.animationPlayState = "running"
              }
            }}
          >
            {loopItems.map((product, i) => (
              <div
                key={`${product.id}-${i}`}
                className="shrink-0 w-[calc(33vw-12px)] md:w-[calc(16.7vw-12px)] max-w-[208px]"
              >
                <ProductCard product={product} onBuy={handleBuy} couponCount={couponCounts[product.source] ?? 0} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
