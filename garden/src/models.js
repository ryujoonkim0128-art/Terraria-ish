// Voxel models: crops at each growth stage, fruit (with mutation recolours), stalls, characters, scenery.
import { Vox, mesh, rng, hash, shade, mixc, hex } from './voxel.js';

const cache = new Map();
export const memo = (k, fn) => { let v = cache.get(k); if (v === undefined) { v = fn(); cache.set(k, v); } return v; };

const LEAF = '#5cc060', LEAF2 = '#4aa852', LEAF3 = '#74d068', TEAL = '#3f9f7a', STEM = '#6ab850', TRUNK = '#8a5a3a', TRUNK2 = '#6e4428';
const SOIL = '#7a4a2e';
const luma = (c) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;

// ---------------------------------------------------------------- crops
// Each builder draws a mature-scaled plant at size s (0.3..1). y = 0 is the first layer above the soil.
const B = {
  carrot(V, s) {
    const h = 2 + Math.round(3 * s);
    for (const [fx, fz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let y = 1; y < h; y++) V.set(fx, y, fz, y > h - 2 ? LEAF3 : LEAF);
      V.set(fx * 2, h, fz * 2, LEAF3);
    }
  },
  strawberry(V, s) { const r = 3.2 * s + 0.5; V.ball(0, Math.round(r * 0.7), 0, r, (x, y) => (y > r * 0.5 && hash(x, y) < 0.08 ? '#ffffff' : hash(x * 7, y * 3) < 0.5 ? LEAF : LEAF2), 0.7); },
  blueberry(V, s) { const r = 3.8 * s + 0.6; V.box(0, 0, 0, 0, 1, 0, TRUNK); V.ball(0, Math.round(r * 0.85) + 1, 0, r, (x, y, z) => (hash(x, y, z) < 0.5 ? TEAL : '#4aae86'), 0.85); },
  tulip(V, s) { const h = Math.round(6 * s) + 1; V.box(0, 0, 0, 0, h - 1, 0, STEM); V.set(-1, 1, 0, LEAF); V.set(-1, 2, 0, LEAF3); V.set(1, 0, 0, LEAF); V.set(1, 1, 0, LEAF3); },
  tomato(V, s) {
    const h = Math.round(12 * s) + 1;
    V.box(0, 0, 0, 0, h, 0, '#b08a5a');
    for (let k = 0; k * 3 + 1 < h; k++) V.ball(k % 2 ? 1 : -1, k * 3 + 2, 0, 1.8 * s + 0.4, LEAF);
  },
  corn(V, s) {
    for (const [ox, H] of [[-1, 15], [2, 13]]) {
      const h = Math.round(H * s);
      V.box(ox, 0, 0, ox, h, 0, '#8ac850');
      for (let k = 0; k < 4 && 3 + k * 3 < h; k++) { const d = k % 2 ? 1 : -1, y = 3 + k * 3; for (let j = 1; j <= 3; j++) V.set(ox + d * j, y + (j > 2 ? -1 : 0), 0, j === 3 ? '#9ad860' : '#7abc48'); }
      if (s > 0.8) { V.set(ox, h + 1, 0, '#e8c06a'); V.set(ox - 1, h + 2, 0, '#d8a84a'); V.set(ox + 1, h + 2, 0, '#d8a84a'); }
    }
  },
  watermelon(V, s) { vine(V, s, [[-4, 0, -1, 2.6], [4, 0, -2, 2.4], [0, 0, -3, 2.6], [-2, 0, 3, 2], [3, 0, 3, 2]]); },
  pumpkin(V, s) { vine(V, s, [[-4, 0, -2, 2.8], [4, 0, -1, 2.8], [0, 0, -4, 2.6], [-3, 0, 3, 2.2], [3, 0, 4, 2]]); },
  apple(V, s) { tree(V, s, 7, 6.2, (x, y, z) => (hash(x, y, z) < 0.5 ? LEAF : LEAF2)); },
  mango(V, s) { tree(V, s, 6, 6.6, (x, y, z) => (hash(x, y, z) < 0.5 ? '#2f8a50' : '#3f9a58'), 0.72); },
  coconut(V, s) {
    const h = Math.round(14 * s) + 1;
    for (let y = 0; y < h; y++) { const x = Math.round(Math.sin((y / h) * 1.2) * 2 * s); V.set(x, y, 0, y % 3 === 0 ? '#7a5434' : '#a8784a', 0.02); if (s > 0.6 && y < 4) V.set(x + 1, y, 0, '#8a6440'); }
    const tx = Math.round(Math.sin(1.2) * 2 * s), L = Math.round(7 * s) + 1;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) for (let j = 1; j <= L; j++) V.set(tx + dx * j, h - Math.floor((j * j) / (L + 2)), dz * j, j > L - 2 ? LEAF3 : LEAF);
    V.ball(tx, h, 0, 1.2, '#7ccf55');
  },
  dragonfruit(V, s) {
    const h = Math.round(9 * s) + 1;
    V.box(0, 0, 0, 0, h, 0, '#9a6a42');
    const arms = [[-1, 0, 4], [1, 0, 6], [0, 1, 8], [0, -1, 5]];
    for (const [dx, dz, y0] of arms) { if (y0 > h) continue; const L = Math.round(5 * s); for (let j = 1; j <= L; j++) { const y = y0 + Math.round(Math.sin((j / L) * 2.2) * 2); V.set(dx * j, y, dz * j, j % 2 ? '#4fa04a' : '#64b85a'); V.set(dx * j, y + 1, dz * j, '#78c868'); } }
  },
  grape(V, s) {
    const h = Math.round(9 * s) + 1, w = Math.round(5 * s) + 1;
    V.box(-w, 0, 0, -w, h, 0, '#9a6a42'); V.box(w, 0, 0, w, h, 0, '#9a6a42'); V.box(-w - 1, h + 1, 0, w + 1, h + 1, 0, '#b8865a');
    for (let x = -w; x <= w; x++) { if (hash(x, 4) < 0.85) V.set(x, h + 2, 0, LEAF); if (hash(x, 5) < 0.6) V.set(x, h + 1, 1, LEAF2); if (hash(x, 6) < 0.5) V.set(x, h + 2, -1, LEAF3); }
    for (let y = 0; y < h; y++) if (y % 2) V.set(-w + 1, y, 0, '#6a8a3a');
  },
  mushroom(V) { for (const [x, z] of [[-3, 1], [3, -1], [2, 3]]) { V.set(x, 0, z, '#f4ead6'); V.set(x, 1, z, '#c8844a'); } for (let k = 0; k < 6; k++) V.set(Math.round(Math.cos(k) * 4), 0, Math.round(Math.sin(k) * 4), LEAF); },
  beanstalk(V, s) {
    const h = Math.round(22 * s) + 1;
    for (let y = 0; y <= h; y++) { const x = Math.round(Math.sin(y * 0.35) * 1.5), z = Math.round(Math.cos(y * 0.35) * 1.5); V.set(x, y, z, '#4fb04a', 0.02); V.set(x + 1, y, z, '#3f9a3a', 0.02); }
    for (let y = 4; y < h - 1; y += 5) { const d = (y / 5) % 2 ? 1 : -1; V.ball(d * 3, y, 0, 1.6 * s + 0.4, '#3aa848', 0.5); }
    V.set(0, h + 1, 0, '#8fe06a'); V.set(1, h + 2, 0, '#8fe06a');
  },
};
function vine(V, s, blobs) {
  for (const [x, , z, r] of blobs) V.ball(Math.round(x * s), 0, Math.round(z * s), r * s + 0.5, (a, b, c) => (hash(a + x, c + z) < 0.5 ? LEAF : LEAF2), 0.4);
  if (s > 0.6) for (let k = -5; k <= 5; k++) V.set(k, 0, Math.round(Math.sin(k) * 2), '#3f8a3a');
}
function tree(V, s, trunk, r, col, sy = 0.82) {
  const h = Math.round(trunk * s) + 2;
  V.box(0, 0, 0, 1, h, 1, (x, y) => (y % 4 === 0 ? TRUNK2 : TRUNK));
  const R = r * s + 1;
  V.ball(0, h + Math.round(R * sy) - 1, 0, R, col, sy);
}

