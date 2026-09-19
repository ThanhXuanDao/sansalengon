import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Public endpoint — no auth — trả về niches đang active cho Footer, nav, sitemap client-side
export async function GET() {
  const niches = await prisma.category.findMany({
    where: { status: "active" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, emoji: true },
  })
  return NextResponse.json({ data: niches })
}
