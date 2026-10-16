// HUD, hotbar, shop panels, dialogs, toasts, tutorial, and all touch input.
import { canvas, painter, mix, darken, lighten, clamp, lerp, ease, fmt, fmtTime, fmtKg, ditherRect, INK, hsl } from './util.js';
import { text, textWidth, wrap, TINY, MAIN, bigText } from './font.js';
import * as A from './art.js';
import { CROPS, CROP, RARITIES, MUTS, MUT_ORDER, SPRINKLERS, EXPANSIONS, basketPrice, CAN_PRICE, CAN_USES, EGGS, EGG, PETS, MAX_PETS, WEATHER, COLS, ROWS, mutMult } from './data.js';
import { G, on, emit, plant, harvest, harvestAll, sell, buySeed, buyGear, buyEgg, releasePet, water, dig, placeSprinkler,
  inStock, restockIn, period, capacity, unlocked, ripeCount, totalRipe, bagValue, itemKey, expandPrice, petBonus, sprinklerAt, reset, save } from './state.js';
import { L, W8, tileAt, tileRect, anchorOf, stallAt, walkTo, float, burst, refreshGround, petScreenPos } from './scene.js';
import { speed, isNight, bloodMoon, dayFrac } from './sim.js';
import { sfx, initAudio, setSound, setMusic } from './audio.js';

export const UI = { title: true, panel: null, confirm: null, info: null, toasts: [], shown: 0, hotScroll: 0, selT: 0, flashHot: 0 };
let hits = [];
const ptr = { down: false, x: 0, y: 0 };
const PAPER = '#f7e8c6', PAPER2 = '#efdcb2', LINE = '#d4b47c', BROWN = '#3a2421', MUTED = '#8a6448';
const WD = A.PAL.wood;

// ---------------------------------------------------------------- primitives
function hit(x, y, w, h, fn, o = {}) { const r = { x, y, w, h, fn, ...o }; hits.push(r); return r; }
const inside = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h &&
  (!r.clip || (x >= r.clip.x && x < r.clip.x + r.clip.w && y >= r.clip.y && y < r.clip.y + r.clip.h));
const pressed = (id) => ptr.down && ptr.hit && ptr.hit.id === id && !ptr.moved && inside(ptr.hit, ptr.x, ptr.y);

function box(g, x, y, w, h, fill, edge = INK) {
  g.fillStyle = edge;
  g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
  g.fillStyle = fill;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
}
function woodPanel(g, x, y, w, h) {
  box(g, x, y, w, h, WD[3]);
  g.fillStyle = WD[5]; g.fillRect(x + 2, y + 1, w - 4, 1);
  g.fillStyle = WD[4]; g.fillRect(x + 1, y + 2, 1, h - 4);
  g.fillStyle = WD[1]; g.fillRect(x + 2, y + h - 2, w - 4, 1); g.fillRect(x + w - 2, y + 2, 1, h - 4);
  for (let yy = y + 6; yy < y + h - 4; yy += 7) { g.fillStyle = WD[2]; g.fillRect(x + 3, yy, w - 6, 1); }
}
function paper(g, x, y, w, h) {
  box(g, x, y, w, h, PAPER, WD[1]);
  g.fillStyle = '#fff3d8'; g.fillRect(x + 1, y + 1, w - 2, 1);
  g.fillStyle = PAPER2; g.fillRect(x + 1, y + h - 2, w - 2, 1);
}
// 3D button. Returns true if drawn pressed.
function button(g, id, x, y, w, h, col, label, fn, o = {}) {
  const dis = o.disabled;
  const r = hit(x, y, w, h, fn, { id, ...o });
  const p = pressed(id);
  const c = dis ? '#a8a0a0' : col;
  const dy = p ? 1 : 0;
  g.fillStyle = INK;
  g.fillRect(x + 1, y + dy, w - 2, h - dy); g.fillRect(x, y + 1 + dy, w, h - 2 - dy);
  g.fillStyle = darken(c, 0.35); g.fillRect(x + 1, y + 1 + dy, w - 2, h - 2 - dy);
  g.fillStyle = c; g.fillRect(x + 1, y + 1 + dy, w - 2, h - 4 + (p ? 1 : 0) - dy);
  g.fillStyle = lighten(c, 0.35); g.fillRect(x + 2, y + 1 + dy, w - 4, 1);
  let lx = x + w / 2;
  if (o.icon) {
    const iw = o.icon.width, tw = label ? textWidth(label) + 2 : 0;
    const ix = Math.round(x + (w - iw - tw) / 2);
    g.drawImage(o.icon, ix, Math.round(y + (h - 2 - o.icon.height) / 2) + dy);
    lx = ix + iw + 2 + tw / 2;
  }
  if (label) text(g, label, lx, y + Math.floor((h - 9) / 2) + dy, dis ? '#e8e0e0' : '#fff6dc', { align: 'center', outline: darken(c, 0.55) });
  return r;
}
function closeBtn(g, x, y, fn) {
  const p = pressed('close');
  hit(x - 2, y - 2, 17, 17, fn, { id: 'close' });
  box(g, x, y + (p ? 1 : 0), 13, 13, '#d9534f');
  g.fillStyle = '#ff8a7a'; g.fillRect(x + 2, y + 1 + (p ? 1 : 0), 9, 1);
  const P = painter({ g }), oy = y + (p ? 1 : 0);
  P.line(x + 4, oy + 4, x + 8, oy + 8, '#fff6dc'); P.line(x + 8, oy + 4, x + 4, oy + 8, '#fff6dc');
  P.line(x + 5, oy + 4, x + 9, oy + 8, '#fff6dc'); P.line(x + 9, oy + 4, x + 5, oy + 8, '#fff6dc');
}
const priceLabel = (n) => '$' + fmt(n);

// ---------------------------------------------------------------- toasts & dialogs
export function toast(str, col = '#fff6dc') {
  if (UI.toasts.some((t) => t.str === str && t.t < 1)) return;
  UI.toasts.push({ str, col, t: 0, life: 2.8 });
  if (UI.toasts.length > 3) UI.toasts.shift();
}
function confirm(msg, yes, fn, col = '#5fbf4a') { UI.confirm = { msg, yes, fn, col, t: 0 }; sfx('open'); }

