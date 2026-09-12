import { prisma } from "@/lib/prisma"
import type { JobConfig, JobResult } from "../types"

const DB_KEYS = {
  accessToken: "zalo:access_token",
} as const

export async function zaloBroadcastHandler(config: JobConfig): Promise<JobResult> {
  const nicheId = config.niche as string | undefined

  const tokenRow = await prisma.appSetting.findUnique({ where: { key: DB_KEYS.accessToken } })
  const accessToken = tokenRow?.value ?? process.env.ZALO_OA_ACCESS_TOKEN

  if (!accessToken) {
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1,
      summary: "Zalo token chưa được cấu hình.",
      errors: [{ reason: "No Zalo access token found in DB or env" }],
    }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const categoryFilter = nicheId && nicheId !== "all" ? { category: { slug: nicheId } } : {}

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
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0,
      summary: "Không có sản phẩm nào thỏa điều kiện broadcast (discount >= 20%).",
    }
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
  const nicheLabel = (nicheId && nicheId !== "all") ? scored[0]?.category?.name : undefined
  const header = nicheLabel ? `🔥 TOP DEAL ${nicheLabel.toUpperCase()} HÔM NAY` : "🔥 TOP DEAL HÔM NAY"
  const lines = [header, ""]

  for (const [i, p] of scored.entries()) {
    const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
    const fmt = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
    lines.push(`${EMOJI[i]} ${p.name.slice(0, 60)}${p.name.length > 60 ? "..." : ""}`)
    if (p.discountPct) lines.push(`💰 ${fmt(salePrice)} (giảm ${p.discountPct}% — gốc ${fmt(p.price)})`)
    else lines.push(`💰 ${fmt(p.price)}`)
    lines.push(`👉 ${siteUrl}/api/affiliate/redirect/${p.id}?src=zalo`)
    lines.push("")
  }
  lines.push("─────────────────")
  lines.push(`📌 Xem thêm: ${siteUrl}`)
  lines.push(`🏷️ Mã giảm giá: ${siteUrl}/ma-giam-gia`)

  const messageText = lines.join("\n")
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
  } catch (err) {
    status = "failed"
    errorMsg = err instanceof Error ? err.message : String(err)
  }

  await prisma.broadcastLog.create({
    data: {
      channel: "zalo",
      nicheId: (nicheId && nicheId !== "all") ? nicheId : null,
      productIds: JSON.stringify(scored.map((p) => p.id)),
      messageText,
      status,
      error: errorMsg,
    },
  })

  if (status === "failed") {
    return {
      itemsTotal: scored.length, itemsSuccess: 0, itemsFailed: 1,
      niche: nicheId ?? "all",
      summary: `Broadcast Zalo thất bại: ${errorMsg}`,
      errors: [{ reason: errorMsg ?? "Unknown error" }],
    }
  }

  return {
    itemsTotal: scored.length, itemsSuccess: scored.length, itemsFailed: 0,
    niche: nicheId ?? "all",
    summary: `Gửi broadcast Zalo thành công với ${scored.length} sản phẩm.`,
    meta: { productIds: scored.map((p) => p.id) },
  }
}
