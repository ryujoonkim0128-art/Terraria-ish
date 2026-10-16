// The world: layout, cached backdrop/ground, plants, characters, weather, lighting and effects.
import { canvas, painter, addOutline, flipX, mix, darken, lighten, hash, rng, clamp, lerp, ease, rgb, hex, ditherRect, glow, softGlow, INK, fmt, BAYER } from './util.js';
import { text, textWidth, TINY } from './font.js';
import * as A from './art.js';
import { CROP, COLS, ROWS, TILE, SPRINKLERS, NIGHT_START, NIGHT_END, PETS } from './data.js';
import { G, on, ripeCount, sprinklerAt, expandPrice } from './state.js';
import { dayFrac, bloodMoon, isNight } from './sim.js';
import { sfx, setNight } from './audio.js';

export const L = {};
export const W8 = { t: 0 }; // world animation state
const parts = [], floats = [], flies = [], drops = [], flakes = [];
const hop = new Map(); // plot index -> hop timer
let bolt = null, flash = 0;
export const env = { wet: 0, snow: 0, rain: 0, storm: 0, snowfall: 0, wind: 1, night: 0 };

// ---------------------------------------------------------------- layout
export function layout(W, H, insetT, insetB) {
  Object.assign(L, { W, H, insetT, insetB });
  L.hudY = insetT + 3;
  const hudH = 15;
  L.barH = 54 + insetB;
  L.barY = H - L.barH;
  const need = 68 + ROWS * TILE + 10;
  const free = L.barY - (L.hudY + hudH + 4) - need;
  const skyExtra = clamp(Math.floor(free * 0.55), -40, 90);
  L.townY = L.hudY + hudH + 4 + skyExtra;
  L.pathY = L.townY + 30;
  L.gx = Math.floor((W - COLS * TILE) / 2);
  L.gy = L.townY + 68;
  L.gw = COLS * TILE; L.gh = ROWS * TILE;
  L.gBottom = L.gy + L.gh;
  L.stalls = {};
  ['seeds', 'sell', 'gear', 'eggs'].forEach((k, i) => {
    const slot = W / 4;
    L.stalls[k] = { x: Math.round(slot * i + (slot - A.STALL_W) / 2), y: L.townY, w: A.STALL_W, h: A.STALL_H };
  });
  const es = L.stalls.eggs;
  L.nest = { x: es.x + 4, y: L.townY + 58 };
  // UI anchors
  L.hotY = L.barY + 6;
  L.btnY = L.barY + 32;
  L.bagBtn = { x: 4, y: L.btnY, w: 66, h: 18 };
  L.harvestBtn = { x: 74, y: L.btnY, w: W - 78, h: 18 };
  L.moneyPos = { x: 10, y: L.hudY + 6 };
  buildBackdrop();
  buildGround();
  if (!W8.farmer) initActors();
  else clampActors();
}
export function tileRect(i) {
  const c = i % COLS, r = Math.floor(i / COLS);
  return { x: L.gx + c * TILE, y: L.gy + r * TILE, w: TILE, h: TILE };
}
export function tileAt(x, y) {
  if (x < L.gx || y < L.gy || x >= L.gx + L.gw || y >= L.gy + L.gh) return -1;
  return Math.floor((y - L.gy) / TILE) * COLS + Math.floor((x - L.gx) / TILE);
}
export const anchorOf = (i) => { const r = tileRect(i); return { x: r.x + 12, y: r.y + 19 }; };
export function stallAt(x, y) {
  for (const k in L.stalls) {
    const s = L.stalls[k];
    if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h + 4) return k;
  }
  return null;
}

// ---------------------------------------------------------------- cached layers
let backdrop = null, ground = null, fenceFront = null, snowCover = null, soilVar = null, groundKey = '';
function buildBackdrop() {
  const { W } = L, base = L.pathY;
  backdrop = canvas(W, base + 4);
  const P = painter(backdrop), g = backdrop.g;
  // far hills
  for (let x = 0; x < W; x++) {
    const h1 = 22 + Math.sin(x * 0.035 + 1) * 6 + Math.sin(x * 0.09) * 3;
    P.rect(x, base - h1, 1, h1 + 4, '#8cc4a4');
    P.dot(x, base - h1, '#b4dcc0');
    const h2 = 13 + Math.sin(x * 0.05 + 3) * 5 + Math.sin(x * 0.13 + 1) * 2;
    P.rect(x, base - h2, 1, h2 + 4, '#5fa476');
    if (hash(x, 1) < 0.5) P.dot(x, base - h2, '#7cbc88');
  }
  // far trees
  const R = rng(91);
  for (let x = -6; x < W + 6; x += 9 + Math.floor(R() * 8)) {
    const t = A.treeSprite(x & 3);
    g.drawImage(t, x - 13, base - 34 - Math.floor(R() * 4));
  }
  // hedge
  for (let x = -4; x < W + 4; x += 10) g.drawImage(A.bush((x * 7) & 15, 6), x - 6, base - 10 + (hash(x, 3) < 0.5 ? 1 : 0));
}

function soilTile(wet, v) {
  const c = canvas(TILE, TILE), P = painter(c), s = wet ? PAL_WET : PAL_SOIL, R = rng(v * 13 + (wet ? 7 : 1));
  P.rect(1, 1, 22, 22, s[2]);
  P.rect(2, 1, 20, 1, s[3]); P.rect(1, 2, 1, 19, s[3]);
  P.rect(2, 22, 20, 1, s[1]); P.rect(22, 2, 1, 20, s[1]);
  for (const fy of [6, 11, 16]) {
    P.rect(3, fy, 18, 1, s[1]);
    P.rect(3, fy + 1, 18, 1, s[3]);
    P.dot(3, fy + 1, s[2]); P.dot(20, fy + 1, s[2]);
  }
  for (let k = 0; k < 9; k++) P.dot(2 + Math.floor(R() * 20), 2 + Math.floor(R() * 20), [s[1], s[3], s[4]][k % 3]);
  if (!wet && R() < 0.8) { const x = 3 + Math.floor(R() * 17), y = 3 + Math.floor(R() * 17); P.rect(x, y, 2, 1, A.PAL.stone[2]); P.dot(x, y + 1, A.PAL.stone[0]); P.dot(x + 1, y + 1, A.PAL.stone[1]); }
  if (wet) for (let k = 0; k < 3; k++) { const x = 3 + Math.floor(R() * 16), y = 3 + Math.floor(R() * 17); P.rect(x, y, 3, 1, '#6a5a6a'); P.dot(x + 1, y, '#8a8aa8'); }
  return c;
}
const PAL_SOIL = A.PAL.soil, PAL_WET = A.PAL.wet;

