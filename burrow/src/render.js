// Drawing the world: tile textures, the sky, the light map and the WebGL pass that multiplies the
// scene by Bayer-dithered light.
import { T, TILES, ROOMS, OBJ, TILE } from './content.js';
import { W, H } from './world.js';
import { canvas, hash2, noise2, shade, mix, clamp } from './util.js';

export const VW = 480, VH = 270;

// ---------- tile textures ----------
function tex(base, fn, n = 4) {
  const out = [];
  for (let v = 0; v < n; v++) {
    const [c, x] = canvas(8, 8);
    x.fillStyle = base; x.fillRect(0, 0, 8, 8);
    fn(x, v, (a, b, col) => { x.fillStyle = col; x.fillRect(a, b, 1, 1); });
    out.push(c);
  }
  return out;
}
function speckle(cols, dens, seed) {
  return (x, v, p) => {
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const h = hash2(i + v * 8, j, seed);
      if (h < dens) p(i, j, cols[Math.floor(hash2(i, j + v * 8, seed + 1) * cols.length)]);
    }
  };
}
const DIRT = '#3d2619', DIRT_D = '#2f1c12', DIRT_L = '#4c3020';
const BACK = '#563726';

export class Terrain {
  constructor() {
    this.tex = {};
    this.tex[T.DIRT] = tex(DIRT, speckle([DIRT_D, DIRT_L, '#56392a'], 0.16, 1));
    this.tex[T.TOPSOIL] = this.tex[T.DIRT];
    this.tex[T.CLAY] = tex('#5a3424', speckle(['#6a3e2a', '#4a2a1c', '#7a4a30'], 0.2, 2));
    this.tex[T.STONE] = tex('#46424c', (x, v, p) => {
      speckle(['#3a3640', '#56525c'], 0.2, 3)(x, v, p);
      x.fillStyle = '#5e5a66'; x.fillRect(1 + v, 1, 3, 1); x.fillStyle = '#2e2b33'; x.fillRect(v % 3 + 3, 5, 3, 1);
    });
    this.tex[T.IRON] = tex('#46424c', (x, v, p) => {
      speckle(['#3a3640', '#56525c'], 0.2, 4)(x, v, p);
      for (const [a, b] of [[2, 2], [5, 4], [3, 6], [6, 1]]) { p((a + v) % 8, b, '#c87a42'); p((a + v + 1) % 8, b, '#8a4a2a'); }
    });
    this.tex[T.CRYSTAL] = tex('#3a3644', (x, v, p) => {
      speckle(['#2e2a36', '#4a4656'], 0.2, 5)(x, v, p);
      x.fillStyle = '#4ab0e0'; x.fillRect(2 + (v & 1), 2, 2, 4); x.fillRect(5, 3 + (v >> 1), 1, 3);
      x.fillStyle = '#bff0ff'; x.fillRect(2 + (v & 1), 2, 1, 2);
    });
    this.tex[T.BEDROCK] = tex('#17131a', speckle(['#211c25', '#0e0b10'], 0.3, 6));
    this.tex[T.FLOOR] = tex('#7a4b2a', (x, v) => {
      x.fillStyle = '#9a643a'; x.fillRect(0, 0, 8, 1);
      x.fillStyle = '#5a341c'; x.fillRect(0, 3, 8, 1); x.fillRect((v * 3) % 8, 0, 1, 3); x.fillRect((v * 3 + 4) % 8, 4, 1, 4);
      x.fillStyle = '#3a2214'; x.fillRect(0, 7, 8, 1);
    });
    this.back = tex(BACK, speckle(['#4a2e1f', '#62402c', '#4e3222'], 0.22, 7));
    this.rooms = {};
    for (const k in ROOMS) this.rooms[k] = this.wallpaper(ROOMS[k]);
  }

