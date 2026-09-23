"use client"

import { useEffect, useState } from "react"
import { TrendingDown } from "lucide-react"
import { useFormatPrice } from "@/lib/currency-context"

interface PlatformEntry {
  platformId: string
  platformName: string
  platformUrl: string
  currentPrice: number
  inStock: boolean
  isCheapest: boolean
}

interface CompareData {
  platforms: PlatformEntry[]
  cheapestPrice: number
  savings: number
}

const PLATFORM_COLORS: Record<string, string> = {
  shopee:  "#ee4d2d",
  lazada:  "#0f146b",
  tiki:    "#189eff",
  tiktok:  "#010101",
}

const PLATFORM_SHORT: Record<string, string> = {
  shopee: "SH",
  lazada: "LZ",
  tiki:   "TK",
  tiktok: "TT",
}

interface Props {
  productId: string
  className?: string
}

export default function PlatformPriceBar({ productId, className = "" }: Props) {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const formatPrice = useFormatPrice()

  useEffect(() => {
    let cancelled = false
    fetch(`/api/products/${productId}/compare`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  if (loading) {
    return (
      <div className={`h-6 skeleton-shimmer rounded ${className}`} aria-hidden="true" />
    )
  }

  // Only show if there are non-Shopee platforms with data
  if (!data || data.platforms.length <= 1) return null

  const hasSavings = data.savings > 0

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`} aria-label="So sánh giá đa sàn">
      {hasSavings && (
        <span className="flex items-center gap-0.5 font-mono text-[10px] text-[#1a6e3c] font-bold">
          <TrendingDown className="size-3" aria-hidden="true" />
          -{formatPrice(data.savings)}
        </span>
      )}

      {data.platforms.map((p) => (
        <a
          key={p.platformId}
          href={p.inStock ? p.platformUrl : undefined}
          target="_blank"
          rel="noopener noreferrer"
          title={`${p.platformName}: ${formatPrice(p.currentPrice)}`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] border transition-opacity ${
            !p.inStock ? "opacity-40 cursor-default" : "hover:opacity-80"
          } ${p.isCheapest ? "border-[#1a6e3c] bg-[#edfaf1]" : "border-border-color bg-white"}`}
          onClick={!p.inStock ? (e) => e.preventDefault() : undefined}
          aria-disabled={!p.inStock}
        >
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: PLATFORM_COLORS[p.platformId] ?? "#888" }}
            aria-hidden="true"
          />
          <span className={p.isCheapest ? "text-[#1a6e3c]" : ""}>
            {PLATFORM_SHORT[p.platformId] ?? p.platformId.slice(0, 2).toUpperCase()}
          </span>
          <span className={p.isCheapest ? "text-[#1a6e3c] font-bold" : "text-ink/60"}>
            {formatPrice(p.currentPrice)}
          </span>
          {p.isCheapest && <span className="text-[#1a6e3c]">✓</span>}
        </a>
      ))}
    </div>
  )
}
