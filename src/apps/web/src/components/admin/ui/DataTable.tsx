import type { ElementType, ReactNode } from "react"
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { PageSpinner } from "./Spinner"
import { EmptyState } from "./EmptyState"

export interface TableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: "left" | "center" | "right"
  width?: string
  className?: string
}

export interface SortState {
  key: string
  dir: "asc" | "desc"
}

interface DataTableProps {
  columns: TableColumn[]
  loading?: boolean
  empty?: boolean
  emptyIcon?: ElementType
  emptyTitle?: string
  emptyDescription?: string
  sort?: SortState
  onSort?: (key: string) => void
  children: ReactNode
  stickyHeader?: boolean
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

export function DataTable({
  columns,
  loading,
  empty,
  emptyIcon,
  emptyTitle = "Không có dữ liệu",
  emptyDescription = "Thử thay đổi bộ lọc.",
  sort,
  onSort,
  children,
}: DataTableProps) {
  const colSpan = columns.length

  const handleSort = (col: TableColumn) => {
    if (!col.sortable || !onSort) return
    onSort(col.key)
  }

  return (
    <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="bg-[#f4f4f1]/60 border-b border-[#e5e1d8]">
            {columns.map((col) => {
              const isSorted = sort?.key === col.key
              const align = col.align ?? "left"
              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`py-3 px-4 font-mono text-[11px] leading-[16px] tracking-[0.06em] text-[#5c403a] font-bold uppercase select-none ${alignClass[align]} ${col.className ?? ""} ${col.sortable ? "cursor-pointer hover:text-[#1a1c1b] hover:bg-[#f4f4f1]" : ""}`}
                  onClick={() => handleSort(col)}
                  aria-sort={isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      isSorted ? (
                        sort!.dir === "asc"
                          ? <ChevronUp className="size-3 shrink-0" aria-hidden="true" />
                          : <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                      ) : (
                        <ChevronsUpDown className="size-3 shrink-0 opacity-40" aria-hidden="true" />
                      )
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="py-16">
                <PageSpinner />
              </td>
            </tr>
          ) : empty ? (
            <tr>
              <td colSpan={colSpan} className="py-4">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={emptyDescription}
                />
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  )
}

interface DataTableRowProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export function DataTableRow({ children, onClick, className = "" }: DataTableRowProps) {
  return (
    <tr
      onClick={onClick}
      className={`group hover:bg-[#FAFAF7] transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  )
}

interface DataTableCellProps {
  children: ReactNode
  align?: "left" | "center" | "right"
  className?: string
  colSpan?: number
}

export function DataTableCell({ children, align = "left", className = "", colSpan }: DataTableCellProps) {
  return (
    <td
      colSpan={colSpan}
      className={`py-3 px-4 align-middle ${alignClass[align]} ${className}`}
    >
      {children}
    </td>
  )
}
