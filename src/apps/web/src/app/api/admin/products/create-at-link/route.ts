import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"

const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "")
const SECRET = process.env.API_INTERNAL_SECRET ?? ""

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  const body = await request.json()

  try {
    const res = await fetch(`${API_URL}/sync/create-at-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Không kết nối được API"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
