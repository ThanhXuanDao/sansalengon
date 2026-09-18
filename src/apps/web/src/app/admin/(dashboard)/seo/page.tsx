"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, RefreshCw, Loader2, CheckCircle2, XCircle, Sparkles, AlertTriangle } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { PageSpinner } from "@/components/admin/ui"

// ── Types ─────────────────────────────────────────────────────────────────────

interface NicheStatus {
  id: string
  name: string
  emoji: string
  hasAiMeta: boolean
  cached: {
    title: string
    description: string
    generatedAt?: string
  } | null
  templateTitle: string
  templateDesc: string
}

interface SeoData {
  hasApiKey: boolean
  niches: NicheStatus[]
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SeoPage() {
  const [data, setData] = useState<SeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/generate-seo", { headers: { "x-csrf-token": csrf } })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const generateNiche = async (nicheId: string) => {
    setGeneratingId(nicheId)
    setLastResult(null)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ target: "niche", nicheId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unknown error")
      setLastResult(`✓ Đã generate SEO cho ${nicheId} (${json.result.model})`)
      await fetchStatus()
    } catch (e) {
      setLastResult(`✗ ${(e as Error).message}`)
    } finally {
      setGeneratingId(null)
    }
  }

  const generateAll = async () => {
    setGeneratingAll(true)
    setLastResult(null)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/generate-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ target: "all_niches" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Unknown error")
      const aiCount = json.summary.filter((s: { model: string }) => s.model === "ai").length
      setLastResult(`✓ Done — ${aiCount}/${json.summary.length} ngách dùng AI`)
      await fetchStatus()
    } catch (e) {
      setLastResult(`✗ ${(e as Error).message}`)
    } finally {
      setGeneratingAll(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="SEO tự động"
        subtitle="Tự động generate title và description cho các trang ngách bằng Claude AI."
        actions={data && !loading ? (
          <button
            onClick={generateAll}
            disabled={generatingAll || !data.hasApiKey}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1a1c1b] text-[#fafaf7] font-mono text-[13px] hover:bg-[#2c2e2d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generatingAll ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generatingAll ? "Đang generate..." : "Generate tất cả ngách"}
          </button>
        ) : undefined}
      />

      {/* API key warning */}
      {data && !data.hasApiKey && (
        <div className="flex items-start gap-3 bg-[#fff9c4] border border-[#f57f17]/30 px-4 py-3 mb-6">
          <AlertTriangle className="size-4 text-[#f57f17] mt-0.5 shrink-0" />
          <div>
            <p className="font-mono text-[13px] text-[#5c403a] font-bold">ANTHROPIC_API_KEY chưa được cấu hình</p>
            <p className="font-mono text-[12px] text-[#906f69] mt-0.5">
              Thêm <code className="bg-white px-1">ANTHROPIC_API_KEY=sk-ant-…</code> vào file <code className="bg-white px-1">.env</code> và restart server để dùng AI.
              Khi không có API key, các trang sẽ dùng meta template tĩnh.
            </p>
          </div>
        </div>
      )}

      {/* Last result banner */}
      {lastResult && (
        <div className={`px-4 py-2.5 mb-6 font-mono text-[13px] border ${
          lastResult.startsWith("✓")
            ? "bg-[#e8f5e9] border-[#2e7d32]/20 text-[#2e7d32]"
            : "bg-[#ffdad6] border-[#b51c00]/20 text-[#b51c00]"
        }`}>
          {lastResult}
        </div>
      )}

      {/* How it works */}
      <div className="bg-[#fafaf7] border border-dashed border-[#e5beb6] p-4 mb-6 space-y-2">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] font-bold">Cách hoạt động</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-[12px] text-[#5c403a]">
          <p>• <strong>Niche pages</strong> — generate thủ công tại đây, cache vào DB</p>
          <p>• <strong>Compare pages</strong> — generate tự động khi trang được crawl lần đầu</p>
          <p>• Model: <code className="bg-white px-1">claude-haiku-4-5</code> (~$0.0003/lần)</p>
          <p>• Fallback về template nếu không có API key hoặc generate thất bại</p>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="py-24"><PageSpinner /></div>
      ) : !data ? (
        <div className="text-center py-24 font-mono text-[13px] text-[#906f69]">
          Không thể tải dữ liệu.{" "}
          <button onClick={fetchStatus} className="text-[#b51c00] underline">Thử lại</button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.05em] text-[#5c403a]">
              Trang ngách ({data.niches.filter((n) => n.hasAiMeta).length}/{data.niches.length} có AI meta)
            </p>
            <button onClick={fetchStatus} className="p-1.5 hover:bg-[#f4f4f1] rounded transition-colors">
              <RefreshCw className="size-3.5 text-[#5c403a]" />
            </button>
          </div>

          {data.niches.map((niche) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              generating={generatingId === niche.id}
              hasApiKey={data.hasApiKey}
              onGenerate={() => generateNiche(niche.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── NicheCard ─────────────────────────────────────────────────────────────────

function NicheCard({
  niche,
  generating,
  hasApiKey,
  onGenerate,
}: {
  niche: NicheStatus
  generating: boolean
  hasApiKey: boolean
  onGenerate: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="bg-white border border-[#e5e1d8] overflow-hidden clip-bevel-xs"
    >
      {/* Row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status icon */}
        <div className="shrink-0">
          {niche.hasAiMeta ? (
            <CheckCircle2 className="size-4 text-[#2e7d32]" />
          ) : (
            <XCircle className="size-4 text-[#906f69]" />
          )}
        </div>

        {/* Niche info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[18px]">{niche.emoji}</span>
            <span className="font-sans text-[15px] font-bold text-[#1a1c1b]">{niche.name}</span>
            {niche.hasAiMeta && (
              <span className="font-mono text-[10px] uppercase tracking-[0.05em] px-1.5 py-0.5 bg-[#e8f5e9] text-[#2e7d32] border border-[#2e7d32]/20">
                AI
              </span>
            )}
          </div>
          <p className="font-mono text-[12px] text-[#906f69] truncate">
            {niche.hasAiMeta ? niche.cached!.title : niche.templateTitle}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="font-mono text-[11px] text-[#5c403a] underline hover:text-[#1a1c1b]"
          >
            {expanded ? "Ẩn" : "Chi tiết"}
          </button>
          <button
            onClick={onGenerate}
            disabled={generating || !hasApiKey}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1c1b] text-[#fafaf7] font-mono text-[12px] hover:bg-[#2c2e2d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            {generating ? "..." : niche.hasAiMeta ? "Refresh" : "Generate"}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#f4f4f1] bg-[#fafaf7] px-5 py-4 space-y-4">
          {/* Current (AI or template) */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-2 font-bold">
              {niche.hasAiMeta ? "AI Meta (đang dùng)" : "Template (fallback)"}
            </p>
            <div className="space-y-2">
              <div>
                <p className="font-mono text-[10px] text-[#906f69] mb-0.5">Title</p>
                <p className="font-sans text-[13px] text-[#1a1c1b]">
                  {niche.hasAiMeta ? niche.cached!.title : niche.templateTitle}
                </p>
                <p className="font-mono text-[10px] text-[#906f69] mt-0.5">
                  {(niche.hasAiMeta ? niche.cached!.title : niche.templateTitle).length} ký tự
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] text-[#906f69] mb-0.5">Description</p>
                <p className="font-sans text-[13px] text-[#1a1c1b]">
                  {niche.hasAiMeta ? niche.cached!.description : niche.templateDesc}
                </p>
                <p className="font-mono text-[10px] text-[#906f69] mt-0.5">
                  {(niche.hasAiMeta ? niche.cached!.description : niche.templateDesc).length} ký tự
                  {niche.hasAiMeta && niche.cached?.generatedAt && (
                    <> · Generate lúc {new Date(niche.cached.generatedAt).toLocaleString("vi-VN")}</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Template reference (only show if using AI) */}
          {niche.hasAiMeta && (
            <div className="opacity-60">
              <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-2">Template (fallback)</p>
              <p className="font-sans text-[12px] text-[#5c403a] italic">{niche.templateTitle}</p>
              <p className="font-sans text-[12px] text-[#5c403a] italic mt-1">{niche.templateDesc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