// fruit attachment points on the mature plant. sit: fruit rests on that point; otherwise it hangs from it.
// points just outside a lit canopy sphere, biased toward the camera so fruit is visible
const shell = (cx, cy, cz, R, sy, dirs) => dirs.map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [Math.round(cx + (x / l) * R * 1.1), Math.round(cy + (y / l) * R * sy * 1.1), Math.round(cz + (z / l) * R * 1.1)]; });
export const ANCHORS = {
  carrot: { sit: true, pts: [[0, -1, 0]] },
  strawberry: { pts: [[-4, 3, 1], [4, 3, -1], [1, 3, 4]] },
  blueberry: { pts: shell(0, 5, 0, 4.4, 0.85, [[-1, 0, 0.5], [1, -0.2, 0.3], [0, -0.1, 1], [0.6, 0.6, 0.6], [-0.6, 0.5, 0.7]]) },
  tulip: { sit: true, pts: [[0, 7, 0]] },
  tomato: { pts: [[-3, 10, 1], [3, 8, 1], [-2, 5, 2]] },
  corn: { pts: [[-3, 9, 1], [4, 7, 1]] },
  watermelon: { sit: true, pts: [[0, 0, 1]] },
  pumpkin: { sit: true, pts: [[0, 0, 1]] },
  apple: { pts: shell(0.5, 14, 0.5, 7.2, 0.82, [[-1, -0.3, 0.8], [1, -0.2, 0.7], [0, -0.45, 1], [0.6, 0.35, 0.8], [-0.7, 0.3, 0.6]]) },
  mango: { pts: shell(0.5, 12, 0.5, 7.6, 0.72, [[-1, -0.35, 0.7], [1, -0.3, 0.6], [0.1, -0.5, 1], [-0.4, 0.3, 0.9]]) },
  coconut: { pts: [[1, 14, 1], [3, 14, 0], [2, 14, -1]] },
  dragonfruit: { pts: [[-5, 6, 0], [5, 7, 0], [0, 10, 5]] },
  grape: { pts: [[-4, 10, 1], [-1, 10, 1], [2, 10, 1], [5, 10, 1]] },
  mushroom: { sit: true, pts: [[0, 0, 0]] },
  beanstalk: { pts: [[-4, 8, 1], [4, 14, 1], [-4, 19, 0]] },
};

