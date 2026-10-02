import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

const SETTINGS_KEY = "source_settings"

interface SourceSettings {
  lazadaMode: "affiliate" | "at"
}

const defaultSourceSettings: SourceSettings = {
  lazadaMode: "affiliate",
}

async function readSettings(): Promise<SourceSettings> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (!row) return { ...defaultSourceSettings }
    return { ...defaultSourceSettings, ...JSON.parse(row.value) }
  } catch {
    return { ...defaultSourceSettings }
  }
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json(await readSettings())
}

export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: Partial<SourceSettings>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const current = await readSettings()
  const merged: SourceSettings = {
    lazadaMode: body.lazadaMode !== undefined ? (body.lazadaMode === "at" ? "at" : "affiliate") : current.lazadaMode,
  }

  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
  })

  return NextResponse.json(merged)
}