// ---------------------------------------------------------------- selection / hotbar items
function hotItems() {
  const out = [];
  for (const c of CROPS) if (G.seeds[c.id] > 0) out.push({ id: 'seed:' + c.id, icon: A.packet(c.id), n: G.seeds[c.id], name: c.name + ' Seed', hint: 'Tap soil to plant' });
  if (G.cans > 0) out.push({ id: 'can', icon: A.toolIcon('can'), n: G.cans, name: 'Watering Can', hint: 'Tap a plant: 2x growth' });
  for (const k in SPRINKLERS) if (G.spr[k] > 0) out.push({ id: 'spr:' + k, icon: A.sprinklerIcon(k), n: G.spr[k], name: SPRINKLERS[k].name, hint: 'Tap a tile to place' });
  out.push({ id: 'shovel', icon: A.toolIcon('shovel'), n: 0, name: 'Shovel', hint: 'Tap a plant to remove it' });
  return out;
}
export function select(id) {
  G.sel = id;
  UI.selT = 2.2;
  sfx('tap');
}
function ensureSelection() {
  if (!G.sel) return;
  const items = hotItems();
  if (items.some((it) => it.id === G.sel)) return;
  const seed = items.find((it) => it.id.startsWith('seed:'));
  G.sel = seed ? seed.id : null;
}

// ---------------------------------------------------------------- garden actions (tap + drag)
const CHEAP = 1000;
function plantSel(i) {
  let crop = G.sel && G.sel.startsWith('seed:') ? G.sel.slice(5) : null;
  if (!crop) return false;
  if (!(G.seeds[crop] > 0)) return false;
  const ok = plant(i, crop);
  if (ok && !(G.seeds[crop] > 0)) {
    const next = hotItems().find((it) => it.id.startsWith('seed:'));
    if (next) { G.sel = next.id; UI.selT = 2.2; toast(`Out of ${CROP[crop].name} seeds. Switched to ${CROP[next.id.slice(5)].name}.`); }
    else { G.sel = null; toast('Out of seeds! Buy more at the SEEDS stand.'); }
  }
  return ok;
}
function applyMode(mode, i) {
  if (i < 0 || !unlocked(i)) return;
  const pl = G.plots[i];
  if (mode === 'harvest' && ripeCount(pl)) harvest(i);
  else if (mode === 'plant' && !pl) plantSel(i);
  else if (mode === 'dig' && pl && CROP[pl.c].price < CHEAP) dig(i);
  else if (mode === 'water' && pl && G.cans > 0) water(i);
}
function gardenStart(i) {
  if (i < 0) return null;
  const row = Math.floor(i / COLS);
  if (!unlocked(i)) {
    if (row === G.rows) askExpand();
    else toast('Expand your garden to unlock this land.');
    return null;
  }
  const pl = G.plots[i], sel = G.sel || '';
  const a = anchorOf(i);
  walkTo(a.x + 8, a.y + 3);
  UI.info = null;
  if (pl && ripeCount(pl)) { harvest(i); return 'harvest'; }
  if (sel.startsWith('seed:') && !pl) { plantSel(i); return 'plant'; }
  if (sel === 'shovel') {
    if (pl) {
      if (CROP[pl.c].price >= CHEAP) { confirm(`Dig up this ${CROP[pl.c].name}? It will be gone for good.`, 'Dig up', () => dig(i), '#d9534f'); return null; }
      dig(i); return 'dig';
    }
    if (G.placed.some((s) => s.i === i)) { dig(i); return null; }
    toast('Nothing to dig here.');
    return null;
  }
  if (sel === 'can') {
    if (pl) { water(i); return 'water'; }
    toast('Tap a plant to water it.');
    return null;
  }
  if (sel.startsWith('spr:')) { placeSprinkler(i, sel.slice(4)); ensureSelection(); return null; }
  if (pl) { UI.info = { i, t: 3.5 }; sfx('tap'); return null; }
  if (!hotItems().some((it) => it.id.startsWith('seed:'))) toast('No seeds left. Buy some at the SEEDS stand!');
  else { toast('Pick a seed from your hotbar first!'); UI.flashHot = 1; }
  return null;
}
function askExpand() {
  if (G.rows >= ROWS) return;
  const p = expandPrice();
  confirm(`Expand your garden by one row of ${COLS} plots for ${priceLabel(p)}?`, 'Expand', () => buyGear('expand'));
}

// ---------------------------------------------------------------- panels
const KIND_STALL = { seeds: 'seeds', sell: 'sell', gear: 'gear', eggs: 'eggs' };
export function openPanel(kind, tab = 0) {
  UI.panel = { kind, scroll: 0, vel: 0, max: 0, anim: 0, tab, closing: false };
  UI.info = null;
  sfx('open');
  const s = L.stalls[KIND_STALL[kind]];
  if (s) walkTo(s.x + s.w / 2, L.townY + 61);
}
function closePanel() { if (UI.panel) { UI.panel.closing = true; sfx('close'); } }

function panelGeom() {
  const x = 5, w = L.W - 10, top = Math.max(L.hudY + 17, L.insetT + 4), bottom = L.H - L.insetB - 5;
  return { x, w, top, h: bottom - top };
}

