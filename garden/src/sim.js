// Time passing: growth, fruiting, weather, day/night, mutations, eggs and pet abilities.
import { CROP, CROPS, WEATHER, DAY_LEN, NIGHT_START, NIGHT_END, SPRINKLERS, PETS, EGG } from './data.js';
import { G, emit, newFruit, sprinklerAt, petBonus, rollPet } from './state.js';
import { hash } from './util.js';

export const dayFrac = () => (G.time % DAY_LEN) / DAY_LEN;
export const isNight = () => { const d = dayFrac(); return d >= NIGHT_START && d < NIGHT_END; };
export const nightIndex = () => Math.floor(G.time / DAY_LEN);
export const bloodMoon = () => isNight() && hash(nightIndex(), 3, G.seed) < 0.2;

export function speed(i) {
  const pl = G.plots[i];
  let s = WEATHER[G.weather.type].grow * (1 + petBonus('grow'));
  if (pl && pl.w > 0) s *= 2;
  const sp = sprinklerAt(i);
  if (sp) s *= sp.mult;
  return s;
}

const roll = (rate, dt) => Math.random() < 1 - Math.exp(-rate * dt);
function eachFruit(fn) {
  G.plots.forEach((pl, i) => pl && pl.fr.forEach((f, k) => f && fn(f, i, k, pl)));
}
function addMut(f, m, i, k) {
  if (f.m.includes(m)) return false;
  if (m === 'gold' && f.m.includes('rainbow')) return false;
  if (m === 'rainbow') f.m = f.m.filter((x) => x !== 'gold');
  if (m === 'frozen') f.m = f.m.filter((x) => x !== 'wet' && x !== 'chilled');
  if ((m === 'wet' || m === 'chilled') && f.m.includes('frozen')) return false;
  f.m.push(m);
  emit('mut', { i, k, m });
  return true;
}
function randomFruit(pred) {
  const list = [];
  eachFruit((f, i, k) => { if (pred(f)) list.push({ f, i, k }); });
  return list.length ? list[(Math.random() * list.length) | 0] : null;
}

