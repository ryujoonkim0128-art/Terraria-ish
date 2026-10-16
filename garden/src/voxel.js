// Voxel sets and a greedy-free face mesher with baked ambient occlusion and vertex colours.
const T = window.THREE;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(x, y = 0, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hex = (s) => (typeof s === 'number' ? s : parseInt(s.slice(1), 16));
export function shade(c, k) {
  c = hex(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f(c >> 16) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}
export function mixc(a, b, t) {
  a = hex(a); b = hex(b);
  const m = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

const key = (x, y, z) => ((x + 512) << 20) | ((y + 512) << 10) | (z + 512);
export class Vox {
  constructor(R = Math.random) { this.m = new Map(); this.R = R; }
  set(x, y, z, c, jit = 0.05) {
    if (c == null) return;
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    c = hex(c);
    if (jit) c = shade(c, 1 + (this.R() - 0.5) * jit * 2);
    this.m.set(key(x, y, z), [x, y, z, c]);
  }
  del(x, y, z) { this.m.delete(key(Math.round(x), Math.round(y), Math.round(z))); }
  has(x, y, z) { return this.m.has(key(x, y, z)); }
  get(x, y, z) { const v = this.m.get(key(x, y, z)); return v ? v[3] : null; }
  box(x0, y0, z0, x1, y1, z1, c, jit) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c, jit); }
  ball(cx, cy, cz, r, c, sy = 1, jit) {
    const ri = Math.ceil(r), ry = Math.ceil(r * sy);
    for (let x = -ri; x <= ri; x++) for (let y = -ry; y <= ry; y++) for (let z = -ri; z <= ri; z++) {
      const d = (x * x + (y / sy) * (y / sy) + z * z) / (r * r);
      if (d <= 1) this.set(cx + x, cy + y, cz + z, typeof c === 'function' ? c(x, y, z, d) : c, jit);
    }
  }
  // recolour every voxel
  map(fn) { for (const v of this.m.values()) v[3] = fn(v[3], v); return this; }
  clone() { const o = new Vox(this.R); for (const [k, v] of this.m) o.m.set(k, v.slice()); return o; }
  bounds() {
    let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9];
    for (const [x, y, z] of this.m.values()) { a = [Math.min(a[0], x), Math.min(a[1], y), Math.min(a[2], z)]; b = [Math.max(b[0], x), Math.max(b[1], y), Math.max(b[2], z)]; }
    return [a, b];
  }
}

// Each face: outward normal, the 4 unit-cube corners (counter-clockwise from outside), and a baked face shade.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.9 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.9 },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], s: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.62 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.84 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.84 },
];
const AO = [0.5, 0.68, 0.84, 1];
const lin = new Map();
function linear(c) {
  let v = lin.get(c);
  if (!v) { const col = new T.Color(c).convertSRGBToLinear(); v = [col.r, col.g, col.b]; lin.set(c, v); }
  return v;
}
// opts.offset shifts voxel coords (e.g. [-0.5, 0, -0.5] centres column 0); opts.scale scales the result
export function mesh(vox, opts = {}) {
  const off = opts.offset || [-0.5, 0, -0.5], sc = opts.scale || 1, ao = opts.ao !== false;
  const pos = [], nor = [], col = [], idx = [];
  const occ = (x, y, z) => vox.m.has(key(x, y, z));
  for (const [x, y, z, c] of vox.m.values()) {
    const base = linear(c);
    for (const f of FACES) {
      const [nx, ny, nz] = f.n;
      if (occ(x + nx, y + ny, z + nz)) continue;
      const v0 = pos.length / 3;
      const aos = [];
      for (const cr of f.c) {
        pos.push((x + cr[0] + off[0]) * sc, (y + cr[1] + off[1]) * sc, (z + cr[2] + off[2]) * sc);
        nor.push(nx, ny, nz);
        let a = 3;
        if (ao) {
          // the two tangent directions this corner leans toward
          const d = [cr[0] * 2 - 1, cr[1] * 2 - 1, cr[2] * 2 - 1];
          const t = [0, 1, 2].filter((i) => f.n[i] === 0);
          const ax = [0, 0, 0], bx = [0, 0, 0];
          ax[t[0]] = d[t[0]]; bx[t[1]] = d[t[1]];
          const s1 = occ(x + nx + ax[0], y + ny + ax[1], z + nz + ax[2]) ? 1 : 0;
          const s2 = occ(x + nx + bx[0], y + ny + bx[1], z + nz + bx[2]) ? 1 : 0;
          const s3 = occ(x + nx + ax[0] + bx[0], y + ny + ax[1] + bx[1], z + nz + ax[2] + bx[2]) ? 1 : 0;
          a = s1 && s2 ? 0 : 3 - (s1 + s2 + s3);
        }
        aos.push(a);
        const k = AO[a] * f.s;
        col.push(base[0] * k, base[1] * k, base[2] * k);
      }
      if (aos[0] + aos[2] < aos[1] + aos[3]) idx.push(v0 + 1, v0 + 2, v0 + 3, v0 + 1, v0 + 3, v0);
      else idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// ---- instanced batches: each frame, objects are re-added by geometry key
const _m = new T.Matrix4(), _c = new T.Color();
export class Batcher {
  constructor(scene, material, opts = {}) { this.scene = scene; this.mat = material; this.b = new Map(); this.shadow = opts.shadow !== false; }
  begin() { for (const b of this.b.values()) b.n = 0; }
  add(k, geoFn, matrix, color) {
    let b = this.b.get(k);
    if (!b) { b = { geo: geoFn(), mesh: null, cap: 0, n: 0 }; this.b.set(k, b); }
    if (b.n >= b.cap) this.grow(b);
    b.mesh.setMatrixAt(b.n, matrix);
    b.mesh.setColorAt(b.n, color || _c.setRGB(1, 1, 1));
    b.n++;
  }
  grow(b) {
    const cap = Math.max(8, b.cap * 2), m = new T.InstancedMesh(b.geo, this.mat, cap);
    m.castShadow = this.shadow; m.receiveShadow = true;
    m.frustumCulled = false;
    if (b.mesh) { for (let i = 0; i < b.n; i++) { b.mesh.getMatrixAt(i, _m); m.setMatrixAt(i, _m); b.mesh.getColorAt(i, _c); m.setColorAt(i, _c); } this.scene.remove(b.mesh); b.mesh.dispose(); }
    else m.setColorAt(0, _c.setRGB(1, 1, 1));
    this.scene.add(m);
    b.mesh = m; b.cap = cap;
  }
  end() {
    for (const b of this.b.values()) {
      if (!b.mesh) continue;
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }
  }
}
