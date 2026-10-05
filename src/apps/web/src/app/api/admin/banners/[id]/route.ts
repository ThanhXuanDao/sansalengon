import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { buildBannerAffiliateUrl } from "@/lib/banner-affiliate"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    const body = await request.json()
    const { title, imageUrl, destinationUrl, affiliateUrl, linkMode, atCampaignId, position, isActive, startDate, endDate } = body

    // Khi linkMode hoặc destinationUrl thay đổi, rebuild affiliate URL nếu cần
    let resolvedAffiliateUrl: string | null | undefined = undefined
    const effectiveMode = linkMode ?? undefined
    const effectiveDest = destinationUrl ?? undefined
    if (effectiveMode === "platform" || (effectiveMode === undefined && effectiveDest !== undefined)) {
      // Cần biết linkMode hiện tại nếu không được gửi
      const existing = effectiveMode === undefined ? await prisma.banner.findUnique({ where: { id }, select: { linkMode: true } }) : null
      const mode = effectiveMode ?? existing?.linkMode
      if (mode === "platform" && effectiveDest) {
        resolvedAffiliateUrl = buildBannerAffiliateUrl(effectiveDest)
      }
    } else if (effectiveMode === "direct") {
      resolvedAffiliateUrl = affiliateUrl || null
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(destinationUrl !== undefined && { destinationUrl }),
        ...(resolvedAffiliateUrl !== undefined ? { affiliateUrl: resolvedAffiliateUrl } : affiliateUrl !== undefined ? { affiliateUrl: affiliateUrl || null } : {}),
        ...(linkMode !== undefined && { linkMode }),
        ...(atCampaignId !== undefined && { atCampaignId: atCampaignId || null }),
        ...(position !== undefined && { position }),
        ...(isActive !== undefined && { isActive }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      },
    })

    return NextResponse.json({ data: banner })
  } catch (err) {
    console.error("[admin/banners PUT]", err)
    return NextResponse.json({ error: "Lỗi cập nhật banner" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  try {
    await prisma.banner.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[admin/banners DELETE]", err)
    return NextResponse.json({ error: "Lỗi xóa banner" }, { status: 500 })
  }
}
