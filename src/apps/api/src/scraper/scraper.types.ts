export interface ScraperSourceConfig {
  type: "product-scraper"
  /**
   * Extraction strategy:
   * - "html-selectors"  : CSS selectors on raw HTML (works for simple SSR pages)
   * - "nextjs-data"     : parse __NEXT_DATA__ JSON embedded in Next.js SSR pages
   * - "jsonld-itemlist" : parse JSON-LD <script type="application/ld+json"> with @type=ItemList
   *                       (reliable for sites embedding product schema.org markup)
   */
  strategy?: "html-selectors" | "nextjs-data" | "jsonld-itemlist" | "haravan-json" | "url-list" | "playwright-dom"
  /** Base delay between page requests (ms). Default: 2000 */
  delayMs?: number
  /** Extra request headers (e.g. Referer, Cookie) */
  headers?: Record<string, string>
  /** Category pages to scrape */
  categories: ScraperCategory[]

  // ── html-selectors strategy ────────────────────────────────────────────────
  /** CSS selectors for extracting product data (required for html-selectors) */
  selectors?: ScraperSelectors
  /** Pagination config. Omit for single-page scrape. */
  pagination?: ScraperPagination

  // ── jsonld-itemlist strategy ───────────────────────────────────────────────
  /** Options for the "jsonld-itemlist" strategy */
  jsonld?: {
    /**
     * Regex pattern (with one capture group) to extract externalId from the product URL.
     * Example: "-([0-9]+)\\.html$" extracts "12345" from "ten-sp-12345.html"
     * Falls back to the last URL path segment if omitted.
     */
    idPattern?: string
    /**
     * CSS selector for the product card container used to extract discount %.
     * Each card must contain both a product link (<a href>) and a discount badge.
     * Example: ".product-item"
     */
    cardSelector?: string
    /**
     * CSS selector for the discount badge element within a card.
     * Text content should contain a percentage like "-50%" or "-50".
     * Default: ".style-percent-product"
     */
    discountSelector?: string
  }

  // ── nextjs-data strategy ───────────────────────────────────────────────────
  /**
   * Dot-path to the products array inside __NEXT_DATA__.
   * Example: "props.pageProps.categoryData.products"
   */
  nextjsDataPath?: string
  /**
   * Dot-path to the pagination object inside __NEXT_DATA__.
   * Expected shape: { current: number; last_page: number }
   * Example: "props.pageProps.categoryData.pagination"
   */
  nextjsPaginationPath?: string
  /** How to map fields from each product JSON object to ScrapedProduct */
  nextjsFieldMap?: NextjsFieldMap
  /**
   * URL template for the product page.
   * Placeholders: {baseUrl}, and any field name from the raw JSON object.
   * Example: "{baseUrl}/{subCate}/{slug}"
   */
  productUrlTemplate?: string
  /**
   * Dot-path (inside each product object) to a boolean field.
   * Products where this path resolves to a truthy value are skipped.
   * Example: "teasingInfo.isTeasing"
   */
  skipWhen?: string
  /**
   * Declares how product data is collected for this source.
   * Informational — used by reporting and routing logic.
   * Example: "scraper", "tiki-api", "shopee-api"
   */
  dataSource?: string
  /**
   * Explicit AT campaign merchant slug used for affiliate link matching.
   * Takes priority over auto-derived slug from source.slug or campaign URL.
   * Example: "kingfoodmart" → matches AT campaign where merchant ≈ "KingFoodMart"
   */
  atMerchantSlug?: string

  // ── playwright-dom strategy ───────────────────────────────────────────────
  /**
   * Config cho strategy "playwright-dom" — headless Chromium để bypass WAF/CSR.
   * Pagination dùng chung `pagination` field (type "offset-param" hoặc "page-param").
   */
  playwrightConfig?: {
    /**
     * CSS selector để wait trước khi extract — dùng biết trang đã render xong.
     * Bắt buộc khi không dùng nextjsDataPath; bỏ trống khi dùng nextjsDataPath.
     */
    waitForSelector?: string
    /**
     * CSS selector của product card container.
     * Bắt buộc khi không dùng nextjsDataPath; bỏ trống khi dùng nextjsDataPath.
     */
    cardSelector?: string
    /**
     * Dot-path đến mảng sản phẩm trong `window.__NEXT_DATA__`.
     * Khi set, strategy extract từ __NEXT_DATA__ thay vì DOM selector.
     * Ví dụ: "props.pageProps.products"
     */
    nextjsDataPath?: string
    /**
     * Dot-path đến object pagination trong `window.__NEXT_DATA__`.
     * Cần có field `count` (tổng sản phẩm) và `viewSize` (per page).
     * Ví dụ: "props.pageProps.info"
     */
    nextjsPaginationPath?: string
    /**
     * Field mapping khi dùng nextjsDataPath — dot-path trong mỗi product object.
     * Ví dụ: { externalId: "id", name: "title", price: "priceData.prices.0.value", imageUrl: "image" }
     */
    nextjsFieldMap?: Pick<NextjsFieldMap, "externalId" | "name" | "price" | "imageUrl"> & { url?: string }
    /** CSS selector của link trong card — href là product URL. Default: "a[href]" */
    linkSelector?: string
    /**
     * Regex (1 capture group) để extract externalId từ product URL.
     * Ví dụ: "([A-Z0-9]{4,8})\\.html$" → "B75806" từ ".../B75806.html"
     * Nếu bỏ trống: lấy segment cuối URL trước dấu "."
     */
    externalIdPattern?: string
    /** CSS selector của tên sản phẩm. Default: "[class*='title'], h3, h2, p" */
    nameSelector?: string
    /** CSS selector của giá. Default: parse số + "₫" từ innerText của card */
    priceSelector?: string
    /** CSS selector của ảnh. Default: "img" */
    imageSelector?: string
    /** Thêm milliseconds chờ sau khi trang load (để JS render xong). Default: 0 */
    waitMs?: number
    /** Chạy headless (default: true) */
    headless?: boolean
  }

  // ── url-list strategy ──────────────────────────────────────────────────────
  /**
   * Danh sách URL sản phẩm cố định — dùng với strategy "url-list".
   * Mỗi entry có thể override nicheSlug và externalId riêng.
   *
   * Cần cập nhật thủ công khi:
   *   - url    : sản phẩm bị discontinued, slug URL thay đổi, hoặc thêm sản phẩm mới
   *   - externalId : khi SKU/ID sản phẩm thay đổi (tự parse từ URL nếu bỏ trống)
   *   - nicheSlug  : khi danh mục sản phẩm thay đổi (mặc định = categories[0].nicheSlug)
   */
  urlList?: Array<{
    /** URL trang chi tiết sản phẩm */
    url: string
    /** Override ngách sản phẩm — mặc định dùng categories[0].nicheSlug */
    nicheSlug?: string
    /** External ID cho upsert — tự parse từ segment cuối URL nếu bỏ trống */
    externalId?: string
  }>
}

