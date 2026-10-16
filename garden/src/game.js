// Game state and rules: plots, growth, weather, mutations, shop stock, selling, saving.
import { SEEDS, SEED, MUT, WEATHER, GEAR, SPRINKLER_TIME, RESTOCK, EXPANSIONS, itemValue } from './data.js';

const SAVE = 'grow-a-garden-save';
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Game {
  constructor() {
    this.money = 20;
    this.cols = 4; this.rows = 5; this.expansions = 0;
    this.plots = new Array(this.cols * this.rows).fill(null);
    this.seeds = {};            // seed id -> count owned
    this.items = [];            // harvested crops: { crop, w, muts }
    this.gear = { can: 0, sprinklers: 0 };
    this.stock = {}; this.restockT = 0; this.restock();
    this.weather = 'SUNNY'; this.weatherT = 0; this.nextWeather = rnd(120, 240);
    this.time = 0; this.saveT = 0;
    this.toasts = [];
    this.onChange = null;
  }

  // ------------------------------------------------------------ shop
  restock() {
    for (const s of SEEDS) this.stock[s.id] = Math.random() < s.chance ? rnd(s.stock[0], s.stock[1]) : 0;
    this.restockT = RESTOCK;
  }
  buySeed(id) {
    const s = SEED[id];
    if (!this.stock[id]) return this.toast('OUT OF STOCK');
    if (this.money < s.price) return this.toast('NOT ENOUGH SHECKLES');
    this.money -= s.price; this.stock[id]--; this.seeds[id] = (this.seeds[id] || 0) + 1;
    this.toast('+1 ' + s.name + ' SEED');
  }
  buyGear(id) {
    const g = GEAR[id];
    if (this.money < g.price) return this.toast('NOT ENOUGH SHECKLES');
    this.money -= g.price;
    if (id === 'can') this.gear.can += 10; else this.gear.sprinklers++;
    this.toast('BOUGHT ' + g.name);
  }
  nextExpansion() { return EXPANSIONS[this.expansions] || null; }
  expand() {
    const e = this.nextExpansion();
    if (!e) return this.toast('GARDEN IS FULL SIZE');
    if (this.money < e.price) return this.toast('NOT ENOUGH SHECKLES');
    this.money -= e.price;
    const plots = new Array(e.cols * e.rows).fill(null);
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) plots[y * e.cols + x] = this.plots[y * this.cols + x];
    this.plots = plots; this.cols = e.cols; this.rows = e.rows; this.expansions++;
    this.toast('GARDEN EXPANDED');
  }

  // ------------------------------------------------------------ plots
  plant(i, id) {
    if (this.plots[i] || !this.seeds[id]) return false;
    this.seeds[id]--; if (!this.seeds[id]) delete this.seeds[id];
    this.plots[i] = { crop: id, growth: 0, ready: false, muts: [] };
    return true;
  }
  placeSprinkler(i) {
    if (this.plots[i] || !this.gear.sprinklers) return false;
    this.gear.sprinklers--; this.plots[i] = { sprinkler: true, t: SPRINKLER_TIME };
    return true;
  }
  water(i) {
    const p = this.plots[i];
    if (!p || p.sprinkler || p.ready || !this.gear.can) return false;
    this.gear.can--; p.growth += 30; this.ripenIfDone(i);
    return true;
  }
  dig(i) { this.plots[i] = null; }
  harvest(i) {
    const p = this.plots[i];
    if (!p || p.sprinkler || !p.ready) return null;
    const s = SEED[p.crop];
    const n = s.multi ? rnd(s.yield[0], s.yield[1]) : 1;
    const got = [];
    for (let k = 0; k < n; k++) {
      let w = s.baseW * (0.8 + Math.random() * 0.5);
      if (Math.random() < 0.05) w *= 1.5 + Math.random();
      const item = { crop: p.crop, w: Math.round(w * 100) / 100, muts: p.muts.slice() };
      this.items.push(item); got.push(item);
    }
    if (s.multi) { p.ready = false; p.growth = s.grow * 0.5; p.muts = []; } else this.plots[i] = null;
    const tag = got[0].muts.length ? ' (' + got[0].muts.join(' ') + ')' : '';
    this.toast('+' + n + ' ' + s.name + tag);
    return got;
  }
  sellAll() {
    if (!this.items.length) return this.toast('NOTHING TO SELL');
    let total = 0;
    for (const it of this.items) total += itemValue(it);
    this.money += total; this.items = [];
    this.toast('SOLD FOR ' + total + ' SHECKLES');
    return total;
  }
  inventoryValue() { return this.items.reduce((a, it) => a + itemValue(it), 0); }

  nearSprinkler(i) {
    const x = i % this.cols, y = (i / this.cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
      const q = this.plots[ny * this.cols + nx];
      if (q && q.sprinkler) return true;
    }
    return false;
  }
  growthMult(i) { return WEATHER[this.weather].growth * (this.nearSprinkler(i) ? 1.5 : 1); }
  ripenIfDone(i) {
    const p = this.plots[i], s = SEED[p.crop];
    if (p.ready || p.growth < s.grow) return;
    p.ready = true; p.growth = s.grow;
    const boost = this.nearSprinkler(i) ? 2 : 1;
    const r = Math.random();
    if (r < 0.001 * boost) p.muts.push('Rainbow');
    else if (r < 0.011 * boost) p.muts.push('Gold');
  }
  addEnv(p, m) {
    if (p.muts.includes(m) || p.muts.includes('Frozen')) return;
    p.muts.push(m);
    if (p.muts.includes('Wet') && p.muts.includes('Chilled')) p.muts = p.muts.filter((x) => x !== 'Wet' && x !== 'Chilled').concat('Frozen');
  }
  timeLeft(i) { const p = this.plots[i]; return Math.max(0, (SEED[p.crop].grow - p.growth) / this.growthMult(i)); }

  // ------------------------------------------------------------ tick
  tick(dt) {
    this.time += dt;
    this.restockT -= dt; if (this.restockT <= 0) { this.restock(); this.toast('SEED SHOP RESTOCKED'); }
    if (this.weather === 'SUNNY') { this.nextWeather -= dt; if (this.nextWeather <= 0) this.startWeather(['RAIN', 'RAIN', 'FROST', 'THUNDER'][rnd(0, 3)]); }
    else { this.weatherT -= dt; if (this.weatherT <= 0) { this.weather = 'SUNNY'; this.nextWeather = rnd(120, 300); } }
    const w = WEATHER[this.weather];
    for (let i = 0; i < this.plots.length; i++) {
      const p = this.plots[i]; if (!p) continue;
      if (p.sprinkler) { p.t -= dt; if (p.t <= 0) this.plots[i] = null; continue; }
      if (!p.ready) { p.growth += dt * this.growthMult(i); this.ripenIfDone(i); }
      else {
        if (w.wet && Math.random() < w.wet * dt) this.addEnv(p, 'Wet');
        if (w.chill && Math.random() < w.chill * dt) this.addEnv(p, 'Chilled');
        if (w.shock && Math.random() < w.shock * dt) this.addEnv(p, 'Shocked');
      }
    }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.saveT += dt; if (this.saveT > 5) { this.saveT = 0; this.save(); }
  }
  startWeather(kind) { this.weather = kind; this.weatherT = rnd(60, 90); this.toast(WEATHER[kind].label + ' HAS STARTED'); }
  toast(msg) { this.toasts.push({ msg, t: 2.5 }); if (this.toasts.length > 3) this.toasts.shift(); }

  // ------------------------------------------------------------ save
  save() {
    const d = { money: this.money, cols: this.cols, rows: this.rows, expansions: this.expansions, plots: this.plots, seeds: this.seeds, items: this.items,
      gear: this.gear, stock: this.stock, restockT: this.restockT, weather: this.weather, weatherT: this.weatherT, nextWeather: this.nextWeather, savedAt: Date.now() };
    try { localStorage.setItem(SAVE, JSON.stringify(d)); } catch (e) { /* storage may be unavailable */ }
  }
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE)); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.plots)) return false;
    Object.assign(this, { money: d.money, cols: d.cols, rows: d.rows, expansions: d.expansions || 0, plots: d.plots, seeds: d.seeds || {}, items: d.items || [],
      gear: Object.assign({ can: 0, sprinklers: 0 }, d.gear), stock: d.stock || {}, restockT: d.restockT, weather: d.weather || 'SUNNY', weatherT: d.weatherT || 0, nextWeather: d.nextWeather || 180 });
    for (const p of this.plots) if (p && !p.sprinkler && !SEED[p.crop]) this.plots[this.plots.indexOf(p)] = null;
    // Plants keep growing while the game is closed (up to 8 hours, no weather).
    const away = Math.min(8 * 3600, Math.max(0, (Date.now() - (d.savedAt || Date.now())) / 1000));
    if (away > 1) {
      this.weather = 'SUNNY';
      for (let i = 0; i < this.plots.length; i++) {
        const p = this.plots[i]; if (!p) continue;
        if (p.sprinkler) { p.t -= away; if (p.t <= 0) this.plots[i] = null; continue; }
        if (!p.ready) { p.growth += away; this.ripenIfDone(i); }
      }
      this.restockT -= away; if (this.restockT <= 0) this.restock();
    }
    return true;
  }
  reset() { try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ } }
}
