'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const api='https://velocify-rooms.realdashvr.workers.dev/';
 const params=new URLSearchParams(location.search);
 let game=params.get('game')==='roulette'?'roulette':'blackjack';
 let code='', token='', state=null, pending=false, timer=null, lastRound='', rotation=0;
 let clockOffset=0;
 const money=c=>'$'+(c/100).toFixed(2);
 const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
 const read=key=>{try{return localStorage.getItem(key)||'';}catch{return '';}};
 const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 function theme() { try { const root=parent.document.documentElement; document.documentElement.dataset.theme=root.dataset.theme||''; for(const key of ['--bg','--surface','--border','--text','--muted','--accent']) document.documentElement.style.setProperty(key,getComputedStyle(root).getPropertyValue(key)); } catch {} }
 theme();
 $('title').textContent=game;
 $('name').value=read('velocify-table-name');
 $('code').value=params.get('room')||'';
 for(let n=0;n<=36;n++) { const o=document.createElement('option'); o.value=String(n); o.textContent=String(n); $('choice').append(o); }
 function busy(value) { pending=value; for(const b of document.querySelectorAll('button')) b.disabled=value; if(state) render(); }
 async function request(data,roomCode=code) {
  const response=await fetch(api+roomCode,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(data),signal:AbortSignal.timeout(60000)});
  const body=await response.json();
  if(!response.ok) throw Error(body.error||'connection failed');
  return body;
 }
 function apply(next) { if(state && next.serverTime < state.serverTime) return; state=next; token=next.token; clockOffset=next.serverTime-Date.now(); write('velocify-room-'+code,token); render(); }
 async function enter(create) {
  if(pending) return;
  const name=$('name').value.trim();
  if(!name) { $('error').textContent='enter your name'; $('name').focus(); return; }
  code=create?Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join(''):$('code').value.trim().toUpperCase();
  if(!/^[A-Z2-9]{6}$/.test(code)) { $('error').textContent='enter a 6-character room code'; return; }
  token=read('velocify-room-'+code); busy(true); $('error').textContent='connecting…';
  try {
   const next=await request({action:create?'create':'join',game,name});
   game=next.game; $('title').textContent=game; write('velocify-table-name',name);
   apply(next); $('lobby').hidden=true; $('room').hidden=false; $('error').textContent='';
   clearTimeout(timer); poll();
  } catch(e) { $('error').textContent=e.message; } finally { busy(false); }
 }
 async function poll() {
  timer=setTimeout(async()=>{
   if(!state) return;
   if(!pending) try { apply(await request({action:'state'})); $('error').textContent=''; } catch { $('error').textContent='connection lost. reconnecting…'; }
   if(state) poll();
  },1500);
 }
 async function act(action,extra={}) {
  if(pending) return;
  busy(true); $('error').textContent='';
  try { apply(await request({action,...extra})); } catch(e) { $('error').textContent=e.message; } finally { busy(false); }
 }
 function cards(hand) {
  const row=document.createElement('div'); row.className='cards';
  for(const c of hand) { const card=document.createElement('span'); card.className='card'; if(c===null) card.textContent='?'; else { const suit=Math.floor(c/13); card.textContent=['A','2','3','4','5','6','7','8','9','10','J','Q','K'][c%13]+['♠','♥','♦','♣'][suit]; if(suit===1||suit===2) card.classList.add('red'); } row.append(card); }
  return row;
 }
 function line(parent,text,tag='p') { const el=document.createElement(tag); el.textContent=text; parent.append(el); return el; }
 function render() {
  if(!state) return;
  const me=state.players.find(p=>p.you);
  const betting=state.phase==='betting';
  $('room-code').textContent='room '+code;
  $('balance').textContent=money(me.balance);
  $('choice-label').hidden=game!=='roulette'; $('wheel').hidden=game!=='roulette'; $('dealer').hidden=game!=='blackjack';
  $('bet').disabled=pending||!betting||me.bet>0||me.balance<100;
  $('amount').disabled=pending||!betting||me.bet>0; $('amount').max=(me.balance/100).toFixed(2);
  $('choice').disabled=pending||!betting||me.bet>0;
  const playing=game==='blackjack'&&state.phase==='playing'&&me.bet>0&&!me.done;
  for(const id of ['hit','stand']) { $(id).hidden=!playing; $(id).disabled=pending; }
  $('refill').hidden=me.balance!==0||me.bet>0&&state.phase!=='result'; $('refill').disabled=pending;
  $('table-note').textContent=game==='blackjack'?'dealer stands on 17 · blackjack pays 3:2':'single zero · colors / odd / even pay 1:1 · numbers pay 35:1';
  $('dealer').replaceChildren();
  if(game==='blackjack') { line($('dealer'),'dealer','strong'); $('dealer').append(cards(state.dealer)); }
  if(game==='roulette'&&state.phase==='result'&&lastRound!==String(state.round)) { lastRound=String(state.round); rotation+=1080+(state.number/37)*360; $('wheel-ring').style.transform='rotate('+rotation+'deg)'; $('number').textContent=state.number; $('number').classList.toggle('red',red.includes(state.number)); }
  $('players').replaceChildren();
  for(const p of state.players) {
   const el=document.createElement('article'); el.className='player'+(p.you?' you':'');
   line(el,p.name+(p.you?' (you)':''),'strong'); line(el,money(p.balance));
   if(p.hand.length&&game==='blackjack') el.append(cards(p.hand));
   line(el,p.bet?'bet '+money(p.bet)+(game==='roulette'?' on '+p.choice:''):'no bet');
   line(el,state.phase==='result'?p.result:state.phase==='playing'&&p.bet?(p.done?'standing':'playing'):'');
   $('players').append(el);
  }
  countdown();
 }
 function countdown() { if(!state)return; const seconds=Math.max(0,Math.ceil((state.deadline-Date.now()-clockOffset)/1000)); $('phase').textContent='round '+state.round+' · '+({betting:'place your bets',playing:'hit or stand',result:'next round'}[state.phase])+' · '+seconds+'s'; }
 setInterval(countdown,250);
 $('create').onclick=()=>enter(true);
 $('join').onsubmit=e=>{e.preventDefault();enter(false);};
 $('bet-form').onsubmit=e=>{e.preventDefault();act('bet',{amount:Math.round(Number($('amount').value)*100),choice:$('choice').value});};
 $('hit').onclick=()=>act('hit'); $('stand').onclick=()=>act('stand'); $('refill').onclick=()=>act('refill');
 $('leave').onclick=()=>{clearTimeout(timer);state=null;token='';$('room').hidden=true;$('lobby').hidden=false;$('error').textContent='';};
 $('copy').onclick=async()=>{
  const url=new URL(parent.location.href); url.searchParams.delete('u'); url.searchParams.set('table',game); url.searchParams.set('room',code);
  try { await navigator.clipboard.writeText(url.href); $('copy').textContent='copied'; setTimeout(()=>$('copy').textContent='copy invite',1500); } catch { $('error').textContent='share room code '+code; }
 };
 parent.postMessage({velocify:'game-ready'},location.origin);
})();
