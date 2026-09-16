"use client"

import { useState, useEffect, useCallback } from "react"
import { RefreshCw, ExternalLink, Loader2, Info, CheckCircle2, Clock, XCircle } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { PageSpinner, useToast } from "@/components/admin/ui"

// ── Types ────────────────────────────────────────────────────────────────────

interface NicheMatch {
  nicheId: string
  matchedAt: string
}

interface Campaign {
  id: string
  name: string
  merchant: string
  url: string
  approval: string
  cookieDuration: number | null
  status: number
  lastSeenAt: string
  createdAt: string
  nicheMatches: NicheMatch[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PLATFORM_KEYWORDS: Record<string, string[]> = {
  tiki:   ["tiki"],
  lazada: ["lazada"],
  shopee: ["shopee"],
  sendo:  ["sendo"],
  tiktok: ["tiktok", "tik tok"],
}

function detectPlatform(name: string, merchant: string): string | null {
  const haystack = `${name} ${merchant}`.toLowerCase()
  for (const [platform, kws] of Object.entries(PLATFORM_KEYWORDS)) {
    if (kws.some((k) => haystack.includes(k))) return platform
  }
  return null
}

const PLATFORM_COLORS: Record<string, string> = {
  tiki:   "bg-[#0d5cb6]/10 text-[#0d5cb6] border-[#0d5cb6]/30",
  lazada: "bg-[#f57224]/10 text-[#c45e1a] border-[#f57224]/30",
  shopee: "bg-[#ee4d2d]/10 text-[#b83c22] border-[#ee4d2d]/30",
  sendo:  "bg-[#e53935]/10 text-[#b71c1c] border-[#e53935]/30",
  tiktok: "bg-[#010101]/10 text-[#010101] border-[#010101]/30",
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "< 1 giờ trước"
  if (h < 24) return `${h}h trước`
  const d = Math.floor(h / 24)
  return `${d} ngày trước`
}

// ── ApprovalBadge ─────────────────────────────────────────────────────────────

function ApprovalBadge({ approval }: { approval: string }) {
  if (approval === "successful") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e6f4ea] text-[#1a6b3c] font-mono text-[10px] uppercase tracking-wider">
        <CheckCircle2 className="size-3" />
        Approved
      </span>
    )
  }
  if (approval === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fff8e1] text-[#6f5400] font-mono text-[10px] uppercase tracking-wider">
        <Clock className="size-3" />
        Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#fce8e6] text-[#c5221f] font-mono text-[10px] uppercase tracking-wider">
      <XCircle className="size-3" />
      {approval}
    </span>
  )
}