export const STAGE_S = [0, 0.3, 0.5, 0.68, 0.84, 1];
export const stageOf = (f) => (f < 0.08 ? 0 : f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.75 ? 3 : f < 1 ? 4 : 5);
export function plantGeo(crop, stage, variant) {
  return memo(`p|${crop}|${stage}|${variant}`, () => {
    const V = new Vox(rng(variant * 977 + stage * 31 + crop.length));
    if (stage === 0) { V.set(0, 0, 0, '#9a6440', 0.02); V.set(1, 0, 0, '#8a5a38', 0.02); V.set(0, 0, 1, '#8a5a38', 0.02); }
    else if (stage === 1) { V.set(0, 0, 0, STEM); V.set(0, 1, 0, STEM); V.set(-1, 2, 0, LEAF3); V.set(1, 2, 0, LEAF3); V.set(0, 2, 0, LEAF); }
    else B[crop](V, STAGE_S[stage]);
    return mesh(V);
  });
}
export function plantHeight(crop, stage) {
  return memo(`ph|${crop}|${stage}`, () => { const g = plantGeo(crop, stage, 0); return Math.max(3, g.boundingBox.max.y); });
}

// ---------------------------------------------------------------- fruit
const FR = {
  carrot(V) { V.box(0, 0, 0, 1, 1, 1, '#ff8a2a'); V.set(0, 1, 0, '#ffa84a'); },
  carrotIcon(V) { V.box(0, 3, 0, 1, 5, 1, '#ff8a2a'); V.box(0, 1, 0, 0, 2, 0, '#ff7a1a'); V.set(1, 2, 1, '#ff7a1a'); V.set(0, 0, 1, '#e86a10'); V.set(0, 6, 0, LEAF); V.set(1, 7, 1, LEAF3); V.set(0, 7, 1, LEAF); V.set(1, 6, 0, LEAF); },
  strawberry(V) { V.box(0, 1, 0, 1, 2, 1, '#f03a4e'); V.set(0, 0, 0, '#d82a40'); V.set(1, 3, 0, '#5cc060'); V.set(0, 3, 1, '#5cc060'); V.set(0, 2, 1, '#ffd0a0', 0); },
  blueberry(V) { V.box(0, 0, 0, 1, 0, 1, '#4a5ae0'); V.set(0, 1, 0, '#6a7af0'); V.set(1, 0, 1, '#3a4ac8'); },
  tulip(V) { V.box(-1, 0, -1, 1, 1, 1, '#ff8a3a'); V.set(0, 0, 0, '#e86a20'); for (const [x, z] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) V.set(x, 2, z, '#ffaa5a'); V.del(0, 1, 0); V.set(0, 1, 0, '#ffd84e'); },
  tulipIcon(V) { V.box(0, 0, 0, 0, 4, 0, STEM); V.set(-1, 1, 0, LEAF); V.set(1, 2, 0, LEAF3); V.box(-1, 5, -1, 1, 6, 1, '#ff8a3a'); for (const [x, z] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) V.set(x, 7, z, '#ffaa5a'); },
  tomato(V) { V.box(0, 0, 0, 1, 1, 1, '#f04a32'); V.set(0, 2, 0, '#5cc060'); V.set(1, 1, 1, '#ff6a4a'); },
  corn(V) { V.box(0, 1, 0, 0, 4, 0, '#ffd84e'); V.set(0, 0, 0, '#7abc48'); V.set(1, 1, 0, '#8ac850'); V.set(-1, 1, 0, '#8ac850'); V.set(0, 5, 0, '#e0b040'); V.set(0, 2, 1, '#ffe46a'); V.set(0, 3, 1, '#ffe46a'); },
  watermelon(V) { for (let x = -3; x <= 3; x++) for (let y = 0; y < 4; y++) for (let z = -2; z <= 2; z++) { if ((Math.abs(x) === 3 && (y === 0 || y === 3)) || (Math.abs(z) === 2 && (y === 0 || y === 3))) continue; V.set(x, y, z, (x + 9) % 3 === 0 ? '#2f7a3a' : '#6ac85a'); } },
  pumpkin(V) { for (let x = -3; x <= 2; x++) for (let y = 0; y < 4; y++) for (let z = -3; z <= 2; z++) { if ((x === -3 || x === 2 || z === -3 || z === 2) && (y === 0 || y === 3)) continue; V.set(x, y, z, (x + z) % 2 === 0 ? '#ff9a2a' : '#f08218'); } V.set(0, 4, 0, '#6a8a3a'); V.set(0, 5, -1, '#6a8a3a'); },
  apple(V) { V.box(0, 0, 0, 1, 1, 1, '#e8383e'); V.set(1, 1, 0, '#ff5a5a'); V.set(0, 2, 0, '#6a4428'); V.set(1, 2, 0, '#5cc060'); },
  coconut(V) { V.box(0, 0, 0, 1, 1, 1, '#6e4428'); V.set(1, 1, 1, '#8a5a3a'); },
  dragonfruit(V) { V.box(0, 0, 0, 1, 2, 1, '#e8408f'); V.set(0, 3, 0, '#7ccf55'); V.set(1, 1, 1, '#7ccf55'); V.set(0, 0, 1, '#ff6ab0'); },
  mango(V) { V.box(0, 0, 0, 1, 2, 1, '#ffb43a'); V.set(1, 2, 1, '#ffd84e'); V.set(0, 0, 0, '#f06a2a'); V.set(0, 3, 0, '#5a7a2a'); },
  grape(V) { V.box(-1, 2, 0, 1, 3, 0, '#8a4ad0'); V.box(0, 0, 0, 0, 1, 0, '#7a3ab8'); V.set(-1, 1, 0, '#9a5ae0'); V.set(1, 1, 0, '#7a3ab8'); V.set(0, 4, 0, '#6a4428'); V.set(0, 3, 1, '#a86af0'); },
  mushroom(V) {
    V.box(-1, 0, -1, 1, 3, 1, '#f4ead6');
    V.ball(0, 4, 0, 4.4, (x, y, z) => (y < 0 ? null : (hash(x, y, z) < 0.12 && y > 0 ? '#fff6ee' : '#e0383a')), 0.75);
    V.box(-3, 4, -3, 3, 4, 3, (x, y, z) => (Math.hypot(x, z) < 3.6 ? '#e8d2b0' : '#e0383a'));
  },
  beanstalk(V) { V.box(0, 0, 0, 0, 3, 0, '#7ae05a'); V.set(1, 1, 0, '#a8f070'); V.set(1, 2, 0, '#a8f070'); V.set(0, 4, 0, '#4fb04a'); },
  bud(V) { V.set(0, 0, 0, '#fff6ee', 0); V.set(0, 1, 0, '#ffd84e', 0); },
};
const RECOLOR = {
  r: null,
  u: (c) => mixc(c, luma(c) > 0.55 ? '#c8ec8a' : '#6aa848', 0.62),
  gold: (c) => { const l = luma(c); return l > 0.75 ? 0xfff4a8 : l > 0.5 ? 0xffd84a : l > 0.3 ? 0xe0b02a : 0xa8781a; },
  frozen: (c) => { const l = luma(c); return l > 0.7 ? 0xffffff : l > 0.45 ? 0xd4f6ff : l > 0.28 ? 0x8fd6ff : 0x4b8fd0; },
  pale: (c) => { const l = 0.55 + luma(c) * 0.45; const v = Math.round(l * 255); return (v << 16) | (v << 8) | v; },
};
export function fruitVox(crop, kind = 'r', icon = false) {
  const V = new Vox(rng(crop.length * 13));
  const f = icon && FR[crop + 'Icon'] ? FR[crop + 'Icon'] : kind === 'bud' ? FR.bud : FR[crop];
  f(V);
  for (const k of [...V.m.keys()]) if (V.m.get(k)[3] === null || Number.isNaN(V.m.get(k)[3])) V.m.delete(k);
  if (kind !== 'bud' && RECOLOR[kind]) V.map(RECOLOR[kind]);
  return V;
}
// fruit geometry, origin at the attachment point (top-centre when hanging, bottom-centre when sitting)
export function fruitGeo(crop, kind) {
  return memo(`f|${crop}|${kind}`, () => {
    const V = fruitVox(crop, kind);
    const [a, b] = V.bounds();
    const sit = ANCHORS[crop].sit;
    return mesh(V, { offset: [-(a[0] + b[0] + 1) / 2, sit ? -a[1] : -(b[1] + 1), -(a[2] + b[2] + 1) / 2] });
  });
}

