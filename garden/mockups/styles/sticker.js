// Style: bold sticker cartoon. Thick tinted outlines, glossy gradients, chunky 3D buttons.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, patchPoints, makeCanvas, smoothPoly, seeded, fontsReady } from './common.js';

const F = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; };
function circles(g, cs, fill, stroke, lw = 3.5) {
  g.fillStyle = stroke;
  for (const [x, y, r] of cs) { g.beginPath(); g.arc(x, y, r + lw, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = fill;
  for (const [x, y, r] of cs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
}
function shape(g, path, fill, stroke, lw = 3.5) { path(); g.lineJoin = 'round'; g.lineWidth = lw * 2; g.strokeStyle = stroke; g.stroke(); g.fillStyle = fill; g.fill(); }
const ell = (g, x, y, rx, ry, rot = 0) => () => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
const rr = (g, x, y, w, h, r) => () => { g.beginPath(); g.roundRect(x, y, w, h, r); };
function gloss(g, x, y, r) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.32, r * 0.2, -0.6, 0, Math.PI * 2); g.fill(); }
function shadow(g, x, y, rx, ry = rx * 0.32) { g.fillStyle = 'rgba(40,60,20,0.22)'; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function fruit(g, x, y, r, col, dark) { circles(g, [[x, y, r]], col, dark, 2.5); gloss(g, x, y, r); }
function leaf(g, x, y, len, ang, w = 0.42, fill = '#5fd14a', stroke = '#2a7a2a') {
  shape(g, () => { g.beginPath(); g.save(); g.translate(x, y); g.rotate(ang); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * w, len, 0); g.quadraticCurveTo(len * 0.5, len * w, 0, 0); g.restore(); }, fill, stroke, 2.5);
}
const GREEN = '#5fd14a', GD = '#2a7a2a';

const PLANT = {
  tree(g, x, y) {
    shadow(g, x, y, 38);
    shape(g, () => { g.beginPath(); g.moveTo(x - 7, y); g.quadraticCurveTo(x - 4, y - 30, x - 6, y - 52); g.lineTo(x + 6, y - 52); g.quadraticCurveTo(x + 4, y - 30, x + 9, y); g.closePath(); }, lin(g, x - 7, 0, x + 9, 0, ['#c98a52', '#8a5228']), '#5a3014');
    const cs = [[x, y - 78, 30], [x - 26, y - 62, 22], [x + 27, y - 60, 22], [x - 14, y - 96, 20], [x + 15, y - 98, 19]];
    circles(g, cs, lin(g, 0, y - 118, 0, y - 40, ['#8ff06a', '#3fb43a']), GD, 4);
    g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(x - 12, y - 100, 12, 6, -0.5, 0, Math.PI * 2); g.fill();
    for (const [ax, ay] of [[-22, -60], [14, -70], [-4, -88], [26, -52], [-30, -76]]) fruit(g, x + ax, y + ay, 7, lin(g, 0, y + ay - 7, 0, y + ay + 7, ['#ff6b6b', '#d81f3a']), '#7a0f20');
  },
  corn(g, x, y) {
    shadow(g, x, y, 22);
    for (const [dx, h] of [[-8, 108], [9, 96]]) {
      g.lineCap = 'round';
      g.strokeStyle = GD; g.lineWidth = 9; g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx, y - h); g.stroke();
      g.strokeStyle = '#7fd34a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx, y - h); g.stroke();
      for (let k = 0; k < 4; k++) leaf(g, x + dx, y - 22 - k * 20, 30 - k * 3, k % 2 ? -0.5 : Math.PI + 0.5, 0.25, '#7fd34a', GD);
      g.strokeStyle = '#c9932e'; g.lineWidth = 3;
      for (const a of [-0.5, 0, 0.5]) { g.beginPath(); g.moveTo(x + dx, y - h); g.lineTo(x + dx + Math.sin(a) * 12, y - h - Math.cos(a) * 12); g.stroke(); }
    }
    for (const [dx, cy] of [[-17, -58], [19, -46]]) {
      shape(g, ell(g, x + dx, y + cy, 7, 15, dx < 0 ? 0.25 : -0.25), lin(g, 0, y + cy - 15, 0, y + cy + 15, ['#fff27a', '#ffc21f']), '#a8700a', 2.5);
      g.fillStyle = 'rgba(200,130,10,0.45)';
      for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) { g.beginPath(); g.arc(x + dx + j * 3.6 + i * (dx < 0 ? 0.9 : -0.9), y + cy + i * 5, 1.2, 0, 7); g.fill(); }
      leaf(g, x + dx, y + cy + 14, 14, dx < 0 ? -1.9 : -1.2, 0.35, '#7fd34a', GD);
    }
  },
  tulip(g, x, y) {
    shadow(g, x, y, 12);
    g.strokeStyle = GD; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 4, y - 18, x, y - 36); g.stroke();
    g.strokeStyle = '#6fd34a'; g.lineWidth = 2.5; g.stroke();
    leaf(g, x, y - 4, 20, -1.1, 0.35); leaf(g, x, y - 6, 18, -2.1, 0.35);
    shape(g, () => { g.beginPath(); g.moveTo(x - 9, y - 46); g.lineTo(x - 5, y - 40); g.lineTo(x, y - 47); g.lineTo(x + 5, y - 40); g.lineTo(x + 9, y - 46); g.quadraticCurveTo(x + 10, y - 30, x, y - 31); g.quadraticCurveTo(x - 10, y - 30, x - 9, y - 46); }, lin(g, 0, y - 47, 0, y - 31, ['#ffb35a', '#ff6a2a']), '#a8370e', 2.5);
  },
  strawberry(g, x, y) {
    shadow(g, x, y, 26);
    circles(g, [[x - 14, y - 14, 13], [x + 14, y - 14, 13], [x, y - 24, 15], [x, y - 10, 12]], lin(g, 0, y - 40, 0, y, ['#8ff06a', '#3fb43a']), GD, 3.5);
    for (const [dx, dy] of [[-18, -6], [3, -2], [19, -8]]) {
      shape(g, () => { g.beginPath(); g.moveTo(x + dx - 7, y + dy - 4); g.quadraticCurveTo(x + dx, y + dy - 8, x + dx + 7, y + dy - 4); g.quadraticCurveTo(x + dx + 6, y + dy + 6, x + dx, y + dy + 10); g.quadraticCurveTo(x + dx - 6, y + dy + 6, x + dx - 7, y + dy - 4); }, lin(g, 0, y + dy - 6, 0, y + dy + 10, ['#ff5a6a', '#d0103a']), '#7a0820', 2.5);
      g.fillStyle = '#ffe48a'; for (const [sx, sy] of [[-3, 0], [2, 1], [0, 5], [-2, 3], [3, -3]]) { g.beginPath(); g.arc(x + dx + sx, y + dy + sy, 0.9, 0, 7); g.fill(); }
      gloss(g, x + dx, y + dy + 1, 6);
    }
    for (const [fx, fy] of [[-8, -30], [10, -26]]) { g.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { const a = k * 1.256; g.beginPath(); g.arc(x + fx + Math.cos(a) * 2.6, y + fy + Math.sin(a) * 2.6, 2, 0, 7); g.fill(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + fx, y + fy, 1.8, 0, 7); g.fill(); }
  },
  tomato(g, x, y) {
    shadow(g, x, y, 22);
    shape(g, rr(g, x - 3, y - 62, 6, 62, 3), '#c98a52', '#5a3014', 2);
    for (let k = 0; k < 4; k++) circles(g, [[x + (k % 2 ? 10 : -10), y - 12 - k * 13, 10]], lin(g, 0, y - 60, 0, y, ['#8ff06a', '#3fb43a']), GD, 3);
    for (const [dx, dy] of [[-15, -18], [13, -32], [-12, -44]]) { fruit(g, x + dx, y + dy, 8, lin(g, 0, y + dy - 8, 0, y + dy + 8, ['#ff7a5a', '#e0281f']), '#80140e'); g.fillStyle = '#3fb43a'; g.beginPath(); g.arc(x + dx, y + dy - 7, 2.5, 0, 7); g.fill(); }
  },
  carrot(g, x, y) {
    shadow(g, x, y + 2, 10, 3.5);
    for (const a of [-0.6, -0.2, 0.2, 0.6]) leaf(g, x, y - 6, 18, -Math.PI / 2 + a, 0.28, '#6fd34a', GD);
    shape(g, ell(g, x, y - 2, 8, 6), lin(g, 0, y - 8, 0, y + 4, ['#ffb35a', '#ff7a1f']), '#a8400a', 2.5);
    g.strokeStyle = 'rgba(160,60,10,0.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x - 1, y); g.stroke();
  },
  pumpkin(g, x, y) {
    shadow(g, x, y + 2, 30);
    leaf(g, x - 4, y - 6, 28, Math.PI + 0.3, 0.45); leaf(g, x + 4, y - 6, 26, -0.2, 0.45);
    const col = lin(g, 0, y - 34, 0, y, ['#ffbf4a', '#ff7f1a']);
    for (const [dx, rx] of [[-13, 13], [13, 13], [0, 15]]) shape(g, ell(g, x + dx, y - 15, rx, 16), col, '#9a420a', 3);
    g.strokeStyle = 'rgba(160,70,10,0.4)'; g.lineWidth = 2; for (const dx of [-6, 6]) { g.beginPath(); g.ellipse(x + dx, y - 15, 3, 14, 0, 0, Math.PI * 2); g.stroke(); }
    gloss(g, x - 8, y - 18, 12);
    shape(g, rr(g, x - 3, y - 38, 6, 9, 2), '#6a8a2a', '#3a4a12', 2);
  },
  blueberry(g, x, y) {
    shadow(g, x, y, 26);
    circles(g, [[x - 13, y - 18, 14], [x + 13, y - 18, 14], [x, y - 32, 15], [x, y - 14, 14]], lin(g, 0, y - 48, 0, y, ['#5fd48a', '#1f8a5a']), '#145a3a', 3.5);
    for (const [dx, dy] of [[-15, -14], [-9, -9], [10, -24], [16, -18], [3, -8], [-3, -30]]) fruit(g, x + dx, y + dy, 5, lin(g, 0, y + dy - 5, 0, y + dy + 5, ['#8aa8ff', '#3a4ad8']), '#1a1f70');
  },
  watermelon(g, x, y) {
    shadow(g, x, y + 2, 30);
    leaf(g, x - 10, y - 4, 22, Math.PI + 0.2, 0.5); leaf(g, x + 10, y - 4, 22, -0.1, 0.5);
    shape(g, ell(g, x, y - 12, 25, 16), lin(g, 0, y - 28, 0, y + 4, ['#7ce05a', '#2f9a3a']), '#145a1a', 3);
    g.save(); ell(g, x, y - 12, 25, 16)(); g.clip();
    g.strokeStyle = '#1f6a2a'; g.lineWidth = 4;
    for (const dx of [-16, -6, 4, 14]) { g.beginPath(); g.moveTo(x + dx, y - 30); g.quadraticCurveTo(x + dx + 6, y - 12, x + dx, y + 6); g.stroke(); }
    g.restore();
    gloss(g, x - 4, y - 14, 18);
  },
};

