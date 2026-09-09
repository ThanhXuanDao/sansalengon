const store = new Map<string, { count: number; resetAt: number }>()
let lastCleanup = Date.now()

export function rateLimit(
  key: string,
  { max = 5, windowMs = 60_000 }: { max?: number; windowMs?: number } = {}
): { allowed: boolean } {
  const now = Date.now()

  // Staggered cleanup: run every 60s instead of at capacity
  if (now - lastCleanup > 60_000) {
    for (const [k, v] of store) {
      if (now > v.resetAt) store.delete(k)
    }
    lastCleanup = now
  }

  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true }
  }

  if (entry.count >= max) {
    return { allowed: false }
  }

  entry.count++
  return { allowed: true }
}
