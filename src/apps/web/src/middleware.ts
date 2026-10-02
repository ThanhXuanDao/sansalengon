import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifySessionToken } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // DISABLE_ADMIN=true → public-only deploy: block all admin routes + API
  if (process.env.DISABLE_ADMIN === "true") {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      return new NextResponse(null, { status: 404 })
    }
  }

  const response = NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(request.headers),
        "x-pathname": pathname,
      }),
    },
  })

  if (pathname === "/admin/login") {
    const token = request.cookies.get("sansale_admin_session")?.value
    if (token) {
      const payload = await verifySessionToken(token)
      if (payload) {
        return NextResponse.redirect(new URL("/admin", request.url))
      }
    }
    return response
  }

  if (pathname.startsWith("/admin")) {
    const token = request.cookies.get("sansale_admin_session")?.value
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
    const payload = await verifySessionToken(token)
    if (!payload) {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
