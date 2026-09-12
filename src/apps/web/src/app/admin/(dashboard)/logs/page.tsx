"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  RefreshCw, Trash2, ChevronDown, ChevronRight,
  AlertCircle, AlertTriangle, Info, Bug, Search, X,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, useToast } from "@/components/admin/ui"

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = "error" | "warn" | "info" | "debug"

interface LogEntry {
  id: string
  level: Level
  message: string
  context: string | null
  source: string | null
  createdAt: string
}

interface LogsResponse {
  logs: LogEntry[]
  total: number
  page: number
  pages: number
  levelCounts: Record<Level, number>
}

// ── Config ────────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<Level, {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  Icon: typeof AlertCircle
}> = {
  error: { label: "Error",  bg: "bg-[#fff0ee]", text: "text-[#ba1a1a]", border: "border-[#ba1a1a]/20", dot: "bg-[#ba1a1a]", Icon: AlertCircle },
  warn:  { label: "Warn",   bg: "bg-[#fffbf0]", text: "text-[#92680a]", border: "border-[#e6a817]/30", dot: "bg-[#e6a817]", Icon: AlertTriangle },
  info:  { label: "Info",   bg: "bg-[#eff6ff]", text: "text-[#1d4ed8]", border: "border-[#3b82f6]/20", dot: "bg-[#3b82f6]", Icon: Info },
  debug: { label: "Debug",  bg: "bg-[#f4f4f1]", text: "text-[#5c403a]", border: "border-[#e5e1d8]",    dot: "bg-[#9ca3af]", Icon: Bug },
}

const RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "7d",    label: "7 ngày"  },
  { value: "30d",   label: "30 ngày" },
  { value: "all",   label: "Tất cả"  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString("vi-VN", {
    day:    "2-digit", month: "2-digit", year: "numeric",
    hour:   "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)   return `${Math.floor(diff / 1000)}s trước`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h trước`
  return `${Math.floor(diff / 86_400_000)}d trước`
}

function tryParseJson(s: string | null): unknown | null {
  if (!s) return null
  try { return JSON.parse(s) } catch { return s }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: Level }) {
  const { bg, text, border, label } = LEVEL_CONFIG[level]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider border ${bg} ${text} ${border}`}>
      {label.toUpperCase()}
    </span>
  )
}

function SourceTag({ source }: { source: string | null }) {
  if (!source) return <span className="text-[#9ca3af] font-mono text-[11px]">—</span>
  return (
    <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#f4f4f1] border border-[#e5e1d8] text-[#5c403a]">
      {source}
    </span>
  )
}

function LogDetail({ log }: { log: LogEntry }) {
  const ctx = tryParseJson(log.context)
  const ctxObj = ctx !== null && typeof ctx === "object" && !Array.isArray(ctx)
    ? (ctx as Record<string, unknown>)
    : null

  // IIFE so TypeScript infers string | null cleanly (avoids unknown leaking into JSX)
  const stack: string | null = (() => {
    if (ctxObj !== null && ctxObj.stack != null) return String(ctxObj.stack)
    if (typeof ctx === "string" && ctx.includes("\n")) return ctx
    return null
  })()

  const otherFields = ctxObj !== null
    ? Object.entries(ctxObj).filter(([k]) => k !== "stack")
    : null

  // Pre-compute booleans so JSX never sees `unknown`
  const hasStack = stack !== null
  const hasOther = otherFields !== null && otherFields.length > 0
  const hasRaw   = ctx !== null && ctxObj === null && stack === null
  const ctxStr   = hasRaw
    ? (typeof ctx === "string" ? ctx : JSON.stringify(ctx, null, 2))
    : ""

  const { bg, text, border } = LEVEL_CONFIG[log.level]

  return (
    <div className="space-y-4">
      {/* Full message */}
      <div>
        <p className={`font-mono text-[10px] uppercase tracking-[0.08em] font-bold mb-2 ${text}`}>
          Thông điệp đầy đủ
        </p>
        <div className={`px-3 py-2.5 border ${bg} ${border}`}>
          <p className="font-mono text-[12px] text-[#1a1c1b] leading-relaxed break-all whitespace-pre-wrap">
            {log.message}
          </p>
        </div>
      </div>

      {/* Stack trace */}
      {hasStack && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">
            Stack trace
          </p>
          <pre className="font-mono text-[11px] text-[#374151] bg-white border border-[#e5e1d8] p-3 overflow-x-auto max-h-64 leading-relaxed">
            {stack}
          </pre>
        </div>
      )}

      {/* Other context fields */}
      {hasOther && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">
            Metadata
          </p>
          <div className="space-y-1.5">
            {otherFields!.map(([k, v]) => (
              <div key={k} className="flex gap-3 font-mono text-[11px]">
                <span className="text-[#906f69] shrink-0 w-28 truncate">{k}</span>
                <span className="text-[#1a1c1b] break-all">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw context (non-object) */}
      {hasRaw && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">
            Context
          </p>
          <pre className="font-mono text-[11px] text-[#374151] bg-white border border-[#e5e1d8] p-3 overflow-x-auto max-h-60">
            {ctxStr}
          </pre>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-1 border-t border-dashed border-[#e5e1d8]">
        <span className="font-mono text-[10px] text-[#9ca3af]">ID: {log.id}</span>
        <span className="font-mono text-[10px] text-[#9ca3af]">{fmtTime(log.createdAt)}</span>
        {log.source !== null && (
          <span className="font-mono text-[10px] text-[#9ca3af]">Source: {log.source}</span>
        )}
      </div>
    </div>
  )
}

function LogRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="border-b border-dashed border-[#e5e1d8] hover:bg-[#fafaf7] transition-colors cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Time */}
        <td className="px-4 py-3 whitespace-nowrap" title={fmtTime(log.createdAt)}>
          <span className="font-mono text-[11px] text-[#5c403a]">{relTime(log.createdAt)}</span>
          <br />
          <span className="font-mono text-[10px] text-[#9ca3af]">{fmtTime(log.createdAt)}</span>
        </td>
        {/* Level */}
        <td className="px-4 py-3 whitespace-nowrap">
          <LevelBadge level={log.level} />
        </td>
        {/* Source */}
        <td className="px-4 py-3 whitespace-nowrap">
          <SourceTag source={log.source} />
        </td>
        {/* Message */}
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[#9ca3af]">
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </span>
            <span className="font-mono text-[12px] text-[#1a1c1b] leading-relaxed break-all line-clamp-2">
              {log.message}
            </span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-dashed border-[#e5e1d8] bg-[#f9f9f6]">
          <td colSpan={4} className="px-5 py-4">
            <LogDetail log={log} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LogsPage() {
  const { success, error: toastError } = useToast()
  const [data, setData]         = useState<LogsResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [level, setLevel]       = useState<Level | "all">("all")
  const [range, setRange]       = useState("today")
  const [q, setQ]               = useState("")
  const [page, setPage]         = useState(1)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        page:  String(page),
        range,
        ...(level !== "all" ? { level } : {}),
        ...(q.trim()        ? { q: q.trim() } : {}),
      })
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error("Fetch failed")
      setData(await res.json())
    } catch {
      if (!silent) toastError("Không thể tải logs")
    } finally {
      setLoading(false)
    }
  }, [page, range, level, q, toastError])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => fetchLogs(true), 10_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    setClearing(true)
    try {
      const params = level !== "all" ? `?level=${level}` : ""
      const res = await fetch(`/api/admin/logs${params}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      const { deleted } = await res.json()
      success(`Đã xóa ${deleted} log`)
      setData(null)
      fetchLogs()
    } catch {
      toastError("Xóa thất bại")
    } finally {
      setClearing(false)
      setConfirmClear(false)
    }
  }

  const handleLevelChange = (v: Level | "all") => { setLevel(v); setPage(1) }
  const handleRangeChange = (v: string)        => { setRange(v); setPage(1) }
  const handleSearch = (v: string)             => { setQ(v);     setPage(1) }

  const levelOrder: (Level | "all")[] = ["all", "error", "warn", "info", "debug"]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="System Logs"
        subtitle="Lịch sử error, warning, info và debug của hệ thống"
        actions={
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[12px] border transition-colors ${
                autoRefresh
                  ? "bg-[#1a1c1b] text-white border-[#1a1c1b]"
                  : "border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] bg-white"
              }`}
              title={autoRefresh ? "Tắt tự động làm mới" : "Bật tự động làm mới (10s)"}
            >
              <RefreshCw className={`size-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto" : "Manual"}
            </button>
            <Button variant="ghost" icon={RefreshCw} onClick={() => fetchLogs()} aria-label="Làm mới" />
          </div>
        }
      />

      {/* Level stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["error", "warn", "info", "debug"] as Level[]).map((lv) => {
          const { bg, text, border, dot, Icon } = LEVEL_CONFIG[lv]
          const count = data?.levelCounts[lv] ?? 0
          return (
            <button
              key={lv}
              onClick={() => handleLevelChange(level === lv ? "all" : lv)}
              className={`flex items-center gap-3 px-4 py-3 border text-left transition-colors ${
                level === lv
                  ? `${bg} ${border} ring-1 ring-current`
                  : "bg-white border-[#e5e1d8] hover:border-[#1a1c1b]"
              }`}
            >
              <span className={`size-2 rounded-full shrink-0 ${dot}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-mono text-[10px] uppercase tracking-wider ${level === lv ? text : "text-[#5c403a]"}`}>
                  {LEVEL_CONFIG[lv].label}
                </p>
                <p className={`font-sans text-[22px] font-extrabold leading-none mt-0.5 ${level === lv ? text : "text-[#1a1c1b]"}`}>
                  {count.toLocaleString("vi-VN")}
                </p>
              </div>
              <Icon className={`size-5 shrink-0 ${level === lv ? text : "text-[#c5c0b8]"}`} />
            </button>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af]" />
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Tìm trong message..."
            className="w-full pl-9 pr-8 py-2 font-mono text-[13px] bg-white border border-[#e5e1d8] focus:border-[#1a1c1b] focus:ring-0 outline-none text-[#1a1c1b] placeholder:text-[#9ca3af]"
          />
          {q && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#1a1c1b]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Range */}
        <div className="flex border border-[#e5e1d8] bg-white overflow-hidden shrink-0">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleRangeChange(opt.value)}
              className={`px-3 py-2 font-mono text-[12px] transition-colors border-r last:border-r-0 border-[#e5e1d8] ${
                range === opt.value
                  ? "bg-[#1a1c1b] text-white"
                  : "text-[#5c403a] hover:bg-[#f4f4f1]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={clearing}
          className={`flex items-center gap-2 px-3 py-2 font-mono text-[12px] border shrink-0 transition-colors ${
            confirmClear
              ? "bg-[#ba1a1a] text-white border-[#ba1a1a]"
              : "border-[#e5e1d8] text-[#5c403a] hover:border-[#ba1a1a] hover:text-[#ba1a1a] bg-white"
          }`}
          onBlur={() => setTimeout(() => setConfirmClear(false), 200)}
        >
          <Trash2 className="size-3.5" />
          {confirmClear ? "Xác nhận xóa?" : level !== "all" ? `Xóa ${LEVEL_CONFIG[level as Level].label}` : "Xóa tất cả"}
        </button>
      </div>

      {/* Log table */}
      <div className="bg-white border border-[#e5e1d8] overflow-hidden">
        {loading ? (
          <div className="py-20"><PageSpinner /></div>
        ) : !data || data.logs.length === 0 ? (
          <div className="py-16 text-center">
            <Bug className="size-8 text-[#d1c9c7] mx-auto mb-3" />
            <p className="font-mono text-[13px] text-[#5c403a]">Không có log nào</p>
            <p className="font-mono text-[11px] text-[#9ca3af] mt-1">
              Dùng <code className="bg-[#f4f4f1] px-1">logger.info()</code> trong server code để ghi log
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b border-[#e5e1d8] bg-[#f4f4f1]">
                    <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#5c403a] w-36">Thời gian</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#5c403a] w-20">Level</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#5c403a] w-24">Source</th>
                    <th className="text-left px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[#5c403a]">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => <LogRow key={log.id} log={log} />)}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-dashed border-[#e5e1d8]">
                <p className="font-mono text-[11px] text-[#5c403a]">
                  {((page - 1) * 50 + 1).toLocaleString()}–{Math.min(page * 50, data.total).toLocaleString()} / {data.total.toLocaleString()} log
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 font-mono text-[12px] border border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1.5 font-mono text-[12px] text-[#1a1c1b] border border-[#e5e1d8] bg-[#f4f4f1]">
                    {page} / {data.pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page === data.pages}
                    className="px-2.5 py-1.5 font-mono text-[12px] border border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
