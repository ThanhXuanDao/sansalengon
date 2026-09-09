import { SignJWT, jwtVerify } from "jose"
import type { NextRequest } from "next/server"

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET is not set")
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long")
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret())
}

export async function verifySessionToken(
  token: string
): Promise<{ role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    })
    if (payload.role !== "admin") return null
    return { role: payload.role as string }
  } catch {
    return null
  }
}

export async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("shopby_admin_session")?.value
  if (!token) return false
  const payload = await verifySessionToken(token)
  return !!payload
}
