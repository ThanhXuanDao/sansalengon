import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Honeypot: redirect anyone hitting /admin to home
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (pathname === "/admin-shopby/login") {
    const token = request.cookies.get("shopby_admin_session")?.value
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        return NextResponse.redirect(new URL("/admin-shopby", request.url))
      }
    }
    return NextResponse.next()
  }

  const token = request.cookies.get("shopby_admin_session")?.value
  if (!token) {
    const loginUrl = new URL("/admin-shopby/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await verifySessionToken(token)
  if (!payload) {
    const loginUrl = new URL("/admin-shopby/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin", "/admin-shopby/:path*", "/api/stats/:path*", "/api/analytics/:path*", "/api/settings/:path*"],
}
