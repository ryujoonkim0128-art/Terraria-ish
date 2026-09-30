// Procedural villages: surface timber villages and burrow villages dug into hills.
import { T, W, OBJ } from './content.js';

const SYL_A = ['Oak', 'Ash', 'Fern', 'Moss', 'Ember', 'Wick', 'Barrow', 'Thorn', 'Heath', 'Bram', 'Lark', 'Sedge', 'Rook', 'Alder'];
const SYL_B = ['wick', 'dale', 'hollow', 'stead', 'ford', 'mere', 'burrow', 'den', 'combe', 'holt', 'ley'];
export function villageName(r) { return SYL_A[Math.floor(r() * SYL_A.length)] + SYL_B[Math.floor(r() * SYL_B.length)]; }

const pick = (r, a) => a[Math.floor(r() * a.length)];

function fill(world, x0, y0, x1, y1, fg, wall) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!world.inb(x, y)) continue;
    const i = y * world.w + x;
    if (fg !== undefined && fg !== null) world.fg[i] = fg;
    if (wall !== undefined && wall !== null) world.wall[i] = wall;
  }
}

// Try object placements left to right inside [x0, x1] with bottom row on floorY-1.
function furnish(world, list, x0, x1, floorY, owner, skip = new Set(), out = []) {
  let x = x0;
  for (const type of list) {
    const d = OBJ[type];
    let placed = null;
    while (x + d.w - 1 <= x1 && !placed) {
      let blocked = false;
      for (let i = 0; i < d.w; i++) if (skip.has(x + i)) blocked = true;
      if (!blocked) placed = world.addObject(type, x, floorY - d.h, owner);
      if (!placed) x++;
    }
    if (placed) { out.push(placed); x += d.w + (type === 'chair' ? 0 : 1); }
  }
  return out;
}

function hangLantern(world, x, ceilY, owner) {
  // lantern hangs one row below a ceiling at ceilY
  if (world.get(x, ceilY + 1) === T.AIR && !world.objectAt(x, ceilY + 1)) return world.addObject('lantern', x, ceilY + 1, owner, true);
  return null;
}

// ------------------------------------------------------------------ surface buildings
const FH = 5; // floor-to-floor height: 1 floor row + 4 rows of headroom

