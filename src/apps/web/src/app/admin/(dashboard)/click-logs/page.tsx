"use client"

import { useState, useEffect, useCallback } from "react"
import { MousePointerClick, Calendar, Filter, Download } from "lucide-react"
import Image from "next/image"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, EmptyState, Pagination } from "@/components/admin/ui"

interface ClickLogEntry {
  id: string
  productId: string
  clickedAt: string
  product: {
    id: string
    name: string
    price: number
    imageUrl: string
  }
}

interface ClickLogResponse {
  data: ClickLogEntry[]
  total: number
  page: number
  totalPages: number
}

export default function AdminClickLogs() {
  const [logs, setLogs] = useState<ClickLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const limit = 25

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      params.set("sort", "desc")
      if (dateFrom) params.set("dateFrom", dateFrom)
      if (dateTo) params.set("dateTo", dateTo)

      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/click-logs?${params.toString()}`, {
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const json: ClickLogResponse = await res.json()
      setLogs(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
    } catch {
      setLogs([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [page, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", minimumFractionDigits: 0 }).format(price)

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell title="Lịch sử click" subtitle="Theo dõi lượt click vào sản phẩm affiliate." />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
          >
            Bộ lọc
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={() => {
              const params = new URLSearchParams()
              if (dateFrom) params.set("dateFrom", dateFrom)
              if (dateTo) params.set("dateTo", dateTo)
              window.open(`/api/click-logs/export?${params.toString()}`, "_blank")
            }}
          >
            Export CSV
          </Button>
        </div>
        <span className="font-mono text-[13px] text-[#5c403a]">
          {total} click{total !== 1 ? "s" : ""} recorded
        </span>
      </div>

      {showFilters && (
        <div className="bg-white border border-[#e5e1d8] p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="dateFrom" className="block font-mono text-[14px] tracking-[0.05em] text-[#5c403a] mb-1">
              <Calendar className="size-3 inline mr-1" aria-hidden="true" />
              Từ ngày
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="border border-[#e5e1d8] bg-transparent px-3 py-1.5 font-mono text-[13px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="dateTo" className="block font-mono text-[14px] tracking-[0.05em] text-[#5c403a] mb-1">
              Đến ngày
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="border border-[#e5e1d8] bg-transparent px-3 py-1.5 font-mono text-[13px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1) }}
          >
            Xóa lọc
          </Button>
        </div>
      )}

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["Sản phẩm", "Giá", "Thời gian nhấp", "ID"].map((h) => (
                <th key={h} className="py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-16">
                  <PageSpinner />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4">
                  <EmptyState
                    icon={MousePointerClick}
                    title="Không tìm thấy nhật ký"
                    description="Clicks sẽ xuất hiện khi người dùng nhấp vào sản phẩm."
                  />
                </td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-[#FAFAF7] transition-colors">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-4">
                    <div className="relative size-10 shrink-0 bg-[#e2e3e0] overflow-hidden">
                      {log.product?.imageUrl && (
                        <Image src={log.product.imageUrl} alt="" width={40} height={40} className="object-cover" unoptimized />
                      )}
                    </div>
                    <span className="font-sans text-[16px] leading-[24px] font-bold text-[#1a1c1b]">
                      {log.product?.name || "Deleted product"}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-6 font-mono text-[16px] font-bold text-[#1a1c1b]">
                  {log.product?.price ? formatPrice(log.product.price) : "—"}
                </td>
                <td className="py-4 px-6 font-mono text-[13px] text-[#5c403a]">
                  {formatDate(log.clickedAt)}
                </td>
                <td className="py-4 px-6 font-mono text-[11px] text-[#906f69]">
                  {log.productId}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        total={total}
        pageSize={limit}
        onChange={setPage}
      />
    </div>
  )
}
