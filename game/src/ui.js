// HUD and menus, drawn at native pixel resolution on the overlay canvas.
import { ITEMS, RECIPES } from './content.js';
import { itemIcon } from './sprites.js';
import { tileIcon, VW, VH } from './render.js';
import { ROLE_NAMES } from './ai.js';

const G = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010', ':': '000010000010000',
  "'": '010010000000000', '-': '000000111000000', '+': '000010111010000', '/': '001001010100100', '(': '010100100100010',
  ')': '010001001001010', '~': '000000011110000', '<': '001010100010001', '>': '100010001010100', '%': '101001010100101',
  '#': '101111101111101', '&': '010101010101011', '=': '000111000111000', '*': '000101010101000', ' ': '000000000000000',
  '♥': '000101111111010', 'z': '000111001010111',
};

export function text(x, str, px, py, col, scale = 1, shadow = '#140e12') {
  str = String(str);
  const draw = (ox, oy, c) => {
    x.fillStyle = c;
    let cx = px + ox;
    for (const chRaw of str) {
      const ch = G[chRaw] ? chRaw : G[chRaw.toUpperCase()] ? chRaw.toUpperCase() : ' ';
      const g = G[ch];
      for (let i = 0; i < 15; i++) if (g[i] === '1') x.fillRect(cx + (i % 3) * scale, py + oy + Math.floor(i / 3) * scale, scale, scale);
      cx += 4 * scale;
    }
  };
  if (shadow) draw(scale, scale, shadow);
  draw(0, 0, col);
}
export const textW = (s, scale = 1) => String(s).length * 4 * scale - scale;

const COL = { panel: '#1c1418', panelHi: '#2c2026', edge: '#5a4030', edgeHi: '#8c643c', ink: '#140e12', text: '#e8dcc0', dim: '#8a7a68', gold: '#f0c060', red: '#e05a48', green: '#8ac060' };

function box(x, bx, by, w, h, fill = COL.panel, edge = COL.edge) {
  x.fillStyle = COL.ink; x.fillRect(bx - 1, by - 1, w + 2, h + 2);
  x.fillStyle = edge; x.fillRect(bx, by, w, h);
  x.fillStyle = fill; x.fillRect(bx + 1, by + 1, w - 2, h - 2);
}

export const icon = (id) => itemIcon(id, ITEMS[id], tileIcon);

function slot(x, sx, sy, s, sel, dim) {
  box(x, sx, sy, 18, 18, sel ? '#3a2a22' : COL.panelHi, sel ? COL.gold : COL.edge);
  if (!s) return;
  x.globalAlpha = dim ? 0.35 : 1;
  x.drawImage(icon(s.id), sx + 3, sy + 3);
  x.globalAlpha = 1;
  if (s.n > 1) text(x, s.n > 999 ? '999' : s.n, sx + 18 - textW(String(s.n)) - 1, sy + 12, COL.text);
}

export class UI {
  constructor(game) {
    this.g = game;
    this.toasts = [];
    this.nameT = 0; this.lastSel = -1;
    this.open = false; this.help = true; this.started = false;
    this.hoverRecipe = null;
  }
  toast(msg, col = COL.text) { this.toasts.push({ msg, t: 4.5, col }); if (this.toasts.length > 4) this.toasts.shift(); }

  // ---------------------------------------------------------------- layout helpers
  hotbarRect(i) { return [VW / 2 - 99 + i * 20, VH - 24]; }
  invRect(i) { const r = Math.floor(i / 10), c = i % 10; return [VW / 2 - 99 + c * 20, 70 + r * 20]; }
  recipeRect(i) { const c = i % 12, r = Math.floor(i / 12); return [VW / 2 - 119 + c * 20, 150 + r * 20]; }

