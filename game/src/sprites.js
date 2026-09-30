// Procedural pixel sprites: characters from ASCII art, furniture drawn with rects, item icons.
import { OBJ } from './content.js';

export const INK = '#140e12';

function canvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

// Add a 1px ink outline around opaque pixels (in place).
export function outline(c, col = INK) {
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height);
  const a = d.data, W = c.width, H = c.height;
  const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 0 ? 1 : 0;
  const [r, g, b] = hexRGB(col);
  for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
    const i = y * W + x2;
    if (src[i]) continue;
    if ((x2 > 0 && src[i - 1]) || (x2 < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) {
      a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255;
    }
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(h, k) {
  const [r, g, b] = hexRGB(h);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}

// ASCII → canvas. pal maps characters to colours; '.' is transparent.
function ascii(rows, pal, pad = 1) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const [c, x] = canvas(w + pad * 2, h + pad * 2);
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) { x.fillStyle = col; x.fillRect(i + pad, y + pad, 1, 1); }
    }
  });
  return outline(c);
}

const flipCache = new WeakMap();
export function flipped(c) {
  if (flipCache.has(c)) return flipCache.get(c);
  const [f, x] = canvas(c.width, c.height);
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  flipCache.set(c, f);
  return f;
}

// ------------------------------------------------------------------ villagers
const VBODY = [
  '............',
  '....hhhh....',
  '...hHHHHh...',
  '..hHHHHHHh..',
  '..hHHHHsssh.',
  '..hHHHHsSEs.',
  '..hHHHHSSSh.',
  '...hHHHhhh..',
  '...rRRRRRr..',
  '..rLRRRRRRr.',
  '..rLRRRRRAr.',
  '..rLRRRRRRS.',
  '..rLRRRRRRr.',
  '.rLLRRRRRRRr',
  '.rLRRRRRRRRr',
];
const FEET = { a: '..ff....ff..', b: '....ffff....', c: '...ff..ff...' };
const KID = [
  '..........',
  '...hhhh...',
  '..hHHHHh..',
  '..hHHssh..',
  '..hHHSES..',
  '..hHHSSh..',
  '...hhhh...',
  '..rRRRRr..',
  '.rLRRRRAr.',
  '.rLRRRRRS.',
  '.rLRRRRRr.',
];
const KFEET = { a: '..ff..ff..', b: '...ffff...', c: '...f..f...' };

export const ROLE_LOOK = {
  cook: { R: '#b3a27c', H: '#8a7a58', apron: '#e2d8c0' },
  smith: { R: '#6f4a38', H: '#4e3326', apron: '#2e2018' },
  keeper: { R: '#8a5a3a', H: '#6a4028', apron: '#d8c8a0' },
  weaver: { R: '#4f6488', H: '#3a4a68' },
  hauler: { R: '#667548', H: '#4a5732' },
  farmer: { R: '#5f7a4a', H: '#465c34' },
  miner: { R: '#6a6358', H: '#4c463e', helmet: true },
  guard: { R: '#8a3b33', H: '#5c2723', helmet: true },
  elder: { R: '#6b6680', H: '#4e4a5e', staff: true },
  kid: { R: '#9a6a4a', H: '#734c33' },
  settler: { R: '#7c5a70', H: '#5a3f52' },
};
const SKINS = ['#e6bf98', '#cf9a70', '#a8744e', '#76513a'];

function villagerPal(look, skin) {
  return {
    h: shade(look.H, -0.3), H: look.H, R: look.R, L: shade(look.R, 0.18), r: shade(look.R, -0.28), A: shade(look.R, -0.15),
    S: skin, s: shade(skin, -0.22), E: '#1a1214', f: '#2a1d16', K: '#c8a86e', k: '#9a7a48', I: '#8a8e98', i: '#5d616b',
    P: look.apron || look.R, W: '#ffffff', T: '#6a4a2e', t: '#a0a4ae',
  };
}

