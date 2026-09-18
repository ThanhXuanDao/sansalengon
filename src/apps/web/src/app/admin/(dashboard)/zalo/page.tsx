"use client"

import { useState, useEffect, useCallback } from "react"
import {
  MessageCircle,
  MousePointerClick,
  TrendingUp,
  Layers,
  Loader2,
  Radio,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, EmptyState, StatCard, useToast, Spinner } from "@/components/admin/ui"

// ── Types ────────────────────────────────────────────────────────────────────

interface NicheStat { id: string; name: string; emoji: string; clicks: number }
interface TopProduct { id: string; name: string; imageUrl: string | null; clicks: number }
interface TimeSeries { date: string; clicks: number }
interface BroadcastSummary {
  id: string
  nicheId: string | null
  nicheName: string
  nicheEmoji: string
  status: string
  sentAt: string
  productCount: number
  clicksAfter24h: number
  error: string | null
  messagePreview: string
}
interface ZaloData {
  totalClicks: number
  byNiche: NicheStat[]
  topProducts: TopProduct[]
  timeSeries: TimeSeries[]
  broadcasts: BroadcastSummary[]
  period: string
}

const PERIODS = [
  { value: "7d", label: "7 ngày" },
  { value: "30d", label: "30 ngày" },
  { value: "all", label: "Tất cả" },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string) {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

// ── Chart ────────────────────────────────────────────────────────────────────

function TimeSeriesChart({ data }: { data: TimeSeries[] }) {
  const max = Math.max(1, ...data.map((d) => d.clicks))
  const total = data.reduce((s, d) => s + d.clicks, 0)
  if (total === 0) {
    return (
      <div className="h-32 bg-[#fafaf7] border border-dashed border-[#e5beb6] flex items-center justify-center">
        <p className="font-mono text-[12px] text-[#906f69]">Chưa có click từ Zalo</p>
      </div>
    )
  }
  return (
    <div>
      <div className="relative h-32 flex items-end gap-px">
        {data.map((d) => (
          <div key={d.date} className="flex-1 group relative">
            <div
              className="w-full bg-[#006af5] transition-all hover:bg-[#b51c00]"
              style={{ height: `${(d.clicks / max) * 100}%`, minHeight: d.clicks > 0 ? 2 : 0 }}
            />
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

// ── Analytics Tab ─────────────────────────────────────────────────────────────

function AnalyticsTab({ data }: { data: ZaloData }) {
  const maxNicheClicks = Math.max(1, ...data.byNiche.map((n) => n.clicks))

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          {
            label: "Click từ Zalo",
            value: data.totalClicks.toLocaleString("vi-VN"),
            icon: <MessageCircle className="size-5" />,
          },
          {
            label: "Sản phẩm có click",
            value: data.topProducts.length.toLocaleString("vi-VN"),
            icon: <MousePointerClick className="size-5" />,
          },
          {
            label: "Ngách dẫn đầu",
            value: data.byNiche[0]?.clicks
              ? `${data.byNiche[0].emoji} ${data.byNiche[0].name}`
              : "—",
            icon: <TrendingUp className="size-5" />,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-[#e5e1d8] p-4 clip-bevel-sm"
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
        <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3">
          Click theo ngày
        </h3>
        <TimeSeriesChart data={data.timeSeries} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niche breakdown */}
        <div className="bg-white border border-[#e5e1d8] p-5">
          <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3">
            Click theo ngách
          </h3>
          {data.totalClicks === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Layers className="size-8 text-[#5c403a]/30" />
              <p className="font-mono text-[12px] text-[#906f69]">Chưa có dữ liệu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.byNiche.map((n) => (
                <div key={n.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[12px] text-[#5c403a]">
                      {n.emoji} {n.name}
                    </span>
                    <span className="font-mono text-[12px] font-bold text-[#1a1c1b]">{n.clicks}</span>
                  </div>
                  <div className="h-2 bg-[#f4f4f1]">
                    <div
                      className="h-full bg-[#006af5] transition-all duration-500"
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
          <div className="px-5 py-4 border-b border-dashed border-[#e5beb6]">
            <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
              Top sản phẩm từ Zalo
            </h3>
          </div>
          {data.topProducts.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <MousePointerClick className="size-8 text-[#5c403a]/30" />
              <p className="font-mono text-[12px] text-[#906f69]">Chưa có click nào từ Zalo</p>
            </div>
          ) : (
            <div className="divide-y divide-dashed divide-[#e5e1d8]">
              {data.topProducts.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafaf7] transition-colors">
                  <span className="font-mono text-[12px] text-[#906f69] w-5 shrink-0">{i + 1}</span>
                  <div className="relative size-9 shrink-0 bg-[#e2e3e0] overflow-hidden">
                    {p.imageUrl && (
                      <Image src={p.imageUrl} alt="" width={36} height={36} className="object-cover" unoptimized />
                    )}
                  </div>
                  <p className="font-sans text-[13px] text-[#1a1c1b] flex-1 min-w-0 truncate">{p.name}</p>
                  <span className="font-mono text-[13px] font-bold text-[#006af5] shrink-0">
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

// ── Broadcasts Tab ────────────────────────────────────────────────────────────

function BroadcastsTab({ broadcasts }: { broadcasts: BroadcastSummary[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (broadcasts.length === 0) {
    return (
      <div className="bg-white border border-[#e5e1d8] flex flex-col items-center py-16 gap-3">
        <Radio className="size-10 text-[#5c403a]/30" />
        <p className="font-mono text-[13px] text-[#5c403a]">Chưa có broadcast nào trong kỳ này.</p>
        <Link
          href="/admin/broadcast"
          className="px-4 py-2 bg-[#1a1c1b] text-[#fafaf7] font-mono text-[13px] hover:bg-[#5c403a] transition-colors"
        >
          Đến trang Broadcast →
        </Link>
      </div>
    )
  }

  const totalSent = broadcasts.filter((b) => b.status === "sent").length
  const totalFailed = broadcasts.filter((b) => b.status === "failed").length
  const totalClicksFromBroadcasts = broadcasts.reduce((s, b) => s + b.clicksAfter24h, 0)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Đã gửi thành công", value: totalSent, color: "text-[#2e7d32]" },
          { label: "Lỗi", value: totalFailed, color: "text-[#b51c00]" },
          { label: "Click sau 24h", value: totalClicksFromBroadcasts.toLocaleString("vi-VN"), color: "text-[#006af5]" },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-[#e5e1d8] p-4 clip-bevel-sm"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a] mb-2">{s.label}</p>
            <p className={`font-sans text-[28px] leading-[32px] font-extrabold tracking-tight ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Broadcasts list */}
      <div className="bg-white border border-[#e5e1d8]">
        <div className="px-5 py-4 border-b border-dashed border-[#e5beb6] flex items-center justify-between">
          <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
            Lịch sử broadcast ({broadcasts.length})
          </h3>
          <Link
            href="/admin/broadcast"
            className="font-mono text-[11px] text-[#5c403a] hover:text-[#b51c00] transition-colors"
          >
            Quản lý →
          </Link>
        </div>
        <div className="divide-y divide-dashed divide-[#e5e1d8]">
          {broadcasts.map((b) => {
            const isOpen = expanded === b.id
            return (
              <div key={b.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#fafaf7] transition-colors text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b51c00] focus-visible:outline-none"
                >
                  {/* Status icon */}
                  {b.status === "sent" ? (
                    <CheckCircle2 className="size-4 text-[#2e7d32] shrink-0" />
                  ) : (
                    <XCircle className="size-4 text-[#b51c00] shrink-0" />
                  )}

                  {/* Niche */}
                  <span className="font-mono text-[13px] text-[#1a1c1b] shrink-0">
                    {b.nicheEmoji} {b.nicheName}
                  </span>

                  {/* Products count */}
                  <span className="font-mono text-[11px] text-[#906f69] hidden sm:block">
                    {b.productCount} sản phẩm
                  </span>

                  {/* Clicks */}
                  <span className="font-mono text-[12px] font-bold text-[#006af5] ml-auto shrink-0">
                    +{b.clicksAfter24h} click/24h
                  </span>

                  {/* Time */}
                  <span className="font-mono text-[11px] text-[#906f69] hidden md:block shrink-0">
                    {fmtDateTime(b.sentAt)}
                  </span>

                  <ChevronDown className={`size-4 text-[#5c403a] shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 bg-[#fafaf7] border-t border-dashed border-[#e5e1d8]">
                    <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mt-3 mb-2">
                      Nội dung tin nhắn
                    </p>
                    {b.error && (
                      <div className="bg-[#ffdad6] border border-[#b51c00]/30 p-3 mb-3 font-mono text-[12px] text-[#b51c00]">
                        Lỗi: {b.error}
                      </div>
                    )}
                    <pre className="font-sans text-[12px] text-[#1a1c1b] whitespace-pre-wrap bg-white border border-[#e5e1d8] p-3 leading-[18px]">
                      {b.messagePreview}{b.messagePreview.length >= 120 ? "…" : ""}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Token Tab ─────────────────────────────────────────────────────────────────

interface TokenStatus {
  hasToken: boolean
  expiresAt: string | null
  daysLeft: number | null
  needsRefresh: boolean
  tokenPrefix?: string
}

function TokenTab() {
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [accessToken, setAccessToken] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [expiresInDays, setExpiresInDays] = useState("90")
  const [showAT, setShowAT] = useState(false)
  const [showRT, setShowRT] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ ok: boolean; message: string } | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/zalo-token", { headers: { "x-csrf-token": csrf } })
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSave = async () => {
    if (!accessToken.trim()) return
    setSaving(true)
    setSaveResult(null)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/zalo-token", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          refreshToken: refreshToken.trim() || undefined,
          expiresInDays: parseInt(expiresInDays) || 90,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      setSaveResult({ ok: true, message: `Đã lưu — hết hạn sau ${data.daysLeft} ngày (${new Date(data.expiresAt).toLocaleDateString("vi-VN")})` })
      setAccessToken("")
      setRefreshToken("")
      await fetchStatus()
    } catch (e) {
      setSaveResult({ ok: false, message: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const days = status?.daysLeft ?? null
  const statusColor = !status?.hasToken
    ? { bg: "bg-[#f4f4f1]", border: "border-[#e5e1d8]", text: "text-[#5c403a]", icon: <ShieldOff className="size-5 text-[#5c403a]" /> }
    : days !== null && days <= 7
    ? { bg: "bg-[#ffdad6]", border: "border-[#b51c00]/30", text: "text-[#b51c00]", icon: <ShieldAlert className="size-5 text-[#b51c00]" /> }
    : days !== null && days <= 14
    ? { bg: "bg-[#fff9c4]", border: "border-[#f57f17]/30", text: "text-[#f57f17]", icon: <ShieldAlert className="size-5 text-[#f57f17]" /> }
    : { bg: "bg-[#e8f5e9]", border: "border-[#2e7d32]/20", text: "text-[#2e7d32]", icon: <ShieldCheck className="size-5 text-[#2e7d32]" /> }

  return (
    <div className="max-w-xl space-y-6">

      {/* Status card */}
      <div className={`border p-5 clip-bevel-sm ${statusColor.bg} ${statusColor.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {statusColor.icon}
            <span className={`font-mono text-[13px] font-bold uppercase tracking-[0.05em] ${statusColor.text}`}>
              Trạng thái Zalo Token
            </span>
          </div>
          <button
            onClick={fetchStatus}
            disabled={loadingStatus}
            className="p-1.5 rounded hover:bg-black/5 transition-colors"
            title="Làm mới"
          >
            <RefreshCw className={`size-3.5 text-[#5c403a] ${loadingStatus ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loadingStatus ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner />
            <span className="font-mono text-[12px] text-[#5c403a]">Đang kiểm tra...</span>
          </div>
        ) : !status?.hasToken ? (
          <div className="space-y-1">
            <p className="font-sans text-[14px] text-[#5c403a]">Chưa có token trong database.</p>
            <p className="font-mono text-[11px] text-[#906f69]">
              Nếu đã đặt ZALO_OA_ACCESS_TOKEN trong .env, hãy restart API server để seed vào DB tự động.
              Hoặc nhập token thủ công bên dưới.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-0.5">Hết hạn</p>
                <p className="font-sans text-[14px] font-bold text-[#1a1c1b]">
                  {status.expiresAt
                    ? new Date(status.expiresAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-0.5">Còn lại</p>
                <p className={`font-sans text-[14px] font-bold ${statusColor.text}`}>
                  {days !== null ? `${days} ngày` : "—"}
                </p>
              </div>
            </div>
            {status.tokenPrefix && (
              <p className="font-mono text-[11px] text-[#906f69]">
                Token hiện tại: <span className="text-[#1a1c1b]">{status.tokenPrefix}</span>
              </p>
            )}
            {status.needsRefresh && (
              <div className="mt-2 bg-white/60 border border-current/20 rounded px-3 py-2">
                <p className="font-mono text-[12px] text-[#b51c00]">
                  ⚠ Token sắp hết hạn. API server sẽ tự động refresh vào thứ Hai 7:00 sáng.
                  Nếu auto-refresh thất bại, nhập token mới bên dưới.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* How tokens work */}
      <div className="bg-[#fafaf7] border border-dashed border-[#e5beb6] p-4 space-y-2">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] font-bold">Cách hoạt động</p>
        <div className="space-y-1.5 font-mono text-[12px] text-[#5c403a]">
          <p>• Token lưu trong bảng <code className="bg-white px-1">AppSetting</code> — không cần restart server khi đổi</p>
          <p>• API server <strong>tự động refresh</strong> mỗi thứ Hai 7:00 sáng nếu còn &lt;14 ngày</p>
          <p>• Nếu auto-refresh thất bại (Zalo revoke token), cần lấy token mới từ <strong>Zalo OA Manager</strong> và nhập vào form bên dưới</p>
          <p>• <code className="bg-white px-1">ZALO_OA_ACCESS_TOKEN</code> trong .env chỉ dùng để <strong>seed lần đầu</strong> — sau đó có thể xoá khỏi .env</p>
        </div>
      </div>

      {/* Manual update form */}
      <div className="bg-white border border-[#e5e1d8] p-5 space-y-4 clip-bevel-sm">
        <div>
          <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-1">
            Cập nhật token thủ công
          </h3>
          <p className="font-mono text-[11px] text-[#906f69]">
            Lấy token mới từ{" "}
            <a href="https://oa.zalo.me/home" target="_blank" rel="noopener noreferrer"
              className="text-[#006af5] underline">
              Zalo OA Manager
            </a>
            {" "}→ Cài đặt → API
          </p>
        </div>

        <div className="space-y-3">
          {/* Access Token */}
          <div className="space-y-1">
            <label className="font-mono text-[14px] tracking-[0.05em] text-[#5c403a]">
              Access Token <span className="text-[#b51c00]">*</span>
            </label>
            <div className="relative">
              <input
                type={showAT ? "text" : "password"}
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste access token từ Zalo OA Manager..."
                className="w-full border border-[#e5e1d8] px-3 py-2 pr-10 font-mono text-[13px] text-[#1a1c1b] bg-[#fafaf7] focus:outline-none focus:border-[#006af5]"
              />
              <button
                type="button"
                onClick={() => setShowAT(!showAT)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#906f69] hover:text-[#1a1c1b]"
                title={showAT ? "Ẩn" : "Hiện"}
              >
                {showAT ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Refresh Token */}
          <div className="space-y-1">
            <label className="font-mono text-[14px] tracking-[0.05em] text-[#5c403a]">
              Refresh Token <span className="text-[#906f69]">(tùy chọn — dùng để tự động gia hạn)</span>
            </label>
            <div className="relative">
              <input
                type={showRT ? "text" : "password"}
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
                placeholder="Paste refresh token (nếu có)..."
                className="w-full border border-[#e5e1d8] px-3 py-2 pr-10 font-mono text-[13px] text-[#1a1c1b] bg-[#fafaf7] focus:outline-none focus:border-[#006af5]"
              />
              <button
                type="button"
                onClick={() => setShowRT(!showRT)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#906f69] hover:text-[#1a1c1b]"
                title={showRT ? "Ẩn" : "Hiện"}
              >
                {showRT ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Expires in */}
          <div className="space-y-1">
            <label className="font-mono text-[14px] tracking-[0.05em] text-[#5c403a]">
              Thời hạn token (ngày)
            </label>
            <div className="flex gap-2">
              {["30", "60", "90"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setExpiresInDays(d)}
                  className={`px-3 py-1.5 font-mono text-[13px] border transition-colors ${
                    expiresInDays === d
                      ? "bg-[#006af5] text-white border-[#006af5]"
                      : "border-[#e5e1d8] text-[#5c403a] hover:border-[#006af5]"
                  }`}
                >
                  {d} ngày
                </button>
              ))}
              <input
                type="number"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                min="1"
                max="365"
                className="w-20 border border-[#e5e1d8] px-2 py-1.5 font-mono text-[13px] text-[#1a1c1b] bg-[#fafaf7] focus:outline-none focus:border-[#006af5] text-center"
              />
            </div>
            <p className="font-mono text-[10px] text-[#906f69]">Zalo OA token mặc định sống 90 ngày</p>
          </div>
        </div>

        {/* Save result */}
        {saveResult && (
          <div className={`px-3 py-2 font-mono text-[12px] border ${
            saveResult.ok
              ? "bg-[#e8f5e9] border-[#2e7d32]/20 text-[#2e7d32]"
              : "bg-[#ffdad6] border-[#b51c00]/20 text-[#b51c00]"
          }`}>
            {saveResult.ok ? "✓ " : "✗ "}{saveResult.message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !accessToken.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#006af5] text-white font-mono text-[13px] hover:bg-[#0055cc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {saving ? "Đang lưu..." : "Lưu token vào Database"}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = "analytics" | "broadcasts" | "token"

export default function ZaloPage() {
  const [tab, setTab] = useState<Tab>("analytics")
  const [period, setPeriod] = useState("7d")
  const [data, setData] = useState<ZaloData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch(`/api/admin/zalo-analytics?period=${period}`, {
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

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Zalo OA"
        subtitle="Phân tích click từ Zalo và hiệu quả của các lần broadcast tự động."
        actions={tab === "analytics" && data ? (
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
          { id: "broadcasts" as Tab, label: "📡 Broadcasts" },
          { id: "token" as Tab, label: "🔑 Token" },
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

      {tab === "token" ? (
        <TokenTab />
      ) : loading ? (
        <div className="py-24"><PageSpinner /></div>
      ) : !data ? (
        <div className="flex flex-col items-center py-24 gap-2">
          <p className="font-mono text-[13px] text-[#906f69]">Không thể tải dữ liệu.</p>
          <button
            onClick={fetchData}
            className="font-mono text-[12px] text-[#b51c00] underline"
          >
            Thử lại
          </button>
        </div>
      ) : tab === "analytics" ? (
        <AnalyticsTab data={data} />
      ) : (
        <BroadcastsTab broadcasts={data.broadcasts} />
      )}
    </div>
  )
}
