// Style: HD-2D. Outline-free pixel art with hue-shifted ramps, lit cinematically: god rays, bloom, tilt-shift, glass UI.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, patchPoints, makeCanvas, seeded, fontsReady } from './common.js';
import { canvas, painter } from './pixel-util.js';

const F = '"Pixelify Sans", ui-monospace, monospace';
const K = 2, w = W / K, h = H / K; // the pixel layer is half resolution
const RAMP = {
  leaf: ['#1e4a52', '#2f7a4e', '#58a94a', '#a6d85a'], leafD: ['#173a4a', '#24604e', '#3f8a54', '#78bc66'],
  red: ['#5a1a3e', '#b82a3a', '#ee5a40', '#ffb070'], orange: ['#6a2a32', '#d0602a', '#f59a30', '#ffd27a'],
  yellow: ['#7a4a2a', '#e0a830', '#ffd84a', '#fff7c0'], blue: ['#24205a', '#3f4ab0', '#6a8ae8', '#c0d6ff'],
  melon: ['#173a3a', '#2f7a44', '#6ab84e', '#c4ec8a'], skin: ['#7a3a3a', '#d98a6a', '#f6c49a', '#ffe6c8'],
};
const SOIL = ['#2e1a26', '#4e2c2a', '#6e4232', '#8e5e40', '#b07c52'];
const WOOD = ['#30202e', '#5a3830', '#8a5c40', '#b8865a', '#e0b07a'];
const GRASS = ['#244a48', '#336e4a', '#4e9450', '#76b856', '#b0dc72'];

