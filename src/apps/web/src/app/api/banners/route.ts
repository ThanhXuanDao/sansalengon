import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const now = new Date()

  const banners = await prisma.banner.findMany({
    where: {
      isActive: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { endDate: null },
            { endDate: { gte: now } },
          ],
        },
      ],
    },
    orderBy: { position: "asc" },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      affiliateUrl: true,
      destinationUrl: true,
    },
  })

  return NextResponse.json({ data: banners })
}
