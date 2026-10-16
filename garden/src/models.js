// Voxel models: crops at each growth stage, fruit (with mutation recolours), stalls, characters, scenery.
import { Vox, mesh, rng, hash, shade, mixc, hex } from './voxel.js';

const cache = new Map();
export const memo = (k, fn) => { let v = cache.get(k); if (v === undefined) { v = fn(); cache.set(k, v); } return v; };

const LEAF = '#5cc060', LEAF2 = '#4aa852', LEAF3 = '#74d068', STEM = '#6ab850', TRUNK = '#8a5a3a', TRUNK2 = '#6e4428';
const luma = (c) => (((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.55 + (c & 255) * 0.15) / 255;

// ---------------------------------------------------------------- drawing helpers
// a straight run of voxels from a to b
function seg(V, a, b, col, jit = 0.03) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]))));
  for (let i = 0; i <= n; i++) { const t = i / n; V.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, typeof col === 'function' ? col(t) : col, jit); }
}
// a blade heading out at angle a for L voxels, rising `up` and drooping `down` toward its tip; returns the tip
function blade(V, p, a, L, up, down, col, tip) {
  let prev = p;
  for (let i = 1; i <= L; i++) {
    const t = i / L, q = [p[0] + Math.cos(a) * i, p[1] + up * t - down * t * t, p[2] + Math.sin(a) * i];
    seg(V, prev, q, tip && i === L ? tip : col);
    prev = q;
  }
  return prev;
}
// a flat leaf: a diamond of radius r lying level, lighter at the rim
function diamond(V, c, r, col, rim) {
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const m = Math.abs(dx) + Math.abs(dz);
    if (m <= r) V.set(c[0] + dx, c[1], c[2] + dz, m === r && r > 0 && rim ? rim : col, 0.04);
  }
}
// a heart-shaped leaf pointing away along angle a, its two lobes at the far end
function heart(V, c, a, col, vein) {
  const ux = Math.cos(a), uz = Math.sin(a);
  for (const [u, v] of [[0, 0], [1, 0], [1, -1], [1, 1], [2, -1], [2, 1], [3, -1], [3, 1]]) V.set(c[0] + ux * u - uz * v, c[1] - (u > 2 ? 1 : 0), c[2] + uz * u + ux * v, v === 0 ? vein : col, 0.03);
}
// a little flower: four petals round an eye
function flower(V, c, petal, eye = '#ffd84e') {
  V.set(c[0], c[1], c[2], eye, 0);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) V.set(c[0] + dx, c[1], c[2] + dz, petal, 0.02);
}
// a canopy puff: flat underneath, sunlit on top
function puff(V, c, r, cols, sy = 0.8) {
  V.ball(c[0], c[1], c[2], r, (x, y, z) => (y < -r * sy * 0.45 ? null : y > r * sy * 0.5 ? cols[2] : hash(x + c[0], y + c[1], z + c[2]) < 0.5 ? cols[0] : cols[1]), sy, 0.04);
}
const around = (n, R, y, off = 0) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2 + off; return [Math.round(Math.cos(a) * R), y, Math.round(Math.sin(a) * R)]; });