// ---------------------------------------------------------------- characters & stalls
export function farmerGeo(frame) {
  return memo('farmer' + frame, () => {
    const V = new Vox(rng(3));
    const legs = frame ? [[-1, 0, 1], [1, 0, -1]] : [[-1, 0, 0], [1, 0, 0]];
    for (const [x, , z] of legs) V.box(x, 0, z, x, 1, z, '#5a3a24', 0.02);
    V.box(-1, 2, -1, 1, 4, 0, '#4a7ae0', 0.03);
    V.box(-1, 4, -1, 1, 4, 0, '#e8584c', 0.02); V.set(-2, 3, 0, '#e8584c'); V.set(2, 3, 0, '#e8584c'); V.set(-2, 2, 0, '#ffcfa0'); V.set(2, 2, 0, '#ffcfa0');
    V.box(-1, 5, -1, 1, 7, 1, '#ffcfa0', 0.02);
    V.set(-1, 6, 1, '#2a2a2a', 0); V.set(1, 6, 1, '#2a2a2a', 0);
    V.box(-1, 7, -1, 1, 7, 1, '#7a4a2c', 0.02); V.set(-1, 6, -1, '#7a4a2c');
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.abs(x) + Math.abs(z) < 5) V.set(x, 8, z, (Math.abs(x) + Math.abs(z) === 2 && z >= -1) ? '#ff5a4a' : '#ffd86a', 0.04);
    V.box(-1, 9, -1, 1, 9, 1, '#ffe48a', 0.03);
    return mesh(V);
  });
}
export function npcGeo(kind) {
  return memo('npc' + kind, () => {
    const V = new Vox(rng(kind.length));
    const shirt = kind === 'seeds' ? '#4cc06a' : '#6a8ae8', skin = kind === 'seeds' ? '#e8b080' : '#ffd0a8';
    V.box(-1, 0, -1, 1, 2, 1, shirt);
    V.box(-1, 3, -1, 1, 5, 1, skin);
    V.set(-1, 4, 1, '#2a2a2a', 0); V.set(1, 4, 1, '#2a2a2a', 0);
    if (kind === 'seeds') { V.box(-1, 6, -1, 1, 6, 1, '#3f9a50'); V.box(-1, 6, 2, 1, 6, 2, '#3f9a50'); }
    else { V.box(-1, 6, -1, 1, 6, 1, '#8a5a3a'); V.box(-2, 3, -1, -2, 6, 1, '#8a5a3a'); V.box(2, 3, -1, 2, 6, 1, '#8a5a3a'); V.box(-1, 3, 1, 1, 3, 1, '#c88a5a'); V.set(0, 3, 1, '#c88a5a'); V.set(-1, 4, 1, '#2a2a2a', 0); V.set(1, 4, 1, '#2a2a2a', 0); }
    return mesh(V);
  });
}
export const STALL = { seeds: { col: '#4cc06a', label: 'SEEDS' }, sell: { col: '#ffaa30', label: 'SELL' } };
export function stallGeo(kind) {
  return memo('stall' + kind, () => {
    const V = new Vox(rng(kind.length * 9)), col = STALL[kind].col;
    V.box(-8, 0, 0, 8, 3, 2, (x, y) => (y === 3 ? '#d8a070' : x % 4 === 0 ? '#9a6a42' : '#b07a50'));
    V.box(-3, 1, 3, 3, 2, 3, col); V.box(-3, 2, 3, 3, 2, 3, shade(col, 1.15));
    for (const dx of [-8, 8]) V.box(dx, 4, -1, dx, 12, -1, '#8a5a3a');
    V.box(-7, 4, -2, 7, 9, -2, '#7a4e30');
    for (let dx = -9; dx <= 9; dx++) for (let k = 0; k < 4; k++) V.set(dx, 13 - k, -1 + k, Math.floor((dx + 9) / 3) % 2 ? '#fff6e6' : col, 0.02);
    for (let dx = -9; dx <= 9; dx++) if ((dx + 9) % 3 === 1) V.set(dx, 9, 3, Math.floor((dx + 9) / 3) % 2 ? '#fff6e6' : col, 0.02);
    for (let i = 0; i < 5; i++) {
      const c = kind === 'seeds' ? ['#ff8a3a', '#f04a5a', '#7cc860', '#ffd84e', '#5a6ae8'][i] : '#ffd84e';
      V.set(-6 + i * 3, 4, 1, c); if (kind === 'seeds') V.set(-6 + i * 3, 4, 2, '#f6ecd8'); else { V.set(-6 + i * 3, 5, 1, '#ffe46a'); }
    }
    V.box(-5, 14, -1, 5, 17, -1, (x, y) => (y === 14 || y === 17 || Math.abs(x) === 5 ? '#8a5a3a' : col));
    // lantern hook
    V.set(8, 12, 0, '#3a3448'); V.set(8, 11, 0, '#3a3448');
    return mesh(V);
  });
}
export function lanternGeo() { return memo('lantern', () => { const V = new Vox(); V.set(0, 0, 0, '#ffe08a', 0); V.set(0, 1, 0, '#3a3448', 0); return mesh(V, { ao: false }); }); }
export function treeGeo(v) {
  return memo('tree' + v, () => {
    const V = new Vox(rng(v * 11 + 3)), h = 3 + (v % 3);
    V.box(0, 0, 0, 0, h, 0, '#8a5a3a');
    V.ball(0, h + 3, 0, 3.4 + (v % 2) * 0.6, (x, y, z) => (hash(x + v, y, z) < 0.5 ? '#5cb860' : '#4aa452'));
    return mesh(V);
  });
}
export function cloudGeo(v) {
  return memo('cloud' + v, () => {
    const V = new Vox(rng(v * 5 + 1)), R = V.R;
    const n = 3 + v;
    for (let k = 0; k < n; k++) V.ball(k * 4 - n * 2, 0, Math.round((R() - 0.5) * 4), 3 + R() * 2, '#ffffff', 0.55, 0.02);
    return mesh(V, { ao: false });
  });
}
export function boltGeo(len) {
  return memo('bolt' + len, () => { const V = new Vox(); let x = 0; for (let y = 0; y < len; y++) { if (y % 4 === 3) x += hash(y, len) < 0.5 ? 1 : -1; V.set(x, -y, 0, '#fffbd0', 0); } return mesh(V, { ao: false }); });
}
export function cubeGeo() { return memo('cube', () => { const V = new Vox(); V.set(0, 0, 0, '#ffffff', 0); return mesh(V, { offset: [-0.5, -0.5, -0.5], ao: false }); }); }