  click(mx, my, button) {
    const g = this.g, inv = g.inv;
    if (!this.started) { this.started = true; g.audio.start(); return true; }
    if (!this.open) {
      for (let i = 0; i < 10; i++) {
        const [sx, sy] = this.hotbarRect(i);
        if (mx >= sx && mx < sx + 18 && my >= sy && my < sy + 18) { inv.sel = i; return true; }
      }
      return false;
    }
    for (let i = 0; i < 30; i++) {
      const [sx, sy] = this.invRect(i);
      if (mx >= sx && mx < sx + 18 && my >= sy && my < sy + 18) { inv.clickSlot(i); g.audio.play('pickup'); return true; }
    }
    for (let i = 0; i < RECIPES.length; i++) {
      const [sx, sy] = this.recipeRect(i);
      if (mx >= sx && mx < sx + 18 && my >= sy && my < sy + 18) {
        const r = RECIPES[i];
        const times = button === 2 ? 5 : 1;
        let made = 0;
        for (let k = 0; k < times; k++) if (inv.craft(r)) made++;
        if (made) { g.audio.play('craft'); this.toast(`Crafted ${ITEMS[r.out].name} x${r.n * made}`, COL.green); }
        else this.toast(`Need: ${costText(r)}`, COL.dim);
        return true;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- draw
  draw(x, dt) {
    const g = this.g, inv = g.inv, p = g.player;
    x.clearRect(0, 0, VW, VH);
    x.imageSmoothingEnabled = false;

    // world-space overlays: bubbles, hover name, cursor, ghost
    this.drawWorldOverlays(x);

    // hearts
    for (let i = 0; i < p.maxHp / 2; i++) {
      const hx = 8 + i * 10, hy = 8, v = p.hp - i * 2;
      heart(x, hx, hy, v >= 2 ? '#e04848' : v === 1 ? '#a03838' : '#3a2a2e', v >= 2);
    }
    // clock + place
    const t = g.time, hrs = Math.floor(t * 24), mins = Math.floor((t * 24 - hrs) * 60 / 10) * 10;
    const clock = `DAY ${g.day}  ${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    const night = t < 0.24 || t > 0.78;
    text(x, clock, VW - textW(clock) - 20, 9, night ? '#a8b8e8' : COL.gold);
    x.fillStyle = night ? '#d8e0f0' : '#f0c060';
    x.beginPath(); x.arc(VW - 12, 11, 4, 0, 7); x.fill();
    if (night) { x.fillStyle = '#140e12'; x.beginPath(); x.arc(VW - 10, 10, 3, 0, 7); x.fill(); }
    const v = g.nearVillage;
    if (v) {
      const mood = v.grudge < 1 ? ['FRIENDLY', COL.green] : v.grudge < 3 ? ['UNEASY', '#d8c060'] : v.grudge < 6 ? ['WARY', '#e09048'] : ['HOSTILE', COL.red];
      const label = v.name.toUpperCase();
      text(x, label, VW - textW(label) - 8, 20, COL.text);
      text(x, mood[0], VW - textW(mood[0]) - 8, 28, mood[1]);
    }
    if (g.timeFast) text(x, 'TIME >>', VW / 2 - 14, 8, COL.gold);

    // hotbar
    for (let i = 0; i < 10; i++) {
      const [sx, sy] = this.hotbarRect(i);
      slot(x, sx, sy, inv.slots[i], inv.sel === i);
      text(x, (i + 1) % 10, sx + 2, sy + 2, COL.dim, 1, null);
    }
    if (inv.sel !== this.lastSel) { this.lastSel = inv.sel; this.nameT = 2; }
    this.nameT -= dt;
    if (this.nameT > 0 && inv.held) {
      const n = ITEMS[inv.held.id].name.toUpperCase();
      text(x, n, VW / 2 - textW(n) / 2, VH - 34, COL.text);
    }

    // toasts
    let ty = 44;
    for (const tt of this.toasts) {
      tt.t -= dt;
      x.globalAlpha = Math.min(1, tt.t);
      const m = tt.msg.toUpperCase();
      x.fillStyle = 'rgba(20,14,18,0.72)';
      x.fillRect(VW / 2 - textW(m) / 2 - 4, ty - 3, textW(m) + 8, 11);
      text(x, m, VW / 2 - textW(m) / 2, ty, tt.col);
      ty += 10;
    }
    x.globalAlpha = 1;
    this.toasts = this.toasts.filter((tt) => tt.t > 0);

    if (this.open) this.drawInventory(x);
    else if (this.help && this.started) {
      const lines = ['A D MOVE   SPACE JUMP   W S CLIMB', 'LEFT CLICK MINE / ATTACK', 'RIGHT CLICK PLACE / GIVE / EAT', 'E INVENTORY + CRAFTING', 'HOLD T FAST-FORWARD TIME', 'H HIDE HELP   M MUTE'];
      lines.forEach((l, i) => text(x, l, 8, VH - 64 + i * 8, COL.dim));
    }
    if (g.dead) {
      x.fillStyle = 'rgba(20,10,14,0.6)'; x.fillRect(0, 0, VW, VH);
      text(x, 'YOU FELL', VW / 2 - textW('YOU FELL', 3) / 2, VH / 2 - 20, COL.red, 3);
    }
    if (!this.started) this.drawTitle(x);
  }

  drawTitle(x) {
    x.fillStyle = 'rgba(14,10,16,0.78)'; x.fillRect(0, 0, VW, VH);
    const t = 'HEARTHLANDS';
    text(x, t, VW / 2 - textW(t, 4) / 2, 70, '#f0c060', 4);
    const sub = 'A LIVING WORLD TO DIG, BUILD AND WANDER';
    text(x, sub, VW / 2 - textW(sub) / 2, 100, COL.text);
    const lines = [
      'VILLAGERS KEEP THEIR OWN DAYS: WORK, MEALS, PLAY AND SLEEP.',
      'HURT ONE AND THE VILLAGE WILL FLEE OR FIGHT, THEN CALM DOWN.',
      'TAKE THEIR THINGS TO FURNISH YOUR HOUSE, IF NOBODY IS WATCHING.',
      'BUILD A ROOM WITH A BACK WALL, BED, LIGHT AND TABLE:',
      'A TRAVELLER MAY MOVE IN.',
    ];
    lines.forEach((l, i) => text(x, l, VW / 2 - textW(l) / 2, 130 + i * 10, i < 3 ? COL.text : '#c8e0a8'));
    const c = 'CLICK TO BEGIN';
    if (Math.floor(performance.now() / 500) % 2) text(x, c, VW / 2 - textW(c, 2) / 2, 206, COL.text, 2);
    const k = 'KEYBOARD AND MOUSE';
    text(x, k, VW / 2 - textW(k) / 2, 240, COL.dim);
  }

  drawInventory(x) {
    const g = this.g, inv = g.inv;
    box(x, VW / 2 - 108, 52, 216, 82);
    text(x, 'INVENTORY', VW / 2 - 99, 58, COL.gold);
    for (let i = 0; i < 30; i++) { const [sx, sy] = this.invRect(i); slot(x, sx, sy, inv.slots[i], inv.sel === i && i < 10); }
    box(x, VW / 2 - 128, 138, 256, 20 + Math.ceil(RECIPES.length / 12) * 20);
    text(x, 'CRAFT  (RIGHT CLICK X5)', VW / 2 - 119, 142, COL.gold);
    let hover = null;
    RECIPES.forEach((r, i) => {
      const [sx, sy] = this.recipeRect(i);
      const ok = inv.canCraft(r);
      slot(x, sx, sy, { id: r.out, n: r.n }, false, !ok);
      if (g.mouse.x >= sx && g.mouse.x < sx + 18 && g.mouse.y >= sy && g.mouse.y < sy + 18) hover = r;
    });
    for (let i = 0; i < 30; i++) {
      const [sx, sy] = this.invRect(i);
      const s = inv.slots[i];
      if (s && g.mouse.x >= sx && g.mouse.x < sx + 18 && g.mouse.y >= sy && g.mouse.y < sy + 18) this.tip(x, ITEMS[s.id].name, null);
    }
    if (hover) this.tip(x, `${ITEMS[hover.out].name} x${hover.n}`, costText(hover), inv.canCraft(hover));
    if (inv.cursor) { x.drawImage(icon(inv.cursor.id), g.mouse.x - 6, g.mouse.y - 6); if (inv.cursor.n > 1) text(x, inv.cursor.n, g.mouse.x + 4, g.mouse.y + 4, COL.text); }
  }

  tip(x, title, sub, ok) {
    const g = this.g;
    const w = Math.max(textW(title), sub ? textW(sub) : 0) + 8;
    const tx = Math.min(VW - w - 4, g.mouse.x + 10), ty = Math.min(VH - 24, g.mouse.y + 10);
    box(x, tx, ty, w, sub ? 20 : 12, COL.panel, COL.edgeHi);
    text(x, title.toUpperCase(), tx + 4, ty + 4, COL.text);
    if (sub) text(x, sub.toUpperCase(), tx + 4, ty + 12, ok ? COL.green : COL.dim);
  }

  drawWorldOverlays(x) {
    const g = this.g, cam = g.cam;
    for (const v of g.villagers) {
      if (v.dead) continue;
      const sx = Math.round(v.cx - cam.x), sy = Math.round(v.y - cam.y) - 8;
      if (sx < -20 || sx > VW + 20 || sy < -20 || sy > VH + 20) continue;
      let b = v.bubble;
      if (v.sleeping) { if (b) { const bx = v.bed.x * 8 + 10 - cam.x, by = v.bed.y * 8 - 6 - cam.y; text(x, 'z', Math.round(bx + Math.sin(g.clock * 2) * 2), Math.round(by), '#b8c8f0'); } continue; }
      if (v.happy > 0) b = { txt: '♥', col: '#f07080' };
      if (b) {
        const w = textW(b.txt) + 4;
        box(x, sx - w / 2, sy - 8, w, 9, '#f0e8d8', '#f0e8d8');
        text(x, b.txt, sx - w / 2 + 2, sy - 6, b.col || '#3a2a22', 1, null);
      }
    }
    if (g.hoverEnt && g.hoverEnt.kind === 'villager' && !this.open) {
      const v = g.hoverEnt;
      const label = `${v.name} - ${ROLE_NAMES[v.role]}`;
      const state = v.dead ? '' : v.sleeping ? 'ASLEEP' : v.alarm ? (v.alarm.mode === 'fight' ? 'ANGRY' : 'SCARED') : (v.act?.phase || '').toUpperCase();
      this.tip(x, label, state);
    }
    // cursor: mining progress / placement ghost
    const c = g.cursor;
    if (c && !this.open && this.started) {
      const sx = c.x * 8 - cam.x, sy = c.y * 8 - cam.y;
      x.globalAlpha = c.inReach ? 0.9 : 0.35;
      x.strokeStyle = c.inReach ? '#f0e8d8' : '#8a7a68';
      x.lineWidth = 1;
      if (c.ghost) {
        x.globalAlpha = 0.55;
        x.drawImage(c.ghost.img, c.ghost.x * 8 - cam.x, c.ghost.y * 8 - cam.y);
        x.globalAlpha = 0.9;
        x.strokeStyle = c.ghost.ok ? '#8ac060' : '#e05a48';
        x.strokeRect(c.ghost.x * 8 - cam.x + 0.5, c.ghost.y * 8 - cam.y + 0.5, c.ghost.w * 8 - 1, c.ghost.h * 8 - 1);
      } else x.strokeRect(sx + 0.5, sy + 0.5, 7, 7);
      x.globalAlpha = 1;
      if (g.mining && g.mining.p > 0) {
        const m = g.mining;
        x.fillStyle = '#140e12'; x.fillRect(m.x * 8 - cam.x - 1, m.y * 8 - cam.y - 4, 10, 3);
        x.fillStyle = '#f0c060'; x.fillRect(m.x * 8 - cam.x, m.y * 8 - cam.y - 3, Math.round(8 * m.p), 1);
      }
    }
  }
}

function heart(x, hx, hy, col, shine) {
  x.fillStyle = '#140e12';
  x.fillRect(hx, hy + 1, 9, 4); x.fillRect(hx + 1, hy, 3, 1); x.fillRect(hx + 5, hy, 3, 1); x.fillRect(hx + 1, hy + 5, 7, 1); x.fillRect(hx + 2, hy + 6, 5, 1); x.fillRect(hx + 3, hy + 7, 3, 1); x.fillRect(hx + 4, hy + 8, 1, 1);
  x.fillStyle = col;
  x.fillRect(hx + 1, hy + 1, 3, 1); x.fillRect(hx + 5, hy + 1, 3, 1); x.fillRect(hx + 1, hy + 2, 7, 3); x.fillRect(hx + 2, hy + 5, 5, 1); x.fillRect(hx + 3, hy + 6, 3, 1); x.fillRect(hx + 4, hy + 7, 1, 1);
  if (shine) { x.fillStyle = '#f8b0a8'; x.fillRect(hx + 2, hy + 2, 1, 1); }
}

export function costText(r) { return Object.entries(r.cost).map(([id, n]) => `${n} ${ITEMS[id].name}`).join(', '); }
