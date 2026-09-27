"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import {
  FileText, Plus, Trash2, Save, Loader2, Check,
  ExternalLink, X, Eye, EyeOff, GripVertical,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import AIGenerateButton from "@/components/admin/AIGenerateButton"
import { useToast } from "@/components/admin/ui"
import { getCsrfToken } from "@/lib/utils"
import { toSlug } from "@/lib/slug"

const RichEditor = dynamic(() => import("@/components/admin/RichEditor"), { ssr: false })

// ─── Constants ───────────────────────────────────────────────

const PLACEMENT_OPTIONS = [
  { value: "header",        label: "Header — gần search" },
  { value: "right_menu",   label: "Menu — phải navbar" },
  { value: "footer_col1",  label: "Footer — Cột 1 (Brand)" },
  { value: "footer_col2",  label: "Footer — Cột 2 (Liên kết)" },
  { value: "footer_col3",  label: "Footer — Cột 3 (Danh mục)" },
  { value: "footer_col4",  label: "Footer — Cột 4 (Newsletter)" },
  { value: "footer_bottom", label: "Footer — Dưới copyright" },
]

const PLACEMENT_COLORS: Record<string, string> = {
  header:        "bg-violet-100 text-violet-700",
  right_menu:    "bg-orange-100 text-orange-700",
  footer_col1:   "bg-blue-100 text-blue-700",
  footer_col2:   "bg-sky-100 text-sky-700",
  footer_col3:   "bg-cyan-100 text-cyan-700",
  footer_col4:   "bg-teal-100 text-teal-700",
  footer_bottom: "bg-amber-100 text-amber-700",
}

// ─── Types ────────────────────────────────────────────────────

interface Page {
  id: string; slug: string; title: string; description: string
  content: string; placements: string[]; published: boolean
  sortOrder: number; updatedAt: string; createdAt: string
}

function getPageUrl(slug: string) {
  return `/p/${slug}`
}

// ─── Page List ───────────────────────────────────────────────

