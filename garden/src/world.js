// The 3D world: scene, terrain, camera fitting, lighting and sky, weather, plants and fruit (instanced), effects, picking.
import { CROP, BED, inBed, DAY_LEN } from './data.js';
import { G, on, ripeCount } from './state.js';
import { dayFrac, bloodMoon, isNight } from './sim.js';
import { Vox, mesh, rng, hash, Batcher, shade } from './voxel.js';
import * as M from './models.js';

const T = window.THREE;
export const W = { t: 0 };
let renderer, scene, cam, sun, hemi, skyC, skyG, plants, fruits, partMesh, rainMesh, snowMesh, trailMesh, farmer, arrow, ring, ghost, ghostRing, bolt;
const parts = [], drops = [], flakes = [], anims = new Map();
const lanterns = [], lanternGlows = [], clouds = [], npcs = [], stallBoxes = {};
export const env = { rain: 0, storm: 0, snow: 0, wet: 0, night: 0, wind: 1, flash: 0 };
const TOP = BED.top;
const view = { zoom: 1, px: 0, pz: 0, base: null };

// ---------------------------------------------------------------- setup
export function init(host) {
  skyC = document.createElement('canvas'); skyC.id = 'sky'; host.appendChild(skyC); skyG = skyC.getContext('2d');
  renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.id = 'gl';
  host.appendChild(renderer.domElement);
  scene = new T.Scene();
  cam = new T.OrthographicCamera(-10, 10, 10, -10, 1, 600);
  hemi = new T.HemisphereLight(0xffffff, 0x6a8a5a, 0.75); scene.add(hemi);
  sun = new T.DirectionalLight(0xfff2dc, 1.05);
  sun.position.set(-40, 90, 45); sun.target.position.set(0, 0, -6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 1, far: 260 });
  scene.add(sun, sun.target);
  const vmat = new T.MeshLambertMaterial({ vertexColors: true });
  buildTerrain(vmat);
  buildStalls(vmat);
  plants = new Batcher(scene, vmat);
  fruits = new Batcher(scene, vmat);
  // effects
  const basic = new T.MeshBasicMaterial({ vertexColors: true });
  partMesh = new T.InstancedMesh(M.cubeGeo(), basic, 900); partMesh.setColorAt(0, new T.Color(1, 1, 1)); partMesh.count = 0; partMesh.frustumCulled = false; scene.add(partMesh);
  rainMesh = new T.InstancedMesh(new T.BoxGeometry(0.12, 1.6, 0.12), new T.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.55 }), 700); rainMesh.count = 0; rainMesh.frustumCulled = false; scene.add(rainMesh);
  snowMesh = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshBasicMaterial({ color: 0xffffff }), 500); snowMesh.count = 0; snowMesh.frustumCulled = false; scene.add(snowMesh);
  trailMesh = new T.InstancedMesh(new T.BoxGeometry(0.7, 0.3, 0.7), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.9 }), 80); trailMesh.count = 0; trailMesh.frustumCulled = false; scene.add(trailMesh);
  farmer = [0, 1].map((f) => { const m = new T.Mesh(M.farmerGeo(f), vmat); m.castShadow = true; scene.add(m); return m; });
  W.farmer = { x: 0, z: BED.rz + 4, tx: 0, tz: BED.rz + 4, dir: Math.PI, walk: 0 };
  // tutorial arrow + ring
  const AV = new Vox(() => 0.5);
  AV.box(-1, 4, -1, 1, 8, 1, (x, y) => (y === 8 ? '#fff4a0' : '#ffd23f'), 0);
  for (let k = 0; k < 4; k++) AV.box(-3 + k, 3 - k, -3 + k, 3 - k, 3 - k, 3 - k, k === 0 ? '#ffc21f' : '#ffb01a', 0);
  arrow = new T.Mesh(mesh(AV, { offset: [-0.5, 0, -0.5] }), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a00 }));
  arrow.visible = false; scene.add(arrow);
  ring = new T.Mesh(new T.RingGeometry(2.4, 3.2, 32, 1), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.8, side: T.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  ghostRing = new T.Mesh(new T.RingGeometry(1, 1.4, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, side: T.DoubleSide }));
  ghostRing.rotation.x = -Math.PI / 2; ghostRing.visible = false; scene.add(ghostRing);
  bolt = new T.Mesh(M.boltGeo(60), new T.MeshBasicMaterial({ vertexColors: true })); bolt.visible = false; scene.add(bolt);
  for (let k = 0; k < 4; k++) {
    const c = new T.Mesh(M.cloudGeo(k % 3), new T.MeshLambertMaterial({ vertexColors: true, color: 0xffffff }));
    c.castShadow = true; c.position.set(-80 + k * 45 + Math.random() * 20, 26 + k * 3, -95 - Math.random() * 25); c.userData.v = 1.2 + Math.random();
    scene.add(c); clouds.push(c);
  }
  on('reset', () => { anims.clear(); });
}

