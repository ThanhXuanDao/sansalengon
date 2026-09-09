import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="bg-white border border-[#e5e1d8] p-10 text-center max-w-md w-full">
        <p className="font-mono text-[100px] leading-none font-bold text-primary">404</p>
        <h1 className="font-sans text-2xl font-extrabold mt-4 uppercase">
          Halaman Tidak Ditemukan
        </h1>
        <div className="w-12 h-1 bg-primary mx-auto mt-3 mb-4" />
        <p className="font-mono text-label-mono text-[#5c403a] mb-6">
          Halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link
          href="/"
          className="inline-block bg-primary text-white font-bold py-3 px-8 brutalist-shadow text-sm uppercase tracking-wider focus-visible:ring-2 focus-visible:ring-primary"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  )
}
