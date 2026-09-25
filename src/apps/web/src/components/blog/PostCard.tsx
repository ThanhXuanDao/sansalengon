import Link from "next/link"
import type { BlogPostMeta } from "@/lib/blog-db"
import FormattedDate from "@/components/ui/FormattedDate"

interface PostCardProps {
  post: BlogPostMeta
}

export default function PostCard({ post }: PostCardProps) {
  const href = `/${post.niche}/blog/${post.slug}`

  return (
    <Link
      href={href}
      className="group block border border-[site-ink] bg-white hover:bg-[#fffdf5] transition-colors clip-bevel-tr-md"
    >
      {post.coverImage && (
        <div className="relative aspect-[16/9] overflow-hidden border-b border-[site-ink]">
          <img
            src={post.coverImage}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <span className="absolute top-2 right-2 bg-[site-yellow] text-[site-ink] font-mono text-[10px] px-2 py-0.5 border border-[site-ink]">
            {post.readTime} phút đọc
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1 mb-2">
          {post.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="font-mono text-[10px] text-[site-brown] border border-[site-brown]/30 px-1.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
        <h3 className="font-mono text-[13px] font-bold text-[site-ink] leading-tight mb-2 line-clamp-2 group-hover:text-[site-red] transition-colors">
          {post.title}
        </h3>
        <p className="font-mono text-[11px] text-[site-ink]/60 line-clamp-2 mb-3">
          {post.description}
        </p>
        <div className="flex items-center justify-between">
          <time dateTime={post.date}>
            <FormattedDate date={post.date} className="font-mono text-[10px] text-[site-ink]/40" />
          </time>
          <span className="font-mono text-[10px] text-[site-red] group-hover:underline">
            Đọc thêm →
          </span>
        </div>
      </div>
    </Link>
  )
}
