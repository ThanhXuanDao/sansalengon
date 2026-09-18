"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Play, RefreshCw, ChevronDown, ChevronRight, Settings2, ToggleLeft, ToggleRight,
  Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Minus,
  Ticket, Cpu, Wand2, Search, TrendingDown, MessageCircle, Settings, CalendarClock,
  Tag, GitMerge,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { getCsrfToken } from "@/lib/utils"
import type { ConfigField } from "@/lib/jobs/types"
import { CRON_PRESETS, getNextRunDate, formatNextRun } from "@/lib/jobs/cron-utils"

// ── Types ──────────────────────────────────────────────────────────────────────

interface SyncJob {
  id: string
  key: string
  name: string
  description: string
  config: Record<string, unknown>
  configFields: ConfigField[]
  category: string
  icon: string
  isEnabled: boolean
  scheduleEnabled: boolean
  scheduleCron: string | null
  scheduleNextRunAt: string | null
  lastRunAt: string | null
  lastStatus: string | null
  lastRun: SyncJobRun | null
}

interface SyncJobRun {
  id: string
  jobId: string
  triggerType: string
  triggeredBy: string | null
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  itemsTotal: number | null
  itemsSuccess: number | null
  itemsFailed: number | null
  source: string | null
  niche: string | null
  summary: string | null
  errors: { item?: string; reason: string }[]
  meta: Record<string, unknown>
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Ticket, Cpu, Wand2, Search, TrendingDown, MessageCircle, Settings, RefreshCw, Tag, GitMerge,
}

const CATEGORY_LABELS: Record<string, string> = {
  sync: "Đồng bộ",
  maintenance: "Bảo trì",
  ai: "AI",
  content: "Nội dung",
  broadcast: "Broadcast",
  analytics: "Phân tích",
}

const CATEGORY_ORDER = ["sync", "maintenance", "ai", "content", "analytics", "broadcast"]

const CATEGORY_COLORS: Record<string, string> = {
  sync: "bg-[#e8f5fb] text-[#1a4a7c]",
  maintenance: "bg-[#e8e8e5] text-[#5c403a]",
  ai: "bg-[#fdf0f8] text-[#6b2d8c]",
  content: "bg-[#edf7ed] text-[#2d6a2d]",
  broadcast: "bg-[#fdf5e0] text-[#7c5a00]",
  analytics: "bg-[#e8f0fb] text-[#1a4a8c]",
}

function statusIcon(status: string | null) {
  if (!status) return <Minus className="size-3.5 text-[#9a9a96]" />
  if (status === "success") return <CheckCircle2 className="size-3.5 text-[#2a7a2a]" />
  if (status === "failed") return <XCircle className="size-3.5 text-[#b51c00]" />
  if (status === "partial") return <AlertCircle className="size-3.5 text-[#b56b00]" />
  if (status === "running") return <Loader2 className="size-3.5 text-[#1a4a8c] animate-spin" />
  return <Minus className="size-3.5 text-[#9a9a96]" />
}

function statusBadge(status: string | null) {
  const base = "inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 tracking-[0.05em]"
  if (!status) return <span className={`${base} bg-[#e8e8e5] text-[#9a9a96]`}>Chưa chạy</span>
  if (status === "success") return <span className={`${base} bg-[#d4edda] text-[#1a5c1a]`}><CheckCircle2 className="size-2.5" />OK</span>
  if (status === "failed") return <span className={`${base} bg-[#fde8e8] text-[#b51c00]`}><XCircle className="size-2.5" />Lỗi</span>
  if (status === "partial") return <span className={`${base} bg-[#fef3cd] text-[#7c5a00]`}><AlertCircle className="size-2.5" />Partial</span>
  if (status === "running") return <span className={`${base} bg-[#e8f0fb] text-[#1a4a8c]`}><Loader2 className="size-2.5 animate-spin" />Chạy...</span>
  return <span className={`${base} bg-[#e8e8e5] text-[#9a9a96]`}>{status}</span>
}

