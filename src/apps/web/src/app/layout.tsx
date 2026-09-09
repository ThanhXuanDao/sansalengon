import type { Metadata } from "next"
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import Providers from "./providers"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
})

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "Shopby — Belanja Cerdas, Struk Berkualitas",
    template: "%s — Shopby",
  },
  description:
      "Rekomendasi produk pilihan dari berbagai kategori. Terkurasi, terpercaya, harga transparan.",
  openGraph: {
    title: "Shopby — Belanja Cerdas, Struk Berkualitas",
    description:
    "Rekomendasi produk pilihan dari berbagai kategori. Terkurasi, terpercaya, harga transparan.",
    type: "website",
    locale: "id_ID",
    siteName: "Shopby",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Shopby — Belanja Cerdas, Struk Berkualitas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shopby — Belanja Cerdas, Struk Berkualitas",
    description:
      "Koleksi produk Shopee Affiliate pilihan dalam satu nota digital.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  authors: [{ name: "Shopby", url: "https://shopby.io" }],
  applicationName: "Shopby",
  alternates: {
    canonical: "https://shopby.io",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://picsum.photos" />
        <link rel="dns-prefetch" href="https://picsum.photos" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#FAFAF7" />
        <script type="speculationrules">
          {JSON.stringify({
            prerender: [{
              where: { href_matches: "/*" },
              eagerness: "moderate"
            }]
          })}
        </script>
      </head>
      <body className="min-h-screen flex flex-col" translate="no">
        <a
          href="#skip-target"
          className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-ink focus:font-bold focus:rounded focus:outline-none"
        >
          Langsung ke konten utama
        </a>
        <Providers>{children}</Providers>
        <Script id="schema-breadcrumb" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            name: "Shopby Breadcrumb",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Beranda", item: "https://shopby.io" },
              { "@type": "ListItem", position: 2, name: "Produk", item: "https://shopby.io/#products" },
            ],
          })}
        </Script>
        <Script id="schema-structured-data" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Shopby",
            url: "https://shopby.io",
            description:
      "Rekomendasi produk pilihan dari berbagai kategori. Terkurasi, terpercaya, harga transparan.",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate:
                  "https://shopby.io/search?q={search_term_string}",
              },
              "query-input": "required name=search_term_string",
            },
          })}
        </Script>
      </body>
    </html>
  )
}
