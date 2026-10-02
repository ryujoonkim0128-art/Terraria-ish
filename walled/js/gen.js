'use strict';
// World generation: blocks of buildings jammed together, lightwells between blocks, rooftops, a drain underneath.

const ROOM_KINDS_GROUND = [['tea', 2.2], ['noodle', 1.6], ['grocer', 1.6], ['barber', 1], ['dentist', 1.2], ['clinic', 1], ['fishball', 1], ['metal', 1], ['home', 1.2]];
const ROOM_KINDS_UP = [['home', 10], ['sewing', 1], ['noodle', 0.6], ['fishball', 0.6], ['metal', 0.7], ['dentist', 0.6], ['mahjong', 0.9], ['temple', 0.45], ['clinic', 0.3], ['empty', 1.7], ['school', 0.3]];
const SIGN_WORDS = [['牙科', 'dentist'], ['診所', 'clinic'], ['麵家', 'noodle'], ['魚蛋', 'fishball'], ['理髮', 'barber'], ['茶室', 'tea'], ['麻雀', 'mahjong'], ['押', 'pawn'], ['藥房', 'pharmacy'], ['酒家', 'restaurant'], ['士多', 'store'], ['金牙', 'gold teeth'], ['醫生', 'doctor'], ['旅館', 'hostel']];
const NEON = ['#ff3b5c', '#ff6ad5', '#3dffb0', '#47dcff', '#ffb347', '#f4f0ff', '#ff5a2a'];

function wpick(list) {
  let s = 0; for (const [, w] of list) s += w;
  let r = R() * s;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}