function building(world, v, x, gy, spec, style, r) {
  const { w, floors, kind } = spec;
  const x1 = x + w - 1;
  const top = gy - FH * floors;                 // attic floor row
  const wallBg = style.wall;
  // foundation
  fill(world, x - 1, gy, x1 + 1, gy + 1, style.found, null);
  // clear the volume and paint background walls
  fill(world, x, top, x1, gy - 1, T.AIR, null);
  fill(world, x + 1, top, x1 - 1, gy - 1, null, wallBg);
  // side walls (timber frame), doorways on the ground floor
  for (let y = top; y < gy; y++) { world.fg[y * world.w + x] = style.frame; world.fg[y * world.w + x1] = style.frame; }
  for (let y = gy - 3; y < gy; y++) { world.fg[y * world.w + x] = T.AIR; world.fg[y * world.w + x1] = T.AIR; world.wall[y * world.w + x] = wallBg; world.wall[y * world.w + x1] = wallBg; }
  // floors, alternating ladder side, windows on upper floors
  const ladders = [];
  for (let f = 1; f <= floors; f++) {
    const fy = gy - FH * f;                     // floor row of storey f (f = floors -> attic floor)
    fill(world, x + 1, fy, x1 - 1, fy, T.PLANK, null);
    const lx = f % 2 ? x + 2 : x1 - 2;
    ladders.push({ x: lx, top: fy, bottom: fy + FH - 1 });
    for (let y = fy; y < fy + FH; y++) world.fg[y * world.w + lx] = T.LADDER;
    if (f >= 2) {
      world.fg[(fy + 2) * world.w + x] = T.GLASS; world.fg[(fy + 2) * world.w + x1] = T.GLASS;
      world.fg[(fy + 3) * world.w + x] = T.GLASS; world.fg[(fy + 3) * world.w + x1] = T.GLASS;
    }
  }
  // roof: A-frame with an attic inside
  let span = [x - 2, x1 + 2], ry = top;
  const roofRows = [];
  while (span[1] - span[0] >= 1) {
    for (let xx = span[0]; xx <= span[1]; xx++) {
      const edge = xx - span[0] < 2 || span[1] - xx < 2 || ry === top;
      if (ry === top && xx > x && xx < x1) continue;              // keep the attic floor planks
      if (edge) world.fg[ry * world.w + xx] = style.roof;
      else { world.fg[ry * world.w + xx] = T.AIR; world.wall[ry * world.w + xx] = W.PLANK; }
    }
    roofRows.push(ry);
    span = [span[0] + 1, span[1] - 1];
    ry--;
  }
  const attic = { floor: top, x0: x + 2, x1: x1 - 2 };

  const out = { x, x1, gy, top, kind, beds: [], stations: [], tables: [], storage: [], chimney: null, floors: [] };
  const plan = spec.plan;
  for (let f = 0; f < floors; f++) {
    const floorRow = gy - FH * f;                 // the row villagers stand on (+1 below feet)
    const ceil = gy - FH * (f + 1);
    const skip = new Set();
    for (const l of ladders) if (l.bottom >= floorRow - 1 && l.top <= floorRow) skip.add(l.x);
    for (const l of ladders) if (l.top === ceil) skip.add(l.x);
    const objs = furnish(world, plan[f] || [], x + 1, x1 - 1, floorRow, v.id, skip);
    out.floors.push({ y: floorRow - 1, x0: x + 1, x1: x1 - 1 });
    for (const o of objs) {
      const tags = OBJ[o.type].tags;
      if (tags.includes('bed')) out.beds.push(o);
      if (tags.includes('station')) out.stations.push(o);
      if (tags.includes('table')) out.tables.push(o);
      if (tags.includes('storage')) out.storage.push(o);
      if (o.type === 'hearth') out.hearth = o;
    }
    // light: lantern hanging mid-room
    const lxs = w > 12 ? [x + Math.floor(w / 3), x + Math.floor(2 * w / 3)] : [x + Math.floor(w / 2)];
    for (const lx of lxs) if (!skip.has(lx)) hangLantern(world, lx, ceil, v.id);
  }
  // attic storage
  const ao = furnish(world, ['sack', 'crate', 'sack'], attic.x0, attic.x1, top, v.id, new Set(ladders.map((l) => l.x)));
  out.storage.push(...ao);
  out.attic = attic;
  // chimney stack standing on the roof slope above the hearth side
  if (out.hearth) {
    const cx = Math.min(Math.max(out.hearth.x + 1, x + 2), x1 - 2);
    let sy = top - 1;
    while (sy > top - 40 && !(world.get(cx, sy) === style.roof && world.get(cx, sy - 1) !== style.roof)) sy--;
    for (let y = sy - 3; y <= sy; y++) world.fg[y * world.w + cx] = T.BRICK;
    out.chimney = { x: cx, y: sy - 4 };
  }
  out.ladders = ladders;
  out.door = [{ x, y: gy - 1 }, { x: x1, y: gy - 1 }];
  return out;
}

const PLANS = {
  house: { w: [11, 13], floors: 2, plan: [['hearth', 'table', 'chair', 'shelf'], ['bed', 'chest', 'bed']], role: 'cook' },
  tavern: { w: [17, 19], floors: 2, plan: [['barrel', 'barrel', 'table', 'chair', 'chair', 'table', 'hearth'], ['bed', 'bed', 'bed', 'chest']], role: 'keeper' },
  smithy: { w: [13, 14], floors: 1, plan: [['furnace', 'anvil', 'workbench', 'barrel'], []], role: 'smith' },
  granary: { w: [8, 9], floors: 3, plan: [['sack', 'sack', 'crate'], ['sack', 'barrel'], ['bed', 'sack']], role: 'hauler' },
  weaver: { w: [12, 13], floors: 2, plan: [['loom', 'yarn', 'chair'], ['bed', 'bed', 'shelf']], role: 'weaver' },
  library: { w: [12, 13], floors: 2, plan: [['bookshelf', 'table', 'chair'], ['bed', 'bookshelf']], role: 'elder' },
};

