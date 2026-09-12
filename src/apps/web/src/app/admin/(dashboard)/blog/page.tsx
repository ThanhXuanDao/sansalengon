"use client"

import { useState, useCallback } from "react"
import { Sparkles, Loader2, ExternalLink, Check, FileText, Lightbulb, ChevronRight } from "lucide-react"
import AdminPageShell from "@/components/admin/AdminPageShell"
import { Alert } from "@/components/admin/ui"

const NICHES = [
  { id: "fashion",     label: "👗 Thời trang" },
  { id: "electronics", label: "📱 Điện tử" },
  { id: "home",        label: "🏠 Nhà cửa" },
  { id: "beauty",      label: "💄 Làm đẹp" },
  { id: "food",        label: "🛒 Thực phẩm" },
  { id: "baby",        label: "👶 Mẹ & Bé" },
]

// Quick-fill examples per niche — click to auto-populate form
const EXAMPLES: Record<string, { title: string; description: string; keywords: string; tags: string }[]> = {
  fashion: [
    {
      title: "Top 5 áo thun nam cotton tốt nhất dưới 200k trên Shopee 2026",
      description: "So sánh 5 mẫu áo thun nam cotton chất lượng dưới 200k: chất liệu, size thực tế, và shop uy tín trên Shopee.",
      keywords: "áo thun nam cotton, áo thun giá rẻ, mua áo thun shopee",
      tags: "áo thun nam, thời trang, shopee",
    },
    {
      title: "Cách chọn quần jean nam đúng form — tránh mua hớ trên Shopee",
      description: "Hướng dẫn chọn quần jean nam theo dáng người, bảng size thực tế, và 3 shop uy tín nhất Shopee 2026.",
      keywords: "quần jean nam, chọn quần jean, size quần jean shopee",
      tags: "quần jean, thời trang nam, mua sắm",
    },
  ],
  electronics: [
    {
      title: "5 tai nghe chống ồn ANC tốt nhất dưới 1 triệu — test thực tế 2026",
      description: "Đã thử 8 mẫu, chọn ra 5 tai nghe ANC đáng mua nhất dưới 1 triệu: chất lượng âm thanh, pin, và độ bền thực tế.",
      keywords: "tai nghe chống ồn, ANC dưới 1 triệu, tai nghe bluetooth giá rẻ",
      tags: "tai nghe, điện tử, chống ồn",
    },
    {
      title: "Sạc dự phòng nào tốt nhất 2026? So sánh 6 mẫu từ 150k–500k",
      description: "Review chi tiết 6 sạc dự phòng phổ biến nhất Shopee: dung lượng thực, tốc độ sạc, và độ bền sau 6 tháng dùng.",
      keywords: "sạc dự phòng tốt, pin dự phòng shopee, power bank giá rẻ",
      tags: "sạc dự phòng, điện tử, shopee",
    },
  ],
  home: [
    {
      title: "Nồi chiên không dầu loại nào tốt? Top 5 mẫu đáng mua 2026",
      description: "So sánh 5 nồi chiên không dầu bán chạy nhất Shopee theo dung tích, công suất, và tính năng thực tế.",
      keywords: "nồi chiên không dầu tốt, air fryer shopee, nồi chiên giá rẻ",
      tags: "nồi chiên không dầu, nhà bếp, shopee",
    },
    {
      title: "Gối ngủ chống đau cổ — cách chọn và 4 mẫu tốt nhất dưới 300k",
      description: "Hướng dẫn chọn gối ngủ phù hợp tư thế, và 4 mẫu chống đau cổ vai gáy chất lượng trên Shopee dưới 300k.",
      keywords: "gối ngủ chống đau cổ, gối memory foam, gối chỉnh hình shopee",
      tags: "gối ngủ, nội thất phòng ngủ, sức khỏe",
    },
  ],
  beauty: [
    {
      title: "Routine dưỡng da buổi sáng 4 bước cho người bận rộn — sản phẩm dưới 500k",
      description: "Skincare sáng đơn giản nhất cho người đi làm: 4 bước, toàn sản phẩm dưới 500k, mua được trên Shopee.",
      keywords: "routine dưỡng da buổi sáng, skincare đơn giản, dưỡng da cho người bận",
      tags: "skincare, dưỡng da, làm đẹp",
    },
    {
      title: "Kem chống nắng nào tốt nhất cho da dầu mụn? Top 5 mẫu 2026",
      description: "Review 5 kem chống nắng dành riêng cho da dầu mụn: không bí, không trắng bệch, chuẩn SPF50+ thực tế.",
      keywords: "kem chống nắng da dầu mụn, sunscreen SPF50 shopee, kem chống nắng không nhờn",
      tags: "kem chống nắng, da dầu mụn, skincare",
    },
  ],
  food: [
    {
      title: "Mua gạo ST25 trên Shopee thế nào để không bị hàng giả? Hướng dẫn chi tiết",
      description: "Cách phân biệt gạo ST25 thật và hàng nhái, shop uy tín nhất trên Shopee, và mức giá chuẩn 2026.",
      keywords: "gạo ST25 thật, mua gạo ST25 shopee, gạo ngon nhất",
      tags: "gạo ST25, thực phẩm, mua sắm thông minh",
    },
    {
      title: "Yến mạch ăn liền loại nào ngon và bổ nhất? Top 4 thương hiệu 2026",
      description: "So sánh 4 thương hiệu yến mạch ăn liền bán chạy nhất Shopee: hàm lượng dinh dưỡng, vị, và giá thực tế.",
      keywords: "yến mạch ăn liền ngon, oats shopee, yến mạch giảm cân",
      tags: "yến mạch, ăn sáng, dinh dưỡng",
    },
  ],
  baby: [
    {
      title: "Xe đẩy em bé loại nào tốt nhất 2026? So sánh 5 mẫu từ 1–3 triệu",
      description: "Review 5 xe đẩy em bé phổ biến nhất Shopee theo độ bền, tính năng, và độ an toàn thực tế cho bé.",
      keywords: "xe đẩy em bé tốt, xe nôi shopee, stroller giá rẻ",
      tags: "xe đẩy em bé, mẹ và bé, shopee",
    },
    {
      title: "Tã bỉm nào thấm tốt và không hăm? So sánh 4 thương hiệu phổ biến",
      description: "Đánh giá tã bỉm theo độ thấm hút, chất liệu da tiếp xúc, và giá thành — dành cho bé sơ sinh đến 10kg.",
      keywords: "tã bỉm thấm tốt, bỉm không hăm, tã cho trẻ sơ sinh shopee",
      tags: "tã bỉm, mẹ và bé, sơ sinh",
    },
  ],
}

