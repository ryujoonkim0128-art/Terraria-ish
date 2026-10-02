// Burrowfolk and the cat: needs, jobs, leisure, walking along paths, and being picked up.
import { bfs } from './path.js';
import { TILES, OBJ, DAY_LEN } from './content.js';
import { folkSprites, toolSprite, LANTERN, BINDLE, CAT_SPR, HATS, COATS, SKINS } from './sprites.js';
import { flipped, clamp } from './util.js';

// Cells a digger can work on from where they stand: beside, below, and up to four above (rooms are tall).
export const REACH = [];
for (const dy of [0, -1, 1, -2, -3, -4]) for (const dx of [-1, 1, 0]) if (!(dx === 0 && (dy === 0 || dy === -1))) REACH.push([dx, dy]);
const GRAV = 420;

// Shared walker: position in pixels (x = centre, y = feet), follows a cell path, falls when unsupported.
class Walker {
  constructor(game, x, y) {
    this.g = game; this.x = x; this.y = y; this.vy = 0;
    this.path = null; this.seg = null; this.face = 1; this.held = false; this.t = Math.random() * 10;
    this.speed = 24; this.hop = 0; this.hopV = 0; this.squash = 0; this.falling = false;
  }
  get cx() { return Math.floor(this.x / 8); }
  get cy() { return Math.floor((this.y - 1) / 8); }

  goTo(goal, limit) {
    const p = bfs(this.g.world, this.cx, this.cy, goal, limit);
    this.path = p; this.seg = null;
    return p;
  }
  stop() { this.path = null; this.seg = null; }

  // returns 'arrived' | 'moving' | 'stuck'
  follow(dt) {
    const w = this.g.world;
    if (!this.path) return 'stuck';
    if (!this.seg) {
      if (!this.path.length) { this.path = null; return 'arrived'; }
      const n = this.path[0], fx = this.cx, fy = this.cy;
      if (!w.standable(n.x, n.y)) { this.path = null; return 'stuck'; }
      this.seg = { type: n.x === fx ? 'climb' : n.y === fy ? 'walk' : n.y < fy ? 'step' : 'drop', tx: n.x * 8 + 4, ty: n.y * 8 + 8, ny: n.y };
    }
    const s = this.seg, sp = this.speed * dt;
    if (s.tx !== this.x) this.face = s.tx > this.x ? 1 : -1;
    if (s.type === 'climb') {
      this.x += clamp(s.tx - this.x, -sp, sp);
      this.y += clamp(s.ty - this.y, -sp * 0.75, sp * 0.75);
      this.climbing = true;
    } else if (s.type === 'walk') {
      this.x += clamp(s.tx - this.x, -sp, sp);
      this.climbing = false;
    } else if (s.type === 'step') {
      const dx = s.tx - this.x, dy = s.ty - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.x += (dx / d) * Math.min(sp, d); this.y += (dy / d) * Math.min(sp, d);
      this.climbing = false;
    } else {
      this.climbing = false;
      if (Math.abs(s.tx - this.x) > 0.5) this.x += clamp(s.tx - this.x, -sp, sp);
      else { this.x = s.tx; this.vy += GRAV * dt; this.y = Math.min(s.ty, this.y + this.vy * dt); }
    }
    if (Math.abs(s.tx - this.x) < 0.01 && Math.abs(s.ty - this.y) < 0.01) {
      this.x = s.tx; this.y = s.ty; this.vy = 0;
      this.path.shift(); this.seg = null;
      if (!this.path.length) { this.path = null; this.climbing = false; return 'arrived'; }
    }
    return 'moving';
  }

