"use client"

import { useState, useEffect, useCallback } from "react"
import {
  RefreshCw, Trash2,
  AlertCircle, AlertTriangle, Info, Bug, ChevronDown, ChevronRight,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  AdminFilterBar, FilterSelect,
  DataTable, DataTablePagination,
  Button, useToast,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = "error" | "warn" | "info" | "debug"
type AppOrigin = "web-public" | "web-admin" | "api" | "api-sync" | "api-distribute"

interface LogEntry {
  id: string
  level: Level
  message: string
  context: string | null
  source: string | null
  app: AppOrigin | null
  trigger: string | null
  createdAt: string
}

interface LogsResponse {
  logs: LogEntry[]
  total: number
  page: number
  pages: number
  levelCounts: Record<Level, number>
  appCounts: Record<string, number>
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
  error: { label: "Error", bg: "bg-[#fff0ee]", text: "text-[#ba1a1a]", border: "border-[#ba1a1a]/20", dot: "bg-[#ba1a1a]", Icon: AlertCircle },
  warn:  { label: "Warn",  bg: "bg-[#fffbf0]", text: "text-[#92680a]", border: "border-[#e6a817]/30", dot: "bg-[#e6a817]", Icon: AlertTriangle },
  info:  { label: "Info",  bg: "bg-[#eff6ff]", text: "text-[#1d4ed8]", border: "border-[#3b82f6]/20", dot: "bg-[#3b82f6]", Icon: Info },
  debug: { label: "Debug", bg: "bg-[#f4f4f1]", text: "text-[#5c403a]", border: "border-[#e5e1d8]",    dot: "bg-[#9ca3af]", Icon: Bug },
}

const APP_CONFIG: Record<AppOrigin, { label: string; bg: string; text: string; border: string }> = {
  "web-admin":      { label: "web-admin",      bg: "bg-[#f0f0ff]", text: "text-[#4338ca]", border: "border-[#818cf8]/30" },
  "web-public":     { label: "web-public",     bg: "bg-[#f0fdf4]", text: "text-[#15803d]", border: "border-[#86efac]/40" },
  "api":            { label: "api",            bg: "bg-[#fff7ed]", text: "text-[#b45309]", border: "border-[#fcd34d]/40" },
  "api-sync":       { label: "api-sync",       bg: "bg-[#fdf2f8]", text: "text-[#9d174d]", border: "border-[#f9a8d4]/30" },
  "api-distribute": { label: "api-distribute", bg: "bg-[#ecfeff]", text: "text-[#0e7490]", border: "border-[#67e8f9]/30" },
}

const TRIGGER_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  cron:   { label: "cron",   bg: "bg-[#f9f9f6]", text: "text-[#5c403a]" },
  manual: { label: "manual", bg: "bg-[#f0f9ff]", text: "text-[#0369a1]" },
  user:   { label: "user",   bg: "bg-[#f0fdf4]", text: "text-[#15803d]" },
  system: { label: "system", bg: "bg-[#fff7ed]", text: "text-[#92400e]" },
}

const APP_ORIGINS: AppOrigin[] = ["web-admin", "web-public", "api", "api-sync", "api-distribute"]

const APP_OPTIONS = [
  { value: "all", label: "Tất cả app" },
  ...APP_ORIGINS.map((o) => ({ value: o, label: o })),
]

const RANGE_OPTIONS = [
  { value: "today", label: "Hôm nay" },
  { value: "7d",    label: "7 ngày"  },
  { value: "30d",   label: "30 ngày" },
  { value: "all",   label: "Tất cả"  },
]

