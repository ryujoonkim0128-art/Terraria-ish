// Rendering: tile textures → cached chunk canvases → front layer; sky + parallax → back layer;
// a WebGL pass multiplies the front layer by a Bayer-dithered light map.
import { T, W as WL, tiles, TILE } from './content.js';
import { CS } from './world.js';
import { hash2, vnoise, fbm, clamp } from './noise.js';
import { objSprite, shade } from './sprites.js';

export const VW = 640, VH = 360;

const pk = (h) => { const n = parseInt(h.slice(1), 16); return (255 << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255); };
const pal = (...hs) => hs.map(pk);
const INKP = pk('#140e12');
function lit(p, k) {
  const r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return (255 << 24) | (f(b) << 16) | (f(g) << 8) | f(r);
}

const PAL = {
  dirt: pal('#3b2a20', '#4a3426', '#5a4030', '#6b4d38'),
  grass: pal('#2f4a2a', '#3f6a33', '#5a8a3d', '#7aa84a'),
  stone: pal('#363945', '#454955', '#555a67', '#6a707d'),
  crack: pk('#23252d'),
  coal: pal('#16161a', '#2a2a32'), copper: pal('#9a5028', '#d08a4e', '#f0b070'), iron: pal('#8a746a', '#c8b0a4', '#e8d8d0'),
  plank: pal('#4e321f', '#6a4629', '#845a34', '#9c6e40'),
  brick: pal('#4d4a52', '#5c5962', '#6c6974', '#7c7984'), mortar: pk('#2e2c33'),
  timber: pal('#2c1e14', '#3a281b', '#4a3423', '#5a412c'),
  thatch: pal('#6e5024', '#8e6c32', '#ad8a44', '#caa75c'),
  glass: pal('#557788', '#80a4b4', '#b8d6e0', '#e4f2f4'),
  moss: pal('#1e4a44', '#2f7a6c', '#4fb39c', '#8ae6cc'),
  crystal: pal('#6a3410', '#b0601c', '#e89a3a', '#ffd88a'),
  cobble: pal('#40434b', '#53565f', '#686b74', '#7e818a'),
  bedrock: pal('#121016', '#1a1820', '#23202a'),
  clay: pal('#6e3e2c', '#834b35', '#9a5c42', '#b06e50'),
  snow: pal('#b8c4d4', '#d0dae6', '#e6eef6', '#ffffff'),
  bark: pal('#2e2016', '#3e2c1d', '#523b27', '#664b33'),
  leaves: pal('#1f3a22', '#2c522e', '#3e6c38', '#5a8a46', '#78a856'),
  pine: pal('#16302a', '#1f4236', '#2b5646', '#3c6c54'),
  flower: pal('#e8c050', '#d8708a', '#a0b4e8', '#f0ece0', '#e89050'),
  shroom: pal('#cfd8d0', '#5fd0c0', '#a8f4e4'),
  wDirt: pal('#3a2a1f', '#433024', '#4c372a'),
  wStone: pal('#30333e', '#383b47', '#414451'),
  wPlank: pal('#35241a', '#402c1f', '#4b3424'),
  wDaub: pal('#8a7c62', '#968770', '#a2937a'),
  wBeam: pal('#3a281b', '#4a3423'),
  wBrick: pal('#34323a', '#3d3b44', '#47444e'),
  back: pal('#2e2219', '#35281e', '#3d2e23'),
  backDeep: pal('#252731', '#2b2d38', '#32343f'),
};

