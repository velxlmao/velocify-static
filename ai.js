"use strict";
(() => {
 const $ = id => document.getElementById(id);
 const page = $("ai-page"), input = $("ai-input"), messages = $("ai-messages");
 const endpoint = "https://velx-ai.realdashvr.workers.dev/chat";
 let chats = [], activeId = null, pending = null, loading = true, error = "", storageError = "", scheduled = false;

 const active = () => chats.find(chat => chat.id === activeId);
 function showError() {
  $("ai-error").textContent = error || storageError;
  $("ai-error").hidden = !$("ai-error").textContent;
 }
 async function persist(chat) {
  try { await window.velxAIStore.save(chat); }
  catch { storageError = "Chats cannot be saved in this browser."; showError(); }
 }
 function context(chat) {
  const result = chat.messages.filter(message => message.content.trim() && !["error", "loading"].includes(message.status)).map(({ role, content }) => ({ role, content }));
  let length = result.reduce((sum, message) => sum + message.content.length, 0);
  while (result.length > 40 || length > 40000) length -= result.shift().content.length;
  while (result[0]?.role === "assistant") result.shift();
  return result;
 }
 function format(target, text) {
  target.replaceChildren();
  const parts = text.split(/```[^\n]*\n/);
  if (parts.length === 1) {
   if (!text) return;
   for (const paragraph of text.split(/\n\s*\n/)) {
    const p = document.createElement("p");
    const bold = paragraph.split(/(\*\*[^*]+\*\*)/g);
    for (const part of bold) {
     if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong"); strong.textContent = part.slice(2, -2); p.append(strong);
     } else p.append(document.createTextNode(part));
    }
    target.append(p);
   }
   return;
  }
  const chunks = text.split(/(```[^\n]*\n[\s\S]*?(?:```|$))/g);
  for (const chunk of chunks) {
   if (!chunk) continue;
   if (chunk.startsWith("```")) {
    const pre = document.createElement("pre"), code = document.createElement("code");
    code.textContent = chunk.replace(/^```[^\n]*\n/, "").replace(/```$/, ""); pre.append(code); target.append(pre);
   } else {
    const block = document.createElement("div"); format(block, chunk); target.append(block);
   }
  }
 }
 function renderHistory() {
  const history = $("ai-history"); history.replaceChildren();
  const ordered = [...chats].sort((a, b) => b.updated - a.updated);
  if (!ordered.length) {
   const empty = document.createElement("p"); empty.className = "ai-storage-note"; empty.textContent = loading ? "loading chats…" : "no chats yet"; history.append(empty);
  }
  for (const chat of ordered) {
   const button = document.createElement("button"); button.type = "button"; button.textContent = chat.title; button.title = chat.title;
   button.setAttribute("aria-current", String(chat.id === activeId));
   button.addEventListener("click", () => { activeId = chat.id; error = ""; page.classList.remove("history-open"); render(); input.focus(); });
   history.append(button);
  }
 }
 function renderMessages() {
  messages.replaceChildren();
  const chat = active();
  $("ai-title").textContent = chat?.messages.length ? chat.title : "velxAI";
  if (!chat?.messages.length) {
   const empty = document.createElement("div"); empty.className = "ai-empty";
   const title = document.createElement("h2"); title.textContent = "velxAI";
   const text = document.createElement("p"); text.textContent = loading ? "loading chats…" : "start a conversation";
   empty.append(title, text); messages.append(empty);
  }
  for (const message of chat?.messages || []) {
   const article = document.createElement("article"); article.className = "ai-message " + message.role + " " + (message.status || "complete");
   const author = document.createElement("strong"); author.className = "ai-author"; author.textContent = message.role === "user" ? "you" : "velxAI";
   const body = document.createElement("div"); body.className = "ai-message-body"; body.id = "ai-reply-" + message.id; format(body, message.content);
   const state = document.createElement("p"); state.className = "ai-message-state";
   state.textContent = message.status === "error" ? "response failed" : message.status === "stopped" ? "response stopped" : "";
   article.append(author, body, state); messages.append(article);
  }
  messages.scrollTop = messages.scrollHeight;
 }
 function controls() {
  $("ai-new").disabled = loading;
  input.disabled = loading;
  $("ai-send").disabled = loading || !!pending || !input.value.trim();
  $("ai-stop").hidden = !pending;
  const last = active()?.messages.at(-1);
  $("ai-retry").hidden = !!pending || !last || !["error", "stopped"].includes(last.status);
 }
 function render() { renderHistory(); renderMessages(); controls(); showError(); }
 function newChat() {
  if (loading) return;
  let chat = chats.find(item => !item.messages.length);
  if (!chat) {
   chat = { id: crypto.randomUUID(), title: "new chat", updated: Date.now(), messages: [] }; chats.push(chat);
  }
  activeId = chat.id; error = ""; page.classList.remove("history-open"); render(); input.focus();
  return chat;
 }
 function updateReply(chat, reply) {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
   scheduled = false;
   if (activeId !== chat.id) return;
   const body = $("ai-reply-" + reply.id);
   if (!body) return;
   const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120;
   format(body, reply.content);
   if (follow) messages.scrollTop = messages.scrollHeight;
  });
 }
 async function consume(response, onText) {
  if (response.headers.get("Content-Type")?.includes("application/json")) {
   const data = await response.json(); if (typeof data.text !== "string") throw Error("AI returned an invalid reply."); onText(data.text); return;
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = "", done = false;
  function event(block) {
   const name = block.split("\n").find(line => line.startsWith("event:"))?.slice(6).trim();
   const raw = block.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
   if (!raw) return;
   const data = JSON.parse(raw);
   if (name === "error") throw Error(data.error || "The response was interrupted.");
   if (name === "text" && typeof data.text === "string") onText(data.text);
   if (name === "done") done = true;
  }
  try {
   for (;;) {
    const chunk = await reader.read(); if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
    let next;
    while ((next = buffer.indexOf("\n\n")) !== -1) { event(buffer.slice(0, next)); buffer = buffer.slice(next + 2); }
   }
   buffer += decoder.decode(); if (buffer.trim()) event(buffer);
   if (!done) throw Error("The response was interrupted. Try again.");
  } finally { await reader.cancel().catch(() => {}); }
 }
 async function send(retry = false) {
  if (loading || pending || !retry && !input.value.trim()) return;
  const chat = active() || newChat();
  error = "";
  if (retry) {
   if (!["error", "stopped"].includes(chat.messages.at(-1)?.status)) return;
   chat.messages.pop();
  } else {
   const text = input.value.trim();
   chat.messages.push({ id: crypto.randomUUID(), role: "user", content: text, status: "complete" });
   if (chat.messages.filter(message => message.role === "user").length === 1) chat.title = text.slice(0, 48);
   input.value = ""; input.style.height = "auto";
  }
  const history = context(chat);
  const reply = { id: crypto.randomUUID(), role: "assistant", content: "", status: "loading" };
  chat.messages.push(reply); chat.updated = Date.now();
  const controller = new AbortController(); pending = { controller, chatId: chat.id }; render();
  await persist(chat);
  try {
   const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history }), signal: controller.signal });
   if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(data.error || "AI could not answer. Try again."); }
   await consume(response, text => { reply.content += text; updateReply(chat, reply); });
   reply.status = "complete";
  } catch (problem) {
   reply.status = controller.signal.aborted ? "stopped" : "error";
   if (!controller.signal.aborted) error = problem.message || "AI could not be reached. Try again.";
  } finally {
   pending = null; chat.updated = Date.now(); await persist(chat); render();
   if (activeId === chat.id) input.focus();
  }
 }
 $("ai-form").addEventListener("submit", event => { event.preventDefault(); send(); });
 input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; controls(); });
 input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); } });
 $("ai-new").addEventListener("click", newChat);
 $("ai-stop").addEventListener("click", () => pending?.controller.abort());
 $("ai-retry").addEventListener("click", () => send(true));
 $("ai-history-toggle").addEventListener("click", () => { const expanded = page.classList.toggle("history-open"); $("ai-history-toggle").setAttribute("aria-expanded", String(expanded)); });
 window.addEventListener("velx-ai-open", () => input.focus());
 (async () => {
  try {
   chats = (await window.velxAIStore.list()).filter(chat => typeof chat.id === "string" && typeof chat.title === "string" && Array.isArray(chat.messages));
   for (const chat of chats) {
    chat.messages = chat.messages.filter(message => ["user", "assistant"].includes(message.role) && typeof message.content === "string");
    for (const message of chat.messages) if (message.status === "loading") message.status = "stopped";
   }
   chats.sort((a, b) => b.updated - a.updated); activeId = chats[0]?.id || null;
  } catch { storageError = "Chats cannot be saved in this browser."; }
  finally { loading = false; render(); }
 })();
})();
