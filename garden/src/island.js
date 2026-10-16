// The sky island: the land your garden and the market sit on, its cliffs and underside, a pond spilling over the
// edge as a waterfall, little islets bobbing nearby, clouds drifting past, and a sea of cloud far below.
import { Vox, mesh, chunks, hash, shade, mixc, rng } from './voxel.js';

const T = window.THREE;

// smooth value noise in [0, 1]
export function vnoise(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(xi, zi, s), b = hash(xi + 1, zi, s), c = hash(xi, zi + 1, s), d = hash(xi + 1, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// three rounded lobes run together: your garden, a neck for the path, the market plaza
const LOBES = [
  { x: 0, z: 4, ax: 52, az: 52, p: 2.4 },
  { x: 0, z: -40, ax: 28, az: 14, p: 2.2 },
  { x: 0, z: -71, ax: 60, az: 38, p: 2.6 },
];
// how far out a point is: under 1 on the island, 1 at the coast
export function islandS(x, z) {
  let s = Infinity;
  for (const L of LOBES) s = smin(s, Math.pow(Math.pow(Math.abs(x - L.x) / L.ax, L.p) + Math.pow(Math.abs(z - L.z) / L.az, L.p), 1 / L.p), 0.3);
  return s * (1 + (vnoise(x / 16, z / 16, 21) - 0.5) * 0.16 + (vnoise(x / 6, z / 6, 22) - 0.5) * 0.07);
}

// one cell per voxel column over a 256-square: how deep the rock goes under each cell (-1 off the island)
export const N = 256, H = N / 2;
const D = new Int16Array(N * N).fill(-1);
// chunky stalactites: on a coarse grid, now and then a rounded spike hangs below the rock
function spike(x, z) {
  const gx = Math.floor(x / 5), gz = Math.floor(z / 5);
  let best = 0;
  for (let i = gx - 1; i <= gx + 1; i++) for (let k = gz - 1; k <= gz + 1; k++) {
    if (hash(i, k, 31) > 0.16) continue;
    const cx = i * 5 + 2 + hash(i, k, 33) * 2, cz = k * 5 + 2 + hash(i, k, 34) * 2, r = 1.6 + hash(i, k, 35) * 1.4;
    const q = Math.hypot(x - cx, z - cz) / r;
    if (q < 1) best = Math.max(best, (5 + hash(i, k, 32) * 14) * (1 - q * q));
  }
  return best;
}
for (let z = -H; z < H; z++) for (let x = -H; x < H; x++) {
  const s = islandS(x, z);
  if (s >= 1) continue;
  const t = 1 - s;
  D[(z + H) * N + x + H] = Math.max(1, Math.round(2 + 50 * Math.pow(t, 1.3) + (vnoise(x / 9, z / 9, 23) - 0.5) * 5 + (t > 0.15 ? spike(x, z) : 0)));
}
const depth = (x, z) => (x < -H || z < -H || x >= H || z >= H ? -1 : D[(z + H) * N + x + H]);
export const landAt = (x, z) => depth(Math.round(x), Math.round(z)) >= 0;

// the pond beside your garden, and the stream that carries it over the east edge
export const POND = { x: 44, z: 8, rx: 6, rz: 4.5 };
let coast = POND.x;
while (landAt(coast + 1, POND.z)) coast++;
export const water = (x, z) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2 < 1 || (x >= POND.x && x <= coast && Math.abs(z - POND.z) <= 1.5);
export const FALLS = { x: coast + 0.5, z: POND.z, w: 4, h: 76 };

// soil and stone under the grass: a green lip, a band of earth, then warm sandy rock in stripes that turns lilac deep down
function rock(x, y, z, d) {
  if (y === 0) return shade('#5aa848', 0.92 + hash(x, z, 41) * 0.14);
  if (y >= -4) return shade(hash(x, y, z) < 0.3 ? '#8a5a38' : '#9c6a42', 0.95 + hash(x, z, 42) * 0.1);
  if (y === -d && d > 24 && hash(x, z, 43) < 0.12) return hash(x, z, 44) < 0.5 ? '#c99aff' : '#8ae8ff';
  if (y > -10 && hash(x, y + 300, z) < 0.14) return '#78a850';
  const c = mixc('#c8b294', '#9890b8', Math.min(1, (-y - 4) / 46));
  return shade(c, ((y + 1000) / 3 | 0) & 1 ? 0.94 : 1.02);
}
// the island under the ground: only the rock that can be seen (the sides of columns that drop below a neighbour, and every
// bottom), with the rest of the column counted as solid so no hidden faces are made
function underside() {
  const V = new Vox(rng(5));
  for (let z = -H; z < H; z++) for (let x = -H; x < H; x++) {
    const d = depth(x, z);
    if (d < 0) continue;
    let dn = Infinity;
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) dn = Math.min(dn, depth(x + ax, z + az));
    const top = dn < 0 ? 0 : Math.max(-d, -dn - 1);
    for (let y = -d; y <= top; y++) V.set(x, y, z, rock(x, y, z, d), 0.03);
    // vines hanging off the edge
    if (dn < 0 && hash(x, z, 45) < 0.07) {
      const L = 3 + Math.floor(hash(x, z, 46) * 9);
      for (let k = 1; k <= L; k++) { V.set(x, -d - k, z, '#4f9a3c', 0.08); if (k % 2 === 0 && hash(x, k, z) < 0.5) V.set(x + (hash(x, z, k) < 0.5 ? 1 : -1), -d - k, z, '#6cc25a', 0.08); }
    }
  }
  const solid = (x, y, z) => { const d = depth(x, z); return d >= 0 && y <= 1 && y >= -d; };
  return chunks(V, 48, { solid });
}

// a little islet: a grassy disc on a rocky cone, with a blossom tree, a clump of flowers or a few stones on top
function islet(seed, r, deco) {
  const R = rng(seed), V = new Vox(R);
  for (let x = -r - 2; x <= r + 2; x++) for (let z = -r - 2; z <= r + 2; z++) {
    const q = Math.hypot(x, z) / (r * (0.85 + vnoise(x / 3 + seed, z / 3, 51) * 0.3));
    if (q >= 1) continue;
    const d = Math.max(1, Math.round((1 - q) ** 1.2 * r * 1.4 + hash(x, z, seed) * 2));
    V.set(x, 0, z, shade('#6cc25a', 0.9 + hash(x, z, 52) * 0.2), 0.03);
    for (let y = -1; y >= -d; y--) V.set(x, y, z, rock(x, y < -2 ? y - 6 : y, z, d), 0.03);
    if (deco === 'flowers' && hash(x, z, 53) < 0.35 && q < 0.8) V.set(x, 1, z, ['#ffffff', '#ffd84e', '#ff8ab0', '#a8c8ff'][(hash(x, z, 54) * 4) | 0], 0);
  }
  if (deco === 'tree') {
    const h = 5 + ((R() * 3) | 0);
    for (let y = 1; y <= h; y++) V.set(0, y, 0, '#8a5a3a', 0.04);
    const pink = R() < 0.6;
    for (const [bx, by, bz, br] of [[0, h + 2, 0, 3.2], [2, h + 1, 1, 2.2], [-2, h + 1, -1, 2.2], [1, h + 3, -2, 2]]) V.ball(bx, by, bz, br, (x, y) => (pink ? (y > 0 ? '#ffc6dc' : '#ff9cc4') : y > 0 ? '#9fe08a' : '#6cc25a'), 1, 0.06);
  }
  if (deco === 'rocks') for (let k = 0; k < 4; k++) { const x = Math.round((R() - 0.5) * r), z = Math.round((R() - 0.5) * r); V.box(x, 1, z, x + 1, 1 + ((R() * 2) | 0), z, '#9a948e', 0.06); }
  return mesh(V);
}
// a puffy cloud built from overlapping balls, a little grey underneath
function cloudGeo(seed) {
  const R = rng(seed), V = new Vox(R);
  const n = 3 + ((R() * 4) | 0);
  for (let k = 0; k < n; k++) {
    const cx = (k - n / 2) * 3 + (R() - 0.5) * 3, r = 2.5 + R() * 2.5;
    V.ball(Math.round(cx), Math.round((R() - 0.3) * 2), Math.round((R() - 0.5) * 3), r, (x, y) => (y < -r * 0.35 ? '#e4ebf6' : '#ffffff'), 0.65, 0.01);
  }
  return mesh(V, { scale: 2.4, ao: false });
}
// a tiling texture for the cloud sea: billowing white tops with soft blue-grey hollows between them
function cloudSeaTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = rng(77);
  g.fillStyle = '#9ec6ec'; g.fillRect(0, 0, S, S);
  const blob = (x, y, r, col, a) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(0.6, `rgba(${col},${a * 0.7})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  };
  for (let k = 0; k < 70; k++) blob(R() * S, R() * S, 18 + R() * 30, '200,220,240', 0.8);
  for (let k = 0; k < 110; k++) blob(R() * S, R() * S, 10 + R() * 22, '255,255,255', 0.75 + R() * 0.25);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(14, 14); tex.encoding = T.sRGBEncoding;
  return tex;
}
// falling water: streaks of white on blue, scrolled down every frame
function fallsTex() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64;
  const g = c.getContext('2d'), R = rng(9);
  g.fillStyle = '#5ab4f0'; g.fillRect(0, 0, 16, 64);
  for (let k = 0; k < 26; k++) { g.fillStyle = R() < 0.5 ? '#bfe6ff' : '#e8f7ff'; g.fillRect((R() * 16) | 0, (R() * 64) | 0, 1 + ((R() * 2) | 0), 6 + ((R() * 14) | 0)); }
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.NearestFilter; tex.encoding = T.sRGBEncoding; tex.repeat.set(1, 4);
  return tex;
}

const ISLETS = [
  { x: 92, y: 10, z: -60, r: 9, deco: 'tree' }, { x: -96, y: -6, z: -96, r: 7, deco: 'flowers' }, { x: 58, y: 22, z: -150, r: 6, deco: 'rocks' },
  { x: -70, y: 16, z: -170, r: 10, deco: 'tree' }, { x: 104, y: -14, z: 28, r: 6, deco: 'flowers' }, { x: -88, y: 4, z: 30, r: 8, deco: 'tree' },
  { x: 10, y: 30, z: -205, r: 8, deco: 'tree' },
];
export function buildIsland(scene, mat) {
  for (const g of underside()) scene.add(new T.Mesh(g, mat));
  const bobbers = ISLETS.map((o, i) => { const m = new T.Mesh(islet(100 + i, o.r, o.deco), mat); m.position.set(o.x, o.y, o.z); m.castShadow = true; scene.add(m); return { m, o, ph: i * 1.7 }; });
  const clouds = [];
  for (let k = 0; k < 26; k++) {
    const R = rng(200 + k), a = R() * Math.PI * 2, low = k >= 14, d = low ? 40 + R() * 160 : 110 + R() * 170;
    const m = new T.Mesh(cloudGeo(300 + k), mat);
    m.position.set(Math.cos(a) * d, low ? -62 + R() * 18 : -40 + R() * 64, -40 + Math.sin(a) * d);
    clouds.push({ m, v: 1 + R() * 2 }); scene.add(m);
  }
  const sea = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshLambertMaterial({ map: cloudSeaTex(), emissive: 0x5a6e88, emissiveIntensity: 0.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -72; scene.add(sea);
  const ftex = fallsTex();
  const falls = new T.Mesh(new T.PlaneGeometry(FALLS.w, FALLS.h), new T.MeshBasicMaterial({ map: ftex, side: T.DoubleSide }));
  falls.rotation.y = Math.PI / 2; falls.position.set(FALLS.x, 1 - FALLS.h / 2, FALLS.z); scene.add(falls);
  return (dt, t, light) => {
    for (const b of bobbers) b.m.position.y = b.o.y + Math.sin(t * 0.45 + b.ph) * 1.4;
    for (const c of clouds) { c.m.position.x += c.v * dt; if (c.m.position.x > 300) c.m.position.x -= 600; }
    sea.material.map.offset.x += dt * 0.0035;
    ftex.offset.y += dt * 1.6;
    falls.material.color.setScalar(0.55 + 0.45 * light);
  };
}
