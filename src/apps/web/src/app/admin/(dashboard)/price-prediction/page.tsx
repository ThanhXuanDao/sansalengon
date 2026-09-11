"use client"

import { useState, useEffect, useCallback } from "react"
import { TrendingDown, RefreshCw, ChevronDown, ChevronUp, AlertCircle } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { PageSpinner } from "@/components/admin/ui"
import type { PricePrediction, DayPattern } from "@/lib/price-prediction"
import { DAY_SHORT } from "@/lib/price-prediction"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
}

const CONFIDENCE_STYLE = {
  high:   { badge: "bg-[#e8f5e9] text-[#2e7d32] border-[#2e7d32]/20", label: "Cao" },
  medium: { badge: "bg-[#fff8e1] text-[#f57f17] border-[#f57f17]/20", label: "Trung bình" },
  low:    { badge: "bg-[#f4f4f1] text-[#906f69] border-[#e5e1d8]",    label: "Thấp" },
}

const NICHE_LABELS: Record<string, string> = {
  fashion:     "👗 Thời trang",
  electronics: "📱 Điện tử",
  home:        "🏠 Nhà cửa",
  beauty:      "💄 Làm đẹp",
  food:        "🛒 Thực phẩm",
  baby:        "👶 Mẹ & Bé",
}

// ── Mini bar chart: price by day of week ──────────────────────────────────────