function drawPanel(g) {
  const P = UI.panel;
  const e = ease(P.anim);
  g.fillStyle = `rgba(20,12,24,${(0.55 * e).toFixed(3)})`; g.fillRect(0, 0, L.W, L.H);
  hit(0, 0, L.W, L.H, closePanel, { id: 'dim' });
  const geo = panelGeom();
  const oy = Math.round((1 - e) * (L.H - geo.top + 10));
  const x = geo.x, y = geo.top + oy, w = geo.w, h = geo.h;
  hit(x, y, w, h, () => {}, { id: 'panelbg' });
  woodPanel(g, x, y, w, h);
  // title ribbon
  const titles = { seeds: 'Seed Shop', sell: 'Sell Stand', gear: 'Gear Shop', eggs: 'Pet Eggs', settings: 'Settings' };
  const tcol = { seeds: '#4fae5a', sell: '#f0a830', gear: '#d9534f', eggs: '#9b6bd6', settings: '#7a8aa8' }[P.kind];
  const title = titles[P.kind], tw = textWidth(title) + 18;
  const tx = Math.round(x + w / 2 - tw / 2);
  box(g, tx, y + 3, tw, 13, tcol);
  g.fillStyle = lighten(tcol, 0.35); g.fillRect(tx + 2, y + 4, tw - 4, 1);
  g.fillStyle = darken(tcol, 0.3); g.fillRect(tx + 1, y + 14, tw - 2, 1);
  text(g, title, x + w / 2, y + 5, '#fff6dc', { align: 'center', outline: darken(tcol, 0.55) });
  closeBtn(g, x + w - 17, y + 3, closePanel);
  // content area
  const cx = x + 4, cy = y + 19, cw = w - 8;
  let ch = h - 23;
  const footer = { sell: 26 }[P.kind] || 0;
  let head = 0;
  if (P.kind === 'seeds') head = 13;
  if (P.kind === 'eggs') head = 17;
  paper(g, cx, cy, cw, ch);
  if (head) drawHead(g, P, cx, cy, cw);
  const list = { x: cx + 1, y: cy + head + 1, w: cw - 2, h: ch - head - footer - 2 };
  P.list = list;
  hit(list.x, list.y, list.w, list.h, () => {}, { id: 'list', scroll: P });
  g.save();
  g.beginPath(); g.rect(list.x, list.y, list.w, list.h); g.clip();
  const total = ({ seeds: listSeeds, sell: listSell, gear: listGear, eggs: P.tab ? listPets : listEggs, settings: listSettings })[P.kind](g, list.x, list.y - Math.round(P.scroll), list.w, list);
  g.restore();
  P.max = Math.max(0, total - list.h);
  // scroll bar
  if (P.max > 0) {
    const bh = Math.max(10, (list.h * list.h) / total), by = list.y + (P.scroll / P.max) * (list.h - bh);
    g.fillStyle = LINE; g.fillRect(list.x + list.w - 3, list.y + 1, 2, list.h - 2);
    g.fillStyle = WD[2]; g.fillRect(list.x + list.w - 3, Math.round(by), 2, Math.round(bh));
  }
  if (footer) drawFooter(g, P, cx, cy + ch - footer, cw, footer);
  if (P.closing) return;
}
function drawHead(g, P, x, y, w) {
  if (P.kind === 'seeds') {
    g.fillStyle = PAPER2; g.fillRect(x + 1, y + 1, w - 2, 12);
    g.drawImage(A.sproutIcon(), x + 4, y + 3);
    text(g, 'New seeds in ' + fmtTime(restockIn()), x + 14, y + 3, MUTED);
    text(g, priceLabel(G.money), x + w - 4, y + 3, '#3a7a2a', { align: 'right' });
  }
  if (P.kind === 'eggs') {
    const tabs = ['Eggs', `My Pets ${G.pets.length}/${MAX_PETS}`];
    const tw = Math.floor((w - 6) / 2);
    tabs.forEach((t, k) => {
      const sel = P.tab === k;
      button(g, 'tab' + k, x + 3 + k * (tw + 1), y + 2, tw, 14, sel ? '#9b6bd6' : '#c8b0a0', t, () => { P.tab = k; P.scroll = 0; sfx('tap'); });
    });
  }
}
function drawFooter(g, P, x, y, w, h) {
  g.fillStyle = PAPER2; g.fillRect(x + 1, y, w - 2, h - 1);
  g.fillStyle = LINE; g.fillRect(x + 1, y, w - 2, 1);
  const v = bagValue();
  button(g, 'sellall', x + 4, y + 4, w - 8, h - 7, '#f0a830', G.bag.length ? 'Sell All  ' + priceLabel(v) : 'Basket is empty', () => {
    if (!G.bag.length) return;
    sell();
    if (G.tut === 4) G.tut = 5;
  }, { disabled: !G.bag.length, icon: A.coinIcon() });
}
function rowBg(g, x, y, w, h, k) { if (k % 2) { g.fillStyle = '#f2dfb6'; g.fillRect(x, y, w, h); } g.fillStyle = '#ead3a4'; g.fillRect(x + 3, y + h - 1, w - 6, 1); }

