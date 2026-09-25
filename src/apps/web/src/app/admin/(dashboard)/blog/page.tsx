"use client"

import { useState, useCallback, useEffect, useRef, useId } from "react"
import dynamic from "next/dynamic"
import AIGenerateButton from "@/components/admin/AIGenerateButton"
import {
  Sparkles, Loader2, ExternalLink, Check, FileText,
  List, Eye, EyeOff, Trash2, RefreshCw,
  Globe, PenLine, Search, ImageIcon, Wand2,
} from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { useToast } from "@/components/admin/ui"
import { getCsrfToken } from "@/lib/utils"
import { toSlug } from "@/lib/slug"

const RichEditor = dynamic(() => import("@/components/admin/RichEditor"), { ssr: false })

// ─── Types ────────────────────────────────────────────────────

interface NicheOption { id: string; name: string; emoji: string }

interface DbPost {
  id: string; slug: string; niche: string; title: string; description: string
  coverImage: string | null; author: string; tags: string[]; readTime: number
  published: boolean; publishedAt: string | null; createdAt: string; updatedAt: string
}

interface FullPost extends DbPost {
  content: string
  keywords: string[]
}

type SaveResult = { slug: string; niche: string; postId: string; published: boolean }

function extractFirstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/)
  return m?.[1] ?? null
}

