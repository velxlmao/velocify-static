"use strict";
(() => {
	// register the service worker early so the app is installable
	if (navigator.serviceWorker && !navigator.serviceWorker.controller) {
		navigator.serviceWorker.register("./sw.js").catch(() => {});
	}

	let deferred = null;
	window.addEventListener("beforeinstallprompt", (e) => {
		e.preventDefault();
		deferred = e;
	});

	// install app to chromebook
	const installBtn = document.getElementById("install-app");
	if (installBtn) {
		installBtn.addEventListener("click", async () => {
			if (deferred) {
				deferred.prompt();
				await deferred.userChoice;
				deferred = null;
			} else if (
				window.matchMedia("(display-mode: standalone)").matches ||
				window.navigator.standalone === true
			) {
				alert("velocify is already installed.");
			} else {
				alert(
					"To install: open the browser menu (three dots) and choose " +
						'"Install app" or "Install velocify". On a phone, use ' +
						'"Add to Home Screen".'
				);
			}
		});
	}

	// download velocify html (a local launcher that loads the site in app mode)
	const dlBtn = document.getElementById("download-html");
	if (dlBtn) {
		dlBtn.addEventListener("click", () => {
			const src = location.origin + "/?app=1";
			const html =
				"<!doctype html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n" +
				"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
				"<title>Untitled document - Google Docs</title>\n" +
				'<link rel="icon" href="https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico">\n' +
				"<style>html,body{margin:0;height:100%;background:#0f1216}" +
				"iframe{border:0;width:100%;height:100%;display:block}</style>\n" +
				"</head>\n<body>\n" +
				'<iframe src="' + src + '" allow="fullscreen; clipboard-read; clipboard-write"></iframe>\n' +
				"</body>\n</html>\n";
			const blob = new Blob([html], { type: "text/html" });
			const a = document.createElement("a");
			a.href = URL.createObjectURL(blob);
			a.download = "velocify.html";
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		});
	}

	// add as a chrome bookmark
	const bmBtn = document.getElementById("add-bookmark");
	if (bmBtn) {
		bmBtn.addEventListener("click", () => {
			const key = navigator.platform.indexOf("Mac") === 0 ? "Cmd+D" : "Ctrl+D";
			alert(
				"Press " + key + " to bookmark this page.\n" +
					"Tip: name it \"Docs\" and save it to your bookmarks bar."
			);
		});
	}
})();
