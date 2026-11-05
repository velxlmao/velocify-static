"use strict";
(() => {
 const dialog = document.getElementById('welcome');
 const startup = document.getElementById('startup');
 function open() {
  if (startup && !startup.hidden) return;
  observer.disconnect();
  dialog.showModal();
 }
 const observer = new MutationObserver(open);
 if (startup) observer.observe(startup, { attributes: true, attributeFilter: ['hidden'] });
 open();
})();
