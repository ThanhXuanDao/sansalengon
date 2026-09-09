import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const history = await prisma.priceHistory.findMany({
    where: {
      productId: id,
      recordedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 ngày gần nhất
      },
    },
    orderBy: { recordedAt: "asc" },
    select: { price: true, recordedAt: true },
  })

  if (!history.length) {
    return NextResponse.json({ data: [] })
  }

  const prices = history.map((h) => h.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const currentPrice = prices[prices.length - 1]
  const isLowest = currentPrice === minPrice

  return NextResponse.json({
    data: history,
    meta: { minPrice, maxPrice, currentPrice, isLowest, days: 30 },
  })
}
