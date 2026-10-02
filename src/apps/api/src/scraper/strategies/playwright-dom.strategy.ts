import { Logger } from "@nestjs/common"
import type { ScraperSourceConfig, ScraperCategory, ScrapedProduct as ScrapedProductType } from "../scraper.types"

// ─────────────────────────────────────────────────────────────────────────────
// PlaywrightDomStrategy — headless Chrome để scrape CSR pages và bypass WAF
//
// Hỗ trợ 2 chế độ extract:
//   1. nextjsDataPath  : extract từ window.__NEXT_DATA__ (SSR embedded JSON)
//                        → nhanh, không phụ thuộc hydration, ưu tiên dùng
//   2. cardSelector    : extract từ DOM sau khi React hydrate xong
//                        → chậm hơn, cần waitForSelector
// ─────────────────────────────────────────────────────────────────────────────

export class PlaywrightDomStrategy {
  protected readonly log = new Logger(PlaywrightDomStrategy.name)

  async scrape(
    sourceSlug: string,
    category: ScraperCategory,
    config: ScraperSourceConfig,
  ): Promise<ScrapedProductType[]> {
    const pw = config.playwrightConfig
    const useNextData = Boolean(pw?.nextjsDataPath)

    if (!pw) {
      this.log.warn(`[playwright-dom][${sourceSlug}] Thiếu playwrightConfig`)
      return []
    }
    if (!useNextData && (!pw.cardSelector || !pw.waitForSelector)) {
      this.log.warn(`[playwright-dom][${sourceSlug}] Thiếu nextjsDataPath hoặc (cardSelector + waitForSelector)`)
      return []
    }
    if (useNextData && !pw.nextjsFieldMap) {
      this.log.warn(`[playwright-dom][${sourceSlug}] nextjsDataPath yêu cầu nextjsFieldMap`)
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chromium: any
    try {
      // playwright-extra + stealth để bypass WAF (Akamai, Cloudflare)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { chromium: pwChromium } = require("playwright-extra")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const stealth = require("puppeteer-extra-plugin-stealth")
      pwChromium.use(stealth())
      chromium = pwChromium
    } catch {
      this.log.warn(`[playwright-dom][${sourceSlug}] playwright-extra không có — dùng playwright thường`)
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        chromium = require("playwright").chromium
      } catch {
        this.log.error(`[playwright-dom][${sourceSlug}] Playwright chưa được cài`)
        return []
      }
    }

    // Đọc proxy từ env (SCRAPER_PROXY_URL) — cần thiết cho sites dùng Akamai WAF (adidas.com.vn)
    // Format: http://user:pass@host:port hoặc socks5://host:port
    const proxyUrl = process.env.SCRAPER_PROXY_URL
    const browser = await chromium.launch({
      headless: pw.headless !== false,
      // Dùng Google Chrome thật (fingerprint giống user thật, bypass Akamai WAF)
      channel: "chrome",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
      ],
      ...(proxyUrl ? { proxy: { server: proxyUrl } } : {}),
    })
    if (proxyUrl) {
      this.log.log(`[playwright-dom][${sourceSlug}] Dùng proxy: ${proxyUrl.replace(/:([^@]+)@/, ":***@")}`)
    } else {
      this.log.warn(`[playwright-dom][${sourceSlug}] SCRAPER_PROXY_URL chưa set — có thể bị WAF block (adidas.com.vn cần proxy)`)
    }

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      locale: "vi-VN",
      viewport: { width: 1280, height: 900 },
      extraHTTPHeaders: {
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "sec-ch-ua": '"Chromium";v="125", "Google Chrome";v="125", "Not.A/Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      },
    })

    const allProducts: ScrapedProductType[] = []
    const maxPages      = config.pagination?.maxPages   ?? 5
    const pageSize      = config.pagination?.pageSize   ?? 48
    const offsetParam   = config.pagination?.offsetParam ?? "start"
    const pageParam     = config.pagination?.pageParam   ?? "page"
    const paginationType = config.pagination?.type      ?? "offset-param"

    let totalCount = Infinity  // cập nhật khi nhận được từ __NEXT_DATA__

    try {
      for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
        // Dừng sớm nếu đã lấy đủ theo tổng count
        if (allProducts.length >= totalCount) break

        let pageUrl: string
        if (pageIdx === 0) {
          pageUrl = category.url
        } else if (paginationType === "offset-param") {
          pageUrl = appendParam(category.url, offsetParam, pageIdx * pageSize)
        } else {
          pageUrl = appendParam(category.url, pageParam, pageIdx + 1)
        }

        this.log.debug(`[playwright-dom][${sourceSlug}] Trang ${pageIdx + 1}: ${pageUrl}`)

        const page = await context.newPage()

        // Intercept JSON responses — capture product API calls từ page (backup nếu __NEXT_DATA__ không có)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let interceptedProducts: any[] | null = null
        let interceptedTotal: number | undefined
        page.on("response", async (resp) => {
          if (interceptedProducts) return  // đã có data rồi
          const ct = resp.headers()["content-type"] ?? ""
          if (!ct.includes("application/json")) return
          const url = resp.url()
          if (!url.includes("adidas") && !url.includes("/api/") && !url.includes("/plp")) return
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const body: any = await resp.json()
            // Adidas API có thể trả về { products: [...], count: N }
            if (Array.isArray(body?.products) && body.products.length > 0) {
              interceptedProducts = body.products
              interceptedTotal = body.count ?? body.total ?? body.products.length
              this.log.debug(`[playwright-dom][${sourceSlug}] Intercepted API ${url}: ${interceptedProducts.length} products`)
            }
          } catch { /* ignore */ }
        })

        try {
          await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 })
          this.log.debug(`[playwright-dom][${sourceSlug}] Page loaded: ${await page.title()} | URL: ${page.url()}`)

          if (useNextData) {
            // ── Chế độ __NEXT_DATA__ ──────────────────────────────────────────
            // Chờ __NEXT_DATA__ xuất hiện — Next.js có thể load chậm (hydration) hoặc WAF challenge
            const maxWaitMs = pw.waitMs ?? 500
            let nextDataJson: string | null = null
            try {
              await page.waitForFunction(
                () => !!document.getElementById("__NEXT_DATA__") || !!(window as unknown as Record<string,unknown>).__NEXT_DATA__,
                { timeout: Math.max(maxWaitMs, 8_000) },
              )
              nextDataJson = await page.evaluate(() => {
                const el = document.getElementById("__NEXT_DATA__")
                if (el?.textContent) return el.textContent
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const wd = (window as any).__NEXT_DATA__
                return wd ? JSON.stringify(wd) : null
              })
            } catch {
              // Timeout → WAF challenge hoặc trang không phải Next.js
            }

            // Fallback: dùng intercepted API response nếu __NEXT_DATA__ không có
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let rawProducts: any[] | null = null

            if (nextDataJson) {
              let nextData: unknown
              try {
                nextData = JSON.parse(nextDataJson)
              } catch {
                this.log.warn(`[playwright-dom][${sourceSlug}] __NEXT_DATA__ parse lỗi`)
                break
              }
              const fromNextData = getPath(nextData as Record<string, unknown>, pw.nextjsDataPath!) as unknown[]
              rawProducts = Array.isArray(fromNextData) ? fromNextData : null

              if (rawProducts && pw.nextjsPaginationPath && totalCount === Infinity) {
                const pagInfo = getPath(nextData as Record<string, unknown>, pw.nextjsPaginationPath) as Record<string, number> | undefined
                if (pagInfo?.count) totalCount = pagInfo.count
              }
            } else if (interceptedProducts) {
              rawProducts = interceptedProducts
              if (interceptedTotal && totalCount === Infinity) totalCount = interceptedTotal
              this.log.log(`[playwright-dom][${sourceSlug}] Dùng intercepted API data: ${rawProducts.length} products`)
            }

            if (!rawProducts || rawProducts.length === 0) {
              const snippet = await page.evaluate(() => document.documentElement.innerHTML.substring(0, 300))
              this.log.warn(`[playwright-dom][${sourceSlug}] Không có product data trang ${pageIdx + 1}. HTML: ${snippet}`)
              break
            }
            const fieldMap = pw.nextjsFieldMap!
            const mapped: ScrapedProductType[] = []

            for (const raw of rawProducts) {
              const externalId = String(getPath(raw, fieldMap.externalId) ?? "").trim()
              const name       = String(getPath(raw, fieldMap.name)       ?? "").trim()
              const price      = Number(getPath(raw, fieldMap.price)      ?? 0)
              const imageUrl   = String(getPath(raw, fieldMap.imageUrl)   ?? "")
              const urlRaw     = fieldMap.url ? String(getPath(raw, fieldMap.url) ?? "") : ""
              const productUrl = urlRaw.startsWith("http")
                ? urlRaw
                : `${new URL(pageUrl).origin}${urlRaw}`

              if (!externalId || !name || price <= 0) continue
              mapped.push({
                sourceSlug,
                categoryId: category.id,
                nicheSlug:  category.nicheSlug,
                externalId,
                name,
                url:        productUrl,
                imageUrl,
                price,
                inStock:    true,
              })
            }

            if (mapped.length === 0) {
              this.log.debug(`[playwright-dom][${sourceSlug}] Trang ${pageIdx + 1} không map được sản phẩm — dừng`)
              break
            }

            allProducts.push(...mapped)
            this.log.log(`[playwright-dom][${sourceSlug}] Trang ${pageIdx + 1}: ${mapped.length} sản phẩm (tổng: ${allProducts.length}/${totalCount === Infinity ? "?" : totalCount})`)

            if (mapped.length < pageSize) break
          } else {
            // ── Chế độ DOM selector ───────────────────────────────────────────
            await page.evaluate(() => { window.scrollTo(0, 400); })
            await page.waitForTimeout(2_000)
            await page.evaluate(() => { window.scrollTo(0, 800); })
            await page.waitForTimeout(1_000)
            await page.waitForSelector(pw.waitForSelector!, { timeout: 45_000 })
            if (pw.waitMs) await page.waitForTimeout(pw.waitMs)

            const products: ScrapedProductType[] = await page.evaluate(
              ({ cardSel, linkSel, nameSel, priceSel, imgSel, idPattern, sourceSlug, categoryId, nicheSlug }) => {
                const cards = document.querySelectorAll(cardSel!)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const results: any[] = []

                cards.forEach((card) => {
                  const linkEl = card.querySelector(linkSel ?? "a[href]") as HTMLAnchorElement | null
                  const href = linkEl?.getAttribute("href") ?? ""
                  const productUrl = href.startsWith("http") ? href : `${location.origin}${href}`
                  if (!productUrl || productUrl === location.origin) return

                  let externalId: string
                  if (idPattern) {
                    externalId = productUrl.match(new RegExp(idPattern))?.[1] ?? ""
                  } else {
                    const seg = productUrl.split("/").filter(Boolean).pop() ?? ""
                    externalId = seg.split(".")[0]
                  }
                  if (!externalId) return

                  const nameEl = nameSel
                    ? card.querySelector(nameSel)
                    : card.querySelector("[class*='title'], [class*='name'], h3, h2, p")
                  const name = (nameEl as HTMLElement | null)?.textContent?.trim() ?? ""
                  if (!name) return

                  let price = 0
                  if (priceSel) {
                    const priceEl = card.querySelector(priceSel) as HTMLElement | null
                    price = parseInt((priceEl?.textContent ?? "").replace(/[^\d]/g, ""), 10)
                  }
                  if (price <= 0) {
                    const inner = (card as HTMLElement).innerText ?? ""
                    const m = inner.match(/([\d.,]+)₫/)
                    if (m) price = parseInt(m[1].replace(/[.,]/g, ""), 10)
                  }
                  if (price <= 0) return

                  const imgEl = card.querySelector(imgSel ?? "img") as HTMLImageElement | null
                  const imageUrl = imgEl?.src ?? imgEl?.getAttribute("data-src") ?? ""

                  results.push({ sourceSlug, categoryId, nicheSlug, externalId, name, url: productUrl, imageUrl, price, inStock: true })
                })

                return results
              },
              {
                cardSel:    pw.cardSelector,
                linkSel:    pw.linkSelector,
                nameSel:    pw.nameSelector,
                priceSel:   pw.priceSelector,
                imgSel:     pw.imageSelector,
                idPattern:  pw.externalIdPattern,
                sourceSlug,
                categoryId: category.id,
                nicheSlug:  category.nicheSlug,
              },
            )

            if (products.length === 0) {
              this.log.debug(`[playwright-dom][${sourceSlug}] Trang ${pageIdx + 1} rỗng — dừng`)
              break
            }

            allProducts.push(...products)
            this.log.log(`[playwright-dom][${sourceSlug}] Trang ${pageIdx + 1}: ${products.length} sản phẩm`)

            if (products.length < pageSize) break
          }
        } finally {
          await page.close()
        }
      }
    } finally {
      await browser.close()
    }

    this.log.log(`[playwright-dom][${sourceSlug}] Tổng "${category.name}": ${allProducts.length} sản phẩm`)
    return allProducts
  }
}

/** Dot-path accessor — hỗ trợ array index dưới dạng string ("prices.0.value") */
function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc == null) return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

function appendParam(url: string, key: string, value: number): string {
  const u = new URL(url)
  u.searchParams.set(key, String(value))
  return u.toString()
}