function WeeklyPatternChart({ pattern, cheapestDay }: { pattern: DayPattern[]; cheapestDay: number }) {
  const allDays = [0, 1, 2, 3, 4, 5, 6]
  const byDay = Object.fromEntries(pattern.map((d) => [d.dayOfWeek, d]))
  const maxPrice = Math.max(...pattern.map((d) => d.avgPrice), 1)
  const minPrice = Math.min(...pattern.map((d) => d.avgPrice))
  const range = maxPrice - minPrice || 1

  return (
    <div className="flex items-end gap-1 h-10">
      {allDays.map((day) => {
        const d = byDay[day]
        if (!d) return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full bg-[#f4f4f1] h-1 opacity-30" />
            <span className="font-mono text-[8px] text-[#ccc]">{DAY_SHORT[day]}</span>
          </div>
        )
        const heightPct = 20 + ((maxPrice - d.avgPrice) / range) * 80
        const isCheapest = d.dayOfWeek === cheapestDay
        return (
          <div key={day} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.dayName}: ${fmtVND(d.avgPrice)}`}>
            <div
              className={`w-full transition-all ${isCheapest ? "bg-[#2e7d32]" : "bg-[#e5e1d8]"}`}
              style={{ height: `${heightPct}%` }}
            />
            <span className={`font-mono text-[8px] ${isCheapest ? "text-[#2e7d32] font-bold" : "text-[#906f69]"}`}>
              {DAY_SHORT[day]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Product prediction row ────────────────────────────────────────────────────

function PredictionRow({ p }: { p: PricePrediction }) {
  const [open, setOpen] = useState(false)
  const conf = CONFIDENCE_STYLE[p.confidence]

  return (
    <div className="border-b border-dashed border-[#e5e1d8] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[#fafaf7] transition-colors text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b51c00] focus-visible:outline-none"
      >
        {/* Name + niche */}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[14px] font-bold text-[#1a1c1b] truncate">{p.productName}</p>
          <p className="font-mono text-[11px] text-[#906f69]">{NICHE_LABELS[p.niche] ?? p.niche}</p>
        </div>

        {/* Cheapest day */}
        <div className="hidden sm:flex flex-col items-center shrink-0 w-20">
          <span className="font-mono text-[10px] text-[#906f69] mb-0.5">Rẻ nhất</span>
          <span className="font-sans text-[14px] font-bold text-[#1a1c1b]">{p.cheapestDayName}</span>
        </div>

        {/* Saving */}
        <div className="flex flex-col items-end shrink-0 w-16">
          <span className="font-mono text-[10px] text-[#906f69] mb-0.5">Tiết kiệm</span>
          <span className="font-sans text-[16px] font-extrabold text-[#2e7d32]">−{p.savingPct}%</span>
        </div>

        {/* Confidence */}
        <div className="hidden md:block shrink-0">
          <span className={`font-mono text-[10px] px-2 py-1 border ${conf.badge}`}>
            {conf.label}
          </span>
        </div>

        {/* Data points */}
        <div className="hidden lg:flex flex-col items-end shrink-0 w-20">
          <span className="font-mono text-[10px] text-[#906f69]">{p.dataPoints} điểm</span>
          <span className="font-mono text-[10px] text-[#906f69]">{p.weeksOfData} tuần</span>
        </div>

        <ChevronDown className={`size-4 text-[#5c403a] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 bg-[#fafaf7] border-t border-dashed border-[#e5e1d8]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <div className="bg-white border border-[#e5e1d8] p-3">
              <p className="font-mono text-[10px] text-[#906f69] mb-1">Giá hiện tại</p>
              <p className="font-sans text-[16px] font-bold text-[#1a1c1b]">{fmtVND(p.currentPrice)}</p>
            </div>
            <div className="bg-white border border-[#e5e1d8] p-3">
              <p className="font-mono text-[10px] text-[#906f69] mb-1">Giá TB tổng</p>
              <p className="font-sans text-[16px] font-bold text-[#1a1c1b]">{fmtVND(p.overallAvg)}</p>
            </div>
            <div className="bg-white border border-[#2e7d32]/30 p-3">
              <p className="font-mono text-[10px] text-[#906f69] mb-1">Giá TB {p.cheapestDayName}</p>
              <p className="font-sans text-[16px] font-bold text-[#2e7d32]">{fmtVND(p.cheapestDayAvg)}</p>
            </div>
            <div className="bg-white border border-[#e5e1d8] p-3">
              <p className="font-mono text-[10px] text-[#906f69] mb-1">Độ tin cậy</p>
              <span className={`font-mono text-[12px] px-2 py-1 border ${conf.badge}`}>
                {conf.label} · {p.dataPoints} records
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="mt-4 bg-white border border-[#e5e1d8] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-3">
              Giá trung bình theo ngày trong tuần
            </p>
            <WeeklyPatternChart pattern={p.pattern} cheapestDay={p.cheapestDay} />
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 bg-[#2e7d32]" />
                <span className="font-mono text-[10px] text-[#5c403a]">Rẻ nhất ({p.cheapestDayName})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2.5 bg-[#e5e1d8]" />
                <span className="font-mono text-[10px] text-[#5c403a]">Ngày khác</span>
              </div>
            </div>
          </div>

          {/* Zalo message preview */}
          <div className="mt-4 bg-white border border-dashed border-[#e5beb6] p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-2">
              Mẫu tin Zalo
            </p>
            <p className="font-sans text-[13px] text-[#1a1c1b] leading-relaxed">
              💡 Tip mua sắm thông minh: <strong>{p.productName.slice(0, 60)}</strong> thường rẻ hơn {p.savingPct}% vào <strong>{p.cheapestDayName}</strong>. Giá tốt nhất trung bình: {fmtVND(p.cheapestDayAvg)} (bình thường {fmtVND(p.overallAvg)}).
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PricePredictionPage() {
  const [data, setData] = useState<{ predictions: PricePrediction[]; total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [minSaving, setMinSaving] = useState(5)
  const [filterConf, setFilterConf] = useState<"all" | "high" | "medium" | "low">("all")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/price-prediction", { headers: { "x-csrf-token": csrf } })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const predictions = (data?.predictions ?? [])
    .filter((p) => p.savingPct >= minSaving)
    .filter((p) => filterConf === "all" || p.confidence === filterConf)

  const highCount   = data?.predictions.filter((p) => p.confidence === "high").length   ?? 0
  const mediumCount = data?.predictions.filter((p) => p.confidence === "medium").length ?? 0

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Dự đoán giá"
        subtitle="Phân tích lịch sử giá — phát hiện ngày trong tuần sản phẩm thường rẻ hơn."
        actions={
          <button onClick={fetchData} disabled={loading} className="p-2 hover:bg-[#f4f4f1] rounded transition-colors disabled:opacity-50">
            <RefreshCw className={`size-4 text-[#5c403a] ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      {loading ? (
        <div className="py-16">
          <PageSpinner />
          <p className="font-mono text-[12px] text-[#906f69] text-center mt-3">Đang phân tích lịch sử giá...</p>
        </div>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#e5e1d8] px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">Tổng phát hiện</p>
              <p className="font-sans text-[32px] font-extrabold text-[#1a1c1b]">{data?.total ?? 0}</p>
              <p className="font-mono text-[11px] text-[#906f69]">sản phẩm có pattern</p>
            </div>
            <div className="bg-white border border-[#2e7d32]/30 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">Tin cậy cao</p>
              <p className="font-sans text-[32px] font-extrabold text-[#2e7d32]">{highCount}</p>
              <p className="font-mono text-[11px] text-[#906f69]">≥8 samples, ≥10% saving</p>
            </div>
            <div className="bg-white border border-[#f57f17]/20 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">Trung bình</p>
              <p className="font-sans text-[32px] font-extrabold text-[#f57f17]">{mediumCount}</p>
              <p className="font-mono text-[11px] text-[#906f69]">≥4 samples, ≥6% saving</p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-[#f4f4f1] border border-dashed border-[#e5e1d8] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-4 text-[#5c403a] mt-0.5 shrink-0" />
              <div className="font-mono text-[12px] text-[#5c403a] space-y-1">
                <p className="font-bold">Cách hoạt động</p>
                <p>Phân tích bảng <code className="bg-white px-1">PriceHistory</code> — group giá theo ngày trong tuần, tìm ngày có giá trung bình thấp hơn ≥{minSaving}% so với tổng bình quân. Cần tối thiểu 14 điểm dữ liệu và 3 mẫu trên ngày rẻ nhất.</p>
                <p>Kết quả dùng để: gợi ý thời điểm mua cho người dùng · nội dung Zalo "Tip mua sắm thứ 6" · ưu tiên broadcast.</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-[#5c403a]">Tiết kiệm tối thiểu:</span>
              {[4, 5, 8, 10, 15].map((v) => (
                <button
                  key={v}
                  onClick={() => setMinSaving(v)}
                  className={`px-3 py-1 font-mono text-[12px] border transition-colors ${
                    minSaving === v
                      ? "bg-[#1a1c1b] text-[#fafaf7] border-[#1a1c1b]"
                      : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"
                  }`}
                >
                  {v}%+
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] text-[#5c403a]">Độ tin cậy:</span>
              {(["all", "high", "medium", "low"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterConf(v)}
                  className={`px-3 py-1 font-mono text-[12px] border transition-colors ${
                    filterConf === v
                      ? "bg-[#1a1c1b] text-[#fafaf7] border-[#1a1c1b]"
                      : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"
                  }`}
                >
                  {v === "all" ? "Tất cả" : v === "high" ? "Cao" : v === "medium" ? "Trung bình" : "Thấp"}
                </button>
              ))}
            </div>
          </div>

          {/* Results table */}
          {predictions.length === 0 ? (
            <div className="bg-white border border-[#e5e1d8] flex flex-col items-center py-16 gap-3">
              <TrendingDown className="size-10 text-[#5c403a]/30" />
              <p className="font-mono text-[13px] text-[#5c403a]">
                {data?.total === 0
                  ? "Chưa đủ dữ liệu lịch sử giá để phân tích."
                  : "Không có sản phẩm nào khớp với bộ lọc hiện tại."
                }
              </p>
              {data?.total === 0 && (
                <p className="font-mono text-[11px] text-[#906f69] text-center max-w-sm">
                  Cần ít nhất 14 điểm dữ liệu PriceHistory. Chạy sync vài tuần để có kết quả.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#e5e1d8]">
              {/* Table header */}
              <div className="px-5 py-3 border-b border-[#e5e1d8] bg-[#fafaf7] hidden sm:grid grid-cols-[1fr_120px_80px_100px_90px_20px] gap-4 items-center">
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69]">Sản phẩm</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69]">Ngày rẻ nhất</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] text-right">Tiết kiệm</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69]">Độ tin cậy</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#906f69] text-right">Dữ liệu</span>
                <span />
              </div>
              {predictions.map((p) => (
                <PredictionRow key={p.productId} p={p} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
