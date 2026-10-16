// Procedural plant and fruit sprites: growth stages per crop form, fruit sprites, and recolouring
// for Gold/Rainbow variants and environmental mutations.
import { Pix, outline, shade, mix, canvas, mapPixels, rgbToHsl, hslToRgb, isInk, hsl } from './pix.js';
import { CROP, MUTATIONS } from './content.js';
import { mulberry32, rnd, irnd } from './rng.js';

const plantCache = new Map();
const fruitCache = new Map();

function foliage(p, cx, cy, rx, ry, leaf, rng, n, rmin, rmax) {
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(rng, 0, Math.PI * 2), d = Math.sqrt(rng());
    blobs.push({ x: Math.round(cx + Math.cos(a) * d * rx), y: Math.round(cy + Math.sin(a) * d * ry), r: irnd(rng, rmin, rmax) });
  }
  blobs.push({ x: cx, y: cy, r: rmax });
  blobs.sort((a, b) => a.y - b.y);
  for (const b of blobs) p.blob(b.x, b.y, b.r, leaf);
  // leaf sparkle
  const light = shade(leaf, 0.45);
  for (let i = 0; i < n / 2; i++) { const b = blobs[irnd(rng, 0, blobs.length - 1)]; p.px(b.x - 1 + irnd(rng, -1, 1), b.y - b.r + irnd(rng, 0, 1), light); }
}
function sprout(p, cx, by, leaf) {
  const dark = shade(leaf, -0.3), light = shade(leaf, 0.3);
  p.vline(cx, by - 3, by - 1, dark);
  p.px(cx - 1, by - 3, leaf); p.px(cx - 2, by - 4, light); p.px(cx - 2, by - 3, leaf);
  p.px(cx + 1, by - 3, leaf); p.px(cx + 2, by - 4, light); p.px(cx + 2, by - 3, leaf);
}
function trunk(p, cx, by, h, w, bark) {
  const l = shade(bark, 0.2), d = shade(bark, -0.3);
  p.rect(cx - (w >> 1), by - h, w, h, bark);
  p.vline(cx - (w >> 1), by - h, by - 1, l);
  p.vline(cx + (w >> 1) - (w % 2 ? 0 : 1), by - h, by - 1, d);
  p.px(cx - (w >> 1) - 1, by - 1, d); p.px(cx + (w >> 1) + (w % 2 ? 1 : 0), by - 1, d);
}
function tuft(p, cx, by, n, h, leaf, rng) {
  const dark = shade(leaf, -0.3), light = shade(leaf, 0.35);
  for (let i = 0; i < n; i++) {
    const x0 = cx - (n >> 1) + i + (n > 4 ? Math.round((i - n / 2) * 0.5) : 0);
    const hh = h - Math.abs(i - (n - 1) / 2) * 1.2 + rnd(rng, -1, 1);
    const x1 = x0 + Math.round((i - (n - 1) / 2) * 0.8);
    p.line(x0, by - 1, x1, by - hh, i % 2 ? leaf : dark);
    p.px(x1, by - hh - 1, light);
    if (h > 6) { p.px(x1 - 1, by - hh + 2, light); p.px(x1 + 1, by - hh + 3, leaf); }
  }
}
function triangle(p, cx, yTop, h, wBottom, col) {
  for (let y = 0; y < h; y++) { const w = Math.round((wBottom / 2) * (y + 1) / h); p.hline(cx - w, cx + w, yTop + y, col); }
}

