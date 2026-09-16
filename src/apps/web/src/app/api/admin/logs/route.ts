import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { prisma } from "@/lib/prisma"

const PAGE_SIZE = 50

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const level   = searchParams.get("level")   || null
  const q       = searchParams.get("q")       || null
  const source  = searchParams.get("source")  || null
  const app     = searchParams.get("app")     || null
  const trigger = searchParams.get("trigger") || null
  const range   = searchParams.get("range")   || "today"
  const page    = Math.max(1, parseInt(searchParams.get("page") || "1", 10))

  const since = rangeSince(range)

  const where = {
    ...(level   ? { level }   : {}),
    ...(source  ? { source }  : {}),
    ...(app     ? { app }     : {}),
    ...(trigger ? { trigger } : {}),
    ...(q       ? { message: { contains: q, mode: "insensitive" as const } } : {}),
    ...(since   ? { createdAt: { gte: since } } : {}),
  }

  // Base where without level filter — for level count chips
  const whereNoLevel = {
    ...(source  ? { source }  : {}),
    ...(app     ? { app }     : {}),
    ...(trigger ? { trigger } : {}),
    ...(q       ? { message: { contains: q, mode: "insensitive" as const } } : {}),
    ...(since   ? { createdAt: { gte: since } } : {}),
  }

  const [total, logs, levelGroups, appGroups] = await Promise.all([
    prisma.appLog.count({ where }),
    prisma.appLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      select: { id: true, level: true, message: true, context: true, source: true, app: true, trigger: true, createdAt: true },
    }),
    // Level counts (excluding level filter)
    prisma.appLog.groupBy({
      by: ["level"],
      where: whereNoLevel,
      _count: { _all: true },
    }),
    // App counts (excluding app filter) — for app filter chips
    prisma.appLog.groupBy({
      by: ["app"],
      where: {
        ...(level   ? { level }   : {}),
        ...(source  ? { source }  : {}),
        ...(trigger ? { trigger } : {}),
        ...(q       ? { message: { contains: q, mode: "insensitive" as const } } : {}),
        ...(since   ? { createdAt: { gte: since } } : {}),
      },
      _count: { _all: true },
    }),
  ])

  const levelCounts = Object.fromEntries(
    levelGroups.map((c) => [c.level, c._count._all])
  )
  const appCounts = Object.fromEntries(
    appGroups.map((c) => [c.app ?? "unknown", c._count._all])
  )

  return NextResponse.json({
    logs,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    levelCounts,
    appCounts,
  })
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { searchParams } = request.nextUrl
  const level = searchParams.get("level") || null
  const app   = searchParams.get("app")   || null

  const { count } = await prisma.appLog.deleteMany({
    where: {
      ...(level ? { level } : {}),
      ...(app   ? { app }   : {}),
    },
  })

  return NextResponse.json({ deleted: count })
}

function rangeSince(range: string): Date | null {
  const now = new Date()
  if (range === "today") {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === "7d")  { const d = new Date(now); d.setDate(d.getDate() - 7);  return d }
  if (range === "30d") { const d = new Date(now); d.setDate(d.getDate() - 30); return d }
  return null
}
