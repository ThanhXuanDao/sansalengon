"use client"

import Image from "next/image"
import type React from "react"

// ─── Shared types ────────────────────────────────────────────────────────────

export interface FilterItem {
  slug: string
  label: string
  /** Image URL — shown as <Image> when present (product source logos). */
  icon?: string | null
  /** Emoji character — shown large when present (category icons). */
  emoji?: string
  /** Hex brand color — used for circle bg/border when no icon or emoji (coupon platforms). */
  color?: string
}

export interface SortOption {
  value: string
  label: string
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
}

// ─── Internal: single circle button ─────────────────────────────────────────

function FilterCircle({
  item,
  isActive,
  onClick,
}: {
  item: FilterItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
      <button
        onClick={onClick}
        aria-pressed={isActive}
        title={item.label}
        className={`flex items-center justify-center w-[52px] h-[52px] rounded-full border-2 transition-all overflow-hidden focus-visible:outline-2 focus-visible:outline-filter-active ${
          item.emoji ? "text-[24px]" : ""
        } ${
          isActive && !item.color
            ? "bg-filter-active/10 border-filter-active"
            : !isActive
            ? "border-border-color hover:border-filter-active/50 bg-white"
            : ""
        }`}
        style={
          item.color
            ? isActive
              ? { borderColor: item.color, background: `${item.color}18` }
              : undefined
            : undefined
        }
      >
        {item.icon ? (
          <Image
            src={item.icon}
            alt={item.label}
            width={34}
            height={34}
            className="object-contain w-[34px] h-[34px]"
            unoptimized
          />
        ) : item.emoji ? (
          <span aria-hidden="true">{item.emoji}</span>
        ) : (
          <span
            className="font-mono font-bold text-[11px] select-none text-[site-brown]"
            style={isActive && item.color ? { color: item.color } : undefined}
          >
            {item.slug.slice(0, 2).toUpperCase()}
          </span>
        )}
      </button>
      <span
        className={`font-mono text-[10px] text-center leading-tight w-full truncate transition-colors ${
          isActive ? "text-filter-active font-semibold" : "text-ink/45"
        }`}
      >
        {item.label}
      </span>
    </div>
  )
}

function CircleSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-[68px]">
      <div className="w-[52px] h-[52px] rounded-full skeleton-shimmer" />
      <div className="h-[10px] w-10 rounded skeleton-shimmer" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FilterBarProps {
  // Sources row (product logos or platform badges)
  sources?: FilterItem[]
  activeSources?: string[]
  onSourceToggle?: (slug: string) => void
  isSourcesLoading?: boolean
  sourcesAriaLabel?: string

  // Categories row (emoji icons)
  categories?: FilterItem[]
  activeCategories?: string[]
  onCategoryToggle?: (slug: string) => void
  isCategoriesLoading?: boolean
  categoriesAriaLabel?: string

  // Sort pills
  sortOptions?: SortOption[]
  sort?: string
  onSortChange?: (value: string) => void

  // Extra pills appended after sort pills (e.g. type filter, divider + pills)
  extraPills?: React.ReactNode

  // Reset button shown when any filter is active
  hasActiveFilter?: boolean
  onResetFilter?: () => void
}

export default function FilterBar({
  sources,
  activeSources = [],
  onSourceToggle,
  isSourcesLoading,
  sourcesAriaLabel = "Nguồn",

  categories,
  activeCategories = [],
  onCategoryToggle,
  isCategoriesLoading,
  categoriesAriaLabel = "Danh mục",

  sortOptions,
  sort,
  onSortChange,

  extraPills,
  hasActiveFilter,
  onResetFilter,
}: FilterBarProps) {
  const showSources = isSourcesLoading || (sources && sources.length > 0)
  const showCategories = isCategoriesLoading || (categories && categories.length > 0)

  return (
    <div className="sticky top-[114px] sm:top-[142px] z-40 -mx-3 px-3 bg-white pt-3 pb-4 mb-6 border-b border-[site-sand]">

      {/* Row 0: Sources / Platforms */}
      {showSources && (
        <div
          className="flex items-start gap-2 pb-3 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label={sourcesAriaLabel}
        >
          {isSourcesLoading
            ? Array.from({ length: 4 }).map((_, i) => <CircleSkeleton key={i} />)
            : sources!.map((src) => (
                <FilterCircle
                  key={src.slug}
                  item={src}
                  isActive={activeSources.includes(src.slug)}
                  onClick={() => onSourceToggle?.(src.slug)}
                />
              ))}
        </div>
      )}

      {/* Row 1: Categories */}
      {showCategories && (
        <div
          className="flex items-start gap-2 pb-3 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label={categoriesAriaLabel}
        >
          {isCategoriesLoading
            ? Array.from({ length: 8 }).map((_, i) => <CircleSkeleton key={i} />)
            : categories!.map((cat) => (
                <FilterCircle
                  key={cat.slug}
                  item={cat}
                  isActive={activeCategories.includes(cat.slug)}
                  onClick={() => onCategoryToggle?.(cat.slug)}
                />
              ))}
        </div>
      )}

      {/* Row 2: Sort pills + extra pills + reset */}
      {(sortOptions || extraPills || hasActiveFilter) && (
        <div
          className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
          role="toolbar"
          aria-label="Sắp xếp"
        >
          {sortOptions?.map(({ value, label, Icon }) => {
            const isActive = sort === value
            return (
              <button
                key={value}
                onClick={() => onSortChange?.(value)}
                className={`flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-mono uppercase border transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-filter-active ${
                  isActive
                    ? "bg-filter-active/10 text-filter-active border-filter-active font-bold"
                    : "bg-white text-ink/50 border-border-color hover:border-filter-active/50 hover:text-ink"
                }`}
              >
                <Icon className="size-3" aria-hidden />
                {label}
              </button>
            )
          })}

          {extraPills}

          {hasActiveFilter && (
            <button
              onClick={onResetFilter}
              className="flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-mono border border-dashed border-ink/20 text-ink/40 hover:border-primary/40 hover:text-primary transition-all shrink-0 ml-1"
            >
              Xóa lọc ×
            </button>
          )}
        </div>
      )}
    </div>
  )
}
