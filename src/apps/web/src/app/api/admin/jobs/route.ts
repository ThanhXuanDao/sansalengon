import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { JOB_SEEDS, JOB_DEFINITIONS } from "@/lib/jobs/registry"

// GET — list all sync jobs (upsert seeds on first call)
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Upsert job seeds so the table is always populated
  await Promise.all(
    JOB_SEEDS.map((seed) =>
      prisma.syncJob.upsert({
        where: { key: seed.key },
        update: { name: seed.name, description: seed.description },
        create: seed,
      }),
    ),
  )

  // Init scheduleNextRunAt for jobs that have a schedule but no nextRunAt yet
  const { getNextRunDate } = await import("@/lib/jobs/cron-utils")
  const uninitialised = await prisma.syncJob.findMany({
    where: { scheduleEnabled: true, scheduleCron: { not: null }, scheduleNextRunAt: null },
  })
  await Promise.all(
    uninitialised.map((job) => {
      const next = job.scheduleCron ? getNextRunDate(job.scheduleCron) : null
      return next ? prisma.syncJob.update({ where: { id: job.id }, data: { scheduleNextRunAt: next } }) : Promise.resolve()
    }),
  )

  const jobs = await prisma.syncJob.findMany({
    orderBy: { key: "asc" },
    include: {
      runs: {
        orderBy: { startedAt: "desc" },
        take: 1,
        select: {
          id: true, status: true, startedAt: true, finishedAt: true,
          durationMs: true, itemsTotal: true, itemsSuccess: true, itemsFailed: true,
          triggerType: true, summary: true,
        },
      },
    },
  })

  // Enrich with config schema from registry
  const result = jobs.map((job) => {
    const def = JOB_DEFINITIONS.find((d) => d.key === job.key)
    return {
      ...job,
      config: (() => { try { return JSON.parse(job.config) } catch { return {} } })(),
      category: def?.category ?? "maintenance",
      icon: def?.icon ?? "Settings",
      configFields: def?.configFields ?? [],
      lastRun: job.runs[0] ?? null,
      runs: undefined,
    }
  })

  return NextResponse.json({ jobs: result })
}
