"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, useToast } from "@/components/admin/ui"
import { ensureCsrfToken, getCsrfToken } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

interface NicheRow {
  id: string
  name: string
  emoji: string
  status: string
  description: string | null
  metaKeywords: string | null
  sortOrder: number
  shopeeKeywords: string[]
  atCampaignIds: string[]
  atKeywords: string[]
  minDiscountPct: number
  minPrice: number
  maxPrice: number
  postPrefix: string | null
  hashtags: string | null
  zaloOaId: string | null
  createdAt: string
  updatedAt: string
}

const EMPTY_FORM: Omit<NicheRow, "createdAt" | "updatedAt"> = {
  id: "",
  name: "",
  emoji: "🏷️",
  status: "draft",
  description: "",
  metaKeywords: "",
  sortOrder: 0,
  shopeeKeywords: [],
  atCampaignIds: [],
  atKeywords: [],
  minDiscountPct: 0,
  minPrice: 0,
  maxPrice: 10000000,
  postPrefix: "",
  hashtags: "",
  zaloOaId: "",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-[#d4f4e0] text-[#1a6b3c] border-[#a3d9b8]",
    draft: "bg-[#fef9e7] text-[#6f5400] border-[#fdc73a]",
    inactive: "bg-[#ffdad6] text-[#ba1a1a] border-[#ffb4ab]",
  }
  const cls = map[status] ?? "bg-[#e2e3e0] text-[#5c403a] border-[#ccc]"
  const label: Record<string, string> = { active: "Hoạt động", draft: "Nháp", inactive: "Tắt" }
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-mono font-bold border rounded ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}

function fmtPrice(v: number) {
  return new Intl.NumberFormat("vi-VN").format(v)
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState("")

  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) onChange([...values, v])
    setInput("")
  }

  return (
    <div>
      <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-1.5 min-h-[28px]">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#fff8e7] border border-[#fdc73a] rounded font-mono text-[11px] text-[#6f5400]"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-[#b51c00] hover:text-[#ba1a1a] ml-0.5"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add() }
          }}
          placeholder={placeholder ?? "Thêm rồi Enter"}
          className="flex-1 border border-[#e5beb6] rounded px-2 py-1 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
        />
        <button
          type="button"
          onClick={add}
          className="px-2 py-1 bg-[#f4f4f1] border border-[#e5beb6] rounded font-mono text-[11px] hover:bg-[#ffdf9a] transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Form modal ────────────────────────────────────────────────────────────────

