import { Logger } from "@nestjs/common"

export interface BotSafeFetcherOptions {
  /** Base delay giữa các request (ms). Default: 1500 */
  baseDelayMs?: number
  /** Random spread [0..1]. 0.4 → ±40%. Default: 0.4 */
  jitterFactor?: number
  /** Base delay khi đang trong trạng thái bị block (ms). Default: 4000 */
  blockBackoffMs?: number
  /** Request timeout (ms). Default: 15_000 */
  timeoutMs?: number
  /** Logger name để trace nguồn gốc */
  loggerName?: string
}

export interface FetchJsonResult<T = unknown> {
  data: T | null
  /** true = bot block hoặc non-JSON response */
  blocked: boolean
  status?: number
}

/**
 * Wrapper fetch thông minh cho các nguồn dễ block bot.
 *
 * Dùng như sau:
 *   const fetcher = new BotSafeFetcher({ baseDelayMs: 1500 })
 *   for (const keyword of keywords) {
 *     await fetcher.delay()           // jitter delay, backoff nếu đang bị block
 *     const { data } = await fetcher.fetchJson(url, headers)
 *     if (!data) continue             // bị block — bỏ qua, tiếp keyword tiếp
 *   }
 */
export class BotSafeFetcher {
  private readonly log: Logger
  private readonly opts: Required<BotSafeFetcherOptions>

  private callCount = 0
  private blockStreak = 0

  constructor(opts: BotSafeFetcherOptions = {}) {
    this.opts = {
      baseDelayMs: opts.baseDelayMs ?? 1500,
      jitterFactor: opts.jitterFactor ?? 0.4,
      blockBackoffMs: opts.blockBackoffMs ?? 4000,
      timeoutMs: opts.timeoutMs ?? 15_000,
      loggerName: opts.loggerName ?? "BotSafeFetcher",
    }
    this.log = new Logger(this.opts.loggerName)
  }

  /** Jitter delay giữa các request. Gọi trước mỗi fetch trong loop. */
  async delay(): Promise<void> {
    if (this.callCount === 0) return // lần đầu không cần delay
    const base = this.blockStreak > 0 ? this.opts.blockBackoffMs : this.opts.baseDelayMs
    const spread = base * this.opts.jitterFactor
    const ms = Math.round(base + (Math.random() - 0.5) * 2 * spread)
    await sleep(ms)
  }

  /**
   * Fetch URL, parse JSON, phát hiện bot block.
   * Returns `{ data: null, blocked: true }` nếu bị block (HTML response, 429, non-JSON).
   * Gọi `delay()` trước khi gọi method này.
   */
  async fetchJson<T = unknown>(
    url: string,
    headers?: Record<string, string>,
  ): Promise<FetchJsonResult<T>> {
    this.callCount++
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      })

      if (res.status === 429) {
        this.log.debug(`Rate limited (429) — ${url}`)
        this.blockStreak++
        return { data: null, blocked: true, status: 429 }
      }

      if (!res.ok) {
        this.log.debug(`HTTP ${res.status} — ${url}`)
        this.blockStreak++
        return { data: null, blocked: false, status: res.status }
      }

      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("application/json") && !ct.includes("text/json")) {
        // HTML response = bot block / CAPTCHA
        this.log.debug(`Non-JSON response (${ct.split(";")[0].trim()}) — bot block? ${url}`)
        this.blockStreak++
        return { data: null, blocked: true, status: res.status }
      }

      const data = (await res.json()) as T
      this.blockStreak = 0
      return { data, blocked: false, status: res.status }
    } catch (e: any) {
      this.log.debug(`Fetch error: ${e.message} — ${url}`)
      this.blockStreak++
      return { data: null, blocked: false }
    }
  }

  /** Tổng số request đã thực hiện */
  get totalCalls(): number { return this.callCount }

  /** Số lần bị block liên tiếp hiện tại */
  get currentBlockStreak(): number { return this.blockStreak }

  /** Reset trạng thái block (dùng khi bắt đầu một nhóm keyword mới) */
  resetStreak(): void { this.blockStreak = 0 }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
