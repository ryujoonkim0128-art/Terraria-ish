// Props, villagers and wolves, built from primitives in pixel units.
import { THREE } from './engine.js';

export const COL = {
  robe: '#a08560', robeDk: '#7c6548', hood: '#7a6246', face: '#ecd0a4', feet: '#241a14',
  wood: '#6b4a30', woodLt: '#8c6440', woodDk: '#3f2b1d', plank: '#5c3e27',
  stone: '#5f6271', stoneDk: '#3d3f4a', stoneLt: '#8c8e95', iron: '#3a3c44',
  clay: '#7a3c2a', thatch: '#b38556', thatchDk: '#896748', daub: '#cdbb98',
  sack: '#bf9d6e', quilt: '#974d3b', quilt2: '#435374', linen: '#e5ca95',
  fire: '#f0b15c', fireHot: '#ffe08a', lamp: '#ffc46a', glass: '#74523a',
  mush: '#cdd8e5', mushGlow: '#a8e0c0', ore: '#f0b15c', water: '#2c4a6a',
  wolf: '#6a6c78', wolfDk: '#44464f', wolfLt: '#9a9ca6', leaf: '#587b4b', leafDk: '#3c5a36',
};

// ------------------------------------------------------------- villagers
// Robe widens at the hem, hood sphere, a small face, tiny dark feet. ~14 px tall.
const ROBE = new THREE.LatheGeometry(
  [[0, 0], [4.4, 0], [4.1, 1.5], [3.4, 5], [2.8, 8.5], [2.3, 10], [0, 10.4]].map(([a, b]) => new THREE.Vector2(a, b)), 12);

export function villager(D, x, y, z, o = {}) {
  const g = new THREE.Group();
  const s = (o.kid ? 0.68 : 1) * 1.25;
  const face = o.face ?? 1;                 // 1 = facing right, -1 = left, 0 = back (climbing)
  const robe = new THREE.Mesh(ROBE, D.mat(COL.robe));
  D.add(robe, g);
  D.ball(0, 11.6, 3.1, 0, COL.hood, { sy: 1.05 }, g);
  D.ball(-face * 1.6, 12.6, 2.2, -0.6, COL.hood, {}, g);   // hood peak falls back
  if (face !== 0) {
    const f = D.ball(face * 1.3, 11.2, 1.6, 2.2, COL.face, { seg: 8 }, g);
    f.scale.set(0.9, 1, 0.6);
  }
  for (const fx of [-1.6, 1.6]) D.box(fx - 1 + face * 0.6, -0.6, 2.2, 1.4, 0.5, 2.4, COL.feet, {}, g);
  const hand = (hx, hy) => D.ball(hx, hy, 1.1, 2.6, COL.robeDk, { seg: 6 }, g);
  const pose = o.pose || 'stand';
  if (pose === 'climb') { hand(-2.6, 14); hand(2.6, 12.5); }
  if (pose === 'carry') {                  // sack over the shoulder
    D.ball(-face * 2.2, 13.5, 3.4, -0.5, COL.sack, { sy: 0.8 }, g);
    D.ball(-face * 3.6, 16, 1.2, -0.5, COL.sack, {}, g);
    hand(face * 0.8, 12.5);
  }
  if (pose === 'cook') {                   // stirring with a long spoon
    hand(face * 3.4, 8);
    D.box(face * 3.6 - 0.4, 3, 0.9, 7, 2, 0.9, COL.woodLt, { rot: face * -0.5 }, g);
  }
  if (pose === 'dig' || pose === 'hammer') {  // tool raised overhead
    hand(face * 2.6, 13.5);
    const h = D.box(face * 2 - 0.5, 12, 1, 9, 1.5, 1, COL.woodLt, { rot: face * -0.6 }, g);
    const hx = face * 6.5, hy = 19.2;
    if (pose === 'dig') D.box(hx - 3.5, hy - 0.6, 7, 1.4, 1.5, 1.4, COL.iron, { rot: face * -0.6 }, g);
    else D.box(hx - 1.5, hy - 1.5, 3, 3, 1.5, 2.2, COL.iron, { rot: face * -0.6 }, g);
    void h;
  }
  if (pose === 'lantern') {
    hand(face * 3.2, 7);
    D.box(face * 3.2 - 1, 3, 2, 2.5, 3, 2, COL.lamp, { emissive: COL.lamp }, g);
  }
  if (pose === 'basket') {
    hand(face * 3, 6.5);
    D.cyl(face * 3.4, 2.5, 2.4, 1.8, 3, 2.5, COL.thatch, {}, g);
  }
  if (pose === 'book') { hand(face * 2.2, 8); D.box(face * 2 - 1.5, 7.5, 3, 2.2, 3, 0.8, COL.quilt, {}, g); }
  if (pose === 'bucket') { hand(face * 3, 13); D.cyl(face * 3.2, 4, 1.6, 1.3, 2.6, 1, COL.wood, {}, g); }
  if (pose === 'jump') g.position.y += 3;
  g.scale.setScalar(s);
  g.position.x += x; g.position.y += y; g.position.z += z;
  if (pose === 'sleep') {                  // lying down under a quilt
    g.rotation.z = Math.PI / 2 * (face === -1 ? -1 : 1);
    g.position.y += 2.5;
  }
  D.scene.add(g);
  return g;
}

