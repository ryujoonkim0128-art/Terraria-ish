// World storage: foreground tiles, background walls, furniture objects, and change tracking.
import { tiles, T, OBJ } from './content.js';

export const CS = 32; // chunk size in tiles

export class World {
  constructor(w, h, seed) {
    this.w = w; this.h = h; this.seed = seed;
    this.fg = new Uint8Array(w * h);
    this.wall = new Uint8Array(w * h);
    this.objAt = new Int32Array(w * h);     // object index + 1
    this.surface = new Int16Array(w);        // generated ground line (for backdrop / biome logic)
    this.skyTop = new Int16Array(w);         // first row that blocks sunlight
    this.objects = [];
    this.villages = [];
    this.dens = [];
    this.dirty = new Set();
    this.onChange = null;
  }

  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.fg[y * this.w + x] : T.BEDROCK; }
  getWall(x, y) { return this.inb(x, y) ? this.wall[y * this.w + x] : 0; }
  solid(x, y) { return tiles[this.get(x, y)].solid; }
  platform(x, y) { return tiles[this.get(x, y)].platform; }
  ladder(x, y) { return this.get(x, y) === T.LADDER; }
  // walkable support: solid, platform, or the top rung of a ladder
  support(x, y) {
    const t = tiles[this.get(x, y)];
    return t.solid || t.platform || (t.climb && !this.ladder(x, y - 1));
  }
  passable(x, y) { return !tiles[this.get(x, y)].solid; }

  markDirty(x, y) {
    const cx = Math.floor(x / CS), cy = Math.floor(y / CS);
    this.dirty.add(cx + ',' + cy);
    const lx = x - cx * CS, ly = y - cy * CS;
    if (lx === 0) this.dirty.add(cx - 1 + ',' + cy);
    if (lx === CS - 1) this.dirty.add(cx + 1 + ',' + cy);
    if (ly === 0) this.dirty.add(cx + ',' + (cy - 1));
    if (ly === CS - 1) this.dirty.add(cx + ',' + (cy + 1));
  }

  setTile(x, y, id, silent) {
    if (!this.inb(x, y)) return;
    this.fg[y * this.w + x] = id;
    if (!silent) { this.updateSky(x); this.markDirty(x, y); this.onChange?.('tile', x, y, id); }
  }
  setWall(x, y, id, silent) {
    if (!this.inb(x, y)) return;
    this.wall[y * this.w + x] = id;
    if (!silent) { this.updateSky(x); this.markDirty(x, y); this.onChange?.('wall', x, y, id); }
  }

  blocksSun(x, y) {
    const i = y * this.w + x;
    return tiles[this.fg[i]].opaque || this.wall[i] !== 0;
  }
  updateSky(x) {
    let y = 0;
    while (y < this.h && !this.blocksSun(x, y)) y++;
    this.skyTop[x] = y;
  }
  updateAllSky() { for (let x = 0; x < this.w; x++) this.updateSky(x); }

  // ---------------------------------------------------------------- objects
  objectAt(x, y) {
    if (!this.inb(x, y)) return null;
    const k = this.objAt[y * this.w + x];
    return k ? this.objects[k - 1] : null;
  }

  canPlaceObject(type, x, y) {
    const d = OBJ[type];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inb(tx, ty)) return false;
      const t = tiles[this.get(tx, ty)];
      if (t.solid || t.climb || t.platform || t.tree) return false;
      if (this.objAt[ty * this.w + tx]) return false;
    }
    if (d.mount === 'floor') {
      for (let i = 0; i < d.w; i++) {
        const s = this.get(x + i, y + d.h);
        if (!tiles[s].solid && !tiles[s].platform) return false;
      }
    } else if (d.mount === 'hang') {
      if (!this.solid(x, y - 1) && !this.platform(x, y - 1) && !this.getWall(x, y)) return false;
    } else if (d.mount === 'wall') {
      let ok = false;
      for (let j = 0; j < d.h && !ok; j++) for (let i = 0; i < d.w && !ok; i++) if (this.getWall(x + i, y + j)) ok = true;
      if (!ok) ok = this.solid(x - 1, y) || this.solid(x + d.w, y) || this.solid(x, y + d.h);
      if (!ok) return false;
    }
    return true;
  }

  addObject(type, x, y, owner = null, force = false) {
    if (!force && !this.canPlaceObject(type, x, y)) return null;
    const d = OBJ[type];
    const o = { type, x, y, w: d.w, h: d.h, owner, id: this.objects.length, alive: true, claim: null, lit: true };
    this.objects.push(o);
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      if (this.inb(x + i, y + j)) { this.objAt[(y + j) * this.w + x + i] = o.id + 1; this.markDirty(x + i, y + j); }
    }
    this.onChange?.('obj', x, y, o);
    return o;
  }

  removeObject(o) {
    if (!o || !o.alive) return;
    o.alive = false;
    for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
      if (this.inb(o.x + i, o.y + j)) { this.objAt[(o.y + j) * this.w + o.x + i] = 0; this.markDirty(o.x + i, o.y + j); }
    }
    this.onChange?.('objgone', o.x, o.y, o);
  }

  objectsIn(x0, y0, x1, y1, pred) {
    const out = [];
    for (const o of this.objects) {
      if (o.alive && o.x + o.w > x0 && o.x <= x1 && o.y + o.h > y0 && o.y <= y1 && (!pred || pred(o))) out.push(o);
    }
    return out;
  }

  // ground level (first support row) at column x, searching down from y
  groundBelow(x, y) {
    for (let yy = y; yy < this.h - 1; yy++) if (this.support(x, yy + 1) && this.passable(x, yy) && this.passable(x, yy - 1)) return yy;
    return -1;
  }
}
