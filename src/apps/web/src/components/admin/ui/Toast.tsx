"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react"

export type ToastTone = "success" | "error" | "warning" | "info"

interface ToastItem {
  id: string
  tone: ToastTone
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<ToastItem, "id">) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const config: Record<ToastTone, { cls: string; bar: string; Icon: typeof XCircle }> = {
  success: { cls: "border-[#155724]/20 bg-white",    bar: "bg-[#2e7d32]", Icon: CheckCircle2 },
  error:   { cls: "border-[#ba1a1a]/20 bg-white",    bar: "bg-[#ba1a1a]", Icon: XCircle },
  warning: { cls: "border-[#856404]/20 bg-white",    bar: "bg-[#e6a817]", Icon: AlertTriangle },
  info:    { cls: "border-[#004085]/20 bg-white",    bar: "bg-[#1565c0]", Icon: Info },
}

const iconColor: Record<ToastTone, string> = {
  success: "text-[#2e7d32]",
  error:   "text-[#ba1a1a]",
  warning: "text-[#e6a817]",
  info:    "text-[#1565c0]",
}

function ToastCard({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const { cls, bar, Icon } = config[item.tone]
  const duration = item.duration ?? 4000
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), duration)
    if (progressRef.current) {
      progressRef.current.style.transition = `width ${duration}ms linear`
      requestAnimationFrame(() => {
        if (progressRef.current) progressRef.current.style.width = "0%"
      })
    }
    return () => clearTimeout(timer)
  // item.id and onRemove are both stable — timer won't reset when new toasts arrive
  }, [duration, item.id, onRemove])

  return (
    <div className={`relative w-80 border shadow-lg overflow-hidden ${cls} animate-in slide-in-from-right-5 fade-in duration-200`}>
      {/* Progress bar */}
      <div ref={progressRef} className={`absolute bottom-0 left-0 h-0.5 w-full ${bar}`} />

      <div className="flex gap-3 p-4 pr-10">
        <Icon className={`size-5 shrink-0 mt-0.5 ${iconColor[item.tone]}`} />
        <div className="flex-1 min-w-0">
          {item.title && (
            <p className="font-sans text-[13px] font-bold text-[#1a1c1b] mb-0.5">{item.title}</p>
          )}
          <p className="font-mono text-[12px] text-[#5c403a] leading-relaxed">{item.message}</p>
        </div>
      </div>

      <button
        onClick={() => onRemove(item.id)}
        tabIndex={-1}
        className="absolute right-2 top-2 p-1 rounded hover:bg-[#f4f4f1] transition-colors text-[#5c403a]"
        aria-label="Đóng"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }])
  }, [])

  const success = useCallback((message: string, title?: string) => toast({ tone: "success", message, title }), [toast])
  const error   = useCallback((message: string, title?: string) => toast({ tone: "error",   message, title }), [toast])
  const warning = useCallback((message: string, title?: string) => toast({ tone: "warning", message, title }), [toast])
  const info    = useCallback((message: string, title?: string) => toast({ tone: "info",    message, title }), [toast])

  const container = (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard item={t} onRemove={remove} />
        </div>
      ))}
    </div>
  )

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Portal vào document.body — tránh bị ảnh hưởng bởi overflow/scroll của layout */}
      {mounted && createPortal(container, document.body)}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be inside ToastProvider")
  return ctx
}