const COLUMNS: TableColumn[] = [
  { key: "time",    label: "Thời gian", width: "150px" },
  { key: "level",   label: "Level",     width: "80px"  },
  { key: "source",  label: "Source",    width: "120px" },
  { key: "origin",  label: "Origin",    width: "140px" },
  { key: "message", label: "Message"                   },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)     return `${Math.floor(diff / 1000)}s trước`
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m trước`
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

function AppBadge({ app }: { app: AppOrigin | null }) {
  if (!app) return null
  const cfg = APP_CONFIG[app] ?? { label: app, bg: "bg-[#f4f4f1]", text: "text-[#5c403a]", border: "border-[#e5e1d8]" }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  )
}

function TriggerBadge({ trigger }: { trigger: string | null }) {
  if (!trigger) return null
  const cfg = TRIGGER_CONFIG[trigger] ?? { label: trigger, bg: "bg-[#f4f4f1]", text: "text-[#5c403a]" }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 font-mono text-[10px] border border-transparent ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

function LogDetail({ log }: { log: LogEntry }) {
  const ctx = tryParseJson(log.context)
  const ctxObj = ctx !== null && typeof ctx === "object" && !Array.isArray(ctx)
    ? (ctx as Record<string, unknown>)
    : null

  const stack: string | null = (() => {
    if (ctxObj !== null && ctxObj.stack != null) return String(ctxObj.stack)
    if (typeof ctx === "string" && ctx.includes("\n")) return ctx
    return null
  })()

  const otherFields = ctxObj !== null
    ? Object.entries(ctxObj).filter(([k]) => k !== "stack")
    : null

  const hasStack = stack !== null
  const hasOther = otherFields !== null && otherFields.length > 0
  const hasRaw   = ctx !== null && ctxObj === null && stack === null
  const ctxStr   = hasRaw ? (typeof ctx === "string" ? ctx : JSON.stringify(ctx, null, 2)) : ""

  const { bg, text, border } = LEVEL_CONFIG[log.level]

  return (
    <div className="space-y-4">
      <div>
        <p className={`font-mono text-[10px] uppercase tracking-[0.08em] font-bold mb-2 ${text}`}>Thông điệp đầy đủ</p>
        <div className={`px-3 py-2.5 border ${bg} ${border}`}>
          <p className="font-mono text-[12px] text-[#1a1c1b] leading-relaxed break-all whitespace-pre-wrap">{log.message}</p>
        </div>
      </div>
      {hasStack && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">Stack trace</p>
          <pre className="font-mono text-[11px] text-[#374151] bg-white border border-[#e5e1d8] p-3 overflow-x-auto max-h-64 leading-relaxed">{stack}</pre>
        </div>
      )}
      {hasOther && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">Metadata</p>
          <div className="space-y-1.5">
            {otherFields!.map(([k, v]) => (
              <div key={k} className="flex gap-3 font-mono text-[11px]">
                <span className="text-[#906f69] shrink-0 w-28 truncate">{k}</span>
                <span className="text-[#1a1c1b] break-all">{typeof v === "string" ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {hasRaw && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] font-bold text-[#5c403a] mb-2">Context</p>
          <pre className="font-mono text-[11px] text-[#374151] bg-white border border-[#e5e1d8] p-3 overflow-x-auto max-h-60">{ctxStr}</pre>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-dashed border-[#e5e1d8]">
        <span className="font-mono text-[10px] text-[#9ca3af]">ID: {log.id}</span>
        <span className="font-mono text-[10px] text-[#9ca3af]">{fmtTime(log.createdAt)}</span>
        {log.source   && <span className="font-mono text-[10px] text-[#9ca3af]">source: {log.source}</span>}
        {log.app      && <span className="font-mono text-[10px] text-[#9ca3af]">app: {log.app}</span>}
        {log.trigger  && <span className="font-mono text-[10px] text-[#9ca3af]">trigger: {log.trigger}</span>}
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
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="font-mono text-[11px] text-[#5c403a]">{relTime(log.createdAt)}</span>
          <br />
          <span className="font-mono text-[10px] text-[#9ca3af]">{fmtTime(log.createdAt)}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <LevelBadge level={log.level} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          {log.source
            ? <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[#f4f4f1] border border-[#e5e1d8] text-[#5c403a]">{log.source}</span>
            : <span className="text-[#9ca3af] font-mono text-[11px]">—</span>
          }
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            {log.app     && <AppBadge     app={log.app}         />}
            {log.trigger && <TriggerBadge trigger={log.trigger} />}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 shrink-0 text-[#9ca3af]">
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </span>
            <span className="font-mono text-[12px] text-[#1a1c1b] leading-relaxed break-all line-clamp-2">{log.message}</span>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-dashed border-[#e5e1d8] bg-[#f9f9f6]">
          <td colSpan={5} className="px-5 py-4">
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
  const [data, setData]               = useState<LogsResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [level, setLevel]             = useState<Level | "all">("all")
  const [app, setApp]                 = useState<AppOrigin | "all">("all")
  const [range, setRange]             = useState("today")
  const [q, setQ]                     = useState("")
  const [appliedQ, setAppliedQ]       = useState("")
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(50)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [clearing, setClearing]       = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(pageSize),
        range,
        ...(level !== "all" ? { level }      : {}),
        ...(app   !== "all" ? { app }         : {}),
        ...(appliedQ.trim()  ? { q: appliedQ.trim() } : {}),
      })
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      if (!silent) toastError("Không thể tải logs")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, range, level, app, appliedQ, toastError])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => fetchLogs(true), 10_000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  const handleClear = async () => {
    if (!confirmClear) { setConfirmClear(true); return }
    setClearing(true)
    try {
      const p = new URLSearchParams()
      if (level !== "all") p.set("level", level)
      if (app   !== "all") p.set("app",   app)
      const qs = p.toString() ? `?${p.toString()}` : ""
      const res = await fetch(`/api/admin/logs${qs}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      const { deleted } = await res.json() as { deleted: number }
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

  const handleLevelFilter = (lv: Level | "all") => { setLevel(lv); setPage(1) }
  const handleAppChange   = (v: string)          => { setApp(v as AppOrigin | "all"); setPage(1) }
  const handleRangeChange = (v: string)          => { setRange(v); setPage(1) }
  const handleSearch      = (v: string)          => setQ(v)
  const submitSearch      = ()                   => { setAppliedQ(q); setPage(1) }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <AdminPageShell
        title="System Logs"
        subtitle="Lịch sử error, warning, info và debug của hệ thống"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh((v) => !v)}
              title={autoRefresh ? "Tắt tự động làm mới" : "Bật tự động làm mới (10s)"}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[12px] border transition-colors ${
                autoRefresh
                  ? "bg-[#1a1c1b] text-white border-[#1a1c1b]"
                  : "border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] bg-white"
              }`}
            >
              <RefreshCw className={`size-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Auto" : "Manual"}
            </button>
            <Button variant="ghost" icon={RefreshCw} onClick={() => fetchLogs()} aria-label="Làm mới" />
          </div>
        }
      />

      {/* Level stat chips — doubles as level filter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["error", "warn", "info", "debug"] as Level[]).map((lv) => {
          const { bg, text, border, dot, Icon } = LEVEL_CONFIG[lv]
          const count = data?.levelCounts[lv] ?? 0
          return (
            <button
              key={lv}
              onClick={() => handleLevelFilter(level === lv ? "all" : lv)}
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
      <AdminFilterBar
        search={{ value: q, onChange: handleSearch, onSearch: submitSearch, placeholder: "Tìm trong message..." }}
        filters={
          <>
            <FilterSelect
              label="App"
              value={app}
              onChange={handleAppChange}
              options={APP_OPTIONS}
            />
            <FilterSelect
              label="Khoảng thời gian"
              value={range}
              onChange={handleRangeChange}
              options={RANGE_OPTIONS}
            />
          </>
        }
        actions={
          <button
            onClick={handleClear}
            disabled={clearing}
            onBlur={() => setTimeout(() => setConfirmClear(false), 200)}
            className={`flex items-center gap-2 px-3 py-2 font-mono text-[12px] border transition-colors disabled:opacity-50 ${
              confirmClear
                ? "bg-[#ba1a1a] text-white border-[#ba1a1a]"
                : "border-[#e5e1d8] text-[#5c403a] hover:border-[#ba1a1a] hover:text-[#ba1a1a] bg-white"
            }`}
          >
            <Trash2 className="size-3.5" />
            {confirmClear
              ? "Xác nhận xóa?"
              : level !== "all" || app !== "all"
                ? "Xóa bộ lọc hiện tại"
                : "Xóa tất cả"}
          </button>
        }
      />

      {/* Data table */}
      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && (!data || data.logs.length === 0)}
        emptyIcon={Bug}
        emptyTitle="Không có log nào"
        emptyDescription="Dùng logger.info() trong server code để ghi log"
      >
        {data?.logs.map((log) => <LogRow key={log.id} log={log} />)}
      </DataTable>

      {/* Pagination */}
      <DataTablePagination
        page={page}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        label="log"
      />
    </div>
  )
}
