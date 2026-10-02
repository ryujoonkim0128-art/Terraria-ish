'use strict';
// Game state, simulation and rendering.

const PWID = 3, PHGT = 12;
const g = window.game = {
  mode: 'title', t: 0, time: 7, day: 1, coins: 12, rentDue: 3, strikes: 0,
  hp: 100, food: 80, stam: 100, jobs: [], done: 0, lamStage: 0, lamDone: false, letter: true,
  cam: { x: 0, y: 0 }, shake: 0, flash: 0, rain: 0.6, rainTarget: 0.7, fade: 0, keys: {}, pressed: {},
  parts: [], drops: [], radioOn: true, mapZoom: 0, power: {}, followers: [],
};

let w, worldCv, litCv, sky, planeImg, planeDark, sc, sx, screen, ctx, vignette, grain;
const keyDown = (k) => g.keys[k];
const tap = (k) => { const v = g.pressed[k]; return v; };

function boot() {
  screen = document.getElementById('screen');
  ctx = screen.getContext('2d');
  sc = document.createElement('canvas'); sc.width = VW; sc.height = VH;
  sx = sc.getContext('2d', { willReadFrequently: true });
  Light.init();
  const hs = parseInt(location.hash.slice(1), 10);
  newWorld(Number.isFinite(hs) ? hs : (Math.random() * 1e9) | 0);
  vignette = makeVignette(); grain = makeGrain();
  UI.init();
  layout(); addEventListener('resize', layout);
  addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!g.keys[k]) g.pressed[k] = true;
    g.keys[k] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.key)) e.preventDefault();
    Sfx.init(); Sfx.resume();
  });
  addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; g.keys[k] = false; });
  addEventListener('blur', () => { g.keys = {}; });
  document.getElementById('wrap').addEventListener('pointerdown', () => { Sfx.init(); Sfx.resume(); g.pressed.click = true; });
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    g.fps = g.fps ? g.fps * 0.95 + 0.05 / Math.max(dt, 0.001) : 60;
    try { step(dt); render(); } catch (err) { console.error(err); }
    g.pressed = {};
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function newWorld(seed) {
  g.seed = seed;
  w = g.world = genWorld(seed);
  worldCv = bakeWorld(w);
  litCv = bakeLitWorld(w, worldCv);
  sky = bakeSkyline(seed);
  planeImg = bakePlane();
  planeDark = tinted(planeImg, '#0c0d14', 'planeDark');
  R = mulberry32(seed ^ 0x1234567);
  const yr = w.yours;
  g.player = { x: (yr.x0 + 1) * T + 4, y: (yr.y1 + 1) * T, vx: 0, vy: 0, face: 1, onGround: true, climbing: false, airTop: 0, frame: 0, ft: 0, carry: [], dropT: 0, hurtT: 0 };
  // start at the street door of your own building instead: the walk up is the first lesson
  const b = w.blds[yr.b];
  g.player.x = (b.x0 + (b.sx < (b.x0 + b.x1) / 2 ? 6 : b.x1 - b.x0 - 6)) * T;
  g.player.x = clamp(g.player.x, (b.x0 + 1) * T + 4, (b.x1 - 1) * T);
  g.player.y = w.G * T;
  g.player.airTop = g.player.y;
  Object.assign(g, { time: 7.2, day: 1, coins: 12, rentDue: 3, strikes: 0, hp: 100, food: 75, stam: 100, jobs: [], done: 0, lamStage: 0, lamDone: false, letter: true, power: {}, parts: [], drops: [], followers: [], nextPlane: 25, plane: null, nextOffer: 0, nextPower: rnd(30, 60), mapZoom: 0, teaDay: 0, kettleT: -9, laminated: false, deadT: 0, ate: 0 });
  spawnLife();
  makeOffers(true);
  snapCam();
}

// ---------- tenants and animals ----------
function spawnLife() {
  g.npcs = []; g.cats = []; g.rats = []; g.birds = [];
  const add = (o) => { o.id = g.npcs.length; g.npcs.push(o); return o; };
  const person = (room, role, kind, female, opts = {}) => {
    const nm = opts.name || (kind === 'kid' ? pick(NAMES_K) : female ? pick(NAMES_F) : pick(NAMES_M));
    const look = makeLook(kind, female);
    if (['noodle', 'fishball', 'tea', 'vendor'].includes(role)) look.apron = true;
    const x0 = room ? room.x0 * T + 3 : opts.x0, x1 = room ? (room.x1 + 1) * T - 3 : opts.x1;
    return add(Object.assign({
      name: nm, look, role, kind, room, x: rnd(x0, x1), y: room ? (room.y1 + 1) * T : opts.y, xmin: x0, xmax: x1,
      face: chance(0.5) ? 1 : -1, pose: 'stand', frame: 0, ft: 0, state: 'idle', st: rnd(1, 4), tx: 0, speed: rnd(12, 20),
      night: chance(0.2), bark: null, offer: null, met: false,
    }, opts));
  };
  for (const r of w.rooms) {
    const t = r.type;
    if (t === 'home') {
      const n = irnd(1, 2);
      for (let i = 0; i < n; i++) { const kind = chance(0.25) ? 'elder' : chance(0.25) ? 'kid' : 'adult'; person(r, kind === 'adult' ? 'adult' : kind, kind, chance(0.55)); }
    } else if (t === 'mahjong') {
      for (let i = 0; i < 3; i++) person(r, 'mahjong', chance(0.4) ? 'elder' : 'adult', chance(0.5), { sit: true });
    } else if (t === 'temple') person(r, 'temple', 'elder', chance(0.6));
    else if (t === 'stair') { if (chance(0.06)) person(r, 'adult', 'adult', chance(0.5)); }
    else if (t === 'empty') { if (chance(0.15)) g.cats.push(makeCat(r.x0 * T + 8, (r.y1 + 1) * T, pick(['black', 'grey', 'calico']))); }
    else if (t === 'yours') { /* nobody */ }
    else if (t === 'tea') { person(r, 'tea', 'adult', chance(0.5)); if (chance(0.7)) person(r, 'adult', chance(0.5) ? 'elder' : 'adult', chance(0.5), { sit: true }); }
    else if (t === 'school') person(r, 'school', 'adult', true);
    else { const n = r.x1 - r.x0 > 5 && chance(0.5) ? 2 : 1; for (let i = 0; i < n; i++) person(r, t, chance(0.15) ? 'elder' : 'adult', chance(0.5)); }
  }
  // named people
  const yr = w.yours;
  const near = w.rooms.filter((r) => r.type === 'home' && r.b === yr.b && Math.abs(r.k - yr.k) <= 1 && r !== yr);
  const lr = near[0] || w.rooms.find((r) => r.type === 'home');
  g.landlord = person(lr, 'landlord', 'adult', false, { name: 'Mr. Ko' });
  g.landlord.look.shirt = '#e8e4d8'; g.landlord.look.style = 'bald';
  const cl = w.rooms.find((r) => r.type === 'clinic');
  if (cl) person(cl, 'clinic', 'adult', true, { name: 'Dr. Leung' });
  g.clinic = cl || w.rooms.find((r) => r.k === 0);
  g.lam = person(null, 'lam', 'elder', true, { name: 'Lam Siu-ying', x0: w.coop.x + 42, x1: w.coop.x + 56, y: w.coop.y });
  g.lam.look.style = 'bun'; g.lam.look.shirt = '#5a6a8a';
  // street vendors and standpipe gossip
  for (const o of w.objs) {
    if (o.kind === 'stall') o.npc = person(null, 'vendor', 'adult', chance(0.5), { x0: o.x + 6, x1: o.x + 16, y: o.y, fixed: true });
    if (o.kind === 'standpipe') person(null, 'adult', 'elder', true, { x0: o.x - 30, x1: o.x - 20, y: o.y });
  }
  // street walkers outside the walls
  const fb = w.blds[0], lb = w.blds[w.blds.length - 1];
  for (let i = 0; i < 3; i++) person(null, 'adult', chance(0.2) ? 'kid' : 'adult', chance(0.5), { x0: 4 * T, x1: (fb.x0 - 2) * T, y: w.G * T });
  for (let i = 0; i < 3; i++) person(null, 'adult', chance(0.2) ? 'kid' : 'adult', chance(0.5), { x0: (lb.x1 + 2) * T, x1: (w.W - 4) * T, y: w.G * T });
  // kids on the roofs
  for (const b of w.blds) if (chance(0.25)) person(null, 'kid', 'kid', chance(0.5), { x0: (b.x0 + 1) * T, x1: b.x1 * T, y: b.roof * T });

  // the stray who might adopt you
  const yb = w.blds[yr.b];
  g.stray = makeCat((yb.x0 + yb.x1) / 2 * T, w.G * T, 'orange');
  g.stray.stray = true; g.cats.push(g.stray);
  for (let i = 0; i < 6; i++) g.cats.push(makeCat(rnd(w.sewer.x0 * T, w.sewer.x1 * T), (w.sewer.y1 + 1) * T, pick(['black', 'grey'])));
  for (let i = 0; i < 26; i++) g.rats.push({ x: rnd(w.sewer.x0 * T + 20, w.sewer.x1 * T - 20), y: (w.sewer.y1 + 1) * T, face: 1, vx: 0, t: 0, frame: 0, bite: 0, dead: false });
  for (const b of w.blds) for (let i = irnd(0, 3); i--;) g.birds.push(makeBird(rnd((b.x0 + 1) * T, b.x1 * T), b.roof * T));
  for (let i = 0; i < 9; i++) g.birds.push(makeBird(w.coop.x + rnd(-6, 50), w.coop.y - (i < 4 ? 26 : 0)));
}
function makeCat(x, y, col) { return { x, y, hx: x, col, face: 1, pose: 'sit', frame: 0, ft: 0, t: rnd(1, 4), tx: x, follow: false, wait: 0 }; }
function makeBird(x, y) { return { x, y, hx: x, hy: y, face: chance(0.5) ? 1 : -1, fly: 0, vx: 0, vy: 0, frame: 0, peck: rnd(0, 3) }; }

const WORKERS = ['noodle', 'fishball', 'sewing', 'metal', 'dentist', 'clinic', 'barber', 'grocer', 'school', 'tea', 'temple'];
function npcPresence(n, h) {
  const night = h >= 23 || h < 6;
  if (n.role === 'mahjong' || n.role === 'lam' || n.role === 'landlord') return 'awake';
  if (n.role === 'vendor') return h >= 2 && h < 6 ? 'gone' : 'awake';
  if (WORKERS.includes(n.role)) return h >= 22 || h < 7 ? 'gone' : 'awake';
  if (!n.room) return night ? 'gone' : 'awake';
  if (night && !n.night) return 'sleep';
  if (n.kind === 'kid' && (h >= 21.5 || h < 7)) return 'sleep';
  return 'awake';
}

function updateNPC(n, dt) {
  n.presence = npcPresence(n, g.time);
  if (n.bark) { n.bark.t -= dt; if (n.bark.t <= 0) n.bark = null; }
  if (n.presence !== 'awake') return;
  n.ft += dt;
  const p = g.player;
  const near = Math.abs(p.x - n.x) < 22 && Math.abs(p.y - n.y) < 10;
  if (n === g.talking) { n.face = p.x > n.x ? 1 : -1; n.pose = n.sit ? 'sit' : 'stand'; return; }
  if (n.fixed || n.sit) {
    n.pose = n.sit ? 'sit' : (n.role === 'vendor' && Math.sin(g.t * 2 + n.id) > 0.3 ? 'work' : 'stand');
    if (near) n.face = p.x > n.x ? 1 : -1;
  } else {
    n.st -= dt;
    if (n.state === 'idle') {
      n.pose = WORKERS.includes(n.role) && n.role !== 'tea' && Math.sin(g.t * 3 + n.id) > 0 ? 'work' : 'stand';
      if (near) n.face = p.x > n.x ? 1 : -1;
      if (n.st <= 0) { n.state = 'walk'; n.tx = rnd(n.xmin, n.xmax); n.st = 8; }
    } else {
      const d = n.tx - n.x;
      n.face = d > 0 ? 1 : -1;
      n.x += Math.sign(d) * Math.min(Math.abs(d), n.speed * dt);
      n.pose = 'walk'; n.frame = Math.floor(n.ft * 7) % 4;
      if (Math.abs(d) < 0.5 || n.st <= 0) { n.state = 'idle'; n.st = rnd(2, 7); }
    }
  }
  if (!n.bark && near && chance(dt * 0.12)) n.bark = { text: pick(BARKS[n.role] || BARKS[n.kind] || ['...']), t: 1.6 };
  if (n.role === 'mahjong' && chance(dt * 0.4)) { n.bark = n.bark || (chance(0.08) ? { text: pick(BARKS.mahjong), t: 1.2 } : null); }
}

