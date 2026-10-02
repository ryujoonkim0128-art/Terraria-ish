// The tile world: terrain, dug spaces, ladders, rooms, furniture, trees. Plus generation of a fresh burrow.
import { T, TILES, ROOMS, OBJ } from './content.js';
import { rng, noise1, noise2, hash2 } from './util.js';

export const W = 140, H = 78;

export class World {
  constructor(seed) {
    this.seed = seed;
    this.w = W; this.h = H;
    const n = W * H;
    this.fg = new Uint8Array(n);
    this.bg = new Uint8Array(n);      // 0 sky, 1 dug earth, 2 room
    this.ladder = new Uint8Array(n);
    this.mark = new Uint8Array(n);    // 1 dig order, 2 room dig
    this.prog = new Float32Array(n);  // dig progress 0..1
    this.roomAt = new Int16Array(n).fill(-1);
    this.surface = new Int16Array(W);
    this.rooms = []; this.objects = []; this.trees = []; this.bushes = [];
    this.nextId = 1;
    this.version = 0; // bumps on any terrain change (for caches)
  }

  idx(x, y) { return y * W + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  tile(x, y) { return this.inb(x, y) ? this.fg[y * W + x] : T.BEDROCK; }
  solid(x, y) { return TILES[this.tile(x, y)].solid; }
  isLadder(x, y) { return this.inb(x, y) && this.ladder[y * W + x] && !this.solid(x, y); }
  under(x, y) { return this.inb(x, y) && this.bg[y * W + x] !== 0; }
  // Where a walker can stand: two open cells and something to stand on.
  standable(x, y) {
    return !this.solid(x, y) && !this.solid(x, y - 1) && (this.solid(x, y + 1) || this.isLadder(x, y) || this.isLadder(x, y + 1));
  }
  footing(x, y) { return !this.solid(x, y) && (this.solid(x, y + 1) || this.isLadder(x, y) || this.isLadder(x, y + 1)); }
  diggable(x, y) {
    if (!this.inb(x, y) || x < 1 || x >= W - 1) return false;
    const t = TILES[this.tile(x, y)];
    return t.solid && t.hard < Infinity;
  }

  dig(x, y) {
    const i = this.idx(x, y);
    const t = this.fg[i];
    this.fg[i] = T.AIR;
    this.bg[i] = this.roomAt[i] >= 0 && this.rooms[this.roomAt[i]]?.state === 'done' ? 2 : y >= this.surface[x] ? 1 : 0;
    this.mark[i] = 0; this.prog[i] = 0;
    this.version++;
    return t;
  }

  roomOf(x, y) { const r = this.inb(x, y) ? this.roomAt[this.idx(x, y)] : -1; return r >= 0 ? this.rooms[r] : null; }

  // ---------- rooms ----------
  roomCells(type, x, y) {
    const R = ROOMS[type], out = [];
    for (let j = 0; j < R.h; j++) for (let i = 0; i < R.w; i++) {
      if (j === 0 && (i === 0 || i === R.w - 1)) continue;
      out.push([x + i, y + j]);
    }
    return out;
  }
  canPlaceRoom(type, x, y) {
    const R = ROOMS[type];
    if (x < 2 || x + R.w > W - 2 || y + R.h >= H - 3) return false;
    for (const [cx, cy] of this.roomCells(type, x, y)) {
      if (cy < this.surface[cx] + 2) return false;
      const i = this.idx(cx, cy);
      if (this.roomAt[i] >= 0) return false;
      const t = this.fg[i];
      if (t === T.BEDROCK || t === T.FLOOR) return false;
    }
    for (let i = 0; i < R.w; i++) {
      const fx = x + i, fy = y + R.h;
      if (this.roomAt[this.idx(fx, fy)] >= 0 || this.tile(fx, fy) === T.BEDROCK) return false;
    }
    return true;
  }
  placeRoom(type, x, y) {
    const R = ROOMS[type];
    const room = { id: this.rooms.length, type, x, y, w: R.w, h: R.h, state: 'dig', progress: 0, work: 6 + R.w * R.h * 0.12, objects: [] };
    this.rooms.push(room);
    let solid = 0;
    for (const [cx, cy] of this.roomCells(type, x, y)) {
      const i = this.idx(cx, cy);
      this.roomAt[i] = room.id;
      if (this.solid(cx, cy)) { this.mark[i] = 2; solid++; }
    }
    if (!solid) room.state = 'build';
    this.version++;
    return room;
  }
  roomDug(room) {
    for (const [cx, cy] of this.roomCells(room.type, room.x, room.y)) if (this.solid(cx, cy)) return false;
    return true;
  }
  cancelRoom(room) {
    for (const [cx, cy] of this.roomCells(room.type, room.x, room.y)) {
      const i = this.idx(cx, cy);
      this.roomAt[i] = -1;
      if (this.mark[i] === 2) { this.mark[i] = 0; this.prog[i] = 0; }
    }
    room.state = 'gone';
    this.version++;
  }
  completeRoom(room) {
    const R = ROOMS[room.type];
    room.state = 'done';
    for (const [cx, cy] of this.roomCells(room.type, room.x, room.y)) this.bg[this.idx(cx, cy)] = 2;
    const fy = room.y + room.h;
    for (let i = 0; i < room.w; i++) {
      const fx = room.x + i, k = this.idx(fx, fy);
      if (!(this.ladder[k] && !this.solid(fx, fy))) { this.fg[k] = T.FLOOR; this.ladder[k] = 0; this.mark[k] = 0; }
    }
    for (const [type, dx, lift] of R.furn) {
      const O = OBJ[type];
      let oy;
      if (O.mount === 'ceil') oy = room.y + (dx === 0 || dx === room.w - 1 ? 1 : 0);
      else if (O.mount === 'wall') oy = fy - O.h - (lift ?? O.lift ?? 1);
      else oy = fy - O.h;
      room.objects.push(this.addObject(type, room.x + dx, oy, room.id));
    }
    this.version++;
  }

  // ---------- objects ----------
  addObject(type, x, y, room = -1) {
    const O = OBJ[type];
    const o = { id: this.nextId++, type, x, y, w: O.w, h: O.h, room, on: true, wig: 0, user: null, t: 0 };
    if (type === 'plot') { o.grow = 0.3 + Math.random() * 0.3; }
    if (type === 'hearth') o.fuel = 1;
    if (type === 'plant') o.size = 0;
    if (type === 'phonograph') o.on = false;
    this.objects.push(o);
    return o;
  }
  removeObject(o) {
    this.objects.splice(this.objects.indexOf(o), 1);
    o.gone = true;
    if (o.room >= 0) { const r = this.rooms[o.room]; r.objects.splice(r.objects.indexOf(o), 1); }
  }
  // Where a decor item would go if dropped at cell (cx, cy): snaps down to the floor beneath.
  decorSpot(type, cx, cy) {
    const O = OBJ[type];
    const x = cx - (O.w >> 1);
    let fy = -1;
    for (let y = cy; y < cy + 8 && y < H; y++) if (this.solid(cx, y)) { fy = y; break; }
    if (fy < 0) return { x, y: cy, ok: false };
    const y = fy - O.h - (O.mount === 'wall' ? O.lift : 0);
    return { x, y, ok: this.canPlaceObj(type, x, y) };
  }
  canPlaceObj(type, x, y) {
    const O = OBJ[type];
    const lift = O.mount === 'wall' ? O.lift : 0;
    for (let j = 0; j < O.h; j++) for (let i = 0; i < O.w; i++) {
      const cx = x + i, cy = y + j;
      if (!this.inb(cx, cy) || this.solid(cx, cy)) return false;
      if (O.surface ? this.under(cx, cy) : !this.under(cx, cy)) return false;
    }
    for (let i = 0; i < O.w; i++) {
      for (let j = 1; j <= lift; j++) if (this.solid(x + i, y + O.h - 1 + j)) return false;
      if (!this.solid(x + i, y + O.h + lift)) return false;
    }
    const layer = (t) => (OBJ[t].mount === 'floor' ? (t === 'rug' ? 'rug' : 'floor') : 'wall');
    const L = layer(type);
    for (const o of this.objects) {
      if (layer(o.type) !== L) continue;
      if (x < o.x + o.w && x + O.w > o.x && y < o.y + o.h && y + O.h > o.y) return false;
    }
    return true;
  }
  objectsOf(type) { return this.objects.filter((o) => o.type === type && !o.gone); }
}

// ---------- generation ----------
export function generate(seed) {
  const w = new World(seed), R = rng(seed);
  const base = 22;
  const cabinX = 62;
  for (let x = 0; x < W; x++) {
    let s = base + Math.round((noise1(x * 0.045, seed) - 0.5) * 7 + (noise1(x * 0.17, seed + 3) - 0.5) * 2);
    w.surface[x] = s;
  }
  // flatten the yard around the cabin
  const yard = w.surface[cabinX + 5];
  for (let x = cabinX - 6; x <= cabinX + 18; x++) {
    const d = x < cabinX - 2 ? cabinX - 2 - x : x > cabinX + 14 ? x - cabinX - 14 : 0;
    w.surface[x] = Math.round(yard + (w.surface[x] - yard) * Math.min(1, d / 4));
  }
  // no cliffs taller than a step, so the folk can walk the whole surface
  for (let pass = 0; pass < 4; pass++) {
    for (let x = 1; x < W; x++) w.surface[x] = Math.max(w.surface[x - 1] - 1, Math.min(w.surface[x - 1] + 1, w.surface[x]));
    for (let x = W - 2; x >= 0; x--) w.surface[x] = Math.max(w.surface[x + 1] - 1, Math.min(w.surface[x + 1] + 1, w.surface[x]));
  }
  for (let x = 0; x < W; x++) {
    const s = w.surface[x];
    for (let y = 0; y < H; y++) {
      const i = w.idx(x, y);
      if (y < s) { w.fg[i] = T.AIR; continue; }
      const d = y - s;
      let t = d === 0 ? T.TOPSOIL : T.DIRT;
      const n = noise2(x * 0.09, y * 0.12, seed + 11);
      const stoneTh = 0.78 - Math.min(0.36, d * 0.012);
      if (d > 3 && n > stoneTh) t = T.STONE;
      if (d > 2 && d < 14 && noise2(x * 0.15, y * 0.2, seed + 21) > 0.78) t = T.CLAY;
      if (t === T.STONE && d > 8 && noise2(x * 0.3, y * 0.3, seed + 31) > 0.7) t = T.IRON;
      if (t === T.STONE && d > 18 && hash2(x, y, seed + 41) > 0.965) t = T.CRYSTAL;
      if (y >= H - 2 || x === 0 || x === W - 1) t = T.BEDROCK;
      if (y === H - 3 && hash2(x, y, seed) > 0.5) t = T.BEDROCK;
      w.fg[i] = t;
    }
  }
  // a few hidden caverns, lit by crystals
  for (let c = 0; c < 6; c++) {
    const cx = 8 + Math.floor(R() * (W - 16)), cy = base + 22 + Math.floor(R() * (H - base - 30));
    if (Math.abs(cx - cabinX - 6) < 22 && cy < base + 26) continue;
    const rx = 4 + R() * 5, ry = 2 + R() * 2;
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 2 || x >= W - 2 || y >= H - 4) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const k = dx * dx + dy * dy + (noise2(x * 0.5, y * 0.5, seed + c) - 0.5) * 0.5;
      const i = w.idx(x, y);
      if (k < 1) { w.fg[i] = T.AIR; w.bg[i] = 1; }
      else if (k < 1.5 && w.fg[i] !== T.AIR && R() < 0.22) w.fg[i] = T.CRYSTAL;
    }
  }
  // the cabin, its shaft and the first two rooms
  const g = w.surface[cabinX + 5];
  const sx = cabinX + 5;
  w.cabin = { x: cabinX, y: g, shaft: sx };
  const rx = sx - 7, ry = g + 7;
  const clear = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.fg[w.idx(x, y)] !== T.AIR) w.fg[w.idx(x, y)] = T.DIRT; };
  clear(rx - 3, g + 1, rx + 30, ry + 7);
  for (let y = g; y < ry; y++) w.dig(sx, y);
  const hearth = w.placeRoom('hearth', rx, ry);
  const rx2 = rx + 15;
  const bed = w.placeRoom('bedroom', rx2, ry + 1);
  for (const r of [hearth, bed]) for (const [cx, cy] of w.roomCells(r.type, r.x, r.y)) w.dig(cx, cy);
  for (let x = rx + 12; x < rx2; x++) for (let y = ry + 3; y <= ry + 4; y++) w.dig(x, y);
  for (let y = g; y <= ry + 4; y++) w.ladder[w.idx(sx, y)] = 1;
  w.completeRoom(hearth); w.completeRoom(bed);
  // trees and bushes
  for (let x = 4; x < W - 4; x++) {
    if (x > cabinX - 4 && x < cabinX + 16) continue;
    const r = hash2(x, 7, seed);
    if (r < 0.2 && !w.trees.some((t) => Math.abs(t.x - x) < 3)) w.trees.push({ x, h: 5 + Math.floor(hash2(x, 9, seed) * 4), stage: 'grown', grow: 0, mark: false, shake: 0, fall: 0 });
    else if (r > 0.94 && !w.bushes.some((b) => Math.abs(b.x - x) < 3)) w.bushes.push({ x, berries: 3, regrow: 0, shake: 0 });
  }
  w.addObject('bell', cabinX + 12, g - 3);
  w.version++;
  return w;
}