// ------------------------------------------------------------- furniture & kit
export function ladder(D, x, y0, y1, z = -14) {
  D.box(x, y0, 1.2, y1 - y0, z, 1.2, COL.woodLt);
  D.box(x + 6, y0, 1.2, y1 - y0, z, 1.2, COL.wood);
  for (let y = y0 + 2; y < y1; y += 4) D.box(x + 1, y, 5, 1, z, 1, COL.woodLt);
}
export function stairs(D, x0, y0, x1, y1, z = -14, w = 16) {
  const lt = '#896748', dk = '#5c402d';
  const n = Math.max(2, Math.round(Math.abs(y1 - y0) / 4));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    D.box(x - 3, y - 1.5, 6.5, 1.5, z, w, i % 2 ? lt : '#977553');
    D.box(x - 3, y - 4, 1.2, 2.5, z, w * 0.9, dk);
  }
  const ang = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  const rail = D.box(0, 0, len, 1, z - w / 2 + 1, 1, COL.woodDk);
  rail.position.set((x0 + x1) / 2, (y0 + y1) / 2 - 3, z - w / 2 + 1);
  rail.rotation.z = ang;
}
export function floorPlanks(D, x0, x1, y, z = -22, d = 36) {
  D.box(x0, y - 2, x1 - x0, 2, z, d, COL.plank);
}
export function lantern(D, x, y, z = -12, o = {}) {
  D.box(x - 0.3, y + 2.5, 0.6, o.chain ?? 5, z, 0.6, COL.iron);
  D.box(x - 1.8, y - 1.5, 3.6, 4, z, 3, COL.iron);
  D.box(x - 1, y - 0.8, 2, 2.6, z + 1.6, 0.4, '#df8d4c', { basic: true });
  D.box(x - 0.5, y - 0.2, 1, 1.2, z + 1.9, 0.2, '#f0b15c', { basic: true });
  D.box(x - 1.8, y + 2.4, 3.6, 0.8, z, 3.6, COL.iron);
  return D.light(x, y, z + 6, o.color ?? 0xffa24a, (o.i ?? 55) * 1.6, (o.dist ?? 80) * 1.2);
}
export function candle(D, x, y, z = -12) {
  D.box(x - 0.6, y, 1.2, 2.5, z, 1.2, COL.linen);
  D.box(x - 0.4, y + 2.6, 0.8, 1, z, 0.8, '#f0b15c', { basic: true });
  return D.light(x, y + 4, z + 4, 0xffb060, 45, 60);
}
export function table(D, x, y, w = 24, z = -16) {
  D.box(x, y + 7, w, 1.8, z, 12, COL.woodLt);
  for (const lx of [x + 1.5, x + w - 3]) D.box(lx, y, 1.5, 7, z, 8, COL.wood);
}
export function bench(D, x, y, w = 14, z = -8) {
  D.box(x, y + 4, w, 1.3, z, 5, COL.wood);
  for (const lx of [x + 1, x + w - 2.3]) D.box(lx, y, 1.3, 4, z, 4, COL.woodDk);
}
export function shelf(D, x, y, w, z = -34, items = true, seed = 1) {
  D.box(x, y, w, 1.2, z, 5, COL.woodLt);
  if (!items) return;
  const cols = ['#558a86', '#b76139', '#80a361', '#cfae79', '#974d3b', '#c87c8b'];
  for (let i = 0; i < w / 3.2 - 1; i++) {
    const h = 2.5 + ((i * 7 + seed) % 3);
    D.cyl(x + 2 + i * 3.2, y + 1.2, 0.9, 1.1, h, z, cols[(i + seed) % cols.length], { seg: 6 });
  }
}
export function barrel(D, x, y, z = -18, r = 4.2, h = 9) {
  D.cyl(x, y, r * 0.9, r * 0.9, h, z, COL.wood);
  D.cyl(x, y + h * 0.35, r, r, h * 0.3, z, COL.woodLt);
  D.cyl(x, y + 1, r * 0.95, r * 0.95, 1, z, COL.iron);
  D.cyl(x, y + h - 2, r * 0.95, r * 0.95, 1, z, COL.iron);
}
export function sideBarrel(D, x, y, z = -30, r = 4) {
  D.cyl(x, y, r, r, 9, z, COL.wood, { rx: Math.PI / 2 }).position.set(x, y + r, z);
  D.cyl(x, y, r * 0.7, r * 0.7, 9.2, z, COL.woodLt, { rx: Math.PI / 2 }).position.set(x, y + r, z);
}
export function crate(D, x, y, s = 7, z = -20) {
  D.box(x, y, s, s, z, s, COL.woodLt);
  D.box(x + s * 0.1, y + s * 0.45, s * 0.8, s * 0.12, z + s / 2, 0.4, COL.woodDk);
}
export function sack(D, x, y, z = -18, r = 3.2) {
  D.ball(x, y + r * 0.8, r, z, COL.sack, { sy: 0.85 });
  D.ball(x, y + r * 1.6, r * 0.35, z, COL.sack);
}
export function sleeper(D, bx, by, w, z, col = COL.quilt, kid = false) {   // hood on the pillow, quilt mound
  const s = kid ? 0.75 : 1;
  D.ball(bx + 4.2, by + 8, 3 * s, z + 1, COL.hood);
  D.ball(bx + 5.6, by + 7.6, 1.5 * s, z + 3.2, COL.face, { seg: 8 });
  D.ball(bx + 7 + (w - 9) / 2, by + 6.2, (w - 8) / 2, z, col, { sy: 0.32 });
}
export function bed(D, x, y, w = 22, z = -20, quilt = COL.quilt) {
  D.box(x, y, w, 3, z, 12, COL.wood);
  D.box(x, y + 3, 1.6, 6, z, 12, COL.wood);
  D.box(x + w - 1.6, y + 3, 1.6, 4, z, 12, COL.wood);
  D.box(x + 1.6, y + 3, w - 3.2, 2.2, z, 11, COL.linen);
  D.box(x + 5.5, y + 5, w - 7.2, 1.6, z, 11, quilt);
  D.ball(x + 3.8, y + 5.6, 1.8, z, COL.linen, { sy: 0.6 });
}
export function hearth(D, x, y, z = -34, big = true) {
  const w = big ? 22 : 16, h = big ? 18 : 14;
  D.box(x, y, w, h, z, 8, COL.stone);
  D.box(x + 3, y, w - 6, h - 6, z + 3, 3, '#1b1411');
  D.box(x - 2, y + h - 2, w + 4, 2, z + 1, 10, COL.woodDk);
  for (let i = 0; i < 4; i++) D.box(x + 5 + i * 3, y + 1, 2.5, 1.5, z + 4.6, 1.5, COL.woodDk);
  D.ball(x + w / 2, y + 3.5, 3, z + 4.8, '#df8d4c', { basic: true, sy: 1.2 });
  D.ball(x + w / 2, y + 3.8, 1.8, z + 5.6, '#f0b15c', { basic: true, sy: 1.3 });
  return D.light(x + w / 2, y + 6, z + 12, 0xff8a3a, 200, 130);
}
export function pot(D, x, y, z = -26) {
  D.ball(x, y + 3, 3.4, z, COL.iron, { sy: 0.8 });
  D.box(x - 3.8, y + 5, 7.6, 0.8, z, 7.6, COL.iron);
}
export function chimney(D, x, y0, y1, z = -30) {
  D.box(x, y0, 3, y1 - y0, z, 3, COL.iron);
  D.box(x - 1, y1, 5, 2, z, 5, COL.iron);
}
export function anvil(D, x, y, z = -18) {
  D.box(x - 2, y, 4, 4, z, 4, COL.wood);
  D.box(x - 1.5, y + 4, 3, 2, z, 3, COL.iron);
  D.box(x - 4, y + 6, 8, 2, z, 3.5, COL.iron);
}
export function furnace(D, x, y, z = -30) {
  D.box(x, y, 16, 20, z, 12, COL.stoneDk);
  D.box(x + 2, y + 16, 12, 10, z, 8, COL.stone);
  D.box(x + 4, y + 3, 8, 7, z + 6.1, 0.2, '#df8d4c', { basic: true });
  D.box(x + 6, y + 3, 4, 3, z + 6.3, 0.2, '#f0b15c', { basic: true });
  return D.light(x + 8, y + 7, z + 14, 0xff7a2a, 220, 130);
}
export function mushrooms(D, x, y, w, z = -24, seed = 3) {
  for (let i = 0; i < w / 4; i++) {
    const h = 2 + ((i * 5 + seed) % 4), mx = x + i * 4 + ((i * 3) % 2);
    D.box(mx - 0.6, y, 1.2, h + 1, z + (i % 3) * 3, 1.2, COL.linen);
    D.ball(mx, y + h + 1, 2.2 + (i % 2) * 0.8, z + (i % 3) * 3, COL.mush, { emissive: COL.mushGlow, ei: 0.6, sy: 0.55 });
  }
  return D.light(x + w / 2, y + 6, z + 10, 0x9fe8c8, 110, 90);
}
export function pickaxeWall(D, x, y, z = -30) {
  D.box(x, y, 1, 8, z, 1, COL.woodLt, { rot: 0.5 });
}
export function cart(D, x, y, z = -18) {
  D.box(x, y + 2.5, 14, 7, z, 9, COL.iron);
  for (const wx of [x + 3, x + 11]) D.cyl(wx, y, 2.2, 2.2, 1.5, z + 4.6, '#1d1b1f', { rx: Math.PI / 2 }).position.set(wx, y + 2.2, z + 4.6);
  for (let i = 0; i < 5; i++) D.ball(x + 2.5 + i * 2.3, y + 10, 1.6, z, i % 2 ? COL.ore : COL.stone, i % 2 ? { emissive: '#7a4a10' } : {});
}
export function rails(D, x0, x1, y, z = -18) {
  D.box(x0, y, x1 - x0, 0.8, z - 3, 1, COL.iron);
  D.box(x0, y, x1 - x0, 0.8, z + 3, 1, COL.iron);
  for (let x = x0; x < x1; x += 5) D.box(x, y - 0.6, 2, 0.8, z, 9, COL.woodDk);
}
export function workbench(D, x, y, z = -26) {
  D.box(x, y + 8, 26, 2.5, z, 10, COL.woodLt);
  D.box(x + 1, y, 2, 8, z, 8, COL.wood); D.box(x + 23, y, 2, 8, z, 8, COL.wood);
  D.box(x + 4, y + 10.5, 8, 1.5, z, 5, COL.linen);
  D.box(x + 16, y + 10.5, 3, 3, z, 3, COL.woodDk);
}
export function toolWall(D, x, y, z = -38) {
  D.box(x, y, 1, 7, z, 1, COL.woodLt); D.box(x - 1.5, y + 6, 4, 1.5, z, 1.5, COL.iron);
  D.box(x + 5, y, 1, 8, z, 1, COL.woodLt); D.box(x + 3.5, y + 7, 5, 1, z, 1.2, COL.iron);
  D.box(x + 10, y + 1, 5, 5, z, 0.6, COL.stoneLt);
}
export function water(D, x, y, w, h, z = -20) {
  D.box(x, y, w, h, z, 18, COL.water, { emissive: '#0b1a2a' });
}
export function rope(D, x, y0, y1, z = -14) { D.box(x - 0.3, y0, 0.6, y1 - y0, z, 0.6, COL.linen); }

