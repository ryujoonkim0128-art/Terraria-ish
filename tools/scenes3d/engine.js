// Low-res pixel-art renderer for side-view dioramas.
// World units are pixels: x right, y up, z toward the camera.
// Pipeline: lit 3D scene -> depth-edge ink outlines -> Bayer dither to a fixed palette.
import * as THREE from './node_modules/three/build/three.module.js';

THREE.ColorManagement.enabled = false;
export { THREE };

// ---------------------------------------------------------------- noise
export function hash(i, j, s) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) & 0xffff) / 65535;
}
export function vnoise(x, y, cell, s) {
  const fx = x / cell, fy = y / cell, i = Math.floor(fx), j = Math.floor(fy);
  let u = fx - i, v = fy - j;
  u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
  const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, cell, s, oct = 3) {
  let t = 0, amp = 1, n = 0;
  for (let o = 0; o < oct; o++) { t += vnoise(x, y, cell / 2 ** o, s + o * 17) * amp; n += amp; amp /= 2; }
  return t / n;
}
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const hex = (h) => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------------------------------------------------------------- post pass
const POST_FRAG = `
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec3 pal[64]; uniform int n; uniform vec2 res; uniform float spread; uniform vec3 ink; uniform float edge;
varying vec2 vUv;
const float B[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
void main(){
  vec2 p = 1.0 / res;
  float d = texture2D(tDepth, vUv).r;
  float m = max(max(texture2D(tDepth, vUv - vec2(p.x,0.)).r, texture2D(tDepth, vUv + vec2(p.x,0.)).r),
                max(texture2D(tDepth, vUv - vec2(0.,p.y)).r, texture2D(tDepth, vUv + vec2(0.,p.y)).r));
  if (m - d > edge) { gl_FragColor = vec4(ink, 1.); return; }
  vec3 c = texture2D(tColor, vUv).rgb;
  int bx = int(mod(gl_FragCoord.x, 4.)), by = int(mod(gl_FragCoord.y, 4.));
  c += ((B[bx + by * 4] + 0.5) / 16. - 0.5) * spread;
  float best = 1e9; vec3 bc = c;
  for (int i = 0; i < 64; i++) {
    if (i >= n) break;
    vec3 e = pal[i] - c;
    float rm = (pal[i].r + c.r) * 0.5;
    float dd = (2. + rm) * e.r * e.r + 4. * e.g * e.g + (3. - rm) * e.b * e.b;
    if (dd < best) { best = dd; bc = pal[i]; }
  }
  gl_FragColor = vec4(bc, 1.);
}`;

export class Diorama {
  constructor(W, H, { palette, spread = 0.09, ink = '#0c0a10', edge = 3 }) {
    this.W = W; this.H = H;
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(0, W, H, 0, 1, 401);
    this.cam.position.set(0, 0, 200);
    const r = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    r.setPixelRatio(1); r.setSize(W, H);
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.BasicShadowMap;
    this.r = r;
    this.rt = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(W, H),
    });
    const pal = palette.map((h) => new THREE.Color(h));
    while (pal.length < 64) pal.push(new THREE.Color(0, 0, 0));
    this.post = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture },
        pal: { value: pal }, n: { value: palette.length }, res: { value: new THREE.Vector2(W, H) },
        spread: { value: spread }, ink: { value: new THREE.Color(ink) }, edge: { value: edge / 400 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: POST_FRAG,
    });
    this.postScene = new THREE.Scene();
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mats = new Map();
  }

  mat(color, o = {}) {
    const key = color + JSON.stringify(o);
    if (!this.mats.has(key)) {
      const m = o.basic ? new THREE.MeshBasicMaterial({ color, transparent: !!o.opacity, opacity: o.opacity ?? 1, depthWrite: o.opacity ? false : true })
        : new THREE.MeshLambertMaterial({ color, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1 });
      this.mats.set(key, m);
    }
    return this.mats.get(key);
  }

  add(mesh, parent) {
    mesh.castShadow = mesh.receiveShadow = true;
    (parent || this.scene).add(mesh);
    return mesh;
  }

  // box by bottom-left corner (x, y), z = centre depth
  box(x, y, w, h, z, d, color, o = {}, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, o));
    m.position.set(x + w / 2, y + h / 2, z);
    if (o.rot) m.rotation.z = o.rot;
    return this.add(m, parent);
  }
  cyl(x, y, rTop, rBot, h, z, color, o = {}, parent) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, o.seg ?? 10), this.mat(color, o));
    m.position.set(x, y + h / 2, z);
    if (o.rot) m.rotation.z = o.rot;
    if (o.rx) m.rotation.x = o.rx;
    return this.add(m, parent);
  }
  ball(x, y, r, z, color, o = {}, parent) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg ?? 12, o.seg ?? 10), this.mat(color, o));
    m.position.set(x, y, z);
    if (o.sy) m.scale.y = o.sy;
    if (o.sx) m.scale.x = o.sx;
    return this.add(m, parent);
  }
  // prism along z from a 2D outline (pixel coords)
  prism(points, z, d, color, o = {}, parent) {
    const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    if (o.holes) o.holes.forEach((h) => s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    const m = new THREE.Mesh(g, this.mat(color, o));
    m.position.z = z - d / 2;
    return this.add(m, parent);
  }
  light(x, y, z, color = 0xffa24a, intensity = 60, dist = 90, shadow = false) {
    const l = new THREE.PointLight(color, intensity, dist, 1);
    l.position.set(x, y, z);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(256, 256); l.shadow.bias = -0.01; }
    this.scene.add(l);
    return l;
  }

  // Textured plane from a per-pixel colour function: fn(x, y) -> [r,g,b] | null (hole).
  plane(z, fn, o = {}) {
    const { W, H } = this;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = fn(x, y), i = ((H - 1 - y) * W + x) * 4;
      if (c) { img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255; }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
    tex.colorSpace = THREE.NoColorSpace;
    const mat = o.basic ? new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 })
      : new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
    m.position.set(W / 2, H / 2, z);
    m.receiveShadow = !o.basic;
    this.scene.add(m);
    return m;
  }

  snow(count, seed, z = 60, color = '#edebe3', region) {
    const R = rng(seed), pos = [];
    const [x0, y0, x1, y1] = region || [0, 0, this.W, this.H];
    for (let i = 0; i < count; i++) pos.push(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), z);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 1, sizeAttenuation: false, depthWrite: false }));
    p.renderOrder = 10;
    this.scene.add(p);
  }

  render() {
    this.r.setRenderTarget(this.rt);
    this.r.render(this.scene, this.cam);
    this.r.setRenderTarget(null);
    this.r.render(this.postScene, this.postCam);
  }
}

