// The game: owns the world, the folk and the clock; runs the loop; turns pointer input into actions; draws.
import { generate, World, W, H } from './world.js';
import { T, TILES, ROOMS, OBJ, RES, DAY_LEN, STORE_BASE, STORE_ROOM, TILE } from './content.js';
import { Terrain, Sky, Lighting, Compositor, ambient, daylight, VW, VH } from './render.js';
import { Folk, Cat, REACH } from './ai.js';
import { reach } from './path.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { objSprite, drawMushrooms, treeSprite, STUMP, SAPLING, bushSprite, CABIN, CABIN_WINDOWS, WOODPILE_LOG, ICON } from './sprites.js';
import { rng, clamp, hash2, flipped } from './util.js';

export { VW, VH };
const SAVE_KEY = 'hearthburrow-save-v1';
const LIGHTS = new Set(['lamp', 'growlamp', 'lantern', 'nightstand', 'crystallamp']);

export class Game {
  constructor(view, hud, seed) {
    this.view = view; this.hud = hud;
    this.hx = hud.getContext('2d'); this.hx.imageSmoothingEnabled = false;
    const mk = () => Object.assign(document.createElement('canvas'), { width: VW, height: VH });
    this.front = mk(); this.fx = this.front.getContext('2d'); this.fx.imageSmoothingEnabled = false;
    this.back = mk(); this.bx = this.back.getContext('2d');
    this.comp = new Compositor(view);
    this.terrain = new Terrain();
    this.light = new Lighting();
    this.audio = new Audio();
    this.seed = seed;
    this.rand = rng(seed ^ 0xb0a7);
    this.sky = new Sky(seed);
    this.mouse = { x: VW / 2, y: VH / 2, down: false, btn: 0, inside: false };
    this.keys = new Set();
    this.parts = []; this.flakes = []; this.popups = [];
    this.claims = new Map(); this.reserved = new Map(); this.bedOwners = new Map();
    this.speed = 1; this.speedMul = 1;
    this.started = false;
    this.tool = 'hand'; this.pick = null; // selected room / decor type
    this.stats = { dug: 0, chopped: 0, rooms: {}, decor: 0 };
    this.gathering = 0; this.bellCD = 0; this.arriveCD = DAY_LEN * 0.15; this.saveT = 0;
    this.shake = 0; this.flare = 0;
    this.ui = new UI(this);
    if (!this.load()) this.fresh(seed);
    this.bindInput();
  }

  fresh(seed) {
    this.world = generate(seed);
    this.time = 0.33; this.day = 1;
    this.res = { wood: 24, stone: 12, iron: 0, crystal: 0, food: 14, meal: 2 };
    this.folk = [];
    const w = this.world;
    const hearth = w.rooms[0];
    const looks = [['#c0443a', '#6a4a34', '#f2c9a0', '#d9a03a'], ['#3a8a8a', '#6a3440', '#a8714f', '#e8dcc0'], ['#d9a03a', '#34466a', '#d9a37a', '#c0443a']];
    looks.forEach((l, i) => {
      const f = new Folk(this, (hearth.x + 2 + i * 3) * 8 + 4, (hearth.y + hearth.h) * 8, l);
      this.folk.push(f);
    });
    this.cat = new Cat(this, (hearth.x + 6) * 8 + 4, (hearth.y + hearth.h) * 8);
    this.goal = 0;
    const c = w.cabin;
    this.cam = { x: c.shaft * 8 - VW / 2, y: (c.y - 14) * 8 };
  }

  // ---------- helpers used by the AI ----------
  isSleepTime() { return this.time >= 0.9 || this.time < 0.24; }
  isEvening() { return this.time >= 0.72 && this.time < 0.9; }
  daylight() { return daylight(this.time); }
  cap(k) { return STORE_BASE + STORE_ROOM * this.world.rooms.filter((r) => r.type === 'storage' && r.state === 'done').length; }
  claim(o, job, f) { let m = this.claims.get(o); if (!m) this.claims.set(o, (m = new Map())); m.set(job, f); }
  taken(o, job) { const f = this.claims.get(o)?.get(job); return f && f.task && (f.task.obj === o || f.task.tree === o || f.task.bush === o) ? f : null; }
  release(f, t) {
    if (t.i !== undefined && this.reserved.get(t.i) === f) this.reserved.delete(t.i);
    for (const o of [t.obj, t.tree, t.bush]) {
      if (!o) continue;
      const m = this.claims.get(o);
      if (m) for (const [k, v] of m) if (v === f) m.delete(k);
    }
  }
  count(room, kind) { return this.folk.filter((f) => f.task?.kind === kind && f.task.room === room).length; }
  bedOwner(b) { const f = this.bedOwners.get(b); return f && this.folk.includes(f) && f.bed === b ? f : null; }
  setBedOwner(b, f) { this.bedOwners.set(b, f); }
  freeBeds() { return this.world.objectsOf('bed').filter((b) => !this.bedOwner(b)).length - this.folk.filter((f) => !f.bed).length; }

  roomCozy(r) {
    const R = ROOMS[r.type];
    let c = R.comfort;
    for (const o of this.world.objects) {
      if (o.gone) continue;
      const inside = o.room === r.id || (o.room < 0 && this.world.roomOf(o.x, o.y + o.h - 1) === r);
      if (!inside) continue;
      const O = OBJ[o.type];
      if (O.light && !o.on) continue;
      c += O.comfort || 0;
      if (o.type === 'hearth' && o.fuel > 0) c += 2;
      if (o.type === 'phonograph' && o.on) c += 1;
      if (o.type === 'plant') c += o.size * 0.3;
    }
    return c;
  }
  cozy() {
    let c = 0;
    for (const r of this.world.rooms) if (r.state === 'done') c += this.roomCozy(r);
    for (const o of this.world.objects) if (o.room < 0 && !this.world.roomOf(o.x, o.y + o.h - 1)) c += (OBJ[o.type].comfort || 0) * 0.5;
    return Math.round(c);
  }
  avgJoy() { return this.folk.length ? this.folk.reduce((a, f) => a + f.joy, 0) / this.folk.length : 0; }

  addRes(k, n, px, py) {
    const room = Math.max(0, this.cap(k) - this.res[k]);
    const got = Math.min(n, room);
    this.res[k] += got;
    this.popups.push({ x: px, y: py, icon: k, n: got, full: got < n, life: 1.6, vy: -14 });
    this.audio.play('pop', RES.indexOf(k));
    this.ui.bump(k);
  }
  afford(cost) { for (const k in cost) if ((this.res[k] || 0) < cost[k]) return false; return true; }
  pay(cost, px, py) { let i = 0; for (const k in cost) { this.res[k] -= cost[k]; this.popups.push({ x: px + i * 12, y: py, icon: k, n: -cost[k], life: 1.4, vy: -10 }); i++; } }

  get markCount() { return this._marks; }
  countMarks() { let n = 0; const m = this.world.mark; for (let i = 0; i < m.length; i++) if (m[i]) n++; this._marks = n; }

  digDone(x, y, f) {
    const w = this.world;
    const t = w.dig(x, y);
    const give = TILES[t].give;
    if (give && (!TILES[t].chance || Math.random() < TILES[t].chance)) this.addRes(give, 1, x * 8 + 4, y * 8);
    this.audio.play('crumble');
    this.crumbs(x, y, 8, t);
    this.stats.dug++;
    this.countMarks();
    // shafts get ladders as they are dug, so nobody is stranded at the bottom
    const shaft = (cx, cy) => !w.solid(cx, cy) && w.solid(cx - 1, cy) && w.solid(cx + 1, cy) && !w.roomOf(cx, cy);
    for (const cy of [y, y - 1]) if (shaft(x, cy) && (!w.solid(x, cy - 1) || !w.solid(x, cy + 1))) w.ladder[w.idx(x, cy)] = 1;
    const r = w.roomOf(x, y);
    if (r && r.state === 'dig' && w.roomDug(r)) r.state = 'build';
    if (t === T.CRYSTAL) this.sparks(x * 8 + 4, y * 8 + 4, 10, '#bff0ff', true);
  }
  roomDone(r) {
    this.world.completeRoom(r);
    this.stats.rooms[r.type] = (this.stats.rooms[r.type] || 0) + 1;
    this.audio.play('done');
    for (let i = 0; i < 24; i++) this.parts.push({ x: (r.x + Math.random() * r.w) * 8, y: (r.y + Math.random() * r.h) * 8, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 1.2, col: ['#f0d060', '#e0485a', '#7ad06a', '#4ab0e0'][i % 4], glow: true, grav: 60 });
  }
  fellTree(tr, dir) {
    tr.stage = 'falling'; tr.fall = 0; tr.dir = dir || 1; tr.mark = false;
    this.audio.play('timber');
    this.stats.chopped++;
  }
  harvest(o) {
    const n = 3 + (o.tended ? 1 : 0);
    o.grow = 0; o.tended = false;
    this.addRes('food', n, (o.x + 1) * 8, o.y * 8);
    this.audio.play('harvest');
  }
  stoke(h, byHand) {
    h.fuel = 1; h.flare = 1.2;
    this.audio.play('crackle');
    this.sparks((h.x + 1.5) * 8, (h.y + 2) * 8, 14, '#ffb050', true);
    this.shake = byHand ? 0.1 : 0;
  }

