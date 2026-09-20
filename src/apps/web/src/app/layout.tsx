import type { Metadata } from "next"
import { Be_Vietnam_Pro } from "next/font/google"
import Script from "next/script"
import Providers from "./providers"
import ScrollToTop from "@/components/ui/ScrollToTop"
import AnalyticsScripts from "@/components/analytics/AnalyticsScripts"
import { getSiteSettings } from "@/lib/get-site-settings"
import "./globals.css"

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings()
  const siteName = s.siteName || "Săn Sale Ngon"
  const title = s.metaTitle || `${siteName} — Mua Thông Minh, Tiết Kiệm Thật`
  const description = s.metaDesc || s.tagline || "Sản phẩm Shopee affiliate được tuyển chọn kỹ — giá tốt nhất, cập nhật tự động mỗi 4 giờ."
  const ogImage = s.ogImage || "/og-image.jpg"
  const [robotsIndex, robotsFollow] = (s.robotsDefault || "index,follow").split(",")

  return {
    metadataBase: new URL(s.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: {
      default: title,
      template: `%s — ${siteName}`,
    },
    description,
    keywords: s.metaKeywords ? s.metaKeywords.split(",").map((k) => k.trim()) : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "vi_VN",
      siteName,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: robotsIndex?.trim() === "index",
      follow: robotsFollow?.trim() === "follow",
    },
    authors: [{ name: siteName, url: s.siteUrl }],
    applicationName: siteName,
    alternates: {
      canonical: s.siteUrl,
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const s = await getSiteSettings()

  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://picsum.photos" />
        <link rel="dns-prefetch" href="https://picsum.photos" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#FAFAF7" />
        {s.favicon && <link rel="icon" href={s.favicon} />}
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
        {s.maintenanceMode ? (
          <MaintenancePage siteName={s.siteName || "Săn Sale Ngon"} tagline={s.tagline} />
        ) : (
          <>
            <a
              href="#skip-target"
              className="skip-link sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-ink focus:font-bold focus:rounded focus:outline-none"
            >
              Chuyển đến nội dung chính
            </a>
            <Providers
              currencySymbol={s.currencySymbol || "₫"}
              currencyPosition={s.currencyPosition || "after"}
              thousandSeparator={s.thousandSeparator || "."}
            >{children}</Providers>
            <ScrollToTop />
          </>
        )}

        {/* GTM + GA4 — client component checks pathname to skip on /admin */}
        <AnalyticsScripts gtmId={s.gtmId || undefined} ga4Id={s.ga4Id || undefined} />

        <Script id="schema-breadcrumb" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            name: `${s.siteName || "Săn Sale Ngon"} Breadcrumb`,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Trang chủ", item: s.siteUrl || "https://sansalengon.vn" },
              { "@type": "ListItem", position: 2, name: "Sản phẩm", item: `${s.siteUrl || "https://sansalengon.vn"}/#products` },
            ],
          })}
        </Script>
        <Script id="schema-structured-data" type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: s.siteName || "Săn Sale Ngon",
            url: s.siteUrl || "https://sansalengon.vn",
            description: s.tagline || "Sản phẩm Shopee affiliate được tuyển chọn kỹ.",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${s.siteUrl || "https://sansalengon.vn"}/search?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          })}
        </Script>
      </body>
    </html>
  )
}

function MaintenancePage({ siteName, tagline }: { siteName: string; tagline?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAF7] px-4 text-center">
      <div className="max-w-md">
        <div className="size-16 mx-auto mb-6 bg-[#fdc73a] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6f5400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 className="font-sans text-[28px] font-bold text-[#1a1c1b] mb-3">{siteName}</h1>
        <p className="font-mono text-[13px] text-[#5c403a] mb-2">Đang bảo trì hệ thống</p>
        <p className="font-sans text-[14px] text-[#5c403a]">
          {tagline || "Chúng tôi sẽ trở lại sớm. Cảm ơn bạn đã kiên nhẫn chờ đợi!"}
        </p>
      </div>
    </div>
  )
}
