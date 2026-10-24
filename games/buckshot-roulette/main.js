const originalFetch = window.fetch;

function mergeFiles(fileParts) {
    return new Promise((resolve, reject) => {
        let buffers = [];

        function fetchPart(index) {
            if (index >= fileParts.length) {
                let mergedBlob = new Blob(buffers, { type: fileParts[0].includes(".wasm") ? "application/wasm" : "application/octet-stream" });
                let mergedFileUrl = URL.createObjectURL(mergedBlob);
                resolve(mergedFileUrl);
                return;
            }
            fetch(fileParts[index]).then((response) => {
                if (!response.ok) throw new Error("Missing part: " + fileParts[index]);
                return response.arrayBuffer();
            }).then((data) => {
                buffers.push(data);
                fetchPart(index + 1);
            }).catch(reject);
        }
        fetchPart(0);
    });
}

function getParts(file, start, end) {
    let parts = [];
    for (let i = start; i <= end; i++) {
        parts.push("https://raw.githubusercontent.com/genizy/web-port/a8bea5fd11f88e5a9192857f434e299c40efe7e6/buckshot-roulette/" + file + ".part" + i);
    }
    return parts;
}
Promise.all([
    mergeFiles(getParts("buckshot-roulette.pck", 1, 17)),
    mergeFiles(getParts("buckshot-roulette.wasm", 1, 3))
]).then(([pckUrl, wasmUrl]) => {
    window.fetch = async function (url, ...args) {
        if (url.endsWith("buckshot-roulette.pck")) {
            return originalFetch(pckUrl, ...args);
        } else if (url.endsWith("buckshot-roulette.wasm")) {
            return originalFetch(wasmUrl, ...args);
        } else {
            return originalFetch(url, ...args);
        }
    };
    window.godotRunStart();
});