function updateCat(c, dt) {
  const p = g.player;
  c.ft += dt;
  if (c.follow) {
    const off = c === g.followers[0] ? 12 : 22;
    const dy = p.y - c.y;
    if (Math.abs(dy) > 4 && (p.onGround || p.climbing)) {
      c.wait += dt;
      const off2 = Math.abs(c.x - g.cam.x - VW / 2) > VW / 2 + 8 || Math.abs(c.y - g.cam.y - VH / 2) > VH / 2 + 8;
      if (p.onGround && ((c.wait > 1.0 && off2) || c.wait > 2.6)) {
        poof(c.x, c.y - 3); c.x = p.x - p.face * off; c.y = p.y; c.wait = 0; poof(c.x, c.y - 3);
        if (!canFit(c.x, c.y)) c.x = p.x;
      }
    } else c.wait = 0;
    const tx = p.x - p.face * off, d = tx - c.x;
    if (Math.abs(d) > 3 && Math.abs(dy) <= 4) { c.x += Math.sign(d) * Math.min(Math.abs(d), (Math.abs(d) > 30 ? 70 : 40) * dt); c.face = Math.sign(d); c.pose = 'walk'; c.frame = Math.floor(c.ft * 9); }
    else { c.pose = 'sit'; if (Math.abs(dy) <= 4) c.face = p.x > c.x ? 1 : -1; }
    if (chance(dt * 0.03) && dist(c, p) < 60) Sfx.meow();
    return;
  }
  c.t -= dt;
  if (c.t <= 0) { if (c.pose === 'sit') { c.pose = 'walk'; c.tx = c.hx + rnd(-20, 20); c.t = 3; } else { c.pose = 'sit'; c.t = rnd(3, 9); } }
  if (c.pose === 'walk') {
    const d = c.tx - c.x;
    if (Math.abs(d) < 1) { c.pose = 'sit'; c.t = rnd(3, 9); }
    else { c.x += Math.sign(d) * 18 * dt; c.face = Math.sign(d); c.frame = Math.floor(c.ft * 8); }
  }
}

function updateRat(r, dt) {
  if (r.dead) return;
  const p = g.player;
  r.t -= dt; r.bite -= dt;
  const sameLevel = Math.abs(p.y - r.y) < 6, dx = p.x - r.x;
  if (sameLevel && Math.abs(dx) < 46) {
    r.face = Math.sign(dx) || 1; r.x += r.face * 34 * dt; r.frame = Math.floor(g.t * 12);
    if (Math.abs(dx) < 5 && r.bite <= 0) { r.bite = 1.3; hurt(6, 'A rat bites your ankle.'); Sfx.squeak(); }
  } else {
    if (r.t <= 0) { r.vx = chance(0.5) ? 0 : (chance(0.5) ? -1 : 1) * rnd(10, 30); r.t = rnd(0.5, 2.5); }
    r.x += r.vx * dt; if (r.vx) { r.face = Math.sign(r.vx); r.frame = Math.floor(g.t * 10); }
  }
  r.x = clamp(r.x, w.sewer.x0 * T + 4, (w.sewer.x1 + 1) * T - 4);
  // stomp
  if (p.vy > 60 && Math.abs(p.x - r.x) < 5 && p.y >= r.y - 4 && p.y <= r.y + 1) { r.dead = true; p.vy = -110; Sfx.squeak(); for (let i = 0; i < 4; i++) part(r.x, r.y - 2, rnd(-30, 30), rnd(-60, -20), 0.4, 'dust'); }
}

function updateBird(b, dt) {
  const p = g.player;
  b.frame = Math.floor(g.t * 10);
  if (b.fly > 0) {
    b.fly -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 8 * dt;
    if (b.fly <= 0) { b.vx = 0; b.vy = 0; b.ret = true; }
    return;
  }
  if (b.ret) {
    b.x = lerp(b.x, b.hx, dt * 0.8); b.y = lerp(b.y, b.hy, dt * 0.8);
    if (Math.abs(b.x - b.hx) + Math.abs(b.y - b.hy) < 2) { b.ret = false; b.x = b.hx; b.y = b.hy; }
    return;
  }
  b.peck -= dt; if (b.peck < 0) { b.peck = rnd(1, 4); if (chance(0.4)) b.face *= -1; }
  if (Math.abs(p.x - b.x) < 26 && Math.abs(p.y - b.y) < 16 && !(g.lamDone && Math.abs(b.hx - w.coop.x - 20) < 40)) {
    b.fly = rnd(4, 7); b.vx = (b.x > p.x ? 1 : -1) * rnd(50, 80); b.vy = rnd(-50, -30); b.face = Math.sign(b.vx);
    if (chance(0.3)) Sfx.hiss(0.3, 1800, 0.05, 1);
  }
}

// ---------- tiles and the player ----------
function tileAt(tx, ty) { if (tx < 0 || tx >= w.W) return WALL; if (ty < 0) return AIR; if (ty >= w.H) return GRND; return w.tiles[ty * w.W + tx]; }
const isSolid = (t) => t === WALL || t === GRND;
const isLadder = (t) => t === LAD || t === LADF;
function platTop(tx, ty) { const t = tileAt(tx, ty); return t === PLAT || t === LADF || (t === LAD && !isLadder(tileAt(tx, ty - 1))); }
function canFit(x, y) {
  const x0 = Math.floor((x - PWID) / T), x1 = Math.floor((x + PWID - 0.01) / T), y0 = Math.floor((y - PHGT) / T), y1 = Math.floor((y - 0.01) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(tx, ty))) return false;
  return true;
}
function moveX(p, dx) {
  if (!dx) return;
  let nx = p.x + dx;
  const edge = dx > 0 ? nx + PWID - 0.01 : nx - PWID, tx = Math.floor(edge / T);
  let blocked = false;
  for (let ty = Math.floor((p.y - PHGT) / T); ty <= Math.floor((p.y - 0.01) / T); ty++) if (isSolid(tileAt(tx, ty))) blocked = true;
  if (blocked) {
    const stepY = Math.floor((p.y - 0.01) / T) * T;
    if (p.onGround && !p.climbing && canFit(nx, stepY)) { p.y = stepY; p.x = nx; p.stepT = 0.08; return; }
    nx = dx > 0 ? tx * T - PWID : (tx + 1) * T + PWID;
    p.vx = 0;
  }
  p.x = nx;
}
function moveY(p, dy) {
  const x0 = Math.floor((p.x - PWID) / T), x1 = Math.floor((p.x + PWID - 0.01) / T);
  let ny = p.y + dy;
  if (dy > 0) {
    const r0 = Math.ceil((p.y - 0.01) / T), r1 = Math.floor(ny / T);
    for (let ry = r0; ry <= r1; ry++) {
      const top = ry * T;
      let land = false;
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(tx, ry);
        if (isSolid(t)) land = true;
        else if (!p.climbing && p.dropT <= 0 && platTop(tx, ry) && p.y <= top + 0.01) land = true;
      }
      if (land) { p.y = top; p.vy = 0; return true; }
    }
    p.y = ny; return false;
  }
  const r0 = Math.floor((p.y - PHGT) / T), r1 = Math.floor((ny - PHGT) / T);
  for (let ry = r0; ry >= r1; ry--) {
    for (let tx = x0; tx <= x1; tx++) if (isSolid(tileAt(tx, ry)) && ry !== r0) { p.y = (ry + 1) * T + PHGT; p.vy = 0; return false; }
  }
  p.y = ny; return false;
}
function groundBelow(p) {
  const ry = Math.floor((p.y + 0.5) / T);
  if (Math.abs(p.y - ry * T) > 0.6) return false;
  const x0 = Math.floor((p.x - PWID) / T), x1 = Math.floor((p.x + PWID - 0.01) / T);
  for (let tx = x0; tx <= x1; tx++) { if (isSolid(tileAt(tx, ry))) return true; if (p.dropT <= 0 && platTop(tx, ry)) return true; }
  return false;
}
function ladderAt(p) {
  const tx = Math.floor(p.x / T);
  return isLadder(tileAt(tx, Math.floor((p.y - 1) / T))) || isLadder(tileAt(tx, Math.floor((p.y - 6) / T)));
}

function updatePlayer(dt) {
  const p = g.player;
  const busy = UI.dialogOpen || g.mode !== 'play';
  const L = !busy && (keyDown('a') || keyDown('ArrowLeft')), Rt = !busy && (keyDown('d') || keyDown('ArrowRight'));
  const U = !busy && (keyDown('w') || keyDown('ArrowUp')), D = !busy && (keyDown('s') || keyDown('ArrowDown'));
  const J = !busy && (tap(' ') || tap('z'));
  const run = !busy && keyDown('Shift') && g.stam > 5;
  p.dropT -= dt; p.hurtT -= dt;
  const bucket = p.carry.find((c) => c.icon === 'bucket' && c.full);
  const hungry = g.food < 20 ? 1.6 : 1;
  const tx = Math.floor(p.x / T);

  if (p.climbing) {
    p.vx = 0; p.vy = 0;
    if (U) p.vy = -34; if (D) p.vy = 42;
    if (p.vy) { g.stam -= (p.vy < 0 ? 6 : 2) * (bucket ? 1.6 : 1) * hungry * dt; p.ft += dt; if (p.ft > 0.18) { p.ft = 0; p.frame++; Sfx.clank(); } }
    else g.stam += 2 * dt;
    p.x = tx * T + 4;
    if (p.vy < 0) {
      p.y += p.vy * dt;
      if (!isLadder(tileAt(tx, Math.floor((p.y - 0.5) / T)))) { p.y = Math.ceil(p.y / T) * T; p.climbing = false; p.onGround = true; }
    } else if (p.vy > 0) {
      const landed = moveY(p, p.vy * dt);
      if (landed || !ladderAt(p)) { if (!ladderAt(p)) p.climbing = false; }
    }
    if ((L || Rt) && groundBelow(p)) { p.climbing = false; }
    if (J) { p.climbing = false; p.vy = -110; p.vx = (Rt ? 1 : L ? -1 : 0) * 50; }
    if (g.stam <= 0 && p.climbing) { p.climbing = false; p.vy = 20; g.stam = 0; toast('Your grip goes.'); Sfx.hurt(); }
    p.airTop = p.y;
  } else {
    const want = (Rt ? 1 : 0) - (L ? 1 : 0);
    const sp = (run ? 80 : 50) * (p.inWater ? 0.6 : 1) * (bucket ? 0.85 : 1);
    p.vx = lerp(p.vx, want * sp, Math.min(1, dt * (p.onGround ? 18 : 6)));
    if (want) p.face = want;
    if (run && want && p.onGround) g.stam -= 7 * hungry * dt;
    if (U && ladderAt(p) && g.stam > 3) { p.climbing = true; p.vx = 0; return; }
    if (D && p.onGround) {
      const ry = Math.round(p.y / T);
      if (isLadder(tileAt(tx, ry))) { p.climbing = true; p.y += 2; p.x = tx * T + 4; return; }
      if (tileAt(Math.floor((p.x - PWID) / T), ry) === PLAT || tileAt(Math.floor((p.x + PWID - 0.01) / T), ry) === PLAT) { p.dropT = 0.25; p.onGround = false; }
    }
    if (J && p.onGround) { p.vy = -168; p.onGround = false; Sfx.step(); }
    p.vy = Math.min(p.vy + 560 * dt, 330);
    moveX(p, p.vx * dt);
    const wasGround = p.onGround;
    const landed = p.vy >= 0 ? moveY(p, p.vy * dt) : moveY(p, p.vy * dt);
    p.onGround = landed || (p.vy >= 0 && groundBelow(p));
    if (!p.onGround) p.airTop = Math.min(p.airTop, p.y);
    if (p.onGround && !wasGround) land(p);
    if (p.onGround) {
      p.airTop = p.y;
      if (Math.abs(p.vx) > 4) { p.ft += dt * Math.abs(p.vx) / 50; if (p.ft > 0.13) { p.ft = 0; p.frame++; if (p.frame % 2) Sfx.step(tileAt(tx, Math.round(p.y / T)) === PLAT); } }
      g.stam += (Math.abs(p.vx) > 4 ? (run ? 0 : 5) : 13) * dt;
    }
  }
  g.stam = clamp(g.stam, 0, 100);
  p.x = clamp(p.x, 6, w.W * T - 6);
  p.inWater = p.y > w.sewer.y1 * T + 4 && p.y <= (w.sewer.y1 + 1) * T && p.x > w.sewer.x0 * T;
  if (p.inWater && Math.abs(p.vx) > 10 && chance(dt * 6)) part(p.x, p.y - 1, rnd(-20, 20), rnd(-40, -10), 0.4, 'splash');
}