function buildTerrain(mat) {
  const R = rng(12), V = new Vox(R);
  const PZ0 = -46, PZ1 = -35;
  for (let x = -84; x <= 84; x++) for (let z = -80; z <= 96; z++) {
    if (z >= PZ0 && z <= PZ1) { V.set(x, 0, z, (hash(x, z) < 0.15 ? '#d8c09a' : (x + z) % 7 === 0 ? '#c8ae86' : '#ead6b0'), 0.04); continue; }
    if (inBed(x, z)) { V.set(x, 0, z, '#6a4228', 0.06); V.set(x, 1, z, !inBed(x, z - 1) || !inBed(x - 1, z) ? '#a8744a' : hash(x, z, 3) < 0.15 ? '#7e4e30' : '#8e5c3a', 0.06); continue; }
    const h = hash(x, z, 1);
    V.set(x, 0, z, h < 0.05 ? '#5aae58' : h > 0.97 ? '#8ad87a' : '#78cc6c', 0.06);
    const nb = inBed(x + 1, z) || inBed(x - 1, z) || inBed(x, z + 1) || inBed(x, z - 1);
    if (nb && hash(x, z, 7) < 0.45) V.set(x, 1, z, hash(x, z, 8) < 0.5 ? '#b8b4c4' : '#9a96a8', 0.05);
    else if (!nb && h > 0.985) V.set(x, 1, z, ['#ffffff', '#ffd84e', '#ff8ab0', '#a8c8ff'][Math.floor(hash(x, z, 9) * 4)], 0);
    else if (!nb && h < 0.012) V.set(x, 1, z, '#5cb860', 0.05);
  }
  // plaza edge kerbs
  for (let x = -84; x <= 84; x++) { V.set(x, 0, PZ1 + 1, '#b8a07a', 0.03); }
  const g = mesh(V);
  const m = new T.Mesh(g, mat);
  m.receiveShadow = true;
  scene.add(m);
  // trees around the back and sides
  const TR = rng(5);
  const spots = [];
  for (let x = -66; x <= 66; x += 7 + Math.floor(TR() * 4)) spots.push([x, -54 - Math.floor(TR() * 8)]);
  for (const [x, z] of [[-42, -20], [-46, -6], [-40, 12], [44, -18], [47, 2], [42, 20], [-50, 30], [50, 34], [-36, 44], [38, 48]]) spots.push([x, z]);
  for (const [x, z] of spots) {
    const t = new T.Mesh(M.treeGeo(Math.floor(TR() * 5)), mat);
    t.position.set(x, 1, z); t.castShadow = true; t.receiveShadow = true; scene.add(t);
  }
}

