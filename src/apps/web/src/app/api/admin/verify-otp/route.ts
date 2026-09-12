import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { verifyOtp } from "@/lib/otp-store"
import { createSessionToken } from "@/lib/auth"
import { generateCsrfToken } from "@/lib/csrf"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed } = await rateLimit(`otp:${ip}`, { max: 5, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Quá nhiều lần thử. Vui lòng thử lại sau." }, { status: 429 })
    }

    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json({ error: "Email và mã xác thực không được để trống" }, { status: 400 })
    }

    if (email !== process.env.ADMIN_EMAIL) {
      return NextResponse.json({ error: "Email không hợp lệ" }, { status: 401 })
    }

    const valid = verifyOtp(email, code)
    if (!valid) {
      return NextResponse.json({ error: "Mã xác thực sai hoặc đã hết hạn" }, { status: 401 })
    }

    const token = await createSessionToken()
    const csrfToken = generateCsrfToken()

    const response = NextResponse.json({ success: true })

    response.cookies.set("sansale_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    response.cookies.set("sansale_csrf", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    return response
  } catch {
    return NextResponse.json({ error: "Có lỗi xảy ra. Vui lòng thử lại." }, { status: 500 })
  }
}