"use client"

import Image from "next/image"
import { Save, ArrowDown, ImageIcon } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { fetchProductById, updateProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"
import type { Product } from "@/types"
import { useToast } from "@/components/admin/ui"

const SOURCE_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  tiki:        { label: "Tiki",        bg: "bg-[#e3f2fd]", text: "text-[#0d5cb6]" },
  shopee:      { label: "Shopee",      bg: "bg-[#fff3e0]", text: "text-[#c05800]" },
  accesstrade: { label: "AccessTrade", bg: "bg-[#f3e8ff]", text: "text-[#7c3aed]" },
  lazada:      { label: "Lazada",      bg: "bg-[#e8f5e9]", text: "text-[#1a6b3c]" },
  cellphones:  { label: "CellphoneS",  bg: "bg-[#fce4ec]", text: "text-[#c2185b]" },
  kingfoodmart: { label: "KingFoodMart", bg: "bg-[#e8f5e9]", text: "text-[#2e7d32]" },
  manual:      { label: "Thủ công",    bg: "bg-[#f4f4f1]", text: "text-[#5c403a]" },
}

function SourceChip({ source, externalId }: { source: string; externalId?: string | null }) {
  const s = SOURCE_STYLE[source] ?? { label: source, bg: "bg-[#f4f4f1]", text: "text-[#5c403a]" }
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`inline-block px-3 py-1 font-mono text-[12px] font-bold uppercase ${s.bg} ${s.text}`}>
        {s.label}
      </span>
      {externalId && (
        <span className="font-mono text-[10px] text-[#906f69]">ID: {externalId.slice(0, 16)}</span>
      )}
    </div>
  )
}

