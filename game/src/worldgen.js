// World generation: terrain, caves, ores, trees, grottos, wolf dens, villages.
import { World } from './world.js';
import { T, W } from './content.js';
import { fbm, vnoise, hash2, rng, clamp } from './noise.js';
import { surfaceVillage, burrowVillage, villageName } from './villagegen.js';

export const WORLD_W = 1400, WORLD_H = 300;

const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

export function generate(seed) {
  const world = new World(WORLD_W, WORLD_H, seed);
  const r = rng(seed);
  const S = seed % 100000;
  const cx = WORLD_W >> 1;
  const base = 96;

  // village sites decide the shape of the land first
  const sites = [
    { type: 'surface', x0: cx + 24, x1: cx + 150 },
    { type: 'burrow', x0: cx - 150, x1: cx - 50 },
    { type: 'surface', x0: cx + 360, x1: cx + 486 },
    { type: 'burrow', x0: cx - 470, x1: cx - 370 },
  ];
  const rawH = (x) => base + (fbm(x / 160, 0.5, S + 1, 3) - 0.5) * 70 + (fbm(x / 34, 3.3, S + 2, 2) - 0.5) * 12;
  for (const s of sites) {
    s.level = Math.round(rawH((s.x0 + s.x1) / 2));
    if (s.type === 'burrow') s.level -= 18;              // a hill to dig into
  }
  const height = (x) => {
    let h = rawH(x);
    for (const s of sites) {
      const blend = 14;
      const t = x < s.x0 ? smooth((x - (s.x0 - blend)) / blend) : x > s.x1 ? smooth(((s.x1 + blend) - x) / blend) : 1;
      if (t > 0) {
        const target = s.type === 'burrow' ? s.level + (fbm(x / 20, 7, S + 3, 2) - 0.5) * 4 : s.level;
        h = h + (target - h) * t;
      }
    }
    return Math.round(h);
  };

  // --- terrain columns ---
  for (let x = 0; x < WORLD_W; x++) {
    const h = height(x);
    world.surface[x] = h;
    const dirtDepth = 9 + Math.floor(fbm(x / 30, 1, S + 4, 2) * 8);
    for (let y = 0; y < WORLD_H; y++) {
      const i = y * WORLD_W + x;
      if (y < h) continue;
      let t;
      if (y === h) t = T.GRASS;
      else if (y < h + dirtDepth) t = T.DIRT;
      else t = fbm(x / 18, y / 14, S + 5, 2) > 0.66 ? T.DIRT : T.STONE;
      if (y >= WORLD_H - 3 || (y >= WORLD_H - 6 && hash2(x, y, S) < 0.5)) t = T.BEDROCK;
      world.fg[i] = t;
      if (y > h + 1) world.wall[i] = 0;
    }
  }
  const inVillage = (x, pad = 6) => sites.some((s) => x >= s.x0 - pad && x <= s.x1 + pad);

  // --- caves: cheese caverns and worm tunnels ---
  for (let x = 0; x < WORLD_W; x++) {
    const h = world.surface[x];
    const protect = inVillage(x, 10);
    for (let y = h + 3; y < WORLD_H - 6; y++) {
      const depth = y - h;
      if (protect && depth < 60) continue;
      const i = y * WORLD_W + x;
      const cheese = fbm(x / 46, y / 26, S + 10, 3);
      const worm = Math.abs(fbm(x / 70, y / 50, S + 11, 3) - 0.5);
      const wormW = 0.014 + clamp((depth - 10) / 200, 0, 0.012);
      let carve = (depth > 14 && cheese > 0.655 - clamp(depth / 900, 0, 0.05)) || (depth > 4 && worm < wormW);
      if (depth < 12 && vnoise(x / 30, 99, S + 12) < 0.62) carve = carve && worm < wormW * 0.7;
      if (carve && world.fg[i] !== T.BEDROCK) world.fg[i] = T.AIR;
    }
  }

  // --- ores and clay ---
  for (let x = 0; x < WORLD_W; x++) {
    const h = world.surface[x];
    for (let y = h + 2; y < WORLD_H - 3; y++) {
      const i = y * WORLD_W + x, t = world.fg[i];
      if (t !== T.STONE && t !== T.DIRT) continue;
      const d = y - h;
      if (t === T.DIRT && d < 14 && vnoise(x / 5, y / 4, S + 20) > 0.8) world.fg[i] = T.CLAY;
      else if (d > 6 && vnoise(x / 3.5, y / 3.5, S + 21) > 0.8) world.fg[i] = T.COAL;
      else if (d > 18 && vnoise(x / 3, y / 3, S + 22) > 0.83) world.fg[i] = T.COPPER;
      else if (d > 48 && vnoise(x / 3, y / 3, S + 23) > 0.84) world.fg[i] = T.IRON;
    }
  }

  // --- glowing grottos: big caverns lit by moss, mushrooms and amber crystals ---
  const grottos = [];
  for (const gx of [cx - 260, cx + 240, cx - 40, cx + 560]) {
    const gy = world.surface[gx] + 55 + Math.floor(r() * 50);
    const rx = 26 + Math.floor(r() * 14), ry = 11 + Math.floor(r() * 5);
    grottos.push({ x: gx, y: gy, rx, ry });
    for (let y = gy - ry - 6; y <= gy + ry + 2; y++) for (let x = gx - rx - 6; x <= gx + rx + 6; x++) {
      if (!world.inb(x, y)) continue;
      const dx = (x - gx) / rx, dy = (y - gy) / ry;
      const k = dx * dx + dy * dy * (y > gy ? 1.8 : 1) + (fbm(x / 7, y / 7, S + 30, 2) - 0.5) * 0.5;
      if (k < 1 && world.fg[y * WORLD_W + x] !== T.BEDROCK) world.fg[y * WORLD_W + x] = T.AIR;
    }
    for (let y = gy - ry - 6; y <= gy + ry + 6; y++) for (let x = gx - rx - 6; x <= gx + rx + 6; x++) {
      if (!world.inb(x, y - 1) || !world.inb(x, y + 1)) continue;
      const i = y * WORLD_W + x, t = world.fg[i];
      const solid = t === T.STONE || t === T.DIRT || t === T.COAL;
      if (solid && world.fg[i - WORLD_W] === T.AIR) {
        world.fg[i] = T.MOSS;
        const k = hash2(x, y, S + 31);
        if (k < 0.35) world.fg[i - WORLD_W] = T.SHROOM;
        else if (k < 0.45) world.fg[i - WORLD_W] = T.TALLGRASS;
      } else if (solid && world.fg[i + WORLD_W] === T.AIR) {
        if (hash2(x, y, S + 32) < 0.12) world.fg[i] = T.CRYSTAL;
        else if (hash2(x, y, S + 33) < 0.3 && world.fg[i + 2 * WORLD_W] === T.AIR) world.fg[i + WORLD_W] = T.ROOTS;
      } else if (solid && (world.fg[i - 1] === T.AIR || world.fg[i + 1] === T.AIR) && hash2(x, y, S + 34) < 0.06) {
        world.fg[i] = T.CRYSTAL;
      }
    }
  }
  world.grottos = grottos;

  // --- wolf dens: a hollow under the ground with a ramp to the surface ---
  for (const dx of [cx - 230, cx + 280, cx + 620, cx - 620]) {
    const top = world.surface[dx];
    const fy = top + 20;                                     // den floor row (solid below)
    const x0 = dx - 16, x1 = dx + 16;
    for (let y = fy - 9; y < fy; y++) for (let x = x0 - 4; x <= x1 + 4; x++) {
      const t = (x - dx) / 19, u = (fy - y) / 9;
      if (t * t + u * u * u < 1 + (fbm(x / 5, y / 5, S + 40, 2) - 0.5) * 0.4) {
        world.fg[y * WORLD_W + x] = T.AIR;
      }
    }
    for (let x = x0 - 6; x <= x1 + 6; x++) if (world.fg[fy * WORLD_W + x] === T.AIR) world.fg[fy * WORLD_W + x] = T.DIRT;
    // ramp: 2-wide slope up to the surface on the left
    let x = x0 + 2, y = fy - 1;
    while (y > world.surface[x] - 1 && x > 2) {
      for (let yy = y - 3; yy <= y; yy++) world.fg[yy * WORLD_W + x] = T.AIR;
      x--; y--;
      for (let yy = y - 3; yy <= y + 1; yy++) world.fg[yy * WORLD_W + x] = yy === y + 1 ? world.fg[yy * WORLD_W + x] : T.AIR;
    }
    world.dens.push({ x: dx, y: fy - 1, x0, x1, mouth: { x, y } });
    for (let k = 0; k < 3; k++) world.addObject('bones', x0 + 4 + k * 9, fy - 1, null, true);
  }

  // --- villages ---
  for (let k = 0; k < sites.length; k++) {
    const s = sites[k];
    const v = { id: k, name: villageName(r), x0: s.x0, x1: s.x1, grudge: 0, residents: [], buildings: [] };
    world.villages.push(v);
    if (s.type === 'surface') surfaceVillage(world, v, s.x0, s.x1, s.level, r);
    else burrowVillage(world, v, s.x0, s.x1, s.level, r);
  }

  // --- trees and grass ---
  let next = 0;
  for (let x = 3; x < WORLD_W - 3; x++) {
    const h = world.surface[x];
    if (world.fg[h * WORLD_W + x] !== T.GRASS || world.fg[(h - 1) * WORLD_W + x] !== T.AIR) continue;
    if (inVillage(x, 4)) {
      if (hash2(x, 1, S + 50) < 0.5 && world.fg[(h - 1) * WORLD_W + x] === T.AIR) world.fg[(h - 1) * WORLD_W + x] = hash2(x, 2, S) < 0.2 ? T.FLOWER : T.TALLGRASS;
      continue;
    }
    const forest = fbm(x / 90, 0, S + 51, 2);
    if (x >= next && hash2(x, 0, S + 52) < 0.18 + forest * 0.35) {
      const pine = fbm(x / 140, 5, S + 53, 2) > 0.52;
      if (growTree(world, x, h - 1, pine, hash2(x, 3, S))) { next = x + 4 + Math.floor(hash2(x, 4, S) * 5); continue; }
    }
    const g = hash2(x, 5, S + 54);
    if (g < 0.45) world.fg[(h - 1) * WORLD_W + x] = g < 0.08 ? T.FLOWER : T.TALLGRASS;
  }

  world.updateAllSky();
  world.spawn = { x: cx, y: world.surface[cx] - 2 };
  return world;
}

