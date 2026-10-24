"use strict";
(() => {
 const url = new URL(location.href);
 const legacy = url.searchParams.get("u");
 const encoded = url.searchParams.get("open");
 window.__workspaceStart = encoded || (legacy ? encodeURIComponent(btoa(Array.from(new TextEncoder().encode(legacy), byte => String.fromCharCode(byte)).join("")).split("").reverse().join("")) : null);
 if (url.searchParams.has("u") || url.searchParams.has("open")) {
  url.searchParams.delete("u");
  url.searchParams.delete("open");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
 }
})();
