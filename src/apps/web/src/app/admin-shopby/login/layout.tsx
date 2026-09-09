import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Secure portal for Shopby affiliate administrators.",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
