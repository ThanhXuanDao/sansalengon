"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Pencil, Trash2, Loader2, X, Globe, ToggleLeft, ToggleRight,
  Play, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronRight,
  CalendarClock, History,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { getSyncSourceLabel } from "@/lib/sync-source-utils"
import {
  AdminFilterBar, FilterSelect,
  DataTable, DataTablePagination,
  Button, useToast,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"
import { ensureCsrfToken, getCsrfToken } from "@/lib/utils"
import { CRON_PRESETS, getNextRunDate } from "@/lib/jobs/cron-utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncSource {
  id: string
  name: string
  slug: string
  baseUrl: string
  enabled: boolean
  config: string
  description: string | null
  icon: string | null
  scheduleCron: string | null
  scheduleEnabled: boolean
  scheduleNextRunAt: string | null
  lastRunAt: string | null
  lastRunStatus: string | null
  createdAt: string
  updatedAt: string
}

interface RunRecord {
  id: string
  status: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  itemsTotal: number | null
  itemsSuccess: number | null
  itemsFailed: number | null
  summary: string | null
}

type FormData = {
  name: string
  slug: string
  baseUrl: string
  enabled: boolean
  config: string
  description: string | null
  icon: string | null
}

const EMPTY_FORM: FormData = {
  name: "", slug: "", baseUrl: "", enabled: true,
  config: JSON.stringify({ type: "product-scraper", strategy: "nextjs-data", delayMs: 2000, categories: [] }, null, 2),
  description: "",
  icon: null,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceType(config: string): "PRODUCT" | "PLATFORM" | "COUPON" {
  return getSyncSourceLabel(config)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "vừa xong"
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  return `${Math.floor(h / 24)} ngày trước`
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="font-mono text-[11px] text-[#906f69]">Chưa chạy</span>
  if (status === "running") return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-[#1a4a7c]">
      <Loader2 className="size-3 animate-spin" /> Đang chạy...
    </span>
  )
  if (status === "success") return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-[#1a6b3c]">
      <CheckCircle2 className="size-3" /> Thành công
    </span>
  )
  if (status === "partial") return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-[#7c5a00]">
      <AlertCircle className="size-3" /> Một phần
    </span>
  )
  return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-[#ba1a1a]">
      <XCircle className="size-3" /> Lỗi
    </span>
  )
}

// ── Tiki category ID editor ────────────────────────────────────────────────────

function TikiCategoryIds({ value, onChange }: { value: Record<string, number[]>; onChange: (v: Record<string, number[]>) => void }) {
  const [newSlug, setNewSlug] = useState("")
  const [newIds, setNewIds] = useState("")

  function addRow() {
    const slug = newSlug.trim()
    const ids = newIds.split(",").map((s) => Number(s.trim())).filter((n) => n > 0)
    if (!slug || ids.length === 0) return
    onChange({ ...value, [slug]: ids })
    setNewSlug(""); setNewIds("")
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Category IDs theo ngách</label>
        <span className="font-mono text-[10px] text-[#906f69]">slug ngách → ID Tiki</span>
      </div>
      <div className="border border-[#e5e1d8] divide-y divide-[#e5e1d8]">
        {Object.entries(value).map(([slug, ids]) => (
          <div key={slug} className="flex items-center gap-2 px-3 py-2">
            <span className="font-mono text-[12px] font-bold text-[#1a1c1b] w-28 shrink-0">{slug}</span>
            <input
              value={ids.join(", ")}
              onChange={(e) => {
                const newIds2 = e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => n > 0)
                onChange({ ...value, [slug]: newIds2 })
              }}
              className="flex-1 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]"
            />
            <button type="button" onClick={() => { const n = { ...value }; delete n[slug]; onChange(n) }} className="text-[#ba1a1a]"><X className="size-3.5" /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#f9f9f6]">
          <input value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow() } }} placeholder="fashion" className="w-28 shrink-0 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]" />
          <input value={newIds} onChange={(e) => setNewIds(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow() } }} placeholder="931, 1703" className="flex-1 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]" />
          <button type="button" onClick={addRow} className="px-2 py-1 bg-[#1a1c1b] text-white font-mono text-[11px] hover:bg-[#b51c00] transition-colors">+</button>
        </div>
      </div>
    </div>
  )
}

// ── Config edit modal ──────────────────────────────────────────────────────────