  // Gravity when not on a path segment that holds us up. Returns true while airborne.
  physics(dt) {
    const w = this.g.world;
    // pushed into rock (a floor appeared, a drop landed badly): climb out upward
    if (w.solid(this.cx, this.cy)) {
      for (let k = 1; k < 6; k++) if (!w.solid(this.cx, this.cy - k)) { this.y = (this.cy - k) * 8 + 8; break; }
    }
    if (this.seg && this.seg.type !== 'drop') return false;
    if (this.seg && this.seg.type === 'drop' && Math.abs(this.seg.tx - this.x) > 0.5) return false;
    const onGround = w.footing(this.cx, this.cy) && Math.abs(this.y - (this.cy * 8 + 8)) < 0.6;
    if (onGround && this.vy >= 0) {
      if (this.falling) { this.land(this.vy); this.falling = false; this.stop(); }
      this.vy = 0; this.y = this.cy * 8 + 8;
      return false;
    }
    if (this.seg) return false;
    this.vy = Math.min(300, this.vy + GRAV * dt);
    const ny = this.y + this.vy * dt;
    // land on the first supporting cell we pass
    const cx = this.cx;
    for (let yy = Math.floor((this.y - 1) / 8); yy <= Math.floor((ny - 1) / 8); yy++) {
      if (w.footing(cx, yy) && yy * 8 + 8 <= ny + 0.01 && yy * 8 + 8 >= this.y - 0.01) {
        this.y = yy * 8 + 8; this.land(this.vy); this.vy = 0; this.falling = false; this.stop(); return false;
      }
    }
    this.y = ny; this.falling = true;
    if (this.y > w.h * 8) { this.y = this.g.world.surface[cx] * 8; this.vy = 0; }
    return true;
  }
  land(v) { if (v > 110) { this.squash = 0.25; this.g.dust(this.x, this.y, 4); this.g.audio.play('thud'); } }

  updateHop(dt) {
    if (this.hop > 0 || this.hopV) { this.hopV -= 300 * dt; this.hop += this.hopV * dt; if (this.hop <= 0) { this.hop = 0; this.hopV = 0; } }
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt);
  }
}

// ---------------------------------------------------------------------------------------------
let folkN = 0;
export class Folk extends Walker {
  constructor(game, x, y, look) {
    super(game, x, y);
    const r = game.rand;
    this.id = ++folkN;
    this.look = look || [HATS[Math.floor(r() * HATS.length)], COATS[Math.floor(r() * COATS.length)], SKINS[Math.floor(r() * SKINS.length)], HATS[Math.floor(r() * HATS.length)]];
    this.spr = folkSprites(this.look);
    this.speed = 22 + r() * 8;
    this.energy = 0.75 + r() * 0.25; this.hunger = 0.7 + r() * 0.3; this.joy = 0.7;
    this.task = null; this.think = r() * 0.5; this.emote = null; this.emoteT = 0;
    this.bed = null; this.pokes = 0; this.pokeT = 0; this.dizzy = 0;
    this.arriving = false; this.lantern = false;
  }

  say(icon, t = 1.6) { this.emote = icon; this.emoteT = t; }

  // ---------- needs & main loop ----------
  update(dt) {
    const g = this.g, gdt = dt * g.speedMul;
    this.t += dt;
    this.updateHop(dt);
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
    if (this.pokeT > 0) { this.pokeT -= dt; if (this.pokeT <= 0) this.pokes = 0; }
    if (this.dizzy > 0) this.dizzy -= dt;
    if (this.held) return;
    const sleeping = this.task?.kind === 'sleep' && this.task.stage === 'do';
    this.energy = clamp(this.energy - (sleeping ? 0 : gdt / (DAY_LEN * 0.7)), 0, 1);
    this.hunger = clamp(this.hunger - gdt / (DAY_LEN * 0.6), 0, 1);
    let jd = -gdt / (DAY_LEN * 1.5);
    if (this.hunger < 0.2) jd -= gdt / (DAY_LEN * 0.5);
    if (this.energy < 0.15) jd -= gdt / (DAY_LEN * 0.5);
    const room = g.world.roomOf(this.cx, this.cy);
    if (room && room.state === 'done') jd += gdt * g.roomCozy(room) * 0.00012;
    if (g.cold && !room) jd -= gdt / (DAY_LEN * 1.2);
    this.joy = clamp(this.joy + jd, 0, 1);

    // lantern in the dark
    const amb = g.light.at(this.cx, this.cy - 1);
    this.lantern = amb < 0.32 && !sleeping;

    if (this.physics(gdt)) return;
    if (this.dizzy > 0) return;
    if (!this.task) {
      this.think -= gdt;
      if (this.think <= 0) { this.decide(); this.think = 0.4 + Math.random() * 0.6; }
      return;
    }
    this.runTask(gdt);
  }

