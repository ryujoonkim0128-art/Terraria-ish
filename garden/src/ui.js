// DOM UI and controls: joystick + camera drag, tap to plant, Collect prompts, teleport buttons,
// shop sheets, toasts, the wordless tutorial, and stealing from the other gardens on the street.
import { CROPS, CROP, RARITIES, MUTS, MUT_ORDER, WEATHER, BASKET, BED, inBed, plural, fruitValue } from './data.js';
import { G, on, plant, collect, sell, buySeed, buyWare, dig, inStock, restockIn, period, ripeCount, totalRipe, bagValue, sellValue, marketOpen, itemKey, placeBlock, reset, save, tutDone, TUT_DONE, steal, stealPrice, stealWait } from './state.js';
import { speed, isNight, bloodMoon } from './sim.js';
import * as Wd from './world.js';
import { ICON } from './icons.js';
import { sfx, initAudio, setSound, setMusic, setFestival } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export function fmt(n) {
  n = Math.floor(n);
  if (n < 100000) return n.toLocaleString('en-US');
  const u = ['K', 'M', 'B', 'T', 'Qd']; let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 10 ? (Math.floor(n * 100) / 100).toFixed(2) : n < 100 ? (Math.floor(n * 10) / 10).toFixed(1) : Math.floor(n)) + u[i];
}
export function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return s >= 3600 ? Math.floor(s / 3600) + 'h ' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + 'm' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

const REACH = 8;      // how close you must stand for the Collect prompt
const TAP_REACH = 15; // tapping a fruit directly works from a bit further
const SVG = {
  gear: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M4 0h2v2h1V1h1v1h1v1H8v1h2v2H8v1h1v1H8v1H7V8H6v2H4V8H3v1H2V8H1V7h1V6H0V4h2V3H1V2h1V1h1v1h1z"/><path fill="#3a3a5a" d="M4 4h2v2H4z"/></svg>',
  shovel: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#a8744b" d="M8 0h2v1H9v1H8v1H7v1H6v1H5V4h1V3h1V2h1z"/><path fill="#c8c6d8" d="M3 4h2v1h1v2H5v1H4v1H2V8H1V6h1V5h1z"/><path fill="#8a88a0" d="M2 8h2v1H2zM5 6h1v1H5z"/></svg>',
  hand: '<svg viewBox="0 0 11 13" shape-rendering="crispEdges"><path fill="#1a1a2e" d="M3 0h2v1h1v4h4v1h1v5h-1v1H9v1H3v-1H2v-1H1V9H0V7h1V6h2z"/><path fill="#fff6e6" d="M4 1h1v5h1V5h1v1h1V6h1v1h1v4H9v1H4v-1H3v-1H2V9H1V8h1V7h1V6h1z"/><path fill="#ffd8b8" d="M4 10h5v1H4z"/></svg>',
  grab: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M2 1h1v4h1V0h1v5h1V1h1v4h1V3h1v5H8v1H3V8H2V7H1V5h1z"/></svg>',
  shop: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M1 1h8v2H1zM1 4h8v5H1z"/><path fill="#3a3a5a" d="M4 5h2v4H4z"/></svg>',
  sprout: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M4 4h2v6H4zM1 1h3v1h1v2H2V2H1zM6 2h3v1H8v1H5V3h1z"/></svg>',
  coin: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M3 1h4v1h1v1h1v4H8v1H7v1H3V8H2V7H1V3h1V2h1z"/><path fill="rgba(0,0,0,0.22)" d="M4 3h2v4H4z"/></svg>',
  house: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M4 1h2v1h1v1h1v1h1v1H1V4h1V3h1V2h1zM2 5h6v4H6V7H4v2H2z"/></svg>',
  tent: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M4 0h2v1h1v1h1v1h1v1h1v1H0V4h1V3h1V2h1V1h1z"/><path fill="#ffd84e" d="M1 5h8v4H1z"/><path fill="#3a3a5a" d="M4 6h2v3H4z"/></svg>',
  sack: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M3 0h4v1H6v1h1v1h1v1h1v1h1v4H9v1H1V9H0V5h1V4h1V3h1V2h1V1H3z"/><path fill="#3a3a5a" d="M4 4h3v1H5v1h2v3H4V8h2V7H4z"/></svg>',
};
const WICON = {
  clear: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#ffb43a" d="M4 0h1v1H4zM4 8h1v1H4zM0 4h1v1H0zM8 4h1v1H8z"/><path fill="#ffd84e" d="M2 2h5v5H2z"/><path fill="#fff4a0" d="M2 2h3v1H2z"/></svg>',
  rain: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#e8f0ff" d="M2 1h4v1h1v1h1v2H1V3h1z"/><path fill="#6cb6ff" d="M2 6h1v1H2zM5 7h1v1H5zM7 6h1v1H7z"/></svg>',
  storm: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#9a9ab4" d="M2 1h4v1h1v1h1v2H1V3h1z"/><path fill="#ffe14a" d="M4 5h2v1H5v1H4v1H3V7h1V6h0z"/></svg>',
  snow: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#e8f6ff" d="M4 0h1v9H4zM0 4h9v1H0zM1 1h1v1H1zM7 1h1v1H7zM1 7h1v1H1zM7 7h1v1H7zM2 2h1v1H2zM6 2h1v1H6zM2 6h1v1H2zM6 6h1v1H6z"/></svg>',
  night: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#f2f0dc" d="M3 0h3v1H4v1H3v5h1v1h2v1H3V8H2V7H1V2h1V1h1z"/></svg>',
  blood: '<svg class="wi" viewBox="0 0 9 9" shape-rendering="crispEdges"><path fill="#ff4a5a" d="M3 0h3v1H4v1H3v5h1v1h2v1H3V8H2V7H1V2h1V1h1z"/></svg>',
};

let ui = {};
export const input = { x: 0, y: 0 };
const keys = new Set();