function CreateTab({ niches, editPost }: { niches: NicheOption[]; editPost?: FullPost | null }) {
  // Lazy initializers — if editing a post, pre-fill from it directly (no effect needed).
  // The `key` prop on CreateTab ensures this component remounts for each new editPost.
  const isEditMode = editPost != null
  const [niche, setNiche] = useState(() => editPost?.niche ?? "")
  const [topic, setTopic] = useState("")
  const [title, setTitle] = useState(() => editPost?.title ?? "")
  const [slug, setSlug] = useState(() => editPost?.slug ?? "")
  const [description, setDescription] = useState(() => editPost?.description ?? "")
  const [keywords, setKeywords] = useState(() => editPost?.keywords?.join(", ") ?? "")
  const [tags, setTags] = useState(() => editPost?.tags?.join(", ") ?? "")
  const [coverImage, setCoverImage] = useState(() => editPost?.coverImage ?? "")
  const [content, setContent] = useState(() => editPost?.content ?? "")
  // true = user manually typed a slug (don't auto-generate); start true in edit mode
  const slugEdited = useRef(isEditMode)
  const { success: toastSuccess, error: toastError } = useToast()
  const [aiLoading, setAiLoading] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)

  const [saved, setSaved] = useState<SaveResult | null>(null)
  const savedPostId = useRef<string | null>(editPost?.id ?? null)
  const coverInputId = useId()

  // Default niche for new posts — only when niche is empty (edit mode pre-fills via lazy init above)
  useEffect(() => {
    if (!niche && niches.length > 0) setNiche(niches[0].id)
  }, [niches, niche])

  const handleNicheChange = (id: string) => {
    setNiche(id)
    if (!isEditMode) {
      // New post only — reset all fields so user starts fresh in the new niche
      setTitle(""); setSlug(""); setDescription(""); setKeywords(""); setTags("")
      setCoverImage(""); setContent(""); setSaved(null)
      savedPostId.current = null; slugEdited.current = false
    }
  }

  const handleQuickSuggest = useCallback(async (provider?: string) => {
    if (!topic.trim() || !niche) return
    setSuggestLoading(true)
    try {
      const csrf = await getCsrfToken()
      const res = await fetch("/api/admin/suggest-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ topic: topic.trim(), niche, ...(provider ? { provider } : {}) }),
      })
      const data = await res.json() as Record<string, unknown>
      if (!res.ok) {
        const msg = (data.error as string) ?? (data.detail as string) ?? `HTTP ${res.status}`
        throw new Error(msg)
      }
      if (data.title) { setTitle(data.title as string); if (!slugEdited.current) setSlug(toSlug(data.title as string)) }
      if (data.description) setDescription(data.description as string)
      if (Array.isArray(data.keywords) && data.keywords.length) setKeywords((data.keywords as string[]).join(", "))
      if (Array.isArray(data.tags) && data.tags.length) setTags((data.tags as string[]).join(", "))
      if (data.htmlContent) setContent(data.htmlContent as string)
      savedPostId.current = null
      setSaved(null)
      toastSuccess("Đã điền xong! Kiểm tra và chỉnh sửa trước khi lưu.")
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setSuggestLoading(false)
    }
  }, [topic, niche, toastSuccess, toastError])

  const handleCoverUpload = useCallback(async (file: File) => {
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      setCoverImage(data.url)
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setCoverUploading(false)
    }
  }, [toastError])

  const handleAiGenerate = useCallback(async (provider: string) => {
    if (!title.trim()) return
    setAiLoading(true)
    try {
      const csrf = await getCsrfToken()
      const res = await fetch("/api/admin/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          niche, title: title.trim(),
          description: description.trim() || title.trim(),
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          provider,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      if (data.htmlContent) setContent(data.htmlContent)
      if (data.meta?.tags) setTags(data.meta.tags.join(", "))
      savedPostId.current = data.postId ?? null
      setSaved({ slug: data.slug, niche: data.niche, postId: data.postId, published: false })
      toastSuccess("Tạo nội dung xong! Kiểm tra và lưu bài.")
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setAiLoading(false)
    }
  }, [niche, title, description, keywords, tags, toastSuccess, toastError])

  const handleSave = useCallback(async (publish: boolean) => {
    if (!title.trim()) return
    // For new posts, require content; for existing posts allow saving without content
    if (!savedPostId.current && !content.trim()) return
    setSaveLoading(true)
    try {
      const csrf = await getCsrfToken()
      const effectiveCover = coverImage.trim() || extractFirstImage(content) || null
      // Ensure slug: use the field value or auto-generate from title
      const effectiveSlug = slug.trim() || toSlug(title.trim())
      const body = {
        niche, title: title.trim(), slug: effectiveSlug,
        description: description.trim() || title.trim(),
        content,
        coverImage: effectiveCover,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        published: publish,
      }
      const isUpdate = !!savedPostId.current
      const url = isUpdate ? `/api/admin/blog/${savedPostId.current}` : "/api/admin/blog"
      const res = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      // Both POST and PATCH return { ok, post: { id, slug, niche, ... } }
      const post = (data.post ?? data) as { id?: string; slug?: string; niche?: string }
      const id = post.id ?? savedPostId.current
      const savedSlug = post.slug ?? effectiveSlug
      savedPostId.current = id ?? null
      setSlug(savedSlug)
      setSaved({ slug: savedSlug, niche: post.niche ?? niche, postId: id ?? "", published: publish })
    } catch (e) {
      toastError((e as Error).message)
    } finally {
      setSaveLoading(false)
    }
  }, [niche, title, slug, description, content, coverImage, keywords, tags, toastError])

  return (
    <div className="space-y-5">
      {/* Quick AI suggest — fill all fields from a short topic */}
      <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50/50 dark:bg-purple-950/20 space-y-3">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-purple-600 shrink-0" />
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">Gợi ý toàn bộ bằng AI</p>
          <span className="text-xs text-purple-500 dark:text-purple-400">— tiêu đề, mô tả SEO, từ khoá, tags và nội dung</span>
        </div>
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && topic.trim() && niche && !suggestLoading) void handleQuickSuggest() }}
            placeholder="VD: iPhone 18 Pro Max, Giày búp bê, Tai nghe bluetooth..."
            className="flex-1 rounded-md border px-3 py-2 text-sm bg-background"
          />
          <AIGenerateButton
            label="Gợi ý tất cả"
            onGenerate={() => void handleQuickSuggest()}
            loading={suggestLoading}
            disabled={!topic.trim() || !niche}
            size="md"
          />
        </div>
        {suggestLoading && (
          <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            AI đang gợi ý... có thể mất 15–30 giây
          </p>
        )}
      </div>

      {/* Niche */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Ngách *</label>
        <div className="flex flex-wrap gap-2">
          {niches.length === 0 && <span className="text-xs text-muted-foreground">Đang tải...</span>}
          {niches.map((n) => (
            <button key={n.id} onClick={() => handleNicheChange(n.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${niche === n.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
              {n.emoji} {n.name}
            </button>
          ))}
        </div>
      </div>

      {/* Metadata */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Tiêu đề *</label>
          <input value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (!slugEdited.current) setSlug(toSlug(e.target.value))
            }}
            placeholder="Top sản phẩm đáng mua nhất tháng này..."
            className="w-full rounded-md border px-3 py-2 text-sm bg-background" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Slug (URL)
            <span className="font-normal text-xs text-muted-foreground ml-1">
              {isEditMode ? "— URL của bài đã tồn tại, thay đổi cẩn thận" : "— tự tạo từ tiêu đề, có thể chỉnh"}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">/{niche}/blog/</span>
            <input value={slug}
              onChange={(e) => {
                slugEdited.current = e.target.value !== ""
                setSlug(e.target.value === "" ? toSlug(title) : e.target.value)
              }}
              placeholder={toSlug(title) || "slug-bai-viet"}
              className="flex-1 rounded-md border px-3 py-2 text-sm bg-background font-mono" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Mô tả SEO <span className="font-normal text-xs text-muted-foreground">tùy chọn · tối đa 160 ký tự</span>
          </label>
          <div className="relative">
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={160}
              placeholder="Tóm tắt nội dung trong 155 ký tự..."
              className="w-full rounded-md border px-3 py-2 text-sm bg-background pr-14" />
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums ${description.length > 140 ? "text-amber-500" : "text-muted-foreground"}`}>
              {description.length}/160
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Từ khoá SEO <span className="font-normal text-xs text-muted-foreground">phân cách bằng dấu phẩy</span></label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="từ khoá chính, từ khoá phụ"
              className="w-full rounded-md border px-3 py-2 text-sm bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Tags <span className="font-normal text-xs text-muted-foreground">phân cách bằng dấu phẩy</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder={`${niche}, shopee, review`}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">
            Ảnh bìa <span className="font-normal text-xs text-muted-foreground">tùy chọn — nếu bỏ trống sẽ tự lấy ảnh đầu tiên trong bài</span>
          </label>
          <div className="flex items-center gap-3">
            {/* Upload button */}
            <label htmlFor={coverInputId}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors select-none ${coverUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-muted"}`}>
              {coverUploading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Đang upload...</>
                : <><ImageIcon className="w-4 h-4 text-muted-foreground" />Upload ảnh</>}
            </label>
            <input id={coverInputId} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden" disabled={coverUploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = "" }} />

            {/* Preview hoặc input URL thủ công */}
            {coverImage ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <img src={coverImage} alt="cover" className="h-10 w-16 object-cover rounded border shrink-0" />
                <span className="text-xs text-muted-foreground truncate flex-1">{coverImage}</span>
                <button type="button" onClick={() => setCoverImage("")}
                  className="text-xs text-red-500 hover:text-red-600 shrink-0">Xóa</button>
              </div>
            ) : (
              <input value={coverImage} onChange={(e) => setCoverImage(e.target.value)}
                placeholder="hoặc dán URL ảnh..."
                className="flex-1 rounded-md border px-3 py-2 text-sm bg-background" />
            )}
          </div>
        </div>
      </div>

      {/* Rich editor + AI button */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Nội dung *</label>
          <AIGenerateButton
            onGenerate={handleAiGenerate}
            loading={aiLoading}
            disabled={!title.trim() || !niche}
          />
        </div>
        <RichEditor content={content} onChange={setContent} minHeight={500}
          placeholder="Bắt đầu viết nội dung, hoặc nhấn 'Tạo bằng AI' để AI tự viết..."
          onImageUpload={(url) => { if (!coverImage) setCoverImage(url) }} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => handleSave(false)}
          disabled={saveLoading || !title.trim() || (!isEditMode && !content.trim())}
          className="flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Lưu Draft
        </button>
        <button onClick={() => handleSave(true)}
          disabled={saveLoading || !title.trim() || (!isEditMode && !content.trim())}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          Publish ngay
        </button>
        {saved && (
          <a href={`/${saved.niche}/blog/${saved.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
            <ExternalLink className="w-3.5 h-3.5" />
            Xem bài
          </a>
        )}
      </div>

      {saved && (
        <div className="border border-green-200 bg-green-50 dark:bg-green-950/20 rounded-lg px-4 py-3 flex items-center gap-2 text-sm">
          <Check className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-green-700 dark:text-green-400">
            Đã lưu {saved.published ? <strong>Published</strong> : <strong>Draft</strong>} —{" "}
            <span className="font-mono text-xs">/{saved.niche}/blog/{saved.slug}</span>
          </span>
        </div>
      )}

      {/* AI info note */}
      <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/20 space-y-1.5">
        <p className="font-semibold text-foreground">Về các tính năng AI</p>
        <p>• <strong>Gợi ý tất cả:</strong> nhập 1 chủ đề ngắn → AI viết toàn bộ tiêu đề + mô tả SEO + từ khoá + tags + nội dung trong 1 lần. Không cần điền gì trước.</p>
        <p>• <strong>Tạo bằng AI</strong> (nút cạnh "Nội dung"): dùng tiêu đề, từ khoá bạn đã điền + top 8 sản phẩm từ DB để viết nội dung chuyên sâu hơn.</p>
        <p>• <strong>Model:</strong> chọn qua nút <span className="font-mono">▾</span> — Gemini miễn phí, DeepSeek rẻ (~$0.002/bài), Claude Sonnet ~$0.04/bài</p>
        <p>• <strong>Nội dung:</strong> lưu HTML vào <span className="font-mono">BlogPost</span> — publish ngay lập tức, không cần build lại</p>
        <p>• <strong>Sau khi AI generate:</strong> mọi trường đều có thể chỉnh sửa tự do trước khi lưu</p>
      </div>
    </div>
  )
}

// ─── Tab: Manage ──────────────────────────────────────────────

function ManageTab({ niches, onEdit }: { niches: NicheOption[]; onEdit: (id: string) => Promise<void> }) {
  const [posts, setPosts] = useState<DbPost[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterNiche, setFilterNiche] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [q, setQ] = useState("")
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ take: "50" })
      if (filterNiche) params.set("niche", filterNiche)
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (q) params.set("q", q)
      const res = await fetch(`/api/admin/blog?${params}`)
      const data = await res.json()
      setPosts(data.data ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [filterNiche, filterStatus, q])

  useEffect(() => { load() }, [load])

  const togglePublish = async (post: DbPost) => {
    setToggling(post.id)
    try {
      const csrf = await getCsrfToken()
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ published: !post.published }),
      })
      if (res.ok) {
        setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, published: !p.published, publishedAt: !p.published ? new Date().toISOString() : null } : p))
      }
    } finally {
      setToggling(null)
    }
  }

  const deletePost = async (post: DbPost) => {
    if (!confirm(`Xóa bài "${post.title}"? Hành động này không thể hoàn tác.`)) return
    setDeleting(post.id)
    try {
      const csrf = await getCsrfToken()
      await fetch(`/api/admin/blog/${post.id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      })
      setPosts((prev) => prev.filter((p) => p.id !== post.id))
      setTotal((t) => t - 1)
    } finally {
      setDeleting(null)
    }
  }

  const nicheLabel = (id: string) => {
    const n = niches.find((n) => n.id === id)
    return n ? `${n.emoji} ${n.name}` : id
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm bài viết..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md bg-background" />
        </div>

        <select value={filterNiche} onChange={(e) => setFilterNiche(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background">
          <option value="">Tất cả ngách</option>
          {niches.map((n) => <option key={n.id} value={n.id}>{n.emoji} {n.name}</option>)}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border rounded-md px-3 py-1.5 bg-background">
          <option value="all">Tất cả trạng thái</option>
          <option value="published">✅ Published</option>
          <option value="draft">📝 Draft</option>
        </select>

        <button onClick={load} className="flex items-center gap-1.5 text-sm border rounded-md px-3 py-1.5 hover:bg-muted transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>

        <span className="text-xs text-muted-foreground ml-auto">{total} bài viết</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
          <PenLine className="w-8 h-8 mx-auto mb-2 opacity-20" />
          Chưa có bài viết nào. Dùng tab "Tạo bài" để tạo bài mới.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground">TIÊU ĐỀ</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground w-28">NGÁCH</th>
                <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground w-24">TRẠNG THÁI</th>
                <th className="text-left px-3 py-2.5 font-medium text-xs text-muted-foreground w-28">NGÀY TẠO</th>
                <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground w-40">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <p className="font-medium line-clamp-1">{post.title}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">/{post.niche}/blog/{post.slug} · {post.readTime} phút</p>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs font-mono">{nicheLabel(post.niche)}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {post.published
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full"><Globe className="w-2.5 h-2.5" />Live</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full"><PenLine className="w-2.5 h-2.5" />Draft</span>}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground font-mono">
                    {new Date(post.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {post.published && (
                        <a href={`/${post.niche}/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Xem bài">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setEditLoading(post.id)
                          onEdit(post.id).finally(() => setEditLoading(null))
                        }}
                        disabled={editLoading === post.id}
                        className="p-1.5 rounded hover:bg-blue-100 hover:text-blue-600 text-muted-foreground transition-colors" title="Chỉnh sửa">
                        {editLoading === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => togglePublish(post)} disabled={toggling === post.id}
                        className={`p-1.5 rounded transition-colors ${post.published ? "hover:bg-amber-100 hover:text-amber-700 text-muted-foreground" : "hover:bg-green-100 hover:text-green-700 text-muted-foreground"}`}
                        title={post.published ? "Ẩn bài" : "Publish"}>
                        {toggling === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : post.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => deletePost(post)} disabled={deleting === post.id}
                        className="p-1.5 rounded hover:bg-red-100 hover:text-red-600 text-muted-foreground transition-colors" title="Xóa bài">
                        {deleting === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function BlogAdminPage() {
  const [tab, setTab] = useState<"generate" | "manage">("manage")
  const [niches, setNiches] = useState<NicheOption[]>([])
  const [editingPost, setEditingPost] = useState<FullPost | null>(null)

  useEffect(() => {
    fetch("/api/niches")
      .then((r) => r.json())
      .then((d) => setNiches(d.data ?? []))
      .catch(() => {})
  }, [])

  const handleEdit = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/blog/${id}`)
    const data = await res.json() as FullPost
    setEditingPost(data)
    setTab("generate")
  }, [])

  return (
    <div className="flex flex-col gap-6 flex-1 min-h-0 overflow-y-auto">
      <AdminPageShell
        title="Blog"
        subtitle="Tạo bài viết bằng AI hoặc quản lý bài đã có — publish/ẩn ngay lập tức, không cần build lại."
      />

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button onClick={() => setTab("manage")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "manage" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <List className="w-4 h-4" />
          Quản lý bài viết
        </button>
        <button onClick={() => { setEditingPost(null); setTab("generate") }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "generate" ? "border-purple-600 text-purple-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Sparkles className="w-4 h-4" />
          Tạo bài
        </button>
      </div>

      {tab === "manage"
        ? <ManageTab niches={niches} onEdit={handleEdit} />
        : <CreateTab key={editingPost?.id ?? "new"} niches={niches} editPost={editingPost} />}
    </div>
  )
}
