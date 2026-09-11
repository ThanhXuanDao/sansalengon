import type { Metadata } from "next"
import Link from "next/link"
import ContentPageShell from "@/components/layout/ContentPageShell"

export const metadata: Metadata = {
  title: "Chính sách bảo mật",
  description:
    "Tìm hiểu cách SanSaleNgon quản lý dữ liệu cá nhân, sử dụng cookie và liên kết affiliate.",
}

export default function PrivacyPage() {
  return (
    <ContentPageShell title="Chính sách bảo mật">
      <div className="space-y-8 font-sans text-body-md text-ink">
        <section>
          <h2 className="text-headline-md font-bold mb-3">Dữ liệu chúng tôi thu thập</h2>
          <p>SanSaleNgon chỉ thu thập dữ liệu tối thiểu cần thiết để vận hành dịch vụ:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Dữ liệu nhấp vào sản phẩm (sản phẩm nào được nhấp, thời điểm)</li>
            <li>Địa chỉ IP (cho phân tích cơ bản)</li>
            <li>User agent trình duyệt (để tối ưu hiển thị)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Cookie</h2>
          <p>
            Chúng tôi sử dụng cookie phiên để xác thực trang quản trị. Không có cookie theo dõi
            của bên thứ ba được sử dụng trên các trang công khai.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Liên kết Affiliate</h2>
          <p>
            Khi nhấp vào link sản phẩm, bạn sẽ được chuyển đến Shopee thông qua link affiliate.
            Shopee có thể thu thập dữ liệu giao dịch theo chính sách bảo mật của họ. Chúng tôi
            không lưu trữ dữ liệu giao dịch hay thông tin thanh toán của bạn.
          </p>
        </section>

        <section>
          <h2 className="text-headline-md font-bold mb-3">Quyền của bạn</h2>
          <p>
            Bạn có quyền không cung cấp dữ liệu được yêu cầu. Vì chúng tôi chỉ lưu dữ liệu nhấp
            ẩn danh, không có dữ liệu cá nhân nào có thể xóa riêng lẻ.
          </p>
        </section>

        <section>
          <p className="text-sm text-[#5c403a] italic">Cập nhật lần cuối: Tháng 7 năm 2026</p>
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