  // ---------- deciding ----------
  decide() {
    const g = this.g;
    if (this.arriving) return this.setTask(this.taskArrive());
    const sleepy = this.energy < 0.12 || (g.isSleepTime() && this.energy < 0.85);
    if (sleepy && this.setTask(this.taskSleep())) return;
    if (this.hunger < 0.35 && this.setTask(this.taskEat())) return;
    if (g.gathering > 0 && !this.gathered && this.setTask(this.taskGather())) return;
    if (!g.isSleepTime() && this.setTask(this.findJob())) return;
    if (g.isEvening() && Math.random() < 0.6 && this.setTask(this.taskRelax(['hearth', 'armchair', 'stool']))) return;
    const r = Math.random();
    if (r < 0.25 && this.setTask(this.taskChat())) return;
    if (r < 0.6 && this.setTask(this.taskRelax(null))) return;
    if (r < 0.85 && this.setTask(this.taskWander())) return;
    this.setTask({ kind: 'idle', stage: 'do', time0: 1 + Math.random() * 2 });
  }
  setTask(t) {
    if (!t) return false;
    this.task = t;
    t.stage = t.stage || 'go';
    t.time = t.time ?? 0;
    return true;
  }
  endTask() {
    const t = this.task;
    if (t) this.g.release(this, t);
    this.task = null; this.stop(); this.think = 0.2;
  }
  interrupt() { if (this.task?.kind === 'sleep' && this.task.stage === 'do') this.say('bang'); this.endTask(); }

  findJob() {
    const g = this.g, w = g.world;
    // keep the fire going
    if (g.res.wood >= 1) for (const h of w.objectsOf('hearth')) {
      if (h.fuel < 0.35 && !g.taken(h, 'stoke')) { const t = this.reachObj(h, 'stoke', 1.2); if (t) return t; }
    }
    // digging
    if (g.markCount > 0) {
      const p = this.goTo((x, y) => {
        for (const [dx, dy] of REACH) {
          const tx = x + dx, ty = y + dy;
          if (!w.inb(tx, ty)) continue;
          const i = w.idx(tx, ty);
          if (w.mark[i] && w.diggable(tx, ty) && !g.reserved.has(i)) return true;
        }
        return false;
      }, 6000);
      if (p) {
        const end = p.length ? p[p.length - 1] : { x: this.cx, y: this.cy };
        for (const [dx, dy] of REACH) {
          const tx = end.x + dx, ty = end.y + dy;
          if (!w.inb(tx, ty)) continue;
          const i = w.idx(tx, ty);
          if (w.mark[i] && w.diggable(tx, ty) && !g.reserved.has(i)) {
            g.reserved.set(i, this);
            return { kind: 'dig', tx, ty, i, stage: 'go', keepPath: true };
          }
        }
      }
    }
    // construction
    for (const r of w.rooms) {
      if (r.state !== 'build' || g.count(r, 'build') >= 3) continue;
      const p = this.goTo((x, y) => w.roomOf(x, y) === r, 6000);
      if (p) return { kind: 'build', room: r, stage: 'go', keepPath: true };
    }
    // ripe mushrooms
    for (const o of w.objectsOf('plot')) if (o.grow >= 1 && !g.taken(o, 'harvest')) { const t = this.reachObj(o, 'harvest', 1.5); if (t) return t; }
    // marked trees
    for (const tr of w.trees) if (tr.mark && tr.stage === 'grown' && !g.taken(tr, 'chop')) {
      const p = this.goTo((x, y) => Math.abs(x - tr.x) === 1 && y === w.surface[x] - 1, 8000);
      if (p) { g.claim(tr, 'chop', this); return { kind: 'chop', tree: tr, obj: tr, job: 'chop', stage: 'go', keepPath: true }; }
    }
    // cooking
    if (g.res.food >= 1 && g.res.meal < Math.max(4, g.folk.length * 2) && g.res.meal < g.cap('meal')) {
      for (const o of w.objectsOf('stove')) if (!g.taken(o, 'cook')) { const t = this.reachObj(o, 'cook', 4); if (t) return t; }
    }
    // tending the farm
    for (const o of w.objectsOf('plot')) if (o.grow < 0.85 && !o.tended && !g.taken(o, 'tend')) { const t = this.reachObj(o, 'tend', 2.5); if (t) return t; }
    // berries by day when the pantry is low
    if (g.daylight() > 0.4 && g.res.food < 12) for (const b of w.bushes) if (b.berries > 0 && !g.taken(b, 'forage')) {
      const p = this.goTo((x, y) => Math.abs(x - b.x - 1) <= 1 && y === w.surface[x] - 1, 6000);
      if (p) { g.claim(b, 'forage', this); return { kind: 'forage', bush: b, obj: b, job: 'forage', stage: 'go', keepPath: true }; }
    }
    return null;
  }

