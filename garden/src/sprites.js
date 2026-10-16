// Procedural sprites: ground tiles, decorations, market stalls, people, pets, gear and egg icons.
import { Pix, outline, shade, mix, canvas, flipped, INK } from './pix.js';
import { mulberry32, rnd, irnd, pick } from './rng.js';
import { PETS, EGGS, EGGMAP, GEAR, TILE } from './content.js';

const cache = new Map();
function memo(key, fn) { let v = cache.get(key); if (!v) { v = fn(); cache.set(key, v); } return v; }

// ------------------------------------------------------------------ tiles
export const GRASS = '#5fae46';
export const SOIL = '#7a4f2e';
export function grassTile(v) {
  return memo('grass' + v, () => {
    const rng = mulberry32(100 + v);
    const p = new Pix(16, 16);
    p.rect(0, 0, 16, 16, GRASS);
    for (let i = 0; i < 14; i++) p.px(irnd(rng, 0, 15), irnd(rng, 0, 15), rng() > 0.5 ? shade(GRASS, -0.12) : shade(GRASS, 0.1));
    for (let i = 0; i < 3; i++) { const x = irnd(rng, 1, 14), y = irnd(rng, 2, 14); p.px(x, y, shade(GRASS, 0.25)); p.px(x, y - 1, shade(GRASS, 0.35)); p.px(x + 1, y, shade(GRASS, -0.15)); }
    return p.c;
  });
}
export function soilTile(v) {
  return memo('soil' + v, () => {
    const rng = mulberry32(200 + v);
    const p = new Pix(16, 16);
    p.rect(0, 0, 16, 16, SOIL);
    for (let y = 0; y < 16; y += 4) { p.hline(0, 15, y, shade(SOIL, -0.3)); p.hline(0, 15, y + 1, shade(SOIL, 0.12)); }
    for (let i = 0; i < 10; i++) p.px(irnd(rng, 0, 15), irnd(rng, 0, 15), rng() > 0.5 ? shade(SOIL, -0.18) : shade(SOIL, 0.08));
    if (rng() > 0.5) { const x = irnd(rng, 1, 13), y = irnd(rng, 1, 13); p.px(x, y, '#a08a74'); p.px(x + 1, y, '#8a7260'); }
    return p.c;
  });
}
export function pathTile(v) {
  return memo('path' + v, () => {
    const rng = mulberry32(300 + v);
    const p = new Pix(16, 16);
    const gap = '#7d7266', base = '#a89c8c';
    p.rect(0, 0, 16, 16, gap);
    const stones = [[0, 0, 7, 5], [8, 0, 8, 6], [0, 6, 5, 5], [6, 7, 6, 4], [13, 7, 3, 4], [0, 12, 8, 4], [9, 12, 7, 4]];
    for (const [x, y, w, h] of stones) {
      const c = shade(base, rnd(rng, -0.12, 0.1));
      p.rect(x, y, w - 1, h - 1, c); p.hline(x, x + w - 2, y, shade(c, 0.18)); p.vline(x, y, y + h - 2, shade(c, 0.1)); p.hline(x + 1, x + w - 2, y + h - 2, shade(c, -0.2));
    }
    for (let i = 0; i < 4; i++) p.px(irnd(rng, 0, 15), irnd(rng, 0, 15), '#6f9a4a');
    return p.c;
  });
}
export function waterTile(f, edge) {
  return memo('water' + f + (edge || ''), () => {
    const p = new Pix(16, 16);
    const base = '#3b86d1', deep = '#2d6db3', light = '#8fd0ff';
    p.rect(0, 0, 16, 16, base);
    const rng = mulberry32(400);
    for (let i = 0; i < 10; i++) p.px(irnd(rng, 0, 15), irnd(rng, 0, 15), deep);
    const off = f ? 3 : 0;
    p.hline(1 + off, 4 + off, 3, light); p.hline(9 + off, 11 + off, 7, light); p.hline(3 + off, 5 + off, 12, light); p.hline(11 - off, 14 - off, 13, light);
    if (edge) { if (edge.includes('n')) { p.hline(0, 15, 0, '#5a9a4a'); p.hline(0, 15, 1, '#8ad6ff'); } if (edge.includes('w')) { p.vline(0, 0, 15, '#5a9a4a'); p.vline(1, 0, 15, '#8ad6ff'); } if (edge.includes('e')) { p.vline(15, 0, 15, '#5a9a4a'); p.vline(14, 0, 15, '#8ad6ff'); } if (edge.includes('s')) { p.hline(0, 15, 15, '#5a9a4a'); } }
    return p.c;
  });
}
// fence: bits n=1 e=2 s=4 w=8 for neighbouring fence tiles
export function fenceTile(bits) {
  return memo('fence' + bits, () => {
    const p = new Pix(16, 16);
    const wood = '#b8894a', dark = shade(wood, -0.35), light = shade(wood, 0.25);
    if (bits & 8) { p.rect(0, 5, 8, 2, wood); p.rect(0, 10, 8, 2, wood); p.hline(0, 7, 5, light); p.hline(0, 7, 10, light); }
    if (bits & 2) { p.rect(8, 5, 8, 2, wood); p.rect(8, 10, 8, 2, wood); p.hline(8, 15, 5, light); p.hline(8, 15, 10, light); }
    if (bits & 1) { p.rect(6, 0, 4, 8, wood); p.vline(6, 0, 7, light); p.vline(9, 0, 7, dark); }
    if (bits & 4) { p.rect(6, 8, 4, 8, wood); p.vline(6, 8, 15, light); p.vline(9, 8, 15, dark); }
    p.rect(6, 2, 4, 12, wood); p.vline(6, 2, 13, light); p.vline(9, 2, 13, dark); p.hline(6, 9, 2, light); p.px(7, 1, light); p.px(8, 1, wood);
    outline(p.c);
    return p.c;
  });
}

