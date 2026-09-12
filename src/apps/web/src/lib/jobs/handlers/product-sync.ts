import type { JobConfig, JobResult } from "../types"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

export async function productSyncHandler(config: JobConfig): Promise<JobResult> {
  const niche = String(config.niche ?? "all")

  let res: Response
  try {
    res = await fetch(`${API_URL}/sync/deals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      body: JSON.stringify({ niche }),
      signal: AbortSignal.timeout(300_000), // 5 phút
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
    niches: number
    fetched: number
    newDeals: number
    priceChanges: number
    skipped: number
    durationMs: number
    summary: string
  }

  return {
    itemsTotal: data.fetched,
    itemsSuccess: data.newDeals,
    itemsFailed: 0,
    source: niche === "all" ? "all niches" : niche,
    summary: data.summary,
    meta: {
      priceChanges: data.priceChanges,
      skipped: data.skipped,
      niches: data.niches,
    },
  }
}
