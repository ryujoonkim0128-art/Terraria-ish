// Pixel-painting helpers: tiny canvases, shaded primitives, outlines, colour math.
export const INK = '#1b1220';

export function canvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
}
// k>0 lightens toward white, k<0 darkens.
export function shade(h, k) {
  const [r, g, b] = hexRGB(h);
  const f = (v) => (k > 0 ? v + (255 - v) * k : v * (1 + k));
  return rgbHex(f(r), f(g), f(b));
}
export function mix(a, b, t) {
  const A = hexRGB(a), B = hexRGB(b);
  return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
export function hslToRgb(h, s, l) {
  h = ((h % 1) + 1) % 1;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = ((t % 1) + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
export function hsl(h, s, l) { const [r, g, b] = hslToRgb(h, s, l); return rgbHex(r, g, b); }

export class Pix {
  constructor(w, h) { const [c, x] = canvas(w, h); this.c = c; this.x = x; this.w = w; this.h = h; }
  px(x, y, col) { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.x.fillStyle = col; this.x.fillRect(x, y, 1, 1); }
  rect(x, y, w, h, col) { this.x.fillStyle = col; this.x.fillRect(x | 0, y | 0, w | 0, h | 0); }
  hline(x0, x1, y, col) { if (x1 < x0) [x0, x1] = [x1, x0]; this.rect(x0, y, x1 - x0 + 1, 1, col); }
  vline(x, y0, y1, col) { if (y1 < y0) [y0, y1] = [y1, y0]; this.rect(x, y0, 1, y1 - y0 + 1, col); }
  disc(cx, cy, r, col) {
    const r2 = r * r + r * 0.6;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r2) this.px(cx + x, cy + y, col);
  }
  ell(cx, cy, rx, ry, col) {
    const k = 1 + 0.6 / Math.max(rx, ry, 1);
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx || 1) + (y * y) / (ry * ry || 1) <= k) this.px(cx + x, cy + y, col);
  }
  line(x0, y0, x1, y1, col) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Shaded sphere-like blob: shadow, base, highlight.
  blob(cx, cy, r, base, opts = {}) {
    const sh = opts.sh ?? shade(base, -0.35), hl = opts.hl ?? shade(base, 0.28);
    this.disc(cx, cy, r, sh);
    this.disc(cx - 1, cy - 1, r, base);
    if (r >= 2) this.disc(cx - Math.max(1, r >> 1), cy - Math.max(1, r >> 1), Math.max(0, r - 2), hl);
    if (opts.spec && r >= 3) this.px(cx - r + 1, cy - r + 1, opts.spec);
  }
  draw(c, x, y) { this.x.drawImage(c, x | 0, y | 0); }
  alpha(a) { this.x.globalAlpha = a; return this; }
}

// Add a 1px outline around opaque pixels, in place. Returns the canvas.
export function outline(c, col = INK, diag = false) {
  const x = c.getContext('2d');
  const W = c.width, H = c.height;
  const d = x.getImageData(0, 0, W, H), a = d.data;
  const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 40 ? 1 : 0;
  const [r, g, b] = hexRGB(col);
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
    const i = y * W + X;
    if (src[i]) continue;
    let near = (X > 0 && src[i - 1]) || (X < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W]);
    if (!near && diag) near = (X > 0 && y > 0 && src[i - W - 1]) || (X < W - 1 && y > 0 && src[i - W + 1]) || (X > 0 && y < H - 1 && src[i + W - 1]) || (X < W - 1 && y < H - 1 && src[i + W + 1]);
    if (near) { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; }
  }
  x.putImageData(d, 0, 0);
  return c;
}

// Per-pixel transform; fn receives [r,g,b,a] and returns [r,g,b,a]. Returns a new canvas.
export function mapPixels(c, fn) {
  const [o, x] = canvas(c.width, c.height);
  x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] === 0) continue;
    const r = fn([a[i], a[i + 1], a[i + 2], a[i + 3]]);
    a[i] = r[0]; a[i + 1] = r[1]; a[i + 2] = r[2]; a[i + 3] = r[3];
  }
  x.putImageData(d, 0, 0);
  return o;
}

const flipCache = new WeakMap();
export function flipped(c) {
  let f = flipCache.get(c);
  if (f) return f;
  const [o, x] = canvas(c.width, c.height);
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  flipCache.set(c, o);
  return o;
}

// Keep outline pixels dark when tinting: ink stays ink.
export function isInk(r, g, b) { return r < 40 && g < 30 && b < 45; }