// ------------------------------------------------------------------ decor
export function tree(v) {
  return memo('tree' + v, () => {
    const rng = mulberry32(500 + v);
    const p = new Pix(36, 46);
    const leaf = ['#3f9a46', '#4aa352', '#368a3f'][v % 3], bark = '#6e4a2a';
    const cx = 18, by = 44;
    p.rect(cx - 3, by - 16, 6, 16, bark); p.vline(cx - 3, by - 16, by - 1, shade(bark, 0.2)); p.vline(cx + 2, by - 16, by - 1, shade(bark, -0.3)); p.px(cx - 4, by - 1, shade(bark, -0.3)); p.px(cx + 3, by - 1, shade(bark, -0.3)); p.px(cx - 4, by - 2, bark); p.px(cx + 3, by - 2, bark);
    p.line(cx - 2, by - 14, cx - 7, by - 20, bark); p.line(cx + 2, by - 15, cx + 7, by - 21, bark);
    const blobs = [];
    for (let i = 0; i < 18; i++) { const a = rnd(rng, 0, Math.PI * 2), d = Math.sqrt(rng()); blobs.push({ x: Math.round(cx + Math.cos(a) * d * 12), y: Math.round(by - 27 + Math.sin(a) * d * 9), r: irnd(rng, 3, 5) }); }
    blobs.push({ x: cx, y: by - 28, r: 6 });
    blobs.sort((a, b) => a.y - b.y);
    for (const b of blobs) p.blob(b.x, b.y, b.r, leaf);
    for (let i = 0; i < 8; i++) { const b = pick(rng, blobs); p.px(b.x - 1 + irnd(rng, -1, 1), b.y - b.r + irnd(rng, 0, 1), shade(leaf, 0.5)); }
    if (v % 3 === 1) for (let i = 0; i < 5; i++) { const b = pick(rng, blobs); p.px(b.x + irnd(rng, -2, 2), b.y + irnd(rng, -1, 2), '#e85a5a'); }
    outline(p.c);
    return p.c;
  });
}
export function bush(v) {
  return memo('bush' + v, () => {
    const rng = mulberry32(600 + v);
    const p = new Pix(20, 14);
    const leaf = v % 2 ? '#4aa352' : '#3f9a46';
    const blobs = [];
    for (let i = 0; i < 6; i++) blobs.push({ x: irnd(rng, 5, 14), y: irnd(rng, 5, 9), r: irnd(rng, 2, 3) });
    blobs.sort((a, b) => a.y - b.y);
    for (const b of blobs) p.blob(b.x, b.y, b.r, leaf);
    if (v % 3 === 2) for (let i = 0; i < 3; i++) p.px(irnd(rng, 5, 14), irnd(rng, 4, 9), '#ff9ac8');
    outline(p.c);
    return p.c;
  });
}
export function rock(v) {
  return memo('rock' + v, () => {
    const p = new Pix(14, 10);
    const g = '#8d8a84';
    p.ell(7, 6, v ? 5 : 4, 3, shade(g, -0.3)); p.ell(6, 5, v ? 5 : 4, 3, g); p.ell(5, 4, 2, 1, shade(g, 0.25)); p.px(8, 5, shade(g, -0.15));
    outline(p.c);
    return p.c;
  });
}
export function flowerPatch(v) {
  return memo('flw' + v, () => {
    const rng = mulberry32(700 + v);
    const p = new Pix(16, 16);
    const cols = ['#ff6b8a', '#ffd23f', '#ffffff', '#b58cff', '#ff9a3c'];
    for (let i = 0; i < 3; i++) {
      const x = irnd(rng, 2, 13), y = irnd(rng, 3, 13), c = pick(rng, cols);
      p.px(x, y + 1, '#3a8a3a'); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y + 1, c); p.px(x, y, shade(c, 0.4));
    }
    return p.c;
  });
}
export function lantern() {
  return memo('lantern', () => {
    const p = new Pix(10, 24);
    const metal = '#4a4a55';
    p.rect(4, 8, 2, 14, metal); p.vline(4, 8, 21, shade(metal, 0.3)); p.rect(2, 21, 6, 2, metal); p.hline(2, 7, 21, shade(metal, 0.3));
    p.rect(2, 2, 6, 7, metal); p.rect(3, 3, 4, 5, '#ffd86a'); p.rect(4, 4, 2, 3, '#fff2b0'); p.rect(3, 1, 4, 1, metal); p.px(4, 0, metal); p.px(5, 0, metal); p.hline(2, 7, 8, shade(metal, -0.3));
    outline(p.c);
    return p.c;
  });
}
export function signBoard() {
  return memo('sign', () => {
    const p = new Pix(22, 18);
    const wood = '#b8894a';
    p.rect(9, 9, 4, 8, shade(wood, -0.2)); p.vline(9, 9, 16, shade(wood, 0.1));
    p.rect(1, 1, 20, 9, wood); p.hline(1, 20, 1, shade(wood, 0.3)); p.vline(1, 1, 9, shade(wood, 0.3)); p.hline(1, 20, 9, shade(wood, -0.35)); p.vline(20, 1, 9, shade(wood, -0.35));
    p.px(2, 2, shade(wood, -0.4)); p.px(19, 2, shade(wood, -0.4)); p.px(2, 8, shade(wood, -0.4)); p.px(19, 8, shade(wood, -0.4));
    outline(p.c);
    return p.c;
  });
}
export function scarecrow() {
  return memo('scare', () => {
    const p = new Pix(20, 30);
    p.rect(9, 10, 2, 19, '#8a5a2a'); p.hline(2, 17, 12, '#8a5a2a');
    p.rect(5, 11, 10, 9, '#6a8ac0'); p.hline(5, 14, 11, '#8aaad8'); p.rect(6, 20, 8, 3, '#8a5a2a');
    for (let i = 0; i < 6; i++) { p.px(3 + i * 2, 13 + (i % 2), '#e8c060'); p.px(4 + i * 2, 23 + (i % 3), '#e8c060'); }
    p.disc(10, 6, 4, '#e8c878'); p.px(8, 6, INK); p.px(12, 6, INK); p.hline(9, 11, 8, '#c08a40');
    p.rect(3, 2, 14, 2, '#d9a84a'); p.rect(6, 0, 8, 3, '#d9a84a'); p.hline(6, 13, 0, '#f0c870'); p.hline(3, 16, 3, '#b08030');
    p.px(1, 11, '#2a2a2a'); p.px(2, 10, '#2a2a2a'); p.px(2, 11, '#444'); p.px(3, 10, '#ffb000');
    outline(p.c);
    return p.c;
  });
}
export function nest() {
  return memo('nest', () => {
    const p = new Pix(18, 10);
    p.ell(9, 6, 8, 3, '#8a6a3a'); p.ell(9, 5, 8, 3, '#b08a4a'); p.ell(9, 5, 5, 2, '#6a4a2a');
    for (let i = 0; i < 8; i++) p.px(2 + i * 2, 4 + (i % 2), '#e0c080');
    outline(p.c);
    return p.c;
  });
}

