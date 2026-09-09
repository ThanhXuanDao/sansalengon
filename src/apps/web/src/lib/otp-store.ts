const store = new Map<string, { code: string; expiresAt: number; attempts: number }>()

export function createOtp(email: string): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  store.set(email, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 })
  return code
}

export function verifyOtp(email: string, inputCode: string): boolean {
  const entry = store.get(email)
  if (!entry) return false
  if (Date.now() > entry.expiresAt) { store.delete(email); return false }
  if (entry.attempts >= 5) { store.delete(email); return false }
  entry.attempts++
  if (entry.code !== inputCode) return false
  store.delete(email)
  return true
}