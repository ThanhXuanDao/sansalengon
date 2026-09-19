import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })
  return NextResponse.json({ data: categories })
}
