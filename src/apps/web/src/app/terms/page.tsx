import type { Metadata } from "next"
import Link from "next/link"
import Navbar from "@/components/layout/Navbar"
import Footer from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description:
    "Syarat dan ketentuan penggunaan platform kurasi produk affiliate Shopby.",
}

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-grow w-full max-w-[800px] mx-auto px-4 md:px-8 pt-28 pb-16">
        <div className="bg-white border border-[#e5e1d8] p-8 md:p-12" style={{ clipPath: "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)" }}>
          <div className="text-center mb-10">
            <h1 className="font-sans text-[32px] md:text-[40px] leading-[38px] md:leading-[48px] tracking-[-0.01em] md:tracking-[-0.02em] font-extrabold text-primary uppercase text-pretty">
              Syarat & Ketentuan
            </h1>
            <div className="w-16 h-1 bg-primary mx-auto mt-4" />
          </div>

          <div className="space-y-8 font-sans text-body-md text-ink">
            <section>
              <h2 className="text-headline-md font-bold mb-3">Penggunaan Layanan</h2>
              <p>Dengan menggunakan Shopby, kamu menyetujui syarat dan ketentuan berikut. Jika tidak setuju, mohon untuk tidak menggunakan layanan kami.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Link Afiliasi</h2>
              <p>Shopby berpartisipasi dalam Shopee Affiliate Program. Kami dapat memperoleh komisi dari pembelian yang dilakukan melalui link afiliasi di situs ini, tanpa biaya tambahan untuk kamu. Harga produk sama persis seperti berbelanja langsung di Shopee.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Akurasi Produk</h2>
              <p>Informasi produk (harga, ketersediaan, deskripsi) bersumber dari Shopee dan dapat berubah sewaktu-waktu. Kami berusaha menjaga akurasi tetapi tidak bertanggung jawab atas perubahan yang dilakukan oleh penjual atau platform.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Kekayaan Intelektual</h2>
              <p>Seluruh konten di Shopby (teks, gambar, kurasi) adalah milik Shopby kecuali disebutkan lain. Dilarang mereproduksi konten tanpa izin tertulis.</p>
            </section>

            <section>
              <h2 className="text-headline-md font-bold mb-3">Perubahan Ketentuan</h2>
              <p>Kami dapat memperbarui syarat dan ketentuan ini sewaktu-waktu. Perubahan akan diumumkan melalui halaman ini.</p>
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