  wallpaper(R) {
    const [a, b, c] = R.wall;
    switch (R.pattern) {
      case 'logs': return tex(a, (x, v) => { x.fillStyle = b; x.fillRect(0, 0, 8, 3); x.fillStyle = c; x.fillRect(0, 3, 8, 1); x.fillRect(0, 7, 8, 1); x.fillStyle = shade(b, 0.12); x.fillRect(v * 2, 1, 2, 1); });
      case 'stripes': return tex(a, (x) => { x.fillStyle = b; x.fillRect(0, 0, 2, 8); x.fillRect(4, 0, 1, 8); x.fillStyle = c; x.fillRect(6, 3, 1, 1); });
      case 'tiles': return tex(a, (x, v) => { x.fillStyle = b; x.fillRect(0, 0, 7, 3); x.fillRect(0, 4, 3, 3); x.fillRect(4, 4, 3, 3); x.fillStyle = c; x.fillRect(7, 0, 1, 8); x.fillRect(0, 3, 8, 1); x.fillRect(0, 7, 8, 1); x.fillRect(3, 4, 1, 3); if (v === 1) { x.fillStyle = shade(b, 0.15); x.fillRect(1, 1, 2, 1); } });
      case 'roots': return tex(a, (x, v) => { speckle([b, c], 0.2, 9)(x, v, (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); }); x.fillStyle = '#5a4a30'; if (v & 1) { x.fillRect(2, 0, 1, 4); x.fillRect(3, 4, 1, 3); } });
      case 'planks': return tex(a, (x, v) => { x.fillStyle = b; x.fillRect(0, 0, 3, 8); x.fillStyle = c; x.fillRect(3, 0, 1, 8); x.fillRect(7, 0, 1, 8); x.fillRect(4 + (v & 1), 2 + v, 1, 1); });
      case 'panels': return tex(a, (x) => { x.fillStyle = b; x.fillRect(1, 1, 6, 6); x.fillStyle = c; x.fillRect(1, 6, 6, 1); x.fillRect(6, 1, 1, 6); });
      default: return tex(a, () => {});
    }
  }

  // Draw visible tiles into ctx. cam is in pixels.
  draw(x2d, w, cam) {
    const tx0 = Math.max(0, Math.floor(cam.x / TILE)), ty0 = Math.max(0, Math.floor(cam.y / TILE));
    const tx1 = Math.min(W - 1, Math.floor((cam.x + VW) / TILE)), ty1 = Math.min(H - 1, Math.floor((cam.y + VH) / TILE));
    const ox = -Math.round(cam.x), oy = -Math.round(cam.y);
    const fg = w.fg, bg = w.bg;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * W + x, t = fg[i], px = x * 8 + ox, py = y * 8 + oy;
      const v = (hash2(x, y) * 4) | 0;
      if (TILES[t].solid) {
        x2d.drawImage(this.tex[t][v], px, py);
        if (t === T.DIRT || t === T.TOPSOIL) {
          const d = y - w.surface[x], h = hash2(x, y, 77);
          if (d < 5 && h < 0.22) { x2d.fillStyle = '#6a4a30'; x2d.fillRect(px + (h * 30 | 0) % 6, py, 1, 3); x2d.fillRect(px + (h * 30 | 0) % 6 + 1, py + 3, 1, 3); x2d.fillRect(px + (h * 30 | 0) % 6 + 2, py + 6, 1, 2); }
          else if (h > 0.93) { x2d.fillStyle = '#5c4a40'; x2d.fillRect(px + 2, py + 3, 3, 2); x2d.fillStyle = '#76655a'; x2d.fillRect(px + 2, py + 3, 2, 1); }
          else if (d > 12 && h > 0.925 && h < 0.93) { x2d.fillStyle = '#d8ccb0'; x2d.fillRect(px + 1, py + 4, 6, 1); x2d.fillRect(px, py + 3, 2, 3); x2d.fillRect(px + 6, py + 3, 2, 3); }
        }
      }
      else if (bg[i] === 2) { const r = w.rooms[w.roomAt[i]]; x2d.drawImage(this.rooms[r.type][v], px, py); }
      else if (bg[i] === 1) x2d.drawImage(this.back[v], px, py);
    }
    // carved edges: shadows inside open cells, lips on solid cells, rounded corners, snow on top
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      const i = y * W + x, t = fg[i], px = x * 8 + ox, py = y * 8 + oy;
      const sU = w.solid(x, y - 1), sD = w.solid(x, y + 1), sL = w.solid(x - 1, y), sR = w.solid(x + 1, y);
      if (TILES[t].solid) {
        if (!sU && bg[i - W] === 0 && t !== T.FLOOR) {
          // snow cap
          x2d.fillStyle = '#e8eef6'; x2d.fillRect(px, py, 8, 2);
          x2d.fillStyle = '#b9c6d8'; x2d.fillRect(px + ((x * 3) % 5), py + 2, 3, 1);
          continue;
        }
        if (t === T.FLOOR) continue;
        const lip = shade(t === T.STONE || t === T.IRON || t === T.CRYSTAL ? '#46424c' : t === T.CLAY ? '#5a3424' : DIRT, 0.18);
        x2d.fillStyle = lip;
        if (!sU) x2d.fillRect(px, py, 8, 1);
        if (!sL) x2d.fillRect(px, py, 1, 8);
        if (!sR) x2d.fillRect(px + 7, py, 1, 8);
        if (!sD) { x2d.fillStyle = shade(lip, -0.35); x2d.fillRect(px, py + 7, 8, 1); }
        // convex corners: carve them round
        const cut = (cx, cy, dx, dy, nx, ny) => {
          const ni = ny * W + nx;
          const col = w.inb(nx, ny) && bg[ni] === 2 ? null : w.inb(nx, ny) && bg[ni] === 1 ? BACK : 'clear';
          if (col === null) return;
          for (const [a, b] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]) {
            const qx = cx + (dx < 0 ? a : 7 - a), qy = cy + (dy < 0 ? b : 7 - b);
            if (col === 'clear') x2d.clearRect(qx, qy, 1, 1); else { x2d.fillStyle = col; x2d.fillRect(qx, qy, 1, 1); }
          }
        };
        if (!sU && !sL) cut(px, py, -1, -1, x, y - 1);
        if (!sU && !sR) cut(px, py, 1, -1, x, y - 1);
        if (!sD && !sL && bg[i] !== 2) cut(px, py, -1, 1, x, y + 1);
        if (!sD && !sR && bg[i] !== 2) cut(px, py, 1, 1, x, y + 1);
      } else if (bg[i] !== 0) {
        x2d.fillStyle = 'rgba(10,5,3,0.45)';
        if (sU) x2d.fillRect(px, py, 8, 2);
        if (sL) x2d.fillRect(px, py, 2, 8);
        if (sR) x2d.fillRect(px + 6, py, 2, 8);
        // concave corners filled in a little
        const fill = (dx, dy, ax, ay) => {
          const tt = fg[(y + ay) * W + (x + ax)];
          x2d.fillStyle = tt === T.FLOOR ? '#7a4b2a' : TILES[tt].solid && tt !== T.STONE && tt !== T.IRON && tt !== T.CRYSTAL ? DIRT : '#46424c';
          for (const [a, b] of [[0, 0], [1, 0], [0, 1]]) x2d.fillRect(px + (dx < 0 ? a : 7 - a), py + (dy < 0 ? b : 7 - b), 1, 1);
        };
        if (sU && sL && w.solid(x - 1, y - 1)) fill(-1, -1, -1, -1);
        if (sU && sR && w.solid(x + 1, y - 1)) fill(1, -1, 1, -1);
      }
    }
  }

  // Wooden frames inside finished rooms: posts, a ceiling beam and corner braces.
  drawRoomFrames(x2d, w, cam) {
    const ox = -Math.round(cam.x), oy = -Math.round(cam.y);
    for (const r of w.rooms) {
      if (r.state !== 'done') continue;
      const x0 = r.x * 8 + ox, y0 = r.y * 8 + oy, x1 = (r.x + r.w) * 8 + ox, y1 = (r.y + r.h) * 8 + oy;
      if (x1 < 0 || x0 > VW || y1 < 0 || y0 > VH) continue;
      const beam = '#6a4428', dark = '#3e2616';
      x2d.fillStyle = beam;
      x2d.fillRect(x0 + 8, y0, x1 - x0 - 16, 2);
      x2d.fillRect(x0, y0 + 8, 2, y1 - y0 - 8); x2d.fillRect(x1 - 2, y0 + 8, 2, y1 - y0 - 8);
      x2d.fillStyle = dark;
      x2d.fillRect(x0 + 8, y0 + 2, x1 - x0 - 16, 1);
      x2d.fillRect(x0 + 2, y0 + 8, 1, y1 - y0 - 8); x2d.fillRect(x1 - 3, y0 + 8, 1, y1 - y0 - 8);
      x2d.fillStyle = beam;
      for (let k = 0; k < 6; k++) { x2d.fillRect(x0 + 2 + k, y0 + 8 + 5 - k, 2, 1); x2d.fillRect(x1 - 4 - k, y0 + 8 + 5 - k, 2, 1); }
      for (let px = x0 + 24; px < x1 - 16; px += 32) { x2d.fillStyle = dark; x2d.fillRect(px, y0, 2, 3); }
    }
  }

  drawLadders(x2d, w, cam) {
    const tx0 = Math.max(0, Math.floor(cam.x / TILE)), ty0 = Math.max(0, Math.floor(cam.y / TILE));
    const tx1 = Math.min(W - 1, Math.floor((cam.x + VW) / TILE)), ty1 = Math.min(H - 1, Math.floor((cam.y + VH) / TILE));
    const ox = -Math.round(cam.x), oy = -Math.round(cam.y);
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      if (!w.ladder[y * W + x] || w.solid(x, y)) continue;
      const px = x * 8 + ox, py = y * 8 + oy;
      x2d.fillStyle = '#3a2414'; x2d.fillRect(px + 1, py, 1, 8); x2d.fillRect(px + 6, py, 1, 8);
      x2d.fillStyle = '#a0703e'; x2d.fillRect(px + 2, py, 1, 8); x2d.fillRect(px + 5, py, 1, 8);
      x2d.fillStyle = '#c8945a'; x2d.fillRect(px + 2, py + 2, 4, 1); x2d.fillRect(px + 2, py + 6, 4, 1);
    }
  }
}

