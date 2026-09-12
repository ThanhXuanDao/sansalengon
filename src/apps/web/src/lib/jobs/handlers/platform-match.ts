import type { JobConfig, JobResult } from "../types"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

export async function platformMatchHandler(_config: JobConfig): Promise<JobResult> {
  let res: Response
  try {
    res = await fetch(`${API_URL}/sync/platform-match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      signal: AbortSignal.timeout(600_000), // 10 phút — matching có thể chạy lâu
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
    byPlatform: Record<string, { matched: number; autoConfirmed: number; errors: number }>
    durationMs: number
    summary: string
  }

  const totalMatched = Object.values(data.byPlatform ?? {}).reduce((s, p) => s + p.matched, 0)
  const totalErrors = Object.values(data.byPlatform ?? {}).reduce((s, p) => s + p.errors, 0)

  return {
    itemsTotal: totalMatched,
    itemsSuccess: totalMatched - totalErrors,
    itemsFailed: totalErrors,
    summary: data.summary,
    meta: { byPlatform: data.byPlatform },
  }
}
