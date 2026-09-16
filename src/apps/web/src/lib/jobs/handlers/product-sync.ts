import type { JobConfig, JobResult } from "../types"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

const authHeaders: Record<string, string> = SECRET ? { Authorization: `Bearer ${SECRET}` } : {}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function productSyncHandler(config: JobConfig): Promise<JobResult> {
  const niche  = String(config.niche  ?? "all")
  const source = String(config.source ?? "all")

  // Step 1: Fire trigger — API starts sync in background and returns 202 immediately.
  // This avoids the undici headersTimeout (300s) that would kill a long-running sync.
  let triggerRes: Response
  try {
    triggerRes = await fetch(`${API_URL}/sync/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ niche, source }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1, summary: `Không kết nối được API: ${msg}`, errors: [{ reason: msg }] }
  }

  if (!triggerRes.ok && triggerRes.status !== 202) {
    const text = await triggerRes.text().catch(() => triggerRes.statusText)
    return {
      itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1,
      summary: `API lỗi ${triggerRes.status}: ${text.slice(0, 200)}`,
      errors: [{ reason: `HTTP ${triggerRes.status}: ${text.slice(0, 200)}` }],
    }
  }

  const triggerBody = await triggerRes.json() as { ok: boolean; inProgress?: boolean; startedAt?: string }

  // Already running — return without error so UI shows it gracefully
  if (!triggerBody.ok && triggerBody.inProgress) {
    return { itemsTotal: 0, itemsSuccess: 0, itemsFailed: 0, summary: "Sync đang chạy, vui lòng đợi" }
  }

  const triggerTime = triggerBody.startedAt ? new Date(triggerBody.startedAt).getTime() : Date.now()

  // Step 2: Poll GET /sync/status every 20s until sync completes (max 90 min)
  const MAX_WAIT_MS = 90 * 60 * 1000
  const POLL_INTERVAL_MS = 20_000

  while (Date.now() - triggerTime < MAX_WAIT_MS) {
    await sleep(POLL_INTERVAL_MS)

    let statusRes: Response
    try {
      statusRes = await fetch(`${API_URL}/sync/status`, {
        headers: authHeaders,
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      continue // network hiccup — retry
    }

    if (!statusRes.ok) continue

    const status = await statusRes.json() as {
      ok: boolean
      inProgress: boolean
      completedAt?: string
      result?: {
        niches: number; fetched: number; newDeals: number
        priceChanges: number; skipped: number; durationMs: number
        summary: string
        bySource: Record<string, { fetched: number; skipped: number }>
      }
    }

    if (!status.inProgress && status.completedAt && status.result) {
      // Verify the completed sync is the one we triggered (not a stale previous result)
      const completedAt = new Date(status.completedAt).getTime()
      if (completedAt >= triggerTime - 5_000) {
        const r = status.result
        return {
          itemsTotal: r.fetched,
          itemsSuccess: r.newDeals,
          itemsFailed: 0,
          summary: r.summary,
          meta: {
            priceChanges: r.priceChanges,
            skipped: r.skipped,
            niches: r.niches,
            bySource: r.bySource,
          },
        }
      }
    }
  }

  return {
    itemsTotal: 0, itemsSuccess: 0, itemsFailed: 1,
    summary: "Sync timeout sau 90 phút",
    errors: [{ reason: "Polling timeout: sync did not complete within 90 minutes" }],
  }
}
