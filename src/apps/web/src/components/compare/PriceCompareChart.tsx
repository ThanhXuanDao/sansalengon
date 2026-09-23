"use client"

import { useEffect, useState, useRef } from "react"
import { useFormatPrice } from "@/lib/currency-context"

interface Platform { platformId: string; platformName: string }

interface Props {
  productId: string
  platforms: Platform[]
}

const PLATFORM_COLORS: Record<string, string> = {
  shopee: "#ee4d2d",
  lazada: "#6875e0",
  tiki:   "#189eff",
  tiktok: "#555",
}

type HistoryData = Record<string, { price: number; recordedAt: string }[]>

export default function PriceCompareChart({ productId, platforms }: Props) {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const formatPrice = useFormatPrice()
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/products/${productId}/price-history?platform=all`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d.data ?? null) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  if (loading) return <div className="h-48 skeleton-shimmer" aria-hidden="true" />

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="h-32 flex items-center justify-center border border-dashed border-border-color">
        <p className="font-mono text-[12px] text-ink/40">Chưa có dữ liệu lịch sử giá đa sàn</p>
      </div>
    )
  }

  // Collect all unique dates across platforms
  const allDates = Array.from(
    new Set(
      Object.values(data)
        .flat()
        .map((r) => r.recordedAt.slice(0, 10)),
    ),
  ).sort()

  if (allDates.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center border border-dashed border-border-color">
        <p className="font-mono text-[12px] text-ink/40">Cần ít nhất 2 điểm dữ liệu để vẽ biểu đồ</p>
      </div>
    )
  }

  // Build per-platform price series aligned to allDates
  const series = Object.entries(data).map(([platformId, rows]) => {
    const byDate: Record<string, number> = {}
    for (const r of rows) {
      byDate[r.recordedAt.slice(0, 10)] = r.price
    }
    // Forward-fill missing dates
    let lastPrice = 0
    const prices = allDates.map((d) => {
      if (byDate[d] !== undefined) lastPrice = byDate[d]
      return lastPrice
    })
    return { platformId, prices }
  })

  const allPrices = series.flatMap((s) => s.prices).filter(Boolean)
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const priceRange = maxPrice - minPrice || 1

  const W = 800
  const H = 180
  const PL = 16
  const PR = 16
  const PT = 16
  const PB = 32
  const chartW = W - PL - PR
  const chartH = H - PT - PB

  const xOf = (i: number) => PL + (i / (allDates.length - 1)) * chartW
  const yOf = (price: number) => PT + chartH - ((price - minPrice) / priceRange) * chartH

  const toPath = (prices: number[]) =>
    prices
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p).toFixed(1)}`)
      .join(" ")

  // Tick dates: show first, last, and a couple in between
  const tickIndices = [0, Math.floor(allDates.length / 3), Math.floor((2 * allDates.length) / 3), allDates.length - 1]
    .filter((v, i, a) => a.indexOf(v) === i && v < allDates.length)

  return (
    <div>
      <div className="overflow-x-auto border border-border-color bg-white">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Biểu đồ giá theo sàn 30 ngày"
          role="img"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = PT + chartH * (1 - t)
            const price = minPrice + priceRange * t
            return (
              <g key={t}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e8e8e5" strokeWidth="1" />
                <text x={PL + 2} y={y - 3} fontSize="9" fill="#a0a0aa" fontFamily="monospace">
                  {formatPrice(Math.round(price))}
                </text>
              </g>
            )
          })}

          {/* Lines per platform */}
          {series.map(({ platformId, prices }) => (
            <path
              key={platformId}
              d={toPath(prices)}
              fill="none"
              stroke={PLATFORM_COLORS[platformId] ?? "#888"}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {/* End-point dots */}
          {series.map(({ platformId, prices }) => {
            const last = prices[prices.length - 1]
            if (!last) return null
            return (
              <circle
                key={`dot-${platformId}`}
                cx={xOf(prices.length - 1)}
                cy={yOf(last)}
                r="4"
                fill={PLATFORM_COLORS[platformId] ?? "#888"}
              />
            )
          })}

          {/* X axis date ticks */}
          {tickIndices.map((i) => (
            <text
              key={i}
              x={xOf(i)}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === allDates.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="#a0a0aa"
              fontFamily="monospace"
            >
              {allDates[i].slice(5)}
            </text>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3">
        {series.map(({ platformId, prices }) => {
          const pName = platforms.find((p) => p.platformId === platformId)?.platformName ?? platformId
          const lastP = prices[prices.length - 1]
          return (
            <div key={platformId} className="flex items-center gap-1.5 font-mono text-[11px] text-ink/70">
              <div
                className="w-6 h-1.5 rounded"
                style={{ background: PLATFORM_COLORS[platformId] ?? "#888" }}
                aria-hidden="true"
              />
              {pName}: <span className="font-bold">{lastP ? formatPrice(lastP) : "—"}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
