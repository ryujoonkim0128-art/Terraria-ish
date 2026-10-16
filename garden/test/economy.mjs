// The economy, simulated. An attentive player starts fresh, picks fruit the moment it ripens, sells at once,
// and always buys the best seed they can afford that is in stock (digging up their weakest plant once the
// garden is full). Restocks, fruit sizes, Gold and Rainbow, rain, snow and lightning are rolled like the game,
// and so is Market Day (the crop of the day sells for triple, the carts sell seeds a quarter off) and stealing (every
// ten minutes they steal the most valuable fruit they can afford from the five gardens next door).
//   node test/economy.mjs [runs]          when each seed first becomes yours, with the values in src/data.js
//   node test/economy.mjs --tune [runs]   find each crop's sell value so the gaps between seeds hit TARGET
//   --casual                               a player who does a round of the garden every half minute and goes to the
//                                          shops every few, instead of collecting, selling and buying the instant they can
//   --no-steal                             a player who never steals
import { CROPS, RARITIES, RESTOCK, MAX_PLANTS, MARKET_LEN, MARKET_GAP, POOLS } from '../src/data.js';

// minutes from one seed to the next, for an attentive player who steals whenever they can: Strawberry comes with the
// tutorial (two carrots pay for it), then 4 more to Blueberry, 9 more to Tulip, and longer and longer after that
export const TARGET = [1, 4, 9, 13, 18, 23, 30, 37, 45, 54, 65, 77, 92, 108];
const DT = 3;
// how the player plays: a round of the garden every `look` seconds (collect and sell everything ripe; ripe fruit
// waits on the plant until then) and a trip to the seed shop every `shop` seconds. 0 means the instant they could.
const PLAYER = process.argv.includes('--casual') ? { look: 30, shop: 150 } : { look: 0, shop: 0 };
const STEAL = !process.argv.includes('--no-steal');
// what fruit next door is worth: the values in src/data.js (fixed while tuning, so the next pass can use this one's)
const REF = CROPS.map((c) => c.value);

