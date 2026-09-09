"use client"

import { LayoutGrid } from "lucide-react"
import CategoryIcon from "@/components/ui/CategoryIcon"
import type { Category } from "@/types"

interface CategoryFilterProps {
  categories?: Category[]
  activeSlug?: string
  onSelect?: (slug: string) => void
  variant?: "sidebar" | "chips"
  numberRanges?: { label: string; from: number; to: number }[]
  activeRange?: { from: number; to: number } | null
  onRangeSelect?: (range: { from: number; to: number } | null) => void
  isLoading?: boolean
}

const defaultCategories: Category[] = [
  { id: "all", name: "Semua", slug: "semua", icon: "LayoutGrid" },
  { id: "cat1", name: "Elektronik", slug: "elektronik", icon: "Laptop" },
  { id: "cat2", name: "Fashion", slug: "fashion", icon: "Shirt" },
  { id: "cat3", name: "Rumah Tangga", slug: "rumah-tangga", icon: "Home" },
  { id: "cat4", name: "Kecantikan", slug: "kecantikan", icon: "Sparkles" },
]

export default function CategoryFilter({
  categories = defaultCategories,
  activeSlug = "semua",
  onSelect,
  variant = "sidebar",
  numberRanges,
  activeRange,
  onRangeSelect,
  isLoading,
}: CategoryFilterProps) {
  if (isLoading && variant === "chips") {
    return (
      <div className="space-y-3">
        <div className="flex md:hidden gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`sk-cat-${i}`}
              className="h-8 skeleton-shimmer rounded-full shrink-0"
              style={{ width: `${70 + i * 20}px` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (isLoading && variant === "sidebar") {
    return (
      <aside className="hidden md:block w-64 flex-shrink-0">
        <div className="sticky top-24 bg-white border-r border-dashed border-border-color p-4">
          <div className="mb-6">
            <div className="h-6 skeleton-shimmer w-24 mb-2" />
            <div className="h-3 skeleton-shimmer w-16" />
          </div>
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={`sk-side-${i}`}>
                <div className="h-10 skeleton-shimmer w-full" />
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <div className="h-3 skeleton-shimmer w-20 mb-3" />
            <ul className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <li key={`sk-range-${i}`}>
                  <div className="h-10 skeleton-shimmer w-full" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    )
  }

  if (variant === "chips") {
    return (
      <div className="space-y-3">
        <div className="flex md:hidden gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug
            return (
                <button
                    key={cat.id}
                    onClick={() => onSelect?.(cat.slug)}
                    className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? "bg-tag-yellow text-ink font-bold border-ink"
                        : "bg-white text-ink/60 border-border-color hover:border-ink/30"
                    }`}
              >
                <CategoryIcon icon={cat.icon} className="size-3.5" />
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>
        {numberRanges !== undefined && (
          <div className="flex md:hidden gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
            <button
              onClick={() => onRangeSelect?.(null)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                !activeRange
                  ? "bg-tag-yellow text-ink font-bold border-ink"
                  : "bg-white text-ink/60 border-border-color hover:border-ink/30"
              }`}
            >
              Semua
            </button>
            {numberRanges.map((range) => {
              const isActive = activeRange?.from === range.from && activeRange?.to === range.to
              return (
                <button
                  key={range.label}
                  onClick={() => onRangeSelect?.(isActive ? null : range)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? "bg-tag-yellow text-ink font-bold border-ink"
                      : "bg-white text-ink/60 border-border-color hover:border-ink/30"
                  }`}
                >
                  {range.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="hidden md:block w-64 flex-shrink-0">
      <div className="sticky top-24 bg-white border-r border-dashed border-border-color p-4">
        <div className="mb-6">
          <h2 className="text-headline-md text-primary font-sans text-pretty">Kategori</h2>
          <p className="text-caption text-ink/60 font-sans">Filter produk</p>
        </div>
        <ul className="space-y-2">
          {categories.map((cat) => {
            const isActive = cat.slug === activeSlug
            return (
              <li key={cat.id}>
                <button
                  onClick={() => onSelect?.(cat.slug)}
                  className={`flex items-center gap-3 p-2 w-full text-left transition-all font-mono text-label-mono uppercase focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? "bg-tag-yellow text-ink font-bold border border-ink -translate-x-0.5 -translate-y-0.5"
                      : "text-ink/60 hover:bg-[#e8e8e5] border border-transparent hover:border-border-color"
                  }`}
                >
                  <span className="text-ink/60"><CategoryIcon icon={cat.icon} className="size-3.5" /></span>
                  <span>{cat.name}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {numberRanges !== undefined && (
          <div className="mt-8">
            <h3 className="font-mono text-xs text-ink/60 uppercase mb-3 tracking-wider">Nomor Produk</h3>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => onRangeSelect?.(null)}
                  className={`flex items-center gap-3 p-2 w-full text-left transition-all font-mono text-label-mono uppercase focus-visible:ring-2 focus-visible:ring-primary ${
                    !activeRange
                      ? "bg-tag-yellow text-ink font-bold border border-ink -translate-x-0.5 -translate-y-0.5"
                      : "text-ink/60 hover:bg-[#e8e8e5] border border-transparent hover:border-border-color"
                  }`}
                >
                  <span>Semua</span>
                </button>
              </li>
              {numberRanges.map((range) => {
                const isActive = activeRange?.from === range.from && activeRange?.to === range.to
                return (
                  <li key={range.label}>
                    <button
                      onClick={() => onRangeSelect?.(isActive ? null : range)}
                      className={`flex items-center gap-3 p-2 w-full text-left transition-all font-mono text-label-mono uppercase focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-tag-yellow text-ink font-bold border border-ink -translate-x-0.5 -translate-y-0.5"
                          : "text-ink/60 hover:bg-[#e8e8e5] border border-transparent hover:border-border-color"
                      }`}
                    >
                      <span>{range.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </aside>
  )
}
