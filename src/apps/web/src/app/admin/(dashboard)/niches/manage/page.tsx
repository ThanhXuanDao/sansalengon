"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Pencil, Trash2, Search, ChevronUp, ChevronDown, Layers,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Modal,
  ConfirmModal,
  useToast,
  AdminFilterBar,
  FilterSelect,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTablePagination,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"
import { ensureCsrfToken, getCsrfToken } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NicheRow {
  id: string
  name: string
  emoji: string
  status: string
  description: string | null
  metaKeywords: string | null
  sortOrder: number
  postPrefix: string | null
  hashtags: string | null
  zaloOaId: string | null
  syncEnabled: boolean
  createdAt: string
  updatedAt: string
}

const EMPTY_FORM: Omit<NicheRow, "createdAt" | "updatedAt"> = {
  id: "", name: "", emoji: "🏷️", status: "draft", description: "",
  metaKeywords: "", sortOrder: 0,
  postPrefix: "", hashtags: "", zaloOaId: "", syncEnabled: true,
}

const STATUS_OPTIONS = [
  { value: "all",      label: "Tất cả trạng thái" },
  { value: "active",   label: "Hoạt động" },
  { value: "draft",    label: "Nháp" },
  { value: "inactive", label: "Tắt" },
]

const COLUMNS: TableColumn[] = [
  { key: "order",   label: "Thứ tự", width: "80px" },
  { key: "niche",   label: "Danh mục" },
  { key: "status",  label: "Trạng thái", width: "120px" },
  { key: "sync",    label: "Đồng bộ", width: "100px" },
  { key: "actions", label: "Thao tác", align: "right", width: "100px" },
]

