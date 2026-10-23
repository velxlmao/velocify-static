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
		all: window.__VELO_BASE + "lib/s/scramjet.all.js?v=2808dc4934ab",
		sync: window.__VELO_BASE + "lib/s/scramjet.sync.js",
	},
});

const scramjetReady = scramjet.init();

const connection = new BareMux.BareMuxConnection(window.__VELO_BASE + "lib/m/worker.js");

let frame = null;

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	error.textContent = "";
	errorCode.textContent = "";

	try {
		await registerSW();
		await scramjetReady;
		// Wait until the service worker is active and controlling the page,
		// otherwise the first navigation loads before the proxy can intercept it.
		await navigator.serviceWorker.ready;
	} catch (err) {
		error.textContent = "Failed to register service worker.";
		errorCode.textContent = err.toString();
		throw err;
	}

	const url = search(address.value, searchEngine.value);

	let wispUrl =
		window.__VELO_WISP ||
		(location.protocol === "https:" ? "wss" : "ws") +
			"://" +
			location.host +
			"/ws/";

	// mirrors: fetch the current backend from the control pointer at runtime,
	// so they keep working after the backend is swapped out
	if (window.__VELO_POINTER) {
		try {
			const b = (
				await fetch(window.__VELO_POINTER, { cache: "no-store" }).then((r) =>
					r.text()
				)
			).trim();
			if (/^wss?:\/\//.test(b)) wispUrl = b;
		} catch (e) {}
	}

	if ((await connection.getTransport()) !== window.__VELO_BASE + "lib/e/index.mjs?v=08b49336efc3") {
		await connection.setTransport(window.__VELO_BASE + "lib/e/index.mjs?v=08b49336efc3", [
			{ wisp: wispUrl },
		]);
	}

	if (!frame) {
		frame = scramjet.createFrame();
		frame.frame.id = "sj-frame";
		view.appendChild(frame.frame);
		frame.frame.addEventListener("load", () => {
			loader.hidden = true;
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

homeBtn.addEventListener("click", () => {
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
