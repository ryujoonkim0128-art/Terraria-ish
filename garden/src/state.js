// Persistent game state (G), saving, the seed stock, and every player action.
import { CROPS, CROP, RARITIES, RESTOCK, DAY_LEN, BASKET, MAX_PLANTS, fruitValue, inBed } from './data.js';
import { rng, hash } from './voxel.js';

export let G = null;
const subs = {};
export const on = (e, f) => (subs[e] ||= []).push(f);
export const emit = (e, d) => (subs[e] || []).forEach((f) => f(d));

const KEY = 'voxel-garden-save-v1';
export function fresh() {
  return {
    v: 1, seed: (Math.random() * 1e9) | 0,
    money: 20, seeds: { carrot: 5 }, bag: [], plants: [], nextId: 1,
    time: DAY_LEN * 0.1, weather: { type: 'clear', left: 0 }, nextWeather: 200,
    bought: { p: -1, c: {} }, tut: 0, sel: 'seed:carrot',
    stats: { harvested: 0, earned: 0, planted: 0, best: 0 },
    sound: true, music: true, saved: Date.now(),
  };
}
export function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  if (!d || d.v !== 1 || !Array.isArray(d.plants)) { G = fresh(); return 0; }
  G = Object.assign(fresh(), d);
  return Math.max(0, Math.min(8 * 3600, (Date.now() - (d.saved || Date.now())) / 1000));
}
export function save() { G.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(G)); } catch { /* storage blocked */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } G = fresh(); emit('reset'); }

// ---------- seed stock (restocks every RESTOCK seconds of real time)
export const period = () => Math.floor(Date.now() / 1000 / RESTOCK);
export const restockIn = () => RESTOCK - ((Date.now() / 1000) % RESTOCK);
const stockCache = { p: -1, seed: 0, s: null };
export function stock() {
  const p = period();
  if (stockCache.p !== p || stockCache.seed !== G.seed) {
    const R = rng(hash(p, 17, G.seed)), s = {};
    for (const c of CROPS) { const r = RARITIES[c.rarity]; if (R() < r.chance) s[c.id] = r.qty[0] + Math.floor(R() * (r.qty[1] - r.qty[0] + 1)); }
    s.carrot = Math.max(s.carrot || 0, 6); s.strawberry = Math.max(s.strawberry || 0, 2);
    Object.assign(stockCache, { p, seed: G.seed, s });
  }
  if (G.bought.p !== p) G.bought = { p, c: {} };
  return stockCache.s;
}
export const inStock = (id) => Math.max(0, (stock()[id] || 0) - (G.bought.c[id] || 0));

// ---------- queries
export const ripeCount = (pl) => (pl ? pl.fr.reduce((n, f) => n + (f && f.p >= 1 ? 1 : 0), 0) : 0);
export const totalRipe = () => G.plants.reduce((n, p) => n + ripeCount(p), 0);
export const bagValue = () => G.bag.reduce((s, it) => s + it.v, 0);
export const plantById = (id) => G.plants.find((p) => p.id === id);
// Can a crop go at (x, z)? Returns null if fine, else a reason.
export function placeBlock(crop, x, z) {
  const r = CROP[crop].r;
  if (!inBed(x, z, r * 0.55)) return 'edge';
  for (const p of G.plants) {
    const need = (r + CROP[p.c].r) * 0.62;
    if (Math.hypot(p.x - x, p.z - z) < need) return 'crowded';
  }
  if (G.plants.length >= MAX_PLANTS) return 'full';
  return null;
}

export function newFruit(p = 0) {
  let size = 0.85 + Math.random() * 0.35;
  if (Math.random() < 0.04) size *= 1.4 + Math.random() * 0.8;
  const m = [];
  if (Math.random() < 0.0025) m.push('rainbow');
  else if (Math.random() < 0.012) m.push('gold');
  return { p, s: +size.toFixed(3), m };
}

// ---------- actions
export function plant(crop, x, z) {
  if (!(G.seeds[crop] > 0) || placeBlock(crop, x, z)) return null;
  G.seeds[crop]--;
  if (!G.seeds[crop]) delete G.seeds[crop];
  const c = CROP[crop];
  const pl = { id: G.nextId++, c: crop, x, z, g: 0, v: (Math.random() * 3) | 0, rot: (Math.random() * 4) | 0, fr: c.multi ? [] : [newFruit()], cd: [] };
  G.plants.push(pl);
  G.stats.planted++;
  emit('plant', pl);
  return pl;
}
export function harvest(pl) {
  if (!pl) return [];
  const c = CROP[pl.c], got = [];
  for (let k = 0; k < pl.fr.length; k++) {
    const f = pl.fr[k];
    if (!f || f.p < 1) continue;
    if (G.bag.length >= BASKET) { emit('bagfull'); break; }
    const item = { c: pl.c, kg: +(c.kg * f.s).toFixed(3), m: f.m.slice(), v: fruitValue(pl.c, f.s, f.m), big: f.s > 1.3 };
    G.bag.push(item);
    got.push({ item, slot: k });
    if (c.multi) { pl.fr[k] = null; pl.cd[k] = 2 + Math.random() * 2; }
  }
  if (got.length) {
    G.stats.harvested += got.length;
    if (!c.multi) G.plants = G.plants.filter((p) => p !== pl);
    emit('harvest', { pl, got, removed: !c.multi });
  }
  return got;
}
export function harvestAll() {
  const out = [];
  for (const pl of [...G.plants]) {
    if (G.bag.length >= BASKET) { emit('bagfull'); break; }
    if (ripeCount(pl)) out.push(...harvest(pl));
  }
  return out;
}
export const itemKey = (it) => it.c + '|' + it.m.slice().sort().join(',');
export function sell(filter) {
  const keep = [], sold = [];
  for (const it of G.bag) (filter && itemKey(it) !== filter ? keep : sold).push(it);
  if (!sold.length) return 0;
  const total = sold.reduce((s, it) => s + it.v, 0);
  G.bag = keep;
  G.money += total;
  G.stats.earned += total;
  G.stats.best = Math.max(G.stats.best, ...sold.map((it) => it.v));
  emit('sell', { total, count: sold.length });
  return total;
}
export function buySeed(id) {
  if (inStock(id) <= 0) { emit('nostock', id); return false; }
  if (G.money < CROP[id].price) { emit('broke'); return false; }
  G.money -= CROP[id].price;
  G.bought.c[id] = (G.bought.c[id] || 0) + 1;
  G.seeds[id] = (G.seeds[id] || 0) + 1;
  emit('buy', id);
  return true;
}
export function dig(pl) {
  G.plants = G.plants.filter((p) => p !== pl);
  emit('dig', pl);
}
