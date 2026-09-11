export interface NicheConfig {
  id: string
  name: string
  emoji: string
  description: string      // dùng cho SEO meta description
  keywords: string         // dùng cho meta keywords + schema
  categorySlug: string     // slug trong bảng Category (thường = id)
}

// Đồng bộ với config/niches.yaml — chỉ list ngách status: active
export const NICHES: NicheConfig[] = [
  {
    id: "fashion",
    name: "Thời trang",
    emoji: "👗",
    categorySlug: "fashion",
    description: "Deal thời trang giảm giá hôm nay — áo, váy, giày sneaker từ Shopee, Lazada. Cập nhật tự động, giá thấp nhất 30 ngày.",
    keywords: "thời trang giảm giá, áo thun nam, váy nữ, giày sneaker, deal shopee",
  },
  {
    id: "electronics",
    name: "Điện tử",
    emoji: "📱",
    categorySlug: "electronics",
    description: "Deal điện tử, phụ kiện công nghệ giá tốt — điện thoại, tai nghe, cáp sạc. Cập nhật mỗi 4 giờ từ Shopee Mall.",
    keywords: "điện tử giảm giá, tai nghe, cáp sạc, phụ kiện điện thoại, deal công nghệ",
  },
  {
    id: "home",
    name: "Nhà cửa",
    emoji: "🏠",
    categorySlug: "home",
    description: "Deal đồ gia dụng, nội thất, trang trí nhà cửa giảm giá sâu. Tổng hợp từ Shopee, Lazada hàng ngày.",
    keywords: "đồ gia dụng giảm giá, nội thất, trang trí nhà, deal nhà cửa",
  },
  {
    id: "beauty",
    name: "Làm đẹp",
    emoji: "💄",
    categorySlug: "beauty",
    description: "Deal mỹ phẩm, chăm sóc da, làm đẹp chính hãng giảm giá — cập nhật tự động từ Shopee Mall và Lazada.",
    keywords: "mỹ phẩm giảm giá, chăm sóc da, làm đẹp, deal shopee beauty",
  },
  {
    id: "food",
    name: "Thực phẩm",
    emoji: "🛒",
    categorySlug: "food",
    description: "Deal thực phẩm, đồ uống, gia vị giảm giá — mua online tiết kiệm hơn siêu thị. Cập nhật hàng ngày.",
    keywords: "thực phẩm giảm giá, đồ uống, gia vị, thực phẩm online shopee",
  },
  {
    id: "baby",
    name: "Mẹ & Bé",
    emoji: "👶",
    categorySlug: "baby",
    description: "Deal sản phẩm mẹ và bé, đồ chơi, tã bỉm, thức ăn dặm giảm giá sâu. Chọn lọc kỹ từ thương hiệu uy tín.",
    keywords: "sản phẩm mẹ bé giảm giá, đồ chơi trẻ em, tã bỉm, thức ăn dặm",
  },
]

export const NICHE_MAP = new Map(NICHES.map((n) => [n.id, n]))

export function getNiche(id: string): NicheConfig | undefined {
  return NICHE_MAP.get(id)
}

export function getNicheByCategory(categorySlug: string): NicheConfig | undefined {
  return NICHES.find((n) => n.categorySlug === categorySlug)
}
