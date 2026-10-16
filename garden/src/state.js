// Persistent game state (G), save/load, the seed stock, and every player action.
import { CROPS, CROP, RARITIES, SPRINKLERS, EXPANSIONS, BASKET_BASE, basketPrice, CAN_PRICE, CAN_USES, CAN_DUR,
  PETS, EGG, MAX_PETS, MAX_EGGS, COLS, ROWS, START_ROWS, RESTOCK, DAY_LEN, fruitValue } from './data.js';
import { rng, hash } from './util.js';

export let G = null;

// tiny event bus so the scene/UI/audio can react to game actions
const subs = {};
export const on = (e, f) => (subs[e] ||= []).push(f);
export const emit = (e, d) => (subs[e] || []).forEach((f) => f(d));

const KEY = 'pocket-garden-save-v1';

export function fresh() {
  return {
    v: 1, seed: (Math.random() * 1e9) | 0,
    money: 20, seeds: { carrot: 5 }, cans: 0, spr: {},
    bag: [], basket: 0, rows: START_ROWS,
    plots: new Array(COLS * ROWS).fill(null),
    placed: [], pets: [], eggs: [],
    time: DAY_LEN * 0.1, weather: { type: 'clear', left: 0 }, nextWeather: 140,
    bought: { p: -1, c: {} },
    tut: 0, sel: 'seed:carrot',
    stats: { harvested: 0, earned: 0, planted: 0, best: 0 },
    sound: true, music: true, saved: Date.now(),
  };
}

export function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  if (!d || d.v !== 1 || !Array.isArray(d.plots)) { G = fresh(); return 0; }
  G = Object.assign(fresh(), d);
  if (G.plots.length !== COLS * ROWS) G.plots = new Array(COLS * ROWS).fill(null);
  return Math.max(0, Math.min(8 * 3600, (Date.now() - (d.saved || Date.now())) / 1000));
}
export function save() {
  G.saved = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(G)); } catch { /* storage full or blocked */ }
}
export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  G = fresh();
}

// ---------- seed stock, restocks every RESTOCK seconds of wall-clock time ----------
export const period = () => Math.floor(Date.now() / 1000 / RESTOCK);
export const restockIn = () => RESTOCK - ((Date.now() / 1000) % RESTOCK);
const stockCache = { p: -1, s: null };
export function stock() {
  const p = period();
  if (stockCache.p !== p) {
    const R = rng(hash(p, 17, G.seed));
    const s = {};
    for (const c of CROPS) {
      const r = RARITIES[c.rarity];
      if (R() < r.chance) s[c.id] = r.qty[0] + Math.floor(R() * (r.qty[1] - r.qty[0] + 1));
    }
    s.carrot = Math.max(s.carrot || 0, 5);
    s.strawberry = Math.max(s.strawberry || 0, 2);
    stockCache.p = p; stockCache.s = s;
  }
  if (G.bought.p !== p) G.bought = { p, c: {} };
  return stockCache.s;
}
export const inStock = (id) => Math.max(0, (stock()[id] || 0) - (G.bought.c[id] || 0));

// ---------- derived values ----------
export const capacity = () => BASKET_BASE + 100 * G.basket;
export const unlocked = (i) => Math.floor(i / COLS) < G.rows;
export function petBonus(key) {
  let b = 0;
  for (const p of G.pets) b += PETS[p.type][key] || 0;
  return b;
}
export function sprinklerAt(i) {
  const c = i % COLS, r = Math.floor(i / COLS);
  let best = null;
  for (const s of G.placed) {
    const d = SPRINKLERS[s.k];
    const sc = s.i % COLS, sr = Math.floor(s.i / COLS);
    if (Math.abs(sc - c) <= d.r && Math.abs(sr - r) <= d.r && (!best || d.mult > best.mult)) best = d;
  }
  return best;
}
export const ripeCount = (pl) => (pl ? pl.fr.reduce((n, f) => n + (f && f.p >= 1 ? 1 : 0), 0) : 0);
export function totalRipe() {
  let n = 0;
  for (const pl of G.plots) n += ripeCount(pl);
  return n;
}
export const bagValue = () => Math.round(G.bag.reduce((s, it) => s + it.v, 0) * (1 + petBonus('sell')));

// ---------- fruit ----------
export function newFruit(crop, i, p = 0) {
  let size = 0.85 + Math.random() * 0.35;
  if (Math.random() < 0.04) size *= 1.4 + Math.random() * 0.8; // giant!
  size *= 1 + petBonus('size');
  const m = [];
  const spr = i != null ? sprinklerAt(i) : null;
  if (Math.random() < 0.0025) m.push('rainbow');
  else if (Math.random() < (spr && spr.gold ? 0.05 : 0.012)) m.push('gold');
  return { p, s: +size.toFixed(3), m };
}

// ---------- actions ----------
export function plant(i, crop) {
  if (!unlocked(i) || G.plots[i] || !(G.seeds[crop] > 0)) return false;
  const c = CROP[crop];
  G.seeds[crop]--;
  if (!G.seeds[crop]) delete G.seeds[crop];
  G.plots[i] = { c: crop, g: 0, v: (Math.random() * 3) | 0, f: Math.random() < 0.5, w: 0, fr: c.multi ? [] : [newFruit(crop, i)], cd: [] };
  G.stats.planted++;
  emit('plant', { i, crop });
  return true;
}

