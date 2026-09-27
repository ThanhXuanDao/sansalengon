import { NextRequest, NextResponse } from "next/server"
import { parse } from "node-html-parser"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { getProviderForTask } from "@/lib/ai-config"
import { createTextProvider } from "@/lib/ai-provider"

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: { title?: string; instructions?: string; provider?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { title, instructions, provider: providerId } = body
  if (!title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  let provider
  try {
    provider = providerId
      ? createTextProvider(providerId, "quality")
      : await getProviderForTask("blog_writing")
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const prompt = `Bạn là chuyên gia viết nội dung web tiếng Việt cho website thương mại điện tử SanSaleNgon.

Viết nội dung HTML cho trang: "${title}"
${instructions ? `\nYêu cầu thêm:\n${instructions}` : ""}

YÊU CẦU BẮT BUỘC:
- Ngôn ngữ: Tiếng Việt, chuyên nghiệp và thân thiện
- Độ dài: 400–800 từ
- Cấu trúc: chia thành các section rõ ràng với heading h2, h3
- Viết ở góc nhìn thứ ba số nhiều ("chúng tôi", "SanSaleNgon")

OUTPUT FORMAT:
- Chỉ trả về HTML thuần, không wrap trong code block, không có <!DOCTYPE>, không có <html>/<body>
- Dùng thẻ: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>

BẮT ĐẦU NGAY BẰNG THẺ HTML ĐẦU TIÊN. KHÔNG viết gì trước thẻ HTML. KHÔNG giải thích:`

  try {
    const raw = await provider.generateText(prompt, {
      maxTokens: 2000,
      temperature: 0.7,
    })

    const content = extractHtml(raw)

    return NextResponse.json({ content })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

/** Extract meta description: prefer <!-- META: ... --> comment, fallback to first 155 chars of all <p> text. */
function extractMetaComment(raw: string, htmlContent: string): string {
  const commentMatch = raw.match(/<!--\s*META:\s*([\s\S]+?)\s*-->/)
  if (commentMatch?.[1]?.trim()) return commentMatch[1].trim()

  // Fallback: concatenate all <p> text nodes
  const root = parse(htmlContent)
  const text = root.querySelectorAll("p")
    .map((p) => p.innerText.replace(/\s+/g, " ").trim())
    .join(" ")
    .trim()
  return text.length > 155 ? text.slice(0, 152) + "..." : text
}

/**
 * Use node-html-parser to keep only HTMLElement nodes at root level,
 * discarding bare text nodes (model reasoning/thinking not wrapped in any tag).
 */
function extractHtml(raw: string): string {
  // Strip code fences first
  const s = raw.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
  const root = parse(s)
  // childNodes includes both TextNode and HTMLElement — keep only HTMLElement (nodeType 1)
  return root.childNodes
    .filter((n) => n.nodeType === 1)
    .map((n) => n.toString())
    .join("\n")
    .trim()
}
