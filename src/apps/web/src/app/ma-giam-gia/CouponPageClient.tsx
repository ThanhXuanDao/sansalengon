"use client"

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Tag, RefreshCw, ChevronDown, Flame, SlidersHorizontal, X } from "lucide-react"
import Navbar from "@/components/layout/Navbar"
import type { Coupon } from "@/components/coupons/CouponCard"

const CouponCard = dynamic(() => import("@/components/coupons/CouponCard"))
const Footer = dynamic(() => import("@/components/layout/Footer"))

interface NicheTab { id: string; label: string; emoji: string }

const STATIC_NICHES: NicheTab[] = [
  { id: "all",         label: "Tất cả",    emoji: "🎁" },
  { id: "fashion",     label: "Thời trang", emoji: "👗" },
  { id: "electronics", label: "Điện tử",   emoji: "📱" },
  { id: "home",        label: "Nhà cửa",   emoji: "🏠" },
  { id: "beauty",      label: "Làm đẹp",   emoji: "💄" },
  { id: "food",        label: "Thực phẩm", emoji: "🛒" },
  { id: "baby",        label: "Mẹ & Bé",   emoji: "👶" },
]

const PLATFORM_TABS = [
  { id: "all",    label: "Tất cả",  color: "" },
  { id: "shopee", label: "Shopee",  color: "text-orange-600" },
  { id: "tiki",   label: "Tiki",    color: "text-blue-600" },
  { id: "lazada", label: "Lazada",  color: "text-purple-600" },
]

const PAGE_SIZE = 20