  // Path to a cell in front of an object and claim it for a job.
  reachObj(o, job, time, cells) {
    const w = this.g.world;
    const spots = cells || (() => { const s = []; for (let i = 0; i < o.w; i++) s.push([o.x + i, o.y + o.h - 1 + (OBJ[o.type].mount === 'floor' ? 0 : OBJ[o.type].lift || 0)]); return s; })();
    const p = this.goTo((x, y) => spots.some(([a, b]) => a === x && b === y), 6000);
    if (!p) return null;
    this.g.claim(o, job, this);
    return { kind: 'obj', job, obj: o, stage: 'go', dur: time, keepPath: true };
  }

  taskSleep() {
    const g = this.g, w = g.world;
    if (this.bed && (this.bed.gone || g.bedOwner(this.bed) !== this)) this.bed = null;
    if (!this.bed) {
      let best = null, bd = 1e9;
      for (const b of w.objectsOf('bed')) {
        if (g.bedOwner(b)) continue;
        const d = Math.abs(b.x - this.cx) + Math.abs(b.y - this.cy);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) { this.bed = best; g.setBedOwner(best, this); }
    }
    if (this.bed) {
      const b = this.bed;
      const p = this.goTo((x, y) => y === b.y + 1 && x >= b.x && x < b.x + b.w, 8000);
      if (p) return { kind: 'sleep', bed: b, stage: 'go', keepPath: true };
    }
    // no bed: curl up by a hearth, or right here
    const h = w.objectsOf('hearth')[0];
    if (h && this.goTo((x, y) => y === h.y + 2 && x >= h.x - 1 && x <= h.x + 3, 8000)) return { kind: 'sleep', bed: null, stage: 'go', keepPath: true };
    return { kind: 'sleep', bed: null, stage: 'do' };
  }

  taskEat() {
    const g = this.g, w = g.world;
    if (g.res.meal < 1 && g.res.food < 1) { if (!this.emote) this.say('hungry', 2); return null; }
    const seats = w.objects.filter((o) => o.type === 'stool' || o.type === 'table' || o.type === 'armchair');
    let best = null;
    const p = this.goTo((x, y) => { for (const o of seats) if (y === o.y + o.h - 1 && x >= o.x && x < o.x + o.w && !g.taken(o, 'sit')) { best = o; return true; } return false; }, 6000);
    if (p && best) { g.claim(best, 'sit', this); return { kind: 'eat', obj: best, job: 'sit', stage: 'go', keepPath: true, dur: 3 }; }
    return { kind: 'eat', stage: 'do', dur: 3 };
  }

  taskGather() {
    const g = this.g, w = g.world;
    const h = w.objectsOf('hearth')[0];
    const target = h ? (x, y) => w.roomOf(x, y) === w.rooms[h.room] : (x, y) => Math.abs(x - g.world.cabin.shaft) < 6 && y === w.surface[x] - 1;
    if (this.goTo(target, 8000)) return { kind: 'gather', stage: 'go', keepPath: true };
    this.gathered = true;
    return null;
  }

  taskRelax(types) {
    const g = this.g, w = g.world;
    const pool = w.objects.filter((o) => (types ? types.includes(o.type) : ['armchair', 'stool', 'bookshelf', 'tub', 'phonograph', 'hearth', 'plant', 'painting', 'crystallamp', 'snowman', 'rug'].includes(o.type)) && !g.taken(o, 'relax'));
    if (!pool.length) return null;
    const o = pool[Math.floor(Math.random() * pool.length)];
    if (o.type === 'phonograph' && !o.on && Math.random() < 0.5) return null;
    const t = this.reachObj(o, 'relax', 6 + Math.random() * 6);
    if (t) t.kind = 'relax';
    return t;
  }

