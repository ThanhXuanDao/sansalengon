import type { Metadata } from "next"
import Link from "next/link"
import ContentPageShell from "@/components/layout/ContentPageShell"

export const metadata: Metadata = {
  title: "Chương trình Affiliate",
  description:
    "Tham gia chương trình affiliate SanSaleNgon, nhận hoa hồng từ mỗi lần bạn giới thiệu sản phẩm tới người dùng.",
}

export default function AffiliatePage() {
  return (
    <ContentPageShell title="Chương trình Affiliate">
      <div className="space-y-8 font-sans text-body-md text-ink">
        <section>
          <h2 className="text-headline-md font-bold mb-3">Cách hoạt động</h2>
          <p>
            SanSaleNgon là nền tảng tuyển chọn sản phẩm Shopee Affiliate. Mỗi sản phẩm hiển thị ở
            đây đều được chúng tôi chọn lọc thủ công. Khi bạn mua hàng qua link affiliate của
            chúng tôi, chúng tôi nhận được hoa hồng nhỏ từ Shopee — hoàn toàn không tốn thêm chi
            phí nào cho bạn.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Tại sao tin tưởng chúng tôi?</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sản phẩm được chọn dựa trên chất lượng và giá trị thực</li>
            <li>Đánh giá trung thực — chúng tôi chỉ giới thiệu những gì thực sự tốt</li>
            <li>Giá giống hệt khi mua trực tiếp trên Shopee</li>
            <li>Minh bạch: mọi link đều là link affiliate được chứng nhận</li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Dành cho nhà sáng tạo</h2>
          <p>
            Muốn trở thành affiliate partner? Chúng tôi đang tìm kiếm các nhà sáng tạo nội dung
            muốn kiếm thu nhập từ việc giới thiệu sản phẩm. Liên hệ với chúng tôi để trao đổi
            thêm.
          </p>
        </section>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/"
          className="inline-block bg-primary text-ink px-8 py-3 font-bold rounded-full brutalist-shadow text-sm uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-primary"
        >
          Khám phá sản phẩm
        </Link>
      </div>

      <div className="mt-12 text-center border-t border-dashed border-[site-sand] pt-6">
        <p className="font-mono text-label-mono text-[site-brown] uppercase tracking-widest">
          *** Shopee Affiliate Partner ***
        </p>
      </div>
    </ContentPageShell>
  )
}
