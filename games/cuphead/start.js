"use strict";
(async () => {
 const loading = document.getElementById('loading-text');
 const parts = (prefix,count) => Array.from({length:count},(_,index) => 'Build/'+prefix+'.part'+(index+1));
 try {
  if (!window.WebAssembly) throw Error('This port needs WebAssembly support.');
  for (const name of Object.keys(window.gameDownloadSizes)) if (name.includes('.asm.')) delete window.gameDownloadSizes[name];
  await caches.delete('cuphead-cache').catch(() => {});
  const onProgress = (loaded,total) => { loading.textContent = 'downloading content '+(loaded/1048576).toFixed(1)+'/'+(total/1048576).toFixed(1)+'mb'; };
  const data = await window.gameAssets.fromPaths(parts('CupheadPort.data.unityweb',103),{onProgress});
  const code = await window.gameAssets.fromPaths(parts('CupheadPort.wasm.code.unityweb',2),{onProgress});
  const response = await fetch(new URL('Build/CupheadPort.json',document.baseURI));
  if (!response.ok) throw Error('Could not load the game manifest.');
  const config = window.gamePerformance.unity(await response.json());
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method,url,...rest) {
   if (String(url).includes('CupheadPort.data.unityweb')) url = data.url;
   else if (String(url).includes('CupheadPort.wasm.code.unityweb')) url = code.url;
   return open.call(this,method,url,...rest);
  };
  const manifest = URL.createObjectURL(new Blob([JSON.stringify(config)],{type:'application/json'}));
  loading.textContent = 'starting game…';
  UnityLoader.instantiate('gameContainer',manifest,{Module:{devicePixelRatio:window.gamePerformance.ratio()},onProgress(_,progress) {
   if (progress < 1) return;
   loading.remove(); URL.revokeObjectURL(manifest); window.gameAssets.release();
   parent.postMessage({velocify:'game-ready'},location.origin);
  }});
 } catch (error) {
  loading.textContent = error.message || String(error);
  const retry = document.createElement('button'); retry.textContent = 'retry'; retry.onclick = () => location.reload(); loading.append(document.createElement('br'),retry);
  parent.postMessage({velocify:'game-error'},location.origin);
 }
})();
