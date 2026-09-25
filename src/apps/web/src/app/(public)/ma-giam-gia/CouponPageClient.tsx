"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams, usePathname } from "next/navigation"
import { Tag, RefreshCw, ChevronDown, Flame, ArrowUpDown, Clock, TrendingUp } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import FilterBar from "@/components/sections/FilterBar"
import type { FilterItem, SortOption } from "@/components/sections/FilterBar"
import type { Coupon } from "@/components/coupons/CouponCard"
import { useFormatDate } from "@/lib/currency-context"
import { useCategories } from "@/hooks/useCategories"
import { useSources } from "@/hooks/useSources"

const CouponCard = dynamic(() => import("@/components/coupons/CouponCard"))

const SORT_OPTIONS: SortOption[] = [
  { value: "value",    label: "Giảm nhiều nhất", Icon: ArrowUpDown },
  { value: "popular",  label: "Phổ biến nhất",   Icon: TrendingUp },
  { value: "expiring", label: "Sắp hết hạn",     Icon: Clock },
]

// No "Tất cả loại" — multi-select, empty array = all types
const TYPE_OPTIONS = [
  { value: "percent", label: "Giảm %" },
  { value: "fixed",   label: "Giảm tiền" },
]

const PAGE_SIZE = 20
const DEFAULT_SORT = "value"

interface CouponFilterState {
  platforms: string[]  // [] = all (SyncSource.slug → Coupon.platform), multi-select
  niches: string[]     // [] = all (Category.id), multi-select
  types: string[]      // [] = all ("percent"|"fixed"), multi-select
  sort: string
}

const DEFAULT_FILTER: CouponFilterState = {
  platforms: [],
  niches: [],
  types: [],
  sort: DEFAULT_SORT,
}

function buildCouponUrl(pathname: string, s: CouponFilterState): string {
  const p = new URLSearchParams()
  if (s.platforms.length > 0) p.set("platform", s.platforms.join(","))
  if (s.niches.length > 0) p.set("niche", s.niches.join(","))
  if (s.types.length > 0) p.set("type", s.types.join(","))
  if (s.sort !== DEFAULT_SORT) p.set("sort", s.sort)
  const qs = p.toString()
  return pathname + (qs ? `?${qs}` : "")
}

function initFromParams(searchParams: URLSearchParams): CouponFilterState {
  const platformParam = searchParams.get("platform")
  const nicheParam = searchParams.get("niche")
  const typeParam = searchParams.get("type")
  return {
    platforms: platformParam ? platformParam.split(",").filter(Boolean) : [],
    niches:    nicheParam   ? nicheParam.split(",").filter(Boolean)   : [],
    types:     typeParam    ? typeParam.split(",").filter(Boolean)    : [],
    sort:      searchParams.get("sort") ?? DEFAULT_SORT,
  }
}

function toggleItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]
}

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

function CouponPageClientInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [filters, setFilters] = useState<CouponFilterState>(() => initFromParams(searchParams))

  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories()
  const { data: sources = [], isLoading: isSourcesLoading } = useSources("coupon")

  const [coupons, setCoupons]         = useState<Coupon[]>([])
  const [flashSale, setFlashSale]     = useState<Coupon[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [skip, setSkip]               = useState(0)
  const [updatedAt, setUpdatedAt]     = useState("")

  const formatDate = useFormatDate()

  useEffect(() => {
    const now = new Date()
    const datePart = formatDate(now)
    const hh = String(now.getHours()).padStart(2, "0")
    const mi = String(now.getMinutes()).padStart(2, "0")
    setUpdatedAt(`${datePart}, ${hh}:${mi}`)
  }, [formatDate])

  // Sync filter state → URL (no navigation, just replaceState)
  useEffect(() => {
    window.history.replaceState(null, "", buildCouponUrl(pathname, filters))
  }, [filters, pathname])

  const buildApiParams = useCallback(
    (f: CouponFilterState, currentSkip: number, flash = false) => {
      const p = new URLSearchParams({
        take: String(PAGE_SIZE),
        skip: String(currentSkip),
        sort: f.sort,
      })
      if (f.platforms.length > 0) p.set("platform", f.platforms.join(","))
      if (f.niches.length > 0) p.set("niche", f.niches.join(","))
      if (f.types.length > 0) p.set("type", f.types.join(","))
      if (flash) p.set("flash", "1")
      return p
    },
    [],
  )

  const fetchCoupons = useCallback(
    async (f: CouponFilterState, currentSkip: number) => {
      const res = await fetch(`/api/coupons?${buildApiParams(f, currentSkip)}`)
      if (!res.ok) throw new Error("fetch error")
      return res.json() as Promise<{ data: Coupon[]; total: number }>
    },
    [buildApiParams],
  )

  const fetchFlashSale = useCallback(
    async (f: CouponFilterState) => {
      const res = await fetch(`/api/coupons?${buildApiParams(f, 0, true)}&take=6`)
      if (!res.ok) return []
      const { data } = await res.json() as { data: Coupon[]; total: number }
      return data
    },
    [buildApiParams],
  )

  useEffect(() => {
    setLoading(true)
    setSkip(0)
    Promise.all([fetchCoupons(filters, 0), fetchFlashSale(filters)])
      .then(([main, flash]) => {
        setCoupons(main.data)
        setTotal(main.total)
        setFlashSale(flash)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters, fetchCoupons, fetchFlashSale])

  const handleLoadMore = async () => {
    const nextSkip = skip + PAGE_SIZE
    setLoadingMore(true)
    try {
      const { data } = await fetchCoupons(filters, nextSkip)
      setCoupons((prev) => [...prev, ...data])
      setSkip(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = coupons.length < total

  // Adapt sources → FilterItem[]
  const sourceItems: FilterItem[] = sources.map((s) => ({
    slug: s.slug,
    label: s.name,
    icon: s.icon,
  }))

  // Adapt categories → FilterItem[]
  const categoryItems: FilterItem[] = categories.map((c) => ({
    slug: c.id,
    label: c.name,
    emoji: c.emoji,
  }))

  // Type filter pills as extraPills in the sort row — multi-select, no "Tất cả loại"
  const typePills = (
    <>
      <span className="w-px h-4 bg-border-color mx-1 shrink-0" aria-hidden="true" />
      {TYPE_OPTIONS.map(({ value, label }) => {
        const isActive = filters.types.includes(value)
        return (
          <button
            key={value}
            onClick={() => setFilters((f) => ({ ...f, types: toggleItem(f.types, value) }))}
            className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-filter-active ${
              isActive
                ? "bg-filter-active/10 text-filter-active border-filter-active font-bold"
                : "bg-white text-ink/50 border-border-color hover:border-filter-active/50 hover:text-ink"
            }`}
          >
            {label}
          </button>
        )
      })}
    </>
  )

  return (
    <>
      <div className="animate-pageIn w-full bg-white border-t border-dashed border-border-color">
        <main className="w-full max-w-[1320px] mx-auto px-3 pt-[120px] sm:pt-[160px] pb-12">
          <Breadcrumb
            items={[{ label: "Trang chủ", href: "/" }, { label: "Mã giảm giá" }]}
            className="mb-4"
          />

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="size-5 text-primary" />
              <h1 className="font-bold text-2xl text-ink">Mã giảm giá hôm nay</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-mono text-sm text-ink/50">
                Voucher từ Shopee, Tiki, Lazada và các thương hiệu —{" "}
                <span className="text-green-600 font-semibold">cập nhật 2 lần/ngày</span>
              </p>
              {updatedAt && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-ink/30">
                  <RefreshCw className="size-3" />
                  {updatedAt}
                </span>
              )}
            </div>
          </div>

          {/* ── Sticky filter bar — dùng chung FilterBar với trang chủ ── */}
          <FilterBar
            sources={sourceItems}
            activeSources={filters.platforms}
            onSourceToggle={(slug) =>
              setFilters((f) => ({ ...f, platforms: toggleItem(f.platforms, slug) }))
            }
            isSourcesLoading={isSourcesLoading}
            sourcesAriaLabel="Nguồn"

            categories={categoryItems}
            activeCategories={filters.niches}
            onCategoryToggle={(id) =>
              setFilters((f) => ({ ...f, niches: toggleItem(f.niches, id) }))
            }
            isCategoriesLoading={isCategoriesLoading}
            categoriesAriaLabel="Ngành hàng"

            sortOptions={SORT_OPTIONS}
            sort={filters.sort}
            onSortChange={(v) => setFilters((f) => ({ ...f, sort: v }))}

            extraPills={typePills}
          />

          {/* Tip */}
          <div className="mt-16 mb-5 p-3 border border-dashed border-border-color bg-[site-cream]">
            <p className="font-mono text-xs text-ink/50">
              <strong className="text-ink/70">Cách dùng:</strong> Nhấn "Lấy mã" để xem mã đầy đủ → Nhấn "Copy" → Dán vào ô voucher khi thanh toán.
              Mã cập nhật tự động — nếu mã hết hiệu lực, hệ thống sẽ tự xóa trong vòng 24 giờ.
            </p>
          </div>

          {/* Flash sale section */}
          {!loading && flashSale.length > 0 && (
            <div className="mb-6">
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
              <hr className="border-dashed border-border-color mt-6 mb-5" />
            </div>
          )}

          {/* Counter */}
          {!loading && (
            <p className="font-mono text-xs text-ink/40 mb-3">
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
                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-3 bg-primary hover:brightness-90 text-white px-10 py-3 rounded-full font-semibold text-sm transition-all active:scale-[.97] disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer min-w-[200px] justify-center"
                  >
                    {loadingMore ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                    Xem thêm ({total - coupons.length} mã)
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}

export default function CouponPageClient() {
  return (
    <Suspense>
      <CouponPageClientInner />
    </Suspense>
  )
}
