// Canvas, colour and pixel helpers shared by the art, scene and UI code.

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  c.g = c.getContext('2d');
  c.g.imageSmoothingEnabled = false;
  return c;
}

// ---------- colour ----------
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export function hex(r, g, b) {
  return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1);
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export const INK = '#26162b';
export const darken = (c, t) => mix(c, INK, t);
export const lighten = (c, t) => mix(c, '#fff6dc', t);
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex(f(0) * 255, f(8) * 255, f(4) * 255);
}

// ---------- math ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => t * t * (3 - 2 * t);
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(x, y = 0, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

// ---------- formatting ----------
export function fmt(n) {
  n = Math.floor(n);
  if (n < 100000) return n.toLocaleString('en-US');
  const u = ['K', 'M', 'B', 'T', 'Qd', 'Qn'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  const s = n < 10 ? (Math.floor(n * 100) / 100).toFixed(2) : n < 100 ? (Math.floor(n * 10) / 10).toFixed(1) : String(Math.floor(n));
  return s + u[i];
}
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 3600) return Math.floor(sec / 3600) + 'h ' + String(Math.floor((sec % 3600) / 60)).padStart(2, '0') + 'm';
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
export function fmtKg(kg) {
  return kg < 10 ? kg.toFixed(2) + 'kg' : kg < 100 ? kg.toFixed(1) + 'kg' : Math.round(kg) + 'kg';
}

// ---------- pixel painting ----------
// A painter draws single pixels / shapes with integer coordinates into a small canvas.
export function painter(c) {
  const g = c.g;
  const P = {
    c, g,
    dot(x, y, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, 1, 1); },
    rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); },
    line(x0, y0, x1, y1, col) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      g.fillStyle = col;
      for (;;) {
        g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * e;
        if (e2 >= dy) { e += dy; x0 += sx; }
        if (e2 <= dx) { e += dx; y0 += sy; }
      }
    },
    // filled ellipse; cx/cy may be fractional (use .5 for odd sizes)
    oval(cx, cy, rx, ry, col) {
      g.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
        }
    },
    // lit ellipse: cols = [shadow, base, light, (spec)]
    ball(cx, cy, rx, ry, cols, opt = {}) {
      const lx = opt.lx ?? -0.55, ly = opt.ly ?? -0.8;
      const hi = opt.hi ?? 0.42, lo = opt.lo ?? -0.22;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy;
          if (d > 1) continue;
          const l = dx * lx + dy * ly + (1 - d) * 0.3;
          const dith = ((x + y) & 1) ? 0.04 : -0.04;
          let col = cols[1];
          if (l + dith > hi) col = cols[2];
          else if (l + dith < lo) col = cols[0];
          if (cols[3] && l > hi + 0.32 && d < 0.6) col = cols[3];
          g.fillStyle = col; g.fillRect(x, y, 1, 1);
        }
    },
    // draw a string-art sprite. pal maps chars to colours; '.' and ' ' are transparent
    rows(x, y, rows, pal) {
      for (let j = 0; j < rows.length; j++)
        for (let i = 0; i < rows[j].length; i++) {
          const ch = rows[j][i];
          if (ch === '.' || ch === ' ') continue;
          const col = pal[ch];
          if (!col) continue;
          g.fillStyle = col; g.fillRect(x + i, y + j, 1, 1);
        }
    },
  };
  return P;
}

// Build a sprite with a painter callback, then add a 1px outline.
// outline: 'sel' (darkened neighbour colour), a colour string, or false.
export function build(w, h, fn, outline = 'sel') {
  const c = canvas(w + 2, h + 2);
  c.g.save();
  c.g.translate(1, 1);
  fn(painter(c));
  c.g.restore();
  if (outline) addOutline(c, outline);
  return c;
}

export function addOutline(c, mode = 'sel', amt = 0.62) {
  const w = c.width, h = c.height;
  const id = c.g.getImageData(0, 0, w, h), d = id.data, src = new Uint8ClampedArray(d);
  const fixed = mode !== 'sel' ? rgb(mode) : null;
  const ink = rgb(INK);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 0) continue;
      let n = -1;
      if (x > 0 && src[i - 4 + 3] > 0) n = i - 4;
      else if (x < w - 1 && src[i + 4 + 3] > 0) n = i + 4;
      else if (y > 0 && src[i - w * 4 + 3] > 0) n = i - w * 4;
      else if (y < h - 1 && src[i + w * 4 + 3] > 0) n = i + w * 4;
      if (n < 0) continue;
      if (fixed) { d[i] = fixed[0]; d[i + 1] = fixed[1]; d[i + 2] = fixed[2]; }
      else {
        d[i] = src[n] + (ink[0] - src[n]) * amt;
        d[i + 1] = src[n + 1] + (ink[1] - src[n + 1]) * amt;
        d[i + 2] = src[n + 2] + (ink[2] - src[n + 2]) * amt;
      }
      d[i + 3] = 255;
    }
  c.g.putImageData(id, 0, 0);
  return c;
}