// ------------------------------------------------------------------ stalls
const STALLS = {
  seeds: { awning: '#5fbf5a', awning2: '#f3f1e0', sign: '#3a8a3a', goods: ['#ff8c1a', '#ec3b32', '#4e62d8', '#f5d442', '#ff8a1f'] },
  gear:  { awning: '#5a8ad6', awning2: '#f3f1e0', sign: '#2a4a8a', goods: ['#8a8a96', '#b8b8c8', '#ffd23f', '#6fb6ff', '#8a5a2a'] },
  eggs:  { awning: '#e07ab0', awning2: '#fff0f6', sign: '#8a2a5a', goods: ['#f1e9d6', '#aee9b0', '#9cc9ff', '#ffe27a', '#d9a8ff'] },
  sell:  { awning: '#e8a23a', awning2: '#f3f1e0', sign: '#8a4a1a', goods: ['#ffd23f', '#ffd23f', '#f0f0f0', '#ffd23f', '#c0c0c0'] },
};
export function stallBack(kind) {
  return memo('stallB' + kind, () => {
    const s = STALLS[kind];
    const W = 80, p = new Pix(W + 8, 44);
    const wood = '#9c6a3a', plank = '#b07a44';
    // back wall
    p.rect(4, 10, W, 22, plank);
    for (let y = 10; y < 32; y += 4) { p.hline(4, W + 3, y, shade(plank, -0.25)); p.hline(4, W + 3, y + 1, shade(plank, 0.1)); }
    // shelves with goods
    for (let k = 0; k < 2; k++) {
      const y = 16 + k * 8;
      p.rect(10, y + 4, W - 12, 2, shade(wood, -0.3)); p.hline(10, W - 3, y + 4, shade(wood, 0.2));
      for (let i = 0; i < 5; i++) { const x = 14 + i * 13 + k * 3, c = s.goods[(i + k) % 5]; p.rect(x, y, 5, 4, c); p.hline(x, x + 3, y, shade(c, 0.3)); p.vline(x + 4, y, y + 3, shade(c, -0.3)); }
    }
    // posts
    for (const x of [4, W + 1]) { p.rect(x, 6, 3, 38, wood); p.vline(x, 6, 43, shade(wood, 0.25)); p.vline(x + 2, 6, 43, shade(wood, -0.3)); }
    // awning
    for (let x = 0; x < W + 8; x++) { const stripe = Math.floor(x / 8) % 2 === 0; const c = stripe ? s.awning : s.awning2; p.vline(x, 2, 8, c); p.px(x, 2, shade(c, 0.25)); if (x % 8 === 7) p.px(x, 9, c); if (x % 8 === 3) p.px(x, 9, c); p.px(x, 8, shade(c, -0.15)); }
    p.hline(0, W + 7, 1, shade(s.awning, -0.3));
    outline(p.c);
    return p.c;
  });
}
export function stallFront(kind) {
  return memo('stallF' + kind, () => {
    const W = 80, p = new Pix(W + 8, 18);
    const wood = '#9c6a3a', plank = '#c08a4e';
    p.rect(4, 3, W, 14, plank);
    for (let y = 5; y < 17; y += 4) { p.hline(4, W + 3, y, shade(plank, -0.25)); p.hline(4, W + 3, y + 1, shade(plank, 0.08)); }
    p.rect(2, 0, W + 4, 3, shade(wood, 0.15)); p.hline(2, W + 5, 0, shade(wood, 0.4));
    for (let x = 8; x < W; x += 16) p.px(x, 1, shade(wood, -0.2));
    outline(p.c);
    return p.c;
  });
}
export function stallSign(kind) {
  return memo('stallS' + kind, () => {
    const s = STALLS[kind];
    const p = new Pix(42, 14);
    p.rect(1, 1, 40, 12, s.sign); p.hline(1, 40, 1, shade(s.sign, 0.3)); p.vline(1, 1, 12, shade(s.sign, 0.3)); p.hline(1, 40, 12, shade(s.sign, -0.3)); p.vline(40, 1, 12, shade(s.sign, -0.3));
    outline(p.c);
    return p.c;
  });
}

