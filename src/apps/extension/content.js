/**
 * Affiliate Admin Helper — Shopee data interceptor
 *
 * Chạy ở document_start trong MAIN world (page context), trước khi Shopee SDK chạy.
 * Override window.fetch để bắt response của Shopee khi họ gọi item API.
 * Khi bắt được data → postMessage về opener (admin form) → tự đóng tab.
 *
 * Chỉ kích hoạt khi URL có param ?__affiliate_fetch=1 (do admin form set).
 */
(function () {
  if (!new URLSearchParams(location.search).has("__affiliate_fetch")) return;

  var sent = false;

  // Override fetch trước khi Shopee SDK chạy
  var _origFetch = window.fetch;
  window.fetch = async function (url, opts) {
    var response = await _origFetch.apply(this, arguments);
    if (!sent) {
      try {
        var u = String(url);
        if (
          u.includes("/api/v4/item/get") ||
          u.includes("pdp/get_pc") ||
          u.includes("pdp/get?")
        ) {
          response.clone().json().then(function (data) {
            var item = data && data.data && data.data.item;
            if (item && !sent) {
              sent = true;
              clearTimeout(timeoutId);
              sendResult(item);
            }
          }).catch(function () {});
        }
      } catch (e) {}
    }
    return response;
  };

  var timeoutId = setTimeout(function () {
    if (!sent) {
      sent = true;
      postToOpener({ __affiliate: true, error: "Timeout — extension nhận không được data từ Shopee. Kiểm tra đã cài đúng chưa." });
      window.close();
    }
  }, 25000);

  function sendResult(item) {
    var p = item.price || item.price_min || 0;
    var op = item.price_before_discount || 0;
    var images = Array.isArray(item.images) ? item.images : [];
    postToOpener({
      __affiliate: true,
      info: {
        price: Math.round(p / 100000),
        originalPrice: op > p ? Math.round(op / 100000) : null,
        discountPct: op > p ? Math.round((1 - p / op) * 100) : null,
        rating: (item.item_rating && item.item_rating.rating_star) || null,
        imageUrls: images.filter(Boolean).map(function (h) {
          return "https://cf.shopee.vn/file/" + h;
        }),
        imageUrl: item.image ? "https://cf.shopee.vn/file/" + item.image : "",
      },
    });
    setTimeout(function () { window.close(); }, 400);
  }

  function postToOpener(data) {
    try {
      if (window.opener) window.opener.postMessage(data, "*");
    } catch (e) {}
  }
})();
