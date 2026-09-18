"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, XCircle, ExternalLink, Plus } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, EmptyState, Pagination, Modal } from "@/components/admin/ui"

interface ProductMatch {
  id: string
  productId: string
  platformId: string
  candidateUrl: string
  candidateName: string | null
  candidatePrice: number | null
  confidence: number
  status: "PENDING" | "CONFIRMED" | "REJECTED"
  product: {
    id: string
    name: string
    price: number
    imageUrl: string
  }
}

const PLATFORM_LABELS: Record<string, string> = {
  lazada: "Lazada",
  tiki:   "Tiki",
  tiktok: "TikTok Shop",
}

const PLATFORM_COLORS: Record<string, string> = {
  lazada: "#0f146b",
  tiki:   "#189eff",
  tiktok: "#010101",
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<ProductMatch[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED" | "REJECTED">("PENDING")
  const [platform, setPlatform] = useState("")
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  // Manual override form
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ productId: "", platformId: "lazada", candidateUrl: "", candidatePrice: "" })
  const [formSaving, setFormSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ status, page: String(page), ...(platform ? { platform } : {}) })
      const r = await fetch(`/api/admin/matches?${qs}`)
      const d = await r.json()
      setMatches(d.data ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [status, page, platform])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: "confirm" | "reject") => {
    setActing(id)
    try {
      await fetch(`/api/admin/matches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      setMatches((prev) => prev.filter((m) => m.id !== id))
      setTotal((t) => t - 1)
    } finally {
      setActing(null)
    }
  }

  const submitManual = async () => {
    setFormSaving(true)
    try {
      await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          candidatePrice: formData.candidatePrice ? Number(formData.candidatePrice) : null,
        }),
      })
      setShowForm(false)
      setFormData({ productId: "", platformId: "lazada", candidateUrl: "", candidatePrice: "" })
      load()
    } finally {
      setFormSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Ghép nối"
        subtitle={`${total} kết quả`}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowForm((v) => !v)}>
            Thêm thủ công
          </Button>
        }
      />

      {/* Manual override modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Thêm match thủ công"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={formSaving}>Huỷ</Button>
            <Button
              variant="primary"
              onClick={submitManual}
              loading={formSaving}
              disabled={formSaving || !formData.productId || !formData.candidateUrl}
            >
              Lưu override
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-[14px] text-[#5c403a] block mb-1">Product ID</label>
            <input
              value={formData.productId}
              onChange={(e) => setFormData((d) => ({ ...d, productId: e.target.value }))}
              placeholder="cuid của product"
              className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[13px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>
          <div>
            <label className="font-mono text-[14px] text-[#5c403a] block mb-1">Platform</label>
            <select
              value={formData.platformId}
              onChange={(e) => setFormData((d) => ({ ...d, platformId: e.target.value }))}
              className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[13px] focus:outline-none focus:border-[#b51c00] bg-white"
            >
              <option value="lazada">Lazada</option>
              <option value="tiki">Tiki</option>
              <option value="tiktok">TikTok Shop</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="font-mono text-[14px] text-[#5c403a] block mb-1">URL sản phẩm</label>
            <input
              value={formData.candidateUrl}
              onChange={(e) => setFormData((d) => ({ ...d, candidateUrl: e.target.value }))}
              placeholder="https://lazada.vn/products/..."
              className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[13px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>
          <div>
            <label className="font-mono text-[14px] text-[#5c403a] block mb-1">Giá hiện tại (VND)</label>
            <input
              type="number"
              value={formData.candidatePrice}
              onChange={(e) => setFormData((d) => ({ ...d, candidatePrice: e.target.value }))}
              placeholder="250000"
              className="w-full border border-[#e5beb6] px-2 py-1.5 font-mono text-[13px] focus:outline-none focus:border-[#b51c00]"
            />
          </div>
        </div>
      </Modal>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["PENDING", "CONFIRMED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1 font-mono text-[11px] uppercase border transition-all ${
              status === s ? "bg-ink text-white border-ink" : "bg-white text-ink/50 border-border-color"
            }`}
          >
            {s}
          </button>
        ))}
        <select
          value={platform}
          onChange={(e) => { setPlatform(e.target.value); setPage(1) }}
          className="border border-border-color px-2 py-1 font-mono text-[11px] bg-white text-ink/60 focus:outline-none focus:border-ink"
        >
          <option value="">Tất cả sàn</option>
          <option value="lazada">Lazada</option>
          <option value="tiki">Tiki</option>
          <option value="tiktok">TikTok</option>
        </select>
      </div>

      {/* Match list */}
      {loading ? (
        <div className="py-16 bg-white border border-[#e5e1d8]">
          <PageSpinner />
        </div>
      ) : matches.length === 0 ? (
        <div className="bg-white border border-[#e5e1d8]">
          <EmptyState
            icon={CheckCircle2}
            title={`Không có match nào`}
            description={`Không có match nào ở trạng thái ${status}`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((m) => {
            const ratio = m.candidatePrice && m.product.price
              ? m.candidatePrice / m.product.price
              : null
            const isSuspicious = ratio !== null && (ratio > 3 || ratio < 0.33)

            return (
              <div
                key={m.id}
                className={`flex gap-4 items-start p-4 border ${isSuspicious ? "border-[#b51c00]/40 bg-[#fff0ed]" : "border-border-color bg-white"}`}
              >
                {/* Product image */}
                <img
                  src={m.product.imageUrl}
                  alt={m.product.name}
                  className="w-14 h-14 object-cover border border-border-color shrink-0"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-mono text-[12px] font-bold text-ink line-clamp-1">{m.product.name}</p>
                    <span
                      className="font-mono text-[10px] font-bold px-2 py-0.5 shrink-0"
                      style={{
                        background: PLATFORM_COLORS[m.platformId] ? `${PLATFORM_COLORS[m.platformId]}18` : "#f0f0f0",
                        color: PLATFORM_COLORS[m.platformId] ?? "#555",
                        border: `1px solid ${PLATFORM_COLORS[m.platformId] ?? "#ccc"}`,
                      }}
                    >
                      {PLATFORM_LABELS[m.platformId] ?? m.platformId}
                    </span>
                  </div>

                  <p className="font-mono text-[11px] text-ink/50 line-clamp-1 mb-1">
                    {m.candidateName ?? "—"}
                  </p>

                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-[11px] text-ink/60">
                      Shopee: <strong>{formatPrice(m.product.price)}</strong>
                    </span>
                    {m.candidatePrice && (
                      <span className={`font-mono text-[11px] ${isSuspicious ? "text-[#b51c00] font-bold" : "text-ink/60"}`}>
                        {PLATFORM_LABELS[m.platformId]}: <strong>{formatPrice(m.candidatePrice)}</strong>
                        {isSuspicious && " ⚠ suspicious"}
                      </span>
                    )}
                    <span className={`font-mono text-[10px] px-1.5 py-0.5 ${
                      m.confidence >= 0.95
                        ? "bg-[#edfaf1] text-[#1a6e3c]"
                        : m.confidence >= 0.85
                          ? "bg-[#fdf6e3] text-[#c9922a]"
                          : "bg-[#fff0ed] text-[#b51c00]"
                    }`}>
                      {(m.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ExternalLink}
                    as="a"
                    href={m.candidateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xem
                  </Button>
                  {status === "PENDING" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CheckCircle2}
                        onClick={() => act(m.id, "confirm")}
                        disabled={!!acting}
                        loading={acting === m.id}
                        className="text-[#1a6e3c] hover:bg-[#edfaf1]"
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={XCircle}
                        onClick={() => act(m.id, "reject")}
                        disabled={!!acting}
                        className="text-[#b51c00] hover:bg-[#fff0ed]"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Pagination page={page} total={total} pageSize={20} onChange={setPage} />
    </div>
  )
}
