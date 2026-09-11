"use client"

import { useState } from "react"
import { Link2, Check } from "lucide-react"

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 border border-[#1a1c1b]/20 hover:border-[#1a1c1b] hover:bg-[#1a1c1b] hover:text-white transition-colors"
    >
      {copied ? (
        <>
          <Check className="size-3 text-green-600" />
          <span className="text-green-600">Đã sao chép!</span>
        </>
      ) : (
        <>
          <Link2 className="size-3" />
          Sao chép link
        </>
      )}
    </button>
  )
}
