import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"

const ZALO_OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token"
const DB_KEYS = {
  accessToken:  "zalo:access_token",
  refreshToken: "zalo:refresh_token",
  expiresAt:    "zalo:token_expires_at",
} as const

// GET /api/broadcast — lịch sử broadcast (admin)
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const take = Math.min(50, Number(searchParams.get("take") ?? "20"))
  const channel = searchParams.get("channel") ?? undefined

  const logs = await prisma.broadcastLog.findMany({
    where: channel ? { channel } : undefined,
    orderBy: { sentAt: "desc" },
    take,
    select: {
      id: true,
      channel: true,
      nicheId: true,
      status: true,
      error: true,
      sentAt: true,
      productIds: true,
      messageText: true,
    },
  })

  return NextResponse.json({
    data: logs.map((l) => ({
      ...l,
      productIds: JSON.parse(l.productIds) as string[],
    })),
    total: logs.length,
  })
}

// POST /api/broadcast — trigger thủ công (admin only)
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { nicheId } = await request.json().catch(() => ({})) as { nicheId?: string }

  // Ưu tiên token từ DB (có thể đã được auto-refresh), fallback về env
  const tokenRow = await prisma.appSetting.findUnique({ where: { key: DB_KEYS.accessToken } })
  const accessToken = tokenRow?.value ?? process.env.ZALO_OA_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: "Zalo token not configured" }, { status: 503 })
  }

  // Lấy top 5 sản phẩm cho niche (hoặc tất cả)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const categoryFilter = nicheId ? { category: { slug: nicheId } } : {}

  const [products, clickCounts] = await Promise.all([
    prisma.product.findMany({
      where: { isSoldOut: false, discountPct: { gte: 20 }, ...categoryFilter },
      include: { category: true },
      orderBy: { discountPct: "desc" },
      take: 20,
    }),
    prisma.clickLog.groupBy({
      by: ["productId"],
      where: { clickedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
  ])

  if (products.length === 0) {
    return NextResponse.json({ error: "No products found for broadcast" }, { status: 404 })
  }

  const clickMap = new Map(clickCounts.map((c) => [c.productId, c._count.id]))
  const maxClicks = Math.max(1, ...Array.from(clickMap.values()))
  const scored = products
    .map((p) => ({
      ...p,
      _score: (p.discountPct ?? 0) * 0.6 + ((clickMap.get(p.id) ?? 0) / maxClicks) * 100 * 0.4,
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")
  const EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]

  const nicheLabel = nicheId ? scored[0]?.category?.name : undefined
  const header = nicheLabel ? `🔥 TOP DEAL ${nicheLabel.toUpperCase()} HÔM NAY` : "🔥 TOP DEAL HÔM NAY"
  const lines = [header, ""]

  for (const [i, p] of scored.entries()) {
    const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
    const fmt = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
    lines.push(`${EMOJI[i]} ${p.name.slice(0, 60)}${p.name.length > 60 ? "..." : ""}`)
    if (p.discountPct) {
      lines.push(`💰 ${fmt(salePrice)} (giảm ${p.discountPct}% — gốc ${fmt(p.price)})`)
    } else {
      lines.push(`💰 ${fmt(p.price)}`)
    }
    lines.push(`👉 ${siteUrl}/api/affiliate/redirect/${p.id}?src=zalo`)
    lines.push("")
  }
  lines.push("─────────────────")
  lines.push(`📌 Xem thêm: ${siteUrl}`)
  lines.push(`🏷️ Mã giảm giá: ${siteUrl}/ma-giam-gia`)

  const messageText = lines.join("\n")

  // Gửi Zalo OA broadcast
  let status: "sent" | "failed" = "sent"
  let errorMsg: string | undefined

  try {
    const res = await fetch("https://openapi.zalo.me/v2.0/oa/message/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: accessToken },
      body: JSON.stringify({
        recipient: { message_tag: "ACCOUNT_UPDATE" },
        message: { text: messageText },
      }),
    })
    const body = await res.json() as { error?: number; message?: string }
    if (body.error !== 0) {
      throw new Error(`Zalo API error ${body.error}: ${body.message}`)
    }
  } catch (e: any) {
    status = "failed"
    errorMsg = e.message
  }

  const log = await prisma.broadcastLog.create({
    data: {
      channel: "zalo",
      nicheId: nicheId ?? null,
      productIds: JSON.stringify(scored.map((p) => p.id)),
      messageText,
      status,
      error: errorMsg ?? null,
    },
  })

  if (status === "failed") {
    return NextResponse.json({ error: errorMsg, logId: log.id }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    logId: log.id,
    products: scored.length,
    preview: messageText,
  })
}