// ---------------------------------------------------------------- build
export function build(app) {
  app.insertAdjacentHTML('beforeend', `
    <div id="hud">
      <div class="pill blk" id="moneyPill"><i class="coin"></i><span id="money">0</span></div>
      <div class="spacer"></div>
      <button class="pill blk" id="weather"></button>
      <button class="blk" id="settings" aria-label="Settings">${SVG.gear}</button>
    </div>
    <nav id="tp">
      <button class="blk tp" data-tp="seeds">${SVG.sprout}Seeds</button>
      <button class="blk tp" data-tp="sell">${SVG.coin}Sell<span class="badge" id="bagN" hidden>0</span></button>
      <button class="blk tp" data-tp="garden">${SVG.house}Garden</button>
    </nav>
    <div id="goal" class="blk" hidden><img alt=""><span class="txt"></span><span class="n"></span><div class="bar"><i></i></div></div>
    <button id="event" class="blk" hidden><span class="tent">${SVG.tent}</span><span class="t">Market Day</span><img class="hot" alt=""><b class="x3">x3</b><span class="time"></span></button>
    <div id="stick"><div class="base"></div><div class="knob"></div></div>
    <button id="act" class="blk" hidden><span class="ico"></span><span class="lbl">Collect</span><span class="badge" hidden></span></button>
    <button id="prompt" class="blk" hidden><i class="key">${SVG.grab}</i><span><b>Collect</b><small></small></span></button>
    <div id="tray" class="blk"><div id="hotbar"></div></div>
    <div id="info" class="blk" hidden><div class="t"></div><div class="pb"><i></i></div><div class="s"></div></div>
    <div id="toasts"></div>
    <div id="fx"></div>
    <div id="hand" hidden>${SVG.hand}</div>
    <div id="fade"></div>
    <div id="shade"></div>
    <section class="sheet blk" id="sheet"><header><h2></h2><span class="sub"></span><button class="x blk" aria-label="Close">X</button></header><div class="list"></div><footer hidden></footer></section>
  `);
  ui = { money: $('#money'), weather: $('#weather'), hotbar: $('#hotbar'), act: $('#act'), prompt: $('#prompt'), bagN: $('#bagN'), info: $('#info'), toasts: $('#toasts'), fx: $('#fx'), hand: $('#hand'), goal: $('#goal'), shade: $('#shade'), sheet: $('#sheet'), stick: $('#stick'), fade: $('#fade'), sellBtn: $('[data-tp="sell"]'), event: $('#event') };
  ui.event.onclick = () => { if (marketOpen()) teleportTo('market'); else toast('Market Day opens in ' + fmtTime(G.mkt.next) + '.'); };
  ui.shown = G.money;
  $('#settings').onclick = () => openSheet('settings');
  ui.weather.onclick = () => toast(G.weather.type !== 'clear' ? WEATHER[G.weather.type].msg : isNight() ? 'Moonlight can make ripe fruit Moonlit (x2).' : 'The weather changes every few minutes.');
  document.querySelectorAll('.tp').forEach((b) => (b.onclick = () => teleportTo(b.dataset.tp)));
  ui.shade.onclick = closeSheet;
  $('.x', ui.sheet).onclick = closeSheet;
  ui.hotbar.addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (!s) return;
    G.sel = G.sel === s.dataset.id ? null : s.dataset.id;
    sfx('tap'); renderHotbar();
  });
  // action button and prompt: tap = once, hold = keep collecting everything in reach
  for (const el of [ui.act, ui.prompt]) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); actHeld = true; actT = 0; doAction(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => { actHeld = false; });
  }
  renderHotbar();
  const gl = $('#gl');
  gl.addEventListener('pointerdown', down);
  gl.addEventListener('pointermove', move);
  gl.addEventListener('pointerup', up);
  gl.addEventListener('pointercancel', up);
  gl.addEventListener('wheel', (e) => { e.preventDefault(); Wd.zoomCam(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    keys.add(e.key.toLowerCase());
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); doAction(true); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) { const it = hotItems()[n - 1]; if (it) { G.sel = G.sel === it.id ? null : it.id; renderHotbar(); } }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  placeStick(null);
}

export function showTitle(app, start) {
  const t = h('div', '', `<h1>Grow a<em>Garden</em></h1><button class="blk">${G.stats.planted ? 'Play' : 'Start'}</button>`);
  t.id = 'title';
  app.appendChild(t);
  $('button', t).onclick = () => { initAudio(); setSound(G.sound); setMusic(G.music); sfx('open'); t.remove(); start(); };
}

// ---------------------------------------------------------------- hotbar
function hotItems() {
  const out = CROPS.filter((c) => G.seeds[c.id] > 0).map((c) => ({ id: 'seed:' + c.id, img: ICON[c.id], n: G.seeds[c.id], rc: RARITIES[c.rarity].col }));
  out.push({ id: 'shovel', svg: SVG.shovel });
  return out;
}
let hotKey = '';
export function renderHotbar() {
  if (G.sel && G.sel !== 'shovel' && !(G.seeds[G.sel.slice(5)] > 0)) G.sel = null;
  const items = hotItems();
  const k = items.map((i) => i.id + i.n).join() + G.sel;
  if (k === hotKey) return;
  hotKey = k;
  ui.hotbar.innerHTML = '';
  items.forEach((it, i) => {
    const b = h('button', 'slot blk' + (G.sel === it.id ? ' sel' : ''));
    b.dataset.id = it.id;
    b.innerHTML = (it.rc ? `<i class="band" style="--rc:${it.rc}"></i>` : '') + (it.img ? `<img src="${it.img}" alt="">` : it.svg) + (it.n ? `<span class="n">x${it.n}</span>` : '') + `<span class="k">${i + 1}</span>`;
    ui.hotbar.appendChild(b);
  });
}
const selCrop = () => (G.sel && G.sel.startsWith('seed:') ? G.sel.slice(5) : null);
function nextSeed(after) {
  if (G.seeds[after] > 0) return;
  const n = CROPS.find((c) => G.seeds[c.id] > 0);
  G.sel = n ? 'seed:' + n.id : null;
  if (!n && tutDone()) toast('Out of seeds! Tap Seeds at the top to buy more.');
}

