/**
 * Seed fake coupons để test trang /ma-giam-gia
 * Chạy: npx tsx prisma/seed-coupons.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const SAMPLE_COUPONS = [
  {
    id: "shopee-fashion-30",
    source: "manual",
    nicheId: "fashion",
    merchant: "Shopee Fashion",
    code: "FASHION30",
    description: "Giảm 30% tất cả sản phẩm thời trang, áp dụng cho shop chính hãng",
    discountValue: 30,
    discountType: "percent",
    minOrderValue: 150000,
    maxDiscount: 80000,
    affiliateUrl: "https://shopee.vn/fashion",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: "lazada-fashion-50k",
    source: "manual",
    nicheId: "fashion",
    merchant: "Lazada",
    code: "LZFASHION50",
    description: "Giảm 50.000đ đơn hàng thời trang từ 299.000đ",
    discountValue: 50000,
    discountType: "fixed",
    minOrderValue: 299000,
    maxDiscount: null,
    affiliateUrl: "https://lazada.vn",
    expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // hết hạn sớm
  },
  {
    id: "shopee-all-10",
    source: "manual",
    nicheId: null, // áp dụng mọi ngách
    merchant: "Shopee",
    code: "SHOPEE10",
    description: "Giảm 10% toàn sàn, áp dụng tất cả danh mục",
    discountValue: 10,
    discountType: "percent",
    minOrderValue: 100000,
    maxDiscount: 50000,
    affiliateUrl: "https://shopee.vn",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: "tiki-fashion-free-ship",
    source: "manual",
    nicheId: "fashion",
    merchant: "Tiki",
    code: null, // không có code — click link trực tiếp
    description: "Miễn phí vận chuyển đơn hàng thời trang, không cần mã — tự động áp dụng qua link",
    discountValue: 30000,
    discountType: "fixed",
    minOrderValue: 200000,
    maxDiscount: 30000,
    affiliateUrl: "https://tiki.vn",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  },
  {
    id: "shopee-electronics-15",
    source: "manual",
    nicheId: "electronics",
    merchant: "Shopee Mall",
    code: "TECH15NOW",
    description: "Giảm 15% phụ kiện điện tử, tai nghe, cáp sạc",
    discountValue: 15,
    discountType: "percent",
    minOrderValue: 200000,
    maxDiscount: 120000,
    affiliateUrl: "https://shopee.vn/electronics",
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
]

async function main() {
  for (const coupon of SAMPLE_COUPONS) {
    await prisma.coupon.upsert({
      where: { id: coupon.id },
      update: coupon,
      create: coupon,
    })
    console.log(`✅ ${coupon.merchant} — ${coupon.code ?? "(no code)"}`)
  }
  console.log(`\nSeeded ${SAMPLE_COUPONS.length} sample coupons`)
}

main().finally(() => prisma.$disconnect())
