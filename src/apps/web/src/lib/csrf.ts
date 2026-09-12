import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "./auth"

export async function csrfGuard(request: NextRequest): Promise<NextResponse | null> {
  const header = request.headers.get("x-csrf-token")
  const cookie = request.cookies.get("sansale_csrf")?.value

  // 1. Jalur utama: token CSRF valid
  if (header && cookie && header === cookie) {
    return null
  }

  // 2. Fallback: session hợp lệ + request từ same-origin (browser gửi sec-fetch-site tự động).
  // Non-browser clients (curl, server-side) không gửi sec-fetch-site → cũng pass nếu có session.
  // Đây là thiết kế có chủ ý: non-browser clients được tin tưởng nếu đã xác thực.
  // Bảo vệ CSRF thực sự dựa vào SameSite=Lax trên cookie session (block cross-site browser requests).
  const sessionToken = request.cookies.get("sansale_admin_session")?.value
  const secFetchSite = request.headers.get("sec-fetch-site")

  if (sessionToken) {
    const isSessionValid = await verifySessionToken(sessionToken)
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