function editRows(rows, edits) {
  const out = rows.slice();
  for (const [y, x, ch] of edits) {
    if (y < 0 || y >= out.length) continue;
    const r = out[y].split('');
    r[x] = ch; out[y] = r.join('');
  }
  return out;
}

function villagerFrame(role, skinI, pose, kid) {
  const look = ROLE_LOOK[kid ? 'kid' : role] || ROLE_LOOK.settler;
  const pal = villagerPal(look, SKINS[skinI % SKINS.length]);
  let rows = (kid ? KID : VBODY).slice();
  const F = kid ? KFEET : FEET;
  const e = [];
  const hand = kid ? [9, 8] : [11, 10];       // [row, col] of the resting hand
  if (look.apron && !kid) for (let y = 9; y <= 13; y++) for (let x = 6; x <= 8; x++) e.push([y, x, 'P']);
  if (look.helmet && !kid) { e.push([1, 4, 'I'], [1, 5, 'I'], [1, 6, 'I'], [1, 7, 'I'], [2, 3, 'I'], [2, 8, 'i']); for (let x = 3; x <= 8; x++) e.push([2, x, x > 6 ? 'i' : 'I']); }
  let feet = F.a, bob = 0;
  switch (pose) {
    case 'walk1': feet = F.b; bob = -1; break;
    case 'walk2': feet = F.c; break;
    case 'walk3': feet = F.b; bob = -1; break;
    case 'climb0': case 'climb1': {
      const up = pose === 'climb0';
      for (let y = 4; y <= 6; y++) for (let x = kid ? 5 : 7; x <= (kid ? 7 : 9); x++) e.push([y, x, 'H']);
      e.push([up ? 3 : 5, 1, 'S'], [up ? 4 : 6, 1, 'A'], [up ? 5 : 3, kid ? 8 : 10, 'S'], [up ? 6 : 4, kid ? 8 : 10, 'A']);
      e.push([hand[0], hand[1], 'r']);
      feet = up ? F.c : F.b;
      break;
    }
    case 'work0': e.push([hand[0], hand[1], 'r'], [kid ? 6 : 7, kid ? 8 : 10, 'A'], [kid ? 5 : 6, kid ? 9 : 11, 'S']); break;
    case 'work1': e.push([hand[0], hand[1], 'r'], [kid ? 8 : 10, kid ? 9 : 11, 'S']); break;
    case 'carry0': case 'carry1': case 'carry2': case 'carry3': {
      for (let y = 3; y <= 8; y++) for (let x = 0; x <= 3; x++) if ((x + y) % 7 !== 0) e.push([y, x, y === 3 || x === 0 ? 'k' : 'K']);
      e.push([hand[0], hand[1], 'r'], [kid ? 6 : 8, kid ? 3 : 4, 'S']);
      if (pose === 'carry1' || pose === 'carry3') { feet = F.b; bob = -1; }
      if (pose === 'carry2') feet = F.c;
      break;
    }
    case 'flee0': case 'flee1':
      e.push([hand[0], hand[1], 'r'], [4, 1, 'S'], [5, 1, 'A'], [kid ? 3 : 4, kid ? 9 : 11, 'S']);
      feet = pose === 'flee0' ? F.a : F.b; bob = pose === 'flee1' ? -1 : 0;
      break;
    case 'sit': feet = kid ? '..........' : '............'; e.push([rows.length - 1, kid ? 8 : 10, 'f'], [rows.length - 1, kid ? 9 : 11, 'f']); break;
    case 'cower': rows = rows.filter((_, i) => i !== 9 && i !== 11); e.push([3, 9, 'W'], [2, 9, 'W']); break;
    default: break;
  }
  rows = editRows(rows, e.filter(([y]) => y < rows.length));
  rows.push(feet);
  const c = ascii(rows, pal);
  if (!bob) return c;
  const [b, x] = canvas(c.width, c.height);
  x.drawImage(c, 0, bob);
  return b;
}

const vcache = new Map();
export function villagerSprite(role, skin, pose, kid) {
  const k = role + skin + pose + (kid ? 'k' : '');
  if (!vcache.has(k)) vcache.set(k, villagerFrame(role, skin, pose, kid));
  return vcache.get(k);
}

