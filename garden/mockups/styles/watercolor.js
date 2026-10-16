// Style: watercolor storybook. Layered translucent pigment washes with bleeding edges, sepia ink linework, cold-press paper.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, patchPoints, makeCanvas, seeded, fontsReady } from './common.js';

const F = '"Caveat", "Segoe Print", cursive';
let R = seeded(11), G = null;
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const P = {
  sky: '#8cc8ea', sun: '#f6c445', sap: '#7aa83e', green: '#3f7a4a', leaf: '#5a9a44', lime: '#a8c850', yellow: '#f2c230', orange: '#ee8030',
  red: '#d8354a', blue: '#4458b8', sienna: '#a8582e', raw: '#d6a45a', ink: '#3a2a22', paper: '#fbf8f1',
};
function deform(pts, depth, v) {
  if (depth === 0) return pts;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    out.push(a, [(a[0] + b[0]) / 2 + gauss() * v * len * 0.12, (a[1] + b[1]) / 2 + gauss() * v * len * 0.12]);
  }
  return deform(out, depth - 1, v * 0.8);
}
const ellPts = (cx, cy, rx, ry, n = 14, rot = 0) => { const o = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; o.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return o; };
const leafPts = (x, y, len, ang, w = 0.35) => { const o = []; for (let i = 0; i <= 6; i++) { const t = i / 6; o.push([t * len, Math.sin(t * Math.PI) * len * w]); } for (let i = 5; i > 0; i--) { const t = i / 6; o.push([t * len, -Math.sin(t * Math.PI) * len * w]); } return o.map(([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]); };
function fillPts(pts) { const g = G; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
// one pigment wash: many faint, randomly deformed copies of a base shape
function wash(pts, col, o = {}) {
  const g = G, layers = o.layers ?? 16, a = o.alpha ?? 0.06, v = o.spread ?? 1;
  const base = deform(pts, 2, v * 0.9);
  g.save(); g.globalCompositeOperation = o.mul ? 'multiply' : 'source-over'; g.fillStyle = col;
  for (let i = 0; i < layers; i++) { g.globalAlpha = a; fillPts(deform(base, 2, v * 0.7)); g.fill(); }
  g.globalAlpha = a * 1.6; g.strokeStyle = col; g.lineWidth = 0.9; fillPts(deform(base, 1, v * 0.3)); g.stroke();
  g.restore();
}
function ink(pts, closed = false, w = 1.1, a = 0.85) {
  const g = G; g.save(); g.strokeStyle = P.ink; g.globalAlpha = a; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); pts.forEach(([x, y], i) => { const jx = x + gauss() * 0.35, jy = y + gauss() * 0.35; i ? g.lineTo(jx, jy) : g.moveTo(jx, jy); }); if (closed) g.closePath(); g.stroke(); g.restore();
}
const inkEll = (cx, cy, rx, ry, w, rot = 0) => ink(ellPts(cx + 0.8, cy - 0.6, rx, ry, 22, rot), true, w);
const blob = (cx, cy, rx, ry, col, o) => wash(ellPts(cx, cy, rx, ry), col, o);
function berry(x, y, r, col) { blob(x, y, r, r, col, { layers: 8, alpha: 0.16, spread: 0.4 }); G.fillStyle = 'rgba(251,248,241,0.85)'; G.beginPath(); G.arc(x - r * 0.35, y - r * 0.4, r * 0.25, 0, 7); G.fill(); inkEll(x, y, r, r, 0.8); }

const PLANT = {
  tree(x, y) {
    wash([[x - 7, y], [x - 4, y - 52], [x + 4, y - 52], [x + 8, y]], P.sienna, { layers: 10, alpha: 0.1, spread: 0.3 });
    ink([[x - 6, y], [x - 3, y - 48]], false, 1); ink([[x + 7, y], [x + 4, y - 48]], false, 1);
    blob(x, y - 82, 38, 32, P.sap, { alpha: 0.05 }); blob(x - 8, y - 92, 24, 20, P.lime, { alpha: 0.05 }); blob(x + 12, y - 70, 22, 16, P.green, { alpha: 0.05 });
    ink(ellPts(x, y - 82, 36, 30, 26).map(([px, py], i) => [px + Math.sin(i * 1.7) * 3, py + Math.cos(i * 2.3) * 3]), true, 1);
    for (const [dx, dy] of [[-22, -66], [14, -74], [-4, -94], [26, -62], [-28, -84]]) berry(x + dx, y + dy, 5.5, P.red);
  },
  corn(x, y) {
    for (const [dx, h] of [[-8, 106], [9, 94]]) {
      wash([[x + dx - 2, y], [x + dx - 1, y - h], [x + dx + 1, y - h], [x + dx + 2, y]], P.sap, { layers: 8, alpha: 0.12, spread: 0.2 });
      ink([[x + dx, y], [x + dx, y - h]], false, 0.9);
      for (let k = 0; k < 4; k++) { const L = leafPts(x + dx, y - 22 - k * 19, 30 - k * 3, k % 2 ? -0.55 : Math.PI + 0.55, 0.15); wash(L, k % 2 ? P.leaf : P.lime, { layers: 8, alpha: 0.1, spread: 0.3 }); ink(L.slice(0, 7), false, 0.8); }
    }
    for (const [dx, cy, rot] of [[-17, -56, 0.25], [19, -44, -0.25]]) {
      wash(ellPts(x + dx, y + cy, 6.5, 14, 16, rot), P.yellow, { layers: 10, alpha: 0.12, spread: 0.3 });
      for (let k = -2; k <= 2; k++) ink([[x + dx - 3, y + cy + k * 5], [x + dx + 3, y + cy + k * 5 - 1]], false, 0.6, 0.5);
      inkEll(x + dx, y + cy, 6.5, 14, 0.8, rot);
    }
  },
  tulip(x, y) {
    ink([[x, y], [x - 1, y - 18], [x, y - 34]], false, 1);
    wash(leafPts(x, y - 2, 20, -1.15, 0.3), P.leaf, { layers: 8, alpha: 0.1, spread: 0.3 });
    const cup = [[x - 8, y - 46], [x - 4, y - 40], [x, y - 47], [x + 4, y - 40], [x + 8, y - 46], [x + 8, y - 36], [x + 4, y - 31], [x - 4, y - 31], [x - 8, y - 36]];
    wash(cup, P.orange, { layers: 10, alpha: 0.13, spread: 0.25 }); ink(cup, true, 0.9);
  },
  strawberry(x, y) {
    blob(x, y - 18, 28, 18, P.leaf, { alpha: 0.06 }); blob(x - 6, y - 24, 16, 10, P.lime, { alpha: 0.05 });
    ink(ellPts(x, y - 18, 27, 17, 20).map(([px, py], i) => [px + Math.sin(i * 2.1) * 2.5, py]), true, 0.9);
    for (const [dx, dy] of [[-17, -6], [3, -2], [19, -8]]) {
      const b = [[x + dx - 7, y + dy - 4], [x + dx, y + dy - 7], [x + dx + 7, y + dy - 4], [x + dx + 4, y + dy + 5], [x + dx, y + dy + 10], [x + dx - 4, y + dy + 5]];
      wash(b, P.red, { layers: 10, alpha: 0.13, spread: 0.2 }); ink(b, true, 0.8);
      for (const [sx, sy] of [[-3, -1], [2, 0], [0, 4], [-2, 3]]) { G.fillStyle = 'rgba(58,42,34,0.6)'; G.fillRect(x + dx + sx, y + dy + sy, 0.9, 1.2); }
    }
  },
  tomato(x, y) {
    wash([[x - 2, y], [x - 2, y - 62], [x + 2, y - 62], [x + 2, y]], P.raw, { layers: 6, alpha: 0.14, spread: 0.1 }); ink([[x - 2, y], [x - 2, y - 62]], false, 0.8);
    blob(x, y - 32, 18, 30, P.leaf, { alpha: 0.05 });
    for (const [dx, dy] of [[-15, -18], [13, -32], [-12, -44]]) berry(x + dx, y + dy, 7.5, P.red);
  },
  carrot(x, y) {
    for (const a of [-0.55, -0.15, 0.25, 0.6]) { const L = leafPts(x, y - 4, 17, -Math.PI / 2 + a, 0.14); wash(L, P.leaf, { layers: 5, alpha: 0.12, spread: 0.3 }); ink(L.slice(0, 7), false, 0.7, 0.7); }
    blob(x, y - 1, 7.5, 5, P.orange, { layers: 8, alpha: 0.15, spread: 0.3 }); inkEll(x, y - 1, 7.5, 5, 0.8);
  },
  pumpkin(x, y) {
    wash(leafPts(x - 4, y - 6, 26, Math.PI + 0.3, 0.42), P.green, { layers: 8, alpha: 0.08 }); wash(leafPts(x + 4, y - 6, 24, -0.2, 0.42), P.leaf, { layers: 8, alpha: 0.08 });
    blob(x, y - 15, 28, 16, P.orange, { alpha: 0.08, spread: 0.4 }); blob(x - 8, y - 18, 10, 8, P.yellow, { layers: 6, alpha: 0.08 });
    inkEll(x, y - 15, 28, 16, 1); ink([[x - 6, y - 30], [x - 9, y - 15], [x - 6, y - 1]], false, 0.8); ink([[x + 6, y - 30], [x + 9, y - 15], [x + 6, y - 1]], false, 0.8);
    ink([[x, y - 30], [x + 1, y - 38], [x + 4, y - 40]], false, 1.6);
  },
  blueberry(x, y) {
    blob(x, y - 22, 28, 22, P.green, { alpha: 0.06 }); blob(x + 6, y - 28, 14, 10, P.sap, { layers: 8, alpha: 0.05 });
    ink(ellPts(x, y - 22, 27, 21, 20).map(([px, py], i) => [px + Math.cos(i * 1.9) * 2.5, py]), true, 0.9);
    for (const [dx, dy] of [[-15, -14], [-9, -9], [10, -24], [16, -18], [3, -8], [-3, -30], [8, -36]]) berry(x + dx, y + dy, 4.2, P.blue);
  },
  watermelon(x, y) {
    wash(leafPts(x - 10, y - 4, 22, Math.PI + 0.2, 0.45), P.green, { layers: 8, alpha: 0.08 }); wash(leafPts(x + 10, y - 4, 22, -0.1, 0.45), P.leaf, { layers: 8, alpha: 0.08 });
    blob(x, y - 12, 25, 16, P.lime, { alpha: 0.07, spread: 0.35 });
    for (const dx of [-15, -5, 5, 15]) wash([[x + dx - 2, y - 26], [x + dx + 1, y - 26], [x + dx + 3, y - 12], [x + dx + 1, y + 2], [x + dx - 2, y + 2], [x + dx, y - 12]], P.green, { layers: 6, alpha: 0.12, spread: 0.2 });
    inkEll(x, y - 12, 25, 16, 1);
  },
};

function stall(s) {
  const { x, y } = s, col = s.kind === 'seeds' ? P.leaf : P.orange;
  wash([[x - 52, y - 66], [x + 52, y - 66], [x + 52, y - 10], [x - 52, y - 10]], P.sienna, { layers: 10, alpha: 0.07, spread: 0.2 });
  blob(x, y - 50, 12, 12, '#e8a888', { layers: 8, alpha: 0.12, spread: 0.3 }); inkEll(x, y - 50, 12, 12, 0.9);
  G.fillStyle = P.ink; G.beginPath(); G.arc(x - 4, y - 51, 1.2, 0, 7); G.arc(x + 4, y - 51, 1.2, 0, 7); G.fill();
  ink([[x - 3, y - 46], [x, y - 44.5], [x + 3, y - 46]], false, 0.9);
  if (s.kind === 'seeds') { wash([[x - 13, y - 58], [x - 9, y - 68], [x + 9, y - 68], [x + 13, y - 58], [x + 19, y - 57]], P.green, { layers: 8, alpha: 0.13, spread: 0.2 }); }
  else blob(x, y - 60, 12, 6, P.sienna, { layers: 8, alpha: 0.13, spread: 0.2 });
  const counter = [[x - 56, y - 30], [x + 56, y - 30], [x + 56, y + 2], [x - 56, y + 2]];
  wash(counter, P.raw, { layers: 12, alpha: 0.1, spread: 0.15 }); ink(counter, true, 1.1);
  for (let i = 1; i < 4; i++) ink([[x - 56 + i * 28, y - 28], [x - 56 + i * 28, y + 1]], false, 0.6, 0.5);
  for (let i = 0; i < 4; i++) berry(x - 36 + i * 24, y - 36, 5, s.kind === 'seeds' ? [P.orange, P.red, P.leaf, P.yellow][i] : P.yellow);
  for (const dx of [-58, 56]) { ink([[x + dx, y + 2], [x + dx, y - 100]], false, 1.4); }
  // scalloped awning
  for (let i = 0; i < 6; i++) {
    const sx = x - 60 + i * 20, sw = [[sx, y - 100], [sx + 20, y - 100], [sx + 20, y - 82], [sx + 15, y - 77], [sx + 10, y - 76], [sx + 5, y - 77], [sx, y - 82]];
    if (i % 2 === 0) wash(sw, col, { layers: 10, alpha: 0.12, spread: 0.15 });
    ink(sw, true, 0.8, 0.7);
  }
  G.font = `700 30px ${F}`; G.textAlign = 'center'; G.textBaseline = 'middle';
  blob(x, y - 116, 36, 13, col, { layers: 8, alpha: 0.08, spread: 0.4 });
  G.fillStyle = P.ink; G.fillText(s.label, x, y - 114);
}
function farmer(x, y) {
  blob(x, y - 1, 14, 3.5, '#8a7a60', { layers: 5, alpha: 0.08, spread: 0.3 });
  const body = [[x - 11, y - 30], [x + 11, y - 30], [x + 12, y - 2], [x - 12, y - 2]];
  wash(body, P.blue, { layers: 10, alpha: 0.11, spread: 0.2 }); ink(body, true, 1);
  blob(x, y - 44, 13, 13, '#f2b896', { layers: 10, alpha: 0.11, spread: 0.2 }); inkEll(x, y - 44, 13, 13, 1);
  G.fillStyle = P.ink; G.beginPath(); G.arc(x - 4.5, y - 44, 1.4, 0, 7); G.arc(x + 4.5, y - 44, 1.4, 0, 7); G.fill();
  blob(x - 8, y - 39, 3, 2, P.red, { layers: 4, alpha: 0.1 }); blob(x + 8, y - 39, 3, 2, P.red, { layers: 4, alpha: 0.1 });
  blob(x, y - 55, 24, 6, P.yellow, { layers: 10, alpha: 0.13, spread: 0.2 }); inkEll(x, y - 55, 24, 6, 1);
  const crown = [[x - 11, y - 56], [x - 9, y - 68], [x + 9, y - 68], [x + 11, y - 56]];
  wash(crown, P.raw, { layers: 10, alpha: 0.14, spread: 0.2 }); ink(crown, false, 1);
  wash([[x - 11, y - 60], [x + 11, y - 60], [x + 11, y - 57], [x - 11, y - 57]], P.red, { layers: 6, alpha: 0.15, spread: 0.1 });
}
function card(x, y, w, h, col = '#f2dca0') {
  wash([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], col, { layers: 8, alpha: 0.12, spread: 0.12 });
  ink([[x + 2, y + 1], [x + w - 1, y], [x + w, y + h - 1], [x + 1, y + h]], true, 1.1);
}
function icon(t, x, y) {
  if (t === 'carrot') { const c = [[x - 6, y - 7], [x + 6, y - 7], [x + 1, y + 12], [x - 1, y + 12]]; wash(c, P.orange, { layers: 8, alpha: 0.16, spread: 0.2 }); ink(c, true, 0.9); ink([[x - 2, y - 7], [x - 5, y - 15]], false, 1); ink([[x + 2, y - 7], [x + 4, y - 15]], false, 1); }
  if (t === 'strawberry') { const b = [[x - 10, y - 6], [x, y - 10], [x + 10, y - 6], [x + 6, y + 6], [x, y + 12], [x - 6, y + 6]]; wash(b, P.red, { layers: 8, alpha: 0.16, spread: 0.2 }); ink(b, true, 0.9); }
  if (t === 'tomato') berry(x, y + 1, 10, P.red);
  if (t === 'corn') { wash(ellPts(x, y, 6, 12), P.yellow, { layers: 8, alpha: 0.16, spread: 0.2 }); inkEll(x, y, 6, 12, 0.9); }
  if (t === 'apple') { berry(x, y + 1, 10, P.red); ink([[x, y - 8], [x + 2, y - 13]], false, 1.2); }
}

export async function render(host) {
  await fontsReady([`700 24px ${F}`]);
  R = seeded(11);
  const { g } = makeCanvas(host);
  G = g;
  g.fillStyle = P.paper; g.fillRect(0, 0, W, H);
  // cold-press paper tooth
  for (let i = 0; i < 9000; i++) { const v = R(); g.fillStyle = v < 0.5 ? `rgba(120,100,70,${0.05 + R() * 0.05})` : `rgba(255,255,255,${0.3 + R() * 0.3})`; g.fillRect(R() * W, R() * H, 1 + R(), 1 + R()); }
  // sky
  wash([[-20, -20], [W + 20, -20], [W + 20, 190], [W * 0.6, 170], [-20, 200]], P.sky, { layers: 18, alpha: 0.04, spread: 0.5 });
  wash([[-20, -20], [W + 20, -20], [W + 20, 90], [-20, 110]], P.sky, { layers: 10, alpha: 0.035, spread: 0.6 });
  g.fillStyle = 'rgba(251,248,241,0.75)'; for (const [cx, cy, rx] of [[80, 110, 40], [210, 76, 34]]) { g.beginPath(); g.ellipse(cx, cy, rx, 12, 0, 0, 7); g.fill(); }
  blob(292, 128, 26, 26, P.sun, { layers: 16, alpha: 0.07, spread: 0.3 });
  // hills, trees, grass
  wash([[0, 190], [90, 168], [200, 182], [300, 160], [W, 172], [W, 230], [0, 230]], P.sap, { layers: 14, alpha: 0.045, spread: 0.4 });
  for (let x = 16; x < W; x += 40) { blob(x, 182, 15, 17, R() < 0.5 ? P.green : P.leaf, { layers: 10, alpha: 0.06, spread: 0.5 }); ink([[x, 196], [x, 206]], false, 1, 0.7); }
  wash([[-20, 230], [W + 20, 226], [W + 20, H - 80], [-20, H - 80]], P.lime, { layers: 16, alpha: 0.035, spread: 0.3 });
  wash([[-20, 205], [W + 20, 202], [W + 20, 246], [-20, 248]], P.raw, { layers: 12, alpha: 0.05, spread: 0.2 });
  ink([[0, 204], [120, 203], [240, 205], [W, 202]], false, 0.8, 0.5); ink([[0, 247], [130, 246], [250, 248], [W, 246]], false, 0.8, 0.5);
  for (let i = 0; i < 50; i++) { const x = R() * W, y = 260 + R() * 380; if (Math.hypot((x - 180) / 170, (y - 452) / 178) < 1) continue; ink([[x - 2, y - 6], [x, y], [x + 2, y - 7]], false, 0.8, 0.6); }
  for (let i = 0; i < 10; i++) { const x = R() * W, y = 270 + R() * 370; if (Math.hypot((x - 180) / 170, (y - 452) / 178) < 1) continue; blob(x, y, 3.5, 3.5, [P.red, P.yellow, '#c070c0'][i % 3], { layers: 5, alpha: 0.16, spread: 0.3 }); }
  // the bed
  const pts = patchPoints(40);
  wash(pts, '#c48a58', { layers: 16, alpha: 0.045, spread: 0.18 });
  wash(pts.map(([x, y]) => [x * 0.85 + 27, y * 0.85 + 68]), P.sienna, { layers: 8, alpha: 0.03, spread: 0.3, mul: true });
  ink(patchPoints(70), true, 1.2, 0.7);
  for (let i = 0; i < 260; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * 0.92; g.fillStyle = `rgba(110,60,30,${0.1 + R() * 0.2})`; g.fillRect(180 + Math.cos(a) * 150 * d, 452 + Math.sin(a) * 158 * d, 1.2, 1.2); }
  STALLS.forEach(stall);
  const list = [...PLANTS.map((p) => ({ y: p.y, d: () => PLANT[p.t](p.x, p.y) })), { y: FARMER.y, d: () => farmer(FARMER.x, FARMER.y) }].sort((a, b) => a.y - b.y);
  list.forEach((o) => o.d());
  // ghost
  g.save(); g.setLineDash([3, 5]); g.strokeStyle = P.ink; g.globalAlpha = 0.7; g.lineWidth = 1.2; g.beginPath(); g.ellipse(GHOST.x, GHOST.y, 20, 9, 0, 0, 7); g.stroke(); g.restore();
  g.globalAlpha = 0.5; PLANT.carrot(GHOST.x, GHOST.y); g.globalAlpha = 1;
  ink([[SLOT(0).x + 25, SLOT(0).y - 6], [GHOST.x - 28, GHOST.y + 40], [GHOST.x - 6, GHOST.y + 12]], false, 1, 0.6);
  g.font = `700 22px ${F}`; g.fillStyle = P.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('plant here', GHOST.x, GHOST.y - 40);
  // HUD
  card(14, 48, 120, 34);
  g.font = `700 26px ${F}`; g.textAlign = 'left'; g.fillStyle = P.ink; g.fillText('$' + MONEY, 26, 66);
  card(250, 48, 96, 34, '#bfe0f2'); g.fillText('sunny', 270, 66);
  card(10, 650, 340, 80, '#efe4cc');
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    card(s.x, s.y - (sel ? 3 : 0), s.w, s.h - 2, sel ? '#f6d880' : '#fbf8f1');
    icon(t, s.x + 25, s.y + 21 - (sel ? 3 : 0));
    g.font = `700 16px ${F}`; g.fillStyle = P.ink; g.textAlign = 'right'; g.fillText('x' + [8, 3, 2, 1, 1][i], s.x + s.w - 4, s.y + s.h - 10 - (sel ? 3 : 0));
  });
  const h = HARVEST;
  blob(h.x, h.y, h.r, h.r, P.leaf, { layers: 12, alpha: 0.1, spread: 0.2 }); inkEll(h.x, h.y, h.r, h.r, 1.2);
  berry(h.x - 6, h.y - 2, 6, P.red); berry(h.x + 6, h.y - 3, 6, P.yellow);
  blob(h.x + 20, h.y - 20, 10, 10, P.red, { layers: 8, alpha: 0.18, spread: 0.2 }); g.font = `700 18px ${F}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('9', h.x + 20, h.y - 19);
}
