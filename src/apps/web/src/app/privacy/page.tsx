import type { Metadata } from "next"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description:
    "Pelajari bagaimana Shopby mengelola data pribadi Anda, penggunaan cookie, dan tautan afiliasi.",
}

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-[800px] mx-auto px-4 md:px-8 pt-28 pb-16">
        <div className="bg-white border border-[#e5e1d8] p-8 md:p-12" style={{ clipPath: "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)" }}>
          <div className="text-center mb-10">
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
              Kebijakan Privasi
            </h1>
            <div className="w-16 h-1 bg-primary mx-auto mt-4" />
          </div>

          <div className="space-y-8 font-sans text-body-md text-ink">
            <section>
              <h2 className="text-headline-md font-bold mb-3">Data yang Kami Kumpulkan</h2>
              <p>Shopby mengumpulkan data minimal yang diperlukan untuk menjalankan layanan:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Data klik produk (produk apa yang diklik, waktu)</li>
                <li>Alamat IP (untuk analitik dasar)</li>
                <li>User agent browser (untuk optimasi tampilan)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Cookie</h2>
              <p>Kami menggunakan cookie sesi untuk autentikasi admin panel. Tidak ada cookie pelacakan pihak ketiga yang digunakan di halaman publik.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Link Afiliasi</h2>
              <p>Klik pada link produk akan mengarahkan kamu ke Shopee melalui link afiliasi. Shopee mungkin mengumpulkan data transaksi sesuai kebijakan privasi mereka. Kami tidak menyimpan data transaksi atau informasi pembayaran kamu.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Hak Kamu</h2>
              <p>Kamu berhak untuk tidak memberikan data yang diminta. Karena kami hanya menyimpan data klik anonim, tidak ada data pribadi yang dapat dihapus secara individual.</p>
            </section>

            <section>
              <p className="text-sm text-[#5c403a] italic">Terakhir diperbarui: Juli 2026</p>
            </section>
          </div>

          <div className="mt-12 text-center">
            <Link href="/" className="inline-block border-2 border-ink text-ink px-8 py-3 font-bold rounded-full text-sm uppercase tracking-wider hover:bg-ink hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary">
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