// ---------- sky ----------
export function daylight(t) {
  const s = Math.sin((t - 0.25) * Math.PI * 2);
  return clamp((s + 0.12) / 0.32, 0, 1);
}
export function ambient(t) {
  const d = daylight(t), s = Math.sin((t - 0.25) * Math.PI * 2);
  const dusk = clamp(1 - Math.abs(s) / 0.3, 0, 1) * 0.9;
  const night = [0.2, 0.25, 0.46], day = [1.06, 1.03, 0.98], warm = [1.0, 0.62, 0.42];
  const c = night.map((v, i) => v + (day[i] - v) * d);
  return c.map((v, i) => v + (warm[i] - v) * dusk * 0.6);
}

export class Sky {
  constructor(seed) {
    this.stars = [];
    for (let i = 0; i < 140; i++) this.stars.push({ x: hash2(i, 1, seed) * VW * 1.6, y: hash2(i, 2, seed) * 190, b: hash2(i, 3, seed), tw: hash2(i, 4, seed) * 6.28 });
    this.night = [0, 1, 2].map((k) => this.ridge(seed + k * 17, k, ['#1c2440', '#162034', '#111a28'][k]));
    this.dayL = [0, 1, 2].map((k) => this.ridge(seed + k * 17, k, ['#9ab4d0', '#7d9cb8', '#5f809c'][k]));
  }
  ridge(seed, k, col) {
    const wpx = 900;
    const [c, x] = canvas(wpx, 120);
    for (let i = 0; i < wpx; i++) {
      let h;
      if (k === 0) h = 50 + noise2(i * 0.006, 0, seed) * 50 + noise2(i * 0.03, 0, seed) * 10;
      else {
        h = 28 + noise2(i * 0.01, 0, seed) * 30;
        const tree = (i * 7 + seed * 13) % (k === 1 ? 9 : 7);
        if (tree < 5) h += [6, 12, 18, 12, 6][tree] * (k === 1 ? 0.8 : 1.2) * (0.6 + hash2(Math.floor(i / 9), k, seed));
      }
      x.fillStyle = col; x.fillRect(i, 120 - h, 1, h);
      if (k === 0) { x.fillStyle = '#e8eef6'; x.globalAlpha = 0.12; x.fillRect(i, 120 - h, 1, 2); x.globalAlpha = 1; }
    }
    return c;
  }
  // The backdrop canvas: gradient, stars, moon/sun, distant hills. groundY is the screen y of the horizon.
  draw(x2d, t, cam, time, groundY, fillY) {
    const d = daylight(t), s = Math.sin((t - 0.25) * Math.PI * 2);
    const dusk = clamp(1 - Math.abs(s) / 0.3, 0, 1);
    const top = mix(mix('#070a1c', '#5a8ec8', d), '#3a2a5a', dusk * 0.5);
    const bot = mix(mix('#1c2650', '#bcdcf0', d), '#e08a6a', dusk * 0.7);
    const g = x2d.createLinearGradient(0, 0, 0, Math.max(40, groundY));
    g.addColorStop(0, top); g.addColorStop(1, bot);
    x2d.fillStyle = g; x2d.fillRect(0, 0, VW, VH);
    // stars
    const sa = 1 - d;
    if (sa > 0.02) for (const st of this.stars) {
      const sx = ((st.x - cam.x * 0.05) % (VW * 1.6) + VW * 1.6) % (VW * 1.6), sy = st.y - cam.y * 0.05;
      if (sx > VW || sy > groundY) continue;
      const a = sa * (0.4 + 0.6 * st.b) * (0.6 + 0.4 * Math.sin(time * 2 + st.tw));
      x2d.fillStyle = `rgba(255,248,230,${a})`;
      x2d.fillRect(Math.round(sx), Math.round(sy), 1, 1);
      if (st.b > 0.93) { x2d.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); x2d.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); }
    }
    // aurora on clear nights
    if (sa > 0.3) {
      for (let i = 0; i < VW; i += 2) {
        const yy = 40 + Math.sin(i * 0.013 + time * 0.2) * 14 + Math.sin(i * 0.031 - time * 0.13) * 6 - cam.y * 0.05;
        const a = (sa - 0.3) * 0.18 * (0.5 + 0.5 * Math.sin(i * 0.02 + time * 0.4));
        x2d.fillStyle = `rgba(110,240,190,${a})`; x2d.fillRect(i, yy, 2, 18);
        x2d.fillStyle = `rgba(140,120,255,${a * 0.6})`; x2d.fillRect(i, yy - 8, 2, 8);
      }
    }
    // sun and moon on an arc
    const ang = (t - 0.25) * Math.PI * 2;
    const bx = VW / 2 - Math.cos(ang) * VW * 0.42, by = groundY + 10 - Math.sin(ang) * (groundY + 10 - 30);
    if (by < groundY + 10) {
      x2d.fillStyle = 'rgba(255,230,160,0.25)'; x2d.beginPath(); x2d.arc(bx, by, 14, 0, 7); x2d.fill();
      x2d.fillStyle = '#fff0b0'; x2d.beginPath(); x2d.arc(bx, by, 7, 0, 7); x2d.fill();
    }
    const mx = VW / 2 + Math.cos(ang) * VW * 0.42, my = groundY + 10 + Math.sin(ang) * (groundY + 10 - 30);
    if (my < groundY + 10) {
      for (let r = 26; r > 9; r -= 4) { x2d.fillStyle = `rgba(220,230,255,${0.05})`; x2d.beginPath(); x2d.arc(mx, my, r, 0, 7); x2d.fill(); }
      x2d.fillStyle = '#f4f0e0'; x2d.beginPath(); x2d.arc(mx, my, 8, 0, 7); x2d.fill();
      x2d.fillStyle = '#d8d2c0'; x2d.fillRect(Math.round(mx) - 3, Math.round(my) - 2, 2, 2); x2d.fillRect(Math.round(mx) + 2, Math.round(my) + 2, 3, 2);
    }
    // ridges
    for (let k = 0; k < 3; k++) {
      const par = [0.15, 0.3, 0.5][k];
      const ox = Math.floor(-((cam.x * par) % 900)), oy = Math.floor(groundY - 120 + [10, 14, 18][k]);
      for (const [c, a] of [[this.night[k], 1], [this.dayL[k], d]]) {
        if (a <= 0) continue;
        x2d.globalAlpha = a;
        x2d.drawImage(c, ox, oy); x2d.drawImage(c, ox + c.width, oy);
        x2d.fillStyle = k === 2 ? (a === 1 ? '#111a28' : '#5f809c') : 'transparent';
        if (k === 2) x2d.fillRect(0, oy + 120, VW, VH);
      }
      x2d.globalAlpha = 1;
    }
    x2d.fillStyle = '#0c0a10'; x2d.fillRect(0, fillY, VW, VH);
  }
}

