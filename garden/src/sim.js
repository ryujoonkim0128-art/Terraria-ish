// Time passing: growth, fruiting, weather, day and night, and weather mutations.
import { CROP, WEATHER, DAY_LEN, NIGHT_START, NIGHT_END } from './data.js';
import { G, emit, newFruit } from './state.js';
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

let boltIn = 5, moonIn = 8;
export function update(dt, offline = false) {
  G.time += dt;
  if (!offline) {
    const w = G.weather;
    if (w.type !== 'clear') {
      if ((w.left -= dt) <= 0) { w.type = 'clear'; G.nextWeather = 160 + Math.random() * 120; emit('weather', 'clear'); }
    } else if (G.tut >= 6 && (G.nextWeather -= dt) <= 0) {
      const r = Math.random();
      w.type = r < 0.45 ? 'rain' : r < 0.72 ? 'snow' : 'storm';
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
    boltIn = 5 + Math.random() * 7;
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