function grassAt(P, x, y) {
  const h = hash(x, y, 5);
  P.dot(x, y, h < 0.07 ? A.PAL.grass[1] : h < 0.13 ? A.PAL.grass[3] : A.PAL.grass[2]);
}
function tuft(P, x, y, R) {
  P.dot(x, y, A.PAL.grass[4]); P.dot(x - 1, y - 1, A.PAL.grass[4]); P.dot(x + 1, y - 1, A.PAL.grass[3]); P.dot(x, y + 1, A.PAL.grass[1]);
}
function flower(P, x, y, col) {
  P.dot(x, y - 1, col); P.dot(x - 1, y, col); P.dot(x + 1, y, col); P.dot(x, y + 1, col); P.dot(x, y, '#ffd23f'); P.dot(x, y + 2, A.PAL.grass[1]);
}
function fenceH(x0, x1, h) {
  const w = x1 - x0, c = canvas(w, h), P = painter(c), wd = A.PAL.wood;
  P.rect(0, 2, w, 2, wd[2]); P.rect(0, 2, w, 1, wd[3]);
  P.rect(0, h - 3, w, 2, wd[2]); P.rect(0, h - 3, w, 1, wd[3]);
  for (let x = 0; x < w - 1; x += 4) {
    P.rect(x, 1, 3, h - 1, wd[4]); P.dot(x + 1, 0, wd[4]);
    P.rect(x, 1, 1, h - 1, wd[5]); P.rect(x + 2, 1, 1, h - 1, wd[3]); P.dot(x + 1, h - 1, wd[3]);
  }
  return addOutline(c);
}
function fenceV(h) {
  const c = canvas(4, h), P = painter(c), wd = A.PAL.wood;
  P.rect(1, 0, 2, h, wd[3]); P.rect(1, 0, 1, h, wd[4]);
  for (let y = 0; y < h - 4; y += 12) { P.rect(0, y, 4, 5, wd[4]); P.rect(0, y, 4, 1, wd[5]); P.rect(3, y + 1, 1, 4, wd[2]); }
  return addOutline(c);
}

function buildGround() {
  const { W, H } = L;
  groundKey = `${W}|${H}|${G.rows}|${L.gy}`;
  ground = canvas(W, H);
  const P = painter(ground), g = ground.g;
  const top = L.pathY, fenceTop = L.gy - 7;
  // grass
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) grassAt(P, x, y);
  const R = rng(7);
  for (let k = 0; k < (W * (H - top)) / 90; k++) {
    const x = Math.floor(R() * W), y = top + Math.floor(R() * (H - top));
    if (R() < 0.12) flower(P, x, y, ['#fff6e8', '#ff9ac0', '#ffd23f', '#a8c8ff'][Math.floor(R() * 4)]);
    else tuft(P, x, y, R);
  }
  // path
  const pathBot = L.townY + 62;
  for (let y = top; y < pathBot; y++) for (let x = 0; x < W; x++) {
    const h = hash(x, y, 9), edge = y >= pathBot - 2 + (hash(x, 1, 2) < 0.5 ? 1 : 0);
    if (edge) continue;
    P.dot(x, y, h < 0.06 ? A.PAL.path[1] : h < 0.11 ? A.PAL.path[3] : A.PAL.path[2]);
  }
  for (let y = top + 3; y < pathBot - 3; y += 5) for (let x = (y * 3) % 7; x < W; x += 6 + Math.floor(hash(x, y) * 5)) {
    P.rect(x, y, 3, 2, A.PAL.path[3]); P.dot(x, y, A.PAL.path[4]); P.rect(x, y + 2, 3, 1, A.PAL.path[1]);
  }
  P.rect(0, top, W, 1, A.PAL.path[1]);
  // stall shadows on the path
  for (const k in L.stalls) { const s = L.stalls[k]; ditherRect(g, s.x + 2, s.y + 56, s.w - 2, 3, '#7a5a40', 10); }
  // garden soil base and beds
  P.rect(L.gx - 2, L.gy - 1, L.gw + 4, L.gh + 3, A.PAL.soil[0]);
  soilVar = [0, 1, 2].map((v) => [soilTile(false, v), soilTile(true, v)]);
  for (let i = 0; i < COLS * ROWS; i++) {
    const r = tileRect(i), row = Math.floor(i / COLS);
    if (row < G.rows) g.drawImage(soilVar[i % 3][0], r.x, r.y);
    else {
      for (let y = r.y; y < r.y + TILE; y++) for (let x = r.x - (i % COLS === 0 ? 2 : 0); x < r.x + TILE + (i % COLS === COLS - 1 ? 2 : 0); x++) grassAt(P, x, y);
      const Rr = rng(i * 31);
      for (let k = 0; k < 4; k++) {
        const x = r.x + 3 + Math.floor(Rr() * 18), y = r.y + 6 + Math.floor(Rr() * 15);
        P.line(x, y, x - 1, y - 4, A.PAL.grass[3]); P.line(x + 1, y, x + 2, y - 5, A.PAL.grass[4]); P.dot(x, y, A.PAL.grass[1]);
      }
      if (Rr() < 0.4) flower(P, r.x + 4 + Math.floor(Rr() * 16), r.y + 5 + Math.floor(Rr() * 14), Rr() < 0.5 ? '#fff6e8' : '#ffd23f');
    }
  }
  // locked area shading + sign
  if (G.rows < ROWS) {
    const ly = L.gy + G.rows * TILE;
    ditherRect(g, L.gx - 2, ly, L.gw + 4, 2, '#1f4d3a', 8);
    const price = expandPrice();
    const label = '$' + fmt(price), tw = Math.max(textWidth(label), textWidth('EXPAND', TINY)) + 10;
    const sx = Math.round(L.W / 2 - tw / 2), sy = ly + 4;
    const b = canvas(tw, 22), B = painter(b), wd = A.PAL.wood;
    B.rect(Math.floor(tw / 2) - 1, 15, 3, 7, wd[2]); B.rect(Math.floor(tw / 2) - 1, 15, 1, 7, wd[3]);
    B.rect(0, 0, tw, 16, wd[3]); B.rect(0, 0, tw, 1, wd[5]); B.rect(0, 15, tw, 1, wd[1]); B.rect(1, 1, tw - 2, 14, wd[4]);
    text(b.g, 'EXPAND', tw / 2, 2, wd[1], { align: 'center', font: TINY });
    text(b.g, label, tw / 2, 8, '#3a2421', { align: 'center' });
    addOutline(b);
    g.drawImage(b, sx, sy);
    L.expandSign = { x: sx, y: sy, w: tw, h: 22 };
  } else L.expandSign = null;
  // fences
  g.drawImage(fenceH(L.gx - 6, L.gx + L.gw + 6, 8), L.gx - 7, fenceTop);
  const fv = fenceV(L.gh + 6);
  g.drawImage(fv, L.gx - 8, L.gy - 3); g.drawImage(fv, L.gx + L.gw + 2, L.gy - 3);
  fenceFront = fenceH(L.gx - 6, L.gx + L.gw + 6, 9);
  // decorations around the garden
  const D = rng(3);
  const below = L.gBottom + 12;
  for (let x = 4; x < W - 10; x += 14 + Math.floor(D() * 18)) {
    if (below + 8 < L.barY) g.drawImage(D() < 0.5 ? A.bush(Math.floor(D() * 9), 4) : A.flowerPot(Math.floor(D() * 4)), x, below + Math.floor(D() * Math.max(1, L.barY - below - 14)));
  }
  if (L.gx > 14) for (let y = L.gy + 10; y < L.gBottom - 10; y += 26) { g.drawImage(A.flowerPot(y), 2, y); g.drawImage(A.flowerPot(y + 1), W - 11, y + 12); }
  // snow cover overlay (dithered white over the ground)
  snowCover = canvas(W, H);
  const sc = snowCover.g;
  for (let y = top; y < H; y++) for (let x = 0; x < W; x++) if (hash(x, y, 11) < 0.55 && BAYER[(y & 3) * 4 + (x & 3)] < 9) { sc.fillStyle = hash(x, y, 2) < 0.2 ? '#cfe0f4' : '#f4f8ff'; sc.fillRect(x, y, 1, 1); }
}
export function refreshGround() { buildGround(); }

