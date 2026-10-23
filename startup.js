"use strict";

function checkWisp(endpoint, timeout) {
	return new Promise((resolve) => {
		let socket;
		const finish = () => {
			clearTimeout(timer);
			if (socket) {
				socket.onmessage = socket.onerror = socket.onclose = null;
				socket.close();
			}
			resolve();
		};
		const timer = setTimeout(finish, timeout);
		try {
			socket = new WebSocket(endpoint);
			socket.binaryType = "arraybuffer";
			socket.onmessage = socket.onerror = socket.onclose = finish;
		} catch (error) { finish(); }
	});
}

window.startupReady = (async () => {
	const screen = document.getElementById("startup");
	const status = document.getElementById("startup-status");
	const progress = document.getElementById("startup-progress");
	const app = document.getElementById("app");
	const servers = window.__VELO_WISP_LIST;
	const expect = (value) => { if (!value) throw new Error("startup check failed"); };
	const steps = [
		["registering service worker", registerSW],
		["testing all wisp connections", () => Promise.all(servers.map((server) => checkWisp(server, 4000)))],
		["checking secure connection", () => expect(window.isSecureContext)],
		["checking service worker control", () => expect(navigator.serviceWorker.controller)],
		["checking WebAssembly support", () => expect(typeof WebAssembly === "object")],
		["checking proxy runtime", () => expect(typeof $scramjetLoadController().ScramjetController === "function")],
		["checking transport runtime", () => expect(typeof BareMux.BareClient === "function")],
		["validating server addresses", () => expect(servers.every((server) => new URL(server).protocol === "wss:"))],
		["checking browser storage", () => sessionStorage.getItem("velocify-theme")],
		["checking database support", () => expect(typeof indexedDB.open === "function")],
		["checking search controls", () => expect(document.getElementById("sj-form") && typeof search === "function")],
		["checking game catalogue", () => expect(document.getElementById("games-page"))],
		["checking panic controls", () => expect(document.getElementById("bind-panic") && document.getElementById("decoy"))],
		["preparing workspace", () => expect(document.getElementById("sj-address"))],
	];
	const total = steps.length;
	const started = performance.now();
	let completed = 0;
	app.inert = true;
	const update = () => {
		progress.value = Math.min(completed / total, (performance.now() - started) / 10000) * 100;
	};
	const interval = setInterval(update, 50);
	try {
		for (let index = 0; index < total; index++) {
			status.textContent = steps[index][0] + " " + (index + 1) + "/" + total;
			await steps[index][1]();
			completed++;
			const remaining = Math.max(0, 10000 - (performance.now() - started));
			await new Promise((resolve) => setTimeout(resolve, remaining / (total - index)));
		}
		progress.value = 100;
		screen.hidden = true;
		app.inert = false;
		return true;
	} catch (error) {
		status.textContent = error.message;
		document.getElementById("startup-retry").hidden = false;
		return false;
	} finally {
		clearInterval(interval);
	}
})();

document.getElementById("startup-retry").addEventListener("click", () => location.reload());