// Each form: (p, crop, stage, rng, cx, by) → anchors (canvas coords)
const FORMS = {
  root(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf;
    if (s === 0) sprout(p, cx, by, leaf);
    else if (s === 1) tuft(p, cx, by, 4, 6, leaf, rng);
    else if (s === 2) tuft(p, cx, by, 6, 9, leaf, rng);
    else tuft(p, cx, by, 7, 11, leaf, rng);
    return s === 3 ? [{ x: cx, y: by - 1 }] : [];
  },
  bush(p, c, s, rng, cx, by) {
    const sz = c.size || 1, leaf = c.pal.leaf;
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    if (c.stake && s >= 2) { const bark = '#8a5a2a'; p.vline(cx, by - Math.round(16 * sz), by - 1, bark); p.px(cx - 1, by - Math.round(16 * sz), shade(bark, 0.3)); }
    const rx = [0, 3, 5, 7][s] * sz, ry = [0, 2, 3, 4.5][s] * sz;
    const cy = by - Math.round(ry) - 1 - (c.stake ? s * 2 : 0);
    foliage(p, cx, cy, rx, ry, leaf, rng, [0, 4, 7, 11][s] + Math.round(sz * 2), s === 1 ? 1 : 2, s === 3 ? 3 : 2);
    const anchors = [];
    if (s === 3) for (let i = 0; i < c.fruits; i++) {
      const t = (i + 0.5) / c.fruits;
      anchors.push({ x: Math.round(cx - rx * 0.8 + t * rx * 1.6), y: Math.round(cy + (i % 2 ? ry * 0.55 : -ry * 0.1) + rnd(rng, -1, 1)) });
    }
    return anchors;
  },
  tree(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, bark = c.pal.bark || '#7a4f2a';
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const th = [0, 5, 9, 14][s], rx = [0, 3, 6, 11][s], ry = [0, 2, 5, 8][s];
    trunk(p, cx, by, th, s === 3 ? 4 : s === 2 ? 3 : 2, bark);
    if (s === 3) { p.line(cx - 1, by - th + 2, cx - 5, by - th - 3, bark); p.line(cx + 2, by - th + 3, cx + 6, by - th - 2, bark); }
    const cy = by - th - ry + 2;
    foliage(p, cx, cy, rx, ry, leaf, rng, [0, 4, 8, 16][s], 2, s === 3 ? 4 : 3);
    const anchors = [];
    if (s === 3) for (let i = 0; i < c.fruits; i++) {
      const a = (i / c.fruits) * Math.PI * 2 + 0.6, d = 0.45 + (i % 2) * 0.3;
      anchors.push({ x: Math.round(cx + Math.cos(a) * d * rx), y: Math.round(cy + Math.sin(a) * d * ry + 1) });
    }
    return anchors;
  },
  conifer(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, bark = c.pal.bark, dark = shade(leaf, -0.35), light = shade(leaf, 0.25);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const th = [0, 4, 7, 10][s], layers = s + 1, H = [0, 8, 16, 30][s], W = [0, 8, 14, 24][s];
    trunk(p, cx, by, th, s === 3 ? 4 : 2, bark);
    const top = by - th - H + 4;
    for (let k = 0; k < layers; k++) {
      const yk = top + Math.round((H / layers) * k * 0.95), hk = Math.round(H / layers) + 4, wk = Math.round(W * (k + 1) / layers);
      triangle(p, cx + 1, yk + 1, hk, wk, dark);
      triangle(p, cx, yk, hk, wk, leaf);
      triangle(p, cx - 1, yk, hk - 2, Math.round(wk * 0.5), light);
    }
    for (let i = 0; i < s * 4; i++) p.px(cx + irnd(rng, -W / 2 + 2, W / 2 - 2), top + irnd(rng, 2, H), rng() > 0.5 ? light : dark);
    return s === 3 ? [{ x: cx - 6, y: by - th - 6 }, { x: cx + 6, y: by - th - 12 }].slice(0, c.fruits) : [];
  },
  palm(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, bark = c.pal.bark, dark = shade(leaf, -0.3), light = shade(leaf, 0.3);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const h = [0, 6, 14, 24][s];
    let tx = cx;
    for (let y = 0; y < h; y++) {
      tx = cx + Math.round(Math.sin(y / h * 1.3) * 3);
      const col = y % 4 === 0 ? shade(bark, -0.3) : bark;
      p.rect(tx - 1, by - 1 - y, 3, 1, col); p.px(tx - 1, by - 1 - y, shade(col, 0.2));
    }
    const topy = by - h, n = s === 1 ? 3 : s === 2 ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i + 0.5) / n * Math.PI, len = s * 4 + 2;
      const ex = tx + Math.round(Math.cos(a) * len), ey = topy + Math.round(Math.sin(a) * len * 0.6) + Math.round(len * 0.35);
      p.line(tx, topy, ex, ey, dark);
      const steps = len;
      for (let k = 2; k < steps; k += 2) {
        const fx = tx + Math.round(Math.cos(a) * k), fy = topy + Math.round(Math.sin(a) * k * 0.6) + Math.round(k * 0.35);
        p.px(fx, fy + 1, leaf); p.px(fx, fy + 2, k % 4 ? leaf : light); p.px(fx + (Math.cos(a) > 0 ? 1 : -1), fy + 2, dark);
      }
    }
    p.disc(tx, topy, 1, dark);
    return s === 3 ? [{ x: tx - 3, y: topy + 3 }, { x: tx + 3, y: topy + 3 }, { x: tx, y: topy + 5 }].slice(0, c.fruits) : [];
  },
  stalk(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.3), light = shade(leaf, 0.3);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const h = [0, 7, 15, 27][s];
    p.vline(cx, by - h, by - 1, dark); p.vline(cx + 1, by - h + 2, by - 1, leaf);
    const n = [0, 2, 4, 6][s];
    for (let i = 0; i < n; i++) {
      const y = by - 3 - Math.round((i / n) * (h - 6)), dir = i % 2 ? -1 : 1, len = 5 + (s === 3 ? 3 : 0);
      p.line(cx, y, cx + dir * len, y - len + 1, leaf); p.line(cx + dir, y, cx + dir * (len - 1), y - len + 3, light);
      p.px(cx + dir * len, y - len, light);
    }
    if (s === 3) { for (let i = -2; i <= 2; i++) p.line(cx, by - h, cx + i * 2, by - h - 4, '#e8d98a'); }
    const anchors = [];
    if (s === 3) for (let i = 0; i < c.fruits; i++) anchors.push({ x: cx + (i % 2 ? -4 : 4), y: by - 9 - i * 6 });
    return anchors;
  },
  bamboo(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.35), light = shade(leaf, 0.3);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const poles = [[-5, 0.8], [0, 1], [4, 0.7]];
    const H = [0, 8, 20, 34][s];
    for (const [ox, k] of poles) {
      const h = Math.round(H * k);
      p.rect(cx + ox - 1, by - h, 3, h, leaf); p.vline(cx + ox - 1, by - h, by - 1, light); p.vline(cx + ox + 1, by - h, by - 1, dark);
      for (let y = by - 1; y > by - h; y -= 6) { p.hline(cx + ox - 1, cx + ox + 1, y, dark); if (y - 2 > by - h) { p.line(cx + ox + 2, y - 2, cx + ox + 5, y - 4, leaf); p.px(cx + ox + 5, y - 5, light); } }
      p.disc(cx + ox, by - h, 1, light);
    }
    return s === 3 ? [{ x: cx + 2, y: by - 2 }] : [];
  },
  beanstalk(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.35), light = shade(leaf, 0.35);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const H = [0, 10, 24, 44][s];
    for (let y = 0; y < H; y++) {
      const x = cx + Math.round(Math.sin(y * 0.3) * 3.5);
      p.px(x - 1, by - 1 - y, light); p.px(x, by - 1 - y, leaf); p.px(x + 1, by - 1 - y, dark);
      if (y % 7 === 3 && y > 2) {
        const dir = (y / 7) % 2 ? 1 : -1;
        p.ell(x + dir * 5, by - 1 - y, 4, 2, dark); p.ell(x + dir * 5, by - 2 - y, 4, 2, leaf); p.ell(x + dir * 4, by - 3 - y, 2, 1, light);
        p.line(x + dir * 5, by - 1 - y, x + dir * 8, by - 3 - y, dark);
      }
    }
    const tx = cx + Math.round(Math.sin(H * 0.3) * 3.5);
    p.line(tx, by - H, tx + 3, by - H - 3, dark); p.px(tx + 4, by - H - 4, light);
    const anchors = [];
    if (s === 3) for (let i = 0; i < c.fruits; i++) { const y = 12 + i * 11; anchors.push({ x: cx + Math.round(Math.sin(y * 0.3) * 3.5) + (i % 2 ? 6 : -6), y: by - y + 2 }); }
    return anchors;
  },
  flower(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.3), light = shade(leaf, 0.3);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const stems = c.fruits > 1 ? [-5, 0, 5] : [0];
    const anchors = [];
    for (const ox of stems) {
      const h = [0, 3, 8, 13][s] - Math.abs(ox) * 0.4;
      const tx = cx + ox;
      p.line(tx, by - 1, tx + Math.round(ox * 0.3), by - h, dark);
      const ex = tx + Math.round(ox * 0.3);
      // leaves along stem
      p.ell(tx - 2, by - 2, 2, 1, leaf); p.px(tx - 3, by - 3, light); p.ell(tx + 2, by - 2, 2, 1, dark); p.px(tx + 2, by - 3, leaf);
      if (s >= 2) { p.line(ex, by - h + 4, ex + 3, by - h + 2, leaf); p.px(ex + 3, by - h + 1, light); p.line(ex, by - h + 6, ex - 3, by - h + 4, leaf); }
      if (s === 2) { p.disc(ex, by - h - 1, 1, shade(c.pal.fruit, -0.3)); p.px(ex, by - h - 2, c.pal.fruit); }
      if (s === 3) anchors.push({ x: ex, y: by - h - 3 });
    }
    return anchors;
  },
  vine(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.35), light = shade(leaf, 0.3);
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const spread = [0, 4, 9, 12][s];
    for (let i = 0; i < 2 + s; i++) {
      const dir = i % 2 ? -1 : 1;
      const ex = cx + dir * irnd(rng, spread - 3, spread), ey = by - 2 - irnd(rng, 0, 3);
      p.line(cx, by - 2, ex, ey, dark);
      p.line(ex, ey, ex + dir * 2, ey - 2, dark); p.px(ex + dir * 3, ey - 3, dark); p.px(ex + dir * 3, ey - 2, dark);
      p.blob(ex - dir, ey - 1, s === 3 ? 3 : 2, leaf);
    }
    p.blob(cx - 2, by - 4, 2, leaf); p.blob(cx + 3, by - 3, s === 3 ? 3 : 2, leaf); p.px(cx + 2, by - 6, light);
    return s === 3 ? [{ x: cx, y: by - 4 }] : [];
  },
  cactus(p, c, s, rng, cx, by) {
    const g = c.pal.leaf, dark = shade(g, -0.35), light = shade(g, 0.3), spine = '#f3f1d6';
    if (s === 0) { p.rect(cx - 1, by - 3, 3, 3, g); p.px(cx - 1, by - 3, light); p.px(cx + 1, by - 1, dark); return []; }
    const h = [0, 6, 12, 18][s], w = [0, 4, 5, 6][s];
    const col = (x, y, hh, ww) => {
      p.rect(x - (ww >> 1), y - hh, ww, hh, g); p.disc(x, y - hh, ww >> 1, g);
      p.vline(x - (ww >> 1), y - hh + 1, y - 1, light); p.vline(x + (ww >> 1) - (ww % 2 ? 0 : 1), y - hh + 1, y - 1, dark); p.vline(x, y - hh + 2, y - 1, dark);
      for (let yy = y - hh + 2; yy < y; yy += 3) { p.px(x - 1, yy, spine); p.px(x + 1, yy + 1, spine); }
    };
    col(cx, by, h, w);
    const anchors = [{ x: cx, y: by - h - 2 }];
    if (s >= 2) { p.rect(cx - 6, by - 10, 4, 2, g); col(cx - 6, by - 9, 5, 3); anchors.push({ x: cx - 6, y: by - 15 }); }
    if (s >= 3) { p.rect(cx + 3, by - 8, 4, 2, g); col(cx + 6, by - 7, 7, 3); anchors.push({ x: cx + 6, y: by - 15 }); }
    return s === 3 ? anchors.slice(0, c.fruits) : [];
  },
  dragon(p, c, s, rng, cx, by) {
    const g = c.pal.leaf, dark = shade(g, -0.35), light = shade(g, 0.3);
    if (s === 0) { p.rect(cx - 1, by - 3, 3, 3, g); p.px(cx - 1, by - 3, light); return []; }
    const h = [0, 5, 10, 14][s];
    p.rect(cx - 2, by - h, 4, h, g); p.vline(cx - 2, by - h, by - 1, light); p.vline(cx + 1, by - h, by - 1, dark);
    const anchors = [];
    const segs = s === 1 ? 1 : s === 2 ? 2 : 3;
    for (let i = 0; i < segs; i++) {
      const dir = i === 0 ? -1 : i === 1 ? 1 : 0, len = 6 + s;
      const sx = cx + dir, sy = by - h;
      const ex = sx + dir * len, ey = sy + Math.round(len * 0.6) - (dir === 0 ? 7 : 0);
      for (let k = 0; k <= len; k++) {
        const t = k / len, x = Math.round(sx + (ex - sx) * t), y = Math.round(sy + (ey - sy) * (dir === 0 ? t : t * t));
        p.px(x, y, g); p.px(x - 1, y, light); p.px(x + 1, y, dark); p.px(x, y - 1, g);
      }
      anchors.push({ x: ex, y: ey + 3 });
    }
    return s === 3 ? anchors.slice(0, c.fruits) : [];
  },
  mushroom(p, c, s, rng, cx, by) {
    const stem = c.pal.leaf, dark = shade(stem, -0.3), cap = c.pal.fruit;
    if (s === 0) { p.disc(cx, by - 1, 1, stem); p.px(cx, by - 2, cap); return []; }
    const h = [0, 3, 6, 9][s], w = [0, 2, 3, 5][s];
    p.rect(cx - (w >> 1), by - h, w, h, stem); p.vline(cx + (w >> 1), by - h, by - 1, dark);
    if (s < 3) { const rx = s === 1 ? 2 : 4; p.ell(cx, by - h, rx, s, cap); p.ell(cx - 1, by - h - 1, rx - 1, Math.max(1, s - 1), shade(cap, 0.25)); }
    if (s >= 2) { p.disc(cx - 5, by - 1, 1, stem); p.disc(cx - 5, by - 3, 2, shade(cap, -0.1)); p.disc(cx + 6, by - 1, 1, stem); p.ell(cx + 6, by - 2, 2, 1, cap); }
    return s === 3 ? [{ x: cx, y: by - h - 2 }] : [];
  },
  trellis(p, c, s, rng, cx, by) {
    const leaf = c.pal.leaf, dark = shade(leaf, -0.35), bark = '#8a5a2a';
    if (s === 0) { sprout(p, cx, by, leaf); return []; }
    const h = [0, 8, 14, 18][s];
    p.vline(cx - 7, by - h, by - 1, bark); p.vline(cx + 7, by - h, by - 1, bark); p.px(cx - 7, by - h, shade(bark, 0.3)); p.px(cx + 7, by - h, shade(bark, 0.3));
    if (s >= 2) { p.hline(cx - 8, cx + 8, by - h + 1, shade(bark, 0.15)); p.hline(cx - 8, cx + 8, by - Math.round(h / 2), shade(bark, -0.15)); }
    for (let x = -8; x <= 8; x++) { const y = by - h + 2 + Math.round(Math.sin(x * 0.7) * 1.5); if (s >= 2) p.px(cx + x, y, dark); if (s >= 2 && x % 3 === 0) p.px(cx + x, y + 1, dark); }
    for (let i = 0; i < 3 + s * 2; i++) p.blob(cx + irnd(rng, -8, 8), by - h + irnd(rng, 1, s === 3 ? 8 : 4), 2, leaf);
    const anchors = [];
    if (s === 3) for (let i = 0; i < c.fruits; i++) anchors.push({ x: cx - 7 + Math.round(i * 14 / (c.fruits - 1)), y: by - h + 8 + (i % 2 ? 2 : 0) });
    return anchors;
  },
};
const SIZES = { root: [20, 18], bush: [28, 24], tree: [32, 42], conifer: [30, 48], palm: [34, 40], stalk: [24, 38], bamboo: [24, 42], beanstalk: [30, 56], flower: [22, 26], vine: [32, 20], cactus: [24, 32], dragon: [30, 30], mushroom: [26, 22], trellis: [30, 28] };