// ---------------------------------------------------------------- actors
function initActors() {
  W8.farmer = { x: L.W / 2, y: L.gBottom - 4, tx: L.W / 2, ty: L.gBottom - 4, dir: 1, walk: 0, moving: false };
  W8.pets = [];
  W8.clouds = [];
  for (let k = 0; k < 5; k++) W8.clouds.push({ x: Math.random() * L.W, y: L.hudY + 6 + Math.random() * Math.max(10, L.townY - L.hudY - 10), i: k % 3, v: 1.5 + Math.random() * 2 });
  W8.bflies = [0, 1, 2].map((k) => ({ x: Math.random() * L.W, y: L.gy + Math.random() * L.gh, vx: 0, vy: 0, t: Math.random() * 10, col: ['#fff6e8', '#ffd23f', '#9ac8ff'][k] }));
  W8.flies = Array.from({ length: 9 }, () => ({ x: Math.random() * L.W, y: L.pathY + Math.random() * (L.barY - L.pathY), t: Math.random() * 10 }));
}
function clampActors() {
  const f = W8.farmer;
  f.x = clamp(f.x, 6, L.W - 6); f.y = clamp(f.y, L.townY + 58, L.gBottom); f.tx = f.x; f.ty = f.y;
}
export function walkTo(x, y) {
  const f = W8.farmer;
  f.tx = clamp(x, 6, L.W - 6); f.ty = clamp(y, L.townY + 58, L.gBottom + 2);
}
function syncPets() {
  while (W8.pets.length < G.pets.length) {
    const r = tileRect(Math.floor(Math.random() * G.rows * COLS));
    const at = W8.spawnAt || { x: r.x + 12, y: r.y + 14 };
    W8.pets.push({ x: at.x, y: at.y, tx: at.x, ty: at.y, dir: 1, wait: W8.spawnAt ? 0.8 : 1, anim: 0, hop: W8.spawnAt ? 0.4 : 0 });
  }
  W8.spawnAt = null;
  W8.pets.length = G.pets.length;
}
function petTarget(p) {
  p.tx = L.gx + 6 + Math.random() * (L.gw - 12);
  p.ty = L.gy + 10 + Math.random() * (G.rows * TILE - 12);
}

// ---------------------------------------------------------------- effects API
export function float(str, x, y, col = '#fff6dc', big = false) { floats.push({ str, x, y, col, t: 0, life: big ? 1.8 : 1.2, big }); }
export function burst(x, y, cols, n = 8, opt = {}) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, v = (opt.speed ?? 30) * (0.4 + Math.random() * 0.8);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opt.up ?? 25), g: opt.g ?? 90, t: 0, life: (opt.life ?? 0.6) * (0.6 + Math.random() * 0.6), col: cols[k % cols.length], img: opt.img });
  }
}
export function fly(img, x0, y0, x1, y1, delay = 0, done) { flies.push({ img, x0, y0, x1, y1, t: -delay, dur: 0.55 + Math.random() * 0.1, done }); }
export function hopPlant(i) { hop.set(i, 0.25); }