function listSeeds(g, x, y, w, clip) {
  const RH = 30;
  CROPS.forEach((c, k) => {
    const ry = y + k * RH;
    if (ry > clip.y + clip.h || ry + RH < clip.y) return;
    rowBg(g, x, ry, w, RH, k);
    const n = inStock(c.id), rar = RARITIES[c.rarity];
    g.drawImage(A.packet(c.id), x + 3, ry + 6);
    text(g, c.name, x + 21, ry + 4, BROWN);
    const rc = rar.rainbow ? hsl(W8.t * 120, 70, 45) : rar.dark;
    const rw = text(g, rar.name.toUpperCase(), x + 21, ry + 15, rc, { font: TINY });
    const have = G.seeds[c.id] || 0;
    text(g, n ? `x${n} IN STOCK` : 'NONE TODAY', x + 25 + rw, ry + 15, n ? '#3a7a2a' : '#b08870', { font: TINY });
    if (have) text(g, `HAVE ${have}`, x + 21, ry + 22, MUTED, { font: TINY });
    const can = n > 0 && G.money >= c.price;
    button(g, 'seed' + c.id, x + w - 52, ry + 7, 48, 16, n > 0 ? '#5fbf4a' : '#a8a0a0', n > 0 ? priceLabel(c.price) : 'SOLD OUT',
      () => { if (buySeed(c.id)) { onBought(c.id, x + w - 28, ry + 7); } }, { clip, repeat: true, disabled: !can });
  });
  return CROPS.length * RH;
}
function onBought(id, x, y) {
  float('+1', x, y, '#a8ff8a');
  if (!G.sel || !G.sel.startsWith('seed:')) G.sel = 'seed:' + id;
  if (G.tut === 5) G.tut = 6;
}
function gearRows() {
  const rows = [];
  rows.push({ id: 'can', icon: A.toolIcon('can'), name: 'Watering Can', desc: `${CAN_USES} uses. Watered plants grow 2x for a minute.`, price: CAN_PRICE, own: G.cans ? `HAVE ${G.cans} USES` : '' });
  for (const k in SPRINKLERS) rows.push({ id: k, icon: A.sprinklerIcon(k), name: SPRINKLERS[k].name, desc: SPRINKLERS[k].desc, price: SPRINKLERS[k].price, own: G.spr[k] ? `HAVE ${G.spr[k]}` : '' });
  rows.push({ id: 'basket', icon: A.toolIcon('basket'), name: 'Bigger Basket', desc: `Carry 100 more fruit (now ${capacity()}).`, price: basketPrice(G.basket) });
  if (G.rows < ROWS) rows.push({ id: 'expand', icon: A.toolIcon('expand'), name: 'Garden Expansion', desc: `Unlock ${COLS} more plots of land.`, price: expandPrice(), confirm: true });
  return rows;
}
function listGear(g, x, y, w, clip) {
  let yy = y;
  gearRows().forEach((r, k) => {
    const lines = wrap(r.desc, w - 80);
    const RH = Math.max(32, 16 + lines.length * 9 + (r.own ? 6 : 0));
    rowBg(g, x, yy, w, RH, k);
    g.drawImage(r.icon, x + 3 + Math.round((15 - r.icon.width) / 2), yy + Math.round((RH - r.icon.height) / 2));
    text(g, r.name, x + 21, yy + 4, BROWN);
    lines.forEach((ln, j) => text(g, ln, x + 21, yy + 14 + j * 9, MUTED));
    if (r.own) text(g, r.own, x + 21, yy + 15 + lines.length * 9, '#3a7a2a', { font: TINY });
    button(g, 'gear' + r.id, x + w - 52, yy + Math.round((RH - 16) / 2), 48, 16, '#5fbf4a', priceLabel(r.price), () => {
      if (r.confirm) { if (G.money < r.price) { emit('broke'); return; } closePanel(); askExpand(); return; }
      if (buyGear(r.id)) { float('Bought!', x + w - 28, yy + 4, '#a8ff8a'); ensureSelection(); if (!G.sel || G.sel === 'shovel') G.sel = r.id === 'can' ? 'can' : SPRINKLERS[r.id] ? 'spr:' + r.id : G.sel; }
    }, { clip, disabled: G.money < r.price, repeat: !r.confirm && r.id !== 'basket' });
    yy += RH;
  });
  return yy - y;
}
function listEggs(g, x, y, w, clip) {
  const RH = 38;
  EGGS.forEach((e, k) => {
    const ry = y + k * RH;
    rowBg(g, x, ry, w, RH, k);
    const img = A.eggSprite(e.id);
    g.drawImage(img, x + 5, ry + 13 + (Math.sin(W8.t * 3 + k) > 0.8 ? -1 : 0));
    text(g, e.name, x + 19, ry + 4, BROWN);
    text(g, 'Hatches in ' + fmtTime(e.hatch), x + 19, ry + 14, MUTED);
    e.pets.forEach(([p], j) => g.drawImage(A.petFrames(p).right[0], x + 17 + j * 15, ry + 23));
    button(g, 'egg' + e.id, x + w - 52, ry + 11, 48, 16, '#9b6bd6', priceLabel(e.price), () => {
      if (buyEgg(e.id)) { float('Egg in the nest!', x + w / 2, ry + 6, '#e8c8ff'); closePanel(); }
    }, { clip, disabled: G.money < e.price });
  });
  return EGGS.length * RH;
}
function listPets(g, x, y, w, clip) {
  if (!G.pets.length) {
    const lines = wrap('No pets yet. Buy an egg and it will hatch in your nest. Pets roam your garden and help out!', w - 16);
    lines.forEach((ln, j) => text(g, ln, x + w / 2, y + 10 + j * 10, MUTED, { align: 'center' }));
    return 20 + lines.length * 10;
  }
  const RH = 34;
  G.pets.forEach((p, k) => {
    const d = PETS[p.type], ry = y + k * RH;
    rowBg(g, x, ry, w, RH, k);
    g.drawImage(A.petFrames(p.type).right[Math.floor(W8.t * 3) % 2], x + 3, ry + 10);
    text(g, d.name, x + 21, ry + 4, BROWN);
    text(g, RARITIES[d.rarity].name.toUpperCase(), x + 25 + textWidth(d.name), ry + 6, RARITIES[d.rarity].dark, { font: TINY });
    wrap(d.desc, w - 80).forEach((ln, j) => text(g, ln, x + 21, ry + 14 + j * 9, MUTED));
    button(g, 'rel' + k, x + w - 52, ry + 9, 48, 16, '#d9534f', 'Release', () => confirm(`Release your ${d.name}? It will leave your garden.`, 'Release', () => releasePet(k), '#d9534f'), { clip });
  });
  return G.pets.length * RH;
}
function groups() {
  const m = new Map();
  for (const it of G.bag) {
    const k = itemKey(it);
    let gr = m.get(k);
    if (!gr) m.set(k, (gr = { key: k, c: it.c, m: it.m, n: 0, v: 0, kg: 0 }));
    gr.n++; gr.v += it.v; gr.kg = Math.max(gr.kg, it.kg);
  }
  return [...m.values()].sort((a, b) => b.v - a.v);
}
function mutName(m) { return MUT_ORDER.filter((k) => m.includes(k)).map((k) => MUTS[k].name).join(' '); }
function listSell(g, x, y, w, clip) {
  const gs = groups();
  text(g, `Basket ${G.bag.length}/${capacity()}`, x + 5, y + 4, MUTED);
  const bonus = petBonus('sell');
  if (bonus) text(g, `Pet bonus +${Math.round(bonus * 100)}%`, x + w - 5, y + 4, '#3a7a2a', { align: 'right' });
  if (!gs.length) {
    wrap('Your basket is empty. Tap ripe crops in your garden to harvest them, then sell them here!', w - 16).forEach((ln, j) => text(g, ln, x + w / 2, y + 22 + j * 10, MUTED, { align: 'center' }));
    return 60;
  }
  const RH = 26, y0 = y + 14;
  gs.forEach((gr, k) => {
    const ry = y0 + k * RH;
    if (ry > clip.y + clip.h || ry + RH < clip.y) return;
    rowBg(g, x, ry, w, RH, k);
    const icon = A.mutated(A.cropIcon(gr.c), A.mainLook(gr.m), Math.floor(W8.t * 8));
    g.drawImage(icon, x + 3 + Math.round((15 - icon.width) / 2), ry + Math.round((RH - icon.height) / 2));
    const mn = mutName(gr.m);
    text(g, CROP[gr.c].name + (gr.n > 1 ? ` x${gr.n}` : ''), x + 21, ry + 3, BROWN);
    if (mn) {
      let mx = x + 21;
      MUT_ORDER.filter((kk) => gr.m.includes(kk)).forEach((kk) => { mx += text(g, MUTS[kk].name.toUpperCase(), mx, ry + 14, darken(MUTS[kk].col, 0.35), { font: TINY }) + 4; });
    } else text(g, 'BEST ' + fmtKg(gr.kg), x + 21, ry + 14, MUTED, { font: TINY });
    button(g, 'sg' + gr.key, x + w - 52, ry + 5, 48, 16, '#f0a830', priceLabel(gr.v * (1 + bonus)), () => { sell(gr.key); if (G.tut === 4) G.tut = 5; }, { clip });
  });
  return 14 + gs.length * RH;
}
function listSettings(g, x, y, w, clip) {
  let yy = y + 4;
  const row = (label, on, fn, id) => {
    text(g, label, x + 8, yy + 4, BROWN);
    button(g, id, x + w - 52, yy, 48, 16, on ? '#5fbf4a' : '#a8a0a0', on ? 'ON' : 'OFF', fn, { clip });
    yy += 22;
  };
  row('Sound effects', G.sound, () => { G.sound = !G.sound; setSound(G.sound); sfx('tap'); }, 'snd');
  row('Music', G.music, () => { G.music = !G.music; setMusic(G.music); sfx('tap'); }, 'mus');
  yy += 2;
  text(g, 'How to play', x + 8, yy, BROWN); yy += 11;
  const help = '1. Pick a seed in the hotbar and tap or drag across soil to plant.\n2. Crops grow on their own, even while you are away.\n3. Tap ripe crops, or press Harvest All.\n4. Sell at the SELL stand, then buy better seeds.\nRain, snow, storms, the moon and your pets can mutate fruit to be worth far more.';
  wrap(help, w - 16).forEach((ln) => { text(g, ln, x + 8, yy, MUTED); yy += 10; });
  yy += 4;
  text(g, 'Stats', x + 8, yy, BROWN); yy += 11;
  for (const [k, v] of [['Planted', fmt(G.stats.planted)], ['Harvested', fmt(G.stats.harvested)], ['Earned', priceLabel(G.stats.earned)], ['Best fruit', priceLabel(G.stats.best)]]) {
    text(g, k, x + 8, yy, MUTED); text(g, v, x + w - 8, yy, BROWN, { align: 'right' }); yy += 10;
  }
  yy += 6;
  button(g, 'reset', x + 8, yy, w - 16, 16, '#d9534f', 'Start a new garden', () => confirm('Erase this garden and start over? This cannot be undone.', 'Erase', () => { reset(); refreshGround(); UI.panel = null; UI.title = true; }, '#d9534f'), { clip });
  yy += 24;
  return yy - y;
}

