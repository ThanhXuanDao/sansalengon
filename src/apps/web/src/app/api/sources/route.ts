import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const sources = await prisma.syncSource.findMany({
    where: { enabled: true },
    select: { id: true, name: true, slug: true, icon: true },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json({ data: sources })
}
