// Game state and rules: planting, growth, weather mutations, shops, selling, pets, eggs, gear, saving.
import { TILE, CROPS, CROP, VARIANTS, MUTATIONS, WEATHER, GEAR, GEARMAP, EGGS, EGGMAP, PETS, RARITY, START_SHECKLES, BACKPACK_CAP, INV_SLOTS, MAX_PETS, MAX_EGGS, SEED_RESTOCK, GEAR_RESTOCK, EGG_RESTOCK, DAY_LEN, NIGHT_AT } from './content.js';
import { World, MW, MH } from './world.js';
import { chance, weighted, clamp, lerp } from './rng.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';

export const VW = 480, VH = 270;
const SAVE_KEY = 'grow-garden-v1';
let uidCounter = 1;
const uid = () => (uidCounter++) + '-' + Math.random().toString(36).slice(2, 7);

const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export function fruitValue(f) {
  const c = CROP[f.crop];
  const wr = Math.max(1, f.w / c.weight);
  let mm = 1; for (const m of f.muts) mm += MUTATIONS[m].mult - 1;
  return Math.round(c.value * wr * wr * VARIANTS[f.variant].mult * mm);
}
export function fruitName(f) {
  const parts = [];
  if (f.variant !== 'Normal') parts.push(f.variant);
  for (const m of f.muts) parts.push(m);
  parts.push(CROP[f.crop].name);
  return parts.join(' ');
}
export function fmt(n) {
  n = Math.round(n);
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 100000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString('en-US');
}
export function fmtTime(s) { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s % 60).padStart(2, '0')}`; }

function rollStock(list) {
  const stock = {};
  for (const it of list) { const [p, a, b] = it.stock; if (Math.random() < p) stock[it.id] = a + Math.floor(Math.random() * (b - a + 1)); }
  return stock;
}

export class Game {
  constructor(view, hud, saved) {
    this.view = view; this.hud = hud;
    this.world = new World(7);
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, click: null, rclick: null, wheel: 0 };
    this.cam = { x: 0, y: 0 };
    this.toasts = [];
    this.particles = [];
    this.floaters = [];
    this.fx = [];           // lightning / meteor / bee events
    this.flash = 0;
    this.shake = 0;
    this.t = 0;
    this.fps = 0;
    this.muted = false;
    this.carried = null;    // plant picked up with the trowel
    this.selected = 0;
    this.fast = false;
    this.player = { x: this.world.spawn.x, y: this.world.spawn.y, dir: 'down', frame: 0, anim: 0, moving: false };
    this.s = saved ? saved.state : this.freshState();
    if (saved?.player) { this.player.x = saved.player.x; this.player.y = saved.player.y; }
    this.sfx = new Sfx();
    this.renderer = new Renderer(this);
    this.ui = new UI(this);
    if (saved) this.applyOffline(saved);
    this.saveT = 15;
  }

  freshState() {
    return {
      sheckles: START_SHECKLES, time: DAY_LEN * 0.08, bloodMoon: false,
      weather: null, nextEvent: 60 + Math.random() * 90,
      shops: { seeds: { stock: rollStock(CROPS), left: SEED_RESTOCK }, gear: { stock: rollStock(GEAR), left: GEAR_RESTOCK }, eggs: { stock: rollStock(EGGS), left: EGG_RESTOCK } },
      plants: [], objects: [], inv: new Array(INV_SLOTS).fill(null), backpack: [], pets: [],
      stats: { earned: 0, harvested: 0, sold: 0, best: null, hatched: 0 },
      welcomed: false,
    };
  }

  // ------------------------------------------------------------------ helpers
  get isNight() { return (this.s.time % DAY_LEN) / DAY_LEN >= NIGHT_AT; }
  get dayFrac() { return (this.s.time % DAY_LEN) / DAY_LEN; }
  plantAt(tx, ty) { return this.s.plants.find((p) => p.tx === tx && p.ty === ty) || null; }
  objectAt(tx, ty) { return this.s.objects.find((o) => o.tx === tx && o.ty === ty) || null; }
  toast(text, color = '#fff') { const same = this.toasts.find((t) => t.text === text); if (same) { same.t = 4.5; return; } this.toasts.push({ text, color, t: 4.5 }); if (this.toasts.length > 6) this.toasts.shift(); }
  floater(x, y, text, col = '#ffe680') { if (this.floaters.length > 14) this.floaters.shift(); this.floaters.push({ x, y, text, col, life: 1.4 }); }
  burst(x, y, col, n = 8, speed = 40) { if (this.particles.length > 500) return; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random()); this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.5 + Math.random() * 0.5, col: Array.isArray(col) ? col[i % col.length] : col, g: 60 }); } }
  equippedPets() { return this.s.pets.filter((p) => p.equipped); }
  petMult(type) { let m = 1; for (const p of this.equippedPets()) { const a = PETS[p.id].ability; if (a.type === type && p.hunger > 0) m += a.mult - 1; } return m; }
  petChance(type) { let c = 0; for (const p of this.equippedPets()) { const a = PETS[p.id].ability; if (a.type === type && p.hunger > 0) c += a.chance; } return c; }
  hatchBonus() { let b = 0; for (const p of this.equippedPets()) { const a = PETS[p.id].ability; if (a.type === 'hatchSpeed' && p.hunger > 0) b += a.bonus; } return b; }
  sprinklersAt(tx, ty) { return this.s.objects.filter((o) => o.type === 'sprinkler' && Math.hypot(o.tx - tx, o.ty - ty) <= GEARMAP[o.id].spr.r); }
  aurasAt(tx, ty, type) { return this.equippedPets().filter((p) => p.aura && p.aura.type === type && Math.hypot(p.x / TILE - 0.5 - tx, p.y / TILE - 0.5 - ty) <= p.aura.r); }
  growthMult(tx, ty) {
    let m = 1;
    for (const o of this.sprinklersAt(tx, ty)) m = Math.max(m, GEARMAP[o.id].spr.growth);
    for (const p of this.aurasAt(tx, ty, 'growthAura')) m *= p.aura.mult;
    const w = this.s.weather && WEATHER[this.s.weather.id].growth;
    if (w) m *= w;
    return m;
  }
  mutMult(tx, ty) {
    let m = 1;
    for (const o of this.sprinklersAt(tx, ty)) m = Math.max(m, GEARMAP[o.id].spr.mut);
    for (const p of this.aurasAt(tx, ty, 'mutAura')) m *= p.aura.mult;
    return m;
  }
  sizeRate(tx, ty) {
    let r = 0;
    for (const o of this.sprinklersAt(tx, ty)) r = Math.max(r, GEARMAP[o.id].spr.size);
    for (const p of this.aurasAt(tx, ty, 'nap')) r += p.aura.size;
    return r;
  }

  // ------------------------------------------------------------------ inventory
  addItem(kind, id, n = 1) {
    const inv = this.s.inv;
    let slot = inv.find((s) => s && s.kind === kind && s.id === id);
    if (slot) { slot.n += n; return true; }
    const i = inv.indexOf(null);
    if (i < 0) return false;
    inv[i] = { kind, id, n, uses: kind === 'gear' ? (GEARMAP[id].uses || 0) : 0 };
    return true;
  }
  removeItem(slot, n = 1) {
    const inv = this.s.inv, i = inv.indexOf(slot);
    slot.n -= n; if (slot.n <= 0 && i >= 0) inv[i] = null;
  }
  useGear(slot) {
    const g = GEARMAP[slot.id];
    if (!g.uses) return;
    slot.uses -= 1;
    if (slot.uses <= 0) { this.removeItem(slot, 1); if (slot.n > 0) slot.uses = g.uses; else this.toast(`${g.name} used up.`, '#ffb0b0'); }
  }
  held() { return this.s.inv[this.selected]; }

  // ------------------------------------------------------------------ shops
  buy(shop, id, n = 1) {
    const st = this.s.shops[shop];
    const def = shop === 'seeds' ? CROP[id] : shop === 'gear' ? GEARMAP[id] : EGGMAP[id];
    const have = st.stock[id] || 0;
    n = Math.min(n, have);
    if (n <= 0) { this.toast('Sold out! Wait for the restock.', '#ffb0b0'); return false; }
    n = Math.min(n, Math.floor(this.s.sheckles / def.price));
    if (n <= 0) { this.toast(`Not enough Sheckles. Need ¢${fmt(def.price)}.`, '#ffb0b0'); this.sfx.play('deny'); return false; }
    const kind = shop === 'seeds' ? 'seed' : shop === 'gear' ? 'gear' : 'egg';
    if (!this.addItem(kind, id, n)) { this.toast('Inventory full!', '#ffb0b0'); this.sfx.play('deny'); return false; }
    this.s.sheckles -= def.price * n;
    st.stock[id] = have - n;
    this.sfx.play('buy');
    this.toast(`Bought ${n}x ${def.name}${kind === 'seed' ? ' seed' : ''} for ¢${fmt(def.price * n)}`, '#c8ffc0');
    return true;
  }
  restock(shop) {
    const st = this.s.shops[shop];
    st.stock = rollStock(shop === 'seeds' ? CROPS : shop === 'gear' ? GEAR : EGGS);
    st.left = shop === 'seeds' ? SEED_RESTOCK : shop === 'gear' ? GEAR_RESTOCK : EGG_RESTOCK;
    this.toast(`${shop === 'seeds' ? 'Seed' : shop === 'gear' ? 'Gear' : 'Egg'} shop restocked!`, '#ffe680');
    const rare = Object.keys(st.stock).map((id) => shop === 'seeds' ? CROP[id] : null).filter((c) => c && RARITY[c.rarity].order >= 4);
    if (rare.length) this.toast(`${rare.map((c) => c.name).join(', ')} in stock!`, '#ffa3e8');
  }
  sellFruit(f) {
    const v = fruitValue(f);
    this.s.sheckles += v; this.s.stats.earned += v; this.s.stats.sold++;
    const i = this.s.backpack.indexOf(f); if (i >= 0) this.s.backpack.splice(i, 1);
    if (Math.random() < this.petChance('refundSell')) { this.s.backpack.push({ ...f, uid: uid() }); this.toast(`Your monkey refunded a ${fruitName(f)}!`, '#ffe680'); }
    return v;
  }
  sellAll() {
    const list = this.s.backpack.filter((f) => !f.fav);
    if (!list.length) { this.toast('Nothing to sell.', '#ffb0b0'); return 0; }
    let total = 0; for (const f of list) total += this.sellFruit(f);
    this.sfx.play('sell');
    this.toast(`Sold ${list.length} crops for ¢${fmt(total)}!`, '#ffe680');
    this.floater(this.player.x, this.player.y - 24, `+¢${fmt(total)}`);
    return total;
  }

  // ------------------------------------------------------------------ farming
  newFruit(plant) {
    const c = CROP[plant.crop];
    const w = c.weight * Math.exp(gauss() * 0.18) * (1 + plant.size);
    return { uid: uid(), crop: plant.crop, w: Math.round(w * 100) / 100, variant: plant.variant, muts: [], fav: plant.fav };
  }
  plantSeed(tx, ty, slot) {
    if (!this.world.isSoil(tx, ty)) { this.toast('Plant on the soil beds.', '#ffb0b0'); return false; }
    if (this.plantAt(tx, ty) || this.objectAt(tx, ty)) { this.toast('That spot is taken.', '#ffb0b0'); return false; }
    const c = CROP[slot.id];
    let variant = 'Normal';
    let gold = 0.01, rainbow = 0.001;
    for (const p of this.aurasAt(tx, ty, 'variantAura')) { gold += p.aura.gold; rainbow += p.aura.rainbow; }
    const mm = this.mutMult(tx, ty); gold *= mm; rainbow *= mm;
    const r = Math.random();
    if (r < rainbow) variant = 'Rainbow'; else if (r < rainbow + gold) variant = 'Gold';
    const plant = { uid: uid(), tx, ty, crop: slot.id, progress: 0, variant, size: 0, fruits: [], regrow: [], fav: false, water: 0, ripe: false };
    this.s.plants.push(plant);
    if (Math.random() < this.petChance('seedSave')) this.toast('Your pet saved the seed!', '#c8ffc0'); else this.removeItem(slot, 1);
    this.sfx.play('plant');
    this.burst(tx * TILE + 8, ty * TILE + 12, ['#8a5a2a', '#6a4a2a', '#a07a4a'], 6, 25);
    if (variant !== 'Normal') { this.toast(`A ${variant} ${c.name} was planted!`, VARIANTS[variant].color); this.sfx.play('rare'); }
    return true;
  }
  ripen(plant) {
    const c = CROP[plant.crop];
    plant.ripe = true; plant.progress = 1;
    plant.fruits = []; plant.regrow = [];
    for (let i = 0; i < c.fruits; i++) { plant.fruits.push(this.newFruit(plant)); plant.regrow.push(0); }
  }
  harvest(plant, i, quiet) {
    const c = CROP[plant.crop];
    const f = plant.fruits[i];
    if (!f) return false;
    if (this.s.backpack.length >= BACKPACK_CAP) { this.toast('Backpack full! Sell some crops.', '#ffb0b0'); return false; }
    this.s.backpack.push(f);
    this.s.stats.harvested++;
    const v = fruitValue(f);
    if (!this.s.stats.best || v > this.s.stats.best.value) this.s.stats.best = { name: fruitName(f), value: v, w: f.w };
    if (Math.random() < this.petChance('dupeHarvest') && this.s.backpack.length < BACKPACK_CAP) { this.s.backpack.push({ ...f, uid: uid() }); this.toast('Your pet doubled the harvest!', '#ffe680'); }
    if (c.multi) { plant.fruits[i] = null; plant.regrow[i] = c.grow * 0.3; }
    else { this.s.plants.splice(this.s.plants.indexOf(plant), 1); }
    const px = plant.tx * TILE + 8, py = plant.ty * TILE + 8;
    this.burst(px, py - 6, [c.pal.fruit, c.pal.fruit2 || '#fff', '#fff'], 8, 35);
    if (!quiet) { this.floater(px, py - 18, `${fruitName(f)} ${f.w.toFixed(2)}kg`, f.muts.length || f.variant !== 'Normal' ? '#ffa3e8' : '#ffffff'); this.sfx.play(f.muts.length || f.variant !== 'Normal' ? 'rare' : 'harvest'); }
    return true;
  }
  harvestArea(tx, ty) {
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const p = this.plantAt(tx + dx, ty + dy); if (!p || !p.ripe) continue;
      for (let i = p.fruits.length - 1; i >= 0; i--) if (p.fruits[i] && this.harvest(p, i, true)) n++;
    }
    if (n) { this.sfx.play('harvest'); this.floater(tx * TILE + 8, ty * TILE - 6, `Harvested ${n}`); }
    return n;
  }
  applyMut(f, m) {
    const has = (x) => f.muts.includes(x), rm = (x) => { const i = f.muts.indexOf(x); if (i >= 0) f.muts.splice(i, 1); };
    if (m === 'Wet') { if (has('Frozen')) return false; if (has('Chilled')) { rm('Chilled'); f.muts.push('Frozen'); return true; } if (has('Wet')) return false; f.muts.push('Wet'); return true; }
    if (m === 'Chilled') { if (has('Frozen')) return false; if (has('Wet')) { rm('Wet'); f.muts.push('Frozen'); return true; } if (has('Chilled')) return false; f.muts.push('Chilled'); return true; }
    if (m === 'Frozen') { if (has('Frozen')) return false; rm('Wet'); rm('Chilled'); f.muts.push('Frozen'); return true; }
    if (has(m)) return false;
    f.muts.push(m); return true;
  }
  mutatePlant(plant, m, loud) {
    let n = 0;
    for (const f of plant.fruits) if (f && this.applyMut(f, m)) n++;
    if (n) {
      const col = MUTATIONS[m].color;
      this.burst(plant.tx * TILE + 8, plant.ty * TILE + 4, [col, '#ffffff'], 10, 30);
      if (loud) { this.floater(plant.tx * TILE + 8, plant.ty * TILE - 10, m + '!', col); this.sfx.play('mutate'); }
    }
    return n;
  }
  randomRipePlant(filter) {
    const list = this.s.plants.filter((p) => p.ripe && p.fruits.some(Boolean) && (!filter || filter(p)));
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  // ------------------------------------------------------------------ world interaction
  useOn(tx, ty) {
    const w = this.world;
    if (!w.inMap(tx, ty)) return;
    const slot = this.held();
    const plant = this.plantAt(tx, ty), obj = this.objectAt(tx, ty);
    if (this.carried) {
      if (!w.isSoil(tx, ty) || plant || obj) { this.toast('Place the plant on empty soil.', '#ffb0b0'); return; }
      this.carried.tx = tx; this.carried.ty = ty; this.s.plants.push(this.carried); this.carried = null; this.sfx.play('plant'); return;
    }
    if (obj && obj.type === 'egg' && !slot) { this.toast(`${EGGMAP[obj.id].name}: hatches in ${fmtTime(obj.left)}`, '#ffe680'); return; }
    if (obj && obj.type === 'sprinkler' && !slot) { this.toast(`${GEARMAP[obj.id].name}: ${fmtTime(obj.left)} left`, '#ffe680'); return; }
    if (!slot || slot.kind === 'seed' || slot.kind === 'egg') {
      if (plant && plant.ripe && plant.fruits.some(Boolean)) {
        const i = plant.fruits.findIndex(Boolean); this.harvest(plant, i); return;
      }
      if (slot?.kind === 'seed') { this.plantSeed(tx, ty, slot); return; }
      if (slot?.kind === 'egg') { this.placeEgg(tx, ty, slot); return; }
      if (plant) { const c = CROP[plant.crop]; this.toast(`${plant.variant !== 'Normal' ? plant.variant + ' ' : ''}${c.name}: ${plant.ripe ? 'regrowing' : Math.floor(plant.progress * 100) + '% grown'}`, '#ffe680'); }
      return;
    }
    const g = GEARMAP[slot.id];
    if (slot.id === 'wateringcan') {
      if (!plant) { this.toast('Water a plant.', '#ffb0b0'); return; }
      if (plant.ripe) { for (let i = 0; i < plant.regrow.length; i++) if (!plant.fruits[i]) plant.regrow[i] = Math.max(0, plant.regrow[i] - CROP[plant.crop].grow * 0.1); }
      else plant.progress = Math.min(1, plant.progress + 0.2);
      plant.water = 12; this.useGear(slot); this.sfx.play('water');
      for (let i = 0; i < 10; i++) this.particles.push({ x: tx * TILE + 2 + Math.random() * 12, y: ty * TILE - 6 - Math.random() * 6, vx: (Math.random() - 0.5) * 10, vy: 30 + Math.random() * 30, life: 0.5, col: '#8fd0ff', g: 80 });
      return;
    }
    if (slot.id === 'trowel') {
      if (!plant) { this.toast('Dig up a plant to move it.', '#ffb0b0'); return; }
      if (plant.fav) { this.toast('That plant is favorited.', '#ffb0b0'); return; }
      this.s.plants.splice(this.s.plants.indexOf(plant), 1); this.carried = plant; this.useGear(slot); this.sfx.play('plant');
      this.toast('Click empty soil to replant.', '#ffe680'); return;
    }
    if (slot.id === 'favtool') {
      if (!plant) { this.toast('Favorite a plant.', '#ffb0b0'); return; }
      plant.fav = !plant.fav; for (const f of plant.fruits) if (f) f.fav = plant.fav;
      this.floater(tx * TILE + 8, ty * TILE - 8, plant.fav ? '★ Favorited' : 'Unfavorited', '#ffd23f'); this.sfx.play('click'); return;
    }
    if (slot.id === 'harvesttool') { if (!this.harvestArea(tx, ty)) this.toast('Nothing ripe here.', '#ffb0b0'); return; }
    if (slot.id === 'cleanspray') {
      if (!plant || !plant.fruits.some((f) => f && f.muts.length)) { this.toast('No mutations to clean.', '#ffb0b0'); return; }
      for (const f of plant.fruits) if (f) f.muts = [];
      this.useGear(slot); this.burst(tx * TILE + 8, ty * TILE + 4, '#c8ffc0', 10, 30); this.sfx.play('water'); return;
    }
    if (g.spr || slot.id === 'rod') {
      if (!w.isPlaceable(tx, ty) || plant || obj) { this.toast('Place it on a free spot inside the garden.', '#ffb0b0'); return; }
      if (g.spr) this.s.objects.push({ type: 'sprinkler', id: slot.id, tx, ty, left: g.spr.life });
      else this.s.objects.push({ type: 'rod', id: 'rod', tx, ty, charges: 3 });
      this.removeItem(slot, 1); this.sfx.play('place'); return;
    }
    if (slot.id === 'wrench') { const st = this.world.stalls[1]; this.player.x = st.x0 * TILE + 40; this.player.y = (st.y0 + 4) * TILE; this.removeItem(slot, 1); this.sfx.play('rare'); this.burst(this.player.x, this.player.y, '#8ad6ff', 12, 50); return; }
  }
  placeEgg(tx, ty, slot) {
    if (!this.world.isPlaceable(tx, ty) || this.plantAt(tx, ty) || this.objectAt(tx, ty)) { this.toast('Place eggs on a free spot inside the garden.', '#ffb0b0'); return; }
    if (this.s.objects.filter((o) => o.type === 'egg').length >= MAX_EGGS) { this.toast(`Only ${MAX_EGGS} eggs can hatch at once.`, '#ffb0b0'); return; }
    this.s.objects.push({ type: 'egg', id: slot.id, tx, ty, left: EGGMAP[slot.id].hatch });
    this.removeItem(slot, 1); this.sfx.play('place');
  }
  hatch(obj) {
    const e = EGGMAP[obj.id];
    const id = weighted(Math.random, e.pets);
    const pet = { uid: uid(), id, name: PETS[id].name, xp: 0, hunger: 100, equipped: this.equippedPets().length < MAX_PETS, x: obj.tx * TILE + 8, y: obj.ty * TILE + 12, cd: PETS[id].ability.cd || 0, aura: null, tgt: null, idle: 1, frame: 0, flip: false };
    this.s.pets.push(pet);
    this.s.objects.splice(this.s.objects.indexOf(obj), 1);
    this.s.stats.hatched++;
    this.burst(pet.x, pet.y - 6, ['#ffffff', e.color, '#ffe680'], 16, 45);
    this.toast(`Your ${e.name} hatched a ${pet.name}!${pet.equipped ? '' : ' (pet inventory)'}`, '#ffe680');
    this.sfx.play('hatch');
  }
  feedPet(pet, f) {
    const v = fruitValue(f);
    const gain = clamp(15 + Math.log10(v + 1) * 15, 15, 100);
    pet.hunger = Math.min(100, pet.hunger + gain);
    const i = this.s.backpack.indexOf(f); if (i >= 0) this.s.backpack.splice(i, 1);
    this.sfx.play('eat'); this.toast(`${pet.name} ate a ${fruitName(f)} (+${Math.round(gain)}% hunger)`, '#c8ffc0');
  }
  equipPet(pet, on) {
    if (on && this.equippedPets().length >= MAX_PETS) { this.toast(`You can only equip ${MAX_PETS} pets.`, '#ffb0b0'); return; }
    pet.equipped = on; if (on) { pet.x = this.player.x; pet.y = this.player.y; pet.tgt = null; }
    this.sfx.play('click');
  }

  // ------------------------------------------------------------------ pets
  petLevel(p) { return Math.min(100, Math.floor(Math.sqrt(p.xp / 20))); }
  triggerAbility(pet) {
    const a = PETS[pet.id].ability, name = pet.name;
    const near = (p) => Math.hypot(p.tx * TILE + 8 - pet.x, p.ty * TILE + 8 - pet.y) <= (a.r || 4) * TILE;
    const say = (msg, col = '#c8ffc0') => this.toast(`${name} ${msg}!`, col);
    const pop = (col) => this.burst(pet.x, pet.y - 8, [col, '#fff'], 8, 30);
    switch (a.type) {
      case 'digSeed': if (Math.random() < a.chance) { const pool = CROPS.filter((c) => c.price <= 5000); const c = pool[Math.floor(Math.random() * pool.length)]; if (this.addItem('seed', c.id, 1)) { say(`dug up a ${c.name} seed`); pop('#8a5a2a'); } } break;
      case 'eatCrop': { const f = this.s.backpack.find((x) => x.crop === a.crop && !x.fav); if (f) { const v = Math.round(fruitValue(f) * a.mult); this.s.backpack.splice(this.s.backpack.indexOf(f), 1); this.s.sheckles += v; this.s.stats.earned += v; say(`${a.msg} for ¢${fmt(v)}`, '#ffe680'); this.floater(pet.x, pet.y - 14, `+¢${fmt(v)}`); } break; }
      case 'nap': pet.aura = { type: 'nap', left: a.dur, r: a.r, size: a.size }; say(a.msg); break;
      case 'variantAura': pet.aura = { type: 'variantAura', left: a.dur, r: a.r, gold: a.gold, rainbow: a.rainbow }; say(a.msg, '#ffd23f'); pop('#ffd23f'); break;
      case 'growthAura': pet.aura = { type: 'growthAura', left: a.dur, r: a.r, mult: a.mult }; say(a.msg); pop('#8fd36a'); break;
      case 'mutAura': pet.aura = { type: 'mutAura', left: a.dur, r: a.r, mult: a.mult }; say(a.msg, '#d58bff'); pop('#d58bff'); break;
      case 'water': { const list = this.s.plants.filter(near); if (list.length) { const p = list[Math.floor(Math.random() * list.length)]; if (p.ripe) { for (let i = 0; i < p.regrow.length; i++) if (!p.fruits[i]) p.regrow[i] = Math.max(0, p.regrow[i] - CROP[p.crop].grow * a.amount); } else p.progress = Math.min(1, p.progress + a.amount); p.water = 10; say(a.msg); this.burst(p.tx * TILE + 8, p.ty * TILE, '#8fd0ff', 8, 30); } break; }
      case 'chill': if (Math.random() < a.chance) { const p = this.randomRipePlant(); if (p) { const f = p.fruits.filter(Boolean)[0]; if (this.applyMut(f, 'Chilled')) { say(a.msg, '#aee8ff'); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#aee8ff', 8, 30); } } } break;
      case 'stealSeed': if (Math.random() < a.chance) { const ids = Object.keys(this.s.shops.seeds.stock).filter((id) => this.s.shops.seeds.stock[id] > 0); if (ids.length) { const id = ids[Math.floor(Math.random() * ids.length)]; if (this.addItem('seed', id, 1)) { this.s.shops.seeds.stock[id]--; say(`stole a ${CROP[id].name} seed from Sam`, '#ffd23f'); } } } break;
      case 'advance': if (Math.random() < a.chance) { const list = this.s.plants.filter((p) => !p.ripe && near(p)); if (list.length) { const p = list[Math.floor(Math.random() * list.length)]; p.progress = Math.min(1, p.progress + a.amount); say(a.msg); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#8fd36a', 6, 25); } } break;
      case 'goldify': { const p = this.randomRipePlant((q) => q.fruits.some((f) => f && f.variant === 'Normal')); if (p) { const f = p.fruits.find((x) => x && x.variant === 'Normal'); f.variant = 'Gold'; say(a.msg, '#ffd23f'); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#ffd23f', 12, 35); this.sfx.play('rare'); } break; }
      case 'sizeBoost': if (this.s.plants.length) { const p = this.s.plants[Math.floor(Math.random() * this.s.plants.length)]; p.size = Math.min(1.5, p.size + a.amount); say(a.msg); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#c8ffc0', 6, 25); } break;
      case 'dig': if (Math.random() < 0.5) { const g = GEAR[Math.floor(Math.random() * 5)]; if (this.addItem('gear', g.id, 1)) say(`dug up a ${g.name}`, '#ffd23f'); } else { const v = 500 + Math.floor(Math.random() * 5000); this.s.sheckles += v; this.s.stats.earned += v; say(`dug up ¢${fmt(v)}`, '#ffe680'); this.floater(pet.x, pet.y - 14, `+¢${fmt(v)}`); } pop('#8a5a2a'); break;
      case 'ripen': { const list = this.s.plants.filter((p) => !p.ripe || p.fruits.some((f) => !f)); if (list.length) { const p = list[Math.floor(Math.random() * list.length)]; this.ripen(p); say(a.msg, '#8fd36a'); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#8fd36a', 12, 35); } break; }
      case 'moonlit': if (this.isNight && Math.random() < a.chance) { const p = this.randomRipePlant(); if (p) { const f = p.fruits.filter(Boolean)[0]; if (this.applyMut(f, 'Moonlit')) { say(a.msg, '#c9a8ff'); this.burst(p.tx * TILE + 8, p.ty * TILE + 4, '#c9a8ff', 8, 30); } } } break;
      case 'copyCrop': if (this.s.backpack.length && this.s.backpack.length < BACKPACK_CAP) { const f = this.s.backpack[Math.floor(Math.random() * this.s.backpack.length)]; this.s.backpack.push({ ...f, uid: uid() }); say(a.msg + ' (' + fruitName(f) + ')', '#ffd23f'); } break;
    }
  }
  updatePets(dt) {
    const g = this.world.garden;
    const xpMult = this.petMult('xpAura') * (this.equippedPets().some((p) => p.id === 'nightowl') ? 1.25 : 1);
    for (const pet of this.equippedPets()) {
      pet.hunger = Math.max(0, pet.hunger - dt * 100 / 1800);
      pet.xp += dt * xpMult;
      const a = PETS[pet.id].ability;
      if (pet.aura) { pet.aura.left -= dt; if (pet.aura.left <= 0) pet.aura = null; }
      if (a.cd) { pet.cd -= dt; if (pet.cd <= 0) { pet.cd = a.cd * (1 - this.petLevel(pet) * 0.005); if (pet.hunger > 0) this.triggerAbility(pet); } }
      // wander
      if (pet.aura && pet.aura.type === 'nap') { pet.frame = 0; continue; }
      if (!pet.tgt) {
        pet.idle -= dt;
        if (pet.idle <= 0) {
          for (let k = 0; k < 8; k++) {
            const tx = g.x0 + Math.floor(Math.random() * (g.x1 - g.x0 + 1)), ty = g.y0 + Math.floor(Math.random() * (g.y1 - g.y0 + 1));
            if (!this.world.isSolid(tx, ty) && Math.hypot(tx * TILE - pet.x, ty * TILE - pet.y) < 90) { pet.tgt = { x: tx * TILE + 8, y: ty * TILE + 12 }; break; }
          }
          if (!pet.tgt) pet.idle = 1;
        }
      } else {
        const dx = pet.tgt.x - pet.x, dy = pet.tgt.y - pet.y, d = Math.hypot(dx, dy);
        const sp = (PETS[pet.id].look.kind === 'snail' || PETS[pet.id].look.kind === 'turtle') ? 8 : 20;
        if (d < 2) { pet.tgt = null; pet.idle = 1 + Math.random() * 3; }
        else {
          const nx = pet.x + dx / d * sp * dt, ny = pet.y + dy / d * sp * dt;
          if (!this.world.collides(nx - 4, ny - 3, 8, 4)) { pet.x = nx; pet.y = ny; } else { pet.tgt = null; pet.idle = 0.5; }
          pet.flip = dx < 0;
          pet.anim = (pet.anim || 0) + dt * 6; pet.frame = Math.floor(pet.anim) % 2;
        }
      }
    }
  }

  // ------------------------------------------------------------------ weather
  startWeather(id) {
    const w = WEATHER[id];
    const dur = w.dur[0] + Math.random() * (w.dur[1] - w.dur[0]);
    this.s.weather = { id, left: dur, total: dur, strikeT: w.strikeEvery || 0 };
    this.toast(w.msg, '#8ad6ff');
    this.sfx.play(id === 'storm' ? 'thunder' : 'weather');
  }
  strike(mut) {
    const w = this.s.weather;
    let plant = null;
    if (mut === 'Shocked') {
      const rods = this.s.objects.filter((o) => o.type === 'rod' && o.charges > 0);
      if (rods.length) {
        const rod = rods[Math.floor(Math.random() * rods.length)];
        plant = this.randomRipePlant((p) => Math.hypot(p.tx - rod.tx, p.ty - rod.ty) <= 2.5);
        if (plant) { rod.charges--; if (rod.charges <= 0) { this.s.objects.splice(this.s.objects.indexOf(rod), 1); this.toast('A Lightning Rod burned out.', '#ffe680'); } }
      }
      if (!plant && Math.random() < 0.4) plant = this.randomRipePlant();
      const tx = plant ? plant.tx : this.world.garden.x0 + Math.floor(Math.random() * 36), ty = plant ? plant.ty : this.world.garden.y0 + Math.floor(Math.random() * 15);
      this.fx.push({ type: 'bolt', x: tx * TILE + 8, y: ty * TILE + 8, t: 0.35 });
      this.flash = 0.25; this.shake = 0.3; this.sfx.play('thunder');
      if (plant) this.mutatePlant(plant, 'Shocked', true);
      return;
    }
    plant = this.randomRipePlant();
    if (!plant) return;
    const x = plant.tx * TILE + 8, y = plant.ty * TILE + 8;
    if (mut === 'Celestial') { this.fx.push({ type: 'meteor', x, y, t: 0.7, total: 0.7, plant }); this.sfx.play('meteor'); }
    else if (mut === 'Pollinated') { this.fx.push({ type: 'bee', x, y, t: 3, total: 3, plant, honey: Math.random() < WEATHER[w.id].honey }); }
  }
  updateWeather(dt) {
    const s = this.s;
    const wasNight = this.isNight;
    s.time += dt;
    if (!wasNight && this.isNight) { s.bloodMoon = Math.random() < 0.15; this.toast(s.bloodMoon ? WEATHER.blood.msg : 'Night falls. Crops may become Moonlit.', s.bloodMoon ? '#ff6b6b' : '#c9a8ff'); this.sfx.play('weather'); }
    if (wasNight && !this.isNight) { s.bloodMoon = false; this.toast('A new day dawns.', '#ffe680'); }
    if (!s.weather) { s.nextEvent -= dt; if (s.nextEvent <= 0) { const pairs = Object.entries(WEATHER).filter(([, w]) => w.weight).map(([id, w]) => [id, w.weight]); this.startWeather(weighted(Math.random, pairs)); } }
    else {
      const w = WEATHER[s.weather.id];
      s.weather.left -= dt;
      if (w.strikes) { s.weather.strikeT -= dt; if (s.weather.strikeT <= 0) { s.weather.strikeT = w.strikeEvery * (0.6 + Math.random() * 0.8); this.strike(w.strikes); } }
      if (s.weather.left <= 0) { this.toast(`${w.name} has ended.`, '#d0d0d0'); s.weather = null; s.nextEvent = 150 + Math.random() * 180; }
    }
    // passive mutations
    const ev = s.weather ? WEATHER[s.weather.id] : null;
    const nightMut = this.isNight ? (s.bloodMoon ? 'Bloodlit' : 'Moonlit') : null;
    const nightRate = this.isNight ? (s.bloodMoon ? WEATHER.blood.rate : WEATHER.night.rate) : 0;
    for (const p of s.plants) {
      if (!p.ripe) continue;
      const mm = this.mutMult(p.tx, p.ty);
      for (const f of p.fruits) {
        if (!f) continue;
        if (ev && ev.mut && ev.rate && chance(ev.rate * mm, dt) && this.applyMut(f, ev.mut)) this.burst(p.tx * TILE + 8, p.ty * TILE + 4, [MUTATIONS[ev.mut].color, '#fff'], 5, 20);
        if (nightMut && chance(nightRate * mm, dt) && this.applyMut(f, nightMut)) this.burst(p.tx * TILE + 8, p.ty * TILE + 4, [MUTATIONS[nightMut].color, '#fff'], 5, 20);
      }
    }
  }

  // ------------------------------------------------------------------ main update
  update(dt) {
    const s = this.s;
    this.t += dt;
    this.updateWeather(dt);
    // shops
    for (const k of ['seeds', 'gear', 'eggs']) { s.shops[k].left -= dt; if (s.shops[k].left <= 0) this.restock(k); }
    // plants
    for (const p of s.plants) {
      const c = CROP[p.crop];
      const gm = this.growthMult(p.tx, p.ty);
      p.size = Math.min(1.5, p.size + this.sizeRate(p.tx, p.ty) * dt);
      if (p.water > 0) p.water -= dt;
      if (!p.ripe) { p.progress += dt * gm / c.grow; if (p.progress >= 1) { this.ripen(p); this.burst(p.tx * TILE + 8, p.ty * TILE + 2, ['#ffffff', c.pal.fruit], 6, 20); } }
      else for (let i = 0; i < p.regrow.length; i++) if (!p.fruits[i]) { p.regrow[i] -= dt * gm; if (p.regrow[i] <= 0) p.fruits[i] = this.newFruit(p); }
    }
    // objects
    const hb = 1 + this.hatchBonus();
    for (let i = s.objects.length - 1; i >= 0; i--) {
      const o = s.objects[i];
      if (o.type === 'sprinkler') { o.left -= dt; if (o.left <= 0) { s.objects.splice(i, 1); this.toast(`${GEARMAP[o.id].name} ran dry.`, '#d0d0d0'); } }
      else if (o.type === 'egg') { o.left -= dt * hb; if (o.left <= 0) this.hatch(o); }
    }
    this.updatePets(dt);
    // fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.t -= dt;
      if (f.t <= 0) {
        if (f.type === 'meteor' && f.plant) { this.mutatePlant(f.plant, 'Celestial', true); this.burst(f.x, f.y, ['#ffe9ff', '#ff9de2', '#fff'], 16, 50); this.flash = 0.12; this.shake = 0.2; }
        if (f.type === 'bee' && f.plant) { this.mutatePlant(f.plant, f.honey ? 'HoneyGlazed' : 'Pollinated', true); }
        this.fx.splice(i, 1);
      }
    }
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 15; this.save(); }
  }

  // ------------------------------------------------------------------ frame (input + visuals at real time)
  frame(rdt) {
    const dt = Math.min(rdt, 0.1);
    const scale = this.fast ? 8 : 1;
    let left = dt * scale;
    while (left > 0) { const step = Math.min(left, 0.25); this.update(step); left -= step; }
    // player
    const pl = this.player, k = this.keys;
    if (!this.ui.panel) {
      let dx = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0), dy = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
      pl.moving = !!(dx || dy);
      if (pl.moving) {
        const sp = (k.ShiftLeft || k.ShiftRight ? 135 : 85) * dt, l = Math.hypot(dx, dy);
        dx = dx / l * sp; dy = dy / l * sp;
        if (!this.world.collides(pl.x - 4 + dx, pl.y - 3, 8, 4)) pl.x += dx;
        if (!this.world.collides(pl.x - 4, pl.y - 3 + dy, 8, 4)) pl.y += dy;
        if (Math.abs(dx) > Math.abs(dy)) pl.dir = dx > 0 ? 'right' : 'left'; else pl.dir = dy > 0 ? 'down' : 'up';
        pl.anim += dt * 9; pl.frame = Math.floor(pl.anim) % 4;
      } else { pl.frame = 0; pl.anim = 0; }
    } else pl.moving = false;
    // camera
    const tx = clamp(pl.x - VW / 2, 0, MW * TILE - VW), ty = clamp(pl.y - VH / 2 - 8, 0, MH * TILE - VH);
    this.cam.x = Math.round(lerp(this.cam.x, tx, Math.min(1, dt * 8)));
    this.cam.y = Math.round(lerp(this.cam.y, ty, Math.min(1, dt * 8)));
    if (this.camSnap) { this.cam.x = Math.round(tx); this.cam.y = Math.round(ty); this.camSnap = false; }
    // target tile
    const mx = this.mouse.x + this.cam.x, my = this.mouse.y + this.cam.y;
    const ttx = Math.floor(mx / TILE), tty = Math.floor(my / TILE);
    const reach = Math.hypot(ttx * TILE + 8 - pl.x, tty * TILE + 8 - pl.y) <= 2.6 * TILE;
    this.target = { tx: ttx, ty: tty, ok: reach && this.world.inMap(ttx, tty) };
    const ptx = Math.floor(pl.x / TILE), pty = Math.floor(pl.y / TILE);
    this.nearStall = this.world.stallAt(ptx, pty);
    // visuals
    for (let i = this.particles.length - 1; i >= 0; i--) { const p = this.particles[i]; p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) this.particles.splice(i, 1); }
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.life -= dt; f.y -= 14 * dt; if (f.life <= 0) this.floaters.splice(i, 1); }
    for (let i = this.toasts.length - 1; i >= 0; i--) { this.toasts[i].t -= dt; if (this.toasts[i].t <= 0) this.toasts.splice(i, 1); }
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake -= dt;
    this.sfx.ambient(this.s.weather?.id, this.isNight);
    this.ui.frame(dt);
    this.renderer.draw();
    this.mouse.click = null; this.mouse.rclick = null; this.mouse.wheel = 0;
  }

  // world click when no panel consumed it
  worldClick(button) {
    if (this.nearStall && button === 0 && !this.target.ok) { this.ui.open(this.nearStall.kind); return; }
    if (this.target.ok) this.useOn(this.target.tx, this.target.ty);
  }
  interact() {
    if (this.nearStall) { this.ui.open(this.nearStall.kind); this.sfx.play('click'); return; }
    const pl = this.player;
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[pl.dir];
    const tx = Math.floor((pl.x + d[0] * 12) / TILE), ty = Math.floor((pl.y + d[1] * 12) / TILE);
    this.useOn(this.target.ok ? this.target.tx : tx, this.target.ok ? this.target.ty : ty);
  }

  // ------------------------------------------------------------------ save / load
  snapshot() { return { state: this.s, player: { x: this.player.x, y: this.player.y }, savedAt: Date.now() }; }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot())); } catch (e) { /* ignore */ } }
  static load() { try { const j = localStorage.getItem(SAVE_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } }
  static clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
  applyOffline(saved) {
    const s = this.s;
    for (const p of s.pets) { p.aura = null; p.tgt = null; p.idle = 1; p.frame = 0; p.x = p.x || this.world.spawn.x; p.y = p.y || this.world.spawn.y; }
    if (!Array.isArray(s.inv) || s.inv.length !== INV_SLOTS) s.inv = (s.inv || []).concat(new Array(INV_SLOTS).fill(null)).slice(0, INV_SLOTS);
    const el = clamp((Date.now() - (saved.savedAt || Date.now())) / 1000, 0, 7200);
    if (el < 30) return;
    for (const p of s.plants) {
      const c = CROP[p.crop];
      if (!p.ripe) { p.progress += el / c.grow; if (p.progress >= 1) this.ripen(p); }
      else for (let i = 0; i < p.regrow.length; i++) if (!p.fruits[i]) { p.regrow[i] -= el; if (p.regrow[i] <= 0) p.fruits[i] = this.newFruit(p); }
    }
    for (let i = s.objects.length - 1; i >= 0; i--) { const o = s.objects[i]; if (o.type === 'sprinkler') { o.left -= el; if (o.left <= 0) s.objects.splice(i, 1); } else if (o.type === 'egg') { o.left -= el; if (o.left <= 0) this.hatch(o); } }
    for (const p of s.pets) if (p.equipped) { p.hunger = Math.max(0, p.hunger - el * 100 / 1800); p.xp += el; }
    for (const k of ['seeds', 'gear', 'eggs']) { s.shops[k].left -= el; if (s.shops[k].left <= 0) this.restock(k); }
    s.weather = null; s.time += el; s.bloodMoon = false;
    this.toasts.length = 0;
    this.toast(`Welcome back! Your garden grew for ${fmtTime(el)} while you were away.`, '#ffe680');
  }
}
