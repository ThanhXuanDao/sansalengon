import { NextRequest, NextResponse } from "next/server"
import { checkAuth } from "@/lib/auth"
import {
  TEXT_PROVIDER_CATALOG,
  IMAGE_PROVIDER_CATALOG,
  getAllProviderConfig,
  getAllFeatureFlags,
  setProviderForTask,
  setFeatureEnabled,
  withAvailability,
  TASK_LABELS,
  FEATURE_META,
  DEFAULT_PROVIDERS,
  type AITask,
} from "@/lib/ai-config"

// GET — catalog + provider config + feature flags
export async function GET(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [config, featureFlags] = await Promise.all([
    getAllProviderConfig(),
    getAllFeatureFlags(),
  ])

  return NextResponse.json({
    textProviders: withAvailability(TEXT_PROVIDER_CATALOG),
    imageProviders: withAvailability(IMAGE_PROVIDER_CATALOG),
    config,
    featureFlags,
    taskLabels: TASK_LABELS,
    featureMeta: FEATURE_META,
    defaults: DEFAULT_PROVIDERS,
  })
}

// POST — set provider OR toggle feature flag
// body: { task, providerId }  OR  { action: "toggle_feature", feature, enabled }
export async function POST(request: NextRequest) {
  if (!(await checkAuth(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const allTasks: AITask[] = ["post_generation", "blog_writing", "seo_meta", "image_generation"]

  // Feature toggle
  if ((body as any).action === "toggle_feature") {
    const { feature, enabled } = body as { action: string; feature: AITask; enabled: boolean }
    if (!allTasks.includes(feature)) {
      return NextResponse.json({ error: "Unknown feature" }, { status: 400 })
    }
    await setFeatureEnabled(feature, Boolean(enabled))
    return NextResponse.json({ ok: true, feature, enabled: Boolean(enabled) })
  }

  // Provider selection
  const { task, providerId } = body as { task: AITask; providerId: string }
  if (!allTasks.includes(task)) {
    return NextResponse.json({ error: "Unknown task" }, { status: 400 })
  }

  const isText = task !== "image_generation"
  const validIds = isText
    ? TEXT_PROVIDER_CATALOG.map((p) => p.id)
    : IMAGE_PROVIDER_CATALOG.map((p) => p.id)

  if (!validIds.includes(providerId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 })
  }

  await setProviderForTask(task, providerId)
  return NextResponse.json({ ok: true, task, providerId })
}