// ---------------------------------------------------------------- update
let sprayT = 0, flyT = 0;
export function updateScene(dt) {
  W8.t += dt;
  const t = W8.t;
  // environment intensities
  const wt = G.weather.type, tgt = (k) => (wt === k ? 1 : 0);
  env.rain = lerp(env.rain, tgt('rain') + tgt('storm'), 1 - Math.exp(-dt * 0.8));
  env.storm = lerp(env.storm, tgt('storm'), 1 - Math.exp(-dt * 0.8));
  env.snowfall = lerp(env.snowfall, tgt('snow'), 1 - Math.exp(-dt * 0.8));
  env.wet = clamp(env.wet + (env.rain > 0.5 ? dt / 6 : -dt / 40), 0, 1);
  env.snow = clamp(env.snow + (env.snowfall > 0.5 ? dt / 25 : -dt / 30), 0, 1);
  env.wind = 1 + env.rain * 0.8 + env.storm * 1.5;
  env.night = nightAmount(dayFrac());
  setNight(env.night > 0.5);
  // farmer
  const f = W8.farmer, dx = f.tx - f.x, dy = f.ty - f.y, d = Math.hypot(dx, dy);
  if (d > 1.5) {
    const sp = Math.min(d, 85 * dt);
    f.x += (dx / d) * sp; f.y += (dy / d) * sp;
    if (Math.abs(dx) > 0.5) f.dir = dx > 0 ? 1 : -1;
    f.walk += dt * 9; f.moving = true;
  } else { f.moving = false; f.walk = 0; }
  // pets
  syncPets();
  W8.pets.forEach((p, k) => {
    p.anim += dt;
    p.hop = Math.max(0, p.hop - dt);
    if (p.wait > 0) { p.wait -= dt; if (p.wait <= 0) petTarget(p); return; }
    const ddx = p.tx - p.x, ddy = p.ty - p.y, dd = Math.hypot(ddx, ddy);
    if (dd < 1) {
      p.wait = 1 + Math.random() * 3.5;
      if (Math.random() < 0.3) parts.push({ x: p.x + 2, y: p.y - 14, vx: 0, vy: -10, g: 0, t: 0, life: 0.9, img: A.heart() });
      return;
    }
    const sp = Math.min(dd, (A.FLYERS[G.pets[k].type] ? 22 : 15) * dt);
    p.x += (ddx / dd) * sp; p.y += (ddy / dd) * sp;
    if (Math.abs(ddx) > 0.3) p.dir = ddx > 0 ? 1 : -1;
  });
  // clouds
  for (const c of W8.clouds) { c.x += c.v * dt * (1 + env.rain); if (c.x > L.W + 10) { c.x = -60; c.y = L.hudY + 4 + Math.random() * Math.max(10, L.townY - L.hudY - 6); } }
  // butterflies / fireflies
  for (const b of W8.bflies) {
    b.t += dt;
    b.vx += (Math.random() - 0.5) * 120 * dt; b.vy += (Math.random() - 0.5) * 120 * dt;
    b.vx = clamp(b.vx, -18, 18); b.vy = clamp(b.vy, -14, 14);
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 4 || b.x > L.W - 4) b.vx = -b.vx * 0.8, b.x = clamp(b.x, 4, L.W - 4);
    if (b.y < L.pathY || b.y > L.gBottom) b.vy = -b.vy * 0.8, b.y = clamp(b.y, L.pathY, L.gBottom);
  }
  for (const ff of W8.flies) { ff.t += dt; ff.x += Math.sin(ff.t * 0.7 + ff.y) * 6 * dt; ff.y += Math.cos(ff.t * 0.9 + ff.x) * 5 * dt; if (ff.x < 0) ff.x = L.W; if (ff.x > L.W) ff.x = 0; ff.y = clamp(ff.y, L.pathY - 20, L.barY - 4); }
  // sprinkler spray
  if ((sprayT -= dt) <= 0) {
    sprayT = 0.06;
    for (const s of G.placed) {
      const r = tileRect(s.i), a = Math.random() * Math.PI * 2, v = 14 + Math.random() * 14 * SPRINKLERS[s.k].r;
      parts.push({ x: r.x + 18, y: r.y + 11, vx: Math.cos(a) * v, vy: -20 - Math.random() * 12, g: 70, t: 0, life: 0.55, col: Math.random() < 0.5 ? '#bfe4ff' : '#6cb6ff', floor: r.y + 13 + Math.sin(a) * 6 });
    }
  }
  // ripe glints / mutation sparkles on random fruits
  if ((flyT -= dt) <= 0) {
    flyT = 0.25;
    G.plots.forEach((pl, i) => pl && pl.fr.forEach((fr) => {
      if (!fr || fr.p < 1 || !fr.m.length || Math.random() > 0.15) return;
      const a = anchorOf(i);
      const m = fr.m;
      const col = m.includes('rainbow') ? `hsl(${(t * 200) % 360},90%,70%)` : m.includes('gold') ? '#fff0a0' : m.includes('shocked') ? '#fff36b' : m.includes('frozen') || m.includes('chilled') ? '#e0f6ff' : m.includes('wet') ? '#6cb6ff' : m.includes('moonlit') ? '#d6c8ff' : m.includes('bloodlit') ? '#ff6070' : '#ffe080';
      parts.push({ x: a.x + (Math.random() - 0.5) * 16, y: a.y - 4 - Math.random() * 18, vx: 0, vy: m.includes('wet') ? 10 : -6, g: 0, t: 0, life: 0.7, col, twinkle: true });
    }));
  }
  // weather particles
  if (env.rain > 0.02) {
    const n = Math.round(env.rain * (90 + env.storm * 60) * dt * (L.W / 200) * 3);
    for (let k = 0; k < n; k++) drops.push({ x: Math.random() * (L.W + 40), y: -4 + Math.random() * 20, vy: 220 + Math.random() * 60, vx: -45 - env.storm * 30, floor: L.pathY + Math.random() * (L.barY - L.pathY) });
  }
  for (let k = drops.length - 1; k >= 0; k--) {
    const r = drops[k];
    r.x += r.vx * dt; r.y += r.vy * dt;
    if (r.y >= r.floor) { drops.splice(k, 1); if (Math.random() < 0.5) { parts.push({ x: r.x, y: r.floor, vx: -8, vy: -18, g: 120, t: 0, life: 0.18, col: '#bfe4ff' }); parts.push({ x: r.x, y: r.floor, vx: 8, vy: -16, g: 120, t: 0, life: 0.18, col: '#bfe4ff' }); } }
  }
  if (env.snowfall > 0.02) {
    const n = Math.round(env.snowfall * 30 * dt * (L.W / 200) * 3);
    for (let k = 0; k < n; k++) flakes.push({ x: Math.random() * L.W, y: -3, vy: 12 + Math.random() * 14, ph: Math.random() * 6, big: Math.random() < 0.25, floor: L.pathY + Math.random() * (L.barY - L.pathY) });
  }
  for (let k = flakes.length - 1; k >= 0; k--) {
    const s = flakes[k];
    s.y += s.vy * dt; s.x += Math.sin(t * 1.5 + s.ph) * 10 * dt;
    if (s.y > s.floor) flakes.splice(k, 1);
  }
  // particles
  for (let k = parts.length - 1; k >= 0; k--) {
    const p = parts[k];
    p.t += dt;
    p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.floor !== undefined && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vx *= 0.5; p.vy *= -0.2; }
    if (p.t >= p.life) parts.splice(k, 1);
  }
  for (let k = floats.length - 1; k >= 0; k--) if ((floats[k].t += dt) >= floats[k].life) floats.splice(k, 1);
  for (let k = flies.length - 1; k >= 0; k--) {
    const fl = flies[k];
    fl.t += dt;
    if (fl.t >= fl.dur) { flies.splice(k, 1); fl.done && fl.done(); }
  }
  for (const [i, v] of hop) { if (v - dt <= 0) hop.delete(i); else hop.set(i, v - dt); }
  if (bolt && (bolt.t -= dt) <= 0) bolt = null;
  flash = Math.max(0, flash - dt * 2.5);
  if (groundKey !== `${L.W}|${L.H}|${G.rows}|${L.gy}`) buildGround();
}

function nightAmount(d) {
  if (d < 0.6) return 0;
  if (d < 0.74) return ease((d - 0.6) / 0.14);
  if (d < 0.93) return 1;
  return 1 - ease(Math.min(1, (d - 0.93) / 0.07));
}

// ---------------------------------------------------------------- drawing
const SKY = [[0, '#6878c8', '#f4a890'], [0.06, '#58a8f0', '#c8e8ff'], [0.5, '#4aa0f4', '#c4e8ff'], [0.6, '#5a98e0', '#ffe0b0'], [0.66, '#5a50a8', '#ff9a78'], [0.72, '#141a44', '#363a7a'], [0.93, '#141a44', '#363a7a'], [0.975, '#3a3a80', '#c08aa0'], [1, '#6878c8', '#f4a890']];
const TINT = [[0, '#e8c8d0'], [0.06, '#fff4e8'], [0.12, '#ffffff'], [0.58, '#ffffff'], [0.64, '#ffdcb8'], [0.69, '#e8a898'], [0.74, '#5a66b0'], [0.93, '#5a66b0'], [0.975, '#a890c0'], [1, '#e8c8d0']];
function keyed(keys, d, idx) {
  for (let k = 0; k < keys.length - 1; k++) {
    const a = keys[k], b = keys[k + 1];
    if (d >= a[0] && d <= b[0]) return mix(a[idx], b[idx], (d - a[0]) / (b[0] - a[0]));
  }
  return keys[0][idx];
}
const mul = (a, b) => { const A1 = rgb(a), B = rgb(b); return hex((A1[0] * B[0]) / 255, (A1[1] * B[1]) / 255, (A1[2] * B[2]) / 255); };

