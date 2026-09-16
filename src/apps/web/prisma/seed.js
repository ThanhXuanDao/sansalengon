// Seed master niche data — idempotent (upsert), safe to run multiple times.
// Status "draft" by default — enable individual niches from Admin UI.
// Run: node prisma/seed.js  OR  npx prisma db seed

const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

const NICHES = [
  {
    id: "fashion",
    name: "Thời trang",
    emoji: "👗",
    status: "active",
    description: "Deal thời trang Shopee hôm nay — quần áo, giày dép, túi xách giảm giá sâu nhất.",
    metaKeywords: "thời trang shopee, quần áo giảm giá, giày dép sale, túi xách khuyến mãi, váy đầm",
    sortOrder: 10,
    shopeeKeywords: ["áo thun nam", "váy nữ", "giày sneaker", "túi xách nữ", "quần jean nam", "áo khoác", "đầm dự tiệc"],
    atKeywords: ["fashion", "thời trang", "shopee fashion", "clothing"],
    minDiscountPct: 20,
    minPrice: 50000,
    maxPrice: 3000000,
    postPrefix: "👗 Deal thời trang hôm nay",
    hashtags: "#thoitrang #shopee #sale #fashion #dealngon",
  },
  {
    id: "electronics",
    name: "Điện tử",
    emoji: "📱",
    status: "active",
    description: "Deal điện tử Shopee — điện thoại, laptop, tai nghe, phụ kiện công nghệ giảm giá sâu.",
    metaKeywords: "điện thoại giảm giá, laptop sale, tai nghe bluetooth, phụ kiện công nghệ, đồng hồ thông minh",
    sortOrder: 20,
    shopeeKeywords: ["tai nghe bluetooth", "ốp lưng điện thoại", "sạc dự phòng", "cáp sạc", "bàn phím cơ", "chuột gaming", "loa bluetooth"],
    atKeywords: ["electronics", "điện tử", "shopee mall điện tử", "technology"],
    minDiscountPct: 15,
    minPrice: 100000,
    maxPrice: 20000000,
    postPrefix: "📱 Deal công nghệ hôm nay",
    hashtags: "#diente #congnghe #shopee #sale #tech",
  },
  {
    id: "beauty",
    name: "Làm đẹp",
    emoji: "💄",
    status: "active",
    description: "Deal làm đẹp Shopee hôm nay — skincare, mỹ phẩm, chăm sóc tóc giảm giá tốt nhất.",
    metaKeywords: "skincare giảm giá, mỹ phẩm shopee, kem dưỡng da, son môi sale, serum vitamin c",
    sortOrder: 30,
    shopeeKeywords: ["kem dưỡng ẩm", "serum vitamin c", "son môi", "kem chống nắng", "sữa rửa mặt", "toner", "mặt nạ dưỡng da"],
    atKeywords: ["beauty", "làm đẹp", "skincare", "mỹ phẩm", "cosmetics"],
    minDiscountPct: 20,
    minPrice: 30000,
    maxPrice: 2000000,
    postPrefix: "💄 Deal làm đẹp hôm nay",
    hashtags: "#lamdep #skincare #shopee #sale #beauty",
  },
  {
    id: "home",
    name: "Nhà cửa & Nội thất",
    emoji: "🏠",
    status: "active",
    description: "Deal đồ gia dụng và nội thất Shopee — dụng cụ nhà bếp, decor, đồ dùng phòng ngủ giá tốt.",
    metaKeywords: "đồ gia dụng giảm giá, nội thất shopee, dụng cụ nhà bếp sale, đồ decor phòng",
    sortOrder: 40,
    shopeeKeywords: ["nồi chiên không dầu", "máy lọc không khí", "đèn ngủ", "chăn ga gối", "thùng rác thông minh", "giá để đồ", "máy xay sinh tố"],
    atKeywords: ["home", "nhà cửa", "gia dụng", "nội thất", "household"],
    minDiscountPct: 15,
    minPrice: 50000,
    maxPrice: 10000000,
    postPrefix: "🏠 Deal gia dụng hôm nay",
    hashtags: "#giadung #nhacu #shopee #sale #homedecor",
  },
  {
    id: "sports",
    name: "Thể thao & Gym",
    emoji: "💪",
    status: "active",
    description: "Deal thể thao và dụng cụ gym Shopee — giày thể thao, đồ tập, thiết bị fitness giảm giá.",
    metaKeywords: "giày thể thao giảm giá, dụng cụ gym sale, đồ tập gym, bình nước thể thao, tạ tập",
    sortOrder: 50,
    shopeeKeywords: ["giày chạy bộ", "tạ tập gym", "thảm yoga", "dây kháng lực", "bình nước gym", "quần legging", "áo tập gym"],
    atKeywords: ["sports", "thể thao", "gym", "fitness", "sport"],
    minDiscountPct: 20,
    minPrice: 50000,
    maxPrice: 5000000,
    postPrefix: "💪 Deal thể thao hôm nay",
    hashtags: "#thethao #gym #fitness #shopee #sale",
  },
  {
    id: "kids",
    name: "Mẹ & Bé",
    emoji: "👶",
    status: "active",
    description: "Deal mẹ và bé Shopee — đồ chơi, quần áo trẻ em, sản phẩm chăm sóc bé giảm giá tốt nhất.",
    metaKeywords: "đồ chơi trẻ em giảm giá, quần áo bé trai sale, sản phẩm mẹ bé, tã bỉm khuyến mãi",
    sortOrder: 60,
    shopeeKeywords: ["đồ chơi trẻ em", "quần áo trẻ em", "tã bỉm", "sữa tắm trẻ em", "xe đẩy em bé", "ghế ngồi ăn", "bình sữa"],
    atKeywords: ["kids", "trẻ em", "mẹ bé", "baby", "children"],
    minDiscountPct: 15,
    minPrice: 30000,
    maxPrice: 5000000,
    postPrefix: "👶 Deal mẹ & bé hôm nay",
    hashtags: "#mebe #treem #shopee #sale #baby",
  },
  {
    id: "food",
    name: "Thực phẩm & Đồ uống",
    emoji: "🍜",
    status: "active",
    description: "Deal thực phẩm và đồ uống Shopee — thực phẩm sạch, đồ uống, snack, thực phẩm chức năng giá tốt.",
    metaKeywords: "thực phẩm shopee sale, đồ uống giảm giá, snack khuyến mãi, thực phẩm chức năng, cafe pha sẵn",
    sortOrder: 70,
    shopeeKeywords: ["cà phê", "trà sữa", "snack ăn vặt", "mỳ ăn liền", "nước tương", "yến mạch", "protein shake"],
    atKeywords: ["food", "thực phẩm", "đồ ăn", "grocery", "food & beverage"],
    minDiscountPct: 10,
    minPrice: 20000,
    maxPrice: 500000,
    postPrefix: "🍜 Deal thực phẩm hôm nay",
    hashtags: "#thucpham #douong #shopee #sale #food",
  },
  {
    id: "pets",
    name: "Thú cưng",
    emoji: "🐾",
    status: "active",
    description: "Deal thú cưng Shopee — thức ăn chó mèo, phụ kiện thú cưng, đồ chơi thú cưng giảm giá.",
    metaKeywords: "thức ăn chó mèo giảm giá, phụ kiện thú cưng sale, đồ chơi thú cưng, cát vệ sinh mèo",
    sortOrder: 80,
    shopeeKeywords: ["thức ăn chó", "thức ăn mèo", "cát vệ sinh mèo", "vòng cổ thú cưng", "đồ chơi chó mèo", "bát ăn thú cưng"],
    atKeywords: ["pets", "thú cưng", "pet", "chó mèo"],
    minDiscountPct: 15,
    minPrice: 30000,
    maxPrice: 1000000,
    postPrefix: "🐾 Deal thú cưng hôm nay",
    hashtags: "#thucung #shopee #sale #pets #chomeo",
  },
  {
    id: "tools",
    name: "Dụng cụ & Thiết bị",
    emoji: "🔧",
    status: "active",
    description: "Deal dụng cụ và thiết bị điện Shopee — máy khoan, dụng cụ sửa chữa, thiết bị điện giá tốt.",
    metaKeywords: "dụng cụ shopee sale, máy khoan giảm giá, thiết bị điện khuyến mãi, đồ sửa nhà",
    sortOrder: 90,
    shopeeKeywords: ["máy khoan", "đa năng cầm tay", "ổ cắm điện", "đèn pin", "kìm điện", "băng dính điện", "máy mài"],
    atKeywords: ["tools", "dụng cụ", "hardware", "thiết bị"],
    minDiscountPct: 15,
    minPrice: 50000,
    maxPrice: 5000000,
    postPrefix: "🔧 Deal dụng cụ hôm nay",
    hashtags: "#dungcu #thietbi #shopee #sale #tools",
  },
  {
    id: "gaming",
    name: "Gaming & PC",
    emoji: "🎮",
    status: "active",
    description: "Deal gaming và PC Shopee — tai nghe gaming, chuột gaming, ghế gaming, linh kiện máy tính giá tốt.",
    metaKeywords: "tai nghe gaming giảm giá, chuột gaming sale, ghế gaming, bàn phím cơ khuyến mãi, card đồ họa",
    sortOrder: 100,
    shopeeKeywords: ["tai nghe gaming", "chuột gaming", "bàn phím cơ", "ghế gaming", "màn hình gaming", "webcam", "lót chuột gaming"],
    atKeywords: ["gaming", "game", "pc gaming", "esports"],
    minDiscountPct: 10,
    minPrice: 100000,
    maxPrice: 15000000,
    postPrefix: "🎮 Deal gaming hôm nay",
    hashtags: "#gaming #game #shopee #sale #pcgaming",
  },
  {
    id: "books",
    name: "Sách & Văn phòng phẩm",
    emoji: "📚",
    status: "active",
    description: "Deal sách và văn phòng phẩm Shopee — sách kỹ năng, tiểu thuyết, bút vở, đồ dùng học tập giá tốt.",
    metaKeywords: "sách giảm giá shopee, văn phòng phẩm sale, bút vở khuyến mãi, sách kỹ năng sống",
    sortOrder: 110,
    shopeeKeywords: ["sách kỹ năng sống", "sách kinh doanh", "bút bi", "vở học sinh", "máy tính casio", "balo học sinh", "đồ dùng học tập"],
    atKeywords: ["books", "sách", "stationery", "văn phòng phẩm"],
    minDiscountPct: 10,
    minPrice: 20000,
    maxPrice: 1000000,
    postPrefix: "📚 Deal sách hôm nay",
    hashtags: "#sach #vanphongpham #shopee #sale #books",
  },
  {
    id: "health",
    name: "Sức khỏe",
    emoji: "💊",
    status: "active",
    description: "Deal sức khỏe Shopee — vitamin, thực phẩm chức năng, dụng cụ y tế, chăm sóc sức khỏe giảm giá.",
    metaKeywords: "vitamin giảm giá, thực phẩm chức năng sale, máy đo huyết áp, khẩu trang, dụng cụ y tế",
    sortOrder: 120,
    shopeeKeywords: ["vitamin C", "dầu cá omega 3", "máy đo huyết áp", "khẩu trang y tế", "nhiệt kế", "thuốc bổ gan", "collagen"],
    atKeywords: ["health", "sức khỏe", "supplement", "vitamin", "healthcare"],
    minDiscountPct: 15,
    minPrice: 30000,
    maxPrice: 2000000,
    postPrefix: "💊 Deal sức khỏe hôm nay",
    hashtags: "#suckhoe #vitamin #shopee #sale #health",
  },
]

