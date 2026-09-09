/**
 * Seed fake price history cho 1 product để test chart.
 * Chạy: npx tsx prisma/seed-price-history.ts <productId>
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const productId = process.argv[2]
  if (!productId) {
    console.error("Usage: npx tsx prisma/seed-price-history.ts <productId>")
    process.exit(1)
  }

  // Tạo 30 điểm giá trong 30 ngày, giả lập sale ảo (thổi giá rồi giảm)
  const basePrice = 200_000
  const points = Array.from({ length: 30 }, (_, i) => {
    const daysAgo = 29 - i
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)

    // Mô phỏng: giá ban đầu cao, giảm dần, rồi sale thật cuối tháng
    let price = basePrice
    if (daysAgo > 20) price = Math.round(basePrice * 1.4)      // thổi giá
    else if (daysAgo > 10) price = Math.round(basePrice * 1.2) // giảm nhẹ
    else if (daysAgo > 3) price = Math.round(basePrice * 1.1)  // gần sale
    else price = Math.round(basePrice * 0.75)                  // sale thật

    // Thêm biến động nhỏ
    price += Math.round((Math.random() - 0.5) * 10_000)

    return { productId, price, recordedAt: date }
  })

  await prisma.priceHistory.createMany({ data: points })
  console.log(`✅ Seeded ${points.length} price history points for product ${productId}`)
}

main().finally(() => prisma.$disconnect())
