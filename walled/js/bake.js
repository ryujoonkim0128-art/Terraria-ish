'use strict';
// Paints the static world into one big canvas, plus the distant skyline layers.

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

const WALLPAPER = {
  home: ['#7c9a86', '#9a7f7a', '#7f8fa0', '#a39a7c', '#8a9a6a', '#a08a5c', '#6f8a8a', '#94867a', '#8c7a90'],
  tea: ['#a8a084', '#b0a07a'], noodle: ['#9aa49a'], fishball: ['#8fa0a0'], grocer: ['#a39a7c'], barber: ['#8fa3b0'], dentist: ['#b0b8b0'],
  clinic: ['#b4bcb6'], metal: ['#6f6f6a'], sewing: ['#a08c94'], mahjong: ['#6f8f70'], temple: ['#8a4a3a'], school: ['#90a088'],
  empty: ['#5d5a55', '#58554e'], stair: ['#6d7a70', '#727468', '#6a7078'], yours: ['#9a8a6a'],
};
const FLOORS = ['#6b4e36', '#7a3b32', '#8c8478', '#5d6a5a', '#6e5a48'];

function bakeWorld(w) {
  const { W, H, G, tiles, bg, room } = w;
  const PW = W * T, PH = H * T;
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
  const ctx = cv.getContext('2d');
  R = mulberry32(w.seed ^ 0x5bd1e995);
  for (const r of w.rooms) {
    r.wall = hexRgb(pick(WALLPAPER[r.type] || WALLPAPER.home));
    r.floor = hexRgb(r.type === 'stair' ? '#6a675f' : r.type === 'temple' ? '#7a3b32' : pick(FLOORS));
  }
  const T_ = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? WALL : tiles[y * W + x]);
  const solid = (x, y) => { const t = T_(x, y); return t === WALL || t === GRND; };
  const img = ctx.createImageData(PW, PH), d = img.data;
  const sw = w.sewer;
  const out = [0, 0, 0, 0];

  function bgColor(tx, ty, px, py, lx, ly) {
    const i = ty * W + tx, b = bg[i];
    const n = hash2(px, py);
    if (b === B_SKY) { out[3] = 0; return; }
    out[3] = 255;
    if (b === B_ROOM) {
      const rid = room[i];
      if (rid < 0) { const v = 44 + n * 6; out[0] = v + 4; out[1] = v; out[2] = v - 4; return; }
      const r = w.rooms[rid];
      let [cr, cg, cb] = r.wall;
      const fromFloor = (r.y1 + 1) * T - py, fromCeil = py - r.y0 * T;
      let f = 1;
      if (fromFloor <= 7) { f = 0.8; if (px % 4 === 0 || fromFloor % 4 === 0) f = 0.7; }
      else if (fromFloor === 8) f = 0.62;
      if (fromCeil < 2) f *= 0.72;
      const st = vnoise(px / 10 + rid * 3.1, py / 7);
      if (st > 0.7) { f *= 0.86; cr *= 0.98; cb *= 0.9; }
      if (hash2(px >> 1, rid) < 0.05 && fromCeil < 6 + hash2(rid, px >> 1) * 14) f *= 0.82;
      if (r.type === 'empty' && vnoise(px / 5, py / 5 + rid) > 0.62) { cr = cg = cb = 88; }
      f *= 0.96 + n * 0.08;
      out[0] = cr * f; out[1] = cg * f; out[2] = cb * f;
      return;
    }
    if (b === B_WELL) {
      let v = 40 + n * 7;
      if (px % 16 === 0) v -= 8;
      if (py % 40 < 2) v += 6;
      if (hash2(px, 1234) < 0.025) { out[0] = 66; out[1] = 60; out[2] = 54; return; }
      const g = vnoise(px / 14, py / 20);
      v *= 0.85 + g * 0.3;
      out[0] = v - 1; out[1] = v + 1; out[2] = v + 5;
      return;
    }
    if (b === B_SEWER) {
      const row = Math.floor(py / 4), off = (row % 2) * 4;
      const mortar = py % 4 === 0 || (px + off) % 8 === 0;
      let v = mortar ? 30 : 50 + n * 10 + hash2((px + off) >> 3, row) * 10;
      const moss = py > (sw.y1) * T + 2 && hash2(px, py >> 1) < 0.5;
      out[0] = v; out[1] = v * (moss ? 1.15 : 0.96); out[2] = v * 0.86;
      return;
    }
    const v = 26 + n * 8; out[0] = v + 4; out[1] = v; out[2] = v - 3;
  }

  function wallColor(tx, ty, px, py, lx, ly) {
    const n = hash2(px, py);
    let v = 84 + n * 12;
    const g = vnoise(px / 13, py / 9);
    v *= 0.82 + g * 0.3;
    let r = v + 4, gg = v + 1, b = v - 4;
    const up = solid(tx, ty - 1), dn = solid(tx, ty + 1), lf = solid(tx - 1, ty), rt = solid(tx + 1, ty);
    const aboveRoom = !up && bg[(ty - 1) * W + tx] === B_ROOM && room[(ty - 1) * W + tx] >= 0;
    if (!up) {
      if (aboveRoom && ly < 2) { const rc = w.rooms[room[(ty - 1) * W + tx]].floor; const f = ly === 0 ? 1.1 : 0.85; out[0] = rc[0] * f; out[1] = rc[1] * f; out[2] = rc[2] * f; out[3] = 255; return; }
      if (ly === 0) { r += 22; gg += 20; b += 16; }
    }
    if (!dn && ly === 7) { r *= 0.55; gg *= 0.55; b *= 0.55; }
    if (!dn && ly === 6) { r *= 0.8; gg *= 0.8; b *= 0.8; }
    if (!lf && lx === 0) { r += 10; gg += 9; b += 8; }
    if (!rt && lx === 7) { r *= 0.7; gg *= 0.7; b *= 0.7; }
    if (hash2(px, 777) < 0.035 && hash2(px, py >> 3) < 0.6) { r += 12; gg -= 4; b -= 12; }
    if (hash2(px >> 2, py >> 2) < 0.015) { r *= 0.6; gg *= 0.6; b *= 0.6; }
    out[0] = r; out[1] = gg; out[2] = b; out[3] = 255;
  }

  function groundColor(tx, ty, px, py, lx, ly) {
    const n = hash2(px, py);
    out[3] = 255;
    const open = !solid(tx, ty - 1);
    if (ty === G && open) {
      if (ly < 2) { const v = 78 + n * 10; out[0] = v; out[1] = v; out[2] = v + 3; return; }
      const v = 42 + n * 12; out[0] = v; out[1] = v; out[2] = v + 4; return;
    }
    if (ty === sw.y1 + 1 && open) { const v = 38 + n * 10; out[0] = v; out[1] = v + 6; out[2] = v + 2; return; }
    const v = 28 + n * 9 + vnoise(px / 8, py / 8) * 8; out[0] = v + 4; out[1] = v; out[2] = v - 3;
  }

  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const t = tiles[ty * W + tx];
    for (let ly = 0; ly < T; ly++) for (let lx = 0; lx < T; lx++) {
      const px = tx * T + lx, py = ty * T + ly;
      if (t === WALL) wallColor(tx, ty, px, py, lx, ly);
      else if (t === GRND) groundColor(tx, ty, px, py, lx, ly);
      else {
        bgColor(tx, ty, px, py, lx, ly);
        if (t === LADF) { out[0] *= 0.45; out[1] *= 0.45; out[2] *= 0.45; out[3] = 255; if (ly === 0) { out[0] = out[1] = out[2] = 60; } }
        if (t === PLAT && ly < 3) { const n = hash2(px >> 2, ty); const v = ly === 2 ? 0.6 : 1; out[0] = (104 + n * 30) * v; out[1] = (76 + n * 20) * v; out[2] = (46 + n * 12) * v; out[3] = 255; }
        if (t === LAD || t === LADF) {
          if (lx === 1 || lx === 6) { out[0] = 128; out[1] = 112; out[2] = 78; out[3] = 255; if (lx === 6) { out[0] *= 0.7; out[1] *= 0.7; out[2] *= 0.7; } }
          else if (lx > 1 && lx < 6 && ly % 4 === 1) { out[0] = 112; out[1] = 96; out[2] = 66; out[3] = 255; }
        }
      }
      const o = (py * PW + px) * 4;
      d[o] = out[0]; d[o + 1] = out[1]; d[o + 2] = out[2]; d[o + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);

  const P = (x, y, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, ww, hh); };

  // facade windows in the wells: frames and dark glass; the glow is drawn live
  for (const wn of w.wins) { P(wn.x - 1, wn.y - 1, wn.w + 2, wn.h + 2, '#24252a'); P(wn.x, wn.y, wn.w, wn.h, '#14161c'); if (chance(0.5)) P(wn.x - 1, wn.y + wn.h + 1, wn.w + 2, 1, '#5a5650'); }

  // ceiling pipes, wires and light fixtures
  for (const r of w.rooms) {
    const x0 = r.x0 * T, x1 = (r.x1 + 1) * T, y0 = r.y0 * T;
    if (chance(0.5)) { const py = y0 + irnd(1, 3); P(x0, py, x1 - x0, 1, chance(0.5) ? '#6a5f52' : '#5b6165'); for (let x = x0 + 4; x < x1; x += irnd(8, 14)) P(x, py - 1, 1, 3, '#4a443e'); }
    if (chance(0.4)) { const py = y0 + 2; for (let x = x0; x < x1; x++) { const t = (x - x0) / (x1 - x0); P(x, py + Math.round(Math.sin(t * Math.PI) * 3), 1, 1, '#1e1c1a'); } }
  }
  for (const L of w.lights) {
    if (L.kind === 'bulb' && !L.sewer && L.room !== undefined) P(L.x, L.y - 1, 1, 3, '#2a2622');
    if (L.kind === 'tube') { P(L.x - 6, L.y, 13, 2, '#8a8c88'); }
  }

  // props
  for (const p of w.props) drawProp(ctx, P, p, w);

  // partition doorways get a frame
  for (let ty = 0; ty < G; ty++) for (let tx = 1; tx < W - 1; tx++) {
    const i = ty * W + tx;
    if (tiles[i] === AIR && bg[i] === B_ROOM && room[i] < 0 && solid(tx, ty - 1) && !solid(tx, ty + 1)) {
      // top of a doorway: lintel shadow
      P(tx * T, ty * T, T, 1, '#2a2622');
    }
  }

  // AC units
  for (const a of w.acs) {
    const x = a.x * T, y = a.y * T;
    P(x, y + 1, 16, 8, '#a8a89c'); P(x, y + 1, 16, 1, '#c8c8bc'); P(x + 1, y + 8, 14, 1, '#6a6a60');
    for (let i = 0; i < 5; i++) P(x + 3 + i * 2, y + 3, 1, 4, '#7a7a70');
    P(x + (a.side > 0 ? 12 : 2), y + 3, 2, 2, '#5a5a52');
    P(x + 7, y + 9, 1, irnd(4, 14), 'rgba(40,40,36,0.6)');
  }
  // bridge railings
  for (const wl of w.wells) for (const br of wl.bridges) {
    const x0 = wl.x0 * T, x1 = (wl.x1 + 1) * T, y = br.y * T;
    for (let x = x0 + 2; x < x1; x += 7) P(x, y - 6, 1, 6, '#5a4630');
    P(x0, y - 6, x1 - x0, 1, '#6a5238');
    P(x0, y + 3, x1 - x0, 1, '#2a2018');
  }
  // wires (static)
  for (const wr of w.wires) for (let x = wr.x0; x < wr.x1; x++) { const t = (x - wr.x0) / (wr.x1 - wr.x0); P(x, wr.y + Math.round(Math.sin(t * Math.PI) * wr.sag), 1, 1, wr.live ? '#2c2a24' : '#18181a'); }
  // laundry
  for (const l of w.laundry) {
    const r2 = mulberry32(l.seed);
    const dir = l.side;
    const x0 = l.x, x1 = l.x + l.len * dir;
    if (l.roof) { P(l.x - 1, l.y, 1, 14, '#5a4a38'); P(l.x + l.len, l.y, 1, 14, '#5a4a38'); }
    for (let i = 0; i < l.len; i++) P(x0 + i * dir, l.y, 1, 1, l.roof ? '#4a4a48' : '#8a7a50');
    for (let x = 2; x < l.len - 3; x += 4 + Math.floor(r2() * 4)) {
      const c = ['#d8d4c8', '#b83a3a', '#3a5a9a', '#d8c060', '#6a9a6a', '#c88aa8', '#e8e8e0', '#5a4a6a'][Math.floor(r2() * 8)];
      const ww = 3 + Math.floor(r2() * 3), hh = 4 + Math.floor(r2() * 6);
      const xx = dir > 0 ? x0 + x : x0 - x - ww;
      P(xx, l.y + 1, ww, hh, c); P(xx, l.y + hh, ww, 1, shade(c, 0.7));
      x += ww;
    }
  }
  // antennas, tanks, parapets
  for (const a of w.antennas) {
    P(a.x, a.y - a.h, 1, a.h, '#3a3a3c');
    for (let i = 0; i < a.arms; i++) { const yy = a.y - a.h + 3 + i * 4, ww = 9 - i; P(a.x - ww, yy, ww * 2 + 1, 1, '#454547'); }
  }
  for (const t of w.tanks) {
    P(t.x + 2, t.y - 6, 1, 6, '#3a3a3a'); P(t.x + 21, t.y - 6, 1, 6, '#3a3a3a');
    P(t.x, t.y - 24, 24, 18, '#5e6a6e'); P(t.x, t.y - 24, 24, 2, '#7e8a8e'); P(t.x + 2, t.y - 16, 20, 1, '#4a5458'); P(t.x + 18, t.y - 24, 6, 18, '#4e585c');
    P(t.x + 6, t.y - 8, 2, 2, '#7a4a30');
  }
  for (const b of w.blds) {
    const y = b.roof * T;
    for (let x = b.x0 * T; x <= b.x1 * T + 7; x += 6) P(x, y - 5, 1, 5, '#4a4844');
    P(b.x0 * T, y - 5, (b.x1 - b.x0 + 1) * T, 1, '#5a5650');
    // painted block letter on the facade near the roof
    text3(ctx, b.letter, b.x0 * T + 2 + (b.sx < (b.x0 + b.x1) / 2 ? (b.x1 - b.x0) * T - 8 : 0), y + 10, 'rgba(210,205,190,0.25)');
  }
  // pigeon coop
  {
    const c = w.coop, x = c.x, y = c.y;
    P(x, y - 22, 40, 22, '#3a2e22');
    for (let i = 0; i < 40; i += 2) for (let j = 0; j < 18; j += 2) if ((i + j) % 4 === 0) P(x + i, y - 20 + j, 1, 1, '#6a6050');
    P(x - 2, y - 24, 44, 3, '#5a4632'); P(x - 4, y - 26, 48, 2, '#6e5a40');
    for (let i = 0; i < 40; i += 8) P(x + i, y - 22, 1, 22, '#5a4632');
    P(x + 16, y - 12, 8, 12, '#1a140e');
    P(x + 44, y - 7, 7, 7, '#7a5a3a'); P(x + 44, y - 8, 7, 1, '#9a7a50');
    P(x + 54, y - 8, 5, 8, '#4a3a2a');
  }
  // street things
  for (const o of w.objs) {
    if (o.kind === 'lamp') { P(o.x, o.y - 26, 2, 26, '#2a2a2c'); P(o.x - 1, o.y - 27, 6, 2, '#3a3a3c'); }
    if (o.kind === 'stall') {
      const x = o.x, y = o.y;
      P(x, y - 10, 22, 8, '#6a4a2e'); P(x, y - 10, 22, 2, '#8a6a46'); P(x + 2, y - 3, 3, 3, '#1a1a1a'); P(x + 17, y - 3, 3, 3, '#1a1a1a');
      P(x + 1, y - 22, 1, 12, '#3a3a3a'); P(x + 20, y - 22, 1, 12, '#3a3a3a');
      for (let i = 0; i < 24; i += 4) P(x - 1 + i, y - 25, 4, 3, i % 8 ? '#e8e0d0' : '#b8302c');
      P(x + 4, y - 14, 6, 4, '#8a8a8a'); P(x + 12, y - 13, 5, 3, '#a0a0a0');
      text3(ctx, '$5', x + 6, y - 8, '#f0d890');
    }
    if (o.kind === 'standpipe') {
      const x = o.x, y = o.y;
      P(x, y - 14, 2, 14, '#5a6a72'); P(x, y - 14, 5, 2, '#5a6a72'); P(x + 4, y - 13, 1, 2, '#7a8a92');
      P(x + 7, y - 4, 4, 4, '#3a5a8a'); P(x - 4, y - 5, 3, 5, '#a04030');
    }
    if (o.kind === 'fuse') {
      const x = o.x, y = o.y - 20;
      P(x - 1, y - 1, 10, 12, '#2a2a28'); P(x, y, 8, 10, '#6a6e66'); P(x, y + 8, 8, 2, '#c8a020');
      for (let i = 0; i < 8; i += 2) P(x + i, y + 8, 1, 2, '#1a1a1a');
      P(x + 3, y + 2, 2, 3, '#3a3a3a'); P(x + 4, y + 10, 1, 10, '#222');
    }
  }
  // signs: board and unlit glyphs (lit layer is drawn live)
  for (const s of w.signs) {
    P(s.x, s.y, s.w, s.h, '#1c1820'); P(s.x, s.y, s.w, 1, '#2c2830');
    P(s.x + (s.x < 0 ? 0 : -3), s.y + 2, 3, 1, '#3a3a3a');
    s.glyphs = s.chars.map((ch) => Glyph.get(ch, 9));
    s.glyphs.forEach((g, gi) => { for (let j = 0; j < 81; j++) if (g[j]) P(s.x + 2 + (j % 9), s.y + 2 + gi * 11 + ((j / 9) | 0), 1, 1, shade(s.col, 0.28)); });
  }
  // drain: water channel is animated; pipes dripping into it
  for (let x = sw.x0 * T; x < (sw.x1 + 1) * T; x += irnd(30, 60)) { P(x, sw.y0 * T + 4, 5, 5, '#2a2a28'); P(x + 1, sw.y0 * T + 5, 3, 3, '#0e0e0c'); }

  return cv;
}

