"use strict";
(() => {
 const $ = id => document.getElementById(id);
 const list = $('chat-messages'), input = $('chat-input'), name = $('chat-name');
 let socket, reconnect, retry = 0, ownId = '', visible = false, ready = false, pending = '', sentAt = 0;
 const messages = new Map();
 try { name.value = localStorage.getItem('velocify-chat-name') || ''; } catch {}
 function passwordPrompt() {
  const owner = name.value.trim().toLowerCase() === 'velx';
  $('chat-password-wrap').hidden = !owner;
  $('chat-password').required = owner;
  if (!owner) $('chat-password').value = '';
 }
 passwordPrompt();
 name.addEventListener('input', passwordPrompt);
 function error(text = '') { $('chat-error').textContent = text; $('chat-error').hidden = !text; }
 function controls() {
  $('chat-send').disabled = !ready || !!pending || !input.value.trim();
  input.disabled = !ready;
  $('chat-status').textContent = ready ? 'connected' : socket?.readyState === WebSocket.OPEN ? 'set your name to chat' : socket?.readyState === WebSocket.CONNECTING ? 'connecting…' : 'disconnected';
 }
 function render() {
  const follow = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  list.replaceChildren();
  if (!messages.size) { const empty = document.createElement('p'); empty.className = 'chat-empty'; empty.textContent = 'no messages yet'; list.append(empty); }
  for (const message of messages.values()) {
   const row = document.createElement('article'); row.className = 'chat-message';
   if (message.authorId === ownId) row.classList.add('own');
   const heading = document.createElement('header'), author = document.createElement('strong'), time = document.createElement('time'), text = document.createElement('p');
   author.textContent = message.name; time.dateTime = new Date(message.time).toISOString(); time.textContent = new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
   text.textContent = message.text; heading.append(author);
   if (message.owner === true) { const badge = document.createElement('span'); badge.className = 'chat-owner'; badge.textContent = 'owner'; heading.append(badge); }
   heading.append(time); row.append(heading, text); list.append(row);
  }
  if (follow) list.scrollTop = list.scrollHeight;
 }
 function connect() {
  if (!visible || socket && socket.readyState < WebSocket.CLOSING) return;
  clearTimeout(reconnect);
  socket = new WebSocket('wss://velocify-public-chat.realdashvr.workers.dev/connect');
  const connection = socket;
  controls();
  socket.onopen = () => { retry = 0; if (name.value.trim() && (name.value.trim().toLowerCase() !== 'velx' || $('chat-password').value)) setName(); controls(); };
  socket.onmessage = event => {
   try {
    const data = JSON.parse(event.data);
    if (data.type === 'history') { messages.clear(); for (const message of data.messages) messages.set(message.id, message); render(); }
    if (data.type === 'named') { ownId = data.id; ready = true; name.value = data.name; error(); render(); controls(); }
    if (data.type === 'message') {
     messages.set(data.message.id, data.message);
     while (messages.size > 100) messages.delete(messages.keys().next().value);
     if (data.message.authorId === ownId && pending) { pending = ''; input.value = ''; error(); }
     render(); controls();
    }
    if (data.type === 'error') { pending = ''; error(data.error); controls(); }
   } catch { error('Could not read a chat update.'); }
  };
  socket.onclose = () => {
   if (socket !== connection) return;
   ready = false;
   if (pending) { pending = ''; error('Connection lost. Your message is still in the box.'); }
   controls();
   if (visible) { reconnect = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++)); }
  };
  socket.onerror = () => error('Could not connect. Retrying…');
 }
 function setName() {
  const value = name.value.trim();
  if (!value || value.length > 24) { error('Choose a name between 1 and 24 characters.'); return; }
  try { localStorage.setItem('velocify-chat-name', value); } catch {}
  if (socket?.readyState === WebSocket.OPEN) { ready = false; socket.send(JSON.stringify({ type: 'name', name: value, password: value.toLowerCase() === 'velx' ? $('chat-password').value : undefined })); controls(); }
  else connect();
 }
 $('chat-name-form').addEventListener('submit', event => { event.preventDefault(); setName(); });
 $('chat-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!ready || pending || !input.value.trim()) return;
  if (Date.now() - sentAt < 1500) { error('Wait a moment before sending again.'); return; }
  pending = input.value.trim(); sentAt = Date.now();
  try { socket.send(JSON.stringify({ type: 'message', text: pending })); controls(); }
  catch { pending = ''; error('Message not sent. Reconnect and try again.'); controls(); }
 });
 input.addEventListener('input', controls);
 input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); $('chat-form').requestSubmit(); } });
 window.addEventListener('velx-chat-open', () => { visible = true; connect(); });
 window.addEventListener('velx-chat-close', () => { visible = false; clearTimeout(reconnect); socket?.close(1000); });
 window.addEventListener('online', () => { if (visible) connect(); });
 window.addEventListener('pagehide', () => { visible = false; clearTimeout(reconnect); socket?.close(1000); });
 render(); controls();
})();
