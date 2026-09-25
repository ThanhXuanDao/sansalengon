import { writeFileSync, readFileSync, mkdirSync } from "fs"
import { join } from "path"
import { getProviderForTask, getProviderIdForTask, isFeatureEnabled } from "./ai-config"
import { createTextProvider } from "./ai-provider"
import { generateImage, buildBlogCoverPrompt } from "./image-generator"
import { toSlug } from "./slug"
export { toSlug } from "./slug"

export interface BlogGenerateInput {
  niche: string
  title: string
  description: string
  keywords: string[]
  tags: string[]
  /** Top products to reference in the article */
  products: Array<{ name: string; price: number; discountPct: number | null; rating: number | null }>
}

export interface BlogGenerateResult {
  slug: string
  filePath: string
  htmlContent: string   // pure HTML for DB storage
  meta: {
    slug: string
    niche: string
    title: string
    description: string
    date: string
    readTime: number
    tags: string[]
    author: string
    coverImage?: string
  }
}

/** Estimate read time from word count (200 words/min) */
function estimateReadTime(tsx: string): number {
  const words = tsx.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length
  return Math.max(3, Math.round(words / 200))
}

/** Generate blog post TSX content using the configured AI provider */
export async function generateBlogPost(
  input: BlogGenerateInput,
  providerOverride?: string,
): Promise<BlogGenerateResult> {
  const productList = input.products
    .slice(0, 5)
    .map((p, i) => {
      const salePrice = p.discountPct ? Math.round(p.price * (1 - p.discountPct / 100)) : p.price
      const priceStr = p.discountPct
        ? `${fmtVND(salePrice)} (giảm ${p.discountPct}%)`
        : fmtVND(salePrice)
      return `${i + 1}. ${p.name} — ${priceStr}${p.rating ? `, ⭐${p.rating.toFixed(1)}` : ""}`
    })
    .join("\n")

  const prompt = `Bạn là chuyên gia viết nội dung affiliate marketing tiếng Việt cho website mua sắm thông minh.

Viết một bài blog dài, chi tiết, hữu ích với tiêu đề: "${input.title}"
Ngách: ${input.niche}
Từ khoá SEO cần có: ${input.keywords.join(", ")}

Sản phẩm thực tế đang bán để tham khảo:
${productList || "(không có dữ liệu sản phẩm)"}

Yêu cầu định dạng — chỉ trả về phần bên trong JSX, KHÔNG có import, KHÔNG có "export default":
- Bắt đầu bằng thẻ <> và kết thúc bằng </>
- Dùng h2 cho từng phần lớn (4-6 phần)
- Dùng p, ul, ol, li, strong, em cho nội dung
- Có ít nhất 1 table với so sánh thực tế
- Đề cập tự nhiên đến các sản phẩm trong danh sách với giá cụ thể
- Kết thúc bằng đoạn "Kết luận" ngắn gọn
- Viết khoảng 700-900 từ, tự nhiên như người thực viết
- KHÔNG có markdown, KHÔNG có \`\`\`, chỉ JSX thuần

Bắt đầu ngay với <>:`

  const [textProvider, imageProviderId] = await Promise.all([
    providerOverride
      ? Promise.resolve(createTextProvider(providerOverride, "quality"))
      : getProviderForTask("blog_writing"),
    getProviderIdForTask("image_generation"),
  ])

  const rawText = await textProvider.generateText(prompt, { maxTokens: 3000 })
  let rawJsx = rawText.trim()

  // Claude sometimes wraps in ```jsx ... ``` — strip it
  rawJsx = rawJsx.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim()

  // Ensure it starts with <> and ends with </>
  if (!rawJsx.startsWith("<>")) rawJsx = `<>\n${rawJsx}`
  if (!rawJsx.endsWith("</>")) rawJsx = `${rawJsx}\n</>`

  const tsx = `export default function PostContent() {\n  return (\n    ${rawJsx.split("\n").join("\n    ")}\n  )\n}\n`

  // Extract pure HTML for DB (strip <> </> wrappers, convert JSX attrs)
  const htmlContent = rawJsx
    .replace(/^<>\n?/, "")
    .replace(/\n?<\/>$/, "")
    .replace(/className=/g, "class=")
    .trim()

  const slug = toSlug(input.title)
  const date = new Date().toISOString().slice(0, 10)
  const readTime = estimateReadTime(tsx)

  // Write TSX file
  const contentDir = join(process.cwd(), "src", "content", "blog", input.niche)
  mkdirSync(contentDir, { recursive: true })
  const filePath = join(contentDir, `${slug}.tsx`)
  writeFileSync(filePath, tsx, "utf-8")

  // Generate cover image only if image_generation feature is enabled
  let coverImage: string | undefined
  const imgEnabled = await isFeatureEnabled("image_generation")
  if (imgEnabled) {
    try {
      const imagePrompt = buildBlogCoverPrompt(input.niche, input.title, input.tags)
      const img = await generateImage({ prompt: imagePrompt }, imageProviderId)
      coverImage = img.url
    } catch {
      // cover image is optional — don't fail the post
    }
  }

  const meta = {
    slug,
    niche: input.niche,
    title: input.title,
    description: input.description,
    date,
    readTime,
    tags: input.tags,
    author: "SanSaleNgon AI",
    ...(coverImage ? { coverImage } : {}),
  }

  // Register in generated-posts.ts (backward compat)
  registerGeneratedPost(meta, input.niche, slug)

  return { slug, filePath, htmlContent, meta }
}

