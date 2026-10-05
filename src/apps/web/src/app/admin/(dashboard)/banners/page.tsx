"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, GripVertical, ToggleLeft, ToggleRight, Sparkles, Copy, Check, Link2 } from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Modal,
  ConfirmModal,
  useToast,
  Badge,
  DataTable,
  DataTableRow,
  DataTableCell,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"
import { getCsrfToken } from "@/lib/utils"

// ── Constants ────────────────────────────────────────────────

const LINK_MODE_OPTIONS = [
  { value: "platform", label: "Tự động theo sàn (Shopee / Lazada / Tiki)" },
  { value: "at",       label: "AccessTrade (wrap qua AT campaign)" },
  { value: "direct",   label: "Nhập trực tiếp (tự điền affiliate URL)" },
] as const

type LinkMode = "platform" | "at" | "direct"

const PLATFORM_DETECT: Record<string, { label: string; hint: string }> = {
  "shopee.vn":  { label: "Shopee", hint: "Dùng SHOPEE_AFFILIATE_ID để tạo an_redir link" },
  "lazada.vn":  { label: "Lazada", hint: "Dùng LAZADA_AFFILIATE_API_KEY để tạo deep link" },
  "tiki.vn":    { label: "Tiki",   hint: "Dùng TIKI_AFFILIATE_API_KEY để tạo deep link" },
}

function detectPlatformHint(url: string): { label: string; hint: string } | null {
  try {
    const host = new URL(url).hostname.toLowerCase()
    for (const [domain, info] of Object.entries(PLATFORM_DETECT)) {
      if (host.includes(domain)) return info
    }
  } catch { /* noop */ }
  return null
}

const COLUMNS: TableColumn[] = [
  { key: "preview",    label: "Banner",      width: "120px" },
  { key: "title",      label: "Tiêu đề / URL" },
  { key: "linkMode",   label: "Link",        align: "center", width: "110px" },
  { key: "position",   label: "Thứ tự",      align: "center", width: "80px" },
  { key: "status",     label: "Trạng thái",  align: "center", width: "110px" },
  { key: "actions",    label: "",            align: "right",  width: "100px" },
]

const EMPTY_FORM = {
  title: "",
  imageUrl: "",
  destinationUrl: "",
  affiliateUrl: "",
  linkMode: "platform" as LinkMode,
  atCampaignId: "",
  position: "0",
  isActive: true,
  startDate: "",
  endDate: "",
}

// ── Types ────────────────────────────────────────────────────

interface BannerItem {
  id: string
  title: string
  imageUrl: string
  destinationUrl: string
  affiliateUrl: string | null
  linkMode: string
  atCampaignId: string | null
  position: number
  isActive: boolean
  startDate: string | null
  endDate: string | null
  createdAt: string
}

interface AtCampaign {
  id: string
  name: string
  merchant: string
}

// ── Component ────────────────────────────────────────────────

