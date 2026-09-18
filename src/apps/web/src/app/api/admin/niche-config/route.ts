import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"
import { adminLog } from "@/lib/logger"

// GET — trả về tất cả niches + integration config từ DB
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [nicheRows, integrations] = await Promise.all([
    prisma.niche.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.nicheIntegration.findMany(),
  ])

  const integrationMap = new Map(
    integrations.map((i) => [`${i.nicheId}:${i.platform}`, i]),
  )

  const defaultPlatformConfig = {
    enabled: false,
    atEnabled: true,
    directEnabled: true,
    directFallback: true,
    campaignId: "",
  }

  const toPlatformConfig = (row: typeof integrations[number] | null) =>
    row
      ? {
          enabled: row.enabled,
          atEnabled: row.atEnabled,
          directEnabled: row.directEnabled,
          directFallback: row.directFallback,
          campaignId: row.campaignId ?? "",
        }
      : { ...defaultPlatformConfig }

  const result = nicheRows.map((n) => ({
    id: n.id,
    name: n.name,
    status: n.status,
    platforms: {
      tiki:   toPlatformConfig(integrationMap.get(`${n.id}:tiki`) ?? null),
      lazada: toPlatformConfig(integrationMap.get(`${n.id}:lazada`) ?? null),
    },
  }))

  return NextResponse.json({ niches: result })
}

// PUT — upsert NicheIntegration cho một niche + platform
export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrfError = await csrfGuard(request)
  if (csrfError) return csrfError

  let body: {
    nicheId: string
    platform: string
    enabled: boolean
    atEnabled: boolean
    directEnabled: boolean
    directFallback: boolean
    campaignId?: string
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { nicheId, platform, enabled, atEnabled, directEnabled, directFallback, campaignId } = body

  if (!nicheId || !platform) {
    return NextResponse.json({ error: "nicheId và platform là bắt buộc" }, { status: 400 })
  }

  const ALLOWED_PLATFORMS = ["tiki", "lazada", "sendo"]
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "Platform không hợp lệ" }, { status: 400 })
  }

  const integration = await prisma.nicheIntegration.upsert({
    where: { nicheId_platform: { nicheId, platform } },
    update: {
      enabled: Boolean(enabled),
      atEnabled: Boolean(atEnabled),
      directEnabled: Boolean(directEnabled),
      directFallback: Boolean(directFallback),
      campaignId: campaignId?.trim() || null,
    },
    create: {
      nicheId,
      platform,
      enabled: Boolean(enabled),
      atEnabled: Boolean(atEnabled),
      directEnabled: Boolean(directEnabled),
      directFallback: Boolean(directFallback),
      campaignId: campaignId?.trim() || null,
    },
  })

  void adminLog.info(`Cập nhật cấu hình nguồn: ${nicheId}/${platform}`, "niche-config", {
    nicheId, platform, enabled,
  }, "user")

  return NextResponse.json({ ok: true, integration })
}
