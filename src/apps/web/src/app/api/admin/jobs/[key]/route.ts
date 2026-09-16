import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { JOB_DEFINITIONS } from "@/lib/jobs/registry"

// GET — job detail + run history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { key } = await params
  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
  const pageSize = 20
  const nicheFilter = searchParams.get("niche") ?? null

  const job = await prisma.syncJob.findUnique({ where: { key } })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const runsWhere: Record<string, unknown> = { jobId: job.id }
  if (nicheFilter && nicheFilter !== "all") runsWhere.niche = nicheFilter

  const [runs, total] = await Promise.all([
    prisma.syncJobRun.findMany({
      where: runsWhere,
      orderBy: { startedAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.syncJobRun.count({ where: runsWhere }),
  ])

  const def = JOB_DEFINITIONS.find((d) => d.key === key)

  return NextResponse.json({
    job: {
      ...job,
      config: (() => { try { return JSON.parse(job.config) } catch { return {} } })(),
      category: def?.category ?? "maintenance",
      icon: def?.icon ?? "Settings",
      configFields: def?.configFields ?? [],
    },
    runs: runs.map((r) => ({
      ...r,
      errors: r.errors ? (() => { try { return JSON.parse(r.errors) } catch { return [] } })() : [],
      meta: r.meta ? (() => { try { return JSON.parse(r.meta) } catch { return {} } })() : {},
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  })
}

// PATCH — update config or isEnabled
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { key } = await params
  const job = await prisma.syncJob.findUnique({ where: { key } })
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const body = await request.json().catch(() => ({})) as {
    config?: Record<string, unknown>
    isEnabled?: boolean
    scheduleEnabled?: boolean
    scheduleCron?: string | null
  }

  // Recompute nextRunAt if schedule changed
  let scheduleNextRunAt: Date | null | undefined = undefined
  if (body.scheduleEnabled !== undefined || body.scheduleCron !== undefined) {
    const current = await prisma.syncJob.findUnique({ where: { key }, select: { scheduleCron: true, scheduleEnabled: true } })
    const newEnabled = body.scheduleEnabled ?? current?.scheduleEnabled ?? false
    const newCron = body.scheduleCron !== undefined ? body.scheduleCron : (current?.scheduleCron ?? null)
    if (newEnabled && newCron) {
      const { getNextRunDate } = await import("@/lib/jobs/cron-utils")
      scheduleNextRunAt = getNextRunDate(newCron) ?? null
    } else {
      scheduleNextRunAt = null
    }
  }

  const updated = await prisma.syncJob.update({
    where: { key },
    data: {
      ...(body.config !== undefined ? { config: JSON.stringify(body.config) } : {}),
      ...(body.isEnabled !== undefined ? { isEnabled: body.isEnabled } : {}),
      ...(body.scheduleEnabled !== undefined ? { scheduleEnabled: body.scheduleEnabled } : {}),
      ...(body.scheduleCron !== undefined ? { scheduleCron: body.scheduleCron || null } : {}),
      ...(scheduleNextRunAt !== undefined ? { scheduleNextRunAt } : {}),
    },
  })

  return NextResponse.json({
    ok: true,
    job: {
      ...updated,
      config: (() => { try { return JSON.parse(updated.config) } catch { return {} } })(),
      scheduleNextRunAt: updated.scheduleNextRunAt?.toISOString() ?? null,
    },
  })
}
