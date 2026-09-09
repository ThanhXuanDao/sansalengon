"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquare, Loader2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"

interface FeedbackEntry {
  id: string
  name: string
  email: string
  message: string
  createdAt: string
}

interface FeedbackResponse {
  data: FeedbackEntry[]
  total: number
  page: number
  totalPages: number
}

export default function AdminFeedback() {
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const limit = 25

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))

      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/feedback?${params.toString()}`, {
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const json: FeedbackResponse = await res.json()
      setFeedbacks(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
    } catch {
      setFeedbacks([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchFeedbacks() }, [fetchFeedbacks])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/feedback?id=${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) throw new Error("Failed to delete")
      setFeedbacks((prev) => prev.filter((f) => f.id !== id))
      setTotal((prev) => prev - 1)
    } catch {
      // Non-critical
    } finally {
      setDeleting(null)
    }
  }

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

  return (
    <div className="max-w-6xl mx-auto pb-24">
      <div className="mb-8 border-b border-dashed border-[#e5beb6] pb-4">
        <h2 className="font-sans text-[40px] leading-[48px] tracking-[-0.02em] font-extrabold text-[#1a1c1b] uppercase mb-2">
          Feedback
        </h2>
        <p className="font-sans text-[16px] leading-[24px] text-[#5c403a]">
          Saran dan masukan dari pengunjung toko.
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <span className="font-mono text-[13px] text-[#5c403a]">
          {total} total feedback
        </span>
      </div>

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["Nama", "Email", "Pesan", "Tanggal", "Aksi"].map((h) => (
                <th key={h} className="py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <Loader2 className="size-6 animate-spin mx-auto text-[#5c403a]" />
                </td>
              </tr>
            ) : feedbacks.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <div className="text-center">
                    <MessageSquare className="size-10 mx-auto text-[#5c403a]/40 mb-2" aria-hidden="true" />
                    <p className="font-mono text-[13px] text-[#5c403a]">Belum ada feedback</p>
                    <p className="font-mono text-[11px] text-[#906f69] mt-1">
                      Feedback akan muncul di sini ketika pengunjung mengirim saran.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              feedbacks.map((fb) => (
                <tr key={fb.id} className="hover:bg-[#FAFAF7] transition-colors">
                  <td className="py-4 px-6">
                    <span className="font-sans text-[16px] leading-[24px] font-bold text-[#1a1c1b]">
                      {fb.name}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-mono text-[13px] text-[#5c403a]">
                      {fb.email}
                    </span>
                  </td>
                  <td className="py-4 px-6 max-w-[280px]">
                    <p className="font-sans text-[14px] text-[#1a1c1b] line-clamp-3">
                      {fb.message}
                    </p>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className="font-mono text-[12px] text-[#906f69]">
                      {formatDate(fb.createdAt)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      onClick={() => handleDelete(fb.id)}
                      disabled={deleting === fb.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded font-mono text-[12px] text-[#ba1a1a] border border-[#ba1a1a]/30 hover:bg-[#ffdad6]/20 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
                      aria-label={`Hapus feedback dari ${fb.name}`}
                    >
                      {deleting === fb.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Trash2 className="size-3" aria-hidden="true" />
                      )}
                      Hapus
                    </button>
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
            Halaman {page} dari {totalPages} ({total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1 hover:text-[#1a1c1b] disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
              aria-label="Halaman sebelumnya"
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
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
