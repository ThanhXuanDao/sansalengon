"use client"

import { useState, useEffect } from "react"
import { Copy, Check, ExternalLink, Clock, Tag, ShoppingCart, Eye, Flame, Users } from "lucide-react"

export interface Coupon {
  id: string
  source: string
  platform: string | null
  nicheId: string | null
  merchant: string
  merchantLogo?: string | null
  code: string | null
  description: string
  discountValue: number
  discountType: "percent" | "fixed"
  minOrderValue: number | null
  maxDiscount: number | null
  affiliateUrl: string
  expiresAt: string | null
  clickCount: number
}

const PLATFORM_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  shopee:     { label: "Shopee",  bg: "bg-orange-100", text: "text-orange-700" },
  tiki:       { label: "Tiki",    bg: "bg-blue-100",   text: "text-blue-700" },
  lazada:     { label: "Lazada",  bg: "bg-purple-100", text: "text-purple-700" },
  accesstrade:{ label: "AT",      bg: "bg-gray-100",   text: "text-gray-600" },
}

function formatDiscount(value: number, type: "percent" | "fixed"): string {
  if (type === "percent") return `-${value}%`
  return `-${new Intl.NumberFormat("vi-VN").format(value)}đ`
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ"
}

function useCountdown(iso: string | null) {
  const [left, setLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!iso) return
    const target = new Date(iso).getTime()

    function update() {
      const diff = target - Date.now()
      if (diff <= 0) { setLeft("Đã hết hạn"); return }
      if (diff > 24 * 3600 * 1000) { setLeft(null); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLeft(`${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [iso])

  return left
}

export default function CouponCard({ coupon }: { coupon: Coupon }) {
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const countdown = useCountdown(coupon.expiresAt)

  const days = coupon.expiresAt
    ? Math.ceil((new Date(coupon.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const isExpiringSoon = days !== null && days <= 3
  const isFlashSale = countdown !== null

  const isLarge = coupon.discountType === "percent"
    ? coupon.discountValue >= 30
    : coupon.discountValue >= 100_000

  const platformKey = coupon.platform ?? coupon.source
  const badge = PLATFORM_BADGE[platformKey]

  const handleRevealAndUse = async () => {
    // Track click
    fetch(`/api/coupons/${coupon.id}/click`, { method: "POST" }).catch(() => {})
    setRevealed(true)
    window.open(coupon.affiliateUrl, "_blank", "noopener,noreferrer")
  }

  const handleCopy = async () => {
    if (!coupon.code) return
    try {
      await navigator.clipboard.writeText(coupon.code)
    } catch {
      const el = document.createElement("textarea")
      el.value = coupon.code
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`receipt-card flex overflow-hidden hover-lift relative ${isFlashSale ? "ring-1 ring-amber-400" : ""}`}>
      {/* Flash sale indicator */}
      {isFlashSale && (
        <div className="absolute top-0 right-0 flex items-center gap-0.5 bg-amber-400 text-amber-900 px-2 py-0.5 text-[9px] font-mono font-bold uppercase">
          <Flame className="size-2.5" />
          {countdown}
        </div>
      )}

      {/* Cột trái — discount badge */}
      <div
        className={`flex-shrink-0 w-24 flex flex-col items-center justify-center p-3 ${
          isLarge ? "bg-primary text-white" : "bg-[#e8e8e5] text-ink"
        }`}
      >
        <span className="font-mono text-sm font-bold uppercase leading-none text-center">
          {coupon.discountType === "percent"
            ? `${coupon.discountValue}%`
            : `${new Intl.NumberFormat("vi-VN").format(coupon.discountValue)}đ`}
        </span>
        <span className="font-mono text-[9px] mt-0.5 opacity-70">GIẢM</span>

        {/* Platform badge */}
        {badge && (
          <span className={`mt-1.5 px-1.5 py-0.5 text-[8px] font-mono font-bold rounded ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Đường nét đứt phân cách */}
      <div className="relative flex-shrink-0 w-px bg-border-color">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-bg border border-border-color" />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-bg border border-border-color" />
        <div className="h-full border-l border-dashed border-border-color" />
      </div>

      {/* Cột phải — nội dung */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-w-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-ink truncate">{coupon.merchant}</p>
            <p className="font-mono text-[10px] text-ink/50 leading-tight mt-0.5 line-clamp-2">
              {coupon.description}
            </p>
          </div>
          {isExpiringSoon && !isFlashSale && (
            <span className="flex-shrink-0 font-mono text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 whitespace-nowrap">
              {days === 0 ? "Hôm nay hết" : `Còn ${days} ngày`}
            </span>
          )}
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {coupon.minOrderValue && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink/50">
              <ShoppingCart className="size-2.5" />
              Đơn tối thiểu {formatMoney(coupon.minOrderValue)}
            </span>
          )}
          {coupon.maxDiscount && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink/50">
              <Tag className="size-2.5" />
              Tối đa {formatMoney(coupon.maxDiscount)}
            </span>
          )}
          {coupon.expiresAt && !isExpiringSoon && !isFlashSale && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink/50">
              <Clock className="size-2.5" />
              HSD: {new Date(coupon.expiresAt).toLocaleDateString("vi-VN")}
            </span>
          )}
          {coupon.clickCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-ink/40">
              <Users className="size-2.5" />
              {coupon.clickCount} lượt dùng
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 mt-auto pt-1">
          {coupon.code ? (
            <>
              {/* Code box — masked until revealed */}
              <div className="flex-1 flex items-center gap-1.5 border border-dashed border-primary/40 bg-primary/5 px-2 py-1 min-w-0 relative overflow-hidden">
                {revealed ? (
                  <span className="font-mono text-xs font-bold text-primary tracking-widest truncate">
                    {coupon.code}
                  </span>
                ) : (
                  <span className="font-mono text-xs font-bold text-primary/50 tracking-widest truncate select-none">
                    {"•".repeat(Math.min(coupon.code.length, 10))}
                  </span>
                )}
              </div>

              {/* Copy button */}
              {revealed && (
                <button
                  onClick={handleCopy}
                  aria-label={copied ? "Đã copy" : `Copy mã ${coupon.code}`}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1 brutalist-border font-mono text-xs font-bold uppercase transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                    copied
                      ? "bg-green-50 text-green-700 border-green-300"
                      : "bg-[#e8e8e5] text-ink hover:bg-primary hover:text-white"
                  }`}
                >
                  {copied ? <><Check className="size-3" /> Đã copy</> : <><Copy className="size-3" /> Copy</>}
                </button>
              )}

              {/* Lấy mã / Dùng */}
              <button
                onClick={handleRevealAndUse}
                aria-label="Lấy mã giảm giá"
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1 brutalist-border bg-primary text-white font-mono text-xs font-bold uppercase hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:ring-primary"
              >
                {revealed ? (
                  <>Dùng <ExternalLink className="size-3" /></>
                ) : (
                  <>Lấy mã <Eye className="size-3" /></>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleRevealAndUse}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 brutalist-border bg-primary text-white font-mono text-xs font-bold uppercase hover:bg-ink transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            >
              Nhận ưu đãi <ExternalLink className="size-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