function PageList({
  pages,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: {
  pages: Page[]
  selectedId: string | null
  onSelect: (p: Page) => void
  onCreate: () => void
  onDelete: (p: Page) => void
}) {
  const { error: toastError } = useToast()

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-dashed border-[#e5beb6] flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-[#5c403a]/50 uppercase tracking-widest">
          {pages.length} trang
        </span>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 text-[11px] font-mono font-bold text-white bg-[#b51c00] px-2.5 py-1.5 hover:bg-[#8f1200] transition-colors"
        >
          <Plus className="size-3 shrink-0" />
          Tạo mới
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {pages.length === 0 && (
          <p className="font-mono text-[11px] text-[#5c403a]/40 text-center py-8">
            Chưa có trang nào.<br />Nhấn "Tạo mới" để bắt đầu.
          </p>
        )}
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className={`w-full text-left px-3 py-2.5 transition-all group relative ${
              selectedId === p.id
                ? "bg-[#fdc73a] border-l-4 border-[#b51c00]"
                : "hover:bg-[#f4f4f1] border-l-4 border-transparent"
            }`}
          >
            <div className="flex items-start gap-2">
              <GripVertical className="size-3 text-[#5c403a]/25 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`font-mono text-[12px] font-bold truncate ${
                    selectedId === p.id ? "text-[#6f5400]" : "text-[#1a1c1b]"
                  }`}>
                    {p.title}
                  </span>
                  {!p.published && (
                    <span className="shrink-0 font-mono text-[9px] bg-[#e5beb6] text-[#5c403a] px-1 py-px">
                      Draft
                    </span>
                  )}
                </div>
                <p className={`font-mono text-[10px] truncate ${
                  selectedId === p.id ? "text-[#6f5400]/70" : "text-[#5c403a]/50"
                }`}>
                  {getPageUrl(p.slug)}
                </p>
                {p.placements.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.placements.slice(0, 2).map((pl) => {
                      const opt = PLACEMENT_OPTIONS.find((o) => o.value === pl)
                      return (
                        <span key={pl} className={`text-[9px] px-1 py-px font-mono ${PLACEMENT_COLORS[pl] ?? "bg-gray-100 text-gray-600"}`}>
                          {opt?.label ?? pl}
                        </span>
                      )
                    })}
                    {p.placements.length > 2 && (
                      <span className="text-[9px] font-mono text-[#5c403a]/50">+{p.placements.length - 2}</span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(p) }}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 text-[#ba1a1a] hover:bg-[#ffdad6]/50 transition-all rounded"
                title="Xóa trang"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Editor Panel ────────────────────────────────────────────

function PageEditor({
  page,
  isNew,
  onSaved,
  onCancel,
}: {
  page: Partial<Page>
  isNew: boolean
  onSaved: (p: Page) => void
  onCancel: () => void
}) {
  const [title, setTitle]           = useState(page.title ?? "")
  const [slug, setSlug]             = useState(page.slug ?? "")
  const [description, setDescription] = useState(page.description ?? "")
  const [content, setContent]       = useState(page.content ?? "")
  const [placements, setPlacements] = useState<string[]>(page.placements ?? [])
  const [published, setPublished]   = useState(page.published ?? false)
  const [sortOrder, setSortOrder]   = useState(page.sortOrder ?? 0)
  const [saving, setSaving]         = useState(false)
  const [aiLoading, setAiLoading]   = useState(false)
  const [instructions, setInstructions] = useState("")
  const slugEdited = useRef(!!page.slug)
  const { success: toastSuccess, error: toastError } = useToast()

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!slugEdited.current) setSlug(toSlug(val))
  }

  const togglePlacement = (val: string) => {
    setPlacements((prev) =>
      prev.includes(val) ? prev.filter((p) => p !== val) : [...prev, val]
    )
  }

  const handleAiGenerate = async (provider: string) => {
    if (!title.trim()) { toastError("Nhập tiêu đề trước khi sinh nội dung"); return }
    setAiLoading(true)
    try {
      const res = await fetch("/api/admin/generate-page-content", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({ title, instructions, provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Lỗi sinh nội dung")
      setContent(data.content)
      if (data.description) setDescription(data.description)
      toastSuccess("Đã sinh xong nội dung bằng AI")
    } catch (err) {
      toastError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) { toastError("Tiêu đề không được trống"); return }
    if (!slug.trim())  { toastError("Slug không được trống"); return }

    setSaving(true)
    try {
      const payload = { title, slug, description, content, placements, published, sortOrder }
      const res = isNew
        ? await fetch("/api/admin/static-pages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/static-pages/${page.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
            body: JSON.stringify(payload),
          })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Lỗi lưu trang")
      toastSuccess(isNew ? "Đã tạo trang mới" : "Đã lưu trang")
      onSaved(data.page)
    } catch (err) {
      toastError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pageUrl = getPageUrl(slug || "...")

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-dashed border-[#e5beb6] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 text-[#b51c00] shrink-0" />
          <span className="font-bold text-[#1a1c1b] text-sm truncate">
            {isNew ? "Tạo trang mới" : title || "Chỉnh sửa trang"}
          </span>
          {!isNew && (
            <a href={pageUrl} target="_blank" rel="noopener noreferrer"
              className="text-[#5c403a]/40 hover:text-[#b51c00] transition-colors shrink-0">
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setPublished((v) => !v)}
            className={`flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border transition-colors ${
              published
                ? "border-[#2d7a4e] text-[#2d7a4e] bg-[#e6f4ed] hover:bg-[#d0ebdc]"
                : "border-[#5c403a]/40 text-[#5c403a]/70 bg-white hover:border-[#b51c00] hover:text-[#b51c00]"
            }`}
          >
            {published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {published ? "Published" : "Draft"}
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[#5c403a]/40 text-[#5c403a]/70 bg-white hover:border-[#b51c00] hover:text-[#b51c00] transition-colors"
          >
            <X className="size-3.5" />
            Huỷ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#b51c00] text-white font-mono text-[11px] hover:bg-[#8f1200] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">

        {/* Title + Slug */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest mb-1">
              Tiêu đề <span className="text-[#b51c00]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Tên trang..."
              className="w-full border border-[#e5beb6] bg-white px-3 py-2 font-sans text-[14px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] transition-colors"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest mb-1">
              Slug (URL) <span className="text-[#5c403a]/40 normal-case">— {pageUrl}</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); slugEdited.current = true }}
              placeholder="ten-trang"
              className="w-full border border-[#e5beb6] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] transition-colors"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest mb-1">
            Mô tả ngắn (meta description)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả hiển thị trên kết quả tìm kiếm..."
            className="w-full border border-[#e5beb6] bg-white px-3 py-2 font-sans text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] transition-colors"
          />
        </div>

        {/* Placements */}
        <div>
          <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest mb-2">
            Hiển thị tại
          </label>
          <div className="flex flex-wrap gap-2">
            {PLACEMENT_OPTIONS.map((opt) => {
              const active = placements.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() => togglePlacement(opt.value)}
                  className={`font-mono text-[11px] px-3 py-1.5 border transition-all ${
                    active
                      ? `${PLACEMENT_COLORS[opt.value]} border-current font-bold`
                      : "border-[#e5beb6] text-[#5c403a]/60 hover:border-[#b51c00] hover:text-[#b51c00]"
                  }`}
                >
                  {active && <Check className="size-3 inline mr-1" />}
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sort order */}
        <div className="flex items-center gap-3">
          <label className="font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest whitespace-nowrap">
            Thứ tự hiển thị
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-20 border border-[#e5beb6] bg-white px-2 py-1.5 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] transition-colors"
          />
          <span className="font-mono text-[10px] text-[#5c403a]/40">Số nhỏ hiển thị trước</span>
        </div>

        {/* AI Generate */}
        <div className="border border-dashed border-[#e5beb6] px-3 py-3 space-y-2.5">
          <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest">
            Sinh nội dung bằng AI
          </label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder="Yêu cầu thêm (tùy chọn): bao gồm thông tin liên hệ, đề cập đến chính sách đổi trả 30 ngày..."
            className="w-full border border-[#e5beb6] bg-white px-3 py-2 font-sans text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] transition-colors resize-none"
          />
          <AIGenerateButton
            label="Sinh nội dung"
            loading={aiLoading}
            onGenerate={handleAiGenerate}
            size="sm"
          />
        </div>

        {/* Content editor */}
        <div>
          <label className="block font-mono text-[10px] text-[#5c403a]/60 uppercase tracking-widest mb-1.5">
            Nội dung trang
          </label>
          <div className="border border-[#e5beb6]">
            <RichEditor
              content={content}
              onChange={setContent}
              minHeight={360}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function StaticPagesAdminPage() {
  const [pages, setPages]           = useState<Page[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew]           = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Page | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const { success: toastSuccess, error: toastError } = useToast()

  useEffect(() => {
    fetch("/api/admin/static-pages")
      .then((r) => r.json())
      .then((data: { pages: Page[] }) => setPages(data.pages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedPage = pages.find((p) => p.id === selectedId)

  const handleCreate = () => {
    setSelectedId(null)
    setIsNew(true)
  }

  const handleSelect = (p: Page) => {
    setIsNew(false)
    setSelectedId(p.id)
  }

  const handleSaved = useCallback((saved: Page) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setSelectedId(saved.id)
    setIsNew(false)
  }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/static-pages/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      })
      if (!res.ok) throw new Error("Lỗi xóa trang")
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      if (selectedId === deleteTarget.id) { setSelectedId(null); setIsNew(false) }
      toastSuccess(`Đã xóa trang "${deleteTarget.title}"`)
    } catch (err) {
      toastError((err as Error).message)
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const showEditor = isNew || !!selectedPage

  return (
    <div className="flex flex-col h-full min-h-0">
      <AdminPageShell
        title="Quản lý trang tĩnh"
        subtitle="Tạo, sửa, xóa trang — chọn vị trí hiển thị trong footer/header — sinh nội dung bằng AI"
      />

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-[#b51c00]" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 mt-4 flex overflow-hidden border border-dashed border-[#e5beb6]">
          {/* Left sidebar — page list */}
          <div className="w-56 shrink-0 border-r border-dashed border-[#e5beb6] bg-[#f9f9f6] overflow-hidden flex flex-col">
            <PageList
              pages={pages}
              selectedId={selectedId}
              onSelect={handleSelect}
              onCreate={handleCreate}
              onDelete={setDeleteTarget}
            />
          </div>

          {/* Right — editor or empty state */}
          <div className="flex-1 min-w-0 overflow-hidden">
            {showEditor ? (
              <div className="h-full p-5 overflow-hidden flex flex-col">
                <PageEditor
                  key={isNew ? "new" : selectedId}
                  page={isNew ? {} : (selectedPage ?? {})}
                  isNew={isNew}
                  onSaved={handleSaved}
                  onCancel={() => { setIsNew(false); setSelectedId(null) }}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
                <FileText className="size-12 text-[#e5beb6] mb-4" />
                <p className="font-mono text-[12px] text-[#5c403a]/40 mb-4">
                  Chọn một trang để chỉnh sửa<br />hoặc tạo trang mới
                </p>
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#b51c00] text-white font-mono text-[12px] hover:bg-[#8f1200] transition-colors"
                >
                  <Plus className="size-4" />
                  Tạo trang đầu tiên
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white border border-[#e5beb6] shadow-[4px_4px_0px_rgba(26,28,27,1)] p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-3">
              <Trash2 className="size-5 text-[#ba1a1a] shrink-0" />
              <h3 className="font-bold text-[#1a1c1b]">Xóa trang?</h3>
            </div>
            <p className="font-mono text-[12px] text-[#5c403a] mb-5">
              Trang <strong>"{deleteTarget.title}"</strong> sẽ bị xóa vĩnh viễn.
              Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 font-mono text-[12px] border border-[#e5beb6] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 font-mono text-[12px] bg-[#ba1a1a] text-white hover:bg-[#8f1200] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
              >
                {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {deleting ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