// ---------- light map ----------
export class Lighting {
  constructor() { this.cap = 0; }
  ensure(n) {
    if (n <= this.cap) return;
    this.cap = n;
    this.R = new Float32Array(n); this.G = new Float32Array(n); this.B = new Float32Array(n); this.D = new Float32Array(n);
    this.out = new Uint8Array(n * 4);
  }
  // emit: list of {x, y, r, g, b} in tile coords. Returns RGBA bytes at tile resolution.
  compute(w, x0, y0, lw, lh, amb, emit) {
    const n = lw * lh;
    this.ensure(n);
    const { R, G, B, D } = this;
    this.x0 = x0; this.y0 = y0; this.lw = lw; this.lh = lh;
    for (let i = 0; i < lw; i++) {
      const x = x0 + i;
      let sky = true;
      for (let y = 0; y < y0 + lh; y++) {
        const inside = y >= y0;
        const k = (y - y0) * lw + i;
        if (!w.inb(x, y)) { if (inside) { R[k] = G[k] = B[k] = 0; D[k] = 0.5; } continue; }
        const idx = y * W + x, t = TILES[w.fg[idx]];
        if (t.solid) sky = false;
        if (!inside) continue;
        D[k] = t.solid ? 0.55 : w.bg[idx] === 2 ? 0.88 : w.bg[idx] === 1 ? 0.84 : 0.9;
        if (sky) { const f = w.bg[idx] === 0 ? 1 : 0.85; R[k] = amb[0] * f; G[k] = amb[1] * f; B[k] = amb[2] * f; }
        else {
          // the cutaway glow: earth is never pitch black, a little darker the deeper it goes
          const f = Math.max(0.15, 0.3 - (y - w.surface[x]) * 0.0028);
          R[k] = f; G[k] = f * 0.84; B[k] = f * 0.8;
          if (t.light) { R[k] = Math.max(R[k], t.light[0]); G[k] = Math.max(G[k], t.light[1]); B[k] = Math.max(B[k], t.light[2]); }
        }
      }
    }
    for (const e of emit) {
      const i = Math.floor(e.x) - x0, j = Math.floor(e.y) - y0;
      if (i < 0 || j < 0 || i >= lw || j >= lh) continue;
      const k = j * lw + i;
      R[k] = Math.max(R[k], e.r); G[k] = Math.max(G[k], e.g); B[k] = Math.max(B[k], e.b);
    }
    const s2 = Math.SQRT2;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < lh; j++) for (let i = 0; i < lw; i++) {
        const k = j * lw + i, d = D[k], dd = Math.pow(d, s2);
        let r = R[k], g = G[k], b = B[k];
        if (i > 0) { r = Math.max(r, R[k - 1] * d); g = Math.max(g, G[k - 1] * d); b = Math.max(b, B[k - 1] * d); }
        if (j > 0) {
          const u = k - lw;
          r = Math.max(r, R[u] * d); g = Math.max(g, G[u] * d); b = Math.max(b, B[u] * d);
          if (i > 0) { r = Math.max(r, R[u - 1] * dd); g = Math.max(g, G[u - 1] * dd); b = Math.max(b, B[u - 1] * dd); }
          if (i < lw - 1) { r = Math.max(r, R[u + 1] * dd); g = Math.max(g, G[u + 1] * dd); b = Math.max(b, B[u + 1] * dd); }
        }
        R[k] = r; G[k] = g; B[k] = b;
      }
      for (let j = lh - 1; j >= 0; j--) for (let i = lw - 1; i >= 0; i--) {
        const k = j * lw + i, d = D[k], dd = Math.pow(d, s2);
        let r = R[k], g = G[k], b = B[k];
        if (i < lw - 1) { r = Math.max(r, R[k + 1] * d); g = Math.max(g, G[k + 1] * d); b = Math.max(b, B[k + 1] * d); }
        if (j < lh - 1) {
          const u = k + lw;
          r = Math.max(r, R[u] * d); g = Math.max(g, G[u] * d); b = Math.max(b, B[u] * d);
          if (i > 0) { r = Math.max(r, R[u - 1] * dd); g = Math.max(g, G[u - 1] * dd); b = Math.max(b, B[u - 1] * dd); }
          if (i < lw - 1) { r = Math.max(r, R[u + 1] * dd); g = Math.max(g, G[u + 1] * dd); b = Math.max(b, B[u + 1] * dd); }
        }
        R[k] = r; G[k] = g; B[k] = b;
      }
    }
    const out = this.out;
    for (let k = 0; k < n; k++) {
      out[k * 4] = Math.min(255, R[k] * 170); out[k * 4 + 1] = Math.min(255, G[k] * 170); out[k * 4 + 2] = Math.min(255, B[k] * 170); out[k * 4 + 3] = 255;
    }
    return out;
  }
  at(x, y) {
    if (!this.lw) return 1;
    const i = x - this.x0, j = y - this.y0;
    if (i < 0 || j < 0 || i >= this.lw || j >= this.lh) return 0;
    const k = j * this.lw + i;
    return Math.max(this.R[k], this.G[k], this.B[k]);
  }
}

