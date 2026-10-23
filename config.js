(function () {
	if (!window.__VELO_BASE) {
		var p = location.pathname;
		window.__VELO_BASE = p.slice(0, p.lastIndexOf("/") + 1);
	}
	if (typeof window.__VELO_POINTER === "undefined") window.__VELO_POINTER = null;

	window.__VELO_WISP_LIST = [
		"wss://velocify-wisp.realdashvr.workers.dev/wisp/"
	];

	window.__VELO_WISP = window.__VELO_WISP_LIST[0];

	(function probe(i) {
		if (i >= window.__VELO_WISP_LIST.length) return;
		var url = window.__VELO_WISP_LIST[i];
		var settled = false, ws;
		var to = setTimeout(function () {
			if (settled) return;
			settled = true;
			try { ws.close(); } catch (e) {}
			probe(i + 1);
		}, 4000);
		try { ws = new WebSocket(url); } catch (e) { clearTimeout(to); return probe(i + 1); }
		ws.onopen = function () {
			if (settled) return;
			settled = true;
			clearTimeout(to);
			window.__VELO_WISP = url;
			try { ws.close(); } catch (e) {}
		};
		ws.onerror = function () {
			if (settled) return;
			settled = true;
			clearTimeout(to);
			probe(i + 1);
		};
	})(0);
})();