// ---------------------------------------------------------------- crops
// Each builder draws the plant at size s (0.3..1). y = 0 is the first layer above the soil. Fruit hangs from
// (or sits on) the ANCHORS below, so builders that carry fruit draw stalks out to those points.
const APPLE = [[-4, 11, 0, 2.8], [4, 11, 1, 2.8], [1, 13, -4, 2.6], [-1, 14, 3, 2.5], [0, 16, 0, 2.6]];
const BLUE = [[-3, 5, 0, 2], [3, 6, 1, 2], [0, 8, -3, 2], [1, 4, 3, 2], [-1, 10, 1, 1]];
const MANGO = [[-3, 9, 0, 3.9], [3, 10, 1, 3.9], [0, 13, -1, 3.5]];
const B = {
  carrot(V, s) {
    // feathery fronds rising out of the carrot's shoulder, each with little leaflets along it
    const y0 = Math.round(2 * s), n = s < 0.6 ? 3 : 4, L = 1 + Math.round(2 * s);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3, ca = Math.cos(a), sa = Math.sin(a);
      let prev = [0, y0, 0];
      for (let i = 1; i <= L; i++) {
        const t = i / L, q = [ca * i * 0.8, y0 + (2 + 4 * s) * t - 1.2 * s * t * t, sa * i * 0.8];
        seg(V, prev, q, '#4fb04a');
        if (i > 1) { const sd = i % 2 ? 1 : -1; V.set(q[0] - sa * sd, q[1], q[2] + ca * sd, i === L ? '#9ae870' : '#6ccf58', 0.03); }
        prev = q;
      }
      V.set(prev[0], prev[1] + 1, prev[2], '#8fe06a', 0.02);
    }
  },
  strawberry(V, s) {
    // a neat rosette of four leaves with white flowers on top; the berries rest on the soil round the edge
    const R = 1 + Math.round(s), h = 1 + Math.round(s), r = s > 0.6 ? 1 : 0;
    V.set(0, 0, 0, '#3f8f42');
    for (const [dx, dz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      seg(V, [0, 0, 0], [dx * R, h, dz * R], '#5aa848');
      diamond(V, [dx * (R + 1), h + 1, dz * (R + 1)], r, '#4aa84e', '#7ccf62');
    }
    if (s > 0.6) { V.box(0, 1, 0, 0, h + 1, 0, '#5aa848'); flower(V, [0, h + 2, 0], '#ffffff'); }
    if (s > 0.8) for (const [x, z] of [[-2, 2], [2, -2]]) flower(V, [x, h + 1, z], '#fff6f8');
  },
  blueberry(V, s) {
    // a little cloud-pruned bush: woody branches ending in flat leaf pads, the berries hang under the rims
    const y0 = Math.round(2 * s);
    V.box(0, 0, 0, 0, y0, 0, '#7a4234');
    for (const [px, py, pz, r] of BLUE) {
      const c = [Math.round(px * s), 1 + Math.round((py - 1) * s), Math.round(pz * s)], rr = s > 0.6 ? r : r - 1;
      seg(V, [0, y0, 0], c, '#8a4a3a');
      diamond(V, c, Math.max(0, rr), '#4a9a7a', '#5aae86');
      if (rr > 0) diamond(V, [c[0], c[1] + 1, c[2]], rr - 1, '#6cc096', '#7cc8a0');
      if (s > 0.8 && py > 7) V.set(c[0], c[1] + 2, c[2], '#fff4f8', 0);
    }
  },
  tulip(V, s) {
    // one straight stem and two broad leaves curling away from it
    const h = Math.max(2, Math.round(8 * s)), L = Math.max(1, Math.round(3 * s));
    V.box(0, 0, 0, 0, h - 1, 0, '#5cb050');
    for (const [a, c] of [[Math.PI + 0.2, '#4aa860'], [0.4, '#58b464']]) {
      blade(V, [0, 0, 0], a, L, 2 + 3 * s, s, c, '#80d070');
      blade(V, [0, 1, 0], a + 0.45, L, 1 + 3 * s, s, c, '#80d070');
    }
  },
  tomato(V, s) {
    // a vine tied to a stake with little leaf sprays and yellow flowers; the fruit hangs off short trusses
    const h = 2 + Math.round(11 * s);
    V.box(0, 0, -1, 0, h + 1, -1, (x, y) => (y === h + 1 ? '#a8804e' : '#c8a070'));
    for (let y = 0; y <= h; y++) V.set(Math.round(Math.sin(y * 0.7) * 0.6), y, 0, '#5aa848', 0.03);
    for (let y = 3; y < h; y += 4) V.set(1, y, -1, '#f2e8d4', 0);
    for (let k = 0, y = 2; y < h; k++, y += 3) {
      const d = k % 2 ? 1 : -1, end = blade(V, [0, y, 0], d > 0 ? -0.35 : Math.PI + 0.35, 1 + Math.round(2 * s), 1, 1, '#4c9c44');
      diamond(V, [Math.round(end[0]) + d, Math.round(end[1]), Math.round(end[2])], s > 0.6 ? 1 : 0, '#4c9c44', '#6abc56');
    }
    if (s > 0.8) {
      for (const [x, y, z] of [[2, 4, 1], [-2, 12, 0]]) flower(V, [x, y, z], '#ffe04a', '#ffb43a');
      for (const p of ANCHORS.tomato.pts) seg(V, [0, p[1] + 1, 0], [p[0], p[1], p[2] - 1], '#5aa848');
    }
  },
  corn(V, s) {
    // three stalks with long arching leaves and golden tassels
    for (const [ox, oz, H] of [[0, 0, 16], [2, 2, 13], [-2, 1, 11]]) {
      const h = Math.max(2, Math.round(H * s));
      V.box(ox, 0, oz, ox, h, oz, (x, y) => (y % 4 === 3 ? '#76b040' : '#8ac850'));
      for (let k = 0, y = 3; y < h - 1; k++, y += 3) blade(V, [ox, y, oz], k * 2.4 + ox, Math.max(1, Math.round(4 * s)), 1.5, 3.2 * s, k % 2 ? '#5aa83e' : '#6ab846', '#9ad060');
      if (s > 0.8) for (const [dx, dy, dz] of [[0, 1, 0], [0, 2, 0], [0, 3, 0], [1, 2, 0], [-1, 3, 0], [0, 2, 1], [0, 3, -1]]) V.set(ox + dx, h + dy, oz + dz, dy === 3 ? '#f4d890' : '#e0b860');
    }
  },
  watermelon(V, s) { melonVine(V, s, '#4f9a3a', ['#3e8a3a', '#56a448', '#78c060'], '#ffe04a'); },
  pumpkin(V, s) { melonVine(V, s, '#5a9a3a', ['#4a8f3c', '#64aa4a', '#88c860'], '#ffb43a', true); },
  apple(V, s) {
    // a short trunk forking into branches, each ending in a flat-bottomed puff dotted with blossom
    const h = 2 + Math.round(5 * s), cols = ['#58b858', '#4aa852', '#7ad06a'];
    V.box(0, 0, 0, 1, h, 1, (x, y) => (y % 3 === 0 ? TRUNK2 : TRUNK));
    APPLE.forEach(([cx, cy, cz, r], i) => {
      const c = [Math.round(cx * s), h + Math.round((cy - 7) * s), Math.round(cz * s)];
      seg(V, [0.5, h, 0.5], c, TRUNK);
      puff(V, c, r * s + 0.6, cols);
      if (s > 0.8) for (let k = 0; k < 3; k++) { const a = i * 2.1 + k * 2.2; V.set(c[0] + Math.round(Math.cos(a) * r * 0.7), c[1] + Math.round(r * 0.6) + 1, c[2] + Math.round(Math.sin(a) * r * 0.7), k ? '#ffd6e6' : '#ffffff', 0); }
    });
  },
  mango(V, s) {
    // broad, flat canopies with a fringe of long hanging leaves and bronze new growth on top
    const h = 2 + Math.round(6 * s), cols = ['#2f8a50', '#3a9658', '#58b070'];
    V.box(0, 0, 0, 1, h, 1, (x, y) => (y % 3 === 0 ? '#5e3e2a' : '#7a5038'));
    MANGO.forEach(([cx, cy, cz, r], i) => {
      const c = [Math.round(cx * s), h + Math.round((cy - 8) * s), Math.round(cz * s)], R = r * s + 0.4;
      seg(V, [0.5, h, 0.5], c, '#7a5038');
      puff(V, c, R, cols, 0.6);
      if (s > 0.5) for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + i, x = c[0] + Math.round(Math.cos(a) * (R - 0.5)), z = c[2] + Math.round(Math.sin(a) * (R - 0.5)); seg(V, [x, c[1] - 1, z], [x, c[1] - 1 - (k % 3 ? 1 : 2), z], k % 2 ? '#2f8a50' : '#3f9a5a'); }
      if (s > 0.8) for (let k = 0; k < 3; k++) { const a = i * 2 + k * 2.1; V.set(c[0] + Math.round(Math.cos(a) * R * 0.5), c[1] + Math.round(R * 0.6 * 0.5) + 1, c[2] + Math.round(Math.sin(a) * R * 0.5), '#c86a3a', 0.03); }
    });
  },
  coconut(V, s) {
    // a leaning, ringed trunk and a crown of feathery fronds
    const h = 3 + Math.round(14 * s), tx = Math.round(Math.sin(1.2) * 2 * s), L = 2 + Math.round(6 * s);
    for (let y = 0; y < h; y++) {
      const x = Math.round(Math.sin((y / h) * 1.2) * 2 * s);
      V.set(x, y, 0, y % 3 === 0 ? '#7a5434' : '#a8784a', 0.02); V.set(x, y, 1, y % 3 === 0 ? '#6e4a2c' : '#9a6c42', 0.02);
    }
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.5, ca = Math.cos(a), sa = Math.sin(a);
      let prev = [tx, h, 0.5];
      for (let i = 1; i <= L; i++) {
        const t = i / L, q = [tx + ca * i, h + 2.5 * t - 5 * t * t, 0.5 + sa * i];
        seg(V, prev, q, '#4f9a3a');
        if (i > 2) for (const sd of [-1, 1]) V.set(q[0] - sa * sd, q[1] - 1, q[2] + ca * sd, i % 2 ? '#5cc050' : '#7ad05a', 0.03);
        prev = q;
      }
    }
    V.box(tx, h, 0, tx, h + 1, 1, '#62b848');
  },
  dragonfruit(V, s) {
    // a cactus climbing a post and draping over the old tyre on top, with big white flowers
    const h = 2 + Math.round(8 * s);
    V.box(0, 0, 0, 0, h, 0, '#a89a8a');
    if (s > 0.5) for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2; V.set(Math.round(Math.cos(a) * 2.4), h + 1, Math.round(Math.sin(a) * 2.4), '#3a3a46', 0.02); }
    for (const dx of [-1, 1]) for (let y = 0; y <= h; y++) V.set(dx, y, (y >> 2) & 1 ? 1 : 0, y % 3 === 0 ? '#5cc48e' : '#3faa7a', 0.03);
    const cact = (t) => (t > 0.97 ? '#5cc48e' : '#3faa7a');
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a), R = 1 + 4 * s;
      const pts = [[0, h + 1, 0], [ca * R * 0.6, h + 2, sa * R * 0.6], [ca * R, h, sa * R], [ca * R, h - 3 * s, sa * R]];
      for (let i = 1; i < pts.length; i++) { seg(V, pts[i - 1], pts[i], cact); seg(V, [pts[i - 1][0], pts[i - 1][1] + 1, pts[i - 1][2]], [pts[i][0], pts[i][1] + 1, pts[i][2]], cact); }
      if (s > 0.8 && k === 3) { const e = pts[3]; flower(V, [Math.round(e[0]), Math.round(e[1]) - 1, Math.round(e[2])], '#fff4f8', '#fff07a'); V.set(Math.round(e[0]) + 1, Math.round(e[1]), Math.round(e[2]) + 1, '#ff8ac0', 0); }
    }
  },
  grape(V, s) {
    // a little pergola: two posts, a beam with slats, a twisting vine and broad leaves; bunches hang under the beam
    const h = 2 + Math.round(8 * s), w = 2 + Math.round(5 * s);
    V.box(-w, 0, 0, -w, h, 0, '#9a6a42'); V.box(w, 0, 0, w, h, 0, '#9a6a42');
    V.box(-w - 1, h + 1, 0, w + 1, h + 1, 1, '#b8865a');
    if (s > 0.5) for (let x = -w + 1; x < w; x += 3) V.box(x, h + 2, -2, x, h + 2, 2, '#c8966a');
    for (let y = 0; y <= h + 1; y++) V.set(-w + 1 + Math.round(Math.sin(y * 0.8) * 0.5), y, Math.round(Math.cos(y * 0.8) * 0.6) - 1, '#7a5a3a', 0.03);
    for (let x = -w; x <= w; x += 2) for (const z of [-2, 1]) {
      if (hash(x, z, 7) < 0.25) continue;
      diamond(V, [x + (z > 0 ? 1 : 0), h + 3 + (hash(x, z, 8) < 0.4 ? 1 : 0), z], s > 0.6 ? 1 : 0, (x >> 1) & 1 ? '#5aa84a' : '#4c9c44', '#7cc45e');
    }
    if (s > 0.6) for (const x of [-w + 2, 0, w - 3]) { V.set(x, h + 1, 2, '#5aa84a'); V.set(x, h, 2, '#4c9c44'); V.set(x + 1, h, 2, '#7cc45e'); }
    if (s > 0.8) for (const [x, y, z] of [[-w, h - 1, -1], [w, h - 2, -1], [w - 1, h + 4, 0]]) { V.set(x, y, z, '#9ad860', 0); V.set(x, y - 1, z - 1, '#9ad860', 0); }
  },
  mushroom(V, s) {
    // a mossy log with a cluster of little mushrooms; the big one grows in front of it
    const L = 1 + Math.round(4 * s);
    for (let x = -L; x <= L; x++) for (let y = 0; y <= 2; y++) for (let z = -5; z <= -2; z++) {
      const d = (y - 1) ** 2 + (z + 3.5) ** 2;
      if (d > 2.3) continue;
      V.set(x, y, z, Math.abs(x) === L ? '#c8a070' : y === 2 && hash(x, z, 4) < 0.6 ? '#6ab850' : '#7a5038', 0.04);
    }
    if (s > 0.5) for (const [x, z, c] of [[-L + 1, -4, '#e8d2b0'], [L - 2, -3, '#c8844a'], [3, 2, '#e8d2b0']]) { const y = z < -1 ? 3 : 0; V.set(x, y, z, '#f4ead6'); V.set(x, y + 1, z, c); V.set(x + 1, y + 1, z, c); }
    if (s > 0.7) blade(V, [-3, 0, 1], 2.6, 3, 2, 2, '#4aa852', '#78c860');
  },
  beanstalk(V, s) {
    // two vines twisting round each other, heart-shaped leaves, and a wisp of cloud at the very top
    const h = 2 + Math.round(21 * s);
    for (let y = 0; y <= h; y++) for (const ph of [0, Math.PI]) V.set(Math.round(Math.cos(y * 0.45 + ph) * 1.3), y, Math.round(Math.sin(y * 0.45 + ph) * 1.3), ph ? '#3f9a3a' : '#4fb04a', 0.02);
    for (let k = 0, y = 4; y < h - 1; k++, y += 4) {
      const a = k * 2.2, end = blade(V, [0, y, 0], a, 1 + Math.round(s), 1, 0, '#4fb04a');
      heart(V, [Math.round(end[0]), Math.round(end[1]), Math.round(end[2])], a, '#5cc060', '#8fe07a');
    }
    if (s > 0.8) { V.ball(0, h + 3, 0, 2.4, '#ffffff', 0.45, 0); V.ball(2, h + 3, 1, 1.6, '#f2f6ff', 0.5, 0); }
  },
};
// watermelon and pumpkin: runners along the soil with broad leaves and flowers; the fruit sits out front
function melonVine(V, s, vine, leaves, bloom, big) {
  const L = 2 + Math.round(6 * s);
  for (const a of [Math.PI + 0.25, -Math.PI / 2 - 0.35, -0.25, -Math.PI * 0.8]) {
    let p = [0, 0, 0];
    for (let i = 1; i <= L; i++) {
      const w = Math.sin(i * 0.9 + a * 3) * 0.6, q = [Math.cos(a) * i - Math.sin(a) * w, 0, Math.sin(a) * i + Math.cos(a) * w];
      seg(V, p, q, vine);
      p = q;
      if (i % 3 === 2 && s > 0.45) {
        const sd = i % 6 === 2 ? 1 : -1;
        diamond(V, [Math.round(q[0] - Math.sin(a) * sd * 1.8), 1, Math.round(q[2] + Math.cos(a) * sd * 1.8)], big && s > 0.7 ? 2 : 1, leaves[i % 2], leaves[2]);
      }
    }
    if (s > 0.8) { flower(V, [Math.round(p[0]), 1, Math.round(p[2])], bloom, '#fff2a0'); V.set(Math.round(p[0]), 2, Math.round(p[2]), '#9ad860', 0); }
  }
}

