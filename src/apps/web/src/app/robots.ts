import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin-shopby/", "/api/"],
    },
    sitemap: "https://shopby.io/sitemap.xml",
  }
}
