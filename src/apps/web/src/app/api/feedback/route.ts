import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { rateLimit } from "@/lib/rate-limit"
import { checkAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const { allowed } = rateLimit(`feedback:${ip}`, { max: 2, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 })
    }

    const { name, email, message } = await request.json()

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Semua field harus diisi" }, { status: 400 })
    }

    if (!email.includes("@")) {
      return NextResponse.json({ error: "Email tidak valid" }, { status: 400 })
    }

    if (name.trim().length < 2) {
      return NextResponse.json({ error: "Nama harus minimal 2 karakter" }, { status: 400 })
    }

    if (message.trim().length < 5) {
      return NextResponse.json({ error: "Pesan harus minimal 5 karakter" }, { status: 400 })
    }

    await prisma.feedback.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      },
    })

    console.info("[Feedback] New feedback from:", email)

    return NextResponse.json({
      success: true,
      message: "Saran/masukan berhasil dikirim. Terima kasih!",
    })
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 25))
  const skip = (page - 1) * limit

  try {
    const [data, total] = await Promise.all([
      prisma.feedback.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.feedback.count(),
    ])

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "ID feedback diperlukan" }, { status: 400 })
  }

  try {
    await prisma.feedback.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Feedback berhasil dihapus" })
  } catch {
    return NextResponse.json({ error: "Gagal menghapus feedback" }, { status: 500 })
  }
}
