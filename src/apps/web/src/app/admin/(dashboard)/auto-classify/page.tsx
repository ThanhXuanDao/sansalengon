"use client"

import { useState, useCallback } from "react"
import { Wand2, CheckCircle, RefreshCw } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, Alert, PageSpinner, EmptyState } from "@/components/admin/ui"

interface ClassificationResult {
  productId: string
  productName: string
  suggestedNicheId: string
  suggestedNicheName: string
  confidence: number
  reasoning: string
  model: string
}

type ApplyStatus = "idle" | "applying" | "applied" | "error"

interface Row extends ClassificationResult {
  applyStatus: ApplyStatus
}

const confidenceBadge = (c: number) => {
  if (c >= 0.8) return "bg-[#d4edda] text-[#155724] border-[#c3e6cb]"
  if (c >= 0.5) return "bg-[#fff3cd] text-[#856404] border-[#ffeeba]"
  return "bg-[#ffdad6] text-[#ba1a1a] border-[#f5c6cb]"
}

export default function AutoClassifyPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(20)
  const [error, setError] = useState<string | null>(null)

  const runClassification = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRows([])
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/admin/auto-classify?limit=${limit}`, {
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) {
        const json = await res.json() as { error: string }
        throw new Error(json.error ?? "Failed")
      }
      const json = await res.json() as { results: ClassificationResult[] }
      setRows(json.results.map((r) => ({ ...r, applyStatus: "idle" })))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [limit])

  const applyCategory = async (productId: string, categoryId: string) => {
    setRows((prev) =>
      prev.map((r) => r.productId === productId ? { ...r, applyStatus: "applying" } : r),
    )
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch("/api/admin/auto-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ productId, categoryId }),
      })
      if (!res.ok) throw new Error("Failed")
      setRows((prev) =>
        prev.map((r) => r.productId === productId ? { ...r, applyStatus: "applied" } : r),
      )
    } catch {
      setRows((prev) =>
        prev.map((r) => r.productId === productId ? { ...r, applyStatus: "error" } : r),
      )
    }
  }

  const appliedCount = rows.filter((r) => r.applyStatus === "applied").length
  const highConfCount = rows.filter((r) => r.confidence >= 0.8).length

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell title="Phân loại tự động" subtitle="Phân loại sản phẩm vào đúng danh mục bằng AI. Xem xét và áp dụng gợi ý." />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block font-mono text-[14px] tracking-[0.05em] text-[#5c403a] mb-1">
            Số sản phẩm phân tích
          </label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00]"
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>{n} sản phẩm</option>
            ))}
          </select>
        </div>
        <Button
          variant="primary"
          icon={Wand2}
          onClick={runClassification}
          loading={loading}
          disabled={loading}
        >
          {loading ? "Đang phân tích…" : "Chạy phân loại AI"}
        </Button>
        {rows.length > 0 && (
          <Button
            variant="ghost"
            icon={RefreshCw}
            onClick={runClassification}
            disabled={loading}
          >
            Làm mới
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Summary tiles */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Đã phân tích", value: rows.length },
            { label: "Độ tin cậy cao (≥80%)", value: highConfCount },
            { label: "Đã áp dụng", value: appliedCount },
            { label: "Chưa áp dụng", value: rows.length - appliedCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-[#e5e1d8] p-4">
              <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] mb-1">{label}</p>
              <p className="font-sans text-[28px] font-black text-[#1a1c1b]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#f4f4f1]/50">
                {["Sản phẩm", "Danh mục gợi ý", "Độ tin cậy", "Lý do AI", "Hành động"].map((h) => (
                  <th key={h} className="py-3 px-5 font-mono text-[11px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
              {rows.map((row) => (
                <tr key={row.productId} className={`transition-colors ${row.applyStatus === "applied" ? "bg-[#d4edda]/20" : "hover:bg-[#FAFAF7]"}`}>
                  <td className="py-3 px-5 max-w-[220px]">
                    <p className="font-sans text-[14px] font-bold text-[#1a1c1b] line-clamp-2">{row.productName}</p>
                    <p className="font-mono text-[10px] text-[#906f69] mt-0.5">{row.productId.slice(0, 8)}…</p>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <span className="font-mono text-[13px] text-[#1a1c1b] font-bold">{row.suggestedNicheName}</span>
                    <p className="font-mono text-[10px] text-[#906f69]">{row.suggestedNicheId}</p>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full font-mono text-[11px] font-bold border ${confidenceBadge(row.confidence)}`}>
                      {Math.round(row.confidence * 100)}%
                    </span>
                  </td>
                  <td className="py-3 px-5 max-w-[240px]">
                    <p className="font-sans text-[12px] text-[#5c403a] italic line-clamp-2">{row.reasoning}</p>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    {row.applyStatus === "applied" ? (
                      <span className="flex items-center gap-1 font-mono text-[12px] text-[#155724]">
                        <CheckCircle className="size-4" />
                        Đã áp dụng
                      </span>
                    ) : row.applyStatus === "error" ? (
                      <span className="font-mono text-[12px] text-[#ba1a1a]">Lỗi</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => applyCategory(row.productId, row.suggestedNicheId)}
                        loading={row.applyStatus === "applying"}
                        disabled={row.applyStatus === "applying"}
                        className="bg-[#fdc73a] text-[#6f5400] hover:bg-[#ffd060]"
                      >
                        Áp dụng
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <EmptyState
          icon={Wand2}
          title="Chưa có kết quả"
          description='Nhấn "Chạy phân loại AI" để bắt đầu phân tích sản phẩm.'
        />
      )}
    </div>
  )
}
