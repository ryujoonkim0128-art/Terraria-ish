// Shared scene for every style mockup: the same free-form garden, two stalls, a farmer, and a drag-to-plant ghost.
export const W = 360, H = 740;

export const STALLS = [
  { kind: 'seeds', x: 96, y: 222, label: 'Seeds' },
  { kind: 'sell', x: 264, y: 222, label: 'Sell' },
];
export const PATCH = { cx: 180, cy: 452, rx: 160, ry: 168 };
// plants placed freely (x, y = ground contact point)
export const PLANTS = [
  { t: 'tree', x: 96, y: 372 },
  { t: 'corn', x: 270, y: 356 },
  { t: 'tulip', x: 48, y: 452 },
  { t: 'tulip', x: 66, y: 462 },
  { t: 'strawberry', x: 170, y: 426 },
  { t: 'tomato', x: 292, y: 456 },
  { t: 'carrot', x: 202, y: 508 },
  { t: 'carrot', x: 226, y: 520 },
  { t: 'carrot', x: 188, y: 528 },
  { t: 'pumpkin', x: 110, y: 512 },
  { t: 'blueberry', x: 294, y: 552 },
  { t: 'watermelon', x: 234, y: 590 },
].sort((a, b) => a.y - b.y);
export const FARMER = { x: 250, y: 470 };
export const GHOST = { x: 116, y: 594, crop: 'carrot' };
export const HOTBAR = ['carrot', 'strawberry', 'tomato', 'corn', 'apple'];
export const MONEY = '12,480';
export const SLOT = (i) => ({ x: 22 + i * 58, y: 664, w: 50, h: 50 });
export const HARVEST = { x: 316, y: 612, r: 27 };

export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// irregular organic bed outline
export function patchPoints(n = 90, wob = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + wob * (0.055 * Math.sin(3 * a + 0.5) + 0.035 * Math.sin(5 * a + 2) + 0.02 * Math.sin(9 * a));
    pts.push([PATCH.cx + Math.cos(a) * PATCH.rx * r, PATCH.cy + Math.sin(a) * PATCH.ry * r]);
  }
  return pts;
}
export function makeCanvas(host, scale = 2) {
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  host.appendChild(c);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  return { c, g };
}
export function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
export function smoothPoly(g, pts) {
  g.beginPath();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    if (i === 0) { const l = pts[n - 1]; g.moveTo((l[0] + p[0]) / 2, (l[1] + p[1]) / 2); }
    g.quadraticCurveTo(p[0], p[1], mx, my);
  }
  g.closePath();
}
export const fontsReady = (list) => Promise.all(list.map((f) => document.fonts.load(f))).catch(() => {});
