import type { Metadata } from "next"
import Link from "next/link"
import ContentPageShell from "@/components/layout/ContentPageShell"

export const metadata: Metadata = {
  title: "Điều khoản sử dụng",
  description:
    "Điều khoản và điều kiện sử dụng nền tảng tổng hợp sản phẩm affiliate SanSaleNgon.",
}

export default function TermsPage() {
  return (
    <ContentPageShell title="Điều khoản sử dụng" breadcrumb={[{ label: "Trang chủ", href: "/" }, { label: "Điều khoản sử dụng" }]}>
      <div className="space-y-8 font-sans text-body-md text-ink">
        <section>
          <h2 className="text-headline-md font-bold mb-3">Sử dụng dịch vụ</h2>
          <p>
            Khi sử dụng SanSaleNgon, bạn đồng ý với các điều khoản sau đây. Nếu không đồng ý, vui
            lòng ngừng sử dụng dịch vụ.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Liên kết Affiliate</h2>
          <p>
            SanSaleNgon tham gia Chương trình Shopee Affiliate. Chúng tôi có thể nhận hoa hồng từ
            các giao dịch mua hàng thực hiện qua link affiliate trên trang này, không tốn thêm chi
            phí nào cho bạn. Giá sản phẩm hoàn toàn giống khi mua trực tiếp trên Shopee.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Độ chính xác thông tin</h2>
          <p>
            Thông tin sản phẩm (giá, tình trạng hàng, mô tả) được lấy từ Shopee và có thể thay đổi
            bất cứ lúc nào. Chúng tôi cố gắng đảm bảo độ chính xác nhưng không chịu trách nhiệm về
            các thay đổi do người bán hoặc nền tảng thực hiện.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Sở hữu trí tuệ</h2>
          <p>
            Toàn bộ nội dung trên SanSaleNgon (văn bản, hình ảnh, danh sách tuyển chọn) là tài sản
            của SanSaleNgon trừ khi có ghi chú khác. Nghiêm cấm sao chép nội dung khi chưa được
            phép bằng văn bản.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Thay đổi điều khoản</h2>
          <p>
            Chúng tôi có thể cập nhật các điều khoản này bất cứ lúc nào. Thay đổi sẽ được thông
            báo qua trang này.
          </p>
        </section>
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/"
          className="inline-block border-2 border-ink text-ink px-8 py-3 font-bold rounded-full text-sm uppercase tracking-wider hover:bg-ink hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          Về trang chủ
        </Link>
      </div>
    </ContentPageShell>
  )
}
