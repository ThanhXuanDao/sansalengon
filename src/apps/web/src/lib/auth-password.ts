import { scryptSync, timingSafeEqual, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":")
  if (parts.length !== 2) return false
  const [salt, key] = parts
  const derivedKey = scryptSync(password, salt, 64)
  const storedKey = Buffer.from(key, "base64")
  if (derivedKey.length !== storedKey.length) return false
  return timingSafeEqual(derivedKey, storedKey)
}

export function hashPassword(password: string): string {
  const salt = randomBytes(32).toString("hex")
  const key = scryptSync(password, salt, 64)
  return `${salt}:${key.toString("base64")}`
}

export async function validateCredentials(
  email: string,
  password: string
): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return false
  if (email !== adminEmail) return false

  // Check env var hash first
  const envHash = process.env.ADMIN_PASSWORD_HASH
  if (envHash && verifyPassword(password, envHash)) return true

  // Fallback: check DB-stored hash (set via change password)
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: "admin_password_hash" },
    })
    if (row && verifyPassword(password, row.value)) return true
  } catch {
    // DB not reachable – rely only on env hash
  }

  return false
}
