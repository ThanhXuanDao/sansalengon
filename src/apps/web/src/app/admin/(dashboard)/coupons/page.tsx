"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight, Search,
  ExternalLink, ChevronDown, Tag, Zap,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import {
  Button,
  Alert,
  Spinner,
  EmptyState,
  Input,
  Select,
  Modal,
  ConfirmModal,
  useToast,
} from "@/components/admin/ui"

interface Coupon {
  id: string
  source: string
  platform: string | null
  merchant: string
  code: string | null
  description: string
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

const PLATFORM_OPTS = ["shopee", "tiki", "lazada"] as const

function fmtDiscount(v: number, t: "percent" | "fixed") {
  if (t === "percent") return `${v}%`
  return new Intl.NumberFormat("vi-VN").format(v) + "đ"
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit" })
}

const PLATFORM_CLR: Record<string, string> = {
  shopee:       "bg-orange-100 text-orange-700",
  tiki:         "bg-blue-100 text-blue-700",
  lazada:       "bg-purple-100 text-purple-700",
  manual:       "bg-gray-100 text-gray-600",
  accesstrade:  "bg-slate-100 text-slate-600",
}

const PAGE_SIZE = 30

const EMPTY_FORM = {
  merchant: "",
  platform: "" as string,
  code: "",
  description: "",
  discountValue: "",
  discountType: "percent" as "percent" | "fixed",
  minOrderValue: "",
  maxDiscount: "",
  affiliateUrl: "",
  expiresAt: "",
}

export default function AdminCouponsPage() {
  const { success, error: toastError } = useToast()
  const [coupons, setCoupons]     = useState<Coupon[]>([])
  const [total, setTotal]         = useState(0)
  const [skip, setSkip]           = useState(0)
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [q, setQ]                 = useState("")
  const [showAdd, setShowAdd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null)
  const [deleting, setDeleting]   = useState(false)

  const [form, setForm] = useState(EMPTY_FORM)

  const fetch_ = useCallback(async (currentSkip: number, search = "") => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        take: String(PAGE_SIZE),
        skip: String(currentSkip),
        niche: "all",
        sort: "value",
      })
      if (search) p.set("q", search)
      const res = await fetch(`/api/admin/coupons?${p}`)
      if (!res.ok) throw new Error("fetch error")
      const { data, total: t } = await res.json() as { data: Coupon[]; total: number }
      setCoupons(data)
      setTotal(t)
    } catch {
      // silent — show stale data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch_(0, q) }, [fetch_, q])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/admin/coupons/sync", { method: "POST" })
      const body = await res.json()
      if (res.ok) {
        success(`Sync xong — ${body.count ?? 0} coupons`)
        fetch_(0, q)
      } else {
        toastError(body.error ?? "Lỗi sync")
      }
    } catch {
      toastError("Lỗi kết nối")
    } finally {
      setSyncing(false)
    }
  }

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
      fetch_(skip, q)
    } finally {
      setDeleting(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: form.merchant,
          platform: form.platform || null,
          code: form.code || null,
          description: form.description,
          discountValue: Number(form.discountValue),
          discountType: form.discountType,
          minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
          maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
          affiliateUrl: form.affiliateUrl,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Lỗi")
      success("Đã thêm coupon")
      setShowAdd(false)
      setForm(EMPTY_FORM)
      fetch_(0, q)
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : "Thao tác thất bại")
    } finally {
      setSaving(false)
    }
  }

  const hasMore = coupons.length < total

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell
        title="Mã giảm giá"
        subtitle={`${total} coupon trong hệ thống`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              icon={syncing ? RefreshCw : Zap}
              onClick={handleSync}
              disabled={syncing}
              loading={syncing}
            >
              Sync ngay
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowAdd(true)}
            >
              Thêm thủ công
            </Button>
          </div>
        }
      />

      {/* Add coupon modal */}
      <Modal
        open={showAdd}
        onClose={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
        title="Thêm coupon thủ công"
        size="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }} disabled={saving}>Hủy</Button>
            <Button variant="primary" onClick={(e) => handleAdd(e as unknown as React.FormEvent)} loading={saving} disabled={!form.merchant.trim() || !form.description.trim()}>
              Lưu
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="MERCHANT *"
            value={form.merchant}
            onChange={(e) => setForm((f) => ({ ...f, merchant: e.target.value }))}
            placeholder="Tên merchant"
          />
          <Select
            label="PLATFORM"
            value={form.platform}
            onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
          >
            <option value="">Không rõ</option>
            {PLATFORM_OPTS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </Select>
          <Input
            label="MÃ CODE"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="SUMMER30"
          />
          <div className="sm:col-span-2">
            <Input
              label="MÔ TẢ *"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Giảm 30% cho đơn hàng thời trang"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">MỨC GIẢM *</label>
            <div className="flex gap-1">
              <input
                required
                type="number"
                min={1}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                className="flex-1 border border-[#e5beb6] px-3 py-1.5 font-mono text-sm text-[#1a1c1b] focus:outline-none focus:border-[#b51c00]"
              />
              <select
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percent" | "fixed" }))}
                className="border border-[#e5beb6] px-2 py-1.5 font-mono text-sm text-[#1a1c1b] focus:outline-none focus:border-[#b51c00]"
              >
                <option value="percent">%</option>
                <option value="fixed">đ</option>
              </select>
            </div>
          </div>
          <Input
            label="ĐƠN TỐI THIỂU (đ)"
            type="number"
            value={form.minOrderValue}
            onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
          />
          <Input
            label="GIẢM TỐI ĐA (đ)"
            type="number"
            value={form.maxDiscount}
            onChange={(e) => setForm((f) => ({ ...f, maxDiscount: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="AFFILIATE URL *"
              type="url"
              value={form.affiliateUrl}
              onChange={(e) => setForm((f) => ({ ...f, affiliateUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <Input
            label="HẾT HẠN"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5c403a]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm merchant, mã code..."
          className="w-full border border-[#e5beb6] pl-9 pr-4 py-2 font-mono text-sm text-[#1a1c1b] bg-white focus:outline-none focus:border-[#b51c00]"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-[#e5beb6] bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-[#e5beb6] bg-[#f9f9f6]">
              {["Merchant / Mô tả", "Mã", "Giảm", "Platform", "Hết hạn", "Clicks", "Trạng thái", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase text-[#5c403a] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <Spinner size="md" />
                </td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-4">
                  <EmptyState
                    icon={Tag}
                    title="Không có coupon nào"
                    description="Thêm coupon thủ công hoặc sync từ các nền tảng."
                    action={<Button variant="primary" icon={Plus} onClick={() => setShowAdd(true)}>Thêm coupon</Button>}
                  />
                </td>
              </tr>
            ) : coupons.map((c) => {
              const plKey = c.platform ?? c.source
              return (
                <tr key={c.id} className={`border-b border-dashed border-[#e5beb6] hover:bg-[#f9f9f6] transition-colors ${!c.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="font-bold text-[#1a1c1b] truncate">{c.merchant}</p>
                    <p className="font-mono text-[10px] text-[#5c403a] truncate mt-0.5">{c.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.code ? (
                      <span className="font-mono text-xs font-bold text-[#b51c00] bg-[#fff4f2] px-2 py-0.5">{c.code}</span>
                    ) : (
                      <span className="font-mono text-[10px] text-[#5c403a]">click-only</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#1a1c1b] whitespace-nowrap">
                    {fmtDiscount(c.discountValue, c.discountType)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${PLATFORM_CLR[plKey] ?? "bg-gray-100 text-gray-600"}`}>
                      {plKey}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-[#5c403a] whitespace-nowrap">
                    {fmtDate(c.expiresAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#5c403a]">
                    {c.clickCount}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(c.id, c.isActive)}
                      className="text-[#5c403a] hover:text-[#b51c00] transition-colors"
                      aria-label={c.isActive ? "Deactivate" : "Activate"}
                    >
                      {c.isActive
                        ? <ToggleRight className="size-5 text-green-600" />
                        : <ToggleLeft className="size-5 text-[#5c403a]" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <a href={c.affiliateUrl} target="_blank" rel="noopener noreferrer"
                        className="p-1 text-[#5c403a] hover:text-[#b51c00] transition-colors">
                        <ExternalLink className="size-3.5" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setDeleteTarget(c)}
                        aria-label="Xóa coupon"
                        className="hover:text-[#ba1a1a]"
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            icon={ChevronDown}
            onClick={() => {
              const nextSkip = skip + PAGE_SIZE
              setSkip(nextSkip)
              fetch_(nextSkip, q)
            }}
          >
            Xem thêm ({total - coupons.length} còn lại)
          </Button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa coupon"
        message={`Bạn có chắc muốn xóa coupon của "${deleteTarget?.merchant}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
      />
    </div>
  )
}