function NicheFormModal({
  initial,
  isEdit,
  onClose,
  onSave,
}: {
  initial: Omit<NicheRow, "createdAt" | "updatedAt">
  isEdit: boolean
  onClose: () => void
  onSave: (data: Omit<NicheRow, "createdAt" | "updatedAt">) => Promise<void>
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
            {isEdit ? "Sửa ngách" : "Thêm ngách mới"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#f4f4f1] transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Row 1: id + name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                ID (slug) *
              </label>
              <input
                required
                disabled={isEdit}
                value={form.id}
                onChange={(e) => set("id", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="fashion"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] disabled:bg-[#f4f4f1] disabled:text-[#5c403a]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Tên hiển thị *
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Thời trang"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
          </div>

          {/* Row 2: emoji + status + sortOrder */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Emoji
              </label>
              <input
                value={form.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder="🏷️"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[14px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Trạng thái
              </label>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              >
                <option value="draft">Nháp</option>
                <option value="active">Hoạt động</option>
                <option value="inactive">Tắt</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Thứ tự
              </label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value))}
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
              Mô tả
            </label>
            <textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00] resize-none"
            />
          </div>

          {/* Meta keywords */}
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
              Meta Keywords (SEO)
            </label>
            <input
              value={form.metaKeywords ?? ""}
              onChange={(e) => set("metaKeywords", e.target.value || null)}
              placeholder="áo, quần, thời trang"
              className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>

          {/* Sync keywords */}
          <div className="grid grid-cols-1 gap-3">
            <TagInput
              label="Shopee Keywords"
              values={form.shopeeKeywords as string[]}
              onChange={(v) => set("shopeeKeywords", v)}
              placeholder="thời trang nữ → Enter"
            />
            <TagInput
              label="AccessTrade Campaign IDs"
              values={form.atCampaignIds as string[]}
              onChange={(v) => set("atCampaignIds", v)}
              placeholder="12345 → Enter"
            />
            <TagInput
              label="AccessTrade Keywords"
              values={form.atKeywords as string[]}
              onChange={(v) => set("atKeywords", v)}
              placeholder="ao thun nu → Enter"
            />
          </div>

          {/* Price filters */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Giảm tối thiểu (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.minDiscountPct}
                onChange={(e) => set("minDiscountPct", Number(e.target.value))}
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Giá tối thiểu (VND)
              </label>
              <input
                type="number"
                min={0}
                value={form.minPrice}
                onChange={(e) => set("minPrice", Number(e.target.value))}
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Giá tối đa (VND)
              </label>
              <input
                type="number"
                min={0}
                value={form.maxPrice}
                onChange={(e) => set("maxPrice", Number(e.target.value))}
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
          </div>

          {/* Broadcast */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Post Prefix (Facebook)
              </label>
              <input
                value={form.postPrefix ?? ""}
                onChange={(e) => set("postPrefix", e.target.value || null)}
                placeholder="🔥 Deal thời trang hôm nay"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
                Hashtags
              </label>
              <input
                value={form.hashtags ?? ""}
                onChange={(e) => set("hashtags", e.target.value || null)}
                placeholder="#thoitrang #shopee"
                className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1 uppercase">
              Zalo OA ID
            </label>
            <input
              value={form.zaloOaId ?? ""}
              onChange={(e) => set("zaloOaId", e.target.value || null)}
              placeholder="1234567890"
              className="w-full border border-[#e5beb6] rounded px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>
        </form>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-dashed border-[#e5beb6] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1] transition-colors"
          >
            Huỷ
          </button>
          <button
            type="submit"
            form="niche-form"
            onClick={async (e) => {
              e.preventDefault()
              setSaving(true)
              try {
                await onSave(form)
              } finally {
                setSaving(false)
              }
            }}
            disabled={saving || !form.id || !form.name}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1c1b] text-[#f9f9f6] font-mono text-[12px] rounded hover:bg-[#b51c00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && <Loader2 className="size-3 animate-spin" />}
            {isEdit ? "Lưu thay đổi" : "Tạo ngách"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  niche,
  onClose,
  onConfirm,
}: {
  niche: NicheRow
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white border border-[#ffb4ab] shadow-[4px_4px_0px_0px_rgba(186,26,26,1)] w-full max-w-sm mx-4 p-5">
        <h2 className="font-mono text-[13px] font-bold text-[#ba1a1a] uppercase tracking-[0.05em] mb-2">
          Xoá ngách?
        </h2>
        <p className="font-sans text-[13px] text-[#1a1c1b] mb-4">
          Bạn sắp xoá ngách <strong>{niche.emoji} {niche.name}</strong> (
          <code className="font-mono text-[11px]">{niche.id}</code>). Hành động này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 font-mono text-[12px] border border-[#e5beb6] rounded hover:bg-[#f4f4f1]"
          >
            Huỷ
          </button>
          <button
            onClick={async () => {
              setDeleting(true)
              await onConfirm()
              setDeleting(false)
            }}
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

export default function ManageNichesPage() {
  const { success: toastSuccess, error: toastError } = useToast()
  const [niches, setNiches] = useState<NicheRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<NicheRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NicheRow | null>(null)

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

  async function handleCreate(data: Omit<NicheRow, "createdAt" | "updatedAt">) {
    await ensureCsrfToken()
    const res = await fetch("/api/admin/niches/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
      toastError(err.error ?? "Lỗi tạo ngách")
      return
    }
    toastSuccess("Đã tạo ngách mới")
    setCreateOpen(false)
    await load()
  }

  async function handleEdit(data: Omit<NicheRow, "createdAt" | "updatedAt">) {
    await ensureCsrfToken()
    const res = await fetch(`/api/admin/niches/manage/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Lỗi không xác định" }))
      toastError(err.error ?? "Lỗi cập nhật")
      return
    }
    toastSuccess("Đã cập nhật ngách")
    setEditTarget(null)
    await load()
  }

  async function handleDelete() {
    if (!deleteTarget) return
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
    toastSuccess(`Đã xoá "${deleteTarget.name}"`);
    setDeleteTarget(null)
    await load()
  }

  async function moveSort(niche: NicheRow, dir: "up" | "down") {
    const sorted = [...niches].sort((a, b) => a.sortOrder - b.sortOrder)
    const idx = sorted.findIndex((n) => n.id === niche.id)
    const swapIdx = dir === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const current = sorted[idx]
    const swap = sorted[swapIdx]
    const tmpOrder = current.sortOrder
    const newOrder = swap.sortOrder

    await ensureCsrfToken()
    const csrf = getCsrfToken()
    await Promise.all([
      fetch(`/api/admin/niches/manage/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ sortOrder: newOrder }),
      }),
      fetch(`/api/admin/niches/manage/${swap.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ sortOrder: tmpOrder }),
      }),
    ])
    await load()
  }

  const sorted = [...niches].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Quản lý ngách"
        subtitle="Thêm, sửa, xoá ngách sản phẩm — nguồn dữ liệu chung cho toàn hệ thống"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Thêm ngách
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="size-6 animate-spin text-[#b51c00]" />
        </div>
      ) : niches.length === 0 ? (
        <div className="border border-dashed border-[#e5beb6] rounded p-8 text-center">
          <p className="font-mono text-[13px] text-[#5c403a] mb-3">Chưa có ngách nào</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            Thêm ngách đầu tiên
          </Button>
        </div>
      ) : (
        <div className="border border-[#e5beb6] rounded overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#f4f4f1] border-b border-[#e5beb6]">
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase w-10">
                  #
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
                  Ngách
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">
                  Trạng thái
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase hidden md:table-cell">
                  Shopee KWs
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase hidden lg:table-cell">
                  Giá lọc
                </th>
                <th className="px-4 py-2.5 font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase w-28">
                  Thứ tự
                </th>
                <th className="px-4 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((niche) => (
                <tr
                  key={niche.id}
                  className="border-b border-dashed border-[#e5beb6] last:border-0 hover:bg-[#fafaf7] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-[#5c403a]">
                    {niche.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[18px]">{niche.emoji}</span>
                      <div>
                        <p className="font-sans text-[13px] font-semibold text-[#1a1c1b]">
                          {niche.name}
                        </p>
                        <p className="font-mono text-[11px] text-[#5c403a]">{niche.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(niche.status)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-[11px] text-[#5c403a]">
                      {(niche.shopeeKeywords as string[]).length} từ khoá
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-mono text-[11px] text-[#5c403a]">
                      {fmtPrice(niche.minPrice)}–{fmtPrice(niche.maxPrice)} ₫
                      {niche.minDiscountPct > 0 && `, ≥${niche.minDiscountPct}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => moveSort(niche, "up")}
                        className="p-1 rounded hover:bg-[#f4f4f1] text-[#5c403a] transition-colors"
                        title="Lên"
                      >
                        <ChevronUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => moveSort(niche, "down")}
                        className="p-1 rounded hover:bg-[#f4f4f1] text-[#5c403a] transition-colors"
                        title="Xuống"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditTarget(niche)}
                        className="p-1.5 rounded hover:bg-[#ffdf9a] text-[#5c403a] transition-colors"
                        title="Sửa"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(niche)}
                        className="p-1.5 rounded hover:bg-[#ffdad6] text-[#ba1a1a] transition-colors"
                        title="Xoá"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <NicheFormModal
          initial={EMPTY_FORM}
          isEdit={false}
          onClose={() => setCreateOpen(false)}
          onSave={handleCreate}
        />
      )}

      {editTarget && (
        <NicheFormModal
          initial={{
            ...editTarget,
            shopeeKeywords: editTarget.shopeeKeywords as string[],
            atCampaignIds: editTarget.atCampaignIds as string[],
            atKeywords: editTarget.atKeywords as string[],
          }}
          isEdit
          onClose={() => setEditTarget(null)}
          onSave={handleEdit}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          niche={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
