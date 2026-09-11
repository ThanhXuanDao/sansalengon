"use client"

import { useState, useEffect, useCallback } from "react"
import { Cpu, Play, AlertCircle, CheckCircle, RefreshCw, Loader2 } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner } from "@/components/admin/ui"

interface EmbeddingStats {
  total: number
  embedded: number
  missing: number
  provider: "openai" | "gemini" | "none"
  model: string | null
  dims: number | null
  lastUpdated: string | null
}

interface RunResult {
  added: number
  failed: number
  skipped: number
}

const PROVIDER_INFO: Record<string, { name: string; cls: string }> = {
  openai: { name: "OpenAI text-embedding-3-small", cls: "text-[#155724] bg-[#d4edda] border-[#c3e6cb]" },
  gemini: { name: "Gemini text-embedding-004",     cls: "text-[#856404] bg-[#fff3cd] border-[#ffeeba]" },
  none:   { name: "Chưa cấu hình",                 cls: "text-[#ba1a1a] bg-[#ffdad6] border-[#f5c6cb]" },
}

export default function EmbeddingsPage() {
  const [stats, setStats] = useState<EmbeddingStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch("/api/admin/embeddings", { headers: { "x-csrf-token": csrfToken } })
      if (!res.ok) throw new Error("Failed")
      setStats(await res.json() as EmbeddingStats)
    } catch {
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const runEmbed = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const csrfToken = await ensureCsrfToken()
      const res = await fetch("/api/admin/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ limit }),
      })
      const json = await res.json() as RunResult & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed")
      setResult(json)
      await fetchStats()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setRunning(false)
    }
  }

  const coverage = stats ? Math.round((stats.embedded / Math.max(stats.total, 1)) * 100) : 0
  const provider = stats?.provider ?? "none"
  const provInfo = PROVIDER_INFO[provider]

  return (
    <div className="flex flex-col gap-6">
      <AdminPageShell title="Embeddings" subtitle="Tạo vector embedding cho sản phẩm để tăng độ chính xác matching đa sàn." />

      {/* Provider status */}
      <div className="bg-white border border-[#e5e1d8] p-5 mb-6">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-2">AI Provider</p>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full font-mono text-[12px] font-bold border ${provInfo.cls}`}>
            {provInfo.name}
          </span>
          {provider === "none" && (
            <p className="font-mono text-[12px] text-[#5c403a]">
              Cần set <code className="bg-[#f4f4f1] px-1">OPENAI_API_KEY</code> hoặc <code className="bg-[#f4f4f1] px-1">GOOGLE_AI_API_KEY</code> trong .env
            </p>
          )}
          {stats?.dims && (
            <span className="font-mono text-[12px] text-[#906f69]">{stats.dims} dims</span>
          )}
        </div>
      </div>

      {/* Stats tiles */}
      {loadingStats ? (
        <div className="py-12"><PageSpinner /></div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Tổng sản phẩm",  value: stats.total },
            { label: "Đã embedding",    value: stats.embedded },
            { label: "Chưa embedding",  value: stats.missing },
            { label: "Coverage",        value: `${coverage}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-[#e5e1d8] p-4">
              <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-1">{label}</p>
              <p className="font-sans text-[28px] font-black text-[#1a1c1b]">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Progress bar */}
      {stats && (
        <div className="bg-white border border-[#e5e1d8] p-5 mb-6">
          <div className="flex justify-between items-center mb-2">
            <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase">Coverage</p>
            <p className="font-mono text-[13px] font-bold text-[#1a1c1b]">{stats.embedded} / {stats.total}</p>
          </div>
          <div className="h-3 bg-[#f4f4f1] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a1c1b] transition-all duration-500"
              style={{ width: `${coverage}%` }}
            />
          </div>
          {stats.lastUpdated && (
            <p className="font-mono text-[10px] text-[#906f69] mt-2">
              Cập nhật lần cuối: {new Date(stats.lastUpdated).toLocaleString("vi-VN")}
            </p>
          )}
        </div>
      )}

      {/* Run controls */}
      <div className="bg-white border border-[#e5e1d8] p-5 mb-6">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-4">
          Tạo embedding cho sản phẩm chưa có
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block font-mono text-[11px] text-[#5c403a] mb-1">Số lượng mỗi lần chạy</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-[#e5e1d8] bg-white px-3 py-2 font-mono text-[13px] text-[#1a1c1b] focus:outline-none focus:border-[#b51c00]"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>{n} sản phẩm</option>
              ))}
            </select>
          </div>
          <button
            onClick={runEmbed}
            disabled={running || provider === "none"}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c1b] text-[#FAFAF7] font-mono text-[13px] tracking-[0.05em] hover:bg-[#2c2e2d] disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {running ? "Đang tạo…" : "Chạy ngay"}
          </button>
          <button
            onClick={fetchStats}
            disabled={loadingStats}
            className="flex items-center gap-2 px-4 py-2.5 border border-[#e5e1d8] font-mono text-[13px] text-[#5c403a] hover:bg-[#f4f4f1] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
        </div>
        <p className="font-mono text-[11px] text-[#906f69] mt-3">
          Cron tự động chạy mỗi Chủ nhật 3:00 SA để embed sản phẩm mới. Chạy thủ công khi muốn tức thì.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div className="flex items-start gap-3 p-4 bg-[#d4edda]/30 border border-[#155724]/20 mb-4">
          <CheckCircle className="size-5 text-[#155724] shrink-0 mt-0.5" />
          <div>
            <p className="font-mono text-[13px] font-bold text-[#155724]">Hoàn thành</p>
            <p className="font-mono text-[12px] text-[#5c403a]">
              +{result.added} mới · {result.failed} lỗi · {result.skipped} đã có sẵn
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#ffdad6]/30 border border-[#ba1a1a]/30">
          <AlertCircle className="size-5 text-[#ba1a1a] shrink-0" />
          <p className="font-mono text-[13px] text-[#ba1a1a]">{error}</p>
        </div>
      )}

      {/* How it works */}
      <div className="mt-8 p-5 bg-[#f9f9f6] border border-dashed border-[#e5beb6]">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] uppercase mb-3">Cách hoạt động</p>
        <ul className="space-y-2">
          {[
            "Mỗi tên sản phẩm được chuyển thành vector số (embedding) qua AI model",
            "Khi matching đa sàn, tính cosine similarity giữa sản phẩm gốc và candidate",
            "Score = cosineSim×50% + tokenOverlap×35% + editSim×15% (thay vì token+edit 100%)",
            "Sản phẩm tương tự ngữ nghĩa ('áo phông' vs 'áo thun') sẽ được match chính xác hơn ~30-40%",
          ].map((text, i) => (
            <li key={i} className="flex items-start gap-2 font-mono text-[12px] text-[#5c403a]">
              <Cpu className="size-3.5 text-[#b51c00] shrink-0 mt-0.5" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
