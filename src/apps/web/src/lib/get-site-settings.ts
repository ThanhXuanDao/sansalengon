import { cache } from "react"
import { prisma } from "@/lib/prisma"

const SETTINGS_KEY = "store_settings"

export interface SiteSettings {
  siteName: string
  siteUrl: string
  tagline: string
  timezone: string
  dateFormat: string
  decimalSeparator: string
  thousandSeparator: string
  currencySymbol: string
  currencyPosition: string
  logo: string
  favicon: string
  footerDesc: string
  hotline: string
  facebookUrl: string
  zaloUrl: string
  youtubeUrl: string
  ga4Id: string
  gtmId: string
  metaTitle: string
  metaDesc: string
  metaKeywords: string
  ogImage: string
  robotsDefault: string
  sitemapEnabled: boolean
  maintenanceMode: boolean
  debugMode: boolean
  showErrors: boolean
}

const defaults: SiteSettings = {
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
}

// cache() deduplicates calls within a single request — generateMetadata + layout
// both call getSiteSettings but only 1 DB query fires per page render.
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } })
    if (!row) return { ...defaults }
    return { ...defaults, ...JSON.parse(row.value) }
  } catch {
    return { ...defaults }
  }
})
