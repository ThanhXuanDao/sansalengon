import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { runJob } from "@/lib/jobs/runner"
import { productSyncHandler } from "@/lib/jobs/handlers/product-sync"
import { couponSyncPlatformHandler } from "@/lib/jobs/handlers/coupon-sync-platform"
import { leadSyncHandler } from "@/lib/jobs/handlers/lead-sync"
import { getSyncHandlerType } from "@/lib/sync-source-utils"

// Reset a stuck "running" source back to "failed"
export async function DELETE(
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
  if (source.lastRunStatus !== "running") {
    return NextResponse.json({ error: "Nguồn không ở trạng thái đang chạy" }, { status: 400 })
  }

  await prisma.syncSource.update({
    where: { id },
    data: { lastRunStatus: "failed" },
  })

  // Also close any stuck SyncJobRun for this source
  await prisma.syncJobRun.updateMany({
    where: { status: "running", source: source.slug },
    data: { status: "failed", finishedAt: new Date(), summary: "Dừng thủ công bởi admin" },
  })

  return NextResponse.json({ ok: true })
}

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

  const handlerType = getSyncHandlerType(source.config)
  const jobKey = handlerType === "coupon" ? "coupon_sync" : "product_sync"
  const handler = handlerType === "coupon"
    ? couponSyncPlatformHandler
    : handlerType === "lead"
    ? leadSyncHandler
    : productSyncHandler

  // Find or create the relevant job record
  const { JOB_SEEDS } = await import("@/lib/jobs/registry")
  const jobSeed = JOB_SEEDS.find((s) => s.key === jobKey)!
  const syncJob = await prisma.syncJob.upsert({
    where: { key: jobKey },
    update: {},
    create: jobSeed,
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
      handler,
      config: handlerType === "coupon" ? { sources: source.slug } : { source: source.slug, niche: "all" },
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