function CouponSkeleton() {
  return (
    <div className="receipt-card flex overflow-hidden animate-pulse">
      <div className="w-24 bg-[#e8e8e5] min-h-[112px]" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-4 bg-[#e8e8e5] rounded w-1/2" />
        <div className="h-3 bg-[#e8e8e5] rounded w-3/4" />
        <div className="h-8 bg-[#e8e8e5] rounded" />
      </div>
    </div>
  )
}

function EmptyCoupons() {
  return (
    <div className="text-center py-16 font-mono">
      <Tag className="size-12 mx-auto text-ink/20 mb-4" />
      <p className="text-ink/40 text-sm">Không có mã giảm giá phù hợp.</p>
      <p className="text-ink/30 text-xs mt-1">Thử chọn bộ lọc khác hoặc quay lại sau.</p>
    </div>
  )
}

interface Filters {
  platform: string
  type: string   // "" | "percent" | "fixed"
  sort: string   // "value" | "popular" | "expiring"
}

export default function CouponPageClient() {
  const [activeNiche, setActiveNiche] = useState("all")
  const [filters, setFilters] = useState<Filters>({ platform: "all", type: "", sort: "value" })
  const [showFilter, setShowFilter] = useState(false)

  const [coupons, setCoupons]       = useState<Coupon[]>([])
  const [flashSale, setFlashSale]   = useState<Coupon[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [skip, setSkip]             = useState(0)
  const [updatedAt, setUpdatedAt]   = useState("")

  useEffect(() => {
    setUpdatedAt(new Date().toLocaleDateString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }))
  }, [])

  const buildParams = useCallback(
    (niche: string, f: Filters, currentSkip: number, flash = false) => {
      const p = new URLSearchParams({
        niche,
        take: String(PAGE_SIZE),
        skip: String(currentSkip),
        platform: f.platform,
        sort: f.sort,
      })
      if (f.type) p.set("type", f.type)
      if (flash) p.set("flash", "1")
      return p
    },
    [],
  )

  const fetchCoupons = useCallback(
    async (niche: string, f: Filters, currentSkip: number) => {
      const res = await fetch(`/api/coupons?${buildParams(niche, f, currentSkip)}`)
      if (!res.ok) throw new Error("fetch error")
      return res.json() as Promise<{ data: Coupon[]; total: number }>
    },
    [buildParams],
  )

  const fetchFlashSale = useCallback(
    async (niche: string, f: Filters) => {
      const res = await fetch(`/api/coupons?${buildParams(niche, f, 0, true)}&take=6`)
      if (!res.ok) return []
      const { data } = await res.json() as { data: Coupon[]; total: number }
      return data
    },
    [buildParams],
  )

  // Main fetch whenever niche or filters change
  useEffect(() => {
    setLoading(true)
    setSkip(0)
    Promise.all([
      fetchCoupons(activeNiche, filters, 0),
      fetchFlashSale(activeNiche, filters),
    ])
      .then(([main, flash]) => {
        setCoupons(main.data)
        setTotal(main.total)
        setFlashSale(flash)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [activeNiche, filters, fetchCoupons, fetchFlashSale])

  const handleLoadMore = async () => {
    const nextSkip = skip + PAGE_SIZE
    setLoadingMore(true)
    try {
      const { data } = await fetchCoupons(activeNiche, filters, nextSkip)
      setCoupons((prev) => [...prev, ...data])
      setSkip(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const activeFilterCount = [
    filters.platform !== "all" ? 1 : 0,
    filters.type ? 1 : 0,
    filters.sort !== "value" ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const hasMore = coupons.length < total

  return (
    <>
      <Navbar onSearch={() => {}} searchQuery="" />

      <div className="w-full bg-white border-t border-dashed border-border-color">
        <main className="w-full max-w-[1320px] mx-auto px-3 py-10">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="size-5 text-primary" />
              <h1 className="font-bold text-2xl text-ink">Mã giảm giá hôm nay</h1>
            </div>
            <p className="font-mono text-sm text-ink/50">
              Voucher từ Shopee, Tiki, Lazada và các thương hiệu —{" "}
              <span className="text-green-600 font-semibold">cập nhật 2 lần/ngày</span>
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <RefreshCw className="size-3 text-ink/30" />
              <span className="font-mono text-[10px] text-ink/30">Cập nhật lần cuối: {updatedAt}</span>
            </div>
          </div>

          {/* Niche tabs */}
          <div className="flex gap-2 flex-wrap mb-4">
            {STATIC_NICHES.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveNiche(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 brutalist-border font-mono text-xs font-bold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                  activeNiche === tab.id
                    ? "bg-primary text-white"
                    : "bg-[#e8e8e5] text-ink hover:bg-primary/10"
                }`}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Platform tabs + filter toggle */}
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex gap-1.5">
              {PLATFORM_TABS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilters((f) => ({ ...f, platform: p.id }))}
                  className={`px-3 py-1 font-mono text-xs font-bold uppercase border transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                    filters.platform === p.id
                      ? "bg-ink text-white border-ink"
                      : `bg-transparent border-border-color text-ink/60 hover:border-ink/40 ${p.color}`
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-bold uppercase border border-border-color hover:border-ink/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              <SlidersHorizontal className="size-3" />
              Bộ lọc
              {activeFilterCount > 0 && (
                <span className="size-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilter && (
            <div className="mb-6 p-4 border border-border-color bg-[#fafaf7] flex flex-wrap gap-6">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase text-ink/50 mb-2">Loại giảm</p>
                <div className="flex gap-2">
                  {[{ v: "", l: "Tất cả" }, { v: "percent", l: "Giảm %" }, { v: "fixed", l: "Giảm tiền" }].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setFilters((f) => ({ ...f, type: v }))}
                      className={`px-2 py-1 font-mono text-xs border transition-colors ${
                        filters.type === v ? "bg-primary text-white border-primary" : "border-border-color text-ink/60 hover:border-ink/40"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-mono text-[10px] font-bold uppercase text-ink/50 mb-2">Sắp xếp</p>
                <div className="flex gap-2">
                  {[
                    { v: "value",    l: "Giảm nhiều nhất" },
                    { v: "popular",  l: "Phổ biến nhất" },
                    { v: "expiring", l: "Sắp hết hạn" },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setFilters((f) => ({ ...f, sort: v }))}
                      className={`px-2 py-1 font-mono text-xs border transition-colors ${
                        filters.sort === v ? "bg-primary text-white border-primary" : "border-border-color text-ink/60 hover:border-ink/40"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => setFilters({ platform: "all", type: "", sort: "value" })}
                  className="flex items-center gap-1 px-2 py-1 font-mono text-xs text-ink/50 hover:text-primary transition-colors self-end"
                >
                  <X className="size-3" /> Xóa bộ lọc
                </button>
              )}
            </div>
          )}

          {/* Flash sale section */}
          {!loading && flashSale.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="size-4 text-amber-500" />
                <h2 className="font-bold text-base text-ink">Flash Sale — Hết hạn trong 24h</h2>
                <span className="font-mono text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 uppercase font-bold">
                  {flashSale.length} mã
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {flashSale.map((c) => (
                  <CouponCard key={c.id} coupon={c} />
                ))}
              </div>
              <hr className="border-dashed border-border-color mt-8 mb-6" />
            </div>
          )}

          {/* Counter */}
          {!loading && (
            <p className="font-mono text-xs text-ink/40 mb-4">
              {total > 0 ? `${total} mã giảm giá đang hoạt động` : ""}
            </p>
          )}

          {/* Main grid */}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <CouponSkeleton key={i} />)}
            </div>
          ) : coupons.length === 0 ? (
            <EmptyCoupons />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {coupons.map((c) => (
                  <CouponCard key={c.id} coupon={c} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-2 brutalist-border bg-[#e8e8e5] text-ink font-mono text-xs font-bold uppercase hover:bg-primary hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                    Xem thêm ({total - coupons.length} mã còn lại)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Tip */}
          <div className="mt-12 p-4 border border-dashed border-border-color bg-[#fafaf7]">
            <p className="font-mono text-xs text-ink/50">
              <strong className="text-ink/70">Cách dùng:</strong> Nhấn "Lấy mã" để xem mã đầy đủ → Nhấn "Copy" → Dán vào ô voucher khi thanh toán.
              Mã cập nhật tự động — nếu mã hết hiệu lực, hệ thống sẽ tự xóa trong vòng 24 giờ.
            </p>
          </div>
        </main>
      </div>

      <Footer />
    </>
  )
}
