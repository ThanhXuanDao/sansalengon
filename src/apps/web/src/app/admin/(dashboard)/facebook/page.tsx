"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Share2,
  MousePointerClick,
  TrendingUp,
  Layers,
  Copy,
  Check,
  ChevronDown,
} from "lucide-react"
import Image from "next/image"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { PageSpinner, EmptyState } from "@/components/admin/ui"

// ── Types ───────────────────────────────────────────────────────────────────

interface NicheStat { id: string; name: string; emoji: string; clicks: number }
interface TopProduct { id: string; name: string; imageUrl: string | null; clicks: number }
interface TimeSeries { date: string; clicks: number }
interface AnalyticsData {
  totalClicks: number
  byNiche: NicheStat[]
  topProducts: TopProduct[]
  timeSeries: TimeSeries[]
  period: string
}

interface ContentProduct {
  id: string
  name: string
  price: number
  discountPct: number | null
  imageUrl: string | null
  rating: number | null
  postText: string
  dealImageUrl?: string
}
interface ContentNiche { nicheId: string; nicheName: string; nicheEmoji: string; products: ContentProduct[] }
interface ContentData { niches: ContentNiche[] }

const PERIODS = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
}

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[12px] border transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
        copied
          ? "bg-[#1a1c1b] text-[#fdc73a] border-[#1a1c1b]"
          : "bg-white text-[#5c403a] border-[#e5e1d8] hover:bg-[#f4f4f1]"
      }`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "Đã sao chép!" : "Copy"}
    </button>
  )
}

function TimeSeriesChart({ data }: { data: TimeSeries[] }) {
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const total = data.reduce((s, d) => s + d.clicks, 0)
  if (total === 0) {
    return (
      <div className="h-32 bg-[#fafaf7] border border-dashed border-[#e5beb6] flex items-center justify-center">
        <p className="font-mono text-[12px] text-[#906f69]">Chưa có click từ Facebook</p>
      </div>
    )
  }
  return (
    <div>
      <div className="relative h-32 flex items-end gap-px">
        {data.map((d) => (
          <div
            key={d.date}
            className="flex-1 group relative"
            title={`${shortDate(d.date)}: ${d.clicks} click`}
          >
            <div
              className="w-full bg-[#1877f2] transition-all hover:bg-[#b51c00]"
              style={{ height: `${(d.clicks / max) * 100}%`, minHeight: d.clicks > 0 ? 2 : 0 }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
              <div className="bg-[#1a1c1b] text-[#fafaf7] font-mono text-[10px] px-1.5 py-0.5 whitespace-nowrap">
                {shortDate(d.date)}: {d.clicks}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 font-mono text-[10px] text-[#906f69]">
        <span>{shortDate(data[0]?.date ?? "")}</span>
        <span>{shortDate(data[data.length - 1]?.date ?? "")}</span>
      </div>
    </div>
  )
}

// ── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ period }: { period: string }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch(`/api/admin/facebook-analytics?period=${period}`, {
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

  if (loading) {
    return <div className="py-24"><PageSpinner /></div>
  }

  const d = data
  const maxNicheClicks = Math.max(1, ...(d?.byNiche.map((n) => n.clicks) ?? [1]))

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Click từ Facebook",
            value: (d?.totalClicks ?? 0).toLocaleString("vi-VN"),
            icon: <Share2 className="size-5" />,
          },
          {
            label: "Sản phẩm có click",
            value: (d?.topProducts.length ?? 0).toLocaleString("vi-VN"),
            icon: <MousePointerClick className="size-5" />,
          },
          {
            label: "Ngách dẫn đầu",
            value: d?.byNiche[0]?.clicks ? `${d.byNiche[0].emoji} ${d.byNiche[0].name}` : "—",
            icon: <TrendingUp className="size-5" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-[#e5e1d8] p-4"
            style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
          >
            <div className="flex items-center gap-2 text-[#5c403a] mb-2">
              {s.icon}
              <span className="font-mono text-[11px] uppercase tracking-[0.05em]">{s.label}</span>
            </div>
            <p className="font-sans text-[28px] leading-[32px] font-extrabold text-[#1a1c1b] tracking-tight">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Time series */}
      <div className="bg-white border border-[#e5e1d8] p-5">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a] mb-4">
          Click theo ngày
        </h3>
        <TimeSeriesChart data={d?.timeSeries ?? []} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niche breakdown */}
        <div className="bg-white border border-[#e5e1d8] p-5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a] mb-4">
            Click theo ngách
          </h3>
          {!d || d.totalClicks === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Layers className="size-8 text-[#5c403a]/30" />
              <p className="font-mono text-[12px] text-[#906f69]">Chưa có dữ liệu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {d.byNiche.map((n) => (
                <div key={n.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] text-[#5c403a]">
                      {n.emoji} {n.name}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[#1a1c1b]">{n.clicks}</span>
                  </div>
                  <div className="h-2 bg-[#f4f4f1]">
                    <div
                      className="h-full bg-[#1877f2] transition-all duration-500"
                      style={{ width: `${(n.clicks / maxNicheClicks) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="bg-white border border-[#e5e1d8]">
          <div className="px-5 py-4 border-b border-dashed border-[#e5e1d8]">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a]">
              Top sản phẩm từ Facebook
            </h3>
          </div>
          {!d || d.topProducts.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <MousePointerClick className="size-8 text-[#5c403a]/30" />
              <p className="font-mono text-[12px] text-[#906f69]">Chưa có click nào từ Facebook</p>
            </div>
          ) : (
            <div className="divide-y divide-dashed divide-[#e5e1d8]">
              {d.topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafaf7] transition-colors">
                  <span className="font-mono text-[12px] text-[#906f69] w-5 shrink-0">{i + 1}</span>
                  <div className="relative size-9 shrink-0 bg-[#e2e3e0] overflow-hidden">
                    {p.imageUrl && (
                      <Image src={p.imageUrl} alt="" width={36} height={36} className="object-cover" unoptimized />
                    )}
                  </div>
                  <p className="font-sans text-[13px] text-[#1a1c1b] flex-1 min-w-0 truncate">{p.name}</p>
                  <span className="font-mono text-[13px] font-bold text-[#1877f2] shrink-0">
                    {p.clicks.toLocaleString("vi-VN")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Content Generator Tab ────────────────────────────────────────────────────

function ContentGeneratorTab() {
  const [data, setData] = useState<ContentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNiche, setSelectedNiche] = useState<string>("all")
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const url = selectedNiche === "all"
        ? "/api/admin/facebook-content"
        : `/api/admin/facebook-content?niche=${selectedNiche}`
      const res = await fetch(url, { headers: { "x-csrf-token": csrf } })
      if (!res.ok) throw new Error("Failed")
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedNiche])

  useEffect(() => { fetchData() }, [fetchData])

  const niches = data?.niches ?? []

  return (
    <div className="space-y-6">
      <div className="bg-[#fdc73a]/20 border border-[#fdc73a] p-4">
        <p className="font-mono text-[13px] text-[#6f5400]">
          💡 Nội dung được tạo tự động dựa trên top sản phẩm có điểm cao nhất (giảm giá + click). Link có{" "}
          <code className="bg-[#fdc73a]/30 px-1">?src=facebook</code> để theo dõi click từ Facebook.
        </p>
      </div>

      {/* Niche filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedNiche("all")}
          className={`px-3 py-1.5 font-mono text-[12px] border transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
            selectedNiche === "all" ? "bg-[#1a1c1b] text-[#fafaf7] border-[#1a1c1b]" : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"
          }`}
        >
          Tất cả ngách
        </button>
        {[
          { id: "fashion", emoji: "👗", name: "Thời trang" },
          { id: "electronics", emoji: "📱", name: "Điện tử" },
          { id: "home", emoji: "🏠", name: "Nhà cửa" },
          { id: "beauty", emoji: "💄", name: "Làm đẹp" },
          { id: "food", emoji: "🛒", name: "Thực phẩm" },
          { id: "baby", emoji: "👶", name: "Mẹ & Bé" },
        ].map((n) => (
          <button
            key={n.id}
            onClick={() => setSelectedNiche(n.id)}
            className={`px-3 py-1.5 font-mono text-[12px] border transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
              selectedNiche === n.id ? "bg-[#1a1c1b] text-[#fafaf7] border-[#1a1c1b]" : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"
            }`}
          >
            {n.emoji} {n.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24"><PageSpinner /></div>
      ) : niches.length === 0 || niches.every((n) => n.products.length === 0) ? (
        <div className="bg-white border border-[#e5e1d8]">
          <EmptyState
            icon={Share2}
            title="Chưa có sản phẩm đủ điều kiện tạo nội dung"
            description="Cần có sản phẩm giảm ≥10% trong hệ thống"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {niches.map((niche) => (
            <div key={niche.nicheId} className="bg-white border border-[#e5e1d8]">
              <div className="px-5 py-4 border-b border-dashed border-[#e5e1d8] flex items-center gap-3">
                <span className="text-[20px]">{niche.nicheEmoji}</span>
                <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b]">{niche.nicheName}</h3>
                <span className="font-mono text-[11px] text-[#906f69] ml-auto">{niche.products.length} sản phẩm</span>
              </div>
              {niche.products.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-mono text-[12px] text-[#906f69]">Không có sản phẩm trong ngách này.</p>
                </div>
              ) : (
                <div className="divide-y divide-dashed divide-[#e5e1d8]">
                  {niche.products.map((p) => {
                    const isOpen = expandedProduct === p.id
                    const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
                    return (
                      <div key={p.id}>
                        {/* Product row */}
                        <button
                          onClick={() => setExpandedProduct(isOpen ? null : p.id)}
                          className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[#fafaf7] transition-colors text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b51c00] focus-visible:outline-none"
                        >
                          <div className="relative size-10 shrink-0 bg-[#e2e3e0] overflow-hidden">
                            {p.imageUrl && (
                              <Image src={p.imageUrl} alt="" width={40} height={40} className="object-cover" unoptimized />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-sans text-[14px] font-bold text-[#1a1c1b] truncate">{p.name}</p>
                            <p className="font-mono text-[12px] text-[#5c403a]">
                              {fmtVND(salePrice)}
                              {p.discountPct ? (
                                <span className="ml-2 text-[#b51c00] font-bold">−{p.discountPct}%</span>
                              ) : null}
                            </p>
                          </div>
                          <ChevronDown
                            className={`size-4 text-[#5c403a] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {/* Expanded post text + deal image */}
                        {isOpen && (
                          <div className="px-5 pb-4 bg-[#fafaf7] border-t border-dashed border-[#e5e1d8]">
                            <div className="flex items-center justify-between mt-3 mb-2">
                              <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a]">
                                Nội dung Facebook
                              </p>
                              <CopyButton text={p.postText} />
                            </div>
                            <pre className="font-sans text-[13px] text-[#1a1c1b] whitespace-pre-wrap bg-white border border-[#e5e1d8] p-3 leading-[20px]">
                              {p.postText}
                            </pre>
                            {p.dealImageUrl && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a]">
                                    Ảnh deal AI (Pollinations · miễn phí)
                                  </p>
                                  <a
                                    href={p.dealImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-[10px] text-[#006af5] hover:underline"
                                  >
                                    Mở ảnh gốc ↗
                                  </a>
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.dealImageUrl}
                                  alt={`Deal image for ${p.name}`}
                                  className="w-full max-w-sm border border-[#e5e1d8] object-cover"
                                  loading="lazy"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = "analytics" | "content"

export default function FacebookPage() {
  const [tab, setTab] = useState<Tab>("analytics")
  const [period, setPeriod] = useState("7d")

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Facebook"
        subtitle="Phân tích click từ Facebook và công cụ tạo nội dung đăng bài."
        actions={tab === "analytics" ? (
          <div className="flex gap-1 border border-[#e5e1d8] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 font-mono text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                  period === p.value ? "bg-[#1a1c1b] text-[#fafaf7]" : "text-[#5c403a] hover:bg-[#f4f4f1]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : undefined}
      />

      {/* Tabs */}
      <div className="flex border-b border-[#e5e1d8] mb-6">
        {([
          { id: "analytics" as Tab, label: "📊 Analytics" },
          { id: "content" as Tab, label: "✍️ Tạo nội dung" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 font-mono text-[13px] border-b-2 transition-colors focus-visible:outline-none -mb-px ${
              tab === t.id
                ? "border-[#b51c00] text-[#b51c00] font-bold"
                : "border-transparent text-[#5c403a] hover:text-[#1a1c1b]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "analytics" ? (
        <AnalyticsTab period={period} />
      ) : (
        <ContentGeneratorTab />
      )}
    </div>
  )
}