function stall(g, s) {
  const { x, y } = s, col = s.kind === 'seeds' ? ['#4fe06a', '#1fa83a', '#0f6a20'] : ['#ffcf3a', '#ff9a1a', '#a8580a'];
  shadow(g, x, y + 2, 64, 9);
  shape(g, rr(g, x - 54, y - 62, 108, 52, 6), '#c98a52', '#5a3014', 3);
  shape(g, rr(g, x - 54, y - 62, 108, 52, 6), lin(g, 0, y - 62, 0, y - 10, ['#8a5228', '#6a3a18']), '#5a3014', 3);
  // shopkeeper
  const hx = x, hy = y - 52;
  circles(g, [[hx, hy, 15]], s.kind === 'seeds' ? '#ffcf9e' : '#d99a6a', '#7a4022', 3);
  g.fillStyle = '#2a1a14'; g.beginPath(); g.ellipse(hx - 5, hy, 2, 3, 0, 0, 7); g.ellipse(hx + 5, hy, 2, 3, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,90,90,0.4)'; g.beginPath(); g.arc(hx - 9, hy + 5, 3, 0, 7); g.arc(hx + 9, hy + 5, 3, 0, 7); g.fill();
  g.strokeStyle = '#2a1a14'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(hx, hy + 4, 4, 0.3, Math.PI - 0.3); g.stroke();
  if (s.kind === 'seeds') shape(g, () => { g.beginPath(); g.ellipse(hx, hy - 12, 16, 6, 0, Math.PI, 0); g.lineTo(hx + 22, hy - 11); g.closePath(); }, '#2fbf4a', '#0f6a20', 2.5);
  else { circles(g, [[hx, hy - 12, 10]], '#7a3a1a', '#3a1a0a', 2.5); g.strokeStyle = '#2a1a14'; g.lineWidth = 2; g.beginPath(); g.arc(hx - 5, hy, 4, 0, 7); g.arc(hx + 5, hy, 4, 0, 7); g.stroke(); }
  // counter
  shape(g, rr(g, x - 58, y - 30, 116, 32, 8), lin(g, 0, y - 30, 0, y, ['#e8a86a', '#b06a32']), '#5a3014', 3);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 54, y - 28, 108, 4);
  if (s.kind === 'seeds') for (let i = 0; i < 4; i++) { const px = x - 40 + i * 22; shape(g, rr(g, px, y - 44, 14, 18, 2), '#fff4dc', '#7a5a3a', 2); g.fillStyle = ['#ff6a3a', '#ff4a6a', '#5fd14a', '#ffcf3a'][i]; g.beginPath(); g.arc(px + 7, y - 33, 4, 0, 7); g.fill(); }
  else { for (const [dx, c] of [[-38, '#ffd23f'], [-28, '#ffd23f'], [-33, '#ffe96a']]) circles(g, [[x + dx, y - 38 + (c === '#ffe96a' ? -5 : 0), 7]], c, '#a8700a', 2.5); shape(g, rr(g, x + 22, y - 46, 26, 16, 3), '#ff7a5a', '#80140e', 2); }
  // awning
  const ay = y - 96;
  for (let i = 0; i < 6; i++) {
    const sx = x - 60 + i * 20, c = i % 2 ? '#fff6e6' : col[0];
    shape(g, () => { g.beginPath(); g.moveTo(sx, ay); g.lineTo(sx + 20, ay); g.lineTo(sx + 20, ay + 22); g.arc(sx + 10, ay + 22, 10, 0, Math.PI); g.closePath(); }, c, col[2], 2.5);
  }
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 60, ay + 16, 120, 5);
  // sign
  shape(g, rr(g, x - 40, ay - 30, 80, 30, 10), lin(g, 0, ay - 30, 0, ay, [col[0], col[1]]), col[2], 3);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.roundRect(x - 34, ay - 27, 68, 6, 3); g.fill();
  g.font = `22px ${F}`; g.textAlign = 'center'; g.lineJoin = 'round';
  g.lineWidth = 5; g.strokeStyle = col[2]; g.strokeText(s.label.toUpperCase(), x, ay - 7); g.fillStyle = '#fff'; g.fillText(s.label.toUpperCase(), x, ay - 7);
}