// fruit attachment points on the mature plant. sit: fruit rests on that point; otherwise it hangs from it.
const hangBeside = (pts) => pts.map(([cx, cy, cz, r, a = Math.atan2(cz || 1, cx)]) => [Math.round(cx + Math.cos(a) * (r + 0.8)), cy, Math.round(cz + Math.sin(a) * (r + 0.8))]);
export const ANCHORS = {
  carrot: { sit: true, pts: [[0, -1, 0]] },
  strawberry: { sit: true, pts: [[4, 0, 0], [-4, 0, 0], [0, 0, 4]] },
  blueberry: { pts: BLUE.map(([x, y, z, r]) => { const a = Math.atan2(z || 1, x); return [Math.round(x + Math.cos(a) * (r + 0.5)), y, Math.round(z + Math.sin(a) * (r + 0.5))]; }) },
  tulip: { sit: true, pts: [[0, 8, 0]] },
  tomato: { pts: [[-2, 11, 2], [2, 8, 2], [-1, 5, 2]] },
  corn: { pts: [[1.5, 9, 0], [2, 7, 3.5]] },
  watermelon: { sit: true, pts: [[0, 0, 2]] },
  pumpkin: { sit: true, pts: [[0, 0, 2]] },
  apple: { pts: hangBeside(APPLE.map(([x, y, z, r]) => [x, y, z, r + 0.6])) },
  mango: { pts: hangBeside([[...MANGO[0], Math.PI], [...MANGO[1], 0], [...MANGO[2], -Math.PI / 2], [...MANGO[0], Math.PI / 2]]) },
  coconut: { pts: [[4, 15, 2], [0, 15, 1], [2, 15, -2]] },
  dragonfruit: { pts: around(4, 5, 7, 0.4).slice(0, 3) },
  grape: { pts: [[-5.25, 11, 0.5], [-1.75, 11, 0.5], [1.75, 11, 0.5], [5.25, 11, 0.5]] },
  mushroom: { sit: true, pts: [[0, 0, 1]] },
  beanstalk: { pts: [1, 3, 4].map((k) => { const a = k * 2.2; return [Math.round(Math.cos(a) * 2), 4 + 4 * k, Math.round(Math.sin(a) * 2)]; }) },
};