function land(p) {
  const d = p.y - p.airTop;
  g.lastFall = d;
  if (d > 44) {
    const soft = p.inWater ? 0.5 : 1;
    const dmg = Math.round((d - 44) * 0.42 * soft);
    Sfx.thud(); g.shake = Math.min(4, d / 40);
    for (let i = 0; i < 6; i++) part(p.x, p.y - 1, rnd(-40, 40), rnd(-50, -10), 0.5, 'dust');
    if (dmg > 0) hurt(dmg, d > 140 ? 'Something in you cracks.' : d > 90 ? 'That was a long way down.' : '');
    const b = p.carry.find((c) => c.icon === 'bucket' && c.full);
    if (b && d > 52) { b.full = false; toast('The water is gone. All of it.'); Sfx.splash(); for (let i = 0; i < 14; i++) part(p.x, p.y - 6, rnd(-70, 70), rnd(-90, -20), 0.7, 'splash'); }
  } else if (d > 6) Sfx.step();
}

function hurt(n, msg) {
  const p = g.player;
  if (n <= 0) return;
  g.hp -= n; p.hurtT = 0.5; g.shake = Math.max(g.shake, 2); Sfx.hurt();
  if (msg) toast(msg);
}

// ---------- jobs ----------
function makeOffers(first) {
  const offers = g.npcs.filter((n) => n.offer && n.offer.stage === 'offered').length;
  const want = 7;
  const cands = g.npcs.filter((n) => !n.offer && n.room && n.role !== 'landlord' && n.role !== 'lam' && npcPresence(n, g.time) === 'awake');
  if (first) {
    // one neighbour near your room, so the first step is obvious
    const yr = w.yours;
    const nb = cands.filter((n) => n.room.b === yr.b && n.room.k === 0 && n.kind !== 'kid').concat(cands.filter((n) => n.room.b === yr.b && n.kind !== 'kid'));
    if (nb.length) createJob(nb[0], 'deliver');
  }
  for (let i = offers; i < want && cands.length; i++) {
    const n = cands.splice(Math.floor(R() * cands.length), 1)[0];
    if (n.offer) continue;
    let type = 'deliver';
    if (n.kind === 'kid') type = 'cat';
    else if (n.room.k >= 6 && chance(0.45)) type = 'water';
    else if (chance(0.12)) type = 'cat';
    createJob(n, type);
  }
}

function createJob(n, type) {
  const j = { id: Math.random().toString(36).slice(2, 7), type, giver: n, stage: 'offered', born: g.day * 24 + g.time };
  const gb = w.blds[n.room.b];
  if (type === 'deliver') {
    const far = g.npcs.filter((m) => m !== n && m.room && m.role !== 'lam' && m.room.type !== 'stair' && (m.room.b !== n.room.b || Math.abs(m.room.k - n.room.k) >= 3) && Math.abs(m.x - n.x) < 900);
    if (!far.length) return null;
    j.target = pick(far);
    j.item = Object.assign({}, pick(ITEMS[n.role] || ITEMS.default));
    const dd = Math.abs(j.target.x - n.x) + Math.abs(j.target.y - n.y) * 2.2;
    j.reward = Math.round(clamp(6 + dd / 45, 7, 26));
    j.tl = w.blds[j.target.room.b].letter; j.tf = fl(j.target.room.k);
  } else if (type === 'water') {
    j.reward = Math.round(12 + n.room.k * 1.6);
  } else if (type === 'cat') {
    j.catName = pick(CAT_NAMES);
    const spots = w.rooms.filter((r) => (r.type === 'empty' || (r.type === 'stair' && chance(0.1))) && Math.abs(r.x0 * T - n.x) < 700 && r.k < n.room.k + 2);
    let x, y, b;
    if (spots.length && chance(0.65)) { const r = pick(spots); x = rnd(r.x0 * T + 6, (r.x1 + 1) * T - 6); y = (r.y1 + 1) * T; b = r.b; }
    else { x = clamp(n.x + rnd(-300, 300), w.sewer.x0 * T + 20, w.sewer.x1 * T - 20); y = (w.sewer.y1 + 1) * T; b = n.room.b; }
    j.cat = makeCat(x, y, pick(['orange', 'black', 'grey', 'calico']));
    j.cat.lost = j; g.cats.push(j.cat);
    j.tl = w.blds[b].letter;
    j.reward = 16;
  } else if (type === 'fuse') {
    j.block = n.room ? w.blds[n.room.b].block : 0;
    j.fuse = w.objs.find((o) => o.kind === 'fuse' && o.block === j.block);
    j.reward = 20;
  }
  j.gl = gb.letter; j.gf = fl(n.room.k);
  j.text = JOB_TEXT[type](j);
  n.offer = j;
  return j;
}

function jobTitle(j) {
  switch (j.type) {
    case 'deliver': return { t: `Bring ${j.item.name} to ${j.target.name}`, w: `${j.tl} · ${j.tf}` };
    case 'water': { const b = g.player.carry.find((c) => c.job === j); return { t: b && b.full ? `Carry the water up to ${j.giver.name}` : 'Fill the bucket at the standpipe', w: b && b.full ? `${j.gl} · ${j.gf}` : 'Alley · G/F' }; }
    case 'cat': return j.cat.follow ? { t: `Bring ${j.catName} home to ${j.giver.name}`, w: `${j.gl} · ${j.gf}` } : { t: `Find ${j.catName}`, w: `somewhere near ${j.tl}` };
    case 'fuse': return { t: 'Fix the fuse box in the drains', w: `under Block ${w.blds.find((b) => b.block === j.block).letter}` };
  }
  return { t: '?', w: '' };
}
function jobTarget(j) {
  switch (j.type) {
    case 'deliver': return j.target;
    case 'water': { const b = g.player.carry.find((c) => c.job === j); return b && b.full ? j.giver : w.objs.find((o) => o.kind === 'standpipe'); }
    case 'cat': return j.cat.follow ? j.giver : j.cat;
    case 'fuse': return { x: j.fuse.x + 4, y: j.fuse.y };
  }
  return null;
}

function acceptJob(j) {
  j.stage = 'active';
  g.jobs.push(j);
  if (j.type === 'deliver') g.player.carry.push(Object.assign({ job: j }, j.item));
  if (j.type === 'water') g.player.carry.push({ job: j, icon: 'bucket', name: 'a bucket', full: false });
  Sfx.ui();
  toast('New task: ' + jobTitle(j).t);
  UI.tasks();
}

function completeJob(j, payer) {
  j.stage = 'done';
  g.jobs = g.jobs.filter((x) => x !== j);
  g.player.carry = g.player.carry.filter((c) => c.job !== j);
  if (j.giver.offer === j) j.giver.offer = null;
  g.coins += j.reward; g.done++;
  Sfx.coin();
  const lines = [{ name: payer.name, text: pick(THANKS) + ` (+$${j.reward})` }];
  if (g.lamStage < 4 && !g.lamDone) {
    lines.push({ name: payer.name, text: LAM_CLUES[g.lamStage].replace('{b}', w.blds[w.coop.b].letter) });
    g.lamStage++;
    if (g.lamStage === 4) setTimeout(() => toast(`Lam Siu-ying: the highest roof, Block ${w.blds[w.coop.b].letter}.`), 400);
  }
  UI.tasks();
  return lines;
}

function failJobsOnCollapse() {
  for (const j of g.jobs.slice()) {
    if (j.type === 'deliver' || j.type === 'water') { g.jobs = g.jobs.filter((x) => x !== j); if (j.giver.offer === j) j.giver.offer = null; }
  }
  g.player.carry = g.player.carry.filter((c) => !c.job || g.jobs.includes(c.job));
}

// ---------- interaction ----------
function dist(a, b) { return Math.hypot(a.x - b.x, (a.y - b.y) * 1.6); }

function findInteract() {
  const p = g.player;
  let best = null, bd = 18;
  for (const n of g.npcs) {
    if (n.presence === 'gone') continue;
    if (Math.abs(n.y - p.y) > 6 && !(n.sit && Math.abs(n.y - p.y) < 9)) continue;
    const d = Math.abs(n.x - p.x);
    if (d < bd) { bd = d; best = { kind: 'npc', n, x: n.x, y: n.y - 14 }; }
  }
  for (const c of g.cats) {
    if (c.follow) continue;
    if (Math.abs(c.y - p.y) > 6) continue;
    const d = Math.abs(c.x - p.x);
    if (d < bd && (c.lost || c.stray || true)) { bd = d; best = { kind: 'cat', c, x: c.x, y: c.y - 10 }; }
  }
  for (const o of w.objs) {
    if (!['bed', 'radio', 'kettle', 'standpipe', 'fuse'].includes(o.kind)) continue;
    if (Math.abs(o.y - p.y) > 6) continue;
    const ox = o.kind === 'standpipe' ? o.x + 3 : o.x;
    const d = Math.abs(ox - p.x) - 5;
    if (d < bd) { bd = d; best = { kind: 'obj', o, x: ox, y: o.y - 16 }; }
  }
  for (const pr of w.props) {
    if (pr.t !== 'altar' && pr.t !== 'counter' && pr.t !== 'shrine') continue;
    if (pr.t === 'counter' && w.rooms[pr.room].type !== 'tea') continue;
    const fy = pr.t === 'shrine' ? (w.rooms[pr.room].y1 + 1) * T : pr.y;
    if (Math.abs(fy - p.y) > 6) continue;
    const d = Math.abs(pr.x + 6 - p.x);
    if (d < bd && pr.t !== 'counter') { bd = d; best = { kind: 'pray', pr, x: pr.x + 6, y: fy - 18 }; }
  }
  return best;
}

function verbFor(it) {
  if (!it) return '';
  if (it.kind === 'npc') {
    const n = it.n;
    if (n.presence === 'sleep') return 'WAKE';
    if (g.jobs.some((j) => (j.type === 'deliver' && j.target === n) || ((j.type === 'water' || j.type === 'cat') && j.giver === n))) return 'GIVE';
    if (n.role === 'vendor' || n.role === 'tea') return 'EAT';
    return 'TALK';
  }
  if (it.kind === 'cat') return it.c.lost ? 'PICK UP' : 'PET';
  if (it.kind === 'pray') return 'INCENSE';
  return { bed: 'SLEEP', radio: g.radioOn ? 'RADIO OFF' : 'RADIO ON', kettle: 'TEA', standpipe: 'FILL', fuse: 'FIX' }[it.o.kind];
}