  taskChat() {
    const g = this.g;
    const others = g.folk.filter((f) => f !== this && !f.held && !f.arriving && (!f.task || f.task.kind === 'idle' || f.task.kind === 'wander'));
    if (!others.length) return null;
    const o = others[Math.floor(Math.random() * others.length)];
    if (Math.abs(o.cx - this.cx) + Math.abs(o.cy - this.cy) > 30) return null;
    const ox = o.cx, oy = o.cy;
    const p = this.goTo((x, y) => y === oy && Math.abs(x - ox) === 1, 3000);
    if (!p) return null;
    o.endTask(); o.stop();
    o.setTask({ kind: 'chat', with: this, stage: 'wait', time: 0 });
    return { kind: 'chat', with: o, stage: 'go', keepPath: true, lead: true };
  }

  taskWander() {
    const n = 4 + Math.floor(Math.random() * 30);
    let k = 0;
    const p = this.goTo(() => ++k > n && Math.random() < 0.3, 2000);
    if (!p || !p.length) return null;
    return { kind: 'wander', stage: 'go', keepPath: true };
  }

  taskArrive() {
    const g = this.g, w = g.world, sx = w.cabin.shaft;
    if (this.goTo((x, y) => Math.abs(x - sx - 4) <= 1 && y === w.surface[x] - 1, 9000)) return { kind: 'arrive', stage: 'go', keepPath: true };
    this.arriving = false;
    return null;
  }

