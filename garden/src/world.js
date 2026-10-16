// Map layout: shops, the fenced garden with four soil beds, pond, trees, lanterns; ground rendering + collision.
import { TILE } from './content.js';
import { mulberry32, irnd, pick } from './rng.js';
import { canvas } from './pix.js';
import * as S from './sprites.js';

export const MW = 44, MH = 30;
export const G_GRASS = 0, G_SOIL = 1, G_PATH = 2, G_WATER = 3;

export class World {
  constructor(seed = 7) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.ground = new Uint8Array(MW * MH);
    this.solid = new Uint8Array(MW * MH);
    this.fence = new Uint8Array(MW * MH);
    this.decor = [];
    this.stalls = [
      { kind: 'seeds', name: "Sam's Seeds", sign: 'SEEDS', npc: 'sam', who: 'Sam', x0: 5, y0: 3 },
      { kind: 'gear', name: 'Gear Shop', sign: 'GEAR', npc: 'gus', who: 'Gus', x0: 15, y0: 3 },
      { kind: 'eggs', name: 'Pet Eggs', sign: 'EGGS', npc: 'edna', who: 'Edna', x0: 25, y0: 3 },
      { kind: 'sell', name: 'Sell Crops', sign: 'SELL', npc: 'steven', who: 'Steven', x0: 35, y0: 3 },
    ];
    this.garden = { x0: 4, y0: 11, x1: 39, y1: 25 };
    this.beds = [{ x0: 5, y0: 12, x1: 19, y1: 16 }, { x0: 24, y0: 12, x1: 38, y1: 16 }, { x0: 5, y0: 18, x1: 19, y1: 22 }, { x0: 24, y0: 18, x1: 38, y1: 22 }];
    this.spawn = { x: 22 * TILE, y: 9 * TILE - 4 };
    this.gate = { x0: 21, x1: 22, y: 10 };

