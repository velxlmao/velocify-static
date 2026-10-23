"use strict";

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const error = document.getElementById("sj-error");
const errorCode = document.getElementById("sj-error-code");
const home = document.getElementById("home");
const view = document.getElementById("view");
const homeBtn = document.getElementById("home-btn");
const loader = document.getElementById("loader");

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	prefix: window.__VELO_BASE + "view/",
	files: {
		wasm: window.__VELO_BASE + "lib/s/scramjet.wasm.wasm",
		all: window.__VELO_BASE + "lib/s/scramjet.all.js?v=9ae1e79cda2d",
		sync: window.__VELO_BASE + "lib/s/scramjet.sync.js",
	},
});

const scramjetReady = scramjet.init();

const connection = new BareMux.BareMuxConnection(window.__VELO_BASE + "lib/m/worker.js");

let frame = null;
let navigation = null;
let connecting = false;
const probeClient = new BareMux.BareClient(window.__VELO_BASE + "lib/m/worker.js");

function connectionStatus(text) {
	for (const el of document.querySelectorAll(".wisp-status")) el.textContent = text;
}

function finishNavigation(ok) {
	loader.hidden = true;
	connectionStatus("");
	window.dispatchEvent(new CustomEvent("velo-proxy-finish", { detail: { ok } }));
}

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	error.textContent = "";
	errorCode.textContent = "";

	navigation?.abort();
	const controller = new AbortController();
	navigation = controller;
	connecting = true;
	const url = search(address.value, searchEngine.value);
	home.hidden = true;
	view.hidden = false;
	document.body.classList.add("proxy-mode");
	loader.hidden = false;
	connectionStatus("connecting to wisp server 1/" + window.__VELO_WISP_LIST.length);
	try {
		await registerSW();
		await scramjetReady;
		await navigator.serviceWorker.ready;
		const servers = [...window.__VELO_WISP_LIST];
		if (window.__VELO_POINTER) {
			try {
				const response = await fetch(window.__VELO_POINTER, { cache: "no-store", signal: controller.signal });
				const endpoint = (await response.text()).trim();
				if (/^wss?:\/\//.test(endpoint) && !servers.includes(endpoint)) servers.push(endpoint);
			} catch (err) { controller.signal.throwIfAborted(); }
		}
		await window.connectWisp(servers, async (wispUrl, signal) => {
			signal.throwIfAborted();
			await connection.setTransport(window.__VELO_BASE + "lib/e/index.mjs?v=08b49336efc3", [{ wisp: wispUrl }]);
			signal.throwIfAborted();
			const response = await probeClient.fetch(url, { method: "GET", redirect: "manual", signal });
			await response.body?.cancel();
			if (response.status >= 500 || [403, 407, 429].includes(response.status)) throw new Error("upstream unavailable");
		}, (index, total) => connectionStatus("connecting to wisp server " + index + "/" + total), controller.signal);
		controller.signal.throwIfAborted();
	} catch (err) {
		if (controller.signal.aborted) return;
		error.textContent = err.message;
		home.hidden = false;
		view.hidden = true;
		document.body.classList.remove("proxy-mode");
		finishNavigation(false);
		connecting = false;
		return;
	}
	connecting = false;

	if (!frame) {
		frame = scramjet.createFrame();
		frame.frame.id = "sj-frame";
		view.appendChild(frame.frame);
		frame.frame.addEventListener("load", () => {
			if (!connecting && !navigation?.signal.aborted) finishNavigation(true);
		});
	}

	// clear any self-hosted (local) game frame and restore the proxy frame
	const localFrame = document.getElementById("sj-local");
	if (localFrame) localFrame.remove();
	if (frame && frame.frame) frame.frame.style.display = "";

	home.hidden = true;
	view.hidden = false;
	document.body.classList.add("proxy-mode");
	loader.hidden = false;
	frame.go(url);
});

function cancelNavigation() {
	navigation?.abort();
	finishNavigation(false);
}

document.getElementById("nav-home").addEventListener("click", cancelNavigation);
homeBtn.addEventListener("click", () => {
	cancelNavigation();
	view.hidden = true;
	home.hidden = false;
	address.value = "";
	document.body.classList.remove("proxy-mode");
	document.getElementById("sidebar").classList.remove("peek");
});

// a shared link like https://<server>/?u=https://example.com opens straight away
const deepLink = new URLSearchParams(location.search).get("u");
if (deepLink) {
	address.value = deepLink;
	form.requestSubmit();
}
