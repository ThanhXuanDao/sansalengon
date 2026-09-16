"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"

interface Props {
  gtmId?: string
  ga4Id?: string
}

export default function AnalyticsScripts({ gtmId, ga4Id }: Props) {
  const pathname = usePathname()
  if (pathname.startsWith("/admin")) return null

  return (
    <>
      {gtmId && /^GTM-[A-Z0-9]{4,10}$/.test(gtmId) && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      )}

      {ga4Id && /^G-[A-Z0-9]{4,12}$/.test(ga4Id) && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');`}
          </Script>
        </>
      )}
    </>
  )
}
