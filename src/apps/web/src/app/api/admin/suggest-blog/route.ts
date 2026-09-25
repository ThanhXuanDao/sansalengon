import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import { csrfGuard } from "@/lib/csrf"
import { suggestBlogFromTopic } from "@/lib/blog-generator"
import { adminLog } from "@/lib/logger"
import { isProviderAvailable } from "@/lib/ai-provider"

export const maxDuration = 120

/** Pick fastest available provider for suggest — bypass DB config which may have slow providers */
function pickSuggestProvider(): string {
  if (isProviderAvailable("groq"))        return "groq"    // fastest: <5s
  if (isProviderAvailable("gemini"))      return "gemini"  // fast: 3-5s, free
  if (isProviderAvailable("openai"))      return "openai"
  if (isProviderAvailable("deepseek"))    return "deepseek"
  if (isProviderAvailable("openrouter"))  return "openrouter"
  return "claude"
}

export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const csrf = await csrfGuard(request)
  if (csrf) return csrf

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { topic, niche, provider } = body as {
    topic: string
    niche: string
    provider?: string
  }

  if (!topic?.trim() || !niche?.trim()) {
    return NextResponse.json({ error: "topic and niche are required" }, { status: 400 })
  }

  // For suggest, always use fastest available provider — ignore explicit provider from client
  // to avoid slow providers (openrouter free tier) stored in localStorage/DB config
  const resolvedProvider = pickSuggestProvider()

  try {
    await adminLog.info(`Suggest blog: "${topic}" [${niche}] via ${resolvedProvider}`, "suggest-blog", { topic, niche, resolvedProvider }, "user")
    const result = await suggestBlogFromTopic(topic.trim(), niche.trim(), resolvedProvider)
    await adminLog.info(`Suggest blog done: "${result.title}"`, "suggest-blog", { niche }, "user")
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    await adminLog.error(`Suggest blog failed: ${(err as Error).message}`, "suggest-blog", { topic, niche, resolvedProvider, stack: (err as Error).stack }, "user")
    return NextResponse.json(
      { error: "Gợi ý thất bại", detail: (err as Error).message },
      { status: 500 },
    )
  }
}
