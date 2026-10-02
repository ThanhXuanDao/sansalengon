/**
 * Affiliate Admin Helper — background service worker
 *
 * Nhiệm vụ:
 *  1. Inject injector.js vào mọi tab shopee.vn (kể cả SPA navigation)
 *  2. Nhận bulk captures từ bridge → POST tới NestJS /sync/extension-bulk-capture
 *  3. Single-product mode: injector.js tự xử lý qua window.opener.postMessage — không cần background
 *
 * Config: đọc từ config.js (generated từ src/.env.local bởi scripts/gen-extension-config.mjs)
 *  • self.AFFILIATE_CONFIG.apiUrl  — mặc định http://localhost:4000
 *  • self.AFFILIATE_CONFIG.apiKey  — API_INTERNAL_SECRET từ .env.local
 */

try {
  importScripts('config.js');
} catch (e) {
  console.warn('[AH:bg] config.js không tìm thấy — chạy: node scripts/gen-extension-config.mjs');
  console.warn('[AH:bg] Fallback: dùng localhost:4000, apiKey rỗng (chỉ OK khi server không yêu cầu auth)');
}

var LOG = '[AH:bg]';
var _cfg = (typeof self !== 'undefined' && self.AFFILIATE_CONFIG) || {};
var DEFAULT_API_URL = 'http://localhost:4000';

function getConfig() {
  return {
    apiUrl: (_cfg.apiUrl || DEFAULT_API_URL).replace(/\/$/, ''),
    apiKey: _cfg.apiKey || '',
  };
}

// ── Inject injector.js ───────────────────────────────────────────────────────

function injectIfShopee(tabId, url) {
  if (!url || !url.includes('shopee.vn')) return;
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['injector.js'],
    world: 'MAIN',
    injectImmediately: true,
  }).then(function () {
    console.debug(LOG, 'injected into tab', tabId, url.split('?')[0].split('/').slice(-2).join('/'));
  }).catch(function (e) {
    // Tab có thể đã đóng hoặc không accessible — ignore
    console.debug(LOG, 'inject skipped tab', tabId, ':', e && e.message);
  });
}

// Inject khi tab bắt đầu load
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (changeInfo.status === 'loading') {
    injectIfShopee(tabId, tab.url);
  }
});

// Re-inject khi SPA navigation (Shopee dùng history.pushState nhiều)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  function (details) {
    if (details.frameId !== 0) return;
    injectIfShopee(details.tabId, details.url);
  },
  { url: [{ hostContains: 'shopee.vn' }] }
);

// ── Handle captures from bridge ───────────────────────────────────────────────

chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.action !== 'ah_capture') return;
  var data = msg.data;
  if (!data || data.mode !== 'bulk') return;

  var products = data.products || [];
  if (products.length === 0) {
    console.debug(LOG, 'received empty bulk — skip');
    return;
  }

  console.log(LOG, 'received', products.length, 'products from', (data.apiUrl || '').split('shopee.vn').pop().split('?')[0]);
  sendBulkCapture(products);
});

// ── Send to NestJS API ────────────────────────────────────────────────────────

async function sendBulkCapture(products) {
  var config = getConfig();
  var endpoint = config.apiUrl + '/sync/extension-bulk-capture';

  console.log(LOG, 'POST', endpoint, '(' + products.length + ' products)');

  if (!config.apiKey) {
    console.warn(LOG, 'apiKey chưa được cấu hình — chạy: node scripts/gen-extension-config.mjs');
    console.warn(LOG, 'Đảm bảo API_INTERNAL_SECRET đã set trong src/.env.local');
  }

  try {
    var headers = {
      'Content-Type': 'application/json',
      'X-Extension-Source': 'affiliate-admin-helper',
    };
    if (config.apiKey) {
      headers['Authorization'] = 'Bearer ' + config.apiKey;
    }

    var res = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        products: products,
        capturedAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      var text = await res.text().catch(function () { return ''; });
      console.warn(LOG, 'API error', res.status, ':', text.slice(0, 300));
      return;
    }

    var json = await res.json().catch(function () { return {}; });
    console.log(
      LOG,
      'saved:', json.saved + '/' + (json.total || products.length),
      '| errors:', (json.errors || []).length,
      json.errors && json.errors.length > 0 ? json.errors.slice(0, 3) : ''
    );
  } catch (e) {
    console.warn(LOG, 'network error:', e && e.message);
  }
}

console.log(LOG, 'service worker ready — apiUrl:', getConfig().apiUrl);
