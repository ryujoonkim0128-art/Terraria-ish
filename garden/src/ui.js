// HUD and panels: immediate-mode pixel UI drawn on the hud canvas, plus keyboard/mouse input.
import { TILE, CROPS, CROP, GEAR, GEARMAP, EGGS, EGGMAP, PETS, RARITY, MUTATIONS, VARIANTS, WEATHER, BACKPACK_CAP, INV_SLOTS, MAX_PETS, DAY_LEN } from './content.js';
import { VW, VH, fruitValue, fruitName, fmt, fmtTime, Game } from './game.js';
import { text, width, wrap, LINE } from './font.js';
import * as S from './sprites.js';
import { seedIcon, fruitSprite } from './plants.js';
import { clamp } from './rng.js';

const C = { ink: '#3a2616', paper: '#f4e6c3', paper2: '#e9d6ab', border: '#6b4a2b', title: '#c98a45', light: '#fff6dc', green: '#3e8f3a', red: '#c0392b', gold: '#d99a1a', dim: '#8a7055', hud: 'rgba(20,14,22,0.72)' };
const SHOP_TITLES = { seeds: "Sam's Seed Shop", gear: "Gus's Gear Shop", eggs: "Edna's Pet Eggs", sell: "Steven's Sell Stand", backpack: 'Backpack', pets: 'Pets', help: 'How to play' };

export class UI {
  constructor(game) {
    this.g = game;
    this.ctx = game.hud.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.panel = null; this.scroll = 0; this.hoverRow = -1; this.tab = 0;
    this.clickUsed = false;
    this.bind();
  }
  open(kind) { this.panel = kind; this.scroll = 0; }
  close() { this.panel = null; }

