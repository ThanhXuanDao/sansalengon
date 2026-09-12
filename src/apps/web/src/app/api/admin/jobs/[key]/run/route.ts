import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { getJobDefinition } from "@/lib/jobs/registry"
import { runJob } from "@/lib/jobs/runner"

// POST — trigger a manual run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { key } = await params
  const def = getJobDefinition(key)
  if (!def) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  const job = await prisma.syncJob.findUnique({ where: { key } })
  if (!job) return NextResponse.json({ error: "Job not registered in DB" }, { status: 404 })

  if (!job.isEnabled) {
    return NextResponse.json({ error: "Job is disabled" }, { status: 400 })
  }

  // Check if already running
  const running = await prisma.syncJobRun.findFirst({
    where: { jobId: job.id, status: "running" },
  })
  if (running) {
    return NextResponse.json({ error: "Job is already running", runId: running.id }, { status: 409 })
  }

  // Use config override from request body, or fall back to stored config
  const body = await request.json().catch(() => ({})) as { configOverride?: Record<string, unknown> }
  const storedConfig = (() => { try { return JSON.parse(job.config) } catch { return {} } })()
  const config = { ...storedConfig, ...(body.configOverride ?? {}) }

  const { runId, result, durationMs, status } = await runJob({
    jobId: job.id,
    handler: def.handler,
    config,
    triggerType: "manual",
    triggeredBy: "admin",
  })

  return NextResponse.json({
    ok: true,
    runId,
    status,
    durationMs,
    itemsTotal: result.itemsTotal,
    itemsSuccess: result.itemsSuccess,
    itemsFailed: result.itemsFailed,
    summary: result.summary,
    errors: result.errors,
  })
}