export default function BannersPage() {
  const [banners, setBanners] = useState<BannerItem[]>([])
  const [campaigns, setCampaigns] = useState<AtCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const [deleteTarget, setDeleteTarget] = useState<BannerItem | null>(null)
  const [copied, setCopied] = useState(false)

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const { success, error: toastError } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/admin/banners"),
        fetch("/api/admin/campaigns"),
      ])
      const bData = await bRes.json()
      const cData = await cRes.json()
      setBanners(bData.data ?? [])
      setCampaigns(cData.campaigns ?? [])
    } catch {
      toastError("Không tải được dữ liệu")
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  function openEdit(b: BannerItem) {
    setEditingId(b.id)
    setForm({
      title: b.title,
      imageUrl: b.imageUrl,
      destinationUrl: b.destinationUrl,
      affiliateUrl: b.affiliateUrl ?? "",
      linkMode: (b.linkMode as LinkMode) || "platform",
      atCampaignId: b.atCampaignId ?? "",
      position: String(b.position),
      isActive: b.isActive,
      startDate: b.startDate ? b.startDate.slice(0, 10) : "",
      endDate: b.endDate ? b.endDate.slice(0, 10) : "",
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title || !form.imageUrl || !form.destinationUrl) {
      toastError("Vui lòng điền tiêu đề, URL hình và URL đích")
      return
    }
    setSaving(true)
    try {
      const csrf = await getCsrfToken()
      const payload = {
        title: form.title,
        imageUrl: form.imageUrl,
        destinationUrl: form.destinationUrl,
        affiliateUrl: form.affiliateUrl || null,
        linkMode: form.linkMode,
        atCampaignId: form.atCampaignId || null,
        position: Number(form.position) || 0,
        isActive: form.isActive,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      }

      const url = editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners"
      const method = editingId ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)

      success(editingId ? "Đã cập nhật banner" : "Đã tạo banner mới")
      setModalOpen(false)
      load()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Lỗi lưu banner")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(b: BannerItem) {
    try {
      const csrf = await getCsrfToken()
      await fetch(`/api/admin/banners/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ isActive: !b.isActive }),
      })
      setBanners((prev) => prev.map((x) => x.id === b.id ? { ...x, isActive: !x.isActive } : x))
    } catch {
      toastError("Lỗi cập nhật trạng thái")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      const csrf = await getCsrfToken()
      const res = await fetch(`/api/admin/banners/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      })
      if (!res.ok) throw new Error()
      success("Đã xóa banner")
      setDeleteTarget(null)
      load()
    } catch {
      toastError("Lỗi xóa banner")
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
      <AdminPageShell
        title="Banners quảng cáo"
        subtitle="Quản lý banner hiển thị trên public site với affiliate link tự động"
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            Tạo banner
          </Button>
        }
      />
      <DataTable columns={COLUMNS} loading={loading} empty={banners.length === 0 && !loading} emptyTitle="Chưa có banner nào" emptyDescription="Nhấn 'Tạo banner' để thêm banner đầu tiên.">
        {banners.map((b) => (
          <DataTableRow key={b.id}>
            <DataTableCell>
              <div className="w-[100px] h-[52px] rounded overflow-hidden bg-[#f4f4f1] border border-[#e8e8e5] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.imageUrl}
                  alt={b.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            </DataTableCell>
            <DataTableCell>
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="size-3.5 text-[#5c403a]/30 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[#1a1a18] truncate">{b.title}</p>
                  {b.affiliateUrl
                    ? <span className="text-[10px] text-emerald-600 mt-0.5 block">Đã có affiliate URL</span>
                    : <span className="text-[10px] text-[#5c403a]/35 mt-0.5 block italic">Chưa có affiliate URL</span>
                  }
                </div>
              </div>
            </DataTableCell>
            <DataTableCell align="center">
              <Badge tone={b.linkMode === "at" ? "blue" : b.linkMode === "platform" ? "green" : "gray"}>
                {b.linkMode === "at" ? "AT" : b.linkMode === "platform" ? "Auto" : "Direct"}
              </Badge>
            </DataTableCell>
            <DataTableCell align="center">
              <span className="font-mono text-sm text-[#5c403a]/60">{b.position}</span>
            </DataTableCell>
            <DataTableCell align="center">
              <button onClick={() => toggleActive(b)} className="flex items-center gap-1 text-xs">
                {b.isActive
                  ? <><ToggleRight className="size-4 text-emerald-500" /> <span className="text-emerald-600 font-medium">Hiện</span></>
                  : <><ToggleLeft className="size-4 text-[#5c403a]/30" /> <span className="text-[#5c403a]/50">Ẩn</span></>
                }
              </button>
            </DataTableCell>
            <DataTableCell align="right">
              <div className="flex items-center gap-1 justify-end">
                <button
                  onClick={() => openEdit(b)}
                  className="p-1.5 rounded hover:bg-[#f4f4f1] text-[#5c403a]/60 hover:text-primary transition-colors"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(b)}
                  className="p-1.5 rounded hover:bg-red-50 text-[#5c403a]/60 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </DataTableCell>
          </DataTableRow>
        ))}
      </DataTable>

      {/* Create / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Chỉnh sửa banner" : "Tạo banner mới"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingId ? "Lưu thay đổi" : "Tạo banner"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Tiêu đề nội bộ *</label>
            <input
              className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Ví dụ: Shopee Sale 11.11"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Image URL + preview */}
          <div>
            <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">URL hình banner *</label>
            <input
              className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            />
            {form.imageUrl && (
              <div className="mt-2 rounded overflow-hidden border border-[#e8e8e5] max-h-[120px] bg-[#f4f4f1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="preview" className="w-full h-full object-contain max-h-[120px]" />
              </div>
            )}
          </div>

          {/* Destination URL */}
          <div>
            <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">URL đích gốc *</label>
            <input
              className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="https://shopee.vn/..."
              value={form.destinationUrl}
              onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
            />
          </div>

          {/* Link mode */}
          <div>
            <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Loại affiliate link</label>
            <select
              className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
              value={form.linkMode}
              onChange={(e) => setForm((f) => ({ ...f, linkMode: e.target.value as LinkMode }))}
            >
              {LINK_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Platform mode — auto-detect & generate */}
          {form.linkMode === "platform" && (
            <div className="rounded-lg border border-[#e8e8e5] bg-[#f9f9f7] px-3 py-2.5 flex items-start gap-2.5">
              <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                {form.destinationUrl && detectPlatformHint(form.destinationUrl) ? (
                  <>
                    <p className="text-xs font-semibold text-[#1a1a18]">
                      Phát hiện: {detectPlatformHint(form.destinationUrl)!.label}
                    </p>
                    <p className="text-[11px] text-[#5c403a]/60 mt-0.5">
                      {detectPlatformHint(form.destinationUrl)!.hint}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[#5c403a]/60">
                    Nhập URL đích ở trên — hệ thống sẽ tự nhận diện sàn (Shopee, Lazada, Tiki) và build affiliate link tự động khi lưu.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Affiliate URL (readonly) — hiển thị trong modal edit */}
          {editingId && form.linkMode === "platform" && form.affiliateUrl && (
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Affiliate URL đã tạo</label>
              <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
                <Link2 className="size-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono text-[11px] text-emerald-800 truncate min-w-0 flex-1">
                  {form.affiliateUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copyText(form.affiliateUrl)}
                  title="Copy affiliate URL"
                  className="shrink-0 p-1 rounded hover:bg-emerald-100 text-emerald-600 transition-colors"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                </button>
              </div>
            </div>
          )}

          {/* Direct — user nhập thủ công */}
          {form.linkMode === "direct" && (
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Affiliate URL</label>
              <input
                className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="https://s.shopee.vn/... hoặc https://c.lazada.vn/..."
                value={form.affiliateUrl}
                onChange={(e) => setForm((f) => ({ ...f, affiliateUrl: e.target.value }))}
              />
              <p className="text-[10px] text-[#5c403a]/50 mt-1">Bỏ trống để dùng URL đích gốc khi click</p>
            </div>
          )}

          {/* Conditional: AT campaign */}
          {form.linkMode === "at" && (
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">AT Campaign</label>
              <select
                className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.atCampaignId}
                onChange={(e) => setForm((f) => ({ ...f, atCampaignId: e.target.value }))}
              >
                <option value="">— Chọn campaign —</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.merchant} — {c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-[#5c403a]/50 mt-1">Affiliate URL sẽ được tạo tự động khi banner được click</p>
            </div>
          )}

          {/* Position + Active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Thứ tự (position)</label>
              <input
                type="number"
                className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <div
                  className={`relative w-9 h-5 rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-[#e8e8e5]"}`}
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                >
                  <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-[#1a1a18]">{form.isActive ? "Hiển thị" : "Ẩn"}</span>
              </label>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5c403a]/70 mb-1">Ngày kết thúc</label>
              <input
                type="date"
                className="w-full border border-[#e8e8e5] rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { handleDelete() }}
        title="Xóa banner"
        message={`Bạn có chắc muốn xóa banner "${deleteTarget?.title}"? Không thể hoàn tác.`}
        confirmLabel="Xóa"
        danger
      />
    </div>
  )
}
