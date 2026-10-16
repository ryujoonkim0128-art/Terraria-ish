// The other gardens on the street. Like bases in Clash of Clans, every player's garden is on show for others to
// walk round and steal from; nobody has to be online, it is just the garden. Until there is a server to fetch real
// gardens from, each plot gets a stand-in: an owner's name on the sign and a garden a few crops ahead of yours, with
// some mutated fruit. The rest of the game only reads `neighbors` (one per plot, null while a plot is empty).
import { CROPS, CROP, PLOTS, inRect } from './data.js';
import { G, on, emit, newFruit } from './state.js';

export const neighbors = PLOTS.map(() => null);
const arriveAt = PLOTS.map(() => Infinity);
let clock = 0, nextId = 1e6;
const used = new Set();

const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[(Math.random() * a.length) | 0];
const TIER = Object.fromEntries(CROPS.map((c, i) => [c.id, i]));
const NAMES = ['RobloxEnjoyer', 'xXGardenGodXx', 'bloxy_bean', 'carrotqueen2014', 'Noob_Farmer77', 'TheSheckleKing', 'mangomaster_09', 'ilovepumpkinz',
  'coolkid_4040', 'BeanstalkBoi', 'sunny_sprout', 'PixelPeach', 'KawaiiCabbage', 'lil_blox_farmer', 'frostberry_x', 'tomato_tim', 'BerryBlitz22',
  'x_Strawberry_x', 'rainbowcarrot44', 'DragonFruitDan', 'sprinkle_bun', 'Gr4peJuice', 'ZeroToMango', 'xx_bloom_xx', 'leafy_luca', 'mossy_mae',
  'TurnipTyrant', 'OofOrchard', 'SkyHighSprout', 'melonmaxxer', 'cocoNUTS_99', 'GoldenGourd', 'SirPlantsALot', 'garden_gremlin', 'hazel_nutty',
  'Petal_Pusher', 'choco_carrot', 'ChillCucumber', 'peachy_keen', 'maple_mochi', 'veggie_vibes', 'Sproutling_7', 'MrMoonlit', 'shockedtomato'];

// a garden a few crops ahead of yours, now and then one much further along; the same crops planted together
function make(i, name) {
  if (!name) { const free = NAMES.filter((n) => !used.has(n)); name = pick(free.length ? free : NAMES); }
  used.add(name);
  const R = PLOTS[i], nb = { id: nextId++, name, plot: i, R, plants: [] };
  const top = Math.max(0, ...G.plants.map((p) => TIER[p.c]), ...Object.keys(G.seeds).map((id) => TIER[id]));
  const far = Math.random() < 0.2, L = Math.min(14, Math.max(far ? 8 : 4, top + (far ? 7 : 3) + rint(0, 4)));
  nb.level = L;
  const want = [];
  const add = (tier, n) => { for (let k = 0; k < n; k++) want.push(CROPS[Math.max(1, Math.min(14, tier))].id); };
  add(L, rint(1, 3)); add(L - 1, rint(2, 4));
  for (let k = rint(6, 9); k--;) add(L - rint(2, 4), 1);
  for (let k = rint(5, 9); k--;) add(rint(1, 3), 1);
  const counts = new Map();
  for (const id of want) counts.set(id, (counts.get(id) || 0) + 1);
  for (const [id, n] of counts) {
    const r = CROP[id].r, cx = rnd(R.x0 + 6, R.x1 - 6), cz = rnd(R.z0 + 6, R.z1 - 6);
    for (let k = 0; k < n; k++) for (let tries = 0; tries < 40; tries++) {
      const spread = r * 2 + 3 + tries * 0.4, x = Math.round(cx + rnd(-spread, spread)), z = Math.round(cz + rnd(-spread, spread));
      if (!inRect(R, x, z, r * 0.55 + 1)) continue;
      if (nb.plants.some((p) => Math.hypot(p.x - x, p.z - z) < (r + CROP[p.c].r) * 0.75)) continue;
      nb.plants.push(makePlant(id, x, z));
      break;
    }
  }
  return nb;
}
// grown, mostly ripe, and old enough to show off a few mutations
function showyFruit(p) {
  const f = newFruit(p), r = Math.random(), e = Math.random();
  if (!f.m.length) { if (r < 0.03) f.m.push('rainbow'); else if (r < 0.13) f.m.push('gold'); }
  if (e < 0.05) f.m.push('frozen'); else if (e < 0.2) f.m.push('wet'); else if (e < 0.27) f.m.push('chilled');
  if (Math.random() < 0.03) f.m.push('shocked');
  if (Math.random() < 0.06) f.m.push(Math.random() < 0.25 ? 'bloodlit' : 'moonlit');
  return f;
}
function makePlant(id, x, z) {
  const c = CROP[id];
  const pl = { id: nextId++, c: id, x, z, g: c.grow, v: (Math.random() * 3) | 0, rot: (Math.random() * 4) | 0, fr: [], cd: [] };
  if (!c.multi) pl.fr = [showyFruit(1)];
  else for (let k = 0; k < c.n; k++) { const r = Math.random(); pl.fr[k] = r < 0.12 ? null : showyFruit(r < 0.8 ? 1 : rnd(0.3, 0.9)); pl.cd[k] = rnd(2, 8); }
  return pl;
}

export function init() {
  const first = rint(0, PLOTS.length - 1);
  PLOTS.forEach((_, i) => { neighbors[i] = make(i, i === first ? 'RobloxEnjoyer' : null); });
}
function moveIn(i) { neighbors[i] = make(i); emit('movein', neighbors[i]); }
function moveOut(nb) {
  const i = neighbors.indexOf(nb);
  if (i < 0) return;
  neighbors[i] = null;
  used.delete(nb.name);
  arriveAt[i] = clock + rnd(12, 20);
  emit('moveout', nb);
}
// a garden you steal from moves away, and before long a new one takes the plot
on('steal', ({ owner }) => { if (owner.leave === undefined) owner.leave = 2.5; });

export function update(dt) {
  clock += dt;
  for (let i = 0; i < neighbors.length; i++) {
    const nb = neighbors[i];
    if (!nb) { if (clock >= arriveAt[i]) { arriveAt[i] = Infinity; moveIn(i); } continue; }
    // gardens grow whether or not anyone is looking
    for (const pl of nb.plants) {
      const c = CROP[pl.c];
      if (c.multi) for (let k = 0; k < c.n; k++) {
        const f = pl.fr[k];
        if (!f) { if ((pl.cd[k] -= dt) <= 0) pl.fr[k] = newFruit(0); } else if (f.p < 1) f.p = Math.min(1, f.p + dt / c.regrow);
      }
    }
    if (nb.leave !== undefined && (nb.leave -= dt) <= 0) moveOut(nb);
  }
}