// ------------------------------------------------------------------ people
// def: {skin, hair, shirt, pants, hat:'straw'|'cap'|'bandana'|'none', hatColor, apron}
function person(def, dir, frame) {
  const p = new Pix(16, 22);
  const skin = def.skin, hair = def.hair, shirt = def.shirt, pants = def.pants;
  const cx = 8;
  const bob = (frame === 1 || frame === 3) ? 1 : 0;
  const legL = frame === 1 ? -1 : 0, legR = frame === 3 ? -1 : 0;
  const by = 21;
  if (dir === 'down' || dir === 'up') {
    // legs
    p.rect(cx - 3, by - 4 + legL, 2, 4 + legL * -1, pants); p.rect(cx + 1, by - 4 + legR, 2, 4 - legR, pants);
    p.rect(cx - 3, by - 1 + legL, 2, 1, '#4a3020'); p.rect(cx + 1, by - 1 + legR, 2, 1, '#4a3020');
    // body
    p.rect(cx - 3, by - 10 - bob, 6, 6, shirt); p.vline(cx - 3, by - 10 - bob, by - 5 - bob, shade(shirt, 0.2)); p.vline(cx + 2, by - 10 - bob, by - 5 - bob, shade(shirt, -0.25));
    if (def.apron) { p.rect(cx - 2, by - 8 - bob, 4, 4, def.apron); p.hline(cx - 2, cx + 1, by - 8 - bob, shade(def.apron, 0.3)); }
    // arms
    const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    p.rect(cx - 4, by - 10 - bob + swing, 1, 4, shirt); p.px(cx - 4, by - 6 - bob + swing, skin);
    p.rect(cx + 3, by - 10 - bob - swing, 1, 4, shirt); p.px(cx + 3, by - 6 - bob - swing, skin);
    // head
    const hy = by - 15 - bob;
    p.disc(cx, hy, 3, skin); p.rect(cx - 3, hy - 1, 7, 3, skin);
    if (dir === 'down') {
      p.rect(cx - 3, hy - 3, 7, 2, hair); p.px(cx - 3, hy - 1, hair); p.px(cx + 3, hy - 1, hair);
      p.px(cx - 1, hy, INK); p.px(cx + 1, hy, INK); p.px(cx - 1, hy - 1, '#fff'); p.px(cx + 1, hy - 1, '#fff'); p.px(cx, hy + 2, shade(skin, -0.3));
      p.px(cx - 2, hy + 1, '#f0a0a0'); p.px(cx + 2, hy + 1, '#f0a0a0');
    } else {
      p.rect(cx - 3, hy - 3, 7, 5, hair); p.rect(cx - 2, hy + 2, 5, 1, hair);
    }
    hat(p, def, cx, hy, dir);
  } else {
    // side view (facing right)
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    p.rect(cx - 2 + step, by - 4, 2, 4, pants); p.rect(cx + 1 - step, by - 4, 2, 4, pants);
    p.rect(cx - 2 + step, by - 1, 2, 1, '#4a3020'); p.rect(cx + 1 - step, by - 1, 2, 1, '#4a3020');
    p.rect(cx - 2, by - 10 - bob, 5, 6, shirt); p.vline(cx - 2, by - 10 - bob, by - 5 - bob, shade(shirt, 0.2)); p.vline(cx + 2, by - 10 - bob, by - 5 - bob, shade(shirt, -0.25));
    if (def.apron) p.rect(cx - 1, by - 8 - bob, 3, 4, def.apron);
    p.rect(cx + 1 + step, by - 10 - bob, 1, 4, shade(shirt, -0.1)); p.px(cx + 1 + step, by - 6 - bob, skin);
    const hy = by - 15 - bob;
    p.disc(cx, hy, 3, skin); p.rect(cx - 3, hy - 1, 7, 3, skin);
    p.rect(cx - 3, hy - 3, 7, 2, hair); p.rect(cx - 3, hy - 1, 2, 3, hair); p.px(cx - 2, hy + 2, hair);
    p.px(cx + 2, hy, INK); p.px(cx + 2, hy - 1, '#fff'); p.px(cx + 3, hy + 1, shade(skin, -0.25));
    hat(p, def, cx, hy, 'side');
  }
  outline(p.c);
  return p.c;
}
function hat(p, def, cx, hy, dir) {
  const c = def.hatColor || '#d9a84a';
  if (def.hat === 'straw') { p.rect(cx - 5, hy - 3, 11, 1, c); p.rect(cx - 3, hy - 6, 7, 3, c); p.hline(cx - 3, cx + 3, hy - 6, shade(c, 0.3)); p.hline(cx - 3, cx + 3, hy - 4, '#8a2a2a'); p.hline(cx - 5, cx + 5, hy - 3, shade(c, -0.15)); }
  else if (def.hat === 'cap') { p.rect(cx - 3, hy - 5, 7, 3, c); p.hline(cx - 3, cx + 3, hy - 5, shade(c, 0.3)); if (dir === 'down') p.rect(cx - 3, hy - 2, 7, 1, shade(c, -0.3)); else if (dir === 'side') p.rect(cx + 2, hy - 2, 4, 1, shade(c, -0.3)); }
  else if (def.hat === 'bandana') { p.rect(cx - 3, hy - 4, 7, 2, c); p.hline(cx - 3, cx + 3, hy - 4, shade(c, 0.3)); p.px(cx + 4, hy - 3, c); p.px(cx + 5, hy - 2, c); }
  else if (def.hat === 'goggles') { p.rect(cx - 3, hy - 4, 7, 2, '#5a4a3a'); p.rect(cx - 2, hy - 4, 2, 2, '#8ad6ff'); p.rect(cx + 1, hy - 4, 2, 2, '#8ad6ff'); }
  else if (def.hat === 'top') { p.rect(cx - 4, hy - 3, 9, 1, c); p.rect(cx - 3, hy - 8, 7, 5, c); p.hline(cx - 3, cx + 3, hy - 8, shade(c, 0.3)); p.hline(cx - 3, cx + 3, hy - 4, '#c0392b'); }
}
export const PEOPLE = {
  player: { skin: '#f1c9a0', hair: '#5a3a1e', shirt: '#4a8ad6', pants: '#3a3a6a', hat: 'straw', hatColor: '#e8c060' },
  sam:    { skin: '#e8b88a', hair: '#2a2a2a', shirt: '#5fbf5a', pants: '#5a4a3a', hat: 'cap', hatColor: '#3a8a3a' },
  gus:    { skin: '#d9a070', hair: '#8a5a2a', shirt: '#e8863a', pants: '#3a3a3a', hat: 'goggles' },
  edna:   { skin: '#f1c9a0', hair: '#e0e0e0', shirt: '#f0e0ff', pants: '#8a4a7a', hat: 'bandana', hatColor: '#e07ab0' },
  steven: { skin: '#c88a60', hair: '#1a1a1a', shirt: '#6a6ad6', pants: '#2a2a4a', hat: 'top', hatColor: '#3a3a3a', apron: '#f0e0c0' },
};
export function personSprite(who, dir, frame) {
  return memo('person' + who + dir + frame, () => {
    if (dir === 'left') return flipped(person(PEOPLE[who], 'right', frame));
    return person(PEOPLE[who], dir, frame);
  });
}