function farmer(g, x, y) {
  shadow(g, x, y, 16, 5);
  shape(g, rr(g, x - 11, y - 30, 22, 26, 9), lin(g, 0, y - 30, 0, y, ['#5aa0ff', '#2a5ad8']), '#142a7a', 3);
  shape(g, rr(g, x - 9, y - 8, 7, 9, 3), '#6a3a1a', '#2a1408', 2); shape(g, rr(g, x + 2, y - 8, 7, 9, 3), '#6a3a1a', '#2a1408', 2);
  circles(g, [[x, y - 46, 17]], '#ffcf9e', '#7a4022', 3);
  g.fillStyle = '#2a1a14'; g.beginPath(); g.ellipse(x - 6, y - 45, 2.4, 3.4, 0, 0, 7); g.ellipse(x + 6, y - 45, 2.4, 3.4, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 5.4, y - 46.5, 1, 0, 7); g.arc(x + 6.6, y - 46.5, 1, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,90,90,0.45)'; g.beginPath(); g.arc(x - 11, y - 40, 3.5, 0, 7); g.arc(x + 11, y - 40, 3.5, 0, 7); g.fill();
  shape(g, ell(g, x, y - 58, 27, 8), lin(g, 0, y - 66, 0, y - 50, ['#ffe48a', '#e8b23a']), '#8a5a0a', 3);
  shape(g, () => { g.beginPath(); g.ellipse(x, y - 62, 14, 13, 0, Math.PI, 0); g.closePath(); }, lin(g, 0, y - 76, 0, y - 60, ['#ffe48a', '#e8b23a']), '#8a5a0a', 3);
  g.fillStyle = '#ff5a5a'; g.fillRect(x - 14, y - 64, 28, 4);
}

