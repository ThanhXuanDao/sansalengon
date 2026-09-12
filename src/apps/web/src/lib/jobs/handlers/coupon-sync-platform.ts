import type { JobConfig, JobResult } from "../types"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

export async function couponSyncPlatformHandler(config: JobConfig): Promise<JobResult> {
  const sources = String(config.sources ?? "all") as "all" | "accesstrade" | "platforms"

  let res: Response
  try {
    res = await fetch(`${API_URL}/sync/coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      body: JSON.stringify({ sources }),
      signal: AbortSignal.timeout(180_000), // 3 phút
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: `Không kết nối được API: ${msg}`, errors: [{ reason: msg }] }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1,
      summary: `API lỗi ${res.status}: ${text.slice(0, 200)}`,
      errors: [{ reason: `HTTP ${res.status}: ${text.slice(0, 200)}` }],
    }
  }

  const data = await res.json() as {
    ok: boolean
    total: number
    byNiche: Record<string, number>
    byPlatform: Record<string, number>
    durationMs: number
    summary: string
  }

  return {
    itemsTotal: data.total,
    itemsSuccess: data.total,
    itemsFailed: 0,
    summary: data.summary,
    meta: {
      byNiche: data.byNiche,
      byPlatform: data.byPlatform,
    },
  }
}