// ------------------------------------------------------------------ tile texel functions
function texSolid(id, lx, ly, px, py, ex, wx, wy) {
  const h = hash2(px, py, 7), n = vnoise(px / 3.2, py / 3.2, 11);
  let c;
  switch (id) {
    case T.DIRT: case T.GRASS: {
      c = PAL.dirt[clamp(Math.floor(n * 3 + h * 1.4), 0, 3)];
      if (h < 0.03) c = PAL.dirt[3];
      if (id === T.GRASS && (ex & 1)) {
        const blade = 2 + Math.floor(hash2(px, 0, 3) * 3);
        if (ly < blade) c = PAL.grass[ly === 0 ? 3 : clamp(2 - ly + Math.floor(h * 2), 0, 3)];
      }
      break;
    }
    case T.STONE: case T.COAL: case T.COPPER: case T.IRON: {
      const plate = vnoise(px / 5, py / 4, 13);
      c = PAL.stone[clamp(Math.floor(plate * 3 + h * 0.9), 0, 3)];
      if (Math.abs(vnoise(px / 4, py / 3, 17) - 0.5) < 0.035) c = PAL.crack;
      if (id !== T.STONE) {
        for (let k = 0; k < 3; k++) {
          const ox = 1 + Math.floor(hash2(wx, wy, 20 + k) * 5), oy = 1 + Math.floor(hash2(wx, wy, 30 + k) * 5);
          if (lx >= ox && lx <= ox + 1 && ly >= oy && ly <= oy + 1) {
            const p = id === T.COAL ? PAL.coal : id === T.COPPER ? PAL.copper : PAL.iron;
            c = p[(lx === ox && ly === oy) ? p.length - 1 : (lx + ly) % (p.length - 1)];
          }
        }
      }
      break;
    }
    case T.PLANK: {
      const row = ly >> 2;
      c = PAL.plank[1 + Math.floor(hash2(wx * 2 + row, wy, 5) * 2)];
      if ((ly & 3) === 3) c = PAL.plank[0];
      if ((px + row * 5 + wy * 3) % 16 === 0) c = PAL.plank[0];
      if ((ly & 3) === 0) c = lit(c, 0.08);
      if (h < 0.05) c = PAL.plank[3];
      break;
    }
    case T.BRICK: case T.COBBLE: {
      if (id === T.BRICK) {
        const row = py >> 2;
        const bx = (px + (row & 1) * 4) >> 3;
        c = PAL.brick[1 + Math.floor(hash2(bx, row, 9) * 3)];
        if ((py & 3) === 3 || ((px + (row & 1) * 4) & 7) === 7) c = PAL.mortar;
        else if ((py & 3) === 0) c = lit(c, 0.08);
      } else {
        const v = vnoise(px / 2.6, py / 2.6, 19);
        c = v > 0.62 || v < 0.2 ? PAL.mortar : PAL.cobble[clamp(Math.floor(v * 4 + h * 0.6) - 1, 0, 3)];
      }
      break;
    }
    case T.TIMBER: c = PAL.timber[clamp(Math.floor(hash2(px, py >> 2, 3) * 3) + (lx === 1 ? 1 : 0), 0, 3)]; if ((px & 3) === 0) c = PAL.timber[0]; break;
    case T.THATCH: {
      c = PAL.thatch[clamp(Math.floor(hash2(px, py >> 1, 4) * 3) + 1, 0, 3)];
      if ((px + py * 2) % 5 === 0) c = PAL.thatch[0];
      if ((py & 3) === 3) c = PAL.thatch[1];
      break;
    }
    case T.GLASS: {
      c = PAL.glass[1 + ((lx + ly) % 7 === 0 ? 2 : (lx + ly) % 7 === 1 ? 1 : 0)];
      if (lx === 0 || ly === 0 || lx === 7 || ly === 7) c = PAL.timber[1];
      if (lx === 4 || ly === 4) c = PAL.timber[2];
      break;
    }
    case T.MOSS: {
      c = PAL.stone[clamp(Math.floor(vnoise(px / 5, py / 4, 13) * 3), 0, 3)];
      const drip = 2 + Math.floor(hash2(px, 1, 8) * 3);
      if ((ex & 1) && ly < drip) c = PAL.moss[ly === 0 ? 3 : clamp(3 - ly, 0, 3)];
      else if (h < 0.08) c = PAL.moss[1];
      break;
    }
    case T.CRYSTAL: {
      const f = ((lx * 3 + ly * 5 + wx * 7 + wy) % 9);
      c = PAL.crystal[f < 2 ? 3 : f < 5 ? 2 : f < 7 ? 1 : 0];
      if (h < 0.06) c = pk('#fff4d0');
      break;
    }
    case T.BEDROCK: c = PAL.bedrock[Math.floor(h * 3)]; break;
    case T.CLAY: c = PAL.clay[clamp(Math.floor(n * 2 + ((py >> 1) % 3 === 0 ? 1 : 0) + h), 0, 3)]; break;
    case T.SNOW: c = PAL.snow[clamp(Math.floor(n * 2 + 1 + h), 0, 3)]; break;
    default: c = pk('#ff00ff');
  }
  // edges: ink outline on exposed sides, a highlight just inside the top, rounded corners
  const top = ex & 1, right = ex & 2, bot = ex & 4, left = ex & 8;
  if ((top && left && lx === 0 && ly === 0) || (top && right && lx === 7 && ly === 0) ||
      (bot && left && lx === 0 && ly === 7) || (bot && right && lx === 7 && ly === 7)) return -1;
  if ((top && ly === 0) || (bot && ly === 7) || (left && lx === 0) || (right && lx === 7)) return INKP;
  if (top && ly === 1 && id !== T.GRASS && id !== T.MOSS) c = lit(c, 0.18);
  if (bot && ly === 6) c = lit(c, -0.25);
  if (right && lx === 6) c = lit(c, -0.12);
  return c;
}