// ---------------------------------------------------------------- terrain masks
// A cave mask drawn with canvas paths (union for free), read back as a bitmap.
export class Mask {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.ctx = this.cv.getContext('2d');
    this.ctx.fillStyle = this.ctx.strokeStyle = '#fff';
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
  }
  Y(y) { return this.H - y; }
  // organic hand-dug room: flat floor, lumpy dome
  room(cx, floor, w, h, seed) {
    const c = this.ctx, n = 28;
    c.beginPath();
    c.moveTo(cx - w / 2, this.Y(floor));
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (1 - i / n);
      const k = 1 + (vnoise(i, 0, 3, seed) - 0.5) * 0.22;
      const sq = Math.pow(Math.abs(Math.cos(a)), 3);            // steep walls, broad dome
      const x = cx + Math.cos(a) * (w / 2) * k;
      const y = floor + Math.sin(a) * h * k * (1 - 0.15 * sq) + (i === 0 || i === n ? 4 : 0);
      c.lineTo(x, this.Y(y));
    }
    c.lineTo(cx + w / 2, this.Y(floor));
    c.closePath(); c.fill();
  }
  tunnel(pts, r) {
    const c = this.ctx;
    c.lineWidth = r * 2;
    c.beginPath(); c.moveTo(pts[0][0], this.Y(pts[0][1]));
    for (const [x, y] of pts.slice(1)) c.lineTo(x, this.Y(y));
    c.stroke();
  }
  rect(x, y, w, h) { this.ctx.fillRect(x, this.Y(y + h), w, h); }
  poly(pts) {
    const c = this.ctx; c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, this.Y(y)) : c.moveTo(x, this.Y(y))));
    c.closePath(); c.fill();
  }
  bits() {
    const d = this.ctx.getImageData(0, 0, this.W, this.H).data, W = this.W, H = this.H;
    const b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) b[y * W + x] = d[((H - 1 - y) * W + x) * 4] > 127 ? 1 : 0;
    return b;
  }
}

export function dilate(b, W, H, r) {
  let cur = b;
  for (let k = 0; k < r; k++) {
    const nx = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      nx[i] = cur[i] || (x > 0 && cur[i - 1]) || (x < W - 1 && cur[i + 1]) || (y > 0 && cur[i - W]) || (y < H - 1 && cur[i + W]) ? 1 : 0;
    }
    cur = nx;
  }
  return cur;
}

// Soil: dithered earth texture with strata, stones and an optional snow/grass cap.
export function soilFn({ W, H, ground, holes, seed = 1, bands, cap, stones = true, relics = [] }) {
  const B = bands.map((b) => ({ ...b, cols: b.cols.map(hex) }));
  const capc = cap ? cap.map(hex) : null;
  const stoneA = hex('#435374'), stoneB = hex('#2c3855'), stoneHi = hex('#5c6b88');
  return (x, y) => {
    const g = ground(x);
    if (y > g || holes[y * W + x]) return null;
    const depth = g - y;
    if (capc && depth < capc.length) return capc[depth];
    let band = B[B.length - 1];
    for (const b of B) if (y > b.above + (fbm(x, 0, 60, seed + 5) - 0.5) * 24) { band = b; break; }
    if (stones) {
      const s = vnoise(x, y, 3.2, seed + 9);
      if (s > 0.9) return s > 0.95 ? stoneHi : stoneA;
      if (s > 0.87) return stoneB;
    }
    const t = fbm(x, y, 7, seed, 3) * 0.8 + ((y >> 2) % 3 === 0 ? 0.08 : 0);
    const k = Math.min(band.cols.length - 1, Math.floor(t * band.cols.length));
    return band.cols[k];
  };
}

export { hex, lerp3 };