// ------------------------------------------------------------------ pets (facing right, 2 frames)
function quad(p, l, f) {
  const s = l.size || 1, body = l.body, belly = l.belly || shade(body, 0.3), dark = shade(body, -0.35), light = shade(body, 0.2);
  const rx = Math.max(3, Math.round(4.5 * s)), ry = Math.max(2, Math.round(2.6 * s));
  const cx = 11, cy = 10;
  // legs
  const lh = Math.max(2, Math.round(3 * s));
  for (let i = 0; i < 4; i++) { const x = cx - rx + 1 + Math.round(i * (rx * 2 - 3) / 3); const off = (i % 2 === f) ? 1 : 0; p.rect(x, cy + ry - 1 - off, 2, lh + off, i < 2 ? dark : body); p.px(x, cy + ry - 1 - off + lh + off - 1, shade(body, -0.5)); }
  // tail
  const tx = cx - rx, ty = cy - 1;
  if (l.tail === 'curl') { p.px(tx - 1, ty, body); p.px(tx - 2, ty - 1, body); p.px(tx - 1, ty - 2, light); }
  else if (l.tail === 'thin') { p.line(tx, ty, tx - 3, ty - 2 + f, dark); }
  else if (l.tail === 'long') { p.line(tx, ty, tx - 4, ty + 1, dark); p.px(tx - 5, ty + f, dark); }
  else if (l.tail === 'puff') { p.disc(tx, ty, 1, belly); }
  else if (l.tail === 'bushy') { p.ell(tx - 3, ty - 1 + f, 3, 2, dark); p.ell(tx - 3, ty - 2 + f, 2, 1, body); p.px(tx - 5, ty - 2 + f, belly); }
  else if (l.tail === 'ring') { p.line(tx, ty, tx - 4, ty - 1, dark); p.px(tx - 2, ty - 1, light); p.px(tx - 4, ty - 1, light); }
  // body
  p.ell(cx + 1, cy + 1, rx, ry, dark); p.ell(cx, cy, rx, ry, body); p.ell(cx, cy + 1, rx - 1, Math.max(1, ry - 1), belly); p.ell(cx - 1, cy - 1, rx - 2, 1, light);
  if (l.patches) { p.ell(cx - 2, cy - 1, 2, 1, l.patches); p.px(cx + 2, cy + 1, l.patches); }
  if (l.spots) for (let i = 0; i < 4; i++) p.px(cx - 2 + i * 2 - (i % 2), cy - 1 + (i % 2), l.spots);
  if (l.stripes) for (let i = -1; i <= 1; i++) p.vline(cx + i * 2, cy - ry + 1, cy, l.stripes);
  if (l.spikes) for (let x = cx - rx + 1; x <= cx + rx - 2; x += 2) { p.px(x, cy - ry - 1, l.spikes); p.px(x + 1, cy - ry, l.spikes); }
  // head
  const hr = Math.max(2, Math.round(2.6 * s));
  const hx = cx + rx - 1, hy = cy - ry + 1;
  p.disc(hx + 1, hy + 1, hr, dark); p.disc(hx, hy, hr, body); p.disc(hx - 1, hy - 1, Math.max(0, hr - 2), light);
  if (l.mask) { p.hline(hx - 1, hx + hr, hy, l.mask); }
  p.px(hx + 1, hy, INK); p.px(hx + 1, hy - 1, '#fff');
  if (l.snout) { p.rect(hx + hr - 1, hy + 1, 3, 2, '#ffb0c8'); p.px(hx + hr, hy + 1, '#d88aa0'); }
  else p.px(hx + hr, hy + 1, INK);
  // ears
  if (l.ear === 'floppy') { p.rect(hx - hr, hy - hr, 2, 4, dark); p.px(hx - hr, hy - hr, body); }
  else if (l.ear === 'pointy') { p.px(hx - 1, hy - hr - 1, body); p.px(hx - 1, hy - hr - 2, dark); p.px(hx + 1, hy - hr - 1, body); p.px(hx + 1, hy - hr - 2, dark); }
  else if (l.ear === 'long') { p.rect(hx - 2, hy - hr - 5, 2, 6, body); p.px(hx - 1, hy - hr - 4, '#ffb0c8'); p.rect(hx + 1, hy - hr - 4, 2, 5, dark); }
  else if (l.ear === 'round') { p.disc(hx - 1, hy - hr, 1, dark); p.px(hx - 1, hy - hr, belly); p.disc(hx + 2, hy - hr, 1, body); }
  if (l.antlers) { p.line(hx - 1, hy - hr, hx - 2, hy - hr - 4, '#8a6a3a'); p.px(hx - 3, hy - hr - 3, '#8a6a3a'); p.line(hx + 2, hy - hr, hx + 3, hy - hr - 4, '#8a6a3a'); p.px(hx + 4, hy - hr - 3, '#8a6a3a'); }
}
function bird(p, l, f) {
  const body = l.body, dark = shade(body, -0.35), light = shade(body, 0.2), s = l.size || 1;
  const cx = 11, cy = 10, rx = Math.round(4 * s), ry = Math.round(3 * s);
  p.line(cx - 1, cy + ry, cx - 2, cy + ry + 3 - f, '#e8a020'); p.line(cx + 2, cy + ry, cx + 3, cy + ry + 3 - (1 - f), '#e8a020');
  if (l.tailFeathers) { p.line(cx - rx, cy - 1, cx - rx - 4, cy - 5, l.tailFeathers); p.line(cx - rx, cy, cx - rx - 4, cy - 2, shade(l.tailFeathers, 0.3)); }
  else p.px(cx - rx - 1, cy - 1, dark);
  p.ell(cx + 1, cy + 1, rx, ry, dark); p.ell(cx, cy, rx, ry, body); p.ell(cx - 1, cy - 1, rx - 2, 1, light);
  p.ell(cx - 1, cy + 1 - f, 2, 1, dark);
  if (l.owl) {
    p.disc(cx + 2, cy - ry - 1, 3, body); p.disc(cx + 1, cy - ry - 1, 1, '#fff'); p.disc(cx + 4, cy - ry - 1, 1, '#fff'); p.px(cx + 1, cy - ry - 1, INK); p.px(cx + 4, cy - ry - 1, INK);
    p.px(cx + 2, cy - ry, '#e8a020'); p.px(cx, cy - ry - 4, dark); p.px(cx + 4, cy - ry - 4, dark); p.ell(cx, cy + 1, 2, 1, l.belly || light);
  } else {
    const hx = cx + rx - 1, hy = cy - ry - 1;
    p.disc(hx, hy, 2, body); p.px(hx + 1, hy, INK); p.px(hx + 3, hy + 1, '#e8a020'); p.px(hx + 2, hy + 1, '#e8a020');
    if (l.comb) { p.px(hx, hy - 3, l.comb); p.px(hx - 1, hy - 3, l.comb); p.px(hx + 1, hy - 3, l.comb); p.px(hx + 2, hy + 2, l.comb); }
  }
}
function bug(p, l, f) {
  const body = l.body, dark = shade(body, -0.35), light = shade(body, 0.25);
  const cy = 11;
  if (l.legs !== 0) for (let i = 0; i < 3; i++) { const x = 7 + i * 3, d = (i % 2 === f) ? 1 : 0; p.line(x, cy, x - 2, cy + 3 + d, dark); p.line(x + 1, cy, x + 3, cy + 3 - d, dark); }
  if (l.stripes) { for (let i = 0; i < 5; i++) { p.disc(5 + i * 3, cy - (i % 2 === f ? 1 : 0), 2, i % 2 ? l.stripes : body); p.px(4 + i * 3, cy - 2 - (i % 2 === f ? 1 : 0), light); } p.px(19, cy - 2, INK); p.px(18, cy - 4, dark); p.px(19, cy - 5, dark); return; }
  if (l.wings) { p.alpha(0.8); p.ell(8, cy - 4 + f, 5, 2, l.wings); p.ell(13, cy - 4 - f, 5, 2, l.wings); p.alpha(1); p.rect(3, cy - 1, 14, 2, body); p.px(3, cy - 1, light); p.disc(17, cy - 1, 2, dark); p.px(18, cy - 2, INK); return; }
  if (l.arms) {
    p.line(6, cy - 1, 15, cy - 3, body); p.line(6, cy, 15, cy - 2, dark); p.disc(5, cy, 2, body); p.line(15, cy - 3, 18, cy - 6, body); p.disc(18, cy - 7, 2, light); p.px(19, cy - 7, INK);
    p.line(14, cy - 2, 14, cy + 2, dark); p.line(14, cy + 2, 17, cy + 1 - f, dark); p.line(16, cy - 2, 16, cy + 1, dark); p.line(16, cy + 1, 19, cy - f, dark);
    return;
  }
  p.disc(6, cy, 2, dark); p.disc(10, cy - 1, 2, body); p.disc(14, cy - 1, 2, body); p.px(13, cy - 2, light); p.px(9, cy - 2, light);
  p.px(16, cy - 2, INK); p.px(15, cy - 3, dark); p.px(16, cy - 4, dark);
}
function frog(p, l, f) {
  const body = l.body, dark = shade(body, -0.35), light = shade(body, 0.25), belly = l.belly;
  const cx = 11, cy = 11;
  p.ell(cx - 5, cy + 1, 2, 1 + f, dark); p.ell(cx + 5, cy + 1, 2, 1 + f, dark);
  p.ell(cx + 1, cy + 1, 5, 3, dark); p.ell(cx, cy, 5, 3, body); p.ell(cx, cy + 1, 3, 1, belly); p.ell(cx - 1, cy - 1, 3, 1, light);
  p.disc(cx - 2, cy - 3, 1, body); p.disc(cx + 2, cy - 3, 1, body); p.px(cx - 2, cy - 3, '#fff'); p.px(cx + 2, cy - 3, '#fff'); p.px(cx - 1, cy - 3, INK); p.px(cx + 3, cy - 3, INK);
  p.hline(cx + 2, cx + 4, cy, dark);
}
function turtle(p, l, f) {
  const shell = l.shell, body = l.body, dark = shade(shell, -0.35), light = shade(shell, 0.25);
  const cx = 10, cy = 10;
  p.rect(cx - 4 + f, cy + 2, 2, 3, body); p.rect(cx + 2 - f, cy + 2, 2, 3, body);
  p.ell(cx + 1, cy + 1, 6, 3, dark); p.ell(cx, cy, 6, 3, shell); p.ell(cx - 1, cy - 1, 3, 1, light);
  for (let i = -1; i <= 1; i++) p.px(cx + i * 3, cy, dark);
  p.px(cx - 7, cy + 1, body);
  p.disc(cx + 7, cy, 2, body); p.px(cx + 8, cy, INK); p.px(cx + 7, cy - 1, shade(body, 0.3));
}
function snail(p, l, f) {
  const body = l.body, shell = l.shell, dark = shade(shell, -0.35), light = shade(shell, 0.3);
  const cy = 12;
  p.ell(10, cy, 7, 2, shade(body, -0.2)); p.ell(10, cy - 1, 7, 2, body); p.px(4, cy - 2, body);
  p.disc(9, cy - 4, 4, dark); p.disc(8, cy - 5, 4, shell); p.disc(9, cy - 5, 2, dark); p.px(8, cy - 5, light); p.px(6, cy - 7, light); p.px(5, cy - 6, light);
  p.line(15, cy - 2, 16, cy - 5 + f, body); p.line(17, cy - 2, 18, cy - 5 + f, body); p.px(16, cy - 6 + f, INK); p.px(18, cy - 6 + f, INK);
}
export function petSprite(id, f, flip) {
  return memo('pet' + id + f + (flip ? 'L' : 'R'), () => {
    const l = PETS[id].look;
    const p = new Pix(24, 20);
    ({ quad, bird, bug, frog, turtle, snail })[l.kind](p, l, f);
    outline(p.c);
    return flip ? flipped(p.c) : p.c;
  });
}

