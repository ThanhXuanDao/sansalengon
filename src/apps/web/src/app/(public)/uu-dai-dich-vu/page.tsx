import type { Metadata } from "next"
import LeadPageClient from "./LeadPageClient"

export const metadata: Metadata = {
  title: "Ưu đãi dịch vụ — Vay, thẻ tín dụng, bảo hiểm",
  description:
    "Tổng hợp ưu đãi dịch vụ tài chính, ngân hàng, bảo hiểm, spa — đăng ký online nhận hoa hồng hoàn tiền và quà tặng hấp dẫn.",
  openGraph: {
    title: "Ưu đãi dịch vụ",
    description: "Vay tín chấp, thẻ tín dụng, bảo hiểm và nhiều dịch vụ tài chính — ưu đãi độc quyền cập nhật liên tục.",
  },
}

export default function LeadPage() {
  return <LeadPageClient />
}
