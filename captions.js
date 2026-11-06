"use strict";
(() => {
 const lines = [
  'velocify on top 😭🙏',
  'if you have this hi ms emond ✌️',
  'check out xyfer aswell 🙏',
  'velocify tops aether 🥀',
  'velx says hi ✌️',
  'evil velx 4000 😭🥀',
  '😭😭🥀🥀✌️',
  'monkey monkey monkey 🥀',
  'larping is fun 😭🙏',
  'linewize sucks 🥀✌️',
  'goguardian more like noguardian 😭🙏'
 ];
 const captions = document.querySelectorAll('.rotating-caption');
 let index = 0;
 setInterval(() => {
  if (document.hidden) return;
  index = (index + 1) % lines.length;
  for (const caption of captions) caption.textContent = lines[index];
 }, 2000);
})();