// ------------------------------------------------------------- trees & sky bits
export function pine(D, x, y, h, z, col = '#2c3855', snow = true) {
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers, r = h * 0.32 * (1 - t * 0.55), ty = y + h * 0.18 + t * h * 0.66;
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.36, 8), D.mat(col));
    m.position.set(x, ty + h * 0.18, z);
    D.add(m);
    if (snow) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(r * 0.6, h * 0.13, 8), D.mat('#cdd8e5', { emissive: '#435374' }));
      s.position.set(x - r * 0.15, ty + h * 0.32, z + 1);
      D.add(s);
    }
  }
  D.box(x - 1, y, 2, h * 0.2, z, 2, '#2b2019');
}
export function tree(D, x, y, h, z, col = COL.leaf) {
  D.box(x - 1.2, y, 2.4, h * 0.5, z, 2.4, COL.woodDk);
  const R = h * 0.28;
  D.ball(x, y + h * 0.62, R, z, col);
  D.ball(x - R * 0.7, y + h * 0.5, R * 0.75, z + 1, col);
  D.ball(x + R * 0.7, y + h * 0.52, R * 0.8, z - 1, COL.leafDk);
  D.ball(x + R * 0.2, y + h * 0.8, R * 0.7, z + 2, col);
}

// ------------------------------------------------------------- wolves
export function wolf(D, x, y, z, o = {}) {
  const g = new THREE.Group(), f = o.face ?? 1;
  if (o.sleep) {
    D.ball(0, 3.2, 5.5, 0, COL.wolf, { sy: 0.6, sx: 1.2 }, g);
    D.ball(f * 5, 2.6, 2.6, 2, COL.wolfLt, { sy: 0.8 }, g);
    D.ball(-f * 5.5, 2, 2, 2.5, COL.wolfDk, { sy: 0.7, sx: 1.6 }, g);
  } else {
    D.ball(0, 7, 5, 0, COL.wolf, { sx: 1.45, sy: 0.72 }, g);
    for (const lx of [-4.5, -2.5, 3, 5]) D.box(lx - 0.7, 0, 1.4, 5.5, lx > 0 ? 1.5 : -1.5, 1.4, COL.wolfDk, {}, g);
    D.ball(f * 7.4, 9.5, 2.9, 0.5, COL.wolf, {}, g);
    D.box(f > 0 ? 9 : -12.4, 8, 3.4, 2, 0.5, 2.2, COL.wolfLt, {}, g);
    for (const ez of [-1.2, 1.2]) {
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 4), D.mat(COL.wolfDk));
      e.position.set(f * 6.8, 12.6, ez); D.add(e, g);
    }
    D.box(f * 8.6 - 0.5, 10, 1, 0.8, 3, 0.5, '#ffd24a', { emissive: '#ffd24a' }, g);
    const tail = D.box(-f * 9.5 - 2, 6.5, 5, 1.8, 0, 1.8, COL.wolfDk, { rot: f * 0.5 }, g);
    void tail;
  }
  g.position.set(x, y, z);
  g.scale.setScalar(o.s ?? 1.9);
  D.scene.add(g);
  return g;
}
export function bones(D, x, y, z) {
  D.box(x, y, 5, 0.9, z, 0.9, COL.linen, { rot: 0.4 });
  D.box(x + 3, y, 4, 0.9, z + 2, 0.9, COL.linen, { rot: -0.6 });
  D.ball(x + 7, y + 0.8, 1.2, z, COL.linen);
}