function interact(it) {
  if (!it) return;
  const p = g.player;
  if (it.kind === 'npc') return talkTo(it.n);
  if (it.kind === 'cat') {
    const c = it.c;
    if (c.lost) { c.follow = true; g.followers.push(c); Sfx.meow(); toast(`${c.lost.catName} decides to come with you.`); UI.tasks(); return; }
    Sfx.meow();
    if (c.stray && !c.follow) {
      c.pets = (c.pets || 0) + 1;
      if (c.pets >= 3) { c.follow = true; g.followers.unshift(c); g.catFriend = c; toast('The orange cat decides you are acceptable.'); }
      else toast(['The cat tolerates you.', 'The cat leans into your hand. Then pretends it did not.'][c.pets - 1]);
    } else toast('It purrs like a small engine.');
    return;
  }
  if (it.kind === 'pray') { Sfx.blip(520, 0.6, 'sine', 0.05); toast(pick(['You light a stick of incense. Nothing happens. You feel slightly better.', 'Smoke goes up. It has nowhere to go. It stays.', 'You ask for nothing in particular.'])); g.stam = Math.min(100, g.stam + 10); return; }
  const o = it.o;
  switch (o.kind) {
    case 'bed': return sleep();
    case 'radio': g.radioOn = !g.radioOn; Sfx.ui(); toast(g.radioOn ? 'The radio crackles into a song you almost know.' : 'The radio clicks off. The rain gets louder.'); return;
    case 'kettle':
      if (g.t - g.kettleT < 40) { toast('The kettle is still warm. You are still full of tea.'); return; }
      g.kettleT = g.t; g.stam = 100; g.food = Math.min(100, g.food + 6); Sfx.hiss(1.2, 3000, 0.04, 2);
      for (let i = 0; i < 8; i++) part(o.x, o.y - 10, rnd(-4, 4), rnd(-16, -8), 1.6, 'steam');
      toast('Tea. Too hot. You drink it anyway, standing by the window that faces a wall.'); return;
    case 'standpipe': {
      const b = p.carry.find((c) => c.icon === 'bucket' && !c.full);
      if (!b) { toast(p.carry.some((c) => c.icon === 'bucket') ? 'The bucket is already full.' : 'Cold water. You drink from your hands.'); if (!p.carry.some((c) => c.icon === 'bucket')) g.stam = Math.min(100, g.stam + 8); return; }
      b.full = true; Sfx.splash(); toast('The bucket fills. It weighs more than it should. Don\'t fall.'); UI.tasks(); return;
    }
    case 'fuse': {
      const j = g.jobs.find((jj) => jj.type === 'fuse' && jj.fuse === o) || (g.power[o.block] === false ? { type: 'fuse', block: o.block, reward: 12, giver: null, fake: true } : null);
      if (!j) { toast('Fuses, wires, a note in faded chalk: DO NOT TOUCH.'); return; }
      Sfx.spark(); g.flash = 0.3;
      for (let i = 0; i < 16; i++) part(o.x + 4, o.y - 15, rnd(-60, 60), rnd(-80, 10), 0.5, 'spark');
      if (chance(0.3)) hurt(8, 'It bites back. You fix it anyway.');
      g.power[o.block] = true;
      if (!j.fake) { g.jobs = g.jobs.filter((x) => x !== j); if (j.giver && j.giver.offer === j) j.giver.offer = null; g.done++; }
      g.coins += j.reward; Sfx.coin();
      toast(`Somewhere above you, a whole block hums back to life. (+$${j.reward})`);
      if (!j.fake && g.lamStage < 4 && !g.lamDone) { g.lamStage++; setTimeout(() => toast('Someone will remember that.'), 1600); }
      UI.tasks(); return;
    }
  }
}

function talkTo(n) {
  const p = g.player;
  n.met = true; Sfx.talk();
  if (n === g.lam) return talkLam();
  if (n.presence === 'sleep') {
    const j = g.jobs.find((jj) => jj.type === 'deliver' && jj.target === n);
    if (j) return UI.talk([{ name: n.name, text: "Mm? Oh. For me? At this hour?" }, ...completeJob(j, n)]);
    return UI.talk([{ name: n.name, text: pick(NIGHT_LINES) }]);
  }
  // deliveries and returns
  for (const j of g.jobs) {
    if (j.type === 'deliver' && j.target === n) return UI.talk([{ name: n.name, text: `${cap(j.item.name)}? From ${j.giver.name}? Finally.` }, ...completeJob(j, n)]);
    if (j.type === 'water' && j.giver === n) {
      const b = p.carry.find((c) => c.job === j);
      if (b && b.full) return UI.talk([{ name: n.name, text: 'All the way up. Not a drop spilled? Liar. Thank you.' }, ...completeJob(j, n)]);
      return UI.talk([{ name: n.name, text: b ? 'The standpipe is in the alley, down on the street. Bring it up full.' : 'You lost my bucket?' }]);
    }
    if (j.type === 'cat' && j.giver === n) {
      if (j.cat.follow && dist(j.cat, p) < 60) {
        g.followers = g.followers.filter((c) => c !== j.cat); j.cat.follow = false; j.cat.lost = null;
        j.cat.x = n.x; j.cat.y = n.y; j.cat.hx = n.x;
        return UI.talk([{ name: n.name, text: `${j.catName}! Where were you? Bad. Bad cat. Come here.` }, ...completeJob(j, n)]);
      }
      return UI.talk([{ name: n.name, text: `Any sign of ${j.catName}? She likes dark places. Empty rooms. The drains.` }]);
    }
  }
  if (n.role === 'landlord') {
    const lines = [{ name: n.name, text: pick(LINES.landlord) }];
    return UI.talk(lines, [{ label: g.coins >= 30 ? 'Pay rent early ($30)' : `Pay rent early ($30, you have $${g.coins})`, fn: () => { if (g.coins >= 30) { g.coins -= 30; g.rentDue += 3; g.strikes = Math.max(0, g.strikes - 1); Sfx.coin(); UI.talk([{ name: n.name, text: 'Good. See you in three days. I always see you.' }]); } else UI.talk([{ name: n.name, text: 'Come back when you have it.' }]); } }, { label: 'Leave', fn: () => {} }]);
  }
  if (n.role === 'vendor' || n.role === 'tea') {
    const price = n.role === 'vendor' ? 5 : 4;
    const food = n.role === 'vendor' ? 'wonton noodles' : 'a pineapple bun and milk tea';
    return UI.talk([{ name: n.name, text: pick(LINES[n.role]) }], [
      { label: `Buy ${food} ($${price})`, fn: () => {
        if (g.coins < price) return UI.talk([{ name: n.name, text: 'No money, no noodles. Come back.' }]);
        g.coins -= price; g.food = Math.min(100, g.food + 45); g.stam = Math.min(100, g.stam + 25); g.hp = Math.min(100, g.hp + 5); g.ate++;
        Sfx.coin();
        for (let i = 0; i < 6; i++) part(p.x, p.y - 10, rnd(-4, 4), rnd(-14, -6), 1.4, 'steam');
        UI.talk([{ name: '', text: n.role === 'vendor' ? 'Steam on your face. For a minute nothing hurts.' : 'Sweet, burnt, too much sugar. You could live on this. People do.' }]);
      } },
      { label: 'Leave', fn: () => {} },
    ]);
  }
  if (n.offer && n.offer.stage === 'offered') {
    const j = n.offer;
    const intro = [{ name: n.name, text: j.text }];
    return UI.talk(intro, [
      { label: g.jobs.length >= 3 ? 'Your hands are full (3 tasks)' : 'Accept', fn: () => { if (g.jobs.length >= 3) return UI.talk([{ name: n.name, text: 'Come back when you have hands.' }]); acceptJob(j); } },
      { label: 'Not now', fn: () => {} },
    ]);
  }
  const bank = LINES[n.role] || LINES[n.kind] || LINES.adult;
  const lines = [{ name: n.name, text: pick(bank).replace('{b}', pick(w.blds).letter) }];
  if (g.letter && !g.lamDone && chance(0.35)) lines.push({ name: n.name, text: g.lamStage >= 4 ? `Lam Siu-ying? Up. Block ${w.blds[w.coop.b].letter}. Everybody knows that.` : 'Lam Siu-ying? Never heard of her. Or maybe. There are a lot of us.' });
  if (g.rain > 0.7 && chance(0.4)) lines.unshift({ name: n.name, text: 'Rain again. The ceiling in my kitchen is crying.' });
  UI.talk(lines);
}

function talkLam() {
  const n = g.lam;
  if (g.lamDone) {
    if (g.teaDay !== g.day) {
      g.teaDay = g.day; g.hp = Math.min(100, g.hp + 30); g.stam = 100; g.food = Math.min(100, g.food + 20);
      return UI.talk([{ name: n.name, text: pick(['Sit. The kettle is on.', "You came back. The birds noticed before I did.", 'Tea. Then you can go back down.']) }, { name: '', text: "She doesn't talk much. Neither do you. A plane goes over and you both duck, then laugh at yourselves." }]);
    }
    return UI.talk([{ name: n.name, text: pick(["Go on. They need you down there. Somebody always does.", 'The birds always come back. Funny. Nobody tells them to.']) }]);
  }
  if (!g.letter) return UI.talk([{ name: n.name, text: 'Mind the birds.' }]);
  UI.talk([
    { name: n.name, text: 'Mind the birds. Who are you? Nobody comes up here who isn\'t lost.' },
    { name: '', text: 'You give her the letter. She looks at the handwriting a long time before she opens it.' },
    { name: n.name, text: 'My sister. Forty years and she writes like a schoolgirl.' },
    { name: n.name, text: '...She says you need somewhere to belong. She always did say what other people needed.' },
    { name: n.name, text: 'Well. Stay, then. Come up for tea when the planes get too loud. They will.' },
  ], null, () => {
    g.lamDone = true; g.letter = false;
    UI.story(['From up here the city is ten thousand lit windows.', 'You know what is behind some of them now.', 'It is still enormous. It still does not notice you.', 'But you are in it.'], () => { toast('The rooftop is yours too, now. Come back for tea.'); UI.tasks(); });
  });
}

// ---------- time, needs, events ----------
function sleep() {
  const h = g.time;
  if (!(h >= 20 || h < 5) && g.stam > 30) { toast("It's too bright to sleep. Something out there still needs doing."); return; }
  const cat = g.catFriend;
  UI.story([pick(SLEEP_TEXT)], () => {}, true);
  setTimeout(() => {
    const nightSleep = h >= 20 || h < 5;
    if (nightSleep) advanceTo(6.3); else advanceHours(3);
    g.stam = 100; g.hp = Math.min(100, g.hp + 35); g.food = Math.max(0, g.food - 18);
    if (cat) { cat.x = g.player.x + 8; cat.y = g.player.y; }
  }, 900);
}
function advanceHours(hrs) { let left = hrs; while (left > 0) { const s = Math.min(0.25, left); tickClock(s); left -= s; } }
function advanceTo(h) { let d = h - g.time; if (d <= 0) d += 24; advanceHours(d); }

function tickClock(dh) {
  const before = g.time;
  g.time += dh;
  if (g.time >= 24) { g.time -= 24; g.day++; }
  if (before < 6 && g.time >= 6 && g.day >= g.rentDue) collectRent();
}
function collectRent() {
  g.rentDue = g.day + 3;
  if (g.coins >= 30) { g.coins -= 30; toast('A note under your door: RENT RECEIVED. — Ko'); g.strikes = 0; }
  else {
    g.strikes++;
    g.coins = 0;
    if (g.strikes >= 2) { gameOver(); return; }
    toast('A note under your door: RENT. THREE DAYS. LAST TIME. — Ko');
  }
}