  // ---------- doing ----------
  runTask(dt) {
    const g = this.g, w = g.world, t = this.task;
    if (t.stage === 'go') {
      if (!this.path && !t.keepPath) { this.endTask(); return; }
      const r = this.follow(dt);
      if (r === 'stuck') { this.endTask(); return; }
      if (r === 'arrived' || !this.path) { t.stage = 'do'; t.time = 0; this.onArrive(t); }
      return;
    }
    if (t.stage === 'wait') { t.time += dt; if (t.time > 8) this.endTask(); return; }
    t.time += dt;
    switch (t.kind) {
      case 'dig': {
        if (!w.mark[t.i] || !w.diggable(t.tx, t.ty)) { this.endTask(); return; }
        this.face = t.tx >= this.cx ? (t.tx === this.cx ? this.face : 1) : -1;
        const hard = TILES[w.tile(t.tx, t.ty)].hard;
        const rate = 0.75 + this.joy * 0.5;
        w.prog[t.i] += (dt * rate) / hard;
        if (Math.floor(t.time * 2.6) !== Math.floor((t.time - dt) * 2.6)) { g.audio.play(hard > 1.5 ? 'clink' : 'dig'); g.crumbs(t.tx, t.ty, 2, w.tile(t.tx, t.ty)); }
        if (w.prog[t.i] >= 1) { g.digDone(t.tx, t.ty, this); this.endTask(); }
        break;
      }
      case 'build': {
        const r = t.room;
        if (r.state !== 'build') { this.endTask(); return; }
        r.progress += dt * (0.8 + this.joy * 0.4);
        if (Math.floor(t.time * 2.4) !== Math.floor((t.time - dt) * 2.4)) { g.audio.play('build'); g.sparks(this.x + this.face * 5, this.y - 6, 2, '#e8c070'); }
        if (Math.random() < dt * 0.25) this.walkWithin(r);
        if (r.progress >= r.work) { g.roomDone(r); this.say('star'); this.endTask(); }
        break;
      }
      case 'chop': {
        const tr = t.tree;
        if (tr.stage !== 'grown') { this.endTask(); return; }
        this.face = tr.x > this.cx ? 1 : -1;
        if (Math.floor(t.time * 2) !== Math.floor((t.time - dt) * 2)) { g.audio.play('chop'); tr.shake = 0.3; g.snowPuff(tr.x * 8 + 4, (w.surface[tr.x] - tr.h * 0.6) * 8, 3); }
        if (t.time > 3.2) { g.fellTree(tr, this.face); this.endTask(); }
        break;
      }
      case 'forage': {
        const b = t.bush;
        if (t.time > 1.6) {
          if (b.berries > 0) { g.addRes('food', b.berries, b.x * 8 + 8, (w.surface[b.x] - 1) * 8); g.audio.play('harvest'); b.berries = 0; b.regrow = 0; b.shake = 0.4; }
          this.endTask();
        }
        break;
      }
      case 'obj': this.doObj(t, dt); break;
      case 'sleep': {
        this.energy = clamp(this.energy + dt / (DAY_LEN * (t.bed ? 0.22 : 0.4)), 0, 1);
        if (!t.bed) this.joy = clamp(this.joy - dt / (DAY_LEN * 3), 0, 1);
        if (!this.emote || this.emote === 'zzz') this.say('zzz', 1);
        if (this.energy >= 1 && !g.isSleepTime()) { g.audio.play('yawn'); this.endTask(); }
        else if (this.energy >= 1 && t.time > 40 && Math.random() < dt * 0.02) this.endTask();
        break;
      }
      case 'eat': {
        if (t.time > (t.dur || 3)) {
          if (g.res.meal >= 1) { g.res.meal--; this.hunger = 1; this.joy = clamp(this.joy + 0.12, 0, 1); this.say('heart'); }
          else if (g.res.food >= 1) { g.res.food--; this.hunger = clamp(this.hunger + 0.55, 0, 1); this.say('food'); }
          g.audio.play('munch');
          this.endTask();
        }
        break;
      }
      case 'relax': {
        const o = t.obj;
        let rate = 0.05 * (OBJ[o.type].comfort || 0.5);
        if (o.type === 'tub' && Math.random() < dt * 0.8) g.steam(this.x, this.y - 8);
        if (o.type === 'phonograph' && o.on) { rate += 0.04; if (!this.emote) this.say('note', 1); }
        if (o.type === 'bookshelf' && Math.random() < dt * 0.2) g.audio.play('page');
        this.joy = clamp(this.joy + rate * dt, 0, 1);
        if (t.time > t.dur) { if (this.joy > 0.8) this.say('heart'); this.endTask(); }
        break;
      }
      case 'chat': {
        const o = t.with;
        if (!o.task || o.task.kind !== 'chat' || o.held) { this.endTask(); return; }
        if (t.lead && o.task.stage === 'wait') { o.task.stage = 'do'; o.task.time = 0; }
        this.face = o.x > this.x ? 1 : -1;
        if (Math.floor(t.time * 0.9 + (t.lead ? 0 : 0.5)) !== Math.floor((t.time - dt) * 0.9 + (t.lead ? 0 : 0.5))) {
          const ic = ['heart', 'note', 'star', 'question', 'food', 'fire'][Math.floor(Math.random() * 6)];
          this.say(ic, 1); this.hop = 0.01; this.hopV = 40;
        }
        this.joy = clamp(this.joy + dt * 0.03, 0, 1);
        if (t.time > 5) { this.endTask(); }
        break;
      }
      case 'gather': {
        if (t.time < 0.1) { this.say('note'); }
        if (Math.floor(t.time * 1.5) !== Math.floor((t.time - dt) * 1.5)) { this.hop = 0.01; this.hopV = 60; }
        if (t.time > 4) { this.joy = clamp(this.joy + 0.25, 0, 1); this.gathered = true; this.say('heart'); this.endTask(); }
        break;
      }
      case 'arrive': {
        if (t.time < 0.05) { g.audio.play('arrive'); this.say('heart', 3); g.hearts(this.x, this.y - 14, 6); }
        if (t.time > 1.5) { this.arriving = false; this.endTask(); }
        break;
      }
      case 'wander': this.endTask(); break;
      case 'idle': if (t.time > (t.time0 || 2)) this.endTask(); break;
      default: this.endTask();
    }
  }
  onArrive(t) {
    if (t.kind === 'chat' && t.with) this.face = t.with.x > this.x ? 1 : -1;
    if (t.kind === 'eat' && t.obj) this.x = (t.obj.x + t.obj.w / 2) * 8 + (t.obj.type === 'table' ? -4 : 0);
    if (t.kind === 'sleep' && t.bed) { this.x = t.bed.x * 8 + 12; this.say('zzz'); }
  }
  walkWithin(r) {
    const w = this.g.world, x = r.x + 1 + Math.floor(Math.random() * (r.w - 2)), y = r.y + r.h - 1;
    if (w.standable(x, y)) { const p = this.goTo((a, b) => a === x && b === y, 400); if (p) { this.task.stage = 'go'; this.task.keepPath = true; } }
  }