// ---------------------------------------------------------------- HUD + bar
function drawHud(g) {
  const y = L.hudY;
  // money
  const s = fmt(UI.shown);
  const tw = textWidth(s);
  const bump = W8.moneyBump > 0 ? -1 : 0;
  box(g, 3, y, tw + 18, 13, '#3a2a30');
  g.fillStyle = '#5a4450'; g.fillRect(4, y + 1, tw + 16, 1);
  g.drawImage(A.coinIcon(), 5, y + 2 + bump);
  text(g, s, 15, y + 3 + bump, W8.moneyBump > 0 ? '#fff6a0' : '#ffe14a', { outline: '#26162b' });
  L.moneyPos = { x: 9, y: y + 6 };
  // weather / time chip
  const wt = G.weather.type;
  let icon, label;
  if (wt !== 'clear') { icon = A.weatherIcon(wt); label = fmtTime(G.weather.left); }
  else if (isNight()) { icon = A.weatherIcon(bloodMoon() ? 'blood' : 'night'); label = bloodMoon() ? 'Blood Moon' : 'Night'; }
  else { icon = A.weatherIcon('clear'); label = 'Sunny'; }
  const cw = textWidth(label) + icon.width + 9;
  const gx = L.W - 17;
  const cx = gx - 3 - cw;
  box(g, cx, y, cw, 13, '#2a3048');
  g.fillStyle = '#3e4868'; g.fillRect(cx + 1, y + 1, cw - 2, 1);
  g.drawImage(icon, cx + 3, y + Math.round((13 - icon.height) / 2));
  text(g, label, cx + icon.width + 5, y + 3, '#e8f0ff', { outline: '#141828' });
  hit(cx, y, cw, 13, () => toast(wt !== 'clear' ? WEATHER[wt].msg : isNight() ? 'At night, fruit can become Moonlit (x2).' : 'Clear skies. Weather changes every few minutes.'), { id: 'wchip' });
  // settings
  const p = pressed('set');
  hit(gx - 1, y - 1, 16, 15, () => openPanel('settings'), { id: 'set' });
  box(g, gx, y + (p ? 1 : 0), 13, 13, '#5a6680');
  g.drawImage(A.toolIcon('gear'), gx + 1, y + 1 + (p ? 1 : 0));
  // seed restock timer on the stall
  const st = L.stalls.seeds, rl = fmtTime(restockIn()), rw = textWidth(rl, TINY) + 4;
  const rx = Math.round(st.x + st.w / 2 - rw / 2), ry = st.y + 22;
  box(g, rx, ry, rw, 7, '#2a3a2a');
  text(g, rl, rx + 2, ry + 1, '#c8f0a0', { font: TINY });
}

function drawBar(g) {
  const y = L.barY, W = L.W;
  // wooden shelf
  g.fillStyle = INK; g.fillRect(0, y, W, L.H - y);
  g.fillStyle = WD[2]; g.fillRect(0, y + 1, W, L.H - y - 1);
  g.fillStyle = WD[4]; g.fillRect(0, y + 1, W, 1);
  g.fillStyle = WD[3]; g.fillRect(0, y + 2, W, 1);
  for (let yy = y + 9; yy < L.H; yy += 8) { g.fillStyle = WD[1]; g.fillRect(0, yy, W, 1); }
  for (let xx = 30; xx < W; xx += 61) { g.fillStyle = WD[1]; g.fillRect(xx, y + 3, 1, L.H - y); }
  // hotbar
  const items = hotItems();
  const SW = 22, GAP = 2, hx = 4, hw = W - 8;
  const total = items.length * (SW + GAP) - GAP;
  const maxScroll = Math.max(0, total - hw);
  UI.hotScroll = clamp(UI.hotScroll, 0, maxScroll);
  const clip = { x: hx, y: L.hotY - 3, w: hw, h: SW + 4 };
  const hb = hit(clip.x, clip.y, clip.w, clip.h, () => {}, { id: 'hotbar', hscroll: true, max: maxScroll });
  g.save(); g.beginPath(); g.rect(clip.x, clip.y, clip.w, clip.h); g.clip();
  const fl = UI.flashHot > 0 && Math.sin(W8.t * 20) > 0;
  items.forEach((it, k) => {
    const sx = Math.round(hx + k * (SW + GAP) - UI.hotScroll), sel = G.sel === it.id;
    const sy = L.hotY - (sel ? 2 : 0);
    hit(sx, sy, SW, SW + (sel ? 2 : 0), () => { if (G.sel === it.id) { G.sel = null; sfx('tap'); } else select(it.id); }, { id: 'slot' + it.id, clip, inH: true });
    box(g, sx, sy, SW, SW, sel ? '#ffe9a8' : fl && it.id.startsWith('seed:') ? '#ffffff' : PAPER, sel ? '#c88a1a' : INK);
    if (sel) { g.fillStyle = '#ffd23f'; g.fillRect(sx + 1, sy + 1, SW - 2, 1); g.fillRect(sx + 1, sy + SW - 2, SW - 2, 1); g.fillRect(sx + 1, sy + 1, 1, SW - 2); g.fillRect(sx + SW - 2, sy + 1, 1, SW - 2); }
    else { g.fillStyle = PAPER2; g.fillRect(sx + 1, sy + SW - 2, SW - 2, 1); }
    g.drawImage(it.icon, sx + Math.round((SW - it.icon.width) / 2), sy + Math.round((SW - it.icon.height) / 2) - (it.n ? 1 : 0));
    if (it.n) text(g, String(it.n > 999 ? '999+' : it.n), sx + SW - 2, sy + SW - 7, '#fff6dc', { font: TINY, align: 'right', outline: INK });
  });
  g.restore();
  if (maxScroll > 0) {
    if (UI.hotScroll < maxScroll) { g.fillStyle = '#fff6dc'; g.fillRect(W - 3, L.hotY + 8, 1, 5); g.fillRect(W - 2, L.hotY + 9, 1, 3); }
    if (UI.hotScroll > 0) { g.fillStyle = '#fff6dc'; g.fillRect(2, L.hotY + 8, 1, 5); g.fillRect(1, L.hotY + 9, 1, 3); }
  }
  // basket + harvest all
  const full = G.bag.length >= capacity();
  const bb = L.bagBtn, bump = W8.bagBump > 0 ? -1 : 0;
  button(g, 'bag', bb.x, bb.y + bump, bb.w, bb.h, full ? '#d9534f' : '#c8904a', `${G.bag.length}/${capacity()}`, () => openPanel('sell'), { icon: A.toolIcon('basket') });
  const n = totalRipe(), hb2 = L.harvestBtn;
  button(g, 'hall', hb2.x, hb2.y, hb2.w, hb2.h, '#5fbf4a', n ? `Harvest All (${n})` : 'Harvest All', () => {
    if (!n) { toast('Nothing is ripe yet. Ripe fruit sparkles!'); sfx('error'); return; }
    harvestAll();
    walkTo(L.W / 2, L.gBottom - 2);
  }, { disabled: !n });
  if (n && Math.sin(W8.t * 4) > 0.6) { g.drawImage(A.sparkle(1), hb2.x + hb2.w - 7, hb2.y - 2); }
  // selected item label
  if (UI.selT > 0 && G.sel && !UI.panel) {
    const it = items.find((i) => i.id === G.sel);
    if (it) {
      const label = `${it.name}: ${it.hint}`;
      const tw = Math.min(textWidth(label) + 10, W - 8);
      const lx = Math.round(W / 2 - tw / 2), ly = L.barY - 15;
      g.globalAlpha = Math.min(1, UI.selT * 3);
      box(g, lx, ly, tw, 13, '#2a2030');
      text(g, label, W / 2, ly + 3, '#fff6dc', { align: 'center' });
      g.globalAlpha = 1;
    }
  }
}

