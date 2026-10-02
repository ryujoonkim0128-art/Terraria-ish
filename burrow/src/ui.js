// The HUD, all icons and numbers: resources, clock and speed, tools and palettes, wordless goals, the title card.
import { VW, VH } from './render.js';
import { RES, ROOMS, ROOM_ORDER, OBJ, DECOR } from './content.js';
import { ICON, objSprite } from './sprites.js';
import { drawText, textWidth, drawBigText, bigTextWidth, clamp, INK } from './util.js';

const PANEL = '#1c1216', EDGE = '#5a4030', LIGHT = '#e8dcc0', DIM = '#8a7a68', GOLD = '#f0d060', BAD = '#e0485a';
const TOOLS = [['hand', 'hand'], ['dig', 'pick'], ['ladder', 'ladder'], ['room', 'room'], ['decor', 'decor'], ['erase', 'erase']];
const ROOM_ICON = { bedroom: 'bed', kitchen: 'stove', farm: 'plot', storage: 'crates', hearth: 'hearth', bath: 'tub', library: 'phonograph' };

const GOALS = [
  { icons: ['pick'], have: (g) => g.stats.dug, n: 12, tool: 'dig' },
  { icons: ['room', 'o:stove'], have: (g) => g.stats.rooms.kitchen || 0, n: 1, tool: 'room', pick: 'kitchen' },
  { icons: ['axe', 'wood'], have: (g) => g.stats.chopped, n: 2, tool: 'hand' },
  { icons: ['room', 'o:plot'], have: (g) => g.stats.rooms.farm || 0, n: 1, tool: 'room', pick: 'farm' },
  { icons: ['room', 'o:bed'], have: (g) => g.stats.rooms.bedroom || 0, n: 1, tool: 'room', pick: 'bedroom' },
  { icons: ['decor', 'o:lantern'], have: (g) => g.stats.decor, n: 3, tool: 'decor' },
  { icons: ['folk'], have: (g) => g.folk.filter((f) => !f.arriving).length, n: 5 },
  { icons: ['room', 'o:crates'], have: (g) => g.stats.rooms.storage || 0, n: 1, tool: 'room', pick: 'storage' },
  { icons: ['room', 'o:tub'], have: (g) => g.stats.rooms.bath || 0, n: 1, tool: 'room', pick: 'bath' },
  { icons: ['room', 'o:phonograph'], have: (g) => g.stats.rooms.library || 0, n: 1, tool: 'room', pick: 'library' },
  { icons: ['folk'], have: (g) => g.folk.filter((f) => !f.arriving).length, n: 10 },
  { icons: ['cozy'], have: (g) => g.cozy(), n: 80 },
  { icons: ['folk'], have: (g) => g.folk.filter((f) => !f.arriving).length, n: 16 },
];

export class UI {
  constructor(game) {
    this.g = game;
    this.bumps = {}; this.rects = []; this.hoverRect = null;
    this.goalFlash = 0; this.titleT = 0;
  }
  bump(k, bad) { this.bumps[k] = { t: 0.5, bad }; }
  update(dt) {
    for (const k in this.bumps) { this.bumps[k].t -= dt; if (this.bumps[k].t <= 0) delete this.bumps[k]; }
    if (this.goalFlash > 0) this.goalFlash -= dt;
    this.titleT += dt;
  }

  startGame() {
    const g = this.g;
    if (g.started) return;
    g.started = true;
    g.audio.start();
    g.audio.play('chime', 5);
    g.camGlide = null;
  }

  checkGoals() {
    const g = this.g;
    if (!g.started || g.goal >= GOALS.length) return;
    const G = GOALS[g.goal];
    if (G.have(g) >= G.n) {
      g.goal++;
      this.goalFlash = 1.5;
      g.audio.play('cheer');
      for (let i = 0; i < 20; i++) g.parts.push({ x: g.cam.x + VW / 2 + (Math.random() - 0.5) * 60, y: g.cam.y + 26, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 40, life: 1.4, col: ['#f0d060', '#e0485a', '#7ad06a', '#4ab0e0'][i % 4], glow: true, grav: 90 });
    }
  }