export const STAGE_S = [0, 0.3, 0.5, 0.68, 0.84, 1];
export const stageOf = (f) => (f < 0.08 ? 0 : f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.75 ? 3 : f < 1 ? 4 : 5);
export function plantGeo(crop, stage, variant) {
  return memo(`p|${crop}|${stage}|${variant}`, () => {
    const V = new Vox(rng(variant * 977 + stage * 31 + crop.length));
    if (stage === 0) { V.set(0, 0, 0, '#9a6440', 0.02); V.set(1, 0, 0, '#8a5a38', 0.02); V.set(0, 0, 1, '#8a5a38', 0.02); }
    else if (stage === 1) { V.set(0, 0, 0, STEM); V.set(0, 1, 0, STEM); V.set(-1, 2, 0, LEAF3); V.set(1, 2, 0, LEAF3); V.set(-1, 2, 1, LEAF); V.set(1, 2, -1, LEAF); V.set(0, 2, 0, LEAF); }
    else B[crop](V, STAGE_S[stage]);
    return mesh(V);
  });
}
export function plantHeight(crop, stage) {
  return memo(`ph|${crop}|${stage}`, () => { const g = plantGeo(crop, stage, 0); return Math.max(3, g.boundingBox.max.y); });
}

// ---------------------------------------------------------------- fruit
const round3 = (x, y, z) => Math.abs(x) + Math.abs(z) === 2; // corners of a 3x3 layer
const FR = {
  carrot(V) { // the shoulder that shows above the soil
    V.box(-1, 0, -1, 1, 1, 1, (x, y, z) => (y === 1 && round3(x, y, z) ? null : y === 0 ? '#ee7a1e' : '#ff8a2a'));
    V.box(-1, 2, -1, 1, 2, 1, (x, y, z) => (round3(x, y, z) ? null : x === -1 || z === 1 ? '#ffa448' : '#ff9238'));
  },
  carrotIcon(V) { V.box(0, 3, 0, 1, 5, 1, '#ff8a2a'); V.box(0, 1, 0, 0, 2, 0, '#ff7a1a'); V.set(1, 2, 1, '#ff7a1a'); V.set(0, 0, 1, '#e86a10'); V.set(0, 6, 0, LEAF); V.set(1, 7, 1, LEAF3); V.set(0, 7, 1, LEAF); V.set(1, 6, 0, LEAF); },
  strawberry(V) {
    V.set(0, 0, 0, '#d82a40');
    V.box(-1, 1, -1, 1, 2, 1, (x, y, z) => (y === 1 && round3(x, y, z) ? null : x === -1 && z === 1 && y === 2 ? '#ff6a7a' : (x + z + y) % 4 === 0 ? '#ff5064' : '#f03a4e'));
    for (const [x, z] of [[0, 0], [1, 0], [-1, 0]]) V.set(x, 3, z, x ? '#5cc060' : '#3f9a3a');
    V.set(0, 4, 0, '#5aa848');
  },
  blueberry(V) { // a loose cluster of berries with a dusty bloom
    for (const [x, y, z, c] of [[0, 0, 0, '#4654d8'], [1, 1, 0, '#3e4cc8'], [-1, 1, 1, '#5262e4'], [0, 1, -1, '#4654d8'], [0, 2, 0, '#6a7af0']]) V.set(x, y, z, c, 0.02);
    V.set(0, 3, 0, '#6a4a3a');
  },
  tulip(V) { V.box(-1, 0, -1, 1, 1, 1, '#ff8a3a'); V.set(0, 0, 0, '#e86a20'); for (const [x, z] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) V.set(x, 2, z, '#ffaa5a'); V.del(0, 1, 0); V.set(0, 1, 0, '#ffd84e'); },
  tulipIcon(V) { V.box(0, 0, 0, 0, 4, 0, STEM); V.set(-1, 1, 0, LEAF); V.set(1, 2, 0, LEAF3); V.box(-1, 5, -1, 1, 6, 1, '#ff8a3a'); for (const [x, z] of [[-1, -1], [1, 1], [1, -1], [-1, 1]]) V.set(x, 7, z, '#ffaa5a'); },
  tomato(V) {
    V.box(-1, 0, -1, 1, 2, 1, (x, y, z) => (round3(x, y, z) && y !== 1 ? null : '#ee4430'));
    V.set(-1, 2, 0, '#ff6a50'); V.set(0, 2, 1, '#ff7a5a'); V.set(1, 1, -1, '#c83420');
    V.set(0, 3, 0, '#3f9a3a'); V.set(1, 3, 0, '#5cc060'); V.set(-1, 3, 0, '#5cc060'); V.set(0, 4, 0, '#5a9a3a');
  },
  corn(V) {
    V.box(0, 1, 0, 1, 5, 1, (x, y, z) => ((x + y + z) & 1 ? '#ffd84e' : '#ffe476'));
    V.box(-1, 0, 0, -1, 3, 1, '#7abc48'); V.box(2, 0, 0, 2, 2, 1, '#8ac850'); V.set(0, 0, 0, '#7abc48'); V.set(1, 0, 1, '#7abc48');
    V.set(0, 6, 0, '#c8a050'); V.set(1, 6, 1, '#d8b060');
  },
  watermelon(V) { for (let x = -3; x <= 3; x++) for (let y = 0; y < 4; y++) for (let z = -2; z <= 2; z++) { if ((Math.abs(x) === 3 && (y === 0 || y === 3)) || (Math.abs(z) === 2 && (y === 0 || y === 3))) continue; V.set(x, y, z, (x + 9) % 3 === 0 ? '#2f7a3a' : y === 3 && x < 0 ? '#86d86a' : '#6ac85a'); } V.set(3, 2, 0, '#5a8a3a'); V.set(4, 3, 0, '#7ab04a'); },
  pumpkin(V) { // a squat, ribbed pumpkin with a curly stem
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = 0; y <= 3; y++) {
      if ((x * x + z * z) / 11 + ((y - 1.5) / 2.1) ** 2 > 1) continue;
      V.set(x, y, z, Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 10) % 2 ? '#ff9a2a' : '#f08218');
    }
    V.set(0, 4, 0, '#6a8a3a'); V.set(0, 5, 0, '#6a8a3a'); V.set(1, 5, 0, '#8ab04a');
  },
  apple(V) {
    V.box(-1, 0, -1, 1, 2, 1, (x, y, z) => (round3(x, y, z) && y !== 1 ? null : '#e2343c'));
    V.set(-1, 1, 1, '#ff6a6a'); V.set(0, 2, 1, '#ff5a5a'); V.set(1, 1, -1, '#b8242c');
    V.set(0, 3, 0, '#6a4428'); V.set(1, 3, 0, '#4aa852'); V.set(1, 4, 0, '#5cc060');
  },
  coconut(V) { V.box(-1, 0, -1, 1, 2, 1, (x, y, z) => (round3(x, y, z) && y !== 1 ? null : (x + y + z) & 1 ? '#6e4428' : '#7e5232')); V.set(0, 3, 0, '#5a7a3a'); },
  dragonfruit(V) {
    V.box(-1, 0, -1, 1, 3, 1, (x, y, z) => (round3(x, y, z) && (y === 0 || y === 3) ? null : '#e8408f'));
    for (const [x, y, z] of [[2, 1, 0], [-2, 2, 0], [0, 2, 2], [0, 1, -2], [1, 4, 0], [-1, 4, 0]]) V.set(x, y, z, '#7ccf55');
    V.set(-1, 2, 1, '#ff6ab0'); V.set(0, 4, 0, '#ff6ab0');
  },
  mango(V) {
    V.box(-1, 0, -1, 1, 3, 1, (x, y, z) => (round3(x, y, z) && (y === 0 || y === 3) ? null : y === 0 ? '#f05a2a' : y === 1 ? '#ff8a2a' : y === 2 ? '#ffb43a' : '#e8c84a'));
    V.set(-1, 2, 1, '#ffd870'); V.set(0, 4, 0, '#5a7a2a');
  },
  grape(V) { // a bunch narrowing toward the bottom
    [[2, 2], [2, 2], [2, 2], [2, 1], [1, 1]].forEach(([w, d], i) => { const y = 4 - i; for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) V.set(x - (w - 1) / 2, y, z, (x + z + y) & 1 ? '#8a4ad0' : '#7a3ab8'); });
    V.set(-1, 4, 1, '#a86af0'); V.set(0, 5, 0, '#6a4428'); V.set(1, 5, 0, '#5aa848');
  },
  mushroom(V) {
    V.box(-1, 0, -1, 1, 3, 1, '#f4ead6');
    V.ball(0, 4, 0, 4.4, (x, y, z) => (y < 0 ? null : (hash(x, y, z) < 0.12 && y > 0 ? '#fff6ee' : '#e0383a')), 0.75);
    V.box(-3, 4, -3, 3, 4, 3, (x, y, z) => (Math.hypot(x, z) < 3.6 ? '#e8d2b0' : '#e0383a'));
  },
  beanstalk(V) { // a fat bean pod
    V.box(0, 0, 0, 1, 4, 0, (x, y) => (y % 2 ? '#7ad050' : '#8ae060'));
    for (const y of [1, 3]) V.set(0, y, 1, '#a8f07a');
    V.set(0, 5, 0, '#4fb04a');
  },
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
// the farmer you play
const FARMER_PAL = { shirt: '#e8584c', pants: '#4a7ae0', hat: '#ffd86a', band: '#ff5a4a', hair: '#7a4a2c', skin: '#ffcfa0', boots: '#5a3a24' };
export const FARMER_S = 0.72; // farmers are built on a finer grid than the world
// frame 0 stands, 1 and 2 are the two halves of a stride (legs and arms swing opposite ways)
export function farmerGeo(frame) {
  const pal = FARMER_PAL;
  return memo('farmer' + frame, () => {
    const V = new Vox(rng(3));
    const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    for (const [x0, x1, s] of [[-2, -1, sw], [1, 2, -sw]]) {
      V.box(x0, 0, -1 + s, x1, 0, 1 + s, pal.boots || '#5a3a24', 0.02);
      V.box(x0, 1, -1 + s, x1, 1, 1 + s, pal.pants, 0.03);
      V.box(x0, 2, -1, x1, 3, 1, pal.pants, 0.03);
    }
    // overalls over a shirt: waist band, bib in front, straps over the shoulders and down the back
    V.box(-2, 4, -1, 2, 7, 1, pal.shirt, 0.03);
    V.box(-2, 4, -1, 2, 4, 1, pal.pants, 0.03);
    V.box(-1, 5, 1, 1, 6, 1, pal.pants, 0.03);
    for (const x of [-1, 1]) { V.set(x, 7, 1, pal.pants); V.box(x, 5, -1, x, 7, -1, pal.pants, 0.02); V.set(x, 6, 1, '#ffd84e', 0); }
    for (const [x, s] of [[-3, -sw], [3, sw]]) {
      V.box(x, 6, 0, x, 7, 0, pal.shirt, 0.02);
      V.box(x, 4, s, x, 5, s, pal.skin, 0.02);
    }
    // a big friendly head
    V.box(-2, 8, -2, 2, 11, 2, pal.skin, 0.02);
    V.set(-1, 9, 2, '#2a2230', 0); V.set(1, 9, 2, '#2a2230', 0);
    V.set(-1, 10, 2, '#2a2230', 0); V.set(1, 10, 2, '#2a2230', 0);
    V.set(-2, 9, 2, '#ff9a8a', 0); V.set(2, 9, 2, '#ff9a8a', 0);
    V.box(-2, 9, -2, 2, 11, -2, pal.hair, 0.03);
    for (const x of [-2, 2]) V.box(x, 10, -2, x, 11, 0, pal.hair, 0.03);
    // straw hat
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.abs(x) + Math.abs(z) < 6) V.set(x, 12, z, (x + z) & 1 ? pal.hat : shade(pal.hat, 0.93), 0.02);
    V.box(-2, 13, -2, 2, 13, 2, pal.band, 0.02);
    V.box(-2, 14, -2, 2, 14, 2, pal.hat, 0.03);
    V.box(-1, 15, -1, 1, 15, 1, shade(pal.hat, 1.06), 0.02);
    return mesh(V);
  });
}
// Market Day carts: a wagon of produce crates under a striped awning
export const CART = {
  veg: { col: '#5a9ae8', label: 'VEGGIE CART', goods: ['#f04a32', '#ffd84e', '#ff9a2a', '#6ac85a'] },
  berry: { col: '#ff7ab0', label: 'BERRY CART', goods: ['#f03a4e', '#4a5ae0', '#8a4ad0', '#ff9ac8'] },
};
export function cartGeo(id) {
  return memo('cart' + id, () => {
    const V = new Vox(rng(id.length * 7)), C = CART[id];
    V.box(-5, 2, -2, 5, 3, 2, (x, y) => (y === 3 ? '#d8a070' : x % 3 === 0 ? '#9a6a42' : '#b07a50'), 0.03);
    for (const wx of [-3, 3]) for (const wz of [-3, 3]) {
      for (let k = 0; k < 14; k++) { const t = (k / 14) * Math.PI * 2; V.set(wx + Math.round(Math.cos(t) * 1.6), 1.6 + Math.sin(t) * 1.6, wz, '#5a3a24', 0.02); }
      V.set(wx, 2, wz, '#3a2a1a', 0);
    }
    [-4, -2, 1, 3].forEach((x0, i) => {
      V.box(x0, 4, -1, x0 + 1, 4, 1, '#8a5a3a', 0.03);
      V.box(x0, 5, -1, x0 + 1, 5, 1, (x, y, z) => ((x + z) & 1 ? C.goods[i] : shade(C.goods[i], 1.15)), 0.04);
    });
    for (const px of [-5, 5]) for (const pz of [-2, 2]) V.box(px, 4, pz, px, 9, pz, '#8a5a3a', 0.02);
    for (let dx = -6; dx <= 6; dx++) for (let k = 0; k < 4; k++) V.set(dx, 11 - k, -2 + k * 1.4, Math.floor((dx + 6) / 2) % 2 ? '#fff6e6' : C.col, 0.02);
    for (let dx = -6; dx <= 6; dx += 2) V.set(dx, 7, 3, Math.floor((dx + 6) / 2) % 2 ? '#fff6e6' : C.col, 0.02);
    return mesh(V);
  });
}
export function balloonGeo(col) {
  return memo('balloon' + col, () => {
    const V = new Vox(rng(5));
    V.ball(0, 4, 0, 1.5, (x, y, z) => (x < 0 && y > 0 ? shade(col, 1.18) : col), 1.15, 0.02);
    V.set(0, 2, 0, shade(col, 0.8), 0); V.box(0, -1, 0, 0, 1, 0, '#f6f0e6', 0);
    return mesh(V, { offset: [-0.5, 0, -0.5] });
  });
}
export function heldGeo(kind) {
  return memo('held' + kind, () => {
    const V = new Vox(rng(9));
    if (kind === 'shovel') { V.box(0, 0, 0, 0, 5, 0, '#a8744b'); V.box(-1, -2, 0, 1, -1, 0, '#c8c6d8'); V.set(0, -3, 0, '#a9a7bd'); V.box(-1, 6, 0, 1, 6, 0, '#7f5238'); }
    else { V.box(-1, 0, 0, 1, 3, 0, '#f2e6c8'); V.box(-1, 3, 0, 1, 3, 0, '#c8a86a'); V.set(0, 1, 1, kind, 0); V.set(0, 2, 1, kind, 0); }
    return mesh(V, { offset: [-0.5, 0, -0.5] });
  });
}