// Plant sprite for crop/stage → {c, ox, oy, anchors}: draw at (tileCenterX + ox, tileBottomY + oy); anchors are canvas coords.
export function plantSprite(cropId, stage) {
  const key = cropId + ':' + stage;
  let r = plantCache.get(key);
  if (r) return r;
  const c = CROP[cropId];
  let [w, h] = SIZES[c.form];
  if (c.size) { w = Math.round(w * c.size); h = Math.round(h * c.size); }
  const p = new Pix(w, h);
  const rng = mulberry32(cropId.length * 977 + stage * 31 + 7);
  const cx = w >> 1, by = h - 2;
  const anchors = FORMS[c.form](p, c, stage, rng, cx, by);
  outline(p.c);
  r = { c: p.c, ox: -cx, oy: -by, anchors, w, h };
  plantCache.set(key, r);
  return r;
}

// ----------------------------------------------------------------- fruit base sprites
function shadeDisc(p, cx, cy, r, col) { p.blob(cx, cy, r, col, { spec: '#ffffff' }); }
const FRUIT = {
  carrot(p, c) { p.ell(4, 3, 3, 1, c.pal.fruit); p.ell(4, 3, 3, 1, c.pal.fruit); p.hline(2, 6, 4, c.pal.fruit2); p.px(2, 2, shade(c.pal.fruit, 0.3)); p.px(3, 2, shade(c.pal.fruit, 0.3)); return [9, 6]; },
  strawberry(p, c) {
    const f = c.pal.fruit, d = shade(f, -0.3), l = shade(f, 0.25);
    p.hline(2, 5, 2, f); p.hline(1, 6, 3, f); p.hline(1, 6, 4, f); p.hline(1, 6, 5, f); p.hline(2, 5, 6, d); p.hline(3, 4, 7, d);
    p.vline(6, 3, 5, d); p.px(5, 6, d); p.px(2, 3, l); p.px(2, 4, l);
    p.px(3, 4, c.pal.fruit2); p.px(5, 3, c.pal.fruit2); p.px(4, 6, c.pal.fruit2);
    p.px(2, 1, '#4caf50'); p.px(3, 1, '#6fd36a'); p.px(4, 1, '#4caf50'); p.px(5, 1, '#3a8a3a'); p.px(3, 0, '#3a8a3a');
    return [9, 9];
  },
  blueberry(p, c) { const f = c.pal.fruit; p.blob(3, 5, 2, f); p.blob(7, 5, 2, f); p.blob(5, 3, 2, f, { spec: '#ffffff' }); p.px(5, 1, '#3a8a3a'); p.px(5, 2, '#2a6a2a'); return [11, 9]; },
  tomato(p, c) { const f = c.pal.fruit; shadeDisc(p, 4, 5, 3, f); p.px(4, 1, '#3a8a3a'); p.px(3, 2, '#4caf50'); p.px(5, 2, '#4caf50'); p.px(4, 2, '#2a6a2a'); return [9, 9]; },
  corn(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.3);
    p.rect(2, 1, 4, 8, f);
    for (let y = 1; y < 9; y++) for (let x = 2; x < 6; x++) if ((x + y) % 2) p.px(x, y, (x < 4) ? l : d);
    p.rect(1, 6, 1, 4, '#5cb85c'); p.rect(6, 6, 1, 4, '#3f8f3f'); p.px(2, 9, '#5cb85c'); p.px(5, 9, '#3f8f3f'); p.px(4, 0, '#e8d98a');
    return [8, 11];
  },
  apple(p, c) { shadeDisc(p, 4, 5, 3, c.pal.fruit); p.px(4, 1, '#6b4a2a'); p.px(5, 1, '#4caf50'); p.px(6, 1, '#4caf50'); p.px(3, 3, '#ffffff'); return [9, 9]; },
  watermelon(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.35);
    p.ell(7, 5, 6, 4, d); p.ell(6, 4, 6, 4, f);
    for (let x = 1; x <= 12; x++) { if (x % 3 === 0) for (let y = 0; y <= 9; y++) { const inside = ((x - 6) ** 2) / 36 + ((y - 4) ** 2) / 16 <= 1.1; if (inside && y > 0) p.px(x, y, l); } }
    p.px(3, 2, '#d8f0b0'); p.px(4, 1, '#d8f0b0'); p.px(7, 0, '#6b4a2a');
    return [15, 11];
  },
  pumpkin(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.35);
    p.ell(7, 6, 6, 4, d); p.ell(6, 5, 6, 4, f);
    for (const x of [3, 6, 9]) for (let y = 2; y <= 9; y++) { const inside = ((x - 6) ** 2) / 36 + ((y - 5) ** 2) / 16 <= 1.05; if (inside) p.px(x, y, d); }
    for (const x of [4, 7, 10]) for (let y = 2; y <= 5; y++) { const inside = ((x - 6) ** 2) / 36 + ((y - 5) ** 2) / 16 <= 0.8; if (inside) p.px(x, y, l); }
    p.rect(6, 0, 2, 2, '#5a8a3a'); p.px(6, 0, '#7cb35a');
    return [15, 11];
  },
  coconut(p, c) { shadeDisc(p, 4, 4, 3, c.pal.fruit); p.px(3, 3, shade(c.pal.fruit, -0.5)); p.px(5, 3, shade(c.pal.fruit, -0.5)); p.px(4, 5, shade(c.pal.fruit, -0.5)); return [9, 9]; },
  bamboo(p, c) { const f = c.pal.fruit, d = shade(f, -0.3); p.rect(2, 2, 3, 6, f); p.px(2, 2, c.pal.fruit2); p.hline(2, 4, 4, d); p.hline(2, 4, 7, d); p.px(3, 1, c.pal.fruit2); p.px(3, 0, c.pal.fruit2); p.line(5, 3, 7, 1, '#5cb85c'); return [9, 9]; },
  cactus(p, c) { p.blob(4, 5, 3, c.pal.fruit, { spec: '#ffffff' }); p.px(2, 2, '#f3f1d6'); p.px(6, 3, '#f3f1d6'); p.px(3, 7, '#f3f1d6'); return [9, 10]; },
  dragonfruit(p, c) {
    const f = c.pal.fruit, g = c.pal.fruit2;
    p.ell(5, 6, 4, 5, shade(f, -0.3)); p.ell(4, 5, 4, 5, f); p.ell(3, 4, 2, 2, shade(f, 0.25));
    p.px(1, 3, g); p.px(1, 2, shade(g, -0.2)); p.px(8, 4, g); p.px(9, 3, shade(g, -0.2)); p.px(2, 9, g); p.px(7, 9, g); p.px(4, 0, g); p.px(5, 0, g); p.px(6, 1, g);
    return [11, 12];
  },
  mango(p, c) {
    const f = c.pal.fruit, b = c.pal.fruit2;
    p.ell(5, 6, 4, 5, shade(f, -0.3)); p.ell(4, 5, 4, 5, f); p.ell(6, 3, 2, 2, b); p.px(7, 4, b); p.px(2, 3, shade(f, 0.35)); p.px(3, 2, shade(f, 0.35)); p.px(4, 0, '#4caf50');
    return [11, 12];
  },
  grape(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2;
    const pts = [[2, 3], [4, 3], [6, 3], [3, 5], [5, 5], [7, 5], [4, 7], [6, 7], [5, 9]];
    for (const [x, y] of pts) { p.disc(x, y, 1, shade(f, -0.3)); p.px(x, y, f); p.px(x - 1, y - 1, l); }
    p.px(4, 1, '#6b4a2a'); p.px(4, 0, '#6b4a2a'); p.px(5, 0, '#4caf50'); p.px(6, 0, '#4caf50');
    return [10, 11];
  },
  mushroom(p, c) {
    const f = c.pal.fruit, s = c.pal.fruit2, d = shade(f, -0.3);
    for (let y = 0; y <= 5; y++) { const w = Math.round(Math.sqrt(1 - ((5 - y) / 5.5) ** 2) * 7); p.hline(8 - w, 8 + w, y, f); }
    p.hline(1, 15, 5, d); p.hline(2, 14, 6, shade(d, -0.2));
    p.hline(3, 5, 1, shade(f, 0.25)); p.px(2, 2, shade(f, 0.25));
    p.rect(4, 2, 2, 2, s); p.rect(9, 1, 2, 2, s); p.rect(12, 3, 2, 1, s); p.px(7, 4, s);
    return [17, 8];
  },
  pepper(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.3);
    p.hline(2, 5, 2, f); p.hline(1, 6, 3, f); p.hline(1, 6, 4, f); p.hline(1, 6, 5, f); p.hline(2, 6, 6, f); p.hline(2, 5, 7, f); p.hline(3, 5, 8, d); p.px(4, 9, d);
    p.vline(6, 3, 6, d); p.vline(2, 3, 5, l); p.px(3, 3, l);
    p.px(3, 1, '#3a8a3a'); p.px(4, 1, '#4caf50'); p.px(4, 0, '#3a8a3a');
    return [9, 11];
  },
  cacao(p, c) {
    const f = c.pal.fruit, d = shade(f, -0.35), l = c.pal.fruit2;
    p.ell(5, 6, 3, 5, d); p.ell(4, 5, 3, 5, f); for (let y = 1; y <= 9; y++) { if (y % 2) p.px(4, y, d); } p.vline(2, 3, 7, l); p.px(5, 0, '#6b4a2a');
    return [10, 12];
  },
  beanstalk(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.3);
    for (let x = 1; x <= 9; x++) { const y = 3 + Math.round(Math.sin((x - 5) * 0.4) * 1); p.vline(x, y - 1, y + 1, f); p.px(x, y + 1, d); if (x % 3 === 1) p.px(x, y - 1, l); }
    p.px(1, 2, d); p.px(9, 2, d);
    return [11, 7];
  },
  orangetulip(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.3);
    p.px(2, 0, f); p.px(5, 0, f); p.hline(1, 2, 1, f); p.hline(5, 6, 1, f); for (let y = 2; y <= 5; y++) p.hline(1, 6, y, f); p.hline(2, 5, 6, d); p.hline(3, 4, 7, d);
    p.vline(6, 2, 5, d); p.px(5, 6, d); p.vline(1, 2, 4, l); p.px(2, 1, l); p.px(3, 1, shade(f, -0.15)); p.px(4, 1, shade(f, -0.15));
    return [8, 8];
  },
  daffodil(p, c) {
    const f = c.pal.fruit, t = c.pal.fruit2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; p.disc(Math.round(4.5 + Math.cos(a) * 3), Math.round(4.5 + Math.sin(a) * 3), 1, i < 3 ? f : shade(f, -0.2)); }
    p.disc(4, 4, 2, t); p.disc(4, 4, 1, shade(t, -0.3)); p.px(3, 3, shade(t, 0.3));
    return [10, 10];
  },
  emberlily(p, c) {
    const f = c.pal.fruit, t = c.pal.fruit2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; const ex = Math.round(5 + Math.cos(a) * 5), ey = Math.round(5 + Math.sin(a) * 5); p.line(5, 5, ex, ey, f); p.line(5, 5, ex, ey - 1 + (i % 2), shade(f, -0.2)); p.px(ex, ey, t); }
    p.disc(5, 5, 1, shade(f, -0.4)); p.px(5, 5, t);
    return [11, 11];
  },
  burningbud(p, c) {
    const f = c.pal.fruit, t = c.pal.fruit2;
    p.ell(5, 8, 3, 4, shade(f, -0.3)); p.ell(4, 7, 3, 4, f); p.ell(3, 6, 1, 2, shade(f, 0.3));
    p.px(4, 2, t); p.px(4, 1, '#ffe080'); p.px(3, 3, t); p.px(6, 3, t); p.px(6, 2, '#ffe080'); p.px(2, 4, f); p.px(7, 4, t); p.px(5, 0, '#fff4b0');
    return [10, 13];
  },
  sugarapple(p, c) { const f = c.pal.fruit, d = shade(f, -0.3); shadeDisc(p, 4, 5, 3, f); for (let y = 2; y <= 8; y++) for (let x = 1; x <= 7; x++) if ((x + y) % 3 === 0 && (x - 4) ** 2 + (y - 5) ** 2 <= 9) p.px(x, y, d); p.px(4, 1, '#6b4a2a'); return [9, 10]; },
  giantpinecone(p, c) {
    const f = c.pal.fruit, l = c.pal.fruit2, d = shade(f, -0.35);
    for (let y = 0; y < 11; y++) { const w = Math.round(Math.min(y + 1, 11 - y * 0.4) * 0.45); p.hline(5 - w, 5 + w, y, f); }
    for (let y = 1; y < 11; y++) for (let x = 1; x < 10; x++) { if (((x + (y % 4 >= 2 ? 1 : 0)) % 2 === 0) && y % 2 === 1) { const px = p.x.getImageData(x, y, 1, 1).data; if (px[3]) p.px(x, y, (x < 5) ? l : d); } }
    p.px(5, 11, d); p.px(5, 0, '#4caf50');
    return [11, 13];
  },
  elderstrawberry(p, c) {
    const f = c.pal.fruit, d = shade(f, -0.3), l = shade(f, 0.25), s = c.pal.fruit2;
    p.hline(3, 7, 2, f); p.hline(2, 8, 3, f); for (let y = 4; y <= 7; y++) p.hline(1, 9, y, f); p.hline(2, 8, 8, d); p.hline(3, 7, 9, d); p.hline(4, 6, 10, d);
    p.vline(9, 4, 7, d); p.vline(8, 8, 8, d); p.vline(1, 4, 6, l); p.px(2, 3, l);
    for (const [x, y] of [[3, 4], [6, 4], [4, 6], [7, 6], [5, 8], [2, 6]]) p.px(x, y, s);
    p.hline(3, 7, 1, '#4caf50'); p.px(4, 0, '#3a8a3a'); p.px(6, 0, '#3a8a3a'); p.px(5, 1, '#2a6a2a');
    return [11, 12];
  },
};

