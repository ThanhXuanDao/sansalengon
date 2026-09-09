export interface ValidatedSettings {
  storeName?: string
  storeUrl?: string
  bio?: string
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  minPayout?: number
  primaryColor?: string
  autoPayout?: boolean
  twoFA?: boolean
  logo?: string
}

const ALLOWED_KEYS = new Set([
  "storeName", "storeUrl", "bio",
  "bankName", "accountNumber", "accountHolder",
  "minPayout", "primaryColor", "autoPayout", "twoFA", "logo",
])

const VALID_COLORS = new Set(["red", "black", "yellow"])

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

    switch (key) {
      case "storeName":
      case "storeUrl":
      case "bio":
      case "bankName":
      case "accountHolder":
        if (typeof value !== "string") errors.push(`"${key}" must be a string`)
        else if (value.length > 500) errors.push(`"${key}" is too long (max 500)`)
        else cleaned[key] = value
        break

      case "accountNumber":
        if (typeof value !== "string") errors.push(`"${key}" must be a string`)
        else if (value.length > 100) errors.push(`"${key}" is too long (max 100)`)
        else cleaned[key] = value
        break

      case "minPayout":
        if (typeof value !== "number" || value < 0) errors.push(`"${key}" must be a non-negative number`)
        else cleaned[key] = value
        break

      case "primaryColor":
        if (!VALID_COLORS.has(value as string)) errors.push(`"${key}" must be one of: ${[...VALID_COLORS].join(", ")}`)
        else cleaned[key] = value as string
        break

      case "autoPayout":
      case "twoFA":
        if (typeof value !== "boolean") errors.push(`"${key}" must be a boolean`)
        else cleaned[key] = value
        break

      case "logo":
        if (typeof value !== "string") errors.push(`"${key}" must be a string`)
        else if (value.length > 500_000) errors.push(`"${key}" is too large (max 500KB)`)
        else cleaned[key] = value
        break
    }
  }

  return { cleaned, errors }
}
