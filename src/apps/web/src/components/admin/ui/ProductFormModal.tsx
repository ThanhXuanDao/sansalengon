"use client"

import Image from "next/image"
import { useState, useEffect } from "react"
import { Plus, Save, ImageIcon, ArrowDown, RefreshCw, Loader2, Copy, Wand2 } from "lucide-react"
import { createProduct, fetchProductById, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import { useSources } from "@/hooks/useSources"
import { useCampaigns } from "@/hooks/useCampaigns"
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


const EXTENSION_INSTALL_PATH = "src/apps/extension"

const EMPTY_FORM = {
  imageUrl: "",
  name: "",
  categoryId: "",
  source: "manual",
  productUrl: "",
  platformAffiliateUrl: "",
  affiliateUrl: "",
  atCampaignId: "",
  price: "",
  commission: "",
  discountPct: "",
  rating: 0,
  isFeatured: false,
  isSoldOut: false,
}


function matchCategoryHint(hint: string | null, cats: { id: string; name: string }[]): string {
  if (!hint || cats.length === 0) return ""
  const lower = hint.toLowerCase()
  const exact = cats.find((c) => c.name.toLowerCase() === lower)
  if (exact) return exact.id
  const partial = cats.find((c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()))
  return partial?.id ?? ""
}

export function ProductFormModal({ open, onClose, productId, onSaved }: ProductFormModalProps) {
  const isEdit = Boolean(productId)
  const { success, error: toastError } = useToast()
  const { data: categories } = useCategories()
  const { data: syncSources } = useSources()
  const { data: campaigns } = useCampaigns()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [urlError, setUrlError] = useState("")
  const [form, setForm] = useState(EMPTY_FORM)
  const [shopeeExtLoading, setShopeeExtLoading] = useState(false)
  const [shopeeExtMissing, setShopeeExtMissing] = useState(false)
  const [generatingAt, setGeneratingAt] = useState(false)

  const set = (key: keyof typeof EMPTY_FORM, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Load product data when editing
  useEffect(() => {
    if (!open) return
    setShopeeExtLoading(false)
    setShopeeExtMissing(false)
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
          source: p.source ?? "manual",
          productUrl: p.productUrl,
          platformAffiliateUrl: p.platformAffiliateUrl ?? "",
          affiliateUrl: p.affiliateUrl ?? "",
          atCampaignId: p.atCampaignId ?? "",
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

  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url)
      .then(() => success(`Đã copy ${label}!`))
      .catch(() => toastError("Không copy được"))
  }

  const handleSyncInfo = async () => {
    const url = form.platformAffiliateUrl.trim()
    if (!url) { toastError("Nhập Link platform affiliate trước"); return }

    // Mở popup Shopee sớm (synchronous trong click handler) để tránh popup blocker.
    // Popup sẽ được dùng nếu API server trả về OG data (price=0).
    const isShopeeUrl = /shopee\.vn|shope\.ee|s\.shopee/i.test(url)
    let popup: Window | null = null
    if (isShopeeUrl) {
      popup = window.open("about:blank", "shopee-affiliate-helper",
        "width=620,height=520,toolbar=0,menubar=0,location=0,scrollbars=1")
    }

    setSyncing(true)
    setShopeeExtMissing(false)
    try {
      const res = await fetch("/api/admin/products/fetch-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message ?? json?.error ?? "Sync thất bại")

      const info = json.info
      const priceIsUnknown = !info.price || info.price === 0
      setForm((prev) => ({
        ...prev,
        name: info.name || prev.name,
        imageUrl: info.imageUrl || prev.imageUrl,
        price: !priceIsUnknown ? String(info.price) : prev.price,
        discountPct: info.discountPct != null ? String(info.discountPct) : prev.discountPct,
        rating: info.rating ?? prev.rating,
        productUrl: info.shopUrl || prev.productUrl,
        source: info.source || prev.source,
        categoryId: prev.categoryId
          ? prev.categoryId
          : matchCategoryHint(info.categoryHint, categories ?? []),
      }))
      setUrlError("")

      if (priceIsUnknown && info.source === "shopee" && popup) {
        // Navigate popup đến trang sản phẩm Shopee với param kích hoạt extension
        const shopUrl = info.shopUrl || url
        const fetchUrl = shopUrl + (shopUrl.includes("?") ? "&" : "?") + "__affiliate_fetch=1"
        popup.location.href = fetchUrl
        setShopeeExtLoading(true)
        success("Đã lấy tên + ảnh — đang tự động lấy giá từ Shopee...")

        const extTimeout = setTimeout(() => {
          window.removeEventListener("message", msgHandler)
          popup?.close()
          setShopeeExtLoading(false)
          setShopeeExtMissing(true)
        }, 25000)

        function msgHandler(e: MessageEvent) {
          if (!e.data?.__affiliate) return
          window.removeEventListener("message", msgHandler)
          clearTimeout(extTimeout)
          setShopeeExtLoading(false)
          if (e.data.info) {
            const d = e.data.info as { price?: number; discountPct?: number | null; rating?: number | null; imageUrl?: string }
            setForm((prev) => ({
              ...prev,
              price: d.price && d.price > 0 ? String(d.price) : prev.price,
              discountPct: d.discountPct != null ? String(d.discountPct) : prev.discountPct,
              rating: d.rating ?? prev.rating,
              imageUrl: d.imageUrl || prev.imageUrl,
            }))
            success("Đã lấy đầy đủ thông tin từ Shopee!")
          } else {
            setShopeeExtMissing(true)
            toastError("Extension báo lỗi: " + (e.data.error ?? "unknown"))
          }
        }
        window.addEventListener("message", msgHandler)
      } else {
        popup?.close()
        success("Đã lấy thông tin sản phẩm!")
      }
    } catch (e: unknown) {
      popup?.close()
      setShopeeExtLoading(false)
      toastError(e instanceof Error ? e.message : "Không lấy được thông tin")
    } finally {
      setSyncing(false)
    }
  }

  const handleGenerateAtLink = async () => {
    const productUrl = form.productUrl.trim()
    if (!productUrl) { toastError("Nhập Link gốc sản phẩm trước"); return }
    setGeneratingAt(true)
    try {
      const res = await fetch("/api/admin/products/create-at-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl,
          ...(form.atCampaignId ? { campaignId: form.atCampaignId } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message ?? json?.error ?? "Tạo AT link thất bại")
      set("affiliateUrl", json.affiliateUrl)
      success("Đã tạo AT link!")
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : "Không tạo được AT link")
    } finally {
      setGeneratingAt(false)
    }
  }

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
    const platformAffiliateUrlTrimmed = form.platformAffiliateUrl.trim()

    const payload = {
      name: form.name.trim(),
      price,
      commission: commissionVal,
      rating: form.rating,
      discountPct: discountVal > 0 ? discountVal : null,
      imageUrl: trimmedUrl,
      imageAlt: form.name.trim(),
      productUrl: form.productUrl.trim(),
      platformAffiliateUrl: platformAffiliateUrlTrimmed || null,
      affiliateUrl: affiliateUrlTrimmed || null,
      categoryId: form.categoryId || categories?.[0]?.id || "",
      source: form.source,
      isFeatured: form.isFeatured,
      isSoldOut: form.isSoldOut,
      atCampaignId: form.atCampaignId || null,
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
      size="2xl"
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
        <div className="grid grid-cols-[1fr_220px] gap-6 items-start">

          {/* ── Cột trái: form fields ─────────────────────────────── */}
          <div className="space-y-5">

            {/* Name */}
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

            {/* Product URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase" htmlFor="pf-product-url">
                  Link gốc sản phẩm <span className="text-[#b51c00]">*</span>
                </label>
                {form.productUrl && (
                  <button
                    type="button"
                    onClick={() => copyLink(form.productUrl, "Link gốc")}
                    className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] border border-[#e5e1d8] text-[#5c403a] bg-white hover:bg-[#5c403a] hover:text-white transition-colors cursor-copy"
                    title="Copy link gốc"
                  >
                    <Copy className="size-3" aria-hidden="true" />
                    Copy
                  </button>
                )}
              </div>
              <input
                id="pf-product-url"
                type="url"
                value={form.productUrl}
                onChange={(e) => set("productUrl", e.target.value)}
                placeholder="https://shopee.vn/..."
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[12px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
            </div>

            {/* Platform affiliate URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase" htmlFor="pf-platform-url">
                  Link platform affiliate
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncInfo}
                    disabled={syncing || !form.platformAffiliateUrl.trim()}
                    className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] border border-[#b51c00]/40 text-[#b51c00] bg-white hover:bg-[#b51c00] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#b51c00]"
                  >
                    <RefreshCw className={`size-3 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
                    {syncing ? "Đang lấy..." : "Sync info"}
                  </button>
                  {form.platformAffiliateUrl ? (
                    <button
                      type="button"
                      onClick={() => copyLink(form.platformAffiliateUrl, "Platform link")}
                      className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e3f2fd] text-[#0d5cb6] border border-[#0d5cb6]/20 hover:bg-[#0d5cb6] hover:text-white transition-colors cursor-copy"
                      title="Click để copy"
                    >✓ Platform link</button>
                  ) : (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#f4f4f1] text-[#76737b] border border-[#e5e1d8]">Chưa có</span>
                  )}
                </div>
              </div>
              <input
                id="pf-platform-url"
                type="url"
                value={form.platformAffiliateUrl}
                onChange={(e) => set("platformAffiliateUrl", e.target.value)}
                placeholder="https://shope.ee/... hoặc https://c.lazada.vn/t/..."
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[12px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
              <p className="font-mono text-[10px] text-[#906f69] mt-1">Link affiliate của Shopee / Lazada — hoa hồng qua platform của họ</p>
            </div>

            {/* AT Campaign */}
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-at-campaign">
                AT Campaign
              </label>
              <div className="relative">
                <select
                  id="pf-at-campaign"
                  value={form.atCampaignId}
                  onChange={(e) => set("atCampaignId", e.target.value)}
                  className="w-full appearance-none border border-[#e5e1d8] bg-white px-3 py-2 pr-8 font-sans text-[14px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
                >
                  <option value="">(tự động theo nguồn)</option>
                  {campaigns?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ArrowDown className="size-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5c403a]" aria-hidden="true" />
              </div>
              <p className="font-mono text-[10px] text-[#906f69] mt-1">Campaign dùng khi tạo AT link — bỏ trống để hệ thống tự chọn</p>
            </div>

            {/* AT affiliate URL */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase" htmlFor="pf-affiliate-url">
                  Link AccessTrade (AT)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGenerateAtLink}
                    disabled={generatingAt || !form.productUrl.trim()}
                    className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] tracking-[0.04em] border border-[#1a6b3c]/50 text-[#1a6b3c] bg-white hover:bg-[#1a6b3c] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-[#1a6b3c]"
                    title="Tạo AT tracking link từ Link gốc sản phẩm"
                  >
                    {generatingAt
                      ? <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      : <Wand2 className="size-3" aria-hidden="true" />
                    }
                    {generatingAt ? "Đang tạo..." : "Tạo AT link"}
                  </button>
                  {form.affiliateUrl ? (
                    <button
                      type="button"
                      onClick={() => copyLink(form.affiliateUrl, "AT link")}
                      className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e8f5e9] text-[#1a6b3c] border border-[#1a6b3c]/20 hover:bg-[#1a6b3c] hover:text-white transition-colors cursor-copy"
                      title="Click để copy"
                    >✓ AT link</button>
                  ) : (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#fff3e0] text-[#c05800] border border-[#c05800]/20">⚠ Chưa có</span>
                  )}
                </div>
              </div>
              <input
                id="pf-affiliate-url"
                type="url"
                value={form.affiliateUrl}
                onChange={(e) => set("affiliateUrl", e.target.value)}
                placeholder="https://www.accesstrade.vn/in_v2?..."
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[12px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
              <p className="font-mono text-[10px] text-[#906f69] mt-1">AccessTrade tracking link — nút &quot;Mua ngay&quot; ưu tiên dùng link này</p>
            </div>

            {/* Shopee auto-fetch status */}
            {shopeeExtLoading && (
              <div className="border border-[#3b82f6]/40 bg-[#eff6ff] px-3 py-2.5 flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin text-[#1d4ed8] shrink-0" aria-hidden="true" />
                <p className="font-mono text-[11px] text-[#1d4ed8]">
                  Đang tự động lấy giá từ Shopee...
                </p>
              </div>
            )}
            {shopeeExtMissing && (
              <div className="border border-[#f59e0b]/50 bg-[#fffbeb] p-3 space-y-1.5">
                <p className="font-mono text-[11px] text-[#92400e] font-semibold">
                  Cài extension Chrome để tự động lấy giá (1 lần duy nhất):
                </p>
                <ol className="font-mono text-[10px] text-[#92400e] space-y-0.5 list-decimal list-inside">
                  <li>Chrome → <code className="bg-[#fef3c7] px-1">chrome://extensions</code> → bật <em>Developer mode</em></li>
                  <li>Click <em>Load unpacked</em> → chọn thư mục <code className="bg-[#fef3c7] px-1">{EXTENSION_INSTALL_PATH}</code> trong project</li>
                  <li>Quay lại đây → click <strong>Sync info</strong> lại — sẽ tự động!</li>
                </ol>
              </div>
            )}

            {/* Price + Commission + Discount */}
            <div className="grid grid-cols-3 gap-3">
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
                  Giảm (%)
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

          </div>

          {/* ── Cột phải: danh mục, nguồn, ảnh, rating, toggles ──── */}
          <div className="flex flex-col gap-4">

            {/* Category */}
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-category">
                Danh mục
              </label>
              <div className="relative">
                <select
                  id="pf-category"
                  value={form.categoryId}
                  onChange={(e) => set("categoryId", e.target.value)}
                  className="w-full appearance-none border border-[#e5e1d8] bg-white px-3 py-2 pr-8 font-sans text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
                >
                  {categories?.map((cat: { id: string; name: string }) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ArrowDown className="size-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5c403a]" aria-hidden="true" />
              </div>
            </div>

            {/* Source */}
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5" htmlFor="pf-source">
                Nguồn
              </label>
              <div className="relative">
                <select
                  id="pf-source"
                  value={form.source}
                  onChange={(e) => set("source", e.target.value)}
                  className="w-full appearance-none border border-[#e5e1d8] bg-white px-3 py-2 pr-8 font-sans text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
                >
                  {syncSources?.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.name}</option>
                  ))}
                  <option value="manual">Thủ công</option>
                </select>
                <ArrowDown className="size-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5c403a]" aria-hidden="true" />
              </div>
            </div>

            {/* Image URL input */}
            <div>
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1.5">
                Ảnh (URL)
              </label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => { set("imageUrl", e.target.value); setUrlError("") }}
                placeholder="https://..."
                className="w-full border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[11px] text-[#1a1c1b] placeholder:text-[#906f69] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
              />
              {urlError && <p className="font-mono text-[10px] text-[#ba1a1a] mt-1">{urlError}</p>}
            </div>

            {/* Image preview */}
            {form.imageUrl && !urlError ? (
              <div className="relative aspect-square bg-[#f4f4f1] overflow-hidden border border-[#e5e1d8] clip-bevel-sm">
                <Image
                  src={form.imageUrl}
                  alt="Preview"
                  fill
                  className="object-contain p-2"
                  unoptimized
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center border border-dashed border-[#e5e1d8] bg-[#fafaf7] clip-bevel-sm">
                <div className="flex flex-col items-center gap-1.5 text-[#5c403a]/40">
                  <ImageIcon className="size-8" aria-hidden="true" />
                  <span className="font-mono text-[10px]">Chưa có ảnh</span>
                </div>
              </div>
            )}

            {/* Rating */}
            <div className="border-t border-dashed border-[#e5e1d8] pt-4">
              <label className="block font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-2">
                Rating
              </label>
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => set("rating", star === Math.ceil(form.rating) ? (form.rating % 1 >= 0.25 ? Math.ceil(form.rating) : Math.ceil(form.rating) - 0.5) : star > form.rating ? star - 0.5 : star)}
                    className={`size-6 flex items-center justify-center text-base transition-colors ${
                      star <= form.rating ? "text-[#f59e0b]" : star - 0.5 <= form.rating ? "text-[#f59e0b] opacity-60" : "text-[#e2e3e0]"
                    }`}
                    aria-label={`${star} sao`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={form.rating}
                  onChange={(e) => set("rating", Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-14 border border-[#e5e1d8] bg-white px-2 py-1 font-mono text-[13px] tabular-nums text-center text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
                />
                <span className="font-mono text-[11px] text-[#76737b]">/ 5</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="border-t border-dashed border-[#e5e1d8] pt-4 flex flex-row gap-4">
              <label className="flex flex-col gap-1.5 cursor-pointer">
                <span className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Nổi bật</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="checkbox" checked={form.isFeatured} onChange={() => set("isFeatured", !form.isFeatured)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-[#e2e3e0] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:size-4 after:transition-all peer-checked:bg-[#FF4D2D]" />
                  </div>
                  <span className="font-mono text-[11px] text-[#1a1c1b]">{form.isFeatured ? "Có" : "Không"}</span>
                </div>
              </label>
              <label className="flex flex-col gap-1.5 cursor-pointer">
                <span className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Hết hàng</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input type="checkbox" checked={form.isSoldOut} onChange={() => set("isSoldOut", !form.isSoldOut)} className="sr-only peer" />
                    <div className="w-9 h-5 bg-[#e2e3e0] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:size-4 after:transition-all peer-checked:bg-[#ba1a1a]" />
                  </div>
                  <span className="font-mono text-[11px] text-[#1a1c1b]">{form.isSoldOut ? "Có" : "Không"}</span>
                </div>
              </label>
            </div>

          </div>
        </div>
      )}
    </Modal>
  )
}