// ------------------------------------------------------------------ eggs & gear
export function eggSprite(id, big) {
  return memo('egg' + id + (big ? 'B' : ''), () => {
    const e = EGGMAP[id];
    const p = new Pix(big ? 16 : 14, big ? 20 : 16);
    const cx = big ? 7 : 6, cy = big ? 10 : 8, rx = big ? 5 : 4, ry = big ? 7 : 5;
    p.ell(cx + 1, cy + 1, rx, ry, shade(e.color, -0.3)); p.ell(cx, cy, rx, ry, e.color); p.ell(cx - 1, cy - 2, rx - 3, 2, shade(e.color, 0.3));
    const rng = mulberry32(id.length * 13);
    for (let i = 0; i < (big ? 6 : 4); i++) { const x = cx + irnd(rng, -rx + 2, rx - 2), y = cy + irnd(rng, -ry + 3, ry - 2); p.px(x, y, e.spot); p.px(x + 1, y, e.spot); p.px(x, y + 1, e.spot); }
    if (id === 'night') { p.px(cx, cy - 3, '#fff'); p.px(cx + 2, cy + 2, '#fff'); }
    outline(p.c);
    return p.c;
  });
}
const SPR_COL = { sprinkler1: '#8a8a96', sprinkler2: '#4a8ad6', sprinkler3: '#ffd23f', sprinkler4: '#b06ad6' };
export function gearIcon(id) {
  return memo('gear' + id, () => {
    const p = new Pix(16, 16);
    const metal = '#8a8a96', ml = shade(metal, 0.35), md = shade(metal, -0.35);
    if (id === 'wateringcan') { const c = '#4a8ad6'; p.rect(3, 6, 8, 7, c); p.hline(3, 10, 6, shade(c, 0.3)); p.vline(10, 6, 12, shade(c, -0.3)); p.rect(5, 3, 4, 2, shade(c, -0.2)); p.line(11, 8, 14, 5, md); p.line(11, 9, 14, 6, metal); p.px(14, 4, ml); p.px(15, 5, ml); p.px(13, 4, ml); p.line(2, 7, 1, 10, md); p.px(1, 11, md); p.px(2, 12, md); }
    else if (id === 'trowel') { p.line(3, 12, 7, 8, '#8a5a2a'); p.line(4, 13, 8, 9, '#6a4a2a'); p.rect(7, 3, 6, 6, metal); p.px(7, 3, ml); p.px(8, 3, ml); p.px(7, 4, ml); p.vline(12, 4, 8, md); p.px(13, 5, md); p.px(9, 9, md); p.px(10, 9, md); p.px(11, 9, md); }
    else if (id === 'favtool') { p.line(3, 13, 8, 8, '#c0392b'); p.line(4, 13, 9, 8, '#e05040'); const s = '#ffd23f'; p.px(10, 3, s); p.px(10, 4, s); p.hline(7, 13, 5, s); p.hline(8, 12, 6, s); p.hline(8, 12, 7, s); p.px(7, 8, s); p.px(13, 8, s); p.px(10, 6, '#fff'); p.px(9, 5, '#fff2a0'); }
    else if (id === 'harvesttool') { p.line(4, 14, 9, 7, '#8a5a2a'); p.line(5, 14, 10, 7, '#6a4a2a'); p.line(9, 6, 13, 3, metal); p.line(13, 3, 14, 6, metal); p.line(10, 7, 13, 5, ml); p.px(9, 6, md); p.px(14, 7, md); p.px(14, 8, md); }
    else if (id === 'cleanspray') { const c = '#8fd36a'; p.rect(5, 6, 6, 8, c); p.hline(5, 10, 6, shade(c, 0.3)); p.vline(10, 7, 13, shade(c, -0.3)); p.rect(6, 3, 3, 3, '#5a5a66'); p.rect(9, 3, 3, 2, '#5a5a66'); p.px(12, 3, md); p.px(5, 4, '#3a3a44'); p.px(13, 2, '#8ad6ff'); p.px(14, 1, '#8ad6ff'); p.px(14, 3, '#8ad6ff'); }
    else if (id.startsWith('sprinkler')) { const c = SPR_COL[id]; p.rect(5, 9, 6, 4, metal); p.hline(5, 10, 9, ml); p.rect(7, 5, 2, 4, md); p.rect(5, 3, 6, 3, c); p.hline(5, 10, 3, shade(c, 0.35)); p.px(10, 5, shade(c, -0.3)); p.px(3, 2, '#8ad6ff'); p.px(12, 2, '#8ad6ff'); p.px(2, 5, '#8ad6ff'); p.px(13, 5, '#8ad6ff'); p.px(8, 0, '#8ad6ff'); p.rect(4, 13, 8, 2, '#5a5a66'); if (id === 'sprinkler4') { p.px(1, 1, '#fff'); p.px(14, 1, '#fff'); } }
    else if (id === 'rod') { p.rect(7, 4, 2, 10, metal); p.vline(7, 4, 13, ml); p.rect(5, 13, 6, 2, md); p.disc(8, 3, 1, '#ffd23f'); p.px(7, 2, '#fff2a0'); p.line(11, 1, 13, 4, '#fff44f'); p.line(13, 4, 11, 6, '#fff44f'); p.px(12, 8, '#fff44f'); }
    else if (id === 'wrench') { p.line(3, 12, 10, 5, metal); p.line(4, 13, 11, 6, md); p.line(3, 12, 10, 5, ml); p.disc(11, 4, 3, metal); p.rect(11, 1, 3, 3, 'rgba(0,0,0,0)'); p.px(12, 2, md); p.px(13, 3, md); p.px(9, 3, ml); p.px(10, 2, ml); p.x.clearRect(11, 1, 4, 3); p.px(11, 1, metal); p.px(14, 3, metal); }
    outline(p.c);
    return p.c;
  });
}
export function sprinklerSprite(id) {
  return memo('sprS' + id, () => {
    const p = new Pix(14, 16);
    const c = SPR_COL[id], metal = '#8a8a96';
    p.ell(7, 13, 5, 2, '#5a5a66'); p.ell(6, 12, 5, 2, metal); p.rect(6, 6, 2, 7, shade(metal, -0.2)); p.vline(6, 6, 12, shade(metal, 0.2));
    p.rect(3, 3, 8, 4, c); p.hline(3, 10, 3, shade(c, 0.35)); p.vline(10, 4, 6, shade(c, -0.3)); p.rect(5, 1, 4, 2, shade(c, -0.15)); p.px(5, 1, shade(c, 0.3));
    outline(p.c);
    return p.c;
  });
}
export function rodSprite() {
  return memo('rodS', () => {
    const p = new Pix(10, 26);
    const metal = '#8a8a96';
    p.ell(5, 23, 4, 2, '#5a5a66'); p.rect(4, 5, 2, 18, metal); p.vline(4, 5, 22, shade(metal, 0.3)); p.rect(2, 21, 6, 2, shade(metal, -0.2));
    p.disc(5, 3, 2, '#ffd23f'); p.px(4, 2, '#fff2a0'); p.px(5, 0, '#fff');
    outline(p.c);
    return p.c;
  });
}
export function coinIcon() {
  return memo('coin', () => {
    const p = new Pix(9, 9);
    p.disc(4, 4, 3, '#e0a020'); p.disc(4, 4, 3, '#e0a020'); p.disc(3, 3, 3, '#ffd23f'); p.disc(4, 4, 2, '#e8b030'); p.px(3, 3, '#fff2a0'); p.px(4, 3, '#fff2a0'); p.px(3, 4, '#fff2a0'); p.rect(4, 2, 1, 5, '#b07a10'); p.px(3, 3, '#fff2a0');
    outline(p.c);
    return p.c;
  });
}
export function heartIcon(full) {
  return memo('heart' + full, () => {
    const p = new Pix(9, 8);
    const c = full ? '#ff5a6a' : '#5a3a44';
    p.px(1, 1, c); p.px(2, 1, c); p.px(4, 1, c); p.px(5, 1, c); p.hline(0, 6, 2, c); p.hline(0, 6, 3, c); p.hline(1, 5, 4, c); p.hline(2, 4, 5, c); p.px(3, 6, c); p.px(1, 2, shade(c, 0.4));
    outline(p.c);
    return p.c;
  });
}
export function cloudShadow(v) {
  return memo('cloud' + v, () => {
    const rng = mulberry32(900 + v);
    const p = new Pix(120, 70);
    p.alpha(1);
    p.x.fillStyle = 'rgba(10,20,40,0.16)';
    for (let i = 0; i < 9; i++) { const x = irnd(rng, 20, 100), y = irnd(rng, 18, 50), rx = irnd(rng, 14, 28), ry = irnd(rng, 8, 16); p.x.beginPath(); for (let yy = -ry; yy <= ry; yy += 1) { const w = Math.round(Math.sqrt(1 - (yy / ry) ** 2) * rx); p.x.rect(x - w, y + yy, w * 2, 1); } p.x.fill(); }
    return p.c;
  });
}