function buildStalls(mat) {
  for (const [kind, x] of [['seeds', -15], ['sell', 15]]) {
    const z = -41;
    const s = new T.Mesh(M.stallGeo(kind), mat);
    s.position.set(x, 1, z); s.castShadow = true; s.receiveShadow = true; scene.add(s);
    const n = new T.Mesh(M.npcGeo(kind), mat); n.position.set(x, 1, z - 1); n.castShadow = true; scene.add(n); npcs.push(n);
    // painted sign
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'); g.fillStyle = M.STALL[kind].col; g.fillRect(0, 0, 256, 64);
    g.font = '44px Bungee, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(M.STALL[kind].label, 131, 37); g.fillStyle = '#fff'; g.fillText(M.STALL[kind].label, 128, 34);
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
    const sign = new T.Mesh(new T.PlaneGeometry(9, 2.25), new T.MeshLambertMaterial({ map: tex }));
    sign.position.set(x, 1 + 16.5, z - 1 + 0.52); scene.add(sign);
    sign.userData.redraw = () => { g.fillStyle = M.STALL[kind].col; g.fillRect(0, 0, 256, 64); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(M.STALL[kind].label, 131, 37); g.fillStyle = '#fff'; g.fillText(M.STALL[kind].label, 128, 34); tex.needsUpdate = true; };
    if (document.fonts) document.fonts.ready.then(sign.userData.redraw);
    const l = new T.Mesh(M.lanternGeo(), new T.MeshBasicMaterial({ vertexColors: true }));
    l.position.set(x + 8, 1 + 9, z); scene.add(l); lanterns.push(l);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: 0xffc070, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glow.position.set(x + 8, 1 + 10, z + 0.5); glow.scale.set(14, 14, 1); scene.add(glow); lanternGlows.push(glow);
    stallBoxes[kind] = new T.Box3(new T.Vector3(x - 10, 0, z - 4), new T.Vector3(x + 10, 20, z + 5));
  }
}
let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (_glow = new T.CanvasTexture(c));
}

// ---------------------------------------------------------------- camera
const DIR = new T.Vector3(0.24, 0.8, 0.95).normalize();
let screen = { w: 360, h: 740, top: 70, bottom: 150 };
export function resize(w, h, padTop, padBottom) {
  screen = { w, h, top: padTop, bottom: padBottom };
  renderer.setSize(w, h);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  skyC.width = Math.round(w * dpr); skyC.height = Math.round(h * dpr); skyC.style.width = w + 'px'; skyC.style.height = h + 'px';
  skyG.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitCamera();
}
function fitCamera() {
  const target = new T.Vector3(0, 0, -6);
  cam.position.copy(target).addScaledVector(DIR, 200);
  cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;
  const pts = [];
  for (let a = 0; a < Math.PI * 2; a += 0.3) pts.push(new T.Vector3(Math.cos(a) * (BED.rx + 3), TOP, Math.sin(a) * (BED.rz + 3)));
  for (const x of [-25, 25]) pts.push(new T.Vector3(x, 19, -42));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { const v = p.clone().applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const availH = screen.h - screen.top - screen.bottom;
  const u = Math.max((x1 - x0) / screen.w, (y1 - y0) / availH) * 1.04;
  const cx = (x0 + x1) / 2;
  view.base = { left: cx - (screen.w / 2) * u, right: cx + (screen.w / 2) * u, top: y1 + screen.top * u, bottom: y1 + screen.top * u - screen.h * u, u };
  applyView();
}
function applyView() {
  const b = view.base, z = view.zoom;
  const cx = (b.left + b.right) / 2 + view.px, cy = (b.top + b.bottom) / 2 + view.pz;
  const hw = (b.right - b.left) / 2 / z, hh = (b.top - b.bottom) / 2 / z;
  Object.assign(cam, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh });
  cam.updateProjectionMatrix();
}
export function zoomBy(f, sx, sy) {
  const before = screenToView(sx, sy);
  view.zoom = Math.min(2.6, Math.max(1, view.zoom * f));
  applyView();
  const after = screenToView(sx, sy);
  panBy(0, 0, before.x - after.x, before.y - after.y);
}
export function panPixels(dx, dy) { const u = view.base.u / view.zoom; panBy(0, 0, -dx * u, dy * u); }
function panBy(_a, _b, vx, vy) {
  view.px += vx; view.pz += vy;
  const lim = ((view.base.right - view.base.left) / 2) * (1 - 1 / view.zoom);
  const limy = ((view.base.top - view.base.bottom) / 2) * (1 - 1 / view.zoom);
  view.px = Math.max(-lim, Math.min(lim, view.px)); view.pz = Math.max(-limy, Math.min(limy, view.pz));
  applyView();
}
function screenToView(sx, sy) { return { x: cam.left + (sx / screen.w) * (cam.right - cam.left), y: cam.top - (sy / screen.h) * (cam.top - cam.bottom) }; }
export const zoomLevel = () => view.zoom;

