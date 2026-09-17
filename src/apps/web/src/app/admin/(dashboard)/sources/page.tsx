"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Loader2, X, Globe, ToggleLeft, ToggleRight, Info } from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, useToast } from "@/components/admin/ui"
import { ensureCsrfToken, getCsrfToken } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface SyncSource {
  id: string
  name: string
  slug: string
  baseUrl: string
  enabled: boolean
  config: string
  description: string | null
  createdAt: string
  updatedAt: string
}

type FormData = Omit<SyncSource, "id" | "createdAt" | "updatedAt">

const EMPTY_FORM: FormData = {
  name: "",
  slug: "",
  baseUrl: "",
  enabled: true,
  config: JSON.stringify({
    listUrl: "",
    nameSelector: "",
    priceSelector: "",
    imageSelector: "",
    urlSelector: "",
    pagination: { type: "page_param", param: "page" },
    rateLimit: 10,
    delayMs: 500,
  }, null, 2),
  description: "",
}

// ── Tiki category ID editor ───────────────────────────────────────────────────

function TikiCategoryIds({
  value,
  onChange,
}: {
  value: Record<string, number[]>
  onChange: (v: Record<string, number[]>) => void
}) {
  const [newSlug, setNewSlug] = useState("")
  const [newIds, setNewIds] = useState("")

  function addRow() {
    const slug = newSlug.trim()
    const ids = newIds.split(",").map((s) => Number(s.trim())).filter((n) => n > 0)
    if (!slug || ids.length === 0) return
    onChange({ ...value, [slug]: ids })
    setNewSlug("")
    setNewIds("")
  }

  function removeRow(slug: string) {
    const next = { ...value }
    delete next[slug]
    onChange(next)
  }

  function updateIds(slug: string, raw: string) {
    const ids = raw.split(",").map((s) => Number(s.trim())).filter((n) => n > 0)
    onChange({ ...value, [slug]: ids })
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
          Category IDs theo ngách
        </label>
        <span className="font-mono text-[10px] text-[#906f69]">slug ngách → ID Tiki (phân cách bằng dấu phẩy)</span>
      </div>

      <div className="border border-[#e5e1d8] divide-y divide-[#e5e1d8]">
        {Object.entries(value).map(([slug, ids]) => (
          <div key={slug} className="flex items-center gap-2 px-3 py-2">
            <span className="font-mono text-[12px] font-bold text-[#1a1c1b] w-28 shrink-0">{slug}</span>
            <input
              value={ids.join(", ")}
              onChange={(e) => updateIds(slug, e.target.value)}
              className="flex-1 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]"
              placeholder="1234, 5678"
            />
            <button
              type="button"
              onClick={() => removeRow(slug)}
              className="text-[#ba1a1a] hover:text-[#9b1515] transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}

        {/* Add row */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#f9f9f6]">
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow() } }}
            placeholder="fashion"
            className="w-28 shrink-0 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]"
          />
          <input
            value={newIds}
            onChange={(e) => setNewIds(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow() } }}
            placeholder="931, 1703, 1686"
            className="flex-1 border border-[#e5e1d8] px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-[#b51c00]"
          />
          <button
            type="button"
            onClick={addRow}
            className="px-2 py-1 bg-[#1a1c1b] text-white font-mono text-[11px] hover:bg-[#b51c00] transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <p className="mt-1 font-mono text-[10px] text-[#906f69]">
        Slug = ID ngách (fashion, beauty, electronics…). Ngách không có entry → tự động dùng keyword search.
        Kiểm tra ID tại: <code>tiki.vn/api/v2/products?category=&lt;id&gt;</code>
      </p>
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────────────────────

function SourceFormModal({
  initial,
  isEdit,
  onClose,
  onSave,
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

  // Parsed config for Tiki UI
  const parsedConfig = (() => {
    try { return JSON.parse(form.config) } catch { return {} }
  })()

  function set<K extends keyof FormData>(k: K, v: FormData[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
    if (k === "config") setConfigError(null)
  }

  function updateTikiCategoryIds(categoryIds: Record<string, number[]>) {
    try {
      const cfg = JSON.parse(form.config)
      set("config", JSON.stringify({ ...cfg, categoryIds }, null, 2))
    } catch {
      set("config", JSON.stringify({ categoryIds }, null, 2))
    }
  }

  function validateConfig(): boolean {
    try {
      JSON.parse(form.config)
      setConfigError(null)
      return true
    } catch (e) {
      setConfigError(`JSON không hợp lệ: ${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!validateConfig()) return
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-[#e5beb6] shadow-[4px_4px_0px_0px_rgba(26,28,27,1)] w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-dashed border-[#e5beb6] shrink-0">
          <h2 className="font-mono text-[13px] font-bold tracking-[0.05em] uppercase text-[#1a1c1b]">
            {isEdit ? "Sửa nguồn" : "Thêm nguồn mới"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f4f4f1] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Tên hiển thị *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Tên nguồn"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Slug (ID) *</label>
              <input
                required
                disabled={isEdit}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                placeholder="ten-nguon"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] disabled:bg-[#f4f4f1] disabled:text-[#5c403a]"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Base URL *</label>
            <input
              required
              type="url"
              value={form.baseUrl}
              onChange={(e) => set("baseUrl", e.target.value)}
              placeholder="https://example.com"
              className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Mô tả</label>
            <input
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Mô tả ngắn về nguồn này"
              className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t border-dashed border-[#e5beb6]">
            <div>
              <p className="font-sans text-[13px] font-medium text-[#1a1c1b]">Kích hoạt nguồn</p>
              <p className="font-mono text-[11px] text-[#5c403a] mt-0.5">Bật để sync jobs sử dụng nguồn này</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={() => set("enabled", !form.enabled)} className="sr-only peer" />
              <div className="w-11 h-6 bg-[#e2e3e0] rounded-full peer peer-focus:ring-2 peer-focus:ring-[#b51c00] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b51c00]" />
            </label>
          </div>

          {/* Tiki-specific: categoryIds UI */}
          {isTiki && (
            <div className="border-t border-dashed border-[#e5e1d8] pt-4">
              <TikiCategoryIds
                value={(parsedConfig.categoryIds as Record<string, number[]>) ?? {}}
                onChange={updateTikiCategoryIds}
              />
            </div>
          )}

          {/* Generic JSON config */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
                Config JSON {isTiki ? "(batch / rate-limit)" : "(Scraper)"}
              </label>
              <button type="button" onClick={validateConfig} className="font-mono text-[10px] text-[#906f69] hover:text-[#b51c00] transition-colors">
                Validate JSON
              </button>
            </div>
            <textarea
              rows={isTiki ? 6 : 10}
              value={form.config}
              onChange={(e) => set("config", e.target.value)}
              spellCheck={false}
              className={`w-full border rounded px-2 py-1.5 font-mono text-[11px] focus:outline-none resize-y ${configError ? "border-[#ba1a1a] bg-[#fff8f8]" : "border-[#e5beb6] focus:border-[#b51c00]"}`}
            />
            {configError && (
              <p className="mt-1 font-mono text-[11px] text-[#ba1a1a]">{configError}</p>
            )}
            {isTiki && (
              <p className="mt-1 font-mono text-[10px] text-[#906f69]">
                Các field batch: <code>tikiBatchSize</code>, <code>tikiBatchPauseMin</code>, <code>tikiInterNicheDelaySec</code>. Field <code>categoryIds</code> được sync từ bảng trên.
              </p>
            )}
          </div>
        </form>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-dashed border-[#e5beb6] shrink-0">
          <button onClick={onClose} className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1] transition-colors">
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving || !form.name || !form.slug || !form.baseUrl}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1c1b] text-[#f9f9f6] font-mono text-[12px] rounded hover:bg-[#b51c00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            {isEdit ? "Lưu thay đổi" : "Tạo nguồn"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ source, onClose, onConfirm }: { source: SyncSource; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-[#ffb4ab] shadow-[4px_4px_0px_0px_rgba(186,26,26,1)] w-full max-w-sm mx-4 p-5">
        <h2 className="font-mono text-[13px] font-bold text-[#ba1a1a] uppercase tracking-[0.05em] mb-2">Xoá nguồn?</h2>
        <p className="font-sans text-[13px] text-[#1a1c1b] mb-4">
          Bạn sắp xoá nguồn <strong>{source.name}</strong> (<code className="font-mono text-[11px]">{source.slug}</code>). Hành động này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1]">Huỷ</button>
          <button
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false) }}
            disabled={deleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#ba1a1a] text-white font-mono text-[12px] rounded hover:bg-[#9b1515] transition-colors disabled:opacity-50"
          >
            {deleting && <Loader2 className="size-3 animate-spin" />}
            Xoá
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SyncSourcesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [sources, setSources] = useState<SyncSource[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SyncSource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SyncSource | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/sync-sources")
      if (!res.ok) throw new Error("Lỗi tải danh sách")
      const json = await res.json()
      setSources(json.data)
    } catch {
      toastError("Lỗi tải nguồn đồng bộ")
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  async function handleCreate(data: FormData) {
    await ensureCsrfToken()
    const res = await fetch("/api/admin/sync-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
      toastError(err.error ?? "Lỗi tạo nguồn")
      return
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
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
      toastError(err.error ?? "Lỗi cập nhật")
      return
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
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
      toastError(err.error ?? "Lỗi xoá nguồn")
      return
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
    if (res.ok) {
      setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, enabled: !source.enabled } : s))
    } else {
      toastError("Lỗi cập nhật")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Nguồn đồng bộ"
        subtitle="Cấu hình nguồn dữ liệu — batch, rate-limit, category IDs theo ngách"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Thêm nguồn
          </Button>
        }
      />

      <div className="flex items-start gap-3 px-4 py-3 bg-[#f9f9f6] border border-[#e5e1d8]">
        <Info className="size-4 text-[#5c403a] mt-0.5 shrink-0" />
        <p className="font-mono text-[12px] text-[#5c403a]">
          Mỗi nguồn lưu một <strong>config JSON</strong>. Nguồn <code>tiki</code> chứa batch/rate-limit và <strong>category IDs</strong> map theo slug ngách — key là slug ngách, value là mảng ID danh mục Tiki.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-6 animate-spin text-[#b51c00]" />
        </div>
      ) : sources.length === 0 ? (
        <div className="border border-dashed border-[#e5beb6] rounded p-8 text-center">
          <Globe className="size-8 text-[#e5beb6] mx-auto mb-3" />
          <p className="font-mono text-[13px] text-[#5c403a] mb-3">Chưa có nguồn nào được cấu hình</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Thêm nguồn đầu tiên
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const cfg = (() => { try { return JSON.parse(source.config) } catch { return {} } })()
            const categoryCount = Object.keys(cfg.categoryIds ?? {}).length
            return (
              <div key={source.id} className="bg-white border border-[#e5e1d8] flex items-start justify-between px-5 py-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Globe className={`size-5 mt-0.5 shrink-0 ${source.enabled ? "text-[#1a6b3c]" : "text-[#906f69]"}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans text-[14px] font-semibold text-[#1a1c1b]">{source.name}</span>
                      <span className="font-mono text-[11px] text-[#5c403a] bg-[#f4f4f1] px-1.5 py-0.5">{source.slug}</span>
                      <button
                        onClick={() => toggleEnabled(source)}
                        className={`flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 border rounded transition-colors ${source.enabled ? "bg-[#d4f4e0] border-[#a3d9b8] text-[#1a6b3c]" : "bg-[#f4f4f1] border-[#e5e1d8] text-[#5c403a]"}`}
                      >
                        {source.enabled
                          ? <><ToggleRight className="size-3.5" /> Bật</>
                          : <><ToggleLeft className="size-3.5" /> Tắt</>
                        }
                      </button>
                    </div>
                    <p className="font-mono text-[12px] text-[#5c403a] mt-0.5">{source.baseUrl}</p>
                    {source.description && (
                      <p className="font-sans text-[12px] text-[#906f69] mt-0.5">{source.description}</p>
                    )}
                    {source.slug === "tiki" && categoryCount > 0 && (
                      <p className="font-mono text-[11px] text-[#0d5cb6] mt-1">
                        {categoryCount} ngách có category ID cấu hình
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4 shrink-0">
                  <button
                    onClick={() => setEditTarget(source)}
                    className="p-1.5 rounded hover:bg-[#ffdf9a] text-[#5c403a] transition-colors"
                    title="Sửa"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(source)}
                    className="p-1.5 rounded hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors"
                    title="Xoá"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {createOpen && (
        <SourceFormModal
          initial={{ ...EMPTY_FORM }}
          isEdit={false}
          onClose={() => setCreateOpen(false)}
          onSave={handleCreate}
        />
      )}

      {editTarget && (
        <SourceFormModal
          initial={{ id: editTarget.id, name: editTarget.name, slug: editTarget.slug, baseUrl: editTarget.baseUrl, enabled: editTarget.enabled, config: editTarget.config, description: editTarget.description }}
          isEdit={true}
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          source={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
