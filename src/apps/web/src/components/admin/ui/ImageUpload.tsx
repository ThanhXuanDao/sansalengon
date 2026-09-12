"use client"

import { useRef, useState, useCallback } from "react"
import { X } from "lucide-react"

export interface ImageUploadProps {
  value?: string | null
  onChange: (value: string | null) => void
  accept?: string
  /** Human-readable type list shown inside the zone, e.g. "JPG, PNG, WEBP" */
  acceptLabel?: string
  /** Max file size in KB — defaults to 500 */
  maxSizeKB?: number
  onError?: (msg: string) => void
  className?: string
  /** Label shown above the zone */
  label?: string
  /** Hint shown below the label (outside the zone) */
  hint?: string
  disabled?: boolean
}

function formatBytes(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(0)} MB` : `${kb} KB`
}

function ImgPlaceholder() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
      <rect width="36" height="36" rx="8" fill="#e2e8f0" />
      <rect x="7" y="9" width="22" height="18" rx="3" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="13.5" cy="15.5" r="2" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M7 23l6-5 4 4 3-2.5 9 6.5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ImageUpload({
  value,
  onChange,
  accept = "image/*",
  acceptLabel,
  maxSizeKB = 500,
  onError,
  className = "",
  label,
  hint,
  disabled = false,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        onError?.("Chỉ hỗ trợ file ảnh.")
        return
      }
      if (file.size > maxSizeKB * 1024) {
        onError?.(`File quá lớn. Tối đa ${formatBytes(maxSizeKB)}.`)
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => onChange(reader.result as string)
      reader.readAsDataURL(file)
    },
    [maxSizeKB, onChange, onError],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const sizeHint = `Tối đa ${formatBytes(maxSizeKB)}/ảnh`
  const typeHint =
    acceptLabel ??
    (accept === "image/*"
      ? "JPG, PNG, WEBP"
      : accept.replace(/image\//g, "").toUpperCase().replace(/,/g, ", "))

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <p className="font-sans text-[13px] font-semibold text-[#111827]">{label}</p>
      )}
      {hint && (
        <p className="font-sans text-[12px] text-[#6b7280]">{hint}</p>
      )}

      {value ? (
        /* ── Preview ── */
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          className={`
            mt-1 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f1f5f9]
            p-4 flex items-center gap-4 cursor-pointer
            hover:border-[#3b82f6] hover:bg-[#eff6ff] transition-colors
            ${disabled ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <img
            src={value}
            alt="Preview"
            className="h-16 w-16 rounded-lg object-contain flex-shrink-0 border border-[#e2e8f0] bg-white p-1"
          />
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[13px] font-medium text-[#111827]">Đã chọn ảnh</p>
            <p className="font-sans text-[12px] text-[#3b82f6] mt-0.5">Nhấn để thay ảnh khác</p>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            aria-label="Xóa ảnh"
            className="size-8 flex-shrink-0 flex items-center justify-center rounded-lg text-[#94a3b8] hover:text-[#ef4444] hover:bg-[#fee2e2] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        /* ── Empty dropzone ── */
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload ảnh — kéo thả hoặc nhấn để chọn file"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && !disabled && inputRef.current?.click()
          }
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={[
            "mt-1 rounded-xl border border-dashed",
            "flex items-center gap-5 px-6 py-5 cursor-pointer select-none outline-none",
            "transition-colors",
            "focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-1",
            dragging
              ? "border-[#3b82f6] bg-[#eff6ff]"
              : "border-[#cbd5e1] bg-[#f1f5f9] hover:border-[#3b82f6] hover:bg-[#eff6ff]",
            disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
          ].join(" ")}
        >
          <ImgPlaceholder />

          <div className="flex flex-col gap-0.5">
            <p className="font-sans text-[13px] text-[#374151] leading-snug">
              Kéo thả ảnh vào đây hoặc{" "}
              <span className="text-[#3b82f6] underline underline-offset-2">chọn file</span>
            </p>
            <p className="font-sans text-[12px] text-[#9ca3af]">
              {typeHint}&nbsp;&nbsp;·&nbsp;&nbsp;{sizeHint}
            </p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  )
}