// Sleeper: head on a pillow; drawn by the bed.
export function sleeperSprite(role, skin) {
  const look = ROLE_LOOK[role] || ROLE_LOOK.settler;
  return ascii(['.hHh.', 'hHHSs', 'hHHSs', '.hhh.'], villagerPal(look, SKINS[skin % SKINS.length]), 0);
}

// ------------------------------------------------------------------ player
const PBODY = [
  '.....ooo....',
  '....oOOOo...',
  '...oOOOOOo..',
  '...oOOoSSs..',
  '...oOOSSES..',
  '...oOoSSSS..',
  '....oSSSs...',
  '...gGGGGGg..',
  '..gGKTTTTGg.',
  '..gGKTTTTAg.',
  '..gGKTTTTTS.',
  '..gGKBBYBBg.',
  '...gTTTTTg..',
  '...pPP.pPP..',
];
const PPAL = {
  o: '#3a2418', O: '#5a3a24', S: '#e2b48c', s: '#b8865e', E: '#1a1214', g: '#244a4e', G: '#2f6a6a', K: '#7a5230',
  T: '#b09060', A: '#8a7048', B: '#4a3220', Y: '#d8b050', p: '#3a3a48', P: '#4a4a5c', d: '#2a1d16', D: '#3a2a1e',
};
const PLEGS = {
  a: ['...pPP.pPP..', '..dDD...dDD.'],
  b: ['....pPPpP...', '....dDDdD...'],
  c: ['...pP..pP...', '..dDD..dDD..'],
  j: ['..pPP..pPP..', '.dDD....dDD.'],
};
const pcache = new Map();
export function playerSprite(pose) {
  if (pcache.has(pose)) return pcache.get(pose);
  let rows = PBODY.slice();
  let legs = PLEGS.a, bob = 0;
  const e = [];
  if (pose === 'walk1' || pose === 'walk3') { legs = PLEGS.b; bob = -1; }
  if (pose === 'walk2') legs = PLEGS.c;
  if (pose === 'jump') legs = PLEGS.j;
  if (pose.startsWith('climb')) {
    const up = pose === 'climb0';
    for (let y = 3; y <= 6; y++) for (let x = 6; x <= 9; x++) e.push([y, x, 'O']);
    e.push([up ? 2 : 4, 1, 'S'], [up ? 3 : 5, 1, 'g'], [up ? 4 : 2, 10, 'S'], [up ? 5 : 3, 10, 'g'], [10, 10, 'g']);
    legs = up ? PLEGS.c : PLEGS.b;
  }
  if (pose === 'swing0') e.push([10, 10, 'g'], [6, 10, 'A'], [5, 11, 'S']);
  if (pose === 'swing1') e.push([10, 10, 'g'], [8, 10, 'A'], [8, 11, 'S']);
  if (pose === 'swing2') e.push([10, 10, 'A'], [11, 11, 'S']);
  rows = editRows(rows, e);
  rows = rows.slice(0, 13).concat(legs);
  let c = ascii(rows, PPAL);
  if (bob) { const [b, x] = canvas(c.width, c.height); x.drawImage(c, 0, bob); c = b; }
  pcache.set(pose, c);
  return c;
}