  doObj(t, dt) {
    const g = this.g, o = t.obj;
    if (o.gone) { this.endTask(); return; }
    this.face = (o.x + o.w / 2) * 8 > this.x ? 1 : -1;
    const tick = (hz) => Math.floor(t.time * hz) !== Math.floor((t.time - dt) * hz);
    switch (t.job) {
      case 'stoke':
        if (t.time > t.dur) { if (g.res.wood >= 1) { g.res.wood--; g.stoke(o, false); } this.endTask(); }
        break;
      case 'cook':
        if (tick(1.5)) { g.audio.play('sizzle'); g.steam((o.x + 0.6) * 8, o.y * 8); }
        if (t.time > t.dur) {
          if (g.res.food >= 1 && g.res.meal < g.cap('meal')) { g.res.food--; g.addRes('meal', 1, (o.x + 1) * 8, o.y * 8); }
          this.endTask();
        }
        break;
      case 'tend':
        if (tick(3)) g.drips((o.x + 1) * 8, o.y * 8 + 2);
        if (t.time > t.dur) { o.grow = Math.min(0.99, o.grow + 0.2); o.tended = true; this.endTask(); }
        break;
      case 'harvest':
        if (t.time > t.dur) { if (o.grow >= 1) g.harvest(o); this.endTask(); }
        break;
      default: this.endTask();
    }
  }

  // ---------- drawing ----------
  pose() {
    const t = this.task;
    if (this.held) return 'held';
    if (this.dizzy > 0) return 'cheer';
    if (this.climbing && this.path) return Math.floor(this.y / 3) % 2 ? 'climb1' : 'climb2';
    if (this.falling) return 'held';
    if (t && t.stage === 'do') {
      if (t.kind === 'dig' || t.kind === 'build' || t.kind === 'chop' || (t.kind === 'obj' && t.job !== 'harvest')) return 'work';
      if (t.kind === 'eat' || (t.kind === 'relax' && ['armchair', 'stool', 'tub', 'hearth', 'rug'].includes(t.obj?.type))) return 'sit';
      if (t.kind === 'gather' || t.kind === 'arrive') return 'cheer';
      if (t.kind === 'relax' && t.obj?.type === 'phonograph' && t.obj.on) return Math.floor(this.t * 3) % 2 ? 'cheer' : 'idle';
    }
    if (this.path && this.seg) return Math.floor(this.t * 8) % 2 ? 'walk1' : 'walk2';
    return 'idle';
  }
  tool() {
    const t = this.task;
    if (!t || t.stage !== 'do') return null;
    if (t.kind === 'dig') return 'pick';
    if (t.kind === 'build') return 'hammer';
    if (t.kind === 'chop') return 'axe';
    if (t.kind === 'obj') return t.job === 'cook' ? 'spoon' : t.job === 'tend' ? 'can' : t.job === 'stoke' ? null : null;
    return null;
  }
  draw(x2d, ox, oy) {
    const t = this.task;
    if (t && t.kind === 'sleep' && t.stage === 'do' && t.bed && !this.held) {
      x2d.drawImage(this.spr.sleep, Math.round(t.bed.x * 8 + 2 + ox), Math.round(t.bed.y * 8 + 3 + oy));
      return;
    }
    let pose = this.pose();
    let spr = this.spr[pose];
    if (t && t.kind === 'sleep' && t.stage === 'do' && !t.bed && !this.held) {
      x2d.drawImage(this.spr.sleep, Math.round(this.x - 3 + ox), Math.round(this.y - 7 + oy));
      return;
    }
    const sq = this.squash > 0 ? 1 : 0;
    const wob = this.held ? Math.sin(this.t * 14) * 1.5 : 0;
    const px = Math.round(this.x - 4 + ox + wob), py = Math.round(this.y - 12 - this.hop + oy + (pose === 'sit' ? 1 : 0) + sq);
    const face = this.dizzy > 0 ? (Math.floor(this.t * 8) % 2 ? 1 : -1) : this.face;
    const img = face < 0 ? flipped(spr) : spr;
    if (sq) x2d.drawImage(img, 0, 0, img.width, img.height, px - 1, py + 1, img.width + 2, img.height - 1);
    else x2d.drawImage(img, px, py);
    const tool = this.tool();
    if (tool) {
      const f = Math.floor(this.t * (tool === 'can' ? 2 : 5)) % 2;
      const ts = toolSprite(tool, f);
      const tx = face > 0 ? px + 7 : px - ts.width + 2;
      x2d.drawImage(face > 0 ? ts : flipped(ts), tx, py + (f ? 4 : 1));
    }
    if (this.lantern && !this.held && !(t && t.kind === 'sleep' && t.stage === 'do')) {
      x2d.drawImage(LANTERN, face > 0 ? px + 6 : px - 2, py + 6);
    }
    if (this.arriving) x2d.drawImage(face > 0 ? flipped(BINDLE) : BINDLE, face > 0 ? px - 4 : px + 4, py - 2);
  }
  lanternPos() { return { x: (this.x + this.face * 4) / 8, y: (this.y - 4) / 8 }; }
}

