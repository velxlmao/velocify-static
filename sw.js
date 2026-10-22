importScripts("lib/s/scramjet.all.js");

self.addEventListener("install", () => self.skipWaiting());
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
