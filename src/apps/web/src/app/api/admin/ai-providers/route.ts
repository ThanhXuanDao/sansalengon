import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { TEXT_PROVIDER_CATALOG, withAvailability } from "@/lib/ai-config"

// Returns TEXT_PROVIDER_CATALOG with runtime `available` flag (checks env vars server-side)
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ providers: withAvailability(TEXT_PROVIDER_CATALOG) })
}
