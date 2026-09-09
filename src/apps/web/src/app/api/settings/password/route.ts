import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { validateCredentials, hashPassword } from "@/lib/auth-password"
import { csrfGuard } from "@/lib/csrf"

export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      )
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password must be at most 128 characters" },
        { status: 400 }
      )
    }

    const adminEmail = process.env.ADMIN_EMAIL
    if (!adminEmail) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const valid = await validateCredentials(adminEmail, currentPassword)
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 }
      )
    }

    const hash = await hashPassword(newPassword)
    await prisma.appSetting.upsert({
      where: { key: "admin_password_hash" },
      update: { value: hash },
      create: { key: "admin_password_hash", value: hash },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to update password" },
      { status: 500 }
    )
  }
}
