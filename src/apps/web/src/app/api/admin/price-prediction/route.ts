import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { analyzePricePrediction, getTopPredictions } from "@/lib/price-prediction"

// GET /api/admin/price-prediction           → top predictions (all products)
// GET /api/admin/price-prediction?id=xxx    → single product prediction
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("id")

  if (productId) {
    const prediction = await analyzePricePrediction(productId)
    return NextResponse.json({ prediction })
  }

  const predictions = await getTopPredictions(50)
  return NextResponse.json({ predictions, total: predictions.length })
}
