'use strict';
// Shared constants and helpers. Classic scripts share globals so the game also runs from file://.
const T = 8;            // tile size in px
const VW = 384, VH = 216; // internal resolution
const DAY_SEC = 600;    // real seconds per in-game day

// tiles
const AIR = 0, WALL = 1, PLAT = 2, LAD = 3, GRND = 4, LADF = 6;
// backgrounds
const B_SKY = 0, B_ROOM = 1, B_WELL = 2, B_SEWER = 3, B_EARTH = 4;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
let R = Math.random;
const rnd = (a, b) => a + R() * (b - a);
const irnd = (a, b) => Math.floor(a + R() * (b - a + 1));
const pick = (a) => a[Math.floor(R() * a.length)];
const chance = (p) => R() < p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function rgb(r, g, b) { return `rgb(${r | 0},${g | 0},${b | 0})`; }
function shade(h, f) { const [r, g, b] = hexRgb(h); return rgb(clamp(r * f, 0, 255), clamp(g * f, 0, 255), clamp(b * f, 0, 255)); }
function mix(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return rgb(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }

// 3x5 pixel font for painted wall labels and world prompts
const FONT = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', '!': '010010010000010',
  '?': '110001010000010', ':': '000010000010000', '$': '011110010011110', '/': '001001010100100', '+': '000010111010000',
};
function text3(ctx, s, x, y, col) {
  ctx.fillStyle = col;
  s = String(s).toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT['?'];
    for (let j = 0; j < 15; j++) if (g[j] === '1') ctx.fillRect(x + i * 4 + (j % 3), y + ((j / 3) | 0), 1, 1);
  }
}
const text3w = (s) => String(s).length * 4 - 1;

// Glyphs for the shop signs. Real characters when a CJK font exists, invented ones otherwise.
const Glyph = (() => {
  const cache = new Map();
  let hasCJK = null;
  function raster(ch, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.textBaseline = 'middle'; x.textAlign = 'center';
    x.font = `bold ${size}px "Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei","Hiragino Sans",sans-serif`;
    x.fillText(ch, size / 2, size / 2 + 1);
    const d = x.getImageData(0, 0, size, size).data;
    const m = new Uint8Array(size * size);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
    return m;
  }
  function detect() {
    const a = raster('牙', 9), b = raster('麵', 9);
    let diff = 0, ink = 0;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) diff++; ink += a[i]; }
    hasCJK = diff > 6 && ink > 8;
  }
  function fake(ch, size) {
    const r = mulberry32(ch.charCodeAt(0) * 7919);
    const m = new Uint8Array(size * size);
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      if (r() < 0.55) { const y = 1 + Math.floor(r() * (size - 2)), x0 = Math.floor(r() * 3), x1 = size - 1 - Math.floor(r() * 3); for (let x = x0; x <= x1; x++) m[y * size + x] = 1; }
      else { const x = 1 + Math.floor(r() * (size - 2)), y0 = Math.floor(r() * 3), y1 = size - 1 - Math.floor(r() * 2); for (let y = y0; y <= y1; y++) m[y * size + x] = 1; }
    }
    if (r() < 0.5) { const x0 = 1, y0 = 1 + Math.floor(r() * 3), w = size - 3, h = 3; for (let x = x0; x <= x0 + w; x++) { m[y0 * size + x] = 1; m[(y0 + h) * size + x] = 1; } for (let y = y0; y <= y0 + h; y++) { m[y * size + x0] = 1; m[y * size + x0 + w] = 1; } }
    return m;
  }
  return {
    get(ch, size = 9) {
      if (hasCJK === null) detect();
      const k = ch + size;
      if (!cache.has(k)) cache.set(k, hasCJK ? raster(ch, size) : fake(ch, size));
      return cache.get(k);
    },
  };
})();

const NAMES_F = ['Mrs. Chan', 'Auntie Wong', 'Siu Ling', 'Mei', 'Ah Fong', 'Mrs. Leung', 'Grandma Ho', 'Wai Yee', 'Ah Lan', 'Mrs. Tse', 'Kit Ying', 'Auntie So', 'Po Chu', 'Mrs. Fung', 'Ah Ngan'];
const NAMES_M = ['Uncle Fai', 'Ah Wing', 'Old Ho', 'Mr. Yip', 'Ah Keung', 'Big Tam', 'Mr. Lo', 'Uncle Shing', 'Ah Lok', 'Fat Kei', 'Mr. Pang', 'Ah Chuen', 'Old Mak', 'Kwok', 'Ah Sang'];
const NAMES_K = ['Siu Ming', 'Ah Bo', 'Tin Tin', 'Ah Kit', 'Ka Ho', 'Little Mui', 'Ah Jai', 'Ling Ling'];