function triggerBadge(type: string) {
  if (type === "auto") return <span className="font-mono text-[10px] bg-[#e8f0fb] text-[#1a4a8c] px-1.5 py-0.5">Auto</span>
  return <span className="font-mono text-[10px] bg-[#e8e8e5] text-[#5c403a] px-1.5 py-0.5">Manual</span>
}

function fmtDuration(ms: number | null): string {
  if (!ms) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "vừa xong"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

// ── Config Editor ────────────────────────────────────────────────────────────

function ConfigEditor({
  fields,
  config,
  onChange,
}: {
  fields: ConfigField[]
  config: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}) {
  if (fields.length === 0) {
    return <p className="font-mono text-[12px] text-[#9a9a96] italic">Không có tham số nào cần cấu hình.</p>
  }

  const inputCls = "w-full font-mono text-[13px] text-[#1a1c1b] bg-white border border-[#e5e1d8] px-3 py-2 focus:outline-none focus:border-[#1a1c1b] transition-colors"

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#5c403a] mb-1">
            {f.label}
          </label>
          {f.type === "number" && (
            <input
              type="number"
              className={inputCls}
              value={Number(config[f.key] ?? f.min ?? 0)}
              min={f.min}
              max={f.max}
              onChange={(e) => onChange(f.key, Number(e.target.value))}
            />
          )}
          {f.type === "select" && (
            <select
              className={inputCls}
              value={String(config[f.key] ?? "")}
              onChange={(e) => onChange(f.key, e.target.value)}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {f.type === "text" && (
            <input
              type="text"
              className={inputCls}
              value={String(config[f.key] ?? "")}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          )}
          {f.description && (
            <p className="font-mono text-[11px] text-[#9a9a96] mt-1">{f.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Run History Row ─────────────────────────────────────────────────────────

function RunRow({ run }: { run: SyncJobRun }) {
  const [open, setOpen] = useState(false)
  const hasErrors = run.errors && run.errors.length > 0

  return (
    <>
      <tr
        className={`border-b border-[#f0ede8] transition-colors ${hasErrors ? "cursor-pointer hover:bg-[#fdf5f5]" : "hover:bg-[#fafaf7]"}`}
        onClick={() => hasErrors && setOpen((p) => !p)}
      >
        <td className="px-3 py-2.5">
          <span className="font-mono text-[12px] text-[#1a1c1b]">
            {fmtTime(run.startedAt)}
          </span>
          <span className="block font-mono text-[10px] text-[#9a9a96]">
            {new Date(run.startedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </td>
        <td className="px-3 py-2.5">{triggerBadge(run.triggerType)}</td>
        <td className="px-3 py-2.5">{statusBadge(run.status)}</td>
        <td className="px-3 py-2.5">
          <span className="font-mono text-[12px] text-[#5c403a] tabular-nums">{fmtDuration(run.durationMs)}</span>
        </td>
        <td className="px-3 py-2.5">
          {run.itemsTotal != null ? (
            <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
              <span className="text-[#5c403a]">{run.itemsTotal}</span>
              {run.itemsSuccess != null && (
                <span className="text-[#2a7a2a]">✓{run.itemsSuccess}</span>
              )}
              {run.itemsFailed != null && run.itemsFailed > 0 && (
                <span className="text-[#b51c00]">✗{run.itemsFailed}</span>
              )}
            </div>
          ) : <span className="text-[#9a9a96]">—</span>}
        </td>
        <td className="px-3 py-2.5">
          {(run.niche || run.source) ? (
            <span className="font-mono text-[11px] text-[#5c403a] bg-[#f4f4f1] px-1.5 py-0.5">
              {run.niche ?? run.source}
            </span>
          ) : <span className="text-[#9a9a96]">—</span>}
        </td>
        <td className="px-3 py-2.5 max-w-[280px]">
          <span className="font-mono text-[11px] text-[#5c403a] line-clamp-1">{run.summary ?? "—"}</span>
          {!!(run.meta as Record<string, unknown> | null)?.bySource && Object.keys((run.meta as Record<string, unknown>).bySource as object).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries((run.meta as Record<string, Record<string, { fetched: number; skipped: number }>>).bySource)
                .filter(([, c]) => c.fetched > 0)
                .map(([src, c]) => (
                  <span key={src} className="font-mono text-[9px] bg-[#f0ede8] text-[#5c403a] px-1 py-0.5 tabular-nums">
                    {src}:{c.fetched}
                    {c.skipped > 0 && <span className="text-[#906f69]">(-{c.skipped})</span>}
                  </span>
                ))}
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">
          {hasErrors && (
            open
              ? <ChevronDown className="size-3.5 text-[#b51c00]" />
              : <ChevronRight className="size-3.5 text-[#b51c00]" />
          )}
        </td>
      </tr>
      {open && hasErrors && (
        <tr>
          <td colSpan={8} className="px-3 pb-3 bg-[#fdf5f5]">
            <div className="space-y-1 pt-1">
              {run.errors.map((e, i) => (
                <div key={i} className="font-mono text-[11px] text-[#b51c00] flex gap-2">
                  {e.item && <span className="text-[#5c403a] shrink-0">[{e.item.slice(0, 30)}]</span>}
                  <span>{e.reason}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Schedule Section ─────────────────────────────────────────────────────────

function ScheduleSection({
  jobKey,
  scheduleEnabled,
  scheduleCron,
  scheduleNextRunAt,
  onSaved,
}: {
  jobKey: string
  scheduleEnabled: boolean
  scheduleCron: string | null
  scheduleNextRunAt: string | null
  onSaved: (patch: { scheduleEnabled: boolean; scheduleCron: string | null; scheduleNextRunAt: string | null }) => void
}) {
  const [localEnabled, setLocalEnabled] = useState(scheduleEnabled)
  const [localCron, setLocalCron] = useState(scheduleCron ?? "")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLocalEnabled(scheduleEnabled)
    setLocalCron(scheduleCron ?? "")
    setDirty(false)
  }, [jobKey, scheduleEnabled, scheduleCron])

  const nextRunDate = useMemo(() => {
    if (!localEnabled || !localCron) return null
    return getNextRunDate(localCron)
  }, [localEnabled, localCron])

  const handleToggle = () => {
    setLocalEnabled((p) => !p)
    setDirty(true)
  }

  const handleCronChange = (cron: string) => {
    setLocalCron(cron)
    if (cron) setLocalEnabled(true)
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const csrf = await getCsrfToken()
      const res = await fetch(`/api/admin/jobs/${jobKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          scheduleEnabled: localEnabled,
          scheduleCron: localCron || null,
        }),
      })
      const data = await res.json() as { ok: boolean; job: { scheduleNextRunAt: string | null } }
      if (data.ok) {
        setDirty(false)
        onSaved({
          scheduleEnabled: localEnabled,
          scheduleCron: localCron || null,
          scheduleNextRunAt: data.job.scheduleNextRunAt,
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const inputCls = "w-full font-mono text-[13px] text-[#1a1c1b] bg-white border border-[#e5e1d8] px-3 py-2 focus:outline-none focus:border-[#1a1c1b] transition-colors"
  const selectedPreset = CRON_PRESETS.find((p) => p.cron === localCron)

  return (
    <div className="bg-white border border-[#e5e1d8] clip-bevel-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e1d8]">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-[#5c403a]" />
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-[#5c403a]">Lịch chạy tự động</span>
        </div>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 font-mono text-[11px] text-[#5c403a] hover:text-[#1a1c1b] transition-colors"
        >
          {localEnabled
            ? <ToggleRight className="size-5 text-[#2a7a2a]" />
            : <ToggleLeft className="size-5 text-[#9a9a96]" />}
          {localEnabled ? "Bật" : "Tắt"}
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-[0.06em] text-[#5c403a] mb-1">
            Tần suất
          </label>
          <select
            className={inputCls}
            value={localCron}
            onChange={(e) => handleCronChange(e.target.value)}
          >
            {CRON_PRESETS.map((p) => (
              <option key={p.cron} value={p.cron}>{p.label} — {p.description}</option>
            ))}
          </select>
          {localCron && !selectedPreset && (
            <p className="font-mono text-[11px] text-[#9a9a96] mt-1">Cron tùy chỉnh: <code className="bg-[#f4f4f1] px-1">{localCron}</code></p>
          )}
        </div>

        <div className="flex items-center gap-2 py-2 px-3 bg-[#fafaf7] border border-[#e5e1d8]">
          <Clock className="size-3.5 text-[#9a9a96] shrink-0" />
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#9a9a96]">Lần tiếp theo: </span>
            {localEnabled && localCron ? (
              <span className="font-mono text-[12px] text-[#1a1c1b] font-bold">
                {formatNextRun(nextRunDate)}
              </span>
            ) : !localEnabled ? (
              <span className="font-mono text-[12px] text-[#9a9a96]">Lịch tự động đang tắt</span>
            ) : (
              <span className="font-mono text-[12px] text-[#9a9a96]">Chọn tần suất để bật lịch</span>
            )}
          </div>
        </div>

        {!dirty && scheduleNextRunAt && scheduleEnabled && (
          <p className="font-mono text-[11px] text-[#9a9a96]">
            Đã lưu — lần tới: <span className="text-[#1a1c1b]">{formatNextRun(new Date(scheduleNextRunAt))}</span>
          </p>
        )}

        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="font-mono text-[12px] uppercase tracking-[0.05em] text-[#1a1c1b] border border-[#1a1c1b] px-3 py-1.5 hover:bg-[#1a1c1b] hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            {saving ? "Đang lưu..." : "Lưu lịch chạy"}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Job Detail Panel ────────────────────────────────────────────────────────

function JobDetail({
  job,
  nicheOptions,
  onToggle,
  onRunComplete,
  onScheduleSaved,
}: {
  job: SyncJob
  nicheOptions: { value: string; label: string }[]
  onToggle: (key: string, enabled: boolean) => void
  onRunComplete: () => void
  onScheduleSaved: (key: string, patch: { scheduleEnabled: boolean; scheduleCron: string | null; scheduleNextRunAt: string | null }) => void
}) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(job.config)
  const [configDirty, setConfigDirty] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [running, setRunning] = useState(false)
  const [lastRunResult, setLastRunResult] = useState<null | { status: string; summary: string | undefined; durationMs: number }>(null)
  const [runs, setRuns] = useState<SyncJobRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsPage, setRunsPage] = useState(1)
  const [runsTotalPages, setRunsTotalPages] = useState(1)
  const [runsNicheFilter, setRunsNicheFilter] = useState("all")

  const loadRuns = useCallback(async (page = 1, nicheFilter = "all") => {
    setRunsLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page) })
      if (nicheFilter && nicheFilter !== "all") qs.set("niche", nicheFilter)
      const res = await fetch(`/api/admin/jobs/${job.key}?${qs}`)
      const data = await res.json() as { runs: SyncJobRun[]; pagination: { totalPages: number } }
      setRuns(data.runs)
      setRunsTotalPages(data.pagination.totalPages)
      setRunsPage(page)
    } finally {
      setRunsLoading(false)
    }
  }, [job.key])

  useEffect(() => {
    setLocalConfig(job.config)
    setConfigDirty(false)
    setLastRunResult(null)
    setRunsNicheFilter("all")
    loadRuns(1, "all")
  }, [job.key, job.config, loadRuns])

  const handleConfigChange = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }))
    setConfigDirty(true)
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    try {
      const csrf = await getCsrfToken()
      await fetch(`/api/admin/jobs/${job.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ config: localConfig }),
      })
      setConfigDirty(false)
    } finally {
      setSavingConfig(false)
    }
  }

  const runNow = async () => {
    setRunning(true)
    setLastRunResult(null)
    try {
      const csrf = await getCsrfToken()
      const res = await fetch(`/api/admin/jobs/${job.key}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ configOverride: localConfig }),
      })
      const data = await res.json() as {
        status: string; summary?: string; durationMs: number;
        itemsSuccess?: number; itemsFailed?: number; error?: string
      }
      if (!res.ok) {
        setLastRunResult({ status: "failed", summary: data.error ?? "Lỗi không xác định", durationMs: 0 })
      } else {
        setLastRunResult({ status: data.status, summary: data.summary, durationMs: data.durationMs })
      }
      onRunComplete()
      await loadRuns(1, runsNicheFilter)
    } catch (err) {
      setLastRunResult({ status: "failed", summary: err instanceof Error ? err.message : "Network error", durationMs: 0 })
    } finally {
      setRunning(false)
    }
  }

  const IconComp = ICON_MAP[job.icon] ?? Settings

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="size-10 bg-[#1a1c1b] flex items-center justify-center shrink-0">
            <IconComp className="size-5 text-[#fdc73a]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-sans text-[18px] font-bold text-[#1a1c1b]">{job.name}</h2>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 uppercase tracking-[0.05em] ${CATEGORY_COLORS[job.category] ?? "bg-[#e8e8e5] text-[#5c403a]"}`}>
                {CATEGORY_LABELS[job.category] ?? job.category}
              </span>
              {!job.isEnabled && (
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e8e8e5] text-[#9a9a96]">Disabled</span>
              )}
            </div>
            <p className="font-mono text-[12px] text-[#5c403a] mt-1 leading-relaxed">{job.description}</p>
          </div>
        </div>
        <button
          onClick={() => onToggle(job.key, !job.isEnabled)}
          className="shrink-0 flex items-center gap-1.5 font-mono text-[11px] text-[#5c403a] hover:text-[#1a1c1b] transition-colors"
          title={job.isEnabled ? "Disable job" : "Enable job"}
        >
          {job.isEnabled
            ? <ToggleRight className="size-5 text-[#2a7a2a]" />
            : <ToggleLeft className="size-5 text-[#9a9a96]" />}
          {job.isEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* Config + Run */}
      <div className="bg-white border border-[#e5e1d8] clip-bevel-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#e5e1d8]">
          <Settings2 className="size-4 text-[#5c403a]" />
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-[#5c403a]">Cấu hình tham số</span>
        </div>
        <div className="p-4">
          <ConfigEditor
            fields={job.configFields}
            config={localConfig}
            onChange={handleConfigChange}
          />
          {configDirty && (
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="mt-3 font-mono text-[12px] uppercase tracking-[0.05em] text-[#1a1c1b] border border-[#1a1c1b] px-3 py-1.5 hover:bg-[#1a1c1b] hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {savingConfig && <Loader2 className="size-3 animate-spin" />}
              {savingConfig ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          )}
        </div>
      </div>

      {/* Schedule */}
      <ScheduleSection
        jobKey={job.key}
        scheduleEnabled={job.scheduleEnabled}
        scheduleCron={job.scheduleCron}
        scheduleNextRunAt={job.scheduleNextRunAt}
        onSaved={(patch) => onScheduleSaved(job.key, patch)}
      />

      {/* Run button + last result */}
      <div className="flex items-start gap-4 flex-wrap">
        <button
          onClick={runNow}
          disabled={running || !job.isEnabled}
          className="flex items-center gap-2 bg-[#1a1c1b] text-white font-mono text-[13px] font-bold uppercase tracking-[0.05em] px-5 py-2.5 hover:bg-[#b51c00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed clip-bevel-xs"
        >
          {running
            ? <Loader2 className="size-4 animate-spin" />
            : <Play className="size-4" />}
          {running ? "Đang chạy..." : "Chạy ngay"}
        </button>

        {lastRunResult && (
          <div className={`flex-1 min-w-0 border px-4 py-2.5 clip-bevel-xs ${
            lastRunResult.status === "success" ? "border-[#2a7a2a] bg-[#f0faf0]" :
            lastRunResult.status === "partial" ? "border-[#b56b00] bg-[#fef9ed]" :
            "border-[#b51c00] bg-[#fdf0f0]"
          }`}>
            <div className="flex items-center gap-2">
              {statusIcon(lastRunResult.status)}
              <span className="font-mono text-[12px] font-bold text-[#1a1c1b]">
                {lastRunResult.status === "success" ? "Thành công" : lastRunResult.status === "partial" ? "Hoàn thành một phần" : "Thất bại"}
              </span>
              <span className="font-mono text-[11px] text-[#9a9a96]">{fmtDuration(lastRunResult.durationMs)}</span>
            </div>
            {lastRunResult.summary && (
              <p className="font-mono text-[11px] text-[#5c403a] mt-1">{lastRunResult.summary}</p>
            )}
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-[#5c403a]">
            Lịch sử chạy
          </h3>
          <div className="flex items-center gap-2">
            {nicheOptions.length > 1 && (
              <select
                className="font-mono text-[11px] text-[#1a1c1b] bg-white border border-[#e5e1d8] px-2 py-1 focus:outline-none focus:border-[#1a1c1b] transition-colors"
                value={runsNicheFilter}
                onChange={(e) => {
                  const val = e.target.value
                  setRunsNicheFilter(val)
                  loadRuns(1, val)
                }}
              >
                {nicheOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => loadRuns(runsPage, runsNicheFilter)}
              disabled={runsLoading}
              className="flex items-center gap-1 font-mono text-[11px] text-[#5c403a] hover:text-[#1a1c1b] transition-colors"
            >
              <RefreshCw className={`size-3 ${runsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {runsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-[#9a9a96]" />
          </div>
        ) : runs.length === 0 ? (
          <div className="border border-dashed border-[#e5e1d8] py-10 text-center">
            <Clock className="size-8 mx-auto text-[#e5e1d8] mb-2" />
            <p className="font-mono text-[12px] text-[#9a9a96]">Chưa có lịch sử chạy nào.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border border-[#e5e1d8]">
              <thead>
                <tr className="bg-[#fafaf7] border-b border-[#e5e1d8]">
                  {["Thời gian", "Trigger", "Trạng thái", "Thời lượng", "Items", "Niche/Nguồn", "Tóm tắt", ""].map((h) => (
                    <th key={h} className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-[#9a9a96] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => <RunRow key={run.id} run={run} />)}
              </tbody>
            </table>

            {runsTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="font-mono text-[11px] text-[#9a9a96]">Trang {runsPage}/{runsTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => loadRuns(runsPage - 1, runsNicheFilter)}
                    disabled={runsPage <= 1}
                    className="font-mono text-[11px] px-2 py-1 border border-[#e5e1d8] hover:border-[#1a1c1b] disabled:opacity-30 transition-colors"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => loadRuns(runsPage + 1, runsNicheFilter)}
                    disabled={runsPage >= runsTotalPages}
                    className="font-mono text-[11px] px-2 py-1 border border-[#e5e1d8] hover:border-[#1a1c1b] disabled:opacity-30 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function SyncJobsPage() {
  const [jobs, setJobs] = useState<SyncJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [nicheOptions, setNicheOptions] = useState<{ value: string; label: string }[]>([
    { value: "all", label: "Tất cả ngách" },
  ])

  useEffect(() => {
    fetch("/api/admin/niches/manage").then(async (r) => {
      if (!r.ok) return
      const j = await r.json()
      const opts = [
        { value: "all", label: "Tất cả ngách" },
        ...(j.data ?? []).map((n: { id: string; name: string; emoji: string }) => ({
          value: n.id,
          label: `${n.emoji} ${n.name}`,
        })),
      ]
      setNicheOptions(opts)
    }).catch(() => {})
  }, [])

  const injectNicheOptions = useCallback((jobList: SyncJob[]): SyncJob[] =>
    jobList.map((j) => ({
      ...j,
      configFields: j.configFields.map((f) =>
        f.key === "niche" ? { ...f, options: nicheOptions } : f
      ),
    })), [nicheOptions])

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/admin/jobs")
    const data = await res.json() as { jobs: SyncJob[] }
    setJobs(injectNicheOptions(data.jobs))
    if (!selectedKey && data.jobs.length > 0) {
      setSelectedKey(data.jobs[0].key)
    }
    setLoading(false)
  }, [selectedKey, injectNicheOptions])

  useEffect(() => { loadJobs() }, [loadJobs])
  useEffect(() => { setJobs((prev) => injectNicheOptions(prev)) }, [nicheOptions, injectNicheOptions])

  const handleToggle = async (key: string, enabled: boolean) => {
    const csrf = await getCsrfToken()
    await fetch(`/api/admin/jobs/${key}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify({ isEnabled: enabled }),
    })
    setJobs((prev) => prev.map((j) => j.key === key ? { ...j, isEnabled: enabled } : j))
  }

  const handleScheduleSaved = (key: string, patch: { scheduleEnabled: boolean; scheduleCron: string | null; scheduleNextRunAt: string | null }) => {
    setJobs((prev) => prev.map((j) => j.key === key ? { ...j, ...patch } : j))
  }

  const selectedJob = jobs.find((j) => j.key === selectedKey) ?? null

  // product_sync moved to admin/sources — hide from pipeline view
  const HIDDEN_KEYS = new Set(["product_sync"])
  const pipelineJobs = jobs.filter((j) => !HIDDEN_KEYS.has(j.key))

  const grouped = pipelineJobs.reduce<Record<string, SyncJob[]>>((acc, job) => {
    const cat = job.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(job)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-0 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Tác vụ xử lý"
        subtitle={`${pipelineJobs.length} tác vụ pipeline — xử lý AI, phân tích, broadcast sau khi dữ liệu đã đồng bộ từ nguồn.`}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[#9a9a96]" />
        </div>
      ) : (
        <div className="flex gap-0 mt-6 min-h-[600px]">
          {/* LEFT: Job list */}
          <aside className="w-[260px] shrink-0 border border-[#e5e1d8] bg-white overflow-y-auto">
            {Object.entries(grouped).sort(([a], [b]) => (CATEGORY_ORDER.indexOf(a) ?? 99) - (CATEGORY_ORDER.indexOf(b) ?? 99)).map(([cat, catJobs]) => (
              <div key={cat}>
                <div className="px-3 py-2 bg-[#fafaf7] border-b border-[#e5e1d8]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9a9a96]">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </span>
                </div>
                {catJobs.map((job) => {
                  const Icon = ICON_MAP[job.icon] ?? Settings
                  const isSelected = job.key === selectedKey
                  return (
                    <button
                      key={job.key}
                      onClick={() => setSelectedKey(job.key)}
                      className={`w-full text-left px-3 py-3 border-b border-[#e5e1d8] transition-colors flex items-start gap-2.5 ${
                        isSelected ? "bg-[#1a1c1b] text-white" : "hover:bg-[#fafaf7] text-[#1a1c1b]"
                      }`}
                    >
                      <div className={`size-7 flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? "bg-white/10" : "bg-[#f0ede8]"}`}>
                        <Icon className={`size-3.5 ${isSelected ? "text-[#fdc73a]" : "text-[#5c403a]"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-sans text-[13px] font-bold truncate ${isSelected ? "text-white" : "text-[#1a1c1b]"}`}>
                            {job.name}
                          </span>
                          {statusIcon(job.lastStatus)}
                        </div>
                        <span className={`font-mono text-[10px] ${isSelected ? "text-white/60" : "text-[#9a9a96]"}`}>
                          {job.lastRunAt ? fmtTime(job.lastRunAt) : "Chưa chạy"}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {job.scheduleEnabled && job.scheduleCron && (
                            <span className={`flex items-center gap-0.5 font-mono text-[9px] ${isSelected ? "text-[#fdc73a]/80" : "text-[#2a7a2a]"}`}>
                              <CalendarClock className="size-2.5" />
                              {formatNextRun(getNextRunDate(job.scheduleCron))}
                            </span>
                          )}
                          {!job.isEnabled && (
                            <span className={`font-mono text-[9px] uppercase ${isSelected ? "text-white/40" : "text-[#9a9a96]"}`}>
                              disabled
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </aside>

          {/* RIGHT: Job detail */}
          <main className="flex-1 min-w-0 border border-l-0 border-[#e5e1d8] bg-[#fafaf7] p-6 overflow-y-auto">
            {selectedJob ? (
              <JobDetail
                key={selectedJob.key}
                job={selectedJob}
                nicheOptions={nicheOptions}
                onToggle={handleToggle}
                onRunComplete={loadJobs}
                onScheduleSaved={handleScheduleSaved}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="font-mono text-[13px] text-[#9a9a96]">Chọn một job để xem chi tiết.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