let skyC = null, skyKey = '';
function drawSky(g, d) {
  const h = L.pathY;
  let top = keyed(SKY, d, 1), bot = keyed(SKY, d, 2);
  const blood = bloodMoon();
  if (blood) { top = mix(top, '#3a0a1a', env.night * 0.7); bot = mix(bot, '#a02a3a', env.night * 0.6); }
  const gray = env.rain * 0.75, sn = env.snowfall * 0.6;
  top = mix(mix(top, env.storm > 0.3 ? '#3a4058' : '#7a8aa8', gray), '#a8b8d0', sn);
  bot = mix(mix(bot, env.storm > 0.3 ? '#6a7088' : '#b8c4d4', gray), '#e0e8f4', sn);
  const key = top + bot + h + L.W;
  if (key !== skyKey) {
    skyKey = key;
    if (!skyC || skyC.width !== L.W || skyC.height !== h) skyC = canvas(L.W, h);
    const id = skyC.g.createImageData(L.W, h), px = id.data, T = rgb(top), B = rgb(bot), bands = 10;
    for (let y = 0; y < h; y++) {
      const f = (y / h) * bands, b = Math.floor(f), frac = (f - b) * 16;
      const u0 = b / bands, u1 = Math.min(1, (b + 1) / bands);
      for (let x = 0; x < L.W; x++) {
        const u = BAYER[(y & 3) * 4 + (x & 3)] < frac ? u1 : u0, i = (y * L.W + x) * 4;
        px[i] = T[0] + (B[0] - T[0]) * u; px[i + 1] = T[1] + (B[1] - T[1]) * u; px[i + 2] = T[2] + (B[2] - T[2]) * u; px[i + 3] = 255;
      }
    }
    skyC.g.putImageData(id, 0, 0);
  }
  g.drawImage(skyC, 0, 0);
  // stars
  if (env.night > 0.05) {
    for (let k = 0; k < 46; k++) {
      const x = Math.floor(hash(k, 1) * L.W), y = Math.floor(hash(k, 2) * (h - 20));
      const tw = Math.sin(W8.t * (1 + hash(k, 3) * 3) + k) > 0.2;
      if (hash(k, 4) > env.night || !tw) continue;
      g.fillStyle = hash(k, 5) < 0.3 ? '#ffe8b0' : '#ffffff';
      g.fillRect(x, y, 1, 1);
      if (hash(k, 6) < 0.15) { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
    }
  }
  // sun & moon
  const arc = (u) => ({ x: L.W * 0.08 + u * L.W * 0.84, y: h - 8 - Math.sin(u * Math.PI) * (h - 26) });
  if (d < 0.7) {
    const p = arc(clamp((d + 0.02) / 0.72, 0, 1));
    g.globalAlpha = 1 - env.rain * 0.8;
    g.drawImage(softGlow(18, '#fff2b0', 0.55), Math.round(p.x) - 18, Math.round(p.y) - 18);
    g.drawImage(sunSprite(), Math.round(p.x) - 6, Math.round(p.y) - 6);
    g.globalAlpha = 1;
  }
  if (d > 0.66 || d < 0.02) {
    const u = d > 0.66 ? (d - 0.66) / 0.34 : 1;
    const p = arc(clamp(u, 0, 1));
    g.globalAlpha = 1 - env.rain * 0.7;
    g.drawImage(softGlow(16, blood ? '#ff4060' : '#c8d0ff', 0.4), Math.round(p.x) - 16, Math.round(p.y) - 16);
    g.drawImage(moonSprite(blood), Math.round(p.x) - 5, Math.round(p.y) - 5);
    g.globalAlpha = 1;
  }
}
const sunSprite = () => A.memo('sun', () => { const c = canvas(13, 13), P = painter(c); P.ball(6.5, 6.5, 6, 6, ['#ffb43a', '#ffd84a', '#fff4b0', '#ffffff']); return c; });
const moonSprite = (blood) => A.memo('moon' + blood, () => {
  const c = canvas(11, 11), P = painter(c);
  P.ball(5.5, 5.5, 5, 5, blood ? ['#8a1020', '#e0303a', '#ff9090', '#ffd0d0'] : ['#a8a8c8', '#e8e6d0', '#ffffff', '#ffffff']);
  P.dot(3, 4, blood ? '#a01828' : '#c8c6b8'); P.dot(6, 7, blood ? '#a01828' : '#c8c6b8'); P.dot(7, 3, blood ? '#a01828' : '#c8c6b8');
  return c;
});

function drawClouds(g) {
  const dark = env.rain > 0.4;
  for (const c of W8.clouds) {
    g.drawImage(A.cloudSprite(c.i, dark), Math.round(c.x), Math.round(c.y));
  }
}

function fruitSprite(crop, fr) {
  const c = CROP[crop];
  if (c.multi) return A.fruit(crop, fr.p < 0.3 ? 0 : fr.p < 0.75 ? 1 : 2);
  if (fr.p < 0.45) return null;
  return fr.p < 0.7 ? A.fruit(crop, 1, 0.6) : fr.p < 1 ? A.fruit(crop, 2, 0.8) : A.fruit(crop, 2, 1);
}
const STAGE_S = [0, 0.3, 0.5, 0.68, 0.84, 1];
const flipped = (spr) => spr._flip || (spr._flip = flipX(spr));

function swayOff(i, y, amp) { return Math.round(Math.sin(W8.t * 1.7 + i * 1.3 + y * 0.02) * amp * clamp((A.AY - y) / 40, 0, 1)); }

const stages = new Map();
const plantShadow = (st) => A.memo('pshadow' + st, () => {
  const c = canvas(18, 4), w = 4 + st * 1.6;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 18; x++) {
    const dx = (x + 0.5 - 9) / w, dy = (y + 0.5 - 2) / 1.8;
    if (dx * dx + dy * dy <= 1 && ((x + y) & 1)) { c.g.fillStyle = 'rgba(30,14,16,0.55)'; c.g.fillRect(x, y, 1, 1); }
  }
  return c;
});
function drawPlant(g, i, pl) {
  const crop = CROP[pl.c];
  const a = anchorOf(i);
  const f = crop.multi ? pl.g / crop.grow : pl.fr[0].p;
  const st = A.stageOf(Math.min(1, f));
  let spr = A.plantSprite(pl.c, st, pl.v);
  if (pl.f) spr = flipped(spr);
  const amp = (st >= 2 ? 1 : 0.4) * env.wind * (crop.id === 'mushroom' ? 0.3 : 1);
  const h = hop.get(i) || 0, lift = h > 0 ? Math.round(Math.sin((h / 0.25) * Math.PI) * 2) : 0;
  const ox = a.x - A.AX - 1, oy = a.y - A.AY - 1 - lift;
  if (st >= 2) g.drawImage(plantShadow(st), a.x - 9, a.y - 1);
  const was = stages.get(i);
  if (was !== undefined && st > was && st >= 2) burst(a.x, a.y - 6 - st * 2, ['#a2df69', '#56b34a', '#cdee8a'], 5, { speed: 18, up: 14, g: 30, life: 0.5 });
  stages.set(i, st);
  for (let y = 0; y < spr.height; y += 3) {
    const hh = Math.min(3, spr.height - y);
    g.drawImage(spr, 0, y, spr.width, hh, ox + swayOff(i, y, amp), oy + y, spr.width, hh);
  }
  // fruit
  const an = A.ANCHORS[pl.c], s = crop.multi ? 1 : STAGE_S[st];
  pl.fr.forEach((fr, k) => {
    if (!fr) return;
    const base = fruitSprite(pl.c, fr);
    if (!base) return;
    const pt = an.pts[k % an.pts.length];
    const px = Math.round((pl.f ? -pt[0] : pt[0]) * s), py = Math.round(pt[1] * s);
    const look = A.mainLook(fr.m);
    const img = A.mutated(base, look, Math.floor(W8.t * 8));
    const off = swayOff(i, A.AY + py, amp);
    const x = a.x + px - Math.floor(img.width / 2) + off;
    const y = (an.sit ? a.y + py - img.height + 1 : a.y + py - 1) - lift;
    if (fr.p >= 1 && (fr.m.includes('shocked') || fr.m.includes('moonlit') || fr.m.includes('gold') || fr.m.includes('rainbow'))) {
      const gc = fr.m.includes('shocked') ? '#fff36b' : fr.m.includes('moonlit') ? '#b9a2ff' : '#ffe680';
      if (fr.m.includes('shocked') && Math.random() < 0.3) { g.fillStyle = gc; g.fillRect(x - 1 + Math.floor(Math.random() * (img.width + 2)), y - 1 + Math.floor(Math.random() * (img.height + 2)), 1, 1); }
    }
    g.drawImage(img, x, y);
    if (fr.p >= 1) {
      const gt = (W8.t * 0.6 + hash(i, k) * 7) % 3.2;
      if (gt < 0.22) g.drawImage(A.sparkle(gt < 0.11 ? 0 : 1), x + img.width - 3 - (gt < 0.11 ? 0 : 1), y - 1 - (gt < 0.11 ? 0 : 1));
    }
  });
  // seed giant-size badge? keep the view calm: nothing else.
}

