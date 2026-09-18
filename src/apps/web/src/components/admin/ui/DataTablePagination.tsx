import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface DataTablePaginationProps {
  page: number
  total: number
  pageSize: number
  pageSizeOptions?: number[]
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  label?: string
}

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100]

export function DataTablePagination({
  page,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
  label = "mục",
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Build visible page numbers: always show first, last, current ±1, with ellipsis
  const pageNumbers = buildPageRange(page, totalPages)

  const btn = (content: React.ReactNode, targetPage: number, disabled: boolean, ariaLabel: string) => (
    <button
      key={ariaLabel}
      onClick={() => !disabled && onPageChange(targetPage)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex items-center justify-center size-8 border border-[#e5e1d8] font-mono text-[13px] text-[#1a1c1b] hover:bg-[#f4f4f1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {content}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      {/* Left: page size selector */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12px] text-[#5c403a]">Số hàng:</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange?.(Number(e.target.value))
              onPageChange(1)
            }}
            className="appearance-none border border-[#e5e1d8] bg-white pl-2 pr-6 py-1 font-mono text-[12px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00] focus:ring-1 focus:ring-[#b51c00]"
            aria-label="Số hàng mỗi trang"
          >
            {pageSizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 size-3 text-[#5c403a]"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <span className="font-mono text-[12px] text-[#5c403a]">
          {from > 0 ? `${from}–${to}` : "0"} / {total} {label}
        </span>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        {btn(<ChevronsLeft className="size-3.5" />, 1, page <= 1, "Trang đầu")}
        {btn(<ChevronLeft className="size-3.5" />, page - 1, page <= 1, "Trang trước")}

        {pageNumbers.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="flex items-center justify-center size-8 font-mono text-[13px] text-[#906f69]">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              aria-label={`Trang ${p}`}
              aria-current={p === page ? "page" : undefined}
              className={`flex items-center justify-center size-8 border font-mono text-[13px] transition-colors ${
                p === page
                  ? "border-[#1a1c1b] bg-[#1a1c1b] text-white"
                  : "border-[#e5e1d8] text-[#1a1c1b] hover:bg-[#f4f4f1]"
              }`}
            >
              {p}
            </button>
          )
        )}

        {btn(<ChevronRight className="size-3.5" />, page + 1, page >= totalPages, "Trang sau")}
        {btn(<ChevronsRight className="size-3.5" />, totalPages, page >= totalPages, "Trang cuối")}
      </div>
    </div>
  )
}

function buildPageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "...")[] = []
  const around = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total))
  const sorted = [...around].sort((a, b) => a - b)

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && (sorted[i] as number) - (sorted[i - 1] as number) > 1) {
      pages.push("...")
    }
    pages.push(sorted[i])
  }
  return pages
}
