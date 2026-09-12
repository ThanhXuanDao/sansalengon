import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"

function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  if (!domain) return "***"
  return `${user.slice(0, 2)}***@${domain}`
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed } = rateLimit(`contact:${ip}`, { max: 3, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 })
    }

    const { name, email, message } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Semua field harus diisi" },
        { status: 400 }
      )
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Email tidak valid" },
        { status: 400 }
      )
    }

    console.info("[Contact] New message from:", maskEmail(email))

    return NextResponse.json({
      success: true,
      message: "Pesan berhasil dikirim. Kami akan menghubungi Anda segera.",
    })
  } catch {
    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 }
    )
  }
}
