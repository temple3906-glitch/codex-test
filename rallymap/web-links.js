'use strict';

const rallyLinks = (() => {
  const ua = navigator.userAgent || '';
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const embedded = /; wv\)|WebView|KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|GSA\/|ChatGPT/i.test(ua)
    || (ios && /AppleWebKit/.test(ua) && !/Safari|CriOS|FxiOS|EdgiOS/.test(ua));
  function webUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function externalUrl(value) {
    const https = webUrl(value);
    if (!https) return '';
    if (android) {
      return 'intent://' + https.slice(8).replace(/;/g,'%3B') +
        '#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=' +
        encodeURIComponent(https) + ';end';
    }
    if (ios) return 'x-safari-' + https;
    return https;
  }
  return {webUrl, externalUrl, embedded, mobile: android || ios, ios};
})();