function drawInfo(g) {
  const inf = UI.info;
  const pl = G.plots[inf.i];
  if (!pl) { UI.info = null; return; }
  const c = CROP[pl.c], a = anchorOf(inf.i), sp = speed(inf.i);
  const lines = [];
  let prog, label;
  if (!c.multi || pl.g < c.grow) {
    prog = c.multi ? pl.g / c.grow : pl.fr[0].p;
    label = prog >= 1 ? 'Ready to harvest!' : 'Ready in ' + fmtTime((c.grow - pl.g) / sp);
  } else {
    const ripe = ripeCount(pl), growing = pl.fr.filter((f) => f && f.p < 1);
    const next = growing.length ? Math.min(...growing.map((f) => ((1 - f.p) * c.regrow) / sp)) : null;
    prog = pl.fr.reduce((s, f) => s + (f ? f.p : 0), 0) / c.n;
    label = ripe ? `${ripe}/${c.n} ripe` : next != null ? 'Fruit in ' + fmtTime(next) : 'Flowering...';
  }
  const boosts = [];
  if (pl.w > 0) boosts.push('Watered');
  if (sprinklerAt(inf.i)) boosts.push('Sprinkler');
  if (G.weather.type === 'rain' || G.weather.type === 'storm') boosts.push('Rain');
  const bw = Math.max(textWidth(c.name), textWidth(label), boosts.length ? textWidth(boosts.join(' ')) : 0, 60) + 10;
  const bh = 30 + (boosts.length ? 9 : 0);
  const x = clamp(Math.round(a.x - bw / 2), 3, L.W - bw - 3);
  const y = Math.max(L.hudY + 16, a.y - 40 - bh);
  g.globalAlpha = Math.min(1, inf.t * 4);
  box(g, x, y, bw, bh, '#2a2030');
  g.fillStyle = '#2a2030'; g.fillRect(clamp(a.x, x + 4, x + bw - 6) - 1, y + bh, 3, 1); g.fillRect(clamp(a.x, x + 4, x + bw - 6), y + bh + 1, 1, 1);
  text(g, c.name, x + 5, y + 3, RARITIES[c.rarity].col);
  g.fillStyle = '#1a1420'; g.fillRect(x + 5, y + 13, bw - 10, 4);
  g.fillStyle = prog >= 1 ? '#ffd23f' : '#5fbf4a'; g.fillRect(x + 5, y + 13, Math.round((bw - 10) * clamp(prog, 0, 1)), 4);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 5, y + 13, Math.round((bw - 10) * clamp(prog, 0, 1)), 1);
  text(g, label, x + 5, y + 20, '#fff6dc');
  if (boosts.length) text(g, boosts.join(' '), x + 5, y + 29, '#8fd8ff');
  g.globalAlpha = 1;
}

function drawToasts(g) {
  let y = L.hudY + 17;
  for (const t of UI.toasts) {
    const lines = wrap(t.str, L.W - 30);
    const tw = Math.max(...lines.map((l) => textWidth(l))) + 12, th = lines.length * 10 + 5;
    const u = t.t / t.life;
    const slide = t.t < 0.15 ? Math.round((1 - t.t / 0.15) * -6) : 0;
    g.globalAlpha = u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1;
    const x = Math.round(L.W / 2 - tw / 2);
    box(g, x, y + slide, tw, th, '#2a2030');
    g.fillStyle = '#3e3448'; g.fillRect(x + 1, y + slide + 1, tw - 2, 1);
    lines.forEach((ln, k) => text(g, ln, L.W / 2, y + slide + 3 + k * 10, t.col, { align: 'center' }));
    g.globalAlpha = 1;
    y += th + 2;
  }
}

function drawConfirm(g) {
  const c = UI.confirm;
  g.fillStyle = 'rgba(20,12,24,0.5)'; g.fillRect(0, 0, L.W, L.H);
  hit(0, 0, L.W, L.H, () => { UI.confirm = null; sfx('close'); }, { id: 'cdim' });
  const w = Math.min(L.W - 20, 170), lines = wrap(c.msg, w - 16), h = 34 + lines.length * 10;
  const x = Math.round(L.W / 2 - w / 2), y = Math.round(L.H / 2 - h / 2) - 20;
  hit(x, y, w, h, () => {}, { id: 'cbox' });
  woodPanel(g, x, y, w, h);
  paper(g, x + 3, y + 3, w - 6, h - 6);
  lines.forEach((ln, k) => text(g, ln, L.W / 2, y + 8 + k * 10, BROWN, { align: 'center' }));
  const bw = Math.floor((w - 18) / 2);
  button(g, 'cno', x + 6, y + h - 22, bw, 16, '#a8a0a0', 'Cancel', () => { UI.confirm = null; sfx('close'); });
  button(g, 'cyes', x + w - 6 - bw, y + h - 22, bw, 16, c.col, c.yes, () => { UI.confirm = null; c.fn(); });
}

