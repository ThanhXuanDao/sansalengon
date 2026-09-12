// Simple cron next-run calculator for the subset of expressions used in this project.
// Supports: "M H * * *", "M H,H * * *", "M H * * DOW", "M star/N * * *"

export interface CronPreset {
  label: string
  cron: string
  description: string
}

export const CRON_PRESETS: CronPreset[] = [
  { label: "Không tự động",    cron: "",              description: "Chỉ chạy thủ công" },
  { label: "Mỗi giờ",          cron: "0 * * * *",     description: "Vào đầu mỗi giờ" },
  { label: "Mỗi 4 giờ",        cron: "0 */4 * * *",   description: "0h, 4h, 8h, 12h, 16h, 20h" },
  { label: "Mỗi 6 giờ",        cron: "0 */6 * * *",   description: "0h, 6h, 12h, 18h" },
  { label: "Mỗi 12 giờ",       cron: "0 0,12 * * *",  description: "0h & 12h" },
  { label: "Hằng ngày 00:00",   cron: "0 0 * * *",     description: "Mỗi ngày nửa đêm" },
  { label: "Hằng ngày 02:00",   cron: "0 2 * * *",     description: "Mỗi ngày lúc 2h sáng" },
  { label: "Hằng ngày 08:00",   cron: "0 8 * * *",     description: "Mỗi ngày lúc 8h sáng" },
  { label: "Hằng ngày 12:00",   cron: "0 12 * * *",    description: "Mỗi ngày lúc 12h trưa" },
  { label: "Hằng ngày 20:00",   cron: "0 20 * * *",    description: "Mỗi ngày lúc 8h tối" },
  { label: "2 lần/ngày 12 & 20", cron: "0 12,20 * * *", description: "12h trưa & 20h tối" },
  { label: "Thứ 2 & Thứ 5 08h", cron: "0 8 * * 1,4",  description: "Hai lần mỗi tuần" },
  { label: "Chủ nhật 03:00",    cron: "0 3 * * 0",     description: "Mỗi tuần 1 lần, Chủ nhật 3h" },
  { label: "Thứ 2 08:00",       cron: "0 8 * * 1",     description: "Mỗi tuần 1 lần, Thứ 2 8h" },
]

export function findPreset(cron: string): CronPreset | undefined {
  return CRON_PRESETS.find((p) => p.cron === cron)
}

/**
 * Calculate the next Date that a cron expression fires after `from` (default: now).
 * Returns null if the expression is empty/invalid for our subset.
 */
export function getNextRunDate(cron: string, from: Date = new Date()): Date | null {
  if (!cron) return null

  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null

  const [minPart, hourPart, , , dowPart] = parts

  const minutes = parseField(minPart, 0, 59)
  const hours = parseField(hourPart, 0, 23)
  const dows = parseField(dowPart, 0, 6)  // 0=Sun, 6=Sat

  if (!minutes || !hours) return null

  // Start from the next minute
  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setMinutes(candidate.getMinutes() + 1)

  // Search within 8 days (covers weekly + margin)
  const limit = new Date(candidate.getTime() + 8 * 24 * 60 * 60 * 1000)

  while (candidate < limit) {
    const dow = candidate.getDay()
    if (dows && !dows.includes(dow)) {
      // Advance to start of next day
      candidate.setHours(0, 0, 0, 0)
      candidate.setDate(candidate.getDate() + 1)
      continue
    }

    const hour = candidate.getHours()
    const nextHour = hours.find((h) => h > hour) ?? hours.find((h) => h === hour)

    if (nextHour === undefined || nextHour < hour) {
      // No valid hour today, advance to next valid day
      candidate.setHours(0, 0, 0, 0)
      candidate.setDate(candidate.getDate() + 1)
      continue
    }

    if (nextHour > hour) {
      candidate.setHours(nextHour, minutes[0], 0, 0)
      return candidate
    }

    // Same hour — find next valid minute
    const minute = candidate.getMinutes()
    const nextMin = minutes.find((m) => m >= minute)
    if (nextMin === undefined) {
      // No valid minute this hour, advance to next hour
      candidate.setMinutes(0, 0, 0)
      candidate.setHours(candidate.getHours() + 1)
      continue
    }

    candidate.setMinutes(nextMin, 0, 0)
    return candidate
  }

  return null
}

function parseField(field: string, min: number, max: number): number[] | null {
  if (field === "*") {
    return Array.from({ length: max - min + 1 }, (_, i) => i + min)
  }
  // */N
  const stepMatch = field.match(/^\*\/(\d+)$/)
  if (stepMatch) {
    const step = parseInt(stepMatch[1])
    const result: number[] = []
    for (let i = min; i <= max; i += step) result.push(i)
    return result
  }
  // Comma-separated values: "1,4" or "0,12"
  if (field.includes(",")) {
    return field.split(",").map(Number).filter((n) => n >= min && n <= max)
  }
  // Single value
  const n = parseInt(field)
  if (!isNaN(n) && n >= min && n <= max) return [n]
  return null
}

export function formatNextRun(date: Date | null): string {
  if (!date) return "—"
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  const mins = Math.round(diff / 60_000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)

  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
  const dateStr = date.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })

  if (mins <= 1)  return "chưa đầy 1 phút nữa"
  if (mins < 60)  return `${mins} phút nữa (${time})`
  if (hrs  < 24)  return `${hrs} giờ nữa (${time})`
  if (days === 1) return `ngày mai lúc ${time}`
  return `${dateStr} lúc ${time}`
}