function genWorld(seed) {
  R = mulberry32(seed);
  const W = 200, H = 140, G = 124, N = W * H;
  const w = {
    W, H, G, seed, tiles: new Uint8Array(N), bg: new Uint8Array(N), room: new Int16Array(N).fill(-1), exp: new Float32Array(N),
    rooms: [], blds: [], blocks: [], wells: [], lights: [], props: [], signs: [], objs: [], wins: [], wires: [], acs: [], laundry: [], antennas: [], tanks: [], roofline: new Int16Array(W).fill(G),
  };
  const I = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const setT = (x, y, t) => { if (inb(x, y)) w.tiles[I(x, y)] = t; };
  const getT = (x, y) => (inb(x, y) ? w.tiles[I(x, y)] : WALL);
  const setB = (x, y, b) => { if (inb(x, y)) w.bg[I(x, y)] = b; };
  w.I = I;

  // ground and drain
  for (let y = G; y < H; y++) for (let x = 0; x < W; x++) { setT(x, y, GRND); setB(x, y, B_EARTH); }
  const sw = { x0: 8, x1: W - 9, y0: G + 3, y1: G + 7 };
  for (let y = sw.y0; y <= sw.y1; y++) for (let x = sw.x0; x <= sw.x1; x++) { setT(x, y, AIR); setB(x, y, B_SEWER); }
  w.sewer = sw;

  // blocks
  let x = 20; const xEnd = W - 20;
  while (xEnd - x >= 16) {
    let bw = irnd(22, 36);
    if (xEnd - (x + bw) < 22) bw = xEnd - x;
    w.blocks.push({ x0: x, x1: x + bw - 1, off: irnd(0, 3), blds: [] });
    x += bw + irnd(3, 5);
  }

  // buildings
  const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (const [bi, bl] of w.blocks.entries()) {
    let bx = bl.x0;
    while (bx < bl.x1) {
      let ww = irnd(11, 17);
      if (bl.x1 - (bx + ww) < 11) ww = bl.x1 - bx;
      const nF = irnd(9, 14);
      const b = { i: w.blds.length, block: bi, x0: bx, x1: bx + ww, nF, off: bl.off, fr: [], letter: LET[w.blds.length % LET.length] };
      for (let k = 0; k <= nF; k++) b.fr.push(k === 0 ? G : G - bl.off - 5 * k);
      b.roof = b.fr[nF];
      w.blds.push(b); bl.blds.push(b);
      bx += ww;
    }
  }

  const newRoom = (o) => { o.id = w.rooms.length; w.rooms.push(o); return o; };

  for (const b of w.blds) {
    for (let y = b.roof; y < G; y++) for (let x = b.x0; x <= b.x1; x++) setB(x, y, B_ROOM);
    for (let y = b.roof; y < G; y++) { setT(b.x0, y, WALL); setT(b.x1, y, WALL); }
    for (let k = 1; k <= b.nF; k++) for (let x = b.x0; x <= b.x1; x++) setT(x, b.fr[k], WALL);
    for (let x = b.x0; x <= b.x1; x++) w.roofline[x] = Math.min(w.roofline[x], b.roof);
    const left = chance(0.5);
    const s0 = left ? b.x0 + 1 : b.x1 - 3, s1 = s0 + 2, sp = left ? s1 + 1 : s0 - 1;
    b.sx = s0 + 1; b.stair = [s0, s1];
    b.rooms = [];
    for (let k = 0; k < b.nF; k++) {
      const y0 = b.fr[k + 1] + 1, y1 = b.fr[k] - 1;
      // stairwell partition
      for (let y = y0; y <= y1; y++) setT(sp, y, WALL);
      for (let y = y1 - 2; y <= y1; y++) setT(sp, y, AIR);
      const st = newRoom({ x0: s0, x1: s1, y0, y1, k, b: b.i, type: 'stair' });
      b.rooms.push(st);
      const a = left ? sp + 1 : b.x0 + 1, e = left ? b.x1 - 1 : sp - 1;
      let cx = a;
      while (cx <= e) {
        let rw = irnd(4, 8);
        if (e - (cx + rw - 1) < 5) rw = e - cx + 1;
        const r = newRoom({ x0: cx, x1: cx + rw - 1, y0, y1, k, b: b.i, type: null });
        b.rooms.push(r);
        const p = cx + rw;
        if (p <= e) {
          for (let y = y0; y <= y1; y++) setT(p, y, WALL);
          for (let y = y1 - 2; y <= y1; y++) setT(p, y, AIR);
        }
        cx = p + 1;
      }
    }
    // stair spine ladder
    for (let y = b.roof; y < G; y++) setT(b.sx, y, getT(b.sx, y) === WALL ? LADF : LAD);
    // extra ladders punched through ceilings
    const extra = irnd(1, 3);
    for (let n = 0; n < extra * 4 && b.extra !== extra; n++) {
      b.extra = b.extra || 0;
      const k = irnd(0, b.nF - 2);
      const cand = b.rooms.filter((r) => r.k === k && r.type !== 'stair' && r.x1 - r.x0 >= 3);
      if (!cand.length) continue;
      const r = pick(cand);
      const lx = irnd(r.x0 + 1, r.x1 - 1);
      const top = b.fr[k + 1];
      if (getT(lx, top - 1) !== AIR || getT(lx, top - 2) !== AIR || getT(lx - 1, top) !== WALL || getT(lx + 1, top) !== WALL) continue;
      if (getT(lx, r.y1) !== AIR) continue;
      for (let y = top; y <= r.y1; y++) setT(lx, y, y === top ? LADF : LAD);
      b.extra++;
    }
  }

  // room ids on tiles
  for (const r of w.rooms) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) w.room[I(x, y)] = r.id;

  // shared walls inside blocks
  for (const bl of w.blocks) {
    for (let i = 0; i + 1 < bl.blds.length; i++) {
      const A = bl.blds[i], B = bl.blds[i + 1], c = A.x1;
      const mn = Math.min(A.nF, B.nF);
      for (let k = 0; k < mn; k++) {
        if (k === 0 || chance(0.45)) { const f = A.fr[k]; for (let y = f - 3; y < f; y++) setT(c, y, AIR); }
      }
      if (A.nF !== B.nF) { const f = A.fr[mn]; for (let y = f - 3; y < f; y++) setT(c, y, AIR); }
    }
    // outer ground doors
    const L = bl.blds[0], Rb = bl.blds[bl.blds.length - 1];
    for (let y = G - 3; y < G; y++) { setT(L.x0, y, AIR); setT(Rb.x1, y, AIR); }
  }

  // lightwells
  for (let i = 0; i + 1 < w.blocks.length; i++) {
    const A = w.blocks[i].blds[w.blocks[i].blds.length - 1], B = w.blocks[i + 1].blds[0];
    const ga = A.x1 + 1, gb = B.x0 - 1;
    const top = Math.min(A.roof, B.roof);
    const well = { i, A: A.i, B: B.i, x0: ga, x1: gb, top, bridges: [] };
    w.wells.push(well);
    for (let x = ga; x <= gb; x++) { w.roofline[x] = Math.max(A.roof, B.roof); for (let y = top + 2; y < G; y++) setB(x, y, B_WELL); }
    const cands = [];
    for (let ka = 1; ka <= A.nF; ka++) {
      let best = null;
      for (let kb = 1; kb <= B.nF; kb++) { const d = Math.abs(A.fr[ka] - B.fr[kb]); if (d <= 2 && (!best || d < best.d)) best = { ka, kb, d }; }
      if (best) cands.push(best);
    }
    let made = 0;
    const used = new Set();
    const make = (c) => {
      const ra = A.fr[c.ka], rb = B.fr[c.kb], y = Math.max(ra, rb);
      for (const u of used) if (Math.abs(u - y) < 4) return;
      used.add(y);
      for (let x = ga; x <= gb; x++) setT(x, y, PLAT);
      if (c.ka < A.nF) for (let yy = ra - 3; yy < ra; yy++) setT(A.x1, yy, AIR);
      if (c.kb < B.nF) for (let yy = rb - 3; yy < rb; yy++) setT(B.x0, yy, AIR);
      well.bridges.push({ y, ra, rb });
      made++;
    };
    for (const c of cands) if (chance(0.38)) make(c);
    for (const c of cands.slice().sort(() => R() - 0.5)) if (made < 3) make(c);
    // air conditioners hung on the well walls: little ledges
    for (const [b, side] of [[A, 1], [B, -1]]) {
      for (let k = 1; k < b.nF; k++) {
        if (!chance(0.32)) continue;
        const y = b.fr[k] - 2;
        if (well.bridges.some((br) => Math.abs(br.y - y) < 3)) continue;
        const ax = side > 0 ? ga : gb - 1;
        if (gb - ga < 3) continue;
        setT(ax, y, PLAT); setT(ax + 1, y, PLAT);
        w.acs.push({ x: ax, y, side });
      }
    }
    // wires across the well, some of them live
    for (let n = irnd(2, 4); n--;) {
      const y = irnd(top + 4, G - 6);
      w.wires.push({ x0: (ga) * T, x1: (gb + 1) * T, y: y * T + irnd(0, 6), sag: irnd(4, 10), live: false, ph: rnd(0, 6) });
    }
    for (const br of well.bridges) if (chance(0.45)) {
      w.wires.push({ x0: ga * T, x1: (gb + 1) * T, y: br.y * T - 22, sag: 12, live: true, ph: rnd(0, 6) });
    }
    // laundry poles
    for (let n = irnd(2, 4); n--;) {
      const side = chance(0.5) ? 1 : -1;
      const y = irnd(top + 6, G - 8) * T;
      w.laundry.push({ x: side > 0 ? ga * T : (gb + 1) * T, y, len: irnd(14, (gb - ga + 1) * T - 4), side, seed: irnd(0, 9999) });
    }
    // facade windows at the back of the well
    for (let y = top + 3; y < G - 1; y += irnd(3, 5)) {
      for (let x = ga * T + irnd(1, 4); x < (gb + 1) * T - 4; x += irnd(6, 10)) {
        w.wins.push({ x, y: y * T + irnd(0, 3), w: 3, h: 4, c: pick(['#ffd28a', '#ffc070', '#c8f0ff', '#ffe6b0', '#a8ffd0']), on: chance(0.55), fl: chance(0.08) });
      }
    }
    // neon signs hanging in the well
    for (let n = irnd(1, 3); n--;) addSign(w, chance(0.5) ? A.x1 * T + T : B.x0 * T - 13, irnd(Math.max(top + 8, G - 50), G - 6) * T, 'v');
  }

  // outer facades facing the streets
  const firstB = w.blds[0], lastB = w.blds[w.blds.length - 1];
  for (let n = 0; n < 4; n++) {
    addSign(w, firstB.x0 * T - 13, (G - 6 - n * irnd(8, 12)) * T, 'v');
    addSign(w, lastB.x1 * T + T, (G - 6 - n * irnd(8, 12)) * T, 'v');
  }
  for (const b of w.blds) for (let k = 0; k < b.nF; k++) {
    if (b === firstB && chance(0.35)) w.acs.push({ x: b.x0 - 1, y: b.fr[k] - 2, side: -1, deco: true });
    if (b === lastB && chance(0.35)) w.acs.push({ x: b.x1 + 1, y: b.fr[k] - 2, side: 1, deco: true });
  }

  // drain access ladders
  const shafts = [];
  for (const wl of w.wells) shafts.push(irnd(wl.x0, wl.x1));
  shafts.push(irnd(10, firstB.x0 - 4), irnd(lastB.x1 + 4, W - 11));
  for (const sx of shafts) {
    for (let y = G; y <= sw.y1; y++) { setT(sx, y, y === G ? LADF : LAD); if (y < sw.y0) setB(sx, y, B_SEWER); }
  }
  w.shafts = shafts;

  // rooftops
  for (const b of w.blds) {
    const r = b.roof;
    const free = (a, e) => { for (let x = a; x <= e; x++) if (x === b.sx || x <= b.x0 || x >= b.x1) return false; return true; };
    if (b.x1 - b.x0 >= 11 && chance(0.6)) {
      const swd = irnd(5, 7);
      for (let t = 0; t < 8; t++) {
        const s0 = irnd(b.x0 + 1, b.x1 - 1 - swd), s1 = s0 + swd;
        if (!free(s0, s1)) continue;
        for (let y = r - 5; y < r; y++) for (let x = s0; x <= s1; x++) setB(x, y, B_ROOM);
        for (let x = s0; x <= s1; x++) setT(x, r - 5, WALL);
        for (let y = r - 4; y < r; y++) { setT(s0, y, y >= r - 3 ? AIR : WALL); setT(s1, y, y >= r - 3 ? AIR : WALL); }
        const rm = newRoom({ x0: s0 + 1, x1: s1 - 1, y0: r - 4, y1: r - 1, k: b.nF, b: b.i, type: 'shack', shack: true });
        for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) w.room[I(x, y)] = rm.id;
        b.shack = rm;
        break;
      }
    }
    for (let n = irnd(1, 3); n--;) {
      const ax = irnd(b.x0 + 1, b.x1 - 1);
      if (getT(ax, r - 1) !== AIR || w.bg[I(ax, r - 1)] === B_ROOM) continue;
      w.antennas.push({ x: ax * T + irnd(1, 6), y: r * T, h: irnd(18, 46), arms: irnd(2, 5) });
    }
    if (chance(0.45)) {
      const tx = irnd(b.x0 + 1, b.x1 - 3);
      if (free(tx, tx + 2) && w.bg[I(tx, r - 1)] !== B_ROOM && w.bg[I(tx + 2, r - 1)] !== B_ROOM) w.tanks.push({ x: tx * T, y: r * T });
    }
    if (chance(0.6)) w.laundry.push({ x: (b.x0 + 1) * T + 2, y: r * T - 14, len: (b.x1 - b.x0 - 2) * T, side: 1, roof: true, seed: irnd(0, 9999) });
  }

  // assign room types
  const plain = w.rooms.filter((r) => r.type === null);
  for (const r of plain) r.type = wpick(r.k === 0 ? ROOM_KINDS_GROUND : ROOM_KINDS_UP);
  for (const r of w.rooms) if (r.type === 'shack') r.type = 'home';
  const ensure = (type, filter, n) => {
    const have = w.rooms.filter((r) => r.type === type).length;
    for (let i = have; i < n; i++) { const c = plain.filter((r) => r.type === 'home' && filter(r)); if (c.length) pick(c).type = type; }
  };
  ensure('clinic', (r) => r.k < 4, 1);
  ensure('tea', (r) => r.k === 0 || r.k > 5, 3);
  ensure('mahjong', () => true, 2);
  ensure('temple', () => true, 1);

  // your room: a small home mid-height near the middle
  const mid = W / 2;
  const yc = plain.filter((r) => r.type === 'home' && r.k >= 4 && r.k <= 6 && r.x1 - r.x0 >= 4 && r.x1 - r.x0 <= 6)
    .sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - mid) - Math.abs((b.x0 + b.x1) / 2 - mid));
  const yours = yc[0] || plain.find((r) => r.type === 'home');
  yours.type = 'yours';
  w.yours = yours;

  // lights
  for (const r of w.rooms) {
    const cx = (r.x0 + r.x1 + 1) * T / 2, cy = r.y0 * T + 1;
    let L = null;
    switch (r.type) {
      case 'home': case 'yours': L = chance(r.type === 'yours' ? 1 : 0.85) && { r: 36, c: [255, 190, 120], kind: 'bulb' }; break;
      case 'stair': L = chance(0.8) && { r: 26, c: [235, 200, 150], kind: 'bulb', flick: chance(0.35) ? rnd(0.2, 0.7) : 0 }; break;
      case 'mahjong': L = { r: 40, c: [185, 255, 205], kind: 'tube' }; break;
      case 'temple': L = { r: 30, c: [255, 95, 60], kind: 'candle' }; break;
      case 'empty': L = chance(0.1) && { r: 22, c: [200, 220, 255], kind: 'bulb', flick: 0.8 }; break;
      case 'tea': case 'noodle': case 'fishball': L = { r: 44, c: [255, 225, 175], kind: 'tube' }; break;
      default: L = { r: 46, c: [205, 240, 228], kind: 'tube', flick: chance(0.18) ? rnd(0.1, 0.5) : 0 };
    }
    if (L) w.lights.push(Object.assign({ x: cx, y: cy, room: r.id, b: r.b, on: true, flick: 0 }, L));
  }

  // props
  for (const r of w.rooms) layoutRoom(w, r);

  // street furniture
  const st = (x) => w.objs.push({ kind: 'lamp', x: x * T + 4, y: G * T });
  st(6); st(firstB.x0 - 6); st(lastB.x1 + 6); st(W - 7);
  w.lights.push({ x: 6 * T + 4, y: G * T - 26, r: 40, c: [255, 170, 90], kind: 'street', on: true });
  w.lights.push({ x: (firstB.x0 - 6) * T + 4, y: G * T - 26, r: 40, c: [255, 170, 90], kind: 'street', on: true });
  w.lights.push({ x: (lastB.x1 + 6) * T + 4, y: G * T - 26, r: 40, c: [255, 170, 90], kind: 'street', on: true });
  w.lights.push({ x: (W - 7) * T + 4, y: G * T - 26, r: 40, c: [255, 170, 90], kind: 'street', on: true, flick: 0.3 });
  w.objs.push({ kind: 'stall', x: (firstB.x0 - 11) * T, y: G * T });
  w.lights.push({ x: (firstB.x0 - 11) * T + 8, y: G * T - 20, r: 30, c: [255, 210, 140], kind: 'bulb', on: true });
  w.objs.push({ kind: 'stall', x: (lastB.x1 + 10) * T, y: G * T });
  w.lights.push({ x: (lastB.x1 + 10) * T + 8, y: G * T - 20, r: 30, c: [255, 210, 140], kind: 'bulb', on: true });
  const pw = w.wells[Math.floor(w.wells.length / 2)];
  const px = pw ? pw.x0 + 1 : firstB.x0 - 3;
  w.objs.push({ kind: 'standpipe', x: px * T + 2, y: G * T });
  w.lights.push({ x: px * T + 4, y: G * T - 22, r: 22, c: [180, 220, 255], kind: 'bulb', on: true, flick: 0.2 });
  for (const bl of w.blocks) {
    const fx = Math.floor((bl.x0 + bl.x1) / 2);
    w.objs.push({ kind: 'fuse', block: w.blocks.indexOf(bl), x: fx * T, y: (sw.y1 + 1) * T });
    w.lights.push({ x: fx * T + 4, y: (sw.y0) * T + 2, r: 38, c: [255, 120, 60], kind: 'bulb', on: true, flick: 0.4, sewer: true });
  }
  for (let sx = sw.x0 + 10; sx < sw.x1; sx += irnd(14, 24)) w.lights.push({ x: sx * T, y: sw.y0 * T + 1, r: 40, c: [150, 200, 160], kind: 'bulb', on: true, flick: chance(0.5) ? 0.5 : 0, sewer: true });

  // the pigeon coop on the highest roof
  const byH = w.blds.slice().sort((a, b) => a.roof - b.roof);
  const tall = byH.find((b) => !b.shack) || byH[0];
  const cxp = tall.sx > (tall.x0 + tall.x1) / 2 ? tall.x0 + 1 : tall.x1 - 6;
  w.coop = { x: cxp * T, y: tall.roof * T, b: tall.i };
  w.tanks = w.tanks.filter((t) => !(Math.abs(t.x - w.coop.x) < 56 && t.y === w.coop.y));
  w.antennas = w.antennas.filter((a) => !(a.x > w.coop.x - 4 && a.x < w.coop.x + 52 && a.y === w.coop.y));
  w.laundry = w.laundry.filter((l) => !(l.roof && l.y === w.coop.y - 14 && Math.abs(l.x - w.coop.x) < 80));
  w.lights.push({ x: w.coop.x + 20, y: w.coop.y - 14, r: 30, c: [255, 200, 120], kind: 'bulb', on: true });

  computeExposure(w);
  return w;
}