// ---------------------------------------------------------------- scenery drawn straight into a shared voxel set
export function drawLamp(V, x, y, z) {
  V.box(x, y, z, x, y, z, '#4a4462', 0.02);
  V.box(x, y + 1, z, x, y + 7, z, '#5e5878', 0.02);
  V.box(x - 1, y + 8, z - 1, x + 1, y + 8, z + 1, '#4a4462', 0.02);
  V.set(x, y + 9, z, '#4a4462', 0);
}
export function drawBench(V, x, y, z) { V.box(x - 2, y + 1, z, x + 2, y + 1, z + 1, '#b8865a', 0.04); V.set(x - 2, y, z, '#7a5434'); V.set(x + 2, y, z, '#7a5434'); V.box(x - 2, y + 2, z, x + 2, y + 2, z, '#a8784a', 0.04); }
export function drawFlowerbed(V, x, y, z, w = 4) {
  for (let dx = -w; dx <= w; dx++) for (let dz = -1; dz <= 1; dz++) {
    V.set(x + dx, y, z + dz, '#6a4228', 0.04);
    if (hash(x + dx, z + dz, 4) < 0.7) V.set(x + dx, y + 1, z + dz, ['#ff6a8a', '#ffd84e', '#ffffff', '#9a7aff', '#ff9a3a'][Math.floor(hash(x + dx, z + dz, 5) * 5)], 0.02);
    else V.set(x + dx, y + 1, z + dz, '#5cb860', 0.05);
  }
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
export function boltGeo(len) {
  return memo('bolt' + len, () => { const V = new Vox(); let x = 0; for (let y = 0; y < len; y++) { if (y % 4 === 3) x += hash(y, len) < 0.5 ? 1 : -1; V.set(x, -y, 0, '#fffbd0', 0); } return mesh(V, { ao: false }); });
}
export function cubeGeo() { return memo('cube', () => { const V = new Vox(); V.set(0, 0, 0, '#ffffff', 0); return mesh(V, { offset: [-0.5, -0.5, -0.5], ao: false }); }); }