function drawSprinkler(g, s) {
  const r = tileRect(s.i), icon = A.sprinklerIcon(s.k);
  const left = s.t / SPRINKLERS[s.k].dur;
  g.drawImage(icon, r.x + 13, r.y + 7);
  if (left < 0.15 && Math.sin(W8.t * 10) > 0) { g.fillStyle = '#ff7a6a'; g.fillRect(r.x + 17, r.y + 5, 1, 1); }
}

function drawFarmer(g) {
  const f = W8.farmer, fr = A.farmerFrames();
  const seq = [1, 2, 3, 0];
  const frame = f.moving ? seq[Math.floor(f.walk) % 4] : 0;
  const img = (f.dir > 0 ? fr.right : fr.left)[frame];
  ditherRect(g, Math.round(f.x) - 5, Math.round(f.y) - 1, 10, 2, '#1a2a1a', 8);
  g.drawImage(img, Math.round(f.x) - 7, Math.round(f.y) - img.height + 1);
}

function drawPet(g, k) {
  const p = W8.pets[k], type = G.pets[k].type, fr = A.petFrames(type);
  const flyer = A.FLYERS[type];
  const moving = p.wait <= 0;
  const frame = flyer ? Math.floor(p.anim * 10) % 2 : moving ? Math.floor(p.anim * 7) % 2 : 0;
  const img = (p.dir > 0 ? fr.right : fr.left)[frame];
  const bob = flyer ? Math.round(Math.sin(p.anim * 3) * 2) - 8 : 0;
  const jump = p.hop > 0 ? -Math.round(Math.sin((p.hop / 0.4) * Math.PI) * 4) : 0;
  ditherRect(g, Math.round(p.x) - 4, Math.round(p.y) - 1, 8, 2, '#1a2a1a', flyer ? 4 : 8);
  g.drawImage(img, Math.round(p.x) - 8, Math.round(p.y) - img.height + 1 + bob + jump);
}

export function petScreenPos(k) { const p = W8.pets[k]; return p ? { x: p.x, y: p.y - 10 } : null; }

function drawStalls(g) {
  for (const k in L.stalls) {
    const s = L.stalls[k], sp = A.stallSprites(k);
    g.drawImage(sp.back, s.x, s.y);
    const fr = A.npcFrames(k), tt = W8.t + hash(k.length, 3) * 5;
    const blink = tt % 4 < 0.12;
    const img = blink ? fr[2] : fr[Math.floor(tt * 1.5) % 2];
    g.drawImage(img, s.x + 15, s.y + 21);
    g.drawImage(sp.front, s.x, s.y);
  }
  // nest and eggs
  if (G.eggs.length) {
    const n = A.nestSprite();
    g.drawImage(n, L.nest.x, L.nest.y - 2);
    G.eggs.forEach((e, k) => {
      const crack = e.t < 4 ? 2 : e.t < 10 ? 1 : 0;
      const wob = e.t < 10 ? Math.round(Math.sin(W8.t * (e.t < 4 ? 30 : 12)) * 1) : 0;
      const img = A.eggSprite(e.id, crack);
      g.drawImage(img, L.nest.x + 1 + k * 7 + wob, L.nest.y - 10);
    });
  }
}

function drawLights(g) {
  const n = env.night;
  const dark = Math.max(n, env.storm * 0.5);
  if (dark < 0.05) return;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = dark * 0.5;
  for (const k in L.stalls) { const s = L.stalls[k]; g.drawImage(softGlow(18, '#ffa040'), s.x + s.w - 21, s.y + 6); }
  G.plots.forEach((pl, i) => {
    if (!pl || (pl.c !== 'mushroom' && pl.c !== 'beanstalk')) return;
    const a = anchorOf(i);
    g.drawImage(softGlow(14, pl.c === 'mushroom' ? '#ff5a7a' : '#6aff7a', 0.8), a.x - 14, a.y - 24);
  });
  g.globalAlpha = n * 0.7;
  for (const ff of W8.flies) {
    if (Math.sin(ff.t * 2 + ff.x) < -0.2) continue;
    g.drawImage(softGlow(5, '#d8ff6a'), Math.round(ff.x) - 5, Math.round(ff.y) - 5);
  }
  g.restore();
  if (n > 0.3) for (const ff of W8.flies) { if (Math.sin(ff.t * 2 + ff.x) < -0.2) continue; g.fillStyle = '#f4ffb0'; g.fillRect(Math.round(ff.x), Math.round(ff.y), 1, 1); }
  // lantern flames stay bright at night
  if (n > 0.2) for (const k in L.stalls) { const s = L.stalls[k]; g.fillStyle = '#fff2b0'; g.fillRect(s.x + s.w - 5, s.y + 23, 3, 3); }
}

