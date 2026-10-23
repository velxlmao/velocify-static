importScripts("lib/s/scramjet.all.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

const SCOPE = new URL("./", self.location).pathname;
const PROXY_PREFIX = SCOPE + "view/";

// Scramjet keeps its config in an IndexedDB ("$scramjet") whose object stores
// are created only in the idb "upgrade" callback. A page/worker open race can
// leave that DB at version 1 with NO stores, after which every scramjet
// transaction throws "object store not found" and the proxy hangs. We heal it
// right before serving the app document, with timeouts so it can't stall nav.
const SCRAMJET_STORES = ["config", "cookies", "redirectTrackers", "referrerPolicies", "publicSuffixList"];
function withTimeout(p, ms) {
	return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}
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
		const db = await withTimeout(openScramjetDB(), 3000);
		const ok = SCRAMJET_STORES.every((s) => db.objectStoreNames.contains(s));
		db.close();
		if (!ok) {
			await withTimeout(deleteScramjetDB(), 3000);
			(await withTimeout(openScramjetDB(), 3000)).close();
		}
	} catch (e) {}
}

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

	const sameOrigin = url.origin === self.location.origin;
	const isNav = event.request.mode === "navigate";
	// Heal scramjet's IndexedDB before the page document loads and opens it.
	if (isNav && sameOrigin) await ensureScramjetDB();

	const resp = await fetch(event.request);
	return withCOI(resp, sameOrigin, isNav);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
