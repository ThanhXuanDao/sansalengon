import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

const SETTINGS_KEY = "sync_config"

interface TikiSyncConfig {
  tikiBatchSize: number
  tikiBatchPauseMin: number
  tikiInterNicheDelaySec: number
}

const defaultSyncConfig: TikiSyncConfig = {
  tikiBatchSize: 3,
  tikiBatchPauseMin: 10,
  tikiInterNicheDelaySec: 10,
}

async function readSyncConfig(): Promise<TikiSyncConfig> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (!row) return { ...defaultSyncConfig }
    return { ...defaultSyncConfig, ...JSON.parse(row.value) }
  } catch {
    return { ...defaultSyncConfig }
  }
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const config = await readSyncConfig()
  return NextResponse.json(config)
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrfError = await csrfGuard(request)
  if (csrfError) return csrfError

  let body: Partial<TikiSyncConfig>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const errors: string[] = []
  if (body.tikiBatchSize !== undefined) {
    const v = Number(body.tikiBatchSize)
    if (!Number.isInteger(v) || v < 1 || v > 12) errors.push("tikiBatchSize phải từ 1 đến 12")
  }
  if (body.tikiBatchPauseMin !== undefined) {
    const v = Number(body.tikiBatchPauseMin)
    if (!Number.isFinite(v) || v < 1 || v > 60) errors.push("tikiBatchPauseMin phải từ 1 đến 60 phút")
  }
  if (body.tikiInterNicheDelaySec !== undefined) {
    const v = Number(body.tikiInterNicheDelaySec)
    if (!Number.isFinite(v) || v < 0 || v > 120) errors.push("tikiInterNicheDelaySec phải từ 0 đến 120 giây")
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 400 })
  }

  const current = await readSyncConfig()
  const merged: TikiSyncConfig = {
    tikiBatchSize: Number(body.tikiBatchSize ?? current.tikiBatchSize),
    tikiBatchPauseMin: Number(body.tikiBatchPauseMin ?? current.tikiBatchPauseMin),
    tikiInterNicheDelaySec: Number(body.tikiInterNicheDelaySec ?? current.tikiInterNicheDelaySec),
  }

  await prisma.appSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
  })

  return NextResponse.json(merged)
}