function drawProp(ctx, P, p, w) {
  const x = p.x, y = p.y, q = p.quilt || '#a34a3d';
  switch (p.t) {
    case 'bed': P(x, y - 6, p.w, 2, '#d8d0c0'); P(x + 5, y - 6, p.w - 5, 3, q); P(x + 5, y - 6, p.w - 5, 1, shade(q, 1.2)); P(x + 1, y - 7, 4, 2, '#eee8dc'); P(x, y - 4, p.w, 2, '#5a3e28'); P(x, y - 2, 1, 2, '#3a2818'); P(x + p.w - 1, y - 2, 1, 2, '#3a2818'); P(x, y - 10, 1, 8, '#5a3e28'); break;
    case 'bunk': for (const yy of [y - 4, y - 13]) { P(x, yy - 2, p.w, 2, '#d8d0c0'); P(x + 4, yy - 2, p.w - 4, 2, q); P(x, yy, p.w, 1, '#4a3a2a'); } P(x, y - 18, 1, 18, '#3a3a3a'); P(x + p.w - 1, y - 18, 1, 18, '#3a3a3a'); P(x + p.w - 3, y - 18, 1, 14, '#5a5a5a'); break;
    case 'table': P(x, y - 7, p.w, 2, '#8a6040'); P(x + 1, y - 5, 1, 5, '#5a3e28'); P(x + p.w - 2, y - 5, 1, 5, '#5a3e28'); if (R() < 0.7) { P(x + 3, y - 9, 3, 2, '#e8e4dc'); P(x + 8, y - 11, 2, 4, pick(['#c83a3a', '#3a8a5a', '#d8d0b0'])); } break;
    case 'chair': P(x, y - 4, 4, 1, '#7a5030'); P(x, y - 9, 1, 9, '#5a3a22'); P(x + 3, y - 3, 1, 3, '#5a3a22'); break;
    case 'tv': P(x, y - 5, 8, 5, '#4a3424'); P(x + 1, y - 11, 7, 6, '#3a3a40'); P(x + 2, y - 10, 5, 4, '#1c2428'); P(x + 3, y - 13, 1, 2, '#555'); P(x + 6, y - 14, 1, 3, '#555'); break;
    case 'shelf': P(x, y - 18, p.w, 18, '#4a3a2a'); for (let s = 0; s < 3; s++) { P(x + 1, y - 17 + s * 6, p.w - 2, 5, '#2e241a'); for (let i = 0; i < p.w - 3; i += 2) if (R() < 0.7) P(x + 1 + i, y - 16 + s * 6 + (R() < 0.5 ? 1 : 0), 2, 4 - (R() < 0.5 ? 1 : 0), pick(['#c8b080', '#a03a2a', '#e0d8c0', '#4a7a9a', '#8a9a4a', '#d0a040'])); } break;
    case 'stove': P(x, y - 6, p.w, 6, '#6a6a6a'); P(x, y - 6, p.w, 1, '#8a8a8a'); P(x + 1, y - 9, 6, 3, '#2a2a2a'); P(x + p.w - 2, y - 4, 2, 4, '#b03030'); break;
    case 'fridge': P(x, y - 15, p.w, 15, '#c8ccc4'); P(x, y - 15, p.w, 1, '#e0e4dc'); P(x, y - 9, p.w, 1, '#8a8e86'); P(x + p.w - 2, y - 13, 1, 3, '#6a6e66'); break;
    case 'cage': P(x + 2, y - 26, 1, 4, '#3a3a3a'); P(x, y - 22, 6, 7, '#5a4a2a'); P(x + 1, y - 21, 4, 5, '#2a2218'); P(x + 2, y - 19, 2, 2, '#e8d040'); break;
    case 'counter': P(x, y - 9, p.w, 9, '#6a4a32'); P(x, y - 10, p.w, 2, '#a08060'); P(x + 2, y - 14, 3, 4, '#d8d0c0'); P(x + 8, y - 13, 4, 3, '#b83a2a'); P(x + 13, y - 15, 2, 5, '#3a6a4a'); break;
    case 'rack': P(x, y - 22, 1, 22, '#5a4a3a'); P(x + p.w - 1, y - 22, 1, 22, '#5a4a3a'); for (const yy of [y - 22, y - 14]) { P(x, yy, p.w, 1, '#6a5a4a'); for (let i = 1; i < p.w - 1; i++) if (i % 2 === 0) P(x + i, yy + 1, 1, 5 + (i % 3), '#e8dcb0'); } break;
    case 'sacks': P(x, y - 6, 6, 6, '#b09a70'); P(x + 4, y - 8, 6, 8, '#c4ad80'); P(x + 2, y - 11, 5, 4, '#a89268'); P(x + 5, y - 6, 1, 3, '#8a7650'); break;
    case 'vat': P(x, y - 9, p.w, 9, '#7a7e82'); P(x, y - 9, p.w, 1, '#a8acb0'); P(x + 1, y - 8, p.w - 2, 1, '#e8e0c8'); P(x - 1, y - 6, 1, 2, '#5a5e62'); P(x + p.w, y - 6, 1, 2, '#5a5e62'); P(x + 2, y - 1, p.w - 4, 1, '#c84020'); break;
    case 'barberchair': P(x + 2, y - 2, 6, 2, '#4a4a4a'); P(x + 4, y - 5, 2, 3, '#7a7a7a'); P(x + 1, y - 8, 8, 3, '#a02828'); P(x + 1, y - 14, 2, 6, '#a02828'); break;
    case 'mirror': P(x, y - 22, 7, 9, '#5a4a3a'); P(x + 1, y - 21, 5, 7, '#a8c0c8'); P(x + 2, y - 20, 1, 3, '#d8e8f0'); break;
    case 'dentchair': P(x + 3, y - 3, 4, 3, '#6a6a6a'); P(x, y - 7, 12, 3, '#d8d0b8'); P(x + 10, y - 11, 3, 5, '#d8d0b8'); P(x + 1, y - 22, 1, 12, '#888'); P(x + 1, y - 22, 6, 1, '#888'); P(x + 6, y - 22, 3, 2, '#e8e8e8'); break;
    case 'cabinet': P(x, y - 13, p.w, 13, '#d8dcd4'); P(x + 1, y - 12, p.w - 2, 5, '#a8c0c8'); P(x, y - 6, p.w, 1, '#9a9e96'); P(x + 2, y - 11, 1, 3, '#c83030'); P(x + 4, y - 10, 1, 2, '#3a8a5a'); break;
    case 'cot': P(x, y - 6, p.w, 3, '#e8e8e4'); P(x, y - 3, p.w, 1, '#8a8e8a'); P(x, y - 3, 1, 3, '#6a6e6a'); P(x + p.w - 1, y - 3, 1, 3, '#6a6e6a'); P(x + 1, y - 7, 4, 1, '#ffffff'); break;
    case 'desk': P(x, y - 7, p.w, 2, '#6a5a40'); P(x + 1, y - 5, 1, 5, '#4a3a28'); P(x + p.w - 2, y - 5, 1, 5, '#4a3a28'); P(x + 3, y - 9, 5, 2, '#e8e4d0'); break;
    case 'bench': P(x, y - 8, p.w, 2, '#5a4a3a'); P(x + 1, y - 6, 2, 6, '#3a2e22'); P(x + p.w - 3, y - 6, 2, 6, '#3a2e22'); P(x + 3, y - 10, 4, 2, '#8a8a8a'); P(x + 9, y - 11, 1, 3, '#aa4a2a'); break;
    case 'lathe': P(x, y - 10, p.w, 10, '#4a5a5a'); P(x, y - 10, p.w, 1, '#6a7a7a'); P(x + 2, y - 14, 4, 4, '#5a6a6a'); P(x + 7, y - 13, 4, 1, '#9aa'); break;
    case 'crates': P(x, y - 7, 7, 7, '#7a5a38'); P(x + 1, y - 6, 5, 5, '#6a4a2a'); P(x + 3, y - 13, 7, 6, '#8a6a42'); P(x + 4, y - 12, 5, 4, '#7a5a38'); break;
    case 'sewing': P(x, y - 7, p.w, 2, '#5a4a3a'); P(x + 1, y - 5, 1, 5, '#2a2a2a'); P(x + p.w - 2, y - 5, 1, 5, '#2a2a2a'); P(x + 3, y - 11, 6, 4, '#1a1a1a'); P(x + 3, y - 12, 2, 1, '#1a1a1a'); P(x + 7, y - 9, 2, 2, '#c8a040'); break;
    case 'bolts': for (let i = 0; i < 4; i++) P(x + i * 2, y - 12 + (i % 2) * 2, 2, 12 - (i % 2) * 2, pick(['#c84a5a', '#4a6aa8', '#e8d8a0', '#5a8a5a', '#a87ab0'])); break;
    case 'mahjong': P(x - 3, y - 4, 3, 4, '#5a3a22'); P(x + p.w, y - 4, 3, 4, '#5a3a22'); P(x, y - 7, p.w, 2, '#2a6a3a'); P(x + 1, y - 5, 1, 5, '#3a2a1a'); P(x + p.w - 2, y - 5, 1, 5, '#3a2a1a'); for (let i = 1; i < p.w - 1; i += 2) P(x + i, y - 8, 1, 1, '#f0ece0'); break;
    case 'altar': P(x, y - 8, p.w, 8, '#8a2a1e'); P(x, y - 9, p.w, 1, '#c8a040'); P(x + 6, y - 15, 4, 6, '#c8a040'); P(x + 7, y - 17, 2, 2, '#d8b850'); P(x + 2, y - 11, 3, 2, '#e8a030'); P(x + 11, y - 11, 3, 2, '#d84030'); break;
    case 'incense': P(x, y - 5, 6, 5, '#6a4a2a'); for (let i = 1; i < 6; i += 2) P(x + i, y - 11, 1, 6, '#a07050'); break;
    case 'blackboard': P(x, y - 24, p.w, 10, '#2a3a2e'); P(x - 1, y - 25, p.w + 2, 1, '#6a5038'); P(x + 2, y - 21, 6, 1, '#c8c8c0'); P(x + 2, y - 18, 9, 1, '#c8c8c0'); break;
    case 'rubble': P(x, y - 3, 5, 3, '#6a6660'); P(x + 4, y - 5, 4, 5, '#5a5650'); P(x + 8, y - 2, 4, 2, '#7a766e'); P(x + 2, y - 4, 1, 1, '#8a7a5a'); break;
    case 'mattress': P(x, y - 2, p.w, 2, '#8a8270'); P(x + 1, y - 3, 4, 1, '#9a9280'); break;
    case 'radio': P(x, y - 6, 7, 6, '#7a4a2a'); P(x + 1, y - 5, 3, 3, '#3a2a1a'); P(x + 5, y - 5, 1, 1, '#d8c070'); P(x + 6, y - 10, 1, 4, '#888'); break;
    case 'kettle': P(x, y - 6, 6, 6, '#6a6a6a'); P(x + 1, y - 10, 4, 4, '#b8b8b0'); P(x + 5, y - 9, 1, 1, '#b8b8b0'); break;
    case 'shrine': P(x, y, 7, 6, '#9a2a1e'); P(x, y - 1, 7, 1, '#c8a040'); P(x + 2, y + 1, 3, 3, '#3a1a10'); P(x + 1, y + 6, 5, 1, '#5a1a10'); break;
    case 'calendar': P(x, y, 5, 7, '#e8e4d8'); P(x, y, 5, 2, '#c83030'); P(x + 1, y + 3, 3, 1, '#888'); P(x + 1, y + 5, 3, 1, '#888'); break;
    case 'poster': { const c = pick(['#c84a3a', '#3a6aa8', '#d8b040', '#5a8a5a', '#a85a9a']); P(x, y, 7, 9, '#d8d0c0'); P(x + 1, y + 1, 5, 5, c); P(x + 1, y + 7, 5, 1, '#666'); break; }
    case 'clock': P(x + 1, y, 4, 5, '#e8e4d8'); P(x, y + 1, 6, 3, '#e8e4d8'); P(x + 3, y + 1, 1, 2, '#222'); P(x + 3, y + 2, 2, 1, '#222'); break;
    case 'photo': P(x, y, 6, 5, '#4a3a2a'); P(x + 1, y + 1, 4, 3, '#8a8478'); P(x + 2, y + 1, 1, 2, '#3a3028'); break;
    case 'label': {
      const r = w.rooms[p.room], b = w.blds[r.b];
      const fl = r.k === 0 ? 'G' : String(r.k);
      text3(ctx, b.letter, x, y, 'rgba(225,220,200,0.55)');
      text3(ctx, fl, x, y + 7, 'rgba(225,220,200,0.55)');
      for (let i = 0; i < 3; i++) if (R() < 0.6) P(x + 4 + irnd(0, 8), y + 14 + irnd(0, 8), irnd(2, 6), 1, pick(['rgba(200,60,50,0.5)', 'rgba(30,30,30,0.5)', 'rgba(60,90,160,0.4)']));
      break;
    }
    case 'mailboxes': for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { P(x + 9 + j * 4, y + i * 4, 3, 3, '#6a6e58'); P(x + 10 + j * 4, y + 1 + i * 4, 1, 1, '#2a2a22'); } break;
  }
}

