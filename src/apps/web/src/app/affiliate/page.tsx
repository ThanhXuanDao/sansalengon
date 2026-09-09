import type { Metadata } from "next"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Affiliate Program",
  description:
    "Bergabung dengan program affiliate Shopby, dapatkan komisi dari setiap rekomendasi produk yang kamu bagikan kepada audiens.",
}

export default function AffiliatePage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-[800px] mx-auto px-4 md:px-8 pt-28 pb-16">
        <div className="bg-white border border-[#e5e1d8] p-8 md:p-12" style={{ clipPath: "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)" }}>
          <div className="text-center mb-10">
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
              Affiliate Program
            </h1>
            <div className="w-16 h-1 bg-primary mx-auto mt-4" />
          </div>

          <div className="space-y-8 font-sans text-body-md text-ink">
            <section>
              <h2 className="text-headline-md font-bold mb-3">Bagaimana Cara Kerjanya?</h2>
              <p>Shopby adalah platform kurasi produk Shopee Affiliate. Setiap produk yang tampil di sini adalah rekomendasi pilihan yang kami kurasi secara manual. Ketika kamu membeli melalui link afiliasi kami, kami mendapatkan komisi kecil dari Shopee tanpa biaya tambahan untuk kamu.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Kenapa Percaya Kami?</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Produk dipilih berdasarkan kualitas dan value for money</li>
                <li>Review jujur — kami hanya merekomendasikan yang benar-benar bagus</li>
                <li>Harga sama persis seperti beli langsung di Shopee</li>
                <li>Transparan: setiap link adalah link afiliasi tersertifikasi</li>
              </ul>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Untuk Kreator</h2>
              <p>Tertarik jadi affiliate partner? Kami mencari kreator konten yang ingin memonetisasi rekomendasi produk. Hubungi kami untuk diskusi lebih lanjut.</p>
            </section>
          </div>

          <div className="mt-10 text-center">
            <Link href="/" className="inline-block bg-primary text-ink px-8 py-3 font-bold rounded-full brutalist-shadow text-sm uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-primary">
              Jelajahi Produk
            </Link>
          </div>

          <div className="mt-12 text-center border-t border-dashed border-[#e5e1d8] pt-6">
            <p className="font-mono text-label-mono text-[#5c403a] uppercase tracking-widest">*** Shopee Affiliate Partner ***</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
