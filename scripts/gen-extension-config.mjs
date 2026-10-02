/**
 * Tạo src/apps/extension/config.js từ src/.env.local
 *
 * Chạy: node scripts/gen-extension-config.mjs
 *
 * Đọc 2 biến từ src/.env.local:
 *   API_URL              → apiUrl  (mặc định http://localhost:4000)
 *   API_INTERNAL_SECRET  → apiKey
 *
 * Output: src/apps/extension/config.js (gitignored)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENV_FILE = resolve(ROOT, 'src', '.env.local')
const OUT_FILE = resolve(ROOT, 'src', 'apps', 'extension', 'config.js')

if (!existsSync(ENV_FILE)) {
  console.error(`[gen-ext-config] Không tìm thấy ${ENV_FILE}`)
  console.error(`  Copy src/.env.example → src/.env.local và điền API_URL + API_INTERNAL_SECRET`)
  process.exit(1)
}

const env = {}
for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  const key = trimmed.slice(0, eq).trim()
  const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  env[key] = val
}

const apiUrl = (env.API_URL || 'http://localhost:4000').replace(/\/$/, '')
const apiKey = env.API_INTERNAL_SECRET || ''

if (!apiKey) {
  console.warn('[gen-ext-config] CẢNH BÁO: API_INTERNAL_SECRET chưa được set trong .env.local')
  console.warn('  Extension sẽ gửi request không có auth — chỉ dùng trong dev khi server không yêu cầu auth')
}

const content = `// AUTO-GENERATED — đừng sửa tay, chạy: node scripts/gen-extension-config.mjs
// Source: src/.env.local (gitignored)
self.AFFILIATE_CONFIG = ${JSON.stringify({ apiUrl, apiKey }, null, 2)};
`

writeFileSync(OUT_FILE, content, 'utf8')
console.log(`[gen-ext-config] ✓ Đã tạo ${OUT_FILE}`)
console.log(`  apiUrl = ${apiUrl}`)
console.log(`  apiKey = ${apiKey ? '***' + apiKey.slice(-4) : '(empty)'}`)
