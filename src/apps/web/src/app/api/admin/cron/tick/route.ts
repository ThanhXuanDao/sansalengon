import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getJobDefinition } from "@/lib/jobs/registry"
import { runJob } from "@/lib/jobs/runner"
import { getNextRunDate } from "@/lib/jobs/cron-utils"
import { productSyncHandler } from "@/lib/jobs/handlers/product-sync"

/**
 * GET /api/admin/cron/tick
 * Called by an external cron scheduler every minute.
 * Finds due jobs and runs them with triggerType="auto".
 *
 * Auth: Bearer token matching CRON_SECRET env var.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization") ?? ""
    const token = auth.replace(/^Bearer\s+/i, "").trim()
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const now = new Date()

  const dueJobs = await prisma.syncJob.findMany({
    where: {
      scheduleEnabled: true,
      scheduleCron: { not: null },
      scheduleNextRunAt: { lte: now },
    },
  })

  // Also initialize scheduleNextRunAt for jobs that have a schedule but no nextRunAt yet
  const uninitialised = await prisma.syncJob.findMany({
    where: {
      scheduleEnabled: true,
      scheduleCron: { not: null },
      scheduleNextRunAt: null,
    },
  })
  for (const job of uninitialised) {
    const next = job.scheduleCron ? getNextRunDate(job.scheduleCron) : null
    if (next) {
      await prisma.syncJob.update({ where: { id: job.id }, data: { scheduleNextRunAt: next } })
    }
  }

  if (dueJobs.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, jobs: [] })
  }

  const results: { key: string; status: string; durationMs: number; summary: string | undefined }[] = []

  for (const job of dueJobs) {
    const def = getJobDefinition(job.key)
    if (!def) continue

    // Prevent double-run: check if already running
    const alreadyRunning = await prisma.syncJobRun.findFirst({
      where: { jobId: job.id, status: "running" },
    })
    if (alreadyRunning) continue

    const config = (() => { try { return JSON.parse(job.config) } catch { return {} } })()

    const { status, durationMs, result } = await runJob({
      jobId: job.id,
      handler: def.handler,
      config,
      triggerType: "auto",
      triggeredBy: "cron",
    })

    results.push({ key: job.key, status, durationMs, summary: result.summary })
  }

  // ── Per-source schedules ─────────────────────────────────────────────────────
  const dueSources = await prisma.syncSource.findMany({
    where: {
      enabled: true,
      scheduleEnabled: true,
      scheduleCron: { not: null },
      scheduleNextRunAt: { lte: now },
    },
  })

  // Init scheduleNextRunAt for sources that have cron but no nextRunAt yet
  const uninitialisedSources = await prisma.syncSource.findMany({
    where: { enabled: true, scheduleEnabled: true, scheduleCron: { not: null }, scheduleNextRunAt: null },
  })
  for (const src of uninitialisedSources) {
    const next = src.scheduleCron ? getNextRunDate(src.scheduleCron) : null
    if (next) await prisma.syncSource.update({ where: { id: src.id }, data: { scheduleNextRunAt: next } })
  }

  let productSyncJob = null
  if (dueSources.length > 0) {
    const { JOB_SEEDS } = await import("@/lib/jobs/registry")
    const seed = JOB_SEEDS.find((s) => s.key === "product_sync")!
    productSyncJob = await prisma.syncJob.upsert({
      where: { key: "product_sync" },
      update: {},
      create: seed,
    })
  }

  const sourceResults: { slug: string; status: string }[] = []

  for (const src of dueSources) {
    if (!productSyncJob) break

    // Skip if already running
    const alreadyRunning = await prisma.syncJobRun.findFirst({
      where: { jobId: productSyncJob.id, status: "running", source: src.slug },
    })
    if (alreadyRunning) continue

    await prisma.syncSource.update({ where: { id: src.id }, data: { lastRunStatus: "running" } })

    try {
      const { status } = await runJob({
        jobId: productSyncJob.id,
        handler: productSyncHandler,
        config: { source: src.slug, niche: "all" },
        triggerType: "auto",
        triggeredBy: `source:${src.slug}`,
        sourceSlug: src.slug,
      })

      const next = src.scheduleCron ? getNextRunDate(src.scheduleCron) : null
      await prisma.syncSource.update({
        where: { id: src.id },
        data: {
          lastRunAt: new Date(), lastRunStatus: status,
          ...(next ? { scheduleNextRunAt: next } : {}),
        },
      })
      sourceResults.push({ slug: src.slug, status })
    } catch {
      await prisma.syncSource.update({
        where: { id: src.id },
        data: { lastRunAt: new Date(), lastRunStatus: "failed" },
      })
      sourceResults.push({ slug: src.slug, status: "failed" })
    }
  }

  return NextResponse.json({ ok: true, ran: results.length, jobs: results, sources: sourceResults })
}
