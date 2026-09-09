"use client"

import Image from "next/image"
import { Save, ArrowDown, ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useRef } from "react"
import { createProduct } from "@/lib/services/products"
import { useCategories } from "@/hooks/useCategories"

export default function NewProduct() {
  const router = useRouter()
  const [status, setStatus] = useState(true)
  const [isSoldOut, setIsSoldOut] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [urlError, setUrlError] = useState("")
  const [showToast, setShowToast] = useState(false)
  const [saving, setSaving] = useState(false)
  const { data: categories } = useCategories()

  const [commission, setCommission] = useState("")
  const [rating, setRating] = useState(0)
  const [discountPct, setDiscountPct] = useState("")
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const linkRef = useRef<HTMLInputElement>(null)
  const priceRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    const name = nameRef.current?.value
    const categoryId = categoryRef.current?.value
    const shopeeUrl = linkRef.current?.value
    const priceText = priceRef.current?.value

    if (!name || !categoryId || !shopeeUrl || !priceText) {
      alert("Please fill in all required fields")
      return
    }

    const trimmedUrl = imageUrl.trim()
    if (trimmedUrl && !/^https?:\/\//i.test(trimmedUrl)) {
      setUrlError("URL must start with http:// or https://")
      return
    }

    const price = parseInt(priceText.replace(/\./g, ""), 10)
    if (isNaN(price)) {
      alert("Invalid price")
      return
    }

    setSaving(true)
    try {
      const commissionVal = parseInt(commission.replace(/\./g, ""), 10) || 0
      const discountVal = parseInt(discountPct, 10) || 0
      await createProduct({
        name,
        price,
        commission: commissionVal,
        rating,
        discountPct: discountVal > 0 ? discountVal : null,
        imageUrl: trimmedUrl || "https://picsum.photos/seed/" + Date.now() + "/400/400",
        imageAlt: name,
        shopeeUrl,
        categoryId,
        isFeatured: status,
        isSoldOut,
      })
      setShowToast(true)
      setTimeout(() => {
        setShowToast(false)
        router.push("/admin-shopby/products")
      }, 1500)
    } catch {
      alert("Failed to create product")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center bg-[#FFC93C] text-[#1a1c1b] border-2 border-[#1a1c1b] px-4 py-3 shadow-[4px_4px_0px_0px_rgba(26,28,27,1)] max-w-[440px] w-full mx-auto" role="alert" aria-live="polite">
          <Save className="size-6 mr-3 font-bold" aria-hidden="true" />
          <span className="font-mono text-[13px] tracking-[0.05em] uppercase">Product link created successfully!</span>
        </div>
      )}

      <main className="w-full max-w-[480px] mx-auto bg-[#f9f9f6] border border-[#e5e1d8] relative">
        <div className="p-8 pb-12">
          <header className="text-center mb-10">
            <h1 className="font-sans text-[32px] leading-[38px] tracking-[-0.01em] font-extrabold text-[#1a1c1b] uppercase">
              Shopby
            </h1>
            <p className="font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#76737b] mt-1 uppercase">
              Admin / New Product Link
            </p>
            <div className="w-full border-b-2 border-dashed border-[#e5e1d8] mt-6" />
          </header>

          <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-3">
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

              <div className="relative aspect-[4/3] bg-[#e2e3e0] overflow-hidden border border-[#e5e1d8]" style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}>
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
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="productName">
                Product Name
              </label>
              <input ref={nameRef} id="productName" type="text" placeholder="e.g. Ergonomic Desk Chair V2"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[20px] leading-[28px] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/30 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="category">
                Category
              </label>
              <div className="relative">
                <select ref={categoryRef} id="category" defaultValue=""
                  className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] appearance-none pr-8 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none">
                  <option value="" disabled>Select a category</option>
                  {categories?.map((cat: { id: string; name: string }) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <ArrowDown className="size-5 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#1a1c1b]" aria-hidden="true" />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="affiliateLink">
                Affiliate Link
              </label>
              <input ref={linkRef} id="affiliateLink" type="url" placeholder="https://shopee.co.id/..."
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-sans text-[16px] leading-[24px] text-[#1a1c1b] placeholder:text-[#5c403a]/30 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="price">
                Price (IDR)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#b51c00]">Rp</span>
                <input ref={priceRef} id="price" type="text" placeholder="1.250.000"
                  className="flex-1 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/20 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="commission">
                Komisi per Produk (IDR)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#b51c00]">Rp</span>
                <input id="commission" type="text" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="50.000"
                  className="flex-1 border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[32px] leading-[32px] tracking-[-0.04em] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/20 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-1" htmlFor="discount">
                Diskon (%)
              </label>
              <input id="discount" type="number" min={0} max={100} value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} placeholder="0"
                className="w-full border-0 border-b-2 border-[#e5e1d8] bg-transparent pb-2 font-mono text-[20px] leading-[28px] font-bold text-[#1a1c1b] placeholder:text-[#5c403a]/20 focus:border-[#1a1c1b] focus:ring-0 focus:outline-none" />
            </div>

            <div>
              <label className="block font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase mb-3" htmlFor="rating">
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
                <input type="checkbox" checked={status} onChange={() => setStatus(!status)} className="sr-only peer" />
                <div className="w-14 h-7 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#FF4D2D]" />
                <span className="ml-3 font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase text-[#1a1c1b]">{status ? "Yes" : "No"}</span>
              </label>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-dashed border-[#e5e1d8] -mt-6">
              <span className="font-mono text-[12px] leading-[16px] font-medium text-[#76737b] uppercase">Tandai Stok Habis</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isSoldOut} onChange={() => setIsSoldOut(!isSoldOut)} className="sr-only peer" />
                <div className="w-14 h-7 bg-[#e2e3e0] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#ba1a1a]" />
                <span className="ml-3 font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase text-[#1a1c1b]">{isSoldOut ? "Yes" : "No"}</span>
              </label>
            </div>

            <div className="pt-6 space-y-4">
              <button type="submit" disabled={saving}
                className="w-full bg-[#FF4D2D] text-[#1a1c1b] font-sans text-[20px] leading-[28px] font-bold py-4 px-6 rounded-full border border-[#1a1c1b] transition-all active:translate-y-0.5 active:translate-x-0.5 flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                <Save className="size-5" aria-hidden="true" />
                {saving ? "Creating…" : "Create Product Link"}
              </button>
              <button type="button" onClick={() => router.back()}
                className="w-full bg-transparent text-[#5d5b62] font-mono text-[13px] leading-[16px] tracking-[0.05em] uppercase py-3 hover:text-[#1a1c1b] transition-colors underline decoration-dashed underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none">
                Cancel
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