export function harvest(i) {
  const pl = G.plots[i];
  if (!pl) return [];
  const c = CROP[pl.c], got = [];
  for (let k = 0; k < pl.fr.length; k++) {
    const f = pl.fr[k];
    if (!f || f.p < 1) continue;
    if (G.bag.length >= capacity()) { emit('bagfull'); break; }
    const item = { c: pl.c, kg: +(c.kg * f.s).toFixed(3), m: f.m.slice(), v: fruitValue(pl.c, f.s, f.m) };
    G.bag.push(item);
    got.push({ item, slot: k });
    if (c.multi) { pl.fr[k] = null; pl.cd[k] = 2 + Math.random() * 2; }
  }
  if (got.length) {
    G.stats.harvested += got.length;
    if (!c.multi) G.plots[i] = null;
    emit('harvest', { i, got, crop: pl.c, removed: !c.multi });
  }
  return got;
}

export function harvestAll() {
  const out = [];
  for (let i = 0; i < G.plots.length; i++) {
    if (G.bag.length >= capacity()) { emit('bagfull'); break; }
    if (ripeCount(G.plots[i])) out.push(...harvest(i));
  }
  return out;
}

// key groups bag items for display/sale: crop + sorted mutations
export const itemKey = (it) => it.c + '|' + it.m.slice().sort().join(',');
export function sell(filter) {
  const keep = [], sold = [];
  for (const it of G.bag) (filter && itemKey(it) !== filter ? keep : sold).push(it);
  if (!sold.length) return 0;
  const total = Math.round(sold.reduce((s, it) => s + it.v, 0) * (1 + petBonus('sell')));
  G.bag = keep;
  G.money += total;
  G.stats.earned += total;
  G.stats.best = Math.max(G.stats.best, ...sold.map((it) => it.v));
  emit('sell', { total, count: sold.length });
  return total;
}

function pay(price) {
  if (G.money < price) { emit('broke', price); return false; }
  G.money -= price;
  return true;
}
export function buySeed(id) {
  if (inStock(id) <= 0) { emit('nostock', id); return false; }
  if (!pay(CROP[id].price)) return false;
  G.bought.c[id] = (G.bought.c[id] || 0) + 1;
  G.seeds[id] = (G.seeds[id] || 0) + 1;
  emit('buy', { kind: 'seed', id });
  return true;
}
export const expandPrice = () => EXPANSIONS[G.rows - START_ROWS];
export function buyGear(id) {
  if (id === 'can') { if (!pay(CAN_PRICE)) return false; G.cans += CAN_USES; }
  else if (id === 'basket') { if (!pay(basketPrice(G.basket))) return false; G.basket++; }
  else if (id === 'expand') {
    if (G.rows >= ROWS) return false;
    if (!pay(expandPrice())) return false;
    G.rows++;
    emit('expand', G.rows);
  } else if (SPRINKLERS[id]) { if (!pay(SPRINKLERS[id].price)) return false; G.spr[id] = (G.spr[id] || 0) + 1; }
  else return false;
  emit('buy', { kind: 'gear', id });
  return true;
}
export function water(i) {
  const pl = G.plots[i];
  if (!pl || G.cans <= 0) return false;
  G.cans--;
  pl.w = CAN_DUR;
  emit('water', i);
  return true;
}
export function placeSprinkler(i, k) {
  if (!unlocked(i) || !(G.spr[k] > 0)) return false;
  if (G.placed.some((s) => s.i === i)) { emit('toast', 'There is already a sprinkler here.'); return false; }
  G.spr[k]--;
  if (!G.spr[k]) delete G.spr[k];
  G.placed.push({ i, k, t: SPRINKLERS[k].dur });
  emit('sprinkler', { i, k });
  return true;
}
export function dig(i) {
  const pl = G.plots[i];
  if (pl) { G.plots[i] = null; emit('dig', { i, crop: pl.c }); return true; }
  const s = G.placed.findIndex((p) => p.i === i);
  if (s >= 0) { G.placed.splice(s, 1); emit('dig', { i }); return true; }
  return false;
}
export function buyEgg(id) {
  if (G.pets.length + G.eggs.length >= MAX_PETS) { emit('toast', `Pet slots full (${MAX_PETS} max). Release a pet first.`); return false; }
  if (G.eggs.length >= MAX_EGGS) { emit('toast', 'Your nest is full. Wait for an egg to hatch!'); return false; }
  if (!pay(EGG[id].price)) return false;
  G.eggs.push({ id, t: EGG[id].hatch });
  emit('buy', { kind: 'egg', id });
  return true;
}
export function releasePet(idx) {
  const p = G.pets.splice(idx, 1)[0];
  if (p) emit('release', p);
}
export function rollPet(id) {
  const list = EGG[id].pets, tot = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * tot;
  for (const [t, w] of list) if ((r -= w) < 0) return t;
  return list[0][0];
}
