"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { Plus, Save, ImageIcon, ArrowDown } from "lucide-react"
import { createProduct, fetchProductById, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import { useToast } from "./Toast"
import { Modal } from "./Modal"
import { Button } from "./Button"
import type { Product } from "@/types"

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  productId?: string
  onSaved: (product: Product) => void
}

const EMPTY_FORM = {
  imageUrl: "",
  name: "",
  categoryId: "",
  productUrl: "",
  affiliateUrl: "",
  price: "",
  commission: "",
  discountPct: "",
  rating: 0,
  isFeatured: false,
  isSoldOut: false,
}

export function ProductFormModal({ open, onClose, productId, onSaved }: ProductFormModalProps) {
  const isEdit = Boolean(productId)
  const { success, error: toastError } = useToast()
  const { data: categories } = useCategories()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [urlError, setUrlError] = useState("")
  const [form, setForm] = useState(EMPTY_FORM)

  const set = (key: keyof typeof EMPTY_FORM, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Load product data when editing
  useEffect(() => {
    if (!open) return
    if (!isEdit || !productId) {
      setForm(EMPTY_FORM)
      setUrlError("")
      return
    }
    setLoading(true)
    fetchProductById(productId)
      .then((p) => {
        setForm({
          imageUrl: p.imageUrl,
          name: p.name,
          categoryId: p.categoryId,
          productUrl: p.productUrl,
          affiliateUrl: p.affiliateUrl ?? "",
          price: p.price.toLocaleString("vi-VN"),
          commission: p.commission.toLocaleString("vi-VN"),
          discountPct: p.discountPct ? String(p.discountPct) : "",
          rating: p.rating,
          isFeatured: p.isFeatured,
          isSoldOut: p.isSoldOut,
        })
        setUrlError("")
      })
      .catch(() => toastError("Không thể tải dữ liệu sản phẩm"))
      .finally(() => setLoading(false))
  }, [open, productId, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    const trimmedUrl = form.imageUrl.trim()
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setUrlError("URL phải bắt đầu bằng http:// hoặc https://")
      return
    }
    const price = parseInt(form.price.replace(/\./g, ""), 10)
    if (isNaN(price)) {
      toastError("Giá không hợp lệ")
      return
    }
    if (!form.name.trim()) {
      toastError("Tên sản phẩm không được trống")
      return
    }
    if (!form.productUrl.trim()) {
      toastError("Link gốc sản phẩm không được trống")
      return
    }

    const commissionVal = parseInt(form.commission.replace(/\./g, ""), 10) || 0
    const discountVal = parseInt(form.discountPct, 10) || 0
    const affiliateUrlTrimmed = form.affiliateUrl.trim()

    const payload = {
      name: form.name.trim(),
      price,
      commission: commissionVal,
      rating: form.rating,
      discountPct: discountVal > 0 ? discountVal : null,
      imageUrl: trimmedUrl,
      imageAlt: form.name.trim(),
      productUrl: form.productUrl.trim(),
      affiliateUrl: affiliateUrlTrimmed || null,
      categoryId: form.categoryId || categories?.[0]?.id || "",
      isFeatured: form.isFeatured,
      isSoldOut: form.isSoldOut,
    }

    setSaving(true)
    try {
      let result: Product
      if (isEdit && productId) {
        result = await updateProduct(productId, payload)
        success("Cập nhật sản phẩm thành công!")
      } else {
        result = await createProduct(payload)
        success("Thêm sản phẩm thành công!")
      }
      onSaved(result)
      onClose()
    } catch {
      toastError(isEdit ? "Cập nhật sản phẩm thất bại" : "Thêm sản phẩm thất bại")
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose} disabled={saving}>
        Hủy
      </Button>
      <Button
        variant="primary"
        icon={isEdit ? Save : Plus}
        onClick={handleSave}
        loading={saving}
        disabled={loading}
      >
        {isEdit ? "Lưu thay đổi" : "Thêm sản phẩm"}
      </Button>
    </>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
      icon={isEdit ? Save : Plus}
      size="lg"
      footer={footer}
    >
      {loading ? (
        <div className="py-12 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-[#e2e3e0] rounded w-3/4 mx-auto" />
            <div className="h-4 bg-[#e2e3e0] rounded w-1/2 mx-auto" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Image URL */}
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5">
              Ảnh sản phẩm (URL)
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => { set("imageUrl", e.target.value); setUrlError("") }}
              placeholder="https://..."
              className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
            />
            {urlError && <p className="font-mono text-[11px] text-[#ba1a1a] mt-1">{urlError}</p>}
            {form.imageUrl && !urlError && (
              <div className="relative aspect-[4/3] bg-[#e2e3e0] overflow-hidden border border-[#e5e1d8] mt-2 clip-bevel-sm max-h-40">
                <Image
                  src={form.imageUrl}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            )}
            {!form.imageUrl && (
              <div className="flex items-center justify-center h-16 border border-dashed border-[#e5e1d8] mt-2 bg-[#fafaf7]">
                <div className="flex items-center gap-2 text-[#5c403a]/40">
                  <ImageIcon className="size-4" aria-hidden="true" />
                  <span className="font-mono text-[11px]">Chưa có ảnh</span>
                </div>
              </div>
            )}
          </div>

          {/* 2-column: Name + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-name">
                Tên sản phẩm <span className="text-[#b51c00]">*</span>
              </label>
              <input
                id="pf-name"
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-sans text-[14px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-category">
                Danh mục
              </label>
              <div className="relative">
                <select
                  id="pf-category"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  className="w-full appearance-none border border-[#e5e1d8] bg-white px-3 py-2 pr-8 font-sans text-[14px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
                >
                  {categories?.map((cat: { id: string; name: string }) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ArrowDown className="size-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5c403a]" aria-hidden="true" />
              </div>
            </div>
          </div>

          {/* Product URL + Affiliate URL — 2 trường riêng */}
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-product-url">
              Link gốc sản phẩm <span className="text-[#b51c00]">*</span>
            </label>
            <input
              id="pf-product-url"
              type="url"
              value={form.productUrl}
              onChange={(e) => set("productUrl", e.target.value)}
              placeholder="https://kingfoodmart.com/san-pham/..."
              className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase" htmlFor="pf-affiliate-url">
                Link affiliate (AT tracking)
              </label>
              {form.affiliateUrl && form.affiliateUrl !== form.productUrl ? (
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e8f5e9] text-[#1a6b3c] border border-[#1a6b3c]/20">✓ AT link</span>
              ) : (
                <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#fff3e0] text-[#c05800] border border-[#c05800]/20">⚠ Chưa có AT link</span>
              )}
            </div>
            <input
              id="pf-affiliate-url"
              type="url"
              value={form.affiliateUrl}
              onChange={(e) => set("affiliateUrl", e.target.value)}
              placeholder="https://shorten.asia/... (để trống nếu chưa có)"
              className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
            />
            <p className="font-mono text-[10px] text-[#906f69] mt-1">Nút &quot;Mua ngay&quot; dùng link này — cần AT link để có hoa hồng</p>
          </div>

          {/* 3-column: Price + Commission + Discount */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-price">
                Giá (VND) <span className="text-[#b51c00]">*</span>
              </label>
              <input
                id="pf-price"
                type="text"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="0"
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] tabular-nums text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-commission">
                Hoa hồng (VND)
              </label>
              <input
                id="pf-commission"
                type="text"
                value={form.commission}
                onChange={(e) => set("commission", e.target.value)}
                placeholder="0"
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] tabular-nums text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-discount">
                Giảm giá (%)
              </label>
              <input
                id="pf-discount"
                type="number"
                min={0}
                max={100}
                value={form.discountPct}
                onChange={(e) => set("discountPct", e.target.value)}
                placeholder="0"
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] tabular-nums text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5">
              Rating
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => set("rating", star === Math.ceil(form.rating) ? (form.rating % 1 >= 0.25 ? Math.ceil(form.rating) : Math.ceil(form.rating) - 0.5) : star > form.rating ? star - 0.5 : star)}
                    className={`size-7 flex items-center justify-center text-lg transition-colors ${
                      star <= form.rating ? "text-[#f59e0b]" : star - 0.5 <= form.rating ? "text-[#f59e0b] opacity-60" : "text-[#e2e3e0]"
                    }`}
                    aria-label={`${star} sao`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.rating}
                onChange={(e) => set("rating", Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-16 border border-[#e5e1d8] bg-white px-2 py-1 font-mono text-[13px] tabular-nums text-center text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
              <span className="font-mono text-[12px] text-[#76737b]">/ 5</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 py-3 border-y border-dashed border-[#e5e1d8]">
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Nổi bật</span>
              <div className="relative">
                <input type="checkbox" checked={form.isFeatured} onChange={() => set("isFeatured", !form.isFeatured)} className="sr-only peer" />
                <div className="w-10 h-5 bg-[#e2e3e0] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:size-4 after:transition-all peer-checked:bg-[#FF4D2D]" />
              </div>
              <span className="font-mono text-[11px] text-[#1a1c1b]">{form.isFeatured ? "Có" : "Không"}</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Hết hàng</span>
              <div className="relative">
                <input type="checkbox" checked={form.isSoldOut} onChange={() => set("isSoldOut", !form.isSoldOut)} className="sr-only peer" />
                <div className="w-10 h-5 bg-[#e2e3e0] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:size-4 after:transition-all peer-checked:bg-[#ba1a1a]" />
              </div>
              <span className="font-mono text-[11px] text-[#1a1c1b]">{form.isSoldOut ? "Có" : "Không"}</span>
            </label>
          </div>
        </div>
      )}
    </Modal>
  )
}
