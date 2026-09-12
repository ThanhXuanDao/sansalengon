import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getJobDefinition } from "@/lib/jobs/registry"
import { runJob } from "@/lib/jobs/runner"
import { getNextRunDate } from "@/lib/jobs/cron-utils"

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

  return NextResponse.json({ ok: true, ran: results.length, jobs: results })
}
