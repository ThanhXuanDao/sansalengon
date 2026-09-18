"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  AlertTriangle,
  Radio,
} from "lucide-react"
import type { NicheConfig } from "@/lib/niches"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, EmptyState, useToast } from "@/components/admin/ui"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenStatus {
  hasToken: boolean
  source?: string
  expiresAt: string | null
  daysLeft: number | null
  needsRefresh: boolean
  status: string
  message?: string
}

interface BroadcastLog {
  id: string
  channel: string
  nicheId: string | null
  status: "sent" | "failed"
  error: string | null
  sentAt: string
  productIds: string[]
  messageText: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TokenCard({
  token,
  onRefresh,
  refreshing,
}: {
  token: TokenStatus | null
  onRefresh: () => void
  refreshing: boolean
}) {
  if (!token) return <div className="bg-white border border-[#e5e1e9] p-5 animate-pulse h-28" />

  const borderColor = !token.hasToken
    ? "border-[#e5beb6]"
    : token.needsRefresh || (token.daysLeft !== null && token.daysLeft < 0)
    ? "border-[#ba1a1a] bg-[#fff8f7]"
    : "border-[#4caf50]/40 bg-[#f7fff7]"

  return (
    <div className={`border ${borderColor} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
      <Shield
        className={`size-8 shrink-0 ${
          !token.hasToken ? "text-[#906f69]" : token.needsRefresh ? "text-[#ba1a1a]" : "text-[#4caf50]"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[13px] font-bold text-[#1a1c1b] uppercase tracking-wide">
          Zalo OA Access Token
        </p>
        {!token.hasToken ? (
          <p className="font-mono text-[12px] text-[#906f69] mt-0.5">{token.message ?? "Chưa cấu hình"}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="font-mono text-[12px] text-[#5c403a]">
              {token.status} · hết hạn{" "}
              {token.expiresAt
                ? new Date(token.expiresAt).toLocaleDateString("vi-VN", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })
                : "—"}
            </span>
            {token.daysLeft !== null && (
              <span
                className={`font-mono text-[11px] px-2 py-0.5 font-bold ${
                  token.daysLeft < 0
                    ? "bg-[#ba1a1a] text-white"
                    : token.daysLeft <= 14
                    ? "bg-[#ffdf9a] text-[#6f5400]"
                    : "bg-[#e8f5e9] text-[#2e7d32]"
                }`}
              >
                {token.daysLeft < 0
                  ? "ĐÃ HẾT HẠN"
                  : `còn ${token.daysLeft} ngày`}
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing || !token.hasToken}
        className="flex items-center gap-2 px-4 py-2 font-mono text-[12px] font-bold uppercase border border-[#e5e1e9] hover:bg-[#f4f4f1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
      >
        <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        Refresh Token
      </button>
    </div>
  )
}

function SendPanel({
  niches,
  onSend,
  sending,
  preview,
  onClearPreview,
}: {
  niches: NicheConfig[]
  onSend: (nicheId?: string) => void
  sending: boolean
  preview: { text: string; logId?: string; error?: string } | null
  onClearPreview: () => void
}) {
  const [selectedNiche, setSelectedNiche] = useState("all")

  return (
    <div className="bg-white border border-[#e5e1e9] p-5 space-y-4">
      <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] flex items-center gap-2">
        <Radio className="size-4 text-[#b51c00]" />
        Gửi Broadcast Thủ Công
      </h3>

      <div className="flex flex-wrap gap-3">
        <select
          value={selectedNiche}
          onChange={(e) => setSelectedNiche(e.target.value)}
          className="border border-[#e5e1e9] bg-white font-mono text-[13px] px-3 py-2 focus:ring-2 focus:ring-[#b51c00] focus:outline-none"
        >
          <option value="all">Tất cả ngách</option>
          {niches.map((n) => (
            <option key={n.id} value={n.id}>
              {n.emoji} {n.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => onSend(selectedNiche === "all" ? undefined : selectedNiche)}
          disabled={sending}
          className="flex items-center gap-2 px-5 py-2 bg-[#b51c00] text-white font-mono text-[13px] font-bold uppercase hover:bg-[#8b1500] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {sending ? <RefreshCw className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {sending ? "Đang gửi..." : "Gửi ngay"}
        </button>
      </div>

      {/* Preview / result */}
      {preview && (
        <div
          className={`border p-4 relative ${
            preview.error ? "border-[#ba1a1a] bg-[#fff8f7]" : "border-[#4caf50]/40 bg-[#f7fff7]"
          }`}
        >
          <button
            onClick={onClearPreview}
            className="absolute top-2 right-2 text-[#906f69] hover:text-[#1a1c1b] font-mono text-[11px] transition-colors"
          >
            ✕
          </button>
          {preview.error ? (
            <p className="font-mono text-[12px] text-[#ba1a1a]">❌ {preview.error}</p>
          ) : (
            <>
              <p className="font-mono text-[11px] text-[#4caf50] font-bold uppercase mb-2">
                ✅ Đã gửi thành công
              </p>
              <pre className="font-mono text-[11px] text-[#1a1c1b] whitespace-pre-wrap leading-relaxed">
                {preview.text}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryRow({ log, niches }: { log: BroadcastLog; niches: NicheConfig[] }) {
  const [expanded, setExpanded] = useState(false)
  const niche = niches.find((n) => n.id === log.nicheId)
  const dateStr = new Date(log.sentAt).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  return (
    <>
      <tr className="border-b border-dashed border-[#e5e1e9] hover:bg-[#f9f9f6] transition-colors">
        <td className="p-3">
          {log.status === "sent" ? (
            <CheckCircle2 className="size-4 text-[#4caf50]" />
          ) : (
            <XCircle className="size-4 text-[#ba1a1a]" />
          )}
        </td>
        <td className="p-3 font-mono text-[12px] text-[#5c403a] uppercase">{log.channel}</td>
        <td className="p-3 font-mono text-[12px] text-[#1a1c1b]">
          {niche ? `${niche.emoji} ${niche.name}` : log.nicheId ?? "Tất cả"}
        </td>
        <td className="p-3 font-mono text-[12px] text-[#5c403a]">{log.productIds.length} sản phẩm</td>
        <td className="p-3 font-mono text-[11px] text-[#906f69]">
          <div className="flex items-center gap-1">
            <Clock className="size-3" />
            {dateStr}
          </div>
        </td>
        <td className="p-3">
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 font-mono text-[11px] text-[#b51c00] hover:underline focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            Nội dung
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-[#e5e1e9]">
          <td colSpan={6} className="px-4 pb-4 pt-0">
            {log.error && (
              <p className="font-mono text-[11px] text-[#ba1a1a] mb-2 flex items-center gap-1">
                <AlertTriangle className="size-3" /> Lỗi: {log.error}
              </p>
            )}
            <pre className="bg-[#f4f4f1] border border-[#e5e1e9] p-3 font-mono text-[11px] text-[#1a1c1b] whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-60">
              {log.messageText || "(không có nội dung)"}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BroadcastPage() {
  const { error: toastError } = useToast()
  const [niches, setNiches] = useState<NicheConfig[]>([])
  const [token, setToken] = useState<TokenStatus | null>(null)
  const [logs, setLogs] = useState<BroadcastLog[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [preview, setPreview] = useState<{ text: string; logId?: string; error?: string } | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 20

  const fetchToken = useCallback(async () => {
    const res = await fetch("/api/broadcast/token")
    if (res.ok) setToken(await res.json())
  }, [])

  useEffect(() => {
    fetch("/api/admin/niches/manage").then(async (r) => {
      if (r.ok) { const j = await r.json(); setNiches(j.data ?? []) }
    }).catch(() => {})
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/broadcast?take=${PAGE_SIZE}`)
      if (res.ok) {
        const json = await res.json()
        setLogs(json.data)
      }
    } finally {
      setLogsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchToken()
    fetchLogs()
  }, [fetchToken, fetchLogs])

  const handleRefreshToken = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/broadcast/token", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        await fetchToken()
      } else {
        toastError(`Refresh thất bại: ${data.error}`)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleSend = async (nicheId?: string) => {
    setSending(true)
    setPreview(null)
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicheId }),
      })
      const data = await res.json()
      if (res.ok) {
        setPreview({ text: data.preview, logId: data.logId })
        fetchLogs()
      } else {
        setPreview({ text: "", error: data.error ?? "Gửi thất bại" })
      }
    } catch (e: any) {
      setPreview({ text: "", error: e.message })
    } finally {
      setSending(false)
    }
  }

  const sentCount  = logs.filter((l) => l.status === "sent").length
  const failCount  = logs.filter((l) => l.status === "failed").length
  const successRate = logs.length > 0 ? Math.round((sentCount / logs.length) * 100) : null

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Phát sóng"
        subtitle="Zalo OA · Lịch sử gửi & quản lý token"
        actions={
          <button onClick={fetchLogs} className="flex items-center gap-2 font-mono text-[13px] border border-[#e5e1e9] px-3 py-2 hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
            <RefreshCw className="size-3.5" />
            Làm mới
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tổng lần gửi", value: logs.length || "—" },
          { label: "Thành công", value: sentCount || "—", color: "text-[#4caf50]" },
          { label: "Thất bại", value: failCount || "—", color: failCount > 0 ? "text-[#ba1a1a]" : undefined },
          { label: "Tỉ lệ thành công", value: successRate !== null ? `${successRate}%` : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[#e5e1e9] p-4">
            <p className="font-mono text-[11px] text-[#5c403a] uppercase tracking-wide">{s.label}</p>
            <p className={`font-mono text-[28px] font-bold mt-1 ${s.color ?? "text-[#1a1c1b]"}`}>
              {String(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Token status */}
      <TokenCard token={token} onRefresh={handleRefreshToken} refreshing={refreshing} />

      {/* Send panel */}
      <SendPanel
        niches={niches}
        onSend={handleSend}
        sending={sending}
        preview={preview}
        onClearPreview={() => setPreview(null)}
      />

      {/* History table */}
      <div className="bg-white border border-[#e5e1e9]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e1e9]">
          <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b]">Lịch sử broadcast</h3>
          <span className="font-mono text-[11px] text-[#906f69]">{logs.length} bản ghi</span>
        </div>

        {logsLoading ? (
          <div className="py-12"><PageSpinner /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="Chưa có lịch sử gửi"
            description='Nhấn "Gửi ngay" hoặc đợi cron chạy lúc 9h sáng'
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#e5e1e9] bg-[#f4f4f1]">
                  {["", "Kênh", "Ngách", "Sản phẩm", "Thời gian", ""].map((h) => (
                    <th
                      key={h}
                      className="p-3 text-left font-mono text-[11px] text-[#5c403a] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <HistoryRow key={log.id} log={log} niches={niches} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
