import Link from "next/link"

export default function Footer() {
  return (
    <footer className="w-full mt-20 border-t-2 border-dashed border-border-color py-8 px-4 md:px-8 bg-[#e8e8e5]">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="max-w-md">
          <span className="font-mono text-label-mono uppercase text-primary mb-2 block" translate="no">
            Shopby
          </span>
          <p className="text-caption text-ink font-sans">
            Kami adalah partner Shopee Affiliate. Setiap pembelian melalui link
            ini membantu kami terus berbagi rekomendasi terbaik.
          </p>
          <p className="text-caption text-ink/60 mt-2">
            &copy; 2026 abny project
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/about"
            className="text-caption text-ink/60 hover:text-primary transition-colors font-sans focus-visible:ring-2 focus-visible:ring-primary"
          >
            Tentang Kami
          </Link>
          <Link
            href="/privacy"
            className="text-caption text-ink/60 hover:text-primary transition-colors font-sans focus-visible:ring-2 focus-visible:ring-primary"
          >
            Kebijakan Privasi
          </Link>
          <Link
            href="/terms"
            className="text-caption text-ink/60 hover:text-primary transition-colors font-sans focus-visible:ring-2 focus-visible:ring-primary"
          >
            Syarat &amp; Ketentuan
          </Link>
          <Link
            href="/contact"
            className="text-caption text-ink/60 hover:text-primary transition-colors font-sans focus-visible:ring-2 focus-visible:ring-primary"
          >
            Hubungi Kami
          </Link>
        </div>
      </div>
    </footer>
  )
}
