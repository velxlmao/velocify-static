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
	const servers = window.__VELO_WISP_LIST.slice(0, 13);
	const total = servers.length + 1;
	const started = performance.now();
	let completed = 0;
	app.inert = true;
	const update = () => {
		progress.value = Math.min(completed / total, (performance.now() - started) / 10000) * 100;
	};
	const interval = setInterval(update, 50);
	try {
		status.textContent = "registering service worker 1/" + total;
		await registerSW();
		completed = 1;
		const spacing = Math.max(0, 10000 - (performance.now() - started)) / servers.length;
		await Promise.all(servers.map(async (server, index) => {
			await new Promise((resolve) => setTimeout(resolve, index * spacing));
			status.textContent = "testing wisp connection, " + (index + 2) + "/" + total;
			await checkWisp(server, Math.max(1, Math.min(4000, 10000 - (performance.now() - started))));
			completed++;
		}));
		await new Promise((resolve) => setTimeout(resolve, Math.max(0, 10000 - (performance.now() - started))));
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
