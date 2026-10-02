/**
 * Affiliate Admin Helper — bridge (ISOLATED world)
 *
 * Nhận postMessage từ injector.js (MAIN world) và forward tới background service worker.
 * Chạy qua content_scripts trong manifest nên không cần inject thêm.
 */
(function () {
  var LOG = '[AH:bridge]';

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== '__AH_CAPTURE__') return;

    try {
      chrome.runtime.sendMessage({ action: 'ah_capture', data: event.data }, function () {
        // Bỏ qua chrome.runtime.lastError nếu background không response
        void chrome.runtime.lastError;
      });
      console.debug(LOG, 'forwarded', event.data.mode, event.data.products && event.data.products.length, 'products');
    } catch (e) {
      // Extension context bị invalidated sau khi reload — ignore
      console.warn(LOG, 'sendMessage failed (context invalidated?):', e && e.message);
    }
  });

  console.debug(LOG, 'active on', location.hostname);
})();
