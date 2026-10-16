// Style: chunky voxel diorama. Every object is built from cubes; orthographic camera, soft sun shadows.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, PATCH, makeCanvas, seeded, fontsReady } from './common.js';

const F = '"Bungee", "Arial Black", system-ui, sans-serif';
const U = 6; // layout px per voxel
const vx = (x) => Math.round((x - 180) / U), vz = (y) => Math.round((y - 440) / U);

export async function render(host) {
  await fontsReady([`20px ${F}`]);
  const T = window.THREE, R = seeded(21);
  const vox = new Map();
  const put = (x, y, z, c) => vox.set(`${x},${y},${z}`, [x, y, z, c]);
  const jit = (c, a = 0.06) => { const col = new T.Color(c); col.offsetHSL(0, 0, (R() - 0.5) * a); return col; };
  const inBed = (x, z) => { const a = Math.atan2((z * U + 440 - PATCH.cy) / PATCH.ry, (x * U + 180 - PATCH.cx) / PATCH.rx); const r = 1 + 0.055 * Math.sin(3 * a + 0.5) + 0.035 * Math.sin(5 * a + 2); return Math.hypot((x * U + 180 - PATCH.cx) / PATCH.rx, (z * U + 440 - PATCH.cy) / PATCH.ry) < r; };
  // terrain
  for (let x = -58; x <= 58; x++) for (let z = -54; z <= 72; z++) {
    const plaza = z >= -40 && z <= -33;
    if (z < -41) { put(x, 0, z, jit('#6fc26a')); continue; }
    if (plaza) { put(x, 0, z, jit((x + z) % 5 === 0 ? '#d8c09a' : '#ead6b0', 0.05)); continue; }
    if (inBed(x, z)) { put(x, 0, z, jit('#8a5a3a')); put(x, 1, z, jit(inBed(x, z - 1) ? '#9c6844' : '#b07a52', 0.08)); continue; }
    put(x, 0, z, jit(R() < 0.06 ? '#5aae58' : '#78cc6c', 0.06));
    if (R() < 0.025) put(x, 1, z, R() < 0.5 ? '#ffffff' : '#ffd84e');
  }
  // backdrop trees
  for (let x = -34; x <= 34; x += 7) {
    const z = -46 + Math.floor(R() * 3), h = 3 + Math.floor(R() * 2);
    for (let y = 1; y <= h; y++) put(x, y, z, '#8a5a3a');
    const r = 3 + R() * 0.8;
    for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) if (dx * dx + dy * dy + dz * dz <= r * r) put(x + dx, h + 3 + dy, z + dz, jit('#5cb860'));
  }
  const TOP = 2;
  const sphere = (cx, cy, cz, r, c, sy = 1, hit) => {
    const ri = Math.ceil(r);
    for (let dx = -ri; dx <= ri; dx++) for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) {
      if (dx * dx + (dy / sy) * (dy / sy) + dz * dz > r * r) continue;
      put(cx + dx, cy + dy, cz + dz, hit ? hit(dx, dy, dz) || jit(c) : jit(c));
    }
  };
  const P = {
    tree(x, z) {
      for (let y = TOP; y < TOP + 8; y++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x + a, y, z + b, jit('#8a5a3a', 0.1));
      sphere(x, TOP + 12, z, 6.2, '#5cc060', 1, (dx, dy, dz) => (dx * dx + dy * dy + dz * dz > 30 && R() < 0.12 ? '#e84a4a' : null));
    },
    corn(x, z) {
      for (const [ox, h] of [[-1, 15], [2, 13]]) {
        for (let y = TOP; y < TOP + h; y++) put(x + ox, y, z, jit('#8ac850'));
        for (let k = 0; k < 4; k++) { const d = k % 2 ? 1 : -1, y = TOP + 3 + k * 3; for (let j = 1; j <= 3; j++) put(x + ox + d * j, y + (j > 2 ? -1 : 0), z, jit('#7abc48')); }
        put(x + ox, TOP + h, z, '#e8c06a'); put(x + ox, TOP + h + 1, z, '#d8a84a');
        for (let y = 0; y < 4; y++) put(x + ox + (ox < 0 ? -1 : 1), TOP + 6 + y, z + 1, y === 0 ? '#7abc48' : jit('#ffd84e'));
      }
    },
    tulip(x, z) { for (let y = TOP; y < TOP + 4; y++) put(x, y, z, '#6ab850'); put(x - 1, TOP, z, '#7cc860'); put(x + 1, TOP + 1, z, '#7cc860'); for (const [a, b, c] of [[0, 4, 0], [-1, 5, 0], [1, 5, 0], [0, 5, -1], [0, 5, 1], [0, 6, 0]]) put(x + a, TOP + b, z + c, jit('#ff8a3a')); },
    strawberry(x, z) { sphere(x, TOP + 1, z, 3.2, '#66c25a', 0.75, (dx, dy, dz) => (dy <= 0 && dx * dx + dz * dz > 6 && R() < 0.4 ? '#f04a5a' : dy >= 2 && R() < 0.15 ? '#ffffff' : null)); },
    tomato(x, z) {
      for (let y = TOP; y < TOP + 10; y++) put(x, y, z, '#b08a5a');
      for (let k = 0; k < 4; k++) sphere(x + (k % 2 ? 1 : -1), TOP + 2 + k * 2, z, 1.7, '#66c25a');
      for (const [a, b] of [[-3, 3], [2, 6], [-2, 8]]) for (const [p, q, r] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) put(x + a + p, TOP + b + q, z + 2 + r, jit('#ff5a42'));
    },
    carrot(x, z) { for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(x + a, TOP, z + b, jit('#ff8a2a')); put(x, TOP + 1, z, '#6ab850'); put(x + 1, TOP + 2, z, '#7cc860'); put(x, TOP + 3, z + 1, '#7cc860'); put(x + 1, TOP + 1, z + 1, '#6ab850'); },
    pumpkin(x, z) {
      for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy < 5; dy++) for (let dz = -2; dz <= 2; dz++) { if ((Math.abs(dx) === 3 || Math.abs(dz) === 2) && (dy === 0 || dy === 4)) continue; put(x + dx, TOP + dy, z + dz, dx % 2 === 0 ? jit('#ffa03a') : jit('#f08a2a')); }
      put(x, TOP + 5, z, '#6a8a3a'); put(x, TOP + 6, z, '#6a8a3a');
      for (const [a, b] of [[-5, -2], [-5, -1], [-4, -2], [5, -1], [4, -2]]) put(x + a, TOP, z + b, jit('#66c25a'));
    },
    blueberry(x, z) { sphere(x, TOP + 2, z, 3.6, '#4aa88a', 0.85, (dx, dy, dz) => (R() < 0.18 ? '#5a6ae8' : null)); },
    watermelon(x, z) {
      for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy < 4; dy++) for (let dz = -2; dz <= 2; dz++) { if ((Math.abs(dx) === 4 && (dy === 0 || dy === 3)) || (Math.abs(dz) === 2 && (dy === 0 || dy === 3))) continue; put(x + dx, TOP + dy, z + dz, (dx + 10) % 3 === 0 ? '#3f8a44' : jit('#7cd068')); }
      for (const [a, b] of [[-6, -1], [-6, 0], [6, 0], [5, -1]]) put(x + a, TOP, z + b, '#66c25a');
    },
  };
  for (const p of PLANTS) P[p.t](vx(p.x), vz(p.y));
  // stalls
  for (const s of STALLS) {
    const x = vx(s.x), z = vz(s.y) - 4, col = s.kind === 'seeds' ? '#4cc06a' : '#ffaa30';
    for (let dx = -8; dx <= 8; dx++) for (let dy = 1; dy <= 4; dy++) for (let dz = 0; dz <= 2; dz++) put(x + dx, dy, z + dz, dy === 4 ? jit('#d8a070') : jit('#b07a50'));
    for (const dx of [-8, 8]) for (let dy = 5; dy <= 12; dy++) put(x + dx, dy, z, '#8a5a3a');
    for (let dx = -9; dx <= 9; dx++) for (let k = 0; k < 4; k++) put(x + dx, 13 - k, z + 1 + k, Math.floor((dx + 9) / 3) % 2 ? '#fff6e6' : col);
    for (let dy = 5; dy <= 7; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -2; dz <= 0; dz++) put(x + dx, dy, z + dz - 1, dy === 7 ? (s.kind === 'seeds' ? '#3f9a50' : '#6a4028') : dy === 5 ? (s.kind === 'seeds' ? '#4cc06a' : '#6a8ae8') : '#ffd0a8');
    put(x - 1, 6, z, '#2a2a2a'); put(x + 1, 6, z, '#2a2a2a');
    for (let i = 0; i < 5; i++) put(x - 6 + i * 3, 5, z + 1, s.kind === 'seeds' ? ['#ff8a3a', '#f04a5a', '#7cc860', '#ffd84e', '#5a6ae8'][i] : '#ffd84e');
    for (let dx = -5; dx <= 5; dx++) for (let dy = 14; dy <= 17; dy++) put(x + dx, dy, z, dy === 17 || dy === 14 ? '#8a5a3a' : col);
  }
  // farmer
  {
    const x = vx(FARMER.x), z = vz(FARMER.y), y0 = TOP;
    for (let dy = 0; dy < 2; dy++) for (const dx of [-1, 1]) put(x + dx, y0 + dy, z, '#6a4428');
    for (let dy = 2; dy < 5; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 0; dz++) put(x + dx, y0 + dy, z + dz, '#4a7ae0');
    for (let dy = 5; dy < 8; dy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(x + dx, y0 + dy, z + dz, '#ffcfa0');
    put(x - 1, y0 + 6, z + 2, '#2a2a2a'); put(x + 1, y0 + 6, z + 2, '#2a2a2a');
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (Math.abs(dx) + Math.abs(dz) < 6) put(x + dx, y0 + 8, z + dz, Math.abs(dx) + Math.abs(dz) === 2 && dz >= 0 ? '#ff5a4a' : '#ffd86a');
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(x + dx, y0 + 9, z + dz, '#ffd86a');
  }
  // ghost outline
  const gx = vx(GHOST.x), gz = vz(GHOST.y);
  for (let a = 0; a < 16; a++) if (a % 2 === 0) { const t = (a / 16) * Math.PI * 2; put(gx + Math.round(Math.cos(t) * 3), TOP, gz + Math.round(Math.sin(t) * 3), '#ffffff'); }

  // build instanced mesh
  const list = [...vox.values()];
  const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial(), list.length);
  const m4 = new T.Matrix4(), col = new T.Color();
  list.forEach(([x, y, z, c], i) => {
    m4.makeTranslation(x, y, z); mesh.setMatrixAt(i, m4);
    col.set(c instanceof T.Color ? c : new T.Color(c)); col.convertSRGBToLinear(); mesh.setColorAt(i, col);
  });
  mesh.castShadow = mesh.receiveShadow = true;
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(W, H);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color('#8fd4ff').convertSRGBToLinear();
  scene.add(mesh);
  scene.add(new T.HemisphereLight(new T.Color('#e8f4ff').convertSRGBToLinear(), new T.Color('#6a8a5a').convertSRGBToLinear(), 0.75));
  const sun = new T.DirectionalLight(new T.Color('#fff2dc').convertSRGBToLinear(), 1.05);
  sun.position.set(-30, 60, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.001;
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 200 });
  scene.add(sun);
  const hh = 56, cam = new T.OrthographicCamera(-hh * W / H, hh * W / H, hh, -hh, 1, 400);
  cam.position.set(24, 96, 112); cam.lookAt(0, 0, -2);
  cam.zoom = 1; cam.updateProjectionMatrix();
  renderer.render(scene, cam);
  const proj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

  const { g } = makeCanvas(host);
  // stall labels painted on the sign blocks
  for (const s of STALLS) {
    const [px, py] = proj(vx(s.x), 15.5, vz(s.y) - 3.4);
    g.font = `15px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(s.label.toUpperCase(), px + 1.5, py + 1.5);
    g.fillStyle = '#ffffff'; g.fillText(s.label.toUpperCase(), px, py);
  }
  hud(g, proj(gx, TOP, gz));
}

function block(g, x, y, w, h, face, dark, light) {
  g.fillStyle = dark; g.fillRect(x, y + 4, w, h);
  g.fillStyle = face; g.fillRect(x, y, w, h);
  g.fillStyle = light; g.fillRect(x, y, w, 3); g.fillRect(x, y, 3, h);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + w - 3, y + 3, 3, h - 3); g.fillRect(x + 3, y + h - 3, w - 3, 3);
}
function vicon(g, t, x, y) {
  const p = (cx, cy, c, s = 4) => { g.fillStyle = c; g.fillRect(cx, cy, s, s); };
  const grid = {
    carrot: ['..gg..', '...g..', '.oooo.', '.oOoo.', '..oo..', '..oo..', '...o..'],
    strawberry: ['.gggg.', 'rrrrrr', 'rWrrrR', 'rrrrRR', '.rrRR.', '..RR..'],
    tomato: ['..gg..', '.rrrr.', 'rWrrrR', 'rrrrrR', 'rrrrRR', '.rRRR.'],
    corn: ['..y...', '.yyy..', '.yYy..', '.yyY..', '.yYy..', 'gyyyg.', '.ggg..'],
    apple: ['...gb.', '.rrbr.', 'rWrrrR', 'rrrrrR', 'rrrrRR', '.rRRR.'],
  }[t];
  const pal = { g: '#5cc060', o: '#ff8a2a', O: '#e06a1a', r: '#f04a4a', R: '#b02a3a', W: '#ffd0d0', y: '#ffd84e', Y: '#e0a82a', b: '#8a5a3a' };
  grid.forEach((row, j) => [...row].forEach((ch, i) => { if (pal[ch]) p(x - 12 + i * 4, y - 14 + j * 4, pal[ch]); }));
}
function hud(g, gp) {
  g.textBaseline = 'middle';
  block(g, 14, 46, 132, 34, '#3a3a5a', '#1a1a2e', '#5a5a80');
  g.fillStyle = '#ffd84e'; g.fillRect(24, 54, 18, 18); g.fillStyle = '#e0a82a'; g.fillRect(30, 60, 6, 6); g.fillStyle = '#fff4a0'; g.fillRect(24, 54, 18, 3);
  g.font = `18px ${F}`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(MONEY, 50, 64);
  block(g, 246, 46, 100, 34, '#3a3a5a', '#1a1a2e', '#5a5a80');
  g.fillStyle = '#ffd84e'; g.fillRect(256, 55, 16, 16);
  g.font = `14px ${F}`; g.fillStyle = '#fff'; g.fillText('SUNNY', 278, 64);
  // ghost callout
  g.save(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(SLOT(0).x + 25, SLOT(0).y - 6); g.lineTo(gp[0], gp[1] + 8); g.stroke(); g.restore();
  const lx = Math.max(56, gp[0]); block(g, lx - 46, gp[1] - 46, 92, 24, '#ffffff', '#9a9ab0', '#ffffff');
  g.font = `11px ${F}`; g.fillStyle = '#3a3a5a'; g.textAlign = 'center'; g.fillText('PLANT HERE', lx, gp[1] - 33);
  block(g, 10, 650, 340, 80, '#3a3a5a', '#1a1a2e', '#5a5a80');
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    block(g, s.x, s.y - (sel ? 3 : 0), s.w, s.h - 4, sel ? '#ffd84e' : '#e8e8f4', sel ? '#a8781a' : '#8a8aa8', sel ? '#fff4a0' : '#ffffff');
    vicon(g, t, s.x + 25, s.y + 22 - (sel ? 3 : 0));
    g.font = `11px ${F}`; g.fillStyle = '#3a3a5a'; g.textAlign = 'right'; g.fillText(String([8, 3, 2, 1, 1][i]), s.x + s.w - 5, s.y + s.h - 13 - (sel ? 3 : 0));
  });
  const h = HARVEST;
  block(g, h.x - 26, h.y - 26, 52, 50, '#5cc060', '#2a7a3a', '#8ae08a');
  g.fillStyle = '#b07a50'; g.fillRect(h.x - 13, h.y - 2, 26, 14); g.fillStyle = '#f04a4a'; g.fillRect(h.x - 10, h.y - 9, 9, 9); g.fillStyle = '#ffd84e'; g.fillRect(h.x + 1, h.y - 10, 9, 9);
  g.fillStyle = '#f04a5a'; g.fillRect(h.x + 14, h.y - 34, 18, 18); g.font = `12px ${F}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('9', h.x + 23, h.y - 24);
}
