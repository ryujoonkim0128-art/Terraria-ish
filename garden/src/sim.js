// Time passing: growth, fruiting, weather, day and night, and weather mutations.
import { CROPS, CROP, WEATHER, DAY_LEN, NIGHT_START, NIGHT_END, MARKET_LEN, MARKET_GAP, POOLS } from './data.js';
import { G, emit, newFruit, tutDone } from './state.js';
import { hash } from './voxel.js';

export const dayFrac = () => (G.time % DAY_LEN) / DAY_LEN;
export const isNight = () => { const d = dayFrac(); return d >= NIGHT_START && d < NIGHT_END; };
export const bloodMoon = () => isNight() && hash(Math.floor(G.time / DAY_LEN), 3, G.seed) < 0.2;
export const speed = (pl) => WEATHER[G.weather.type].grow * (pl && pl.boost ? 6 : 1);

const roll = (rate, dt) => Math.random() < 1 - Math.exp(-rate * dt);
function addMut(f, m, pl) {
  if (f.m.includes(m)) return;
  if (m === 'frozen') f.m = f.m.filter((x) => x !== 'wet' && x !== 'chilled');
  if ((m === 'wet' || m === 'chilled') && f.m.includes('frozen')) return;
  f.m.push(m);
  emit('mut', { pl, f, m });
}

// ---------- Market Day (see data.js)
const tier = (id) => CROPS.findIndex((c) => c.id === id);
function pickHot() {
  const grown = [...G.plants.map((p) => p.c), ...G.bag.map((it) => it.c)];
  if (grown.length) return grown[(Math.random() * grown.length) | 0];
  return ['carrot', 'strawberry', 'blueberry', 'tomato'][(Math.random() * 4) | 0];
}
// one seed near where the player is, one a step or two beyond; a quarter off the shop price
function rollWares(cart) {
  const have = [...G.plants.map((p) => tier(p.c)), ...CROPS.map((c, i) => (G.money >= c.price * 0.6 ? i : 0))];
  const at = Math.max(0, ...have);
  const pool = POOLS[cart];
  const pick = (lo, hi, not) => {
    const opts = pool.filter((id) => tier(id) >= lo && tier(id) <= hi && id !== not);
    return opts.length ? opts[(Math.random() * opts.length) | 0] : pool.filter((id) => id !== not).sort((a, b) => Math.abs(tier(a) - at) - Math.abs(tier(b) - at))[0];
  };
  const a = pick(at - 2, at + 1), b = pick(at + 1, at + 4, a);
  const off = (p) => (p < 100 ? Math.round(p * 0.75) : Math.round((p * 0.75) / 5) * 5);
  const ware = (id, n) => ({ id, n, price: off(CROP[id].price), was: CROP[id].price });
  return [ware(a, 2 + ((Math.random() * 2) | 0)), ware(b, 1)];
}
function marketTick(dt) {
  const m = G.mkt;
  if (m.left > 0) {
    if ((m.left -= dt) <= 0) { m.left = 0; m.next = MARKET_GAP; m.wares = null; emit('market', false); }
  } else if (tutDone()) {
    const was = m.next;
    m.next -= dt;
    if (was > 30 && m.next <= 30) emit('marketSoon');
    if (m.next <= 0) { m.left = MARKET_LEN; m.hot = pickHot(); m.wares = { veg: rollWares('veg'), berry: rollWares('berry') }; emit('market', true); }
  }
}

let boltIn = 20, moonIn = 8;
export function update(dt, offline = false) {
  G.time += dt;
  if (!offline) {
    marketTick(dt);
    const w = G.weather;
    if (w.type !== 'clear') {
      if ((w.left -= dt) <= 0) { w.type = 'clear'; G.nextWeather = 240 + Math.random() * 180; emit('weather', 'clear'); }
    } else if (tutDone() && (G.nextWeather -= dt) <= 0) {
      const r = Math.random();
      w.type = r < 0.5 ? 'rain' : r < 0.8 ? 'snow' : 'storm';
      w.left = 70 + Math.random() * 40;
      emit('weather', w.type);
    }
  }
  for (const pl of G.plants) {
    const c = CROP[pl.c], sp = speed(pl) * dt;
    if (!c.multi) {
      const f = pl.fr[0], was = f.p;
      pl.g = Math.min(c.grow, pl.g + sp);
      f.p = pl.g / c.grow;
      if (was < 1 && f.p >= 1) emit('ripe', pl);
      continue;
    }
    if (pl.g < c.grow) {
      pl.g = Math.min(c.grow, pl.g + sp);
      if (pl.g >= c.grow) { pl.fr = new Array(c.n).fill(null); pl.cd = pl.fr.map((_, k) => k * 1.2); pl.first = true; }
      continue;
    }
    for (let k = 0; k < c.n; k++) {
      const f = pl.fr[k];
      if (!f) { if ((pl.cd[k] -= dt) <= 0) pl.fr[k] = newFruit(pl.first ? 0.45 : 0); }
      else if (f.p < 1) { f.p = Math.min(1, f.p + sp / c.regrow); if (f.p >= 1) emit('ripe', pl); }
    }
    if (pl.first && pl.fr.every(Boolean)) pl.first = false;
  }
  if (offline) return;
  const wt = G.weather.type;
  const each = (fn) => { for (const pl of G.plants) for (const f of pl.fr) if (f) fn(f, pl); };
  if (wt === 'rain' || wt === 'storm') each((f, pl) => { if (roll(1 / 45, dt)) addMut(f, f.m.includes('chilled') ? 'frozen' : 'wet', pl); });
  if (wt === 'snow') each((f, pl) => { if (roll(1 / 45, dt)) addMut(f, f.m.includes('wet') ? 'frozen' : 'chilled', pl); });
  if (wt === 'storm' && (boltIn -= dt) <= 0) {
    boltIn = 25 + Math.random() * 15;
    const pl = G.plants.length && Math.random() < 0.85 ? G.plants[(Math.random() * G.plants.length) | 0] : null;
    emit('lightning', pl ? { x: pl.x, z: pl.z, pl } : { x: (Math.random() - 0.5) * 50, z: (Math.random() - 0.5) * 50 });
    if (pl) pl.fr.forEach((f) => f && addMut(f, 'shocked', pl));
  }
  if (isNight() && (moonIn -= dt) <= 0) {
    moonIn = 10 + Math.random() * 10;
    const list = [];
    each((f, pl) => { if (f.p >= 1 && !f.m.includes('moonlit') && !f.m.includes('bloodlit')) list.push([f, pl]); });
    if (list.length) { const [f, pl] = list[(Math.random() * list.length) | 0]; addMut(f, bloodMoon() ? 'bloodlit' : 'moonlit', pl); emit('moonbeam', pl); }
  }
}

export function catchUp(sec) {
  if (sec < 5) return;
  const ripe = () => G.plants.reduce((n, p) => n + p.fr.filter((f) => f && f.p >= 1).length, 0);
  const before = ripe();
  let left = sec;
  while (left > 0) { const d = Math.min(2, left); update(d, true); left -= d; }
  emit('welcome', { sec, ripe: Math.max(0, ripe() - before) });
}