// ── CampaignRow ───────────────────────────────────────────────────────────────

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const platform = detectPlatform(campaign.name, campaign.merchant)
  const platformColor = platform ? PLATFORM_COLORS[platform] : "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"

  return (
    <tr className="border-b border-[#e5e1d8] hover:bg-[#f9f9f6] transition-colors">
      {/* Campaign */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[13px] font-bold text-[#1a1c1b]">{campaign.name}</span>
              {platform && (
                <span className={`px-1.5 py-0.5 border font-mono text-[10px] uppercase tracking-wider ${platformColor}`}>
                  {platform}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[11px] text-[#5c403a]">{campaign.merchant}</span>
              <a
                href={campaign.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#906f69] hover:text-[#b51c00] transition-colors"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </td>

      {/* ID */}
      <td className="px-4 py-3 align-top">
        <span className="font-mono text-[11px] text-[#5c403a] bg-[#f4f4f1] px-1.5 py-0.5">{campaign.id}</span>
      </td>

      {/* Approval */}
      <td className="px-4 py-3 align-top">
        <ApprovalBadge approval={campaign.approval} />
      </td>

      {/* Cookie */}
      <td className="px-4 py-3 align-top">
        <span className="font-mono text-[12px] text-[#1a1c1b]">
          {campaign.cookieDuration != null ? `${campaign.cookieDuration}d` : "—"}
        </span>
      </td>

      {/* Niche matches */}
      <td className="px-4 py-3 align-top">
        {campaign.nicheMatches.length === 0 ? (
          <span className="font-mono text-[11px] text-[#906f69]">Chưa match</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {campaign.nicheMatches.map((m) => (
              <span
                key={m.nicheId}
                title={`Matched: ${formatDate(m.matchedAt)}`}
                className="px-2 py-0.5 bg-[#e8f5e9] border border-[#1a6b3c]/20 font-mono text-[10px] text-[#1a6b3c]"
              >
                {m.nicheId}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Last seen */}
      <td className="px-4 py-3 align-top text-right">
        <span className="font-mono text-[11px] text-[#5c403a]" title={formatDate(campaign.lastSeenAt)}>
          {relativeTime(campaign.lastSeenAt)}
        </span>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { error: toastError } = useToast()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched">("all")

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/at-campaigns", {
        headers: { "x-csrf-token": csrf },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
    } catch (e: any) {
      toastError(`Không tải được danh sách campaign: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = campaigns.filter((c) => {
    if (filter === "matched") return c.nicheMatches.length > 0
    if (filter === "unmatched") return c.nicheMatches.length === 0
    return true
  })

  const matchedCount = campaigns.filter((c) => c.nicheMatches.length > 0).length
  const platformCounts = campaigns.reduce<Record<string, number>>((acc, c) => {
    const p = detectPlatform(c.name, c.merchant) ?? "other"
    acc[p] = (acc[p] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="AccessTrade Campaigns"
        subtitle="Danh sách campaign đã đăng ký & được duyệt. Cập nhật mỗi lần sync chạy (4h/lần)."
        actions={
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#e5e1d8] font-mono text-[12px] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Tải lại
          </button>
        }
      />

      {/* Stats */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#e5e1d8] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Tổng campaign</p>
            <p className="font-mono text-[28px] font-bold text-[#1a1c1b] tabular-nums">{campaigns.length}</p>
          </div>
          <div className="bg-white border border-[#e5e1d8] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Đang match ngách</p>
            <p className="font-mono text-[28px] font-bold text-[#1a6b3c] tabular-nums">{matchedCount}</p>
          </div>
          <div className="bg-white border border-[#e5e1d8] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Chưa match</p>
            <p className="font-mono text-[28px] font-bold text-[#5c403a] tabular-nums">{campaigns.length - matchedCount}</p>
          </div>
          <div className="bg-white border border-[#e5e1d8] px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Sàn</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(platformCounts).map(([p, n]) => (
                <span key={p} className={`px-1.5 py-0.5 border font-mono text-[10px] ${PLATFORM_COLORS[p] ?? "bg-[#f4f4f1] text-[#5c403a] border-[#e5e1d8]"}`}>
                  {p} ×{n}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-[#f9f9f6] border border-[#e5e1d8]">
        <Info className="size-4 text-[#5c403a] mt-0.5 shrink-0" />
        <p className="font-mono text-[12px] text-[#5c403a]">
          Data được cập nhật mỗi lần <strong>DealSyncService</strong> chạy (cron 0 */4 * * *).
          Nếu bảng trống, hãy trigger sync thủ công tại <strong>Admin → Sync Jobs</strong> hoặc chờ lần chạy tiếp theo.
          Campaign match ngách theo <code className="bg-[#e5e1d8] px-1">atKeywords</code> trong Admin → Quản lý ngách.
        </p>
      </div>

      {/* Filter tabs */}
      {!loading && campaigns.length > 0 && (
        <div className="flex gap-0 border border-[#e5e1d8] w-fit">
          {(["all", "matched", "unmatched"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 font-mono text-[12px] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                filter === f
                  ? "bg-[#1a1c1b] text-white"
                  : "text-[#5c403a] hover:bg-[#f4f4f1]"
              }`}
            >
              {f === "all" ? `Tất cả (${campaigns.length})` : f === "matched" ? `Đã match (${matchedCount})` : `Chưa match (${campaigns.length - matchedCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-24"><PageSpinner /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white border border-[#e5e1d8] p-12 text-center">
          <p className="font-mono text-[13px] text-[#5c403a]">Chưa có campaign nào trong DB.</p>
          <p className="font-mono text-[11px] text-[#906f69] mt-1">Trigger một lần sync để load campaign từ AccessTrade.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#e5e1d8] bg-[#f9f9f6]">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Campaign</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">ID</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Trạng thái</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Cookie</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Match ngách</th>
                <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.1em] text-[#906f69]">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-8 text-center font-mono text-[12px] text-[#906f69]">
              Không có campaign nào khớp filter.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