function fruitBase(cropId) {
  const c = CROP[cropId];
  const p = new Pix(24, 24);
  const [w, h] = FRUIT[cropId](p, c);
  // crop to [w,h] with 1px padding for outline
  const o = new Pix(w + 2, h + 2);
  o.x.drawImage(p.c, 0, 0, w, h, 1, 1, w, h);
  outline(o.c);
  return o.c;
}

// Deterministic decoration positions on a sprite's opaque pixels.
function opaqueSpots(c, n, seed) {
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  const pts = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && !isInk(d[i], d[i + 1], d[i + 2])) pts.push([(i / 4) % c.width, Math.floor(i / 4 / c.width)]);
  const rng = mulberry32(seed);
  const out = [];
  for (let i = 0; i < n && pts.length; i++) out.push(pts[Math.floor(rng() * pts.length)]);
  return out;
}

const TINT = { Wet: 0.22, Chilled: 0.45, Frozen: 0.55, Moonlit: 0.45, Choc: 0.7, Pollinated: 0.25, Bloodlit: 0.5, Burnt: 0.65, HoneyGlazed: 0.4, Twisted: 0.55, Shocked: 0.45, Celestial: 0.5 };

// Styled fruit sprite. muts: array of mutation names. frame: animation frame for Rainbow/Disco.
export function fruitSprite(cropId, variant = 'Normal', muts = [], frame = 0) {
  const animated = variant === 'Rainbow' || muts.includes('Disco');
  const key = cropId + '|' + variant + '|' + muts.join(',') + '|' + (animated ? frame : 0);
  let c = fruitCache.get(key);
  if (c) return c;
  c = fruitBase(cropId);
  if (variant === 'Gold') {
    c = mapPixels(c, ([r, g, b, a]) => {
      if (isInk(r, g, b)) return [r, g, b, a];
      const L = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      const t = Math.min(1, L * 1.15);
      const col = t > 0.85 ? [255, 250, 220] : [Math.round(120 + 135 * t), Math.round(70 + 160 * t), Math.round(10 + 90 * t)];
      return [col[0], col[1], col[2], a];
    });
  } else if (variant === 'Rainbow') {
    c = mapPixels(c, ([r, g, b, a]) => {
      if (isInk(r, g, b)) return [r, g, b, a];
      const [, , l] = rgbToHsl(r, g, b);
      const [R, G, B] = hslToRgb(frame / 12 + l * 0.35, 0.95, 0.3 + l * 0.5);
      return [R, G, B, a];
    });
  }
  for (const m of muts) {
    const M = MUTATIONS[m]; if (!M) continue;
    let target = M.color;
    if (m === 'Disco') target = hsl(frame / 6, 1, 0.6);
    const t = TINT[m] ?? 0.5;
    const [tr, tg, tb] = [parseInt(target.slice(1, 3), 16), parseInt(target.slice(3, 5), 16), parseInt(target.slice(5, 7), 16)];
    c = mapPixels(c, ([r, g, b, a]) => isInk(r, g, b) ? [r, g, b, a] : [r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t, a]);
  }
  // decorations
  const x = c.getContext('2d');
  const seed = cropId.length * 131 + muts.length * 17;
  if (muts.includes('Wet')) for (const [px, py] of opaqueSpots(c, 3, seed + 1)) { x.fillStyle = '#9fd4ff'; x.fillRect(px, py, 1, 1); x.fillStyle = '#ffffff'; x.fillRect(px, py - 1, 1, 1); }
  if (muts.includes('Pollinated')) for (const [px, py] of opaqueSpots(c, 5, seed + 2)) { x.fillStyle = '#fff176'; x.fillRect(px, py, 1, 1); }
  if (muts.includes('HoneyGlazed')) for (const [px, py] of opaqueSpots(c, 3, seed + 3)) { x.fillStyle = '#ffb000'; x.fillRect(px, py, 1, 2); x.fillStyle = '#ffe080'; x.fillRect(px, py, 1, 1); }
  if (muts.includes('Twisted')) for (const [px, py] of opaqueSpots(c, 4, seed + 4)) { x.fillStyle = '#e8e8f0'; x.fillRect(px, py, 2, 1); }
  if (muts.includes('Burnt')) for (const [px, py] of opaqueSpots(c, 4, seed + 5)) { x.fillStyle = '#2a1a12'; x.fillRect(px, py, 1, 1); x.fillStyle = '#ff6a2a'; x.fillRect(px + 1, py, 1, 1); }
  if (muts.includes('Chilled')) for (const [px, py] of opaqueSpots(c, 3, seed + 6)) { x.fillStyle = '#ffffff'; x.fillRect(px, py, 1, 1); }
  if (muts.includes('Frozen')) {
    const [o, ox] = canvas(c.width + 2, c.height + 2);
    ox.fillStyle = 'rgba(170,225,255,0.35)'; ox.fillRect(1, 1, c.width, c.height);
    ox.drawImage(c, 1, 1);
    ox.fillStyle = 'rgba(200,240,255,0.28)'; ox.fillRect(1, 1, c.width, c.height);
    ox.fillStyle = '#eaf8ff'; ox.fillRect(0, 0, c.width + 2, 1); ox.fillRect(0, 0, 1, c.height + 2);
    ox.fillStyle = '#7fb8e0'; ox.fillRect(0, c.height + 1, c.width + 2, 1); ox.fillRect(c.width + 1, 0, 1, c.height + 2);
    ox.fillStyle = '#ffffff'; ox.fillRect(2, 2, 2, 1); ox.fillRect(2, 2, 1, 2);
    c = o;
  }
  fruitCache.set(key, c);
  return c;
}

// Seed packet icon (14x16).
const iconCache = new Map();
export function seedIcon(cropId, rarityColor) {
  const key = 'seed:' + cropId;
  let c = iconCache.get(key);
  if (c) return c;
  const p = new Pix(16, 18);
  p.rect(2, 2, 12, 14, '#f3e7c9'); p.rect(2, 2, 12, 3, rarityColor); p.rect(2, 5, 12, 1, shade(rarityColor, -0.3));
  p.vline(13, 5, 15, '#d8c9a3'); p.hline(2, 13, 15, '#d8c9a3'); p.px(3, 6, '#fffaf0'); p.px(3, 7, '#fffaf0');
  for (let x = 2; x < 14; x += 2) p.px(x, 2, shade(rarityColor, 0.3));
  const f = fruitBase(cropId);
  const s = Math.max(f.width, f.height) > 10 ? 0.5 : 1;
  p.x.drawImage(f, 0, 0, f.width, f.height, Math.round(8 - f.width * s / 2), Math.round(10.5 - f.height * s / 2), Math.round(f.width * s), Math.round(f.height * s));
  outline(p.c);
  iconCache.set(key, p.c);
  return p.c;
}