function gameOver() {
  g.mode = 'over';
  UI.story([
    'Mr. Ko gave your room to a family of five before your bag hit the stairs.',
    'The city did not notice. It never does.',
    `You lasted ${g.day} days. You did ${g.done} favours for people whose names you mostly remember.`,
  ], () => { UI.over(); });
}

function die() {
  g.deadT = 1;
  failJobsOnCollapse();
  UI.story([pick(DEATH_TEXT), 'You wake up in the clinic. The doctor charges you half of everything. She says it\'s a discount.'], () => {
    const c = g.clinic;
    const p = g.player;
    p.x = (c.x0 + 1) * T + 4; p.y = (c.y1 + 1) * T; p.vx = p.vy = 0; p.climbing = false; p.airTop = p.y;
    g.coins = Math.floor(g.coins / 2); g.hp = 60; g.food = Math.max(g.food, 40); g.stam = 100; g.deadT = 0;
    advanceHours(8);
    for (const f of g.followers) { f.x = p.x + 10; f.y = p.y; }
    snapCam();
  });
}

function updateNeeds(dt) {
  g.food -= dt * 100 / (DAY_SEC * 1.15);
  if (g.food <= 0) { g.food = 0; g.hp -= dt * 0.5; if (chance(dt * 0.05)) toast('Your stomach has stopped asking.'); }
  else if (g.food > 35) g.hp = Math.min(100, g.hp + dt * 0.15);
  if (g.hp <= 0 && !g.deadT && g.mode === 'play') die();
}

function startPowerCut() {
  const bi = irnd(0, w.blocks.length - 1);
  if (g.power[bi] === false) return;
  g.power[bi] = false;
  g.cutT = g.cutT || {}; g.cutT[bi] = 240;
  const people = g.npcs.filter((n) => n.room && w.blds[n.room.b].block === bi && !n.offer && n.kind !== 'kid' && n.role !== 'landlord');
  if (people.length) createJob(pick(people), 'fuse');
  const p = g.player, pb = buildingAt(p.x, p.y);
  if (pb && pb.block === bi) toast('The lights die. All of them. Somebody screams, then laughs.');
  else toast('Somewhere, a whole block has gone dark.');
  Sfx.hiss(0.5, 200, 0.2, 1);
}
function buildingAt(x, y) { const tx = Math.floor(x / T); return w.blds.find((b) => tx >= b.x0 && tx <= b.x1 && y / T >= b.roof - 6); }

function updateEvents(dt) {
  g.nextOffer -= dt;
  if (g.nextOffer <= 0) { g.nextOffer = 45; makeOffers(false); }
  // stale offers fade
  for (const n of g.npcs) if (n.offer && n.offer.stage === 'offered' && g.day * 24 + g.time - n.offer.born > 30) { if (n.offer.cat) g.cats = g.cats.filter((c) => c !== n.offer.cat); n.offer = null; }
  for (const k in g.cutT || {}) {
    if (g.power[k] !== false) continue;
    g.cutT[k] -= dt;
    if (g.cutT[k] <= 0) {
      g.power[k] = true;
      for (const n of g.npcs) if (n.offer && n.offer.type === 'fuse' && n.offer.block === +k) { if (n.offer.stage === 'active') g.jobs = g.jobs.filter((j) => j !== n.offer); n.offer = null; }
      toast('Somebody else fixed the fuses. The lights come back without you.');
      UI.tasks();
    }
  }
  g.nextPower -= dt;
  if (g.nextPower <= 0) { g.nextPower = rnd(150, 300); startPowerCut(); }
  // weather drifts
  if (chance(dt * 0.01)) g.rainTarget = chance(0.25) ? 0 : chance(0.5) ? rnd(0.3, 0.6) : rnd(0.7, 1);
  g.rain = lerp(g.rain, g.rainTarget, dt * 0.05);
  if (g.rain > 0.75 && chance(dt * 0.025)) { g.flash = 1; setTimeout(() => Sfx.thunder(), rnd(400, 1800)); }
  g.flash = Math.max(0, g.flash - dt * 2.5);
  // planes
  g.nextPlane -= dt;
  if (!g.plane && g.nextPlane <= 0) {
    const top = Math.min(...w.blds.map((b) => b.roof)) * T;
    g.plane = { x: -320, y: top - 110, vx: 150, t: 0 };
    g.nextPlane = rnd(60, 110);
    for (const n of g.npcs) if (n.presence === 'awake' && Math.abs(n.x - g.player.x) < 200 && Math.abs(n.y - g.player.y) < 120 && chance(0.6)) n.bark = { text: pick(['...', '!', 'HM']), t: 3 };
  }
  if (g.plane) {
    const pl = g.plane;
    pl.x += pl.vx * dt; pl.y += 6 * dt; pl.t += dt;
    const cx = g.cam.x + VW / 2, cy = g.cam.y + VH / 2;
    const px = pl.x + 150, dx = Math.abs(px - cx) / 600, dy = Math.max(0, (cy - pl.y)) / 900;
    const prox = clamp(1 - dx, 0, 1) * clamp(1 - dy, 0.15, 1);
    g.planeProx = prox;
    g.shake = Math.max(g.shake, prox * prox * 2.2);
    if (prox > 0.7 && chance(dt * 6)) dustFromCeiling();
    if (prox > 0.85 && !pl.said) { pl.said = true; const n = g.npcs.find((m) => m.presence === 'awake' && Math.abs(m.x - g.player.x) < 60 && Math.abs(m.y - g.player.y) < 10); if (n) n.bark = { text: pick(['HERE IT COMES', 'HOLD THE CUPS', '...', '!']), t: 2 }; }
    if (pl.x > w.W * T + 60) { g.plane = null; g.planeProx = 0; }
  } else g.planeProx = 0;
  // live wires
  for (const wr of w.wires) {
    if (!wr.live) continue;
    wr.on = Math.sin(g.t * 1.7 + wr.ph) > 0.55 && g.power[wireBlock(wr)] !== false;
    if (wr.on && chance(dt * 8)) { const t = rnd(0.3, 0.7); const sx2 = lerp(wr.x0, wr.x1, t), sy2 = wr.y + Math.sin(t * Math.PI) * wr.sag; part(sx2, sy2, rnd(-50, 50), rnd(-40, 30), 0.3, 'spark'); if (Math.abs(sx2 - g.player.x) < 120 && chance(0.3)) Sfx.spark(); }
    if (wr.on) {
      const p = g.player, t = (p.x - wr.x0) / (wr.x1 - wr.x0);
      if (t > 0 && t < 1) { const wy = wr.y + Math.sin(t * Math.PI) * wr.sag; if (wy > p.y - PHGT - 1 && wy < p.y && p.hurtT <= 0) { hurt(14, 'The wire is live.'); p.vx = -p.face * 90; p.vy = -60; p.onGround = false; for (let i = 0; i < 10; i++) part(p.x, wy, rnd(-60, 60), rnd(-60, 20), 0.4, 'spark'); } }
    }
  }
  // drips
  if (chance(dt * 3)) spawnDrip();
}
function wireBlock(wr) { const x = wr.x0 / T; const b = w.blds.find((bb) => Math.abs(bb.x1 - x) < 2 || Math.abs(bb.x0 - x) < 2); return b ? b.block : -1; }

function dustFromCeiling() {
  const x = g.cam.x + rnd(0, VW), tx = Math.floor(x / T);
  for (let ty = Math.floor(g.cam.y / T); ty < (g.cam.y + VH) / T; ty++) {
    if (isSolid(tileAt(tx, ty)) && tileAt(tx, ty + 1) === AIR) { for (let i = 0; i < 3; i++) part(x + rnd(-2, 2), (ty + 1) * T, rnd(-3, 3), rnd(5, 20), 1.2, 'dust'); return; }
  }
}
function spawnDrip() {
  const x = g.cam.x + rnd(0, VW), tx = Math.floor(x / T);
  for (let ty = Math.floor(g.cam.y / T); ty < (g.cam.y + VH) / T; ty++) {
    const i = ty * w.W + tx;
    if (isSolid(tileAt(tx, ty)) && tileAt(tx, ty + 1) === AIR && (w.bg[i + w.W] !== B_ROOM || hash2(tx, ty) < 0.25)) { part(tx * T + 2 + hash2(tx, 9) * 4, (ty + 1) * T, 0, 0, 3, 'drip'); return; }
  }
}

// ---------- particles ----------
function part(x, y, vx, vy, life, type) { if (g.parts.length < 500) g.parts.push({ x, y, vx, vy, life, max: life, type }); }
function poof(x, y) { for (let i = 0; i < 5; i++) part(x, y, rnd(-20, 20), rnd(-20, 5), 0.4, 'dust'); }
function updateParts(dt) {
  for (const q of g.parts) {
    q.life -= dt;
    if (q.type === 'steam') { q.x += q.vx * dt + Math.sin(g.t * 3 + q.y) * 0.1; q.y += q.vy * dt; continue; }
    if (q.type === 'drip') {
      q.vy += 380 * dt; q.y += q.vy * dt;
      if (isSolid(tileAt(Math.floor(q.x / T), Math.floor(q.y / T))) || tileAt(Math.floor(q.x / T), Math.floor(q.y / T)) === PLAT) {
        q.life = 0; for (let i = 0; i < 2; i++) part(q.x, Math.floor(q.y / T) * T, rnd(-15, 15), rnd(-35, -15), 0.25, 'splash');
        const d = Math.hypot(q.x - g.player.x, q.y - g.player.y); if (d < 140) Sfx.drip(1 - d / 140);
      }
      continue;
    }
    q.vy += (q.type === 'dust' ? 40 : 300) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
  }
  g.parts = g.parts.filter((q) => q.life > 0);
  // ambient steam from vats, stalls and kettles
  if (chance(dt * 4)) for (const pr of w.props) if ((pr.t === 'vat' || pr.t === 'stove' || pr.t === 'incense') && Math.abs(pr.x - g.player.x) < 220 && Math.abs(pr.y - g.player.y) < 130 && chance(0.4)) part(pr.x + rnd(1, pr.w - 1), pr.y - (pr.t === 'incense' ? 11 : 9), rnd(-2, 2), rnd(-12, -6), pr.t === 'incense' ? 2.5 : 1.5, 'steam');
  if (chance(dt * 3)) for (const o of w.objs) if (o.kind === 'stall' && Math.abs(o.x - g.player.x) < 220) part(o.x + rnd(4, 16), o.y - 15, rnd(-2, 2), rnd(-14, -8), 1.6, 'steam');
}
function updateRain(dt) {
  const want = Math.floor(260 * g.rain);
  while (g.drops.length < want) g.drops.push({ x: g.cam.x + rnd(-20, VW + 40), y: g.cam.y + rnd(-VH, VH), vy: rnd(260, 340) });
  if (g.drops.length > want) g.drops.length = want;
  for (const d of g.drops) {
    d.y += d.vy * dt; d.x -= 30 * dt;
    const tx = Math.floor(d.x / T), ty = Math.floor(d.y / T);
    const t = tileAt(tx, ty), b = ty >= 0 && ty < w.H && tx >= 0 && tx < w.W ? w.bg[ty * w.W + tx] : B_SKY;
    const hit = isSolid(t) || t === PLAT;
    if (hit || b === B_ROOM || b === B_SEWER || d.y > g.cam.y + VH + 10 || d.x < g.cam.x - 30) {
      if (hit && b !== B_ROOM && chance(0.5)) part(d.x, ty * T, rnd(-15, 15), rnd(-40, -15), 0.2, 'splash');
      d.x = g.cam.x + rnd(-20, VW + 40); d.y = g.cam.y - rnd(4, 60);
      const sx2 = Math.floor(d.x / T), sy2 = Math.floor(d.y / T);
      if (sy2 >= 0 && sx2 >= 0 && sx2 < w.W && w.bg[sy2 * w.W + sx2] === B_ROOM) d.y = g.cam.y + VH + 100;
    }
  }
}

