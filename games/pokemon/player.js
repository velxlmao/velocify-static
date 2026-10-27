"use strict";
(async () => {
 const game = window.pokemonGames.find(item => item.slug === new URLSearchParams(location.search).get('game'));
 const input = document.getElementById('rom'), notice = document.getElementById('notice'), error = document.getElementById('error');
 let database, running = false, saving = Promise.resolve();
 const urls = [];
 function fail(problem) { error.textContent = problem.message || String(problem); error.hidden = false; input.disabled = false; }
 function read(key) { return new Promise((resolve,reject) => { const request = database.transaction('files').objectStore('files').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
 function write(key,value) { return new Promise((resolve,reject) => { const transaction = database.transaction('files','readwrite'); transaction.objectStore('files').put(value,key); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || Error('Save interrupted.')); }); }
 async function start(file) {
  error.hidden = true;
  if (!file || !/\.(gb|gbc|gba)$/i.test(file.name) || file.size < 192 || file.size > (game.core === 'mgba' ? 32 : 8) * 1024 * 1024) throw Error('Choose a valid '+(game.core === 'mgba' ? '.gba' : '.gb or .gbc')+' game file.');
  if ((game.core === 'mgba') !== /\.gba$/i.test(file.name)) throw Error('This version needs a .'+game.extension+' game file.');
  const header = new Uint8Array(await file.slice(0,340).arrayBuffer());
  const logo = game.core === 'mgba' ? [0x24,0xff,0xae,0x51] : [0xce,0xed,0x66,0x66];
  const offset = game.core === 'mgba' ? 4 : 260;
  if (!logo.every((value,index) => header[offset+index] === value)) throw Error('That file does not contain a valid game header.');
  if (database) await write(game.slug+':rom',file);
  if (running) { location.reload(); return; }
  running = true; input.disabled = true; notice.textContent = 'loading emulator…';
  const url = URL.createObjectURL(file); urls.push(url);
  window.EJS_player = '#game'; window.EJS_core = game.core; window.EJS_gameID = game.id;
  window.EJS_gameName = game.title; window.EJS_gameUrl = url;
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/4.2.3/data/';
  window.EJS_threads = false; window.EJS_startOnLoaded = false;
  window.EJS_defaultOptions = {'save-state-location':'browser','save-state-slot':1,'save-save-interval':30};
  const saved = database ? await read(game.slug+':save') : null;
  window.EJS_onGameStart = () => {
   const emulator = window.EJS_emulator, manager = emulator.gameManager;
   if (saved) { try { manager.FS.writeFile(manager.getSaveFilePath(),new Uint8Array(saved)); manager.loadSaveFiles(); } catch (problem) { fail(Error('Saved progress could not be restored. '+problem.message)); } }
   emulator.on('saveSaveFiles',data => {
    if (!database || !data?.byteLength) return;
    const copy = new Uint8Array(data);
    saving = saving.catch(() => {}).then(() => write(game.slug+':save',copy)).catch(() => fail(Error('Progress could not be saved. Export a save from the emulator menu.')));
   });
   window.flushGameSaves = () => { manager.saveSaveFiles(); return saving; };
   document.addEventListener('visibilitychange', () => { if (document.hidden) window.flushGameSaves(); });
   notice.textContent = database ? 'progress saves in this browser' : 'browser storage is unavailable. export saves from the emulator menu.';
   input.disabled = false;
  };
  const script = document.createElement('script'); script.src = window.EJS_pathtodata+'loader.js';
  script.onload = () => { notice.textContent = 'press start game to play'; input.disabled = false; };
  script.onerror = () => { running = false; fail(Error('The emulator could not load. Check your connection and choose the file again.')); };
  document.head.append(script);
 }
 input.addEventListener('change', () => { const file = input.files[0]; if (file) start(file).catch(fail); });
 window.addEventListener('pagehide', () => { window.flushGameSaves?.(); for (const url of urls) URL.revokeObjectURL(url); });
 if (!game) { fail(Error('Choose a Pokémon version from the games tab.')); input.disabled = true; return; }
 document.title = game.title; document.getElementById('title').textContent = game.title;
 input.accept = game.core === 'mgba' ? '.gba' : '.gb,.gbc';
 try {
  database = await new Promise((resolve,reject) => { const request = indexedDB.open('velocify-pokemon',1); request.onupgradeneeded = () => request.result.createObjectStore('files'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); request.onblocked = () => reject(Error('Browser storage is blocked.')); });
  const file = await read(game.slug+':rom'); if (file) await start(file);
 } catch (problem) { fail(problem); notice.textContent = 'choose a file to play. browser saving is currently unavailable.'; }
 parent.postMessage({velocify:'game-ready'},location.origin);
})();
