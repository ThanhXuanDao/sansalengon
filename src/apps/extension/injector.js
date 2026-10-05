/**
 * Affiliate Admin Helper — Shopee interceptor (MAIN world)
 *
 * Inject bởi background.js qua chrome.scripting.executeScript, chạy trước Shopee SDK.
 *
 * Hai chế độ:
 *  • bulk  (default): bắt recommend_v2 / search_items → emit __AH_CAPTURE__ → bridge → background → API
 *  • single (khi URL có ?__affiliate_fetch=1): bắt item/get, pdp/get → postMessage về window.opener (admin modal)
 */
(function () {
  if (window.__ahInjected) return;
  window.__ahInjected = true;

  var LOG = '[AH:injector]';
  var IMG_BASE = 'https://down-vn.img.susercontent.com/file/';
  var PRICE_DIV = 100000; // Shopee raw price unit → VND
  var isSingle = new URLSearchParams(location.search).has('__affiliate_fetch');

  console.log(LOG, 'active — mode:', isSingle ? 'single' : 'bulk', '—', location.pathname);

  // ── URL matchers ─────────────────────────────────────────────────────────────

  function isBulkApi(url) {
    return url.includes('recommend/recommend_v2') ||
           url.includes('search/search_items') ||
           url.includes('flash_sale/flash_sale_batch_get_items');
  }

  function isSingleApi(url) {
    return url.includes('/api/v4/item/get') || url.includes('pdp/get_pc') || url.includes('pdp/get?');
  }

  // ── Parsers ──────────────────────────────────────────────────────────────────

  function parseRecommendV2(body) {
    try {
      var data = JSON.parse(body);
      var units = (data && data.data && data.data.units) || [];
      var products = [];
      for (var i = 0; i < units.length; i++) {
        var unit = units[i];
        var asset = unit && unit.item && unit.item.item_card_displayed_asset;
        var itemData = unit && unit.item && unit.item.item_data;
        if (!asset || !asset.name) continue;

        var tid = unit.tracking_card_id || '';
        var itemId = tid.indexOf('::') >= 0 ? tid.split('::').pop() : '';
        if (!itemId) continue;

        var rawPrice = (asset.display_price && asset.display_price.price) || 0;
        var rawOrig = (asset.display_price && asset.display_price.strikethrough_price) || 0;
        var price = Math.round(rawPrice / PRICE_DIV);
        var originalPrice = rawOrig > rawPrice ? Math.round(rawOrig / PRICE_DIV) : null;
        var discountText = (asset.discount_tag && asset.discount_tag.discount_text) || '';
        var discountPct = discountText ? parseInt(discountText.replace(/[^0-9]/g, ''), 10) || null : null;
        var shopId = String((itemData && itemData.shopid) || '');
        var image = asset.image ? IMG_BASE + asset.image : '';
        var images = (asset.images || []).filter(Boolean).map(function (h) { return IMG_BASE + h; });

        products.push({
          itemId: itemId,
          shopId: shopId,
          name: asset.name,
          price: price,
          originalPrice: originalPrice,
          discountPct: discountPct,
          sold: (asset.sold_count && asset.sold_count.text) || '',
          sellerType: (asset.seller_flag && asset.seller_flag.name) || '',
          image: image,
          images: images,
          url: 'https://shopee.vn/product/' + shopId + '/' + itemId,
          rating: (itemData && itemData.item_rating && itemData.item_rating.rating_star) || null,
        });
      }
      console.log(LOG, 'recommend_v2 parsed:', products.length, 'products');
      return products;
    } catch (e) {
      console.warn(LOG, 'parseRecommendV2 error:', e && e.message);
      return [];
    }
  }

  function parseSearchItems(body) {
    try {
      var data = JSON.parse(body);
      var items = (data && data.items) || (data && data.data && data.data.items) || [];
      var products = [];
      for (var i = 0; i < items.length; i++) {
        var b = (items[i] && items[i].item_basic) || items[i];
        if (!b || !b.name || !b.itemid) continue;

        var price = Math.round((b.price || 0) / PRICE_DIV);
        var origPrice = Math.round((b.price_before_discount || 0) / PRICE_DIV);
        var hist = b.historical_sold || 0;
        var sold = hist >= 1000
          ? 'Đã bán ' + Math.floor(hist / 1000) + 'k+'
          : hist > 0 ? 'Đã bán ' + hist : '';
        var image = b.image ? IMG_BASE + b.image : '';
        var images = (b.images || []).filter(Boolean).map(function (h) { return IMG_BASE + h; });

        products.push({
          itemId: String(b.itemid),
          shopId: String(b.shopid || ''),
          name: b.name,
          price: price,
          originalPrice: origPrice > price ? origPrice : null,
          discountPct: b.raw_discount || null,
          sold: sold,
          sellerType: b.is_official_shop ? 'MALL' : b.shopee_verified ? 'PREFERRED' : '',
          image: image,
          images: images,
          url: 'https://shopee.vn/product/' + (b.shopid || '') + '/' + b.itemid,
          rating: (b.item_rating && b.item_rating.rating_star) || null,
        });
      }
      console.log(LOG, 'search_items parsed:', products.length, 'products');
      return products;
    } catch (e) {
      console.warn(LOG, 'parseSearchItems error:', e && e.message);
      return [];
    }
  }

  function parseFlashSaleItems(body) {
    try {
      var data = JSON.parse(body);
      var items = (data && data.data && data.data.items) || [];
      var products = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item || !item.itemid || !item.name) continue;
        if (item.is_soldout) continue; // bỏ qua hết hàng

        var price = Math.round((item.price || 0) / PRICE_DIV);
        var origPrice = Math.round((item.price_before_discount || 0) / PRICE_DIV);
        var hist = item.historical_sold || 0;
        var sold = hist >= 1000
          ? 'Đã bán ' + Math.floor(hist / 1000) + 'k+'
          : hist > 0 ? 'Đã bán ' + hist : '';
        var image = item.image ? IMG_BASE + item.image : '';
        var images = (item.images || []).filter(Boolean).map(function (h) { return IMG_BASE + h; });
        var discount = item.raw_discount || (origPrice > price ? Math.round((1 - price / origPrice) * 100) : null);

        products.push({
          itemId: String(item.itemid),
          shopId: String(item.shopid || ''),
          name: item.name,
          price: price,
          originalPrice: origPrice > price ? origPrice : null,
          discountPct: discount,
          sold: sold,
          sellerType: item.is_official_shop ? 'MALL' : item.shopee_verified ? 'PREFERRED' : '',
          image: image,
          images: images,
          url: 'https://shopee.vn/product/' + (item.shopid || '') + '/' + item.itemid,
          rating: (item.item_rating && item.item_rating.rating_star) || null,
          isFlashSale: true,
          flashSaleStock: item.flash_sale_stock || null,
        });
      }
      console.log(LOG, 'flash_sale_batch_get_items parsed:', products.length, 'products');
      return products;
    } catch (e) {
      console.warn(LOG, 'parseFlashSaleItems error:', e && e.message);
      return [];
    }
  }

  function parseSingleItem(body) {
    try {
      var data = JSON.parse(body);
      var item = (data && data.data && data.data.item) || data;
      if (!item) return null;

      var p = item.price || item.price_min || 0;
      var op = item.price_before_discount || 0;
      var images = (item.images || []).filter(Boolean).map(function (h) { return IMG_BASE + h; });

      return {
        price: Math.round(p / PRICE_DIV),
        originalPrice: op > p ? Math.round(op / PRICE_DIV) : null,
        discountPct: op > p ? Math.round((1 - p / op) * 100) : null,
        rating: (item.item_rating && item.item_rating.rating_star) || null,
        imageUrl: item.image ? IMG_BASE + item.image : (images[0] || ''),
        imageUrls: images,
      };
    } catch (e) {
      console.warn(LOG, 'parseSingleItem error:', e && e.message);
      return null;
    }
  }

  // ── Emit helpers ─────────────────────────────────────────────────────────────

  function emitBulk(products, apiUrl) {
    if (!products || products.length === 0) return;
    console.log(LOG, 'emit bulk:', products.length, 'products —', apiUrl.split('shopee.vn').pop().split('?')[0]);
    window.postMessage({ type: '__AH_CAPTURE__', mode: 'bulk', products: products, apiUrl: apiUrl }, '*');
  }

  var singleSent = false;
  var singleTimeoutId = null;

  if (isSingle) {
    singleTimeoutId = setTimeout(function () {
      if (!singleSent) {
        singleSent = true;
        console.warn(LOG, 'single timeout — no item API response in 25s');
        try {
          if (window.opener) window.opener.postMessage({
            __affiliate: true,
            error: 'Timeout — extension không nhận được data từ Shopee. Kiểm tra đã cài đúng chưa.',
          }, '*');
        } catch (e) {}
        window.close();
      }
    }, 25000);
  }

  function emitSingle(info) {
    if (singleSent) return;
    singleSent = true;
    clearTimeout(singleTimeoutId);
    console.log(LOG, 'emit single — price:', info.price, 'rating:', info.rating);
    try {
      if (window.opener) window.opener.postMessage({ __affiliate: true, info: info }, '*');
    } catch (e) {}
    setTimeout(function () { window.close(); }, 400);
  }

  // ── Fetch override ────────────────────────────────────────────────────────────

  var _origFetch = window.fetch;
  window.fetch = async function () {
    var input = arguments[0];
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var response = await _origFetch.apply(this, arguments);

    try {
      if (!isSingle && isBulkApi(url)) {
        response.clone().text().then(function (body) {
          var products = url.includes('recommend_v2')
            ? parseRecommendV2(body)
            : url.includes('flash_sale_batch_get_items')
            ? parseFlashSaleItems(body)
            : parseSearchItems(body);
          emitBulk(products, url);
        }).catch(function () {});
      } else if (isSingle && isSingleApi(url)) {
        response.clone().text().then(function (body) {
          var info = parseSingleItem(body);
          if (info && info.price > 0) emitSingle(info);
        }).catch(function () {});
      }
    } catch (e) {}

    return response;
  };

  // ── XHR override ─────────────────────────────────────────────────────────────

  var _origOpen = XMLHttpRequest.prototype.open;
  var _origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ahUrl = url || '';
    return _origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    var url = this._ahUrl || '';
    var needsBulk = !isSingle && isBulkApi(url);
    var needsSingle = isSingle && isSingleApi(url);

    if (needsBulk || needsSingle) {
      this.addEventListener('load', function () {
        try {
          if (needsBulk) {
            var products = url.includes('recommend_v2')
              ? parseRecommendV2(this.responseText)
              : url.includes('flash_sale_batch_get_items')
              ? parseFlashSaleItems(this.responseText)
              : parseSearchItems(this.responseText);
            emitBulk(products, url);
          } else if (needsSingle) {
            var info = parseSingleItem(this.responseText);
            if (info && info.price > 0) emitSingle(info);
          }
        } catch (e) {}
      });
    }

    return _origSend.apply(this, arguments);
  };
})();