// ---------------------------------------------------------------- touch: joystick on the left, camera on the right, taps anywhere
const ptrs = new Map();
let pinch = null;
function stickZone(x, y) { return x < innerWidth * 0.45 && y > innerHeight * 0.32; }
function placeStick(p) {
  const s = ui.stick;
  if (!p) { s.classList.remove('on'); s.style.left = '78px'; s.style.top = ''; s.style.bottom = 'calc(var(--sb) + 150px)'; $('.knob', s).style.transform = ''; return; }
  s.classList.add('on'); s.style.left = p.x + 'px'; s.style.top = p.y + 'px'; s.style.bottom = 'auto';
}
function down(e) {
  e.preventDefault();
  try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  const P = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, role: null };
  P.role = stickZone(P.sx, P.sy) && ![...ptrs.values()].some((q) => q.role === 'stick') ? 'stick' : 'cam';
  ptrs.set(e.pointerId, P);
  if (P.role === 'stick') placeStick({ x: P.sx, y: P.sy });
  const cams = [...ptrs.values()].filter((q) => q.role === 'cam');
  if (cams.length === 2) pinch = { d: Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y) };
  ui.info.hidden = true; ui.infoPl = null;
}
function move(e) {
  const P = ptrs.get(e.pointerId);
  if (!P) return;
  const dx = e.clientX - P.x, dy = e.clientY - P.y;
  P.x = e.clientX; P.y = e.clientY;
  if (!P.moved && Math.hypot(P.x - P.sx, P.y - P.sy) > 9) P.moved = true;
  if (P.role === 'stick') {
    let ox = P.x - P.sx, oy = P.y - P.sy;
    const r = 52, l = Math.hypot(ox, oy);
    if (l > r) { ox = (ox / l) * r; oy = (oy / l) * r; }
    $('.knob', ui.stick).style.transform = `translate(${ox}px, ${oy}px)`;
    input.x = ox / r; input.y = -oy / r;
    return;
  }
  const cams = [...ptrs.values()].filter((q) => q.role === 'cam');
  if (cams.length >= 2 && pinch) {
    const d = Math.hypot(cams[0].x - cams[1].x, cams[0].y - cams[1].y);
    Wd.zoomCam(d / pinch.d); pinch.d = d;
    return;
  }
  if (P.moved) Wd.rotateCam(dx, dy);
}
function up(e) {
  const P = ptrs.get(e.pointerId);
  if (!P) return;
  ptrs.delete(e.pointerId);
  if (P.role === 'stick') { input.x = input.y = 0; placeStick(null); }
  if ([...ptrs.values()].filter((q) => q.role === 'cam').length < 2) pinch = null;
  if (!P.moved && performance.now() - P.t < 450 && e.type === 'pointerup') tap(P.sx, P.sy);
}

// ---------------------------------------------------------------- taps on the world
function tap(x, y) {
  const fr = Wd.pickFruit(x, y);
  const p = Wd.W.player;
  if (fr && G.sel !== 'shovel') {
    const f = fr.pl._fw[fr.k];
    if (Math.hypot(f.x - p.x, f.z - p.z) <= TAP_REACH) { if (fr.owner) askSteal(fr.owner, fr.pl, fr.k); else grab(fr.pl, fr.k); return; }
    tooFar(f); return;
  }
  const hit = Wd.pickPlant(x, y), pl = hit && !hit.owner ? hit.pl : null;
  if (hit && hit.owner) {
    if (G.sel === 'shovel') { toast(`That's ${hit.owner.name}'s garden!`); sfx('error'); return; }
    showInfo(hit.pl, hit.owner); sfx('tap'); return;
  }
  if (pl) {
    if (G.sel === 'shovel') {
      if (CROP[pl.c].price >= 1000) dialog(`Dig up this ${CROP[pl.c].name}? It will be gone for good.`, 'Dig up', () => dig(pl), 'var(--red)');
      else dig(pl);
      Wd.faceTo(pl.x, pl.z);
      return;
    }
    if (ripeCount(pl)) {
      const k = pl.fr.findIndex((f) => f && f.p >= 1);
      if (Wd.distTo(pl.x, pl.z) <= TAP_REACH) { grab(pl, k); return; }
      tooFar((pl._fw && pl._fw[k]) || { x: pl.x, y: 4, z: pl.z }); return;
    }
    if (!selCrop()) { showInfo(pl); sfx('tap'); return; }
  }
  const shop = Wd.pickShop(x, y);
  if (shop) { if (Wd.nearShop(16) === shop) openSheet(shop); else { pulse($(`[data-tp="${shop}"]`)); toast(`Tap ${Wd.SHOPS[shop].name} at the top to go there.`); } return; }
  const gp = Wd.groundPoint(x, y);
  const crop = selCrop();
  if (crop && gp) {
    if (!inBed(gp.x, gp.z)) { toast('Plant seeds on your garden soil.'); sfx('error'); return; }
    tryPlant(crop, gp);
    return;
  }
  if (pl) { showInfo(pl); sfx('tap'); }
}
function tryPlant(crop, gp) {
  const x = Math.round(gp.x), z = Math.round(gp.z);
  const why = placeBlock(crop, x, z);
  if (why) {
    Wd.flashRing(x, z); sfx('error');
    toast(why === 'crowded' ? 'Too close to another plant.' : why === 'full' ? 'Your garden is full!' : 'Too close to the edge.');
    return;
  }
  Wd.faceTo(x, z);
  const delay = Wd.toss(x, z, Wd.seedColor(crop));
  const pl = plant(crop, x, z);
  if (!pl) return;
  Wd.pop(pl, 'plant', delay);
  if (G.tut <= 2) { pl.boost = true; if (pl.fr[0]) pl.fr[0].s = Math.max(pl.fr[0].s, 1); }
  nextSeed(crop); renderHotbar();
}
function tooFar(f) { const s = Wd.project(f.x, f.y + 2, f.z); floatText('Walk closer', s.x, s.y, '#ffe9a8'); sfx('error'); }
function grab(pl, k) {
  const f = pl._fw && pl._fw[k];
  if (f) Wd.faceTo(f.x, f.z);
  collect(pl, k);
}

