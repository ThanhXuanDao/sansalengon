import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"

const AT_TTL_MS = 4 * 60 * 60 * 1000 // 4h

async function syncFromAt(): Promise<void> {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000"
  const secret = process.env.API_INTERNAL_SECRET ?? ""
  await fetch(`${apiUrl}/sync/campaigns`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(30_000),
  })
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Tự động sync từ AT nếu dữ liệu cũ hơn 4h hoặc chưa có
  const latest = await prisma.atCampaign.findFirst({ orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } })
  const isStale = !latest || Date.now() - latest.lastSeenAt.getTime() > AT_TTL_MS
  if (isStale) {
    await syncFromAt().catch(() => { /* nếu sync lỗi, vẫn trả data cũ */ })
  }

  const campaigns = await prisma.atCampaign.findMany({
    include: { nicheMatches: true, banners: { orderBy: [{ width: "desc" }, { height: "desc" }] } },
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