export async function render(host) {
  await fontsReady([`700 16px ${F}`]);
  const R = seeded(31);
  const px = canvas(w, h), P = painter(px), g0 = px.g;
  const hsh = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  // backdrop hills (atmospheric, behind the plaza)
  for (let x = 0; x < w; x++) {
    const a = 96 - Math.sin(x * 0.05 + 1) * 6 - Math.sin(x * 0.13) * 2;
    P.rect(x, a, 1, 110 - a, '#7ab8a0'); P.dot(x, a, '#a8d8b8');
    const b = 102 - Math.sin(x * 0.07 + 3) * 4;
    P.rect(x, b, 1, 110 - b, '#5a9a7a');
  }
  for (let x = 4; x < w; x += 15) { const y = 98 + (x % 3); P.rect(x - 1, y, 2, 6, WOOD[1]); P.ball(x, y - 3, 6, 6, RAMP.leafD); }
  // grass field
  for (let y = 100; y < h; y++) for (let x = 0; x < w; x++) { const n = hsh(x, y); P.dot(x, y, n < 0.08 ? GRASS[1] : n < 0.16 ? GRASS[3] : GRASS[2]); }
  for (let i = 0; i < 260; i++) { const x = Math.floor(R() * w), y = 126 + Math.floor(R() * 210); if (Math.hypot((x * 2 - 180) / 172, (y * 2 - 452) / 180) < 1) continue; P.dot(x, y, GRASS[4]); P.dot(x - 1, y + 1, GRASS[3]); P.dot(x + 1, y + 1, GRASS[3]); if (R() < 0.1) { P.dot(x, y - 1, ['#fff6e0', '#ffd84a', '#ff9ac0'][i % 3]); } }
  // plaza
  for (let y = 102; y < 123; y++) for (let x = 0; x < w; x++) { const n = hsh(x + 7, y); P.dot(x, y, n < 0.1 ? '#b8946a' : n < 0.2 ? '#e8cca0' : '#d4b486'); }
  for (let y = 104; y < 121; y += 4) for (let x = (y * 3) % 6; x < w; x += 7) { P.rect(x, y, 4, 2, '#e8d4ae'); P.rect(x, y + 2, 4, 1, '#a8845e'); }
  P.rect(0, 102, w, 1, '#8a6a4e'); P.rect(0, 123, w, 1, GRASS[1]);
  // soil bed: textured, with a dark lip and a lit inner rim
  const pts = patchPoints(120).map(([x, y]) => [x / K, y / K]);
  const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  for (let y = 130; y < 320; y++) for (let x = 0; x < w; x++) {
    if (!inside(x + 0.5, y + 0.5)) { if (inside(x + 0.5, y - 1.5)) P.dot(x, y, SOIL[0]); continue; }
    const top = !inside(x + 0.5, y - 1.5), n = hsh(x * 3, y * 5);
    P.dot(x, y, top ? SOIL[4] : !inside(x + 0.5, y - 3.5) ? SOIL[3] : n < 0.12 ? SOIL[1] : n < 0.2 ? SOIL[3] : SOIL[2]);
  }
  // shadows painted onto the ground under everything
  const shade = (x, y, rx, ry = rx * 0.35) => { for (let yy = -ry; yy <= ry; yy++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (yy / ry) ** 2 <= 1) { const ix = Math.round(x + xx + 2), iy = Math.round(y + yy + 1); const d = g0.getImageData(ix, iy, 1, 1).data; P.dot(ix, iy, `rgb(${d[0] * 0.62 | 0},${d[1] * 0.6 | 0},${d[2] * 0.72 | 0})`); } };
  const PL = {
    tree(x, y) { shade(x, y, 18, 5); P.rect(x - 2, y - 26, 4, 26, WOOD[2]); P.rect(x - 2, y - 26, 1, 26, WOOD[3]); P.rect(x + 1, y - 26, 1, 26, WOOD[1]); for (const [dx, dy, r] of [[0, -40, 15], [-12, -33, 10], [12, -32, 10], [-6, -48, 9], [7, -49, 9]]) P.ball(x + dx, y + dy, r, r * 0.9, RAMP.leaf); for (const [dx, dy] of [[-11, -30], [7, -36], [-2, -46], [13, -27], [-14, -40]]) P.ball(x + dx, y + dy, 2.6, 2.6, RAMP.red); },
    corn(x, y) { shade(x, y, 10, 3); for (const [dx, hh] of [[-4, 52], [4, 46]]) { P.rect(x + dx, y - hh, 1, hh, '#7ab040'); P.rect(x + dx + 1, y - hh, 1, hh, '#4f8a34'); for (let k = 0; k < 4; k++) { const d = k % 2 ? 1 : -1; for (let j = 1; j < 9 - k; j++) P.dot(x + dx + d * j, y - 10 - k * 9 - (j < 4 ? j : 8 - j) / 2, j < 4 ? '#86c040' : '#5c9a34'); } P.dot(x + dx, y - hh - 1, '#e8c060'); P.dot(x + dx - 1, y - hh - 2, '#e8c060'); P.dot(x + dx + 1, y - hh - 2, '#e8c060'); } for (const [dx, dy] of [[-8, -28], [9, -22]]) P.ball(x + dx, y + dy, 2.6, 6, RAMP.yellow); },
    tulip(x, y) { shade(x, y, 5, 2); P.rect(x, y - 16, 1, 16, '#3f8a44'); P.ball(x - 2, y - 4, 1.6, 4, RAMP.leaf); P.ball(x, y - 19, 3.4, 3.6, RAMP.orange); P.dot(x - 2, y - 23, '#f59a30'); P.dot(x + 2, y - 23, '#f59a30'); },
    strawberry(x, y) { shade(x, y, 14, 4); for (const [dx, dy, r] of [[-6, -7, 7], [6, -7, 7], [0, -12, 8], [0, -5, 6]]) P.ball(x + dx, y + dy, r, r * 0.85, RAMP.leaf); for (const [dx, dy] of [[-8, -3], [1, -1], [9, -4]]) { P.ball(x + dx, y + dy, 3, 3.6, RAMP.red); P.dot(x + dx - 1, y + dy - 1, '#ffd6a0'); } for (const [dx, dy] of [[-4, -15], [5, -14]]) { P.dot(x + dx, y + dy, '#fff6e8'); P.dot(x + dx + 1, y + dy, '#ffd84a'); } },
    tomato(x, y) { shade(x, y, 11, 3); P.rect(x, y - 30, 1, 30, WOOD[3]); P.rect(x + 1, y - 30, 1, 30, WOOD[1]); for (let k = 0; k < 4; k++) P.ball(x + (k % 2 ? 5 : -4), y - 6 - k * 6, 5, 4.5, RAMP.leaf); for (const [dx, dy] of [[-7, -9], [7, -16], [-6, -22]]) P.ball(x + dx, y + dy, 3.6, 3.4, RAMP.red); },
    carrot(x, y) { shade(x, y, 5, 2); P.ball(x, y - 1, 3.6, 2.6, RAMP.orange); for (const a of [-2, 0, 2]) { P.line(x, y - 2, x + a, y - 9, '#4f9a40'); P.dot(x + a, y - 10, '#a6d85a'); } },
    pumpkin(x, y) { shade(x, y, 15, 4); P.ball(x - 10, y - 2, 6, 2.5, RAMP.leafD); P.ball(x + 10, y - 2, 5, 2.4, RAMP.leafD); for (const dx of [-6, 6, 0]) P.ball(x + dx, y - 7, dx ? 6.5 : 7, 7.5, RAMP.orange); P.rect(x, y - 16, 2, 3, '#6a7a3a'); },
    blueberry(x, y) { shade(x, y, 14, 4); for (const [dx, dy, r] of [[-6, -9, 7], [6, -9, 7], [0, -16, 7.5], [0, -7, 7]]) P.ball(x + dx, y + dy, r, r * 0.9, RAMP.leafD); for (const [dx, dy] of [[-7, -7], [-4, -4], [5, -12], [8, -9], [1, -4], [-1, -15], [4, -18]]) P.ball(x + dx, y + dy, 1.8, 1.8, RAMP.blue); },
    watermelon(x, y) { shade(x, y, 14, 4); P.ball(x - 9, y - 2, 6, 2.5, RAMP.leaf); P.ball(x + 9, y - 2, 6, 2.5, RAMP.leaf); P.ball(x, y - 6, 12, 8, RAMP.melon); for (let yy = -13; yy < 1; yy++) for (const sx of [-7, -2, 3, 8]) { const xx = x + sx + Math.round(Math.sin(yy * 0.25) * 0.8); const d = g0.getImageData(xx, y + yy, 1, 1).data; if (d[3]) P.dot(xx, y + yy, '#1f5a34'); } },
  };
  function stall(s) {
    const x = s.x / K, y = s.y / K, col = s.kind === 'seeds' ? ['#2f8a4a', '#4cb860', '#8fe08a'] : ['#c06a1a', '#f0a030', '#ffd27a'];
    shade(x, y - 1, 30, 4);
    P.rect(x - 26, y - 32, 52, 22, WOOD[1]); for (let i = x - 24; i < x + 26; i += 5) P.rect(i, y - 32, 1, 22, WOOD[0]);
    P.ball(x, y - 25, 6, 6, RAMP.skin); P.dot(x - 2, y - 25, '#2a1a20'); P.dot(x + 2, y - 25, '#2a1a20');
    if (s.kind === 'seeds') { P.rect(x - 6, y - 32, 12, 3, '#3f9a50'); P.rect(x - 7, y - 30, 15, 1, '#2f7a40'); } else { P.rect(x - 5, y - 32, 10, 3, '#6a3a24'); P.rect(x - 4, y - 26, 3, 1, '#c8d0e0'); P.rect(x + 1, y - 26, 3, 1, '#c8d0e0'); }
    P.rect(x - 28, y - 15, 56, 3, WOOD[4]); P.rect(x - 28, y - 12, 56, 12, WOOD[3]); for (let i = x - 27; i < x + 28; i += 6) P.rect(i, y - 12, 1, 12, WOOD[2]); P.rect(x - 28, y - 1, 56, 1, WOOD[1]);
    P.rect(x - 7, y - 11, 14, 8, col[1]); P.rect(x - 7, y - 11, 14, 1, col[2]);
    for (let i = 0; i < 4; i++) P.ball(x - 20 + i * 4, y - 17, 1.6, 1.8, s.kind === 'seeds' ? [RAMP.orange, RAMP.red, RAMP.leaf, RAMP.yellow][i] : RAMP.yellow);
    for (const dx of [-27, 26]) { P.rect(x + dx, y - 50, 2, 50, WOOD[2]); P.rect(x + dx, y - 50, 1, 50, WOOD[3]); }
    for (let i = -30; i < 30; i++) { const st = Math.floor((i + 30) / 5) % 2 === 0, c = st ? col[1] : '#fff0dc'; P.rect(x + i, y - 50, 1, 9, c); P.dot(x + i, y - 50, st ? col[2] : '#ffffff'); P.rect(x + i, y - 44, 1, 3, st ? col[0] : '#d8c8b8'); if ((i + 30) % 5 > 0 && (i + 30) % 5 < 4) P.dot(x + i, y - 41, st ? col[0] : '#d8c8b8'); }
    P.rect(x + 25, y - 40, 4, 5, '#ffe28a'); P.dot(x + 26, y - 39, '#ffffff');
  }
  function farmer(x, y) {
    shade(x, y, 6, 2);
    P.rect(x - 3, y - 4, 2, 4, '#3a5aa8'); P.rect(x + 1, y - 4, 2, 4, '#2f4a90');
    P.rect(x - 4, y - 10, 8, 6, '#e05a4a'); P.rect(x - 3, y - 9, 6, 6, '#4f7fd6'); P.dot(x - 2, y - 9, '#ffd84a'); P.dot(x + 1, y - 9, '#ffd84a');
    P.rect(x - 3, y - 16, 6, 6, '#f6c49a'); P.rect(x - 3, y - 11, 6, 1, '#d98a6a'); P.dot(x - 2, y - 14, '#2a1a20'); P.dot(x + 1, y - 14, '#2a1a20'); P.dot(x - 3, y - 13, '#f59a8a'); P.dot(x + 2, y - 13, '#f59a8a');
    P.rect(x - 6, y - 17, 12, 1, '#e8c35e'); P.rect(x - 3, y - 20, 6, 3, '#f2d27a'); P.rect(x - 3, y - 18, 6, 1, '#c8423a'); P.rect(x - 5, y - 16, 10, 1, '#c89a40');
  }
  STALLS.forEach(stall);
  const list = [...PLANTS.map((p) => ({ y: p.y, d: () => PL[p.t](Math.round(p.x / K), Math.round(p.y / K)) })), { y: FARMER.y, d: () => farmer(Math.round(FARMER.x / K), Math.round(FARMER.y / K)) }].sort((a, b) => a.y - b.y);
  list.forEach((o) => o.d());
  // ghost
  for (let a = 0; a < 20; a++) if (a % 2 === 0) { const t = (a / 20) * Math.PI * 2; P.dot(Math.round(GHOST.x / K + Math.cos(t) * 9), Math.round(GHOST.y / K + Math.sin(t) * 4), '#ffffff'); }

  // ---- compose at full resolution with lighting
  const { g } = makeCanvas(host);
  const sky = g.createLinearGradient(0, 0, 0, 230); sky.addColorStop(0, '#3a7ad8'); sky.addColorStop(0.6, '#7ab8f0'); sky.addColorStop(1, '#ffd8a8');
  g.fillStyle = sky; g.fillRect(0, 0, W, 240);
  const sunG = g.createRadialGradient(70, 120, 0, 70, 120, 120); sunG.addColorStop(0, 'rgba(255,240,200,1)'); sunG.addColorStop(0.12, 'rgba(255,230,170,0.9)'); sunG.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = sunG; g.fillRect(0, 0, W, 260);
  for (const [cx, cy, s] of [[230, 70, 1], [320, 120, 0.7], [140, 40, 0.6]]) { g.fillStyle = 'rgba(255,255,255,0.75)'; for (const [dx, dy, r] of [[0, 0, 14], [14, -6, 18], [30, 0, 13]]) { g.beginPath(); g.ellipse(cx + dx * s, cy + dy * s, r * s * 1.3, r * s * 0.8, 0, 0, 7); g.fill(); } }
  g.imageSmoothingEnabled = false;
  g.drawImage(px, 0, 0, W, H);
  // warm key light from the sun, cool shadows
  g.save(); g.globalCompositeOperation = 'soft-light';
  const key = g.createLinearGradient(0, 0, W, H); key.addColorStop(0, 'rgba(255,200,120,0.85)'); key.addColorStop(1, 'rgba(60,70,160,0.7)');
  g.fillStyle = key; g.fillRect(0, 0, W, H); g.restore();
  // god rays
  g.save(); g.globalCompositeOperation = 'screen';
  for (const [x0, wd, a] of [[30, 40, 0.16], [100, 26, 0.12], [150, 60, 0.1], [230, 30, 0.08]]) {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(255,230,170,${a})`); gr.addColorStop(1, 'rgba(255,230,170,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + wd, 0); g.lineTo(x0 + wd + 260, H); g.lineTo(x0 + 220, H); g.fill();
  }
  g.restore();
  // bloom
  const src = canvas(W * 2, H * 2); src.g.drawImage(g.canvas, 0, 0);
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35; g.filter = 'blur(7px) brightness(1.1) contrast(1.4)'; g.drawImage(src, 0, 0, W, H); g.restore();
  // tilt-shift: blur the far plaza strip and the bottom edge
  const blur = canvas(W * 2, H * 2); blur.g.filter = 'blur(5px)'; blur.g.drawImage(g.canvas, 0, 0);
  const mask = blur.g; mask.filter = 'none'; mask.globalCompositeOperation = 'destination-in';
  const mg = mask.createLinearGradient(0, 0, 0, H * 2); mg.addColorStop(0, 'rgba(0,0,0,0.9)'); mg.addColorStop(0.2, 'rgba(0,0,0,0.45)'); mg.addColorStop(0.33, 'rgba(0,0,0,0)'); mg.addColorStop(0.78, 'rgba(0,0,0,0)'); mg.addColorStop(1, 'rgba(0,0,0,0.9)');
  mask.fillStyle = mg; mask.fillRect(0, 0, W * 2, H * 2);
  g.drawImage(blur, 0, 0, W, H);
  // motes in the light
  for (let i = 0; i < 40; i++) { const x = 20 + R() * 260, y = R() * 600, r = 0.8 + R() * 1.8; const mg2 = g.createRadialGradient(x, y, 0, x, y, r * 3); mg2.addColorStop(0, 'rgba(255,245,210,0.9)'); mg2.addColorStop(1, 'rgba(255,245,210,0)'); g.fillStyle = mg2; g.beginPath(); g.arc(x, y, r * 3, 0, 7); g.fill(); }
  // lantern glow
  for (const s of STALLS) { const lx = s.x + 54, ly = s.y - 75; const lg = g.createRadialGradient(lx, ly, 0, lx, ly, 34); lg.addColorStop(0, 'rgba(255,210,120,0.55)'); lg.addColorStop(1, 'rgba(255,210,120,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = lg; g.fillRect(lx - 34, ly - 34, 68, 68); g.restore(); }
  // vignette
  const vg = g.createRadialGradient(W / 2, H * 0.48, H * 0.3, W / 2, H * 0.5, H * 0.78); vg.addColorStop(0, 'rgba(10,10,40,0)'); vg.addColorStop(1, 'rgba(10,10,40,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  ui(g);
}

function glass(g, x, y, ww, hh, r = 12) {
  g.save();
  g.fillStyle = 'rgba(16,20,44,0.58)'; g.beginPath(); g.roundRect(x, y, ww, hh, r); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 1; g.stroke();
  const sh = g.createLinearGradient(0, y, 0, y + hh); sh.addColorStop(0, 'rgba(255,255,255,0.14)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fill(); g.restore();
}
function pixIcon(g, t, x, y) {
  const c = canvas(14, 14), P = painter(c);
  if (t === 'carrot') { P.ball(7, 8, 3, 5.5, RAMP.orange); P.line(7, 3, 5, 0, '#4f9a40'); P.line(7, 3, 9, 0, '#76b856'); }
  if (t === 'strawberry') { P.ball(7, 8, 4.5, 5, RAMP.red); P.rect(4, 3, 6, 1, '#4f9a40'); }
  if (t === 'tomato') { P.ball(7, 8, 5.5, 5, RAMP.red); P.rect(6, 2, 3, 2, '#4f9a40'); }
  if (t === 'corn') { P.ball(7, 6, 3, 6, RAMP.yellow); P.line(4, 13, 6, 9, '#4f9a40'); P.line(10, 13, 8, 9, '#76b856'); }
  if (t === 'apple') { P.ball(7, 8, 5.5, 5.2, RAMP.red); P.rect(7, 1, 1, 3, '#5a3830'); P.rect(8, 1, 2, 1, '#76b856'); }
  g.imageSmoothingEnabled = false; g.drawImage(c, x - 14, y - 14, 28, 28);
}
function ui(g) {
  g.textBaseline = 'middle';
  glass(g, 14, 48, 128, 34, 17);
  const cg = g.createRadialGradient(31, 62, 1, 33, 65, 11); cg.addColorStop(0, '#fff6b0'); cg.addColorStop(1, '#e0a020');
  g.fillStyle = cg; g.beginPath(); g.arc(33, 65, 10, 0, 7); g.fill();
  g.font = `700 20px ${F}`; g.fillStyle = '#fff4d8'; g.fillText(MONEY, 50, 66);
  glass(g, 248, 48, 98, 34, 17);
  g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(267, 65, 8, 0, 7); g.fill();
  g.font = `500 17px ${F}`; g.fillStyle = '#fff4d8'; g.fillText('Sunny', 282, 66);
  // ghost hint
  g.save(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.setLineDash([2, 6]); g.lineWidth = 2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(SLOT(0).x + 25, SLOT(0).y - 6); g.quadraticCurveTo(GHOST.x - 30, GHOST.y + 40, GHOST.x - 4, GHOST.y + 12); g.stroke(); g.restore();
  glass(g, GHOST.x - 42, GHOST.y - 52, 84, 24, 12); g.font = `500 14px ${F}`; g.textAlign = 'center'; g.fillStyle = '#fff4d8'; g.fillText('Plant here', GHOST.x, GHOST.y - 40);
  glass(g, 12, 652, 336, 76, 22);
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    g.fillStyle = sel ? 'rgba(255,214,110,0.3)' : 'rgba(255,255,255,0.08)'; g.beginPath(); g.roundRect(s.x, s.y, s.w, s.h, 12); g.fill();
    g.strokeStyle = sel ? 'rgba(255,220,130,0.95)' : 'rgba(255,255,255,0.18)'; g.lineWidth = sel ? 2 : 1; g.stroke();
    pixIcon(g, t, s.x + 25, s.y + 23);
    g.font = `700 13px ${F}`; g.fillStyle = '#fff4d8'; g.textAlign = 'right'; g.fillText(String([8, 3, 2, 1, 1][i]), s.x + s.w - 6, s.y + s.h - 9);
  });
  const hb = HARVEST;
  const hg = g.createRadialGradient(hb.x - 8, hb.y - 10, 2, hb.x, hb.y, hb.r); hg.addColorStop(0, '#9ff07a'); hg.addColorStop(1, '#2f9a4a');
  g.save(); g.shadowColor = 'rgba(120,255,140,0.6)'; g.shadowBlur = 18; g.fillStyle = hg; g.beginPath(); g.arc(hb.x, hb.y, hb.r, 0, 7); g.fill(); g.restore();
  pixIcon(g, 'tomato', hb.x, hb.y);
  g.fillStyle = '#ff5a6a'; g.beginPath(); g.arc(hb.x + 20, hb.y - 20, 10, 0, 7); g.fill();
  g.font = `700 13px ${F}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('9', hb.x + 20, hb.y - 19);
  // stall signs as floating labels
  for (const s of STALLS) { glass(g, s.x - 32, s.y - 128, 64, 24, 12); g.font = `700 15px ${F}`; g.fillStyle = '#fff4d8'; g.fillText(s.label.toUpperCase(), s.x, s.y - 116); }
}
