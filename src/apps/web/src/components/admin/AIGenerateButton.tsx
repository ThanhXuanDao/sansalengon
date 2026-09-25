"use client"

import { useState, useEffect } from "react"
import { Sparkles, Loader2, ChevronDown } from "lucide-react"

export interface ProviderOption {
  id: string
  name: string
  tagline: string
  freeTier: string
  getKeyUrl: string
  available: boolean
}

interface Props {
  /** Label shown on the button (default: "Tạo bằng AI") */
  label?: string
  disabled?: boolean
  loading?: boolean
  /** Called with the selected providerId when user clicks generate */
  onGenerate: (providerId: string) => void
  /** Pre-select a specific provider (overrides last-used) */
  defaultProvider?: string
  size?: "sm" | "md"
}

const STORAGE_KEY = "ai_generate_provider"

export default function AIGenerateButton({
  label = "Tạo bằng AI",
  disabled = false,
  loading = false,
  onGenerate,
  defaultProvider,
  size = "sm",
}: Props) {
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [selected, setSelected] = useState<string>(defaultProvider ?? "")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/admin/ai-providers")
      .then((r) => r.json())
      .then((d: { providers: ProviderOption[] }) => {
        const list = d.providers ?? []
        setProviders(list)
        // Pick: defaultProvider → last used in localStorage → first available
        const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
        const initial = defaultProvider
          ?? (stored && list.find((p) => p.id === stored && p.available) ? stored : null)
          ?? list.find((p) => p.available)?.id
          ?? list[0]?.id
          ?? ""
        setSelected(initial)
      })
      .catch(() => {})
  }, [defaultProvider])

  const current = providers.find((p) => p.id === selected)

  const handleSelect = (id: string) => {
    setSelected(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    setOpen(false)
  }

  const handleGenerate = () => {
    if (!selected || disabled || loading) return
    onGenerate(selected)
  }

  const btnBase = size === "sm"
    ? "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
    : "flex items-center gap-2 px-4 py-2 text-sm font-medium"

  const isReady = !!current?.available

  return (
    <div className="relative flex items-stretch">
      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={disabled || loading || !isReady}
        className={`${btnBase} rounded-l-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
        title={!isReady ? "Provider chưa có API key" : undefined}
      >
        {loading
          ? <><Loader2 className={size === "sm" ? "w-3.5 h-3.5 animate-spin" : "w-4 h-4 animate-spin"} />Đang viết...</>
          : <><Sparkles className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />{label}</>}
      </button>

      {/* Provider picker trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        className={`${size === "sm" ? "px-2" : "px-2.5"} rounded-r-md bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 border-l border-purple-500 transition-colors`}
        title="Chọn AI model"
      >
        <ChevronDown className={`${size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} ${open ? "rotate-180" : ""} transition-transform`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border bg-background shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chọn AI model</p>
            </div>
            <div className="py-1">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => p.available && handleSelect(p.id)}
                  disabled={!p.available}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    p.id === selected
                      ? "bg-purple-50 dark:bg-purple-950/30"
                      : p.available
                        ? "hover:bg-muted"
                        : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {p.id === selected && <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0" />}
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{p.freeTier}</p>
                    </div>
                    {p.available ? (
                      <span className="text-[10px] font-mono bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded shrink-0">
                        sẵn sàng
                      </span>
                    ) : (
                      <a
                        href={p.getKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded shrink-0 hover:underline"
                      >
                        lấy key →
                      </a>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
