import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"

const ZALO_OAUTH_URL = "https://oauth.zaloapp.com/v4/oa/access_token"
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DB_KEYS = {
  accessToken:  "zalo:access_token",
  refreshToken: "zalo:refresh_token",
  expiresAt:    "zalo:token_expires_at",
} as const

// GET /api/broadcast/token — trạng thái token hiện tại (admin)
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [atRow, expRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: DB_KEYS.accessToken } }),
    prisma.appSetting.findUnique({ where: { key: DB_KEYS.expiresAt } }),
  ])

  if (!atRow?.value) {
    return NextResponse.json({
      hasToken:     false,
      source:       process.env.ZALO_OA_ACCESS_TOKEN ? "env_only" : "none",
      message:      "No token in DB. Set ZALO_OA_ACCESS_TOKEN + ZALO_OA_REFRESH_TOKEN and restart API server to seed.",
    })
  }

  const expiresAt  = expRow ? new Date(expRow.value) : null
  const daysLeft   = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_DAY) : null
  const needsRefresh = daysLeft !== null && daysLeft <= 14

  return NextResponse.json({
    hasToken:     true,
    source:       "db",
    expiresAt:    expiresAt?.toISOString() ?? null,
    daysLeft,
    needsRefresh,
    status:       needsRefresh ? "⚠️ expiring_soon" : daysLeft !== null && daysLeft < 0 ? "❌ expired" : "✅ valid",
  })
}

// POST /api/broadcast/token/refresh — force refresh ngay lập tức (admin)
// Body: {} — không cần gì, dùng refresh_token từ DB + app credentials từ env
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appId     = process.env.ZALO_OA_APP_ID
  const appSecret = process.env.ZALO_OA_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "ZALO_OA_APP_ID and ZALO_OA_APP_SECRET must be set in env" },
      { status: 503 }
    )
  }

  const rtRow = await prisma.appSetting.findUnique({ where: { key: DB_KEYS.refreshToken } })
  const refreshToken = rtRow?.value ?? process.env.ZALO_OA_REFRESH_TOKEN
  if (!refreshToken) {
    return NextResponse.json(
      { error: "No refresh token available — manual re-auth required at developers.zalo.me" },
      { status: 503 }
    )
  }

  const body = new URLSearchParams({
    grant_type:    "refresh_token",
    app_id:        appId,
    refresh_token: refreshToken,
  })

  const res = await fetch(ZALO_OAUTH_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key:      appSecret,
    },
    body,
  })

  const data = await res.json() as {
    access_token?:  string
    refresh_token?: string
    expires_in?:    number
    error?:         number
    message?:       string
  }

  if (data.error || !data.access_token) {
    return NextResponse.json(
      { error: `Zalo OAuth error ${data.error}: ${data.message}` },
      { status: 502 }
    )
  }

  const expiresAt = new Date(Date.now() + (data.expires_in ?? 7_776_000) * 1000)
  const daysLeft  = Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_DAY)

  await Promise.all([
    prisma.appSetting.upsert({
      where:  { key: DB_KEYS.accessToken },
      update: { value: data.access_token },
      create: { key: DB_KEYS.accessToken, value: data.access_token },
    }),
    prisma.appSetting.upsert({
      where:  { key: DB_KEYS.refreshToken },
      update: { value: data.refresh_token ?? refreshToken },
      create: { key: DB_KEYS.refreshToken, value: data.refresh_token ?? refreshToken },
    }),
    prisma.appSetting.upsert({
      where:  { key: DB_KEYS.expiresAt },
      update: { value: expiresAt.toISOString() },
      create: { key: DB_KEYS.expiresAt, value: expiresAt.toISOString() },
    }),
  ])

  return NextResponse.json({
    success:   true,
    expiresAt: expiresAt.toISOString(),
    daysLeft,
    message:   `Token refreshed — valid for ${daysLeft} more days`,
  })
}