// NicheIntegration: kích hoạt Tiki direct sync cho tất cả ngách.
// atEnabled=false vì chưa có AT campaign cho Tiki; directEnabled=true dùng Tiki public API.
// update:{} — không ghi đè config user đã chỉnh (campaignId, atEnabled, v.v.)
const NICHE_TIKI_INTEGRATIONS = NICHES.map((n) => ({
  id: `${n.id}_tiki`,
  nicheId: n.id,
  platform: "tiki",
  enabled: true,
  atEnabled: false,
  directEnabled: true,
  directFallback: true,
  campaignId: null,
}))

async function main() {
  console.log(`Seeding ${NICHES.length} niches...`)
  for (const niche of NICHES) {
    const { shopeeKeywords, atKeywords, ...rest } = niche
    await prisma.niche.upsert({
      where: { id: niche.id },
      update: {}, // không ghi đè nếu đã tồn tại — bảo toàn config user đã chỉnh
      create: {
        ...rest,
        shopeeKeywords,
        atKeywords,
      },
    })
    console.log(`  ✓ ${niche.emoji} ${niche.name} (${niche.id})`)
  }

  console.log(`Seeding ${NICHE_TIKI_INTEGRATIONS.length} Tiki integrations...`)
  for (const intg of NICHE_TIKI_INTEGRATIONS) {
    await prisma.nicheIntegration.upsert({
      where: { nicheId_platform: { nicheId: intg.nicheId, platform: intg.platform } },
      update: {}, // bảo toàn config user đã chỉnh
      create: {
        id:             intg.id,
        nicheId:        intg.nicheId,
        platform:       intg.platform,
        enabled:        intg.enabled,
        atEnabled:      intg.atEnabled,
        directEnabled:  intg.directEnabled,
        directFallback: intg.directFallback,
        campaignId:     intg.campaignId,
        updatedAt:      new Date(),
      },
    })
    console.log(`  ✓ tiki integration → ${intg.nicheId}`)
  }

  console.log("Seed done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
