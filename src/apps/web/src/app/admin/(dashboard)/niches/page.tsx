"use client"

import { useState, useEffect, useCallback } from "react"
import { Layers, TrendingUp, MousePointerClick, Globe, MessageCircle, Share2, ExternalLink } from "lucide-react"
import Link from "next/link"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { SegmentedControl, PageSpinner, EmptyState, StatCard } from "@/components/admin/ui"

type SourceMap = { website: number; zalo: number; facebook: number; direct: number; unknown: number }
interface NicheStat {
  id: string
  name: string
  emoji: string
  totalClicks: number
  bySource: SourceMap
  topProducts: { id: string; name: string; imageUrl: string | null; clicks: number }[]
}
interface AnalyticsResponse {
  niches: NicheStat[]
  period: string
  total: number
}

const PERIODS = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
]

const SOURCE_COLORS: Record<string, string> = {
  website: "#1a1c1b",
  zalo: "#006af5",
  facebook: "#1877f2",
  direct: "#b51c00",
  unknown: "#e5e1d8",
}
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  website: <Globe className="size-3" />,
  zalo: <MessageCircle className="size-3" />,
  facebook: <Share2 className="size-3" />,
  direct: <ExternalLink className="size-3" />,
  unknown: <MousePointerClick className="size-3" />,
}

function SourceBar({ bySource, total }: { bySource: SourceMap; total: number }) {
  if (total === 0) return <div className="h-2 bg-[#e5e1d8] w-full" />
  return (
    <div className="flex h-2 w-full overflow-hidden gap-px" title="Click sources">
      {Object.entries(bySource)
        .filter(([, v]) => v > 0)
        .map(([src, v]) => (
          <div
            key={src}
            style={{ width: `${(v / total) * 100}%`, background: SOURCE_COLORS[src] ?? "#ccc" }}
            title={`${src}: ${v}`}
          />
        ))}
    </div>
  )
}

export default function NichesAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("7d")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch(`/api/admin/niche-analytics?period=${period}`, {
        headers: { "x-csrf-token": csrf },
      })
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const sorted = data?.niches.slice().sort((a, b) => b.totalClicks - a.totalClicks) ?? []
  const topNiche = sorted[0]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Ngách sản phẩm"
        subtitle="Phân tích lượt click phân theo danh mục sản phẩm và kênh phân phối."
        actions={
          <SegmentedControl
            value={period}
            options={PERIODS.map((p) => ({ label: p.label, value: p.value }))}
            onChange={setPeriod}
          />
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Tổng click"
          value={loading ? "…" : (data?.total ?? 0).toLocaleString("vi-VN")}
          icon={MousePointerClick}
          loading={loading}
        />
        <StatCard
          label="Ngách dẫn đầu"
          value={loading ? "…" : topNiche ? `${topNiche.emoji} ${topNiche.name}` : "—"}
          icon={TrendingUp}
          loading={loading}
        />
        <StatCard
          label="Click website"
          value={loading ? "…" : (data?.niches.reduce((s, n) => s + n.bySource.website, 0) ?? 0).toLocaleString("vi-VN")}
          icon={Globe}
          loading={loading}
        />
        <StatCard
          label="Click Zalo"
          value={loading ? "…" : (data?.niches.reduce((s, n) => s + n.bySource.zalo, 0) ?? 0).toLocaleString("vi-VN")}
          icon={MessageCircle}
          loading={loading}
        />
      </div>

      {/* Niches table */}
      {loading ? (
        <div className="py-24">
          <PageSpinner />
        </div>
      ) : sorted.length === 0 || data?.total === 0 ? (
        <div className="bg-white border border-[#e5e1d8]">
          <EmptyState
            icon={Layers}
            title="Chưa có click nào"
            description="Chưa có click nào trong kỳ này."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((niche, i) => (
            <div key={niche.id} className="bg-white border border-[#e5e1d8] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#5c403a] w-4">{i + 1}</span>
                  <span className="text-[24px] leading-none">{niche.emoji}</span>
                  <div>
                    <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b]">{niche.name}</h3>
                    <p className="font-mono text-[11px] text-[#5c403a]">{niche.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-sans text-[24px] leading-[28px] font-extrabold text-[#1a1c1b]">
                      {niche.totalClicks.toLocaleString("vi-VN")}
                    </p>
                    <p className="font-mono text-[11px] text-[#5c403a]">lượt click</p>
                  </div>
                  <Link
                    href={`/admin/niches/${niche.id}?period=${period}`}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[#e5e1d8] font-mono text-[12px] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                  >
                    Chi tiết →
                  </Link>
                </div>
              </div>

              {/* Source breakdown bar */}
              <div className="mb-2">
                <SourceBar bySource={niche.bySource} total={niche.totalClicks} />
              </div>
              <div className="flex flex-wrap gap-3">
                {Object.entries(niche.bySource)
                  .filter(([, v]) => v > 0)
                  .map(([src, v]) => (
                    <span key={src} className="flex items-center gap-1 font-mono text-[11px] text-[#5c403a]">
                      <span style={{ color: SOURCE_COLORS[src] }}>{SOURCE_ICONS[src]}</span>
                      {src}: <strong>{v}</strong>
                    </span>
                  ))}
              </div>

              {/* Top 3 products preview */}
              {niche.topProducts.length > 0 && (
                <div className="mt-4 pt-3 border-t border-dashed border-[#e5e1d8]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-2">Top sản phẩm</p>
                  <div className="space-y-1">
                    {niche.topProducts.slice(0, 3).map((p, j) => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-[#906f69] shrink-0">{j + 1}.</span>
                          <span className="font-sans text-[13px] text-[#1a1c1b] truncate">{p.name}</span>
                        </div>
                        <span className="font-mono text-[12px] font-bold text-[#b51c00] shrink-0">{p.clicks}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
