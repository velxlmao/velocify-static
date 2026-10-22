importScripts("lib/s/scramjet.all.js");

// --- Scramjet IndexedDB: create its object stores on install so a page/worker
// open race can't leave an empty "$scramjet" DB (which makes every scramjet
// transaction throw "object store not found"). Self-heal a broken one too.
const SCRAMJET_STORES = ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"];
function openScramjetDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open("$scramjet", 1);
		req.onupgradeneeded = () => {
			const db = req.result;
			for (const s of SCRAMJET_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
		req.onblocked = () => reject(new Error("blocked"));
	});
}
function deleteScramjetDB() {
	return new Promise((resolve) => {
		const req = indexedDB.deleteDatabase("$scramjet");
		req.onsuccess = req.onerror = req.onblocked = () => resolve();
	});
}
async function ensureScramjetDB() {
	try {
		let db = await openScramjetDB();
		const ok = SCRAMJET_STORES.every((s) => db.objectStoreNames.contains(s));
		if (!ok) {
			db.close();
			await deleteScramjetDB();
			db = await openScramjetDB();
		}
		db.close();
	} catch (e) {}
}

self.addEventListener("install", (event) =>
	event.waitUntil(ensureScramjetDB().then(() => self.skipWaiting()))
);
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const SCOPE = new URL("./", self.location).pathname;
const PROXY_PREFIX = SCOPE + "view/";

// Inject COOP/COEP so the page is crossOriginIsolated (libcurl needs
// SharedArrayBuffer) and so same-origin subresources — including bare-mux's
// SharedWorker — are isolation-compatible.
function withCOI(resp, sameOrigin, isNav) {
	if (!sameOrigin || !resp || resp.status === 0 || resp.type === "opaque" || resp.type === "opaqueredirect") {
		return resp;
	}
	try {
		const h = new Headers(resp.headers);
		h.set("Cross-Origin-Embedder-Policy", "credentialless");
		h.set("Cross-Origin-Resource-Policy", "cross-origin");
		if (isNav) h.set("Cross-Origin-Opener-Policy", "same-origin");
		return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
	} catch (e) {
		return resp;
	}
}

async function handleRequest(event) {
	const url = new URL(event.request.url);

	if (url.pathname.startsWith(PROXY_PREFIX)) {
		try {
			await scramjet.loadConfig();
			if (scramjet.route(event)) return scramjet.fetch(event);
		} catch (e) {}
	}

	const resp = await fetch(event.request);
	return withCOI(resp, url.origin === self.location.origin, event.request.mode === "navigate");
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