// non-solid foreground drawn over the background; -1 = let background through
function texDecor(id, lx, ly, px, py, wx, wy, w) {
  const h = hash2(px, py, 5);
  switch (id) {
    case T.LADDER:
      if (lx === 1 || lx === 6) return lx === 1 ? PAL.plank[3] : PAL.plank[1];
      if ((ly & 3) === 1 && lx > 1 && lx < 6) return PAL.plank[2];
      if ((ly & 3) === 2 && lx > 1 && lx < 6) return PAL.plank[0];
      return -1;
    case T.PLATFORM:
      if (ly === 0) return PAL.plank[3];
      if (ly === 1) return PAL.plank[2];
      if (ly === 2) return INKP;
      if (ly < 5 && (lx === 1 || lx === 6)) return PAL.plank[0];
      return -1;
    case T.TRUNK: {
      const below = w.get(wx, wy + 1);
      const flare = tiles[below].solid && ly >= 5 ? 7 - ly : 0;
      if (lx < 1 - flare || lx > 6 + flare) return -1;
      if (lx === 1 - flare || lx === 6 + flare) return INKP;
      return PAL.bark[clamp((lx === 2 ? 3 : lx === 5 ? 0 : 1 + Math.floor(hash2(px, py >> 1, 2) * 2)), 0, 3)];
    }
    case T.LEAVES: case T.PINE: {
      const p = id === T.LEAVES ? PAL.leaves : PAL.pine;
      const nU = w.get(wx, wy - 1) === id, nD = w.get(wx, wy + 1) === id || w.get(wx, wy + 1) === T.TRUNK;
      const nL = w.get(wx - 1, wy) === id, nR = w.get(wx + 1, wy) === id;
      const v = vnoise(px / 2.3, py / 2.3, id);
      const edgeD = Math.min(nL ? 9 : lx, nR ? 9 : 7 - lx, nU ? 9 : ly, nD ? 9 : 7 - ly);
      if (edgeD < 2 && v < 0.45 + edgeD * 0.2) return edgeD === 0 || v < 0.3 ? -1 : INKP;
      const shadeK = id === T.PINE ? ((py >> 1) % 3 === 0 ? 0 : 1) : 0;
      return p[clamp(Math.floor(v * (p.length - 1) + (nU ? 0 : 1) - shadeK + h * 0.6), 0, p.length - 1)];
    }
    case T.TALLGRASS: {
      const hgt = 2 + Math.floor(hash2(px, wy, 3) * 6);
      if (((px * 7) % 3 === 0 || h < 0.3) && 7 - ly < hgt) return PAL.grass[clamp(1 + ((7 - ly) > hgt - 3 ? 1 : 0) + (lx & 1), 0, 3)];
      return -1;
    }
    case T.FLOWER: {
      const col = PAL.flower[Math.floor(hash2(wx, wy, 1) * PAL.flower.length)];
      if (lx === 4 && ly >= 3) return PAL.grass[1];
      if (ly >= 1 && ly <= 2 && lx >= 3 && lx <= 5) return lx === 4 && ly === 1 ? pk('#f0e0a0') : col;
      if (ly === 5 && lx === 5) return PAL.grass[2];
      return -1;
    }
    case T.SUPPORT:
      if (lx < 2 || lx > 5) return -1;
      if (lx === 2) return PAL.timber[3];
      if (lx === 5) return INKP;
      return PAL.timber[1 + ((py >> 2) & 1)];
    case T.FENCE:
      if (lx === 1 || lx === 2) return lx === 1 ? PAL.plank[3] : PAL.plank[1];
      if (ly === 3 || ly === 6) return PAL.plank[2];
      if (ly === 4 || ly === 7) return INKP;
      return -1;
    case T.ROOTS: {
      const col = Math.floor(hash2(px, wy, 4) * 8);
      const len = 3 + Math.floor(hash2(wx, wy, 6) * 5);
      if ((lx === col || lx === (col + 3) % 8) && ly < len) return PAL.bark[ly < 2 ? 2 : 1];
      return -1;
    }
    case T.SHROOM: {
      const cx = 2 + Math.floor(hash2(wx, wy, 7) * 3);
      if (lx === cx + 1 && ly >= 4) return PAL.shroom[0];
      if (ly >= 2 && ly <= 3 && lx >= cx - 1 && lx <= cx + 3) return PAL.shroom[ly === 2 && lx === cx ? 2 : 1];
      if (ly === 1 && lx >= cx && lx <= cx + 2) return PAL.shroom[2];
      return -1;
    }
    default: return -1;
  }
}