export function surfaceVillage(world, v, x0, x1, gy, r) {
  const style = pick(r, [
    { wall: W.DAUB, frame: T.TIMBER, roof: T.THATCH, found: T.BRICK },
    { wall: W.PLANK, frame: T.TIMBER, roof: T.THATCH, found: T.COBBLE },
    { wall: W.DAUB, frame: T.TIMBER, roof: T.PLANK, found: T.BRICK },
  ]);
  v.type = 'surface';
  const kinds = ['house', 'smithy', 'tavern', 'granary', 'house', 'weaver', 'library', 'house'];
  // shuffle lightly but keep the tavern near the middle
  const order = [kinds[0], kinds[1], kinds[3], kinds[2], kinds[5], kinds[4], r() < 0.5 ? 'library' : 'house'];
  let x = x0 + 5;
  const bs = [];
  let plaza = null;
  for (let k = 0; k < order.length; k++) {
    const kind = order[k];
    const P = PLANS[kind];
    const w = P.w[0] + Math.floor(r() * (P.w[1] - P.w[0] + 1));
    if (x + w + 2 > x1) break;
    const b = building(world, v, x, gy, { w, floors: P.floors, plan: P.plan, kind }, style, r);
    b.role = P.role;
    bs.push(b);
    x += w;
    if (k === 2) { plaza = { x0: x + 1, x1: x + 12 }; x += 13; }       // the village square
    else x += 4 + Math.floor(r() * 4);
  }
  v.buildings = bs;
  // outdoor details in the gaps between houses
  for (let i = 0; i + 1 < bs.length; i++) {
    const g0 = bs[i].x1 + 2, g1 = bs[i + 1].x - 2;
    if (plaza && g0 <= plaza.x0 && g1 >= plaza.x1 - 1) continue;
    const gx = (g0 + g1) >> 1;
    if (g1 - g0 < 1) continue;
    const k = r();
    if (k < 0.4) world.addObject('lamppost', gx, gy - 4, v.id);
    else if (k < 0.7) world.addObject('crate', gx, gy - 2, v.id) || world.addObject('sack', gx, gy - 1, v.id);
    else { world.fg[(gy - 1) * world.w + g0] = T.FENCE; world.fg[(gy - 1) * world.w + g1] = T.FENCE; }
  }
  if (plaza) {
    world.addObject('well', plaza.x0 + 1, gy - 4, v.id);
    world.addObject('campfire', plaza.x0 + 7, gy - 1, v.id);
    v.gather = { x: plaza.x0 + 7, y: gy - 1 };
  } else v.gather = { x: bs[0].x1 + 2, y: gy - 1 };
  v.chimneys = bs.filter((b) => b.chimney).map((b) => b.chimney);
  // lamp posts at the edges mark the guard posts
  world.addObject('lamppost', x0 + 1, gy - 4, v.id);
  world.addObject('lamppost', Math.min(x1 - 1, x + 1), gy - 4, v.id);
  v.posts = [{ x: x0 + 2, y: gy - 1 }, { x: Math.min(x1 - 2, x + 2), y: gy - 1 }];
  // cellar under the first house: storage the hauler visits
  const h0 = bs.find((b) => b.kind === 'house' || b.kind === 'tavern');
  if (h0) {
    const cy = gy + 5;                               // cellar floor row
    fill(world, h0.x + 1, gy + 1, h0.x1 - 1, cy - 1, T.AIR, W.DIRT);
    fill(world, h0.x + 1, cy, h0.x1 - 1, cy, T.PLANK, null);
    const lx = h0.x1 - 2;
    for (let y = gy; y < cy; y++) world.fg[y * world.w + lx] = T.LADDER;
    const co = furnish(world, ['barrel', 'sack', 'sack', 'crate'], h0.x + 1, h0.x1 - 3, cy, v.id);
    h0.storage.push(...co);
    hangLantern(world, h0.x + 4, gy, v.id);
    h0.cellar = { y: cy - 1 };
  }
  collectResidents(v, bs, r);
}

// ------------------------------------------------------------------ burrow villages
function room(world, cx, floorY, w, h, r, wall = W.DIRT) {
  const x0 = cx - (w >> 1), x1 = x0 + w - 1;
  for (let y = floorY - h; y < floorY; y++) {
    const t = (floorY - y) / h;                              // 0 at floor .. 1 at top
    const shrink = t > 0.6 ? Math.round(((t - 0.6) / 0.4) ** 1.6 * (w * 0.35)) : 0;
    for (let x = x0 + shrink; x <= x1 - shrink; x++) {
      const i = y * world.w + x;
      world.fg[i] = T.AIR; world.wall[i] = wall;
    }
  }
  for (let x = x0 - 1; x <= x1 + 1; x++) world.fg[floorY * world.w + x] = T.PLANK;
  // support posts and a beam
  for (let y = floorY - 5; y < floorY; y++) {
    if (world.get(x0, y) === T.AIR) world.fg[y * world.w + x0] = T.SUPPORT;
    if (world.get(x1, y) === T.AIR) world.fg[y * world.w + x1] = T.SUPPORT;
  }
  for (let x = x0; x <= x1; x++) if (world.get(x, floorY - 6) === T.AIR) world.fg[(floorY - 6) * world.w + x] = T.PLATFORM;
  return { x0, x1, floorY, top: floorY - h };
}