// ---------- compositor ----------
const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D uBack, uFront, uLight;
uniform vec2 uRes, uLightSize, uLightOff;
out vec4 o;
const int M[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
void main(){
  ivec2 ip = ivec2(gl_FragCoord.xy); ip.y = int(uRes.y) - 1 - ip.y;
  vec2 uv = (vec2(ip) + 0.5) / uRes;
  float b = (float(M[(ip.x & 3) + (ip.y & 3) * 4]) + 0.5) / 16.0;
  vec4 f = texture(uFront, uv);
  vec3 c0 = texture(uBack, uv).rgb;
  if (f.a < 0.02) { o = vec4(floor(c0 * 28.0 + b) / 28.0, 1.0); return; }
  vec2 lp = (vec2(ip) + 0.5 - uLightOff) / 8.0;
  vec3 L = texture(uLight, lp / uLightSize).rgb * (255.0 / 170.0);
  L = floor(L * 6.0 + b) / 6.0;
  vec3 c = f.rgb * max(L, vec3(0.1, 0.08, 0.09));
  o = vec4(mix(c0, c, f.a), 1.0);
}`;

export class Compositor {
  constructor(cv) {
    const gl = cv.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const mk = (unit, filter) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tBack = mk(0, gl.NEAREST); this.tFront = mk(1, gl.NEAREST); this.tLight = mk(2, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(pr, 'uBack'), 0);
    gl.uniform1i(gl.getUniformLocation(pr, 'uFront'), 1);
    gl.uniform1i(gl.getUniformLocation(pr, 'uLight'), 2);
    this.uRes = gl.getUniformLocation(pr, 'uRes');
    this.uLightSize = gl.getUniformLocation(pr, 'uLightSize');
    this.uLightOff = gl.getUniformLocation(pr, 'uLightOff');
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  draw(back, front, light, lw, lh, offX, offY) {
    const gl = this.gl;
    gl.viewport(0, 0, VW, VH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tBack);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, back);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tFront);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, front);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tLight);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lw, lh, 0, gl.RGBA, gl.UNSIGNED_BYTE, light);
    gl.uniform2f(this.uRes, VW, VH);
    gl.uniform2f(this.uLightSize, lw, lh);
    gl.uniform2f(this.uLightOff, offX, offY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