  // ---------- particles ----------
  crumbs(x, y, n, t) {
    const col = t === T.STONE || t === T.IRON ? ['#6e6a72', '#4f4b55'] : t === T.CRYSTAL ? ['#7fd8ff', '#4f4b55'] : t === T.CLAY ? ['#7a4a30', '#5a3424'] : ['#5a3a26', '#3d2619'];
    for (let i = 0; i < n; i++) this.parts.push({ x: x * 8 + Math.random() * 8, y: y * 8 + Math.random() * 8, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 40, life: 0.6 + Math.random() * 0.5, col: col[i % 2], grav: 260, solidHit: true });
  }
  dust(px, py, n) { for (let i = 0; i < n; i++) this.parts.push({ x: px + (Math.random() - 0.5) * 6, y: py - 1, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 10, life: 0.5, col: '#8a7a68', grav: 0 }); }
  sparks(px, py, n, col, glow) { for (let i = 0; i < n; i++) this.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 60, life: 0.5 + Math.random() * 0.6, col, glow: glow !== false, grav: 80 }); }
  steam(px, py) { this.parts.push({ x: px + (Math.random() - 0.5) * 6, y: py, vx: (Math.random() - 0.5) * 4, vy: -8 - Math.random() * 6, life: 1.5, col: 'rgba(230,236,245,0.5)', grav: -2, size: 2 }); }
  drips(px, py) { for (let i = 0; i < 2; i++) this.parts.push({ x: px + (Math.random() - 0.5) * 8, y: py, vx: 0, vy: 10, life: 0.5, col: '#6ac0e0', grav: 200, glow: true }); }
  hearts(px, py, n) { for (let i = 0; i < n; i++) this.parts.push({ x: px + (Math.random() - 0.5) * 12, y: py, vx: (Math.random() - 0.5) * 12, vy: -15 - Math.random() * 15, life: 1.2, icon: 'heart', grav: 0 }); }
  snowPuff(px, py, n) { for (let i = 0; i < n * 4; i++) this.parts.push({ x: px + (Math.random() - 0.5) * 20, y: py + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 20, vy: Math.random() * 10, life: 0.9, col: '#eef2f8', grav: 60 }); }
  notes(px, py) { this.parts.push({ x: px, y: py, vx: (Math.random() - 0.5) * 10, vy: -14, life: 1.6, icon: 'note', grav: 0 }); }

  // ---------- update ----------
  update(dt) {
    const w = this.world;
    this.speedMul = this.started ? [0, 1, 2, 4][this.speed] : 0.6;
    const gdt = dt * this.speedMul;
    this.time += gdt / DAY_LEN;
    if (this.time >= 1) { this.time -= 1; this.day++; }
    this.ui.update(dt);
    this.panCamera(dt);

    // hearths, farms, trees, bushes
    let warm = false;
    for (const o of w.objects) {
      if (o.wig > 0) o.wig = Math.max(0, o.wig - dt);
      if (o.type === 'hearth') {
        o.fuel = Math.max(0, o.fuel - gdt / (DAY_LEN * 0.35));
        if (o.flare > 0) o.flare -= dt;
        if (o.fuel > 0) warm = true;
        if (o.fuel > 0 && Math.random() < dt * 3) this.parts.push({ x: (o.x + 1 + Math.random()) * 8, y: (o.y + 2) * 8, vx: (Math.random() - 0.5) * 6, vy: -12 - Math.random() * 10, life: 0.8, col: '#ffb050', glow: true, grav: -4 });
      } else if (o.type === 'plot' && o.grow < 1) {
        o.grow = Math.min(1, o.grow + (gdt / (DAY_LEN * 0.55)) * (o.tended ? 2 : 1));
      } else if (o.type === 'phonograph' && o.on && Math.random() < dt * 1.5) this.notes((o.x + 0.5) * 8, o.y * 8);
    }
    this.cold = !warm && (this.isSleepTime() || this.time > 0.8);
    for (const tr of w.trees) {
      if (tr.shake > 0) tr.shake -= dt;
      if (tr.stage === 'falling') {
        tr.fall += dt * 1.6 * (1 + tr.fall * 3);
        if (tr.fall >= 1) {
          tr.stage = 'stump'; tr.grow = 0;
          const gy = w.surface[tr.x];
          this.addRes('wood', 3 + Math.floor(tr.h / 3), (tr.x + tr.dir * 3) * 8, (gy - 2) * 8);
          this.snowPuff((tr.x + tr.dir * 3) * 8, (gy - 1) * 8, 6);
          this.shake = 0.15;
        }
      } else if (tr.stage === 'stump') { tr.grow += gdt / (DAY_LEN * 0.6); if (tr.grow >= 1) { tr.stage = 'sapling'; tr.grow = 0; } }
      else if (tr.stage === 'sapling') { tr.grow += gdt / (DAY_LEN * 0.8); if (tr.grow >= 1) { tr.stage = 'grown'; tr.h = 5 + Math.floor(Math.random() * 4); } }
    }
    for (const b of w.bushes) { if (b.shake > 0) b.shake -= dt; if (b.berries < 3) { b.regrow += gdt / (DAY_LEN * 0.4); if (b.regrow >= 1) { b.berries = 3; b.regrow = 0; } } }

    // which cells the folk can walk to (for showing dig orders nobody can reach)
    this.reachT = (this.reachT || 0) - dt;
    if (this.reachT <= 0) { this.reachT = 0.5; this.refreshReach(); }

    // folk
    for (const f of this.folk) f.update(dt);
    this.cat.update(dt);
    if (this.gathering > 0) this.gathering -= gdt;
    if (this.bellCD > 0) this.bellCD -= dt;

    // newcomers
    this.arriveCD -= gdt;
    if (this.started && this.arriveCD <= 0) {
      this.arriveCD = 15;
      if (this.freeBeds() > 0 && this.avgJoy() > 0.42 && !this.folk.some((f) => f.arriving) && this.folk.length < 40) {
        const left = Math.random() < 0.5, x = left ? 3 : W - 4;
        const f = new Folk(this, x * 8 + 4, w.surface[x] * 8);
        f.arriving = true;
        this.folk.push(f);
        this.arrival = { f, t: 8 };
        this.arriveCD = DAY_LEN * 0.3;
      }
    }
    if (this.arrival) { this.arrival.t -= dt; if (this.arrival.t <= 0 || !this.arrival.f.arriving) this.arrival = null; }

    // particles
    for (const p of this.parts) {
      p.life -= dt; p.vy += (p.grav || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.solidHit && w.solid(Math.floor(p.x / 8), Math.floor(p.y / 8))) { p.vy *= -0.3; p.vx *= 0.5; p.y -= 1; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.popups) { p.life -= dt; p.y += p.vy * dt; p.vy *= 0.96; }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.updateSnow(dt);
    if (this.shake > 0) this.shake -= dt;
    if (this.flare > 0) this.flare -= dt;

    // chimney smoke
    const c = w.cabin;
    if (Math.random() < dt * 4) this.parts.push({ x: (c.x) * 8 + 68 + Math.random() * 4, y: (c.y - 7) * 8 - 2, vx: 3 + Math.random() * 3, vy: -8 - Math.random() * 4, life: 3, col: 'rgba(200,200,215,0.35)', grav: -1, size: 3 });

    // goals, saving, sound
    this.ui.checkGoals();
    this.saveT += dt;
    if (this.started && this.saveT > 20) { this.saveT = 0; this.save(); }
    const surfaceDist = clamp(1 - (this.cam.y + VH / 2 - c.y * 8) / 200, 0, 1);
    const music = this.world.objects.some((o) => o.type === 'phonograph' && o.on) ? 1 : 0;
    this.audio.update(dt, this.started ? surfaceDist * (0.5 + (1 - this.daylight()) * 0.5) : 0.2, music);
  }

  refreshReach() {
    const w = this.world, set = new Set();
    for (const f of this.folk) {
      if (f.held) continue;
      const k = f.cy * W + f.cx;
      if (set.has(k)) continue;
      for (const c of reach(w, f.cx, f.cy)) set.add(c);
    }
    this.reachSet = set;
  }
  canReachDig(x, y) {
    const s = this.reachSet;
    if (!s) return true;
    for (const [dx, dy] of REACH) { const sx = x - dx, sy = y - dy; if (s.has(sy * W + sx)) return true; }
    return false;
  }

  updateSnow(dt) {
    const w = this.world;
    while (this.flakes.length < 160) this.flakes.push({ x: this.cam.x + Math.random() * (VW + 80) - 40, y: this.cam.y - Math.random() * VH, vy: 10 + Math.random() * 14, ph: Math.random() * 6, s: Math.random() < 0.2 ? 2 : 1 });
    const t = performance.now() / 1000;
    for (const f of this.flakes) {
      f.y += f.vy * dt; f.x += Math.sin(t * 0.8 + f.ph) * 6 * dt + 4 * dt;
      const tx = Math.floor(f.x / 8), ty = Math.floor(f.y / 8);
      if (f.y > this.cam.y + VH + 10 || f.x < this.cam.x - 50 || f.x > this.cam.x + VW + 50 || (w.inb(tx, ty) && (w.solid(tx, ty) || w.bg[ty * W + tx] !== 0))) {
        f.x = this.cam.x + Math.random() * (VW + 80) - 40; f.y = this.cam.y - 4 - Math.random() * 30;
      }
    }
  }

  panCamera(dt) {
    const k = this.keys, sp = 260 * dt;
    if (k.has('KeyA') || k.has('ArrowLeft')) this.cam.x -= sp;
    if (k.has('KeyD') || k.has('ArrowRight')) this.cam.x += sp;
    if (k.has('KeyW') || k.has('ArrowUp')) this.cam.y -= sp;
    if (k.has('KeyS') || k.has('ArrowDown')) this.cam.y += sp;
    if (this.camGlide) {
      this.cam.x += (this.camGlide.x - this.cam.x) * Math.min(1, dt * 4);
      this.cam.y += (this.camGlide.y - this.cam.y) * Math.min(1, dt * 4);
      if (Math.abs(this.camGlide.x - this.cam.x) < 1 && Math.abs(this.camGlide.y - this.cam.y) < 1) this.camGlide = null;
    }
    this.cam.x = clamp(this.cam.x, 0, W * 8 - VW);
    this.cam.y = clamp(this.cam.y, 0, H * 8 - VH);
  }

  // ---------- input ----------
  bindInput() {
    const el = this.hud;
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.keyPress(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.pointerUp(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    const pos = (e) => {
      const r = el.getBoundingClientRect();
      this.mouse.x = Math.floor(((e.clientX - r.left) / r.width) * VW);
      this.mouse.y = Math.floor(((e.clientY - r.top) / r.height) * VH);
    };
    el.addEventListener('pointerdown', (e) => {
      pos(e); el.setPointerCapture?.(e.pointerId); el.focus?.();
      this.audio.start();
      this.pointerDown(e.button, e.shiftKey);
    });
    el.addEventListener('pointermove', (e) => { pos(e); this.mouse.inside = true; this.pointerMove(); });
    el.addEventListener('pointerup', (e) => { pos(e); this.pointerUp(e.button); });
    el.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.cam.x += (e.deltaX || e.deltaY) * 0.5;
      else this.cam.y += e.deltaY * 0.5;
      this.camGlide = null;
    }, { passive: false });
    addEventListener('beforeunload', () => this.save());
  }

  keyPress(code) {
    const tools = { Digit1: 'hand', Digit2: 'dig', Digit3: 'ladder', Digit4: 'room', Digit5: 'decor', Digit6: 'erase' };
    if (!this.started) { if (code === 'Space' || code === 'Enter') this.ui.startGame(); return; }
    if (tools[code]) this.setTool(tools[code], this.ui.defaultPick(tools[code]));
    if (code === 'Escape') this.setTool('hand');
    if (code === 'Space') this.speed = this.speed === 0 ? (this.prevSpeed || 1) : ((this.prevSpeed = this.speed), 0);
    if (code === 'KeyM') this.audio.setMuted(!this.audio.muted);
    if (code === 'KeyF') this.speed = this.speed % 3 + 1;
  }

  setTool(t, pick = null) {
    this.tool = t; this.pick = pick;
    this.audio.play('click');
  }

  world2cell() {
    const wx = this.mouse.x + Math.round(this.cam.x), wy = this.mouse.y + Math.round(this.cam.y);
    return { wx, wy, cx: Math.floor(wx / 8), cy: Math.floor(wy / 8) };
  }

  pointerDown(btn, shift) {
    if (!this.started) { this.ui.click(this.mouse.x, this.mouse.y); return; }
    if (this.ui.click(this.mouse.x, this.mouse.y, btn)) return;
    const { wx, wy, cx, cy } = this.world2cell();
    this.mouse.down = true; this.mouse.btn = btn;
    this.drag = { sx: this.mouse.x, sy: this.mouse.y, cam: { ...this.cam }, moved: false, last: { cx, cy } };
    if (btn === 1 || btn === 2 && (this.tool === 'hand' || this.tool === 'room' || this.tool === 'decor')) {
      if (btn === 2 && (this.tool === 'room' || this.tool === 'decor')) { this.setTool('hand'); this.drag = null; this.mouse.down = false; return; }
      this.drag.pan = true; return;
    }
    const tool = this.tool;
    if (tool === 'hand') {
      const hit = this.hitTest(wx, wy);
      this.drag.hit = hit;
      if (!hit || hit.kind === 'sky' || hit.kind === 'tile') this.drag.pan = true;
    } else if (tool === 'dig') {
      const w = this.world;
      this.drag.erase = btn === 2 || (w.inb(cx, cy) && w.mark[w.idx(cx, cy)] === 1);
      this.paintDig(cx, cy);
    } else if (tool === 'ladder') {
      const w = this.world;
      this.drag.erase = btn === 2 || (w.inb(cx, cy) && w.ladder[w.idx(cx, cy)] === 1);
      this.paintLadder(cx, cy);
    } else if (tool === 'room') this.placeRoom(cx, cy);
    else if (tool === 'decor') this.placeDecor(cx, cy);
    else if (tool === 'erase') this.eraseAt(wx, wy, cx, cy);
  }

  pointerMove() {
    if (!this.started || !this.drag) return;
    const d = this.drag, { wx, wy, cx, cy } = this.world2cell();
    const mdx = this.mouse.x - d.sx, mdy = this.mouse.y - d.sy;
    if (Math.abs(mdx) + Math.abs(mdy) > 3) d.moved = true;
    if (d.pan) {
      if (d.moved) { this.cam.x = d.cam.x - mdx; this.cam.y = d.cam.y - mdy; this.camGlide = null; }
      return;
    }
    if (this.tool === 'hand' && d.hit && d.moved && !d.carry) {
      const h = d.hit;
      if (h.kind === 'folk' || h.kind === 'cat') {
        d.carry = h.ref; h.ref.held = true; h.ref.stop(); h.ref.vy = 0;
        if (h.kind === 'folk') { h.ref.interrupt(); h.ref.say('bang', 1); }
        this.audio.play('grab');
      } else if (h.kind === 'obj' && h.ref.room < 0 && OBJ[h.ref.type].cost) {
        d.carryObj = h.ref; this.world.removeObject(h.ref); h.ref.gone = false;
        for (const f of this.folk) if (f.task && (f.task.obj === h.ref || f.task.bed === h.ref)) f.endTask();
        this.audio.play('grab');
      }
    }
    if (d.carry) { d.carry.x = wx; d.carry.y = wy + 10; return; }
    if (this.tool === 'dig' && this.mouse.down) this.lineCells(d.last, { cx, cy }, (x, y) => this.paintDig(x, y));
    if (this.tool === 'ladder' && this.mouse.down) this.lineCells(d.last, { cx, cy }, (x, y) => this.paintLadder(x, y));
    d.last = { cx, cy };
  }

  pointerUp() {
    const d = this.drag;
    this.mouse.down = false;
    if (!d) return;
    this.drag = null;
    if (d.carry) {
      const c = d.carry;
      c.held = false; c.vy = 30;
      const w = this.world;
      // dropped inside rock: pop out to the nearest open spot
      if (w.solid(c.cx, c.cy) || w.solid(c.cx, c.cy - 1)) {
        let best = null, bd = 1e9;
        for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
          const x = c.cx + dx, y = c.cy + dy;
          if (w.inb(x, y) && w.standable(x, y) && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = { x, y }; }
        }
        if (best) { c.x = best.x * 8 + 4; c.y = best.y * 8 + 8; } else { c.x = w.cabin.shaft * 8 + 12; c.y = w.cabin.y * 8; }
        this.dust(c.x, c.y, 6);
      }
      c.falling = true;
      if (c instanceof Folk) { c.say('heart', 1); c.task = null; c.think = 0.3; }
      return;
    }
    if (d.carryObj) {
      const o = d.carryObj;
      const { cx, cy } = this.world2cell();
      const s = this.world.decorSpot(o.type, cx, cy);
      const pos = s.ok ? s : { x: o.x, y: o.y };
      const n = this.world.addObject(o.type, pos.x, pos.y, -1);
      Object.assign(n, { on: o.on, size: o.size, wig: 0.3 });
      this.audio.play(s.ok ? 'place' : 'nope');
      if (this.bedOwners.has(o)) { const f = this.bedOwners.get(o); this.bedOwners.delete(o); if (f.bed === o) f.bed = null; }
      return;
    }
    if (this.tool === 'hand' && d.hit && !d.moved) this.interact(d.hit);
    else if (this.tool === 'hand' && !d.moved && !d.hit) this.interact(this.hitTest(this.mouse.x + this.cam.x, this.mouse.y + this.cam.y));
    else if (this.tool === 'hand' && d.pan && !d.moved) {
      const { wx, wy } = this.world2cell();
      this.interact(this.hitTest(wx, wy));
    }
  }

  lineCells(a, b, fn) {
    let x0 = a.cx, y0 = a.cy;
    const dx = Math.abs(b.cx - x0), dy = -Math.abs(b.cy - y0), sx = x0 < b.cx ? 1 : -1, sy = y0 < b.cy ? 1 : -1;
    let err = dx + dy, guard = 0;
    while (guard++ < 200) {
      fn(x0, y0);
      if (x0 === b.cx && y0 === b.cy) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Dig brush: the cell and the one above, so tunnels come out tall enough to walk.
  paintDig(cx, cy) {
    const w = this.world;
    let changed = false;
    for (const y of [cy, cy - 1]) {
      if (!w.diggable(cx, y)) continue;
      const i = w.idx(cx, y);
      if (this.drag.erase) { if (w.mark[i] === 1) { w.mark[i] = 0; w.prog[i] = 0; changed = true; } }
      else if (!w.mark[i]) { w.mark[i] = 1; changed = true; }
    }
    if (changed) { this.audio.play('click'); this.countMarks(); }
  }
  paintLadder(cx, cy) {
    const w = this.world;
    if (!w.inb(cx, cy) || cx < 1 || cx >= W - 1) return;
    const i = w.idx(cx, cy), t = w.fg[i];
    if (this.drag.erase) { if (w.ladder[i]) { w.ladder[i] = 0; this.res.wood++; this.audio.play('click'); } return; }
    if (w.ladder[i] || t === T.BEDROCK) return;
    if (TILES[t].solid && !w.mark[i] && t !== T.FLOOR) return;
    if (this.res.wood < 1) { if (!this.nopeT || performance.now() - this.nopeT > 400) { this.audio.play('nope'); this.ui.bump('wood', true); this.nopeT = performance.now(); } return; }
    this.res.wood--; w.ladder[i] = 1; w.version++;
    if (t === T.FLOOR) { w.fg[i] = T.AIR; w.bg[i] = 1; this.dust(cx * 8 + 4, cy * 8 + 8, 4); } // a hatch through the floor
    this.audio.play('place');
  }
  placeRoom(cx, cy) {
    const type = this.pick; if (!type) return;
    const R = ROOMS[type], x = cx - (R.w >> 1), y = cy - R.h + 1;
    const w = this.world;
    if (!w.canPlaceRoom(type, x, y)) { this.audio.play('nope'); return; }
    if (!this.afford(R.cost)) { this.audio.play('nope'); for (const k in R.cost) if (this.res[k] < R.cost[k]) this.ui.bump(k, true); return; }
    this.pay(R.cost, (x + R.w / 2) * 8, y * 8);
    w.placeRoom(type, x, y);
    this.countMarks();
    this.audio.play('place');
  }
  placeDecor(cx, cy) {
    const type = this.pick; if (!type) return;
    const O = OBJ[type];
    const s = this.world.decorSpot(type, cx, cy);
    if (!s.ok) { this.audio.play('nope'); return; }
    if (!this.afford(O.cost)) { this.audio.play('nope'); for (const k in O.cost) if (this.res[k] < O.cost[k]) this.ui.bump(k, true); return; }
    this.pay(O.cost, (s.x + O.w / 2) * 8, s.y * 8);
    const o = this.world.addObject(type, s.x, s.y, -1);
    o.wig = 0.35;
    this.stats.decor++;
    this.dust((s.x + O.w / 2) * 8, (s.y + O.h) * 8, 5);
    this.audio.play('place');
  }
  eraseAt(wx, wy, cx, cy) {
    const w = this.world;
    const o = this.objectAt(wx, wy);
    if (o && o.room < 0 && OBJ[o.type].cost) {
      const cost = OBJ[o.type].cost;
      for (const k in cost) this.res[k] = Math.min(this.cap(k), this.res[k] + Math.ceil(cost[k] / 2));
      w.removeObject(o);
      this.dust(wx, wy, 6); this.audio.play('crumble');
      return;
    }
    const r = w.roomOf(cx, cy);
    if (r && r.state !== 'done') {
      for (const k in ROOMS[r.type].cost) this.res[k] += ROOMS[r.type].cost[k];
      w.cancelRoom(r); this.countMarks(); this.audio.play('crumble');
      return;
    }
    const tr = this.treeAt(wx, wy);
    if (tr && tr.mark) { tr.mark = false; this.audio.play('click'); return; }
    if (w.inb(cx, cy)) {
      const i = w.idx(cx, cy);
      if (w.ladder[i]) { w.ladder[i] = 0; this.res.wood++; this.audio.play('click'); return; }
      if (w.mark[i] === 1) {
        this.drag.erase = true; this.paintDig(cx, cy);
        return;
      }
    }
    this.audio.play('nope');
  }

  // ---------- picking what is under the cursor ----------
  objectAt(wx, wy) {
    let best = null;
    for (const o of this.world.objects) {
      const s = objSprite(o.type, o.type === 'plant' ? o.size : 0);
      const x0 = o.x * 8 - 1 + (s.offX || 0), y0 = o.y * 8 - 1 + (s.offY || 0);
      if (wx >= x0 && wx < x0 + s.width && wy >= y0 && wy < y0 + s.height) {
        if (!best || o.type !== 'rug') best = o;
      }
    }
    return best;
  }
  treeAt(wx, wy) {
    const w = this.world;
    for (const tr of w.trees) {
      const gy = w.surface[tr.x] * 8;
      const h = tr.stage === 'grown' ? tr.h * 8 + 4 : 8;
      if (Math.abs(wx - (tr.x * 8 + 4)) < (tr.stage === 'grown' ? 12 : 5) && wy < gy && wy > gy - h) return tr;
    }
    return null;
  }
  hitTest(wx, wy) {
    const w = this.world;
    for (const f of [...this.folk].reverse()) if (Math.abs(wx - f.x) <= 5 && wy <= f.y + 1 && wy >= f.y - 14) return { kind: 'folk', ref: f };
    const c = this.cat;
    if (Math.abs(wx - c.x) <= 6 && wy <= c.y + 1 && wy >= c.y - 8) return { kind: 'cat', ref: c };
    const o = this.objectAt(wx, wy);
    if (o) return { kind: 'obj', ref: o };
    const tr = this.treeAt(wx, wy);
    if (tr) return { kind: 'tree', ref: tr };
    for (const b of w.bushes) { const gy = w.surface[b.x] * 8; if (wx >= b.x * 8 && wx < b.x * 8 + 16 && wy < gy && wy > gy - 10) return { kind: 'bush', ref: b }; }
    const cab = w.cabin;
    if (wx >= cab.x * 8 && wx < cab.x * 8 + 90 && wy >= cab.y * 8 - 58 && wy < cab.y * 8) return { kind: 'cabin' };
    const cx = Math.floor(wx / 8), cy = Math.floor(wy / 8);
    if (!w.inb(cx, cy)) return null;
    const t = w.tile(cx, cy);
    if (!TILES[t].solid && w.bg[w.idx(cx, cy)] === 0) return { kind: 'sky', cx, cy, wx, wy };
    return { kind: 'tile', t, cx, cy };
  }

  interact(h) {
    if (!h) return;
    const w = this.world, a = this.audio;
    switch (h.kind) {
      case 'folk': {
        const f = h.ref;
        f.hop = 0.01; f.hopV = 70; f.pokes++; f.pokeT = 1.2;
        if (f.pokes >= 5) { f.dizzy = 1.6; f.pokes = 0; f.say('star', 1.6); a.play('boing'); }
        else { f.say(f.task?.kind === 'sleep' && f.task.stage === 'do' ? 'bang' : 'heart', 1.2); a.play('giggle'); f.joy = clamp(f.joy + 0.04, 0, 1); }
        this.hearts(f.x, f.y - 14, 2);
        break;
      }
      case 'cat': h.ref.pet(); a.play(Math.random() < 0.3 ? 'meow' : 'purr'); this.hearts(h.ref.x, h.ref.y - 8, 3); break;
      case 'obj': this.useObject(h.ref); break;
      case 'tree': {
        const tr = h.ref;
        if (tr.stage !== 'grown') { a.play('click'); tr.shake = 0.3; break; }
        tr.shake = 0.5; tr.mark = !tr.mark;
        const gy = w.surface[tr.x];
        this.snowPuff(tr.x * 8 + 4, (gy - tr.h * 0.7) * 8, 5);
        a.play('snow'); a.play('click');
        break;
      }
      case 'bush': {
        const b = h.ref; b.shake = 0.4;
        if (b.berries > 0) { b.berries--; b.regrow = 0; this.addRes('food', 1, b.x * 8 + 8, (w.surface[b.x] - 2) * 8); }
        this.snowPuff(b.x * 8 + 8, (w.surface[b.x] - 1) * 8, 2); a.play('snow');
        break;
      }
      case 'cabin': {
        const c = w.cabin;
        for (let i = 0; i < 6; i++) this.parts.push({ x: c.x * 8 + 68, y: (c.y - 7) * 8, vx: (Math.random() - 0.3) * 10, vy: -16 - Math.random() * 10, life: 2.5, col: 'rgba(220,220,235,0.5)', grav: -2, size: 3 });
        this.snowPuff(c.x * 8 + 45, (c.y - 6) * 8, 4);
        a.play('thud'); a.play('snow');
        break;
      }
      case 'sky': {
        if (this.daylight() < 0.4) {
          this.parts.push({ x: h.wx, y: h.wy, vx: 140 * (Math.random() < 0.5 ? -1 : 1), vy: 50, life: 0.9, col: '#fff8e0', glow: true, grav: 0, trail: true });
          a.play('whoosh');
        } else {
          for (let i = 0; i < 3; i++) this.parts.push({ x: this.cam.x - 10 - i * 9, y: h.wy - 10 + (i % 2) * 6, vx: 50, vy: -3, life: 12, bird: true, grav: 0, ph: i });
          a.play('chime', 7);
        }
        break;
      }
      case 'tile': {
        if (h.t === T.CRYSTAL) { a.play('chime', h.cx); this.sparks(h.cx * 8 + 4, h.cy * 8 + 4, 6, '#bff0ff', true); }
        else if (h.t === T.TOPSOIL && !w.under(h.cx, h.cy - 1)) { this.snowPuff(h.cx * 8 + 4, h.cy * 8, 2); a.play('snow'); }
        else { this.crumbs(h.cx, h.cy, 2, h.t); a.play('dig'); }
        break;
      }
    }
  }

  useObject(o) {
    const a = this.audio;
    o.wig = 0.3;
    if (LIGHTS.has(o.type)) { o.on = !o.on; a.play('switch', o.on ? 1 : 0); if (o.on) this.sparks((o.x + 0.5) * 8, (o.y + 0.6) * 8, 4, '#ffe7a0', true); return; }
    switch (o.type) {
      case 'hearth':
        if (this.res.wood >= 1) { this.res.wood--; this.popups.push({ x: (o.x + 1.5) * 8, y: o.y * 8, icon: 'wood', n: -1, life: 1.2, vy: -10 }); this.stoke(o, true); }
        else { a.play('nope'); this.ui.bump('wood', true); this.sparks((o.x + 1.5) * 8, (o.y + 2) * 8, 4, '#ffb050', true); }
        break;
      case 'stove': a.play('sizzle'); for (let i = 0; i < 4; i++) this.steam((o.x + 0.6) * 8, o.y * 8); break;
      case 'phonograph': o.on = !o.on; a.play('switch', o.on ? 1 : 0); if (o.on) { this.notes((o.x + 0.5) * 8, o.y * 8); this.audio.step = 0; } break;
      case 'tub': a.play('splash'); for (let i = 0; i < 10; i++) this.parts.push({ x: (o.x + 0.5 + Math.random() * 3) * 8, y: (o.y + 0.8) * 8, vx: (Math.random() - 0.5) * 40, vy: -30 - Math.random() * 30, life: 0.8, col: '#8ad8e8', glow: true, grav: 200 }); for (let i = 0; i < 3; i++) this.steam((o.x + 2) * 8, o.y * 8 + 4); break;
      case 'plot':
        if (o.grow >= 1) this.harvest(o);
        else { o.grow = Math.min(0.999, o.grow + 0.05); this.drips((o.x + 1) * 8, o.y * 8); a.play('pop', 2); }
        break;
      case 'bed': {
        const f = this.folk.find((f) => f.task?.kind === 'sleep' && f.task.stage === 'do' && f.task.bed === o);
        if (f) { f.say('zzz', 2); a.play('yawn'); }
        else { for (let i = 0; i < 5; i++) this.parts.push({ x: (o.x + 0.7) * 8, y: (o.y + 1) * 8, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 14, life: 1.4, col: '#f4efe2', grav: 12 }); a.play('boing'); }
        break;
      }
      case 'bookshelf': a.play('page'); this.parts.push({ x: (o.x + 1) * 8, y: (o.y + 1) * 8, vx: (Math.random() - 0.5) * 30, vy: -40, life: 0.9, col: ['#a8423a', '#3d5a8a', '#4f7a3c', '#d9a03a'][Math.floor(Math.random() * 4)], grav: 160, size: 3 }); break;
      case 'plant': if (o.size < 3) { o.size++; a.play('harvest'); this.sparks((o.x + 0.5) * 8, o.y * 8, 5, '#7ad06a', true); } else { a.play('pop', 4); } break;
      case 'armchair': a.play('boing'); this.dust((o.x + 1) * 8, (o.y + 2) * 8, 4); break;
      case 'rug': this.dust((o.x + 2) * 8, (o.y + 1) * 8, 10); a.play('snow'); break;
      case 'snowman': this.snowPuff((o.x + 1) * 8, o.y * 8, 3); a.play('snow'); break;
      case 'bell':
        if (this.bellCD > 0) { a.play('click'); break; }
        this.bellCD = 12; o.swing = 1.5;
        a.play('bell');
        this.gathering = 30;
        for (const f of this.folk) { f.gathered = false; if (!f.held && !(f.task?.kind === 'sleep' && f.task.stage === 'do') && !f.arriving) { f.endTask(); f.say('note', 1.5); } }
        break;
      case 'painting': a.play('click'); this.sparks((o.x + 1) * 8, (o.y + 0.5) * 8, 4, '#f0d060', true); break;
      default: a.play('thud');
    }
  }

  // ---------- drawing ----------
  render(time) {
    const w = this.world, fx = this.fx, cam = this.cam;
    const sh = this.shake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
    const view = { x: Math.round(cam.x) + sh, y: Math.round(cam.y) };
    const ox = -view.x, oy = -view.y;
    // backdrop
    const c = w.cabin;
    let deepest = 0;
    for (let x = Math.max(0, Math.floor(view.x / 8)); x <= Math.min(W - 1, Math.floor((view.x + VW) / 8)); x++) deepest = Math.max(deepest, w.surface[x]);
    this.sky.draw(this.bx, this.time, view, time, c.y * 8 + oy, (deepest + 1) * 8 + oy);
    // lit layer
    fx.clearRect(0, 0, VW, VH);
    this.terrain.draw(fx, w, view);
    this.terrain.drawRoomFrames(fx, w, view);
    this.drawSurface(fx, ox, oy, time);
    this.terrain.drawLadders(fx, w, view);
    const order = (o) => (OBJ[o.type].mount === 'wall' ? 0 : OBJ[o.type].mount === 'ceil' ? 1 : o.type === 'rug' ? 3 : 2);
    const objs = w.objects.filter((o) => (o.x + o.w) * 8 + ox > -16 && o.x * 8 + ox < VW + 16 && (o.y + o.h) * 8 + oy > -16 && o.y * 8 + oy < VH + 24).sort((a, b) => order(a) - order(b));
    for (const o of objs) this.drawObject(fx, o, ox, oy, time);
    for (const f of this.folk) if (!f.held) f.draw(fx, ox, oy);
    this.cat.held || this.cat.draw(fx, ox, oy);
    // tub fronts over bathers
    for (const o of objs) if (o.type === 'tub' && this.folk.some((f) => f.task?.obj === o && f.task.stage === 'do')) {
      const s = objSprite('tub');
      fx.drawImage(s, 0, 9, s.width, s.height - 9, o.x * 8 - 1 + ox, o.y * 8 - 1 + 9 + oy, s.width, s.height - 9);
    }
    for (const p of this.parts) if (!p.glow && !p.icon && !p.bird) { fx.fillStyle = p.col; const s = p.size || 1; fx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), s, s); }
    for (const p of this.parts) if (p.bird) {
      const bx = Math.round(p.x + ox), by = Math.round(p.y + oy + Math.sin(time * 3 + p.ph) * 2), up = Math.floor(time * 8 + p.ph) % 2;
      fx.fillStyle = '#1a1420'; fx.fillRect(bx, by, 1, 1); fx.fillRect(bx - 1, by - up, 1, 1); fx.fillRect(bx + 1, by - up, 1, 1); fx.fillRect(bx - 2, by - up * 2 + 1, 1, 1); fx.fillRect(bx + 2, by - up * 2 + 1, 1, 1);
    }
    for (const f of this.flakes) { fx.fillStyle = '#eef2f8'; fx.fillRect(Math.round(f.x + ox), Math.round(f.y + oy), f.s, f.s); }

    // light
    const M = 10;
    const lx0 = Math.floor(view.x / 8) - M, ly0 = Math.floor(view.y / 8) - M;
    const lw = Math.ceil(VW / 8) + 2 * M + 1, lh = Math.ceil(VH / 8) + 2 * M + 1;
    const emit = this.emitters(time);
    const amb = ambient(this.time);
    const L = this.light.compute(w, lx0, ly0, lw, lh, amb, emit);
    this.comp.draw(this.back, this.front, L, lw, lh, lx0 * 8 - view.x, ly0 * 8 - view.y);

    // unlit overlay: glows, marks, held things, bubbles, HUD
    const hx = this.hx;
    hx.clearRect(0, 0, VW, VH);
    this.drawGlows(hx, ox, oy, time);
    this.drawMarks(hx, ox, oy, time);
    for (const f of this.folk) if (f.held) f.draw(hx, ox, oy);
    if (this.cat.held) this.cat.draw(hx, ox, oy);
    if (this.drag?.carryObj) { const o = this.drag.carryObj, s = objSprite(o.type, o.size || 0); hx.globalAlpha = 0.85; hx.drawImage(s, this.mouse.x - s.width / 2, this.mouse.y - s.height / 2); hx.globalAlpha = 1; }
    for (const f of this.folk) if (f.emote) this.bubble(hx, f.x + ox, f.y - 16 - f.hop + oy, f.emote, f.emoteT);
    if (this.cat.purr > 0) this.bubble(hx, this.cat.x + ox, this.cat.y - 10 + oy, 'heart', this.cat.purr);
    for (const p of this.parts) if (p.icon) { hx.globalAlpha = clamp(p.life, 0, 1); hx.drawImage(ICON[p.icon], Math.round(p.x + ox - 4), Math.round(p.y + oy - 4)); hx.globalAlpha = 1; }
    this.ui.draw(hx, time);
  }

  emitters(time) {
    const w = this.world, out = [];
    for (const o of w.objects) {
      const O = OBJ[o.type];
      if (!O.light || !o.on) continue;
      let k = 1;
      if (o.type === 'hearth') { if (o.fuel <= 0) continue; k = (0.55 + 0.45 * Math.min(1, o.fuel * 2)) * (0.9 + 0.1 * Math.sin(time * 9 + o.id) * Math.sin(time * 5.3)) * (1 + Math.max(0, o.flare || 0) * 0.3); }
      if (o.type === 'stove') { if (!this.folk.some((f) => f.task?.obj === o && f.task.stage === 'do')) k = 0.35; }
      if (o.type === 'tub') k = 0.6;
      const ly = O.mount === 'ceil' ? o.y + 0.7 : o.y + o.h * 0.5;
      out.push({ x: o.x + o.w / 2, y: ly, r: O.light[0] * k, g: O.light[1] * k, b: O.light[2] * k });
    }
    for (const f of this.folk) if (f.lantern && !f.held) { const p = f.lanternPos(); out.push({ x: p.x, y: p.y, r: 0.75, g: 0.55, b: 0.3 }); }
    const c = w.cabin;
    if (this.daylight() < 0.5) {
      out.push({ x: c.x + 2.5, y: c.y - 2.5, r: 0.7, g: 0.45, b: 0.25 }); out.push({ x: c.x + 8.2, y: c.y - 2.5, r: 0.7, g: 0.45, b: 0.25 });
      out.push({ x: c.x + 12.5, y: c.y - 3, r: 0.6, g: 0.42, b: 0.22 });
    }
    for (const p of this.parts) if (p.glow && p.life > 0.3 && p.col === '#ffb050' && Math.random() < 0.3) out.push({ x: p.x / 8, y: p.y / 8, r: 0.5, g: 0.3, b: 0.1 });
    return out;
  }

  drawSurface(fx, ox, oy, time) {
    const w = this.world, c = w.cabin;
    // cabin, woodpile, lantern post, laundry line
    const cx = c.x * 8 + ox, cy = c.y * 8 + oy;
    if (cx > -120 && cx < VW + 40) {
      fx.drawImage(CABIN, cx - 1, cy - 58);
      const logs = Math.min(18, Math.ceil(this.res.wood / 3));
      for (let i = 0; i < logs; i++) { const row = Math.floor(i / 6), col = i % 6; fx.drawImage(WOODPILE_LOG, cx - 30 + col * 4 + (row % 2) * 2, cy - 3 - row * 3); }
      fx.fillStyle = '#3e2616'; fx.fillRect(cx - 31, cy - 16, 1, 16); fx.fillRect(cx - 7, cy - 16, 1, 16); fx.fillRect(cx - 32, cy - 16, 26, 1);
      fx.fillStyle = '#eef2f8'; fx.fillRect(cx - 32, cy - 17, 26, 1);
      // lantern post
      fx.fillStyle = '#2a1c16'; fx.fillRect(cx + 104, cy - 26, 2, 26); fx.fillRect(cx + 101, cy - 26, 8, 2);
      fx.fillStyle = '#3b3f48'; fx.fillRect(cx + 102, cy - 24, 5, 6);
      fx.fillStyle = '#eef2f8'; fx.fillRect(cx + 101, cy - 27, 8, 1);
      // laundry line
      fx.fillStyle = '#4a3020'; fx.fillRect(cx + 116, cy - 22, 1, 22); fx.fillRect(cx + 150, cy - 22, 1, 22);
      fx.fillStyle = '#8a7a68';
      for (let i = 0; i < 34; i++) fx.fillRect(cx + 116 + i, cy - 21 + Math.round(Math.sin((i / 34) * Math.PI) * 3), 1, 1);
      const cl = ['#c0443a', '#e8dcc0', '#3a8a8a', '#d9a03a'];
      for (let i = 0; i < 4; i++) { const sw = Math.round(Math.sin(time * 1.5 + i) * 1); fx.fillStyle = cl[i]; fx.fillRect(cx + 120 + i * 7 + sw, cy - 19 + (i % 2), 5, 6 - (i % 2)); }
      // signpost
      fx.fillStyle = '#5e3a20'; fx.fillRect(cx - 44, cy - 14, 2, 14); fx.fillStyle = '#8a5a34'; fx.fillRect(cx - 50, cy - 14, 12, 5); fx.fillStyle = '#eef2f8'; fx.fillRect(cx - 50, cy - 15, 12, 1);
      fx.fillStyle = '#3e2616'; fx.fillRect(cx - 47, cy - 12, 6, 1);
    }
    for (const tr of w.trees) {
      const gy = w.surface[tr.x] * 8 + oy, px = tr.x * 8 + 4 + ox;
      if (px < -40 || px > VW + 40) continue;
      if (tr.stage === 'grown' || tr.stage === 'falling') {
        const s = treeSprite(tr.h, tr.x, true);
        const sway = tr.shake > 0 ? Math.round(Math.sin(tr.shake * 40) * 1.5) : 0;
        if (tr.stage === 'falling') {
          fx.save(); fx.translate(px, gy); fx.rotate(tr.dir * Math.min(1, tr.fall) * Math.PI / 2); fx.drawImage(s, -17, -s.height); fx.restore();
          fx.drawImage(STUMP, px - 4, gy - 5);
        } else fx.drawImage(s, px - 17 + sway, gy - s.height);
      } else if (tr.stage === 'stump') fx.drawImage(STUMP, px - 4, gy - 5);
      else fx.drawImage(SAPLING, px - 3, gy - 5);
    }
    for (const b of w.bushes) {
      const gy = w.surface[b.x] * 8 + oy, px = b.x * 8 + ox;
      if (px < -20 || px > VW + 20) continue;
      const sway = b.shake > 0 ? Math.round(Math.sin(b.shake * 40)) : 0;
      fx.drawImage(bushSprite(b.berries), px + sway, gy - 10);
    }
  }

  drawObject(fx, o, ox, oy, time) {
    const s = objSprite(o.type, o.type === 'plant' ? o.size : 0);
    let px = o.x * 8 - 1 + ox + (s.offX || 0), py = o.y * 8 - 1 + oy + (s.offY || 0);
    if (o.wig > 0) py -= Math.round(Math.sin(o.wig * 20) * 1.5 * (o.wig / 0.3));
    if (o.type === 'lamp' || o.type === 'growlamp') px += Math.round(Math.sin(time * 1.3 + o.id) * 0.6);
    if (o.type === 'bell' && o.swing > 0) { o.swing -= 1 / 60; px += Math.round(Math.sin(o.swing * 12) * 1.5 * o.swing); }
    if (o.type === 'bed') {
      const sleeper = this.folk.find((f) => f.task?.kind === 'sleep' && f.task.stage === 'do' && f.task.bed === o);
      fx.drawImage(s, px, py);
      if (sleeper) { fx.fillStyle = sleeper.look[1]; fx.fillRect(px + 9, py + 9, 13, 4); fx.fillStyle = sleeper.look[3]; fx.fillRect(px + 9, py + 9, 13, 1); }
      return;
    }
    fx.drawImage(s, px, py);
    if (o.type === 'plot') drawMushrooms(fx, o.x * 8 + ox, o.y * 8 + oy, o.grow, o.id);
    if (o.type === 'hearth') {
      // logs pile shrinks with fuel
      fx.fillStyle = '#5e3a20'; if (o.fuel > 0.5) fx.fillRect(px + 10, py + 20, 6, 1);
    }
  }

  drawGlows(hx, ox, oy, time) {
    const w = this.world, night = 1 - this.daylight();
    for (const o of w.objects) {
      const px = o.x * 8 + ox, py = o.y * 8 + oy;
      if (px < -40 || px > VW + 40 || py < -40 || py > VH + 40) continue;
      const halo = (x, y, r, col, a) => {
        hx.fillStyle = col;
        for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
          const d = (i * i + j * j) / (r * r);
          if (d > 1) continue;
          if (((i + j + 64) & 1) && d > 0.35) continue;
          hx.globalAlpha = a * (1 - d); hx.fillRect(x + i, y + j, 1, 1);
        }
        hx.globalAlpha = 1;
      };
      if (o.type === 'hearth' && o.fuel > 0) {
        const f = Math.min(1, o.fuel * 1.6) * (1 + Math.max(0, o.flare || 0) * 0.5);
        for (let i = 0; i < 10; i++) {
          const h = Math.max(1, Math.round((3 + Math.sin(time * 13 + i * 1.7) * 2 + Math.sin(time * 7 + i) * 2 + (i > 2 && i < 7 ? 3 : 0)) * f));
          const x = px + 7 + i, base = py + 20;
          hx.fillStyle = '#e0502a'; hx.fillRect(x, base - h, 1, h);
          if (h > 2) { hx.fillStyle = '#ffa040'; hx.fillRect(x, base - h + 1, 1, h - 1); }
          if (h > 4) { hx.fillStyle = '#ffe890'; hx.fillRect(x, base - h + 3, 1, h - 3); }
        }
        hx.fillStyle = '#ff8030'; hx.fillRect(px + 8, py + 20, 8, 1);
      }
      if (!o.on) continue;
      if (o.type === 'lamp' || o.type === 'growlamp') {
        const sx = Math.round(Math.sin(time * 1.3 + o.id) * 0.6);
        const col = o.type === 'lamp' ? '#fff0b8' : '#f0d0ff';
        hx.fillStyle = col; hx.fillRect(px + 2 + sx, py + 5, 4, 2);
        halo(px + 4 + sx, py + 7, 7, o.type === 'lamp' ? '#ffd890' : '#d8a0ff', 0.22);
      } else if (o.type === 'lantern') { hx.fillStyle = '#fff0b8'; hx.fillRect(px + 2, py + 4, 3, 3); halo(px + 3, py + 5, 6, '#ffd890', 0.2); }
      else if (o.type === 'nightstand') { hx.fillStyle = Math.sin(time * 11 + o.id) > -0.6 ? '#ffe890' : '#ffb050'; hx.fillRect(px + 3, py + 1, 2, 1); hx.fillRect(px + 3, py, 1, 1); halo(px + 4, py + 1, 4, '#ffd890', 0.2); }
      else if (o.type === 'crystallamp') { hx.fillStyle = '#bff0ff'; hx.fillRect(px + 3, py + 1 + Math.round(Math.sin(time * 2) * 0.5), 2, 2); halo(px + 4, py + 6, 7, '#9fe8ff', 0.2); }
      else if (o.type === 'stove' && this.folk.some((f) => f.task?.obj === o && f.task.stage === 'do')) { hx.fillStyle = Math.sin(time * 14) > 0 ? '#ffa040' : '#ffd060'; hx.fillRect(px + 4, py + 10, 7, 3); }
    }
    // cabin windows and lantern post at night
    const c = w.cabin, cx = c.x * 8 + ox, cy = c.y * 8 + oy;
    if (night > 0.4) {
      hx.globalAlpha = Math.min(1, (night - 0.4) * 3);
      for (const [a, b, ww, hh] of CABIN_WINDOWS) {
        hx.fillStyle = '#ffc870'; hx.fillRect(cx + a, cy - 58 + b, ww, hh);
        hx.fillStyle = '#5e3a20'; hx.fillRect(cx + a + 5, cy - 58 + b, 2, hh); hx.fillRect(cx + a, cy - 58 + b + 4, ww, 2);
      }
      hx.fillStyle = '#fff0b8'; hx.fillRect(cx + 103, cy - 23, 3, 4);
      hx.globalAlpha = 1;
    }
    // crystal glints in rock
    const tx0 = Math.floor(-ox / 8), ty0 = Math.floor(-oy / 8);
    for (let y = ty0; y < ty0 + 35; y++) for (let x = tx0; x < tx0 + 61; x++) {
      if (w.tile(x, y) !== T.CRYSTAL) continue;
      const tw = Math.sin(time * 2 + hash2(x, y) * 30);
      if (tw > 0.85) { hx.fillStyle = '#e8fcff'; hx.fillRect(x * 8 + ox + 2 + (hash2(x, y, 1) * 4 | 0), y * 8 + oy + 2, 1, 1); }
    }
    // folk lanterns
    for (const f of this.folk) if (f.lantern && !f.held && f.task?.kind !== 'sleep') {
      const px = Math.round(f.x - 4 + ox) + (f.face > 0 ? 6 : -2), py = Math.round(f.y - 12 - f.hop + oy) + 6;
      hx.fillStyle = '#fff0b8'; hx.fillRect(px + 2, py + 2, 1, 2);
    }
    for (const p of this.parts) if (p.glow) {
      hx.globalAlpha = clamp(p.life * 2, 0, 1); hx.fillStyle = p.col;
      if (p.trail) { for (let k = 0; k < 10; k++) { hx.globalAlpha = (1 - k / 10) * clamp(p.life * 2, 0, 1); hx.fillRect(Math.round(p.x + ox - p.vx * k * 0.012), Math.round(p.y + oy - p.vy * k * 0.012), 1, 1); } }
      else hx.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.size || 1, p.size || 1);
    }
    hx.globalAlpha = 1;
  }

  drawMarks(hx, ox, oy, time) {
    const w = this.world;
    const tx0 = Math.max(0, Math.floor(-ox / 8)), ty0 = Math.max(0, Math.floor(-oy / 8));
    for (let y = ty0; y < Math.min(H, ty0 + 35); y++) for (let x = tx0; x < Math.min(W, tx0 + 61); x++) {
      const i = y * W + x;
      const px = x * 8 + ox, py = y * 8 + oy;
      if (w.mark[i] && w.solid(x, y)) {
        const live = this.canReachDig(x, y);
        hx.fillStyle = w.mark[i] === 2 ? 'rgba(120,200,255,0.28)' : 'rgba(255,200,90,0.3)';
        hx.globalAlpha = live ? 1 : 0.45;
        hx.fillRect(px, py, 8, 8);
        hx.fillStyle = w.mark[i] === 2 ? 'rgba(160,220,255,0.6)' : 'rgba(255,215,120,0.65)';
        for (let k = 0; k < 8; k++) if (((k + x * 8 + y * 8 + (live ? Math.floor(time * 4) : 0)) & 3) === 0) hx.fillRect(px + k, py + (7 - k), 1, 1);
        hx.globalAlpha = 1;
        if (w.prog[i] > 0) { hx.fillStyle = '#140c0e'; const n = Math.ceil(w.prog[i] * 4); for (let k = 0; k < n; k++) hx.fillRect(px + 2 + k, py + 3 + (k % 2) * 2, 2, 1); }
      }
      if (w.ladder[i] && w.solid(x, y)) { hx.fillStyle = 'rgba(200,148,90,0.55)'; hx.fillRect(px + 1, py, 1, 8); hx.fillRect(px + 6, py, 1, 8); hx.fillRect(px + 2, py + 3, 4, 1); }
    }
    // unfinished rooms: dashed outline and a progress bar
    for (const r of w.rooms) {
      if (r.state !== 'dig' && r.state !== 'build') continue;
      this.roomOutline(hx, r.type, r.x, r.y, ox, oy, r.state === 'build' ? '#9fe0ff' : '#7ab0d8', time);
      const live = r.state === 'build' ? w.roomCells(r.type, r.x, r.y).some(([a, b]) => this.reachSet?.has(b * W + a) ?? true) : w.roomCells(r.type, r.x, r.y).some(([a, b]) => w.solid(a, b) && this.canReachDig(a, b));
      if (!live) this.bubble(hx, (r.x + r.w / 2) * 8 + ox, r.y * 8 + oy + 6 + Math.round(Math.sin(time * 3)), 'question', 1);
      if (r.state === 'build') {
        const bx = (r.x + r.w / 2) * 8 + ox - 12, by = r.y * 8 + oy - 6;
        hx.fillStyle = '#140c0e'; hx.fillRect(bx - 1, by - 1, 26, 4);
        hx.fillStyle = '#7ad06a'; hx.fillRect(bx, by, Math.round(24 * Math.min(1, r.progress / r.work)), 2);
        hx.drawImage(ICON.hammer, bx - 11, by - 4);
      }
    }
    for (const tr of w.trees) if (tr.mark && tr.stage === 'grown') {
      const gy = w.surface[tr.x] * 8 + oy;
      hx.drawImage(ICON.axe, tr.x * 8 + ox, gy - tr.h * 8 - 14 + Math.round(Math.sin(time * 4) * 1.5));
    }
  }
  roomOutline(hx, type, x, y, ox, oy, col, time) {
    const w = this.world;
    hx.fillStyle = col;
    const cells = w.roomCells(type, x, y);
    const set = new Set(cells.map(([a, b]) => a + ',' + b));
    const dash = Math.floor(time * 8);
    for (const [a, b] of cells) {
      const px = a * 8 + ox, py = b * 8 + oy;
      const edge = (dx, dy) => !set.has(a + dx + ',' + (b + dy));
      for (let k = 0; k < 8; k++) {
        if (((k + a * 8 + b * 8 + dash) & 3) > 1) continue;
        if (edge(0, -1)) hx.fillRect(px + k, py, 1, 1);
        if (edge(0, 1)) hx.fillRect(px + k, py + 7, 1, 1);
        if (edge(-1, 0)) hx.fillRect(px, py + k, 1, 1);
        if (edge(1, 0)) hx.fillRect(px + 7, py + k, 1, 1);
      }
    }
  }
  bubble(hx, x, y, icon, t) {
    const img = ICON[icon];
    if (!img) return;
    const a = clamp(t * 3, 0, 1);
    hx.globalAlpha = a;
    const bx = Math.round(x - 6), by = Math.round(y - 10);
    hx.fillStyle = '#140c0e'; hx.fillRect(bx, by + 1, 13, 10); hx.fillRect(bx + 1, by, 11, 12);
    hx.fillStyle = '#f4ead4'; hx.fillRect(bx + 1, by + 1, 11, 10);
    hx.fillStyle = '#140c0e'; hx.fillRect(bx + 5, by + 12, 3, 1); hx.fillRect(bx + 6, by + 13, 1, 1);
    hx.fillStyle = '#f4ead4'; hx.fillRect(bx + 5, by + 11, 3, 1);
    hx.drawImage(img, bx + 2, by + 1);
    hx.globalAlpha = 1;
  }

  // ---------- loop ----------
  start() {
    let last = performance.now(), acc = 0, frames = 0;
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.render(now / 1000);
      frames++; acc += dt; if (acc > 1) { this.fps = frames; frames = 0; acc = 0; }
      requestAnimationFrame(loop);
    };
    this.countMarks();
    requestAnimationFrame(loop);
  }

  // ---------- saving ----------
  save() {
    if (!this.started) return;
    try {
      const w = this.world;
      const enc = (a) => { let s = ''; for (let i = 0; i < a.length; i += 8192) s += String.fromCharCode.apply(null, a.subarray(i, i + 8192)); return btoa(s); };
      const objId = new Map(w.objects.map((o, i) => [o, i]));
      const data = {
        seed: this.seed, time: this.time, day: this.day, res: this.res, goal: this.goal, stats: this.stats, cam: this.cam,
        fg: enc(w.fg), bg: enc(w.bg), ladder: enc(w.ladder), mark: enc(w.mark), surface: Array.from(w.surface), cabin: w.cabin,
        rooms: w.rooms.map((r) => ({ type: r.type, x: r.x, y: r.y, state: r.state, progress: r.progress, work: r.work })),
        objects: w.objects.map((o) => ({ type: o.type, x: o.x, y: o.y, room: o.room, on: o.on, grow: o.grow, fuel: o.fuel, size: o.size, tended: o.tended })),
        trees: w.trees, bushes: w.bushes,
        folk: this.folk.map((f) => ({ x: f.x, y: f.y, look: f.look, energy: f.energy, hunger: f.hunger, joy: f.joy, bed: f.bed ? objId.get(f.bed) : -1, arriving: f.arriving })),
        cat: { x: this.cat.x, y: this.cat.y },
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* storage unavailable: play on without saving */ }
  }
  load() {
    let data;
    try {
      if (location.hash === '#new') { localStorage.removeItem(SAVE_KEY); return false; }
      data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    } catch { return false; }
    if (!data) return false;
    try {
      const dec = (s, a) => { const b = atob(s); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); };
      const w = new World(data.seed);
      dec(data.fg, w.fg); dec(data.bg, w.bg); dec(data.ladder, w.ladder); dec(data.mark, w.mark);
      w.surface.set(data.surface); w.cabin = data.cabin;
      for (const r of data.rooms) {
        const room = { id: w.rooms.length, type: r.type, x: r.x, y: r.y, w: ROOMS[r.type].w, h: ROOMS[r.type].h, state: r.state, progress: r.progress, work: r.work, objects: [] };
        w.rooms.push(room);
        if (r.state !== 'gone') for (const [cx, cy] of w.roomCells(r.type, r.x, r.y)) w.roomAt[w.idx(cx, cy)] = room.id;
      }
      for (const s of data.objects) {
        const o = w.addObject(s.type, s.x, s.y, s.room);
        Object.assign(o, { on: s.on, grow: s.grow, fuel: s.fuel, size: s.size, tended: s.tended });
        if (s.room >= 0) w.rooms[s.room].objects.push(o);
      }
      w.trees = data.trees; w.bushes = data.bushes;
      this.world = w;
      this.seed = data.seed; this.time = data.time; this.day = data.day; this.res = data.res; this.goal = data.goal || 0;
      this.stats = Object.assign(this.stats, data.stats || {});
      this.cam = data.cam || { x: 0, y: 0 };
      this.folk = data.folk.map((s) => {
        const f = new Folk(this, s.x, s.y, s.look);
        Object.assign(f, { energy: s.energy, hunger: s.hunger, joy: s.joy, arriving: s.arriving });
        if (s.bed >= 0 && w.objects[s.bed]) { f.bed = w.objects[s.bed]; this.bedOwners.set(f.bed, f); }
        return f;
      });
      this.cat = new Cat(this, data.cat.x, data.cat.y);
      this.hasSave = true;
      return true;
    } catch (e) {
      console.warn('save could not be loaded', e);
      return false;
    }
  }
  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.claims.clear(); this.reserved.clear(); this.bedOwners.clear();
    this.parts = []; this.popups = [];
    this.stats = { dug: 0, chopped: 0, rooms: {}, decor: 0 };
    this.fresh(this.seed + 1);
    this.countMarks();
    this.hasSave = false;
  }
}