function addSign(w, x, y, dir) {
  const [word, meaning] = pick(SIGN_WORDS);
  const chars = [...word];
  const s = { x, y, chars, meaning, col: pick(NEON), dir, flick: chance(0.25) ? rnd(0.2, 0.8) : 0, w: 13, h: chars.length * 11 + 3 };
  if (s.y + s.h > w.G * T - 4) s.y = w.G * T - 4 - s.h;
  w.signs.push(s);
  w.lights.push({ x: x + 6, y: s.y + s.h / 2, r: 34, c: hexRgb(s.col), kind: 'neon', on: true, sign: s });
}

const PROPS = {
  home: [['bed', 18], ['table', 12], ['tv', 8], ['shelf', 9], ['stove', 8], ['bunk', 16], ['fridge', 7], ['chair', 5], ['cage', 6]],
  yours: [],
  tea: [['counter', 16], ['table', 12], ['chair', 5], ['table', 12], ['chair', 5]],
  noodle: [['rack', 14], ['rack', 14], ['sacks', 10], ['table', 12]],
  fishball: [['vat', 10], ['vat', 10], ['table', 12], ['sacks', 10]],
  grocer: [['shelf', 9], ['shelf', 9], ['counter', 16], ['sacks', 10]],
  barber: [['barberchair', 10], ['mirror', 8], ['chair', 5]],
  dentist: [['dentchair', 14], ['cabinet', 8], ['chair', 5]],
  clinic: [['cot', 16], ['cabinet', 8], ['desk', 12]],
  metal: [['bench', 14], ['lathe', 12], ['crates', 10]],
  sewing: [['sewing', 12], ['sewing', 12], ['bolts', 9]],
  mahjong: [['mahjong', 16], ['chair', 5]],
  temple: [['altar', 16], ['incense', 6]],
  school: [['blackboard', 16], ['desk', 12], ['desk', 12]],
  empty: [['rubble', 12], ['crates', 10], ['mattress', 14]],
  stair: [],
};