// ---------------------------------------------------------------- picking
const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hitP = new T.Vector3();
function setRay(sx, sy) { ndc.set((sx / screen.w) * 2 - 1, -(sy / screen.h) * 2 + 1); ray.setFromCamera(ndc, cam); }
export function screenToGround(sx, sy) { setRay(sx, sy); return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, z: hitP.z } : null; }
export function pickStall(sx, sy) { setRay(sx, sy); for (const k in stallBoxes) if (ray.ray.intersectsBox(stallBoxes[k])) return k; return null; }
const _v = new T.Vector3();
export function project(x, y, z) { _v.set(x, y, z).project(cam); return { x: ((_v.x + 1) / 2) * screen.w, y: ((1 - _v.y) / 2) * screen.h }; }
export function pickPlant(sx, sy) {
  let best = null, bd = 1e9;
  const u = view.base.u / view.zoom;
  for (const pl of G.plants) {
    const st = M.stageOf(growth(pl)), h = M.plantHeight(pl.c, st);
    const c = project(pl.x, TOP + h * 0.45, pl.z);
    const r = Math.max(12, (Math.max(h * 0.55, CROP[pl.c].r) / u) * 0.9);
    const d = Math.hypot(c.x - sx, c.y - sy);
    if (d < r && d / r < bd) { bd = d / r; best = pl; }
  }
  return best;
}
export const stallScreen = (k) => project(k === 'seeds' ? -15 : 15, 14, -40);
export const plantScreen = (pl, k = 0.5) => project(pl.x, TOP + M.plantHeight(pl.c, M.stageOf(growth(pl))) * k, pl.z);
export const growth = (pl) => (CROP[pl.c].multi ? pl.g / CROP[pl.c].grow : pl.fr[0].p);

// ---------------------------------------------------------------- effects API
const PC = new T.Color();
export function burst(x, y, z, cols, n = 10, o = {}) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = (o.speed ?? 8) * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, z, vx: Math.cos(a) * v, vy: (o.up ?? 9) * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * v, g: o.g ?? 28, t: -(o.delay || 0) * Math.random(), life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), s: o.size ?? 0.45, col: cols[k % cols.length] });
  }
}
export function sparkle(x, y, z, col = '#ffffff', n = 1) { for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - 0.5), y, z: z + (Math.random() - 0.5), vx: 0, vy: 3, vz: 0, g: 0, t: 0, life: 0.6, s: 0.35, col, spin: 1 }); }
export function pop(pl, kind = 'plant') { anims.set(pl.id, { t: 0, kind }); }
export function walkTo(x, z) { W.farmer.tx = Math.max(-60, Math.min(60, x)); W.farmer.tz = Math.max(-34, Math.min(60, z)); }
export function lightning(x, z) {
  bolt.position.set(x, TOP + 60, z); bolt.visible = true; bolt.userData.t = 0.22;
  env.flash = 1;
  burst(x, TOP + 6, z, ['#fff36b', '#ffffff', '#9ad8ff'], 22, { speed: 14, up: 14 });
}
export function setGhost(x, z, ok) {
  if (x == null) { ghostRing.visible = false; return; }
  ghostRing.visible = true; ghostRing.position.set(x, TOP + 0.08, z);
  ghostRing.material.color.set(ok ? 0xffffff : 0xff6a6a);
}
let guide = null;
export function setGuide(g) { guide = g; }

