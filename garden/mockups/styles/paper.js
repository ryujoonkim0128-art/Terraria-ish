// Style: layered paper cut-out. Hand-cut edges, real drop shadows between layers, paper grain, washi tape labels.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, patchPoints, makeCanvas, seeded, fontsReady } from './common.js';

const F = '"Gaegu", "Comic Sans MS", system-ui, sans-serif';
let R = seeded(5);
const C = {
  sky: '#a8d8d0', sun: '#f2b632', cloud: '#f7f3ec', hill1: '#9cc99a', hill2: '#79b07c', hill3: '#5e9668', grass: '#8ec47e',
  path: '#dcb98c', soil: '#9a6845', soil2: '#82543a', leaf: '#5aa05a', leaf2: '#7cbf6a', leaf3: '#468a4c',
  red: '#e8574a', orange: '#f08a3a', blue: '#4b5fb0', yellow: '#f2c442', wood: '#b88a5e', wood2: '#94683f', white: '#f7f3ec', ink: '#4a3a30',
};
// hand-cut outline: sample a shape and nudge every vertex a little
const cutPts = (pts, j = 0.8) => pts.map(([x, y]) => [x + (R() - 0.5) * j, y + (R() - 0.5) * j]);
const ellPts = (cx, cy, rx, ry, n = 0, rot = 0) => { n = n || Math.max(12, Math.round((rx + ry) * 0.9)); const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return o; };
const leafPts = (x, y, len, ang, w = 0.35) => { const o = []; const n = 14; for (let i = 0; i <= n; i++) { const t = i / n; o.push([t * len, Math.sin(t * Math.PI) * len * w]); } for (let i = n - 1; i > 0; i--) { const t = i / n; o.push([t * len, -Math.sin(t * Math.PI) * len * w]); } return o.map(([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]); };
const rectPts = (x, y, w, h) => { const o = []; const step = 6; for (let i = 0; i <= w; i += step) o.push([x + i, y]); for (let i = 0; i <= h; i += step) o.push([x + w, y + i]); for (let i = w; i >= 0; i -= step) o.push([x + i, y + h]); for (let i = h; i >= 0; i -= step) o.push([x, y + i]); return o; };

let G = null, grain = null;
function piece(pts, fill, depth = 1, jit = 0.9) {
  const g = G;
  const p = cutPts(pts, jit);
  g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.save();
  g.shadowColor = `rgba(60,40,25,${0.22 + depth * 0.08})`; g.shadowBlur = 3 + depth * 2.5; g.shadowOffsetX = depth * 0.8; g.shadowOffsetY = 1 + depth * 1.6;
  g.fillStyle = fill; g.fill();
  g.restore();
  g.save(); g.clip(); g.globalAlpha = 0.5; g.globalCompositeOperation = 'multiply'; g.fillStyle = grain; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 0.5; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.2; g.stroke(); g.restore();
}
function pencil(pts, a = 0.5, w = 1) { const g = G; g.save(); g.strokeStyle = `rgba(74,58,48,${a})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + (R() - 0.5) * 0.6, y + (R() - 0.5) * 0.6) : g.moveTo(x, y))); g.stroke(); g.restore(); }
const dot = (x, y, r, c, d = 0.4) => piece(ellPts(x, y, r, r), c, d, 0.3);

const PLANT = {
  tree(x, y) {
    piece([[x - 7, y], [x - 4, y - 50], [x + 4, y - 50], [x + 8, y]], C.wood2, 1);
    pencil([[x - 1, y - 6], [x, y - 40]], 0.35);
    for (const [dx, dy, r, c] of [[-20, -66, 22, C.leaf3], [20, -64, 22, C.leaf3], [0, -86, 26, C.leaf], [-12, -96, 16, C.leaf2], [16, -82, 17, C.leaf2]]) piece(ellPts(x + dx, y + dy, r, r * 0.92), c, 1.4);
    for (const [dx, dy] of [[-22, -60], [14, -72], [-4, -92], [26, -58], [-28, -80]]) { dot(x + dx, y + dy, 6, C.red, 1); dot(x + dx - 2, y + dy - 2, 1.6, C.white, 0.1); }
  },
  corn(x, y) {
    for (const [dx, h] of [[-8, 106], [9, 94]]) {
      piece([[x + dx - 2.5, y], [x + dx - 1.5, y - h], [x + dx + 1.5, y - h], [x + dx + 2.5, y]], '#7fae4a', 0.8);
      for (let k = 0; k < 4; k++) piece(leafPts(x + dx, y - 22 - k * 19, 30 - k * 3, k % 2 ? -0.55 : Math.PI + 0.55, 0.16), k % 2 ? C.leaf : C.leaf2, 0.9);
      piece(leafPts(x + dx, y - h, 10, -1.9, 0.2), '#d8a85a', 0.5); piece(leafPts(x + dx, y - h, 10, -1.2, 0.2), '#d8a85a', 0.5);
    }
    for (const [dx, cy, rot] of [[-17, -56, 0.25], [19, -44, -0.25]]) {
      piece(ellPts(x + dx, y + cy, 6.5, 14, 20, rot), C.yellow, 1.2);
      for (let k = -2; k <= 2; k++) pencil([[x + dx - 4, y + cy + k * 5], [x + dx + 4, y + cy + k * 5 - 1]], 0.3, 0.8);
      piece(leafPts(x + dx, y + cy + 14, 14, rot > 0 ? -1.9 : -1.2, 0.3), C.leaf2, 0.9);
    }
  },
  tulip(x, y) {
    piece([[x - 1.5, y], [x - 1, y - 34], [x + 1, y - 34], [x + 1.5, y]], C.leaf3, 0.6);
    piece(leafPts(x, y - 2, 20, -1.15, 0.3), C.leaf2, 0.8);
    piece([[x - 8, y - 46], [x - 4, y - 40], [x, y - 47], [x + 4, y - 40], [x + 8, y - 46], [x + 8, y - 36], [x + 4, y - 31], [x - 4, y - 31], [x - 8, y - 36]], C.orange, 1);
  },
  strawberry(x, y) {
    for (const [dx, dy, r, c] of [[-13, -14, 13, C.leaf3], [13, -14, 13, C.leaf3], [0, -24, 15, C.leaf], [0, -10, 12, C.leaf2]]) piece(ellPts(x + dx, y + dy, r, r * 0.85), c, 1.2);
    for (const [dx, dy] of [[-17, -6], [3, -2], [19, -8]]) {
      piece([[x + dx - 7, y + dy - 4], [x + dx, y + dy - 7], [x + dx + 7, y + dy - 4], [x + dx + 4, y + dy + 5], [x + dx, y + dy + 10], [x + dx - 4, y + dy + 5]], C.red, 1.1, 0.4);
      for (const [sx, sy] of [[-3, -1], [2, 0], [0, 4], [-2, 3], [3, -3]]) { G.fillStyle = '#ffe2a0'; G.fillRect(x + dx + sx, y + dy + sy, 1.3, 1.3); }
    }
    for (const [fx, fy] of [[-8, -30], [10, -27]]) { for (let k = 0; k < 5; k++) { const a = k * 1.256; dot(x + fx + Math.cos(a) * 2.6, y + fy + Math.sin(a) * 2.6, 2.2, C.white, 0.3); } dot(x + fx, y + fy, 1.8, C.yellow, 0.2); }
  },
  tomato(x, y) {
    piece(rectPts(x - 2.5, y - 62, 5, 62), C.wood, 0.8);
    for (let k = 0; k < 4; k++) piece(ellPts(x + (k % 2 ? 9 : -9), y - 12 - k * 13, 10, 9), k % 2 ? C.leaf : C.leaf3, 1.1);
    for (const [dx, dy] of [[-15, -18], [13, -32], [-12, -44]]) { dot(x + dx, y + dy, 7.5, C.red, 1.2); piece(ellPts(x + dx, y + dy - 6, 4, 2), C.leaf2, 0.4, 0.2); }
  },
  carrot(x, y) {
    for (const a of [-0.55, -0.15, 0.25, 0.6]) piece(leafPts(x, y - 4, 17, -Math.PI / 2 + a, 0.16), a > 0 ? C.leaf : C.leaf2, 0.7);
    piece(ellPts(x, y - 1, 7.5, 5), C.orange, 0.9);
    pencil([[x - 4, y], [x - 1, y + 0.5]], 0.4);
  },
  pumpkin(x, y) {
    piece(leafPts(x - 4, y - 6, 26, Math.PI + 0.3, 0.42), C.leaf3, 0.8); piece(leafPts(x + 4, y - 6, 24, -0.2, 0.42), C.leaf, 0.8);
    for (const [dx, rx, c] of [[-13, 13, '#e07a2e'], [13, 13, '#e07a2e'], [0, 15, C.orange]]) piece(ellPts(x + dx, y - 15, rx, 16), c, 1.3);
    pencil([[x - 5, y - 28], [x - 6, y - 15], [x - 5, y - 3]], 0.35); pencil([[x + 5, y - 28], [x + 6, y - 15], [x + 5, y - 3]], 0.35);
    piece(rectPts(x - 2.5, y - 38, 5, 9), '#6a7a3a', 0.6);
  },
  blueberry(x, y) {
    for (const [dx, dy, r, c] of [[-13, -18, 14, '#3f7a5a'], [13, -18, 14, '#3f7a5a'], [0, -32, 15, '#548f6a'], [0, -14, 14, '#4a8562']]) piece(ellPts(x + dx, y + dy, r, r * 0.9), c, 1.2);
    for (const [dx, dy] of [[-15, -14], [-9, -9], [10, -24], [16, -18], [3, -8], [-3, -30], [8, -36]]) dot(x + dx, y + dy, 4.5, C.blue, 0.9);
  },
  watermelon(x, y) {
    piece(leafPts(x - 10, y - 4, 22, Math.PI + 0.2, 0.45), C.leaf3, 0.8); piece(leafPts(x + 10, y - 4, 22, -0.1, 0.45), C.leaf, 0.8);
    piece(ellPts(x, y - 12, 25, 16), '#7cbf6a', 1.4);
    for (const dx of [-15, -5, 5, 15]) piece([[x + dx - 2, y - 26], [x + dx + 2, y - 26], [x + dx + 4, y - 12], [x + dx + 2, y + 2], [x + dx - 2, y + 2], [x + dx, y - 12]], '#3f7a4a', 0.2, 0.3);
  },
};

function tag(x, y, w, h, text, size = 20, rot = 0, fill = C.white) {
  const g = G;
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot); g.translate(-(x + w / 2), -(y + h / 2));
  piece(rectPts(x, y, w, h), fill, 1.2, 0.8);
  g.fillStyle = 'rgba(230,200,140,0.75)'; g.fillRect(x + w / 2 - 14, y - 6, 28, 11);
  g.font = `700 ${size}px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.ink; g.fillText(text, x + w / 2, y + h / 2 + 1);
  g.restore();
}
function stall(s) {
  const { x, y } = s, col = s.kind === 'seeds' ? '#5aa05a' : '#e8a23a';
  piece(rectPts(x - 52, y - 66, 104, 56), C.wood2, 1);
  // keeper
  piece(ellPts(x, y - 50, 13, 13), s.kind === 'seeds' ? '#f2c8a0' : '#d9a37a', 1.1);
  dot(x - 4.5, y - 50, 1.6, C.ink, 0.1); dot(x + 4.5, y - 50, 1.6, C.ink, 0.1);
  pencil([[x - 3, y - 45], [x, y - 43.5], [x + 3, y - 45]], 0.6, 1.2);
  if (s.kind === 'seeds') piece([[x - 14, y - 58], [x - 10, y - 68], [x + 10, y - 68], [x + 14, y - 58], [x + 20, y - 57]], '#4a8a4a', 1); else piece(ellPts(x, y - 61, 13, 6), '#6a4430', 1);
  piece(rectPts(x - 56, y - 30, 112, 32), C.wood, 1.5);
  for (let i = 0; i < 4; i++) pencil([[x - 56 + i * 28 + 14, y - 28], [x - 56 + i * 28 + 14, y]], 0.25);
  if (s.kind === 'seeds') for (let i = 0; i < 4; i++) { piece(rectPts(x - 40 + i * 22, y - 44, 14, 18), C.white, 1); dot(x - 33 + i * 22, y - 34, 4, [C.orange, C.red, C.leaf, C.yellow][i], 0.5); }
  else { dot(x - 34, y - 38, 7, C.yellow, 1); dot(x - 26, y - 40, 7, C.yellow, 1.2); piece(rectPts(x + 18, y - 46, 26, 16), C.red, 1); }
  // bunting string with triangle flags
  pencil([[x - 60, y - 92], [x - 30, y - 84], [x, y - 82], [x + 30, y - 84], [x + 60, y - 92]], 0.6, 1.2);
  for (let i = 0; i < 7; i++) { const fx = x - 54 + i * 18, fy = y - 89 + Math.sin((i / 6) * Math.PI) * 7; piece([[fx - 7, fy], [fx + 7, fy], [fx, fy + 13]], i % 2 ? C.white : col, 0.9, 0.4); }
  for (const dx of [-58, 54]) piece(rectPts(x + dx, y - 100, 4, 100), C.wood2, 1.1);
  tag(x - 34, y - 130, 68, 28, s.label, 24, s.kind === 'seeds' ? -0.04 : 0.05);
}
function farmer(x, y) {
  piece(ellPts(x, y + 1, 14, 4), 'rgba(60,40,25,0.25)', 0, 0.1);
  piece([[x - 11, y - 30], [x + 11, y - 30], [x + 13, y - 2], [x - 13, y - 2]], '#5a7ab8', 1.2);
  piece(rectPts(x - 7, y - 26, 14, 6), '#e8574a', 0.4);
  piece(ellPts(x, y - 44, 14, 14), '#f2c8a0', 1.3);
  dot(x - 5, y - 44, 1.7, C.ink, 0.1); dot(x + 5, y - 44, 1.7, C.ink, 0.1);
  dot(x - 9, y - 39, 2.6, '#f2a090', 0.1); dot(x + 9, y - 39, 2.6, '#f2a090', 0.1);
  piece(ellPts(x, y - 55, 24, 7), C.yellow, 1.4);
  piece([[x - 12, y - 56], [x - 10, y - 68], [x + 10, y - 68], [x + 12, y - 56]], '#e8b232', 1.4);
  piece(rectPts(x - 12, y - 60, 24, 4), C.red, 0.4);
}
function icon(t, x, y) {
  if (t === 'carrot') { piece(leafPts(x, y - 8, 11, -1.9, 0.2), C.leaf, 0.5); piece(leafPts(x, y - 8, 11, -1.25, 0.2), C.leaf2, 0.5); piece([[x - 7, y - 8], [x + 7, y - 8], [x + 1, y + 13], [x - 1, y + 13]], C.orange, 0.9); }
  if (t === 'strawberry') { piece([[x - 10, y - 6], [x, y - 11], [x + 10, y - 6], [x + 6, y + 6], [x, y + 13], [x - 6, y + 6]], C.red, 1, 0.4); piece(ellPts(x, y - 9, 7, 3), C.leaf, 0.5); }
  if (t === 'tomato') { dot(x, y + 1, 11, C.red, 1); piece(ellPts(x, y - 9, 5, 2.5), C.leaf, 0.4); }
  if (t === 'corn') { piece(ellPts(x, y, 6, 13), C.yellow, 1); piece(leafPts(x, y + 12, 12, -1.9, 0.3), C.leaf, 0.6); piece(leafPts(x, y + 12, 12, -1.2, 0.3), C.leaf2, 0.6); }
  if (t === 'apple') { dot(x, y + 1, 11, C.red, 1); piece(leafPts(x, y - 9, 9, -0.6, 0.35), C.leaf, 0.5); }
}

export async function render(host) {
  await fontsReady([`700 20px ${F}`]);
  R = seeded(5);
  const { g } = makeCanvas(host);
  G = g;
  // paper grain pattern
  const gc = document.createElement('canvas'); gc.width = gc.height = 180;
  const gg = gc.getContext('2d'); gg.fillStyle = '#fff'; gg.fillRect(0, 0, 180, 180);
  for (let i = 0; i < 2600; i++) { const v = 200 + Math.floor(R() * 55); gg.fillStyle = `rgb(${v},${v - 6},${v - 14})`; gg.fillRect(R() * 180, R() * 180, 1, 1); }
  gg.strokeStyle = 'rgba(150,120,90,0.18)'; gg.lineWidth = 0.6;
  for (let i = 0; i < 60; i++) { const x = R() * 180, y = R() * 180, a = R() * 6.3; gg.beginPath(); gg.moveTo(x, y); gg.quadraticCurveTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5 + 2, x + Math.cos(a) * 10, y + Math.sin(a) * 10); gg.stroke(); }
  grain = g.createPattern(gc, 'repeat');

  g.fillStyle = C.sky; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.45; g.fillStyle = grain; g.fillRect(0, 0, W, H); g.restore();
  for (const [r, c] of [[42, '#f7d27a'], [32, '#f5c450'], [22, C.sun]]) piece(ellPts(292, 128, r, r), c, 0.8);
  for (const [cx, cy, k] of [[70, 108, 1], [196, 78, 0.8]]) piece([...ellPts(cx, cy, 34 * k, 14 * k, 30)].map(([x, y], i) => [x, y - Math.abs(Math.sin(i * 0.5)) * 7 * k]), C.cloud, 1);
  const hill = (pts, c, d) => piece(pts, c, d, 1.2);
  const wave = (base, amp, f, ph) => { const o = [[0, H]]; for (let x = 0; x <= W; x += 8) o.push([x, base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.3 + ph) * amp * 0.3]); o.push([W, H]); return o; };
  hill(wave(178, 22, 0.018, 1), C.hill1, 1);
  hill(wave(198, 16, 0.024, 3), C.hill2, 1.4);
  for (let x = 14; x < W; x += 38) { piece(rectPts(x - 2, 182, 4, 22), C.wood2, 1); piece(ellPts(x, 176, 14, 17), R() < 0.5 ? C.hill3 : C.leaf3, 1.3); }
  hill(wave(214, 6, 0.03, 2), C.grass, 1.6);
  piece([[-10, 206], [W + 10, 202], [W + 10, 246], [-10, 248]], C.path, 1.6, 1.6);
  for (let i = 0; i < 22; i++) dot(R() * W, 212 + R() * 30, 2 + R() * 3, '#c9a274', 0.3);
  // garden bed: two layers of kraft paper
  const pts = patchPoints(110);
  piece(pts.map(([x, y]) => [x, y + 3]), C.soil2, 2, 1.4);
  piece(pts.map(([x, y]) => [x + (x - 180) * -0.025, y + (y - 452) * -0.025]), C.soil, 1.2, 1.4);
  for (let i = 0; i < 40; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * 0.85; pencil([[180 + Math.cos(a) * 150 * d, 452 + Math.sin(a) * 158 * d], [183 + Math.cos(a) * 150 * d, 452 + Math.sin(a) * 158 * d]], 0.35, 1.4); }
  for (let i = 0; i < 40; i++) { const x = R() * W, y = 260 + R() * 390; if (Math.hypot((x - 180) / 170, (y - 452) / 178) < 1) continue; piece(leafPts(x, y, 9, -1.4 - R() * 0.4, 0.22), R() < 0.5 ? C.leaf2 : C.leaf, 0.5, 0.2); }
  for (let i = 0; i < 9; i++) { const x = R() * W, y = 270 + R() * 380; if (Math.hypot((x - 180) / 170, (y - 452) / 178) < 1) continue; for (let k = 0; k < 5; k++) { const a = k * 1.256; dot(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2.6, [C.white, '#f2a6b6', C.yellow][i % 3], 0.4); } dot(x, y, 1.8, C.orange, 0.2); }
  STALLS.forEach(stall);
  const list = [...PLANTS.map((p) => ({ y: p.y, d: () => PLANT[p.t](p.x, p.y) })), { y: FARMER.y, d: () => farmer(FARMER.x, FARMER.y) }].sort((a, b) => a.y - b.y);
  list.forEach((o) => o.d());
  // ghost: a dashed scissor-line circle
  g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.white; g.lineWidth = 2.4; g.beginPath(); g.ellipse(GHOST.x, GHOST.y, 20, 9, 0, 0, 7); g.stroke(); g.restore();
  g.globalAlpha = 0.55; PLANT.carrot(GHOST.x, GHOST.y); g.globalAlpha = 1;
  pencil([[SLOT(0).x + 25, SLOT(0).y - 6], [GHOST.x - 30, GHOST.y + 40], [GHOST.x - 6, GHOST.y + 12]], 0.7, 1.6);
  tag(GHOST.x - 40, GHOST.y - 62, 80, 24, 'plant here!', 18, -0.06);
  // HUD as paper scraps
  tag(14, 46, 124, 34, '$ ' + MONEY, 24, -0.03);
  tag(250, 46, 96, 34, 'sunny', 22, 0.04, '#fbe6a8');
  piece(rectPts(10, 650, 340, 80), '#e9dcc4', 2.2, 1.2);
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    piece(rectPts(s.x, s.y - (sel ? 4 : 0), s.w, s.h - 2), sel ? '#fbe6a8' : C.white, sel ? 2 : 1, 0.8);
    icon(t, s.x + 25, s.y + 22 - (sel ? 4 : 0));
    g.font = `700 15px ${F}`; g.fillStyle = C.ink; g.textAlign = 'right'; g.fillText('x' + [8, 3, 2, 1, 1][i], s.x + s.w - 5, s.y + s.h - 8 - (sel ? 4 : 0));
  });
  const h = HARVEST;
  piece(ellPts(h.x, h.y, h.r, h.r, 40), '#7cbf6a', 2.2, 0.8);
  piece(rectPts(h.x - 13, h.y - 2, 26, 14), C.wood, 1);
  dot(h.x - 5, h.y - 4, 5.5, C.red, 0.8); dot(h.x + 6, h.y - 5, 5.5, C.yellow, 0.8);
  dot(h.x + 20, h.y - 20, 10, C.red, 1.2);
  g.font = `700 16px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.white; g.fillText('9', h.x + 20, h.y - 19);
  // whole-page paper grain
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.25; g.fillStyle = grain; g.fillRect(0, 0, W, H); g.restore();
}
