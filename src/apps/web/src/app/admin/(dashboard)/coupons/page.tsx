"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Search, Pencil, Trash2, ExternalLink, ToggleLeft, ToggleRight, Tag, AlertTriangle } from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Badge,
  ConfirmModal,
  Modal,
  useToast,
  AdminFilterBar,
  FilterSelect,
  DataTable,
  DataTableRow,
  DataTableCell,
  DataTablePagination,
} from "@/components/admin/ui"
import type { TableColumn } from "@/components/admin/ui"
import { usePlatformBadges } from "@/hooks/usePlatformBadges"

interface Coupon {
  id: string
  source: string
  platform: string | null
  merchant: string
  code: string | null
  description: string
  terms: string | null
  imageUrl: string | null
  discountValue: number
  discountType: "percent" | "fixed"
  minOrderValue: number | null
  maxDiscount: number | null
  affiliateUrl: string
  expiresAt: string | null
  isActive: boolean
  clickCount: number
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: "all",      label: "Tất cả trạng thái" },
  { value: "active",   label: "Đang hoạt động" },
  { value: "inactive", label: "Đã tắt" },
]

const DISCOUNT_TYPE_OPTIONS = [
  { value: "all",     label: "Tất cả loại" },
  { value: "percent", label: "Phần trăm (%)" },
  { value: "fixed",   label: "Số tiền (đ)" },
]

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "value",  label: "Giá trị giảm" },
  { value: "expires", label: "Sắp hết hạn" },
]

const PLATFORM_FORM_OPTS = ["shopee", "tiki", "lazada", "tch"] as const

const COLUMNS: TableColumn[] = [
  { key: "merchant",     label: "Merchant / Mô tả" },
  { key: "code",         label: "Mã",          width: "110px" },
  { key: "discount",     label: "Giảm",        align: "right", width: "90px", sortable: true },
  { key: "platform",     label: "Platform",    align: "center", width: "90px" },
  { key: "expires",      label: "Hết hạn",     align: "center", width: "90px" },
  { key: "clicks",       label: "Clicks",      align: "right",  width: "70px" },
  { key: "status",       label: "Trạng thái",  align: "center", width: "110px" },
  { key: "actions",      label: "",            align: "right",  width: "90px" },
]

const EMPTY_FORM = {
  merchant: "",
  platform: "",
  code: "",
  description: "",
  terms: "",
  imageUrl: "",
  discountValue: "",
  discountType: "percent" as "percent" | "fixed",
  minOrderValue: "",
  maxDiscount: "",
  affiliateUrl: "",
  expiresAt: "",
}