export function drawWorld(g) {
  const d = dayFrac();
  drawSky(g, d);
  drawClouds(g);
  g.drawImage(backdrop, 0, 0);
  g.drawImage(ground, 0, 0);
  // wet soil (rain or watering can)
  for (let i = 0; i < G.rows * COLS; i++) {
    const pl = G.plots[i];
    const w = Math.max(env.wet * 0.85, pl && pl.w > 0 ? Math.min(1, pl.w / 4) : 0);
    if (w < 0.03) continue;
    const r = tileRect(i);
    g.globalAlpha = w;
    g.drawImage(soilVar[i % 3][1], r.x, r.y);
  }
  g.globalAlpha = 1;
  if (env.snow > 0.02) { g.globalAlpha = env.snow * 0.85; g.drawImage(snowCover, 0, 0); g.globalAlpha = 1; }
  // sprinkler reach, shown while a sprinkler is selected
  if (G.sel && G.sel.startsWith('spr:')) {
    for (const sp of G.placed) {
      const r = SPRINKLERS[sp.k].r, c0 = sp.i % COLS, r0 = Math.floor(sp.i / COLS);
      for (let rr = r0 - r; rr <= r0 + r; rr++) for (let cc = c0 - r; cc <= c0 + r; cc++) {
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= G.rows) continue;
        const t = tileRect(rr * COLS + cc);
        ditherRect(g, t.x + 1, t.y + 1, 22, 22, '#9ad8ff', 4);
      }
    }
  }
  drawStalls(g);
  // y-sorted world objects
  const list = [];
  G.plots.forEach((pl, i) => { if (pl) list.push([anchorOf(i).y, 0, i]); });
  G.placed.forEach((s, k) => list.push([tileRect(s.i).y + 17, 1, k]));
  W8.pets.forEach((p, k) => list.push([p.y, 2, k]));
  list.push([W8.farmer.y, 3, 0]);
  list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [, kind, k] of list) {
    if (kind === 0) drawPlant(g, k, G.plots[k]);
    else if (kind === 1) drawSprinkler(g, G.placed[k]);
    else if (kind === 2) drawPet(g, k);
    else drawFarmer(g);
  }
  g.drawImage(fenceFront, L.gx - 7, L.gBottom - 3);
  // butterflies
  const day = 1 - env.night;
  if (day > 0.5 && env.rain < 0.3) for (const b of W8.bflies) {
    const open = Math.sin(b.t * 18) > 0;
    g.fillStyle = b.col;
    const x = Math.round(b.x), y = Math.round(b.y);
    if (open) { g.fillRect(x - 1, y, 1, 1); g.fillRect(x + 1, y, 1, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); }
    else { g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); }
    g.fillStyle = INK; g.fillRect(x, y, 1, 1);
  }
  // particles
  for (const p of parts) {
    if (p.img) { g.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height / 2)); continue; }
    if (p.twinkle) { const k = p.t / p.life; g.fillStyle = p.col; const x = Math.round(p.x), y = Math.round(p.y); g.fillRect(x, y, 1, 1); if (k > 0.25 && k < 0.6) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } continue; }
    g.fillStyle = p.col;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size || 1, p.size || 1);
  }
  // weather
  if (drops.length) {
    g.fillStyle = 'rgba(200,225,255,0.75)';
    for (const r of drops) { const x = Math.round(r.x), y = Math.round(r.y); g.fillRect(x, y, 1, 3); g.fillRect(x + 1, y - 2, 1, 2); }
  }
  for (const s of flakes) { g.fillStyle = '#ffffff'; g.fillRect(Math.round(s.x), Math.round(s.y), s.big ? 2 : 1, s.big ? 2 : 1); }
  // lighting
  let tint = keyed(TINT, d, 1);
  if (bloodMoon()) tint = mix(tint, '#a04a60', env.night * 0.8);
  tint = mul(tint, mix('#ffffff', env.storm > 0.3 ? '#8a92b4' : '#c4ccdc', env.rain));
  tint = mul(tint, mix('#ffffff', '#e4ecf8', env.snowfall));
  if (tint !== '#ffffff') {
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = tint; g.fillRect(0, 0, L.W, L.H); g.restore();
  }
  drawLights(g);
  // lightning
  if (bolt) {
    g.fillStyle = '#ffffff';
    for (let k = 0; k < bolt.pts.length - 1; k++) {
      const [x0, y0] = bolt.pts[k], [x1, y1] = bolt.pts[k + 1];
      const pp = painter({ g });
      pp.line(x0, y0, x1, y1, '#fffbd0'); pp.line(x0 + 1, y0, x1 + 1, y1, '#9ad8ff');
    }
  }
  if (flash > 0) { g.fillStyle = `rgba(240,245,255,${(flash * 0.6).toFixed(3)})`; g.fillRect(0, 0, L.W, L.H); }
}

