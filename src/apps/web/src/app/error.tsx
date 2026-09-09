"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF7] p-4" role="alert">
      <div className="bg-white border border-[#e5e1d8] p-8 max-w-md w-full text-center" style={{ clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)" }}>
        <AlertTriangle className="size-12 mx-auto text-[#b51c00] mb-4" aria-hidden="true" />
        <h2 className="font-sans text-[24px] font-black text-[#1a1c1b] uppercase mb-2">This page couldn&apos;t load</h2>
        <p className="font-sans text-[14px] text-[#5c403a] mb-6">
          {error.message || "An unexpected error occurred. Reload to try again."}
        </p>
        <button
          onClick={reset}
          className="bg-[#b51c00] text-white font-mono text-[13px] tracking-[0.05em] py-3 px-8 rounded-full hover:shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-[#b51c00] focus-visible:outline-none active:translate-x-0.5 active:translate-y-0.5"
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
