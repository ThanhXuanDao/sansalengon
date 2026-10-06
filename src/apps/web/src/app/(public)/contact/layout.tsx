import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Liên hệ",
  description:
    "Có câu hỏi hoặc góp ý? Liên hệ đội ngũ SanSaleNgon qua form hoặc gửi email tới hello@sansalengon.com.",
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
