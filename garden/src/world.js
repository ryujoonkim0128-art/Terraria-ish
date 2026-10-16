// The 3D world: the map, a third-person camera that follows your farmer, movement and collisions,
// plants and fruit (instanced), Market Day dressing, weather, sky, effects and picking.
import { CROP, BED, inRect } from './data.js';
import { G, on, marketOpen } from './state.js';
import { dayFrac, bloodMoon } from './sim.js';
import { Vox, mesh, chunks, rng, hash, hex, shade, Batcher } from './voxel.js';
import * as M from './models.js';

const T = window.THREE;
export const W = { t: 0 };
export const env = { rain: 0, storm: 0, snow: 0, night: 0, wind: 1, flash: 0 };
const TOP = BED.top;

// ---------------------------------------------------------------- map layout
export const SHOPS = {
  seeds: { x: -14, z: -72, spot: { x: -14, z: -58 }, name: 'Seeds' },
  sell: { x: 14, z: -72, spot: { x: 14, z: -58 }, name: 'Sell' },
};
export const HOME = { x: 0, z: BED.z1 + 9 };
const PLAZA = { x0: -40, x1: 40, z0: -92, z1: -50 };
// Market Day: two pop-up carts beside the stalls and a maypole in the middle of the plaza
export const CARTS = { veg: { x: -31, z: -71 }, berry: { x: 31, z: -71 } };
const MAYPOLE = { x: 0, z: -62 };
export const BOUNDS = { x0: -66, x1: 66, z0: -110, z1: 74 };
// the soil and the plank border round it both sit a step above the lawn
export const onAnyBed = (x, z) => inRect(BED, x, z, -1);
export const groundY = (x, z) => (onAnyBed(x, z) ? TOP : 1);

let renderer, scene, cam, sun, hemi, skyC, skyG, plants, fruits, partMesh, rainMesh, snowMesh, trailMesh, arrow, ring, ghostRing, bolt, heldMesh, mats;
const parts = [], drops = [], flakes = [], anims = new Map(), lanternGlows = [], colliders = [], balloons = [];
let market = null;
const shopBoxes = {};
let playerMeshes = [];