function texWall(wid, lx, ly, px, py, wex) {
  const h = hash2(px, py, 21);
  let c;
  switch (wid) {
    case WL.DIRT: c = PAL.wDirt[clamp(Math.floor(vnoise(px / 3, py / 3, 23) * 2.2 + h * 0.9), 0, 2)]; break;
    case WL.STONE: {
      const row = py >> 3;
      c = PAL.wStone[1 + Math.floor(hash2((px + (row & 1) * 4) >> 3, row, 2) * 2)];
      if ((py & 7) === 7 || ((px + (row & 1) * 4) & 7) === 7) c = PAL.wStone[0];
      break;
    }
    case WL.PLANK: c = PAL.wPlank[(px & 3) === 0 ? 0 : 1 + Math.floor(hash2(px >> 2, py >> 4, 3) * 2)]; break;
    case WL.DAUB: {
      c = PAL.wDaub[clamp(Math.floor(vnoise(px / 4, py / 4, 25) * 2.4 + h * 0.5), 0, 2)];
      const tx = Math.floor(px / 8), ty = Math.floor(py / 8);
      if (tx % 5 === 0 && lx < 2) c = PAL.wBeam[lx];
      if (ty % 5 === 0 && ly < 2) c = PAL.wBeam[ly];
      if (tx % 5 !== 0 && ty % 5 !== 0 && ((tx % 5) + (4 - (ty % 5))) % 5 === 0 && Math.abs(lx - (7 - ly)) < 2) c = PAL.wBeam[0];
      break;
    }
    case WL.BRICK: {
      const row = py >> 2;
      c = PAL.wBrick[1 + Math.floor(hash2((px + (row & 1) * 4) >> 3, row, 4) * 2)];
      if ((py & 3) === 3 || ((px + (row & 1) * 4) & 7) === 7) c = PAL.wBrick[0];
      break;
    }
    default: c = pk('#ff00ff');
  }
  // soft inner shadow where the wall ends
  if (((wex & 1) && ly < 2) || ((wex & 8) && lx < 2) || ((wex & 2) && lx > 5) || ((wex & 4) && ly > 5)) c = lit(c, -0.35);
  return c;
}

function texBack(px, py, deep) {
  const p = deep ? PAL.backDeep : PAL.back;
  const v = vnoise(px / 5, py / 5, 41);
  if (hash2(px, py, 43) < 0.012) return lit(p[2], 0.2);
  return p[clamp(Math.floor(v * 2.4 + hash2(px, py, 42) * 0.8), 0, 2)];
}

