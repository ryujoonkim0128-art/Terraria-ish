// Persistent game state (G), saving, the seed stock, and every player action.
import { CROPS, CROP, RARITIES, RESTOCK, DAY_LEN, BASKET, MAX_PLANTS, fruitValue, inBed } from './data.js';
import { rng, hash } from './voxel.js';

export let G = null;
const subs = {};
export const on = (e, f) => (subs[e] ||= []).push(f);
export const emit = (e, d) => (subs[e] || []).forEach((f) => f(d));

const KEY = 'voxel-garden-save-v2';
export function fresh() {
  return {
    v: 2, seed: (Math.random() * 1e9) | 0,
    money: 20, seeds: { carrot: 5 }, bag: [], plants: [], nextId: 1,
    time: DAY_LEN * 0.1, weather: { type: 'clear', left: 0 }, nextWeather: 200,
    bought: { p: -1, c: {} }, tut: 0, sel: 'seed:carrot',  // tut 7 = tutorial finished
    stats: { harvested: 0, earned: 0, planted: 0, best: 0 },
    mkt: { next: 420, left: 0, hot: null, wares: null },  // Market Day: seconds until it opens, seconds left while open
    sound: true, music: true, saved: Date.now(),
  };
}
export function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  if (!d || d.v !== 2 || !Array.isArray(d.plants)) { G = fresh(); return 0; }
  G = Object.assign(fresh(), d);
  return Math.max(0, Math.min(8 * 3600, (Date.now() - (d.saved || Date.now())) / 1000));
}
// keys starting with _ are per-frame scratch (like fruit positions) and never saved
export function save() { G.saved = Date.now(); try { localStorage.setItem(KEY, JSON.stringify(G, (k, v) => (k[0] === '_' ? undefined : v))); } catch { /* storage blocked */ } }
export function reset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } G = fresh(); emit('reset'); }

// ---------- seed stock (restocks every RESTOCK seconds of real time)
export const period = () => Math.floor(Date.now() / 1000 / RESTOCK);
export const restockIn = () => RESTOCK - ((Date.now() / 1000) % RESTOCK);
const stockCache = { p: -1, seed: 0, s: null };
export function stock() {
  const p = period();
  if (stockCache.p !== p || stockCache.seed !== G.seed) {
    const R = rng(hash(p, 17, G.seed)), s = {};
    for (const c of CROPS) { const r = RARITIES[c.rarity], q = c.qty || r.qty; if (R() < r.chance) s[c.id] = q[0] + Math.floor(R() * (q[1] - q[0] + 1)); }
    s.carrot = Math.max(s.carrot || 0, 5); s.strawberry = Math.max(s.strawberry || 0, 1);
    Object.assign(stockCache, { p, seed: G.seed, s });
  }
  if (G.bought.p !== p) G.bought = { p, c: {} };
  return stockCache.s;
}
export const inStock = (id) => Math.max(0, (stock()[id] || 0) - (G.bought.c[id] || 0));

// ---------- queries
export const ripeCount = (pl) => (pl ? pl.fr.reduce((n, f) => n + (f && f.p >= 1 ? 1 : 0), 0) : 0);
export const totalRipe = () => G.plants.reduce((n, p) => n + ripeCount(p), 0);
// on Market Day one crop sells for triple
export const marketOpen = () => G.mkt.left > 0;
export const sellValue = (it) => it.v * (marketOpen() && it.c === G.mkt.hot ? 3 : 1);
export const bagValue = () => G.bag.reduce((s, it) => s + sellValue(it), 0);
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
  if (Math.random() < 0.001) m.push('rainbow');
  else if (Math.random() < 0.006) m.push('gold');
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
// pick one ripe fruit (slot k) off a plant
export function collect(pl, k) {
  const f = pl && pl.fr[k];
  if (!f || f.p < 1) return null;
  if (G.bag.length >= BASKET) { emit('bagfull'); return null; }
  const c = CROP[pl.c];
  const item = { c: pl.c, kg: +(c.kg * f.s).toFixed(3), m: f.m.slice(), v: fruitValue(pl.c, f.s, f.m), big: f.s > 1.3 };
  const at = pl._fw && pl._fw[k];
  G.bag.push(item);
  G.stats.harvested++;
  if (c.multi) { pl.fr[k] = null; pl.cd[k] = 2 + Math.random() * 2; }
  else G.plants = G.plants.filter((p) => p !== pl);
  emit('collect', { pl, k, item, at, removed: !c.multi });
  return item;
}
export const itemKey = (it) => it.c + '|' + it.m.slice().sort().join(',');
export function sell(filter) {
  const keep = [], sold = [];
  for (const it of G.bag) (filter && itemKey(it) !== filter ? keep : sold).push(it);
  if (!sold.length) return 0;
  const total = sold.reduce((s, it) => s + sellValue(it), 0);
  G.bag = keep;
  G.money += total;
  G.stats.earned += total;
  G.stats.best = Math.max(G.stats.best, ...sold.map(sellValue));
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
// buy from one of the Market Day carts
export function buyWare(cart, i) {
  const w = marketOpen() && G.mkt.wares && G.mkt.wares[cart] && G.mkt.wares[cart][i];
  if (!w) return false;
  if (w.n <= 0) { emit('nostock', w.id); return false; }
  if (G.money < w.price) { emit('broke'); return false; }
  G.money -= w.price;
  w.n--;
  G.seeds[w.id] = (G.seeds[w.id] || 0) + 1;
  emit('buy', w.id);
  return true;
}
export function dig(pl) {
  G.plants = G.plants.filter((p) => p !== pl);
  emit('dig', pl);
}
