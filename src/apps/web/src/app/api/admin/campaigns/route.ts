import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const res = await fetch(`${API_URL}/sync/campaigns`, {
      headers: {
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không kết nối được API"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
