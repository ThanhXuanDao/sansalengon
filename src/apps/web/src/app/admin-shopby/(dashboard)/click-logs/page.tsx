"use client"

import { useState, useEffect, useCallback } from "react"
import { MousePointerClick, Loader2, ChevronLeft, ChevronRight, Calendar, Filter, Download } from "lucide-react"
import Image from "next/image"
import { ensureCsrfToken } from "@/lib/utils"

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
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price)

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="mb-8 border-b border-dashed border-[#e5beb6] pb-4">
        <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-2">
          Click Logs
        </h2>
        <p className="font-sans text-[16px] leading-[24px] text-[#5c403a]">
          Track when users click on your affiliate product links.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 rounded-full font-mono text-[13px] border border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            <Filter className="size-4" aria-hidden="true" />
            Filters
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams()
              if (dateFrom) params.set("dateFrom", dateFrom)
              if (dateTo) params.set("dateTo", dateTo)
              window.open(`/api/click-logs/export?${params.toString()}`, "_blank")
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-full font-mono text-[13px] bg-[#1a1c1b] text-white hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            <Download className="size-4" aria-hidden="true" />
            Export CSV
          </button>
        </div>
        <span className="font-mono text-[13px] text-[#5c403a]">
          {total} click{total !== 1 ? "s" : ""} recorded
        </span>
      </div>

      {showFilters && (
        <div className="bg-white border border-[#e5e1d8] p-4 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="dateFrom" className="block font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">
              <Calendar className="size-3 inline mr-1" aria-hidden="true" />
              From
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
            <label htmlFor="dateTo" className="block font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">
              To
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="border border-[#e5e1d8] bg-transparent px-3 py-1.5 font-mono text-[13px] text-[#1a1c1b] focus:border-[#1a1c1b] focus:ring-0 focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1) }}
            className="px-3 py-1.5 rounded font-mono text-[13px] border border-[#e5e1d8] text-[#5c403a] hover:bg-[#f4f4f1] transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["Product", "Price", "Clicked At", "ID"].map((h) => (
                <th key={h} className="py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-16">
                  <Loader2 className="size-6 animate-spin mx-auto text-[#5c403a]" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-16">
                  <div className="text-center">
                    <MousePointerClick className="size-10 mx-auto text-[#5c403a]/40 mb-2" aria-hidden="true" />
                    <p className="font-mono text-[13px] text-[#5c403a]">No click logs found</p>
                    <p className="font-mono text-[11px] text-[#906f69] mt-1">Clicks will appear here when users interact with your products.</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4 font-mono text-[13px] text-[#5c403a] border-t border-dashed border-[#e5beb6] mt-4">
          <p>
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1 hover:text-[#1a1c1b] disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`size-7 flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                  page === p ? "bg-[#1a1c1b] text-[#FAFAF7]" : "hover:bg-[#f4f4f1]"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="p-1 hover:text-[#1a1c1b] disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
