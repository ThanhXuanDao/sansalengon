"use client"

import { LayoutGrid } from "lucide-react"
import type { Category } from "@/types"

interface CategoryFilterProps {
  categories?: Category[]
  activeSlug?: string
  onSelect?: (slug: string) => void
  variant?: "sidebar" | "chips"
  isLoading?: boolean
}

const defaultCategories: Category[] = [
  { id: "semua", name: "Tất cả", emoji: "🏷️", status: "active" },
  { id: "electronics", name: "Điện tử", emoji: "📱", status: "active" },
  { id: "fashion", name: "Thời trang", emoji: "👗", status: "active" },
  { id: "home", name: "Gia dụng", emoji: "🏠", status: "active" },
  { id: "beauty", name: "Làm đẹp", emoji: "💄", status: "active" },
]

export default function CategoryFilter({
  categories = defaultCategories,
  activeSlug = "semua",
  onSelect,
  variant = "sidebar",
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
        </div>
      </aside>
    )
  }

  if (variant === "chips") {
    return (
      <div className="space-y-3">
        <div className="flex md:hidden gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
          {categories.map((cat) => {
            const isActive = cat.id === activeSlug
            return (
              <button
                key={cat.id}
                onClick={() => onSelect?.(cat.id)}
                title={cat.name}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? "bg-tag-yellow text-ink font-bold border-ink"
                    : "bg-white text-ink/60 border-border-color hover:border-ink/30"
                }`}
              >
                <span aria-hidden="true">{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <aside className="hidden md:block w-64 flex-shrink-0">
      <div className="sticky top-24 bg-white border-r border-dashed border-border-color p-4">
        <div className="mb-6">
          <h2 className="text-headline-md text-primary font-sans text-pretty">Danh mục</h2>
          <p className="text-caption text-ink/60 font-sans">Lọc sản phẩm</p>
        </div>
        <ul className="space-y-2">
          {categories.map((cat) => {
            const isActive = cat.id === activeSlug
            return (
              <li key={cat.id}>
                <button
                  onClick={() => onSelect?.(cat.id)}
                  className={`flex items-center gap-3 p-2 w-full text-left transition-all font-mono text-label-mono uppercase focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? "bg-tag-yellow text-ink font-bold border border-ink -translate-x-0.5 -translate-y-0.5"
                      : "text-ink/60 hover:bg-[#e8e8e5] border border-transparent hover:border-border-color"
                  }`}
                >
                  <span className="text-ink/60" aria-hidden="true">{cat.emoji}</span>
                  <span>{cat.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