/** Field mapping for nextjs-data strategy — all values are dot-paths within each product object */
export interface NextjsFieldMap {
  /** Unique product ID (dot-path). Example: "id" */
  externalId: string
  /** Product name (dot-path). Example: "name" */
  name: string
  /**
   * Current/sale price in VND as a number — NOT cents.
   * The engine multiplies by 100. Example: "discountPrice"
   */
  price: string
  /** Original price in VND — present when discounted. Example: "originalPrice" */
  originalPrice?: string
  /** Image URL (dot-path). Example: "thumbnail" */
  imageUrl: string
  /** In-stock indicator — truthy = in stock. Example: "inStock" */
  inStock?: string
}

export interface ScraperCategory {
  /** Unique ID within this source (e.g. "kf-thit-ca") */
  id: string
  /** Human-readable name */
  name: string
  /** Full URL of the category listing page */
  url: string
  /** Maps to Niche.id — products land in this niche */
  nicheSlug: string
}

export interface ScraperSelectors {
  /** Selector that matches each product card container */
  productCard: string
  /** Product name — relative to productCard */
  name: string
  /** Current/sale price text — relative to productCard */
  price: string
  /** Original price text — relative to productCard. Optional. */
  originalPrice?: string
  /** <img> element — tries src, data-src, data-lazy-src */
  image: string
  /** <a> element for the product URL — relative to productCard */
  linkUrl: string
  /** Badge/label text (e.g. "SALE", "-20%") — optional, informational only */
  badge?: string
}

export interface ScraperPagination {
  /**
   * - "page-param"  : append ?page=N to URL (most common)
   * - "offset-param": append ?offset=N*pageSize
   * - "next-link"   : follow href of a "next page" element
   * - "load-more"   : click a button (Playwright only)
   */
  type: "page-param" | "offset-param" | "next-link" | "load-more"
  /** URL parameter name for page-param. Default: "page" */
  pageParam?: string
  /** URL parameter name for offset-param. Default: "offset" */
  offsetParam?: string
  /** Items per page, used with offset-param */
  pageSize?: number
  /** CSS selector for the next-link href element */
  nextSelector?: string
  /** Safety ceiling for pages to fetch. Default: 5 */
  maxPages?: number
}

export interface ScrapedProduct {
  /** SyncSource.slug (e.g. "kingfoodmart") */
  sourceSlug: string
  /** ScraperCategory.id */
  categoryId: string
  /** Niche.id to assign this product to */
  nicheSlug: string
  /** Unique identifier within this source */
  externalId: string
  name: string
  /** Absolute product URL */
  url: string
  imageUrl: string
  /** Price in cents (VND × 100) */
  price: number
  /** Original price in cents — present when there is a discount */
  originalPrice?: number
  inStock?: boolean
}