const STATUS_STYLE: Record<string, { cls: string; label: string }> = {
  active:   { cls: "bg-[#d4f4e0] text-[#1a6b3c] border-[#a3d9b8]",   label: "Hoạt động" },
  draft:    { cls: "bg-[#fef9e7] text-[#6f5400] border-[#fdc73a]",    label: "Nháp" },
  inactive: { cls: "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]",    label: "Tắt" },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { cls: "bg-[#e2e3e0] text-[#5c403a] border-[#ccc]", label: status }
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-mono font-bold border ${s.cls}`}>
      {s.label}
    </span>
  )
}

// ── Niche form content ────────────────────────────────────────────────────────

function NicheFormContent({
  form, setForm, isEdit,
}: {
  form: Omit<NicheRow, "createdAt" | "updatedAt">
  setForm: React.Dispatch<React.SetStateAction<Omit<NicheRow, "createdAt" | "updatedAt">>>
  isEdit: boolean
}) {
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">ID (slug) *</label>
          <input
            required disabled={isEdit}
            value={form.id}
            onChange={(e) => set("id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
            placeholder="fashion"
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] disabled:bg-[#f4f4f1] disabled:text-[#5c403a]"
          />
        </div>
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Tên hiển thị *</label>
          <input
            required value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Thời trang"
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Emoji</label>
          <input value={form.emoji} onChange={(e) => set("emoji", e.target.value)} placeholder="🏷️"
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[14px] focus:outline-none focus:border-[#b51c00]" />
        </div>
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Trạng thái</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value)}
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]">
            <option value="draft">Nháp</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Tắt</option>
          </select>
        </div>
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Thứ tự</label>
          <input type="number" value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))}
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
        </div>
      </div>

      <div>
        <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Mô tả</label>
        <textarea rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value || null)}
          className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] resize-none" />
      </div>

      <div>
        <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Meta Keywords (SEO)</label>
        <input value={form.metaKeywords ?? ""} onChange={(e) => set("metaKeywords", e.target.value || null)}
          placeholder="áo, quần, thời trang"
          className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Post Prefix</label>
          <input value={form.postPrefix ?? ""} onChange={(e) => set("postPrefix", e.target.value || null)}
            placeholder="🔥 Deal thời trang hôm nay"
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
        </div>
        <div>
          <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Hashtags</label>
          <input value={form.hashtags ?? ""} onChange={(e) => set("hashtags", e.target.value || null)}
            placeholder="#thoitrang #shopee"
            className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
        </div>
      </div>

      <div>
        <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">Zalo OA ID</label>
        <input value={form.zaloOaId ?? ""} onChange={(e) => set("zaloOaId", e.target.value || null)}
          placeholder="1234567890"
          className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]" />
      </div>

      <div className="flex items-center justify-between py-2 border-t border-dashed border-[#e5beb6]">
        <div>
          <p className="font-sans text-[13px] font-medium text-[#1a1c1b]">Đồng bộ sản phẩm</p>
          <p className="font-mono text-[11px] text-[#5c403a] mt-0.5">Bật để sync jobs tự động xử lý ngách này</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={form.syncEnabled} onChange={() => set("syncEnabled", !form.syncEnabled)} className="sr-only peer" />
          <div className="w-11 h-6 bg-[#e2e3e0] rounded-full peer peer-focus:ring-2 peer-focus:ring-[#b51c00] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#b51c00]" />
        </label>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ManageNichesPage() {
  const { success: toastSuccess, error: toastError } = useToast()

  const [niches, setNiches]       = useState<NicheRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState("")
  const [statusFilter, setStatus] = useState("all")
  const [page, setPage]           = useState(1)
  const [pageSize, setPageSize]   = useState(10)

  const [createOpen, setCreateOpen]     = useState(false)
  const [editTarget, setEditTarget]     = useState<NicheRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NicheRow | null>(null)
  const [deleting, setDeleting]         = useState(false)

  const [createForm, setCreateForm] = useState<Omit<NicheRow, "createdAt" | "updatedAt">>(EMPTY_FORM)
  const [editForm, setEditForm]     = useState<Omit<NicheRow, "createdAt" | "updatedAt">>(EMPTY_FORM)
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/niches/manage")
      if (!res.ok) throw new Error("Lỗi tải danh sách")
      const json = await res.json()
      setNiches(json.data)
    } catch {
      toastError("Lỗi tải ngách")
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { void load() }, [load])

  // Filter + sort + paginate client-side
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...niches]
      .filter((n) => statusFilter === "all" || n.status === statusFilter)
      .filter((n) => !q || n.name.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [niches, search, statusFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  function openCreate() {
    setCreateForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  function openEdit(niche: NicheRow) {
    setEditForm({ ...niche })
    setEditTarget(niche)
  }

  async function handleCreate() {
    if (!createForm.id || !createForm.name) return
    setSaving(true)
    try {
      await ensureCsrfToken()
      const res = await fetch("/api/admin/niches/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
        toastError(err.error ?? "Lỗi tạo ngách")
        return
      }
      toastSuccess("Đã tạo ngách mới")
      setCreateOpen(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    setSaving(true)
    try {
      await ensureCsrfToken()
      const res = await fetch(`/api/admin/niches/manage/${editForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
        toastError(err.error ?? "Lỗi cập nhật")
        return
      }
      toastSuccess("Đã cập nhật ngách")
      setEditTarget(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await ensureCsrfToken()
      const res = await fetch(`/api/admin/niches/manage/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
        toastError(err.error ?? "Lỗi xoá ngách")
        return
      }
      toastSuccess(`Đã xoá "${deleteTarget.name}"`)
      setDeleteTarget(null)
      await load()
    } finally {
      setDeleting(false)
    }
  }

  async function moveSort(niche: NicheRow, dir: "up" | "down") {
    const sorted = [...niches].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((n) => n.id === niche.id)
    const swapIdx = dir === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const current = sorted[idx]
    const swap = sorted[swapIdx]
    await ensureCsrfToken()
    const csrf = getCsrfToken()
    await Promise.all([
      fetch(`/api/admin/niches/manage/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/admin/niches/manage/${swap.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ sortOrder: current.sortOrder }),
      }),
    ])
    await load()
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
      <AdminPageShell
        title="Ngành hàng"
        subtitle={`Thêm, sửa, xoá ngành hàng hiển thị trên site. ${niches.length > 0 ? `${niches.length} ngành.` : ""}`}
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            Thêm ngành
          </Button>
        }
      />

      <AdminFilterBar
        search={{
          value: search,
          onChange: (v) => { setSearch(v); setPage(1) },
          placeholder: "Tên hoặc ID ngách...",
          id: "niches-search",
        }}
        filters={
          <FilterSelect
            label="Trạng thái"
            value={statusFilter}
            onChange={(v) => { setStatus(v); setPage(1) }}
            options={STATUS_OPTIONS}
            id="filter-status"
          />
        }
        actions={
          <Button variant="secondary" icon={Search} onClick={() => {}}>
            Tìm
          </Button>
        }
      />

      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && filtered.length === 0}
        emptyIcon={Layers}
        emptyTitle={search || statusFilter !== "all" ? "Không tìm thấy ngách" : "Chưa có ngách nào"}
        emptyDescription={
          search || statusFilter !== "all"
            ? "Thử điều chỉnh bộ lọc."
            : "Tạo ngách đầu tiên để bắt đầu phân loại sản phẩm."
        }
      >
        {paginated.map((niche) => (
          <DataTableRow key={niche.id}>
            {/* Thứ tự */}
            <DataTableCell>
              <div className="flex items-center gap-0.5">
                <button onClick={() => moveSort(niche, "up")} className="p-1 hover:bg-[#f4f4f1] text-[#5c403a] transition-colors" title="Lên">
                  <ChevronUp className="size-3.5" />
                </button>
                <span className="font-mono text-[12px] text-[#5c403a] w-6 text-center">{niche.sortOrder}</span>
                <button onClick={() => moveSort(niche, "down")} className="p-1 hover:bg-[#f4f4f1] text-[#5c403a] transition-colors" title="Xuống">
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </DataTableCell>

            {/* Ngách */}
            <DataTableCell>
              <div className="flex items-center gap-2">
                <span className="text-[18px]">{niche.emoji}</span>
                <div>
                  <p className="font-sans text-[13px] font-semibold text-[#1a1c1b]">{niche.name}</p>
                  <p className="font-mono text-[11px] text-[#5c403a]">{niche.id}</p>
                </div>
              </div>
            </DataTableCell>

            {/* Trạng thái */}
            <DataTableCell>
              <StatusBadge status={niche.status} />
            </DataTableCell>

            {/* Đồng bộ */}
            <DataTableCell>
              <span className={`inline-block px-2 py-0.5 text-[11px] font-mono font-bold border ${niche.syncEnabled ? "bg-[#d4f4e0] text-[#1a6b3c] border-[#a3d9b8]" : "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]"}`}>
                {niche.syncEnabled ? "Bật" : "Tắt"}
              </span>
            </DataTableCell>

            {/* Thao tác */}
            <DataTableCell align="right">
              <div className="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEdit(niche)} aria-label={`Sửa ${niche.name}`} />
                <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(niche)} aria-label={`Xóa ${niche.name}`} />
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {filtered.length > pageSize && (
        <DataTablePagination
          page={page}
          total={filtered.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          label="ngách"
        />
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm ngách mới"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Huỷ</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving} disabled={!createForm.id || !createForm.name}>
              Tạo ngách
            </Button>
          </>
        }
      >
        <NicheFormContent form={createForm} setForm={setCreateForm} isEdit={false} />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Sửa ngách"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={saving}>Huỷ</Button>
            <Button variant="primary" onClick={handleEdit} loading={saving} disabled={!editForm.name}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <NicheFormContent form={editForm} setForm={setEditForm} isEdit={true} />
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xoá ngách"
        message={`Bạn có chắc muốn xoá ngách "${deleteTarget?.emoji} ${deleteTarget?.name}" (${deleteTarget?.id})? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá"
        danger
        loading={deleting}
      />
    </div>
  )
}
