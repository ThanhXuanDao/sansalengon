import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      emoji: true,
      status: true,
      description: true,
      sortOrder: true,
    },
    where: { status: { not: "draft" } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return NextResponse.json({ data: categories }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  })
}
