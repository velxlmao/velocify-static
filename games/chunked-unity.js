"use strict";
(async () => {
 const status = document.getElementById('port-status'), overlay = document.getElementById('port-loading');
 const urls = [], abort = new AbortController();
 document.getElementById('port-retry').addEventListener('click', () => location.reload());
 function fail(error) {
  abort.abort(); overlay.hidden = false;
  status.textContent = error.message || String(error);
  document.getElementById('port-retry').hidden = false;
  parent.postMessage({ velocify: 'game-error' }, location.origin);
 }
 function ready() { overlay.hidden = true; parent.postMessage({ velocify: 'game-ready' }, location.origin); }
 window.addEventListener('pagehide', () => { abort.abort(); for (const url of urls) URL.revokeObjectURL(url); });
 try {
  const response = await fetch('manifest.json');
  if (!response.ok) throw Error('Could not load game manifest.');
  const port = await response.json();
  window.gameDownloadSizes = Object.fromEntries(Object.entries(port.sizes).filter(([name]) => /\.part\d+$|\.wasm\.(code|framework)\.unityweb$/.test(name)));
  const base = 'https://cdn.jsdelivr.net/gh/' + port.repo + '@' + port.revision + '/' + port.path;
  const backup = 'https://raw.githubusercontent.com/' + port.repo + '/' + port.revision + '/' + port.path;
  async function download(name) {
   let last;
   for (const host of [base, backup, base]) {
    try {
     const result = await fetch(host + 'Build/' + name, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(60000)]) });
     if (!result.ok) throw Error('Download failed: ' + result.status);
     const bytes = await result.arrayBuffer();
     if (bytes.byteLength !== port.sizes[name]) throw Error('Incomplete download: ' + name);
     return bytes;
    } catch (error) { if (abort.signal.aborted) throw error; last = error; }
   }
   throw last;
  }
  function blob(parts, type) { const url = URL.createObjectURL(new Blob(parts, { type })); urls.push(url); return url; }
  async function merged(prefix) {
   const names = Object.keys(port.sizes).filter(name => name.startsWith(prefix + '.part')).sort((a,b) => Number(a.split('.part')[1]) - Number(b.split('.part')[1]));
   if (!names.length) throw Error('Game files are missing.');
   const parts = new Array(names.length);
   let next = 0, done = 0;
   await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < names.length) {
     const index = next++; parts[index] = await download(names[index]);
     status.textContent = 'downloading content ' + (++done) + '/' + names.length;
    }
   }));
   return blob(parts, 'application/octet-stream');
  }
  if (port.kind === 'legacy') {
   window.dataUrll = await merged('FTFHAPort.data.unityweb');
   status.textContent = 'starting game…';
   const config = {
    companyName: 'Rayll', productName: 'Fears To Fathom',
    dataUrl: base + 'Build/FTFHAPort.data.unityweb',
    wasmCodeUrl: base + 'Build/FTFHAPort.wasm.code.unityweb',
    wasmFrameworkUrl: base + 'Build/FTFHAPort.wasm.framework.unityweb',
    TOTAL_MEMORY: 536870912, graphicsAPI: ['WebGL 2.0','WebGL 1.0'], splashScreenStyle: 'Dark',
    webglContextAttributes: { preserveDrawingBuffer: false }, cacheControl: { default: 'must-revalidate' }
   };
   const instance = UnityLoader.instantiate('unityContainer', blob([JSON.stringify(config)], 'application/json'), { Module: { onRuntimeInitialized: ready }, onProgress: (_, progress) => { if (progress >= 1) ready(); } });
   if (!instance) throw Error('Game could not start.');
   if (instance.Module) window.persistGameSaves(() => new Promise((resolve,reject) => instance.Module.FS?.syncfs ? instance.Module.FS.syncfs(false, error => error ? reject(error) : resolve()) : resolve()));
  } else {
   const dataUrl = await merged('hk.data'), codeUrl = await merged('hk.wasm');
   status.textContent = 'starting game…';
   const instance = await createUnityInstance(document.getElementById('game-canvas'), {
    dataUrl, codeUrl, frameworkUrl: base + 'Build/hk.framework.js', streamingAssetsUrl: base + 'StreamingAssets',
    companyName: 'Team Cherry & Truffled', productName: 'Hollow Knight', productVersion: '1.0'
   });
   window.persistGameSaves(() => new Promise((resolve,reject) => instance.Module.FS?.syncfs ? instance.Module.FS.syncfs(false, error => error ? reject(error) : resolve()) : resolve()));
   ready();
  }
 } catch (error) { if (!abort.signal.aborted) fail(error); }
})();
