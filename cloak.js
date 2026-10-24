"use strict";
(() => {
	// about:blank cloaking: on a user gesture, move the site into an
	// about:blank tab and send this tab to Google Docs.
	if (window.top !== window.self) return; // inside the cloak iframe already
	if (new URLSearchParams(location.search).get("nocloak") === "1") return;

	let done = false;
	let warned = false;

	function tryCloak() {
		if (done) return;
		let on = "0";
		try {
			on = localStorage.getItem("velocify-cloak") || "0";
		} catch (e) {}
		if (on !== "1") return; // not enabled; keep listening in case it is later

		let w = null;
		try {
			w = window.open("about:blank", "_blank");
		} catch (e) {}
		if (!w) {
			if (!warned) {
				warned = true;
				alert(
					"about:blank cloaking is blocked by your popup blocker.\n" +
						"Allow popups for this site, then click again."
				);
			}
			return; // leave the listener so the next click retries
		}

		done = true;
		window.removeEventListener("workspace-cloak", tryCloak);

		const url = new URL(location.href);
		url.searchParams.set("app", "1");
		url.searchParams.set("nocloak", "1");
		w.document.title = "Untitled document - Google Docs";
		const icon = w.document.createElement("link");
		icon.rel = "icon";
		icon.href = new URL("document.ico", location.href).href;
		const style = w.document.createElement("style");
		style.textContent = "html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}";
		const frame = w.document.createElement("iframe");
		frame.src = url.href;
		frame.allow = "fullscreen; clipboard-read; clipboard-write; cross-origin-isolated";
		w.document.head.append(icon, style);
		w.document.body.append(frame);
		location.replace("https://docs.google.com/document/u/0/");
	}

	window.addEventListener("workspace-cloak", tryCloak);
})();
