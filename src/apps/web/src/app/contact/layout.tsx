import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Hubungi Kami",
  description:
    "Ada pertanyaan atau saran? Hubungi tim Shopby melalui form kontak atau kirim email ke hello@shopby.com.",
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