// ---------- step ----------
function step(dt) {
  g.t += dt;
  if (g.mode === 'title' || g.mode === 'story0') { g.titleT = (g.titleT || 0) + dt; updateEvents(dt * 0.6); return; }
  if (g.mode === 'zoom') { g.zoomT += dt; updateEvents(dt); updateRain(dt); if (g.zoomT > 5.2) { g.mode = 'play'; UI.hud(true); UI.tasks(); toast('Your room is on the fifth floor. Find the stairwell ladder.'); } return; }
  if (g.mode === 'over') return;
  const paused = UI.storyOpen || g.mapZoom;
  if (tap('m') || tap('Tab')) { if (!UI.dialogOpen && !UI.storyOpen) { g.mapZoom = (g.mapZoom + 1) % 3; Sfx.ui(); } }
  if (tap('Escape') && g.mapZoom) g.mapZoom = 0;
  if (tap('h')) UI.toggleHelp();
  if (tap('n')) { Sfx.setMuted(Sfx.on); toast(Sfx.on ? 'Sound on.' : 'Sound off.'); }
  if (paused) { updateAudio(dt, true); return; }
  let used = false;
  if (UI.dialogOpen) {
    used = true;
    if (tap('e') || tap('Enter') || tap(' ') || tap('1')) UI.advance(0);
    else if (tap('2') || tap('q')) UI.advance(1);
    else if (tap('Escape')) UI.close();
    if (!UI.dialogOpen) g.pressed = {};
  }
  if (tap('f') && g.jobs.length > 1) { g.jobs.push(g.jobs.shift()); UI.tasks(); Sfx.ui(); }
  const spd = keyDown('t') && !UI.dialogOpen ? 8 : 1;
  tickClock(dt * 24 / DAY_SEC * spd);
  updatePlayer(dt);
  g.focus = UI.dialogOpen ? null : findInteract();
  if (!used && !UI.dialogOpen && (tap('e') || tap('Enter')) && g.focus) interact(g.focus);
  const p = g.player;
  for (const n of g.npcs) if (Math.abs(n.x - p.x) < 520 && Math.abs(n.y - p.y) < 360) updateNPC(n, dt); else n.presence = npcPresence(n, g.time);
  for (const c of g.cats) if (c.follow || Math.abs(c.x - p.x) < 520) updateCat(c, dt);
  if (p.y > w.G * T) for (const r of g.rats) updateRat(r, dt);
  for (const b of g.birds) if (Math.abs(b.x - p.x) < 520) updateBird(b, dt);
  updateNeeds(dt);
  updateEvents(dt);
  updateParts(dt);
  updateRain(dt);
  updateCam(dt);
  updateAudio(dt, false);
  updateLights();
  if (Math.floor(g.t * 10) !== Math.floor((g.t - dt) * 10)) UI.hud();
  if (Math.floor(g.t) !== Math.floor(g.t - dt)) UI.tasks();
  UI.el.help.style.visibility = UI.dialogOpen ? 'hidden' : '';
}

function updateLights() {
  const h = g.time;
  for (const L of w.lights) {
    if (L.room === undefined) { L.on = L.sewer ? true : L.kind === 'neon' ? g.power[blockOfX(L.x)] !== false : true; continue; }
    const r = w.rooms[L.room];
    const b = w.blds[r.b];
    if (g.power[b.block] === false && L.kind !== 'candle') { L.on = false; continue; }
    let on = true;
    if (['tea', 'noodle', 'fishball', 'sewing', 'metal', 'dentist', 'clinic', 'barber', 'grocer', 'school'].includes(r.type)) on = !(h >= 22 || h < 7) || (r.type === 'tea' && h < 1);
    if (r.type === 'home') on = !(h >= 0.5 && h < 6) || hash2(L.room, g.day) < 0.2;
    L.on = on;
  }
}
function blockOfX(x) { const tx = x / T; for (const b of w.blds) if (tx >= b.x0 - 3 && tx <= b.x1 + 3) return b.block; return -1; }

function updateCam(dt) {
  const p = g.player;
  const tx = p.x - VW / 2 + p.face * 18, ty = p.y - VH / 2 - 8;
  g.cam.x = lerp(g.cam.x, tx, Math.min(1, dt * 5));
  g.cam.y = lerp(g.cam.y, ty, Math.min(1, dt * (p.climbing ? 6 : 4)));
  g.cam.x = clamp(g.cam.x, 0, w.W * T - VW); g.cam.y = clamp(g.cam.y, 0, w.H * T - VH);
  g.shake = Math.max(0, g.shake - dt * 3);
}
function snapCam() { const p = g.player; g.cam.x = clamp(p.x - VW / 2, 0, w.W * T - VW); g.cam.y = clamp(p.y - VH / 2 - 8, 0, w.H * T - VH); }

function updateAudio(dt, quiet) {
  if (!Sfx.ctx) return;
  const p = g.player;
  const tx = Math.floor(p.x / T), ty = Math.floor((p.y - 6) / T);
  let e = 0, n = 0;
  for (let dy = -4; dy <= 4; dy += 2) for (let dx = -8; dx <= 8; dx += 2) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < w.W && y < w.H) { e += w.exp[y * w.W + x]; n++; } }
  e /= n;
  const inside = 1 - e;
  Sfx.set(Sfx.rainG, g.mode === 'title' ? 0.25 * g.rain : g.rain * (0.08 + e * 0.5) + g.flash * 0.1);
  Sfx.set(Sfx.humG, quiet ? 0.004 : 0.012 * inside);
  Sfx.set(Sfx.rumbleG, 0.18 + 0.1 * inside);
  const pp = g.planeProx || 0;
  Sfx.set(Sfx.planeG, pp * pp * 1.1, 0.2); Sfx.set(Sfx.whineG, pp * pp * 0.05, 0.2);
  if (Sfx.planeF) Sfx.planeF.frequency.setTargetAtTime(150 + pp * 700, Sfx.ctx.currentTime, 0.3);
  // radio in your room
  const yr = w.yours, rx = (yr.x0 + 2) * T, ry = (yr.y1 + 1) * T;
  const d = Math.hypot(p.x - rx, (p.y - ry) * 2.5);
  Sfx.radioTick(g.radioOn && g.mode === 'play' ? clamp(1 - d / 220, 0, 1) * 0.5 : 0);
  // mahjong clatter nearby
  if (!quiet && chance(dt * 1.5)) {
    let best = 1e9;
    for (const r of w.rooms) if (r.type === 'mahjong') { const dd = Math.hypot(p.x - (r.x0 + r.x1) * T / 2, (p.y - (r.y1 + 1) * T) * 2); if (dd < best) best = dd; }
    if (best < 200) Sfx.clack(1 - best / 200);
  }
  if (!quiet && g.catFriend && chance(dt * 0.02)) Sfx.meow();
  if (!quiet && chance(dt * 0.05)) { const b = g.birds.find((bb) => Math.abs(bb.x - p.x) < 120 && Math.abs(bb.y - p.y) < 60); if (b) Sfx.coo(); }
}

// ---------- rendering ----------
const SKY_KEYS = [
  [0, '#04060d', '#1d1526', [22, 26, 46], 1], [5, '#060914', '#271c2c', [26, 28, 48], 1], [6, '#2a3048', '#c07858', [110, 96, 100], 0.5],
  [7.5, '#56667c', '#a8a29c', [165, 165, 172], 0], [12, '#6a7a8c', '#a8acae', [195, 196, 198], 0], [17, '#5a6478', '#b89c88', [175, 160, 155], 0],
  [18.6, '#2a2846', '#c26a4a', [110, 85, 90], 0.45], [20, '#0a0c1a', '#3a2238', [34, 32, 56], 1], [24, '#04060d', '#1d1526', [22, 26, 46], 1],
];
function skyAt(h) {
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  const dim = 1 - g.rain * 0.3;
  return { top: mix(a[1], b[1], t), bot: mix(a[2], b[2], t), amb: a[3].map((v, k) => lerp(v, b[3][k], t) * dim), night: lerp(a[4], b[4], t) };
}

const tintCache = {};
function tinted(img, col, key) {
  let c = tintCache[key];
  if (!c) { c = tintCache[key] = { cv: document.createElement('canvas') }; c.cv.width = img.width; c.cv.height = img.height; }
  if (c.col !== col) {
    const x = c.cv.getContext('2d'); x.clearRect(0, 0, img.width, img.height);
    x.globalCompositeOperation = 'source-over'; x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, img.width, img.height);
    c.col = col;
  }
  return c.cv;
}