// ------------------------------------------------------------------ wolves
const WOLF = {
  stand: [
    '..............e.e...',
    '.............gGGg...',
    '............gGGGGg..',
    '...t.......gGGGYGGnn',
    '..tt..gGGGGGGGGGGbbn',
    '.tt..gGGGGGGGGGGGbb.',
    '....gGGGGGGGGGGGGb..',
    '....gGgbbbbbbbGGg...',
    '.....gl..g.....gl.l.',
    '.....gl..gl....gl.l.',
    '.....dd..dd....dd.dd',
  ],
  walk: [
    '..............e.e...',
    '.............gGGg...',
    '............gGGGGg..',
    '..t........gGGGYGGnn',
    '.tt...gGGGGGGGGGGbbn',
    'tt...gGGGGGGGGGGGbb.',
    '....gGGGGGGGGGGGGb..',
    '....gGgbbbbbbbGGg...',
    '....gl....gl..gl..l.',
    '...gl......gl.gl...l',
    '...dd......dd.dd...d',
  ],
  sleep: [
    '....................',
    '....................',
    '....................',
    '....................',
    '.......gGGGGGGg.....',
    '.....gGGGGGGGGGGe...',
    '....gGGGGGGGGGGGGg..',
    '...tgGGGGGGGGGgGGGnn',
    '..tgGGGGGGGGGGGgbbbn',
    '.ttgbbbbbbbbbbbbbbb.',
    '....................',
  ],
};
const WPAL = { g: '#3e4048', G: '#6a6d78', b: '#9ea2ac', t: '#4e515c', e: '#2e3038', n: '#1a1a20', Y: '#ffd24a', l: '#4e515c', d: '#26272d' };
const wcache = new Map();
export function wolfSprite(pose) {
  if (!wcache.has(pose)) wcache.set(pose, ascii(WOLF[pose] || WOLF.stand, WPAL));
  return wcache.get(pose);
}

// ------------------------------------------------------------------ furniture
const P = {
  wood: '#74502f', woodL: '#946a40', woodD: '#4a3220', woodDD: '#2e2016', iron: '#4a4d56', ironL: '#7a7e88', ironD: '#2c2e34',
  stone: '#5c616d', stoneL: '#7a808c', stoneD: '#3e424c', fire: '#f0a040', fireL: '#ffe08a', fireD: '#c05a20',
  linen: '#e2d6b8', linenD: '#b8aa88', red: '#9a4a3a', redD: '#6a2e26', blue: '#4a5a88', blueD: '#34406a', green: '#5f7a4a',
  straw: '#c8a86e', strawD: '#9a7a48', glass: '#c8e0e8', amber: '#e8a040',
};

