import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { runJob } from "@/lib/jobs/runner"
import { productSyncHandler } from "@/lib/jobs/handlers/product-sync"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const { id } = await params

  const source = await prisma.syncSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Không tìm thấy nguồn" }, { status: 404 })
  if (!source.enabled) return NextResponse.json({ error: "Nguồn đang tắt" }, { status: 400 })

  // Find or create the product_sync job record
  const { JOB_SEEDS } = await import("@/lib/jobs/registry")
  const productSyncSeed = JOB_SEEDS.find((s) => s.key === "product_sync")!
  const syncJob = await prisma.syncJob.upsert({
    where: { key: "product_sync" },
    update: {},
    create: productSyncSeed,
  })

  // Prevent double run for this source
  const running = await prisma.syncJobRun.findFirst({
    where: { jobId: syncJob.id, status: "running", source: source.slug },
  })
  if (running) {
    return NextResponse.json({ error: "Nguồn đang được đồng bộ", runId: running.id }, { status: 409 })
  }

  // Mark source as running
  await prisma.syncSource.update({
    where: { id },
    data: { lastRunStatus: "running" },
  })

  try {
    const { runId, result, durationMs, status } = await runJob({
      jobId: syncJob.id,
      handler: productSyncHandler,
      config: { source: source.slug, niche: "all" },
      triggerType: "manual",
      triggeredBy: `source:${source.slug}`,
      sourceSlug: source.slug,
    })

    await prisma.syncSource.update({
      where: { id },
      data: { lastRunAt: new Date(), lastRunStatus: status },
    })

    return NextResponse.json({
      ok: true, runId, status, durationMs,
      itemsTotal: result.itemsTotal,
      itemsSuccess: result.itemsSuccess,
      itemsFailed: result.itemsFailed,
      summary: result.summary,
    })
  } catch (err) {
    await prisma.syncSource.update({
      where: { id },
      data: { lastRunAt: new Date(), lastRunStatus: "failed" },
    })
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
