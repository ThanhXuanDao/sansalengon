import Link from "next/link"
import type { BlogPostMeta } from "@/content/blog"
import FormattedDate from "@/components/ui/FormattedDate"

interface PostCardProps {
  post: BlogPostMeta
}

export default function PostCard({ post }: PostCardProps) {
  const href = `/${post.niche}/blog/${post.slug}`

  return (
    <Link
      href={href}
      className="group block border border-[#1a1c1b] bg-white hover:bg-[#fffdf5] transition-colors clip-bevel-tr-md"
    >
      {post.coverImage && (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-[#1a1c1b]">
          <img
            src={post.coverImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2 right-2 bg-[#fdc73a] text-[#1a1c1b] font-mono text-[10px] px-2 py-0.5 border border-[#1a1c1b]">
            {post.readTime} phút đọc
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {post.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] text-[#5c403a] border border-[#5c403a]/30 px-1.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
        <h3 className="font-mono text-[13px] font-bold text-[#1a1c1b] leading-tight mb-2 line-clamp-2 group-hover:text-[#b51c00] transition-colors">
          {post.title}
        </h3>
        <p className="font-mono text-[11px] text-[#1a1c1b]/60 line-clamp-2 mb-3">
          {post.description}
        </p>
        <div className="flex items-center justify-between">
          <time dateTime={post.date}>
            <FormattedDate date={post.date} className="font-mono text-[10px] text-[#1a1c1b]/40" />
          </time>
          <span className="font-mono text-[10px] text-[#b51c00] group-hover:underline">
            Đọc thêm →
          </span>
        </div>
      </div>
    </Link>
  )
}
