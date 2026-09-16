import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSessionToken } from "@/lib/auth"
import { validateCredentials } from "@/lib/auth-password"
import { rateLimit } from "@/lib/rate-limit"
import { generateCsrfToken } from "@/lib/csrf"
import { createOtp } from "@/lib/otp-store"
import { sendOtpEmail } from "@/lib/email"
import { adminLog } from "@/lib/logger"

async function readTwoFA(): Promise<boolean> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: "store_settings" } })
    if (!row) return false
    const parsed = JSON.parse(row.value) as Record<string, unknown>
    return !!parsed.twoFA
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const ip = (request.headers as Headers).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed } = await rateLimit(`login:${ip}`, { max: 5, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Quá nhiều lần thử. Vui lòng thử lại sau." }, { status: 429 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email và mật khẩu không được để trống" },
        { status: 400 }
      )
    }

    const valid = await validateCredentials(email, password)

    if (!valid) {
      void adminLog.warn("Đăng nhập thất bại — sai thông tin", "auth", { email, ip }, "user")
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không đúng" },
        { status: 401 }
      )
    }

    const twoFA = await readTwoFA()

    if (twoFA) {
      const code = createOtp(email)
      await sendOtpEmail(email, code)
      void adminLog.info("Đăng nhập yêu cầu OTP", "auth", { email, ip }, "user")
      return NextResponse.json({ requiresOtp: true })
    }

    void adminLog.info("Đăng nhập thành công", "auth", { email, ip }, "user")
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
    return NextResponse.json(
      { error: "Có lỗi xảy ra. Vui lòng thử lại." },
      { status: 500 }
    )
  }
}
