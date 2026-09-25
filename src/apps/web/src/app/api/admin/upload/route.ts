import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/avif": "avif",
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Chỉ chấp nhận ảnh JPG, PNG, WebP, GIF, AVIF" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Ảnh quá lớn — tối đa 5 MB" }, { status: 400 })
  }

  const ext = EXT_MAP[file.type] ?? "jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const uploadDir = path.join(process.cwd(), "public", "uploads", "blog")

  await mkdir(uploadDir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadDir, filename), buffer)

  return NextResponse.json({ url: `/uploads/blog/${filename}` })
}
