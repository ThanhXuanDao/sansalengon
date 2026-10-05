import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { buildBannerAffiliateUrl } from "@/lib/banner-affiliate"

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const banners = await prisma.banner.findMany({
    orderBy: { position: "asc" },
  })

  return NextResponse.json({ data: banners })
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const { title, imageUrl, destinationUrl, affiliateUrl, linkMode, atCampaignId, position, isActive, startDate, endDate } = body

    if (!title || !imageUrl || !destinationUrl) {
      return NextResponse.json({ error: "title, imageUrl, destinationUrl là bắt buộc" }, { status: 400 })
    }

    const resolvedMode = linkMode || "platform"
    const resolvedAffiliateUrl =
      resolvedMode === "platform"
        ? buildBannerAffiliateUrl(destinationUrl)
        : resolvedMode === "direct"
        ? affiliateUrl || null
        : affiliateUrl || null // "at" — URL được set khi user click (server-side redirect)

    const banner = await prisma.banner.create({
      data: {
        title,
        imageUrl,
        destinationUrl,
        affiliateUrl: resolvedAffiliateUrl,
        linkMode: resolvedMode,
        atCampaignId: atCampaignId || null,
        position: position ?? 0,
        isActive: isActive ?? true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    })

    return NextResponse.json({ data: banner }, { status: 201 })
  } catch (err) {
    console.error("[admin/banners POST]", err)
    return NextResponse.json({ error: "Lỗi tạo banner" }, { status: 500 })
  }
}
