import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { generateCsrfToken } from "@/lib/csrf"

export async function GET(request: NextRequest) {
  const isAuthed = await checkAuth(request)
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const csrfToken = generateCsrfToken()
  const response = NextResponse.json({ token: csrfToken })

  response.cookies.set("shopby_csrf", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  })

  return response
}