// ---------------------------------------------------------------- setup
export function init(host) {
  skyC = document.createElement('canvas'); skyC.id = 'sky'; host.appendChild(skyC); skyG = skyC.getContext('2d');
  renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.id = 'gl';
  W.renderer = renderer;
  host.appendChild(renderer.domElement);
  scene = new T.Scene();
  scene.fog = new T.Fog(0xc8ecff, 80, 175);
  cam = new T.PerspectiveCamera(62, 1, 0.5, 240);
  hemi = new T.HemisphereLight(0xffffff, 0x6a8a5a, 0.75); scene.add(hemi);
  sun = new T.DirectionalLight(0xfff2dc, 1.05);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0012; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
  scene.add(sun, sun.target);
  mats = { vox: new T.MeshLambertMaterial({ vertexColors: true }), basic: new T.MeshBasicMaterial({ vertexColors: true }) };
  buildTerrain();
  buildProps();
  buildShops();
  plants = new Batcher(scene, mats.vox);
  fruits = new Batcher(scene, mats.vox);
  partMesh = new T.InstancedMesh(M.cubeGeo(), mats.basic, 900); partMesh.setColorAt(0, new T.Color(1, 1, 1)); partMesh.count = 0; partMesh.frustumCulled = false; scene.add(partMesh);
  rainMesh = new T.InstancedMesh(new T.BoxGeometry(0.18, 2.4, 0.18), new T.MeshBasicMaterial({ color: 0x8cb0dc, transparent: true, opacity: 0.6 }), 1200); rainMesh.count = 0; rainMesh.frustumCulled = false; scene.add(rainMesh);
  snowMesh = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshBasicMaterial({ color: 0xdce8f8 }), 500); snowMesh.count = 0; snowMesh.frustumCulled = false; scene.add(snowMesh);
  trailMesh = new T.InstancedMesh(new T.BoxGeometry(1.3, 0.35, 1.3), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.95 }), 120); trailMesh.count = 0; trailMesh.frustumCulled = false; scene.add(trailMesh);
  // the player
  W.player = { x: HOME.x, y: 1, z: HOME.z, dir: Math.PI, walk: 0, moving: 0, act: 0, vx: 0, vz: 0 };
  playerMeshes = [0, 1, 2].map((f) => { const m = new T.Mesh(M.farmerGeo(f), mats.vox); m.castShadow = true; scene.add(m); return m; });
  heldMesh = new T.Mesh(M.heldGeo('shovel'), mats.vox); heldMesh.castShadow = true; heldMesh.visible = false; scene.add(heldMesh);
  // tutorial arrow, ring, planting flash ring, lightning bolt
  const AV = new Vox(() => 0.5);
  AV.box(-1, 4, -1, 1, 8, 1, (x, y) => (y === 8 ? '#fff4a0' : '#ffd23f'), 0);
  for (let k = 0; k < 4; k++) AV.box(-3 + k, 3 - k, -3 + k, 3 - k, 3 - k, 3 - k, k === 0 ? '#ffc21f' : '#ffb01a', 0);
  arrow = new T.Mesh(mesh(AV, { offset: [-0.5, 0, -0.5] }), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x6a4a00 }));
  arrow.visible = false; scene.add(arrow);
  ring = new T.Mesh(new T.RingGeometry(2.4, 3.2, 32, 1), new T.MeshBasicMaterial({ color: 0xfff27a, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  ghostRing = new T.Mesh(new T.RingGeometry(1, 1.5, 24), new T.MeshBasicMaterial({ color: 0xff6a6a, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
  ghostRing.rotation.x = -Math.PI / 2; ghostRing.visible = false; scene.add(ghostRing);
  bolt = new T.Mesh(M.boltGeo(60), mats.basic); bolt.visible = false; scene.add(bolt);
  buildMarket();
  on('reset', () => anims.clear());
  snapCamera();
}

// The flat ground is one big square with a texel per voxel; only blocks that stick up are meshed.
const GROUND = 256;
const onGround = (x, y) => y <= 0;
const tiled = (x, z) => (x >= PLAZA.x0 && x <= PLAZA.x1 && z >= PLAZA.z0 && z <= PLAZA.z1) || (Math.abs(x) <= 3 && z > PLAZA.z1 && z < BED.z0 - 1);
// the grass repeats every 64 cells, so the endless lawn past the painted square matches it exactly
const GRASS = 64;
function grass(x, z) {
  x &= GRASS - 1; z &= GRASS - 1;
  const h = hash(x, z, 1);
  return shade(h < 0.05 ? '#5aae58' : h > 0.97 ? '#8ad87a' : '#78cc6c', 1 + (hash(x, z, 11) - 0.5) * 0.12);
}
function groundColor(x, z) {
  if (tiled(x, z)) {
    const plaza = x >= PLAZA.x0 && x <= PLAZA.x1, tile = plaza && z <= PLAZA.z1 ? ((Math.floor(x / 3) + Math.floor(z / 3)) & 1) : ((x + z) & 1);
    return shade(hash(x, z) < 0.08 ? '#c8ae86' : tile ? '#ead6b0' : '#e0c9a0', 1 + (hash(x, z, 11) - 0.5) * 0.06);
  }
  if (onAnyBed(x, z)) return hex('#6a4228');
  return grass(x, z);
}
// paint an n-by-n canvas texture, one texel per cell, starting at cell (x0, z0)
function paint(n, x0, z0, colorAt, dark = null) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data;
  for (let pz = 0; pz < n; pz++) for (let px = 0; px < n; px++) {
    const col = colorAt(px + x0, pz + z0), k = dark ? dark[pz * n + px] : 1, i = (pz * n + px) * 4;
    d[i] = (col >> 16) * k; d[i + 1] = ((col >> 8) & 255) * k; d[i + 2] = (col & 255) * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(c);
  // crisp squares up close, smooth far away (no anisotropy: it blurs nearest filtering on many GPUs)
  tex.encoding = T.sRGBEncoding; tex.magFilter = T.NearestFilter; tex.minFilter = T.LinearMipmapLinearFilter;
  return tex;
}
function floor(size, tex, y) {
  const geo = new T.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2); geo.translate(-0.5, y, -0.5);
  const m = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex }));
  m.receiveShadow = true; scene.add(m);
  return geo;
}
function buildTerrain() {
  const V = new Vox(rng(12));
  // your planter: soil, a plank border and a post at each corner
  const R = BED;
  for (let x = R.x0 - 1; x <= R.x1 + 1; x++) for (let z = R.z0 - 1; z <= R.z1 + 1; z++) {
    if (inRect(R, x, z)) { V.set(x, 1, z, hash(x, z, 3) < 0.15 ? '#7e4e30' : '#8e5c3a', 0.06); continue; }
    const along = x === R.x0 - 1 || x === R.x1 + 1 ? z : x;
    V.set(x, 1, z, Math.floor((along + 64) / 3) & 1 ? '#c8945e' : '#b8844e', 0.03);
  }
  for (const x of [R.x0 - 1, R.x1 + 1]) for (const z of [R.z0 - 1, R.z1 + 1]) { V.set(x, 2, z, '#8a5a3a', 0.02); V.set(x, 3, z, '#a87048', 0.02); }
  // kerb around the plaza (open where the path comes in)
  for (let x = PLAZA.x0 - 1; x <= PLAZA.x1 + 1; x++) for (const z of [PLAZA.z0 - 1, PLAZA.z1 + 1]) if (Math.abs(x) > 3 || z === PLAZA.z0 - 1) V.set(x, 1, z, '#c8b48a', 0.03);
  for (let z = PLAZA.z0; z <= PLAZA.z1; z++) for (const x of [PLAZA.x0 - 1, PLAZA.x1 + 1]) V.set(x, 1, z, '#c8b48a', 0.03);
  // paint the floor, with a soft contact shadow around everything that sticks up
  const N = GROUND, H = N / 2, dark = new Float32Array(N * N).fill(1);
  for (const [x, , z] of V.m.values()) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const i = (z + dz + H) * N + (x + dx + H);
    if (i >= 0 && i < N * N) dark[i] = Math.min(dark[i], dx && dz ? 0.9 : 0.8);
  }
  floor(N, paint(N, -H, -H, groundColor, dark), 1);
  // and an endless lawn just beneath it, the same grass tiled out to the horizon
  const lawn = paint(GRASS, 0, 0, grass), L = 1024;
  lawn.wrapS = lawn.wrapT = T.RepeatWrapping;
  const geo = floor(L, lawn, 0.97), pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + 0.5) / GRASS, 1 - (pos.getZ(i) + 0.5) / GRASS);
  for (const geo2 of chunks(V, 48, { solid: onGround })) { const m = new T.Mesh(geo2, mats.vox); m.receiveShadow = true; scene.add(m); }
}