export default function EditProduct() {
  const router = useRouter()
  const params = useParams()
  const [saving, setSaving] = useState(false)
  const { success, error: toastError } = useToast()

  const copyLink = (url: string, label: string) => {
    navigator.clipboard.writeText(url)
      .then(() => success(`Đã copy ${label}!`))
      .catch(() => toastError("Không copy được"))
  }
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [isFeatured, setIsFeatured] = useState(false)
  const [isSoldOut, setIsSoldOut] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [urlError, setUrlError] = useState("")
  const [commission, setCommission] = useState("")
  const [rating, setRating] = useState(0)
  const [discountPct, setDiscountPct] = useState("")
  const { data: categories } = useCategories()

  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const productUrlRef = useRef<HTMLInputElement>(null)
  const affiliateUrlRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = params?.id as string
    if (!id) return
    fetchProductById(id)
      .then((p) => {
        setProduct(p)
        setImageUrl(p.imageUrl)
        setIsFeatured(p.isFeatured)
        setIsSoldOut(p.isSoldOut)
        setCommission(p.commission.toLocaleString("vi-VN"))
        setRating(p.rating)
        setDiscountPct(p.discountPct ? String(p.discountPct) : "")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params?.id])

  const handleSave = async () => {
    if (!product) return
    const name = nameRef.current?.value || product.name
    const categoryId = categoryRef.current?.value || product.categoryId
    const productUrl = productUrlRef.current?.value || product.productUrl
    const affiliateUrl = affiliateUrlRef.current?.value || product.affiliateUrl || ""
    const priceText = priceRef.current?.value || String(product.price)

    const trimmedUrl = imageUrl.trim()
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setUrlError("URL must start with http:// or https://")
      return
    }

    const price = parseInt(priceText.replace(/\./g, ""), 10)
    if (isNaN(price)) {
      toastError("Giá không hợp lệ")
      return
    }

    const commissionVal = parseInt(commission.replace(/\./g, ""), 10) || 0

    setSaving(true)
    try {
      const discountVal = parseInt(discountPct, 10) || 0
      await updateProduct(product.id, {
        name,
        price,
        commission: commissionVal,
        rating,
        discountPct: discountVal > 0 ? discountVal : null,
        imageUrl: trimmedUrl || product.imageUrl,
        imageAlt: name,
        productUrl,
        affiliateUrl: affiliateUrl || null,
        categoryId,
        isFeatured,
        isSoldOut,
      })
      success("Cập nhật sản phẩm thành công!")
    } catch {
      toastError("Cập nhật sản phẩm thất bại")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="w-full max-w-[480px] mx-auto bg-[#f9f9f6] border border-[#e5e1d8] relative p-8 text-center" aria-busy="true">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#e2e3e0] rounded w-3/4 mx-auto" />
          <div className="h-4 bg-[#e2e3e0] rounded w-1/2 mx-auto" />
        </div>
        <p className="font-mono text-[13px] text-[#5c403a] mt-4">Loading product…</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="w-full max-w-[480px] mx-auto bg-[#f9f9f6] border border-[#e5e1d8] relative p-8 text-center">
        <div role="status">
          <p className="font-mono text-[13px] text-[#5c403a]">Product not found</p>
          <p className="font-mono text-[11px] text-[#906f69] mt-2">The product you are looking for does not exist or has been removed.</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <main className="w-full max-w-[480px] mx-auto bg-[#f9f9f6] border border-[#e5e1d8] relative">
        <div className="p-8 pb-12">
          <header className="text-center mb-10">
            <h1 className="font-sans text-[32px] leading-[38px] tracking-[-0.01em] font-extrabold text-[#1a1c1b] uppercase">
              SanSaleNgon
            </h1>
            <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#76737b] mt-1 uppercase">
              Admin / Edit Product
            </p>
            <div className="w-full border-b-2 border-dashed border-[#e5e1d8] mt-6" />
          </header>

          <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1">Item No.</label>
                <p className="font-mono text-[16px] leading-[24px] font-bold">#{product.id}</p>
              </div>
              <div className="text-right">
                <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1">Nguồn</label>
                <SourceChip source={product.source} externalId={product.externalId} />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-3">
                Product Image
              </label>
              <div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => { setImageUrl(e.target.value); setUrlError("") }}
                  placeholder="https://down-id.img.susercontent.com/file/xxxxx"
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] placeholder:text-[#5c403a]/30 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
                />
                {urlError && (
                  <p className="font-mono text-[11px] text-[#ba1a1a] mt-1">{urlError}</p>
                )}
              </div>
              <div className="relative aspect-[4/3] bg-[#e2e3e0] overflow-hidden border border-[#e5e1d8] mt-3 clip-bevel-sm">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt="Product preview"
                    fill
                    className="object-cover"
                    unoptimized
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden") }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center ${imageUrl ? "hidden" : ""}`}>
                  <div className="text-center">
                    <ImageIcon className="size-10 mx-auto text-[#5c403a]/40" aria-hidden="true" />
                    <p className="font-mono text-[11px] text-[#5c403a]/40 mt-2">Preview</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1" htmlFor="productName">Product Name</label>
              <input ref={nameRef} id="productName" type="text" defaultValue={product.name}
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1" htmlFor="category">Category</label>
              <div className="relative">
                <select ref={categoryRef} id="category" defaultValue={product.categoryId}
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] appearance-none pr-8 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none">
                  {categories?.map((cat: { id: string; name: string }) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ArrowDown className="size-5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#1a1c1b]" aria-hidden="true" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[14px] leading-[16px] font-medium text-[#76737b]" htmlFor="productUrl">Link gốc sản phẩm</label>
                <a href={product.productUrl} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[#76737b] underline decoration-dashed underline-offset-2 hover:text-[#1a1c1b]">
                  Mở ↗
                </a>
              </div>
              <input ref={productUrlRef} id="productUrl" type="url" defaultValue={product.productUrl}
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[14px] leading-[20px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[14px] leading-[16px] font-medium text-[#76737b]" htmlFor="platformUrl">Link platform affiliate</label>
                {product.platformAffiliateUrl ? (
                  <button
                    type="button"
                    onClick={() => copyLink(product.platformAffiliateUrl!, "Platform link")}
                    className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e3f2fd] text-[#0d5cb6] border border-[#0d5cb6]/20 hover:bg-[#0d5cb6] hover:text-white transition-colors cursor-copy"
                    title="Click để copy"
                  >
                    ✓ Platform link
                  </button>
                ) : (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#f4f4f1] text-[#76737b] border border-[#e5e1d8]">Chưa có</span>
                )}
              </div>
              <input id="platformUrl" type="url" defaultValue={product.platformAffiliateUrl ?? ""}
                readOnly
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[14px] leading-[20px] text-[#1a1c1b] opacity-60 cursor-default focus:outline-none" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[14px] leading-[16px] font-medium text-[#76737b]" htmlFor="affiliateUrl">Link AccessTrade (AT)</label>
                {product.affiliateUrl && product.affiliateUrl !== product.productUrl ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyLink(product.affiliateUrl!, "AT link")}
                      className="font-mono text-[10px] px-1.5 py-0.5 bg-[#e8f5e9] text-[#1a6b3c] border border-[#1a6b3c]/20 hover:bg-[#1a6b3c] hover:text-white transition-colors cursor-copy"
                      title="Click để copy"
                    >
                      ✓ AT link
                    </button>
                    <a href={product.affiliateUrl} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[10px] text-[#76737b] underline decoration-dashed underline-offset-2 hover:text-[#1a1c1b]">
                      Mở ↗
                    </a>
                  </div>
                ) : (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#fff3e0] text-[#c05800] border border-[#c05800]/20">⚠ Chưa có AT link</span>
                )}
              </div>
              <input ref={affiliateUrlRef} id="affiliateUrl" type="url" defaultValue={product.affiliateUrl ?? ""}
                placeholder="https://shorten.asia/... hoặc AT tracking link"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[14px] leading-[20px] text-[#1a1c1b] placeholder:text-[#5c403a]/30 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              <p className="font-mono text-[11px] text-[#76737b] mt-1">Link dùng cho nút &quot;Mua ngay&quot; — nếu trống hoặc giống link gốc thì không có hoa hồng</p>
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1" htmlFor="price">Giá (VND)</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#b51c00]">Rp</span>
                <input ref={priceRef} id="price" type="text" defaultValue={product.price.toLocaleString("vi-VN")}
                  className="flex-1 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1" htmlFor="commission">
                Hoa hồng mỗi sản phẩm (VND)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#b51c00]">Rp</span>
                <input id="commission" type="text" value={commission} onChange={(e) => setCommission(e.target.value)}
                  placeholder="50.000"
                  className="flex-1 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/20 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-1" htmlFor="discount">
                Diskon (%)
              </label>
              <input id="discount" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[20px] leading-[28px] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/20 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <label className="block font-mono text-[14px] leading-[16px] font-medium text-[#76737b] mb-3" htmlFor="rating">
                Rating
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star === Math.ceil(rating) ? (rating % 1 >= 0.25 ? Math.ceil(rating) : Math.ceil(rating) - 0.5) : star > rating ? star - 0.5 : star)}
                      className={`size-8 flex items-center justify-center text-xl transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                        star <= rating ? "text-[#f59e0b]" : star - 0.5 <= rating ? "text-[#f59e0b] opacity-60" : "text-[#e2e3e0]"
                      }`}
                      aria-label={`Rating ${star} bintang`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <input
                  id="rating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={rating}
                  onChange={(e) => setRating(Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-20 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-1 font-mono text-[16px] leading-[24px] text-[#1a1c1b] text-center focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
                />
                <span className="font-mono text-[13px] text-[#76737b]">/ 5</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-4 border-y border-dashed border-[#e5e1d8] my-8">
              <span className="font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase">Featured</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isFeatured} onChange={() => setIsFeatured(!isFeatured)} className="sr-only peer" />
                <div className="w-14 h-7 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FF4D2D]" />
                <span className="ml-3 font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase text-[#1a1c1b]">{isFeatured ? "Yes" : "No"}</span>
              </label>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-dashed border-[#e5e1d8] -mt-6">
              <span className="font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase">Đánh dấu hết hàng</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isSoldOut} onChange={() => setIsSoldOut(!isSoldOut)} className="sr-only peer" />
                <div className="w-14 h-7 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#ba1a1a]" />
                <span className="ml-3 font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase text-[#1a1c1b]">{isSoldOut ? "Yes" : "No"}</span>
              </label>
            </div>

            <div className="pt-6 space-y-4">
              <button type="submit" disabled={saving}
                className="w-full bg-[#FF4D2D] text-[#1a1c1b] font-sans text-[20px] leading-[28px] font-bold py-4 px-6 rounded-full border border-[#1a1c1b] transition-all active:translate-y-0.5 active:translate-x-0.5 flex items-center justify-center disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                <Save className="size-5 mr-2" aria-hidden="true" />
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" onClick={() => router.back()}
                className="w-full bg-transparent text-[#5d5b62] font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase py-3 hover:text-[#1a1c1b] transition-colors underline decoration-dashed underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                Discard Edits
              </button>
            </div>
          </form>

          <div className="mt-12 text-center">
            <p className="font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase tracking-widest">*** END OF RECORD ***</p>
          </div>
        </div>
      </main>
    </>
  )
}
