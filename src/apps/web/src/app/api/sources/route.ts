import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { syncSourceHasCoupons, syncSourceHasProducts } from "@/lib/sync-source-utils"

export async function GET(request: NextRequest) {
  const type = new URL(request.url).searchParams.get("type") // "coupon" | "product" | null

  const all = await prisma.syncSource.findMany({
    select: { id: true, name: true, slug: true, icon: true, config: true },
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  })

  const filtered = type === "coupon"
    ? all.filter((s) => syncSourceHasCoupons(s.config))
    : type === "product"
    ? all.filter((s) => syncSourceHasProducts(s.config))
    : all

  const data = filtered.map(({ config: _, ...rest }) => rest)

  return NextResponse.json({ data })
}