// ---------------------------------------------------------------- tutorial
const TUT = [
  'Tap the soil to plant a Carrot seed!',
  'Plant the rest! Tip: drag across the soil to plant fast.',
  'Your crops are growing. Ripe crops sparkle!',
  'Tap a ripe crop to harvest it, or press Harvest All.',
  'Tap the SELL stand to sell your harvest.',
  'Now tap the SEEDS stand to buy more seeds!',
];
function tutorialStep() {
  if (G.tut === 0 && G.stats.planted > 0) G.tut = 1;
  if (G.tut === 1 && !Object.keys(G.seeds).length) G.tut = 2;
  if (G.tut <= 2 && totalRipe() > 0 && G.stats.planted > 0) G.tut = 3;
  if (G.tut === 3 && G.bag.length > 0) G.tut = 4;
  if (G.tut === 4 && G.stats.earned > 0) G.tut = 5;
  if (G.tut === 5 && G.stats.earned > 0 && CROPS.some((c) => G.bought.c[c.id])) G.tut = 6;
  if (G.tut === 6) { G.tut = 7; toast("You're a natural! Keep growing your garden.", '#a8ff8a'); }
}
function drawTutorial(g) {
  if (G.tut >= 6 || UI.panel || UI.confirm) return;
  const msg = TUT[G.tut];
  const lines = wrap(msg, L.W - 34);
  const h = lines.length * 10 + 6, w = Math.max(...lines.map((l) => textWidth(l))) + 14;
  const x = Math.round(L.W / 2 - w / 2), y = L.barY - h - (UI.selT > 0 ? 18 : 4);
  box(g, x, y, w, h, '#fff6dc', INK);
  g.fillStyle = '#ffd23f'; g.fillRect(x + 1, y + 1, 2, h - 2);
  lines.forEach((ln, k) => text(g, ln, x + w / 2 + 1, y + 4 + k * 10, BROWN, { align: 'center' }));
  // pointing hand
  let target = null;
  if (G.tut === 0) { const i = G.plots.findIndex((p, k) => !p && unlocked(k)); if (i >= 0) { const a = anchorOf(i); target = { x: a.x, y: a.y - 4 }; } }
  if (G.tut === 3) { const i = G.plots.findIndex((p) => ripeCount(p)); if (i >= 0) { const a = anchorOf(i); target = { x: a.x, y: a.y - 6 }; } }
  if (G.tut === 4) { const s = L.stalls.sell; target = { x: s.x + 22, y: s.y + 30 }; }
  if (G.tut === 5) { const s = L.stalls.seeds; target = { x: s.x + 22, y: s.y + 30 }; }
  if (target) {
    const b = Math.round(Math.abs(Math.sin(W8.t * 4)) * 3);
    g.drawImage(A.pointerSprite(), target.x - 4, target.y + 2 + b);
  }
}

// ---------------------------------------------------------------- title
function drawTitle(g) {
  g.fillStyle = 'rgba(20,12,24,0.35)'; g.fillRect(0, 0, L.W, L.H);
  const t1 = bigText('Grow a', '#fff6a0', '#ffc93a'), t2 = bigText('Garden', '#bff07a', '#4fae5a');
  const cy = Math.round(L.townY + 30);
  const b1 = Math.round(Math.sin(W8.t * 2) * 2), b2 = Math.round(Math.sin(W8.t * 2 + 0.6) * 2);
  g.drawImage(t1, Math.round(L.W / 2 - t1.width / 2), cy + b1);
  g.drawImage(t2, Math.round(L.W / 2 - t2.width / 2), cy + 20 + b2);
  const fr = ['carrot', 'strawberry', 'apple', 'corn', 'watermelon', 'grape'];
  fr.forEach((c, k) => {
    const ic = A.cropIcon(c), a = (k / fr.length) * Math.PI * 2 + W8.t * 0.4;
    g.drawImage(ic, Math.round(L.W / 2 + Math.cos(a) * 62 - ic.width / 2), Math.round(cy + 22 + Math.sin(a) * 34 - ic.height / 2));
  });
  text(g, 'pocket edition', L.W / 2, cy + 46, '#c8f0a0', { align: 'center', outline: INK });
  if (Math.sin(W8.t * 4) > -0.3) text(g, G.stats.planted ? 'Tap to continue' : 'Tap to start', L.W / 2, L.barY - 28, '#fff6dc', { align: 'center', outline: INK, thick: true });
  hit(0, 0, L.W, L.H, () => { UI.title = false; initAudio(); setSound(G.sound); setMusic(G.music); sfx('open'); }, { id: 'title' });
}

// ---------------------------------------------------------------- frame
let lastNight = null, lastPeriod = null, bagFullT = 0, rescueT = 3;
export function updateUI(dt) {
  UI.shown = Math.abs(G.money - UI.shown) < 1 ? G.money : lerp(UI.shown, G.money, 1 - Math.exp(-dt * 8));
  if (G.money < UI.shown && G.money < UI.shown - 1) UI.shown = G.money;
  W8.moneyBump = Math.max(0, (W8.moneyBump || 0) - dt);
  W8.bagBump = Math.max(0, (W8.bagBump || 0) - dt);
  UI.selT = Math.max(0, UI.selT - dt);
  UI.flashHot = Math.max(0, UI.flashHot - dt);
  bagFullT = Math.max(0, bagFullT - dt);
  if (!UI.title) for (const t of UI.toasts) t.t += dt;
  UI.toasts = UI.toasts.filter((t) => t.t < t.life);
  if (UI.info && (UI.info.t -= dt) <= 0) UI.info = null;
  const P = UI.panel;
  if (P) {
    P.anim = clamp(P.anim + (P.closing ? -dt : dt) * 5, 0, 1);
    if (P.closing && P.anim <= 0) UI.panel = null;
    else if (!ptr.scrolling) {
      P.scroll += P.vel * dt; P.vel *= Math.exp(-dt * 5);
      if (P.scroll < 0) { P.scroll = lerp(P.scroll, 0, 1 - Math.exp(-dt * 18)); P.vel = 0; }
      if (P.scroll > P.max) { P.scroll = lerp(P.scroll, P.max, 1 - Math.exp(-dt * 18)); P.vel = 0; }
    }
  }
  // hold-to-repeat buttons
  if (ptr.down && ptr.hit && ptr.hit.repeat && !ptr.moved && inside(ptr.hit, ptr.x, ptr.y)) {
    ptr.held += dt;
    if (ptr.held > 0.45) { ptr.rep -= dt; if (ptr.rep <= 0) { ptr.rep = 0.09; ptr.repeated = true; ptr.hit.fn(); } }
  }
  ensureSelection();
  tutorialStep();
  if ((rescueT -= dt) <= 0) {
    rescueT = 3;
    if (G.money < 10 && !Object.keys(G.seeds).length && !G.plots.some(Boolean) && !G.bag.length) {
      G.seeds.carrot = 3; G.sel = 'seed:carrot';
      toast('The seed seller felt generous and gave you 3 free Carrot seeds!', '#a8ff8a');
    }
  }
  // ambient announcements
  const n = isNight();
  if (lastNight !== null && n !== lastNight) toast(n ? (bloodMoon() ? 'A Blood Moon rises! Fruit may become Bloodlit (x4).' : 'Night falls. Moonlight can make fruit Moonlit (x2).') : 'Good morning!', n ? '#d6c8ff' : '#ffe9a8');
  lastNight = n;
  const p = period();
  if (lastPeriod !== null && p !== lastPeriod) { toast('The Seed Shop has restocked!', '#a8ff8a'); burst(L.stalls.seeds.x + 22, L.stalls.seeds.y + 10, ['#a8ff8a', '#fff6dc', '#ffd23f'], 14, { speed: 35 }); }
  lastPeriod = p;
}