// ---------------------------------------------------------------- proximity: Collect prompt + action button
let actHeld = false, actT = 0, near = null;
// the nearest ripe fruit in reach: in your garden, or (others = true) in someone else's
function nearestRipe(R, others = false) {
  const p = Wd.W.player;
  let best = null, bd = R, count = 0;
  for (const { owner, plants } of others ? Wd.gardens().slice(1) : [{ owner: null, plants: G.plants }]) for (const pl of plants) for (let k = 0; k < (pl._fw || []).length; k++) {
    const f = pl._fw[k];
    if (!f || !f.ripe || !pl.fr[k]) continue;
    const d = Math.hypot(f.x - p.x, f.z - p.z);
    if (d > R) continue;
    count++;
    if (d < bd) { bd = d; best = { pl, k, f, owner }; }
  }
  return best ? { ...best, count } : null;
}
function doAction(fromPress) {
  if (!near) return;
  if (near.kind === 'fruit') { const n = nearestRipe(REACH); if (n) grab(n.pl, n.k); }
  else if (!fromPress) return;
  else if (near.kind === 'steal') askSteal(near.owner, near.pl, near.k);
  else if (near.kind === 'cart') openSheet('cart:' + near.cart);
  else openSheet(near.kind);
}
// what a fruit is called, with its best mutation: "Gold Mango"
const fruitName = (c, m) => { const top = MUT_ORDER.find((x) => m.includes(x)); return (top ? MUTS[top].name + ' ' : '') + CROP[c].name; };
// Stealing: you pay half what the fruit is worth (in Sheckles for now), and that garden moves out
function askSteal(owner, pl, k) {
  const f = pl.fr[k];
  if (!f || f.p < 1) return;
  const wait = stealWait();
  if (wait > 0) { toast(`Lie low for a bit. You can steal again in ${fmtTime(wait)}.`); sfx('error'); return; }
  const price = stealPrice(pl, k), name = fruitName(pl.c, f.m);
  if (G.money < price) { toast(`Stealing this ${name} costs $${fmt(price)}.`); sfx('error'); return; }
  const worth = fruitValue(pl.c, f.s, f.m);
  dialog(`Steal ${esc(owner.name)}'s ${name}?<small>It sells for $${fmt(worth)}. Their garden will move away after this.</small>`, `Steal $${fmt(price)}`, () => {
    if (pl._fw && pl._fw[k]) Wd.faceTo(pl._fw[k].x, pl._fw[k].z);
    steal(owner, pl, k);
  }, 'var(--red)');
}
// standing in front of one of the Market Day carts
function nearCart() {
  if (!marketOpen()) return null;
  for (const id in Wd.CARTS) { const c = Wd.marketSpot(id); if (Wd.distTo(c.x, c.z) < 8) return { kind: 'cart', cart: id }; }
  return null;
}
const ACTS = { fruit: ['Collect', 'grab'], steal: ['Steal', 'sack'], seeds: ['Shop', 'shop'], sell: ['Sell', 'shop'], cart: ['Shop', 'shop'] };
function updateProximity(dt) {
  const nr = nearestRipe(REACH), theirs = nr ? null : nearestRipe(REACH, true), shop = nr || theirs ? null : Wd.nearShop(12) || nearCart();
  near = nr ? { kind: 'fruit', ...nr } : theirs ? { kind: 'steal', ...theirs } : typeof shop === 'string' ? { kind: shop } : shop;
  if (sheetKind || document.getElementById('title')) near = null;
  if (!near) { ui.act.hidden = true; ui.prompt.hidden = true; actHeld = false; return; }
  ui.act.hidden = false;
  const fruit = near.kind === 'fruit' || near.kind === 'steal', [label, icon] = ACTS[near.kind];
  if (ui.actLabel !== label + icon) {
    ui.actLabel = label + icon;
    $('.lbl', ui.act).textContent = label;
    $('.ico', ui.act).innerHTML = $('.key', ui.prompt).innerHTML = SVG[icon];
    for (const k of ['shop', 'steal']) { const on = k === 'shop' ? icon === 'shop' : near.kind === k; ui.act.classList.toggle(k, on); ui.prompt.classList.toggle(k, on); }
  }
  const badge = $('.badge', ui.act);
  badge.hidden = near.kind !== 'fruit' || near.count < 2; badge.textContent = near.count;
  // floating prompt over the fruit, the stall or the cart
  const cart = near.kind === 'cart' && Wd.CARTS[near.cart];
  const at = fruit ? Wd.project(near.f.x, near.f.y + (near.f.sit ? 3.5 : 1.5), near.f.z)
    : cart ? Wd.project(cart.x, 16.5, cart.z)
    : Wd.project(Wd.SHOPS[near.kind].x, 13, Wd.SHOPS[near.kind].z + 1);
  ui.prompt.hidden = at.behind;
  ui.prompt.style.left = at.x + 'px'; ui.prompt.style.top = at.y + 'px';
  const fr = fruit && near.pl.fr[near.k];
  const sub = near.kind === 'steal' ? (fr ? `${fruitName(near.pl.c, fr.m)} · ${stealWait() > 0 ? 'wait ' + fmtTime(stealWait()) : '$' + fmt(stealPrice(near.pl, near.k))}` : '')
    : fruit ? CROP[near.pl.c].name + (fr ? ` · ${(CROP[near.pl.c].kg * fr.s).toFixed(2)}kg` : '')
    : cart ? CARTNAME[near.cart] : near.kind === 'seeds' ? 'Seed shop' : 'Sell your harvest';
  const key = label + sub;
  if (ui.promptKey !== key) { ui.promptKey = key; $('b', ui.prompt).textContent = label; $('small', ui.prompt).textContent = sub; }
  if (actHeld && near.kind === 'fruit' && (actT += dt) > 0.12) { actT = 0; doAction(false); }
}

// ---------------------------------------------------------------- teleports
export function teleportTo(where) {
  closeSheet(true);
  ui.fade.classList.remove('go'); void ui.fade.offsetWidth; ui.fade.classList.add('go');
  sfx('open');
  // the market chip takes you to the veggie cart, or to the berry cart if you are already there
  if (where === 'market') { const p = Wd.marketSpot('veg'); where = 'cart:' + (Wd.distTo(p.x, p.z) < 10 ? 'berry' : 'veg'); }
  setTimeout(() => {
    if (where === 'garden') Wd.teleport(Wd.HOME, Math.PI);
    else if (where.startsWith('cart:')) Wd.teleport(Wd.marketSpot(where.slice(5)), Math.PI);
    else Wd.teleport(Wd.SHOPS[where].spot, Math.PI);
    if (where !== 'garden') setTimeout(() => openSheet(where), 260);
  }, 140);
}

// ---------------------------------------------------------------- plant info bubble
function showInfo(pl, owner = null) { ui.infoPl = pl; ui.infoOwner = owner; ui.infoT = 3.5; ui.info.hidden = false; updateInfo(); }
function updateInfo() {
  const pl = ui.infoPl, owner = ui.infoOwner;
  if (!pl || !(owner ? owner.plants : G.plants).includes(pl) || ui.infoT <= 0) { ui.info.hidden = true; ui.infoPl = null; return; }
  const c = CROP[pl.c], sp = speed(pl);
  let prog, label;
  if (!c.multi || pl.g < c.grow) { prog = Wd.growth(pl); label = prog >= 1 ? 'Ready!' : 'Ready in ' + fmtTime((c.grow - pl.g) / sp); }
  else {
    const ripe = ripeCount(pl), grow = pl.fr.filter((f) => f && f.p < 1);
    prog = pl.fr.reduce((s, f) => s + (f ? f.p : 0), 0) / c.n;
    label = ripe ? `${ripe} of ${c.n} ripe` : grow.length ? 'Fruit in ' + fmtTime(Math.min(...grow.map((f) => ((1 - f.p) * c.regrow) / sp))) : 'Flowering';
  }
  $('.t', ui.info).textContent = (owner ? owner.name + "'s " : '') + c.name;
  $('.t', ui.info).style.color = RARITIES[c.rarity].col;
  $('.pb i', ui.info).style.width = Math.round(Math.min(1, prog) * 100) + '%';
  $('.s', ui.info).textContent = label;
  const p = Wd.plantScreen(pl, 1);
  ui.info.style.left = Math.max(84, Math.min(innerWidth - 84, p.x)) + 'px';
  ui.info.style.top = Math.max(150, p.y - 14) + 'px';
}