// ------------------------------------------------------------------ chunks
export class ChunkCache {
  constructor(world) {
    this.world = world;
    this.map = new Map();
  }
  get(cx, cy) {
    const k = cx + ',' + cy;
    let e = this.map.get(k);
    if (!e || this.world.dirty.has(k)) {
      this.world.dirty.delete(k);
      if (!e) {
        const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(CS * TILE, CS * TILE) : Object.assign(document.createElement('canvas'), { width: CS * TILE, height: CS * TILE });
        e = { c, x: c.getContext('2d') };
        this.map.set(k, e);
      }
      this.renderChunk(cx, cy, e);
    }
    return e.c;
  }
  renderChunk(cx, cy, e) {
    const w = this.world, S = CS * TILE;
    const img = e.x.createImageData(S, S);
    const buf = new Uint32Array(img.data.buffer);
    for (let ty = 0; ty < CS; ty++) for (let tx = 0; tx < CS; tx++) {
      const wx = cx * CS + tx, wy = cy * CS + ty;
      if (!w.inb(wx, wy)) continue;
      const id = w.get(wx, wy), td = tiles[id];
      const wid = w.getWall(wx, wy);
      let ex = 0;
      if (td.solid) {
        if (!w.solid(wx, wy - 1)) ex |= 1;
        if (!w.solid(wx + 1, wy)) ex |= 2;
        if (!w.solid(wx, wy + 1)) ex |= 4;
        if (!w.solid(wx - 1, wy)) ex |= 8;
      }
      let wex = 0;
      if (wid) {
        const open = (x, y) => !w.getWall(x, y) && !w.solid(x, y);
        if (open(wx, wy - 1)) wex |= 1;
        if (open(wx + 1, wy)) wex |= 2;
        if (open(wx, wy + 1)) wex |= 4;
        if (open(wx - 1, wy)) wex |= 8;
      }
      const under = wy > w.surface[wx] + 1;
      const deep = wy > w.surface[wx] + 40;
      for (let ly = 0; ly < 8; ly++) for (let lx = 0; lx < 8; lx++) {
        const px = wx * 8 + lx, py = wy * 8 + ly;
        let c = -1;
        if (td.solid) c = texSolid(id, lx, ly, px, py, ex, wx, wy);
        else if (id !== T.AIR) c = texDecor(id, lx, ly, px, py, wx, wy, w);
        if (c === -1) {
          if (wid) c = texWall(wid, lx, ly, px, py, wex);
          else if (under) c = texBack(px, py, deep);
          else c = 0;
        }
        buf[(ty * 8 + ly) * S + tx * 8 + lx] = c;
      }
    }
    e.x.putImageData(img, 0, 0);
    // furniture baked into the chunk
    const x0 = cx * CS, y0 = cy * CS;
    for (const o of w.objectsIn(x0, y0, x0 + CS - 1, y0 + CS - 1)) {
      e.x.drawImage(objSprite(o.type), (o.x - x0) * TILE, (o.y - y0) * TILE);
    }
  }
}

// 8×8 texture of a tile or wall, for item icons
export function tileIcon(def) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(8, 8) : Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
  const x = c.getContext('2d'), img = x.createImageData(8, 8), buf = new Uint32Array(img.data.buffer);
  for (let ly = 0; ly < 8; ly++) for (let lx = 0; lx < 8; lx++) {
    let v;
    if (def.kind === 'wall') v = texWall(def.place, lx, ly, lx + 40, ly + 40, 15);
    else if (tiles[def.place].solid) v = texSolid(def.place, lx, ly, lx + 40, ly + 40, 15, 5, 5);
    else v = texDecor(def.place, lx, ly, lx + 40, ly + 40, 5, 5, { get: () => T.AIR });
    buf[ly * 8 + lx] = v === -1 ? 0 : v;
  }
  x.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ sky
