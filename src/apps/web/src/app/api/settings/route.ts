import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { validateSettings } from "@/lib/validate-settings"

const SETTINGS_KEY = "store_settings"

const defaultSettings = {
  siteName: "Săn Sale Ngon",
  siteUrl: "https://sansalengon.vn",
  tagline: "Tuyển chọn sản phẩm Shopee affiliate — giá tốt, minh bạch, cập nhật tự động.",
  timezone: "Asia/Ho_Chi_Minh",
  dateFormat: "DD/MM/YYYY",
  decimalSeparator: ",",
  thousandSeparator: ".",
  currencySymbol: "₫",
  currencyPosition: "after",
  logo: "",
  favicon: "",
  footerDesc: "",
  hotline: "",
  facebookUrl: "",
  zaloUrl: "",
  youtubeUrl: "",
  ga4Id: "",
  gtmId: "",
  metaTitle: "",
  metaDesc: "",
  metaKeywords: "",
  ogImage: "",
  robotsDefault: "index,follow",
  sitemapEnabled: true,
  maintenanceMode: false,
  debugMode: false,
  showErrors: false,
  twoFA: false,
  footerCategoryLimit: 0,
  trendingCount: 20,
}

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (!row) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(row.value) }
  } catch {
    return { ...defaultSettings }
  }
}

const PUBLIC_FIELDS = [
  "siteName", "siteUrl", "tagline", "logo", "favicon",
  "footerDesc", "hotline", "facebookUrl", "zaloUrl", "youtubeUrl",
  "currencySymbol", "currencyPosition", "decimalSeparator", "thousandSeparator",
  "footerCategoryLimit",
] as const

export async function GET(request: NextRequest) {
  const settings = await readSettings()
  const isAdmin = await checkAuth(request)
  if (!isAdmin) {
    const pub = Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, settings[k]]))
    return NextResponse.json(pub)
  }
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  try {
    const body = await request.json()
    const { cleaned, errors } = validateSettings(body)

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const current = await readSettings()
    const merged = { ...current, ...cleaned }
    await prisma.appSetting.upsert({
      where: { key: SETTINGS_KEY },
      update: { value: JSON.stringify(merged) },
      create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
    })
    return NextResponse.json({ success: true, settings: merged })
  } catch {
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    )
  }
}
