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
  {
    id: "finance",
    name: "Tài chính",
    emoji: "💰",
    status: "active",
    description: "Vay tín chấp online, thẻ tín dụng, bảo hiểm — giải pháp tài chính cá nhân lãi suất tốt nhất.",
    metaKeywords: "vay tín chấp online, vay tiền nhanh không thế chấp, thẻ tín dụng miễn phí, bảo hiểm nhân thọ, vay ngân hàng",
    sortOrder: 130,
    postPrefix: "💰 Ưu đãi tài chính hôm nay",
    hashtags: "#taichinh #vaytinchap #nganhang #thetindung #finance",
  },
  {
    id: "travel",
    name: "Du lịch & Di chuyển",
    emoji: "🚌",
    status: "active",
    description: "Đặt vé xe khách, máy bay, tàu hỏa online — giá tốt nhất, flash sale mỗi ngày.",
    metaKeywords: "đặt vé xe khách online, vé máy bay giá rẻ, vé tàu hỏa, thuê xe du lịch, vexere giảm giá",
    sortOrder: 140,
    postPrefix: "🚌 Deal du lịch hôm nay",
    hashtags: "#dulich #dichcuyen #vexere #veXe #travel",
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

// NicheIntegration: CellphoneS chỉ có sản phẩm cho electronics và gaming.
const NICHE_CELLPHONES_INTEGRATIONS = [
  { id: "electronics_cellphones", nicheId: "electronics", platform: "cellphones" },
  { id: "gaming_cellphones",      nicheId: "gaming",      platform: "cellphones" },
].map((n) => ({
  ...n,
  enabled: true,
  atEnabled: false,
  directEnabled: true,
  directFallback: false,
  campaignId: null,
}))

const SYNC_SOURCES = [
  {
    id: "syncsrc_shopee",
    name: "Shopee",
    slug: "shopee",
    baseUrl: "https://shopee.vn",
    icon: "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/icon_favicon_1_96.1ce0e05fc18a86e5.png",
    enabled: false,
    description: "Shopee — Googlebot scrape + an_redir affiliate link (syncMode=scrape)",
    config: JSON.stringify({
      type: "platform-sync",
      badge: { label: "Shopee", bg: "bg-orange-100", text: "text-orange-700" },
      // syncMode: "scrape" — Googlebot scrape shopee.vn + tạo link qua an_redir (chỉ cần affiliateId)
      // syncMode: "api"    — Shopee Affiliate Open API (cần SHOPEE_AFFILIATE_APP_ID + APP_SECRET)
      // Để đổi sang API chính thức khi có app_id/secret: chỉ cần sửa syncMode thành "api"
      syncMode: "scrape",
      // affiliateId: lấy từ affiliate.shopee.vn → Tài khoản của tôi → ID
      // Nếu không set ở đây, fallback lấy từ env var SHOPEE_AFFILIATE_ID
      affiliateId: "17372510071",
      scrapeMaxPages: 2,
      scrapeDelayMs: 2000,
      // keywords: niche slug → mảng keyword search Shopee
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
    icon: "https://img.lazcdn.com/g/tps/images/ims-web/TB1T7K2d8Cw3KVjSZFuXXcAOpXa.png",
    enabled: false,
    description: "Lazada — lấy sản phẩm qua AccessTrade /v1/offers feed (offer-sync, cần ACCESSTRADE_ACCESS_KEY)",
    config: JSON.stringify({
      type: "offer-sync",
      badge: { label: "Lazada", bg: "bg-purple-100", text: "text-purple-700" },
    }),
  },
  {
    id: "syncsrc_tiki",
    name: "Tiki",
    slug: "tiki",
    baseUrl: "https://tiki.vn",
    icon: "https://salt.tikicdn.com/ts/upload/9f/9b/d0/6ce302126e0a4d958a41d90fed1eb4f6.png",
    enabled: true,
    description: "Tiki — gọi thẳng Tiki public API, wrap AT tracking link",
    config: JSON.stringify({
      type: "platform-sync",
      badge: { label: "Tiki", bg: "bg-blue-100", text: "text-blue-700" },
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
    id: "syncsrc_cellphones",
    name: "CellphoneS",
    slug: "cellphones",
    baseUrl: "https://cellphones.com.vn",
    icon: "https://cdn2.cellphones.com.vn/200x/media/favicon/default/logo-cps.png",
    enabled: true,
    description: "CellphoneS — GraphQL API, wrap AT tracking link",
    config: JSON.stringify({
      type: "graphql-sync",
      // atCampaignId: "<AT campaign ID>" — để trống thì auto-match theo tên "cellphones"
      // CellphoneS dùng GraphQL API, wrap AT tracking link
      // categoryIds: CPS category IDs — mobile:3, audio:220, smartwatch:610, tablet:4, laptop:380
      categories: [
        { id: "cps-electronics", name: "Điện tử",  nicheSlug: "electronics", categoryIds: ["3", "220", "610", "4"] },
        { id: "cps-gaming",      name: "Gaming",   nicheSlug: "gaming",      categoryIds: ["380"] },
      ],
      pageSize: 20,
      maxPages: 2,
      provinceId: 30, // HCM
    }),
  },
  {
    id: "syncsrc_kingfoodmart",
    name: "KingFoodMart",
    slug: "kingfoodmart",
    baseUrl: "https://kingfoodmart.com",
    icon: "https://kingfoodmart.com/assets/images/logo/home-kfm.svg",
    enabled: true,
    description: "KingFoodMart — Next.js SSR, đọc __NEXT_DATA__ JSON, không cần CSS selectors",
    config: JSON.stringify({
      type: "product-scraper",
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
  {
    id: "syncsrc_tch",
    name: "The Coffee House",
    slug: "tch",
    baseUrl: "https://www.thecoffeehouse.com",
    icon: "https://thecoffeehouse.com/icon/tch-app-icon-192.png",
    enabled: true,
    description: "The Coffee House — scrape trang promo, tạo AT tracking link (CPS/Smartlink)",
    config: JSON.stringify({
      type: "coupon-scraper",
      badge: { label: "TCH", bg: "bg-green-100", text: "text-green-700" },
      parser: "tch-promo",
      promoUrl: "https://promothecoffeeehouse.com.vn/",
      // atMerchantSlug: khớp với field `merchant` trong bảng AtCampaign
      // → service tự lookup campaign ID từ DB thay vì hardcode
      atMerchantSlug: "thecoffeehouse_cpv",
      merchant: "The Coffee House",
      merchantLogo: "https://thecoffeehouse.com/icon/tch-app-icon-192.png",
      nicheId: "food",
      platform: "tch",
    }),
  },
  {
    id: "syncsrc_vpbank_vaytinchap",
    name: "VPBank Vay Tín Chấp",
    slug: "vpbank-vaytinchap",
    baseUrl: "https://vayonline.vpbank.com.vn",
    icon: "https://content.accesstrade.vn/adv/1775708523_avatar_1775708523.jpg",
    enabled: true,
    description: "Vay tín chấp VPBank online — không cần tài sản thế chấp, lãi từ 1.2%/tháng, giải ngân nhanh lên đến 200 triệu.",
    config: JSON.stringify({
      type: "lead-campaign",
      // atMerchantSlug: khớp với field merchant trong AtCampaign → service dùng để match & wrap link
      atMerchantSlug: "vpbank3t_vaytinchap",
      // landingUrl: trang đăng ký ổn định (không phải CTKM theo tháng) → được wrap thành affiliateUrl
      landingUrl: "https://vayonline.vpbank.com.vn/",
      // nicheId: dùng khi upsert vào Coupon để public site filter theo ngách
      nicheId: "finance",
      badge: { label: "VPBank", bg: "bg-blue-100", text: "text-blue-700" },
      cta: "Đăng ký vay ngay",
      // Data display (commission, description, logoUrl...) được LeadCampaignSyncService
      // lấy từ AtCampaign rồi upsert vào bảng Coupon — không lưu ở đây
    }),
  },
  {
    id: "syncsrc_vascara",
    name: "Vascara",
    slug: "vascara",
    baseUrl: "https://www.vascara.com",
    icon: "https://www.vascara.com/uploads/web/900/Logo/vascara.png",
    enabled: true,
    description: "Vascara — HTML scraper (custom template, không phải Next.js), wrap AT tracking link (CPS)",
    config: JSON.stringify({
      type: "product-scraper",
      strategy: "html-selectors",
      // atMerchantSlug: normalizeSlug(c.merchant) phải khớp với "vascara"
      // → kiểm tra field merchant trong AtCampaign table sau khi import AT campaigns
      atMerchantSlug: "vascara",
      delayMs: 2500,
      headers: {
        "Referer": "https://www.vascara.com/",
      },
      selectors: {
        productCard:   ".product-item",
        name:          "h2.title-product a",
        price:         ".price .ins",
        originalPrice: ".price .del",
        image:         ".product-thuml img",
        linkUrl:       "h2.title-product a",
      },
      pagination: {
        type:     "page-param",
        pageParam: "page",
        maxPages: 3,
      },
      categories: [
        { id: "vsc-giay-cao-got", name: "Giày cao gót",  url: "https://www.vascara.com/giay/giay-cao-got",      nicheSlug: "fashion" },
        { id: "vsc-giay-sandals", name: "Giày sandals",  url: "https://www.vascara.com/giay/giay-sandals",      nicheSlug: "fashion" },
        { id: "vsc-giay-bit",     name: "Giày bít",      url: "https://www.vascara.com/giay/giay-bit",          nicheSlug: "fashion" },
        { id: "vsc-giay-bup-be",  name: "Giày búp bê",   url: "https://www.vascara.com/giay/giay-bup-be",       nicheSlug: "fashion" },
        { id: "vsc-giay-sneaker", name: "Giày sneaker",  url: "https://www.vascara.com/giay/giay-sneaker",      nicheSlug: "fashion" },
        { id: "vsc-giay-boots",   name: "Giày boots",    url: "https://www.vascara.com/giay/giay-boots",        nicheSlug: "fashion" },
        { id: "vsc-tui-xach",     name: "Túi xách",      url: "https://www.vascara.com/tui-xach",               nicheSlug: "fashion" },
        { id: "vsc-vi-bop",       name: "Ví bóp",        url: "https://www.vascara.com/vi-bop",                 nicheSlug: "fashion" },
        { id: "vsc-mat-kinh",     name: "Mắt kính",      url: "https://www.vascara.com/mat-kinh-vascara",       nicheSlug: "fashion" },
      ],
    }),
  },
  {
    id: "syncsrc_concung",
    name: "Con Cưng",
    slug: "concung",
    baseUrl: "https://www.concung.com",
    icon: "https://www.concung.com/themes/images/v50/icon/logo.png",
    enabled: true,
    description: "Con Cưng — chuỗi bán lẻ mẹ & bé, đọc JSON-LD ItemList nhúng trong HTML danh mục, wrap AT tracking link (CPS)",
    config: JSON.stringify({
      type: "product-scraper",
      // Con Cưng nhúng dữ liệu sản phẩm vào JSON-LD schema.org ItemList trong HTML tĩnh.
      // Stable hơn css-selector: không bị vỡ khi site thay đổi giao diện.
      strategy: "jsonld-itemlist",
      // atMerchantSlug không đặt → tự match qua domainSlug(campaign.url) === "concung"
      delayMs: 2000,
      headers: {
        "Referer": "https://www.concung.com/",
      },
      jsonld: {
        // <script type="application/ld+json"> với @type = "ItemList"
        // item.url, item.name, item.image, item.offers.price
        // productId được extract từ URL: /{category}/{slug}-{id}.html
        idPattern: "-([0-9]+)\\.html$",   // capture group 1 = externalId
        // Mỗi card sản phẩm trong HTML có badge discount (-50%) → dùng để tính originalPrice
        cardSelector: ".product-item",
        discountSelector: ".style-percent-product",
      },
      pagination: {
        // Sản phẩm trên 1 trang category ≈ 49 (JSON-LD) — không cần phân trang
        // nếu muốn fetch thêm: type "page-param", pageParam "page", maxPages 3
        type: "none",
      },
      categories: [
        { id: "cc-do-choi-tre-em",    name: "Đồ chơi trẻ em",    url: "https://www.concung.com/do-choi-tre-em-101489.html",     nicheSlug: "kids" },
        { id: "cc-sua-bot",           name: "Sữa bột & sữa nước", url: "https://www.concung.com/sua-bot-sua-nuoc-101259.html",   nicheSlug: "kids" },
        { id: "cc-do-choi-em-be",     name: "Đồ chơi em bé",     url: "https://www.concung.com/do-choi-em-be-1013.html",        nicheSlug: "kids" },
        { id: "cc-cho-be-an",         name: "Cho bé ăn",          url: "https://www.concung.com/cho-be-an-1014.html",            nicheSlug: "kids" },
        { id: "cc-xe-day",            name: "Xe đẩy & xe tập đi", url: "https://www.concung.com/xe-day-101426.html",            nicheSlug: "kids" },
        { id: "cc-be-ngu",            name: "Đồ dùng bé ngủ",    url: "https://www.concung.com/do-dung-be-ngu-101201.html",     nicheSlug: "kids" },
      ],
      // Voucher scraping chạy cùng lúc với product sync (1 AT campaign)
      coupon: {
        parser: "concung-voucher",
        promoUrl: "https://concung.com/landingpages-chuong-trinh-uu-dai.html",
        voucherFetchUrl: "https://concung.com/do-dung-be-ngu/goi-cho-be-organic-size-23x35cm-ku2053-10477.html",
        atMerchantSlug: "concung",
        merchant: "Con Cưng",
        merchantLogo: "https://www.concung.com/themes/images/v50/icon/logo.png",
        nicheId: "kids",
        // platform = source.slug ("concung") — tự động inject trong loadCouponScraperSources
      },
    }),
  },
  {
    id: "syncsrc_vexere",
    name: "Vexere",
    slug: "vexere",
    baseUrl: "https://vexere.com",
    icon: "https://content.accesstrade.vn/adv/1705433645_avatar_1705433645.png",
    enabled: true,
    description: "Đặt vé xe khách, máy bay, tàu hỏa online nhanh chóng — giá tốt nhất, flash sale mỗi ngày, thanh toán qua ví điện tử tiện lợi.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "vexere",
      landingUrl: "https://vexere.com/",
      nicheId: "travel",
      badge: { label: "Vexere", bg: "bg-sky-100", text: "text-sky-700" },
      cta: "Đặt vé ngay",
    }),
  },
  {
    id: "syncsrc_vietnamairlines",
    name: "Vietnam Airlines",
    slug: "vietnamairlines",
    baseUrl: "https://www.vietnamairlines.com",
    icon: "https://content.accesstrade.vn/adv/1706241920_avatar_1706241920.png",
    enabled: true,
    description: "Đặt vé máy bay Vietnam Airlines — hàng không quốc gia, phủ khắp 21 tỉnh thành và nhiều đường bay quốc tế.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "vietnamairlines_web",
      landingUrl: "https://www.vietnamairlines.com/vn/vi/home",
      nicheId: "travel",
      badge: { label: "VNA", bg: "bg-blue-100", text: "text-blue-700" },
      cta: "Đặt vé ngay",
    }),
  },
  {
    id: "syncsrc_ngocdung_tmv",
    name: "Thẩm Mỹ Viện Ngọc Dung",
    slug: "ngocdung-tmv",
    baseUrl: "https://thammyvienngocdung.com",
    icon: "https://content.accesstrade.vn/adv/1775040954_avatar_1775040954.jpeg",
    enabled: true,
    description: "Phun xăm thẩm mỹ, điều trị nám, trị mụn, triệt lông — công nghệ nhập khẩu chuẩn FDA, phác đồ cá nhân hóa cho từng khách hàng.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "ngocdung_tmv",
      landingUrl: "https://thammyvienngocdung.com/",
      nicheId: "beauty",
      badge: { label: "Ngọc Dung", bg: "bg-pink-100", text: "text-pink-700" },
      cta: "Đăng ký tư vấn",
    }),
  },
  {
    id: "syncsrc_shopeefood_taixe",
    name: "Shopee Food Tài xế",
    slug: "shopeefood-taixe",
    baseUrl: "https://shopeefood.vn",
    icon: "https://content.accesstrade.vn/adv/1773222773_avatar_1773222773.png",
    enabled: true,
    description: "Trở thành tài xế ShopeeFood — thời gian linh hoạt 100%, thu nhập hấp dẫn, thưởng hàng tuần, hỗ trợ đối tác 24/7.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "shopeefood_taixe",
      landingUrl: "https://hikc.caiapp.online/",
      nicheId: "food",
      badge: { label: "ShopeeFood", bg: "bg-orange-100", text: "text-orange-700" },
      cta: "Đăng ký tài xế",
    }),
  },
  {
    id: "syncsrc_ila_vietnam",
    name: "ILA Education",
    slug: "ila-vietnam",
    baseUrl: "https://ila.edu.vn",
    icon: "https://content.accesstrade.vn/adv/1785469727_avatar_1785469727.jpg",
    enabled: true,
    description: "Tiếng Anh cho bé 3–16 tuổi theo chuẩn quốc tế — hơn 25 năm kinh nghiệm, phương pháp truyền cảm hứng, bé tự tin giao tiếp toàn cầu.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "ila_vietnam",
      landingUrl: "https://ila.edu.vn/tieng-anh-cho-be/",
      nicheId: "kids",
      badge: { label: "ILA", bg: "bg-yellow-100", text: "text-yellow-700" },
      cta: "Đăng ký học thử",
    }),
  },
  {
    id: "syncsrc_at_referral",
    name: "ACCESSTRADE Referral",
    slug: "at-referral",
    baseUrl: "https://accesstradevn.com",
    icon: "https://content.accesstrade.vn/adv/1719480490_avatar_1719480490.png",
    enabled: true,
    description: "Giới thiệu bạn bè đăng ký ACCESSTRADE — nhận hoa hồng không giới hạn từ 3 tầng khi người được giới thiệu phát sinh đơn thành công.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "oneat_referral_firebase",
      landingUrl: "https://accesstradevn.com/",
      // Link referral cá nhân — dùng thẳng, không tạo tracking link mới
      fixedAffiliateUrl: "https://shorten.asia/J4VqwHFM",
      nicheId: null,
      badge: { label: "ACCESSTRADE", bg: "bg-green-100", text: "text-green-700" },
      cta: "Giới thiệu ngay",
    }),
  },
  {
    id: "syncsrc_dingtea",
    name: "Ding Tea",
    slug: "dingtea",
    baseUrl: "https://dingtea.vn",
    icon: "https://dingtea.vn/images/logospare.png",
    enabled: true,
    description: "Trà sữa Đài Loan chính gốc Ding Tea — topping đặc trưng, nguyên liệu nhập khẩu, hơn 100 chi nhánh toàn quốc.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "dingtea",
      landingUrl: "https://dingtea.vn/",
      nicheId: "food",
      badge: { label: "Ding Tea", bg: "bg-purple-100", text: "text-purple-700" },
      cta: "Đặt trà sữa ngay",
    }),
  },
  {
    id: "syncsrc_chickita",
    name: "Chickita",
    slug: "chickita",
    baseUrl: "https://chickita.com.vn",
    icon: "https://chickita.com.vn/wp-content/uploads/2023/01/Thumbnail.jpeg",
    enabled: true,
    description: "Gà nướng lửa hồng Chickita — sốt độc quyền 8 loại, nguyên liệu chọn lọc từ nông trại, phù hợp gia đình với nhiều chi nhánh khắp TP.HCM.",
    config: JSON.stringify({
      type: "lead-campaign",
      atMerchantSlug: "chickita_voucher",
      landingUrl: "https://chickita.com.vn/",
      nicheId: "food",
      badge: { label: "Chickita", bg: "bg-amber-100", text: "text-amber-700" },
      cta: "Nhận ưu đãi",
    }),
  },
]