export function growTree(world, x, y, pine, k) {
  const h = (pine ? 9 : 6) + Math.floor(k * 6);
  for (let j = 0; j < h + 4; j++) for (let i = -3; i <= 3; i++) {
    const t = world.get(x + i, y - j);
    if (t !== T.AIR && t !== T.TALLGRASS && t !== T.FLOWER) return false;
  }
  for (let j = 0; j < h; j++) world.fg[(y - j) * world.w + x] = T.TRUNK;
  const leaf = pine ? T.PINE : T.LEAVES;
  const top = y - h + 1;
  if (pine) {
    for (let j = -2; j < h - 2; j++) {
      const rad = Math.floor((j + 2) / 3) % 2 === 0 ? Math.min(3, 1 + (j + 2) / 4) : Math.min(2, (j + 2) / 5);
      for (let i = -Math.round(rad); i <= Math.round(rad); i++) {
        const tx = x + i, ty = top + j;
        if (i !== 0 && world.get(tx, ty) === T.AIR) world.fg[ty * world.w + tx] = leaf;
        else if (i === 0 && j < 0) world.fg[ty * world.w + tx] = leaf;
      }
    }
  } else {
    const rx = 3, ry = 3;
    for (let j = -ry; j <= ry - 1; j++) for (let i = -rx; i <= rx; i++) {
      const d = (i * i) / (rx * rx) + (j * j) / (ry * ry);
      if (d < 1.05 + hash2(x + i, top + j, 9) * 0.25) {
        const tx = x + i, ty = top + j - 1;
        if (world.get(tx, ty) === T.AIR) world.fg[ty * world.w + tx] = leaf;
      }
    }
  }
  return true;
}
