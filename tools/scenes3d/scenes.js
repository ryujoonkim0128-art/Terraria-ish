// The four village mockups.
import { Diorama, Mask, dilate, soilFn, fbm, hex, rng, THREE } from './engine.js';
import * as P from './props.js';

const REF = ['#121217', '#141c2f', '#2b2019', '#412f21', '#53281d', '#2c3855', '#453b3a', '#5c402d', '#783a2b',
  '#554b60', '#74523a', '#435374', '#587b4b', '#974d3b', '#5f6271', '#896748', '#5c6b88', '#b76139', '#977553',
  '#558a86', '#80a361', '#727f97', '#b38556', '#a59171', '#8c8e95', '#748cb1', '#df8d4c', '#bf9d6e', '#c87c8b',
  '#909fb5', '#cfae79', '#f0b15c', '#b3b0ac', '#a0b2cb', '#e5ca95', '#bec5cd', '#cdd8e5', '#e8dfc6', '#edebe3',
  '#f3f6f9'];

// sky: vertical gradient plane far behind everything, plus stars
function sky(D, stops, stars = 0) {
  const s = stops.map((c) => ({ y: c[0], c: hex(c[1]) }));
  D.plane(-195, (x, y) => {
    const t = y / D.H;
    for (let i = 0; i < s.length - 1; i++) {
      if (t <= s[i + 1].y) {
        const k = (t - s[i].y) / (s[i + 1].y - s[i].y);
        return s[i].c.map((v, j) => v + (s[i + 1].c[j] - v) * k);
      }
    }
    return s[s.length - 1].c;
  }, { basic: true });
  if (stars) D.snow(stars, 99, -190, '#cdd8e5', [0, D.H * 0.55, D.W, D.H]);
}

function moon(D, x, y, r = 7) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), D.mat('#f3f6f9', { basic: true }));
  m.position.set(x, y, -185); D.scene.add(m);
  for (const [k, o] of [[2.4, 0.18], [4, 0.09], [6.5, 0.05]]) {
    const g = new THREE.Mesh(new THREE.CircleGeometry(r * k, 32), D.mat('#a0b2cb', { basic: true, opacity: o }));
    g.position.set(x, y, -186); D.scene.add(g);
  }
}

function smoke(D, x, y, n = 7, col = '#8c8e95') {
  for (let i = 0; i < n; i++) {
    const b = D.ball(x + Math.sin(i * 1.3) * 2 + i * 0.6, y + i * 5, 1.8 + i * 0.35, 10, col, { basic: true, opacity: 0.55 - i * 0.06 });
    b.castShadow = false;
  }
}

// Earth cut away as a diorama: front soil, a lit dug rim, and the cave's back wall.
function earth(D, mask, ground, o) {
  const { W, H } = D;
  const caves = mask.bits();
  const rimW = o.rim ?? 3;
  const ring = dilate(caves, W, H, rimW);
  D.plane(0, soilFn({ W, H, ground, holes: ring, seed: o.seed ?? 3, bands: o.bands, cap: o.cap }), { basic: true });
  const rimC = o.rimCols.map(hex);
  D.plane(-5, (x, y) => (ring[y * W + x] && !caves[y * W + x] && y <= ground(x)
    ? rimC[Math.floor(fbm(x, y, 3, 7) * rimC.length * 0.999)] : null));
  const wallC = o.wallCols.map(hex);
  D.plane(-40, (x, y) => {
    if (!ring[y * W + x]) return null;
    const t = fbm(x, y, 6, 11) * 0.7 + fbm(x, y * 3, 14, 12) * 0.3;
    return wallC[Math.floor(t * wallC.length * 0.999)];
  });
  return caves;
}

function relic(D, x, y) {        // glinting buried relics, as in the reference
  D.box(x - 3, y, 7, 1.2, 2, 1, '#f0b15c', { emissive: '#b3782a', rot: 0.7 });
  D.box(x - 3, y, 7, 1.2, 2, 1, '#f0b15c', { emissive: '#b3782a', rot: -0.7 });
}

function shed(D, x, y, w, h, o = {}) {
  D.box(x, y, w, h, -60, 16, o.col ?? '#3d3f4a');
  D.box(x + 2, y + 2, w - 4, h - 4, -51.9, 0.2, '#2c3855');
  if (o.windows) for (const wx of o.windows) D.box(x + wx, y + h * 0.45, 4, 3.5, -51.8, 0.2, '#f0b15c', { emissive: '#f0b15c' });
  D.prism([[x - 3, y + h], [x + w + 3, y + h], [x + w / 2, y + h + (o.pitch ?? 7)]], -60, 20, o.roof ?? '#2c3855');
  D.prism([[x - 3, y + h + 1], [x + w / 2, y + h + (o.pitch ?? 7) + 1], [x + w / 2 - 2, y + h + (o.pitch ?? 7) - 1], [x - 1, y + h]], -49, 1, '#cdd8e5');
}