// texts and flying items are drawn above the UI bar so they can land on it
export function drawOverlayFx(g) {
  for (const fl of flies) {
    if (fl.t < 0) continue;
    const u = ease(clamp(fl.t / fl.dur, 0, 1));
    const x = lerp(fl.x0, fl.x1, u), y = lerp(fl.y0, fl.y1, u) - Math.sin(u * Math.PI) * 26;
    g.drawImage(fl.img, Math.round(x - fl.img.width / 2), Math.round(y - fl.img.height / 2));
  }
  for (const f of floats) {
    const u = f.t / f.life;
    const y = f.y - ease(Math.min(1, u * 1.5)) * (f.big ? 16 : 11);
    g.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
    text(g, f.str, f.x, y, f.col, { align: 'center', outline: INK, thick: f.big });
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------- event reactions
on('plant', ({ i }) => {
  const a = anchorOf(i);
  burst(a.x, a.y - 1, [A.PAL.soil[3], A.PAL.soil[4], A.PAL.soil[2]], 6, { speed: 20, up: 15, life: 0.35 });
  hopPlant(i);
  sfx('plant', i);
});
on('harvest', ({ i, got, removed }) => {
  const a = anchorOf(i);
  hopPlant(i);
  burst(a.x, a.y - 6, ['#a2df69', '#56b34a', '#fff6dc'], 6, { speed: 26, up: 30, life: 0.45 });
  const special = got.filter(({ item }) => item.m.some((m) => m !== 'wet' && m !== 'chilled') || item.kg > CROP[item.c].kg * 1.4);
  special.slice(0, floats.length > 2 ? 0 : 1).forEach(({ item }, k) => {
    const giant = item.kg > CROP[item.c].kg * 1.4 ? 'Giant ' : '';
    const look = A.mainLook(item.m);
    float(`${giant}${look ? ({ gold: 'Gold', rainbow: 'Rainbow', shocked: 'Shocked', frozen: 'Frozen', bloodlit: 'Bloodlit', moonlit: 'Moonlit', pollinated: 'Pollinated', chilled: 'Chilled', wet: 'Wet' })[look] + ' ' : ''}${CROP[item.c].name} $${fmt(item.v)}`, a.x, a.y - 24 - k * 10, look === 'gold' ? '#ffd84a' : look === 'rainbow' ? '#ff9ae0' : '#c8f0ff');
  });
  got.forEach(({ item }, k) => {
    const icon = A.mutated(A.cropIcon(item.c), A.mainLook(item.m), 0);
    fly(icon, a.x + (k - got.length / 2) * 4, a.y - 10, L.bagBtn.x + 12, L.bagBtn.y + 8, k * 0.05, () => { W8.bagBump = 0.18; sfx('pop'); });
  });
  sfx('harvest', i);
  if (removed) burst(a.x, a.y, [A.PAL.soil[3], A.PAL.soil[4]], 5, { speed: 18, up: 12, life: 0.3 });
});
on('sell', ({ total }) => {
  const s = L.stalls.sell, n = Math.min(14, 3 + Math.floor(Math.log10(total + 1) * 2));
  for (let k = 0; k < n; k++) fly(A.coinIcon(), s.x + 22 + (Math.random() - 0.5) * 20, s.y + 36, L.moneyPos.x, L.moneyPos.y, k * 0.045, () => { W8.moneyBump = 0.15; sfx('coin'); });
  float('+$' + fmt(total), s.x + 22, s.y + 26, '#ffe14a', true);
  sfx('sell');
});
on('ripe', (i) => {
  const a = anchorOf(i), pl = G.plots[i];
  const h = pl && CROP[pl.c].multi ? 18 : 8;
  for (let k = 0; k < 6; k++) parts.push({ x: a.x + (Math.random() - 0.5) * 16, y: a.y - 4 - Math.random() * h, vx: 0, vy: -8, g: 0, t: -k * 0.06, life: 0.6, col: k % 2 ? '#fff6c0' : '#ffffff', twinkle: true });
});
on('dig', ({ i }) => { const a = anchorOf(i); burst(a.x, a.y - 2, [A.PAL.soil[3], A.PAL.soil[4], '#56b34a'], 10, { speed: 30, up: 25 }); sfx('dig'); });
on('water', (i) => {
  const a = anchorOf(i);
  for (let k = 0; k < 14; k++) parts.push({ x: a.x - 6 + Math.random() * 12, y: a.y - 22 - Math.random() * 6, vx: (Math.random() - 0.5) * 8, vy: 20, g: 160, t: 0, life: 0.4, col: k % 2 ? '#bfe4ff' : '#6cb6ff', floor: a.y });
  sfx('water');
});
on('sprinkler', ({ i }) => { const a = anchorOf(i); burst(a.x + 6, a.y - 8, ['#bfe4ff', '#6cb6ff', '#ffffff'], 10, { speed: 30 }); sfx('buy'); });
on('lightning', (i) => {
  const a = anchorOf(i);
  const pts = [];
  let x = a.x + (Math.random() - 0.5) * 30, y = 0;
  const ty = G.plots[i] ? a.y - 14 : a.y;
  while (y < ty) { pts.push([Math.round(x), Math.round(y)]); y += 6 + Math.random() * 10; x += (a.x - x) * 0.25 + (Math.random() - 0.5) * 10; }
  pts.push([a.x, ty]);
  bolt = { pts, t: 0.22 };
  flash = 1;
  burst(a.x, ty, ['#fff36b', '#ffffff', '#9ad8ff'], 14, { speed: 50, up: 30 });
  sfx('thunder');
});
on('mut', ({ i, m }) => {
  if (m === 'wet' || m === 'chilled') return;
  const a = anchorOf(i);
  burst(a.x, a.y - 14, m === 'gold' ? ['#ffd84a', '#fff4a8'] : m === 'rainbow' ? ['#ff6a8a', '#ffd23f', '#7ccf55', '#5aa8ff', '#c08aff'] : ['#ffffff', '#fff6c0'], 10, { speed: 24, up: 20, life: 0.7 });
  float(({ gold: 'GOLD!', rainbow: 'RAINBOW!', shocked: 'Shocked!', frozen: 'Frozen!', moonlit: 'Moonlit', bloodlit: 'Bloodlit', pollinated: 'Pollinated' })[m] || m, a.x, a.y - 26, ({ gold: '#ffd84a', rainbow: '#ff8fd8', shocked: '#fff36b', frozen: '#9fe4ff', moonlit: '#c8b8ff', bloodlit: '#ff6070', pollinated: '#ffcf3f' })[m] || '#fff');
  sfx('mut');
});
on('moonbeam', (i) => {
  const a = anchorOf(i);
  for (let k = 0; k < 16; k++) parts.push({ x: a.x + (Math.random() - 0.5) * 6, y: a.y - 70 + k * 3.5, vx: 0, vy: 30, g: 0, t: -k * 0.02, life: 0.5, col: bloodMoon() ? '#ff7080' : '#d6c8ff', twinkle: true });
});
on('petfx', ({ idx, kind, i, crop }) => {
  const p = W8.pets[idx];
  if (!p) return;
  p.hop = 0.4;
  if (i != null) { const a = anchorOf(i); p.tx = a.x + 6; p.ty = a.y + 2; p.wait = 0; }
  if (kind === 'dig') {
    burst(p.x, p.y - 2, [A.PAL.soil[3], A.PAL.soil[4]], 8, { speed: 25 });
    fly(A.packet(crop), p.x, p.y - 8, L.W / 2, L.hotY + 10, 0.2);
    float('+1 ' + CROP[crop].name + ' seed', p.x, p.y - 16, '#a8ff8a');
    sfx('pop');
  }
});
on('hatch', ({ type }) => {
  const x = L.nest.x + 7, y = L.nest.y - 6;
  burst(x, y, ['#fff6e8', '#ffd23f', '#ff9ac0', '#9ad8ff'], 20, { speed: 45, up: 30, life: 0.9 });
  for (let k = 0; k < 6; k++) parts.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 30, vy: -40, g: 80, t: 0, life: 0.6, img: A.memo('shell', () => { const c = canvas(2, 2); c.g.fillStyle = '#f4ead2'; c.g.fillRect(0, 0, 2, 2); return c; }) });
  W8.spawnAt = { x, y: y + 6 };
  float(PETS[type].name + '!', x, y - 14, '#ffd84a', true);
  sfx('hatch');
});
on('expand', () => { buildGround(); for (let c = 0; c < COLS; c++) { const a = anchorOf((G.rows - 1) * COLS + c); burst(a.x, a.y - 6, ['#ab774b', '#8f5d3a', '#a2df69'], 5, { speed: 30, up: 20 }); } sfx('expand'); });
