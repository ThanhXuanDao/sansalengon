import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
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

export async function PATCH(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const { id, campaignType, ctaTitle, ctaDescription, ctaImageUrl, ctaLabel } = body

    if (!id) return NextResponse.json({ error: "id là bắt buộc" }, { status: 400 })

    const updated = await prisma.atCampaign.update({
      where: { id },
      data: {
        ...(campaignType !== undefined && { campaignType }),
        ...(ctaTitle !== undefined && { ctaTitle: ctaTitle || null }),
        ...(ctaDescription !== undefined && { ctaDescription: ctaDescription || null }),
        ...(ctaImageUrl !== undefined && { ctaImageUrl: ctaImageUrl || null }),
        ...(ctaLabel !== undefined && { ctaLabel: ctaLabel || null }),
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
