/* A device profile is a local storage namespace, never a cloud credential. */
(function (window) {
  'use strict';
  const key='onyxDevicePlayerV1';
  let cached=null;
  function getId() {
    if(cached) return cached;
    try { const saved=localStorage.getItem(key); if(/^device:[a-f0-9-]{36}$/i.test(saved||'')) return cached=saved; } catch (_) {}
    cached=`device:${crypto.randomUUID()}`;
    try { localStorage.setItem(key,cached); } catch (_) { /* This session remains usable without persistence. */ }
    return cached;
  }
  window.OnyxDevicePlayer=Object.freeze({getId,isDevice:id=>String(id||'').startsWith('device:')});
})(window);