// ---------------------------------------------------------------- per-frame
const KEYS = [[0, '#f4b0a0', 0.55, '#a8b8e8', 0.5], [0.07, '#fff2dc', 1.05, '#e8f4ff', 0.75], [0.6, '#fff0d8', 1.0, '#eaf2ff', 0.72], [0.66, '#ffb070', 0.8, '#ffd0b0', 0.6], [0.73, '#7080d8', 0.32, '#5060a0', 0.38], [0.93, '#7080d8', 0.32, '#5060a0', 0.38], [0.98, '#ffb8a0', 0.55, '#a890c0', 0.5], [1, '#f4b0a0', 0.55, '#a8b8e8', 0.5]];
const SKY = [[0, '#6878c8', '#f4a890'], [0.07, '#4aa8f4', '#c8ecff'], [0.58, '#4aa0f4', '#c4e8ff'], [0.65, '#5a60b8', '#ff9a78'], [0.73, '#0e1236', '#2a3070'], [0.93, '#0e1236', '#2a3070'], [0.975, '#3a3a80', '#c08aa0'], [1, '#6878c8', '#f4a890']];
const ca = new T.Color(), cb = new T.Color();
function key(keys, d) {
  for (let k = 0; k < keys.length - 1; k++) if (d >= keys[k][0] && d <= keys[k + 1][0]) return [keys[k], keys[k + 1], (d - keys[k][0]) / (keys[k + 1][0] - keys[k][0])];
  return [keys[0], keys[0], 0];
}
const lerpCol = (a, b, t, out) => out.set(a).lerp(cb.set(b), t);
function nightAmount(d) { if (d < 0.6) return 0; if (d < 0.74) return (d - 0.6) / 0.14; if (d < 0.93) return 1; return Math.max(0, 1 - (d - 0.93) / 0.07); }

function drawSky(d) {
  const g = skyG, w = screen.w, h = screen.h;
  const [a, b, t] = key(SKY, d);
  let top = lerpCol(a[1], b[1], t, new T.Color()), bot = lerpCol(a[2], b[2], t, new T.Color());
  const gray = env.rain * 0.7, sn = env.snow * 0.5;
  top.lerp(ca.set(env.storm > 0.3 ? '#3a4058' : '#7a8aa8'), gray).lerp(ca.set('#a8b8d0'), sn);
  bot.lerp(ca.set(env.storm > 0.3 ? '#6a7088' : '#b8c4d4'), gray).lerp(ca.set('#e0e8f4'), sn);
  if (bloodMoon()) { top.lerp(ca.set('#3a0a1a'), env.night * 0.7); bot.lerp(ca.set('#a02a3a'), env.night * 0.6); }
  const gr = g.createLinearGradient(0, 0, 0, h * 0.45);
  gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(1, '#' + bot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (env.night > 0.05) for (let k = 0; k < 60; k++) {
    if (hash(k, 4) > env.night || Math.sin(W.t * (1 + hash(k, 3) * 3) + k) < 0.1) continue;
    g.fillStyle = hash(k, 5) < 0.3 ? '#ffe8b0' : '#ffffff';
    const s = hash(k, 6) < 0.15 ? 3 : 2;
    g.fillRect(Math.floor(hash(k, 1) * w), Math.floor(hash(k, 2) * h * 0.3), s, s);
  }
  const arc = (u) => ({ x: w * 0.12 + u * w * 0.76, y: h * 0.25 - Math.sin(u * Math.PI) * h * 0.18 });
  const body = (u, c, r, glowC) => {
    const p = arc(u);
    const gg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); gg.addColorStop(0, glowC); gg.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 1 - env.rain * 0.8; g.fillStyle = gg; g.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8);
    g.fillStyle = c; g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, Math.round(r * 0.6));
    g.globalAlpha = 1;
  };
  if (d < 0.7) body(Math.min(1, (d + 0.02) / 0.72), '#ffd84a', 13, 'rgba(255,240,180,0.55)');
  if (d > 0.66 || d < 0.02) body(d > 0.66 ? (d - 0.66) / 0.34 : 1, bloodMoon() ? '#ff4a5a' : '#f2f0dc', 10, bloodMoon() ? 'rgba(255,60,80,0.4)' : 'rgba(200,210,255,0.4)');
  if (env.flash > 0) { g.fillStyle = `rgba(255,255,255,${env.flash * 0.7})`; g.fillRect(0, 0, w, h); }
}