function fmtDiscount(v: number, t: "percent" | "fixed") {
  if (t === "percent") return `${v}%`
  return new Intl.NumberFormat("vi-VN").format(v) + "đ"
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

function PlatformBadge({ slug, badges }: { slug: string; badges: Record<string, { label: string; bg: string; text: string }> }) {
  const b = badges[slug]
  if (!b) return <span className="font-mono text-[10px] text-[#906f69]">{slug || "—"}</span>
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${b.bg} ${b.text}`}>
      {b.label}
    </span>
  )
}

export default function AdminCouponsPage() {
  const { success, error: toastError } = useToast()
  const { data: platformBadges = {} } = usePlatformBadges()

  // Filters
  const [search, setSearch]               = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [platform, setPlatform]           = useState("all")
  const [status, setStatus]               = useState("all")
  const [discountType, setDiscountType]   = useState("all")
  const [sort, setSort]                   = useState("newest")

  // Data
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [total, setTotal]     = useState(0)
  const [loading, setLoading] = useState(true)

  // Pagination
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // Add
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addSaving, setAddSaving] = useState(false)

  // Edit
  const [editTarget, setEditTarget] = useState<Coupon | null>(null)
  const [editForm, setEditForm]     = useState(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)

  const platformOptions = useMemo(() => [
    { value: "all", label: "Tất cả platform" },
    ...Object.entries(platformBadges).map(([slug, b]) => ({ value: slug, label: b.label })),
  ], [platformBadges])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const p = new URLSearchParams({
        take: String(pageSize),
        skip: String(skip),
        sort,
      })
      if (appliedSearch)           p.set("q", appliedSearch)
      if (platform !== "all")      p.set("platform", platform)
      if (status !== "all")        p.set("status", status)
      if (discountType !== "all")  p.set("discountType", discountType)

      const res = await fetch(`/api/admin/coupons?${p}`)
      if (!res.ok) throw new Error("fetch error")
      const { data, total: t } = await res.json() as { data: Coupon[]; total: number }
      setCoupons(data)
      setTotal(t)
    } catch {
      setCoupons([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedSearch, platform, status, discountType, sort])

  useEffect(() => { load() }, [load])

  const handleToggle = async (id: string, isActive: boolean) => {
    setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !isActive } : c))
    await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    }).catch(() => {
      setCoupons((prev) => prev.map((c) => c.id === id ? { ...c, isActive } : c))
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/admin/coupons/${deleteTarget.id}`, { method: "DELETE" })
      setCoupons((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      setTotal((t) => t - 1)
      success("Đã xóa coupon")
      setDeleteTarget(null)
    } catch {
      toastError("Không thể xóa coupon")
    } finally {
      setDeleting(false)
    }
  }

  const handleAdd = async () => {
    setAddSaving(true)
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: addForm.merchant,
          platform: addForm.platform || null,
          code: addForm.code || null,
          description: addForm.description,
          terms: addForm.terms || null,
          imageUrl: addForm.imageUrl || null,
          discountValue: Number(addForm.discountValue),
          discountType: addForm.discountType,
          minOrderValue: addForm.minOrderValue ? Number(addForm.minOrderValue) : null,
          maxDiscount: addForm.maxDiscount ? Number(addForm.maxDiscount) : null,
          affiliateUrl: addForm.affiliateUrl,
          expiresAt: addForm.expiresAt ? new Date(addForm.expiresAt).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi")
      success("Đã thêm coupon")
      setShowAdd(false)
      setAddForm(EMPTY_FORM)
      load()
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Thao tác thất bại")
    } finally {
      setAddSaving(false)
    }
  }

  const handleEditOpen = (c: Coupon) => {
    setEditTarget(c)
    setEditForm({
      merchant: c.merchant,
      platform: c.platform ?? "",
      code: c.code ?? "",
      description: c.description,
      terms: c.terms ?? "",
      imageUrl: c.imageUrl ?? "",
      discountValue: String(c.discountValue),
      discountType: c.discountType,
      minOrderValue: c.minOrderValue != null ? String(c.minOrderValue) : "",
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      affiliateUrl: c.affiliateUrl,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 16) : "",
    })
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/coupons/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: editForm.merchant,
          platform: editForm.platform || null,
          code: editForm.code || null,
          description: editForm.description,
          terms: editForm.terms || null,
          imageUrl: editForm.imageUrl || null,
          discountValue: Number(editForm.discountValue),
          discountType: editForm.discountType,
          minOrderValue: editForm.minOrderValue ? Number(editForm.minOrderValue) : null,
          maxDiscount: editForm.maxDiscount ? Number(editForm.maxDiscount) : null,
          affiliateUrl: editForm.affiliateUrl,
          expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi")
      success("Đã cập nhật coupon")
      setCoupons((prev) => prev.map((c) => c.id === editTarget.id ? {
        ...c,
        merchant: editForm.merchant,
        platform: editForm.platform || null,
        code: editForm.code || null,
        description: editForm.description,
        terms: editForm.terms || null,
        imageUrl: editForm.imageUrl || null,
        discountValue: Number(editForm.discountValue),
        discountType: editForm.discountType,
        minOrderValue: editForm.minOrderValue ? Number(editForm.minOrderValue) : null,
        maxDiscount: editForm.maxDiscount ? Number(editForm.maxDiscount) : null,
        affiliateUrl: editForm.affiliateUrl,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      } : c))
      setEditTarget(null)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Thao tác thất bại")
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
      <AdminPageShell
        title="Mã giảm giá"
        subtitle="Quản lý coupon và mã khuyến mãi affiliate."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>
            Thêm thủ công
          </Button>
        }
      />

      <AdminFilterBar
        search={{
          value: search,
          onChange: (v) => setSearch(v),
          onSearch: () => { setAppliedSearch(search); setPage(1) },
          placeholder: "Merchant, mã code, mô tả...",
          id: "coupons-search",
        }}
        filters={
          <>
            <FilterSelect
              label="Platform"
              value={platform}
              onChange={(v) => { setPlatform(v); setPage(1) }}
              options={platformOptions}
              id="filter-platform"
            />
            <FilterSelect
              label="Trạng thái"
              value={status}
              onChange={(v) => { setStatus(v); setPage(1) }}
              options={STATUS_OPTIONS}
              id="filter-status"
            />
            <FilterSelect
              label="Loại giảm"
              value={discountType}
              onChange={(v) => { setDiscountType(v); setPage(1) }}
              options={DISCOUNT_TYPE_OPTIONS}
              id="filter-discount-type"
            />
            <FilterSelect
              label="Sắp xếp"
              value={sort}
              onChange={(v) => { setSort(v); setPage(1) }}
              options={SORT_OPTIONS}
              id="filter-sort"
            />
          </>
        }
        actions={
          <Button variant="secondary" icon={Search} onClick={() => { setAppliedSearch(search); setPage(1) }}>
            Tìm
          </Button>
        }
      />

      <DataTable
        columns={COLUMNS}
        loading={loading}
        empty={!loading && coupons.length === 0}
        emptyIcon={Tag}
        emptyTitle="Không tìm thấy coupon"
        emptyDescription="Thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm."
      >
        {coupons.map((c) => {
          const plKey = c.platform ?? c.source
          return (
            <DataTableRow key={c.id}>
              {/* Merchant / Mô tả */}
              <DataTableCell>
                <p className="font-sans text-[14px] text-[#1a1c1b] truncate max-w-[220px]">{c.merchant}</p>
                <p className="font-mono text-[11px] text-[#5c403a] truncate max-w-[220px] mt-0.5">{c.description}</p>
              </DataTableCell>

              {/* Mã */}
              <DataTableCell>
                {c.code ? (
                  <span className="font-mono text-xs font-bold text-[#b51c00] bg-[#fff4f2] px-2 py-0.5">{c.code}</span>
                ) : (
                  <span className="font-mono text-[10px] text-[#906f69]">click-only</span>
                )}
              </DataTableCell>

              {/* Giảm */}
              <DataTableCell align="right">
                <span className="font-mono text-[13px] font-bold text-[#1a1c1b] bg-[#FFC93C] px-2 py-0.5 tabular-nums">
                  {fmtDiscount(c.discountValue, c.discountType)}
                </span>
              </DataTableCell>

              {/* Platform */}
              <DataTableCell align="center">
                <PlatformBadge slug={plKey} badges={platformBadges} />
              </DataTableCell>

              {/* Hết hạn */}
              <DataTableCell align="center">
                <span className="font-mono text-[11px] text-[#5c403a]">{fmtDate(c.expiresAt)}</span>
              </DataTableCell>

              {/* Clicks */}
              <DataTableCell align="right">
                <span className="font-mono text-[13px] tabular-nums text-[#1a1c1b]">{c.clickCount}</span>
              </DataTableCell>

              {/* Trạng thái */}
              <DataTableCell align="center">
                <button
                  onClick={() => handleToggle(c.id, c.isActive)}
                  className="flex items-center gap-1.5 text-[#5c403a] hover:text-[#b51c00] transition-colors"
                >
                  {c.isActive
                    ? <ToggleRight className="size-5 text-green-600" />
                    : <ToggleLeft className="size-5 text-[#5c403a]" />}
                  <Badge tone={c.isActive ? "green" : "gray"}>
                    {c.isActive ? "Bật" : "Tắt"}
                  </Badge>
                </button>
              </DataTableCell>

              {/* Thao tác */}
              <DataTableCell align="right">
                <div className="flex items-center justify-end gap-0.5">
                  <a
                    href={c.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-[#5c403a] hover:text-[#b51c00] transition-colors"
                    aria-label="Mở link affiliate"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => handleEditOpen(c)} aria-label="Sửa" />
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleteTarget(c)} aria-label="Xóa" className="hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20" />
                </div>
              </DataTableCell>
            </DataTableRow>
          )
        })}
      </DataTable>

      <DataTablePagination
        page={page}
        total={total}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        label="coupon"
      />

      {/* Thêm coupon */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }}
        title="Thêm coupon thủ công"
        size="2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM) }} disabled={addSaving}>Hủy</Button>
            <Button variant="primary" onClick={handleAdd} loading={addSaving} disabled={!addForm.merchant.trim() || !addForm.description.trim() || !addForm.discountValue || !addForm.affiliateUrl.trim()}>
              Lưu
            </Button>
          </>
        }
      >
        <CouponForm form={addForm} setForm={setAddForm} />
      </Modal>

      {/* Sửa coupon */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Chỉnh sửa coupon"
        size="2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)} disabled={editSaving}>Hủy</Button>
            <Button variant="primary" onClick={handleEditSave} loading={editSaving} disabled={!editForm.merchant.trim() || !editForm.description.trim()}>
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <CouponForm form={editForm} setForm={setEditForm} />
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa coupon"
        icon={AlertTriangle}
        message={`Bạn có chắc muốn xóa coupon của "${deleteTarget?.merchant}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        confirmIcon={Trash2}
        danger
        loading={deleting}
      />
    </div>
  )
}

const FORM_INPUT_CLS = "w-full border border-[#e5beb6] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#c9b4ae] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
const FORM_LABEL_CLS = "block font-mono text-[11px] tracking-[0.08em] font-semibold text-[#906f69] mb-1 uppercase"

function CouponForm({
  form,
  setForm,
}: {
  form: typeof EMPTY_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
}) {
  return (
    <div className="flex gap-5 min-h-0">

      {/* ── Left: form fields ──────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3">

        {/* Row 1: Merchant + Platform + Code */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={FORM_LABEL_CLS}>MERCHANT *</label>
            <input
              value={form.merchant}
              onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
              placeholder="Tên thương hiệu"
              className={FORM_INPUT_CLS}
            />
          </div>
          <div>
            <label className={FORM_LABEL_CLS}>PLATFORM</label>
            <select
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              className={FORM_INPUT_CLS}
            >
              <option value="">Không rõ</option>
              {PLATFORM_FORM_OPTS.map((p) => (
                <option key={p} value={p}>{p.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={FORM_LABEL_CLS}>MÃ CODE</label>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="Để trống nếu click-only"
              className={`${FORM_INPUT_CLS} ${form.code ? "font-bold border-[#fdc73a] bg-[#fffbf0] text-[#6f5400]" : ""}`}
            />
          </div>
        </div>

        {/* Row 2: Mô tả */}
        <div>
          <label className={FORM_LABEL_CLS}>MÔ TẢ *</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Đồng giá 39.000đ, giảm 30%..."
            className={FORM_INPUT_CLS}
          />
        </div>

        {/* Row 3: Điều kiện */}
        <div>
          <label className={FORM_LABEL_CLS}>ĐIỀU KIỆN SỬ DỤNG</label>
          <textarea
            value={form.terms}
            onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
            placeholder="Áp dụng cho đơn từ 200.000đ, không áp dụng cùng KM khác..."
            rows={2}
            className={`${FORM_INPUT_CLS} resize-none`}
          />
        </div>

        {/* Row 4: Mức giảm + Đơn tối thiểu + Giảm tối đa */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={FORM_LABEL_CLS}>MỨC GIẢM *</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={1}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                className={`${FORM_INPUT_CLS} tabular-nums`}
              />
              <select
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percent" | "fixed" }))}
                className="border border-[#e5beb6] bg-white px-2 py-2 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] shrink-0"
              >
                <option value="percent">%</option>
                <option value="fixed">đ</option>
              </select>
            </div>
          </div>
          <div>
            <label className={FORM_LABEL_CLS}>ĐƠN TỐI THIỂU (đ)</label>
            <input
              type="number"
              value={form.minOrderValue}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
              className={`${FORM_INPUT_CLS} tabular-nums`}
            />
          </div>
          <div>
            <label className={FORM_LABEL_CLS}>GIẢM TỐI ĐA (đ)</label>
            <input
              type="number"
              value={form.maxDiscount}
              onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
              className={`${FORM_INPUT_CLS} tabular-nums`}
            />
          </div>
        </div>

        {/* Row 5: Affiliate URL + Hết hạn */}
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <div>
            <label className={FORM_LABEL_CLS}>AFFILIATE URL *</label>
            <input
              type="url"
              value={form.affiliateUrl}
              onChange={(e) => setForm((f) => ({ ...f, affiliateUrl: e.target.value }))}
              placeholder="https://shorten.asia/..."
              className={FORM_INPUT_CLS}
            />
          </div>
          <div>
            <label className={FORM_LABEL_CLS}>HẾT HẠN</label>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className={FORM_INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* ── Right: image preview ───────────────────────────── */}
      <div className="w-[168px] shrink-0 flex flex-col gap-2">
        <div>
          <label className={FORM_LABEL_CLS}>ẢNH COUPON</label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            placeholder="https://..."
            className={FORM_INPUT_CLS}
          />
        </div>
        <div className="flex-1 border border-dashed border-[#e5beb6] bg-[#fafaf7] overflow-hidden flex items-center justify-center min-h-[140px]">
          {form.imageUrl ? (
            <img
              src={form.imageUrl}
              alt="Ảnh coupon"
              className="w-full h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block" }}
            />
          ) : (
            <span className="font-mono text-[10px] text-[#c9b4ae] text-center leading-relaxed px-2">
              Nhập URL<br />để xem ảnh
            </span>
          )}
        </div>
      </div>

    </div>
  )
}
