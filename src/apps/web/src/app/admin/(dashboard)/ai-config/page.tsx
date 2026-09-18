"use client"

import { useState, useEffect, useCallback } from "react"
import { Bot, RefreshCw, CheckCircle2, Lock, ExternalLink, Image, FileText, ToggleLeft, ToggleRight, DollarSign, Loader2 } from "lucide-react"
import { ensureCsrfToken } from "@/lib/utils"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Button, PageSpinner, useToast } from "@/components/admin/ui"
import type { ProviderInfo, FeatureMeta } from "@/lib/ai-config"

// ── Types ─────────────────────────────────────────────────────────────────────

type AITask = "post_generation" | "blog_writing" | "seo_meta" | "image_generation"

interface ProviderWithAvail extends ProviderInfo {
  available: boolean
}

interface ConfigData {
  textProviders: ProviderWithAvail[]
  imageProviders: ProviderWithAvail[]
  config: Record<AITask, string>
  featureFlags: Record<AITask, boolean>
  taskLabels: Record<AITask, string>
  featureMeta: Record<AITask, FeatureMeta>
  defaults: Record<AITask, string>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEXT_TASKS: AITask[] = ["post_generation", "blog_writing", "seo_meta"]
const IMAGE_TASKS: AITask[] = ["image_generation"]

// Provider badge colors
const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gemini:      { bg: "bg-[#e8f5e9]", text: "text-[#2e7d32]", border: "border-[#2e7d32]/20" },
  deepseek:    { bg: "bg-[#e3f2fd]", text: "text-[#1565c0]", border: "border-[#1565c0]/20" },
  openai:      { bg: "bg-[#f4f4f1]", text: "text-[#1a1c1b]", border: "border-[#1a1c1b]/20" },
  claude:      { bg: "bg-[#fce4ec]", text: "text-[#880e4f]", border: "border-[#880e4f]/20" },
  pollinations:{ bg: "bg-[#e8f5e9]", text: "text-[#2e7d32]", border: "border-[#2e7d32]/20" },
  dalle:       { bg: "bg-[#f4f4f1]", text: "text-[#1a1c1b]", border: "border-[#1a1c1b]/20" },
  stability:   { bg: "bg-[#ede7f6]", text: "text-[#4527a0]", border: "border-[#4527a0]/20" },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ALL_TASKS: AITask[] = ["post_generation", "blog_writing", "seo_meta", "image_generation"]

export default function AIConfigPage() {
  const { success, error: toastError } = useToast()
  const [data, setData] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<AITask | null>(null)
  const [toggling, setToggling] = useState<AITask | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/ai-config", { headers: { "x-csrf-token": csrf } })
      if (res.ok) setData(await res.json())
      else toastError("Không thể tải cấu hình AI")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleFeature = async (feature: AITask, enabled: boolean) => {
    setToggling(feature)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action: "toggle_feature", feature, enabled }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error")
      setData((prev) =>
        prev ? { ...prev, featureFlags: { ...prev.featureFlags, [feature]: enabled } } : prev
      )
      const label = data?.featureMeta[feature]?.label ?? feature
      success(`${enabled ? "Bật" : "Tắt"} "${label}"`)
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setToggling(null)
    }
  }

  const saveProvider = async (task: AITask, providerId: string) => {
    setSaving(task)
    try {
      const csrf = await ensureCsrfToken()
      const res = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ task, providerId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? "Error")
      setData((prev) => prev ? { ...prev, config: { ...prev.config, [task]: providerId } } : prev)
      success(`Đã cập nhật "${data?.taskLabels[task]}"`)
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="py-24"><PageSpinner /></div>

  if (!data) return (
    <div className="py-8 flex justify-center">
      <Button variant="ghost" size="sm" onClick={fetchData}>Thử lại</Button>
    </div>
  )

  const availableText  = data.textProviders.filter((p) => p.available).length
  const availableImage = data.imageProviders.filter((p) => p.available).length

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Cấu hình AI"
        subtitle="Chọn AI provider cho từng tác vụ. Thay đổi áp dụng ngay, không cần restart."
        actions={
          <Button variant="ghost" icon={RefreshCw} onClick={fetchData} aria-label="Làm mới" />
        }
      />

      {/* Provider availability summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#fafaf7] border border-[#e5e1d8] px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">Text AI</p>
          <p className="font-sans text-[28px] font-extrabold text-[#1a1c1b]">{availableText}<span className="text-[#906f69] text-[16px] font-normal">/{data.textProviders.length}</span></p>
          <p className="font-mono text-[11px] text-[#906f69]">provider đã có API key</p>
        </div>
        <div className="bg-[#fafaf7] border border-[#e5e1d8] px-5 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.05em] text-[#5c403a] mb-1">Image AI</p>
          <p className="font-sans text-[28px] font-extrabold text-[#1a1c1b]">{availableImage}<span className="text-[#906f69] text-[16px] font-normal">/{data.imageProviders.length}</span></p>
          <p className="font-mono text-[11px] text-[#906f69]">provider khả dụng</p>
        </div>
      </div>

      {/* Text provider catalog */}
      <section>
        <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3">
          <FileText className="size-4 text-[#b51c00]" />
          Text / Content Providers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {data.textProviders.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>

        {/* Task → provider assignment */}
        <div className="space-y-2">
          {TEXT_TASKS.map((task) => (
            <TaskRow
              key={task}
              task={task}
              label={data.taskLabels[task]}
              providers={data.textProviders}
              currentId={data.config[task]}
              saving={saving === task}
              onSave={(pid) => saveProvider(task, pid)}
            />
          ))}
        </div>
      </section>

      {/* Image provider catalog */}
      <section>
        <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3">
          <Image className="size-4 text-[#b51c00]" />
          Image Generation Providers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {data.imageProviders.map((p) => (
            <ProviderCard key={p.id} provider={p} compact />
          ))}
        </div>

        <div className="space-y-2">
          {IMAGE_TASKS.map((task) => (
            <TaskRow
              key={task}
              task={task}
              label={data.taskLabels[task]}
              providers={data.imageProviders}
              currentId={data.config[task]}
              saving={saving === task}
              onSave={(pid) => saveProvider(task, pid)}
            />
          ))}
        </div>
      </section>

      {/* Feature flags — cost control */}
      <section>
        <h3 className="font-sans text-[16px] font-bold text-[#1a1c1b] mb-4 flex items-center gap-2 border-b border-dashed border-[#e5beb6] pb-3">
          <DollarSign className="size-4 text-[#b51c00]" />
          Kiểm soát chi phí — Bật / Tắt từng tính năng AI
        </h3>
        <div className="bg-[#fffbf0] border border-[#fdc73a]/50 px-4 py-2.5 mb-3">
          <p className="font-mono text-[12px] text-[#6f5400]">
            Tắt tính năng để ngăn AI gọi API — giúp kiểm soát chi phí. Nội dung đã cache vẫn hiển thị bình thường.
          </p>
        </div>
        <div className="space-y-2">
          {data && ALL_TASKS.map((task) => {
            const meta = data.featureMeta[task]
            const enabled = data.featureFlags[task]
            const isToggling = toggling === task
            return (
              <div
                key={task}
                className={`border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors clip-bevel-xs ${
                  enabled ? "bg-white border-[#e5e1d8]" : "bg-[#fafaf7] border-dashed border-[#e5e1d8]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`font-sans text-[14px] font-bold ${enabled ? "text-[#1a1c1b]" : "text-[#906f69]"}`}>
                      {meta.label}
                    </p>
                    {!enabled && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#f4f4f1] text-[#906f69] border border-[#e5e1d8]">
                        TẮT
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-[#906f69]">{meta.desc}</p>
                  <p className="font-mono text-[11px] text-[#5c403a] mt-0.5">
                    Chi phí: <span className="font-bold">{meta.costNote}</span>
                  </p>
                </div>
                <button
                  onClick={() => !isToggling && toggleFeature(task, !enabled)}
                  disabled={isToggling}
                  className={`flex items-center gap-2 px-4 py-2 font-mono text-[13px] border transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none ${
                    enabled
                      ? "bg-[#1a1c1b] text-[#fafaf7] border-[#1a1c1b] hover:bg-[#333]"
                      : "border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] hover:text-[#1a1c1b] bg-white"
                  }`}
                >
                  {isToggling
                    ? <Loader2 className="size-4 animate-spin" />
                    : enabled
                    ? <ToggleRight className="size-4" />
                    : <ToggleLeft className="size-4" />
                  }
                  {enabled ? "Đang bật" : "Đang tắt"}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ENV key guide */}
      <section className="bg-[#fafaf7] border border-dashed border-[#e5beb6] p-5 space-y-3">
        <p className="font-mono text-[11px] tracking-[0.05em] text-[#5c403a] font-bold">Cách thêm API key</p>
        <div className="font-mono text-[12px] text-[#5c403a] space-y-1">
          <p>Thêm vào file <code className="bg-white px-1 border border-[#e5e1d8]">src/.env</code> và restart web server:</p>
          <div className="bg-white border border-[#e5e1d8] p-3 space-y-1 mt-2">
            {[...data.textProviders, ...data.imageProviders]
              .filter((p) => p.envKey && !p.available)
              .filter((p, i, arr) => arr.findIndex((x) => x.envKey === p.envKey) === i)
              .map((p) => (
                <div key={p.envKey} className="flex items-center justify-between gap-4">
                  <code className="text-[#b51c00]">{p.envKey}=<span className="text-[#906f69]">your_key_here</span></code>
                  <a
                    href={p.getKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#006af5] hover:underline text-[11px]"
                  >
                    Lấy key <ExternalLink className="size-3" />
                  </a>
                </div>
              ))
            }
            {[...data.textProviders, ...data.imageProviders].every((p) => !p.envKey || p.available) && (
              <p className="text-[#2e7d32]">✓ Tất cả provider đã có API key</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// ── ProviderCard ──────────────────────────────────────────────────────────────

function ProviderCard({ provider, compact = false }: { provider: ProviderWithAvail; compact?: boolean }) {
  const colors = PROVIDER_COLORS[provider.id] ?? { bg: "bg-[#f4f4f1]", text: "text-[#1a1c1b]", border: "border-[#e5e1d8]" }

  return (
    <div className={`border clip-bevel-xs ${provider.available ? "border-[#e5e1d8] bg-white" : "border-dashed border-[#e5e1d8] bg-[#fafaf7] opacity-70"} p-4`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-sans text-[14px] font-bold text-[#1a1c1b]">{provider.name}</span>
            {provider.available
              ? <span className={`font-mono text-[10px] px-1.5 py-0.5 border ${colors.bg} ${colors.text} ${colors.border}`}>✓ Ready</span>
              : <span className="font-mono text-[10px] px-1.5 py-0.5 bg-[#f4f4f1] text-[#906f69] border border-[#e5e1d8] flex items-center gap-1"><Lock className="size-2.5" />No key</span>
            }
          </div>
          <p className={`font-mono text-[11px] font-bold ${colors.text}`}>{provider.tagline}</p>
        </div>
      </div>
      {!compact && (
        <p className="font-mono text-[11px] text-[#906f69] leading-relaxed">{provider.freeTier}</p>
      )}
      {provider.envKey && !provider.available && (
        <div className="mt-2 flex items-center justify-between">
          <code className="font-mono text-[10px] text-[#5c403a] bg-white border border-[#e5e1d8] px-1.5 py-0.5">{provider.envKey}=</code>
          <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer"
            className="font-mono text-[10px] text-[#006af5] hover:underline flex items-center gap-0.5">
            Lấy key <ExternalLink className="size-2.5" />
          </a>
        </div>
      )}
    </div>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  label,
  providers,
  currentId,
  saving,
  onSave,
}: {
  task: AITask
  label: string
  providers: ProviderWithAvail[]
  currentId: string
  saving: boolean
  onSave: (providerId: string) => void
}) {
  const current = providers.find((p) => p.id === currentId)
  const colors = PROVIDER_COLORS[currentId] ?? { bg: "bg-[#f4f4f1]", text: "text-[#1a1c1b]", border: "border-[#e5e1d8]" }

  return (
    <div className="bg-white border border-[#e5e1d8] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 clip-bevel-xs">
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[14px] font-bold text-[#1a1c1b] mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#906f69]">Đang dùng:</span>
          <span className={`font-mono text-[11px] px-1.5 py-0.5 border ${colors.bg} ${colors.text} ${colors.border}`}>
            {current?.name ?? currentId}
          </span>
          {current && !current.available && (
            <span className="font-mono text-[10px] text-[#b51c00]">⚠ API key chưa có</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => p.id !== currentId && onSave(p.id)}
            disabled={saving || p.id === currentId}
            className={`px-3 py-1.5 font-mono text-[12px] border transition-colors flex items-center gap-1.5 ${
              p.id === currentId
                ? `${colors.bg} ${colors.text} ${colors.border} cursor-default`
                : p.available
                ? "border-[#e5e1d8] text-[#5c403a] hover:border-[#1a1c1b] hover:text-[#1a1c1b] bg-white"
                : "border-dashed border-[#e5e1d8] text-[#ccc] cursor-not-allowed bg-[#fafaf7]"
            }`}
            title={!p.available ? `${p.envKey} chưa được cấu hình` : undefined}
          >
            {saving && p.id === currentId
              ? <Loader2 className="size-3 animate-spin" />
              : p.id === currentId
              ? <CheckCircle2 className="size-3" />
              : !p.available
              ? <Lock className="size-3" />
              : null
            }
            {p.name.split(" ")[0]}
          </button>
        ))}
      </div>
    </div>
  )
}