function SourceFormModal({
  initial, isEdit, onClose, onSave,
}: {
  initial: FormData & { id?: string }
  isEdit: boolean
  onClose: () => void
  onSave: (data: FormData & { id?: string }) => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const isTiki = form.slug === "tiki"
  const parsedConfig = (() => { try { return JSON.parse(form.config) } catch { return {} } })()

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((p) => ({ ...p, [k]: v }))
    if (k === "config") setConfigError(null)
  }

  function validateConfig(): boolean {
    try { JSON.parse(form.config); setConfigError(null); return true }
    catch (e) { setConfigError(`JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`); return false }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validateConfig()) return
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-[#e5beb6] shadow-[4px_4px_0px_0px_rgba(26,28,27,1)] w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-dashed border-[#e5beb6] shrink-0">
          <h2 className="font-mono text-[13px] font-bold tracking-[0.05em] uppercase text-[#1a1c1b]">
            {isEdit ? "Sửa cấu hình nguồn" : "Thêm nguồn mới"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f4f4f1]"><X className="size-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Tên hiển thị *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Tên nguồn" className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Slug (ID) *</label>
              <input required disabled={isEdit} value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))} placeholder="ten-nguon" className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] disabled:bg-[#f4f4f1] disabled:text-[#5c403a]" />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Base URL *</label>
            <input required type="url" value={form.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} placeholder="https://example.com" className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
          </div>
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Mô tả</label>
            <input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Mô tả ngắn về nguồn" className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
          </div>
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Logo URL</label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={form.icon ?? ""}
                onChange={(e) => set("icon", e.target.value || null)}
                placeholder="https://cdn.example.com/logo.png"
                className="flex-1 border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
              {form.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.icon} alt="preview" className="size-8 object-contain border border-[#e5beb6] rounded bg-[#f9f9f6]" />
              )}
            </div>
            <p className="mt-1 font-mono text-[10px] text-[#906f69]">Logo thương hiệu — hiển thị trên bộ lọc nguồn ở trang public</p>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-dashed border-[#e5beb6]">
            <div>
              <p className="font-sans text-[13px] font-medium text-[#1a1c1b]">Kích hoạt nguồn</p>
              <p className="font-mono text-[11px] text-[#5c403a] mt-0.5">Bật để cho phép đồng bộ</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={() => set("enabled", !form.enabled)} className="sr-only peer" />
              <div className="w-11 h-6 bg-[#e2e3e0] rounded-full peer peer-focus:ring-2 peer-focus:ring-[#b51c00] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b51c00]" />
            </label>
          </div>
          {isTiki && (
            <div className="border-t border-dashed border-[#e5e1d8] pt-4">
              <TikiCategoryIds
                value={(parsedConfig.categoryIds as Record<string, number[]>) ?? {}}
                onChange={(categoryIds) => {
                  try { set("config", JSON.stringify({ ...parsedConfig, categoryIds }, null, 2)) } catch {}
                }}
              />
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Config JSON</label>
              <button type="button" onClick={validateConfig} className="font-mono text-[10px] text-[#906f69] hover:text-[#b51c00]">Validate JSON</button>
            </div>
            <textarea rows={isTiki ? 6 : 10} value={form.config} onChange={(e) => set("config", e.target.value)} spellCheck={false} className={`w-full border rounded px-2 py-1.5 font-mono text-[11px] focus:outline-none resize-y ${configError ? "border-[#ba1a1a] bg-[#fff8f8]" : "border-[#e5beb6] focus:border-[#b51c00]"}`} />
            {configError && <p className="mt-1 font-mono text-[11px] text-[#ba1a1a]">{configError}</p>}
          </div>
        </form>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-dashed border-[#e5beb6] shrink-0">
          <button onClick={onClose} className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1]">Huỷ</button>
          <button type="button" onClick={() => handleSubmit()} disabled={saving || !form.name || !form.slug || !form.baseUrl} className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1c1b] text-[#f9f9f6] font-mono text-[12px] rounded hover:bg-[#b51c00] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving && <Loader2 className="size-3 animate-spin" />}
            {isEdit ? "Lưu thay đổi" : "Tạo nguồn"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete modal ───────────────────────────────────────────────────────────────

function DeleteModal({ source, onClose, onConfirm }: { source: SyncSource; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-[#ffb4ab] shadow-[4px_4px_0px_0px_rgba(186,26,26,1)] w-full max-w-sm mx-4 p-5">
        <h2 className="font-mono text-[13px] font-bold text-[#ba1a1a] uppercase tracking-[0.05em] mb-2">Xoá nguồn?</h2>
        <p className="font-sans text-[13px] text-[#1a1c1b] mb-4">Bạn sắp xoá nguồn <strong>{source.name}</strong>. Hành động này không thể hoàn tác.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1]">Huỷ</button>
          <button onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }} disabled={deleting} className="flex items-center gap-1.5 px-4 py-2 bg-[#ba1a1a] text-white font-mono text-[12px] rounded hover:bg-[#9b1515] disabled:opacity-50">
            {deleting && <Loader2 className="size-3 animate-spin" />} Xoá
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Schedule panel ─────────────────────────────────────────────────────────────

function SchedulePanel({ source, onSaved }: { source: SyncSource; onSaved: (updated: Partial<SyncSource>) => void }) {
  const [cron, setCron] = useState(source.scheduleCron ?? "")
  const [enabled, setEnabled] = useState(source.scheduleEnabled)
  const [saving, setSaving] = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()

  const nextRun = cron.trim()
    ? (() => { try { const d = getNextRunDate(cron); return d ? d.toLocaleString("vi-VN") : null } catch { return null } })()
    : null

  async function save() {
    setSaving(true)
    await ensureCsrfToken()
    try {
      const res = await fetch(`/api/admin/sync-sources/${source.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ scheduleCron: cron || null, scheduleEnabled: enabled }),
      })
      if (!res.ok) throw new Error("Lỗi lưu lịch")
      toastSuccess("Đã lưu lịch chạy")
      onSaved({ scheduleCron: cron || null, scheduleEnabled: enabled })
    } catch { toastError("Lỗi lưu lịch chạy") }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase shrink-0">Preset</label>
        <select value={cron} onChange={(e) => setCron(e.target.value)} className="border border-[#e5beb6] rounded px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00] bg-white">
          <option value="">-- Chọn preset --</option>
          {CRON_PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label}</option>)}
        </select>
        <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="*/30 * * * *" className="flex-1 border border-[#e5beb6] rounded px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]" />
      </div>
      {nextRun && (
        <p className="font-mono text-[11px] text-[#5c403a]">Lần tới: <span className="text-[#1a1c1b] font-bold">{nextRun}</span></p>
      )}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <div onClick={() => setEnabled(!enabled)} className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${enabled ? "bg-[#b51c00]" : "bg-[#e2e3e0]"}`}>
            <div className={`absolute top-[2px] left-[2px] size-4 bg-white rounded-full transition-transform ${enabled ? "translate-x-5" : ""}`} />
          </div>
          <span className="font-mono text-[12px] text-[#1a1c1b]">{enabled ? "Bật tự động" : "Tắt tự động"}</span>
        </label>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1c1b] text-[#f9f9f6] font-mono text-[11px] rounded hover:bg-[#b51c00] transition-colors disabled:opacity-50">
          {saving && <Loader2 className="size-3 animate-spin" />}
          Lưu lịch
        </button>
      </div>
    </div>
  )
}

// ── History panel ──────────────────────────────────────────────────────────────

function HistoryPanel({ sourceId }: { sourceId: string }) {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/sync-sources/${sourceId}/runs`)
      .then((r) => r.json())
      .then((d) => setRuns((d as { runs: RunRecord[] }).runs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sourceId])

  if (loading) return (
    <div className="flex items-center gap-2">
      <Loader2 className="size-3.5 animate-spin text-[#b51c00]" />
      <span className="font-mono text-[11px] text-[#5c403a]">Đang tải lịch sử...</span>
    </div>
  )
  if (runs.length === 0) return <p className="font-mono text-[11px] text-[#906f69]">Chưa có lịch sử chạy</p>

  return (
    <table className="w-full text-left">
      <thead>
        <tr className="border-b border-dashed border-[#e5e1d8]">
          {["Trạng thái", "Thời gian", "Sp thành công", "Thời lượng", "Tóm tắt"].map((h) => (
            <th key={h} className="px-3 py-2 font-mono text-[10px] tracking-[0.05em] text-[#5c403a] uppercase">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id} className="border-b border-dashed border-[#e5e1d8] last:border-0">
            <td className="px-3 py-2"><StatusBadge status={run.status} /></td>
            <td className="px-3 py-2 font-mono text-[11px] text-[#1a1c1b]">{timeAgo(run.startedAt)}</td>
            <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-[#1a1c1b]">
              {run.itemsSuccess ?? 0}{run.itemsTotal ? `/${run.itemsTotal}` : ""}
            </td>
            <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-[#5c403a]">
              {run.durationMs != null ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
            </td>
            <td className="px-3 py-2 font-mono text-[11px] text-[#5c403a] max-w-xs truncate">{run.summary ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Source row ─────────────────────────────────────────────────────────────────

const COLUMNS: TableColumn[] = [
  { key: "name",     label: "Nguồn"       },
  { key: "type",     label: "Loại",    width: "90px",  align: "center" },
  { key: "status",   label: "Trạng thái", width: "100px" },
  { key: "lastrun",  label: "Lần chạy cuối", width: "150px" },
  { key: "schedule", label: "Lịch",     width: "130px" },
  { key: "actions",  label: "",         width: "120px", align: "right" },
]

function SourceRow({
  source,
  onEdit,
  onDelete,
  onToggleEnabled,
  onRunDone,
}: {
  source: SyncSource
  onEdit: () => void
  onDelete: () => void
  onToggleEnabled: () => void
  onRunDone: (updated: Partial<SyncSource>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [panel, setPanel] = useState<"schedule" | "history">("schedule")
  const [running, setRunning] = useState(false)
  const [runSummary, setRunSummary] = useState<string | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()

  const type = sourceType(source.config)
  const cfg = (() => { try { return JSON.parse(source.config) } catch { return {} } })()
  const categoryCount = Object.keys(cfg.categoryIds ?? {}).length
  const scraperCategories = Array.isArray(cfg.categories) ? (cfg.categories as unknown[]).length : 0

  async function handleRun() {
    setRunning(true)
    setRunSummary(null)
    await ensureCsrfToken()
    try {
      const res = await fetch(`/api/admin/sync-sources/${source.id}/run`, {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
      })
      const data = await res.json() as { status?: string; summary?: string; error?: string }
      if (!res.ok) {
        toastError(data.error ?? "Lỗi chạy đồng bộ")
        setRunSummary(data.error ?? null)
        onRunDone({ lastRunAt: new Date().toISOString(), lastRunStatus: "failed" })
      } else {
        toastSuccess(`${source.name}: ${data.summary ?? data.status}`)
        setRunSummary(data.summary ?? null)
        onRunDone({ lastRunAt: new Date().toISOString(), lastRunStatus: data.status ?? "success" })
      }
    } catch {
      toastError("Lỗi kết nối")
      onRunDone({ lastRunAt: new Date().toISOString(), lastRunStatus: "failed" })
    } finally {
      setRunning(false)
    }
  }

  function togglePanel(p: "schedule" | "history") {
    if (expanded && panel === p) { setExpanded(false); return }
    setPanel(p)
    setExpanded(true)
  }

  return (
    <>
      <tr className="group border-b border-dashed border-[#e5e1d8] hover:bg-[#fafaf7] transition-colors">
        {/* Nguồn */}
        <td className="py-3 px-4 align-middle">
          <div className="flex items-start gap-2.5">
            {source.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={source.icon} alt={source.name} className="size-5 mt-0.5 shrink-0 object-contain" />
            ) : (
              <Globe className={`size-4 mt-0.5 shrink-0 ${source.enabled ? "text-[#1a6b3c]" : "text-[#906f69]"}`} />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-sans text-[13px] font-semibold text-[#1a1c1b]">{source.name}</span>
                <span className="font-mono text-[10px] text-[#5c403a] bg-[#f4f4f1] px-1.5 py-0.5">{source.slug}</span>
              </div>
              <p className="font-mono text-[11px] text-[#906f69] mt-0.5 truncate max-w-[260px]">{source.baseUrl}</p>
              {runSummary && <p className="font-mono text-[10px] text-[#5c403a] mt-0.5 truncate max-w-[260px]">{runSummary}</p>}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {type === "PLATFORM" && source.slug === "tiki" && categoryCount > 0 && (
                  <span className="font-mono text-[10px] text-[#0d5cb6]">{categoryCount} category IDs</span>
                )}
                {type === "PRODUCT" && scraperCategories > 0 && (
                  <span className="font-mono text-[10px] text-[#7c5a00]">{scraperCategories} danh mục</span>
                )}
              </div>
            </div>
          </div>
        </td>
        {/* Loại */}
        <td className="py-3 px-4 align-middle text-center">
          <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${
            type === "PRODUCT"  ? "bg-[#fdf5e0] border-[#f0d080] text-[#7c5a00]" :
            type === "PLATFORM" ? "bg-[#e8f5fb] border-[#b0d8f0] text-[#1a4a7c]" :
                                  "bg-[#fde8f0] border-[#f0b0cc] text-[#7c1a40]"
          }`}>
            {type}
          </span>
        </td>
        {/* Trạng thái */}
        <td className="py-3 px-4 align-middle">
          <button
            onClick={onToggleEnabled}
            className={`flex items-center gap-1 font-mono text-[11px] px-2 py-1 border rounded transition-colors ${source.enabled ? "bg-[#d4f4e0] border-[#a3d9b8] text-[#1a6b3c]" : "bg-[#f4f4f1] border-[#e5e1d8] text-[#5c403a]"}`}
          >
            {source.enabled ? <><ToggleRight className="size-3.5" /> Bật</> : <><ToggleLeft className="size-3.5" /> Tắt</>}
          </button>
        </td>
        {/* Lần chạy cuối */}
        <td className="py-3 px-4 align-middle">
          <StatusBadge status={running ? "running" : (source.lastRunStatus ?? null)} />
          {source.lastRunAt && !running && (
            <p className="font-mono text-[10px] text-[#906f69] mt-0.5">{timeAgo(source.lastRunAt)}</p>
          )}
        </td>
        {/* Lịch */}
        <td className="py-3 px-4 align-middle">
          {source.scheduleEnabled && source.scheduleCron ? (
            <span className="flex items-center gap-1 font-mono text-[11px] text-[#5c403a]">
              <Clock className="size-3 shrink-0" />{source.scheduleCron}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-[#c5c0b8]">—</span>
          )}
        </td>
        {/* Thao tác */}
        <td className="py-3 px-4 align-middle">
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={handleRun}
              disabled={running || !source.enabled}
              title="Chạy ngay"
              className="p-1.5 rounded hover:bg-[#d4f4e0] text-[#1a6b3c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            </button>
            <button
              onClick={() => togglePanel("schedule")}
              title="Lịch tự động"
              className={`p-1.5 rounded transition-colors ${expanded && panel === "schedule" ? "bg-[#fdf5e0] text-[#7c5a00]" : "hover:bg-[#f4f4f1] text-[#5c403a]"}`}
            >
              <CalendarClock className="size-3.5" />
            </button>
            <button
              onClick={() => togglePanel("history")}
              title="Lịch sử"
              className={`p-1.5 rounded transition-colors ${expanded && panel === "history" ? "bg-[#e8f5fb] text-[#1a4a7c]" : "hover:bg-[#f4f4f1] text-[#5c403a]"}`}
            >
              <History className="size-3.5" />
            </button>
            <button onClick={onEdit} title="Cấu hình" className="p-1.5 rounded hover:bg-[#ffdf9a] text-[#5c403a] transition-colors">
              <Pencil className="size-3.5" />
            </button>
            <button onClick={onDelete} title="Xoá" className="p-1.5 rounded hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors">
              <Trash2 className="size-3.5" />
            </button>
            <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded hover:bg-[#f4f4f1] text-[#9ca3af] transition-colors">
              {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {expanded && (
        <tr className="border-b border-dashed border-[#e5e1d8] bg-[#fafaf7]">
          <td colSpan={6} className="px-5 py-4">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setPanel("schedule")}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded transition-colors ${panel === "schedule" ? "bg-[#fdf5e0] border-[#f0d080] text-[#7c5a00]" : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"}`}
              >
                <CalendarClock className="size-3" /> Lịch tự động
              </button>
              <button
                onClick={() => setPanel("history")}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded transition-colors ${panel === "history" ? "bg-[#e8f5fb] border-[#b0d8f0] text-[#1a4a7c]" : "border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1]"}`}
              >
                <History className="size-3" /> Lịch sử
              </button>
            </div>
            {panel === "schedule" && (
              <SchedulePanel source={source} onSaved={onRunDone} />
            )}
            {panel === "history" && (
              <HistoryPanel sourceId={source.id} />
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Filter options ─────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "all",      label: "Tất cả loại" },
  { value: "product",  label: "Product"     },
  { value: "platform", label: "Platform"    },
  { value: "coupon",   label: "Coupon"      },
]

const STATUS_OPTIONS = [
  { value: "all",      label: "Tất cả"  },
  { value: "enabled",  label: "Đang bật" },
  { value: "disabled", label: "Đang tắt" },
]

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SyncSourcesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [sources, setSources] = useState<SyncSource[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SyncSource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SyncSource | null>(null)

  // Filters
  const [q, setQ]               = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/sync-sources")
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: SyncSource[] }
      setSources(json.data)
    } catch { toastError("Lỗi tải nguồn đồng bộ") }
    finally { setLoading(false) }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  function patchSource(id: string, patch: Partial<SyncSource>) {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))
  }

  async function handleCreate(data: FormData) {
    await ensureCsrfToken()
    const res = await fetch("/api/admin/sync-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" })) as { error?: string }
      toastError(err.error ?? "Lỗi tạo nguồn"); return
    }
    toastSuccess("Đã tạo nguồn mới")
    setCreateOpen(false)
    await load()
  }

  async function handleEdit(data: FormData & { id?: string }) {
    if (!data.id) return
    await ensureCsrfToken()
    const res = await fetch(`/api/admin/sync-sources/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" })) as { error?: string }
      toastError(err.error ?? "Lỗi cập nhật"); return
    }
    toastSuccess("Đã cập nhật nguồn")
    setEditTarget(null)
    await load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await ensureCsrfToken()
    const res = await fetch(`/api/admin/sync-sources/${deleteTarget.id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": getCsrfToken() },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" })) as { error?: string }
      toastError(err.error ?? "Lỗi xoá nguồn"); return
    }
    toastSuccess(`Đã xoá "${deleteTarget.name}"`)
    setDeleteTarget(null)
    await load()
  }

  async function toggleEnabled(source: SyncSource) {
    await ensureCsrfToken()
    const res = await fetch(`/api/admin/sync-sources/${source.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify({ enabled: !source.enabled }),
    })
    if (res.ok) patchSource(source.id, { enabled: !source.enabled })
    else toastError("Lỗi cập nhật")
  }

  // Client-side filter + paginate
  const filtered = sources.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.slug.includes(q.toLowerCase())) return false
    if (typeFilter !== "all" && sourceType(s.config).toLowerCase() !== typeFilter.toLowerCase()) return false
    if (statusFilter === "enabled"  && !s.enabled) return false
    if (statusFilter === "disabled" &&  s.enabled) return false
    return true
  })

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      <AdminPageShell
        title="Đồng bộ nguồn"
        subtitle="Quản lý nguồn nhập liệu — cấu hình, lịch chạy tự động và lịch sử đồng bộ"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" /> Thêm nguồn
          </Button>
        }
      />

      <AdminFilterBar
        search={{ value: q, onChange: (v) => { setQ(v); setPage(1) }, placeholder: "Tìm theo tên, slug..." }}
        filters={
          <>
            <FilterSelect label="Loại" value={typeFilter} onChange={(v) => { setTypeFilter(v); setPage(1) }} options={TYPE_OPTIONS} />
            <FilterSelect label="Trạng thái" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_OPTIONS} />
          </>
        }
      />

      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={Globe}
        emptyTitle="Không có nguồn nào"
        emptyDescription="Thêm nguồn đầu tiên hoặc thay đổi bộ lọc."
      >
        {paginated.map((source) => (
          <SourceRow
            key={source.id}
            source={source}
            onEdit={() => setEditTarget(source)}
            onDelete={() => setDeleteTarget(source)}
            onToggleEnabled={() => toggleEnabled(source)}
            onRunDone={(updated) => patchSource(source.id, updated)}
          />
        ))}
      </DataTable>

      <DataTablePagination
        page={page}
        total={filtered.length}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        label="nguồn"
      />

      {createOpen && (
        <SourceFormModal initial={{ ...EMPTY_FORM }} isEdit={false} onClose={() => setCreateOpen(false)} onSave={handleCreate} />
      )}
      {editTarget && (
        <SourceFormModal
          initial={{ id: editTarget.id, name: editTarget.name, slug: editTarget.slug, baseUrl: editTarget.baseUrl, enabled: editTarget.enabled, config: editTarget.config, description: editTarget.description, icon: editTarget.icon }}
          isEdit={true}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}
      {deleteTarget && (
        <DeleteModal source={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  )
}
