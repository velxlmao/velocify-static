"use strict";
(() => {
 let ready = false;
 const started = Date.now();
 const observer = new MutationObserver(() => {
  const loader = document.getElementById('loader');
  const status = document.getElementById('status')?.textContent || '';
  if (/failed|error/i.test(status)) parent.postMessage({ velocify: 'game-error' }, location.origin);
  if (!ready && loader && (loader.hidden || loader.style.display === 'none')) {
   ready = true; observer.disconnect(); parent.postMessage({ velocify: 'game-ready' }, location.origin);
  }
 });
 observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','hidden'] });
 window.addEventListener('error', () => { if (!ready && Date.now() - started > 1000) parent.postMessage({ velocify: 'game-error' }, location.origin); });
})();
