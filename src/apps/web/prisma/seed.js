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

const SYNC_SOURCES = [
  {
    id: "syncsrc_shopee",
    name: "Shopee",
    slug: "shopee",
    baseUrl: "https://shopee.vn",
    enabled: true,
    description: "Shopee — search sản phẩm theo từ khoá, wrap AT tracking link",
    config: JSON.stringify({
      // "affiliate" = dùng Shopee Affiliate SDK (cần API key riêng)
      // "at"        = wrap URL bằng AccessTrade tracking link (như Tiki)
      mode: "affiliate",
      // keywords: slug ngách → danh sách từ khoá search Shopee
      keywords: {
        fashion:     ["áo thun nam", "váy nữ", "giày sneaker", "túi xách nữ", "quần jean nam", "áo khoác", "đầm dự tiệc"],
        electronics: ["tai nghe bluetooth", "ốp lưng điện thoại", "sạc dự phòng", "cáp sạc", "bàn phím cơ", "chuột gaming", "loa bluetooth"],
        beauty:      ["kem dưỡng ẩm", "serum vitamin c", "son môi", "kem chống nắng", "sữa rửa mặt", "toner", "mặt nạ dưỡng da"],
        home:        ["nồi chiên không dầu", "máy lọc không khí", "đèn ngủ", "chăn ga gối", "thùng rác thông minh", "giá để đồ", "máy xay sinh tố"],
        sports:      ["giày chạy bộ", "tạ tập gym", "thảm yoga", "dây kháng lực", "bình nước gym", "quần legging", "áo tập gym"],
        kids:        ["đồ chơi trẻ em", "quần áo trẻ em", "tã bỉm", "sữa tắm trẻ em", "xe đẩy em bé", "ghế ngồi ăn", "bình sữa"],
        food:        ["cà phê", "trà sữa", "snack ăn vặt", "mỳ ăn liền", "nước tương", "yến mạch", "protein shake"],
        pets:        ["thức ăn chó", "thức ăn mèo", "cát vệ sinh mèo", "vòng cổ thú cưng", "đồ chơi chó mèo", "bát ăn thú cưng"],
        tools:       ["máy khoan", "đa năng cầm tay", "ổ cắm điện", "đèn pin", "kìm điện", "băng dính điện", "máy mài"],
        gaming:      ["tai nghe gaming", "chuột gaming", "bàn phím cơ", "ghế gaming", "màn hình gaming", "webcam", "lót chuột gaming"],
        books:       ["sách kỹ năng sống", "sách kinh doanh", "bút bi", "vở học sinh", "máy tính casio", "balo học sinh", "đồ dùng học tập"],
        health:      ["vitamin C", "dầu cá omega 3", "máy đo huyết áp", "khẩu trang y tế", "nhiệt kế", "thuốc bổ gan", "collagen"],
      },
    }),
  },
  {
    id: "syncsrc_lazada",
    name: "Lazada",
    slug: "lazada",
    baseUrl: "https://lazada.vn",
    enabled: false,
    description: "Lazada — search sản phẩm theo từ khoá, wrap AT tracking link",
    config: JSON.stringify({
      // "affiliate" = dùng Lazada Affiliate API (cần API key riêng)
      // "at"        = wrap URL bằng AccessTrade tracking link
      mode: "affiliate",
      // keywords: slug ngách → danh sách từ khoá search Lazada
      keywords: {
        fashion:     ["áo thun nam", "váy nữ", "giày sneaker", "túi xách nữ", "quần jean nam", "áo khoác", "đầm dự tiệc"],
        electronics: ["tai nghe bluetooth", "ốp lưng điện thoại", "sạc dự phòng", "cáp sạc", "bàn phím cơ", "chuột gaming", "loa bluetooth"],
        beauty:      ["kem dưỡng ẩm", "serum vitamin c", "son môi", "kem chống nắng", "sữa rửa mặt", "toner", "mặt nạ dưỡng da"],
        home:        ["nồi chiên không dầu", "máy lọc không khí", "đèn ngủ", "chăn ga gối", "thùng rác thông minh", "giá để đồ", "máy xay sinh tố"],
        sports:      ["giày chạy bộ", "tạ tập gym", "thảm yoga", "dây kháng lực", "bình nước gym", "quần legging", "áo tập gym"],
        kids:        ["đồ chơi trẻ em", "quần áo trẻ em", "tã bỉm", "sữa tắm trẻ em", "xe đẩy em bé", "ghế ngồi ăn", "bình sữa"],
        food:        ["cà phê", "trà sữa", "snack ăn vặt", "mỳ ăn liền", "nước tương", "yến mạch", "protein shake"],
        pets:        ["thức ăn chó", "thức ăn mèo", "cát vệ sinh mèo", "vòng cổ thú cưng", "đồ chơi chó mèo", "bát ăn thú cưng"],
        tools:       ["máy khoan", "đa năng cầm tay", "ổ cắm điện", "đèn pin", "kìm điện", "băng dính điện", "máy mài"],
        gaming:      ["tai nghe gaming", "chuột gaming", "bàn phím cơ", "ghế gaming", "màn hình gaming", "webcam", "lót chuột gaming"],
        books:       ["sách kỹ năng sống", "sách kinh doanh", "bút bi", "vở học sinh", "máy tính casio", "balo học sinh", "đồ dùng học tập"],
        health:      ["vitamin C", "dầu cá omega 3", "máy đo huyết áp", "khẩu trang y tế", "nhiệt kế", "thuốc bổ gan", "collagen"],
      },
    }),
  },
  {
    id: "syncsrc_tiki",
    name: "Tiki",
    slug: "tiki",
    baseUrl: "https://tiki.vn",
    enabled: true,
    description: "Tiki — gọi thẳng Tiki public API, wrap AT tracking link",
    config: JSON.stringify({
      tikiBatchSize: 2,
      tikiBatchPauseMin: 15,
      tikiInterNicheDelaySec: 15,
      tikiMaxPages: 2,
      // Category IDs Tiki — dùng slug ngách làm key, giá trị là mảng số.
      // Ngách không có entry → tự động dùng keyword search.
      // Kiểm tra ID tại: tiki.vn/api/v2/products?category=<id>
      categoryIds: {
        electronics: [4221],
        beauty:      [1520],
        home:        [1883],
        sports:      [1975],
        kids:        [2549],
        food:        [4384],
        books:       [8322],
        health:      [2322],
        fashion:     [931, 1703, 1686],
        pets:        [5451],
        gaming:      [2667, 12672],
        tools:       [1974],
      },
    }),
  },
  {
    id: "syncsrc_kingfoodmart",
    name: "KingFoodMart",
    slug: "kingfoodmart",
    baseUrl: "https://kingfoodmart.com",
    enabled: true,
    description: "KingFoodMart — Next.js SSR, đọc __NEXT_DATA__ JSON, không cần CSS selectors",
    config: JSON.stringify({
      type: "scraper",
      dataSource: "scraper",
      atMerchantSlug: "kingfoodmart",
      // Đọc __NEXT_DATA__ JSON nhúng trong HTML thay vì CSS selectors
      // → ổn định hơn nhiều, không bị vỡ khi site thay đổi giao diện
      strategy: "nextjs-data",
      delayMs: 2500,
      headers: {
        "Referer": "https://kingfoodmart.com/",
      },
      // __NEXT_DATA__.props.pageProps.categoryData.products
      nextjsDataPath: "props.pageProps.categoryData.products",
      // pagination.last_page cho biết tổng số trang
      nextjsPaginationPath: "props.pageProps.categoryData.pagination",
      // Map các field trong JSON object của mỗi sản phẩm
      nextjsFieldMap: {
        externalId:    "id",
        name:          "name",
        price:         "discountPrice",   // VND (không phải cents) — engine × 100
        originalPrice: "originalPrice",   // VND
        imageUrl:      "thumbnail",
        inStock:       "inStock",
      },
      // URL sản phẩm = baseUrl + subCate + slug
      // {baseUrl}, {subCate}, {slug} là placeholder — engine thay bằng giá trị từ JSON
      productUrlTemplate: "{baseUrl}/{subCate}/{slug}",
      // Bỏ qua sản phẩm "Sắp mở bán" — teasingInfo là object != null khi chưa mở bán
      skipWhen: "teasingInfo",
      // Các category cần scrape — thêm/bớt tuỳ nhu cầu
      categories: [
        { id: "kfm-thit-ca",     name: "Thịt, cá, trứng, hải sản",    url: "https://kingfoodmart.com/thit-ca-trung-thuy-hai-san", nicheSlug: "food" },
        { id: "kfm-rau-cu",      name: "Rau củ quả",                   url: "https://kingfoodmart.com/rau-cu-qua",                 nicheSlug: "food" },
        { id: "kfm-trai-cay",    name: "Trái cây",                     url: "https://kingfoodmart.com/trai-cay",                   nicheSlug: "food" },
        { id: "kfm-sua-bo",      name: "Sữa, bơ, phô mai",             url: "https://kingfoodmart.com/sua-bo-pho-mai",             nicheSlug: "food" },
        { id: "kfm-gao-kho",     name: "Gạo, đậu, bột, đồ khô",       url: "https://kingfoodmart.com/gao-dau-bot-do-kho",         nicheSlug: "food" },
        { id: "kfm-gia-vi",      name: "Dầu ăn, nước chấm, gia vị",   url: "https://kingfoodmart.com/dau-an-nuoc-cham-gia-vi",    nicheSlug: "food" },
        { id: "kfm-mi-hop",      name: "Mì gói, xúc xích, đồ hộp",    url: "https://kingfoodmart.com/mi-goi-xuc-xich-do-hop",     nicheSlug: "food" },
        { id: "kfm-banh-keo",    name: "Bánh kẹo, ăn vặt",             url: "https://kingfoodmart.com/banh-keo-an-vat",            nicheSlug: "food" },
        { id: "kfm-nuoc-uong",   name: "Trà, cà phê, nước giải khát", url: "https://kingfoodmart.com/tra-ca-phe-nuoc-giai-khat",  nicheSlug: "food" },
        { id: "kfm-dong-mat",    name: "Thực phẩm đông mát",           url: "https://kingfoodmart.com/thuc-pham-dong-mat",         nicheSlug: "food" },
      ],
      // pagination tự động đọc từ nextjsPaginationPath.last_page
      // Giới hạn 3 trang/category để tránh quá tải — tăng lên nếu cần
      pagination: {
        type: "page-param",
        pageParam: "page",
        maxPages: 3,
      },
    }),
  },
]

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
      update: {},
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

  console.log(`Seeding ${SYNC_SOURCES.length} sync sources...`)
  for (const src of SYNC_SOURCES) {
    await prisma.syncSource.upsert({
      where: { slug: src.slug },
      update: {}, // bảo toàn config user đã chỉnh
      create: src,
    })
    console.log(`  ✓ SyncSource: ${src.name} (${src.slug})`)
  }

  const SYNC_JOBS = [
    { key: "product_sync",   name: "Đồng bộ sản phẩm" },
    { key: "coupon_sync",    name: "Đồng bộ Coupon/Voucher" },
    { key: "platform_match", name: "Matching đa sàn" },
    { key: "coupon_expire",  name: "Hết hạn Coupon" },
    { key: "embedding_gen",  name: "Tạo Vector Embedding" },
    { key: "auto_classify",  name: "AI Phân loại sản phẩm" },
    { key: "price_analysis", name: "Phân tích & Dự đoán giá" },
    { key: "seo_gen",        name: "Tạo SEO Metadata" },
    { key: "zalo_broadcast", name: "Broadcast Zalo OA" },
  ]
  console.log(`Seeding ${SYNC_JOBS.length} sync jobs...`)
  for (const job of SYNC_JOBS) {
    await prisma.syncJob.upsert({
      where: { key: job.key },
      update: {},
      create: { key: job.key, name: job.name, config: "{}" },
    })
    console.log(`  ✓ SyncJob: ${job.name} (${job.key})`)
  }

  console.log("Seed done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