const m4 = new T.Matrix4(), mR = new T.Matrix4(), mS = new T.Matrix4(), mT = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3(), col = new T.Color();
const TINT = { wet: [0.78, 0.9, 1.25], chilled: [0.95, 1.05, 1.3], moonlit: [0.85, 0.75, 1.35], bloodlit: [1.35, 0.5, 0.55], shocked: [1.35, 1.35, 0.7] };
function fruitKind(crop, f) {
  if (f.m.includes('rainbow')) return 'pale';
  if (f.m.includes('gold')) return 'gold';
  if (f.m.includes('frozen')) return 'frozen';
  if (CROP[crop].multi && f.p < 0.25) return 'bud';
  return f.p < 0.75 ? 'u' : 'r';
}
export function fruitWorld(pl, k) { return pl._fw ? pl._fw[k] : null; }

export function update(dt) {
  W.t += dt;
  const t = W.t, d = dayFrac(), wt = G.weather.type;
  const ease = 1 - Math.exp(-dt * 0.8);
  env.rain += ((wt === 'rain' || wt === 'storm' ? 1 : 0) - env.rain) * ease;
  env.storm += ((wt === 'storm' ? 1 : 0) - env.storm) * ease;
  env.snow += ((wt === 'snow' ? 1 : 0) - env.snow) * ease;
  env.night = nightAmount(d);
  env.wind = 1 + env.rain * 0.8 + env.storm * 1.4;
  env.flash = Math.max(0, env.flash - dt * 3);
  // lights
  const [a, b, tt] = key(KEYS, d);
  lerpCol(a[1], b[1], tt, sun.color); sun.intensity = (a[2] + (b[2] - a[2]) * tt) * (1 - env.rain * 0.45 - env.storm * 0.25) + env.flash * 2;
  lerpCol(a[3], b[3], tt, hemi.color); hemi.intensity = (a[4] + (b[4] - a[4]) * tt) * (1 - env.rain * 0.15) + env.flash;
  if (bloodMoon()) { sun.color.lerp(ca.set('#ff5060'), env.night * 0.6); hemi.color.lerp(ca.set('#a04050'), env.night * 0.5); }
  hemi.groundColor.set(env.night > 0.5 ? '#202840' : '#6a8a5a');
  drawSky(d);
  for (const c of clouds) {
    c.position.x += c.userData.v * dt * (1 + env.rain * 1.5);
    if (c.position.x > 100) { c.position.x = -100; c.position.z = -95 - Math.random() * 25; }
    c.material.color.set(env.rain > 0.4 ? 0x8a8ea8 : 0xffffff);
  }
  lanternGlows.forEach((gl) => { gl.material.opacity = Math.max(env.night, env.storm * 0.5) * (0.8 + Math.sin(t * 3) * 0.05); gl.visible = gl.material.opacity > 0.02; });
  npcs.forEach((n, k) => { n.position.y = 1 + (Math.sin(t * 2.4 + k) > 0.6 ? 0.25 : 0); n.rotation.y = Math.sin(t * 0.7 + k * 2) * 0.35; });
  // farmer
  const f = W.farmer, dx = f.tx - f.x, dz = f.tz - f.z, dd = Math.hypot(dx, dz);
  if (dd > 0.5) { const sp = Math.min(dd, 24 * dt); f.x += (dx / dd) * sp; f.z += (dz / dd) * sp; f.dir = Math.atan2(dx, dz); f.walk += dt * 10; } else f.walk = 0;
  const fy = (f.x * f.x) / (BED.rx * BED.rx) + (f.z * f.z) / (BED.rz * BED.rz) < 1 ? TOP : 1;
  farmer.forEach((m, k) => {
    m.visible = f.walk ? Math.floor(f.walk / Math.PI) % 2 === k : k === 0;
    m.position.set(f.x, fy + (f.walk ? Math.abs(Math.sin(f.walk)) * 0.5 : 0), f.z);
    m.rotation.y = f.dir;
  });
  // plants & fruit
  plants.begin(); fruits.begin();
  for (const pl of G.plants) {
    const c = CROP[pl.c], gfrac = Math.min(1, growth(pl)), st = M.stageOf(gfrac);
    const an = anims.get(pl.id);
    let sc = 1;
    if (an) { an.t += dt; const u = an.t / 0.35; if (u >= 1) anims.delete(pl.id); else sc = an.kind === 'plant' ? 0.4 + 0.6 * Math.min(1, u * 1.6) + Math.sin(u * Math.PI) * 0.18 : 1 - Math.sin(u * Math.PI) * 0.15; }
    const amp = (st >= 2 ? 0.035 : 0.015) * env.wind * (pl.c === 'mushroom' ? 0.3 : 1);
    e.set(Math.sin(t * 1.3 + pl.id) * amp * 0.6, pl.rot * Math.PI / 2, Math.sin(t * 1.7 + pl.id * 1.3) * amp);
    q.setFromEuler(e);
    m4.compose(v3.set(pl.x, TOP, pl.z), q, s3.set(sc, an && an.kind !== 'plant' ? 2 - sc : sc, sc));
    plants.add(`p|${pl.c}|${st}|${pl.v}`, () => M.plantGeo(pl.c, st, pl.v), m4);
    const A = M.ANCHORS[pl.c], ks = c.multi ? 1 : M.STAGE_S[st];
    pl._fw = pl._fw || [];
    pl.fr.forEach((fr, k) => {
      if (!fr) { pl._fw[k] = null; return; }
      if (!c.multi && fr.p < 0.4) { pl._fw[k] = null; return; }
      const kind = fruitKind(pl.c, fr);
      const pt = A.pts[k % A.pts.length];
      const grow = c.multi ? (fr.p < 0.25 ? 1 : 0.45 + 0.55 * Math.min(1, fr.p)) : 0.4 + 0.6 * Math.min(1, fr.p);
      const size = (kind === 'bud' ? 1 : fr.s) * grow;
      mT.makeTranslation(pt[0] * ks, pt[1] * ks, pt[2] * ks);
      mS.makeScale(size, size, size);
      mR.multiplyMatrices(m4, mT).multiply(mS);
      let tint = null;
      if (fr.m.includes('rainbow')) tint = col.setHSL((t * 0.4 + k * 0.17 + pl.id * 0.1) % 1, 0.85, 0.62).multiplyScalar(1.35);
      else for (const mm of ['shocked', 'bloodlit', 'moonlit', 'chilled', 'wet']) if (fr.m.includes(mm) && kind !== 'gold' && kind !== 'frozen') { const tc = TINT[mm]; tint = col.setRGB(tc[0], tc[1], tc[2]); if (mm === 'shocked' && Math.sin(t * 20 + k) > 0.6) tint.multiplyScalar(1.4); break; }
      fruits.add(`f|${pl.c}|${kind}`, () => M.fruitGeo(pl.c, kind), mR, tint);
      v3.setFromMatrixPosition(mR);
      pl._fw[k] = { x: v3.x, y: v3.y, z: v3.z, ripe: fr.p >= 1 };
      if (fr.p >= 1 && Math.random() < dt * (fr.m.length ? 2.5 : 0.35)) sparkle(v3.x, v3.y + (A.sit ? 2 : -0.5), v3.z, fr.m.includes('gold') ? '#ffe680' : fr.m.length ? '#e0f0ff' : '#ffffff');
    });
  }
  plants.end(); fruits.end();
  // particles
  if (env.night > 0.4 && Math.random() < dt * 4) parts.push({ x: (Math.random() - 0.5) * 90, y: 3 + Math.random() * 6, z: (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 2, vy: 0.4, vz: (Math.random() - 0.5) * 2, g: 0, t: 0, life: 3, s: 0.3, col: '#e8ff7a', blink: true });
  let n = 0;
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.t += dt;
    if (p.t < 0) continue;
    if (p.t >= p.life) { parts.splice(k, 1); continue; }
    p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < TOP && p.vy < 0) { p.y = TOP; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    if (n >= 900) continue;
    const u = p.t / p.life, s = p.s * (p.spin ? Math.sin(u * Math.PI) * 1.4 : 1 - u * 0.6) * (p.blink ? (Math.sin(p.t * 6) > 0 ? 1 : 0.2) : 1);
    e.set(p.t * 3, p.t * 4, 0); q.setFromEuler(e);
    m4.compose(v3.set(p.x, p.y, p.z), q, s3.set(s, s, s));
    partMesh.setMatrixAt(n, m4); partMesh.setColorAt(n, PC.set(p.col)); n++;
  }
  partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  // rain and snow
  if (env.rain > 0.02) for (let k = 0; k < Math.round(env.rain * 260 * dt * (1 + env.storm)); k++) drops.push({ x: (Math.random() - 0.5) * 140, y: 50 + Math.random() * 10, z: (Math.random() - 0.5) * 130 - 5 });
  if (env.snow > 0.02) for (let k = 0; k < Math.round(env.snow * 90 * dt); k++) flakes.push({ x: (Math.random() - 0.5) * 140, y: 50, z: (Math.random() - 0.5) * 130 - 5, ph: Math.random() * 6 });
  n = 0;
  for (let k = drops.length - 1; k >= 0; k--) {
    const r = drops[k];
    r.y -= 60 * dt; r.x -= 6 * env.wind * dt;
    if (r.y < 1.5) { drops.splice(k, 1); if (Math.random() < 0.15) parts.push({ x: r.x, y: 1.5, z: r.z, vx: 0, vy: 3, vz: 0, g: 20, t: 0, life: 0.2, s: 0.25, col: '#cfe8ff' }); continue; }
    if (n < 700) { m4.makeTranslation(r.x, r.y, r.z); rainMesh.setMatrixAt(n++, m4); }
  }
  rainMesh.count = n; rainMesh.instanceMatrix.needsUpdate = true;
  n = 0;
  for (let k = flakes.length - 1; k >= 0; k--) {
    const s = flakes[k];
    s.y -= 7 * dt; s.x += Math.sin(t + s.ph) * 2 * dt;
    if (s.y < 1.3) { flakes.splice(k, 1); continue; }
    if (n < 500) { m4.makeTranslation(s.x, s.y, s.z); snowMesh.setMatrixAt(n++, m4); }
  }
  snowMesh.count = n; snowMesh.instanceMatrix.needsUpdate = true;
  if (bolt.visible && (bolt.userData.t -= dt) <= 0) bolt.visible = false;
  // tutorial guide
  arrow.visible = ring.visible = false; trailMesh.count = 0;
  if (guide) {
    const gx = guide.x, gz = guide.z, gy = guide.y ?? TOP;
    arrow.visible = true;
    arrow.position.set(gx, gy + (guide.h ?? 8) + Math.abs(Math.sin(t * 4)) * 2, gz);
    arrow.rotation.y = t * 1.2; arrow.scale.setScalar(guide.s || 1);
    ring.visible = guide.ring !== false; ring.position.set(gx, gy + 0.1, gz);
    const rs = 1 + (t * 1.2 % 1) * 0.8; ring.scale.set(rs * (guide.r || 1), rs * (guide.r || 1), 1); ring.material.opacity = 0.9 * (1 - (t * 1.2 % 1));
    if (guide.trail) {
      const fx = W.farmer.x, fz = W.farmer.z, L = Math.hypot(gx - fx, gz - fz);
      let m = 0;
      for (let s = 2.5; s < L - 3 && m < 80; s += 2.5) {
        const u = s / L, wave = (s - t * 8) % 10;
        const sz = wave < 0 && wave > -3 ? 1.4 : 1;
        m4.compose(v3.set(fx + (gx - fx) * u, inBed(fx + (gx - fx) * u, fz + (gz - fz) * u) ? TOP + 0.2 : 1.2, fz + (gz - fz) * u), q.identity(), s3.set(sz, 1, sz));
        trailMesh.setMatrixAt(m++, m4);
      }
      trailMesh.count = m; trailMesh.instanceMatrix.needsUpdate = true;
    }
  }
  renderer.render(scene, cam);
}
