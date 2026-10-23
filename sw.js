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
		h.set("Cross-Origin-Embedder-Policy", "require-corp");
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
			if (scramjet.route(event)) {
				try {
					// Proxied document/iframe/script/style/worker responses need
					// COEP require-corp + COOP same-origin so the crossOriginIsolated
					// top page can embed the /view/ frame (else ERR_BLOCKED_BY_RESPONSE).
					// Match the reference: no CORP, drop permissions-policy.
					const r = await scramjet.fetch(event);
					if (!r || r.status === 0 || r.type === "opaque" || r.type === "opaqueredirect") return r;
					const dest = event.request.destination;
					const h = new Headers(r.headers);
					h.delete("permissions-policy");
					if (["document", "iframe", "worker", "sharedworker", "style", "script", ""].indexOf(dest) !== -1) {
						h.set("Cross-Origin-Embedder-Policy", "require-corp");
						h.set("Cross-Origin-Opener-Policy", "same-origin");
					}
					// A navigated/framed proxy page is always rewritten HTML; make sure
					// it's served as such so scripts run (else it renders as text/plain).
					if ((dest === "document" || dest === "iframe" || dest === "") && event.request.mode === "navigate") {
						const ct = h.get("content-type") || "";
						if (!/html/i.test(ct)) h.set("content-type", "text/html; charset=utf-8");
					}
					return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
				} catch (e) {
					return new Response("VELO scramjet.fetch error: " + (e && (e.stack || e.message) || e), {
						status: 502,
						headers: { "Content-Type": "text/plain" },
					});
				}
			}
		} catch (e) {
			return new Response("VELO route/loadConfig error: " + (e && (e.stack || e.message) || e), {
				status: 502,
				headers: { "Content-Type": "text/plain" },
			});
		}
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
