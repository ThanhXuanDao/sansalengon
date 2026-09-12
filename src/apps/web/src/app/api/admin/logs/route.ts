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
  const level  = searchParams.get("level")  || null   // "error"|"warn"|"info"|"debug"
  const q      = searchParams.get("q")      || null
  const source = searchParams.get("source") || null
  const range  = searchParams.get("range")  || "today" // "today"|"7d"|"30d"|"all"
  const page   = Math.max(1, parseInt(searchParams.get("page") || "1", 10))

  const since = rangeSince(range)

  const where = {
    ...(level  ? { level }  : {}),
    ...(source ? { source } : {}),
    ...(q      ? { message: { contains: q, mode: "insensitive" as const } } : {}),
    ...(since  ? { createdAt: { gte: since } } : {}),
  }

  const [total, logs, counts] = await Promise.all([
    prisma.appLog.count({ where }),
    prisma.appLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:  (page - 1) * PAGE_SIZE,
      take:  PAGE_SIZE,
      select: { id: true, level: true, message: true, context: true, source: true, createdAt: true },
    }),
    // Level counts for the current filter (excluding level filter itself)
    prisma.appLog.groupBy({
      by: ["level"],
      where: {
        ...(source ? { source } : {}),
        ...(q      ? { message: { contains: q, mode: "insensitive" as const } } : {}),
        ...(since  ? { createdAt: { gte: since } } : {}),
      },
      _count: { _all: true },
    }),
  ])

  const levelCounts = Object.fromEntries(
    counts.map((c) => [c.level, c._count._all])
  )

  return NextResponse.json({
    logs,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
    levelCounts,
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

  const { count } = await prisma.appLog.deleteMany({
    where: level ? { level } : {},
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
