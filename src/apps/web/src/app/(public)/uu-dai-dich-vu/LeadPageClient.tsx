"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { Banknote, RefreshCw, ChevronDown, TrendingUp, Clock } from "lucide-react"
import Breadcrumb from "@/components/ui/Breadcrumb"
import FilterBar from "@/components/sections/FilterBar"
import type { SortOption } from "@/components/sections/FilterBar"
import type { Coupon } from "@/components/coupons/CouponCard"
import { useCategories } from "@/hooks/useCategories"
import { useSources } from "@/hooks/useSources"
import { toSourceItems, toCategoryItems, toggleItem } from "@/lib/filter-utils"
import { useFilterUrlSync } from "@/hooks/useFilterUrlSync"

const CouponCard = dynamic(() => import("@/components/coupons/CouponCard"))

const SORT_OPTIONS: SortOption[] = [
  { value: "newest",  label: "Mới nhất",     Icon: Clock },
  { value: "popular", label: "Phổ biến nhất", Icon: TrendingUp },
]

const PAGE_SIZE = 50
const DEFAULT_SORT = "newest"

interface LeadFilterState {
  niches:     string[]
  platforms:  string[]
  sort:       string
}

const DEFAULT_FILTER: LeadFilterState = {
  niches:    [],
  platforms: [],
  sort:      DEFAULT_SORT,
}

function buildLeadUrl(pathname: string, s: LeadFilterState): string {
  const p = new URLSearchParams()
  if (s.niches.length    > 0) p.set("niche",    s.niches.join(","))
  if (s.platforms.length > 0) p.set("platform", s.platforms.join(","))
  if (s.sort !== DEFAULT_SORT) p.set("sort", s.sort)
  const qs = p.toString()
  return pathname + (qs ? `?${qs}` : "")
}

function initFromParams(searchParams: URLSearchParams): LeadFilterState {
  const nicheParam    = searchParams.get("niche")
  const platformParam = searchParams.get("platform")
  return {
    niches:    nicheParam    ? nicheParam.split(",").filter(Boolean)    : [],
    platforms: platformParam ? platformParam.split(",").filter(Boolean) : [],
    sort:      searchParams.get("sort") ?? DEFAULT_SORT,
  }
}

function LeadSkeleton() {
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

function EmptyLeads() {
  return (
    <div className="text-center py-16 font-mono">
      <Banknote className="size-12 mx-auto text-ink/20 mb-4" />
      <p className="text-ink/40 text-sm">Chưa có ưu đãi dịch vụ nào.</p>
      <p className="text-ink/30 text-xs mt-1">Thử chọn ngành hàng khác hoặc quay lại sau.</p>
    </div>
  )
}

function LeadPageClientInner() {
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<LeadFilterState>(() => initFromParams(searchParams))

  useFilterUrlSync(filters, buildLeadUrl)

  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories()
  const { data: sources = [],    isLoading: isSourcesLoading }   = useSources("lead")

  const [leads, setLeads]             = useState<Coupon[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [skip, setSkip]               = useState(0)

  const buildApiParams = useCallback(
    (f: LeadFilterState, currentSkip: number) => {
      const p = new URLSearchParams({
        take: String(PAGE_SIZE),
        skip: String(currentSkip),
        sort: f.sort,
      })
      if (f.niches.length    > 0) p.set("niche",    f.niches.join(","))
      if (f.platforms.length > 0) p.set("platform", f.platforms.join(","))
      return p
    },
    [],
  )

  const fetchLeads = useCallback(
    async (f: LeadFilterState, currentSkip: number) => {
      const res = await fetch(`/api/leads?${buildApiParams(f, currentSkip)}`)
      if (!res.ok) throw new Error("fetch error")
      return res.json() as Promise<{ data: Coupon[]; total: number }>
    },
    [buildApiParams],
  )

  useEffect(() => {
    setLoading(true)
    setSkip(0)
    fetchLeads(filters, 0)
      .then(({ data, total: t }) => {
        setLeads(data)
        setTotal(t)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [filters, fetchLeads])

  const handleLoadMore = async () => {
    const nextSkip = skip + PAGE_SIZE
    setLoadingMore(true)
    try {
      const { data } = await fetchLeads(filters, nextSkip)
      setLeads((prev) => [...prev, ...data])
      setSkip(nextSkip)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = leads.length < total

  const sourceItems   = toSourceItems(sources)
  const categoryItems = toCategoryItems(categories)

  return (
    <>
      <div className="animate-pageIn w-full bg-white border-t border-dashed border-border-color">
        <main className="w-full max-w-[1320px] mx-auto px-3 pt-[120px] sm:pt-[160px] pb-12">
          <Breadcrumb
            items={[{ label: "Trang chủ", href: "/" }, { label: "Ưu đãi dịch vụ" }]}
            className="mb-4"
          />

          {/* Header */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="size-5 text-primary" />
              <h1 className="font-bold text-2xl text-ink">Ưu đãi dịch vụ</h1>
            </div>
            <p className="font-mono text-sm text-ink/50">
              Ẩm thực, giáo dục, du lịch, spa và nhiều dịch vụ —{" "}
              <span className="text-green-600 font-semibold">đăng ký qua link, nhận ưu đãi độc quyền</span>
            </p>
          </div>

          {/* Sticky filter bar — categories only, no source/platform filter */}
          <FilterBar
            sources={sourceItems}
            activeSources={filters.platforms}
            onSourceToggle={(slug) =>
              setFilters((f) => ({ ...f, platforms: toggleItem(f.platforms, slug) }))
            }
            isSourcesLoading={isSourcesLoading}
            sourcesAriaLabel="Nhà cung cấp"

            categories={categoryItems}
            activeCategories={filters.niches}
            onCategoryToggle={(id) =>
              setFilters((f) => ({ ...f, niches: toggleItem(f.niches, id) }))
            }
            isCategoriesLoading={isCategoriesLoading}
            categoriesAriaLabel="Ngành dịch vụ"

            sortOptions={SORT_OPTIONS}
            sort={filters.sort}
            onSortChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
          />

          {/* Tip */}
          <div className="mt-4 mb-5 p-3 border border-dashed border-border-color bg-[site-cream]">
            <p className="font-mono text-xs text-ink/50">
              <strong className="text-ink/70">Cách dùng:</strong> Nhấn "Nhận ưu đãi" → điền thông tin trên trang đối tác → hoàn thành hồ sơ để nhận ưu đãi.
              Hoa hồng và điều kiện áp dụng hiển thị trên từng thẻ dịch vụ.
            </p>
          </div>

          {/* Counter */}
          {!loading && (
            <p className="font-mono text-xs text-ink/40 mb-3">
              {total > 0 ? `${total} dịch vụ đang có ưu đãi` : ""}
            </p>
          )}

          {/* Main grid */}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <LeadSkeleton key={i} />)}
            </div>
          ) : leads.length === 0 ? (
            <EmptyLeads />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {leads.map((c) => (
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
                    Xem thêm ({total - leads.length} dịch vụ)
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

export default function LeadPageClient() {
  return (
    <Suspense>
      <LeadPageClientInner />
    </Suspense>
  )
}