// Distant layers behind the city.
function bakeSkyline(seed) {
  R = mulberry32(seed ^ 0x2545f491);
  const far = document.createElement('canvas'); far.width = 640; far.height = 120;
  const fx = far.getContext('2d');
  fx.fillStyle = '#fff';
  for (let x = 0; x < 640; x++) {
    let h = 40 + vnoise(x / 70, 3) * 40 + vnoise(x / 23, 9) * 10;
    // Lion Rock-ish crag
    const lr = x - 380; if (lr > -60 && lr < 80) h += Math.max(0, 34 - Math.abs(lr - 10) * 0.55) + (lr > -10 && lr < 30 ? 14 - Math.abs(lr - 10) * 0.6 : 0);
    fx.fillRect(x, 120 - h, 1, h);
  }
  const mid = document.createElement('canvas'); mid.width = 900; mid.height = 150;
  const mx = mid.getContext('2d');
  const midL = document.createElement('canvas'); midL.width = 900; midL.height = 150;
  const ml = midL.getContext('2d');
  const tops = [];
  for (let x = 0; x < 900;) {
    const ww = irnd(8, 26), hh = irnd(14, chance(0.15) ? 130 : 70);
    mx.fillStyle = '#fff'; mx.fillRect(x, 150 - hh, ww, hh);
    for (let yy = 150 - hh + 3; yy < 148; yy += 3) for (let xx = x + 2; xx < x + ww - 1; xx += 3) {
      if (R() < 0.33) { ml.fillStyle = pick(['#ffd28a', '#ffe6b8', '#bfe6ff', '#ffc070']); ml.fillRect(xx, yy, 1, 1); }
    }
    if (hh > 70) tops.push({ x: x + (ww >> 1), y: 150 - hh - 1 });
    x += ww + irnd(0, 3);
  }
  return { far, mid, midL, tops };
}

