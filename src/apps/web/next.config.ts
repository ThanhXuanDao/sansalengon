import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Cần cho Docker build (Dockerfile.local dùng .next/standalone)
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  images: {
    remotePatterns: [
      // Shopee
      { protocol: "https", hostname: "*.img.susercontent.com" },
      { protocol: "https", hostname: "cf.shopee.vn" },
      // Lazada
      { protocol: "https", hostname: "*.lazcdn.com" },
      { protocol: "https", hostname: "*.alicdn.com" },
      // Tiki
      { protocol: "https", hostname: "*.tikicdn.com" },
      // CellphoneS
      { protocol: "https", hostname: "*.cellphones.com.vn" },
      // KingFoodMart / OneLife CDN
      { protocol: "https", hostname: "*.kingfoodmart.com" },
      { protocol: "https", hostname: "kingfoodmart.com" },
      { protocol: "https", hostname: "img.onelife.vn" },
      { protocol: "https", hostname: "*.onelife.vn" },
      // Vascara
      { protocol: "https", hostname: "*.vascara.com" },
      { protocol: "https", hostname: "vascara.com" },
      // Con Cưng
      { protocol: "https", hostname: "*.concung.com" },
      { protocol: "https", hostname: "concung.com" },
      // Dev / placeholder
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ]
  },
}

export default nextConfig
