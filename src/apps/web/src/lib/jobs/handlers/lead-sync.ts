import type { JobConfig, JobResult } from "../types"
import { prisma } from "@/lib/prisma"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""
const authHeaders: Record<string, string> = SECRET ? { Authorization: `Bearer ${SECRET}` } : {}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Handler cho lead-campaign và offer-sync — sync nhanh (<30s).
// Poll SyncSource.lastRunAt thay vì poll NestJS /sync/status (vốn chỉ đọc dealSync state).
export async function leadSyncHandler(config: JobConfig): Promise<JobResult> {
  const source = String(config.source ?? "")
  if (!source) return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: "Thiếu source slug" }

  const triggerTime = Date.now()

  try {
    const res = await fetch(`${API_URL}/sync/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ source }),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await res.json() as { ok: boolean; inProgress?: boolean; message?: string }
    if (body.inProgress) {
      return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: body.message ?? "Sync đang chạy, vui lòng đợi" }
    }
    if (!res.ok && !body.ok) {
      return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: `API lỗi ${res.status}: ${body.message ?? ""}` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: `Không kết nối được API: ${msg}` }
  }

  // Poll DB: NestJS cập nhật SyncSource.lastRunAt + lastRunStatus khi hoàn thành
  const MAX_WAIT_MS = 60_000
  const POLL_MS = 2_000

  while (Date.now() - triggerTime < MAX_WAIT_MS) {
    await sleep(POLL_MS)
    const src = await prisma.syncSource.findFirst({
      where: { slug: source },
      select: { lastRunAt: true, lastRunStatus: true },
    })
    if (src?.lastRunAt && src.lastRunAt.getTime() >= triggerTime - 2_000) {
      const ok = src.lastRunStatus === "success"
      return {
        itemsTotal: 1,
        itemsSuccess: ok ? 1 : 0,
        itemsFailed: ok ? 0 : 1,
        summary: ok ? "Đồng bộ thành công" : `Lỗi: ${src.lastRunStatus ?? "unknown"}`,
      }
    }
  }

  return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: "Timeout: sync không phản hồi sau 60s" }
}