  // Returns true when the click landed on the HUD.
  click(x, y, btn = 0) {
    const g = this.g;
    for (const r of this.rects) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        if (btn === 0 || !g.started) r.fn();
        return true;
      }
    }
    return !g.started;
  }

  // ---------- drawing ----------
  draw(hx, time) {
    const g = this.g;
    this.rects = [];
    this.drawPopups(hx);
    if (!g.started) { this.drawTitle(hx, time); return; }
    this.drawCursorWorld(hx, time);
    this.drawResources(hx);
    this.drawTopRight(hx, time);
    this.drawGoal(hx, time);
    this.drawToolbar(hx, time);
    this.drawArrival(hx, time);
    this.drawCursor(hx, time);
  }

  panel(hx, x, y, w, h) {
    hx.fillStyle = INK; hx.fillRect(x - 1, y, w + 2, h); hx.fillRect(x, y - 1, w, h + 2);
    hx.fillStyle = EDGE; hx.fillRect(x, y, w, h);
    hx.fillStyle = PANEL; hx.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
  button(hx, x, y, w, h, icon, on, fn, opts = {}) {
    const m = this.g.mouse;
    const hover = m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
    this.panel(hx, x, y, w, h);
    if (on) { hx.fillStyle = '#6a4a2a'; hx.fillRect(x + 1, y + 1, w - 2, h - 2); hx.fillStyle = GOLD; hx.fillRect(x + 1, y + h - 2, w - 2, 1); }
    else if (hover) { hx.fillStyle = '#2e2024'; hx.fillRect(x + 1, y + 1, w - 2, h - 2); }
    if (opts.pulse) {
      const a = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      hx.fillStyle = `rgba(240,208,96,${a})`;
      hx.fillRect(x - 2, y - 2, w + 4, 1); hx.fillRect(x - 2, y + h + 1, w + 4, 1); hx.fillRect(x - 2, y - 2, 1, h + 4); hx.fillRect(x + w + 1, y - 2, 1, h + 4);
    }
    if (icon) {
      const img = typeof icon === 'string' ? ICON[icon] : icon;
      const s = img.width > w - 2 || img.height > h - 2 ? Math.min((w - 2) / img.width, (h - 2) / img.height) : 1;
      const iw = Math.round(img.width * s), ih = Math.round(img.height * s);
      hx.globalAlpha = opts.dim ? 0.4 : 1;
      hx.drawImage(img, Math.round(x + (w - iw) / 2), Math.round(y + (h - ih) / 2 + (hover && !on ? -1 : 0)), iw, ih);
      hx.globalAlpha = 1;
    }
    if (opts.key) drawText(hx, opts.key, x + w - 4, y + h - 6, DIM);
    this.rects.push({ x, y, w, h, fn });
    return hover;
  }

  drawResources(hx) {
    const g = this.g;
    const x0 = 4, y0 = 4, cw = 30;
    this.panel(hx, x0, y0, RES.length * cw + 2, 15);
    const m = g.mouse;
    RES.forEach((k, i) => {
      const x = x0 + 2 + i * cw, b = this.bumps[k];
      const jx = b ? Math.round(Math.sin(b.t * 50) * (b.bad ? 2 : 0)) : 0, jy = b && !b.bad ? -Math.round(Math.sin(b.t * 6.28) * 2) : 0;
      hx.drawImage(ICON[k], x + jx, y0 + 3 + jy);
      const v = Math.floor(g.res[k]), cap = g.cap(k);
      const col = b?.bad ? BAD : v >= cap ? GOLD : LIGHT;
      drawText(hx, String(v), x + 11 + jx, y0 + 5, col, 1, INK);
      if (m.x >= x && m.x < x + cw && m.y >= y0 && m.y < y0 + 15) {
        const s = v + '/' + cap;
        this.panel(hx, x - 2, y0 + 17, textWidth(s) + 6, 9);
        drawText(hx, s, x + 1, y0 + 19, LIGHT);
      }
    });
  }

  drawTopRight(hx, time) {
    const g = this.g;
    let x = VW - 4;
    const y = 4, h = 15;
    // sound
    x -= 15; this.button(hx, x, y, 15, h, g.audio.muted ? 'mute' : 'sound', false, () => { g.audio.setMuted(!g.audio.muted); g.audio.play('click'); });
    // speeds
    x -= 3;
    for (let s = 3; s >= 0; s--) {
      x -= 15;
      this.button(hx, x, y, 15, h, ['pause', 'play1', 'play2', 'play3'][s], g.speed === s, () => { g.speed = s; g.audio.play('click'); });
    }
    // clock: sun or moon over a day count
    x -= 3; x -= 30;
    this.panel(hx, x, y, 30, h);
    const dl = g.daylight();
    hx.drawImage(dl > 0.4 ? ICON.sun : ICON.moon, x + 2, y + 3);
    drawText(hx, String(g.day), x + 13, y + 5, LIGHT, 1, INK);
    hx.fillStyle = '#3a2a2e'; hx.fillRect(x + 2, y + h - 3, 26, 1);
    hx.fillStyle = GOLD; hx.fillRect(x + 2 + Math.floor(g.time * 26), y + h - 3, 1, 1);
    // cosiness, happiness, folk / beds
    const joy = Math.round(g.avgJoy() * 100);
    const beds = g.world.objectsOf('bed').length;
    const items = [['cozy', String(g.cozy())], ['heart', String(joy)], ['folk', g.folk.length + '/' + beds]];
    for (let i = items.length - 1; i >= 0; i--) {
      const [ic, s] = items[i];
      const w = 14 + textWidth(s);
      x -= w + 4 + 2;
      this.panel(hx, x, y, w + 4, h);
      hx.drawImage(ICON[ic], x + 2, y + 3);
      drawText(hx, s, x + 13, y + 5, ic === 'heart' && joy < 35 ? BAD : LIGHT, 1, INK);
    }
    if (g.cold) {
      const a = 0.5 + 0.5 * Math.sin(time * 5);
      hx.globalAlpha = a; hx.drawImage(ICON.cold, x - 12, y + 3); hx.globalAlpha = 1;
    }
  }

  drawGoal(hx, time) {
    const g = this.g;
    const done = g.goal >= GOALS.length;
    const G = GOALS[Math.min(g.goal, GOALS.length - 1)];
    const imgs = done ? [ICON.star, ICON.heart, ICON.star] : G.icons.map((k) => (k.startsWith('o:') ? objSprite(k.slice(2)) : ICON[k]));
    const prog = done ? '' : Math.min(G.have(g), G.n) + '/' + G.n;
    let w = 6;
    const sizes = imgs.map((im) => { const s = Math.min(1, 12 / im.height, 16 / im.width); return [Math.round(im.width * s), Math.round(im.height * s)]; });
    for (const [iw] of sizes) w += iw + 3;
    w += textWidth(prog) + 4;
    const x = Math.round(VW / 2 - w / 2), y = 4 + (this.goalFlash > 0 ? Math.round(Math.sin(this.goalFlash * 10) * 2) : 0);
    this.panel(hx, x, y, w, 16);
    if (this.goalFlash > 0) { hx.fillStyle = `rgba(122,208,106,${this.goalFlash / 1.5})`; hx.fillRect(x + 1, y + 1, w - 2, 14); }
    let cx = x + 4;
    imgs.forEach((im, i) => { const [iw, ih] = sizes[i]; hx.drawImage(im, cx, y + Math.round((16 - ih) / 2), iw, ih); cx += iw + 3; });
    drawText(hx, prog, cx, y + 6, LIGHT, 1, INK);
    if (this.goalFlash > 0) hx.drawImage(ICON.check, x + w - 4, y - 4);
  }

  drawToolbar(hx, time) {
    const g = this.g;
    const bw = 20, gap = 3, n = TOOLS.length;
    const x0 = Math.round(VW / 2 - (n * (bw + gap) - gap) / 2), y0 = VH - bw - 4;
    const G = GOALS[g.goal];
    TOOLS.forEach(([t, ic], i) => {
      const pulse = G && G.tool === t && g.tool !== t;
      this.button(hx, x0 + i * (bw + gap), y0, bw, bw, ic, g.tool === t, () => g.setTool(t, this.defaultPick(t)), { key: String(i + 1), pulse });
    });
    // palettes
    if (g.tool === 'room' || g.tool === 'decor') {
      const list = g.tool === 'room' ? ROOM_ORDER : DECOR;
      const pw = 22, py = y0 - pw - 6;
      const px0 = Math.round(VW / 2 - (list.length * (pw + 2) - 2) / 2);
      let hover = null;
      list.forEach((k, i) => {
        const cost = g.tool === 'room' ? ROOMS[k].cost : OBJ[k].cost;
        const icon = objSprite(g.tool === 'room' ? ROOM_ICON[k] : k, k === 'plant' ? 2 : 0);
        const pulse = G && G.pick === k && g.pick !== k;
        const h = this.button(hx, px0 + i * (pw + 2), py, pw, pw, icon, g.pick === k, () => { g.pick = k; g.audio.play('click'); }, { dim: !g.afford(cost), pulse });
        if (h) hover = { k, i, cost };
      });
      const show = hover || (g.pick && list.includes(g.pick) ? { k: g.pick, i: list.indexOf(g.pick), cost: g.tool === 'room' ? ROOMS[g.pick].cost : OBJ[g.pick].cost } : null);
      if (show) this.costCard(hx, px0 + show.i * (pw + 2) + pw / 2, py - 4, show.cost, g.tool === 'room' ? ROOMS[show.k] : null);
    }
  }
  costCard(hx, cx, by, cost, room) {
    const g = this.g;
    const ks = Object.keys(cost);
    const items = ks.map((k) => [k, String(cost[k])]);
    let w = 4;
    for (const [, s] of items) w += 12 + textWidth(s) + 4;
    if (!ks.length) w += 10;
    let size = '';
    if (room) { size = room.w + 'x' + room.h; w += textWidth(size) + 8; }
    const x = Math.round(clamp(cx - w / 2, 2, VW - w - 2)), y = by - 13;
    this.panel(hx, x, y, w, 13);
    let px = x + 3;
    for (const [k, s] of items) {
      hx.drawImage(ICON[k], px, y + 2);
      drawText(hx, s, px + 11, y + 4, (g.res[k] || 0) >= cost[k] ? LIGHT : BAD);
      px += 12 + textWidth(s) + 4;
    }
    if (!ks.length) hx.drawImage(ICON.check, px, y + 2);
    if (room) { hx.fillStyle = EDGE; hx.fillRect(px - 2, y + 2, 1, 9); drawText(hx, size, px + 2, y + 4, DIM); }
  }

  // What a palette opens on: the last pick of that kind, the current goal's pick, or the first entry.
  defaultPick(t) {
    const g = this.g, G = GOALS[g.goal];
    if (t === 'room') return g.pick && ROOMS[g.pick] ? g.pick : G?.pick || 'bedroom';
    if (t === 'decor') return g.pick && DECOR.includes(g.pick) ? g.pick : 'lantern';
    return null;
  }

  drawArrival(hx, time) {
    const g = this.g, a = g.arrival;
    if (!a || !a.f.arriving) return;
    const sx = a.f.x - g.cam.x, sy = a.f.y - g.cam.y;
    if (sx > 0 && sx < VW && sy > 0 && sy < VH) return;
    const x = clamp(sx, 14, VW - 26), y = clamp(sy - 10, 26, VH - 44);
    const bob = Math.round(Math.sin(time * 6) * 2);
    const left = sx < 0;
    this.button(hx, x + (left ? bob : -bob), y, 16, 14, 'folk', false, () => { g.camGlide = { x: clamp(a.f.x - VW / 2, 0, 1e9), y: clamp(a.f.y - VH / 2, 0, 1e9) }; g.audio.play('click'); });
    hx.fillStyle = GOLD;
    for (let k = 0; k < 4; k++) hx.fillRect(left ? x - 3 + k + bob : x + 18 - k - bob, y + 7 - k, 1, k * 2 + 1);
  }

  drawPopups(hx) {
    const g = this.g;
    for (const p of g.popups) {
      const x = Math.round(p.x - g.cam.x), y = Math.round(p.y - g.cam.y);
      if (x < -20 || x > VW + 20 || y < -20 || y > VH + 20) continue;
      hx.globalAlpha = clamp(p.life * 1.5, 0, 1);
      const s = (p.n > 0 ? '+' : '') + p.n;
      hx.drawImage(ICON[p.icon], x - 10, y - 4);
      drawText(hx, s, x, y - 2, p.full && p.n === 0 ? DIM : p.n < 0 ? BAD : '#a8f090', 1, INK);
      hx.globalAlpha = 1;
    }
  }

  // ---------- cursor & previews ----------
  drawCursorWorld(hx, time) {
    const g = this.g, m = g.mouse;
    if (!m.inside || this.overHud()) return;
    const { wx, wy, cx, cy } = g.world2cell();
    const ox = -Math.round(g.cam.x), oy = -Math.round(g.cam.y);
    const w = g.world;
    if (g.tool === 'hand' && !g.drag?.carry && !g.drag?.carryObj) {
      const h = g.drag?.hit && !g.drag.moved ? g.drag.hit : g.hitTest(wx, wy);
      let box = null;
      if (h?.kind === 'folk') { box = [h.ref.x - 5, h.ref.y - 14, 11, 15]; this.folkCard(hx, h.ref, ox, oy); }
      else if (h?.kind === 'cat') box = [h.ref.x - 6, h.ref.y - 8, 12, 9];
      else if (h?.kind === 'obj') { const s = objSprite(h.ref.type, h.ref.size || 0); box = [h.ref.x * 8 - 1 + (s.offX || 0), h.ref.y * 8 - 1 + (s.offY || 0), s.width, s.height]; }
      else if (h?.kind === 'tree') { const gy = w.surface[h.ref.x] * 8, th = h.ref.stage === 'grown' ? h.ref.h * 8 + 4 : 8; box = [h.ref.x * 8 - 12, gy - th, 32, th]; }
      else if (h?.kind === 'bush') box = [h.ref.x * 8, w.surface[h.ref.x] * 8 - 10, 16, 10];
      if (box) this.brackets(hx, box[0] + ox, box[1] + oy, box[2], box[3], LIGHT, time);
    } else if (g.tool === 'dig') {
      for (const y of [cy, cy - 1]) {
        const ok = w.diggable(cx, y);
        hx.fillStyle = ok ? 'rgba(255,215,120,0.6)' : 'rgba(224,72,90,0.35)';
        this.rectOutline(hx, cx * 8 + ox, y * 8 + oy, 8, 8);
      }
    } else if (g.tool === 'ladder') {
      hx.fillStyle = 'rgba(200,148,90,0.8)'; this.rectOutline(hx, cx * 8 + ox, cy * 8 + oy, 8, 8);
      hx.fillRect(cx * 8 + ox + 1, cy * 8 + oy, 1, 8); hx.fillRect(cx * 8 + ox + 6, cy * 8 + oy, 1, 8); hx.fillRect(cx * 8 + ox + 2, cy * 8 + oy + 3, 4, 1);
    } else if (g.tool === 'room' && g.pick) {
      const R = ROOMS[g.pick], x = cx - (R.w >> 1), y = cy - R.h + 1;
      const ok = w.canPlaceRoom(g.pick, x, y) && g.afford(R.cost);
      for (const [a, b] of w.roomCells(g.pick, x, y)) { hx.fillStyle = ok ? 'rgba(122,208,106,0.18)' : 'rgba(224,72,90,0.2)'; hx.fillRect(a * 8 + ox, b * 8 + oy, 8, 8); }
      g.roomOutline(hx, g.pick, x, y, ox, oy, ok ? '#a8f090' : BAD, time);
      hx.fillStyle = ok ? 'rgba(168,240,144,0.5)' : 'rgba(224,72,90,0.4)';
      hx.fillRect(x * 8 + ox, (y + R.h) * 8 + oy, R.w * 8, 2);
      hx.globalAlpha = 0.55;
      for (const [type, dx, lift] of R.furn) {
        const O = OBJ[type], s = objSprite(type);
        const oy2 = O.mount === 'ceil' ? y : O.mount === 'wall' ? y + R.h - O.h - (lift ?? O.lift ?? 1) : y + R.h - O.h;
        hx.drawImage(s, (x + dx) * 8 - 1 + ox, oy2 * 8 - 1 + oy);
      }
      hx.globalAlpha = 1;
    } else if (g.tool === 'decor' && g.pick) {
      const s = w.decorSpot(g.pick, cx, cy), O = OBJ[g.pick];
      const ok = s.ok && g.afford(O.cost);
      const img = objSprite(g.pick, g.pick === 'plant' ? 0 : 0);
      hx.globalAlpha = 0.7;
      hx.drawImage(img, s.x * 8 - 1 + ox + (img.offX || 0), s.y * 8 - 1 + oy + (img.offY || 0));
      hx.globalAlpha = 1;
      hx.fillStyle = ok ? 'rgba(168,240,144,0.7)' : 'rgba(224,72,90,0.7)';
      this.rectOutline(hx, s.x * 8 + ox, s.y * 8 + oy, O.w * 8, O.h * 8);
    } else if (g.tool === 'erase') {
      const o = g.objectAt(wx, wy);
      if (o && o.room < 0 && OBJ[o.type].cost) { const s = objSprite(o.type, o.size || 0); this.brackets(hx, o.x * 8 - 1 + ox + (s.offX || 0), o.y * 8 - 1 + oy + (s.offY || 0), s.width, s.height, BAD, time); }
      else { const r = w.roomOf(cx, cy); if (r && r.state !== 'done') g.roomOutline(hx, r.type, r.x, r.y, ox, oy, BAD, time); }
    }
  }
  folkCard(hx, f, ox, oy) {
    const x = Math.round(f.x + ox + 8), y = Math.round(f.y + oy - 26);
    this.panel(hx, x, y, 34, 26);
    [['zzz', f.energy, '#8ab0ff'], ['hungry', f.hunger, '#e0a050'], ['heart', f.joy, '#e0485a']].forEach(([ic, v, col], i) => {
      hx.drawImage(ICON[ic], x + 1, y + 1 + i * 8, 7, 7);
      hx.fillStyle = '#3a2a2e'; hx.fillRect(x + 10, y + 3 + i * 8, 22, 3);
      hx.fillStyle = v < 0.25 ? BAD : col; hx.fillRect(x + 10, y + 3 + i * 8, Math.round(22 * v), 3);
    });
  }
  brackets(hx, x, y, w, h, col, time) {
    const p = Math.round(Math.sin(time * 6)) + 1;
    x -= p; y -= p; w += p * 2; h += p * 2;
    hx.fillStyle = col;
    for (const [a, b, sx, sy] of [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]) {
      hx.fillRect(Math.min(a, a + sx * 2), b, 3, 1); hx.fillRect(a, Math.min(b, b + sy * 2), 1, 3);
    }
  }
  rectOutline(hx, x, y, w, h) { hx.fillRect(x, y, w, 1); hx.fillRect(x, y + h - 1, w, 1); hx.fillRect(x, y, 1, h); hx.fillRect(x + w - 1, y, 1, h); }
  overHud() {
    const m = this.g.mouse;
    return this.rects.some((r) => m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h);
  }
  drawCursor(hx) {
    const g = this.g, m = g.mouse;
    if (!m.inside) return;
    if (this.overHud()) { hx.drawImage(ICON.hand, m.x - 3, m.y - 1); return; }
    const icon = g.drag?.carry || g.drag?.carryObj ? 'hand' : TOOLS.find(([t]) => t === g.tool)[1];
    hx.drawImage(ICON[icon], m.x + 3, m.y + 3);
    hx.fillStyle = INK; hx.fillRect(m.x - 2, m.y, 5, 1); hx.fillRect(m.x, m.y - 2, 1, 5);
    hx.fillStyle = LIGHT; hx.fillRect(m.x, m.y, 1, 1);
  }

  // ---------- title ----------
  drawTitle(hx, time) {
    const g = this.g;
    const title = 'HEARTHBURROW', sc = 2;
    const tw = bigTextWidth(title, sc);
    const x = Math.round(VW / 2 - tw / 2), y = 40 + Math.round(Math.sin(time * 1.2) * 2);
    for (let k = 0; k < 64; k += 2) { hx.fillStyle = `rgba(12,8,12,${0.5 * Math.sin((k / 64) * Math.PI)})`; hx.fillRect(0, y - 20 + k, VW, 2); }
    drawBigText(hx, title, x + 2, y + 2, INK, sc);
    drawBigText(hx, title, x, y, '#b07a30', sc);
    drawBigText(hx, title, x, y - 1, GOLD, sc);
    for (let i = 0; i < 5; i++) hx.drawImage(ICON[['fire', 'heart', 'star', 'heart', 'fire'][i]], VW / 2 - 40 + i * 18, y + 18);
    const by = 104;
    const play = () => { g.audio.play('click'); this.startGame(); };
    const bigPlay = this.bigButton(hx, VW / 2 - (g.hasSave ? 34 : 14), by, 'play1', play, time);
    if (g.hasSave) this.bigButton(hx, VW / 2 + 6, by, 'room', () => { g.newGame(); g.audio.play('click'); this.startGame(); }, time, true);
    // a wordless hint of the controls
    const hy = 236;
    const hints = [['hand', 'folk'], ['pick', 'stone'], ['room', 'o:bed'], ['decor', 'o:lantern']];
    let hx0 = VW / 2 - (hints.length * 40) / 2;
    for (const [a, b] of hints) {
      this.panel(hx, hx0, hy, 34, 16);
      hx.drawImage(ICON[a], hx0 + 3, hy + 4);
      const im = b.startsWith('o:') ? objSprite(b.slice(2)) : ICON[b];
      const s = Math.min(1, 12 / im.height, 14 / im.width);
      hx.drawImage(im, hx0 + 18, hy + Math.round((16 - im.height * s) / 2), Math.round(im.width * s), Math.round(im.height * s));
      hx0 += 40;
    }
    void bigPlay;
    if (g.mouse.inside) hx.drawImage(ICON.hand, g.mouse.x - 3, g.mouse.y - 1);
  }
  bigButton(hx, x, y, icon, fn, time, small) {
    const m = this.g.mouse, w = 28, h = 28;
    const hover = m.x >= x && m.x < x + w && m.y >= y && m.y < y + h;
    const bob = small ? 0 : Math.round(Math.sin(time * 3) * 1.5);
    this.panel(hx, x, y + bob, w, h);
    if (hover) { hx.fillStyle = '#3a2a2e'; hx.fillRect(x + 1, y + 1 + bob, w - 2, h - 2); }
    hx.drawImage(ICON[icon], x + 5, y + 5 + bob, 18, 18);
    this.rects.push({ x, y, w, h, fn });
    return hover;
  }
}