/** Append new post to generated-posts.ts by rewriting the entire file */
function registerGeneratedPost(
  meta: BlogGenerateResult["meta"],
  niche: string,
  slug: string,
): void {
  const registryPath = join(process.cwd(), "src", "content", "blog", "generated-posts.ts")

  let existing: BlogGenerateResult["meta"][] = []
  let existingLoaders: Array<{ key: string; niche: string; slug: string }> = []

  try {
    const raw = readFileSync(registryPath, "utf-8")

    // Extract GENERATED_POSTS array entries via simple regex
    const postsMatch = raw.match(/export const GENERATED_POSTS[^=]+=\s*\[([\s\S]*?)\]/)
    if (postsMatch && postsMatch[1].trim()) {
      // Best-effort: eval not used; we reconstruct from regex parsing
      const entries = postsMatch[1].match(/\{[\s\S]*?\}/g) ?? []
      existing = entries.map((e) => {
        const get = (key: string) => {
          const m = e.match(new RegExp(`${key}:\\s*"([^"]*)"`, ""))
          return m?.[1] ?? ""
        }
        const getNum = (key: string) => {
          const m = e.match(new RegExp(`${key}:\\s*(\\d+)`, ""))
          return m ? Number(m[1]) : 0
        }
        const tagsM = e.match(/tags:\s*\[([^\]]*)\]/)
        const tags = tagsM ? tagsM[1].match(/"([^"]*)"/g)?.map((s) => s.replace(/"/g, "")) ?? [] : []
        return { slug: get("slug"), niche: get("niche"), title: get("title"), description: get("description"), date: get("date"), readTime: getNum("readTime"), tags, author: get("author") }
      }).filter((e) => e.slug)
    }

    // Extract loader keys
    const loaderMatch = raw.match(/export const GENERATED_LOADERS[^=]+=\s*\{([\s\S]*?)\}/)
    if (loaderMatch && loaderMatch[1].trim()) {
      const entries = loaderMatch[1].match(/"([^/]+)\/([^"]+)":/g) ?? []
      existingLoaders = entries.map((e) => {
        const m = e.match(/"([^/]+)\/([^"]+)":/)!
        return { key: `${m[1]}/${m[2]}`, niche: m[1], slug: m[2] }
      })
    }
  } catch {
    // File not found or parse error — start fresh
  }

  // Remove duplicate if regenerating same slug
  existing = existing.filter((e) => !(e.niche === niche && e.slug === slug))
  existingLoaders = existingLoaders.filter((l) => l.key !== `${niche}/${slug}`)

  existing.push(meta)
  existingLoaders.push({ key: `${niche}/${slug}`, niche, slug })

  const postsLines = existing.map((p) => {
    const tags = p.tags.map((t) => `"${t}"`).join(", ")
    return `  {\n    slug: "${p.slug}",\n    niche: "${p.niche}",\n    title: "${p.title.replace(/"/g, '\\"')}",\n    description: "${p.description.replace(/"/g, '\\"')}",\n    date: "${p.date}",\n    readTime: ${p.readTime},\n    tags: [${tags}],\n    author: "${p.author}",\n  }`
  }).join(",\n")

  const loadersLines = existingLoaders.map((l) =>
    `  "${l.key}": () => import("./${l.niche}/${l.slug}"),`
  ).join("\n")

  const output = `// AUTO-GENERATED — do not edit manually. Managed by /api/admin/generate-blog
import type React from "react"

export interface GeneratedPostMeta {
  slug: string
  niche: string
  title: string
  description: string
  date: string
  readTime: number
  tags: string[]
  coverImage?: string
  author?: string
}

export const GENERATED_POSTS: GeneratedPostMeta[] = [
${postsLines}
]

export const GENERATED_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
${loadersLines}
}
`

  writeFileSync(registryPath, output, "utf-8")
}

