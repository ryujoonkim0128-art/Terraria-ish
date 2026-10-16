// Style: soft clay diorama. Real 3D (three.js), rounded toy-like shapes, soft shadows, pastel palette.
import { W, H, STALLS, PLANTS, FARMER, GHOST, HOTBAR, MONEY, SLOT, HARVEST, patchPoints, makeCanvas, seeded, fontsReady } from './common.js';

const F = '"Fredoka", "Arial Rounded MT Bold", system-ui, sans-serif';
const S = 20; // layout px per world unit
const wx = (x) => (x - 180) / S, wz = (y) => (y - 440) / S;

export async function render(host, opts = {}) {
  await fontsReady([`600 20px ${F}`]);
  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2); renderer.setSize(W, H);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new T.Scene();
  const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
  const bgg = bg.getContext('2d'), gr = bgg.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8fc8ff'); gr.addColorStop(0.55, '#d8ecff'); gr.addColorStop(1, '#ffe8d6');
  bgg.fillStyle = gr; bgg.fillRect(0, 0, 4, 256);
  const bgt = new T.CanvasTexture(bg); bgt.encoding = T.sRGBEncoding; scene.background = bgt;
  scene.fog = new T.Fog(new T.Color('#dcecff').convertSRGBToLinear(), 70, 130);

  const cam = new T.PerspectiveCamera(32, W / H, 1, 200);
  cam.position.set(0, 50, 33); cam.lookAt(0, 0, -1.2);
  scene.add(new T.HemisphereLight(new T.Color('#fff6ea').convertSRGBToLinear(), new T.Color('#7a9870').convertSRGBToLinear(), 0.9));
  const sun = new T.DirectionalLight(new T.Color('#fff0dc').convertSRGBToLinear(), 1.6);
  sun.position.set(-14, 26, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6; sun.shadow.bias = -0.0008;
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  scene.add(sun);

  const mats = new Map();
  const M = (c, r = 0.82) => { const k = c + r; if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ color: new T.Color(c).convertSRGBToLinear(), roughness: r, metalness: 0 })); return mats.get(k); };
  const add = (geo, color, x, y, z, o = {}) => {
    const m = new T.Mesh(geo, typeof color === 'string' ? M(color, o.rough) : color);
    m.position.set(x, y, z);
    if (o.s) m.scale.set(...o.s);
    if (o.r) m.rotation.set(...o.r);
    m.castShadow = o.cast !== false; m.receiveShadow = true;
    (o.parent || scene).add(m);
    return m;
  };
  const SPH = new T.SphereGeometry(1, 32, 24), CYL = new T.CylinderGeometry(1, 1, 1, 24);
  const ball = (c, x, y, z, r, s = [1, 1, 1], o = {}) => add(SPH, c, x, y, z, { ...o, s: [r * s[0], r * s[1], r * s[2]] });
  const rod = (c, x, y, z, r, h, o = {}) => add(CYL, c, x, y + h / 2, z, { ...o, s: [r, h, r] });
  function rbox(w, h, d, r) {
    const s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, ww = w - 2 * r, hh = h - 2 * r;
    s.moveTo(x, y); s.lineTo(x + ww, y); s.lineTo(x + ww, y + hh); s.lineTo(x, y + hh); s.lineTo(x, y);
    const g = new T.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 5, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }

  // ground
  const ground = add(new T.PlaneGeometry(200, 200), '#a6d98c', 0, 0, 0, { r: [-Math.PI / 2, 0, 0], cast: false });
  ground.receiveShadow = true;
  add(rbox(40, 2.4, 0.4, 0.2), '#f3dfbf', 0, 0.05, -10.5, { r: [-Math.PI / 2, 0, 0] });
  // hills + trees behind
  for (const [x, z, r, c] of [[-14, -26, 9, '#b8e2a0'], [4, -30, 12, '#c4e8ac'], [20, -25, 9, '#b0dc98']]) ball(c, x, -2, z, r, [1.4, 0.7, 1]);
  const R = seeded(9);
  for (let x = -17; x <= 17; x += 3.4) {
    const z = -15.5 - R() * 1.5, h = 1.2 + R() * 0.8;
    rod('#b48862', x, 0, z, 0.25, h);
    ball(R() < 0.5 ? '#7ccc7a' : '#8fd68a', x, h + 1.1, z, 1.35 + R() * 0.3);
  }
  // garden bed (extruded organic shape)
  const pts = patchPoints(80);
  const shape = new T.Shape(pts.map(([x, y]) => new T.Vector2(wx(x), -wz(y))));
  const bedG = new T.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.45, bevelSegments: 6, curveSegments: 12 });
  bedG.rotateX(-Math.PI / 2);
  add(bedG, '#b47e5a', 0, 0, 0, { cast: false });
  const top = 0.6;
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * 0.9;
    ball(R() < 0.5 ? '#a06c4a' : '#c08e68', Math.cos(a) * 7.6 * d, top, Math.sin(a) * 7.9 * d + 0.6, 0.12 + R() * 0.12, [1, 0.5, 1]);
  }

  // plants
  const LEAF = '#7cc96a', LEAF2 = '#68b85c';
  const P = {
    tree(x, z) {
      rod('#b48862', x, top, z, 0.42, 3.4, { rough: 0.9 });
      for (const [dx, dy, dz, r] of [[0, 5, 0, 2.1], [-1.5, 4.2, 0.6, 1.5], [1.5, 4.3, 0.4, 1.5], [0.2, 6.1, -0.4, 1.4], [-0.8, 5.6, 1.1, 1.2]]) ball(R() < 0.5 ? LEAF : LEAF2, x + dx, top + dy, z + dz, r);
      for (const [dx, dy, dz] of [[-1.6, 4, 1.6], [1.3, 4.6, 1.6], [0, 5.4, 1.9], [2.2, 3.7, 0.6], [-2.3, 4.6, 0.3]]) ball('#ef6a6a', x + dx, top + dy, z + dz, 0.36);
    },
    corn(x, z) {
      for (const [dx, h] of [[-0.45, 5.4], [0.5, 4.8]]) {
        rod('#9ccc66', x + dx, top, z, 0.16, h);
        for (let k = 0; k < 4; k++) ball('#8cc45e', x + dx + (k % 2 ? 0.7 : -0.7), top + 1.2 + k * 1, z, 0.75, [1, 0.12, 0.32], { r: [0, 0, k % 2 ? -0.6 : 0.6] });
        ball('#e8c06a', x + dx, top + h + 0.2, z, 0.25, [0.6, 1.4, 0.6]);
      }
      ball('#ffd85e', x - 0.95, top + 2.8, z + 0.3, 0.32, [1, 2, 1], { r: [0, 0, 0.3] });
      ball('#ffd85e', x + 1.0, top + 2.4, z + 0.3, 0.32, [1, 2, 1], { r: [0, 0, -0.3] });
    },
    tulip(x, z) {
      rod('#78b858', x, top, z, 0.08, 1.6);
      ball(LEAF, x - 0.25, top + 0.5, z, 0.5, [0.35, 1.1, 0.2], { r: [0, 0, 0.4] });
      ball('#ff9a5a', x, top + 1.8, z, 0.38, [1, 1.25, 1]);
    },
    strawberry(x, z) {
      for (const [dx, dz, r] of [[-0.6, 0, 0.75], [0.6, 0.1, 0.75], [0, -0.3, 0.85], [0, 0.4, 0.7]]) ball(LEAF, x + dx, top + 0.5, z + dz, r, [1, 0.75, 1]);
      for (const [dx, dz] of [[-0.9, 0.6], [0.2, 0.95], [1, 0.5]]) ball('#f2556a', x + dx, top + 0.3, z + dz, 0.3, [1, 1.2, 1]);
      for (const [dx, dz] of [[-0.3, -0.2], [0.5, -0.1]]) ball('#ffffff', x + dx, top + 1.1, z + dz, 0.16);
    },
    tomato(x, z) {
      rod('#c49a6c', x, top, z, 0.1, 3.2);
      for (let k = 0; k < 4; k++) ball(LEAF, x + (k % 2 ? 0.5 : -0.5), top + 0.6 + k * 0.7, z, 0.62);
      for (const [dx, dy] of [[-0.85, 0.9], [0.8, 1.7], [-0.7, 2.4]]) ball('#ff6a52', x + dx, top + dy, z + 0.5, 0.36);
    },
    carrot(x, z) {
      ball('#ff9a42', x, top + 0.05, z, 0.32, [1, 0.6, 1]);
      for (const a of [-0.5, 0, 0.5]) ball('#7cc96a', x + a * 0.5, top + 0.65, z, 0.4, [0.25, 1, 0.12], { r: [0, 0, a] });
    },
    pumpkin(x, z) {
      ball(LEAF, x - 1.2, top + 0.15, z - 0.4, 0.8, [1, 0.25, 0.9]); ball(LEAF, x + 1.2, top + 0.15, z - 0.3, 0.7, [1, 0.25, 0.9]);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ball('#ffa244', x + Math.cos(a) * 0.45, top + 0.75, z + Math.sin(a) * 0.45, 0.62, [0.75, 0.85, 0.75]); }
      ball('#ffaa4e', x, top + 0.8, z, 0.7, [1, 0.85, 1]);
      rod('#8a9a4a', x, top + 1.45, z, 0.1, 0.4);
    },
    blueberry(x, z) {
      for (const [dx, dz, r] of [[-0.6, 0, 0.85], [0.6, 0.1, 0.85], [0, -0.3, 0.95], [0, 0.35, 0.8]]) ball('#5cb88a', x + dx, top + 0.85, z + dz, r);
      for (let k = 0; k < 9; k++) { const a = R() * 6.28; ball('#6a7ef0', x + Math.cos(a) * 0.95, top + 0.6 + R() * 0.9, z + Math.abs(Math.sin(a)) * 0.9, 0.17); }
    },
    watermelon(x, z) {
      ball(LEAF, x - 1.2, top + 0.12, z - 0.2, 0.7, [1, 0.22, 0.8]); ball(LEAF, x + 1.25, top + 0.12, z - 0.1, 0.6, [1, 0.22, 0.8]);
      const c = document.createElement('canvas'); c.width = 128; c.height = 8;
      const g = c.getContext('2d'); g.fillStyle = '#8fd66e'; g.fillRect(0, 0, 128, 8); g.fillStyle = '#4f9a50';
      for (let i = 0; i < 128; i += 16) g.fillRect(i, 0, 7, 8);
      const tx = new T.CanvasTexture(c); tx.encoding = T.sRGBEncoding;
      ball(new T.MeshStandardMaterial({ map: tx, roughness: 0.6 }), x, top + 0.55, z, 0.9, [1.35, 0.75, 0.95]);
    },
  };
  for (const p of PLANTS) P[p.t](wx(p.x), wz(p.y));

  // stalls
  function textTex(str, col, w = 256, h = 96) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.font = `700 60px ${F}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fffaf2'; g.fillText(str, w / 2, h / 2 + 4);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
  }
  for (const s of STALLS) {
    const x = wx(s.x), z = wz(s.y) - 0.8, col = s.kind === 'seeds' ? '#4fbf68' : '#ffab3a';
    add(rbox(5.4, 1.6, 1.6, 0.3), '#e2b48a', x, 0.8, z);
    for (const dx of [-2.4, 2.4]) rod('#c99a72', x + dx, 0, z - 0.4, 0.15, 3.6);
    // awning stripes
    for (let i = 0; i < 7; i++) {
      const seg = add(new T.CylinderGeometry(0.42, 0.42, 1.9, 16, 1, false, 0, Math.PI), i % 2 ? '#fffaf0' : col, x - 2.52 + i * 0.84, 3.85, z + 0.25, { r: [Math.PI / 2 - 0.5, 0, Math.PI / 2] });
      seg.scale.set(1, 1, 0.9);
    }
    // keeper
    ball(s.kind === 'seeds' ? '#ffd2b0' : '#e9b48e', x, 2.2, z - 0.25, 0.62);
    ball(s.kind === 'seeds' ? '#6cc47a' : '#8aa8ff', x, 1.6, z - 0.3, 0.75, [1, 0.8, 0.8]);
    ball('#3a2a2a', x - 0.2, 2.3, z + 0.3, 0.07); ball('#3a2a2a', x + 0.2, 2.3, z + 0.3, 0.07);
    if (s.kind === 'seeds') ball('#5cb86c', x, 2.65, z - 0.25, 0.6, [1, 0.45, 1]); else ball('#8a5a3a', x, 2.6, z - 0.3, 0.6, [1, 0.6, 1]);
    // goods
    for (let i = 0; i < 4; i++) ball(s.kind === 'seeds' ? ['#ff9a5a', '#f2556a', '#7cc96a', '#ffd85e'][i] : '#ffd85e', x - 1.6 + i * 0.75, 1.75, z + 0.25, 0.28, [1, s.kind === 'seeds' ? 1.3 : 0.4, 1]);
    // sign
    const sign = add(rbox(2.9, 1.1, 0.3, 0.12), col, x, 5, z + 0.1);
    const face = new T.Mesh(new T.PlaneGeometry(2.6, 0.95), new T.MeshStandardMaterial({ map: textTex(s.label, col), roughness: 0.9 }));
    face.position.set(x, 5, z + 0.26); scene.add(face);
    sign.rotation.x = -0.2; face.rotation.x = -0.2;
  }
  // farmer
  {
    const x = wx(FARMER.x), z = wz(FARMER.y);
    ball('#7aa6f0', x, top + 0.7, z, 0.62, [1, 1.1, 0.85]);
    ball('#ffd6b4', x, top + 1.75, z, 0.62);
    ball('#3a2a2a', x - 0.2, top + 1.8, z + 0.55, 0.07); ball('#3a2a2a', x + 0.2, top + 1.8, z + 0.55, 0.07);
    ball('#ff9a9a', x - 0.38, top + 1.6, z + 0.45, 0.1, [1, 0.6, 0.4]); ball('#ff9a9a', x + 0.38, top + 1.6, z + 0.45, 0.1, [1, 0.6, 0.4]);
    rod('#ffe08a', x, top + 2.05, z, 1.05, 0.08);
    ball('#ffe08a', x, top + 2.1, z, 0.55, [1, 0.75, 1]);
    rod('#ff7a6a', x, top + 2.12, z, 0.56, 0.12);
  }
  // planting ghost
  {
    const x = wx(GHOST.x), z = wz(GHOST.y);
    const ring = new T.Mesh(new T.RingGeometry(0.75, 0.95, 40), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, top + 0.04, z); scene.add(ring);
    const gm = new T.MeshStandardMaterial({ color: new T.Color('#ffb070').convertSRGBToLinear(), transparent: true, opacity: 0.55 });
    ball(gm, x, top + 0.05, z, 0.32, [1, 0.6, 1], { cast: false });
  }
  renderer.render(scene, cam);
  const proj = (x, y, z) => { const v = new T.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };

  // HUD overlay
  const { g } = makeCanvas(host);
  hud(g, proj(wx(GHOST.x), top, wz(GHOST.y)));
}

function pill(g, x, y, w, h, fill = '#fffaf2') {
  g.save(); g.shadowColor = 'rgba(80,70,110,0.28)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
  g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, h / 2 > 18 ? 18 : h / 2); g.fill(); g.restore();
}
function icon(g, t, x, y) {
  const b = (cx, cy, r, c1, c2) => { const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };
  const leaf = (cx, cy, rx, ry, a) => { g.fillStyle = '#7cc96a'; g.beginPath(); g.ellipse(cx, cy, rx, ry, a, 0, 7); g.fill(); };
  if (t === 'carrot') { leaf(x - 3, y - 10, 2.5, 6, -0.4); leaf(x + 3, y - 10, 2.5, 6, 0.4); g.fillStyle = '#ff9a42'; g.beginPath(); g.moveTo(x - 6, y - 5); g.quadraticCurveTo(x, y - 9, x + 6, y - 5); g.lineTo(x + 1, y + 12); g.lineTo(x - 1, y + 12); g.fill(); }
  if (t === 'strawberry') { b(x, y + 1, 9, '#ff9aa8', '#e8405a'); leaf(x, y - 8, 7, 2.5, 0); }
  if (t === 'tomato') { b(x, y + 1, 10, '#ffa08a', '#f04a3a'); leaf(x, y - 8, 4, 2.5, 0); }
  if (t === 'corn') { g.fillStyle = '#ffd85e'; g.beginPath(); g.ellipse(x, y, 6, 12, 0, 0, 7); g.fill(); leaf(x - 4, y + 6, 3, 8, 0.4); leaf(x + 4, y + 6, 3, 8, -0.4); }
  if (t === 'apple') { b(x, y + 1, 10, '#ff9a9a', '#e04a4a'); leaf(x + 4, y - 10, 4, 2, -0.5); }
}
function hud(g, gp) {
  g.textBaseline = 'middle';
  pill(g, 14, 48, 124, 36);
  g.fillStyle = '#ffd34e'; g.beginPath(); g.arc(34, 66, 11, 0, 7); g.fill(); g.fillStyle = '#e8a82a'; g.beginPath(); g.arc(34, 66, 6, 0, 7); g.fill();
  g.font = `700 20px ${F}`; g.fillStyle = '#4a3f66'; g.fillText(MONEY, 52, 67);
  pill(g, 248, 48, 98, 36);
  g.fillStyle = '#ffc94e'; g.beginPath(); g.arc(268, 66, 9, 0, 7); g.fill();
  g.font = `600 17px ${F}`; g.fillStyle = '#4a3f66'; g.fillText('Sunny', 284, 67);
  // ghost hint
  g.save(); g.setLineDash([3, 7]); g.lineCap = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.moveTo(SLOT(0).x + 25, SLOT(0).y - 6); g.quadraticCurveTo(gp[0] - 30, gp[1] + 40, gp[0], gp[1] + 10); g.stroke(); g.restore();
  pill(g, gp[0] - 34, gp[1] - 62, 68, 26, '#ffffff');
  g.font = `600 13px ${F}`; g.fillStyle = '#4a3f66'; g.textAlign = 'center'; g.fillText('Plant here', gp[0], gp[1] - 49); g.textAlign = 'left';
  // tray
  pill(g, 12, 652, 336, 76, 'rgba(255,250,242,0.96)');
  HOTBAR.forEach((t, i) => {
    const s = SLOT(i), sel = i === 0;
    g.fillStyle = sel ? '#ffe9a8' : '#f1ebf8'; g.beginPath(); g.roundRect(s.x, s.y, s.w, s.h, 16); g.fill();
    if (sel) { g.strokeStyle = '#ffc94e'; g.lineWidth = 3; g.stroke(); }
    icon(g, t, s.x + 25, s.y + 25);
    g.font = `700 12px ${F}`; g.fillStyle = '#8a80a8'; g.textAlign = 'right'; g.fillText('x' + [8, 3, 2, 1, 1][i], s.x + s.w - 6, s.y + s.h - 9); g.textAlign = 'left';
  });
  const h = HARVEST;
  g.save(); g.shadowColor = 'rgba(60,120,60,0.4)'; g.shadowBlur = 14; g.shadowOffsetY = 6;
  const gr = g.createLinearGradient(0, h.y - h.r, 0, h.y + h.r); gr.addColorStop(0, '#9ee08a'); gr.addColorStop(1, '#5cb86c');
  g.fillStyle = gr; g.beginPath(); g.arc(h.x, h.y, h.r, 0, 7); g.fill(); g.restore();
  g.fillStyle = '#fffaf2'; g.beginPath(); g.roundRect(h.x - 12, h.y - 2, 24, 13, 5); g.fill();
  g.fillStyle = '#ff7a7a'; g.beginPath(); g.arc(h.x - 5, h.y - 4, 5, 0, 7); g.fill(); g.fillStyle = '#ffc94e'; g.beginPath(); g.arc(h.x + 5, h.y - 5, 5, 0, 7); g.fill();
  g.fillStyle = '#ff7a8a'; g.beginPath(); g.arc(h.x + 20, h.y - 20, 10, 0, 7); g.fill();
  g.font = `700 13px ${F}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText('9', h.x + 20, h.y - 19); g.textAlign = 'left';
}