// ---------------------------------------------------------------- sheets
let sheetKind = null, sheetTick = 0;
const CARTNAME = { veg: 'Veggie Cart', berry: 'Berry Cart' };
export function openSheet(kind) {
  sheetKind = kind;
  ui.shade.classList.add('on'); ui.sheet.classList.add('open');
  input.x = input.y = 0; placeStick(null); ptrs.clear();
  renderSheet();
  sfx('open');
}
function closeSheet(silent) { if (!sheetKind) return; sheetKind = null; ui.shade.classList.remove('on'); ui.sheet.classList.remove('open'); if (silent !== true) sfx('close'); }
function renderSheet() {
  const s = ui.sheet, list = $('.list', s), foot = $('footer', s);
  const keepScroll = list.scrollTop;
  list.innerHTML = ''; foot.hidden = true; foot.innerHTML = '';
  if (sheetKind && sheetKind.startsWith('cart:')) {
    const id = sheetKind.slice(5), wares = (G.mkt.wares && G.mkt.wares[id]) || [];
    $('h2', s).textContent = CARTNAME[id]; $('.sub', s).textContent = marketOpen() ? 'Closes in ' + fmtTime(G.mkt.left) : 'Closed';
    wares.forEach((w, i) => {
      const c = CROP[w.id], r = RARITIES[c.rarity], can = w.n > 0 && G.money >= w.price;
      const row = h('div', 'row blk', `<img src="${ICON[c.id]}" alt=""><div class="meta"><div class="name">${c.name}</div><div class="tag"><span style="color:${r.col};-webkit-text-stroke:0.6px #3a3a5a">${r.name}</span><span style="color:${w.n ? '#3a9a4a' : '#b08870'}">${w.n ? 'x' + w.n + ' left' : 'Sold out'}</span></div></div>`);
      const b = h('button', 'buy blk' + (can ? '' : ' no'), w.n ? `<s>$${fmt(w.was)}</s>$${fmt(w.price)}` : 'Sold out');
      b.dataset.id = `ware-${id}-${i}`;
      b.onclick = () => { if (buyWare(id, i)) { floatAt('+1', b.getBoundingClientRect()); if (!G.sel || G.sel === 'shovel') G.sel = 'seed:' + c.id; renderHotbar(); renderSheet(); } };
      row.appendChild(b); list.appendChild(row);
    });
    if (!wares.length) list.appendChild(h('div', 'empty-note', 'The cart is packed up for today.'));
    else list.appendChild(h('div', 'empty-note small', 'A quarter off the shop price, today only.'));
  } else if (sheetKind === 'seeds') {
    $('h2', s).textContent = 'Seeds'; $('.sub', s).textContent = 'Restock ' + fmtTime(restockIn());
    for (const c of CROPS) {
      const n = inStock(c.id), r = RARITIES[c.rarity], can = n > 0 && G.money >= c.price;
      const row = h('div', 'row blk', `<img src="${ICON[c.id]}" alt=""><div class="meta"><div class="name">${c.name}</div><div class="tag"><span style="color:${r.col};-webkit-text-stroke:0.6px #3a3a5a">${r.name}</span><span style="color:${n ? '#3a9a4a' : '#b08870'}">${n ? 'x' + n + ' in stock' : 'Sold out'}</span></div></div>`);
      const b = h('button', 'buy blk' + (can ? '' : ' no'), n ? '$' + fmt(c.price) : 'Sold out');
      b.dataset.id = 'buy-' + c.id;
      b.onclick = () => { if (buySeed(c.id)) { floatAt('+1', b.getBoundingClientRect()); if (!G.sel || G.sel === 'shovel') G.sel = 'seed:' + c.id; renderHotbar(); renderSheet(); } };
      holdRepeat(b);
      row.appendChild(b); list.appendChild(row);
    }
  } else if (sheetKind === 'sell') {
    $('h2', s).textContent = 'Sell'; $('.sub', s).textContent = `Basket ${G.bag.length}/${BASKET}`;
    const groups = new Map();
    for (const it of G.bag) { const k = itemKey(it); const g = groups.get(k) || { k, c: it.c, m: it.m, n: 0, v: 0 }; g.n++; g.v += sellValue(it); groups.set(k, g); }
    const gs = [...groups.values()].sort((a, b) => b.v - a.v);
    if (!gs.length) list.appendChild(h('div', 'empty-note', 'Your basket is empty.<br>Walk up to ripe crops and tap Collect.'));
    for (const g of gs) {
      const muts = MUT_ORDER.filter((m) => g.m.includes(m));
      const hot = marketOpen() && g.c === G.mkt.hot ? '<span class="x3">x3 today</span>' : '';
      const row = h('div', 'row blk', `<img src="${ICON[g.c]}" alt=""><div class="meta"><div class="name">${CROP[g.c].name}${g.n > 1 ? ' x' + g.n : ''}</div><div class="tag">${hot}${muts.length ? muts.map((m) => `<span style="color:${MUTS[m].col};-webkit-text-stroke:0.6px #3a3a5a">${MUTS[m].name}</span>`).join('') : '<span style="color:#8a86a0">Fresh</span>'}</div></div>`);
      const b = h('button', 'buy sell blk', '$' + fmt(g.v));
      b.onclick = () => { sell(g.k); renderSheet(); };
      row.appendChild(b); list.appendChild(row);
    }
    foot.hidden = false;
    const all = h('button', 'big blk', G.bag.length ? `<i class="coin"></i>Sell all $${fmt(bagValue())}` : 'Nothing to sell');
    all.id = 'sellAll';
    all.disabled = !G.bag.length;
    all.onclick = () => { sell(); renderSheet(); };
    foot.appendChild(all);
  } else if (sheetKind === 'settings') {
    $('h2', s).textContent = 'Settings'; $('.sub', s).textContent = '';
    const tog = (label, key, fn) => { const r = h('div', 'setrow', `<span>${label}</span>`); const b = h('button', 'buy blk' + (G[key] ? '' : ' no'), G[key] ? 'On' : 'Off'); b.onclick = () => { G[key] = !G[key]; fn(G[key]); sfx('tap'); renderSheet(); }; r.appendChild(b); list.appendChild(r); };
    tog('Sound', 'sound', setSound); tog('Music', 'music', setMusic);
    list.appendChild(h('div', 'stats', `<span>Move</span><b>Left thumb</b><span>Look around</span><b>Drag right side</b><span>Zoom</span><b>Pinch</b><span>Planted</span><b>${fmt(G.stats.planted)}</b><span>Harvested</span><b>${fmt(G.stats.harvested)}</b><span>Earned</span><b>$${fmt(G.stats.earned)}</b><span>Best fruit</span><b>$${fmt(G.stats.best)}</b>`));
    const r = h('button', 'big red blk', 'New garden');
    r.onclick = () => dialog('Erase this garden and start over?', 'Erase', () => { reset(); closeSheet(); renderHotbar(); Wd.teleport(Wd.HOME); }, 'var(--red)');
    list.appendChild(r);
  }
  list.scrollTop = keepScroll;
}
function holdRepeat(b) {
  let t = null;
  const stop = () => { clearTimeout(t); clearInterval(t); t = null; };
  b.addEventListener('pointerdown', () => { stop(); t = setTimeout(() => { t = setInterval(() => b.click(), 110); }, 450); });
  b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
}
function dialog(msg, yes, fn, col) {
  const d = h('div', '', `<div class="box blk"><div>${msg}</div><div class="btns"><button class="blk" style="--c:#9a96a8">Cancel</button><button class="blk" style="--c:${col}">${yes}</button></div></div>`);
  d.id = 'dialog'; $('#app').appendChild(d);
  const [no, ok] = d.querySelectorAll('button');
  no.onclick = () => d.remove(); ok.onclick = () => { d.remove(); fn(); };
  sfx('open');
}

