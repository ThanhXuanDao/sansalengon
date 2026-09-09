import type { Metadata } from "next"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Tentang Shopby",
  description:
    "Shopby adalah platform kurasi produk affiliate yang membantu kamu menemukan barang-barang berkualitas tanpa menghabiskan waktu scrolling tanpa akhir.",
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-[800px] mx-auto px-4 md:px-8 pt-28 pb-16">
        <div className="bg-white border border-[#e5e1d8] p-8 md:p-12" style={{ clipPath: "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)" }}>
          <div className="text-center mb-10">
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
              Tentang <span translate="no">Shopby</span>
            </h1>
            <div className="w-16 h-1 bg-primary mx-auto mt-4" />
          </div>

          <div className="space-y-8 font-sans text-body-md text-ink">
            <section>
              <p className="text-lg leading-relaxed"><span translate="no">Shopby</span> adalah platform kurasi produk affiliate yang membantu kamu menemukan barang-barang berkualitas tanpa harus menghabiskan waktu scrolling tanpa akhir.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Misi Kami</h2>
              <p>Misi kami sederhana: <strong>belanja cerdas, struk berkualitas</strong>. Kami percaya bahwa berbelanja online harus efisien, menyenangkan, dan menguntungkan. Setiap produk di <span translate="no">Shopby</span> telah melalui kurasi ketat untuk memastikan kamu mendapatkan value terbaik.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Untuk Siapa?</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Pembeli cerdas</strong> — yang ingin produk berkualitas tanpa riset berjam-jam</li>
                <li><strong>Pecinta gaya hidup</strong> — fashion, elektronik, rumah tangga, dan kecantikan</li>
                <li><strong>Kreator konten</strong> — yang ingin bergabung sebagai affiliate partner</li>
              </ul>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Hubungi Kami</h2>
              <p>Punya pertanyaan atau saran? Kami senang mendengar dari kamu. Kunjungi halaman <Link href="/contact" className="text-primary underline focus-visible:ring-2 focus-visible:ring-primary">Kontak</Link> kami.</p>
            </section>
          </div>

          <div className="mt-12 text-center border-t border-dashed border-[#e5e1d8] pt-6">
            <p className="font-mono text-label-mono text-[#5c403a] uppercase tracking-widest">*** Since 2024 ***</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
