"use client"

import { useState, useEffect, useCallback, use } from "react"
import { MousePointerClick, Globe, MessageCircle, Share2, ExternalLink, ChevronLeft, Layers } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
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
const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  zalo: "Zalo OA",
  facebook: "Facebook",
  direct: "Direct",
  unknown: "Khác",
}
const SOURCE_ICONS: Record<string, React.ReactNode> = {
  website: <Globe className="size-4" />,
  zalo: <MessageCircle className="size-4" />,
  facebook: <Share2 className="size-4" />,
  direct: <ExternalLink className="size-4" />,
  unknown: <MousePointerClick className="size-4" />,
}

export default function NicheDetailPage({ params }: { params: Promise<{ niche: string }> }) {
  const { niche: nicheParam } = use(params)
  const searchParams = useSearchParams()
  const initialPeriod = searchParams.get("period") ?? "7d"
  const [period, setPeriod] = useState(initialPeriod)
  const [niche, setNiche] = useState<NicheStat | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch(
        `/api/admin/niche-analytics?period=${period}&niche=${nicheParam}`,
        { headers: { "x-csrf-token": csrf } }
      )
      if (!res.ok) throw new Error("Failed")
      const data = await res.json() as { niches: NicheStat[] }
      const found = data.niches.find((n) => n.id === nicheParam)
      if (!found) { setNotFound(true); return }
      setNiche(found)
    } catch {
      setNiche(null)
    } finally {
      setLoading(false)
    }
  }, [period, nicheParam])

  useEffect(() => { fetchData() }, [fetchData])

  const maxClicks = niche?.topProducts[0]?.clicks ?? 1
  const topSource = niche
    ? Object.entries(niche.bySource).sort((a, b) => b[1] - a[1])[0]
    : null

  const pageTitle = niche ? `${niche.emoji} ${niche.name}` : nicheParam

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 overflow-y-auto">
      <AdminPageShell
        title={pageTitle}
        subtitle={
          <Link
            href="/admin/niches"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#5c403a] hover:text-[#b51c00] transition-colors"
          >
            <ChevronLeft className="size-3" />
            Phân tích ngành hàng
          </Link>
        }
        actions={
          <SegmentedControl
            value={period}
            options={PERIODS.map((p) => ({ label: p.label, value: p.value }))}
            onChange={setPeriod}
          />
        }
      />

      {loading ? (
        <div className="py-24"><PageSpinner /></div>
      ) : notFound ? (
        <div className="bg-white border border-[#e5e1d8]">
          <EmptyState icon={Layers} title={`Không tìm thấy ngành "${nicheParam}"`} />
        </div>
      ) : !niche ? (
        <div className="bg-white border border-[#e5e1d8]">
          <EmptyState icon={Layers} title="Không thể tải dữ liệu" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              label="Tổng click"
              value={niche.totalClicks.toLocaleString("vi-VN")}
              icon={MousePointerClick}
            />
            <StatCard
              label="Sản phẩm có click"
              value={niche.topProducts.length}
              icon={Layers}
            />
            <StatCard
              label="Kênh dẫn đầu"
              value={topSource && topSource[1] > 0 ? SOURCE_LABELS[topSource[0]] ?? topSource[0] : "—"}
              icon={Globe}
            />
          </div>

          {/* Source breakdown */}
          <div className="bg-white border border-[#e5e1d8] p-5">
            <h3 className="font-sans text-[14px] font-bold text-[#1a1c1b] mb-4 border-b border-dashed border-[#e5beb6] pb-3">
              Phân bổ theo kênh
            </h3>
            <div className="space-y-3">
              {Object.entries(niche.bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([src, count]) => {
                  const pct = niche.totalClicks > 0 ? (count / niche.totalClicks) * 100 : 0
                  return (
                    <div key={src}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-2 font-mono text-[12px] text-[#5c403a]">
                          <span style={{ color: SOURCE_COLORS[src] }}>{SOURCE_ICONS[src]}</span>
                          {SOURCE_LABELS[src] ?? src}
                        </span>
                        <span className="font-mono text-[12px] font-bold text-[#1a1c1b]">
                          {count.toLocaleString("vi-VN")}{" "}
                          <span className="font-normal text-[#906f69]">({pct.toFixed(1)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-[#f4f4f1] w-full">
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: SOURCE_COLORS[src] ?? "#ccc" }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Top products */}
          <div className="bg-white border border-[#e5e1d8]">
            <div className="px-5 py-4 border-b border-dashed border-[#e5beb6]">
              <h3 className="font-sans text-[14px] font-bold text-[#1a1c1b]">
                Top sản phẩm ({niche.topProducts.length})
              </h3>
            </div>
            {niche.topProducts.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <MousePointerClick className="size-8 text-[#5c403a]/30" />
                <p className="font-mono text-[12px] text-[#5c403a]">Chưa có click nào.</p>
              </div>
            ) : (
              <div className="divide-y divide-dashed divide-[#e5e1d8]">
                {niche.topProducts.map((p, i) => {
                  const pct = maxClicks > 0 ? (p.clicks / maxClicks) * 100 : 0
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#fafaf7] transition-colors">
                      <span className="font-mono text-[12px] text-[#906f69] w-5 shrink-0">{i + 1}</span>
                      <div className="relative size-9 shrink-0 bg-[#e2e3e0] overflow-hidden">
                        {p.imageUrl && (
                          <Image src={p.imageUrl} alt="" width={36} height={36} className="object-cover" unoptimized />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-[13px] font-semibold text-[#1a1c1b] truncate">{p.name}</p>
                        <div className="mt-1 h-1.5 bg-[#f4f4f1] w-full">
                          <div
                            className="h-full bg-[#b51c00] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-[13px] font-bold text-[#b51c00] shrink-0">
                        {p.clicks.toLocaleString("vi-VN")}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
