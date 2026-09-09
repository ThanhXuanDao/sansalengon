import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("productId")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  const where: Record<string, unknown> = {}
  if (productId) where.productId = productId
  if (dateFrom || dateTo) {
    const clickedAt: Record<string, Date> = {}
    if (dateFrom) clickedAt.gte = new Date(dateFrom)
    if (dateTo) clickedAt.lte = new Date(dateTo + "T23:59:59.999Z")
    where.clickedAt = clickedAt
  }

  const logs = await prisma.clickLog.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, price: true, commission: true, category: { select: { name: true } } },
      },
    },
    orderBy: { clickedAt: "desc" },
  })

  const escapeCSV = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }

  const headers = ["Product Name", "Category", "Price", "Commission", "Clicked At", "Product ID"]
  const rows = logs.map((log) => [
    escapeCSV(log.product?.name || "Deleted product"),
    escapeCSV(log.product?.category?.name || ""),
    log.product?.price || 0,
    log.product?.commission || 0,
    new Date(log.clickedAt).toISOString(),
    log.productId,
  ])

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="click-logs-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  })
}
