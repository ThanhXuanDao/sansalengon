import type React from "react"
import { GENERATED_POSTS, GENERATED_LOADERS } from "./generated-posts"

export interface BlogPostMeta {
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

const MANUAL_POSTS: BlogPostMeta[] = [
  {
    slug: "chon-ao-thun-nam-chat-luong",
    niche: "fashion",
    title: "Áo thun nam: Cách chọn đúng chất liệu, size và tầm giá để không mua hớ",
    description:
      "Hướng dẫn đọc thông số chất liệu, bảng size thực tế cho người Việt, và 5 lỗi hay gặp khi mua áo thun trên Shopee — giúp bạn chọn đúng ngay từ lần đầu.",
    date: "2026-09-09",
    readTime: 6,
    tags: ["áo thun nam", "mua sắm thông minh", "thời trang"],
    author: "SanSaleNgon",
  },
  {
    slug: "top-ao-khoac-thu-dong-2026",
    niche: "fashion",
    title: "Top 10 áo khoác mùa đông 2026 đáng mua nhất — deal Shopee đang giảm sâu",
    description:
      "Tổng hợp 10 mẫu áo khoác thu đông 2026 chất lượng trong tầm giá 200k–800k: bomber, windbreaker, hoodie — ấm áp và đúng trend streetwear Việt.",
    date: "2026-09-05",
    readTime: 7,
    tags: ["áo khoác", "thu đông 2026", "thời trang nam nữ"],
    author: "SanSaleNgon",
  },
  {
    slug: "tai-nghe-chong-on-gia-duoi-2-trieu",
    niche: "electronics",
    title: "5 tai nghe chống ồn ANC tốt nhất dưới 2 triệu đồng — test thực tế 2026",
    description:
      "Đã thử nghiệm 12 mẫu, chọn ra 5 tai nghe chống ồn chủ động đáng mua nhất trong tầm giá dưới 2 triệu: Soundcore, Edifier, Sony WH-1000XM và các ẩn số Trung Quốc.",
    date: "2026-09-03",
    readTime: 8,
    tags: ["tai nghe chống ồn", "ANC", "điện tử"],
    author: "SanSaleNgon",
  },
  {
    slug: "routine-duong-da-ban-dem-cho-nguoi-moi",
    niche: "beauty",
    title: "Routine dưỡng da ban đêm 5 bước cho người mới bắt đầu — cải thiện da sau 30 ngày",
    description:
      "Hướng dẫn skincare ban đêm từ A–Z cho người hoàn toàn mới: 5 bước đơn giản, sản phẩm giá hợp lý trên Shopee, lịch trình dễ duy trì mỗi ngày.",
    date: "2026-09-01",
    readTime: 7,
    tags: ["dưỡng da ban đêm", "skincare cho người mới", "làm đẹp"],
    author: "SanSaleNgon",
  },
]

export const BLOG_POSTS: BlogPostMeta[] = [...MANUAL_POSTS, ...(GENERATED_POSTS as BlogPostMeta[])]

// Map "niche/slug" → dynamic import loader cho TSX content component
const MANUAL_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  "fashion/chon-ao-thun-nam-chat-luong": () =>
    import("./fashion/chon-ao-thun-nam-chat-luong"),
  "fashion/top-ao-khoac-thu-dong-2026": () =>
    import("./fashion/top-ao-khoac-thu-dong-2026"),
  "electronics/tai-nghe-chong-on-gia-duoi-2-trieu": () =>
    import("./electronics/tai-nghe-chong-on-gia-duoi-2-trieu"),
  "beauty/routine-duong-da-ban-dem-cho-nguoi-moi": () =>
    import("./beauty/routine-duong-da-ban-dem-cho-nguoi-moi"),
}

export const POST_LOADERS: Record<string, () => Promise<{ default: React.ComponentType }>> = {
  ...MANUAL_LOADERS,
  ...GENERATED_LOADERS,
}
