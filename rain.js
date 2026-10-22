"use strict";
(() => {
	const canvas = document.getElementById("rain");
	if (!canvas) return;
	const ctx = canvas.getContext("2d");

	let w, h, drops;

	function reset() {
		w = canvas.width = window.innerWidth;
		h = canvas.height = window.innerHeight;
		const count = Math.round((w * h) / 9000);
		drops = new Array(count).fill(0).map(spawn);
	}

	function spawn() {
		return {
			x: Math.random() * w,
			y: Math.random() * h,
			len: 8 + Math.random() * 16,
			speed: 1 + Math.random() * 2.2,
			alpha: 0.08 + Math.random() * 0.22,
		};
	}

	function frame() {
		ctx.clearRect(0, 0, w, h);
		ctx.lineWidth = 1;
		for (const d of drops) {
			ctx.strokeStyle = `rgba(150,170,200,${d.alpha})`;
			ctx.beginPath();
			ctx.moveTo(d.x, d.y);
			ctx.lineTo(d.x - 1, d.y + d.len);
			ctx.stroke();
			d.y += d.speed;
			d.x -= 0.15;
			if (d.y > h) {
				d.y = -d.len;
				d.x = Math.random() * w;
			}
		}
		requestAnimationFrame(frame);
	}

	window.addEventListener("resize", reset);
	reset();
	frame();

	const glow = document.createElement("div");
	glow.id = "cursor-glow";
	document.body.appendChild(glow);
	let tx = window.innerWidth / 2,
		ty = window.innerHeight / 2,
		gx = tx,
		gy = ty;
	window.addEventListener("pointermove", (e) => {
		tx = e.clientX;
		ty = e.clientY;
	});
	const logo = document.querySelector("#home .logo");

	function trail() {
		gx += (tx - gx) * 0.12;
		gy += (ty - gy) * 0.12;
		glow.style.transform = `translate(${gx}px, ${gy}px)`;
		if (logo) {
			const rx = ((gy - window.innerHeight / 2) / window.innerHeight) * -14;
			const ry = ((gx - window.innerWidth / 2) / window.innerWidth) * 14;
			logo.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
		}
		requestAnimationFrame(trail);
	}
	trail();
})();
