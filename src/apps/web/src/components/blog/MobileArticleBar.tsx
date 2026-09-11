"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, Share2, ShoppingBag } from "lucide-react"

interface Props {
  nicheId: string
  nicheName: string
  postTitle: string
  postUrl: string
}

export default function MobileArticleBar({ nicheId, nicheName, postTitle, postUrl }: Props) {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setCanShare(typeof navigator.share === "function")

    const onScroll = () => {
      const top = window.scrollY
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.round((top / max) * 100) : 0)
      setVisible(top > 120)
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const handleShare = async () => {
    try {
      await navigator.share({ title: postTitle, url: postUrl })
    } catch {
      /* user cancelled or not supported */
    }
  }

  return (
    <div
      className={`
        lg:hidden fixed bottom-0 left-0 right-0 z-50 h-14
        bg-[#1a1c1b] border-t-2 border-[#fdc73a]/20
        flex items-stretch
        transition-transform duration-300 ease-out
        ${visible ? "translate-y-0" : "translate-y-full"}
      `}
      role="navigation"
      aria-label="Điều hướng bài viết"
    >
      {/* ← Blog */}
      <Link
        href={`/${nicheId}/blog`}
        className="flex items-center justify-center gap-1.5 px-4 font-mono text-[11px] text-white/50 hover:text-white active:bg-white/10 transition-colors border-r border-white/10"
      >
        <ChevronLeft className="size-4 shrink-0" />
        <span className="hidden xs:inline">Blog</span>
      </Link>

      {/* Progress strip */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-1.5">
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#fdc73a] rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-white/30 tabular-nums leading-none">
          {progress}%
        </span>
      </div>

      {/* Share (native Web Share API — mobile only) */}
      {canShare && (
        <button
          onClick={handleShare}
          className="flex items-center justify-center px-4 text-white/50 hover:text-white active:bg-white/10 transition-colors border-l border-white/10"
          aria-label="Chia sẻ bài viết"
        >
          <Share2 className="size-4" />
        </button>
      )}

      {/* Deal CTA */}
      <Link
        href={`/${nicheId}`}
        className="flex items-center justify-center gap-1.5 px-5 bg-[#b51c00] text-white font-mono text-[12px] font-bold active:bg-[#b51c00]/80 transition-colors border-l border-white/10"
        aria-label={`Xem deal ${nicheName}`}
      >
        <ShoppingBag className="size-4 shrink-0" />
        <span>Deal</span>
      </Link>
    </div>
  )
}