// ---------------------------------------------------------------- toasts & effects
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function toast(str) {
  if ([...ui.toasts.children].some((c) => c.textContent === str)) return;
  const t = h('div', 'toast blk'); t.textContent = str;
  ui.toasts.appendChild(t);
  while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  setTimeout(() => t.remove(), 2900);
}
function floatText(str, x, y, col = '#fff', big = false) {
  const f = h('div', 'float' + (big ? ' big' : '')); f.textContent = str; f.style.color = col; f.style.left = x + 'px'; f.style.top = y + 'px';
  ui.fx.appendChild(f); setTimeout(() => f.remove(), 1300);
}
const floatAt = (str, r) => floatText(str, r.left + r.width / 2, r.top, '#a8ff8a');
function flyIcon(src, from, to, delay, done) {
  const i = h('img', 'fly'); i.src = src; ui.fx.appendChild(i);
  const mx = (from.x + to.x) / 2, my = Math.min(from.y, to.y) - 80;
  const a = i.animate([{ transform: `translate(${from.x}px,${from.y}px) scale(0.6)` }, { transform: `translate(${mx}px,${my}px) scale(1.3)`, offset: 0.45 }, { transform: `translate(${to.x}px,${to.y}px) scale(0.7)` }], { duration: 600, delay, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
  a.onfinish = () => { i.remove(); done && done(); };
}
const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const under = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - 12 }; }; // point from below at a top-bar button
const bump = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
const pulse = (el) => { if (!el) return; el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); };

// ---------------------------------------------------------------- tutorial: one objective chip, an arrow in the world, a pointing hand
// Buy two carrots with your first $20, grow and sell them, and that pays for your first Strawberry.
const STEPS = [
  { text: 'Buy seeds', icon: 'carrot', target: 2, count: () => Math.min(2, (G.seeds.carrot || 0) + G.stats.planted) },
  { text: 'Go home', icon: 'carrot' },
  { text: 'Plant', icon: 'carrot', target: 2, count: () => Math.min(2, G.stats.planted) },
  { text: 'Growing', icon: 'carrot', bar: true },
  { text: 'Collect', icon: 'carrot', target: 2, count: () => Math.min(2, G.stats.harvested) },
  { text: 'Sell', icon: 'carrot' },
  { text: 'Buy a Strawberry', icon: 'strawberry' },
  { text: 'Go home', icon: 'strawberry' },
];
let lastStep = -1;
function tutorial() {
  if (tutDone() || document.getElementById('title')) { if (!ui.goal.hidden) ui.goal.hidden = true; ui.hand.hidden = true; Wd.setGuide(null); return; }
  const home = !sheetKind && Wd.distTo(Wd.HOME.x, Wd.HOME.z) < 12;
  if (G.tut === 0 && STEPS[0].count() >= 2) G.tut = 1;
  if (G.tut === 1 && home) G.tut = 2;
  if (G.tut === 2 && (G.stats.planted >= 2 || (!G.seeds.carrot && G.plants.length))) G.tut = 3;
  if (G.tut === 3 && totalRipe() > 0) G.tut = 4;
  if (G.tut === 4 && (G.stats.harvested >= 2 || (G.bag.length && !G.plants.length))) G.tut = 5;
  if (G.tut === 5 && G.stats.earned > 0) G.tut = 6;
  if (G.tut === 6 && (G.seeds.strawberry > 0 || G.plants.some((p) => p.c === 'strawberry'))) G.tut = 7;
  if (G.tut === 7 && home) {
    G.tut = TUT_DONE; celebrate('Garden unlocked!'); ui.goal.classList.add('done');
    setTimeout(() => toast('Plant your Strawberry: it fruits again and again!'), 1200);
    return tutorial();
  }
  const st = STEPS[G.tut];
  if (G.tut !== lastStep) {
    if (lastStep >= 0) celebrate();
    lastStep = G.tut;
    ui.goal.hidden = false;
    ui.goal.classList.remove('pop', 'done'); void ui.goal.offsetWidth; ui.goal.classList.add('pop');
    $('img', ui.goal).src = ICON[st.icon];
    $('.txt', ui.goal).textContent = st.text;
  }
  const n = st.count ? st.count() : 0;
  $('.n', ui.goal).textContent = st.target ? `${n}/${st.target}` : '';
  let frac = st.target ? n / st.target : 0;
  if (st.bar) { const ps = G.plants.filter((p) => p.c === 'carrot'); frac = ps.length ? Math.max(...ps.map((p) => Wd.growth(p))) : 0; }
  $('.bar i', ui.goal).style.width = Math.round(frac * 100) + '%';
  let guide = null, hand = null, kind = 'tap';
  const shopFor = (id) => {
    if (sheetKind === 'seeds') { const b = ui.sheet.querySelector(`[data-id="buy-${id}"]`); if (b) hand = center(b); }
    else hand = under($('[data-tp="seeds"]'));
  };
  if (G.tut === 0) shopFor('carrot');
  else if (G.tut === 1 || G.tut === 7) hand = under($('[data-tp="garden"]'));
  else if (G.tut === 6) shopFor('strawberry');
  else if (G.tut === 2) {
    const spot = suggestSpot();
    if (spot) { guide = { x: spot.x, z: spot.z, h: 6, r: 0.6, s: 0.6 }; const s = Wd.project(spot.x, 2, spot.z); hand = { x: s.x, y: s.y }; }
    if (!selCrop()) { const sl = ui.hotbar.querySelector('[data-id="seed:carrot"]'); if (sl) hand = center(sl); }
  } else if (G.tut === 4) {
    const target = nearestToPlayer();
    if (target) {
      if (near && near.kind === 'fruit') hand = center(ui.act);
      else {
        guide = { x: target.x, z: target.z, h: 9, r: 0.6, s: 0.6, trail: true };
        const b = $('.base', ui.stick).getBoundingClientRect(), p = Wd.W.player;
        const a = Wd.project(p.x, p.y, p.z), o = Wd.project(target.x, p.y, target.z);
        const dx = o.x - a.x, dy = o.y - a.y, l = Math.hypot(dx, dy) || 1;
        ui.hand.style.setProperty('--dx', Math.round((dx / l) * 40) + 'px'); ui.hand.style.setProperty('--dy', Math.round((dy / l) * 40) + 'px');
        hand = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; kind = 'drag';
      }
    }
  } else if (G.tut === 5) {
    if (sheetKind === 'sell') { const b = $('#sellAll'); if (b && G.bag.length) hand = center(b); }
    else hand = under(ui.sellBtn);
  }
  Wd.setGuide(guide);
  if (hand) {
    ui.hand.hidden = false;
    ui.hand.className = kind;
    ui.hand.style.left = hand.x - 15 + 'px'; ui.hand.style.top = hand.y - 2 + 'px';
  } else ui.hand.hidden = true;
}
function nearestToPlayer() {
  const p = Wd.W.player;
  let best = null, bd = 1e9;
  for (const pl of G.plants) if (ripeCount(pl)) { const d = Math.hypot(pl.x - p.x, pl.z - p.z); if (d < bd) { bd = d; best = pl; } }
  return best;
}
let spotCache = null;
function suggestSpot() {
  if (spotCache && !placeBlock('carrot', spotCache.x, spotCache.z)) return spotCache;
  // a row just in front of the farmer, a little to the right so the hand never covers them
  for (const [x, dz] of [[6, 9], [11, 11], [6, 14], [11, 16], [16, 13], [1, 13], [16, 18], [1, 18], [6, 19], [11, 21]]) {
    const z = BED.z1 - dz;
    if (!placeBlock('carrot', x, z)) return (spotCache = { x, z });
  }
  return null;
}
function celebrate(big) {
  const p = Wd.W.player;
  Wd.burst(p.x, p.y + 6, p.z, ['#ffd84e', '#5cc060', '#ff6a8a', '#6ab0ff', '#ffffff'], 30, { speed: 12, up: 16, life: 1.2, size: 0.6 });
  sfx(big ? 'hatch' : 'buy');
  ui.goal.classList.add('done');
  if (big) { const s = Wd.project(p.x, p.y + 12, p.z); floatText(big, s.x, s.y, '#ffd84e', true); }
}