function objDraw(type) {
  const d = OBJ[type];
  const W = d.w * 8, H = d.h * 8;
  const [c, x] = canvas(W, H);
  const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  switch (type) {
    case 'bed':
      R(1, 6, 22, 7, P.woodD); R(1, 2, 3, 12, P.wood); R(20, 6, 3, 8, P.wood);
      R(4, 6, 16, 3, P.linen); R(4, 5, 4, 2, P.linen); R(8, 5, 12, 4, P.red); R(8, 5, 12, 1, shade(P.red, 0.2));
      for (let i = 9; i < 20; i += 3) R(i, 7, 1, 1, P.linenD);
      R(2, 14, 2, 2, P.woodD); R(20, 14, 2, 2, P.woodD);
      break;
    case 'table':
      R(1, 5, 22, 3, P.woodL); R(1, 5, 22, 1, shade(P.woodL, 0.15)); R(3, 8, 2, 8, P.woodD); R(19, 8, 2, 8, P.woodD);
      R(6, 3, 4, 2, P.linen); R(13, 2, 3, 3, P.red); R(17, 3, 3, 2, P.straw);
      break;
    case 'chair':
      R(1, 1, 2, 15, P.wood); R(1, 8, 6, 2, P.woodL); R(5, 10, 2, 6, P.woodD);
      break;
    case 'workbench':
      R(1, 6, 22, 3, P.woodL); R(2, 9, 2, 7, P.woodD); R(20, 9, 2, 7, P.woodD); R(2, 12, 20, 1, P.woodD);
      R(4, 3, 6, 3, P.ironL); R(14, 4, 1, 2, P.woodD); R(12, 3, 5, 1, P.ironL); R(18, 2, 3, 4, P.wood);
      break;
    case 'anvil':
      R(1, 1, 13, 2, P.ironL); R(0, 2, 3, 1, P.ironL); R(5, 3, 5, 2, P.iron); R(3, 5, 9, 3, P.ironD);
      break;
    case 'furnace':
      R(1, 3, 14, 21, P.stoneD); R(2, 3, 12, 1, P.stoneL);
      for (let y = 6; y < 24; y += 4) R(1, y, 14, 1, P.stone);
      R(4, 12, 8, 8, '#1a1214'); R(5, 15, 6, 5, P.fireD); R(6, 16, 4, 4, P.fire); R(7, 17, 2, 2, P.fireL);
      R(5, 0, 6, 3, P.stone);
      break;
    case 'hearth':
      R(0, 6, 24, 18, P.stone); R(0, 6, 24, 2, P.stoneL); for (let y = 10; y < 24; y += 3) R(0, y, 24, 1, P.stoneD);
      R(0, 4, 24, 2, P.woodD); R(4, 11, 16, 13, '#1a1214');
      R(8, 12, 1, 5, P.ironD); R(7, 16, 7, 4, P.iron); R(6, 16, 9, 1, P.ironL);
      R(6, 21, 12, 2, P.fireD); R(8, 20, 8, 2, P.fire); R(10, 19, 4, 2, P.fireL); R(5, 23, 14, 1, P.woodD);
      R(3, 1, 3, 3, P.red); R(18, 2, 3, 2, P.linen);
      break;
    case 'loom':
      R(1, 1, 2, 23, P.wood); R(21, 1, 2, 23, P.wood); R(1, 1, 22, 2, P.woodL); R(1, 12, 22, 2, P.woodD); R(1, 20, 22, 2, P.woodD);
      for (let i = 4; i < 20; i++) R(i, 3, 1, 9, i % 2 ? P.red : P.linen);
      for (let y = 14; y < 20; y++) for (let i = 3; i < 21; i++) R(i, y, 1, 1, (i + y) % 4 === 0 ? P.linen : P.red);
      break;
    case 'barrel':
      R(2, 1, 12, 15, P.wood); R(1, 3, 14, 11, P.wood); R(2, 1, 12, 1, P.woodL);
      R(1, 4, 14, 1, P.ironD); R(1, 11, 14, 1, P.ironD); R(5, 2, 1, 13, P.woodD); R(10, 2, 1, 13, P.woodD);
      break;
    case 'crate':
      R(1, 2, 14, 14, P.woodL); R(1, 2, 14, 1, shade(P.woodL, 0.15));
      for (let i = 0; i < 12; i++) R(2 + i, 3 + i, 1, 1, P.woodD);
      R(1, 2, 1, 14, P.woodD); R(14, 2, 1, 14, P.woodD);
      break;
    case 'sack':
      R(1, 3, 6, 5, P.straw); R(2, 2, 4, 1, P.straw); R(3, 1, 2, 1, P.strawD); R(1, 7, 6, 1, P.strawD); R(5, 4, 1, 2, P.strawD);
      break;
    case 'chest':
      R(1, 4, 14, 12, P.wood); R(1, 4, 14, 3, P.woodL); R(1, 7, 14, 1, P.woodD);
      R(1, 4, 1, 12, P.amber); R(14, 4, 1, 12, P.amber); R(7, 8, 2, 3, P.amber);
      break;
    case 'shelf':
      R(0, 12, 24, 2, P.woodL); R(1, 14, 2, 2, P.woodD); R(21, 14, 2, 2, P.woodD);
      [[2, P.amber], [6, P.green], [10, P.red], [14, P.blue], [18, P.linen]].forEach(([i, col], k) => R(i, 12 - 4 - (k % 2), 3, 4 + (k % 2), col));
      break;
    case 'bookshelf':
      R(0, 0, 24, 32, P.woodD); R(1, 1, 22, 30, '#2a1a12');
      for (const sy of [1, 11, 21]) { for (let i = 1; i < 23; i += 2) R(i, sy + 1 + (i % 3), 2, 8 - (i % 3), [P.red, P.blue, P.green, P.straw][i % 4]); R(0, sy + 9, 24, 1, P.wood); }
      break;
    case 'torch':
      R(3, 3, 2, 5, P.wood); R(2, 1, 4, 3, P.fire); R(3, 0, 2, 2, P.fireL);
      break;
    case 'lantern':
      R(3, 0, 2, 2, P.ironD); R(1, 2, 6, 5, P.ironD); R(2, 3, 4, 3, P.fire); R(3, 3, 2, 2, P.fireL); R(1, 7, 6, 1, P.iron);
      break;
    case 'lamppost':
      R(3, 6, 2, 26, P.woodD); R(1, 29, 6, 3, P.stoneD); R(1, 1, 6, 5, P.ironD); R(2, 2, 4, 3, P.fire); R(3, 2, 2, 2, P.fireL); R(0, 0, 8, 1, P.iron);
      break;
    case 'campfire':
      R(1, 6, 14, 2, P.stoneD); R(2, 5, 12, 1, P.woodD); R(4, 2, 8, 4, P.fire); R(6, 0, 4, 3, P.fireL); R(5, 4, 1, 1, P.fireD); R(10, 3, 1, 2, P.fireD);
      break;
    case 'banner':
      R(0, 0, 8, 2, P.woodD); R(1, 2, 6, 18, P.red); R(1, 20, 2, 2, P.red); R(5, 20, 2, 2, P.red); R(2, 6, 4, 4, P.amber); R(3, 12, 2, 5, P.linen);
      break;
    case 'potplant':
      R(2, 5, 4, 3, P.red); R(1, 5, 6, 1, P.redD); R(3, 1, 2, 4, P.green); R(1, 2, 2, 2, P.green); R(5, 1, 2, 2, P.green); R(3, 0, 2, 1, P.amber);
      break;
    case 'bones':
      R(1, 5, 6, 2, P.linen); R(0, 4, 2, 2, P.linen); R(6, 6, 2, 2, P.linen); R(9, 4, 5, 2, P.linenD); R(12, 3, 3, 3, P.linen);
      break;
    case 'well':
      R(2, 20, 28, 12, P.stone); for (let y = 22; y < 32; y += 3) R(2, y, 28, 1, P.stoneD); R(2, 20, 28, 2, P.stoneL);
      R(3, 4, 2, 16, P.woodD); R(27, 4, 2, 16, P.woodD); R(1, 2, 30, 3, P.strawD); R(3, 0, 26, 2, P.straw);
      R(15, 5, 1, 9, P.linenD); R(13, 13, 5, 4, P.wood);
      break;
    case 'yarn':
      R(1, 2, 2, 22, P.wood); R(13, 2, 2, 22, P.wood); R(1, 2, 14, 2, P.woodL); R(1, 12, 14, 1, P.woodD);
      [[3, P.red], [6, P.blue], [9, P.amber]].forEach(([i, col]) => { R(i, 4, 3, 7, col); R(i, 14, 3, 7, col === P.red ? P.green : col); });
      break;
    case 'cauldron':
      R(1, 6, 14, 8, P.ironD); R(0, 5, 16, 2, P.iron); R(2, 6, 12, 2, P.green); R(3, 14, 2, 2, P.ironD); R(11, 14, 2, 2, P.ironD);
      break;
    case 'minecart':
      R(2, 3, 20, 9, P.iron); R(2, 3, 20, 1, P.ironL); R(4, 12, 4, 4, P.ironD); R(16, 12, 4, 4, P.ironD);
      for (let i = 0; i < 6; i++) R(4 + i * 3, 1 + (i % 2), 3, 3, i % 2 ? P.amber : P.stone);
      break;
    default:
      R(0, 0, W, H, '#ff00ff');
  }
  return outline(c);
}

