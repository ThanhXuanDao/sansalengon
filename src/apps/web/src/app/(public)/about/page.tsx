import type { Metadata } from "next"
import Link from "next/link"
import ContentPageShell from "@/components/layout/ContentPageShell"

export const metadata: Metadata = {
  title: "Về SanSaleNgon",
  description:
    "SanSaleNgon là nền tảng tuyển chọn sản phẩm affiliate giúp bạn tìm hàng chất lượng mà không mất thời gian lướt mãi không ngừng.",
}

export default function AboutPage() {
  return (
    <ContentPageShell title="Về SanSaleNgon" breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Về chúng tôi" }]}>
      <div className="space-y-8 font-sans text-body-md text-ink">
        <section>
          <p className="text-lg leading-relaxed">
            <span translate="no">SanSaleNgon</span> là nền tảng tuyển chọn sản phẩm affiliate giúp bạn
            tìm được hàng chất lượng mà không phải lướt mãi không ngừng.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Sứ mệnh của chúng tôi</h2>
          <p>
            Sứ mệnh đơn giản: <strong>mua thông minh, tiết kiệm thật</strong>. Chúng tôi tin rằng
            mua sắm online phải hiệu quả, vui vẻ và có lợi. Mỗi sản phẩm trên{" "}
            <span translate="no">SanSaleNgon</span> đều qua tuyển chọn kỹ lưỡng để bạn nhận được
            giá trị tốt nhất.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Dành cho ai?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Người mua thông minh</strong> — muốn hàng chất lượng mà không cần nghiên cứu hàng giờ
            </li>
            <li>
              <strong>Người yêu phong cách sống</strong> — thời trang, điện tử, gia dụng và làm đẹp
            </li>
            <li>
              <strong>Nhà sáng tạo nội dung</strong> — muốn tham gia với tư cách affiliate partner
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Liên hệ chúng tôi</h2>
          <p>
            Có câu hỏi hoặc góp ý? Chúng tôi rất vui được lắng nghe. Truy cập trang{" "}
            <Link href="/contact" className="text-primary underline focus-visible:ring-2 focus-visible:ring-primary">
              Liên hệ
            </Link>{" "}
            của chúng tôi.
          </p>
        </section>
      </div>

      <div className="mt-12 text-center border-t border-dashed border-[site-sand] pt-6">
        <p className="font-mono text-label-mono text-[site-brown] uppercase tracking-widest">
          *** Săn sale ngon mỗi ngày ***
        </p>
      </div>
    </ContentPageShell>
  )
}