// ---------------------------------------------------------------- per frame
let lastNight = null, lastPeriod = null;
export function update(dt) {
  // keyboard movement on desktop
  if (![...ptrs.values()].some((q) => q.role === 'stick')) {
    const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const l = Math.hypot(kx, ky) || 1;
    input.x = kx / l; input.y = ky / l;
  }
  if (sheetKind || document.getElementById('title')) input.x = input.y = 0;
  const d = G.money - ui.shown;
  ui.shown = Math.abs(d) < 1 ? G.money : d < 0 ? G.money : ui.shown + d * (1 - Math.exp(-dt * 8));
  ui.money.textContent = fmt(ui.shown);
  const wt = G.weather.type;
  const wk = wt !== 'clear' ? wt + Math.ceil(G.weather.left) : isNight() ? (bloodMoon() ? 'blood' : 'night') : 'clear';
  if (ui.wk !== wk) {
    ui.wk = wk;
    ui.weather.innerHTML = wt !== 'clear' ? WICON[wt] + `<span>${fmtTime(G.weather.left)}</span>` : isNight() ? WICON[bloodMoon() ? 'blood' : 'night'] + `<span>${bloodMoon() ? 'Blood Moon' : 'Night'}</span>` : WICON.clear + '<span>Sunny</span>';
  }
  ui.bagN.hidden = !G.bag.length; ui.bagN.textContent = G.bag.length >= BASKET ? 'FULL' : G.bag.length;
  ui.bagN.classList.toggle('full', G.bag.length >= BASKET);
  if (ui.infoPl) { ui.infoT -= dt; updateInfo(); }
  if (sheetKind === 'seeds' && (sheetTick += dt) > 1) { sheetTick = 0; $('.sub', ui.sheet).textContent = 'Restock ' + fmtTime(restockIn()); }
  if (sheetKind && sheetKind.startsWith('cart:') && (sheetTick += dt) > 1) { sheetTick = 0; $('.sub', ui.sheet).textContent = marketOpen() ? 'Closes in ' + fmtTime(G.mkt.left) : 'Closed'; }
  renderHotbar();
  updateProximity(dt);
  tutorial();
  marketChip();
  setFestival(marketOpen() && Wd.distTo(0, -66) < 75);
  const night = isNight();
  if (lastNight !== null && night !== lastNight && tutDone()) toast(night ? (bloodMoon() ? 'A Blood Moon rises! Ripe fruit may turn Bloodlit (x4).' : 'Night falls. Moonlight can make fruit Moonlit (x2).') : 'Good morning!');
  lastNight = night;
  const per = period();
  if (lastPeriod !== null && per !== lastPeriod) { toast('Fresh seeds at the Seed shop!'); pulse($('[data-tp="seeds"]')); if (sheetKind === 'seeds') renderSheet(); }
  lastPeriod = per;
  if (G.money < 10 && !Object.keys(G.seeds).length && !G.plants.length && !G.bag.length) { G.seeds.carrot = 3; G.sel = 'seed:carrot'; toast('The seed seller gave you 3 free Carrot seeds!'); }
}

// the Market Day chip under the teleport buttons: countdown, the crop of the day, tap to go
function marketChip() {
  const open = marketOpen(), show = tutDone() && (open || G.mkt.next < 60);
  if (ui.event.hidden === show) ui.event.hidden = !show;
  if (!show) return;
  const key = (open ? 'o' : 's') + G.mkt.hot;
  if (ui.eventKey !== key) {
    ui.eventKey = key;
    $('.t', ui.event).textContent = open ? 'Market Day' : 'Market in';
    const img = $('.hot', ui.event), x3 = $('.x3', ui.event);
    img.hidden = x3.hidden = !open || !G.mkt.hot;
    if (open && G.mkt.hot) img.src = ICON[G.mkt.hot];
    ui.event.classList.toggle('open', open);
  }
  $('.time', ui.event).textContent = fmtTime(open ? G.mkt.left : G.mkt.next);
}