function drawSky(c, cx, cy, s) {
  const gr = c.createLinearGradient(0, 0, 0, VH);
  gr.addColorStop(0, s.top); gr.addColorStop(1, s.bot);
  c.fillStyle = gr; c.fillRect(0, 0, VW, VH);
  // stars, rarely, through gaps in the cloud
  if (s.night > 0.6 && g.rain < 0.3) { c.fillStyle = 'rgba(220,220,255,0.5)'; for (let i = 0; i < 30; i++) { const x = (hash2(i, 1) * 900 - cx * 0.02) % VW, y = hash2(i, 2) * 90 - cy * 0.02; if (y > 0) c.fillRect((x + VW) % VW, y, 1, 1); } }
  const hz = mix('#000000', s.bot.startsWith('rgb') ? '#2a2838' : s.bot, 0.5);
  // far hills
  const fy = (w.G * T - cy - VH / 2) * 0.1 + VH / 2 + 10;
  const farCol = s.night > 0.5 ? '#141826' : mixRgb(s.bot, '#3a4250', 0.55);
  c.drawImage(tinted(sky.far, farCol, 'far'), Math.round(-cx * 0.1 - 40), Math.round(fy - 120));
  c.fillStyle = farCol; c.fillRect(0, Math.round(fy), VW, VH);
  // haze
  const hg = c.createLinearGradient(0, fy - 50, 0, fy + 10); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(1, s.night > 0.5 ? 'rgba(90,50,60,0.35)' : 'rgba(200,200,205,0.25)');
  c.fillStyle = hg; c.fillRect(0, fy - 50, VW, 60);
  // mid towers
  const my = (w.G * T - cy - VH / 2) * 0.22 + VH / 2 + 30;
  const midCol = s.night > 0.5 ? '#0c0e18' : mixRgb(s.bot, '#2a3038', 0.65);
  const mx = Math.round(-cx * 0.22 - 60);
  c.drawImage(tinted(sky.mid, midCol, 'mid'), mx, Math.round(my - 150));
  c.fillStyle = midCol; c.fillRect(0, Math.round(my), VW, VH);
  if (s.night > 0.05) { c.globalAlpha = s.night * 0.9; c.drawImage(sky.midL, mx, Math.round(my - 150)); c.globalAlpha = 1; }
  if (s.night > 0.3) for (const t of sky.tops) if (Math.sin(g.t * 2 + t.x) > 0.2) { c.fillStyle = '#ff3020'; c.fillRect(mx + t.x, Math.round(my - 150 + t.y), 1, 1); }
  // low cloud
  c.fillStyle = s.night > 0.5 ? 'rgba(40,36,56,0.35)' : 'rgba(200,204,210,0.22)';
  for (let i = 0; i < 6; i++) { const x = ((hash2(i, 5) * 1200 + g.t * (3 + i)) - cx * 0.05) % 700 - 100, y = 20 + hash2(i, 6) * 60 - cy * 0.04; c.beginPath(); c.ellipse(x, y, 90, 10 + i * 2, 0, 0, Math.PI * 2); c.fill(); }
}
function mixRgb(a, b, t) { const A = a.startsWith('rgb') ? a.match(/\d+/g).map(Number) : hexRgb(a), B = hexRgb(b); return rgb(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }

function drawPlane(c, cx, cy, s) {
  const pl = g.plane; if (!pl) return;
  const x = Math.round(pl.x - cx), y = Math.round(pl.y - cy - 40);
  if (x > VW + 20 || x < -320) return;
  c.drawImage(planeImg, x, y);
  if (s.night > 0.05) { c.globalAlpha = s.night * 0.8; c.drawImage(planeDark, x, y); c.globalAlpha = 1; }
  const blink = Math.sin(g.t * 9) > 0.7;
  c.fillStyle = '#ff2a2a'; if (Math.sin(g.t * 5) > 0) c.fillRect(x + 150, y + 30, 2, 1);
  c.fillStyle = '#3aff6a'; c.fillRect(x + 150, y + 47, 1, 1);
  if (blink) { c.fillStyle = '#ffffff'; c.fillRect(x + 22, y + 9, 2, 1); c.fillRect(x + 196, y + 47, 2, 1); }
  // cabin windows lit
  c.fillStyle = 'rgba(255,220,160,0.8)'; for (let i = 60; i < 262; i += 4) c.fillRect(x + i, y + 36, 2, 1);
  // landing lights: glare
  c.save(); c.globalCompositeOperation = 'lighter';
  const gl = c.createRadialGradient(x + 268, y + 46, 0, x + 268, y + 46, 40);
  gl.addColorStop(0, 'rgba(255,255,240,0.9)'); gl.addColorStop(0.2, 'rgba(255,250,220,0.35)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = gl; c.fillRect(x + 228, y + 6, 80, 80);
  c.fillStyle = 'rgba(255,250,220,0.06)';
  c.beginPath(); c.moveTo(x + 268, y + 46); c.lineTo(x + 420, y + 200); c.lineTo(x + 330, y + 220); c.closePath(); c.fill();
  c.restore();
}

function render() {
  const s = skyAt(g.time);
  g.skyNow = s;
  if (g.mode === 'title' || g.mode === 'story0') return renderOverview(0, s);
  if (g.mode === 'zoom') {
    const t = smooth(clamp(g.zoomT / 4.6, 0, 1));
    if (t < 1) return renderOverview(t, s);
  }
  UI.mapHide(!!g.mapZoom);
  if (g.mapZoom) return renderMap(s);
  const shx = g.shake > 0.05 ? Math.round(rnd(-g.shake, g.shake)) : 0, shy = g.shake > 0.05 ? Math.round(rnd(-g.shake, g.shake)) : 0;
  const cx = Math.round(g.cam.x) + shx, cy = Math.round(g.cam.y) + shy;
  // background
  drawSky(ctx, cx, cy, s);
  drawPlane(ctx, cx, cy, s);
  // scene
  sx.clearRect(0, 0, VW, VH);
  sx.drawImage(worldCv, cx, cy, VW, VH, 0, 0, VW, VH);
  drawDynamic(sx, cx, cy);
  // lighting
  Light.ambient(w, cx, cy, s.amb, g.flash);
  drawLights(cx, cy, s);
  Light.apply(sx, cx, cy);
  ctx.drawImage(sc, 0, 0);
  drawEmissive(ctx, cx, cy, s);
  drawRainFx(ctx, cx, cy, s);
  drawMarkers(ctx, cx, cy);
  ctx.drawImage(vignette, 0, 0);
  ctx.globalAlpha = 0.05; ctx.drawImage(grain, -Math.floor(rnd(0, 64)), -Math.floor(rnd(0, 64))); ctx.globalAlpha = 1;
  if (g.player.hurtT > 0) { ctx.fillStyle = `rgba(150,20,10,${g.player.hurtT * 0.35})`; ctx.fillRect(0, 0, VW, VH); }
  if (g.mode === 'zoom') { ctx.fillStyle = `rgba(0,0,0,${clamp(1 - (g.zoomT - 4.6) / 0.6, 0, 1) * 0.0})`; ctx.fillRect(0, 0, VW, VH); }
}

function drawDynamic(c, cx, cy) {
  const vis = (x, y, m = 20) => x > cx - m && x < cx + VW + m && y > cy - m && y < cy + VH + 40;
  // drain water
  const sw = w.sewer, wy = (sw.y1 + 1) * T - 3 - cy;
  if (wy > -10 && wy < VH + 10) {
    c.fillStyle = 'rgba(40,62,58,0.85)'; c.fillRect(Math.max(0, sw.x0 * T - cx), wy, (sw.x1 - sw.x0 + 1) * T, 3);
    c.fillStyle = 'rgba(120,150,140,0.5)';
    for (let x = 0; x < VW; x += 3) if (Math.sin((x + cx) * 0.3 + g.t * 3) > 0.6 && x + cx > sw.x0 * T && x + cx < (sw.x1 + 1) * T) c.fillRect(x, wy, 2, 1);
  }
  // laundry sway hint: none; wires sag static
  for (const b of g.birds) if (vis(b.x, b.y)) drawPigeon(c, b.x - cx, b.y - cy, b.face, b.fly > 0 || b.ret, b.frame);
  for (const r of g.rats) if (!r.dead && vis(r.x, r.y)) drawRat(c, r.x - cx, r.y - cy, r.face, r.frame);
  for (const k of g.cats) if (vis(k.x, k.y)) drawCat(c, k.x - cx, k.y - cy, k.face, k.col, k.pose, k.frame, false);
  for (const n of g.npcs) {
    if (n.presence === 'gone' || !vis(n.x, n.y)) continue;
    drawPerson(c, n.look, n.x - cx, n.y - cy, n.presence === 'sleep' ? 'sleep' : n.pose, n.frame, n.face);
  }
  const p = g.player;
  const pose = p.climbing ? 'climb' : !p.onGround ? 'air' : Math.abs(p.vx) > 4 ? 'walk' : 'stand';
  if (!(p.hurtT > 0 && Math.floor(g.t * 20) % 2)) drawPerson(c, PLAYER_LOOK, p.x - cx, p.y - cy, pose, p.frame, p.face);
  if (p.carry.length && !p.climbing) drawItem(c, p.carry[0], p.x - cx + p.face * 4, p.y - cy - 4);
  if (p.climbing && p.carry.length) drawItem(c, p.carry[0], p.x - cx, p.y - cy - 13);
  // particles that live in the lit scene
  for (const q of g.parts) {
    const x = q.x - cx, y = q.y - cy;
    if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
    const a = q.life / q.max;
    if (q.type === 'steam') { c.fillStyle = `rgba(230,230,225,${a * 0.35})`; c.fillRect(x, y, 2, 2); }
    else if (q.type === 'dust') { c.fillStyle = `rgba(150,140,120,${a * 0.8})`; c.fillRect(x, y, 1, 1); }
    else if (q.type === 'drip' || q.type === 'splash') { c.fillStyle = 'rgba(150,180,200,0.8)'; c.fillRect(x, y, 1, q.type === 'drip' ? 2 : 1); }
  }
}

function drawLights(cx, cy, s) {
  const night = s.night;
  for (const L of w.lights) {
    if (!L.on) continue;
    const x = L.x - cx, y = L.y - cy, r = L.r;
    if (x < -r * 1.6 || x > VW + r * 1.6 || y < -r || y > VH + r) continue;
    let k = 1;
    if (L.flick && Math.random() < L.flick * 0.12) continue;
    if (g.planeProx > 0.6 && L.room !== undefined && Math.random() < (g.planeProx - 0.6) * 0.3) k = 0.4;
    if (L.kind === 'candle') k = 0.75 + Math.sin(g.t * 9 + L.x) * 0.1 + Math.random() * 0.1;
    if (L.kind === 'neon') { if (L.sign.flick && Math.sin(g.t * 13 + L.x) > 1 - L.sign.flick * 0.4) continue; k = 0.45 + night * 0.35; }
    if (L.kind === 'street') k = 0.3 + night * 0.7;
    let clip = null;
    if (L.room !== undefined) { const rm = w.rooms[L.room]; clip = [rm.x0 * T - cx - 3, rm.y0 * T - cy, (rm.x1 - rm.x0 + 1) * T + 6, (rm.y1 - rm.y0 + 1) * T]; }
    Light.add(x, y + (L.kind === 'tube' ? 6 : 3), r, L.c, k, clip, L.kind === 'tube' ? 1.5 : 1);
  }
  // tv glow at night
  if (night > 0.3) for (const pr of w.props) {
    if (pr.t !== 'tv') continue;
    const L = w.lights.find((l) => l.room === pr.room);
    if (!L || !L.on) continue;
    const x = pr.x + 4 - cx, y = pr.y - 8 - cy; if (x < -30 || x > VW + 30 || y < -30 || y > VH + 30) continue;
    const rm = w.rooms[pr.room];
    Light.add(x, y, 22, [90, 140, 255], 0.5 + Math.random() * 0.25, [rm.x0 * T - cx, rm.y0 * T - cy, (rm.x1 - rm.x0 + 1) * T, (rm.y1 - rm.y0 + 1) * T]);
  }
  // live wires
  for (const wr of w.wires) if (wr.live && wr.on) { const x = (wr.x0 + wr.x1) / 2 - cx, y = wr.y + wr.sag - cy; if (x > -40 && x < VW + 40 && y > -40 && y < VH + 40) Light.add(x, y, 30, [140, 180, 255], 0.6 + Math.random() * 0.4); }
  for (const q of g.parts) if (q.type === 'spark') Light.add(q.x - cx, q.y - cy, 10, [180, 200, 255], 0.5);
  // the plane's landing lights sweep over the roofs
  if (g.plane) { const pl = g.plane; Light.add(pl.x + 300 - cx, pl.y + 40 - cy, 110, [255, 250, 230], 0.8); }
  // you carry a little light: a cheap torch
  const p = g.player;
  Light.add(p.x - cx + p.face * 3, p.y - 8 - cy, 26, [255, 210, 160], 0.38);
}

function drawEmissive(c, cx, cy, s) {
  const night = s.night;
  if (night > 0.1) for (const wn of w.wins) {
    if (!wn.on) continue;
    const x = wn.x - cx, y = wn.y - cy; if (x < -4 || x > VW || y < -4 || y > VH) continue;
    if (g.power[blockOfX(wn.x)] === false) continue;
    if (wn.fl && Math.random() < 0.1) continue;
    c.globalAlpha = night * 0.85; c.fillStyle = wn.c; c.fillRect(x, y, wn.w, wn.h);
  }
  c.globalAlpha = 1;
  for (const sg of w.signs) {
    const x = sg.x - cx, y = sg.y - cy; if (x < -20 || x > VW + 4 || y < -sg.h || y > VH) continue;
    if (g.power[blockOfX(sg.x)] === false) continue;
    if (sg.flick && Math.sin(g.t * 13 + sg.x) > 1 - sg.flick * 0.4) continue;
    drawSignLit(c, sg, x, y, 0.55 + night * 0.45);
  }
  for (const L of w.lights) {
    if (!L.on || (L.kind !== 'bulb' && L.kind !== 'tube' && L.kind !== 'street')) continue;
    const x = Math.round(L.x - cx), y = Math.round(L.y - cy); if (x < -10 || x > VW + 10 || y < -4 || y > VH + 4) continue;
    if (L.flick && Math.random() < L.flick * 0.12) continue;
    c.fillStyle = L.kind === 'tube' ? '#f2fff6' : '#fff0c8';
    if (L.kind === 'tube') c.fillRect(x - 5, y + 1, 11, 1);
    else if (L.kind === 'street') c.fillRect(x - 1, y + 1, 4, 1);
    else c.fillRect(x, y + 1, 2, 2);
  }
  for (const pr of w.props) {
    const x = pr.x - cx, y = pr.y - cy; if (x < -20 || x > VW + 4 || y < -30 || y > VH + 30) continue;
    if (pr.t === 'tv' && night > 0.3) { const L = w.lights.find((l) => l.room === pr.room); if (L && L.on) { c.fillStyle = Math.random() < 0.5 ? '#9ac8ff' : '#c8e0ff'; c.fillRect(x + 2, y - 10, 5, 4); } }
    if (pr.t === 'incense') { c.fillStyle = '#ff6030'; for (let i = 1; i < 6; i += 2) if (Math.random() < 0.8) c.fillRect(x + i, y - 11, 1, 1); }
    if (pr.t === 'shrine') { c.fillStyle = Math.sin(g.t * 3 + pr.x) > -0.5 ? '#ff3020' : '#a02010'; c.fillRect(x + 1, y + 2, 1, 1); c.fillRect(x + 5, y + 2, 1, 1); }
    if (pr.t === 'altar') { c.fillStyle = '#ffb040'; c.fillRect(x + 3, y - 12, 1, 1); c.fillRect(x + 12, y - 12, 1, 1); }
    if (pr.t === 'radio' && g.radioOn) { c.fillStyle = '#ffd070'; c.fillRect(x + 5, y - 5, 1, 1); }
  }
  for (const wr of w.wires) if (wr.live && wr.on) {
    c.fillStyle = Math.random() < 0.5 ? '#d8e8ff' : '#7aa0ff';
    for (let x = wr.x0; x < wr.x1; x += 1) { const t = (x - wr.x0) / (wr.x1 - wr.x0); if (Math.random() < 0.6) c.fillRect(x - cx, Math.round(wr.y + Math.sin(t * Math.PI) * wr.sag) - cy, 1, 1); }
  }
  for (const q of g.parts) if (q.type === 'spark') { c.fillStyle = '#e8f0ff'; c.fillRect(q.x - cx, q.y - cy, 1, 1); }
  // cats' eyes in the dark
  for (const k of g.cats) if (k.x > cx && k.x < cx + VW && k.y > cy && k.y < cy + VH) {
    const amb = w.exp[Math.floor((k.y - 4) / T) * w.W + Math.floor(k.x / T)];
    if (amb < 0.2 && Math.sin(g.t * 0.7 + k.x) > -0.8) { c.fillStyle = '#c8ff60'; const ex = k.pose === 'sit' ? (k.face < 0 ? -3 : 2) : (k.face < 0 ? -5 : 4); c.fillRect(Math.round(k.x - cx + ex), Math.round(k.y - cy - (k.pose === 'sit' ? 7 : 5)), 1, 1); }
  }
}

function drawRainFx(c, cx, cy, s) {
  c.fillStyle = s.night > 0.5 ? 'rgba(150,170,210,0.38)' : 'rgba(200,210,225,0.45)';
  for (const d of g.drops) { const x = d.x - cx, y = d.y - cy; if (y > -4 && y < VH) c.fillRect(x, y, 1, 3); }
  for (const q of g.parts) if (q.type === 'splash' && q.y - cy > 0) { c.fillRect(q.x - cx, q.y - cy, 1, 1); }
  if (g.flash > 0) { c.fillStyle = `rgba(220,230,255,${g.flash * 0.18})`; c.fillRect(0, 0, VW, VH); }
}

function drawMarkers(c, cx, cy) {
  if (g.mode !== 'play') return;
  // offers
  for (const n of g.npcs) {
    if (!n.offer || n.offer.stage !== 'offered' || n.presence !== 'awake') continue;
    const x = Math.round(n.x - cx), y = Math.round(n.y - cy - 20 + Math.sin(g.t * 3 + n.id) * 1.5);
    if (x < -4 || x > VW + 4 || y < -8 || y > VH) continue;
    c.fillStyle = '#1a1410'; c.fillRect(x - 2, y - 1, 5, 8); c.fillStyle = '#ffd24a'; c.fillRect(x - 1, y, 3, 4); c.fillRect(x - 1, y + 5, 3, 1);
  }
  // barks
  for (const n of g.npcs) {
    if (!n.bark || n.presence === 'gone') continue;
    const x = Math.round(n.x - cx), y = Math.round(n.y - cy - 22);
    if (x < -20 || x > VW + 20 || y < -8 || y > VH) continue;
    const wd = text3w(n.bark.text);
    c.fillStyle = 'rgba(16,14,12,0.75)'; c.fillRect(x - wd / 2 - 2, y - 1, wd + 4, 7);
    text3(c, n.bark.text, x - wd / 2, y, '#e8e0cc');
  }
  for (const n of g.npcs) if (n.presence === 'sleep' && Math.abs(n.x - g.player.x) < 150) {
    const x = Math.round(n.x - cx - 6), y = Math.round(n.y - cy - 14 - (g.t * 4 % 6));
    text3(c, 'Z', x, y, 'rgba(200,200,230,0.5)');
  }
  // tracked task
  const j = g.jobs[0];
  const tgt = j && jobTarget(j);
  if (tgt) {
    const x = tgt.x - cx, y = tgt.y - cy - 22;
    if (x > 4 && x < VW - 4 && y > 4 && y < VH - 4) {
      const b = Math.sin(g.t * 4) * 1.5;
      c.fillStyle = '#5ad8ff'; c.fillRect(Math.round(x) - 1, Math.round(y + b), 3, 1); c.fillRect(Math.round(x), Math.round(y + b + 1), 1, 2);
    } else {
      const ang = Math.atan2(y - VH / 2, x - VW / 2);
      const ex = clamp(VW / 2 + Math.cos(ang) * 400, 10, VW - 10), ey = clamp(VH / 2 + Math.sin(ang) * 400, 12, VH - 12);
      c.save(); c.translate(Math.round(ex), Math.round(ey)); c.rotate(ang);
      c.fillStyle = 'rgba(10,10,14,0.6)'; c.fillRect(-4, -4, 9, 9);
      c.fillStyle = '#5ad8ff'; c.fillRect(0, -1, 4, 3); c.fillRect(-3, 0, 3, 1); c.fillRect(2, -2, 1, 5);
      c.restore();
    }
  }
  if (g.lamStage >= 4 && !g.lamDone) {
    const x = g.lam.x - cx, y = g.lam.y - cy - 22;
    if (x > 0 && x < VW && y > 0 && y < VH) { c.fillStyle = '#ffb0d0'; c.fillRect(Math.round(x), Math.round(y + Math.sin(g.t * 3) * 1.5), 1, 3); }
  }
  // prompt
  const f = g.focus;
  if (f && !UI.dialogOpen) {
    const label = 'E ' + verbFor(f);
    const wd = text3w(label), x = Math.round(f.x - cx - wd / 2), y = Math.round(f.y - cy - 4);
    c.fillStyle = 'rgba(12,10,8,0.8)'; c.fillRect(x - 2, y - 2, wd + 4, 9);
    text3(c, label, x, y, '#ffe6a8');
  }
}

// overview: the lit city, used by the title and the zoom-in
function renderOverview(t, s) {
  const p = g.player;
  const PW = w.W * T, PH = w.H * T;
  const s0 = Math.min(VW / PW, VH / (PH - 300)) * 1.0;
  const sc0 = lerp(s0, 1, t * t);
  const fx = lerp(PW / 2, p.x, smooth(t)), fy = lerp(PH / 2 + 120, p.y - 8, smooth(t));
  const ox = VW / 2 - fx * sc0, oy = VH / 2 - fy * sc0;
  const ss = skyAt(g.mode === 'title' || g.mode === 'story0' ? 22 : g.time);
  drawSky(ctx, -ox / sc0, (-oy / sc0) * 0.2 + 600, ss);
  ctx.imageSmoothingEnabled = sc0 < 0.9;
  if (g.plane) { ctx.save(); ctx.translate(ox, oy); ctx.scale(sc0, sc0); ctx.drawImage(planeImg, g.plane.x, g.plane.y - 40); ctx.restore(); }
  ctx.drawImage(litCv, ox, oy, PW * sc0, PH * sc0);
  ctx.imageSmoothingEnabled = false;
  // rain over the whole thing
  ctx.fillStyle = 'rgba(160,180,215,0.25)';
  for (let i = 0; i < 160; i++) { const x = (hash2(i, 3) * VW * 1.3 - g.t * 30) % (VW + 40), y = (hash2(i, 4) * VH + g.t * 260 * (0.8 + hash2(i, 5) * 0.4)) % VH; ctx.fillRect((x + VW + 40) % (VW + 40) - 20, y, 1, 3); }
  if (g.mode === 'zoom') { const a = clamp((g.zoomT - 4.3) / 0.6, 0, 1); ctx.fillStyle = `rgba(0,0,0,${Math.sin(a * Math.PI)})`; ctx.fillRect(0, 0, VW, VH); }
  ctx.drawImage(vignette, 0, 0);
}

function renderMap(s) {
  const p = g.player;
  const PW = w.W * T, PH = w.H * T;
  const z = g.mapZoom === 1 ? 0.5 : Math.min(VW / PW, VH / (PH - 330));
  let ox = VW / 2 - p.x * z, oy = VH / 2 - p.y * z;
  if (g.mapZoom === 2) { ox = (VW - PW * z) / 2; oy = VH - (PH - 40) * z; }
  ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, VW, VH);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(litCv, ox, oy, PW * z, PH * z);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = 'rgba(5,6,10,0.35)'; ctx.fillRect(0, 0, VW, VH);
  // block letters
  for (const b of w.blds) { const x = Math.round(((b.x0 + b.x1) / 2) * T * z + ox) - 1, y = Math.round(b.roof * T * z + oy) - 8; text3(ctx, b.letter, x, y, 'rgba(230,220,200,0.7)'); }
  // targets
  for (const j of g.jobs) { const t = jobTarget(j); if (!t) continue; const x = t.x * z + ox, y = (t.y - 6) * z + oy; ctx.fillStyle = j === g.jobs[0] ? '#5ad8ff' : '#3a8aa8'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
  if (g.lamStage >= 4 && !g.lamDone) { ctx.fillStyle = '#ffb0d0'; ctx.fillRect(Math.round(g.lam.x * z + ox) - 1, Math.round((g.lam.y - 6) * z + oy) - 1, 3, 3); }
  const yr = w.yours; ctx.fillStyle = '#ffd070'; ctx.fillRect(Math.round((yr.x0 + 1) * T * z + ox), Math.round((yr.y1 + 0.5) * T * z + oy), 2, 2);
  // you
  const px = Math.round(p.x * z + ox), py = Math.round((p.y - 6) * z + oy);
  const pulse = (g.t * 1.5) % 1;
  ctx.strokeStyle = `rgba(255,255,255,${1 - pulse})`; ctx.beginPath(); ctx.arc(px + 0.5, py + 0.5, 2 + pulse * 10, 0, Math.PI * 2); ctx.stroke();
  if (Math.floor(g.t * 3) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py, 1, 1); }
  text3(ctx, 'YOU', px + 4, py - 2, '#ffffff');
  const label = g.mapZoom === 2 ? 'THE WHOLE CITY' : 'NEARBY';
  text3(ctx, label, 6, 6, '#c8c0b0');
  text3(ctx, 'M ZOOM  ESC CLOSE', 6, VH - 10, '#8a8478');
  ctx.fillStyle = '#ffd070'; ctx.fillRect(VW - 70, VH - 9, 2, 2); text3(ctx, 'YOUR ROOM', VW - 64, VH - 10, '#8a8478');
}

function makeVignette() {
  const c = document.createElement('canvas'); c.width = VW; c.height = VH;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VW * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = gr; x.fillRect(0, 0, VW, VH);
  return c;
}
function makeGrain() {
  const c = document.createElement('canvas'); c.width = VW + 64; c.height = VH + 64;
  const x = c.getContext('2d'); const im = x.createImageData(c.width, c.height);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); return c;
}

function layout() {
  const wrap = document.getElementById('wrap');
  const W2 = innerWidth, H2 = innerHeight;
  let s = Math.min(W2 / VW, H2 / VH);
  if (s >= 2) s = Math.floor(s);
  wrap.style.width = VW * s + 'px'; wrap.style.height = VH * s + 'px';
  wrap.style.setProperty('--s', s);
}

function startGame() {
  if (g.mode !== 'title') return;
  Sfx.init(); Sfx.resume();
  g.mode = 'story0';
  UI.title(false);
  UI.story(INTRO, () => { g.mode = 'zoom'; g.zoomT = 0; snapCam(); });
}

window.addEventListener('load', boot);