function layoutRoom(w, r) {
  const x0 = r.x0 * T + 1, x1 = (r.x1 + 1) * T - 1, fy = (r.y1 + 1) * T;
  const ladderAt = (a, b) => { for (let px = a; px < b; px += 2) { const t = w.tiles[w.I(Math.floor(px / T), r.y1)]; if (t === LAD) return true; } return false; };
  if (r.type === 'yours') {
    w.props.push({ t: 'bed', x: x0 + 1, y: fy, w: 18, room: r.id, quilt: '#a34a3d' });
    w.props.push({ t: 'radio', x: x0 + 21, y: fy, w: 7, room: r.id });
    w.props.push({ t: 'kettle', x: x1 - 8, y: fy, w: 6, room: r.id });
    w.props.push({ t: 'poster', x: x0 + 6, y: r.y0 * T + 6, room: r.id, wall: true });
    w.objs.push({ kind: 'bed', x: x0 + 10, y: fy, room: r.id });
    w.objs.push({ kind: 'radio', x: x0 + 24, y: fy, room: r.id });
    w.objs.push({ kind: 'kettle', x: x1 - 5, y: fy, room: r.id });
    return;
  }
  if (r.type === 'stair') {
    w.props.push({ t: 'label', x: x0 + 1, y: r.y0 * T + 3, room: r.id, wall: true });
    if (r.k === 0) w.props.push({ t: 'mailboxes', x: x0, y: r.y0 * T + 12, room: r.id, wall: true });
    return;
  }
  const list = (PROPS[r.type] || PROPS.home).slice();
  if (r.type === 'home') list.sort(() => R() - 0.5);
  let cx = x0 + irnd(0, 3);
  const isHome = r.type === 'home';
  if (isHome && chance(0.5)) w.props.push({ t: 'shrine', x: x0 + irnd(2, Math.max(2, x1 - x0 - 10)), y: r.y0 * T + 7, room: r.id, wall: true });
  if (chance(0.55)) w.props.push({ t: pick(['calendar', 'poster', 'clock', 'photo', 'poster']), x: x0 + irnd(3, Math.max(3, x1 - x0 - 8)), y: r.y0 * T + 5 + irnd(0, 3), room: r.id, wall: true });
  for (const [t, pw] of list) {
    if (cx + pw > x1) continue;
    if (ladderAt(cx, cx + pw)) { cx += 4; if (cx + pw > x1 || ladderAt(cx, cx + pw)) continue; }
    w.props.push({ t, x: cx, y: fy, w: pw, room: r.id, quilt: pick(['#a34a3d', '#3f6a8a', '#7a8a3d', '#8a5a8a', '#b07a3a']) });
    cx += pw + irnd(1, 3);
    if (isHome && R() < 0.35) break;
  }
}

function computeExposure(w) {
  const { W, H, tiles, bg, exp, roofline } = w;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const i = y * W + x, b = bg[i];
      let e = 0;
      if (b === B_SKY) e = 1;
      else if (b === B_WELL) e = clamp(1 - (y - roofline[x]) / 34, 0.07, 1);
      else if (b === B_ROOM) e = 0;
      exp[i] = e;
    }
  }
  // soften so light bleeds a little into rooms facing outside
  const tmp = new Float32Array(exp);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (bg[i] === B_ROOM) exp[i] = Math.max(tmp[i], 0.35 * Math.max(tmp[i - 1], tmp[i + 1]) * (tiles[i] === WALL ? 0.5 : 1));
  }
}