const SKY = [
  { t: 0.0, top: '#060a16', bot: '#131a2e', far: '#161d31', mid: '#0f1422', cloud: '#262c46' },
  { t: 0.2, top: '#08101f', bot: '#1c2240', far: '#1a2138', mid: '#10162a', cloud: '#2a3050' },
  { t: 0.26, top: '#2e3a66', bot: '#e09070', far: '#4e3f5c', mid: '#2c2940', cloud: '#e8b0a0' },
  { t: 0.33, top: '#5a8cc8', bot: '#c6dde4', far: '#7d97aa', mid: '#4a6658', cloud: '#f4f4ee' },
  { t: 0.67, top: '#5a8cc8', bot: '#cadfe4', far: '#7d97aa', mid: '#4a6658', cloud: '#f4f4ee' },
  { t: 0.74, top: '#3a3868', bot: '#ec9460', far: '#5a4560', mid: '#332e48', cloud: '#f0a888' },
  { t: 0.8, top: '#0c1226', bot: '#262848', far: '#1c2238', mid: '#12182a', cloud: '#2a3050' },
  { t: 1.0, top: '#060a16', bot: '#131a2e', far: '#161d31', mid: '#0f1422', cloud: '#262c46' },
];
function mixHex(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const f = (s) => Math.round(((A >> s) & 255) + (((B >> s) & 255) - ((A >> s) & 255)) * t);
  return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
}
export function skyAt(t) {
  let i = 0;
  while (i < SKY.length - 2 && t > SKY[i + 1].t) i++;
  const a = SKY[i], b = SKY[i + 1], k = clamp((t - a.t) / (b.t - a.t), 0, 1);
  const o = {};
  for (const key of ['top', 'bot', 'far', 'mid', 'cloud']) o[key] = mixHex(a[key], b[key], k);
  return o;
}
// sunlight colour/intensity through the day
export function sunAt(t) {
  const keys = [[0, [0.1, 0.12, 0.22]], [0.2, [0.1, 0.12, 0.22]], [0.26, [0.7, 0.5, 0.45]], [0.33, [1, 0.97, 0.9]],
    [0.67, [1, 0.97, 0.9]], [0.74, [0.9, 0.55, 0.42]], [0.8, [0.12, 0.13, 0.25]], [1, [0.1, 0.12, 0.22]]];
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const k = clamp((t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), 0, 1);
  return keys[i][1].map((v, j) => v + (keys[i + 1][1][j] - v) * k);
}

export class Sky {
  constructor(seed) {
    this.stars = [];
    for (let i = 0; i < 140; i++) this.stars.push([hash2(i, 1, seed) * VW, hash2(i, 2, seed) * VH * 0.7, hash2(i, 3, seed)]);
    // ridge lines for parallax layers, tileable over 2048 px
    this.far = []; this.mid = []; this.trees = [];
    for (let x = 0; x <= 2048; x += 8) {
      this.far.push(fbm(x / 300, 1, seed + 3, 3) * 120 + fbm(x / 60, 2, seed + 4, 2) * 18);
      this.mid.push(fbm(x / 180, 5, seed + 5, 3) * 60);
    }
    for (let i = 0; i < 90; i++) this.trees.push([hash2(i, 7, seed) * 2048, 12 + hash2(i, 8, seed) * 18]);
    this.clouds = [];
    for (let i = 0; i < 9; i++) this.clouds.push([hash2(i, 9, seed) * 2048, 20 + hash2(i, 10, seed) * 90, 3 + Math.floor(hash2(i, 11, seed) * 4)]);
  }