function rnd(st) {
  st.r = (st.r + 0x6d2b79f5) >>> 0;
  let t = st.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
// size, then a growth mutation (Rainbow x50, Gold x20); env holds weather mutations as bits
function newFruit(st, p = 0) {
  let s = 0.85 + rnd(st) * 0.35;
  if (rnd(st) < 0.04) s *= 1.4 + rnd(st) * 0.8;
  const g = rnd(st) < 0.001 ? 50 : rnd(st) < 0.006 ? 20 : 1;
  return { p, s, g, env: 0 };
}
const WET = 1, CHILLED = 2, FROZEN = 4, SHOCKED = 8;
function envMult(e) {
  let m = 1;
  if (e & FROZEN) m += 9; else { if (e & WET) m += 1; if (e & CHILLED) m += 1; }
  if (e & SHOCKED) m += 99;
  return m;
}

// A fresh start is $20 and an empty garden. The tutorial takes about a minute: the shop at 10 seconds (two carrots,
// which grow six times faster and always come up a decent size), home to plant them, then the Sell stand at 45.
const TUT = { shop: 10, boost: 20, sell: 45 };
function fresh(seed) {
  const st = { r: seed >>> 0, t: 0, money: 20, hold: 0, plants: [], first: CROPS.map(() => Infinity), per: -1, stock: null, shopAt: 0,
    w: { type: null, left: 0, next: 90 }, bolt: 25, mkt: { next: 70 + 420, left: 0, hot: -1, wares: [] } };
  st.off = rnd(st) * RESTOCK;
  st.first[0] = 0;
  return st;
}
function earn(st, v) { if (st.t < TUT.sell) st.hold += v; else st.money += v; }
function plantSeed(st, k, boost = false) { st.plants.push({ k, g: 0, boost, fr: [], cd: [], spawned: 0 }); }
// Market Day, as src/sim.js runs it: two carts, each with a seed near your best and one a step or two beyond
const TIER = Object.fromEntries(CROPS.map((c, i) => [c.id, i]));
const off = (p) => (p < 100 ? Math.round(p * 0.75) : Math.round((p * 0.75) / 5) * 5);
function openMarket(st, crops) {
  const m = st.mkt;
  m.left = MARKET_LEN;
  m.hot = st.plants.length ? st.plants[(rnd(st) * st.plants.length) | 0].k : 0;
  const at = Math.max(0, ...st.plants.map((p) => p.k), ...crops.map((c, i) => (st.money >= c.price * 0.6 ? i : 0)));
  m.wares = [];
  for (const pool of Object.values(POOLS)) {
    const pick = (lo, hi, not) => {
      const opts = pool.filter((id) => TIER[id] >= lo && TIER[id] <= hi && id !== not);
      return opts.length ? opts[(rnd(st) * opts.length) | 0] : pool.filter((id) => id !== not).sort((a, b) => Math.abs(TIER[a] - at) - Math.abs(TIER[b] - at))[0];
    };
    const a = pick(at - 2, at + 1), b = pick(at + 1, at + 4, a);
    m.wares.push({ k: TIER[a], n: 2 + ((rnd(st) * 2) | 0), price: off(crops[TIER[a]].price) }, { k: TIER[b], n: 1, price: off(crops[TIER[b]].price) });
  }
}
function marketTick(st, crops) {
  const m = st.mkt;
  if (m.left > 0) { if ((m.left -= DT) <= 0) { m.left = 0; m.next = MARKET_GAP; m.wares = []; m.hot = -1; } }
  else if ((m.next -= DT) <= 0) openMarket(st, crops);
}
const sale = (st, k) => (st.mkt.left > 0 && k === st.mkt.hot ? 3 : 1);

// the gardens next door, as src/neighbors.js makes them: a few tiers ahead of yours, some fruit mutated
function garden(st) {
  const top = Math.max(0, ...st.plants.map((p) => p.k)), far = rnd(st) < 0.2, L = Math.min(14, Math.max(far ? 8 : 4, top + (far ? 7 : 3) + Math.floor(rnd(st) * 5)));
  const tiers = [], fruit = [];
  const add = (t, n) => { for (let i = 0; i < n; i++) tiers.push(Math.max(1, Math.min(14, t))); };
  add(L, 1 + Math.floor(rnd(st) * 3)); add(L - 1, 2 + Math.floor(rnd(st) * 3));
  for (let i = 6 + Math.floor(rnd(st) * 4); i--;) add(L - 2 - Math.floor(rnd(st) * 3), 1);
  for (let i = 5 + Math.floor(rnd(st) * 5); i--;) add(1 + Math.floor(rnd(st) * 3), 1);
  for (const t of tiers) for (let i = 0; i < (CROPS[t].n || 1); i++) {
    let s = 0.85 + rnd(st) * 0.35; if (rnd(st) < 0.04) s *= 1.4 + rnd(st) * 0.8;
    const r = rnd(st), g = r < 0.03 ? 50 : r < 0.13 ? 20 : 1, e = rnd(st);
    let m = 1; if (e < 0.05) m += 9; else if (e < 0.27) m += 1; if (rnd(st) < 0.03) m += 99; if (rnd(st) < 0.06) m += rnd(st) < 0.25 ? 3 : 1;
    fruit.push(REF[t] * s * s * g * m);
  }
  return fruit;
}
// walk into one of the gardens next door, pay half the best ripe fruit you can afford there and sell it; that garden
// is replaced by a new one (about seven in ten of a garden's fruit is ripe at any moment)
function steal(st) {
  if (!st.gardens) st.gardens = [0, 1, 2, 3, 4].map(() => garden(st));
  const i = Math.floor(rnd(st) * st.gardens.length);
  let best = -1;
  for (const v of st.gardens[i]) if (v / 2 <= st.money && v > best && rnd(st) < 0.7) best = v;
  if (best < 0) return;
  st.money += best / 2;
  st.gardens[i] = garden(st);
}
function step(st, crops) {
  st.t += DT;
  if (STEAL && st.t >= 120 && Math.floor(st.t / 600) !== Math.floor((st.t - DT) / 600)) steal(st);
  const per = Math.floor((st.t + st.off) / RESTOCK);
  if (per !== st.per) {
    st.per = per;
    st.stock = crops.map((c) => { const r = RARITIES[c.rarity], q = c.qty || r.qty; return rnd(st) < r.chance ? q[0] + Math.floor(rnd(st) * (q[1] - q[0] + 1)) : 0; });
    st.stock[0] = Math.max(st.stock[0], 5); st.stock[1] = Math.max(st.stock[1], 1);
  }
  if (st.hold && st.t >= TUT.sell) { st.money += st.hold; st.hold = 0; }
  if (st.t >= 70) marketTick(st, crops);
  // weather: a spell of rain, snow or storm every four to seven minutes
  const w = st.w;
  if (w.type) { if ((w.left -= DT) <= 0) { w.type = null; w.next = 240 + rnd(st) * 180; } }
  else if ((w.next -= DT) <= 0) { const r = rnd(st); w.type = r < 0.5 ? 'rain' : r < 0.8 ? 'snow' : 'storm'; w.left = 70 + rnd(st) * 40; }
  const fast = w.type === 'rain' || w.type === 'storm' ? 1.5 : 1, pm = 1 - Math.exp(-DT / 45);
  const round = PLAYER.look && Math.floor(st.t / PLAYER.look) !== Math.floor((st.t - DT) / PLAYER.look);
  for (let i = st.plants.length - 1; i >= 0; i--) {
    const pl = st.plants[i], c = crops[pl.k], sp = fast * (pl.boost ? 6 : 1) * DT;
    if (w.type) for (const f of pl.fr) if (f && rnd(st) < pm) {
      if (w.type === 'snow') f.env |= f.env & WET ? FROZEN : CHILLED; else f.env |= f.env & CHILLED ? FROZEN : WET;
    }
    if (!c.multi) {
      if (!pl.fr.length) { pl.fr.push(newFruit(st)); if (pl.big) pl.fr[0].s = Math.max(pl.fr[0].s, 1); }
      if ((pl.g += sp) >= c.grow && (!PLAYER.look || round)) { const f = pl.fr[0]; earn(st, c.value * f.s * f.s * f.g * envMult(f.env) * sale(st, pl.k)); st.plants.splice(i, 1); }
      continue;
    }
    if (pl.g < c.grow) { if ((pl.g += sp) >= c.grow) { pl.fr = new Array(c.n).fill(null); pl.cd = pl.fr.map((_, k) => k * 1.2); } continue; }
    for (let k = 0; k < c.n; k++) {
      const f = pl.fr[k];
      if (!f) { if ((pl.cd[k] -= DT) <= 0) pl.fr[k] = newFruit(st, pl.spawned++ < c.n ? 0.45 : 0); continue; }
      if (f.p < 1) f.p = Math.min(1, f.p + sp / c.regrow);
      if (f.p >= 1 && (!PLAYER.look || round)) { earn(st, c.value * f.s * f.s * f.g * envMult(f.env) * sale(st, pl.k)); pl.fr[k] = null; pl.cd[k] = 2 + rnd(st) * 2; }
    }
  }
  if (w.type === 'storm' && (st.bolt -= DT) <= 0) {
    st.bolt = 25 + rnd(st) * 15;
    if (st.plants.length && rnd(st) < 0.85) for (const f of st.plants[(rnd(st) * st.plants.length) | 0].fr) if (f) f.env |= SHOCKED;
  }
  // shop: the best seed you can afford, from the seed shop or a cart, while there is room (or a weaker plant to dig up)
  if (PLAYER.shop && st.t >= TUT.sell + 20) { if (st.t < st.shopAt) return; st.shopAt = st.t + PLAYER.shop; }
  for (; st.t >= TUT.shop;) {
    let k = crops.length - 1, ware = null;
    for (; k >= 0; k--) {
      ware = st.mkt.wares.find((w) => w.k === k && w.n > 0 && st.money >= w.price) || null;
      if (ware || (st.stock[k] > 0 && st.money >= crops[k].price)) break;
    }
    if (k < 0) break;
    if (st.plants.length >= MAX_PLANTS) {
      let wi = -1, wk = k;
      st.plants.forEach((p, i) => { if (p.k < wk) { wk = p.k; wi = i; } });
      if (wi < 0) { if (ware) ware.n = 0; else st.stock[k] = 0; continue; }
      st.plants.splice(wi, 1);
    }
    if (ware) { st.money -= ware.price; ware.n--; } else { st.money -= crops[k].price; st.stock[k]--; }
    plantSeed(st, k, st.t < TUT.boost);
    if (st.t < TUT.boost) st.plants[st.plants.length - 1].big = true;
    if (st.first[k] === Infinity) st.first[k] = st.t;
  }
}
// run until seed k has been bought (or the clock runs out)
function until(st, crops, k, limit) { while (st.first[k] === Infinity && st.t < limit) step(st, crops); return st; }
const clone = (st) => structuredClone(st);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const mins = (s) => (s / 60).toFixed(1).padStart(6);

const args = process.argv.slice(2), tune = args.includes('--tune'), runs = +(args.find((a) => /^\d+$/.test(a)) || (tune ? 48 : 200));
const crops = CROPS.map((c) => ({ ...c }));
if (tune) {
  // Each crop earns back its own price at a set pace, slower the rarer it is (a strawberry plant in a minute and a half of
  // fruiting, a beanstalk in under five hours); one-harvest crops sell for a little more than their seed. Then, seed by
  // seed, freeze every run at the moment seed k is first bought and search the price of seed k+1 so the median
  // wait for it matches the target (nothing before that moment depends on seed k+1).
  const PAYBACK = { strawberry: 1.5, blueberry: 3, tomato: 20, corn: 32, apple: 55, coconut: 80, dragonfruit: 115, mango: 160, grape: 210, beanstalk: 280 };
  // the first rung is set by hand in src/data.js: two tutorial carrots pay for a Strawberry
  const HAND = Object.fromEntries(['strawberry'].map((id) => [id, CROPS.find((c) => c.id === id)]));
  const ROI = { carrot: 1.5, tulip: 1.2, watermelon: 1.15, pumpkin: 1.12, mushroom: 1.1 };
  const nice = (x) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
  const setPrice = (c, price) => { c.price = nice(price); c.value = nice(c.multi ? (c.price * c.regrow) / (c.n * PAYBACK[c.id] * 60) : c.price * ROI[c.id]); };
  setPrice(crops[0], 10);
  for (const c of crops.slice(1)) { c.price = Infinity; c.value = 0; } // out of reach until their turn
  let snaps = Array.from({ length: runs }, (_, i) => until(fresh(i * 7919 + 17), crops, 0, 0));
  for (let k = 0; k < crops.length - 1; k++) {
    const goal = TARGET[k] * 60, limit = (s) => s.t + goal * 8, next = crops[k + 1];
    const gap = () => median(snaps.map((s0) => { const s = until(clone(s0), crops, k + 1, limit(s0)); return s.first[k + 1] - s0.t; }));
    let lo = Math.log(crops[k].price * 1.5), hi = Math.log(crops[k].price * 2000);
    if (HAND[next.id]) Object.assign(next, { price: HAND[next.id].price, value: HAND[next.id].value });
    else {
      for (let it = 0; it < 14; it++) { const mid = (lo + hi) / 2; setPrice(next, Math.exp(mid)); if (gap() < goal) lo = mid; else hi = mid; }
      setPrice(next, Math.exp((lo + hi) / 2));
    }
    console.log(`${next.name.padEnd(14)} $${String(next.price).padEnd(10)} sells $${String(next.value).padEnd(9)} reached ${mins(gap())} min after ${crops[k].name} (target ${TARGET[k]})`);
    snaps = snaps.map((s0) => until(clone(s0), crops, k + 1, limit(s0)));
  }
  console.log('\nprices:', JSON.stringify(Object.fromEntries(crops.map((c) => [c.id, c.price]))));
  console.log('values:', JSON.stringify(Object.fromEntries(crops.map((c) => [c.id, c.value]))));
} else {
  const all = Array.from({ length: runs }, (_, i) => until(fresh(i * 104729 + 3), crops, crops.length - 1, 60 * 60 * 60).first);
  console.log(`${runs} players, minutes from a fresh start (median, and the middle half of players):\n`);
  let prev = 0;
  crops.forEach((c, k) => {
    const ts = all.map((f) => f[k]).filter(Number.isFinite), m = median(ts), q = (p) => [...ts].sort((a, b) => a - b)[Math.floor(ts.length * p)];
    console.log(`${c.name.padEnd(14)} $${String(c.price).padEnd(10)} ${mins(m)}  (${mins(q(0.25)).trim()}-${mins(q(0.75)).trim()})  +${(((m - prev) / 60).toFixed(1))}`);
    prev = m;
  });
}