// -------------------------------------------------------------------------------------------
// 1. Underground village at night in the snow
// -------------------------------------------------------------------------------------------
export function underground() {
  const W = 600, H = 400;
  const D = new Diorama(W, H, { palette: REF });
  const ground = (x) => 318 + Math.round((fbm(x, 0, 70, 4) - 0.5) * 8);
  sky(D, [[0.75, '#121a2c'], [0.9, '#16213a'], [1, '#1b2640']], 80);
  moon(D, 548, 378);
  D.scene.add(new THREE.HemisphereLight(0x5c6b88, 0x2b2019, 0.45));
  const moonL = new THREE.DirectionalLight(0x9fb0d0, 3.2); moonL.position.set(80, 120, 150); D.scene.add(moonL);

  const m = new Mask(W, H);
  // level A
  m.room(305, 250, 120, 58, 1);        // hall
  m.room(470, 254, 88, 44, 2);         // bedroom
  // level B
  m.room(120, 180, 96, 42, 3);         // pantry
  m.room(320, 176, 100, 46, 4);        // workshop
  m.room(500, 172, 80, 42, 5);         // brewery
  // level C
  m.room(222, 100, 96, 42, 6);         // mushroom farm
  m.room(425, 98, 90, 46, 7);          // forge
  m.room(548, 106, 58, 38, 8);         // cistern
  // level D
  m.room(330, 28, 240, 38, 9);         // mine gallery
  // passages
  m.tunnel([[92, 322], [252, 258]], 9);                   // stairs from the surface
  m.tunnel([[362, 258], [430, 262]], 8);                  // hall -> bedroom
  m.tunnel([[252, 258], [160, 188]], 9);                  // hall -> pantry stairs
  m.rect(350, 170, 11, 84);                               // ladder shaft hall -> workshop
  m.tunnel([[368, 184], [462, 180]], 8);                  // workshop -> brewery
  m.rect(262, 94, 11, 86);                                // shaft workshop -> mushrooms
  m.rect(461, 94, 11, 82);                                // shaft brewery -> forge
  m.tunnel([[470, 106], [520, 112]], 8);                  // forge -> cistern
  m.tunnel([[196, 106], [252, 34]], 9);                   // stairs mushrooms -> mine
  m.rect(398, 24, 11, 76);                                // shaft forge -> mine
  earth(D, m, ground, {
    seed: 3,
    bands: [{ above: 200, cols: ['#2b2019', '#2b2019', '#412f21', '#412f21', '#53281d'] },
      { above: -99, cols: ['#121217', '#141c2f', '#141c2f', '#141c2f', '#2c3855'] }],
    cap: ['#f3f6f9', '#edebe3', '#cdd8e5', '#cdd8e5', '#a0b2cb', '#5c6b88', '#2c3855'],
    rimCols: ['#74523a', '#896748', '#783a2b'],
    wallCols: ['#412f21', '#53281d', '#53281d', '#783a2b', '#5c402d'],
  });

  // --- surface ---
  const R = rng(4);
  for (let i = 0; i < 16; i++) {
    const x = R() * W, h = 40 + R() * 50;
    P.pine(D, x, ground(x) - 2, h, -120 - R() * 50, i % 2 ? '#2c3855' : '#435374');
  }
  shed(D, 76, ground(90) - 1, 34, 20, { windows: [], col: '#5c402d', roof: '#453b3a' });   // stairhead shed
  shed(D, 470, ground(490) - 1, 52, 22, { windows: [8, 22, 38], col: '#5c402d', roof: '#453b3a' });
  D.box(40, ground(40), 1.5, 10, -30, 1.5, '#5c402d');            // signpost
  D.box(34, ground(40) + 8, 10, 3, -30, 1, '#74523a');
  P.chimney(D, 268, 290, 336, -30);
  smoke(D, 270, 342);
  P.lantern(D, 112, ground(112) + 14, -40, { chain: 0, i: 30, dist: 50 });
  P.villager(D, 200, ground(200), -30, { pose: 'lantern', face: 1 });
  P.villager(D, 452, ground(452), -30, { pose: 'carry', face: 1 });
  for (let x = 290; x < 330; x += 8) P.crate(D, x, ground(x), 6, -70);

  // --- level A: hall + bedroom ---
  P.stairs(D, 100, 314, 248, 252);
  P.floorPlanks(D, 245, 366, 250);
  P.hearth(D, 258, 250);
  P.pot(D, 269, 254, -30);
  P.shelf(D, 300, 280, 28, -36, true, 1);
  P.shelf(D, 330, 270, 24, -36, true, 3);
  P.table(D, 314, 250, 30);
  P.bench(D, 316, 250, 12, -6);
  P.lantern(D, 318, 288, -14);
  P.villager(D, 292, 250, -18, { pose: 'cook', face: -1 });
  P.villager(D, 329, 250, -4, { kid: true, pose: 'jump', face: 1 });
  P.villager(D, 341, 250, -4, { kid: true, face: -1 });
  P.villager(D, 352, 250, -20, { pose: 'book', face: -1 });
  P.floorPlanks(D, 426, 514, 254);
  P.bed(D, 432, 254, 24);
  P.bed(D, 462, 254, 24, -20, P.COL.quilt2);
  P.sleeper(D, 432, 254, 24, -20);
  P.sleeper(D, 462, 254, 24, -20, P.COL.quilt2, true);
  P.candle(D, 491, 254, -24);
  P.shelf(D, 440, 284, 20, -36, true, 5);
  P.lantern(D, 470, 282, -16, { i: 35 });

  // --- level B ---
  P.stairs(D, 250, 252, 164, 182);
  P.ladder(D, 351.5, 176, 256);
  P.villager(D, 355, 208, -10, { pose: 'climb', face: 0 });
  P.floorPlanks(D, 72, 168, 180);
  for (const [x, y] of [[82, 180], [89, 180], [85.5, 185], [96, 180]]) P.sack(D, x, y, -26);
  P.barrel(D, 108, 180, -30); P.barrel(D, 118, 180, -30);
  P.crate(D, 140, 180, 8, -32); P.crate(D, 141, 188, 6, -32);
  P.shelf(D, 80, 204, 30, -36, true, 2);
  P.lantern(D, 120, 210, -14);
  P.villager(D, 128, 180, -12, { pose: 'carry', face: -1 });
  P.floorPlanks(D, 270, 370, 176);
  P.workbench(D, 300, 176);
  P.toolWall(D, 284, 196);
  P.villager(D, 292, 176, -16, { pose: 'hammer', face: 1 });
  P.lantern(D, 322, 208, -12);
  P.floorPlanks(D, 460, 540, 172);
  for (const [x, y] of [[488, 172], [497, 172], [506, 172], [492.5, 180], [501.5, 180]]) P.sideBarrel(D, x, y, -34, 4.2);
  P.barrel(D, 526, 172, -20);
  P.villager(D, 475, 172, -14, { pose: 'bucket', face: 1 });
  P.lantern(D, 510, 202, -12);

  // --- level C ---
  P.ladder(D, 264, 100, 180);
  P.ladder(D, 463, 98, 176);
  P.floorPlanks(D, 174, 270, 100);
  P.mushrooms(D, 184, 100, 34, -30, 1);
  P.mushrooms(D, 232, 100, 24, -34, 4);
  P.villager(D, 222, 100, -14, { pose: 'basket', face: -1 });
  P.floorPlanks(D, 380, 470, 98);
  P.furnace(D, 440, 98);
  P.anvil(D, 423, 98, -16);
  P.villager(D, 410, 98, -14, { pose: 'hammer', face: 1 });
  P.chimney(D, 446, 124, 150, -30);
  P.lantern(D, 398, 128, -12, { i: 30 });
  P.floorPlanks(D, 520, 578, 106);
  P.water(D, 526, 100, 30, 8, -22);
  P.rope(D, 540, 108, 138, -20);
  P.villager(D, 564, 106, -12, { pose: 'bucket', face: -1 });
  P.lantern(D, 552, 132, -14, { i: 30 });

  // --- level D: mine ---
  P.stairs(D, 198, 102, 250, 30);
  P.ladder(D, 399, 28, 100);
  P.rails(D, 214, 448, 28);
  P.cart(D, 300, 29);
  P.villager(D, 318, 28, -8, { face: -1 });
  P.villager(D, 228, 28, -12, { pose: 'dig', face: -1 });
  P.villager(D, 432, 28, -12, { pose: 'dig', face: 1 });
  for (const tx of [260, 340, 380]) { D.box(tx, 28, 2, 30, -30, 2, P.COL.woodDk); D.box(tx - 8, 56, 18, 2, -30, 3, P.COL.woodDk); }
  P.lantern(D, 280, 54, -14, { i: 40 });
  P.lantern(D, 420, 52, -14, { i: 35 });
  for (const [x, y] of [[212, 40], [216, 50], [446, 44], [451, 36], [360, 58]]) D.box(x, y, 2, 2, -34, 2, '#f0b15c', { emissive: '#f0b15c' });

  // extra dressing so rooms feel lived in
  for (const x of [284, 292, 356]) { P.rope(D, x, 292, 300, -30); D.ball(x, 290, 2, -30, P.COL.leaf, { sy: 1.4 }); }
  D.box(300, 250, 26, 0.6, -10, 14, P.COL.quilt);                 // rug
  P.shelf(D, 136, 196, 26, -36, true, 4);
  P.shelf(D, 330, 196, 24, -36, true, 6);
  for (const x of [500, 512]) { P.rope(D, x, 196, 204, -30); D.ball(x, 194, 2.2, -30, P.COL.quilt, { sy: 1.3 }); }
  P.shelf(D, 530, 125, 20, -36, true, 2);
  P.crate(D, 190, 100, 7, -30); P.sack(D, 200, 100, -30);
  D.box(440, 254, 50, 0.6, -10, 12, P.COL.quilt2);                // bedroom rug
  for (const [x, y] of [[305, 270], [470, 272], [120, 198], [320, 196], [500, 190], [222, 118], [425, 118], [548, 122], [330, 45], [260, 45], [400, 45]])
    D.light(x, y, 20, 0xc8703a, 22, 90);
  for (const [x, y] of [[40, 250], [560, 230], [80, 60], [520, 30], [140, 130]]) relic(D, x, y);
  D.snow(700, 5, 60);
  return D;
}

