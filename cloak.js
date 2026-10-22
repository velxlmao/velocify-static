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
		document.removeEventListener("pointerdown", tryCloak, true);
		document.removeEventListener("keydown", tryCloak, true);

		const url = location.origin + "/?app=1&nocloak=1";
		w.document.write(
			"<!doctype html><title>Untitled document - Google Docs</title>" +
				'<link rel="icon" href="https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico">' +
				"<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style>" +
				'<iframe src="' + url + '" allow="fullscreen; clipboard-read; clipboard-write"></iframe>'
		);
		w.document.close();
		location.replace("https://docs.google.com/document/u/0/");
	}

	document.addEventListener("pointerdown", tryCloak, true);
	document.addEventListener("keydown", tryCloak, true);
})();
