import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const DB_KEYS = {
  accessToken:  "zalo:access_token",
  refreshToken: "zalo:refresh_token",
  expiresAt:    "zalo:token_expires_at",
} as const

const MS_PER_DAY = 24 * 60 * 60 * 1000
const REFRESH_THRESHOLD_DAYS = 14

function daysLeft(expiresAt: Date): number {
  return Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_DAY)
}

// GET — trạng thái token (không trả về giá trị token thực)
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
      hasToken: false,
      expiresAt: null,
      daysLeft: null,
      needsRefresh: false,
      seededFromEnv: false,
    })
  }

  const expiresAt = expRow ? new Date(expRow.value) : null
  const days = expiresAt ? daysLeft(expiresAt) : null

  return NextResponse.json({
    hasToken: true,
    expiresAt: expiresAt?.toISOString() ?? null,
    daysLeft: days,
    needsRefresh: days !== null && days <= REFRESH_THRESHOLD_DAYS,
    // Hint for UI: token prefix (first 8 chars) so admin can verify which token is active
    tokenPrefix: atRow.value.slice(0, 8) + "…",
  })
}

// POST — lưu token mới vào DB (dùng khi manual re-auth hoặc initial setup)
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { accessToken, refreshToken, expiresInDays } = body as {
    accessToken?: string
    refreshToken?: string
    expiresInDays?: number
  }

  if (!accessToken?.trim()) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 })
  }

  const days = typeof expiresInDays === "number" && expiresInDays > 0 ? expiresInDays : 90
  const expiresAt = new Date(Date.now() + days * MS_PER_DAY)

  const ops: Promise<unknown>[] = [
    prisma.appSetting.upsert({
      where:  { key: DB_KEYS.accessToken },
      update: { value: accessToken.trim() },
      create: { key: DB_KEYS.accessToken, value: accessToken.trim() },
    }),
    prisma.appSetting.upsert({
      where:  { key: DB_KEYS.expiresAt },
      update: { value: expiresAt.toISOString() },
      create: { key: DB_KEYS.expiresAt, value: expiresAt.toISOString() },
    }),
  ]

  if (refreshToken?.trim()) {
    ops.push(
      prisma.appSetting.upsert({
        where:  { key: DB_KEYS.refreshToken },
        update: { value: refreshToken.trim() },
        create: { key: DB_KEYS.refreshToken, value: refreshToken.trim() },
      }),
    )
  }

  await Promise.all(ops)

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    daysLeft: days,
    tokenPrefix: accessToken.trim().slice(0, 8) + "…",
  })
}