// ---------------------------------------------------------------------------------------------
export class Cat extends Walker {
  constructor(game, x, y) {
    super(game, x, y);
    this.speed = 20; this.state = 'idle'; this.timer = 2; this.purr = 0; this.follow_ = null;
  }
  update(dt) {
    const g = this.g, gdt = dt * g.speedMul;
    this.t += dt; this.updateHop(dt);
    if (this.purr > 0) this.purr -= dt;
    if (this.held) return;
    if (this.physics(gdt)) return;
    if (this.path) { if (this.follow(gdt) !== 'moving') this.stop(); return; }
    this.timer -= gdt;
    if (this.timer > 0) return;
    const w = g.world, r = Math.random();
    if (g.isSleepTime() || r < 0.25) {
      const h = w.objectsOf('hearth')[0] || w.objectsOf('rug')[0] || w.objectsOf('bed')[Math.floor(Math.random() * 3)];
      if (h && Math.random() < 0.7) { this.goTo((x, y) => y === h.y + h.h - 1 && x >= h.x - 1 && x <= h.x + h.w, 4000); this.state = 'sleep'; this.timer = 10 + Math.random() * 20; return; }
    }
    if (r < 0.55 && g.folk.length) {
      const f = g.folk[Math.floor(Math.random() * g.folk.length)];
      if (!f.held) { const fx = f.cx, fy = f.cy; this.goTo((x, y) => y === fy && Math.abs(x - fx) <= 1, 3000); this.state = 'idle'; this.timer = 3 + Math.random() * 4; return; }
    }
    let k = 0; const n = 5 + Math.random() * 25;
    this.goTo(() => ++k > n && Math.random() < 0.3, 1500);
    this.state = 'idle'; this.timer = 2 + Math.random() * 5;
  }
  pet() {
    this.purr = 2.5; this.state = 'sleep'; this.timer = 4; this.stop();
    this.hop = 0.01; this.hopV = 40;
  }
  draw(x2d, ox, oy) {
    const walking = this.path && this.seg;
    const spr = this.held ? CAT_SPR.idle : walking ? (Math.floor(this.t * 8) % 2 ? CAT_SPR.walk : CAT_SPR.idle) : this.state === 'sleep' && this.timer > 0 ? CAT_SPR.sleep : CAT_SPR.idle;
    const img = this.face < 0 ? flipped(spr) : spr;
    const wob = this.held ? Math.sin(this.t * 10) : 0;
    x2d.drawImage(img, Math.round(this.x - img.width / 2 + ox + wob), Math.round(this.y - img.height + 1 - this.hop + oy));
  }
}
