"use strict";

window.__VELO_WISP_LIST = [
	"wss://t9os.space/wisp-vps/",
	"wss://t9os.space/wisp-boston/",
	"wss://t9os.space/wisp-milan/",
	"wss://t9os.space/wisp-paloalto/",
	"wss://t9os.space/wisp-mullvad/",
	"wss://girlspreples.org/wi/",
	"wss://boxcasa.net/wi/",
	"wss://shop.kristenblackburnvolleyballcamps.com/wi/",
	"wss://learn.southpadreislandkiteboarding.com/wi/",
	"wss://bananadogstore.com/socket/",
	"wss://aplusmartialarts-templehills.com/socket/",
	"wss://actingoutdoor.com/socket/",
	"wss://restorecounselingcenter.org/socket/",
	"wss://velocify-wisp.realdashvr.workers.dev/wisp/",
];

window.connectWisp = async function (servers, connect, progress, signal, timeout = 10000) {
	for (let i = 0; i < servers.length; i++) {
		signal.throwIfAborted();
		progress(i + 1, servers.length);
		let timer;
		let abort;
		try {
			await Promise.race([
				Promise.resolve().then(() => connect(servers[i], signal)),
				new Promise((_, reject) => {
					timer = setTimeout(() => reject(new Error("wisp connection timed out")), timeout);
					abort = () => reject(signal.reason);
					signal.addEventListener("abort", abort, { once: true });
				}),
			]);
			signal.throwIfAborted();
			return servers[i];
		} catch (err) {
			signal.throwIfAborted();
		} finally {
			clearTimeout(timer);
			signal.removeEventListener("abort", abort);
		}
	}
	throw new Error("could not connect through any wisp server");
};