// -------------------------------------------------------------------------------------------
// Cross-section house: front wall cut away. Returns the y of each floor.
// -------------------------------------------------------------------------------------------
function house(D, x, y, w, floors, o = {}) {
  const Z = -17, DEP = 34, lit = o.lit;
  const total = floors.reduce((a, b) => a + b, 0);
  const wallC = o.wall ?? (o.lit ? '#896748' : P.COL.daub), beam = P.COL.woodDk;
  D.box(x - 3, y - 4, w + 6, 4, Z, DEP + 4, P.COL.stone);                     // stone footing
  if (o.stone) D.box(x, y, w, floors[0], Z - DEP / 2 + 1, 2, P.COL.stoneLt);
  D.box(x, y, w, total, Z - DEP / 2, 2, wallC);                                 // back wall
  const ys = [];
  let fy = y;
  floors.forEach((h, i) => {
    ys.push(fy);
    const gap = o.hatch && o.hatch[i];                                           // ladder hole in this floor
    if (i > 0) {
      if (gap) {
        D.box(x, fy - 2.5, gap[0] - x, 2.5, Z, DEP, P.COL.plank);
        D.box(gap[1], fy - 2.5, x + w - gap[1], 2.5, Z, DEP, P.COL.plank);
      } else D.box(x, fy - 2.5, w, 2.5, Z, DEP, P.COL.plank);
      D.box(x, fy - 3.5, w, 1.2, Z - DEP / 2 + 1.5, 1, beam);
    } else D.box(x, fy, w, 1, Z, DEP, P.COL.plank);
    for (const wx of (o.windows?.[i] ?? [w / 2 - 3])) {                          // windows in the back wall
      D.box(x + wx - 1, fy + h * 0.38 - 1, 8, 8, Z - DEP / 2 + 1.3, 0.4, beam);
      D.box(x + wx, fy + h * 0.38, 6, 6, Z - DEP / 2 + 1.6, 0.3, lit ? '#f0b15c' : '#f4d9a0', { basic: true });
      D.box(x + wx + 2.6, fy + h * 0.38, 0.8, 6, Z - DEP / 2 + 1.9, 0.3, beam);
      if (lit) D.light(x + wx + 3, fy + h * 0.5, Z + 6, 0xff9a40, 18, 60);
    }
    fy += h;
  });
  for (let px = x; px <= x + w - 2; px += Math.max(12, w / Math.round(w / 16))) {   // timber frame on the back wall
    D.box(px, y, 2, total, Z - DEP / 2 + 1.2, 0.6, beam);
  }
  D.box(x, y + total - 2, w, 2, Z - DEP / 2 + 1.2, 0.6, beam);
  for (const sx of [x - 2, x + w - 1]) D.box(sx, y, 3, total, Z, DEP + 2, o.side ?? P.COL.woodLt);   // cut side walls
  const top = y + total, rh = o.roofH ?? w * 0.42, ov = 7, th = 5;
  const outer = [[x - ov, top - 3], [x + w + ov, top - 3], [x + w / 2, top + rh]];
  const inner = [[x + 5, top], [x + w - 5, top], [x + w / 2, top + rh - th * 2.2]];
  D.prism(outer, Z, DEP + 8, o.roof ?? P.COL.thatch, { holes: [inner] });        // thatch shell, cut open
  for (let k = 1; k < 4; k++) {                                                   // straw courses on the cut face
    const t = k / 4;
    D.box(x - ov + (w / 2 + ov) * t - 2, top - 3 + rh * t - 0.5, 4, 1, Z + DEP / 2 + 4.2, 0.4, o.roofDk ?? P.COL.thatchDk, { rot: Math.atan2(rh, w / 2 + ov) });
    D.box(x + w + ov - (w / 2 + ov) * t - 2, top - 3 + rh * t - 0.5, 4, 1, Z + DEP / 2 + 4.2, 0.4, o.roofDk ?? P.COL.thatchDk, { rot: -Math.atan2(rh, w / 2 + ov) });
  }
  D.prism(inner, Z - DEP / 2, 2, wallC);                                          // gable wall inside the attic
  D.box(x, top, w, 2, Z, DEP, P.COL.plank);                                        // attic floor
  if (o.snow) D.prism([[x - ov - 1, top - 3], [x + w / 2, top + rh + 1.5], [x + w + ov + 1, top - 3], [x + w + ov - 2, top - 1], [x + w / 2, top + rh - 1], [x - ov + 2, top - 1]], Z + 8, 6, '#edebe3');
  if (o.chimney) { D.box(x + w * 0.72, top + rh * 0.3, 6, rh * 0.8, Z - 8, 6, P.COL.stone); smoke(D, x + w * 0.72 + 3, top + rh * 1.12, 6, o.smoke ?? '#b3b0ac'); }
  ys.push(top);
  return ys;
}

