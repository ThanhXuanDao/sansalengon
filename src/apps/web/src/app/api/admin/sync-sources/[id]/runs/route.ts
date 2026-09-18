import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const source = await prisma.syncSource.findUnique({ where: { id }, select: { slug: true } })
  if (!source) return NextResponse.json({ error: "Không tìm thấy nguồn" }, { status: 404 })

  const syncJob = await prisma.syncJob.findUnique({ where: { key: "product_sync" }, select: { id: true } })
  if (!syncJob) return NextResponse.json({ runs: [] })

  const runs = await prisma.syncJobRun.findMany({
    where: {
      jobId: syncJob.id,
      source: source.slug,
    },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: {
      id: true, status: true, startedAt: true, finishedAt: true,
      durationMs: true, itemsTotal: true, itemsSuccess: true, itemsFailed: true,
      summary: true,
    },
  })

  return NextResponse.json({ runs })
}