async function main() {
  console.log(`Seeding ${NICHES.length} niches...`)
  for (const niche of NICHES) {
    const { shopeeKeywords, atKeywords, ...rest } = niche
    await prisma.category.upsert({
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

  console.log(`Seeding ${NICHE_CELLPHONES_INTEGRATIONS.length} CellphoneS integrations...`)
  for (const intg of NICHE_CELLPHONES_INTEGRATIONS) {
    await prisma.nicheIntegration.upsert({
      where: { nicheId_platform: { nicheId: intg.nicheId, platform: intg.platform } },
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
    console.log(`  ✓ cellphones integration → ${intg.nicheId}`)
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

  // ── Merge Con Cưng: gộp coupon sub-config vào product source, xóa source riêng ──
  const concungSrc = await prisma.syncSource.findUnique({ where: { slug: "concung" } })
  if (concungSrc) {
    const cfg = JSON.parse(concungSrc.config)
    if (!cfg.coupon) {
      // Force-update để thêm coupon sub-block vào config đã tồn tại
      const merged = SYNC_SOURCES.find(s => s.slug === "concung")
      if (merged) {
        await prisma.syncSource.update({ where: { slug: "concung" }, data: { config: merged.config } })
        console.log("  ✓ Merged coupon sub-config vào syncsrc_concung")
      }
    }
  }
  const oldCouponSrc = await prisma.syncSource.findUnique({ where: { slug: "concung-coupon" } })
  if (oldCouponSrc) {
    await prisma.coupon.updateMany({ where: { platform: "concung-coupon" }, data: { platform: "concung" } })
    await prisma.syncSource.delete({ where: { slug: "concung-coupon" } })
    console.log("  ✓ Migrated concung-coupon → concung, xóa source cũ")
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

  const APP_SETTINGS = [
    { key: "trendingCount", value: "20" },
    { key: "store_settings", value: JSON.stringify({ footerCategoryLimit: 0 }) },
  ]
  console.log(`Seeding ${APP_SETTINGS.length} app settings...`)
  for (const setting of APP_SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    })
    console.log(`  ✓ AppSetting: ${setting.key} = ${setting.value}`)
  }

  console.log("Seed done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
