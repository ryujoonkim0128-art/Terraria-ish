// Procedural pixel art: burrowfolk, the cat, furniture, trees, the cabin and HUD icons.
import { canvas, ascii, outline, shade, INK, hash2 } from './util.js';
import { OBJ } from './content.js';

const WOOD = '#8a5a34', WOOD_D = '#5e3a20', WOOD_L = '#b07a48';
const STONE = '#6e6a72', STONE_D = '#4f4b55', STONE_L = '#8e8a92';
const IRON = '#3b3f48', IRON_L = '#575c66';
const CREAM = '#e8d8b0', RED = '#a8423a', GREEN = '#4f7a3c', GOLD = '#e0b050';

// ---------- burrowfolk ----------
export const HATS = ['#c0443a', '#d9a03a', '#3a8a8a', '#7a4a8a', '#4f7a3c', '#c0683a', '#e8dcc0', '#3d5a9a'];
export const COATS = ['#6a4a34', '#34466a', '#5a6a3a', '#6a3440', '#4c5a6a', '#7a5a3a'];
export const SKINS = ['#f2c9a0', '#d9a37a', '#a8714f', '#7a4e33', '#e8b892'];

const BODY = {
  idle: ['...P...', '..HHH..', '.HHHHh.', '.hhhhh.', '.SSSSE.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '.CCCCD.', '.B..B..'],
  walk1: ['...P...', '..HHH..', '.HHHHh.', '.hhhhh.', '.SSSSE.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '.CCCCD.', 'B....B.'],
  walk2: ['...P...', '..HHH..', '.HHHHh.', '.hhhhh.', '.SSSSE.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '.CCCCD.', '..BB...'],
  work: ['...P...', '..HHH..', '.HHHHh.', '.hhhhh.', '.SSSSE.', '.SSSKS.', '.FFFFFA', '.CCCCDA', '.CCCCD.', '.CCCCD.', '.B..B..'],
  climb1: ['A..P...', 'A.HHH..', '.HHHHH.', '.hhhhh.', '.HHHHH.', '.FFFFF.', '.CCCCCA', '.CCCCC.', '.CCCCC.', '.B...B.', '.....B.'],
  climb2: ['...P..A', '..HHH.A', '.HHHHH.', '.hhhhh.', '.HHHHH.', '.FFFFF.', 'ACCCCC.', '.CCCCC.', '.CCCCC.', '.B...B.', '.B.....'],
  held: ['A..P..A', 'A.HHH.A', '.HHHHh.', '.hhhhh.', '.SOSSO.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '..B.B..', '.B...B.'],
  cheer: ['A..P..A', 'A.HHH.A', '.HHHHh.', '.hhhhh.', '.SUSSU.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '.CCCCD.', '.B..B..'],
  sit: ['...P...', '..HHH..', '.HHHHh.', '.hhhhh.', '.SSSSE.', '.SSSKS.', '.FFFFF.', '.CCCCD.', '.CCCCD.', '.CBBBB.'],
  sleep: ['..P..', '.HHH.', 'HHHHh', 'hhhhh', 'SSSSS', 'SUSUS'],
};

const folkCache = new Map();
export function folkSprites(look) {
  const key = look.join(',');
  if (folkCache.has(key)) return folkCache.get(key);
  const [hat, coat, skin, scarf] = look;
  const pal = {
    P: shade(hat, 0.45), H: hat, h: shade(hat, -0.25), S: skin, E: INK, O: INK, U: INK, K: '#e07a6a',
    F: scarf, C: coat, D: shade(coat, -0.25), A: coat, B: '#2a1c16',
  };
  const out = {};
  for (const k in BODY) out[k] = ascii(BODY[k], pal);
  folkCache.set(key, out);
  return out;
}

// Tools held while working, drawn next to the hand. Two frames each (raised, struck).
const TOOL_ART = {
  pick: [['.mmm.', 'm.h.m', '..h..', '..h..'], ['..h..', '..h..', 'm.h.m', '.mmm.']],
  hammer: [['mmm', 'mmm', '.h.', '.h.'], ['.h.', '.h.', 'mmm', 'mmm']],
  axe: [['mm.', 'mmh', '..h', '..h'], ['..h', '..h', 'mmh', 'mm.']],
  spoon: [['m', 'h', 'h'], ['h', 'h', 'm']],
  can: [['mm.', 'mmm', 'mm.'], ['mm.', 'mmm', 'mm.']],
};
const toolCache = {};
export function toolSprite(kind, f) {
  const k = kind + f;
  if (!toolCache[k]) toolCache[k] = ascii(TOOL_ART[kind][f], { m: kind === 'can' ? '#5a8aa8' : kind === 'spoon' ? '#c8a070' : '#9aa0aa', h: WOOD_L });
  return toolCache[k];
}

export const LANTERN = ascii(['.i.', 'iyi', 'iyi', 'iii'], { i: '#3b3f48', y: '#ffd27a' });
export const BINDLE = ascii(['.....rr', '....rrr', '...h.r.', '..h....', '.h.....', 'h......'], { r: '#a8423a', h: WOOD_L });

// ---------- the cat ----------
const CAT = {
  idle: ['......o.o', 't.....ooo', 't....oEoE', '.oooooooo', '.oSoSoSo.', '.o.o..o.o'],
  walk: ['......o.o', '.t....ooo', '.t...oEoE', '.oooooooo', '.oSoSoSo.', '..oo..oo.'],
  sleep: ['..ooo..', '.oSoSo.', 'ooooooo', 'ttooooo'],
};
export const CAT_SPR = {};
for (const k in CAT) CAT_SPR[k] = ascii(CAT[k], { o: '#d9883a', S: '#a85a24', t: '#d9883a', E: '#2a1c16' });

// ---------- furniture ----------
function art(w, h, fn) {
  const [c, x] = canvas(w * 8 + 2, h * 8 + 2);
  x.translate(1, 1);
  const r = (a, b, cw, ch, col) => { x.fillStyle = col; x.fillRect(a, b, cw, ch); };
  fn(r, x);
  return outline(c);
}

const DRAW = {
  bed: (r) => {
    r(0, 3, 3, 13, WOOD_D); r(21, 7, 3, 9, WOOD_D); r(2, 12, 20, 2, WOOD); r(1, 14, 2, 2, WOOD_D); r(21, 14, 2, 2, WOOD_D);
    r(3, 9, 18, 3, CREAM); r(3, 7, 5, 3, '#f4efe2'); r(8, 8, 13, 4, RED);
    for (let i = 9; i < 21; i += 3) r(i, 9, 1, 3, shade(RED, 0.25));
    r(0, 3, 3, 1, WOOD_L);
  },
  hearth: (r) => {
    r(3, 0, 18, 24, STONE); r(0, 8, 24, 3, WOOD_L); r(0, 10, 24, 1, WOOD_D);
    for (let y = 12; y < 24; y += 3) for (let x = (y % 2) * 3; x < 24; x += 6) r(x + 1, y, 5, 2, y < 12 ? STONE : STONE_L);
    for (let y = 0; y < 8; y += 3) for (let x = 3 + ((y / 3) % 2) * 3; x < 21; x += 6) r(x, y + 1, 5, 2, STONE_L);
    r(1, 11, 22, 13, STONE); for (let y = 12; y < 24; y += 3) for (let x = 1 + (y % 2) * 3; x < 22; x += 6) r(x, y, 5, 2, STONE_L);
    r(6, 13, 12, 11, '#1a0d08'); r(7, 12, 10, 1, '#1a0d08'); r(8, 21, 8, 2, WOOD_D); r(9, 20, 6, 1, WOOD);
    r(4, 6, 3, 2, '#c8a070'); r(16, 5, 2, 3, '#7ab06a'); r(19, 6, 2, 2, CREAM);
  },
  rug: (r) => {
    r(0, 5, 32, 3, RED); r(1, 6, 30, 1, GOLD);
    for (let i = 3; i < 30; i += 4) r(i, 6, 2, 1, CREAM);
    for (let i = 0; i < 32; i += 2) r(i, 7, 1, 1, shade(RED, -0.3));
  },
  armchair: (r) => {
    r(1, 1, 14, 9, GREEN); r(2, 2, 12, 1, shade(GREEN, 0.2)); r(0, 6, 3, 7, shade(GREEN, -0.2)); r(13, 6, 3, 7, shade(GREEN, -0.2));
    r(3, 9, 10, 4, shade(GREEN, 0.15)); r(1, 13, 2, 3, WOOD_D); r(13, 13, 2, 3, WOOD_D); r(3, 13, 10, 1, shade(GREEN, -0.35));
  },
  painting: (r) => {
    r(0, 0, 16, 8, GOLD); r(1, 1, 14, 6, '#8ab0d0'); r(1, 4, 14, 3, '#5a7a4a'); r(4, 2, 4, 3, '#e8eef6'); r(5, 1, 2, 1, '#e8eef6');
    r(11, 2, 1, 4, '#2e4a2a'); r(10, 3, 3, 2, '#2e4a2a'); r(1, 1, 3, 2, '#f0d880');
  },
  lamp: (r) => { r(3, 0, 1, 3, IRON); r(1, 3, 6, 2, '#a0703a'); r(0, 4, 8, 1, '#7a5028'); r(2, 5, 4, 2, '#ffe7a0'); },
  growlamp: (r) => { r(3, 0, 1, 3, IRON); r(1, 3, 6, 2, IRON_L); r(0, 4, 8, 1, IRON); r(2, 5, 4, 2, '#e0b0ff'); },
  nightstand: (r) => { r(1, 4, 6, 4, WOOD); r(1, 4, 6, 1, WOOD_L); r(3, 2, 2, 2, CREAM); r(3, 1, 2, 1, '#ffd27a'); r(2, 6, 4, 1, WOOD_D); },
  stove: (r) => {
    r(1, 5, 14, 11, IRON); r(0, 4, 16, 2, IRON_L); r(11, 0, 3, 4, IRON); r(4, 9, 7, 4, '#2a1408'); r(4, 8, 7, 1, IRON_L);
    r(2, 1, 7, 3, '#6a6a70'); r(3, 0, 5, 1, '#8a8a90'); r(1, 15, 2, 1, INK); r(13, 15, 2, 1, INK);
  },
  shelf: (r) => {
    r(0, 6, 16, 2, WOOD); r(1, 7, 1, 1, WOOD_D); r(14, 7, 1, 1, WOOD_D);
    r(1, 2, 3, 4, '#c86a3a'); r(1, 1, 3, 1, CREAM); r(5, 3, 3, 3, '#7ab06a'); r(9, 0, 3, 6, '#e0c070'); r(9, 0, 3, 1, WOOD_D); r(13, 3, 2, 3, '#a0c8d8');
  },
  table: (r) => { r(0, 2, 16, 2, WOOD_L); r(1, 4, 2, 4, WOOD_D); r(13, 4, 2, 4, WOOD_D); r(3, 0, 4, 2, CREAM); r(10, 0, 3, 2, '#c86a3a'); },
  stool: (r) => { r(1, 3, 6, 2, WOOD_L); r(1, 5, 1, 3, WOOD_D); r(6, 5, 1, 3, WOOD_D); },
  barrel: (r) => { r(1, 0, 6, 8, WOOD); r(2, 0, 4, 8, WOOD_L); r(1, 2, 6, 1, IRON); r(1, 5, 6, 1, IRON); },
  plot: (r) => { r(0, 4, 16, 4, WOOD_D); r(1, 4, 14, 2, '#3a2414'); r(0, 7, 16, 1, shade(WOOD_D, -0.3)); },
  crates: (r) => {
    const crate = (a, b, s) => { r(a, b, s, s, WOOD); r(a, b, s, 1, WOOD_L); for (let i = 1; i < s - 1; i++) { r(a + i, b + i, 1, 1, WOOD_D); r(a + s - 1 - i, b + i, 1, 1, WOOD_D); } };
    crate(0, 6, 10); crate(9, 8, 8); crate(3, 0, 7);
  },
  tub: (r) => {
    r(1, 6, 30, 10, WOOD); r(2, 6, 28, 2, '#6ac0d0'); r(2, 6, 28, 1, '#a8e8f0');
    r(1, 9, 30, 1, IRON); r(1, 13, 30, 1, IRON); for (let i = 4; i < 30; i += 5) r(i, 8, 1, 8, WOOD_D);
  },
  bookshelf: (r) => {
    r(0, 0, 16, 24, WOOD_D); r(1, 1, 14, 22, '#2a1810');
    const cols = ['#a8423a', '#3d5a8a', '#4f7a3c', '#d9a03a', '#7a4a8a', CREAM];
    for (let s = 0; s < 3; s++) {
      const y = 1 + s * 8;
      r(1, y + 6, 14, 1, WOOD);
      let x = 1, k = s * 2;
      while (x < 14) { const bw = 1 + ((k * 7) % 3 === 0 ? 1 : 0), bh = 4 + (k % 3); r(x, y + 6 - bh, bw, bh, cols[k % cols.length]); x += bw + (k % 4 === 0 ? 1 : 0); k++; }
    }
  },
  phonograph: (r) => {
    r(1, 10, 6, 6, WOOD_D); r(0, 9, 8, 2, WOOD); r(1, 7, 6, 2, WOOD_L);
    r(3, 3, 1, 4, GOLD); r(3, 1, 3, 2, GOLD); r(4, 0, 4, 2, GOLD); r(6, 0, 2, 4, shade(GOLD, 0.25));
  },
  lantern: (r) => { r(0, 1, 3, 1, IRON); r(2, 1, 1, 2, IRON); r(1, 3, 5, 5, IRON); r(2, 4, 3, 3, '#ffd27a'); r(3, 2, 1, 1, IRON); },
  crystallamp: (r) => { r(1, 12, 6, 4, STONE); r(1, 12, 6, 1, STONE_L); r(2, 3, 4, 9, '#7fd8ff'); r(3, 1, 2, 2, '#bff0ff'); r(2, 5, 1, 5, '#bff0ff'); },
  banner: (r) => { r(0, 0, 8, 1, WOOD_D); r(1, 1, 6, 12, '#3d5a8a'); r(1, 13, 2, 2, '#3d5a8a'); r(5, 13, 2, 2, '#3d5a8a'); r(3, 4, 2, 4, GOLD); r(2, 5, 4, 2, GOLD); },
  snowman: (r) => {
    r(2, 8, 12, 8, '#eef2f8'); r(4, 2, 8, 7, '#eef2f8'); r(3, 9, 10, 1, '#c8d4e4');
    r(4, 0, 8, 2, '#2a1c16'); r(3, 2, 10, 1, '#2a1c16'); r(6, 4, 1, 1, INK); r(9, 4, 1, 1, INK); r(10, 5, 3, 1, '#e07a2a');
    r(4, 8, 8, 1, '#c0443a'); r(10, 9, 2, 3, '#c0443a'); r(7, 11, 1, 1, INK); r(7, 13, 1, 1, INK);
  },
  bell: (r) => { r(3, 2, 2, 22, WOOD_D); r(0, 1, 8, 2, WOOD); r(2, 3, 4, 1, GOLD); r(1, 4, 6, 4, GOLD); r(0, 7, 8, 1, shade(GOLD, -0.2)); r(3, 8, 2, 1, IRON); },
};
const PLANT_SIZES = [
  (r) => { r(2, 5, 4, 3, '#b0603a'); r(3, 3, 1, 2, GREEN); r(4, 2, 1, 3, shade(GREEN, 0.2)); },
  (r) => { r(2, 5, 4, 3, '#b0603a'); r(1, 2, 2, 2, GREEN); r(3, 1, 2, 4, shade(GREEN, 0.2)); r(5, 2, 2, 2, GREEN); },
  (r) => { r(2, 5, 4, 3, '#b0603a'); r(0, 1, 3, 3, GREEN); r(3, -1, 2, 6, shade(GREEN, 0.2)); r(5, 0, 3, 4, GREEN); r(1, 0, 1, 1, '#e8a0c0'); },
  (r) => { r(2, 5, 4, 3, '#b0603a'); r(-1, 0, 4, 4, GREEN); r(2, -3, 4, 8, shade(GREEN, 0.2)); r(5, -1, 4, 5, GREEN); r(0, -1, 1, 1, '#e8a0c0'); r(6, -2, 1, 1, '#f0d060'); r(3, -4, 1, 1, '#e8a0c0'); },
];

const objCache = {};
export function objSprite(type, variant = 0) {
  const k = type + variant;
  if (objCache[k]) return objCache[k];
  const O = OBJ[type];
  let c;
  if (type === 'plant') {
    const [cv, x] = canvas(14, 18);
    x.translate(3, 9);
    PLANT_SIZES[variant]((a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); });
    c = outline(cv); c.offY = -8; c.offX = -2;
  } else c = art(O.w, O.h, DRAW[type]);
  objCache[k] = c;
  return c;
}

// Mushrooms in a plot, by growth stage 0..1.
export function drawMushrooms(x2d, px, py, grow, seed) {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const g = Math.max(0, Math.min(1, grow * 1.25 - i * 0.08));
    if (g <= 0.05) continue;
    const h = Math.round(1 + g * 4), cw = Math.round(1 + g * 3);
    const mx = px + 2 + i * 4 - (cw >> 1) + 1, my = py + 5;
    x2d.fillStyle = '#e8dcc0'; x2d.fillRect(mx + (cw >> 1), my - h, 1, h);
    x2d.fillStyle = grow >= 1 ? (i % 2 ? '#d0503a' : '#e07a3a') : '#a07a5a';
    x2d.fillRect(mx, my - h - 1, cw + 1, 2);
    if (grow >= 1 && cw > 2) { x2d.fillStyle = '#f4e8d0'; x2d.fillRect(mx + 1, my - h - 1, 1, 1); }
  }
}

// ---------- trees, bushes, the cabin ----------
const treeCache = {};
export function treeSprite(h, seed, snowy) {
  const k = h + ':' + (seed % 4) + snowy;
  if (treeCache[k]) return treeCache[k];
  const W = 34, Hh = h * 8 + 4;
  const [c, x] = canvas(W, Hh);
  const dark = '#1f3a2c', mid = '#2c5038', light = '#3c6646';
  x.fillStyle = '#4a3020'; x.fillRect(15, Hh - 10, 4, 10);
  const layers = Math.max(3, h - 2);
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const y = Hh - 8 - i * ((Hh - 12) / layers);
    const half = Math.round(15 - t * 11);
    for (let row = 0; row < 7; row++) {
      const hw = Math.round(half * (row / 6));
      x.fillStyle = row < 2 ? light : row < 5 ? mid : dark;
      x.fillRect(17 - hw, y - 7 + row, hw * 2, 1);
    }
    if (snowy) {
      x.fillStyle = '#e8eef6';
      x.fillRect(17 - Math.round(half * 0.5), y - 4, Math.round(half), 1);
      x.fillRect(17 - half + 1, y - 1, 3, 1); x.fillRect(17 + half - 4, y - 1, 3, 1);
      if (hash2(i, seed) > 0.5) x.fillRect(17 - 2, y - 7, 3, 1);
    }
  }
  x.fillStyle = snowy ? '#f4f8fc' : light; x.fillRect(16, 0, 2, 3);
  treeCache[k] = outline(c);
  return treeCache[k];
}
export const STUMP = ascii(['.wwww.', 'wllllw', 'wwwwww', 'ddddd.'], { w: '#6a4428', l: '#c8a070', d: '#4a3020' });
export const SAPLING = ascii(['..g..', '.ggg.', 'ggggg', '..t..'], { g: '#3c6646', t: '#4a3020' });

export function bushSprite(berries) {
  const k = 'bush' + berries;
  if (treeCache[k]) return treeCache[k];
  const [c, x] = canvas(16, 10);
  x.fillStyle = '#2c5038'; x.fillRect(1, 3, 14, 7); x.fillRect(3, 1, 10, 2);
  x.fillStyle = '#3c6646'; x.fillRect(3, 3, 5, 2); x.fillRect(9, 2, 3, 2);
  x.fillStyle = '#e8eef6'; x.fillRect(3, 1, 9, 1); x.fillRect(1, 3, 3, 1);
  x.fillStyle = '#d03a4a';
  const spots = [[4, 6], [10, 5], [7, 8], [12, 8], [2, 8]];
  for (let i = 0; i < berries * 2 && i < spots.length; i++) x.fillRect(spots[i][0], spots[i][1], 2, 2);
  treeCache[k] = outline(c);
  return treeCache[k];
}

// The cabin over the shaft: 11 cells wide, 7 tall. Windows are left dark; the glow pass lights them.
export const CABIN = (() => {
  const [c, x] = canvas(90, 58);
  const r = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  r(6, 24, 76, 34, '#6a4428');
  for (let y = 25; y < 58; y += 4) { r(6, y, 76, 1, '#4a2e1a'); r(6, y + 1, 76, 1, '#7a5232'); }
  for (let y = 25; y < 58; y += 8) { r(3, y, 4, 3, '#8a5a34'); r(81, y, 4, 3, '#8a5a34'); }
  // roof
  for (let i = 0; i < 20; i++) r(2 + i * 2, 24 - i, 86 - i * 4, 1, i % 3 === 0 ? '#3a2418' : '#4a2e20');
  for (let i = 0; i < 20; i++) { r(1 + i * 2, 21 - i, 6, 3, '#eef2f8'); r(83 - i * 2, 21 - i, 6, 3, '#eef2f8'); }
  r(40, 2, 10, 4, '#eef2f8');
  r(64, 0, 8, 14, '#5a5560'); r(63, 0, 10, 2, '#eef2f8'); r(64, 3, 8, 1, '#3e3a44');
  // windows and door
  r(14, 32, 12, 10, '#2a1a12'); r(19, 32, 2, 10, '#5e3a20'); r(14, 36, 12, 2, '#5e3a20'); r(13, 42, 14, 2, '#8a5a34'); r(13, 42, 14, 1, '#eef2f8');
  r(60, 32, 12, 10, '#2a1a12'); r(65, 32, 2, 10, '#5e3a20'); r(60, 36, 12, 2, '#5e3a20'); r(59, 42, 14, 2, '#8a5a34'); r(59, 42, 14, 1, '#eef2f8');
  r(38, 34, 14, 24, '#2a1a12'); r(37, 33, 16, 2, '#5e3a20');
  // garland
  for (let i = 0; i < 70; i += 6) r(10 + i, 26 + (i % 12 === 0 ? 1 : 0), 2, 2, ['#c0443a', '#e0b050', '#3a8a8a'][(i / 6) % 3]);
  return outline(c);
})();
export const CABIN_WINDOWS = [[14, 32, 12, 10], [60, 32, 12, 10]];

export const WOODPILE_LOG = ascii(['.www.', 'wlllw', '.www.'], { w: '#6a4428', l: '#c8a070' }, 0, false);

// ---------- HUD icons (7x7 before outline) ----------
const ICONS = {
  wood: [['...ww..', '..wwlw.', '.wwwll.', 'wwwwww.', 'lwwww..', 'llww...', '.......'], { w: '#8a5a34', l: '#c8a070' }],
  stone: [['.......', '..ss...', '.sSSs..', 'sSSSss.', 'sSSssss', '.sssss.', '.......'], { s: '#6e6a72', S: '#9e9aa2' }],
  iron: [['.......', '.ss.o..', 'ssosss.', 'sossoss', '.ssosss', '..sss..', '.......'], { s: '#5a5660', o: '#d0864a' }],
  crystal: [['...c...', '..cCc..', '.cCCcc.', '.cCccc.', '..ccc..', '...c...', '.......'], { c: '#4ab0e0', C: '#bff0ff' }],
  food: [['.rrrr..', 'rrwrrr.', 'rrrrwr.', '..cc...', '..cc...', '..cc...', '.......'], { r: '#d0503a', w: '#f4e8d0', c: '#e8dcc0' }],
  meal: [['..s.s..', '...s...', 'wwwwwww', 'wsoSoSw', '.wwwww.', '..www..', '.......'], { w: '#c8a070', s: '#c8d4e4', o: '#e07a3a', S: '#7ab06a' }],
  heart: [['.......', '.rr.rr.', 'rRrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'], { r: '#e0485a', R: '#ffb0b8' }],
  folk: [['...p...', '..hhh..', '.hhhhh.', '.sssss.', '.ccccc.', '.ccccc.', '.b...b.'], { p: '#f0a0a0', h: '#c0443a', s: '#f2c9a0', c: '#6a4a34', b: '#2a1c16' }],
  bed: [['.......', 'w......', 'wppbbbb', 'wwwwwww', 'w.....w', '.......', '.......'], { w: '#8a5a34', p: '#f4efe2', b: '#a8423a' }],
  zzz: [['..zzzz.', '....z..', '...z...', '..zzzz.', 'zz.....', '.z.....', 'zz.....'], { z: '#c8d8ff' }],
  note: [['...nnn.', '...n.n.', '...n.n.', '...n.n.', '.nnn.n.', 'nnnnnn.', '.nn....'], { n: '#f0e0a0' }],
  star: [['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'], { y: '#f0d060' }],
  bang: [['..rr...', '..rr...', '..rr...', '..rr...', '.......', '..rr...', '.......'], { r: '#f0d060' }],
  cold: [['...w...', '.w.w.w.', '..www..', 'wwwwwww', '..www..', '.w.w.w.', '...w...'], { w: '#bfe0ff' }],
  hungry: [['..s.s..', '...s...', 'wwwwwww', 'w.....w', '.w...w.', '..www..', '.......'], { w: '#c8a070', s: '#c8d4e4' }],
  hand: [['..f....', '..f.f..', 'f.fff.f', 'fffffff', 'ffffff.', '.ffff..', '..ff...'], { f: '#f2c9a0' }],
  pick: [['.mmmmm.', 'm..h..m', '...h...', '...h...', '...h...', '...h...', '.......'], { m: '#9aa0aa', h: '#c8a070' }],
  ladder: [['l...l..', 'lllll..', 'l...l..', 'lllll..', 'l...l..', 'lllll..', 'l...l..'], { l: '#c8a070' }],
  room: [['...r...', '..rrr..', '.rrrrr.', 'rrrrrrr', '.wwyww.', '.wwyww.', '.wwyww.'], { r: '#a8423a', w: '#8a5a34', y: '#ffd27a' }],
  decor: [['...i...', '..iii..', '..yyy..', '..yyy..', '..iii..', '.......', '.......'], { i: '#575c66', y: '#ffd27a' }],
  erase: [['r.....r', '.r...r.', '..r.r..', '...r...', '..r.r..', '.r...r.', 'r.....r'], { r: '#e0485a' }],
  pause: [['.......', '.bb.bb.', '.bb.bb.', '.bb.bb.', '.bb.bb.', '.bb.bb.', '.......'], { b: '#e8dcc0' }],
  play1: [['.......', '.b.....', '.bbb...', '.bbbbb.', '.bbb...', '.b.....', '.......'], { b: '#e8dcc0' }],
  play2: [['.......', 'b..b...', 'bb.bb..', 'bbbbbb.', 'bb.bb..', 'b..b...', '.......'], { b: '#e8dcc0' }],
  play3: [['.......', 'b.b.b..', 'bbbbbb.', 'bbbbbbb', 'bbbbbb.', 'b.b.b..', '.......'], { b: '#e8dcc0' }],
  sound: [['...b...', '..bb.b.', 'bbbb..b', 'bbbb..b', 'bbbb..b', '..bb.b.', '...b...'], { b: '#e8dcc0' }],
  mute: [['...b...', '..bb...', 'bbbbr.r', 'bbbb.r.', 'bbbbr.r', '..bb...', '...b...'], { b: '#8a7a68', r: '#e0485a' }],
  axe: [['.mm....', 'mmmh...', '.mm.h..', '.....h.', '......h', '.......', '.......'], { m: '#9aa0aa', h: '#c8a070' }],
  hammer: [['mmm....', 'mmmh...', '....h..', '.....h.', '......h', '.......', '.......'], { m: '#9aa0aa', h: '#c8a070' }],
  sun: [['y..y..y', '.yyyyy.', '.yYYYy.', 'yyYYYyy', '.yYYYy.', '.yyyyy.', 'y..y..y'], { y: '#f0b040', Y: '#ffe090' }],
  moon: [['..mmm..', '.mmm...', 'mmm....', 'mmm....', 'mmm....', '.mmm...', '..mmm..'], { m: '#e8e0c0' }],
  check: [['.......', '......g', '.....g.', 'g...g..', '.g.g...', '..g....', '.......'], { g: '#7ad06a' }],
  lock: [['..ggg..', '.g...g.', '.g...g.', 'yyyyyyy', 'yyy.yyy', 'yyy.yyy', 'yyyyyyy'], { g: '#9aa0aa', y: '#d0a040' }],
  cozy: [['...f...', '..fFf..', '.fFyFf.', '.fyyyf.', '..fff..', 'wwwwwww', '.w...w.'], { f: '#f08a3a', F: '#ffd060', y: '#fff0a0', w: '#8a5a34' }],
  fire: [['...f...', '..ff...', '..fFf..', '.fFyFf.', '.fyyyf.', '..fyf..', '.......'], { f: '#f08a3a', F: '#ffd060', y: '#fff0a0' }],
  question: [['..yyy..', '.y...y.', '.....y.', '...yy..', '...y...', '.......', '...y...'], { y: '#e8dcc0' }],
};
export const ICON = {};
for (const k in ICONS) ICON[k] = ascii(ICONS[k][0], ICONS[k][1]);
