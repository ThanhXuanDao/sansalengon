import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) return NextResponse.json({ error: "id là bắt buộc" }, { status: 400 })

  const banners = await prisma.atCampaignBanner.findMany({
    where: { campaignId: id },
    orderBy: [{ width: "desc" }, { height: "desc" }],
  })

  // Nếu DB chưa có banner (chưa sync lần nào), fallback sang AT API
  if (banners.length === 0) {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000"
    const secret = process.env.API_INTERNAL_SECRET ?? ""
    try {
      const res = await fetch(`${apiUrl}/sync/campaigns/${encodeURIComponent(id)}/banners`, {
        headers: secret ? { authorization: `Bearer ${secret}` } : {},
        signal: AbortSignal.timeout(15_000),
      })
      if (res.ok) {
        const data = await res.json()
        return NextResponse.json({ banners: data.banners ?? [], total: data.total ?? 0, source: "live" })
      }
    } catch {
      // fallback failed — return empty
    }
    return NextResponse.json({ banners: [], total: 0, source: "empty" })
  }

  return NextResponse.json({ banners, total: banners.length, source: "db" })
}
