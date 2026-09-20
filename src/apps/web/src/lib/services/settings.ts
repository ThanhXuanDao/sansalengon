export interface StoreSettings {
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
  footerCategoryLimit: number
  trendingCount: number
}

const defaults: StoreSettings = {
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
  footerCategoryLimit: 0,
  trendingCount: 20,
}

export async function fetchSettings(): Promise<StoreSettings> {
  try {
    const token = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)sansale_csrf=([^;]*)/)?.[1] || "" : ""
    const res = await fetch("/api/settings", {
      headers: { "x-csrf-token": token },
    })
    if (!res.ok) throw new Error("Failed to fetch settings")
    const data = await res.json()
    return { ...defaults, ...data }
  } catch {
    return { ...defaults }
  }
}