function tunnel(world, xa, xb, floorY) {
  const a = Math.min(xa, xb), b = Math.max(xa, xb);
  for (let x = a; x <= b; x++) {
    for (let y = floorY - 3; y < floorY; y++) { world.fg[y * world.w + x] = T.AIR; world.wall[y * world.w + x] = W.DIRT; }
    world.fg[floorY * world.w + x] = T.PLANK;
  }
}

function shaft(world, x, topFloor, bottomFloor) {
  for (let y = topFloor; y < bottomFloor; y++) {
    world.fg[y * world.w + x] = T.LADDER;
    world.wall[y * world.w + x] = W.DIRT;
  }
}

export function burrowVillage(world, v, x0, x1, surf, r) {
  v.type = 'burrow';
  const L1 = surf + 14, L2 = L1 + 11, L3 = L2 + 12;         // floor rows of each level
  const c = (x0 + x1) >> 1;
  const rooms = [];
  const mk = (cx, fy, w, h, purpose, wall) => { const rm = room(world, cx, fy, w, h, r, wall); rm.purpose = purpose; rooms.push(rm); return rm; };
  const hall = mk(c, L1, 26, 8, 'hall');
  const bunk = mk(c + 26, L1, 18, 7, 'bunk');
  const pantry = mk(c - 24, L2, 16, 7, 'pantry');
  const forge = mk(c + 4, L2, 18, 7, 'forge', W.STONE);
  const farm = mk(c + 25, L2, 16, 7, 'farm');
  const mine = mk(c + 6, L3, 36, 7, 'mine', W.STONE);
  tunnel(world, hall.x1, bunk.x0, L1);
  tunnel(world, pantry.x1, forge.x0, L2);
  tunnel(world, forge.x1, farm.x0, L2);
  shaft(world, hall.x0 + 3, L1, L2);                          // hall -> forge level (lands in the forge/pantry tunnel)
  shaft(world, c + 10, L1, L2);
  shaft(world, forge.x0 + 3, L2, L3);
  shaft(world, farm.x0 + 3, L2, L3);
  // stair entrance from the surface down into the hall
  const sx = hall.x0 - 16;
  const s0 = world.surface[sx];
  let sy = s0 - 1, xx = sx;
  const stairTop = { x: sx, y: s0 - 1 };
  while (sy < L1 - 1) {
    for (let y = sy - 3; y <= sy; y++) {
      if (!world.inb(xx, y)) continue;
      world.fg[y * world.w + xx] = T.AIR;
      if (y > world.surface[xx] + 1) world.wall[y * world.w + xx] = W.DIRT;
    }
    world.fg[(sy + 1) * world.w + xx] = T.PLANK;
    xx++; sy++;
  }
  tunnel(world, xx - 1, hall.x0, L1);
  // entrance hood (thatch lean-to) and a flue from the hall to the sky
  for (let i = -3; i < 5; i++) world.fg[(s0 - 5) * world.w + sx + i] = T.THATCH;
  for (let i = -2; i < 4; i++) world.fg[(s0 - 6) * world.w + sx + i] = T.THATCH;
  for (let y = s0 - 4; y < s0; y++) world.fg[y * world.w + sx - 3] = T.TIMBER;
  const own = v.id;
  const H = furnish(world, ['hearth', 'table', 'chair', 'chair', 'table', 'barrel'], hall.x0 + 1, hall.x1 - 1, L1, own, new Set([hall.x0 + 3, c + 10]));
  const hearth = H.find((o) => o.type === 'hearth');
  if (hearth) {
    const fx = hearth.x + 1;
    for (let y = world.surface[fx] - 3; y < hearth.y; y++) { world.fg[y * world.w + fx] = T.BRICK; }
  }
  const B = furnish(world, ['bed', 'bed', 'bed', 'bed'], bunk.x0 + 1, bunk.x1 - 1, L1, own);
  const P = furnish(world, ['bed', 'sack', 'sack', 'barrel', 'crate'], pantry.x0 + 1, pantry.x1 - 1, L2, own);
  const F = furnish(world, ['furnace', 'anvil', 'workbench'], forge.x0 + 5, forge.x1 - 1, L2, own, new Set([forge.x0 + 3, c + 10]));
  const R = furnish(world, ['bed', 'bed', 'yarn'], farm.x0 + 5, farm.x1 - 1, L2, own);
  const M = furnish(world, ['minecart', 'crate'], mine.x0 + 6, mine.x1 - 3, L3, own, new Set([forge.x0 + 3, farm.x0 + 3]));
  // glowing mushroom beds along the farm floor
  for (let x = farm.x0 + 1; x < farm.x0 + 4; x++) if (world.get(x, L2 - 1) === T.AIR) world.fg[(L2 - 1) * world.w + x] = T.SHROOM;
  // ore glints in the mine walls
  for (let i = 0; i < 18; i++) {
    const ox = mine.x0 - 2 + Math.floor(r() * (mine.x1 - mine.x0 + 4)), oy = L3 - 9 + Math.floor(r() * 10);
    if (world.get(ox, oy) === T.DIRT || world.get(ox, oy) === T.STONE) world.fg[oy * world.w + ox] = r() < 0.5 ? T.COPPER : T.COAL;
  }
  for (const rm of rooms) hangLantern(world, (rm.x0 + rm.x1) >> 1, rm.floorY - 6, own) || hangLantern(world, ((rm.x0 + rm.x1) >> 1) + 1, rm.floorY - 6, own);
  world.addObject('torch', sx - 2, s0 - 3, own, true);
  // treat the whole warren as one "building" set so the resident logic can reuse it
  const b = (rm, objs, role, extra = {}) => ({
    x: rm.x0, x1: rm.x1, gy: rm.floorY, kind: rm.purpose, role,
    beds: objs.filter((o) => o.type === 'bed'), stations: objs.filter((o) => OBJ[o.type].tags.includes('station')),
    tables: objs.filter((o) => o.type === 'table'), storage: objs.filter((o) => OBJ[o.type].tags.includes('storage')),
    floors: [{ y: rm.floorY - 1, x0: rm.x0 + 1, x1: rm.x1 - 1 }], ...extra,
  });
  const bs = [
    b(hall, H, 'cook', { hearth }), b(bunk, B, 'kid'), b(pantry, P, 'hauler'), b(forge, F, 'smith'),
    b(farm, R, 'farmer'), b(mine, M, 'miner', { mineFace: { x: mine.x1 - 2, y: L3 - 1 } }),
  ];
  v.buildings = bs;
  v.gather = { x: hall.x0 + 12, y: L1 - 1 };
  v.posts = [{ x: xx - 2, y: L1 - 1 }, { x: stairTop.x + 1, y: stairTop.y }];
  v.chimneys = hearth ? [{ x: hearth.x + 1, y: world.surface[hearth.x + 1] - 4 }] : [];
  collectResidents(v, bs, r);
}

// Residents: one per bed. Roles come from what the building is for.
function collectResidents(v, bs, r) {
  const beds = [];
  for (const b of bs) for (const bed of b.beds) beds.push({ bed, b });
  const stations = bs.flatMap((b) => b.stations.map((s) => ({ s, b })));
  const storage = bs.flatMap((b) => b.storage);
  v.storage = storage;
  v.tables = bs.flatMap((b) => b.tables);
  v.stations = stations.map((x) => x.s);
  v.residents = [];
  let guards = 0, kids = 0;
  const roleQueue = [];
  for (const b of bs) if (b.role) roleQueue.push({ role: b.role, b });
  beds.forEach(({ bed, b }, i) => {
    let role, work = null;
    if (i < roleQueue.length) { role = roleQueue[i].role; work = roleQueue[i].b; }
    else if (guards < 2) { role = 'guard'; guards++; }
    else if (kids < 3 && r() < 0.7) { role = 'kid'; kids++; }
    else role = pick(r, ['hauler', 'elder', 'farmer']);
    v.residents.push({ role, bed, work });
  });
  if (guards === 0 && v.residents.length > 2) v.residents[v.residents.length - 1].role = 'guard';
}