    // ground
    for (const b of this.beds) for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) this.ground[y * MW + x] = G_SOIL;
    for (let x = 3; x <= 41; x++) this.ground[7 * MW + x] = G_PATH;
    for (let y = 7; y <= 25; y++) { this.ground[y * MW + 21] = G_PATH; this.ground[y * MW + 22] = G_PATH; }
    for (const s of this.stalls) for (let x = s.x0; x < s.x0 + 5; x++) this.ground[6 * MW + x] = G_PATH;
    // pond (bottom-left)
    for (let y = 27; y < MH; y++) for (let x = 1; x <= 7 - (y === 27 ? 1 : 0); x++) this.ground[y * MW + x] = G_WATER;
    this.ground[29 * MW + 8] = G_WATER; this.ground[28 * MW + 8] = G_WATER;
    // fence
    const g = this.garden;
    for (let x = g.x0 - 1; x <= g.x1 + 1; x++) { this.fence[(g.y0 - 1) * MW + x] = 1; this.fence[(g.y1 + 1) * MW + x] = 1; }
    for (let y = g.y0 - 1; y <= g.y1 + 1; y++) { this.fence[y * MW + g.x0 - 1] = 1; this.fence[y * MW + g.x1 + 1] = 1; }
    this.fence[(g.y0 - 1) * MW + 21] = 0; this.fence[(g.y0 - 1) * MW + 22] = 0;

    // solids
    for (let i = 0; i < MW * MH; i++) if (this.fence[i] || this.ground[i] === G_WATER) this.solid[i] = 1;
    for (const s of this.stalls) for (let y = s.y0; y < s.y0 + 3; y++) for (let x = s.x0; x < s.x0 + 5; x++) this.solid[y * MW + x] = 1;

    const place = (type, tx, ty, v = 0, solid = true) => { this.decor.push({ type, x: tx * TILE + 8, y: ty * TILE + TILE - 1, v, tx, ty }); if (solid) this.solid[ty * MW + tx] = 1; };
    // tree border (top, sides, bottom)
    for (let x = 0; x < MW; x += 2) { if (rng() < 0.85) place('tree', x, 1, irnd(rng, 0, 5)); }
    for (let x = 1; x < MW; x += 2) { if (rng() < 0.4) place('tree', x, 0, irnd(rng, 0, 5)); }
    for (let y = 9; y < 27; y += 2) { if (rng() < 0.7) place('tree', 1, y, irnd(rng, 0, 5)); if (rng() < 0.7) place('tree', 42, y, irnd(rng, 0, 5)); }
    for (let x = 11; x < MW; x += 2) { if (rng() < 0.7) place('tree', x, 28 + (x % 4 === 1 ? 1 : 0), irnd(rng, 0, 5)); }
    // bushes & rocks
    const free = (tx, ty) => tx >= 0 && ty >= 0 && tx < MW && ty < MH && !this.solid[ty * MW + tx] && this.ground[ty * MW + tx] === G_GRASS && !(tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1) && ty !== 6 && ty !== 8 && ty !== 9 && ty !== 2;
    for (let i = 0; i < 16; i++) { const tx = irnd(rng, 2, 41), ty = irnd(rng, 8, 27); if (free(tx, ty)) place('bush', tx, ty, irnd(rng, 0, 5)); }
    for (let i = 0; i < 8; i++) { const tx = irnd(rng, 2, 41), ty = irnd(rng, 8, 27); if (free(tx, ty)) place('rock', tx, ty, irnd(rng, 0, 1)); }
    // lanterns
    for (const [tx, ty] of [[4, 11], [39, 11], [4, 25], [39, 25], [19, 9], [24, 9], [3, 6], [12, 6], [22, 5], [32, 6], [41, 6]]) place('lantern', tx, ty, 0);
    place('sign', 20, 9, 0);
    place('scarecrow', 37, 24, 0);
    this.lights = this.decor.filter((d) => d.type === 'lantern').map((d) => ({ x: d.x, y: d.y - 16 }));
    for (const s of this.stalls) this.lights.push({ x: s.x0 * TILE + 40, y: s.y0 * TILE + 24, r: 44, c: 'rgba(255,220,160,0.5)' });

    // flowers on grass
    this.flowers = [];
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const inside = tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1;
      if (this.ground[ty * MW + tx] === G_GRASS && !this.solid[ty * MW + tx] && rng() < (inside ? 0.05 : 0.13)) this.flowers.push([tx, ty, irnd(rng, 0, 7)]);
    }
    this.groundCanvas = null;
  }
  idx(tx, ty) { return ty * MW + tx; }
  inMap(tx, ty) { return tx >= 0 && ty >= 0 && tx < MW && ty < MH; }
  isSolid(tx, ty) { return !this.inMap(tx, ty) || this.solid[ty * MW + tx] === 1; }
  isSoil(tx, ty) { return this.inMap(tx, ty) && this.ground[ty * MW + tx] === G_SOIL; }
  inGarden(tx, ty) { const g = this.garden; return tx >= g.x0 && tx <= g.x1 && ty >= g.y0 && ty <= g.y1; }
  isPlaceable(tx, ty) { return this.inGarden(tx, ty) && !this.isSolid(tx, ty) && this.ground[ty * MW + tx] !== G_PATH; }
  // px AABB vs solid tiles
  collides(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 1) / TILE), y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 1) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }
  stallAt(tx, ty) { // stall whose counter-front zone contains this tile
    for (const s of this.stalls) if (tx >= s.x0 && tx < s.x0 + 5 && ty >= s.y0 + 3 && ty <= s.y0 + 4) return s;
    return null;
  }
  ground2() {
    if (this.groundCanvas) return this.groundCanvas;
    const [c, x] = canvas(MW * TILE, MH * TILE);
    const rng = mulberry32(this.seed + 99);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const g = this.ground[ty * MW + tx];
      let t;
      if (g === G_GRASS) t = S.grassTile(irnd(rng, 0, 7));
      else if (g === G_SOIL) t = S.soilTile(irnd(rng, 0, 7));
      else if (g === G_PATH) t = S.pathTile(irnd(rng, 0, 5));
      else {
        let e = '';
        if (ty === 0 || this.ground[(ty - 1) * MW + tx] !== G_WATER) e += 'n';
        if (tx === 0 || this.ground[ty * MW + tx - 1] !== G_WATER) e += 'w';
        if (tx === MW - 1 || this.ground[ty * MW + tx + 1] !== G_WATER) e += 'e';
        t = S.waterTile(0, e);
      }
      x.drawImage(t, tx * TILE, ty * TILE);
    }
    // low-frequency meadow shading so the grass reads as a field, not a grid
    const vn = mulberry32(this.seed + 5), grid = [];
    for (let j = 0; j <= MH / 4 + 1; j++) { grid[j] = []; for (let i = 0; i <= MW / 4 + 1; i++) grid[j][i] = vn(); }
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      if (this.ground[ty * MW + tx] !== G_GRASS) continue;
      const fx = tx / 4, fy = ty / 4, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
      const n = grid[j][i] * (1 - u) * (1 - v) + grid[j][i + 1] * u * (1 - v) + grid[j + 1][i] * (1 - u) * v + grid[j + 1][i + 1] * u * v;
      if (n > 0.55) { x.fillStyle = `rgba(255,250,180,${(n - 0.55) * 0.35})`; x.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
      else if (n < 0.45) { x.fillStyle = `rgba(20,60,40,${(0.45 - n) * 0.5})`; x.fillRect(tx * TILE, ty * TILE, TILE, TILE); }
    }
    // bed rims and path edges
    x.fillStyle = 'rgba(40,20,10,0.45)';
    for (const b of this.beds) { x.fillRect(b.x0 * TILE, b.y0 * TILE, (b.x1 - b.x0 + 1) * TILE, 1); x.fillRect(b.x0 * TILE, b.y0 * TILE, 1, (b.y1 - b.y0 + 1) * TILE); }
    x.fillStyle = 'rgba(255,240,200,0.18)';
    for (const b of this.beds) { x.fillRect(b.x0 * TILE, (b.y1 + 1) * TILE - 1, (b.x1 - b.x0 + 1) * TILE, 1); x.fillRect((b.x1 + 1) * TILE - 1, b.y0 * TILE, 1, (b.y1 - b.y0 + 1) * TILE); }
    for (const [tx, ty, v] of this.flowers) x.drawImage(S.flowerPatch(v), tx * TILE, ty * TILE);
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (this.fence[ty * MW + tx]) {
      let bits = 0;
      if (ty > 0 && this.fence[(ty - 1) * MW + tx]) bits |= 1;
      if (tx < MW - 1 && this.fence[ty * MW + tx + 1]) bits |= 2;
      if (ty < MH - 1 && this.fence[(ty + 1) * MW + tx]) bits |= 4;
      if (tx > 0 && this.fence[ty * MW + tx - 1]) bits |= 8;
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(tx * TILE + 5, ty * TILE + 14, 8, 2);
      x.drawImage(S.fenceTile(bits), tx * TILE, ty * TILE - 2);
    }
    this.groundCanvas = c;
    return c;
  }
}
