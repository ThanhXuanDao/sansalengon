export interface ValidatedSettings {
  siteName?: string
  siteUrl?: string
  tagline?: string
  timezone?: string
  dateFormat?: string
  decimalSeparator?: string
  thousandSeparator?: string
  currencySymbol?: string
  currencyPosition?: string
  logo?: string
  favicon?: string
  footerDesc?: string
  hotline?: string
  facebookUrl?: string
  zaloUrl?: string
  youtubeUrl?: string
  ga4Id?: string
  gtmId?: string
  metaTitle?: string
  metaDesc?: string
  metaKeywords?: string
  ogImage?: string
  robotsDefault?: string
  sitemapEnabled?: boolean
  maintenanceMode?: boolean
  debugMode?: boolean
  showErrors?: boolean
  twoFA?: boolean
  cacheEnabled?: boolean
  footerCategoryLimit?: number
  trendingCount?: number
}

const STRING_FIELDS = new Set([
  "siteName", "siteUrl", "tagline", "timezone", "dateFormat",
  "decimalSeparator", "thousandSeparator", "currencySymbol", "currencyPosition",
  "footerDesc", "hotline", "facebookUrl", "zaloUrl", "youtubeUrl",
  "ga4Id", "gtmId", "metaTitle", "metaDesc", "metaKeywords",
  "ogImage", "robotsDefault",
])

const BOOL_FIELDS = new Set([
  "sitemapEnabled", "maintenanceMode", "debugMode", "showErrors", "twoFA", "cacheEnabled",
])

const NUMBER_FIELDS = new Set(["footerCategoryLimit", "trendingCount"])

const LARGE_STRING_FIELDS = new Set(["logo", "favicon"])

const ALLOWED_KEYS = new Set([...STRING_FIELDS, ...BOOL_FIELDS, ...LARGE_STRING_FIELDS, ...NUMBER_FIELDS])

export function validateSettings(body: Record<string, unknown>): {
  cleaned: ValidatedSettings
  errors: string[]
} {
  const errors: string[] = []
  const cleaned: ValidatedSettings = {}

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      errors.push(`Unknown key: "${key}"`)
      continue
    }

    if (STRING_FIELDS.has(key)) {
      if (typeof value !== "string") { errors.push(`"${key}" must be a string`); continue }
      if (value.length > 1000) { errors.push(`"${key}" is too long (max 1000)`); continue }
      if (key === "gtmId" && value && !/^GTM-[A-Z0-9]{4,10}$/.test(value)) {
        errors.push('"gtmId" phải có định dạng GTM-XXXXXXX')
        continue
      }
      if (key === "ga4Id" && value && !/^G-[A-Z0-9]{4,12}$/.test(value)) {
        errors.push('"ga4Id" phải có định dạng G-XXXXXXXXXX')
        continue
      }
      ;(cleaned as Record<string, unknown>)[key] = value
    } else if (BOOL_FIELDS.has(key)) {
      if (typeof value !== "boolean") { errors.push(`"${key}" must be a boolean`); continue }
      ;(cleaned as Record<string, unknown>)[key] = value
    } else if (LARGE_STRING_FIELDS.has(key)) {
      if (typeof value !== "string") { errors.push(`"${key}" must be a string`); continue }
      if (value.length > 1_500_000) { errors.push(`"${key}" is too large (max 1MB)`); continue }
      ;(cleaned as Record<string, unknown>)[key] = value
    } else if (NUMBER_FIELDS.has(key)) {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 0) { errors.push(`"${key}" phải là số nguyên không âm`); continue }
      ;(cleaned as Record<string, unknown>)[key] = n
    }
  }

  return { cleaned, errors }
}