interface GeneratedPost {
  slug: string
  niche: string
  title: string
  description: string
  date: string
  readTime: number
  tags: string[]
  author: string
}

interface GenerateResult {
  ok: boolean
  slug: string
  niche: string
  url: string
  meta: GeneratedPost
}

export default function BlogGeneratorPage() {
  const [niche, setNiche] = useState("fashion")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [keywords, setKeywords] = useState("")
  const [tags, setTags] = useState("")

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fillExample = (ex: typeof EXAMPLES["fashion"][0]) => {
    setTitle(ex.title)
    setDescription(ex.description)
    setKeywords(ex.keywords)
    setTags(ex.tags)
    setResult(null)
    setError(null)
  }

  const handleNicheChange = (id: string) => {
    setNiche(id)
    // Clear form when switching niche so examples stay relevant
    setTitle("")
    setDescription("")
    setKeywords("")
    setTags("")
    setResult(null)
    setError(null)
  }

  const handleGenerate = useCallback(async () => {
    if (!title.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/admin/generate-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          niche,
          title: title.trim(),
          description: description.trim() || title.trim(),
          keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unknown error")
      setResult(data as GenerateResult)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [niche, title, description, keywords, tags])

  const currentExamples = EXAMPLES[niche] ?? []

  return (
    <div className="flex flex-col gap-6">

      <AdminPageShell title="Blog tự động" subtitle="Điền tiêu đề + chọn ngách → Claude Sonnet tự động viết bài blog hoàn chỉnh (~700 từ) dựa trên sản phẩm đang bán thực tế." />

      {/* How it works — 3 steps */}
      <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground tracking-wider">Cách dùng</p>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-purple-500 font-bold">01</span>
            <span className="font-medium">Chọn ngách & tiêu đề</span>
            <span className="text-muted-foreground">Dùng ví dụ nhanh bên dưới hoặc tự nhập tiêu đề bài viết mới</span>
          </div>
          <div className="flex items-start gap-1.5">
            <ChevronRight className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-purple-500 font-bold">02</span>
              <span className="font-medium">Nhấn tạo bài</span>
              <span className="text-muted-foreground">Claude đọc dữ liệu sản phẩm từ DB, viết bài ~15 giây</span>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <ChevronRight className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-purple-500 font-bold">03</span>
              <span className="font-medium">Bài live sau 30 phút</span>
              <span className="text-muted-foreground">ISR tự revalidate — hoặc build lại để live ngay</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="border rounded-lg p-5 space-y-5">

        {/* Niche selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Ngách *</label>
          <div className="flex flex-wrap gap-2">
            {NICHES.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNicheChange(n.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  niche === n.id
                    ? "bg-purple-600 text-white border-purple-600"
                    : "border-border text-muted-foreground hover:border-purple-400 hover:text-foreground"
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick examples */}
        {currentExamples.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-medium">Ví dụ nhanh</span>
              <span>— click để tự động điền toàn bộ form</span>
            </div>
            <div className="flex flex-col gap-2">
              {currentExamples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => fillExample(ex)}
                  disabled={loading}
                  className="text-left text-xs px-3 py-2.5 rounded-md border border-dashed border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 text-foreground hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <span className="font-medium group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    {ex.title}
                  </span>
                  <span className="block text-muted-foreground mt-0.5">
                    Keywords: {ex.keywords.split(",").slice(0, 2).join(", ")}…
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <hr className="border-dashed" />

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Tiêu đề bài viết *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`VD: ${currentExamples[0]?.title ?? "Top sản phẩm đáng mua nhất tháng này"}`}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Tiêu đề càng cụ thể (có số, giá tiền, năm) → bài viết càng chất lượng và SEO tốt hơn.
            Slug URL sẽ được tự động tạo từ tiêu đề này.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Mô tả SEO
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">tùy chọn — hiển thị trên Google Search</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={160}
            placeholder={currentExamples[0]?.description ?? "Tóm tắt nội dung bài viết trong 155 ký tự..."}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Nếu để trống, sẽ dùng tiêu đề làm mô tả.</span>
            <span className={description.length > 140 ? "text-amber-500" : ""}>{description.length}/160</span>
          </div>
        </div>

        {/* Keywords */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Từ khoá SEO
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">tùy chọn — cách nhau dấu phẩy</span>
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder={currentExamples[0]?.keywords ?? "từ khoá chính, từ khoá phụ, long-tail keyword"}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Claude sẽ đưa các từ khoá này vào bài một cách tự nhiên — nên nhập 2–4 từ khoá có lượng tìm kiếm cao.
          </p>
        </div>

        {/* Tags */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Tags
            <span className="text-muted-foreground font-normal ml-1.5 text-xs">tùy chọn — cách nhau dấu phẩy</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={currentExamples[0]?.tags ?? `${NICHES.find(n => n.id === niche)?.label.split(" ")[1]?.toLowerCase() ?? niche}, shopee, review`}
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          />
          <p className="text-xs text-muted-foreground">
            Hiển thị dưới bài viết và dùng để lọc blog theo chủ đề.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !title.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors w-full justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Claude đang đọc sản phẩm và viết bài... (~15 giây)
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              {title.trim() ? `Tạo bài: "${title.trim().slice(0, 40)}${title.length > 40 ? "…" : ""}"` : "Nhập tiêu đề để bắt đầu"}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <Alert tone="error" title="Lỗi tạo bài viết">
          {error}
          {error.includes("ANTHROPIC_API_KEY") && (
            <p className="font-mono text-[11px] mt-1">Thêm ANTHROPIC_API_KEY vào file .env rồi restart server</p>
          )}
        </Alert>
      )}

      {/* Result */}
      {result && (
        <div className="border border-green-200 bg-green-50 dark:bg-green-950/20 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
            <Check className="w-4 h-4" />
            Bài viết đã được tạo và đăng ký thành công
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground mb-0.5">Tiêu đề</p>
              <p className="font-medium">{result.meta.title}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">URL slug</p>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">/{result.niche}/blog/{result.slug}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Thời gian đọc ước tính</p>
              <p>{result.meta.readTime} phút đọc</p>
            </div>
          </div>

          <div className="flex gap-3 pt-1 flex-wrap">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Xem bài viết (live sau ISR 30 phút hoặc rebuild)
            </a>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-2.5">
            <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              File đã lưu tại{" "}
              <code className="font-mono">src/content/blog/{result.niche}/{result.slug}.tsx</code>
              {" "}và đã đăng ký trong{" "}
              <code className="font-mono">generated-posts.ts</code>
            </span>
          </div>
        </div>
      )}

      {/* Technical notes */}
      <div className="text-xs text-muted-foreground border rounded p-3 bg-muted/20 space-y-1.5">
        <p className="font-semibold text-foreground">Lưu ý kỹ thuật</p>
        <p>• <strong>Model:</strong> Claude Sonnet 5 · Chi phí: ~$0.04/bài (~800 token in, 2000 token out)</p>
        <p>• <strong>Dữ liệu:</strong> Claude tự lấy top 8 sản phẩm từ DB theo ngách để viết — không cần nhập thủ công</p>
        <p>• <strong>ISR:</strong> Bài viết live sau 30 phút tự động. Muốn ngay: chạy <code className="font-mono">npm run build</code></p>
        <p>• <strong>Chỉnh sửa:</strong> Mở file TSX tương ứng trong <code className="font-mono">src/content/blog/</code> để sửa thủ công</p>
        <p>• <strong>Tái tạo:</strong> Nhập lại cùng tiêu đề → ghi đè file cũ, không tạo trùng</p>
      </div>
    </div>
  )
}
