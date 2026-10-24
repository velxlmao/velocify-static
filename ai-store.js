"use strict";
window.velxAIStore = (() => {
 let database;
 function open() {
  return database ||= new Promise((resolve, reject) => {
   const request = indexedDB.open("velxAI-chats", 1);
   request.onupgradeneeded = () => request.result.createObjectStore("chats", { keyPath: "id" });
   request.onsuccess = () => resolve(request.result);
   request.onerror = () => reject(request.error);
   request.onblocked = () => reject(new Error("Chat storage is blocked."));
  });
 }
 async function list() {
  const db = await open();
  return new Promise((resolve, reject) => {
   const request = db.transaction("chats").objectStore("chats").getAll();
   request.onsuccess = () => resolve(request.result);
   request.onerror = () => reject(request.error);
  });
 }
 async function save(chat) {
  const db = await open();
  return new Promise((resolve, reject) => {
   const transaction = db.transaction("chats", "readwrite");
   transaction.objectStore("chats").put(chat);
   transaction.oncomplete = () => resolve();
   transaction.onerror = () => reject(transaction.error);
   transaction.onabort = () => reject(transaction.error || new Error("Chat was not saved."));
  });
 }
 return { list, save };
})();
