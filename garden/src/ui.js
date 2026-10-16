// Rendering and touch input. Everything is drawn in logical pixels on a small canvas that CSS scales up.
import { SEEDS, SEED, GEAR, WEATHER, itemValue } from './data.js';
import { INK, text, textWidth, plantSprite, icon, fruitIcon } from './sprites.js';

const SOIL = '#a06a3a', SOIL_DARK = '#7a4b22', GREEN = '#3cb043', GREY = '#9aa0a6', CREAM = '#f7f1e3', RED = '#e63946';
const TILE = 20, CELL_W = 21, CELL_H = 25, ROW = 18;
const fmt = (n) => n < 10000 ? String(n) : n < 1e6 ? (n / 1000).toFixed(1).replace('.0', '') + 'K' : (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
const clock = (s) => { s = Math.ceil(s); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
const WICON = { SUNNY: 'sun', RAIN: 'drop', FROST: 'snow', THUNDER: 'bolt' };

export class UI {
  constructor(canvas, game) {
    this.c = canvas; this.x = canvas.getContext('2d'); this.x.imageSmoothingEnabled = false;
    this.game = game; this.scale = 1; this.W = 128; this.H = 224;
    this.modal = null; this.plot = -1; this.scroll = 0; this.confirmReset = 0;
    this.hits = []; this.list = null; this.down = null; this.t = 0;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', () => { this.down = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.resize();
  }
  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const needH = Math.max(190, 24 + this.game.rows * CELL_H + 34);   // the whole garden plus the toolbar must fit
    this.scale = Math.max(1, Math.floor(Math.min(vw / 128, vh / needH))); this.rowsAt = this.game.rows;
    this.W = Math.min(200, Math.floor(vw / this.scale)); this.H = Math.floor(vh / this.scale);
    this.c.width = this.W; this.c.height = this.H;
    this.c.style.width = this.W * this.scale + 'px'; this.c.style.height = this.H * this.scale + 'px';
    this.x.imageSmoothingEnabled = false;
  }
  pos(e) { const r = this.c.getBoundingClientRect(); return [(e.clientX - r.left) / this.scale, (e.clientY - r.top) / this.scale]; }

  // ------------------------------------------------------------ input
  onDown(e) { e.preventDefault(); const [x, y] = this.pos(e); this.down = { x, y, sy: y, moved: false }; this.c.setPointerCapture?.(e.pointerId); }
  onMove(e) {
    if (!this.down) return;
    const [x, y] = this.pos(e);
    if (Math.abs(x - this.down.x) > 3 || Math.abs(y - this.down.y) > 3) this.down.moved = true;
    if (this.list && this.down.moved) { this.scroll = Math.max(0, Math.min(this.list.max, this.scroll - (y - this.down.sy))); }
    this.down.sy = y;
  }
  onUp(e) {
    const d = this.down; this.down = null;
    if (!d || d.moved) return;
    const [x, y] = this.pos(e);
    this.tap(x, y);
  }
  tap(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (h.clip && (y < h.clip[0] || y > h.clip[1])) continue;
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) { h.fn(); return true; }
    }
    return false;
  }
  open(modal, plot = -1) { this.modal = modal; this.plot = plot; this.scroll = 0; this.confirmReset = 0; }
  close() { this.modal = null; this.list = null; }

  // ------------------------------------------------------------ drawing helpers
  box(x, y, w, h, fill = '#ffffff', stroke = INK) {
    const c = this.x; c.fillStyle = stroke; c.fillRect(x, y, w, h); c.fillStyle = fill; c.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
  button(x, y, w, h, label, fn, opts = {}) {
    const on = !opts.disabled;
    this.box(x, y, w, h, on ? (opts.fill || CREAM) : '#e9e9e9', on ? INK : GREY);
    if (on) { this.x.fillStyle = INK; this.x.fillRect(x + 1, y + h, w - 1, 1); this.x.fillRect(x + w, y + 1, 1, h); }
    text(this.x, label, x + (w / 2) | 0, y + ((h - 5) / 2) | 0, on ? (opts.color || INK) : GREY, 1, 'center');
    if (on && fn) this.hits.push({ x, y, w, h, fn, clip: opts.clip });
  }
  coins(x, y, n, col = INK) { this.x.drawImage(icon('coin'), x, y - 1); text(this.x, fmt(n), x + 9, y, col); }

  // ------------------------------------------------------------ frame
  render(dt) {
    if (this.game.rows !== this.rowsAt) this.resize();
    this.t += dt; this.hits = []; this.list = null;
    const c = this.x, g = this.game, W = this.W, H = this.H;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
    // top bar: money and weather
    c.drawImage(icon('coin'), 3, 3); text(c, fmt(g.money), 12, 3, INK, 2);
    const wl = WEATHER[g.weather].label;
    text(c, wl, W - 3, 5, INK, 1, 'right'); c.drawImage(icon(WICON[g.weather]), W - textWidth(wl) - 12, 4);
    if (g.weather !== 'SUNNY') text(c, clock(g.weatherT), W - 3, 12, GREY, 1, 'right');
    this.drawGarden();
    // toolbar
    const bw = ((W - 8) / 3) | 0, by = H - 20;
    this.button(4, by, bw - 2, 16, 'SEEDS', () => this.open('seeds'));
    this.button(4 + bw, by, bw - 2, 16, 'GEAR', () => this.open('gear'));
    this.button(4 + bw * 2, by, bw - 2, 16, 'SELL ' + g.items.length, () => this.open('sell'), { fill: g.items.length ? GREEN : CREAM, color: g.items.length ? '#ffffff' : INK });
    // toasts
    let ty = by - 4;
    for (let i = g.toasts.length - 1; i >= 0; i--) {
      const t = g.toasts[i], w = textWidth(t.msg) + 6; ty -= 10;
      this.box((W - w) / 2 | 0, ty, w, 9, '#ffffff'); text(c, t.msg, W / 2 | 0, ty + 2, INK, 1, 'center');
    }
    if (this.modal) this.drawModal();
  }

  gridOrigin() { const g = this.game; return [((this.W - (g.cols * CELL_W - 1)) / 2) | 0, 20]; }
  drawGarden() {
    const c = this.x, g = this.game, [gx, gy] = this.gridOrigin();
    for (let i = 0; i < g.plots.length; i++) {
      const px = gx + (i % g.cols) * CELL_W, py = gy + ((i / g.cols) | 0) * CELL_H, p = g.plots[i];
      // soil block
      this.box(px, py + 16, TILE, 8, SOIL);
      c.fillStyle = SOIL_DARK; c.fillRect(px + 3, py + 19, 2, 1); c.fillRect(px + 9, py + 21, 2, 1); c.fillRect(px + 14, py + 18, 2, 1);
      if (!p) {
        c.fillStyle = '#d9d9d9'; c.fillRect(px + 9, py + 5, 2, 8); c.fillRect(px + 6, py + 8, 8, 2);
        if (!this.modal) this.hits.push({ x: px, y: py, w: TILE, h: CELL_H, fn: () => this.open('plant', i) });
        continue;
      }
      if (p.sprinkler) {
        const s = icon('sprinkler'); c.drawImage(s, px + 6, py + 10);
        c.fillStyle = '#4cc9f0'; const k = ((this.t * 6) | 0) % 3;
        for (let d = 0; d < 3; d++) c.fillRect(px + 2 + d * 7, py + 2 + ((d + k) % 3) * 3, 1, 2);
        if (!this.modal) this.hits.push({ x: px, y: py, w: TILE, h: CELL_H, fn: () => this.open('plot', i) });
        continue;
      }
      const s = SEED[p.crop], f = p.growth / s.grow;
      const stage = p.ready ? 3 : f < 0.25 ? 0 : f < 0.6 ? 1 : 2;
      const spr = plantSprite(p.crop, stage, p.muts, (this.t * 120) % 360);
      c.drawImage(spr, px + 10 - (spr.width / 2 | 0), py + 18 - spr.height);
      if (p.ready) { c.drawImage(icon('check'), px + TILE - 7, py); }
      else { c.fillStyle = INK; c.fillRect(px + 2, py + 20, 16, 3); c.fillStyle = '#ffffff'; c.fillRect(px + 3, py + 21, 14, 1); c.fillStyle = GREEN; c.fillRect(px + 3, py + 21, Math.round(14 * Math.min(1, f)), 1); }
      if (!this.modal) this.hits.push({ x: px, y: py, w: TILE, h: CELL_H, fn: () => (p.ready ? g.harvest(i) : this.open('plot', i)) });
    }
  }

  // ------------------------------------------------------------ modals
  drawModal() {
    const c = this.x, W = this.W, H = this.H, x0 = 4, y0 = 18, w = W - 8, h = H - 42;
    c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(0, 0, W, H);
    this.box(x0, y0, w, h); c.fillStyle = INK; c.fillRect(x0 + 1, y0 + h, w - 1, 1); c.fillRect(x0 + w, y0 + 1, 1, h);
    this.hits.push({ x: 0, y: 0, w: W, h: H, fn: () => this.close() });   // tap outside closes
    this.hits.push({ x: x0, y: y0, w, h, fn: () => {} });
    this.button(x0 + w - 13, y0 + 2, 11, 11, 'X', () => this.close(), { fill: '#ffffff' });
    const title = { seeds: 'SEED SHOP', gear: 'GEAR', sell: 'SELL', plant: 'PLANT', plot: 'PLOT' }[this.modal];
    text(c, title, x0 + 4, y0 + 5, INK);
    this['modal_' + this.modal](x0 + 3, y0 + 16, w - 6, h - 19);
  }
  // Scrollable list of rows. draw(rowIndex, x, y, w) draws one row at the given position.
  rows(x, y, w, h, n, draw, extraTop = 0) {
    const c = this.x, max = Math.max(0, n * ROW + extraTop - h);
    this.scroll = Math.min(this.scroll, max); this.list = { max };
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const clip = [y, y + h];
    for (let i = 0; i < n; i++) { const ry = y + extraTop + i * ROW - this.scroll; if (ry + ROW < y || ry > y + h) continue; draw(i, x, ry, w, clip); c.fillStyle = '#e4e4e4'; c.fillRect(x, ry + ROW - 1, w, 1); }
    c.restore();
    if (max > 0) { c.fillStyle = '#e4e4e4'; c.fillRect(x + w - 2, y, 2, h); c.fillStyle = INK; c.fillRect(x + w - 2, y + (h - 12) * this.scroll / max, 2, 12); }
  }
  modal_seeds(x, y, w, h) {
    const c = this.x, g = this.game;
    text(c, 'RESTOCK ' + clock(g.restockT), x + w - 15, y - 11, GREY, 1, 'right');
    this.rows(x, y, w, h, SEEDS.length, (i, rx, ry, rw, clip) => {
      const s = SEEDS[i], st = g.stock[s.id] || 0, can = st > 0 && g.money >= s.price;
      c.drawImage(fruitIcon(s.id), rx + 1, ry + 2);
      text(c, s.name, rx + 12, ry + 2, st ? INK : GREY);
      text(c, st ? 'x' + st : 'SOLD OUT', rx + rw - 4, ry + 2, st ? INK : RED, 1, 'right');
      this.coins(rx + 12, ry + 10, s.price, g.money >= s.price ? INK : RED);
      this.button(rx + rw - 28, ry + 8, 24, 9, 'BUY', () => g.buySeed(s.id), { disabled: !can, fill: GREEN, color: '#ffffff', clip });
    });
  }
  modal_gear(x, y, w, h) {
    const c = this.x, g = this.game, e = g.nextExpansion();
    const items = [
      { icon: 'can', name: GEAR.can.name + (g.gear.can ? ' (' + g.gear.can + ')' : ''), desc: GEAR.can.desc, price: GEAR.can.price, fn: () => g.buyGear('can') },
      { icon: 'sprinkler', name: GEAR.sprinkler.name + (g.gear.sprinklers ? ' (' + g.gear.sprinklers + ')' : ''), desc: GEAR.sprinkler.desc, price: GEAR.sprinkler.price, fn: () => g.buyGear('sprinkler') },
      e ? { icon: 'plus', name: 'EXPAND TO ' + e.cols + 'x' + e.rows, desc: 'MORE PLOTS', price: e.price, fn: () => g.expand() } : { icon: 'plus', name: 'GARDEN ' + g.cols + 'x' + g.rows, desc: 'MAX SIZE', price: 0, done: true },
    ];
    this.rows(x, y, w, h - 14, items.length, (i, rx, ry, rw, clip) => {
      const it = items[i];
      c.drawImage(icon(it.icon), rx + 1, ry + 2);
      text(c, it.name, rx + 12, ry + 2, INK);
      text(c, it.desc, rx + 12, ry + 9, GREY);
      if (it.done) return;
      this.coins(rx + rw - 13 - textWidth(fmt(it.price)), ry + 2, it.price, g.money >= it.price ? INK : RED);
      this.button(rx + rw - 28, ry + 8, 24, 9, 'BUY', it.fn, { disabled: g.money < it.price, fill: GREEN, color: '#ffffff', clip });
    });
    this.button(x, y + h - 11, w, 11, this.confirmReset ? 'TAP AGAIN TO ERASE SAVE' : 'NEW GAME', () => {
      if (!this.confirmReset) { this.confirmReset = 1; return; }
      g.reset(); location.reload();
    }, { fill: this.confirmReset ? RED : CREAM, color: this.confirmReset ? '#ffffff' : INK });
  }
  modal_sell(x, y, w, h) {
    const c = this.x, g = this.game;
    const groups = new Map();
    for (const it of g.items) { const k = it.crop + '|' + it.muts.join(' '); const gr = groups.get(k) || { crop: it.crop, muts: it.muts, n: 0, v: 0, w: 0 }; gr.n++; gr.v += itemValue(it); gr.w += it.w; groups.set(k, gr); }
    const list = [...groups.values()].sort((a, b) => b.v - a.v);
    const total = g.inventoryValue();
    if (!list.length) text(c, 'NOTHING TO SELL YET', x + w / 2 | 0, y + 10, GREY, 1, 'center');
    this.rows(x, y, w, h - 16, list.length, (i, rx, ry, rw) => {
      const gr = list[i];
      c.drawImage(fruitIcon(gr.crop, gr.muts), rx + 1, ry + 2);
      text(c, SEED[gr.crop].name + ' x' + gr.n, rx + 12, ry + 2, INK);
      text(c, (gr.muts.length ? gr.muts.join(' ').toUpperCase() + ' ' : '') + (gr.w / gr.n).toFixed(2) + 'KG', rx + 12, ry + 9, gr.muts.length ? '#b5179e' : GREY);
      this.coins(rx + rw - 12 - textWidth(fmt(gr.v)), ry + 5, gr.v);
    });
    this.button(x, y + h - 13, w, 13, 'SELL ALL FOR ' + fmt(total), () => { g.sellAll(); this.close(); }, { disabled: !list.length, fill: GREEN, color: '#ffffff' });
  }
  modal_plant(x, y, w, h) {
    const c = this.x, g = this.game, i = this.plot;
    const owned = SEEDS.filter((s) => g.seeds[s.id]);
    const list = owned.map((s) => ({ icon: fruitIcon(s.id), name: s.name, n: g.seeds[s.id], sub: (s.multi ? 'REGROWS' : 'ONE HARVEST') + ' ' + clock(s.grow), fn: () => { g.plant(i, s.id); this.close(); } }));
    if (g.gear.sprinklers) list.push({ icon: icon('sprinkler'), name: 'SPRINKLER', n: g.gear.sprinklers, sub: 'BOOSTS NEIGHBOURS', fn: () => { g.placeSprinkler(i); this.close(); } });
    if (!list.length) { text(c, 'NO SEEDS YET', x + w / 2 | 0, y + 8, GREY, 1, 'center'); this.button(x + 10, y + 20, w - 20, 13, 'GO TO SEED SHOP', () => this.open('seeds'), { fill: GREEN, color: '#ffffff' }); return; }
    this.rows(x, y, w, h, list.length, (k, rx, ry, rw, clip) => {
      const it = list[k];
      c.drawImage(it.icon, rx + 1, ry + 2);
      text(c, it.name + ' x' + it.n, rx + 12, ry + 2, INK); text(c, it.sub, rx + 12, ry + 9, GREY);
      this.button(rx + rw - 32, ry + 4, 28, 10, 'PLANT', it.fn, { fill: GREEN, color: '#ffffff', clip });
    });
  }
  modal_plot(x, y, w, h) {
    const c = this.x, g = this.game, i = this.plot, p = g.plots[i];
    if (!p) { this.close(); return; }
    if (p.sprinkler) {
      c.drawImage(icon('sprinkler'), x + 1, y + 1); text(c, 'SPRINKLER', x + 12, y + 2, INK); text(c, clock(p.t) + ' LEFT', x + 12, y + 9, GREY);
      this.button(x, y + 22, w, 12, 'REMOVE', () => { g.dig(i); this.close(); }, { fill: RED, color: '#ffffff' });
      return;
    }
    const s = SEED[p.crop];
    const spr = plantSprite(p.crop, p.ready ? 3 : 2, p.muts, (this.t * 120) % 360);
    c.drawImage(spr, x + 2, y + 2);
    text(c, s.name, x + 20, y + 3, INK);
    text(c, p.ready ? 'READY!' : 'READY IN ' + clock(g.timeLeft(i)), x + 20, y + 10, p.ready ? GREEN : GREY);
    let ly = y + 17;
    if (g.growthMult(i) > 1 && !p.ready) { text(c, 'x' + g.growthMult(i).toFixed(1) + ' GROWTH', x + 20, ly, '#4cc9f0'); ly += 7; }
    if (p.muts.length) { text(c, p.muts.join(' ').toUpperCase(), x + 20, ly, '#b5179e'); ly += 7; }
    let by = Math.max(ly + 4, y + 26);
    if (p.ready) { this.button(x, by, w, 13, 'HARVEST', () => { g.harvest(i); this.close(); }, { fill: GREEN, color: '#ffffff' }); by += 16; }
    else if (g.gear.can) { this.button(x, by, w, 13, 'WATER (' + g.gear.can + ' LEFT)', () => { g.water(i); if (g.plots[i]?.ready) this.close(); }, { fill: '#4cc9f0', color: '#ffffff' }); by += 16; }
    this.button(x, by, w, 11, 'DIG UP', () => { g.dig(i); this.close(); }, { fill: CREAM });
  }
}
