import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Cổng quản trị SanSaleNgon dành cho quản trị viên.",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
