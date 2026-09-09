import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "./auth"

export async function csrfGuard(request: NextRequest): Promise<NextResponse | null> {
  const header = request.headers.get("x-csrf-token")
  const cookie = request.cookies.get("shopby_csrf")?.value

  // 1. Jalur utama: token CSRF valid
  if (header && cookie && header === cookie) {
    return null
  }

  // 2. Jalur fallback: jika session admin valid dan sec-fetch-site same-origin (browser modern)
  const sessionToken = request.cookies.get("shopby_admin_session")?.value
  const secFetchSite = request.headers.get("sec-fetch-site")
  
  if (sessionToken) {
    const isSessionValid = await verifySessionToken(sessionToken)
    // sec-fetch-site same-origin memastikan request dipicu dari web kita sendiri, bukan web lain
    if (isSessionValid && (!secFetchSite || secFetchSite === "same-origin")) {
      return null
    }
  }

  return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 })
}

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}
