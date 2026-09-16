import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCsrfToken(): string {
  if (typeof document === "undefined") return ""
  const match = document.cookie.match(/(?:^|;\s*)sansale_csrf=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : ""
}

export async function ensureCsrfToken(): Promise<string> {
  const existing = getCsrfToken()
  if (existing) return existing
  try {
    const res = await fetch("/api/admin/csrf")
    if (res.ok) {
      const data = await res.json()
      return data.token || getCsrfToken()
    }
  } catch {
    // Ignore fetch error
  }
  return ""
}

interface PriceFormatOpts {
  currencySymbol?: string
  currencyPosition?: string
  thousandSeparator?: string
}

export function formatPrice(price: number, opts?: PriceFormatOpts): string {
  // Prices are stored as cents (VND × 100) — divide before display
  const amount = Math.round(price / 100)
  const symbol = opts?.currencySymbol ?? "₫"
  const position = opts?.currencyPosition ?? "after"
  // vi-VN uses "." as thousands separator; swap if settings differ
  let formatted = amount.toLocaleString("vi-VN")
  const sep = opts?.thousandSeparator
  if (sep && sep !== ".") formatted = formatted.replace(/\./g, sep)
  return position === "before" ? `${symbol}${formatted}` : `${formatted}${symbol}`
}

export const NUMBER_RANGE_CHUNK_SIZE = 100

export function buildNumberRanges(total: number): { label: string; from: number; to: number }[] {
  const ranges: { label: string; from: number; to: number }[] = []
  for (let from = 1; from <= total; from += NUMBER_RANGE_CHUNK_SIZE) {
    const to = Math.min(from + NUMBER_RANGE_CHUNK_SIZE - 1, total)
    ranges.push({ label: `#${from}-${to}`, from, to })
  }
  return ranges
}