function buildProps() {
  const V = new Vox(rng(77));
  // lamps along the path, round the plaza and at the front corners of your garden
  const lamps = [[-7, BED.z0 - 10], [PLAZA.x0 + 2, PLAZA.z1 - 2], [PLAZA.x1 - 2, PLAZA.z1 - 2], [PLAZA.x0 + 2, PLAZA.z0 + 2], [PLAZA.x1 - 2, PLAZA.z0 + 2], [BED.x0 - 4, BED.z1 + 4], [BED.x1 + 4, BED.z1 + 4]];
  for (const [x, z] of lamps) { M.drawLamp(V, x, 1, z); colliders.push({ x, z, r: 0.8 }); addGlow(x, 10.5, z, 0xffd27a, 16); addLampHead(x, 9.5, z); }
  // plaza dressing
  for (const [x, z] of [[-30, -60], [30, -60], [-30, -82], [30, -82]]) { M.drawFlowerbed(V, x, 1, z, 5); colliders.push({ x0: x - 5.5, x1: x + 5.5, z0: z - 1.5, z1: z + 1.5 }); }
  for (const [x, z] of [[-22, -54], [22, -54]]) { M.drawBench(V, x, 1, z); colliders.push({ x0: x - 2.5, x1: x + 2.5, z0: z - 0.5, z1: z + 1.5 }); }
  M.drawFlowerbed(V, 0, 1, -86, 8);
  colliders.push({ x0: -8.5, x1: 8.5, z0: -87.5, z1: -84.5 });
  // two signboards either side of the way into your garden, read together: YOUR GARDEN / GROWS EVEN WHILE OFFLINE
  const z = BED.z1 + 6;
  for (const [x0, x1] of [[-11, -5], [5, 12]]) {
    V.box(x0, 1, z, x0, 4, z, '#8a5a3a', 0.03); V.box(x1, 1, z, x1, 4, z, '#8a5a3a', 0.03);
    colliders.push({ x0: x0 - 1, x1: x1 + 1, z0: z - 0.6, z1: z + 0.6 });
  }
  for (const geo of chunks(V, 48, { solid: onGround })) { const m = new T.Mesh(geo, mats.vox); m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  sign('YOUR GARDEN', -8, 5.6, z + 0.6, 8, '#c8904a');
  sign(['GROWS EVEN', 'WHILE OFFLINE'], 8.5, 6.3, z + 0.6, 9, '#5aa848', scene, 3.4);
}
function addLampHead(x, y, z) {
  const l = new T.Mesh(M.lanternGeo(), mats.basic);
  l.position.set(x + 0.5, y - 1, z + 0.5); l.scale.set(1.6, 1.2, 1.6); scene.add(l);
}
function addGlow(x, y, z, col, s) {
  const g = new T.Sprite(new T.SpriteMaterial({ map: glowTex(), color: col, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  g.position.set(x + 0.5, y, z + 0.5); g.scale.set(s, s, 1); scene.add(g); lanternGlows.push(g);
}
// white lettering on a coloured board: one line, or an array of lines sharing one size
function textTexture(text, bg, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
  const lines = [].concat(text), lh = h / lines.length;
  const draw = () => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - lh / 12, w, lh / 12);
    let size = Math.round(lh * 0.6); g.font = `${size}px Bungee, "Arial Black", sans-serif`;
    while (lines.some((l) => g.measureText(l).width > w * 0.9) && size > 12) { size -= 2; g.font = `${size}px Bungee, "Arial Black", sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      const y = (i + 0.5) * lh;
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(l, w / 2 + lh / 32, y + lh / 20); g.fillStyle = '#fff'; g.fillText(l, w / 2, y + lh / 64);
    });
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts) document.fonts.ready.then(draw);
  return tex;
}
function sign(text, x, y, z, w, bg, parent = scene, h = w / 4) {
  const board = new T.Mesh(new T.BoxGeometry(w, h, 0.6), new T.MeshLambertMaterial({ color: 0x8a5a3a }));
  board.position.set(x, y, z - 0.35); board.castShadow = true; parent.add(board);
  const face = new T.Mesh(new T.PlaneGeometry(w - 0.4, h - 0.4), new T.MeshLambertMaterial({ map: textTexture(text, bg, 512, Math.round((512 * (h - 0.4)) / (w - 0.4))) }));
  face.position.set(x, y, z - 0.03); parent.add(face);
}
function buildShops() {
  for (const kind of ['seeds', 'sell']) {
    const { x, z } = SHOPS[kind];
    const s = new T.Mesh(M.stallGeo(kind), mats.vox);
    s.position.set(x, 1, z); s.castShadow = true; s.receiveShadow = true; scene.add(s);
    const face = new T.Mesh(new T.PlaneGeometry(9, 2.25), new T.MeshLambertMaterial({ map: textTexture(M.STALL[kind].label, M.STALL[kind].col, 256, 64) }));
    face.position.set(x, 1 + 16.5, z - 1 + 0.52); scene.add(face);
    const l = new T.Mesh(M.lanternGeo(), mats.basic); l.position.set(x + 8, 1 + 9, z); scene.add(l);
    addGlow(x + 8, 11, z, 0xffc070, 14);
    shopBoxes[kind] = new T.Box3(new T.Vector3(x - 10, 0, z - 4), new T.Vector3(x + 10, 20, z + 5));
    colliders.push({ x0: x - 9.5, x1: x + 9.5, z0: z - 3.5, z1: z + 3 });
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
// Market Day dressing: two carts with balloons, a maypole with bunting, a banner over the way in
function buildMarket() {
  market = new T.Group(); market.visible = false; scene.add(market);
  const BAL = { veg: ['#ff5a6a', '#ffd84e', '#5a9ae8'], berry: ['#ff7ab0', '#c08aff', '#ffffff'] };
  for (const id of ['veg', 'berry']) {
    const c = CARTS[id];
    const m = new T.Mesh(M.cartGeo(id), mats.vox); m.position.set(c.x, 1, c.z); m.castShadow = m.receiveShadow = true; market.add(m);
    sign(M.CART[id].label, c.x, 14.2, c.z - 1.2, 9, M.CART[id].col, market);
    BAL[id].forEach((col, k) => {
      const b = new T.Mesh(M.balloonGeo(col), mats.vox);
      b.userData = { x: c.x + [-5.5, 5.5, 4][k], y: [10.5, 10.5, 13][k], z: c.z + [2.5, 2.5, 1][k], ph: k * 2 + c.x };
      b.castShadow = true; market.add(b); balloons.push(b);
    });
    colliders.push({ x0: c.x - 6, x1: c.x + 6, z0: c.z - 3.5, z1: c.z + 3.5, when: marketOpen });
  }
  const V = new Vox(rng(31)), RIB = ['#ff5a6a', '#ffd84e', '#5cc060', '#5a9ae8', '#c08aff', '#ff9a3a'], P = MAYPOLE;
  V.box(P.x - 1, 1, P.z - 1, P.x + 1, 1, P.z + 1, '#c8b48a', 0.03);
  for (let y = 2; y <= 18; y++) V.set(P.x, y, P.z, y % 3 === 0 ? RIB[(y / 3) % RIB.length] : '#f6ecd8', 0.02);
  V.set(P.x, 19, P.z, '#ffd84e', 0); V.set(P.x, 20, P.z, '#ffe880', 0);
  let f = 0;
  for (const [ex, ez] of [[-38, -52], [38, -52], [-38, -90], [38, -90]]) {
    const L = Math.ceil(Math.hypot(ex - P.x, 10 - 18, ez - P.z));
    for (let i = 0; i <= L; i++) {
      const t = i / L, x = P.x + (ex - P.x) * t, z = P.z + (ez - P.z) * t, y = 18 + (10 - 18) * t - 3.5 * Math.sin(Math.PI * t);
      V.set(x, y, z, '#f6ecd8', 0);
      if (i % 3 === 1 && i > 1 && i < L - 1) { const col = RIB[f++ % RIB.length]; V.set(x, y - 1, z, col, 0.03); V.set(x, y - 2, z, col, 0.03); }
    }
  }
  const pole = new T.Mesh(mesh(V), mats.vox); pole.castShadow = true; market.add(pole);
  colliders.push({ x: P.x - 0.5, z: P.z - 0.5, r: 1.6, when: marketOpen });
  const B = new Vox(rng(3));
  for (const x of [-7, 7]) B.box(x, 1, -48, x, 8, -48, '#8a5a3a', 0.03);
  market.add(new T.Mesh(mesh(B), mats.vox));
  sign('MARKET DAY', 0, 9.6, -47.6, 14, '#ff5a8a', market);
}
export function confetti() {
  burst(MAYPOLE.x, 20, MAYPOLE.z, ['#ff5a6a', '#ffd84e', '#5cc060', '#5a9ae8', '#c08aff', '#ffffff'], 70, { speed: 16, up: 18, g: 14, life: 2.2, size: 0.45 });
}
export const marketSpot = (id) => ({ x: CARTS[id].x, z: CARTS[id].z + 9 });

// ---------------------------------------------------------------- camera
const cs = { yaw: 0, pitch: 0.72, dist: 52, tx: 0, ty: 0, tz: 0, lead: 10, lift: 3 };
export const camState = cs;
let screen = { w: 360, h: 740 };
export function resize(w, h) {
  screen = { w, h };
  renderer.setSize(w, h);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  skyC.width = Math.round(w * dpr); skyC.height = Math.round(h * dpr); skyC.style.width = w + 'px'; skyC.style.height = h + 'px';
  skyG.setTransform(dpr, 0, 0, dpr, 0, 0);
  skyKey = '';
  cam.aspect = w / h;
  cam.fov = w / h < 0.75 ? 64 : 50;
  cam.updateProjectionMatrix();
}
export function rotateCam(dx, dy) { cs.yaw -= dx * 0.0085; cs.pitch = Math.min(1.3, Math.max(0.42, cs.pitch + dy * 0.006)); }
export function zoomCam(f) { cs.dist = Math.min(80, Math.max(16, cs.dist / f)); }
export function snapCamera(yaw = cs.yaw) {
  const p = W.player;
  cs.yaw = yaw; cs.tx = p.x; cs.ty = p.y + cs.lift; cs.tz = p.z;
  placeCamera();
}
// the camera looks a little ahead of the farmer so more of the garden is in view
function placeCamera() {
  const cp = Math.cos(cs.pitch), sp = Math.sin(cs.pitch), sy = Math.sin(cs.yaw), cy = Math.cos(cs.yaw);
  const lx = cs.tx - sy * cs.lead, lz = cs.tz - cy * cs.lead;
  cam.position.set(lx + sy * cp * cs.dist, cs.ty + sp * cs.dist, lz + cy * cp * cs.dist);
  cam.lookAt(lx, cs.ty, lz);
  cam.updateMatrixWorld();
}
export const camYaw = () => cs.yaw;

// ---------------------------------------------------------------- player
const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
function collide(o, r) {
  for (const c of colliders) {
    if (c.when && !c.when()) continue;
    if (c.r !== undefined) {
      const dx = o.x - (c.x + 0.5), dz = o.z - (c.z + 0.5), d = Math.hypot(dx, dz), m = r + c.r;
      if (d < m && d > 0.0001) { o.x += (dx / d) * (m - d); o.z += (dz / d) * (m - d); }
    } else {
      const cx = Math.max(c.x0, Math.min(c.x1, o.x)), cz = Math.max(c.z0, Math.min(c.z1, o.z));
      const dx = o.x - cx, dz = o.z - cz, d = Math.hypot(dx, dz);
      if (d < r) {
        if (d > 0.0001) { o.x += (dx / d) * (r - d); o.z += (dz / d) * (r - d); }
        else {
          const opts = [[c.x0 - r - o.x, 0], [c.x1 + r - o.x, 0], [0, c.z0 - r - o.z], [0, c.z1 + r - o.z]].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          o.x += opts[0][0]; o.z += opts[0][1];
        }
      }
    }
  }
  o.x = Math.max(BOUNDS.x0, Math.min(BOUNDS.x1, o.x)); o.z = Math.max(BOUNDS.z0, Math.min(BOUNDS.z1, o.z));
}
function movePlayer(dt, ix, iy) {
  const p = W.player;
  const fx = -Math.sin(cs.yaw), fz = -Math.cos(cs.yaw), rx = Math.cos(cs.yaw), rz = -Math.sin(cs.yaw);
  const mx = rx * ix + fx * iy, mz = rz * ix + fz * iy, ml = Math.hypot(mx, mz), m = Math.min(1, ml);
  const speed = 17;
  const tvx = m > 0.08 ? (mx / ml) * m * speed : 0, tvz = m > 0.08 ? (mz / ml) * m * speed : 0;
  const k = 1 - Math.exp(-dt * 14);
  p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
  const v = Math.hypot(p.vx, p.vz);
  p.x += p.vx * dt; p.z += p.vz * dt;
  collide(p, 1.1);
  if (v > 0.8) { p.dir = angLerp(p.dir, Math.atan2(p.vx, p.vz), 1 - Math.exp(-dt * 16)); p.walk += dt * v * 0.75; p.moving = v; } else { p.moving = 0; p.walk = 0; }
  p.y += (groundY(p.x, p.z) - p.y) * (1 - Math.exp(-dt * 18));
  p.act = Math.max(0, p.act - dt);
}
export function teleport(spot, dir = Math.PI) {
  const p = W.player;
  burst(p.x, p.y + 4, p.z, ['#ffffff', '#bfe4ff', '#fff27a'], 20, { speed: 8, up: 10, life: 0.5, size: 0.5 });
  p.x = spot.x; p.z = spot.z; p.y = groundY(p.x, p.z); p.vx = p.vz = 0; p.dir = dir;
  snapCamera(0);
  burst(p.x, p.y + 4, p.z, ['#ffffff', '#bfe4ff', '#fff27a'], 24, { speed: 9, up: 12, life: 0.6, size: 0.5 });
}
export function faceTo(x, z) { const p = W.player; p.dir = Math.atan2(x - p.x, z - p.z); p.act = 0.25; }
export const distTo = (x, z) => Math.hypot(W.player.x - x, W.player.z - z);
export function nearShop(r = 12) {
  for (const k in SHOPS) if (Math.hypot(W.player.x - SHOPS[k].x, W.player.z - (SHOPS[k].z + 3)) < r) return k;
  return null;
}

// ---------------------------------------------------------------- picking
const ray = new T.Raycaster(), ndc = new T.Vector2(), hitP = new T.Vector3(), box = new T.Box3(), bmin = new T.Vector3(), bmax = new T.Vector3(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP);
function setRay(sx, sy) { ndc.set((sx / screen.w) * 2 - 1, -(sy / screen.h) * 2 + 1); ray.setFromCamera(ndc, cam); }
export function groundPoint(sx, sy) { setRay(sx, sy); return ray.ray.intersectPlane(plane, hitP) ? { x: hitP.x, z: hitP.z } : null; }
export const growth = (pl) => (CROP[pl.c].multi ? pl.g / CROP[pl.c].grow : pl.fr[0].p);
export function pickPlant(sx, sy) {
  setRay(sx, sy);
  let best = null, bd = 1e9;
  for (const pl of G.plants) {
    const st = M.stageOf(Math.min(1, growth(pl))), h = plantH(pl, st), r = Math.max(1.4, Math.min(CROP[pl.c].r, h * 0.6));
    box.set(bmin.set(pl.x - r, TOP, pl.z - r), bmax.set(pl.x + r, TOP + h + 0.5, pl.z + r));
    const hit = ray.ray.intersectBox(box, hitP);
    if (hit) { const d = hit.distanceTo(cam.position); if (d < bd) { bd = d; best = pl; } }
  }
  return best;
}
const fp = new T.Vector3();
export function pickFruit(sx, sy) {
  setRay(sx, sy);
  let best = null, bd = 1e9;
  for (const pl of G.plants) for (let k = 0; k < (pl._fw || []).length; k++) {
    const f = pl._fw[k];
    if (!f || !f.ripe) continue;
    fp.set(f.x, f.y + (f.sit ? 1 : -1), f.z);
    const d2 = ray.ray.distanceSqToPoint(fp);
    if (d2 < 3.2 && d2 < bd) { bd = d2; best = { pl, k }; }
  }
  return best;
}
export function pickShop(sx, sy) { setRay(sx, sy); for (const k in shopBoxes) if (ray.ray.intersectsBox(shopBoxes[k])) return k; return null; }
const _v = new T.Vector3();
export function project(x, y, z) { _v.set(x, y, z).project(cam); return { x: ((_v.x + 1) / 2) * screen.w, y: ((1 - _v.y) / 2) * screen.h, behind: _v.z > 1 }; }
const plantH = (pl, st) => M.plantHeight(pl.c, st) * (CROP[pl.c].size || 1);
export const plantScreen = (pl, k = 0.5) => project(pl.x, TOP + plantH(pl, M.stageOf(Math.min(1, growth(pl)))) * k, pl.z);

// ---------------------------------------------------------------- effects API
const PC = new T.Color();
export function burst(x, y, z, cols, n = 10, o = {}) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = (o.speed ?? 8) * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, z, vx: Math.cos(a) * v, vy: (o.up ?? 9) * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * v, g: o.g ?? 28, t: -(o.delay || 0) * Math.random(), life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), s: o.size ?? 0.45, col: cols[k % cols.length] });
  }
}
export function sparkle(x, y, z, col = '#ffffff', n = 1) { for (let k = 0; k < n; k++) parts.push({ x: x + (Math.random() - 0.5), y, z: z + (Math.random() - 0.5), vx: 0, vy: 3, vz: 0, g: 0, t: 0, life: 0.6, s: 0.35, col, spin: 1 }); }
// a seed tossed from the farmer's hand to the soil; returns the flight time
export function toss(x, z, col = '#c8a86a') {
  const p = W.player, sx = p.x + Math.sin(p.dir) * 1.5, sz = p.z + Math.cos(p.dir) * 1.5, sy = p.y + 4;
  const d = Math.hypot(x - sx, z - sz), T1 = Math.min(0.5, 0.2 + d * 0.012), g = 30;
  parts.push({ x: sx, y: sy, z: sz, vx: (x - sx) / T1, vy: (TOP + 0.3 - sy) / T1 + (g * T1) / 2, vz: (z - sz) / T1, g, t: 0, life: T1, s: 0.6, col, seed: 1 });
  return T1;
}
export function pop(pl, kind = 'plant', delay = 0) { anims.set(pl.id, { t: -delay, kind }); }
export function lightning(x, z) {
  bolt.position.set(x, TOP + 60, z); bolt.visible = true; bolt.userData.t = 0.22;
  env.flash = 1;
  burst(x, TOP + 6, z, ['#fff36b', '#ffffff', '#9ad8ff'], 22, { speed: 14, up: 14 });
}
export function flashRing(x, z) { ghostRing.visible = true; ghostRing.position.set(x, TOP + 0.08, z); ghostRing.userData.t = 0.5; }
let guide = null;
export function setGuide(g) { guide = g; }

// ---------------------------------------------------------------- sky and light
const KEYS = [[0, '#f4b0a0', 0.55, '#a8b8e8', 0.5], [0.07, '#fff2dc', 1.05, '#e8f4ff', 0.75], [0.6, '#fff0d8', 1.0, '#eaf2ff', 0.72], [0.66, '#ffb070', 0.8, '#ffd0b0', 0.6], [0.73, '#7080d8', 0.32, '#5060a0', 0.38], [0.93, '#7080d8', 0.32, '#5060a0', 0.38], [0.98, '#ffb8a0', 0.55, '#a890c0', 0.5], [1, '#f4b0a0', 0.55, '#a8b8e8', 0.5]];
const SKY = [[0, '#6878c8', '#f4c0a8'], [0.07, '#4aa8f4', '#d4f0ff'], [0.58, '#4aa0f4', '#cdeeff'], [0.65, '#5a60b8', '#ffb08a'], [0.73, '#0e1236', '#2a3070'], [0.93, '#0e1236', '#2a3070'], [0.975, '#3a3a80', '#c08aa0'], [1, '#6878c8', '#f4c0a8']];
const ca = new T.Color(), cb = new T.Color(), cTop = new T.Color(), cBot = new T.Color();
function key(keys, d) {
  for (let k = 0; k < keys.length - 1; k++) if (d >= keys[k][0] && d <= keys[k + 1][0]) return [keys[k], keys[k + 1], (d - keys[k][0]) / (keys[k + 1][0] - keys[k][0])];
  return [keys[0], keys[0], 0];
}
const lerpCol = (a, b, t, out) => out.set(a).lerp(cb.set(b), t);
function nightAmount(d) { if (d < 0.6) return 0; if (d < 0.74) return (d - 0.6) / 0.14; if (d < 0.93) return 1; return Math.max(0, 1 - (d - 0.93) / 0.07); }
let skyKey = '', skyT = 0;
function drawSky(d, dt) {
  const [a, b, t] = key(SKY, d);
  lerpCol(a[1], b[1], t, cTop); lerpCol(a[2], b[2], t, cBot);
  const gray = env.rain * 0.7, sn = env.snow * 0.5;
  cTop.lerp(ca.set(env.storm > 0.3 ? '#3a4058' : '#7a8aa8'), gray).lerp(ca.set('#a8b8d0'), sn);
  cBot.lerp(ca.set(env.storm > 0.3 ? '#6a7088' : '#b8c4d4'), gray).lerp(ca.set('#e0e8f4'), sn);
  if (bloodMoon()) { cTop.lerp(ca.set('#3a0a1a'), env.night * 0.7); cBot.lerp(ca.set('#a02a3a'), env.night * 0.6); }
  scene.fog.color.copy(cBot).convertSRGBToLinear();
  skyT += dt;
  const k = cTop.getHexString() + cBot.getHexString() + Math.round(d * 400) + (env.flash > 0 ? env.flash.toFixed(2) : '');
  if (k === skyKey && !(env.night > 0.05 && skyT > 0.12)) return;
  skyKey = k; skyT = 0;
  const g = skyG, w = screen.w, h = screen.h;
  const gr = g.createLinearGradient(0, 0, 0, h * 0.5);
  gr.addColorStop(0, '#' + cTop.getHexString()); gr.addColorStop(1, '#' + cBot.getHexString());
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  if (env.night > 0.05) for (let s = 0; s < 70; s++) {
    if (hash(s, 4) > env.night || Math.sin(W.t * (1 + hash(s, 3) * 3) + s) < 0.1) continue;
    g.fillStyle = hash(s, 5) < 0.3 ? '#ffe8b0' : '#ffffff';
    const z = hash(s, 6) < 0.15 ? 3 : 2;
    g.fillRect(Math.floor(hash(s, 1) * w), Math.floor(hash(s, 2) * h * 0.35), z, z);
  }
  const arc = (u) => ({ x: w * 0.12 + u * w * 0.76, y: h * 0.2 - Math.sin(u * Math.PI) * h * 0.13 });
  const body = (u, c, r, glowC) => {
    const p = arc(u);
    const gg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); gg.addColorStop(0, glowC); gg.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 1 - env.rain * 0.8; g.fillStyle = gg; g.fillRect(p.x - r * 4, p.y - r * 4, r * 8, r * 8);
    g.fillStyle = c; g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, r * 2);
    g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(Math.round(p.x - r), Math.round(p.y - r), r * 2, Math.round(r * 0.6));
    g.globalAlpha = 1;
  };
  if (d < 0.7) body(Math.min(1, (d + 0.02) / 0.72), '#ffd84a', 14, 'rgba(255,240,180,0.55)');
  if (d > 0.66 || d < 0.02) body(d > 0.66 ? (d - 0.66) / 0.34 : 1, bloodMoon() ? '#ff4a5a' : '#f2f0dc', 11, bloodMoon() ? 'rgba(255,60,80,0.4)' : 'rgba(200,210,255,0.4)');
  if (env.flash > 0) { g.fillStyle = `rgba(255,255,255,${env.flash * 0.7})`; g.fillRect(0, 0, w, h); }
}

// ---------------------------------------------------------------- per frame
const m4 = new T.Matrix4(), mR = new T.Matrix4(), mS = new T.Matrix4(), mT = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v3 = new T.Vector3(), s3 = new T.Vector3(), col = new T.Color();
const TINT = { wet: [0.78, 0.9, 1.25], chilled: [0.95, 1.05, 1.3], moonlit: [0.85, 0.75, 1.35], bloodlit: [1.35, 0.5, 0.55], shocked: [1.35, 1.35, 0.7] };
function fruitKind(crop, f) {
  if (f.m.includes('rainbow')) return 'pale';
  if (f.m.includes('gold')) return 'gold';
  if (f.m.includes('frozen')) return 'frozen';
  if (CROP[crop].multi && f.p < 0.25) return 'bud';
  return f.p < 0.75 ? 'u' : 'r';
}
function drawPlants(list, dt, t) {
  for (const pl of list) {
    const c = CROP[pl.c], gfrac = Math.min(1, growth(pl)), st = M.stageOf(gfrac);
    const an = anims.get(pl.id);
    let sc = 1, sy = 1;
    if (an) {
      an.t += dt;
      const u = an.t / 0.35;
      if (an.t < 0) sc = sy = 0.001;
      else if (u >= 1) anims.delete(pl.id);
      else if (an.kind === 'plant') { sc = 0.4 + 0.6 * Math.min(1, u * 1.6) + Math.sin(u * Math.PI) * 0.18; sy = sc; }
      else { sc = 1 + Math.sin(u * Math.PI) * 0.12; sy = 1 - Math.sin(u * Math.PI) * 0.18; }
    }
    const amp = (st >= 2 ? 0.035 : 0.015) * env.wind * (pl.c === 'mushroom' ? 0.3 : 1);
    e.set(Math.sin(t * 1.3 + pl.id) * amp * 0.6, pl.rot * Math.PI / 2, Math.sin(t * 1.7 + pl.id * 1.3) * amp);
    q.setFromEuler(e);
    const k = c.size || 1;
    m4.compose(v3.set(pl.x, TOP, pl.z), q, s3.set(sc * k, sy * k, sc * k));
    plants.add(`p|${pl.c}|${st}|${pl.v}`, () => M.plantGeo(pl.c, st, pl.v), m4);
    const A = M.ANCHORS[pl.c], ks = c.multi ? 1 : M.STAGE_S[st];
    pl._fw = pl._fw || [];
    pl.fr.forEach((fr, k) => {
      if (!fr || (!c.multi && fr.p < 0.4)) { pl._fw[k] = null; return; }
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
      pl._fw[k] = { x: v3.x, y: v3.y, z: v3.z, ripe: fr.p >= 1, sit: !!A.sit, s: size };
      if (fr.p >= 1 && Math.random() < dt * (fr.m.length ? 2.5 : 0.35)) sparkle(v3.x, v3.y + (A.sit ? 2 : -0.5), v3.z, fr.m.includes('gold') ? '#ffe680' : fr.m.length ? '#e0f0ff' : '#ffffff');
    });
  }
}
function drawFarmer(meshes, o, held) {
  const step = Math.floor(o.walk * 2) % 4;
  const frame = o.walk ? (step === 1 ? 1 : step === 3 ? 2 : 0) : 0;
  const bob = o.walk ? Math.abs(Math.sin(o.walk * Math.PI)) * 0.35 : 0;
  const crouch = o.act ? Math.sin((o.act / 0.25) * Math.PI) * 0.16 : 0;
  meshes.forEach((m, k) => {
    m.visible = k === frame;
    m.position.set(o.x, (o.y ?? 1) + bob, o.z);
    m.rotation.y = o.dir;
    m.scale.set(M.FARMER_S, M.FARMER_S * (1 - crouch), M.FARMER_S);
  });
  if (held !== undefined) {
    heldMesh.visible = !!held;
    if (held) {
      if (heldMesh.userData.k !== held) { heldMesh.geometry = M.heldGeo(held); heldMesh.userData.k = held; }
      const ox = -2.3, oz = 0.8;
      heldMesh.position.set(o.x + Math.cos(o.dir) * ox + Math.sin(o.dir) * oz, (o.y ?? 1) + bob + 2 - crouch * 4, o.z - Math.sin(o.dir) * ox + Math.cos(o.dir) * oz);
      heldMesh.rotation.y = o.dir;
      heldMesh.scale.setScalar(0.55);
    }
  }
}
const SEEDCOL = { carrot: '#ff8a2a', strawberry: '#f03a4e', blueberry: '#4a5ae0', tulip: '#ff8a3a', tomato: '#f04a32', corn: '#ffd84e', watermelon: '#6ac85a', pumpkin: '#ff9a2a', apple: '#e8383e', coconut: '#6e4428', dragonfruit: '#e8408f', mango: '#ffb43a', grape: '#8a4ad0', mushroom: '#e0383a', beanstalk: '#7ae05a' };
export const seedColor = (c) => SEEDCOL[c] || '#c8a86a';

export function update(dt, input = { x: 0, y: 0 }) {
  W.t += dt;
  const t = W.t, d = dayFrac(), wt = G.weather.type;
  const ease = 1 - Math.exp(-dt * 0.8);
  env.rain += ((wt === 'rain' || wt === 'storm' ? 1 : 0) - env.rain) * ease;
  env.storm += ((wt === 'storm' ? 1 : 0) - env.storm) * ease;
  env.snow += ((wt === 'snow' ? 1 : 0) - env.snow) * ease;
  env.night = nightAmount(d);
  env.wind = 1 + env.rain * 0.8 + env.storm * 1.4;
  env.flash = Math.max(0, env.flash - dt * 3);
  // player and camera
  movePlayer(dt, input.x, input.y);
  const p = W.player;
  const kf = 1 - Math.exp(-dt * 9);
  cs.tx += (p.x - cs.tx) * kf; cs.ty += (p.y + cs.lift - cs.ty) * kf; cs.tz += (p.z - cs.tz) * kf;
  placeCamera();
  sun.target.position.set(cs.tx, 0, cs.tz);
  sun.position.set(cs.tx - 40, 90, cs.tz + 45);
  // lights and sky
  const [a, b, tt] = key(KEYS, d);
  lerpCol(a[1], b[1], tt, sun.color); sun.intensity = (a[2] + (b[2] - a[2]) * tt) * (1 - env.rain * 0.45 - env.storm * 0.25) + env.flash * 2;
  lerpCol(a[3], b[3], tt, hemi.color); hemi.intensity = (a[4] + (b[4] - a[4]) * tt) * (1 - env.rain * 0.15) + env.flash;
  if (bloodMoon()) { sun.color.lerp(ca.set('#ff5060'), env.night * 0.6); hemi.color.lerp(ca.set('#a04050'), env.night * 0.5); }
  hemi.groundColor.set(env.night > 0.5 ? '#202840' : '#6a8a5a');
  drawSky(d, dt);
  const glowOn = Math.max(env.night, env.storm * 0.5);
  lanternGlows.forEach((gl) => { gl.material.opacity = glowOn * (0.8 + Math.sin(t * 3) * 0.05); gl.visible = gl.material.opacity > 0.02; });
  // Market Day dressing
  const mOn = marketOpen();
  if (market.visible !== mOn) market.visible = mOn;
  if (mOn) {
    for (const b of balloons) { const u = b.userData; b.position.set(u.x + Math.sin(t * 0.9 + u.ph) * 0.3, u.y + Math.sin(t * 1.6 + u.ph) * 0.4, u.z); b.rotation.z = Math.sin(t * 1.2 + u.ph) * 0.12; }
    if (Math.hypot(p.x - MAYPOLE.x, p.z - MAYPOLE.z) < 60 && Math.random() < dt * 0.25) burst(MAYPOLE.x + (Math.random() - 0.5) * 50, 22, MAYPOLE.z + (Math.random() - 0.5) * 30, ['#ff5a6a', '#ffd84e', '#5cc060', '#5a9ae8', '#c08aff'], 14, { speed: 4, up: 2, g: 6, life: 2.5, size: 0.4 });
  }
  const held = G.sel === 'shovel' ? 'shovel' : G.sel && G.sel.startsWith('seed:') ? seedColor(G.sel.slice(5)) : null;
  drawFarmer(playerMeshes, p, held);
  // plants and fruit
  plants.begin(); fruits.begin();
  drawPlants(G.plants, dt, t);
  plants.end(); fruits.end();
  // particles
  if (env.night > 0.4 && Math.random() < dt * 5) parts.push({ x: cs.tx + (Math.random() - 0.5) * 80, y: 3 + Math.random() * 6, z: cs.tz + (Math.random() - 0.5) * 80, vx: (Math.random() - 0.5) * 2, vy: 0.4, vz: (Math.random() - 0.5) * 2, g: 0, t: 0, life: 3, s: 0.3, col: '#e8ff7a', blink: true });
  let n = 0;
  for (let k = parts.length - 1; k >= 0; k--) {
    const pt = parts[k];
    pt.t += dt;
    if (pt.t < 0) continue;
    if (pt.t >= pt.life) { parts.splice(k, 1); continue; }
    pt.vy -= pt.g * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
    if (!pt.seed && pt.y < 1.2 && pt.vy < 0) { pt.y = 1.2; pt.vy *= -0.3; pt.vx *= 0.6; pt.vz *= 0.6; }
    if (n >= 900) continue;
    const u = pt.t / pt.life, s = pt.s * (pt.spin ? Math.sin(u * Math.PI) * 1.4 : pt.seed ? 1 : 1 - u * 0.6) * (pt.blink ? (Math.sin(pt.t * 6) > 0 ? 1 : 0.2) : 1);
    e.set(pt.t * 3, pt.t * 4, 0); q.setFromEuler(e);
    m4.compose(v3.set(pt.x, pt.y, pt.z), q, s3.set(s, s, s));
    partMesh.setMatrixAt(n, m4); partMesh.setColorAt(n, PC.set(pt.col)); n++;
  }
  partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  // rain and snow fill the space between the camera and the farmer
  const wx = (cs.tx + cam.position.x) / 2, wz = (cs.tz + cam.position.z) / 2;
  if (env.rain > 0.02) for (let k = 0; k < Math.round(env.rain * 520 * dt * (1 + env.storm * 0.6)); k++) drops.push({ x: wx + (Math.random() - 0.5) * 90, y: 40 + Math.random() * 10, z: wz + (Math.random() - 0.5) * 90 });
  if (env.snow > 0.02) for (let k = 0; k < Math.round(env.snow * 130 * dt); k++) flakes.push({ x: wx + (Math.random() - 0.5) * 90, y: 42, z: wz + (Math.random() - 0.5) * 90, ph: Math.random() * 6 });
  n = 0;
  for (let k = drops.length - 1; k >= 0; k--) {
    const r = drops[k];
    r.y -= 60 * dt; r.x -= 6 * env.wind * dt;
    if (r.y < 1.5) { drops.splice(k, 1); if (Math.random() < 0.15) parts.push({ x: r.x, y: 1.5, z: r.z, vx: 0, vy: 3, vz: 0, g: 20, t: 0, life: 0.2, s: 0.25, col: '#cfe8ff' }); continue; }
    if (n < 1200) { m4.makeTranslation(r.x, r.y, r.z); rainMesh.setMatrixAt(n++, m4); }
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
  if (ghostRing.visible && (ghostRing.userData.t -= dt) <= 0) ghostRing.visible = false;
  // tutorial guide: arrow, pulsing ring and a glowing trail from the farmer
  arrow.visible = ring.visible = false; trailMesh.count = 0;
  if (guide) {
    const gx = guide.x, gz = guide.z, gy = guide.y ?? groundY(gx, gz);
    arrow.visible = true;
    arrow.position.set(gx, gy + (guide.h ?? 8) + Math.abs(Math.sin(t * 4)) * 2, gz);
    arrow.rotation.y = t * 1.2; arrow.scale.setScalar(guide.s || 1);
    ring.visible = guide.ring !== false; ring.position.set(gx, gy + 0.1, gz);
    const rs = 1 + ((t * 1.2) % 1) * 0.8; ring.scale.set(rs * (guide.r || 1), rs * (guide.r || 1), 1); ring.material.opacity = 0.9 * (1 - ((t * 1.2) % 1));
    if (guide.trail) {
      const L = Math.hypot(gx - p.x, gz - p.z);
      let m = 0;
      for (let s = 3; s < L - 3 && m < 120; s += 2.5) {
        const u = s / L, wave = (s - t * 12) % 12, sz = wave < 0 && wave > -3 ? 1.5 : 1;
        const x = p.x + (gx - p.x) * u, z = p.z + (gz - p.z) * u;
        m4.compose(v3.set(x, groundY(x, z) + 0.2, z), q.identity(), s3.set(sz, 1, sz));
        trailMesh.setMatrixAt(m++, m4);
      }
      trailMesh.count = m; trailMesh.instanceMatrix.needsUpdate = true;
    }
  }
  renderer.render(scene, cam);
}