  bind() {
    const g = this.g, hud = g.hud;
    const pos = (e) => { const r = hud.getBoundingClientRect(); return { x: (e.clientX - r.left) * VW / r.width, y: (e.clientY - r.top) * VH / r.height }; };
    hud.addEventListener('mousemove', (e) => { const p = pos(e); g.mouse.x = p.x; g.mouse.y = p.y; });
    hud.addEventListener('mousedown', (e) => { const p = pos(e); g.mouse.x = p.x; g.mouse.y = p.y; g.mouse.click = { x: p.x, y: p.y, button: e.button, shift: e.shiftKey }; g.sfx.unlock(); e.preventDefault(); });
    hud.addEventListener('contextmenu', (e) => e.preventDefault());
    hud.addEventListener('wheel', (e) => { g.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      g.keys[e.code] = true; g.sfx.unlock();
      if (e.code === 'Escape') { if (this.panel) this.close(); }
      else if (e.code === 'KeyE' || e.code === 'Space') { if (this.panel) this.close(); else g.interact(); }
      else if (e.code === 'KeyB' || e.code === 'Tab') { this.panel === 'backpack' ? this.close() : this.open('backpack'); e.preventDefault(); }
      else if (e.code === 'KeyP') { this.panel === 'pets' ? this.close() : this.open('pets'); }
      else if (e.code === 'KeyH') { this.panel === 'help' ? this.close() : this.open('help'); }
      else if (e.code === 'KeyM') { g.muted = !g.muted; g.sfx.muted = g.muted; g.toast(g.muted ? 'Muted' : 'Sound on', '#d0d0d0'); }
      else if (e.code === 'KeyT') g.fast = true;
      else if (e.code === 'KeyQ') { if (g.carried) g.toast('Place the carried plant first.', '#ffb0b0'); }
      else if (/^Digit\d$/.test(e.code)) { const n = e.code === 'Digit0' ? 9 : parseInt(e.code[5], 10) - 1; g.selected = n; g.sfx.play('click'); }
      else if (e.code === 'Minus') g.selected = 10; else if (e.code === 'Equal') g.selected = 11;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { g.keys[e.code] = false; if (e.code === 'KeyT') g.fast = false; });
    window.addEventListener('blur', () => { for (const k in g.keys) g.keys[k] = false; g.fast = false; });
    window.addEventListener('beforeunload', () => g.save());
  }

  // ---------------------------------------------------------------- primitives
  box(x, y, w, h, fill = C.paper, border = C.border) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 2, y + 2, w, h);
    c.fillStyle = border; c.fillRect(x, y, w, h);
    c.fillStyle = fill; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.clearRect(x, y, 1, 1); c.clearRect(x + w - 1, y, 1, 1); c.clearRect(x, y + h - 1, 1, 1); c.clearRect(x + w - 1, y + h - 1, 1, 1);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(x + 1, y + h, w, 1); c.fillRect(x + w, y + 1, 1, h);
  }
  pill(x, y, w, h) { const c = this.ctx; c.fillStyle = C.hud; c.fillRect(x + 1, y, w - 2, h); c.fillRect(x, y + 1, w, h - 2); }
  hit(x, y, w, h) { const m = this.g.mouse; return m.x >= x && m.x < x + w && m.y >= y && m.y < y + h; }
  clicked(x, y, w, h, button = 0) { const k = this.g.mouse.click; if (!k || this.clickUsed) return false; if (k.x >= x && k.x < x + w && k.y >= y && k.y < y + h && (button === null || k.button === button)) { this.clickUsed = true; return true; } return false; }
  button(x, y, w, h, label, opts = {}) {
    const c = this.ctx;
    const hov = this.hit(x, y, w, h) && !opts.disabled;
    const col = opts.disabled ? '#a09080' : opts.color || C.green;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 1, y + 1, w, h);
    c.fillStyle = hov ? lighten(col) : col; c.fillRect(x, y, w, h);
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, w, 1);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 1, w, 1);
    text(c, label, x + w / 2, y + Math.floor((h - 8) / 2) + 1, opts.disabled ? '#e8e0d0' : '#fff', { align: 'center', shadow: 'rgba(0,0,0,0.4)' });
    if (hov && this.clicked(x, y, w, h)) { this.g.sfx.play('click'); return true; }
    return false;
  }
  icon(c, x, y, max = 14) {
    const s = Math.max(c.width, c.height) > max ? 0.5 : 1;
    const w = Math.round(c.width * s), h = Math.round(c.height * s);
    this.ctx.drawImage(c, 0, 0, c.width, c.height, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  }
  itemIcon(slot) {
    if (slot.kind === 'seed') return seedIcon(slot.id, RARITY[CROP[slot.id].rarity].color);
    if (slot.kind === 'gear') return S.gearIcon(slot.id);
    return S.eggSprite(slot.id, false);
  }
  itemName(slot) { return slot.kind === 'seed' ? CROP[slot.id].name + ' Seed' : slot.kind === 'gear' ? GEARMAP[slot.id].name : EGGMAP[slot.id].name; }

  // ---------------------------------------------------------------- frame
  frame(dt) {
    const g = this.g, c = this.ctx;
    this.clickUsed = false;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, VW, VH);
    if (g.mouse.wheel && !this.panel) { g.selected = (g.selected + g.mouse.wheel + INV_SLOTS) % INV_SLOTS; }
    this.drawHud();
    this.drawToasts();
    if (this.panel) this.drawPanel();
    else { this.drawPrompts(); }
    if (g.mouse.click && !this.clickUsed && !this.panel) g.worldClick(g.mouse.click.button);
    if (g.mouse.click && !this.clickUsed && this.panel) { /* clicks outside panel do nothing */ }
  }

  drawHud() {
    const g = this.g, c = this.ctx, s = g.s;
    // sheckles
    this.pill(4, 4, 96, 14);
    c.drawImage(S.coinIcon(), 7, 6);
    text(c, '¢' + fmt(s.sheckles), 19, 7, '#ffe680', { shadow: '#000' });
    // day/time
    const day = Math.floor(s.time / DAY_LEN) + 1;
    this.pill(4, 20, 96, 12);
    text(c, `Day ${day}  ${g.isNight ? (s.bloodMoon ? 'Blood Moon' : 'Night') : g.dayFrac < 0.05 ? 'Dawn' : g.dayFrac > 0.64 ? 'Evening' : 'Day'}`, 8, 22, '#e8e0d0');
    if (g.fast) text(c, '▶▶ x8', 104, 22, '#ffd23f', { shadow: '#000' });
    // weather banner
    const w = s.weather ? WEATHER[s.weather.id] : null;
    const label = w ? `${w.name}  ${fmtTime(s.weather.left)}` : g.isNight ? (s.bloodMoon ? 'Blood Moon' : 'Night') : 'Sunny';
    const col = w ? '#8ad6ff' : g.isNight ? (s.bloodMoon ? '#ff6b6b' : '#c9a8ff') : '#ffe680';
    const bw = width(label) + 16;
    this.pill(VW / 2 - bw / 2, 4, bw, 14);
    text(c, label, VW / 2, 7, col, { align: 'center', shadow: '#000' });
    // restock timers
    this.pill(VW - 70, 4, 66, 34);
    text(c, 'Restock', VW - 8, 6, '#8a8a8a', { align: 'right' });
    text(c, `Seeds ${fmtTime(s.shops.seeds.left)}`, VW - 8, 15, '#c8ffc0', { align: 'right' });
    text(c, `Gear ${fmtTime(s.shops.gear.left)}`, VW - 8, 24, '#b8d8ff', { align: 'right' });
    text(c, `Eggs ${fmtTime(s.shops.eggs.left)}`, VW - 8, 33, '#ffc8e8', { align: 'right' });
    // hotbar
    const n = INV_SLOTS, sw = 22, x0 = Math.round(VW / 2 - n * sw / 2), y0 = VH - 26;
    this.pill(x0 - 3, y0 - 3, n * sw + 6, 26);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * sw, slot = s.inv[i], sel = i === g.selected;
      c.fillStyle = sel ? '#ffd23f' : '#5a4a3a'; c.fillRect(x, y0, sw - 2, 20);
      c.fillStyle = sel ? '#8a6a2a' : '#2a2020'; c.fillRect(x + 1, y0 + 1, sw - 4, 18);
      if (slot) {
        this.icon(this.itemIcon(slot), x + 10, y0 + 9, 16);
        if (slot.n > 1 || slot.kind !== 'gear') text(c, String(slot.n), x + sw - 3, y0 + 12, '#fff', { align: 'right', shadow: '#000' });
        if (slot.kind === 'gear' && GEARMAP[slot.id].uses) { c.fillStyle = '#000'; c.fillRect(x + 2, y0 + 17, sw - 6, 2); c.fillStyle = '#6fb6ff'; c.fillRect(x + 2, y0 + 17, Math.round((sw - 6) * slot.uses / GEARMAP[slot.id].uses), 2); }
      }
      text(c, i < 9 ? String(i + 1) : i === 9 ? '0' : i === 10 ? '-' : '=', x + 2, y0 + 1, sel ? '#fff' : '#8a8080');
      if (this.clicked(x, y0, sw, 20)) { g.selected = i; g.sfx.play('click'); }
    }
    const held = s.inv[g.selected];
    const hl = g.carried ? `Carrying ${CROP[g.carried.crop].name} - click soil to replant` : held ? this.itemName(held) + (held.kind === 'gear' && GEARMAP[held.id].uses ? ` (${held.uses} uses)` : '') + '  -  ' + (held.kind === 'seed' ? 'click soil to plant' : held.kind === 'egg' ? 'place in the garden to hatch' : GEARMAP[held.id].desc) : 'Empty hand - click ripe crops to harvest';
    text(c, hl, VW / 2 + 10, y0 - 12, '#fff', { align: 'center', shadow: '#000', max: 270 });
    // side buttons
    const bp = `[B] Bag ${s.backpack.length}/${BACKPACK_CAP}`, pt = `[P] Pets ${g.equippedPets().length}/${MAX_PETS}`;
    if (this.button(4, VH - 40, width(bp) + 10, 12, bp, { color: '#6b4a2b' })) this.open('backpack');
    if (this.button(4, VH - 26, width(pt) + 10, 12, pt, { color: '#6b4a2b' })) this.open('pets');
    if (this.button(4, VH - 12, 50, 10, '[H] Help', { color: '#4a4a5a' })) this.open('help');
    if (this.button(VW - 54, 42, 50, 11, g.muted ? 'Unmute' : 'Mute [M]', { color: '#4a4a5a' })) { g.muted = !g.muted; g.sfx.muted = g.muted; }
  }

  drawPrompts() {
    const g = this.g, c = this.ctx;
    const px = g.player.x - g.cam.x, py = g.player.y - g.cam.y;
    if (g.nearStall) { const t = `[E] Talk to ${g.nearStall.who}`; this.pill(px - width(t) / 2 - 4, py - 36, width(t) + 8, 12); text(c, t, px, py - 34, '#ffe680', { align: 'center' }); }
    // tooltip for target
    if (g.target?.ok) {
      const p = g.plantAt(g.target.tx, g.target.ty);
      if (p) {
        const cr = CROP[p.crop];
        const lines = [`${p.variant !== 'Normal' ? p.variant + ' ' : ''}${cr.name}${p.fav ? ' ★' : ''}`];
        if (!p.ripe) lines.push(`${Math.floor(p.progress * 100)}% grown`);
        else { const ready = p.fruits.filter(Boolean); lines.push(ready.length ? `${ready.length} ready - click to harvest` : `regrowing ${fmtTime(Math.max(...p.regrow))}`); const muts = new Set(); for (const f of ready) for (const m of f.muts) muts.add(m); if (muts.size) lines.push([...muts].join(', ')); if (ready.length) lines.push(`worth ¢${fmt(ready.reduce((a, f) => a + fruitValue(f), 0))}`); }
        const w = Math.max(...lines.map((l) => width(l))) + 8, h = lines.length * 9 + 4;
        let x = clamp(g.mouse.x + 10, 2, VW - w - 2), y = clamp(g.mouse.y - h - 6, 2, VH - h - 2);
        this.pill(x, y, w, h);
        lines.forEach((l, i) => text(c, l, x + 4, y + 3 + i * 9, i === 0 ? RARITY[cr.rarity].color : '#e8e0d0'));
      }
    }
  }

  drawToasts() {
    const c = this.ctx, g = this.g;
    let y = 34;
    for (const t of g.toasts) {
      const w = width(t.text) + 10;
      c.globalAlpha = Math.min(1, t.t * 2);
      this.pill(VW / 2 - w / 2, y, w, 12);
      text(c, t.text, VW / 2, y + 2, t.color, { align: 'center' });
      c.globalAlpha = 1;
      y += 13;
    }
  }

  // ---------------------------------------------------------------- panels
  drawPanel() {
    const g = this.g, c = this.ctx;
    const w = 380, h = 240, x = Math.round(VW / 2 - w / 2), y = Math.round(VH / 2 - h / 2);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 0, VW, VH);
    this.box(x, y, w, h);
    c.fillStyle = C.title; c.fillRect(x + 1, y + 1, w - 2, 14);
    c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(x + 1, y + 1, w - 2, 1);
    text(c, SHOP_TITLES[this.panel], x + 8, y + 4, '#fff6dc', { shadow: 'rgba(0,0,0,0.4)' });
    if (this.button(x + w - 16, y + 2, 13, 12, 'X', { color: C.red })) this.close();
    const inner = { x: x + 6, y: y + 20, w: w - 12, h: h - 26 };
    if (this.panel === 'seeds' || this.panel === 'gear' || this.panel === 'eggs') this.drawShop(inner, this.panel);
    else if (this.panel === 'sell') this.drawSell(inner);
    else if (this.panel === 'backpack') this.drawBackpack(inner);
    else if (this.panel === 'pets') this.drawPets(inner);
    else if (this.panel === 'help') this.drawHelp(inner);
    if (g.mouse.click && !this.clickUsed) this.clickUsed = true;
  }
  list(inner, n, rowH, drawRow) {
    const c = this.ctx, g = this.g;
    const vis = Math.floor(inner.h / rowH);
    const max = Math.max(0, n - vis);
    if (g.mouse.wheel) this.scroll = clamp(this.scroll + g.mouse.wheel, 0, max);
    this.scroll = clamp(this.scroll, 0, max);
    c.save(); c.beginPath(); c.rect(inner.x, inner.y, inner.w, inner.h); c.clip();
    for (let i = this.scroll; i < Math.min(n, this.scroll + vis + 1); i++) {
      const ry = inner.y + (i - this.scroll) * rowH;
      c.fillStyle = i % 2 ? C.paper2 : C.paper; c.fillRect(inner.x, ry, inner.w - (max ? 6 : 0), rowH);
      drawRow(i, inner.x, ry, inner.w - (max ? 6 : 0), rowH);
    }
    c.restore();
    if (max) {
      c.fillStyle = C.paper2; c.fillRect(inner.x + inner.w - 5, inner.y, 5, inner.h);
      const th = Math.max(8, inner.h * vis / n), ty = inner.y + (inner.h - th) * this.scroll / max;
      c.fillStyle = C.border; c.fillRect(inner.x + inner.w - 4, Math.round(ty), 3, Math.round(th));
    }
    if (!n) text(c, 'Nothing here.', inner.x + inner.w / 2, inner.y + 20, C.dim, { align: 'center' });
  }
  drawShop(inner, kind) {
    const g = this.g, c = this.ctx, st = g.s.shops[kind];
    const defs = kind === 'seeds' ? CROPS : kind === 'gear' ? GEAR : EGGS;
    text(c, `Restock in ${fmtTime(st.left)}   Shift-click buys 5`, inner.x + inner.w - 2, inner.y, C.dim, { align: 'right' });
    const area = { x: inner.x, y: inner.y + 10, w: inner.w, h: inner.h - 10 };
    const items = defs.filter((d) => (st.stock[d.id] || 0) > 0 || kind !== 'seeds');
    this.list(area, items.length, 20, (i, x, y, w, h) => {
      const d = items[i], stock = st.stock[d.id] || 0, can = stock > 0 && g.s.sheckles >= d.price;
      const icon = kind === 'seeds' ? seedIcon(d.id, RARITY[d.rarity].color) : kind === 'gear' ? S.gearIcon(d.id) : S.eggSprite(d.id, false);
      this.icon(icon, x + 11, y + h / 2, 18);
      const col = kind === 'seeds' ? RARITY[d.rarity].color : kind === 'eggs' ? d.color : C.ink;
      text(c, d.name, x + 24, y + 2, kind === 'seeds' ? darken(col) : C.ink);
      let sub;
      if (kind === 'seeds') sub = `${d.rarity} · ${d.multi ? 'multi-harvest' : 'single'} · ${fmtTime(d.grow)} · ¢${fmt(d.value)} base`;
      else if (kind === 'gear') sub = d.desc;
      else sub = `Hatches in ${fmtTime(d.hatch)} · ${d.pets.map(([p, w]) => PETS[p].name + ' ' + w + '%').join(', ')}`;
      text(c, sub, x + 24, y + 11, C.dim, { max: w - 130 });
      text(c, '¢' + fmt(d.price), x + w - 70, y + 2, g.s.sheckles >= d.price ? C.green : C.red, { align: 'right' });
      text(c, stock ? `${stock} left` : 'sold out', x + w - 70, y + 11, stock ? C.ink : C.red, { align: 'right' });
      if (this.button(x + w - 64, y + 4, 56, 12, stock ? 'Buy' : 'Sold out', { disabled: !can })) g.buy(kind, d.id, g.mouse.click?.shift ? 5 : 1);
      else if (stock && can && this.hit(x, y, w - 66, h) && g.mouse.click && !this.clickUsed) { this.clickUsed = true; g.buy(kind, d.id, g.mouse.click.shift ? 5 : 1); }
    });
  }
  fruitRow(f, x, y, w, h, frame) {
    const c = this.ctx;
    this.icon(fruitSprite(f.crop, f.variant, f.muts, frame), x + 11, y + h / 2, 16);
    const cr = CROP[f.crop];
    text(c, fruitName(f), x + 24, y + 2, f.variant === 'Gold' ? '#b07a00' : f.variant === 'Rainbow' ? '#c03a9a' : darken(RARITY[cr.rarity].color), { max: w - 140 });
    text(c, `${f.w.toFixed(2)} kg${f.muts.length ? ' · ' + f.muts.map((m) => `${m} x${MUTATIONS[m].mult}`).join(' ') : ''}`, x + 24, y + 11, C.dim, { max: w - 140 });
    text(c, '¢' + fmt(fruitValue(f)), x + w - 72, y + 6, C.green, { align: 'right' });
  }
  drawSell(inner) {
    const g = this.g, c = this.ctx;
    const list = [...g.s.backpack].sort((a, b) => fruitValue(b) - fruitValue(a));
    const total = list.filter((f) => !f.fav).reduce((a, f) => a + fruitValue(f), 0);
    if (this.button(inner.x, inner.y, 150, 14, `Sell all for ¢${fmt(total)}`, { disabled: !total })) g.sellAll();
    text(c, 'Favorited (★) crops are kept.', inner.x + 156, inner.y + 3, C.dim);
    const area = { x: inner.x, y: inner.y + 18, w: inner.w, h: inner.h - 18 };
    const frame = Math.floor(g.t * 8) % 12;
    this.list(area, list.length, 20, (i, x, y, w, h) => {
      const f = list[i];
      this.fruitRow(f, x, y, w, h, frame);
      if (f.fav) text(c, '★', x + w - 66, y + 6, C.gold);
      else if (this.button(x + w - 64, y + 4, 56, 12, 'Sell')) { g.sellFruit(f); g.sfx.play('sell'); }
    });
  }
  drawBackpack(inner) {
    const g = this.g, c = this.ctx;
    const list = [...g.s.backpack].sort((a, b) => fruitValue(b) - fruitValue(a));
    const total = list.reduce((a, f) => a + fruitValue(f), 0);
    text(c, `${list.length}/${BACKPACK_CAP} crops · worth ¢${fmt(total)} · sell them at Steven's stand`, inner.x, inner.y + 3, C.ink);
    const area = { x: inner.x, y: inner.y + 14, w: inner.w, h: inner.h - 14 };
    const frame = Math.floor(g.t * 8) % 12;
    this.list(area, list.length, 20, (i, x, y, w, h) => {
      const f = list[i];
      this.fruitRow(f, x, y, w, h, frame);
      if (this.button(x + w - 64, y + 4, 56, 12, f.fav ? '★ Favorited' : '☆ Favorite', { color: f.fav ? C.gold : '#8a7055' })) f.fav = !f.fav;
    });
  }
  drawPets(inner) {
    const g = this.g, c = this.ctx;
    const pets = [...g.s.pets].sort((a, b) => (b.equipped - a.equipped));
    text(c, `Equipped ${g.equippedPets().length}/${MAX_PETS} · feed them crops from your bag · hungry pets stop working`, inner.x, inner.y + 2, C.ink, { max: inner.w });
    const area = { x: inner.x, y: inner.y + 12, w: inner.w, h: inner.h - 12 };
    this.list(area, pets.length, 40, (i, x, y, w, h) => {
      const p = pets[i], def = PETS[p.id];
      c.drawImage(S.petSprite(p.id, 0, false), x + 2, y + 8);
      text(c, `${p.name}  Lv ${g.petLevel(p)}${p.equipped ? '' : '  (stored)'}`, x + 28, y + 3, C.ink);
      const dl = wrap(def.desc, w - 150);
      text(c, dl[0], x + 28, y + 12, C.dim, { max: w - 150 }); if (dl[1]) text(c, dl[1], x + 28, y + 21, C.dim, { max: w - 150 });
      text(c, `Hunger ${Math.round(p.hunger)}%  ·  ${def.ability.cd ? `next ability in ${fmtTime(p.cd)}` : 'passive ability'}`, x + 28, y + 30, p.hunger > 0 ? C.dim : C.red);
      c.fillStyle = '#1b1220'; c.fillRect(x + w - 118, y + 22, 112, 6); c.fillStyle = p.hunger > 30 ? C.green : C.red; c.fillRect(x + w - 117, y + 23, Math.round(110 * p.hunger / 100), 4);
      const food = [...g.s.backpack].filter((f) => !f.fav).sort((a, b) => fruitValue(a) - fruitValue(b))[0];
      if (this.button(x + w - 118, y + 4, 54, 12, 'Feed', { disabled: !food || p.hunger >= 100 })) g.feedPet(p, food);
      if (this.button(x + w - 60, y + 4, 54, 12, p.equipped ? 'Unequip' : 'Equip', { color: p.equipped ? C.red : C.green })) g.equipPet(p, !p.equipped);
    });
    if (!pets.length) text(c, 'Buy an egg from Edna, place it in your garden and wait for it to hatch.', inner.x + inner.w / 2, inner.y + 40, C.dim, { align: 'center' });
  }
  drawHelp(inner) {
    const c = this.ctx, g = this.g, st = g.s.stats;
    const lines = [
      'WASD / arrows: walk (Shift to run).  E or click: use the held item on the tile under the cursor.',
      'Buy seeds from Sam, plant them on the soil beds, wait for them to ripen, then harvest and sell to Steven.',
      'Crops have a random weight: heavier fruit sells for more. 1% of plants are Gold (20x), 0.1% Rainbow (50x).',
      'Weather mutates ripe fruit: Rain=Wet, Frost=Chilled (Wet+Chilled=Frozen x10), Storm=Shocked x100,',
      'Night=Moonlit, Blood Moon=Bloodlit, Meteors=Celestial x120, Bees=Pollinated, Disco x125, and more.',
      'Mutations stack: price = base x weight² x variant x (1 + sum of mutations - count).',
      'Gear: sprinklers boost growth, size and mutations nearby. Lightning rods attract strikes.',
      'Eggs hatch into pets that work for you. Equip up to 3 and keep them fed.',
      '1-9/0/-/= or wheel: pick a hotbar slot.  B backpack  P pets  H help  M mute  Hold T: fast-forward.',
      'Your garden is saved automatically and keeps growing while you are away.',
      '',
      `Stats: earned ¢${fmt(st.earned)} · harvested ${st.harvested} · sold ${st.sold} · hatched ${st.hatched}`,
      st.best ? `Best crop: ${st.best.name} ${st.best.w.toFixed(2)}kg worth ¢${fmt(st.best.value)}` : 'Best crop: none yet',
    ];
    let y = inner.y + 2;
    for (const l of lines) { for (const w of wrap(l, inner.w - 4)) { text(c, w, inner.x + 2, y, C.ink); y += 9; } if (!l) y += 2; }
    if (this.button(inner.x + inner.w - 90, inner.y + inner.h - 14, 88, 12, 'Reset save', { color: C.red })) { if (confirm('Start a new garden? Your save will be deleted.')) { Game.clear(); location.reload(); } }
  }
}
function lighten(h) { const n = parseInt(h.slice(1), 16); const f = (v) => Math.min(255, Math.round(v + (255 - v) * 0.2)); return '#' + ((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1); }
function darken(h) { const n = parseInt(h.slice(1), 16); const f = (v) => Math.round(v * 0.55); return '#' + ((1 << 24) | (f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).slice(1); }