function lamp(D, x, y, z, lit, i) { if (lit) P.lantern(D, x, y, z, { i }); else P.lantern(D, x, y, z, { i: i * 0.25, dist: 50 }); }

// -------------------------------------------------------------------------------------------
// 2 + 3. Above-ground village in cross-section (golden hour / blue dusk)
// -------------------------------------------------------------------------------------------
function village(mode) {
  const W = 600, H = 400, dusk = mode === 'dusk';
  const extra = dusk ? ['#1f2a48', '#3a4a78', '#26304f'] : ['#e8c070', '#c8a050', '#6a8a4a', '#9ab070', '#f4d9a0', '#d88a5a', '#f6e4b8'];
  const D = new Diorama(W, H, { palette: REF.concat(extra), spread: 0.08 });
  const G = 120;
  const ground = (x) => G + Math.round((fbm(x, 0, 50, 21) - 0.5) * 3);
  if (dusk) {
    sky(D, [[0.3, '#2c3855'], [0.45, '#435374'], [0.62, '#2c3855'], [0.85, '#1b2640'], [1, '#141c2f']], 90);
    moon(D, 520, 360, 6);
    D.scene.add(new THREE.HemisphereLight(0x5c6b88, 0x2b2019, 0.7));
    const l = new THREE.DirectionalLight(0x8fa4d0, 1.4); l.position.set(120, 160, 160); D.scene.add(l);
  } else {
    sky(D, [[0.28, '#df8d4c'], [0.38, '#f0b15c'], [0.55, '#e5ca95'], [0.78, '#bec5cd'], [1, '#909fb5']]);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(16, 24), D.mat('#f6e4b8', { basic: true }));
    sun.position.set(548, 236, -185); D.scene.add(sun);
    for (const [k, op] of [[2, 0.25], [3.4, 0.12]]) {
      const g = new THREE.Mesh(new THREE.CircleGeometry(16 * k, 32), D.mat('#f0b15c', { basic: true, opacity: op }));
      g.position.set(548, 236, -186); D.scene.add(g);
    }
    D.scene.add(new THREE.HemisphereLight(0xf6d8a0, 0x7a5a3a, 1.7));
    const sunL = new THREE.DirectionalLight(0xffc27a, 2.6);
    sunL.position.set(160, 110, 320); sunL.castShadow = true;
    Object.assign(sunL.shadow.camera, { left: -400, right: 400, top: 400, bottom: -400, near: 1, far: 800 });
    sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.002;
    sunL.target.position.set(300, 150, -20); D.scene.add(sunL.target); D.scene.add(sunL);
  }
  const m = new Mask(W, H);
  m.room(78, 76, 76, 30, 31);          // house cellar
  m.room(276, 72, 100, 32, 32);        // tavern cellar
  m.rect(96, 76, 10, 46);              // cellar ladder holes
  m.rect(318, 72, 10, 50);
  m.room(500, 40, 70, 26, 33);         // old burrow of roots and junk under the weaver
  earth(D, m, ground, {
    seed: 21,
    bands: [{ above: 60, cols: ['#2b2019', '#412f21', '#412f21', '#53281d', '#5c402d'] },
      { above: -99, cols: ['#121217', '#141c2f', '#2b2019', '#141c2f', '#2c3855'] }],
    cap: dusk ? ['#587b4b', '#435374', '#2c3855', '#412f21'] : ['#80a361', '#587b4b', '#587b4b', '#412f21'],
    rimCols: ['#74523a', '#896748', '#783a2b'],
    wallCols: ['#412f21', '#53281d', '#53281d', '#783a2b', '#5c402d'],
  });
  const lit = dusk, I = dusk ? 34 : 20;

  // background trees + hills
  const R = rng(9);
  for (let i = 0; i < 12; i++) {
    const x = R() * W;
    P.tree(D, x, G - 2, 50 + R() * 40, -140 - R() * 30, dusk ? '#2c3855' : '#80a361');
  }
  D.prism([[0, G], [0, G + 40], [120, G + 62], [260, G + 30], [400, G + 70], [600, G + 44], [600, G]], -170, 4, dusk ? '#1b2640' : '#9ab070');

  // A: family house with cellar
  const A = house(D, 26, G, 94, [34, 30], { windows: [[12, 64], [60]], hatch: [null, [96, 106]], chimney: true, lit });
  P.hearth(D, 32, A[0], -32, false);
  P.pot(D, 40, A[0] + 3, -28);
  P.villager(D, 55, A[0], -12, { pose: 'cook', face: -1 });
  P.table(D, 66, A[0], 22);
  P.villager(D, 90, A[0], -8, { kid: true, face: -1 });
  lamp(D, 76, A[1] - 8, -14, lit, I);
  P.ladder(D, 98, A[0], A[1] + 2);
  P.bed(D, 32, A[1], 24);
  P.sleeper(D, 32, A[1], 24, -20);
  P.bed(D, 62, A[1], 20, -20, P.COL.quilt2);
  P.sleeper(D, 62, A[1], 20, -20, P.COL.quilt2, true);
  for (let i = 0; i < 3; i++) P.sack(D, 44 + i * 7, A[2] + 2, -24);
  P.ladder(D, 97, 76, G + 2);
  P.villager(D, 101, 92, -10, { pose: 'climb', face: 0 });
  P.floorPlanks(D, 44, 114, 76);
  P.barrel(D, 52, 76, -30); P.barrel(D, 62, 76, -30); P.sack(D, 74, 76, -28); P.sack(D, 80, 76, -28);
  lamp(D, 78, 96, -14, true, 35);

  // B: granary tower with a hoist
  const B = house(D, 136, G, 46, [30, 28, 28], { stone: true, windows: [[8], [20], [20]], hatch: [null, [168, 178], [140, 150]], roofH: 26, lit, roof: '#896748' });
  for (let i = 0; i < 4; i++) P.sack(D, 144 + i * 6, B[0], -24);
  P.villager(D, 152, B[0], -8, { pose: 'carry', face: 1 });
  P.ladder(D, 170, B[0], B[1] + 2);
  D.cyl(152, B[1], 9, 9, 3, -22, P.COL.stone); D.cyl(152, B[1] + 3, 8, 8, 3, -22, P.COL.stoneLt);   // millstones
  D.box(151, B[1] + 6, 2, 12, -22, 2, P.COL.woodDk);
  P.villager(D, 168, B[1], -8, { face: -1 });
  P.ladder(D, 142, B[1], B[2] + 2);
  P.villager(D, 164, B[2], -8, { pose: 'lantern', face: 1 });
  D.box(182, B[3] - 4, 14, 2, -10, 3, P.COL.woodDk);                              // hoist beam
  P.rope(D, 194, G + 40, B[3] - 4, -10);
  P.sack(D, 194, G + 34, -10, 3.6);
  lamp(D, 158, B[1] - 8, -14, lit, I);

  // C: tavern
  const C = house(D, 210, G, 128, [38, 30], { windows: [[14, 58, 104], [20, 90]], hatch: [null, [312, 322]], chimney: true, lit, roofH: 44 });
  D.box(216, C[0], 30, 10, -24, 8, P.COL.woodLt);                                  // bar
  for (let i = 0; i < 3; i++) P.sideBarrel(D, 222 + i * 9, C[0] + 18, -32, 3.6);
  P.villager(D, 228, C[0] + 1, -32, { face: 1 });
  P.table(D, 256, C[0], 22); P.bench(D, 254, C[0], 8, -8); P.bench(D, 272, C[0], 8, -8);
  P.table(D, 288, C[0], 22);
  P.villager(D, 262, C[0], -4, { face: 1 });
  P.villager(D, 280, C[0], -24, { face: -1, pose: 'book' });
  P.villager(D, 300, C[0], -4, { pose: 'bucket', face: -1 });
  P.ladder(D, 314, C[0], C[1] + 2);
  P.bed(D, 218, C[1], 22); P.sleeper(D, 218, C[1], 22, -20);
  P.bed(D, 246, C[1], 22, -20, P.COL.quilt2);
  P.villager(D, 280, C[1], -10, { face: -1 });
  P.shelf(D, 290, C[1] + 16, 20, -36, true, 3);
  for (let i = 0; i < 4; i++) P.crate(D, 230 + i * 12, C[2] + 2, 7, -24);
  lamp(D, 270, C[1] - 8, -12, lit, I); lamp(D, 250, C[2] - 8, -12, lit, I * 0.7);
  P.ladder(D, 318.5, 72, G + 2);
  P.floorPlanks(D, 226, 326, 72);
  for (let i = 0; i < 4; i++) P.sideBarrel(D, 240 + i * 10, 72, -32, 4.2);
  P.villager(D, 300, 72, -12, { pose: 'carry', face: -1 });
  lamp(D, 276, 94, -14, true, 35);

  // D: smithy, open lean-to
  const Dm = house(D, 356, G, 70, [36], { windows: [[40]], lit, roofH: 24, roof: '#5f6271' });
  P.furnace(D, 362, Dm[0], -30);
  P.anvil(D, 392, Dm[0], -14);
  P.villager(D, 404, Dm[0], -12, { pose: 'hammer', face: -1 });
  P.toolWall(D, 400, Dm[0] + 22);
  P.barrel(D, 418, Dm[0], -24, 3.5, 7);

  // E: weaver's cottage
  const E = house(D, 450, G, 82, [32, 26], { windows: [[10, 56], [34]], hatch: [null, [512, 522]], chimney: true, lit });
  for (const [px, py] of [[460, 0], [484, 0]]) { D.box(px, E[0] + py, 2, 22, -28, 2, P.COL.wood); }
  D.box(458, E[0] + 20, 30, 2, -28, 3, P.COL.wood);
  for (let i = 0; i < 9; i++) D.box(463 + i * 2.4, E[0] + 4, 0.6, 16, -28, 0.4, i % 2 ? P.COL.quilt : P.COL.linen);
  P.villager(D, 494, E[0], -14, { face: -1 });
  P.ladder(D, 514, E[0], E[1] + 2);
  P.villager(D, 518, E[0] + 16, -10, { pose: 'climb', face: 0 });
  for (let i = 0; i < 3; i++) D.cyl(462 + i * 9, E[1], 3, 2.4, 4, -24, P.COL.thatch);
  P.villager(D, 492, E[1], -14, { pose: 'basket', face: 1 });
  lamp(D, 478, E[1] - 7, -12, lit, I);
  P.floorPlanks(D, 468, 532, 40);
  for (let i = 0; i < 3; i++) P.crate(D, 478 + i * 10, 40, 7, -28);
  D.light(500, 52, -4, 0xffa24a, lit ? 20 : 12, 50);
  P.candle(D, 530, 40, -24);
  D.ball(510, 44, 2.5, -20, P.COL.wolfLt); D.ball(513, 47, 1.3, -20, P.COL.wolfLt);   // a rabbit in the old burrow

  // outside: well, fence, kids, errands
  D.cyl(560, G, 7, 7, 6, -16, P.COL.stone);
  D.box(553, G + 6, 1.5, 12, -16, 1.5, P.COL.wood); D.box(566, G + 6, 1.5, 12, -16, 1.5, P.COL.wood);
  D.prism([[550, G + 17], [570, G + 17], [560, G + 23]], -16, 16, P.COL.thatchDk);
  P.villager(D, 578, G, -10, { pose: 'bucket', face: -1 });
  P.villager(D, 436, G, -4, { kid: true, pose: 'jump', face: 1 });
  P.villager(D, 444, G, -4, { kid: true, face: -1 });
  P.villager(D, 196, G, -2, { pose: 'carry', face: 1 });
  for (let x = 586; x < 600; x += 6) D.box(x, G, 1.5, 9, -6, 1.5, P.COL.wood);
  D.box(584, G + 6, 16, 1.2, -6, 1, P.COL.wood);
  if (dusk) { P.lantern(D, 344, G + 22, -4, { i: 40 }); D.box(344, G, 1.5, 25, -4, 1.5, P.COL.woodDk); }
  D.snow(dusk ? 120 : 0, 7, 60, '#a0b2cb', [0, G, W, H]);
  return D;
}