// ---------------------------------------------------------------- reactions to game events
let bagFullT = 0, combo = 0, comboT = 0;
on('plant', (pl) => { setTimeout(() => { Wd.burst(pl.x, 2.2, pl.z, ['#a8744a', '#8e5c3a', '#c08a5a'], 7, { speed: 5, up: 7, life: 0.5, size: 0.35 }); sfx('plant', pl.id); }, 220); renderHotbar(); });
on('collect', ({ pl, item, at }) => {
  Wd.pop(pl, 'harvest');
  const w = at || { x: pl.x, y: 4, z: pl.z };
  Wd.burst(w.x, w.y, w.z, ['#8ff06a', '#ffffff'], 5, { speed: 5, up: 7, life: 0.4, size: 0.3 });
  const from = Wd.project(w.x, w.y, w.z);
  flyIcon(ICON[item.c], from, center(ui.sellBtn), 0, () => bump(ui.sellBtn));
  const now = performance.now();
  combo = now - comboT < 900 ? combo + 1 : 0; comboT = now;
  sfx('harvest', combo);
  const special = item.m.find((m) => m !== 'wet' && m !== 'chilled');
  if (special || item.big) floatText(`${item.big ? 'Giant ' : ''}${special ? MUTS[special].name + ' ' : ''}${CROP[item.c].name} $${fmt(item.v)}`, from.x, from.y - 24, special ? MUTS[special].col : '#c8f0ff');
  else floatText('+1 ' + CROP[item.c].name, from.x, from.y - 18, '#ffffff');
});
on('sell', ({ total }) => {
  const sa = $('#sellAll'), s = center(sa && ui.sheet.classList.contains('open') ? sa : ui.sellBtn), to = center($('#moneyPill'));
  const n = Math.min(12, 3 + Math.floor(Math.log10(total + 1) * 2));
  for (let k = 0; k < n; k++) flyCoin({ x: s.x + (Math.random() - 0.5) * 80, y: s.y }, to, k * 45);
  floatText('+$' + fmt(total), s.x, s.y - 30, '#ffd84e', true);
  sfx('sell');
  save();
});
function flyCoin(from, to, delay) {
  const c = h('i', 'coin fly'); c.style.width = c.style.height = '18px'; c.style.margin = '-9px 0 0 -9px'; c.style.position = 'absolute'; ui.fx.appendChild(c);
  const a = c.animate([{ transform: `translate(${from.x}px,${from.y}px)` }, { transform: `translate(${(from.x + to.x) / 2}px,${Math.min(from.y, to.y) - 60}px)`, offset: 0.5 }, { transform: `translate(${to.x}px,${to.y}px)` }], { duration: 600, delay, easing: 'ease-in', fill: 'both' });
  a.onfinish = () => { c.remove(); bump(ui.money); sfx('coin'); };
}
on('dig', (pl) => { Wd.burst(pl.x, 3, pl.z, ['#a8744a', '#8e5c3a', '#5cc060'], 14, { speed: 8, up: 10 }); sfx('dig'); });
on('ripe', (pl) => { Wd.burst(pl.x, 5, pl.z, ['#ffffff', '#fff6c0'], 6, { speed: 3, up: 6, g: 4, life: 0.8, size: 0.3 }); });
on('mut', ({ pl, m }) => {
  if (m === 'wet' || m === 'chilled') return;
  const p = Wd.plantScreen(pl, 0.8);
  if (!p.behind) floatText(MUTS[m].name + '!', p.x, p.y, MUTS[m].col);
  Wd.burst(pl.x, 6, pl.z, [MUTS[m].col, '#ffffff'], 12, { speed: 6, up: 8 });
  sfx('mut');
});
on('lightning', ({ x, z }) => { Wd.lightning(x, z); sfx('thunder'); });
on('moonbeam', (pl) => { for (let k = 0; k < 14; k++) Wd.sparkle(pl.x, 4 + k * 2.5, pl.z, bloodMoon() ? '#ff7080' : '#d6c8ff'); });
on('broke', () => { toast('Not enough money!'); sfx('error'); });
on('nostock', () => { toast('Sold out! New seeds in ' + fmtTime(restockIn())); sfx('error'); });
on('bagfull', () => { const t = performance.now(); if (t - bagFullT < 2000) return; bagFullT = t; toast('Basket full! Tap Sell at the top.'); pulse(ui.sellBtn); sfx('error'); });
on('buy', () => sfx('buy'));
on('marketSoon', () => toast('Market Day starts in 30 seconds!'));
on('market', (open) => {
  if (open) {
    sfx('fanfare');
    toast(`Market Day! ${plural(G.mkt.hot)} sell for triple, and the carts have rare seeds.`);
    if (Wd.distTo(0, -62) < 90) Wd.confetti();
    pulse(ui.event);
  } else {
    toast("Market's over. See you next time!");
    if (sheetKind && sheetKind.startsWith('cart:')) closeSheet();
  }
});
on('weather', (w) => { if (tutDone()) toast(w === 'clear' ? 'The skies are clearing up.' : WEATHER[w].msg); });
on('welcome', ({ sec, ripe }) => { if (sec > 30) setTimeout(() => toast(`Welcome back! Your garden grew for ${fmtTime(sec)}.` + (ripe ? ` ${ripe} fruit ripened.` : '')), 600); });
on('reset', () => { hotKey = ''; lastStep = -1; ui.shown = G.money; });
// the other gardens: fruit you take from them, and gardens moving out and in
on('steal', ({ item, at, pl }) => {
  const w = at || { x: pl.x, y: 4, z: pl.z }, from = Wd.project(w.x, w.y, w.z);
  flyIcon(ICON[item.c], from, center(ui.sellBtn), 0, () => bump(ui.sellBtn));
  floatText(`Stolen! ${fruitName(item.c, item.m)} $${fmt(item.v)}`, from.x, from.y - 24, '#ffd84e');
  sfx('mut');
  save();
});
on('stealwait', () => { toast(`Lie low for a bit. You can steal again in ${fmtTime(stealWait())}.`); sfx('error'); });
on('moveout', (nb) => toast(`${nb.name}'s garden moved out. A new garden is on its way.`));
on('movein', (nb) => { if (Wd.distTo(nb.R.cx, nb.R.cz) < 90) toast(`New neighbor: ${nb.name}'s garden.`); });
