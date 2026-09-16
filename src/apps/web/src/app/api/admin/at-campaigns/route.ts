import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const campaigns = await prisma.atCampaign.findMany({
    include: { nicheMatches: true },
    orderBy: { lastSeenAt: "desc" },
  })

  return NextResponse.json({ campaigns, total: campaigns.length })
}
