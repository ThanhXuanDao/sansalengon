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
}

const STRING_FIELDS = new Set([
  "siteName", "siteUrl", "tagline", "timezone", "dateFormat",
  "decimalSeparator", "thousandSeparator", "currencySymbol", "currencyPosition",
  "footerDesc", "hotline", "facebookUrl", "zaloUrl", "youtubeUrl",
  "ga4Id", "gtmId", "metaTitle", "metaDesc", "metaKeywords",
  "ogImage", "robotsDefault",
])

const BOOL_FIELDS = new Set([
  "sitemapEnabled", "maintenanceMode", "debugMode", "showErrors",
])

const LARGE_STRING_FIELDS = new Set(["logo", "favicon"])

const ALLOWED_KEYS = new Set([...STRING_FIELDS, ...BOOL_FIELDS, ...LARGE_STRING_FIELDS])

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
      ;(cleaned as Record<string, unknown>)[key] = value
    } else if (BOOL_FIELDS.has(key)) {
      if (typeof value !== "boolean") { errors.push(`"${key}" must be a boolean`); continue }
      ;(cleaned as Record<string, unknown>)[key] = value
    } else if (LARGE_STRING_FIELDS.has(key)) {
      if (typeof value !== "string") { errors.push(`"${key}" must be a string`); continue }
      if (value.length > 1_500_000) { errors.push(`"${key}" is too large (max 1MB)`); continue }
      ;(cleaned as Record<string, unknown>)[key] = value
    }
  }

  return { cleaned, errors }
}