function ghost(g, x, y) {
  g.save();
  g.setLineDash([5, 5]); g.lineWidth = 3; g.strokeStyle = '#fff';
  g.beginPath(); g.ellipse(x, y, 20, 8, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 0.6; PLANT.carrot(g, x, y); g.globalAlpha = 1;
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.setLineDash([2, 7]); g.lineCap = 'round';
  g.beginPath(); g.moveTo(SLOT(0).x + 25, SLOT(0).y - 4); g.quadraticCurveTo(x - 40, y + 30, x - 6, y + 10); g.stroke();
  g.restore();
  // finger
  g.save(); g.translate(x + 12, y + 14); g.rotate(-0.35);
  shape(g, rr(g, -6, -2, 12, 24, 6), '#ffe0c4', '#7a4022', 2.5);
  shape(g, rr(g, -10, 10, 20, 18, 7), '#ffe0c4', '#7a4022', 2.5);
  g.restore();
}

function cropIcon(g, t, x, y, k = 1) {
  g.save(); g.translate(x, y); g.scale(k, k);
  if (t === 'carrot') { leaf(g, 0, -8, 12, -1.9, 0.3, '#6fd34a', GD); leaf(g, 0, -8, 12, -1.2, 0.3, '#6fd34a', GD); shape(g, () => { g.beginPath(); g.moveTo(-7, -8); g.quadraticCurveTo(0, -12, 7, -8); g.lineTo(1, 14); g.lineTo(-1, 14); g.closePath(); }, lin(g, 0, -10, 0, 14, ['#ffb35a', '#ff7a1f']), '#a8400a', 2.5); }
  if (t === 'strawberry') PLANT_ICON.strawberry(g);
  if (t === 'tomato') { fruit(g, 0, 2, 11, lin(g, 0, -9, 0, 13, ['#ff7a5a', '#e0281f']), '#80140e'); g.fillStyle = '#3fb43a'; g.beginPath(); g.arc(0, -8, 4, 0, 7); g.fill(); }
  if (t === 'corn') { shape(g, ell(g, 0, 0, 7, 14), lin(g, 0, -14, 0, 14, ['#fff27a', '#ffc21f']), '#a8700a', 2.5); leaf(g, 0, 12, 13, -1.9, 0.35, '#7fd34a', GD); leaf(g, 0, 12, 13, -1.2, 0.35, '#7fd34a', GD); }
  if (t === 'apple') { fruit(g, 0, 2, 12, lin(g, 0, -10, 0, 14, ['#ff6b6b', '#d81f3a']), '#7a0f20'); leaf(g, 1, -10, 10, -0.6, 0.4); }
  g.restore();
}
const PLANT_ICON = {
  strawberry(g) { shape(g, () => { g.beginPath(); g.moveTo(-11, -6); g.quadraticCurveTo(0, -12, 11, -6); g.quadraticCurveTo(9, 8, 0, 14); g.quadraticCurveTo(-9, 8, -11, -6); }, lin(g, 0, -10, 0, 14, ['#ff5a6a', '#d0103a']), '#7a0820', 2.5); gloss(g, 0, 0, 9); g.fillStyle = '#3fb43a'; g.beginPath(); g.ellipse(0, -9, 8, 3, 0, 0, 7); g.fill(); },
};

function hud(g) {
  // money pill
  const px = 14, py = 50;
  shape(g, rr(g, px, py, 132, 34, 17), lin(g, 0, py, 0, py + 34, ['#3a2a6a', '#24184a']), '#120a2a', 2.5);
  circles(g, [[px + 17, py + 17, 13]], lin(g, 0, py + 4, 0, py + 30, ['#ffe96a', '#ffb31a']), '#8a5a0a', 2.5);
  g.font = `16px ${F}`; g.textAlign = 'center'; g.fillStyle = '#a8700a'; g.fillText('$', px + 17, py + 23);
  g.font = `22px ${F}`; g.textAlign = 'left'; g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = '#120a2a'; g.strokeText(MONEY, px + 38, py + 25); g.fillStyle = '#fff'; g.fillText(MONEY, px + 38, py + 25);
  // weather
  shape(g, rr(g, 254, py, 92, 34, 17), lin(g, 0, py, 0, py + 34, ['#3a2a6a', '#24184a']), '#120a2a', 2.5);
  circles(g, [[272, py + 17, 9]], '#ffd23f', '#c87a0a', 2.5);
  g.font = `18px ${F}`; g.lineWidth = 4; g.strokeStyle = '#120a2a'; g.strokeText('Sunny', 288, py + 24); g.fillStyle = '#fff'; g.fillText('Sunny', 288, py + 24);
  // bottom tray
  shape(g, rr(g, 10, 652, 340, 76, 22), lin(g, 0, 652, 0, 728, ['#3a2a6a', '#24184a']), '#120a2a', 3);
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    shape(g, rr(g, s.x, s.y + 4, s.w, s.h - 4, 14), sel ? '#c8860a' : '#b8b0d8', '#120a2a', 2);
    shape(g, rr(g, s.x, s.y - (sel ? 3 : 0), s.w, s.h - 6, 14), sel ? lin(g, 0, s.y, 0, s.y + 44, ['#fff27a', '#ffc21f']) : lin(g, 0, s.y, 0, s.y + 44, ['#ffffff', '#e4def8']), '#120a2a', 2);
    cropIcon(g, t, s.x + 25, s.y + 20 - (sel ? 3 : 0), 0.95);
    const n = [8, 3, 2, 1, 1][i];
    shape(g, () => { g.beginPath(); g.arc(s.x + s.w - 4, s.y + 2 - (sel ? 3 : 0), 10, 0, 7); }, '#ff4a5a', '#7a0a1a', 2);
    g.font = `14px ${F}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(String(n), s.x + s.w - 4, s.y + 7 - (sel ? 3 : 0));
  });
  // harvest button
  const h = HARVEST;
  circles(g, [[h.x, h.y + 4, h.r]], '#1f8a2a', '#0a3a10', 3);
  circles(g, [[h.x, h.y, h.r]], lin(g, 0, h.y - h.r, 0, h.y + h.r, ['#8ff06a', '#2fbf3a']), '#0a3a10', 3);
  g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(h.x - 6, h.y - 14, 12, 5, -0.3, 0, 7); g.fill();
  shape(g, rr(g, h.x - 13, h.y - 2, 26, 15, 4), '#e8a86a', '#5a3014', 2);
  circles(g, [[h.x - 6, h.y - 4, 6]], '#ff5a5a', '#7a0f20', 2); circles(g, [[h.x + 6, h.y - 5, 6]], '#ffb31a', '#8a5a0a', 2);
  shape(g, () => { g.beginPath(); g.arc(h.x + 20, h.y - 20, 11, 0, 7); }, '#ff4a5a', '#7a0a1a', 2);
  g.font = `15px ${F}`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('9', h.x + 20, h.y - 15);
}

export async function render(host) {
  await fontsReady([`22px ${F}`]);
  const { g } = makeCanvas(host);
  const R = seeded(4);
  // sky
  g.fillStyle = lin(g, 0, 0, 0, 230, ['#3ab4ff', '#9fe4ff']); g.fillRect(0, 0, W, 240);
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(300, 120, 60, 0, 7); g.fill();
  circles(g, [[300, 120, 26]], lin(g, 0, 94, 0, 146, ['#fff38a', '#ffc21f']), '#e8900a', 3);
  for (const [cx, cy, k] of [[70, 110, 1], [210, 80, 0.8]]) circles(g, [[cx, cy, 16 * k], [cx + 18 * k, cy - 8 * k, 20 * k], [cx + 40 * k, cy, 15 * k], [cx + 20 * k, cy + 6 * k, 14 * k]], '#ffffff', '#8ccff0', 3);
  // hills and trees
  shape(g, () => { g.beginPath(); g.moveTo(0, 240); g.quadraticCurveTo(70, 150, 170, 190); g.quadraticCurveTo(260, 140, 360, 180); g.lineTo(360, 260); g.lineTo(0, 260); g.closePath(); }, lin(g, 0, 150, 0, 240, ['#7fe06a', '#4fc04a']), '#2a8a3a', 3);
  for (let x = 6; x < W; x += 34) { const r = 14 + R() * 5; circles(g, [[x, 196 - R() * 6, r], [x + 12, 202, r * 0.8]], lin(g, 0, 170, 0, 215, ['#5fd14a', '#2f9a3a']), '#1f6a2a', 3); }
  // grass field
  g.fillStyle = lin(g, 0, 200, 0, H, ['#7ad85a', '#5cc04a']); g.fillRect(0, 205, W, H);
  // plaza path
  shape(g, rr(g, -10, 200, W + 20, 44, 18), lin(g, 0, 200, 0, 244, ['#ffe4b0', '#f2c98a']), '#b0804a', 3);
  g.fillStyle = 'rgba(176,128,74,0.35)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(R() * W, 208 + R() * 30, 6 + R() * 6, 3, 0, 0, 7); g.fill(); }
  // grass tufts and flowers
  for (let i = 0; i < 70; i++) {
    const x = R() * W, y = 250 + R() * 400;
    if (Math.hypot((x - 180) / 168, (y - 452) / 176) < 1) continue;
    g.strokeStyle = '#3fa83a'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 3, y - 6); g.lineTo(x, y); g.lineTo(x + 3, y - 7); g.stroke();
    if (R() < 0.25) { g.fillStyle = ['#fff', '#ffd23f', '#ff8ac0'][i % 3]; g.beginPath(); g.arc(x, y - 9, 3, 0, 7); g.fill(); }
  }
  // garden bed
  const pts = patchPoints();
  g.save(); g.shadowColor = 'rgba(30,60,10,0.35)'; g.shadowOffsetY = 6;
  smoothPoly(g, pts); g.fillStyle = '#5a2e1a'; g.fill(); g.restore();
  smoothPoly(g, pts); g.lineWidth = 8; g.strokeStyle = '#5a2e1a'; g.stroke();
  g.fillStyle = lin(g, 0, 280, 0, 620, ['#b8743e', '#8a4e2a']); g.fill();
  g.save(); smoothPoly(g, pts); g.clip();
  g.strokeStyle = 'rgba(255,220,170,0.35)'; g.lineWidth = 4; smoothPoly(g, pts.map(([x, y]) => [x, y + 5])); g.stroke();
  g.fillStyle = 'rgba(90,46,26,0.35)'; for (let i = 0; i < 120; i++) { g.beginPath(); g.ellipse(R() * W, 280 + R() * 340, 3 + R() * 4, 1.6, 0, 0, 7); g.fill(); }
  g.restore();
  // stalls
  STALLS.forEach((s) => stall(g, s));
  // plants + farmer, sorted by depth
  const list = [...PLANTS.map((p) => ({ y: p.y, d: () => PLANT[p.t](g, p.x, p.y) })), { y: FARMER.y, d: () => farmer(g, FARMER.x, FARMER.y) }].sort((a, b) => a.y - b.y);
  list.forEach((o) => o.d());
  // ripe sparkles
  for (const [x, y] of [[80, 300], [190, 400], [304, 520]]) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 2, y - 2); g.lineTo(x + 8, y); g.lineTo(x + 2, y + 2); g.lineTo(x, y + 8); g.lineTo(x - 2, y + 2); g.lineTo(x - 8, y); g.lineTo(x - 2, y - 2); g.fill(); }
  ghost(g, GHOST.x, GHOST.y);
  hud(g);
}
