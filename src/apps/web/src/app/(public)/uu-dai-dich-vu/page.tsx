import type { Metadata } from "next"
import LeadPageClient from "./LeadPageClient"

export const metadata: Metadata = {
  title: "Ưu đãi dịch vụ — Ẩm thực, giáo dục, du lịch, spa",
  description:
    "Tổng hợp ưu đãi từ các đối tác dịch vụ uy tín — ẩm thực, giáo dục, du lịch, spa và nhiều lĩnh vực khác. Đăng ký qua link để nhận ưu đãi độc quyền.",
  openGraph: {
    title: "Ưu đãi dịch vụ",
    description: "Ẩm thực, giáo dục, du lịch, spa và nhiều dịch vụ — đăng ký qua link nhận ưu đãi độc quyền, cập nhật liên tục.",
  },
}

export default function LeadPage() {
  return <LeadPageClient />
}
