"use strict";
const stockSW = "./sw.js?v=34fdf1e63a75";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	await navigator.serviceWorker.register(stockSW);
	const expected = new URL(stockSW, location.href).href;
	if (navigator.serviceWorker.controller?.scriptURL === expected) return;
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => finish(new Error("Service worker activation timed out.")), 15000);
		function finish(error) {
			clearTimeout(timer);
			navigator.serviceWorker.removeEventListener("controllerchange", check);
			if (error) reject(error);
			else resolve();
		}
		function check() {
			if (navigator.serviceWorker.controller?.scriptURL === expected) finish();
		}
		navigator.serviceWorker.addEventListener("controllerchange", check);
		check();
	});
}
