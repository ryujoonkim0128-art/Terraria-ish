// Small shared helpers: seeded randomness, noise, canvases, colours and a tiny pixel font.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 1D and 2D value noise in [0, 1].
export function noise1(x, s = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash2(i, 0, s) * (1 - u) + hash2(i + 1, 0, s) * u;
}
export function noise2(x, y, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbHex(r, g, b) {
  const f = (v) => clamp(Math.round(v), 0, 255);
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
// k > 0 lightens toward white, k < 0 darkens toward black.
export function shade(h, k) {
  const [r, g, b] = hexRGB(h);
  const f = (v) => (k > 0 ? v + (255 - v) * k : v * (1 + k));
  return rgbHex(f(r), f(g), f(b));
}
export function mix(a, b, t) {
  const A = hexRGB(a), B = hexRGB(b);
  return rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

export const INK = '#140c0e';

// 1px ink outline around the opaque pixels of a canvas (in place).
export function outline(c, col = INK) {
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height);
  const a = d.data, W = c.width, H = c.height;
  const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 0 ? 1 : 0;
  const [r, g, b] = hexRGB(col);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const k = y * W + i;
    if (src[k]) continue;
    if ((i > 0 && src[k - 1]) || (i < W - 1 && src[k + 1]) || (y > 0 && src[k - W]) || (y < H - 1 && src[k + W])) {
      a[k * 4] = r; a[k * 4 + 1] = g; a[k * 4 + 2] = b; a[k * 4 + 3] = 255;
    }
  }
  x.putImageData(d, 0, 0);
  return c;
}

const flipCache = new WeakMap();
export function flipped(c) {
  let f = flipCache.get(c);
  if (f) return f;
  const [n, x] = canvas(c.width, c.height);
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  flipCache.set(c, n);
  return n;
}

// ASCII rows -> canvas; '.' and ' ' are transparent.
export function ascii(rows, pal, pad = 1, ink = true) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const [c, x] = canvas(w + pad * 2, h + pad * 2);
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      const col = pal[row[i]];
      if (col) { x.fillStyle = col; x.fillRect(i + pad, y + pad, 1, 1); }
    }
  });
  return ink ? outline(c) : c;
}

// 3x5 pixel font: digits and the few symbols the HUD needs.
const GLYPHS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '/': '001001010100100', 'x': '000101010101000', ':': '000010000010000',
  ' ': '000000000000000',
};
export function textWidth(s, scale = 1) { return s.length * 4 * scale - scale; }
export function drawText(x2d, s, x, y, col, scale = 1, shadow = null) {
  if (shadow) drawText(x2d, s, x + scale, y + scale, shadow, scale);
  x2d.fillStyle = col;
  for (let n = 0; n < s.length; n++) {
    const g = GLYPHS[s[n]];
    if (!g) continue;
    for (let k = 0; k < 15; k++) if (g[k] === '1') x2d.fillRect(x + n * 4 * scale + (k % 3) * scale, y + Math.floor(k / 3) * scale, scale, scale);
  }
}

// 5x5 letters for the title card.
const BIG = {
  H: '1000110001111111000110001', E: '1111110000111101000011111', A: '0111010001111111000110001', R: '1111010001111101001010001',
  T: '1111100100001000010000100', B: '1111010001111101000111110', U: '1000110001100011000101110', O: '0111010001100011000101110',
  W: '1000110001101011010101010',
};
export function bigTextWidth(s, scale) { return s.length * 6 * scale - scale; }
export function drawBigText(x2d, s, x, y, col, scale) {
  x2d.fillStyle = col;
  for (let n = 0; n < s.length; n++) {
    const g = BIG[s[n]];
    if (!g) continue;
    for (let k = 0; k < 25; k++) if (g[k] === '1') x2d.fillRect(x + n * 6 * scale + (k % 5) * scale, y + Math.floor(k / 5) * scale, scale, scale);
  }
}
