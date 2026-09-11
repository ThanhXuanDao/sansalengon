import type { Metadata } from "next"
import CouponPageClient from "./CouponPageClient"

export const metadata: Metadata = {
  title: "Mã giảm giá hôm nay — Deal tốt nhất",
  description:
    "Tổng hợp mã giảm giá, voucher Shopee, Lazada cập nhật hàng ngày. Copy mã và áp dụng ngay để tiết kiệm khi mua sắm online.",
  openGraph: {
    title: "Mã giảm giá hôm nay",
    description: "Tổng hợp voucher và mã giảm giá cập nhật hàng ngày từ Shopee, Lazada và hơn 100 thương hiệu.",
  },
}

export default function CouponPage() {
  return <CouponPageClient />
}