let boltIn = 4, moonIn = 8;
export function update(dt, offline = false) {
  G.time += dt;
  // weather
  if (!offline) {
    const w = G.weather;
    if (w.type !== 'clear') {
      w.left -= dt;
      if (w.left <= 0) { w.type = 'clear'; G.nextWeather = 150 + Math.random() * 120; emit('weather', 'clear'); }
    } else if ((G.nextWeather -= dt) <= 0) {
      const r = Math.random();
      w.type = r < 0.45 ? 'rain' : r < 0.72 ? 'snow' : 'storm';
      w.left = 70 + Math.random() * 40;
      emit('weather', w.type);
    }
  }
  // sprinklers
  for (const s of G.placed) s.t -= dt;
  if (G.placed.some((s) => s.t <= 0)) {
    for (const s of G.placed) if (s.t <= 0) emit('sprinklerdone', s);
    G.placed = G.placed.filter((s) => s.t > 0);
  }
  // plants
  for (let i = 0; i < G.plots.length; i++) {
    const pl = G.plots[i];
    if (!pl) continue;
    const c = CROP[pl.c], sp = speed(i) * dt;
    if (pl.w > 0) pl.w = Math.max(0, pl.w - dt);
    if (!c.multi) {
      const was = pl.fr[0].p;
      pl.g = Math.min(c.grow, pl.g + sp);
      pl.fr[0].p = pl.g / c.grow;
      if (was < 1 && pl.fr[0].p >= 1) emit('ripe', i);
      continue;
    }
    if (pl.g < c.grow) {
      pl.g = Math.min(c.grow, pl.g + sp);
      if (pl.g >= c.grow) {
        pl.fr = new Array(c.n).fill(null);
        pl.cd = pl.fr.map((_, k) => k * 1.5);
        pl.first = true;
      }
      continue;
    }
    for (let k = 0; k < c.n; k++) {
      const f = pl.fr[k];
      if (!f) {
        pl.cd[k] -= dt;
        if (pl.cd[k] <= 0) pl.fr[k] = newFruit(pl.c, i, pl.first ? 0.45 : 0);
      } else if (f.p < 1) {
        f.p = Math.min(1, f.p + sp / c.regrow);
        if (f.p >= 1) emit('ripe', i);
      }
    }
    if (pl.first && pl.fr.every(Boolean)) pl.first = false;
  }
  // eggs
  for (const e of G.eggs) e.t -= dt;
  const hatched = G.eggs.filter((e) => e.t <= 0);
  if (hatched.length) {
    G.eggs = G.eggs.filter((e) => e.t > 0);
    for (const e of hatched) {
      const type = rollPet(e.id);
      G.pets.push({ type, cd: 10 + Math.random() * 10 });
      emit('hatch', { egg: e.id, type });
    }
  }
  if (offline) return;
  // weather mutations
  const wt = G.weather.type;
  if (wt === 'rain' || wt === 'storm') eachFruit((f, i, k) => { if (roll(1 / 45, dt)) addMut(f, f.m.includes('chilled') ? 'frozen' : 'wet', i, k); });
  if (wt === 'snow') eachFruit((f, i, k) => { if (roll(1 / 45, dt)) addMut(f, f.m.includes('wet') ? 'frozen' : 'chilled', i, k); });
  if (wt === 'storm' && (boltIn -= dt) <= 0) {
    boltIn = 5 + Math.random() * 7;
    const planted = G.plots.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    const i = planted.length && Math.random() < 0.8 ? planted[(Math.random() * planted.length) | 0] : (Math.random() * G.plots.length) | 0;
    emit('lightning', i);
    if (G.plots[i]) G.plots[i].fr.forEach((f, k) => f && addMut(f, 'shocked', i, k));
  }
  if (isNight() && (moonIn -= dt) <= 0) {
    moonIn = 10 + Math.random() * 10;
    const t = randomFruit((f) => f.p >= 1 && !f.m.includes('moonlit') && !f.m.includes('bloodlit'));
    if (t) { addMut(t.f, bloodMoon() ? 'bloodlit' : 'moonlit', t.i, t.k); emit('moonbeam', t.i); }
  }
  // pets
  for (let idx = 0; idx < G.pets.length; idx++) {
    const p = G.pets[idx], d = PETS[p.type];
    const every = d.dig || d.splash || d.pollinate || d.moon || d.goldify || d.rainbowify;
    if (!every) continue;
    if (p.cd === undefined) p.cd = every;
    if ((p.cd -= dt) > 0) continue;
    p.cd = every;
    if (d.dig) {
      const r = Math.random(), crop = r < 0.5 ? 'carrot' : r < 0.8 ? 'strawberry' : r < 0.95 ? 'blueberry' : 'tulip';
      G.seeds[crop] = (G.seeds[crop] || 0) + 1;
      emit('petfx', { idx, kind: 'dig', crop });
      continue;
    }
    let t = null, m = null;
    if (d.splash) { m = 'wet'; t = randomFruit((f) => !f.m.includes('wet') && !f.m.includes('frozen')); }
    if (d.pollinate) { m = 'pollinated'; t = randomFruit((f) => !f.m.includes('pollinated')); }
    if (d.moon) { if (!isNight()) { p.cd = 5; continue; } m = 'moonlit'; t = randomFruit((f) => !f.m.includes('moonlit')); }
    if (d.goldify) { m = 'gold'; t = randomFruit((f) => !f.m.includes('gold') && !f.m.includes('rainbow')); }
    if (d.rainbowify) { m = 'rainbow'; t = randomFruit((f) => !f.m.includes('rainbow')); }
    if (!t) { p.cd = 6; continue; }
    addMut(t.f, m, t.i, t.k);
    emit('petfx', { idx, kind: m, i: t.i });
  }
}

// Catch up on time spent away (no weather while away).
export function catchUp(sec) {
  if (sec < 5) return;
  const before = G.plots.reduce((n, pl) => n + (pl ? pl.fr.filter((f) => f && f.p >= 1).length : 0), 0);
  let left = sec;
  while (left > 0) { const d = Math.min(2, left); update(d, true); left -= d; }
  const after = G.plots.reduce((n, pl) => n + (pl ? pl.fr.filter((f) => f && f.p >= 1).length : 0), 0);
  emit('welcome', { sec, ripe: Math.max(0, after - before) });
}