export function flipX(src) {
  const c = canvas(src.width, src.height);
  c.g.translate(src.width, 0);
  c.g.scale(-1, 1);
  c.g.drawImage(src, 0, 0);
  return c;
}

// Per-pixel recolour: fn([r,g,b,a], x, y) -> [r,g,b,a] or null to keep
export function recolor(src, fn) {
  const c = canvas(src.width, src.height);
  c.g.drawImage(src, 0, 0);
  const id = c.g.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    if (!d[i + 3]) continue;
    const r = fn([d[i], d[i + 1], d[i + 2], d[i + 3]], p % c.width, (p / c.width) | 0);
    if (r) { d[i] = r[0]; d[i + 1] = r[1]; d[i + 2] = r[2]; d[i + 3] = r[3] ?? d[i + 3]; }
  }
  c.g.putImageData(id, 0, 0);
  return c;
}
export const luma = (p) => (p[0] * 0.3 + p[1] * 0.55 + p[2] * 0.15) / 255;

// Map a sprite onto a colour ramp by luminance (used for gold, frozen, etc.)
export function ramp(src, cols) {
  const R = cols.map(rgb);
  return recolor(src, (p) => {
    const l = luma(p);
    const k = Math.min(R.length - 1, Math.floor(Math.pow(l, 0.85) * R.length));
    return [...R[k], p[3]];
  });
}

// Silhouette in one colour (for shadows and glows)
export function silhouette(src, col, alpha = 255) {
  const C = rgb(col);
  return recolor(src, (p) => [C[0], C[1], C[2], p[3] ? alpha : 0]);
}

// ---------- ordered dithering ----------
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const patCache = new Map();
// A 4x4 pattern with `level` of 16 pixels filled (0..16) in col.
export function ditherPattern(g, col, level) {
  level = clamp(Math.round(level), 0, 16);
  const key = col + level;
  let p = patCache.get(key);
  if (!p) {
    const c = canvas(4, 4);
    c.g.fillStyle = col;
    for (let i = 0; i < 16; i++) if (BAYER[i] < level) c.g.fillRect(i & 3, i >> 2, 1, 1);
    p = c;
    patCache.set(key, p);
  }
  return g.createPattern(p, 'repeat');
}
export function ditherRect(g, x, y, w, h, col, level) {
  if (level <= 0) return;
  if (level >= 16) { g.fillStyle = col; g.fillRect(x, y, w, h); return; }
  g.fillStyle = ditherPattern(g, col, level);
  g.fillRect(x, y, w, h);
}
// A smooth radial light, cached by size and colour (used additively for lamps and night glows).
const softCache = new Map();
export function softGlow(r, col, a = 1) {
  const key = r + col + a;
  let c = softCache.get(key);
  if (c) return c;
  c = canvas(r * 2, r * 2);
  const [R, Gc, B] = rgb(col);
  const gr = c.g.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${R},${Gc},${B},${a})`);
  gr.addColorStop(0.45, `rgba(${R},${Gc},${B},${a * 0.35})`);
  gr.addColorStop(1, `rgba(${R},${Gc},${B},0)`);
  c.g.fillStyle = gr;
  c.g.fillRect(0, 0, r * 2, r * 2);
  softCache.set(key, c);
  return c;
}
// A soft round light / shadow made of dithered rings, cached by size and colour.
const glowCache = new Map();
export function glow(r, col, strength = 1) {
  const key = r + col + strength;
  let c = glowCache.get(key);
  if (c) return c;
  c = canvas(r * 2, r * 2);
  const C = rgb(col);
  const id = c.g.getImageData(0, 0, r * 2, r * 2), d = id.data;
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) {
      const dd = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      if (dd >= 1) continue;
      const v = (1 - dd) * (1 - dd) * 16 * strength * 1.6;
      if (BAYER[(y & 3) * 4 + (x & 3)] < v) {
        const i = (y * r * 2 + x) * 4;
        d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = 255;
      }
    }
  c.g.putImageData(id, 0, 0);
  glowCache.set(key, c);
  return c;
}
