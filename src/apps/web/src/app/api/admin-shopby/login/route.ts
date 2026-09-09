import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createSessionToken } from "@/lib/auth"
import { validateCredentials } from "@/lib/auth-password"
import { rateLimit } from "@/lib/rate-limit"
import { generateCsrfToken } from "@/lib/csrf"
import { createOtp } from "@/lib/otp-store"
import { sendOtpEmail } from "@/lib/email"

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
    const { allowed } = rateLimit(`login:${ip}`, { max: 5, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Terlalu banyak percobaan login. Coba lagi nanti." }, { status: 429 })
    }

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password harus diisi" },
        { status: 400 }
      )
    }

    const valid = await validateCredentials(email, password)

    if (!valid) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      )
    }

    const twoFA = await readTwoFA()

    if (twoFA) {
      const code = createOtp(email)
      await sendOtpEmail(email, code)
      return NextResponse.json({ requiresOtp: true })
    }

    const token = await createSessionToken()
    const csrfToken = generateCsrfToken()

    const response = NextResponse.json({ success: true })

    response.cookies.set("shopby_admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    response.cookies.set("shopby_csrf", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    })

    return response
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
