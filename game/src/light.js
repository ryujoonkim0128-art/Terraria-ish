// Tile light map: sunlight from open sky + emitters, spread with per-tile falloff (8-neighbour sweeps).
import { tiles, OBJ } from './content.js';

export class Lighting {
  constructor(world) {
    this.world = world;
    this.cap = 0;
  }

  ensure(n) {
    if (n <= this.cap) return;
    this.cap = n;
    this.R = new Float32Array(n); this.G = new Float32Array(n); this.B = new Float32Array(n);
    this.D = new Float32Array(n);
    this.out = new Uint8Array(n * 4);
  }

  // x0,y0: top-left tile of the region; returns RGBA bytes (tile resolution)
  compute(x0, y0, w, h, sun, dyn, time) {
    const world = this.world, n = w * h;
    this.ensure(n);
    const { R, G, B, D } = this;
    R.fill(0); G.fill(0); B.fill(0);
    for (let j = 0; j < h; j++) {
      const y = y0 + j;
      for (let i = 0; i < w; i++) {
        const x = x0 + i, k = j * w + i;
        if (!world.inb(x, y)) { D[k] = 0.5; continue; }
        const idx = y * world.w + x, t = tiles[world.fg[idx]];
        D[k] = t.solid ? (t.opaque ? 0.5 : 0.88) : world.wall[idx] ? 0.86 : 0.9;
        const st = world.skyTop[x];
        if (y < st) { R[k] = sun[0]; G[k] = sun[1]; B[k] = sun[2]; }
        else {
          // daylight soaking into houses (below the roof) and into the top of the ground, fading with depth
          const a = y - st < 16 ? 0.5 * Math.pow(1 - (y - st) / 16, 1.6) : 0;
          const d = y - world.surface[x];
          const g = d >= 0 && d < 22 ? 0.55 * Math.pow(1 - d / 22, 1.3) : 0;
          const f = Math.max(a, g);
          R[k] = sun[0] * f; G[k] = sun[1] * f; B[k] = sun[2] * f;
        }
        if (t.light) {
          const f = 0.9 + 0.1 * Math.sin(time * 2 + x * 1.7 + y);
          R[k] = Math.max(R[k], t.light[0] * f); G[k] = Math.max(G[k], t.light[1] * f); B[k] = Math.max(B[k], t.light[2] * f);
        }
      }
    }
    // furniture lights (fires flicker)
    for (const o of world.objects) {
      if (!o.alive || !o.lit) continue;
      const L = OBJ[o.type].light;
      if (!L) continue;
      const lx = o.x + (o.w >> 1) - x0, ly = o.y + (o.type === 'lamppost' ? 0 : o.h >> 1) - y0;
      if (lx < -2 || ly < -2 || lx >= w + 2 || ly >= h + 2) continue;
      const fire = o.type === 'hearth' || o.type === 'campfire' || o.type === 'furnace' || o.type === 'torch';
      const f = fire ? 0.88 + 0.12 * Math.sin(time * 9 + o.id * 3.1) * Math.sin(time * 5.3 + o.id) : 1;
      this.put(lx, ly, w, h, L[0] * f, L[1] * f, L[2] * f);
    }
    for (const d of dyn) this.put(Math.floor(d.x) - x0, Math.floor(d.y) - y0, w, h, d.r, d.g, d.b);

    // two forward/backward sweep pairs with diagonals
    const s2 = Math.SQRT2;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = j * w + i, d = D[k], dd = Math.pow(d, s2);
        let r = R[k], g = G[k], b = B[k];
        if (i > 0) { r = Math.max(r, R[k - 1] * d); g = Math.max(g, G[k - 1] * d); b = Math.max(b, B[k - 1] * d); }
        if (j > 0) {
          const u = k - w;
          r = Math.max(r, R[u] * d); g = Math.max(g, G[u] * d); b = Math.max(b, B[u] * d);
          if (i > 0) { r = Math.max(r, R[u - 1] * dd); g = Math.max(g, G[u - 1] * dd); b = Math.max(b, B[u - 1] * dd); }
          if (i < w - 1) { r = Math.max(r, R[u + 1] * dd); g = Math.max(g, G[u + 1] * dd); b = Math.max(b, B[u + 1] * dd); }
        }
        R[k] = r; G[k] = g; B[k] = b;
      }
      for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
        const k = j * w + i, d = D[k], dd = Math.pow(d, s2);
        let r = R[k], g = G[k], b = B[k];
        if (i < w - 1) { r = Math.max(r, R[k + 1] * d); g = Math.max(g, G[k + 1] * d); b = Math.max(b, B[k + 1] * d); }
        if (j < h - 1) {
          const u = k + w;
          r = Math.max(r, R[u] * d); g = Math.max(g, G[u] * d); b = Math.max(b, B[u] * d);
          if (i > 0) { r = Math.max(r, R[u - 1] * dd); g = Math.max(g, G[u - 1] * dd); b = Math.max(b, B[u - 1] * dd); }
          if (i < w - 1) { r = Math.max(r, R[u + 1] * dd); g = Math.max(g, G[u + 1] * dd); b = Math.max(b, B[u + 1] * dd); }
        }
        R[k] = r; G[k] = g; B[k] = b;
      }
    }
    const out = this.out;
    for (let k = 0; k < n; k++) {
      out[k * 4] = Math.min(255, R[k] * 170);
      out[k * 4 + 1] = Math.min(255, G[k] * 170);
      out[k * 4 + 2] = Math.min(255, B[k] * 170);
      out[k * 4 + 3] = 255;
    }
    return out;
  }

  put(i, j, w, h, r, g, b) {
    if (i < 0 || j < 0 || i >= w || j >= h) return;
    const k = j * w + i;
    this.R[k] = Math.max(this.R[k], r); this.G[k] = Math.max(this.G[k], g); this.B[k] = Math.max(this.B[k], b);
  }

  // brightness at a world tile (for AI, e.g. "is it dark here")
  sample(x, y, x0, y0, w) {
    const k = (y - y0) * w + (x - x0);
    return k >= 0 && k < this.cap ? Math.max(this.R[k], this.G[k], this.B[k]) : 0;
  }
}