export function drawUI(g) {
  hits = [];
  if (UI.title) { drawBar(g); hits = []; drawTitle(g); UI.hits = hits; return; }
  drawHud(g);
  if (UI.info) drawInfo(g);
  drawBar(g);
  drawTutorial(g);
  if (UI.panel) drawPanel(g);
  if (UI.confirm) drawConfirm(g);
  drawToasts(g);
  UI.hits = hits;
}

// ---------------------------------------------------------------- input
function topHit(x, y) {
  for (let k = hits.length - 1; k >= 0; k--) if (inside(hits[k], x, y)) return hits[k];
  return null;
}
export function pointerDown(x, y) {
  Object.assign(ptr, { down: true, x, y, sx: x, sy: y, moved: false, hit: null, scrolling: null, garden: null, stall: null, held: 0, rep: 0, repeated: false, vy: 0, vx: 0 });
  const h = topHit(x, y);
  if (h) {
    ptr.hit = h;
    if (UI.panel && h.id !== 'dim') UI.panel.vel = 0;
    return;
  }
  if (UI.title || UI.panel || UI.confirm) return;
  const st = stallAt(x, y);
  if (st) { ptr.stall = st; return; }
  if (L.expandSign && x >= L.expandSign.x && x < L.expandSign.x + L.expandSign.w && y >= L.expandSign.y && y < L.expandSign.y + L.expandSign.h) { askExpand(); return; }
  if (W8.farmer && y > L.townY + 50 && y < L.gy - 2) { walkTo(x, y); return; }
  const i = tileAt(x, y);
  const mode = gardenStart(i);
  if (mode) ptr.garden = { mode, last: i };
}
export function pointerMove(x, y) {
  if (!ptr.down) return;
  const px = ptr.x, py = ptr.y;
  ptr.x = x; ptr.y = y;
  if (!ptr.moved && Math.hypot(x - ptr.sx, y - ptr.sy) > 4) {
    ptr.moved = true;
    const h = ptr.hit;
    if (h && UI.panel && UI.panel.list && (h.clip || h.scroll) && !h.inH) ptr.scrolling = { kind: 'v', start: UI.panel.scroll, sy: y };
    else if (h && (h.hscroll || h.inH)) ptr.scrolling = { kind: 'h', start: UI.hotScroll, sx: x };
  }
  if (ptr.scrolling) {
    if (ptr.scrolling.kind === 'v') {
      const P = UI.panel;
      if (!P) return;
      let s = ptr.scrolling.start - (y - ptr.scrolling.sy);
      if (s < 0) s *= 0.4; if (s > P.max) s = P.max + (s - P.max) * 0.4;
      P.vel = -(y - (ptr.prevY ?? y)) * 60;
      ptr.prevY = y;
      P.scroll = s;
    } else UI.hotScroll = ptr.scrolling.start - (x - ptr.scrolling.sx);
    return;
  }
  if (ptr.garden) {
    // walk along the drag so fast swipes do not skip tiles
    const steps = Math.ceil(Math.hypot(x - px, y - py) / 3) || 1;
    for (let s = 1; s <= steps; s++) {
      const i = tileAt(px + ((x - px) * s) / steps, py + ((y - py) * s) / steps);
      if (i !== ptr.garden.last && i >= 0) {
        ptr.garden.last = i;
        applyMode(ptr.garden.mode, i);
        const a = anchorOf(i);
        walkTo(a.x + 8, a.y + 3);
      }
    }
  }
}
export function pointerUp(x, y) {
  if (!ptr.down) return;
  ptr.down = false;
  ptr.prevY = undefined;
  const h = ptr.hit;
  if (ptr.scrolling) { ptr.scrolling = null; return; }
  if (h && !ptr.moved && !ptr.repeated && inside(h, x, y)) h.fn();
  if (ptr.stall && !ptr.moved && stallAt(x, y) === ptr.stall) openPanel(ptr.stall);
  ptr.hit = null;
}
export function wheel(dy) {
  if (UI.panel) UI.panel.scroll = clamp(UI.panel.scroll + dy, 0, UI.panel.max);
  else UI.hotScroll += dy;
}

// ---------------------------------------------------------------- event messages
on('broke', () => { toast('Not enough Sheckles!', '#ff9a8a'); sfx('error'); });
on('nostock', () => { toast('Sold out! New seeds in ' + fmtTime(restockIn()), '#ff9a8a'); sfx('error'); });
on('bagfull', () => { if (bagFullT > 0) return; bagFullT = 2; toast('Your basket is full! Sell at the SELL stand.', '#ffb08a'); sfx('error'); });
on('buy', () => sfx('buy'));
on('toast', (s) => { toast(s); sfx('error'); });
on('weather', (w) => toast(w === 'clear' ? 'The skies are clearing up.' : WEATHER[w].msg, w === 'clear' ? '#ffe9a8' : '#9fd8ff'));
on('hatch', ({ type }) => toast(`Your egg hatched a ${PETS[type].name}! ${PETS[type].desc}`, '#ffd84a'));
on('release', (p) => toast(`Your ${PETS[p.type].name} wandered off. Bye bye!`));
on('expand', () => toast('Your garden grew!', '#a8ff8a'));
on('sprinklerdone', () => toast('A sprinkler ran dry.'));
on('welcome', ({ sec, ripe }) => { if (sec > 30) toast(`Welcome back! Your garden grew for ${fmtTime(sec)}.` + (ripe ? ` ${ripe} fruit ripened.` : ''), '#a8ff8a'); });