const ocache = new Map();
export function objSprite(type) {
  if (!ocache.has(type)) ocache.set(type, objDraw(type));
  return ocache.get(type);
}

// ------------------------------------------------------------------ item icons (10×10)
const icache = new Map();
export function itemIcon(id, def, tileTex) {
  if (icache.has(id)) return icache.get(id);
  const [c, x] = canvas(12, 12);
  x.imageSmoothingEnabled = false;
  const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  if (def.kind === 'tile' || def.kind === 'wall') {
    const t = tileTex(def);
    if (t) x.drawImage(t, 2, 2);
  } else if (def.kind === 'object') {
    const s = objSprite(def.place);
    const k = Math.min(10 / s.width, 10 / s.height, 1);
    const w = Math.max(1, Math.round(s.width * k)), h = Math.max(1, Math.round(s.height * k));
    x.drawImage(s, 0, 0, s.width, s.height, 1 + ((10 - w) >> 1), 1 + (10 - h), w, h);
  } else {
    switch (id) {
      case 'pickaxe': case 'iron_pickaxe': {
        const head = id === 'pickaxe' ? '#d08a4e' : '#b8bcc6';
        for (let i = 0; i < 7; i++) R(2 + i, 9 - i, 1, 1, P.woodL);
        R(3, 2, 6, 1, head); R(2, 3, 2, 1, head); R(8, 3, 2, 2, head); R(5, 1, 3, 1, shade(head, 0.3));
        break;
      }
      case 'wood_sword': case 'copper_sword': case 'iron_sword': {
        const bl = { wood_sword: '#a67a4a', copper_sword: '#d8905a', iron_sword: '#c8ccd6' }[id];
        for (let i = 0; i < 6; i++) R(4 + i, 7 - i, 1, 1, bl), R(5 + i, 7 - i, 1, 1, shade(bl, 0.35));
        R(2, 7, 4, 1, P.amber); R(4, 5, 1, 4, P.amber); R(2, 9, 2, 2, P.woodD);
        break;
      }
      case 'wood': R(2, 4, 8, 4, P.wood); R(2, 4, 8, 1, P.woodL); R(8, 4, 2, 4, '#c8a878'); R(9, 5, 1, 2, P.woodD); break;
      case 'fiber': for (let i = 0; i < 4; i++) R(3 + i * 2, 2 + (i % 2), 1, 8, i % 2 ? '#7a9a4a' : '#5f7a3a'); R(2, 6, 8, 1, P.strawD); break;
      case 'coal': R(3, 4, 6, 5, '#26262c'); R(4, 3, 3, 2, '#3a3a44'); R(4, 4, 1, 1, '#5a5a66'); break;
      case 'copper': R(3, 4, 6, 5, '#8e4e2a'); R(4, 3, 3, 2, '#d08a4e'); R(5, 5, 2, 1, '#f0b070'); break;
      case 'iron': R(3, 4, 6, 5, '#7a6a64'); R(4, 3, 3, 2, '#c8b0a4'); R(5, 5, 2, 1, '#e8d8d0'); break;
      case 'pelt': R(2, 3, 8, 6, '#6a6d78'); R(1, 4, 1, 3, '#6a6d78'); R(10, 4, 1, 3, '#6a6d78'); R(3, 4, 6, 3, '#9ea2ac'); break;
      case 'bone': R(3, 5, 6, 2, P.linen); R(2, 4, 2, 2, P.linen); R(8, 6, 2, 2, P.linen); break;
      case 'coin': R(3, 3, 6, 6, '#d8a840'); R(4, 4, 4, 4, '#f0c860'); R(5, 5, 2, 2, '#b88828'); break;
      case 'bread': R(2, 5, 8, 4, '#b8783a'); R(3, 4, 6, 1, '#d8985a'); R(4, 5, 1, 1, '#f0c080'); R(7, 5, 1, 1, '#f0c080'); break;
      case 'meat': R(3, 3, 6, 6, '#a84a44'); R(4, 4, 3, 3, '#d86a60'); R(8, 7, 2, 2, P.linen); break;
      case 'stew': R(2, 5, 8, 4, P.woodD); R(3, 5, 6, 2, '#b86a3a'); R(5, 3, 1, 2, '#c8c0b0'); break;
      default: R(3, 3, 6, 6, '#ff00ff');
    }
  }
  outline(c);
  icache.set(id, c);
  return c;
}
