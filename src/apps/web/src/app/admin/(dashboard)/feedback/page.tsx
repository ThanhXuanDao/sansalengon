"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquare, Trash2 } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, Badge, PageSpinner, EmptyState, Pagination, ConfirmModal, useToast } from "@/components/admin/ui"

type Sentiment = "positive" | "negative" | "neutral" | "suggestion"

const SENTIMENT_TONE: Record<Sentiment, "green" | "red" | "gray" | "yellow"> = {
  positive:   "green",
  negative:   "red",
  neutral:    "gray",
  suggestion: "yellow",
}

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive:   "Tích cực",
  negative:   "Tiêu cực",
  neutral:    "Trung tính",
  suggestion: "Góp ý",
}

interface FeedbackEntry {
  id: string
  name: string
  email: string
  message: string
  sentiment?: Sentiment
  sentimentScore?: number
  createdAt: string
}

interface FeedbackResponse {
  data: FeedbackEntry[]
  total: number
  page: number
  totalPages: number
}

export default function AdminFeedback() {
  const { success, error: toastError } = useToast()
  const [feedbacks, setFeedbacks] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<FeedbackEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
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
    } catch {
      setFeedbacks([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchFeedbacks() }, [fetchFeedbacks])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch(`/api/feedback?id=${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
      })
      if (!res.ok) throw new Error("Failed to delete")
      setFeedbacks((prev) => prev.filter((f) => f.id !== deleteTarget.id))
      setTotal((prev) => prev - 1)
      success("Đã xóa phản hồi")
      setDeleteTarget(null)
    } catch {
      toastError("Không thể xóa phản hồi")
    } finally {
      setDeleting(false)
    }
  }

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

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell title="Phản hồi" subtitle="Góp ý và phản hồi từ khách hàng." />

      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] text-[#5c403a]">
          {total} phản hồi
        </span>
      </div>

      <div className="bg-white border border-[#e5e1d8] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="bg-[#f4f4f1]/50">
              {["Họ tên", "Email", "Tin nhắn", "Cảm xúc", "Ngày gửi", "Thao tác"].map((h) => (
                <th key={h} className="py-4 px-6 font-mono text-[13px] leading-[16px] tracking-[0.05em] text-[#5c403a] font-bold uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-[#e5e1d8]">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16">
                  <PageSpinner />
                </td>
              </tr>
            ) : feedbacks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4">
                  <EmptyState
                    icon={MessageSquare}
                    title="Chưa có phản hồi"
                    description="Phản hồi sẽ xuất hiện khi khách hàng gửi góp ý."
                  />
                </td>
              </tr>
            ) : feedbacks.map((fb) => (
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
                  {fb.sentiment ? (
                    <Badge tone={SENTIMENT_TONE[fb.sentiment]}>
                      {SENTIMENT_LABEL[fb.sentiment]}
                    </Badge>
                  ) : (
                    <span className="font-mono text-[11px] text-[#906f69]">—</span>
                  )}
                </td>
                <td className="py-4 px-6 whitespace-nowrap">
                  <span className="font-mono text-[12px] text-[#906f69]">
                    {formatDate(fb.createdAt)}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setDeleteTarget(fb)}
                    aria-label={`Xóa phản hồi từ ${fb.name}`}
                    className="hover:text-[#ba1a1a] hover:bg-[#ffdad6]/20"
                  />
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

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa phản hồi"
        message={`Bạn có chắc muốn xóa phản hồi từ "${deleteTarget?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        danger
        loading={deleting}
      />
    </div>
  )
}
