/**
 * Statistical price drop prediction.
 * Groups PriceHistory by day-of-week, finds days consistently cheaper than average.
 * No AI needed — purely statistical.
 */

import { prisma } from "./prisma"

export const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
export const DAY_SHORT  = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

export interface DayPattern {
  dayOfWeek: number
  dayName: string
  avgPrice: number
  samples: number
  pctVsAvg: number // negative = cheaper than average
}

export interface PricePrediction {
  productId: string
  productName: string
  niche: string
  currentPrice: number
  overallAvg: number
  cheapestDay: number
  cheapestDayName: string
  cheapestDayAvg: number
  savingPct: number       // how much cheaper than average on cheapest day
  confidence: "high" | "medium" | "low"
  dataPoints: number
  weeksOfData: number
  pattern: DayPattern[]  // one entry per day that has data
}

/** Minimum thresholds */
const MIN_DATA_POINTS   = 14  // at least 2 weeks
const MIN_CHEAPEST_SAMPLES = 3
const MIN_SAVING_PCT    = 4   // at least 4% cheaper to be meaningful

export async function analyzePricePrediction(
  productId: string,
): Promise<PricePrediction | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, name: true, price: true, category: { select: { slug: true } } },
  })
  if (!product) return null

  // Fetch up to 180 days of main-platform price history
  const history = await prisma.priceHistory.findMany({
    where: { productId, platformId: null },
    orderBy: { recordedAt: "desc" },
    take: 180,
    select: { price: true, recordedAt: true },
  })

  if (history.length < MIN_DATA_POINTS) return null

  // Group prices by day of week
  const byDay: Record<number, number[]> = {}
  for (const h of history) {
    const day = h.recordedAt.getDay()
    byDay[day] = byDay[day] ?? []
    byDay[day].push(h.price)
  }

  const overallAvg = Math.round(history.reduce((s, h) => s + h.price, 0) / history.length)

  const pattern: DayPattern[] = Object.entries(byDay)
    .map(([d, prices]) => {
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
      return {
        dayOfWeek: parseInt(d),
        dayName: DAY_NAMES[parseInt(d)],
        avgPrice: avg,
        samples: prices.length,
        pctVsAvg: Math.round(((avg - overallAvg) / overallAvg) * 100),
      }
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

  const cheapest = pattern.reduce((a, b) => a.avgPrice < b.avgPrice ? a : b)

  if (cheapest.samples < MIN_CHEAPEST_SAMPLES) return null

  const savingPct = Math.round(((overallAvg - cheapest.avgPrice) / overallAvg) * 100)
  if (savingPct < MIN_SAVING_PCT) return null

  const weeksOfData = Math.round(history.length / 7)

  const confidence: PricePrediction["confidence"] =
    cheapest.samples >= 8 && savingPct >= 10 ? "high" :
    cheapest.samples >= 4 && savingPct >= 6  ? "medium" : "low"

  return {
    productId: product.id,
    productName: product.name,
    niche: product.category.slug,
    currentPrice: product.price,
    overallAvg,
    cheapestDay: cheapest.dayOfWeek,
    cheapestDayName: cheapest.dayName,
    cheapestDayAvg: cheapest.avgPrice,
    savingPct,
    confidence,
    dataPoints: history.length,
    weeksOfData,
    pattern,
  }
}

/** Scan all non-soldout products and return those with strong patterns */
export async function getTopPredictions(limit = 30): Promise<PricePrediction[]> {
  const products = await prisma.product.findMany({
    where: { isSoldOut: false },
    select: { id: true },
  })

  const results = await Promise.all(
    products.map((p) => analyzePricePrediction(p.id).catch(() => null))
  )

  return results
    .filter((p): p is PricePrediction => p !== null)
    .sort((a, b) => {
      // Sort by confidence first, then savingPct
      const cScore = { high: 3, medium: 2, low: 1 }
      if (cScore[b.confidence] !== cScore[a.confidence])
        return cScore[b.confidence] - cScore[a.confidence]
      return b.savingPct - a.savingPct
    })
    .slice(0, limit)
}

export function formatPredictionMessage(p: PricePrediction): string {
  return `💡 Tip mua sắm: "${p.productName.slice(0, 60)}" thường rẻ hơn ${p.savingPct}% vào ${p.cheapestDayName}. Giá trung bình ngày đó: ${fmtVND(p.cheapestDayAvg)} (so với ${fmtVND(p.overallAvg)} bình thường).`
}

function fmtVND(n: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
}
