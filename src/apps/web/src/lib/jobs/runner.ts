import { prisma } from "@/lib/prisma"
import { getNextRunDate } from "./cron-utils"
import type { JobHandler, JobConfig, JobResult } from "./types"

export async function runJob(opts: {
  jobId: string
  handler: JobHandler
  config: JobConfig
  triggerType?: "manual" | "auto"
  triggeredBy?: string
  sourceSlug?: string
}): Promise<{ runId: string; result: JobResult; durationMs: number; status: string }> {
  const { jobId, handler, config, triggerType = "manual", triggeredBy } = opts

  const run = await prisma.syncJobRun.create({
    data: {
      jobId, triggerType, triggeredBy, status: "running",
      ...(opts.sourceSlug ? { source: opts.sourceSlug } : {}),
    },
  })

  const t0 = Date.now()
  let result: JobResult
  let status: "success" | "failed" | "partial"

  try {
    result = await handler(config)
    const s = result.itemsSuccess ?? 0
    const f = result.itemsFailed ?? 0
    status = f > 0 && s === 0 ? "failed" : f > 0 ? "partial" : "success"
  } catch (err) {
    result = {
      itemsTotal: 0,
      itemsSuccess: 0,
      itemsFailed: 1,
      summary: `Lỗi không xác định: ${err instanceof Error ? err.message : String(err)}`,
      errors: [{ reason: err instanceof Error ? err.message : String(err) }],
    }
    status = "failed"
  }

  const durationMs = Date.now() - t0

  await prisma.syncJobRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      durationMs,
      itemsTotal: result.itemsTotal,
      itemsSuccess: result.itemsSuccess,
      itemsFailed: result.itemsFailed,
      source: result.source,
      niche: result.niche,
      summary: result.summary,
      errors: result.errors ? JSON.stringify(result.errors) : null,
      meta: result.meta ? JSON.stringify(result.meta) : null,
    },
  })

  // Recompute next scheduled run
  const job = await prisma.syncJob.findUnique({ where: { id: jobId }, select: { scheduleCron: true, scheduleEnabled: true } })
  const nextRunAt = (job?.scheduleEnabled && job.scheduleCron)
    ? getNextRunDate(job.scheduleCron)
    : null

  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      lastRunAt: new Date(),
      lastStatus: status,
      updatedAt: new Date(),
      ...(nextRunAt ? { scheduleNextRunAt: nextRunAt } : {}),
    },
  })

  return { runId: run.id, result, durationMs, status }
}
