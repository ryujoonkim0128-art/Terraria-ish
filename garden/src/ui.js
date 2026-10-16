// DOM UI (HUD, hotbar, shop sheets, toasts), touch input on the 3D view, and the in-world tutorial.
import { CROPS, CROP, RARITIES, MUTS, MUT_ORDER, WEATHER, BASKET, inBed } from './data.js';
import { G, on, emit, plant, harvest, harvestAll, sell, buySeed, dig, inStock, restockIn, period, ripeCount, totalRipe, bagValue, itemKey, placeBlock, reset, save } from './state.js';
import { speed, isNight, bloodMoon } from './sim.js';
import * as Wd from './world.js';
import { ICON } from './icons.js';
import { sfx, initAudio, setSound, setMusic } from './audio.js';

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

const SVG = {
  gear: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#fff" d="M4 0h2v2h1V1h1v1h1v1H8v1h2v2H8v1h1v1H8v1H7V8H6v2H4V8H3v1H2V8H1V7h1V6H0V4h2V3H1V2h1V1h1v1h1z"/><path fill="#3a3a5a" d="M4 4h2v2H4z"/></svg>',
  basket: '<svg viewBox="0 0 12 10" shape-rendering="crispEdges"><path fill="#f04a5a" d="M2 1h3v3H2z"/><path fill="#ffd84e" d="M5 0h3v3H5z"/><path fill="#5cc060" d="M8 1h2v3H8z"/><path fill="#1a1a2e" d="M0 4h12v1H0z"/><path fill="#c8904a" d="M1 5h10v4H1z"/><path fill="#a8703a" d="M2 6h1v1H2zm2 0h1v1H4zm2 0h1v1H6zm2 0h1v1H8zM3 7h1v1H3zm2 0h1v1H5zm2 0h1v1H7zm2 0h1v1H9z"/><path fill="#1a1a2e" d="M1 9h10v1H1z"/></svg>',
  shovel: '<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><path fill="#a8744b" d="M8 0h2v1H9v1H8v1H7v1H6v1H5V4h1V3h1V2h1z"/><path fill="#c8c6d8" d="M3 4h2v1h1v2H5v1H4v1H2V8H1V6h1V5h1z"/><path fill="#8a88a0" d="M2 8h2v1H2zM5 6h1v1H5z"/></svg>',
  hand: '<svg viewBox="0 0 11 13" shape-rendering="crispEdges"><path fill="#1a1a2e" d="M3 0h2v1h1v4h4v1h1v5h-1v1H9v1H3v-1H2v-1H1V9H0V7h1V6h2z"/><path fill="#fff6e6" d="M4 1h1v5h1V5h1v1h1V6h1v1h1v4H9v1H4v-1H3v-1H2V9H1V8h1V7h1V6h1z"/><path fill="#ffd8b8" d="M4 10h5v1H4z"/></svg>',
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
const P = { down: false, pts: new Map(), mode: null, last: null, stall: null, moved: false, pinch: null };

// ---------------------------------------------------------------- build
export function build(app) {
  app.insertAdjacentHTML('beforeend', `
    <div id="hud">
      <div class="pill blk" id="moneyPill"><i class="coin"></i><span id="money">0</span></div>
      <div class="spacer"></div>
      <button class="pill blk" id="weather"></button>
      <button class="blk" id="settings" aria-label="Settings">${SVG.gear}</button>
    </div>
    <div id="goal" class="blk" hidden><img alt=""><span class="txt"></span><span class="n"></span><div class="bar"><i></i></div></div>
    <button class="blk" id="basket" aria-label="Basket">${SVG.basket}<span id="bagN">0</span></button>
    <div id="side"><button class="blk" id="harvest" aria-label="Harvest all">${SVG.basket}<span class="badge" id="ripeN" hidden>0</span></button></div>
    <div id="tray" class="blk"><div id="hotbar"></div></div>
    <div id="info" class="blk" hidden><div class="t"></div><div class="pb"><i></i></div><div class="s"></div></div>
    <div id="toasts"></div>
    <div id="fx"></div>
    <div id="hand" hidden>${SVG.hand}</div>
    <div id="shade"></div>
    <section class="sheet blk" id="sheet"><header><h2></h2><span class="sub"></span><button class="x blk" aria-label="Close">X</button></header><div class="list"></div><footer hidden></footer></section>
  `);
  ui = { money: $('#money'), weather: $('#weather'), hotbar: $('#hotbar'), harvest: $('#harvest'), ripeN: $('#ripeN'), basket: $('#basket'), bagN: $('#bagN'), info: $('#info'), toasts: $('#toasts'), fx: $('#fx'), hand: $('#hand'), goal: $('#goal'), shade: $('#shade'), sheet: $('#sheet') };
  ui.shown = G.money;
  $('#settings').onclick = () => openSheet('settings');
  ui.weather.onclick = () => toast(G.weather.type !== 'clear' ? WEATHER[G.weather.type].msg : isNight() ? 'Moonlight can make ripe fruit Moonlit (x2).' : 'The weather changes every few minutes.');
  ui.harvest.onclick = () => {
    if (!totalRipe()) { toast('Nothing is ripe yet. Ripe fruit sparkles!'); sfx('error'); return; }
    harvestAll();
  };
  ui.basket.onclick = () => openSheet('sell');
  ui.shade.onclick = closeSheet;
  $('.x', ui.sheet).onclick = closeSheet;
  ui.hotbar.addEventListener('click', (e) => {
    const s = e.target.closest('.slot');
    if (!s) return;
    G.sel = G.sel === s.dataset.id ? null : s.dataset.id;
    sfx('tap'); renderHotbar();
  });
  renderHotbar();
  const gl = $('#gl');
  gl.addEventListener('pointerdown', down);
  gl.addEventListener('pointermove', move);
  gl.addEventListener('pointerup', up);
  gl.addEventListener('pointercancel', up);
  gl.addEventListener('wheel', (e) => { e.preventDefault(); Wd.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
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
  for (const it of items) {
    const b = h('button', 'slot blk' + (G.sel === it.id ? ' sel' : ''));
    b.dataset.id = it.id;
    b.innerHTML = (it.rc ? `<i class="band" style="--rc:${it.rc}"></i>` : '') + (it.img ? `<img src="${it.img}" alt="">` : it.svg) + (it.n ? `<span class="n">${it.n}</span>` : '');
    ui.hotbar.appendChild(b);
  }
}
const selCrop = () => (G.sel && G.sel.startsWith('seed:') ? G.sel.slice(5) : null);
function nextSeed(after) {
  if (G.seeds[after] > 0) return;
  const n = CROPS.find((c) => G.seeds[c.id] > 0);
  G.sel = n ? 'seed:' + n.id : null;
  if (!n && G.tut >= 6) toast('Out of seeds! Get more at the SEEDS stall.');
}

// ---------------------------------------------------------------- touch input on the world
function down(e) {
  e.preventDefault();
  try { e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  P.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P.pts.size === 2) {
    const [a, b] = [...P.pts.values()];
    P.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    P.mode = null; Wd.setGhost(null);
    return;
  }
  if (P.pts.size > 2) return;
  const x = e.clientX, y = e.clientY;
  P.down = true; P.moved = false; P.sx = x; P.sy = y; P.mode = null; P.stall = null; P.last = null;
  ui.info.hidden = true; ui.infoPl = null;
  const pl = Wd.pickPlant(x, y);
  if (pl && ripeCount(pl)) { P.mode = 'harvest'; harvest(pl); return; }
  const crop = selCrop();
  const gp = Wd.screenToGround(x, y);
  if (G.sel === 'shovel' && pl) {
    if (CROP[pl.c].price >= 1000) dialog(`Dig up this ${CROP[pl.c].name}? It will be gone for good.`, 'Dig up', () => dig(pl), 'var(--red)');
    else { dig(pl); P.mode = 'dig'; }
    return;
  }
  if (crop && gp && inBed(gp.x, gp.z, 0) && !pl) { P.mode = 'plant'; tryPlant(crop, gp); return; }
  if (pl) { showInfo(pl); sfx('tap'); return; }
  const st = Wd.pickStall(x, y);
  if (st) { P.stall = st; return; }
  if (gp) {
    Wd.walkTo(gp.x, gp.z);
    if (inBed(gp.x, gp.z) && !crop) { if (G.sel === 'shovel') return; toast(Object.keys(G.seeds).length ? 'Pick a seed below, then tap the soil.' : 'No seeds! Get some at the SEEDS stall.'); pulseHotbar(); }
  }
}
function tryPlant(crop, gp) {
  const x = Math.round(gp.x), z = Math.round(gp.z);
  const why = placeBlock(crop, x, z);
  Wd.setGhost(x, z, !why);
  if (why) { if (!P.last && why === 'crowded') { toast('Too close to another plant.'); sfx('error'); } return; }
  const pl = plant(crop, x, z);
  if (pl) { P.last = pl; Wd.walkTo(x + 2, z - 3); if (G.tut < 1) pl.boost = true; nextSeed(crop); renderHotbar(); }
}
function move(e) {
  if (!P.pts.has(e.pointerId)) return;
  const prev = P.pts.get(e.pointerId);
  P.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (P.pinch && P.pts.size === 2) {
    const [a, b] = [...P.pts.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    Wd.zoomBy(d / P.pinch.d, mx, my);
    Wd.panPixels(mx - P.pinch.mx, my - P.pinch.my);
    P.pinch = { d, mx, my };
    return;
  }
  if (!P.down) return;
  const x = e.clientX, y = e.clientY;
  if (Math.hypot(x - P.sx, y - P.sy) > 8) P.moved = true;
  if (P.mode === 'plant') {
    const crop = selCrop();
    const gp = Wd.screenToGround(x, y);
    if (crop && gp && inBed(gp.x, gp.z)) tryPlant(crop, gp); else Wd.setGhost(null);
  } else if (P.mode === 'harvest' || P.mode === 'dig') {
    const steps = Math.max(1, Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 10));
    for (let s = 1; s <= steps; s++) {
      const pl = Wd.pickPlant(prev.x + ((x - prev.x) * s) / steps, prev.y + ((y - prev.y) * s) / steps);
      if (!pl) continue;
      if (P.mode === 'harvest' && ripeCount(pl)) harvest(pl);
      if (P.mode === 'dig' && CROP[pl.c].price < 1000) dig(pl);
    }
  } else if (!P.mode && P.moved && G.tut >= 6) {
    Wd.panPixels(x - prev.x, y - prev.y);
  }
}
function up(e) {
  P.pts.delete(e.pointerId);
  if (P.pts.size < 2) P.pinch = null;
  if (!P.down || P.pts.size) return;
  P.down = false;
  Wd.setGhost(null);
  if (P.stall && !P.moved && Wd.pickStall(e.clientX, e.clientY) === P.stall) openSheet(P.stall);
  P.mode = null;
}
function pulseHotbar() { ui.hotbar.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 }); }

// ---------------------------------------------------------------- plant info bubble
function showInfo(pl) { ui.infoPl = pl; ui.infoT = 3.5; ui.info.hidden = false; updateInfo(); }
function updateInfo() {
  const pl = ui.infoPl;
  if (!pl || !G.plants.includes(pl) || ui.infoT <= 0) { ui.info.hidden = true; ui.infoPl = null; return; }
  const c = CROP[pl.c], sp = speed(pl);
  let prog, label;
  if (!c.multi || pl.g < c.grow) { prog = Wd.growth(pl); label = prog >= 1 ? 'Ready!' : 'Ready in ' + fmtTime((c.grow - pl.g) / sp); }
  else {
    const ripe = ripeCount(pl), grow = pl.fr.filter((f) => f && f.p < 1);
    prog = pl.fr.reduce((s, f) => s + (f ? f.p : 0), 0) / c.n;
    label = ripe ? `${ripe} of ${c.n} ripe` : grow.length ? 'Fruit in ' + fmtTime(Math.min(...grow.map((f) => ((1 - f.p) * c.regrow) / sp))) : 'Flowering';
  }
  $('.t', ui.info).textContent = c.name;
  $('.t', ui.info).style.color = RARITIES[c.rarity].col;
  $('.pb i', ui.info).style.width = Math.round(Math.min(1, prog) * 100) + '%';
  $('.s', ui.info).textContent = label;
  const p = Wd.plantScreen(pl, 1);
  ui.info.style.left = Math.max(84, Math.min(innerWidth - 84, p.x)) + 'px';
  ui.info.style.top = Math.max(100, p.y - 14) + 'px';
}

// ---------------------------------------------------------------- sheets
let sheetKind = null, sheetTimer = 0;
export function openSheet(kind) {
  sheetKind = kind;
  ui.shade.classList.add('on'); ui.sheet.classList.add('open');
  renderSheet();
  sfx('open');
  if (kind === 'seeds' || kind === 'sell') Wd.walkTo(kind === 'seeds' ? -15 : 15, -34);
}
function closeSheet() { if (!sheetKind) return; sheetKind = null; ui.shade.classList.remove('on'); ui.sheet.classList.remove('open'); sfx('close'); }
function renderSheet() {
  const s = ui.sheet, list = $('.list', s), foot = $('footer', s);
  const keepScroll = list.scrollTop;
  list.innerHTML = ''; foot.hidden = true; foot.innerHTML = '';
  if (sheetKind === 'seeds') {
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
    for (const it of G.bag) { const k = itemKey(it); const g = groups.get(k) || { k, c: it.c, m: it.m, n: 0, v: 0 }; g.n++; g.v += it.v; groups.set(k, g); }
    const gs = [...groups.values()].sort((a, b) => b.v - a.v);
    if (!gs.length) list.appendChild(h('div', 'empty-note', 'Your basket is empty.<br>Tap ripe crops to pick them.'));
    for (const g of gs) {
      const muts = MUT_ORDER.filter((m) => g.m.includes(m));
      const row = h('div', 'row blk', `<img src="${ICON[g.c]}" alt=""><div class="meta"><div class="name">${CROP[g.c].name}${g.n > 1 ? ' x' + g.n : ''}</div><div class="tag">${muts.length ? muts.map((m) => `<span style="color:${MUTS[m].col};-webkit-text-stroke:0.6px #3a3a5a">${MUTS[m].name}</span>`).join('') : '<span style="color:#8a86a0">Fresh</span>'}</div></div>`);
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
    list.appendChild(h('div', 'stats', `<span>Planted</span><b>${fmt(G.stats.planted)}</b><span>Harvested</span><b>${fmt(G.stats.harvested)}</b><span>Earned</span><b>$${fmt(G.stats.earned)}</b><span>Best fruit</span><b>$${fmt(G.stats.best)}</b>`));
    const r = h('button', 'big red blk', 'New garden');
    r.onclick = () => dialog('Erase this garden and start over?', 'Erase', () => { reset(); closeSheet(); renderHotbar(); }, 'var(--red)');
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
  d.id = 'dialog'; document.body.querySelector('#app').appendChild(d);
  const [no, ok] = d.querySelectorAll('button');
  no.onclick = () => d.remove(); ok.onclick = () => { d.remove(); fn(); };
  sfx('open');
}

// ---------------------------------------------------------------- toasts & effects
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
  const a = i.animate([{ transform: `translate(${from.x}px,${from.y}px) scale(0.6)` }, { transform: `translate(${mx}px,${my}px) scale(1.25)`, offset: 0.45 }, { transform: `translate(${to.x}px,${to.y}px) scale(0.7)` }], { duration: 650, delay, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
  a.onfinish = () => { i.remove(); done && done(); };
}
const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const bump = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };

// ---------------------------------------------------------------- tutorial
// Tiny objective chip + world arrow, glowing trail and a pointing hand. No dialogue.
const STEPS = [
  { text: 'Plant', icon: 'carrot', target: 5, count: () => Math.min(5, G.stats.planted) },
  { text: 'Growing', icon: 'carrot', bar: true },
  { text: 'Harvest', icon: 'carrot', target: 5, count: () => Math.min(5, G.stats.harvested) },
  { text: 'Sell', icon: 'carrot' },
  { text: 'Buy seeds', icon: 'strawberry' },
];
let lastStep = -1, rewardT = 0;
function tutorial(dt) {
  if (G.tut >= 6 || document.getElementById('title')) { if (!ui.goal.hidden) ui.goal.hidden = true; ui.hand.hidden = true; Wd.setGuide(null); return; }
  // advance
  if (G.tut === 0 && (G.stats.planted >= 5 || (!Object.keys(G.seeds).length && G.plants.length))) G.tut = 1;
  if (G.tut === 1 && totalRipe() > 0) G.tut = 2;
  if (G.tut === 2 && (G.stats.harvested >= 5 || (G.bag.length && !G.plants.length))) G.tut = 3;
  if (G.tut === 3 && G.stats.earned > 0) G.tut = 4;
  if (G.tut === 4 && CROPS.some((c) => G.bought.c[c.id])) { G.tut = 5; rewardT = 2.4; G.seeds.strawberry = (G.seeds.strawberry || 0) + 2; renderHotbar(); celebrate('Garden unlocked!'); closeSheet(); }
  if (G.tut === 5) { if ((rewardT -= dt) <= 0) { G.tut = 6; toast('You got 2 Strawberry seeds. Have fun!'); } return; }
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
  // world + UI pointers
  let guide = null, hand = null;
  if (G.tut === 0) {
    const spot = suggestSpot();
    if (spot) guide = { x: spot.x, z: spot.z, h: 6, r: 0.6, s: 0.6 };
    if (!selCrop()) { const s = ui.hotbar.querySelector('[data-id="seed:carrot"]'); if (s) hand = center(s); }
    else if (spot) { const p = Wd.project(spot.x, 2, spot.z); hand = { x: p.x + 4, y: p.y + 6 }; }
  } else if (G.tut === 2) {
    const pl = G.plants.find((p) => ripeCount(p));
    if (pl) { guide = { x: pl.x, z: pl.z, h: 9, r: 0.6, s: 0.6 }; const p = Wd.plantScreen(pl, 0.4); hand = { x: p.x + 4, y: p.y + 10 }; }
  } else if (G.tut === 3) {
    if (sheetKind === 'sell') { const b = $('#sellAll'); if (b && G.bag.length) hand = center(b); }
    else { guide = { x: 15, z: -37, y: 1, h: 20, r: 2.2, trail: true }; hand = Wd.stallScreen('sell'); }
  } else if (G.tut === 4) {
    if (sheetKind === 'seeds') { const b = ui.sheet.querySelector('[data-id="buy-carrot"]'); if (b) hand = center(b); }
    else { guide = { x: -15, z: -37, y: 1, h: 20, r: 2.2, trail: true }; hand = Wd.stallScreen('seeds'); }
  }
  Wd.setGuide(guide);
  if (hand) {
    ui.hand.hidden = false;
    const bob = Math.abs(Math.sin(Wd.W.t * 5)) * 8;
    ui.hand.style.left = hand.x - 8 + 'px'; ui.hand.style.top = hand.y + 4 + bob + 'px';
  } else ui.hand.hidden = true;
}
let spotCache = null;
function suggestSpot() {
  if (spotCache && !placeBlock('carrot', spotCache.x, spotCache.z)) return spotCache;
  for (const [x, z] of [[0, 8], [-4, 8], [4, 8], [-8, 8], [8, 8], [0, 12], [-4, 12], [4, 12], [0, 4], [-8, 12]]) if (!placeBlock('carrot', x, z)) return (spotCache = { x, z });
  return null;
}
function celebrate(big) {
  const f = Wd.W.farmer;
  Wd.burst(f.x, 6, f.z, ['#ffd84e', '#5cc060', '#ff6a8a', '#6ab0ff', '#ffffff'], 30, { speed: 12, up: 16, life: 1.2, size: 0.6 });
  sfx(big ? 'hatch' : 'buy');
  ui.goal.classList.add('done');
  if (big) { const p = Wd.project(f.x, 10, f.z); floatText(big, p.x, p.y, '#ffd84e', true); }
}

// ---------------------------------------------------------------- per frame
let lastNight = null, lastPeriod = null, sheetTick = 0;
export function update(dt) {
  // money counter
  const d = G.money - ui.shown;
  ui.shown = Math.abs(d) < 1 ? G.money : d < 0 ? G.money : ui.shown + d * (1 - Math.exp(-dt * 8));
  ui.money.textContent = fmt(ui.shown);
  // weather chip
  const wt = G.weather.type;
  const wk = wt !== 'clear' ? wt + Math.ceil(G.weather.left) : isNight() ? (bloodMoon() ? 'blood' : 'night') : 'clear';
  if (ui.wk !== wk) {
    ui.wk = wk;
    ui.weather.innerHTML = wt !== 'clear' ? WICON[wt] + `<span>${fmtTime(G.weather.left)}</span>` : isNight() ? WICON[bloodMoon() ? 'blood' : 'night'] + `<span>${bloodMoon() ? 'Blood Moon' : 'Night'}</span>` : WICON.clear + '<span>Sunny</span>';
  }
  const n = totalRipe();
  ui.ripeN.hidden = !n; ui.ripeN.textContent = n > 99 ? '99+' : n;
  ui.harvest.classList.toggle('off', !n);
  ui.bagN.textContent = `${G.bag.length}/${BASKET}`;
  ui.basket.classList.toggle('full', G.bag.length >= BASKET);
  if (ui.infoPl) { ui.infoT -= dt; updateInfo(); }
  if (sheetKind && (sheetTick += dt) > 1) { sheetTick = 0; if (sheetKind === 'seeds') $('.sub', ui.sheet).textContent = 'Restock ' + fmtTime(restockIn()); }
  renderHotbar();
  tutorial(dt);
  const night = isNight();
  if (lastNight !== null && night !== lastNight && G.tut >= 6) toast(night ? (bloodMoon() ? 'A Blood Moon rises! Ripe fruit may turn Bloodlit (x4).' : 'Night falls. Moonlight can make fruit Moonlit (x2).') : 'Good morning!');
  lastNight = night;
  const p = period();
  if (lastPeriod !== null && p !== lastPeriod) { toast('Fresh seeds at the SEEDS stall!'); if (sheetKind === 'seeds') renderSheet(); }
  lastPeriod = p;
  // softlock rescue
  if (G.money < 10 && !Object.keys(G.seeds).length && !G.plants.length && !G.bag.length) { G.seeds.carrot = 3; G.sel = 'seed:carrot'; toast('The seed seller gave you 3 free Carrot seeds!'); }
}

// ---------------------------------------------------------------- reactions to game events
let bagFullT = 0;
on('plant', (pl) => { Wd.pop(pl, 'plant'); Wd.burst(pl.x, 2.2, pl.z, ['#a8744a', '#8e5c3a', '#c08a5a'], 7, { speed: 5, up: 7, life: 0.5, size: 0.35 }); sfx('plant', pl.id); renderHotbar(); });
on('harvest', ({ pl, got }) => {
  Wd.pop(pl, 'harvest'); Wd.walkTo(pl.x + 2, pl.z - 3);
  Wd.burst(pl.x, 4, pl.z, ['#8ff06a', '#5cc060', '#ffffff'], 8, { speed: 6, up: 9, life: 0.5, size: 0.35 });
  const to = center(ui.basket);
  got.forEach(({ item, slot }, k) => {
    const fw = (pl._fw && pl._fw[slot]) || { x: pl.x, y: 4, z: pl.z };
    const from = Wd.project(fw.x, fw.y, fw.z);
    flyIcon(ICON[item.c], from, to, k * 60, () => { bump(ui.basket); sfx('pop'); });
    const special = item.m.find((m) => m !== 'wet' && m !== 'chilled');
    if ((special || item.big) && k < 2) floatText(`${item.big ? 'Giant ' : ''}${special ? MUTS[special].name + ' ' : ''}${CROP[item.c].name} $${fmt(item.v)}`, from.x, from.y - 20, special ? MUTS[special].col : '#c8f0ff');
  });
  sfx('harvest', pl.id);
});
on('sell', ({ total }) => {
  const s = Wd.stallScreen('sell'), to = center($('#moneyPill'));
  const n = Math.min(12, 3 + Math.floor(Math.log10(total + 1) * 2));
  for (let k = 0; k < n; k++) flyCoin({ x: s.x + (Math.random() - 0.5) * 60, y: s.y + 30 }, to, k * 45);
  floatText('+$' + fmt(total), s.x, s.y, '#ffd84e', true);
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
  floatText(MUTS[m].name + '!', p.x, p.y, MUTS[m].col);
  Wd.burst(pl.x, 6, pl.z, [MUTS[m].col, '#ffffff'], 12, { speed: 6, up: 8 });
  sfx('mut');
});
on('lightning', ({ x, z }) => { Wd.lightning(x, z); sfx('thunder'); });
on('moonbeam', (pl) => { for (let k = 0; k < 14; k++) Wd.sparkle(pl.x, 4 + k * 2.5, pl.z, bloodMoon() ? '#ff7080' : '#d6c8ff'); });
on('broke', () => { toast('Not enough money!'); sfx('error'); });
on('nostock', () => { toast('Sold out! New seeds in ' + fmtTime(restockIn())); sfx('error'); });
on('bagfull', () => { const t = performance.now(); if (t - bagFullT < 2000) return; bagFullT = t; toast('Basket full! Sell at the SELL stall.'); sfx('error'); });
on('buy', () => sfx('buy'));
on('weather', (w) => { if (G.tut >= 6) toast(w === 'clear' ? 'The skies are clearing up.' : WEATHER[w].msg); });
on('welcome', ({ sec, ripe }) => { if (sec > 30) setTimeout(() => toast(`Welcome back! Your garden grew for ${fmtTime(sec)}.` + (ripe ? ` ${ripe} fruit ripened.` : '')), 600); });
on('reset', () => { hotKey = ''; lastStep = -1; ui.shown = G.money; });
