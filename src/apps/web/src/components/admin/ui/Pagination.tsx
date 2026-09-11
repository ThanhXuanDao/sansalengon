import { ChevronLeft, ChevronRight } from "lucide-react"

interface PaginationProps {
  page: number
  total: number
  pageSize: number
  onChange: (page: number) => void
}

export function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-[12px] text-[#5c403a]">
        {from}–{to} / {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 border border-[#e5e1d8] hover:bg-[#f4f4f1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4 text-[#5c403a]" />
        </button>
        <span className="px-3 font-mono text-[13px] text-[#1a1c1b] border border-[#e5e1d8] py-1.5 min-w-[2.5rem] text-center">
          {page}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 border border-[#e5e1d8] hover:bg-[#f4f4f1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4 text-[#5c403a]" />
        </button>
      </div>
    </div>
  )
}