export interface BlogSuggestResult {
  title: string
  description: string
  keywords: string[]
  tags: string[]
  htmlContent: string
}

/** Generate all blog metadata + content from a short topic string */
export async function suggestBlogFromTopic(
  topic: string,
  niche: string,
  providerOverride?: string,
): Promise<BlogSuggestResult> {
  const textProvider = providerOverride
    ? createTextProvider(providerOverride, "quality")
    : await getProviderForTask("blog_writing")

  const nicheHint: Record<string, string> = {
    electronics: "kỹ thuật số — review tập trung vào specs thực tế, hiệu năng chip, camera, pin, so sánh với đối thủ và giá bán",
    fashion: "thời trang — tập trung vào chất liệu, xu hướng, cách phối đồ, thương hiệu uy tín",
    beauty: "làm đẹp/skincare — tập trung vào thành phần hoạt chất, công dụng thực tế, phù hợp loại da",
    home: "gia dụng/nội thất — tập trung vào chất liệu, tính năng, độ bền, so sánh giá thương hiệu",
    sports: "thể thao/gym — tập trung vào hiệu suất, chất liệu thoáng khí, phù hợp bộ môn cụ thể",
    gaming: "gaming/PC — tập trung vào FPS, độ trễ, cấu hình tương thích, giá/hiệu năng",
    health: "sức khoẻ — tập trung vào thành phần, liều dùng khuyến nghị, bằng chứng khoa học",
    food: "thực phẩm — tập trung vào nguyên liệu, hương vị, giá trị dinh dưỡng, nơi mua",
  }
  const nicheContext = nicheHint[niche] ?? niche

  const prompt = `Bạn là chuyên gia viết blog affiliate marketing tiếng Việt.
Chủ đề: "${topic}"
Lĩnh vực: ${nicheContext}

Viết bài blog đánh giá/hướng dẫn THỰC CHẤT — tránh sáo rỗng, cần có:
- Thông số/số liệu cụ thể (specs, giá, thông số kỹ thuật)
- Ưu điểm và nhược điểm thật sự (không chỉ khen)
- Lời khuyên mua hàng có căn cứ

Trả về MỘT object JSON (không markdown, không \`\`\`json):
{
  "title": "tiêu đề SEO 55-65 ký tự, có từ khoá chính, hấp dẫn",
  "description": "mô tả SEO 140-155 ký tự, nêu rõ giá trị bài viết",
  "keywords": ["từ khoá chính", "từ khoá 2", "từ khoá 3", "từ khoá 4", "từ khoá 5"],
  "tags": ["tag1", "tag2", "tag3"],
  "htmlContent": "Nội dung HTML đầy đủ: 4-5 thẻ h2 với nội dung chi tiết (dùng p, ul/li, strong cho thông số quan trọng), 1 bảng so sánh thực tế (table > thead > tr > th + tbody > tr > td, ít nhất 3 cột và 3-4 hàng dữ liệu), đoạn kết luận với lời khuyên có/không nên mua. Tổng cộng 700-900 từ, viết tự nhiên như người dùng thật. KHÔNG có html/body/head."
}

Bắt đầu với {:`

  const raw = await textProvider.generateText(prompt, { maxTokens: 3500 })
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim()

  let parsed: BlogSuggestResult
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Try to extract JSON from the response if there's surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("AI không trả về JSON hợp lệ. Hãy thử lại.")
    parsed = JSON.parse(jsonMatch[0])
  }

  // Validate required fields
  if (!parsed.title || !parsed.htmlContent) {
    throw new Error("AI trả về thiếu dữ liệu (title hoặc htmlContent). Hãy thử lại.")
  }

  return {
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    htmlContent: parsed.htmlContent ?? "",
  }
}

function fmtVND(n: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n)
}
