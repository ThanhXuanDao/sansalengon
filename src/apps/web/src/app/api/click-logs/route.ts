import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25))
  const productId = searchParams.get("productId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const sortOrder = searchParams.get("sort") === "asc" ? "asc" : "desc"

  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (productId) where.productId = productId
  if (dateFrom || dateTo) {
    const clickedAt: Record<string, Date> = {}
    if (dateFrom) clickedAt.gte = new Date(dateFrom)
    if (dateTo) clickedAt.lte = new Date(dateTo + "T23:59:59.999Z")
    where.clickedAt = clickedAt
  }

  const [logs, total] = await Promise.all([
    prisma.clickLog.findMany({
      where,
      include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
      orderBy: { clickedAt: sortOrder },
      skip,
      take: limit,
    }),
    prisma.clickLog.count({ where }),
  ])

  return NextResponse.json({
    data: logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
