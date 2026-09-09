"use client"

import { useEffect, useState, useRef } from "react"
import { TrendingDown, TrendingUp, Minus, ShieldCheck } from "lucide-react"
import { formatPrice } from "@/lib/utils"

interface PricePoint {
  price: number
  recordedAt: string
}

interface PriceMeta {
  minPrice: number
  maxPrice: number
  currentPrice: number
  isLowest: boolean
  days: number
}

interface PriceHistoryChartProps {
  productId: string
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function SvgLineChart({ data, meta }: { data: PricePoint[]; meta: PriceMeta }) {
  const W = 600
  const H = 100
  const PAD = { top: 10, right: 12, bottom: 24, left: 8 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const prices = data.map((d) => d.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const range = hi - lo || 1

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * chartW
  const toY = (p: number) => PAD.top + chartH - ((p - lo) / range) * chartH

  const points = data.map((d, i) => `${toX(i)},${toY(d.price)}`).join(" ")
  const areaPoints = [
    `${toX(0)},${PAD.top + chartH}`,
    ...data.map((d, i) => `${toX(i)},${toY(d.price)}`),
    `${toX(data.length - 1)},${PAD.top + chartH}`,
  ].join(" ")

  const minIdx = prices.indexOf(lo)
  const lastIdx = data.length - 1
  const isCurrentLowest = meta.isLowest

  // Chọn tối đa 4 nhãn ngày phân bổ đều
  const labelIdxs = data.length <= 4
    ? data.map((_, i) => i)
    : [0, Math.floor(lastIdx / 3), Math.floor((lastIdx * 2) / 3), lastIdx]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 100 }}
      aria-label="Biểu đồ lịch sử giá 30 ngày"
      role="img"
    >
      <defs>
        <linearGradient id={`grad-${meta.minPrice}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCurrentLowest ? "#16a34a" : "#2563eb"} stopOpacity="0.18" />
          <stop offset="100%" stopColor={isCurrentLowest ? "#16a34a" : "#2563eb"} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Vùng tô dưới đường */}
      <polygon
        points={areaPoints}
        fill={`url(#grad-${meta.minPrice})`}
      />

      {/* Đường giá */}
      <polyline
        points={points}
        fill="none"
        stroke={isCurrentLowest ? "#16a34a" : "#2563eb"}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Điểm min — highlight */}
      <circle
        cx={toX(minIdx)}
        cy={toY(lo)}
        r="4"
        fill="#16a34a"
        stroke="white"
        strokeWidth="1.5"
      />

      {/* Điểm cuối (giá hiện tại) */}
      <circle
        cx={toX(lastIdx)}
        cy={toY(data[lastIdx].price)}
        r="4"
        fill={isCurrentLowest ? "#16a34a" : "#2563eb"}
        stroke="white"
        strokeWidth="1.5"
      />

      {/* Nhãn ngày trên trục X */}
      {labelIdxs.map((i) => (
        <text
          key={i}
          x={toX(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill="#6b6b72"
          fontFamily="monospace"
        >
          {formatShortDate(data[i].recordedAt)}
        </text>
      ))}
    </svg>
  )
}

export default function PriceHistoryChart({ productId }: PriceHistoryChartProps) {
  const [data, setData] = useState<PricePoint[]>([])
  const [meta, setMeta] = useState<PriceMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    fetch(`/api/products/${productId}/price-history`)
      .then((r) => r.json())
      .then(({ data: points, meta: m }) => {
        setData(points ?? [])
        setMeta(m ?? null)
      })
      .finally(() => setLoading(false))
  }, [productId])

  if (loading) {
    return (
      <div className="mt-3 pt-3 border-t border-dashed border-border-color">
        <div className="h-24 skeleton-shimmer rounded" />
      </div>
    )
  }

  if (!data.length || !meta) {
    return (
      <div className="mt-3 pt-3 border-t border-dashed border-border-color">
        <p className="font-mono text-[10px] text-ink/40 text-center py-3">
          Chưa có dữ liệu lịch sử giá
        </p>
      </div>
    )
  }

  const isLowest = meta.isLowest
  const TrendIcon = isLowest ? TrendingDown : meta.currentPrice === meta.maxPrice ? TrendingUp : Minus
  const trendColor = isLowest ? "text-green-600" : meta.currentPrice === meta.maxPrice ? "text-red-500" : "text-ink/50"

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-border-color">
      {/* Badge trạng thái */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1">
          <ShieldCheck className={`size-3 ${isLowest ? "text-green-600" : "text-ink/30"}`} />
          <span className={`font-mono text-[9px] font-bold uppercase ${isLowest ? "text-green-600" : "text-ink/40"}`}>
            {isLowest ? "Giá thấp nhất 30 ngày ✓" : "Lịch sử giá 30 ngày"}
          </span>
        </div>
        <div className={`flex items-center gap-0.5 ${trendColor}`}>
          <TrendIcon className="size-3" />
        </div>
      </div>

      {/* Chart SVG */}
      <SvgLineChart data={data} meta={meta} />

      {/* Chú thích giá min / max */}
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[9px] text-green-600">
          Thấp: {formatPrice(meta.minPrice)}
        </span>
        <span className="font-mono text-[9px] text-ink/40">
          Cao: {formatPrice(meta.maxPrice)}
        </span>
      </div>

      {/* Cảnh báo nếu không phải giá thấp nhất */}
      {!isLowest && (
        <p className="font-mono text-[9px] text-amber-600 mt-1.5 border border-amber-200 bg-amber-50 px-2 py-1">
          ⚠ Giá hiện tại cao hơn mức thấp nhất {Math.round(((meta.currentPrice - meta.minPrice) / meta.minPrice) * 100)}% — có thể chờ deal tốt hơn
        </p>
      )}
    </div>
  )
}