  draw(x, t, camX, camY, surfacePx, time) {
    const s = skyAt(t);
    const g = x.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, s.top); g.addColorStop(1, s.bot);
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    const night = t < 0.24 || t > 0.78 ? 1 : t < 0.3 ? (0.3 - t) / 0.06 : t > 0.72 ? (t - 0.72) / 0.06 : 0;
    if (night > 0) {
      for (const [sx, sy, k] of this.stars) {
        const tw = 0.5 + 0.5 * Math.sin(time * (1 + k * 3) + k * 40);
        x.globalAlpha = night * (0.35 + 0.65 * tw) * (0.4 + k * 0.6);
        x.fillStyle = k > 0.85 ? '#fff6d8' : '#cfd8ee';
        x.fillRect(Math.floor(sx), Math.floor(sy), k > 0.93 ? 2 : 1, k > 0.93 ? 2 : 1);
      }
      x.globalAlpha = 1;
    }
    // sun and moon arc
    const hor = VH * 0.62 + clamp((surfacePx - camY - VH * 0.6) * 0.15, -60, 60);
    const sunA = (t - 0.25) / 0.5, moonA = ((t + 0.5) % 1 - 0.25) / 0.5;
    const body = (a, r, col, halo) => {
      if (a < -0.05 || a > 1.05) return;
      const bx = VW * (0.12 + a * 0.76), by = hor - Math.sin(a * Math.PI) * VH * 0.5;
      x.fillStyle = halo; x.globalAlpha = 0.18; x.beginPath(); x.arc(bx, by, r * 2.4, 0, 7); x.fill();
      x.globalAlpha = 0.3; x.beginPath(); x.arc(bx, by, r * 1.5, 0, 7); x.fill();
      x.globalAlpha = 1; x.fillStyle = col; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill();
    };
    body(sunA, 11, '#fff2c4', '#ffd890');
    body(moonA, 8, '#e8eef6', '#a8b8d8');
    // clouds
    x.fillStyle = s.cloud;
    for (const [cx0, cy, n] of this.clouds) {
      const cxp = ((cx0 - camX * 0.05 + time * 4) % 2300 + 2300) % 2300 - 150;
      if (cxp < -120 || cxp > VW + 120) continue;
      for (let k = 0; k < n; k++) {
        x.beginPath(); x.arc(Math.round(cxp + k * 10), Math.round(cy - (k % 2) * 5), 8 + (k % 2) * 3, 0, 7); x.fill();
      }
      x.fillRect(Math.round(cxp - 8), Math.round(cy), n * 10 + 8, 6);
    }
    // far mountains and near hills with pine silhouettes
    const layer = (pts, par, baseY, col, trees) => {
      const off = ((camX * par) % 2048 + 2048) % 2048;
      const by = baseY - (camY - (surfacePx - VH * 0.55)) * par;
      x.fillStyle = col;
      x.beginPath(); x.moveTo(0, VH);
      for (let sx = 0; sx <= VW + 8; sx += 4) {
        const p = (sx + off) % 2048, i = Math.floor(p / 8), f = (p % 8) / 8;
        const hh = pts[i] + (pts[i + 1] - pts[i]) * f;
        x.lineTo(sx, Math.round(by - hh));
      }
      x.lineTo(VW, VH); x.closePath(); x.fill();
      if (trees) {
        for (const [tx, th] of this.trees) {
          const sx = ((tx - off) % 2048 + 2048) % 2048;
          if (sx > VW + 10) continue;
          const i = Math.floor(((sx + off) % 2048) / 8);
          const ty = Math.round(by - pts[i]);
          x.beginPath(); x.moveTo(Math.round(sx), ty - th); x.lineTo(Math.round(sx) - th * 0.3, ty + 2); x.lineTo(Math.round(sx) + th * 0.3, ty + 2); x.closePath(); x.fill();
        }
      }
      x.fillRect(0, Math.round(by - 1), VW, VH);
    };
    layer(this.far, 0.12, VH * 0.78, s.far, false);
    layer(this.mid, 0.3, VH * 0.95, s.mid, true);
  }
}

// ------------------------------------------------------------------ WebGL compositor
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
  if (f.a < 0.5) {
    vec3 c = texture(uBack, uv).rgb;
    o = vec4(floor(c * 30.0 + b) / 30.0, 1.0);
    return;
  }
  vec2 lp = (vec2(ip) + 0.5 - uLightOff) / 8.0;
  vec3 L = texture(uLight, lp / uLightSize).rgb * (255.0 / 170.0);
  L = floor(L * 7.0 + b) / 7.0;
  vec3 c = f.rgb * max(L, vec3(0.035, 0.035, 0.05));
  o = vec4(c, 1.0);
}`;

export class Compositor {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true });
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
    this.pr = pr;
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, filter) => {
      const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.tBack = tex(0, gl.NEAREST); this.tFront = tex(1, gl.NEAREST); this.tLight = tex(2, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(pr, 'uBack'), 0);
    gl.uniform1i(gl.getUniformLocation(pr, 'uFront'), 1);
    gl.uniform1i(gl.getUniformLocation(pr, 'uLight'), 2);
    this.uRes = gl.getUniformLocation(pr, 'uRes');
    this.uLightSize = gl.getUniformLocation(pr, 'uLightSize');
    this.uLightOff = gl.getUniformLocation(pr, 'uLightOff');
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
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

export { shade };