// -------------------------------------------------------------------------------------------
// 4. Hillside village on terraces, a wolf den underneath (snowy night)
// -------------------------------------------------------------------------------------------
export function hillside() {
  const W = 600, H = 400;
  const D = new Diorama(W, H, { palette: REF });
  const steps = [[0, 74], [134, 134], [276, 194], [424, 254], [560, 290]];
  const ground = (x) => {
    let y = steps[0][1];
    for (let i = 1; i < steps.length; i++) {
      const [sx, sy] = steps[i], prev = steps[i - 1][1];
      if (x >= sx + 12) y = sy;
      else if (x > sx) y = prev + (sy - prev) * ((x - sx) / 12) ** 1.5;
    }
    return Math.round(y + (fbm(x, 0, 30, 41) - 0.5) * 4);
  };
  sky(D, [[0.5, '#1b2640'], [0.8, '#16213a'], [1, '#121a2c']], 120);
  moon(D, 80, 360);
  D.scene.add(new THREE.HemisphereLight(0x5c6b88, 0x2b2019, 0.55));
  const ml = new THREE.DirectionalLight(0x9fb0d0, 3); ml.position.set(-100, 140, 150); D.scene.add(ml);

  const m = new Mask(W, H);
  m.room(380, 70, 190, 58, 41);                       // wolf den
  m.room(470, 100, 60, 30, 42);                       // side chamber
  m.tunnel([[118, 80], [200, 76], [292, 74]], 11);    // den mouth opening onto the lower meadow
  m.room(470, 214, 70, 28, 43);                       // root cellar of the top house (thin wall above the den)
  m.rect(506, 214, 10, 42);
  earth(D, m, ground, {
    seed: 41,
    bands: [{ above: 30, cols: ['#2b2019', '#2b2019', '#412f21', '#412f21', '#53281d'] },
      { above: -99, cols: ['#121217', '#141c2f', '#141c2f', '#141c2f', '#2c3855'] }],
    cap: ['#f3f6f9', '#edebe3', '#cdd8e5', '#cdd8e5', '#a0b2cb', '#5c6b88', '#2c3855'],
    rimCols: ['#554b60', '#5f6271', '#5c402d'],
    wallCols: ['#453b3a', '#554b60', '#5c402d', '#453b3a', '#5f6271'],
  });
  // retaining walls where the terraces step up
  for (const [sx, lo, hi] of [[134, 74, 134], [276, 134, 194], [424, 194, 254]]) {
    for (let y = lo; y < hi; y += 5) for (let k = 0; k < 3; k++) D.box(sx + k * 4.3 + ((y / 5) % 2) * 2, y, 4, 4.6, 1.5, 3, k % 2 ? P.COL.stone : P.COL.stoneDk);
  }
  const R = rng(12);
  for (let i = 0; i < 14; i++) { const x = R() * W; P.pine(D, x, ground(x) - 4, 40 + R() * 50, -130 - R() * 40, i % 2 ? '#2c3855' : '#435374'); }

  const hs = { snow: true, lit: true, chimney: true, smoke: '#8c8e95' };
  const h1 = house(D, 18, 74, 82, [32, 26], { ...hs, windows: [[10, 56], [34]], hatch: [null, [84, 94]] });
  P.hearth(D, 24, h1[0], -32, false); P.pot(D, 32, h1[0] + 3, -28);
  P.villager(D, 46, h1[0], -12, { pose: 'cook', face: -1 });
  P.table(D, 58, h1[0], 20); P.villager(D, 76, h1[0], -6, { face: -1 });
  P.ladder(D, 86, h1[0], h1[1] + 2);
  P.bed(D, 24, h1[1], 22); P.sleeper(D, 24, h1[1], 22, -20); P.bed(D, 50, h1[1], 20, -20, P.COL.quilt2); P.sleeper(D, 50, h1[1], 20, -20, P.COL.quilt2, true);
  P.lantern(D, 64, h1[1] - 8, -14, { i: 32 });
  const h2 = house(D, 156, 134, 96, [34, 28], { ...hs, windows: [[12, 70], [40]], hatch: [null, [226, 236]] });
  P.workbench(D, 164, h2[0]); P.villager(D, 196, h2[0], -12, { pose: 'hammer', face: -1 });
  for (let i = 0; i < 3; i++) P.sideBarrel(D, 212 + i * 9, h2[0], -32, 4);
  P.ladder(D, 228, h2[0], h2[1] + 2); P.villager(D, 232, h2[0] + 14, -10, { pose: 'climb', face: 0 });
  P.shelf(D, 166, h2[1] + 14, 30, -36, true, 5); P.villager(D, 190, h2[1], -12, { pose: 'book', face: 1 });
  P.lantern(D, 200, h2[1] - 8, -14, { i: 32 });
  const h3 = house(D, 300, 194, 86, [32, 26], { ...hs, windows: [[12, 58], [30]], hatch: [null, [368, 378]] });
  P.table(D, 312, h3[0], 24); P.villager(D, 306, h3[0], -6, { kid: true, pose: 'jump', face: 1 }); P.villager(D, 346, h3[0], -6, { kid: true, face: -1 });
  P.villager(D, 330, h3[0], -24, { pose: 'basket', face: 1 });
  P.ladder(D, 370, h3[0], h3[1] + 2);
  P.bed(D, 308, h3[1], 24); P.sleeper(D, 308, h3[1], 24, -20);
  P.lantern(D, 340, h3[1] - 8, -14, { i: 32 });
  const h4 = house(D, 440, 254, 84, [30, 24], { ...hs, windows: [[10, 58], [34]], hatch: [null, [504, 514]] });
  P.hearth(D, 446, h4[0], -32, false); P.villager(D, 472, h4[0], -12, { pose: 'carry', face: 1 });
  P.ladder(D, 506, h4[0], h4[1] + 2); P.ladder(D, 507, 214, h4[0] + 2);
  P.floorPlanks(D, 436, 516, 214);
  for (let i = 0; i < 4; i++) P.sack(D, 444 + i * 7, 214, -26);
  P.villager(D, 486, 214, -10, { pose: 'carry', face: -1 });
  P.lantern(D, 470, 236, -14, { i: 30 });
  // ladders up the terrace walls, a snowman, kids, the cautious lantern-bearer at the den mouth
  P.ladder(D, 124, 74, 136, 4); P.ladder(D, 266, 134, 196, 4); P.ladder(D, 414, 194, 256, 4);
  P.villager(D, 128, 100, 8, { pose: 'climb', face: 0 });
  D.ball(116, 74 + 5, 5, -4, '#edebe3'); D.ball(116, 74 + 12, 3.6, -4, '#edebe3'); D.ball(116, 74 + 17.5, 2.6, -4, '#edebe3');
  P.villager(D, 104, 74, -2, { kid: true, pose: 'jump', face: 1 });
  P.villager(D, 150, 134, -4, { kid: true, face: -1 });
  P.villager(D, 236, 66, -6, { pose: 'lantern', face: 1 });
  // the den (floor at y 70, side chamber at 100)
  P.wolf(D, 322, 70, -18, { sleep: true, face: 1 });
  P.wolf(D, 352, 70, -28, { sleep: true, face: -1 });
  P.wolf(D, 408, 70, -12, { face: -1 });
  P.wolf(D, 440, 70, -24, { sleep: true, face: 1 });
  P.wolf(D, 470, 100, -20, { sleep: true, face: -1 });
  P.wolf(D, 378, 70, -6, { face: 1, s: 1 });   // pup
  P.bones(D, 312, 70.5, -12); P.bones(D, 424, 71, -6); P.bones(D, 296, 71, -22);
  D.light(380, 92, 0, 0x8fa4d8, 110, 170);
  D.light(244, 76, 0, 0xffa24a, 45, 70);   // the villager's lantern spills in at the mouth
  D.light(160, 90, 30, 0x9fb0d0, 30, 90);
  D.snow(700, 13, 60);
  return D;
}

export const SCENES = { 1: underground, 2: () => village('gold'), 3: () => village('dusk'), 4: hillside };