function bakePlane() {
  const c = document.createElement('canvas'); c.width = 300; c.height = 80;
  const x = c.getContext('2d');
  const P = (a, b, ww, hh, col) => { x.fillStyle = col; x.fillRect(a, b, ww, hh); };
  const body = '#3a3d48', belly = '#2a2c34', top = '#4c505c';
  // fuselage
  for (let i = 0; i < 260; i++) {
    const t = i / 260;
    let h = 18;
    if (t < 0.08) h = 8 + t / 0.08 * 10;
    if (t > 0.82) h = 18 - (t - 0.82) / 0.18 * 10;
    let yo = 40 - h / 2 + (t > 0.82 ? (t - 0.82) * 30 : 0);
    if (i > 190 && i < 228) { /* hump */ }
    P(20 + i, yo, 1, h, body); P(20 + i, yo, 1, 2, top); P(20 + i, yo + h - 3, 1, 3, belly);
  }
  // nose cone towards +x (flies right)
  // tail fin
  for (let i = 0; i < 40; i++) P(22 + i * 0.6, 8 + i * 0.6, 26 - i * 0.4, 1, body);
  P(20, 8, 16, 3, top);
  // wing (side view: a thin slab) and engines
  P(110, 46, 90, 3, '#30333c'); P(120, 49, 70, 2, '#24262e');
  for (const ex of [128, 168]) { P(ex, 50, 20, 7, '#2c2e36'); P(ex + 18, 51, 3, 5, '#16171c'); P(ex, 50, 20, 1, '#4a4e58'); }
  // gear
  P(150, 50, 2, 10, '#222'); P(147, 59, 8, 4, '#111'); P(250, 48, 2, 10, '#222'); P(248, 57, 6, 4, '#111');
  // cabin windows row
  for (let i = 60; i < 262; i += 4) P(i, 36, 2, 2, '#16181e');
  // cockpit
  P(266, 34, 6, 2, '#16181e');
  return c;
}
