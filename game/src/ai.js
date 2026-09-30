// Villagers (schedules, jobs, reactions) and wolves.
import { Body } from './entities.js';
import { findPath, nearestStand, standable } from './path.js';
import { TILE, OBJ } from './content.js';

const NA = ['Ed', 'Ma', 'Ta', 'Or', 'Hol', 'Bran', 'Wy', 'Fen', 'Ros', 'Al', 'Tam', 'Ber', 'Ise', 'Cor', 'Lu', 'Nel', 'Pip', 'Ot', 'Hal', 'Gwen', 'Ivo', 'Sab'];
const NB = ['da', 'ren', 'vi', 'sk', 'wick', 'nock', 'la', 'ric', 'wen', 'sy', 'mo', 'a', 'bel', 'ie', 'os', 'o', 'rin', 'et'];
export const ROLE_NAMES = {
  cook: 'Cook', smith: 'Smith', keeper: 'Tavern Keeper', weaver: 'Weaver', hauler: 'Hauler', farmer: 'Farmer',
  miner: 'Miner', guard: 'Guard', elder: 'Elder', kid: 'Child', settler: 'Settler',
};
const BRAVE = new Set(['guard', 'smith', 'miner', 'keeper', 'hauler']);
const STATION_TAG = { cook: 'cook', smith: 'smith', weaver: 'weave' };
const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy);

// a spot to stand next to an object (tile coords of feet)
function besideSpot(w, o, side = 1) {
  const y = o.y + o.h - 1;
  const cands = side > 0 ? [o.x + o.w, o.x - 1, o.x + (o.w >> 1)] : [o.x - 1, o.x + o.w, o.x + (o.w >> 1)];
  for (const x of cands) if (standable(w, x, y)) return { x, y, face: x < o.x ? 1 : x >= o.x + o.w ? -1 : 1 };
  const s = nearestStand(w, o.x, y, 3);
  return s ? { ...s, face: 1 } : null;
}

export class Villager extends Body {
  constructor(game, v, res, idx, rand) {
    const kid = res.role === 'kid';
    super(0, 0, kid ? 5 : 6, kid ? 11 : 14);
    this.kind = 'villager';
    this.game = game; this.v = v; this.role = res.role; this.kid = kid;
    this.bed = res.bed; this.work = res.work; this.idx = idx;
    this.skin = Math.floor(rand() * 4);
    this.name = NA[Math.floor(rand() * NA.length)] + NB[Math.floor(rand() * NB.length)];
    this.maxHp = this.role === 'guard' ? 26 : kid ? 8 : 14; this.hp = this.maxHp;
    this.speed = kid ? 30 : 23 + rand() * 4;
    this.shift = idx % 2;
    this.act = null; this.path = null; this.pi = 0;
    this.alarm = null; this.bubble = null; this.animT = rand() * 10;
    this.atkT = 0; this.hurtT = 0; this.stuckT = 0; this.lastPos = 0; this.fails = 0;
    this.pose = 'idle'; this.carry = false; this.sleeping = false; this.happy = 0;
    this.rand = rand;
    if (this.bed) { this.x = this.bed.x * TILE + TILE - this.w / 2; this.y = (this.bed.y + this.bed.h) * TILE - this.h; }
  }

  say(txt, t = 2.5, col) { this.bubble = { txt, t, col }; }

  phase(t) {
    if (this.role === 'guard') {
      const day = this.shift === 0;
      const onDuty = day ? t > 0.24 && t < 0.8 : t > 0.76 || t < 0.3;
      if (onDuty) return 'patrol';
      const sleepy = day ? t > 0.86 || t < 0.2 : t > 0.36 && t < 0.66;
      return sleepy ? 'sleep' : 'evening';
    }
    if (this.kid) return t < 0.26 || t > 0.86 ? 'sleep' : t < 0.3 ? 'breakfast' : t > 0.72 ? 'evening' : 'play';
    return t < 0.23 || t > 0.9 ? 'sleep' : t < 0.3 ? 'breakfast' : t < 0.72 ? 'work' : 'evening';
  }

  // ---------------------------------------------------------------- planning
  plan(phase) {
    const w = this.game.world, v = this.v, r = this.rand;
    const A = (target, o) => ({ phase, target, t: 0, dur: 10, pose: 'idle', ...o });
    switch (phase) {
      case 'sleep': {
        if (!this.bed || !this.bed.alive) return A(null, { dur: 5, pose: 'idle' });
        return A({ x: this.bed.x + 1, y: this.bed.y + this.bed.h - 1 }, { pose: 'sleep', dur: 9999 });
      }
      case 'breakfast': {
        const tb = this.nearest(v.tables);
        const s = tb && besideSpot(w, tb, r() < 0.5 ? 1 : -1);
        return A(s, { pose: 'sit', dur: 20, face: s?.face });
      }
      case 'evening': {
        const g = v.gather;
        if (!g) return A(null, { dur: 6 });
        const s = nearestStand(w, g.x + Math.floor(r() * 9) - 4, g.y, 3);
        return A(s, { pose: this.kid ? 'play' : 'idle', dur: 8 + r() * 10, chat: true });
      }
      case 'patrol': {
        const posts = v.posts || [];
        if (!posts.length) return A(null, { dur: 5 });
        this.postI = ((this.postI ?? this.idx) + 1) % posts.length;
        const p = posts[this.postI];
        return A(nearestStand(w, p.x, p.y, 3), { pose: 'idle', dur: 4 + r() * 5, look: true });
      }
      case 'play': return this.playTarget(phase);
      case 'work': return this.workPlan(phase);
    }
    return A(null, { dur: 5 });
  }

  nearest(list, pred) {
    let best = null, bd = Infinity;
    for (const o of list || []) {
      if (!o.alive || (pred && !pred(o))) continue;
      const d = Math.abs(o.x * TILE - this.cx) + Math.abs(o.y * TILE - this.cy) * 2;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  playTarget(phase) {
    const w = this.game.world, v = this.v, r = this.rand;
    const others = this.game.villagers.filter((o) => o !== this && o.kid && o.v === v && !o.dead && !o.sleeping);
    if (others.length && r() < 0.35) {
      const o = others[Math.floor(r() * others.length)];
      return { phase, target: { x: o.tx, y: o.ty }, t: 0, dur: 3, pose: 'play', chase: o };
    }
    const home = this.work?.floors?.[0] ?? { x0: v.x0, x1: v.x1, y: this.ty };
    const outside = r() < 0.6;
    const x = outside ? v.x0 + Math.floor(r() * (v.x1 - v.x0)) : home.x0 + Math.floor(r() * Math.max(1, home.x1 - home.x0));
    const y = outside && v.type === 'surface' ? v.gather?.y ?? this.ty : home.y;
    return { phase, target: nearestStand(w, x, y, 4), t: 0, dur: 1 + r() * 3, pose: 'play' };
  }

  workPlan(phase) {
    const w = this.game.world, v = this.v, r = this.rand, role = this.role;
    const A = (target, o) => ({ phase, target, t: 0, dur: 12, pose: 'work', ...o });
    const tag = STATION_TAG[role];
    if (tag) {
      const pool = (this.work?.stations?.length ? this.work.stations : v.stations).filter((s) => s.alive && OBJ[s.type].tags.includes(tag));
      if (pool.length) {
        this.cycle = (this.cycle ?? 0) + 1;
        if (role === 'cook' && this.cycle % 3 === 0 && v.tables.length) {
          const tb = this.nearest(v.tables);
          return A(besideSpot(w, tb, 1), { pose: 'idle', dur: 4, carry: true });
        }
        const st = pool[this.cycle % pool.length];
        const s = besideSpot(w, st, st.type === 'anvil' ? -1 : 1);
        return A(s, { dur: 10 + r() * 14, face: s?.face, tool: role === 'smith' ? 'hammer' : role === 'cook' ? 'spoon' : null, station: st });
      }
    }
    if (role === 'hauler' || role === 'keeper' || role === 'farmer' && v.type === 'surface') {
      const store = v.storage.filter((s) => s.alive);
      if (store.length >= 2) {
        this.haul = !this.haul;
        const pickFrom = store.filter((s) => (this.lastStore ? s !== this.lastStore : true));
        const s = pickFrom[Math.floor(r() * pickFrom.length)];
        this.lastStore = s;
        return A(besideSpot(w, s, 1), { dur: 2 + r() * 2, pose: 'work', carry: this.haul, carryAfter: !this.haul });
      }
    }
    if (role === 'miner' && this.work?.mineFace) {
      this.cycle = (this.cycle ?? 0) + 1;
      if (this.cycle % 3 === 0) {
        const st = this.nearest(v.storage);
        if (st) return A(besideSpot(w, st, 1), { dur: 3, pose: 'work', carry: true, carryAfter: false });
      }
      const f = this.work.mineFace;
      return A(nearestStand(w, f.x, f.y, 3), { dur: 14 + r() * 10, tool: 'pick', face: 1, dig: true });
    }
    if (role === 'farmer' && this.work) {
      const fl = this.work.floors[0];
      return A(nearestStand(w, fl.x0 + 1 + Math.floor(r() * 4), fl.y, 3), { dur: 10 + r() * 8, tool: 'hoe', face: -1 });
    }
    if (role === 'elder' || role === 'settler') {
      if (r() < 0.5 && v.tables.length) {
        const tb = v.tables[Math.floor(r() * v.tables.length)];
        const s = besideSpot(w, tb, r() < 0.5 ? 1 : -1);
        return A(s, { pose: 'sit', dur: 15 + r() * 15, face: s?.face });
      }
      const g = v.gather || { x: this.tx, y: this.ty };
      return A(nearestStand(w, g.x + Math.floor(r() * 12) - 6, g.y, 4), { pose: 'idle', dur: 8 + r() * 8, chat: true });
    }
    // fallback: wander about the village
    return A(nearestStand(w, v.x0 + Math.floor(r() * (v.x1 - v.x0)), this.ty, 5), { pose: 'idle', dur: 5 + r() * 5 });
  }

  // ---------------------------------------------------------------- movement
  goTo(target) {
    if (!target) { this.path = null; return false; }
    const w = this.game.world;
    const p = findPath(w, this.tx, this.ty, target.x, target.y, 4000);
    if (!p) { this.path = null; this.fails++; return false; }
    this.path = p; this.pi = 0; this.stuckT = 0; this.fails = 0;
    return true;
  }

  follow(dt, speed) {
    const w = this.game.world;
    if (!this.path || this.pi >= this.path.length) { this.path = null; return true; }
    const n = this.path[this.pi];
    const tx = n.x * TILE + TILE / 2;
    const ty = this.ty;
    const vertical = n.x === this.tx && n.a === 3;
    if (vertical || (this.climbing && n.x === this.tx && n.y !== ty)) {
      this.climbing = true;
      this.x += ((n.x * TILE + TILE / 2 - this.w / 2) - this.x) * Math.min(1, dt * 14);
      this.vx = 0;
      const goalFeet = (n.y + 1) * TILE;
      const d = goalFeet - (this.y + this.h);
      this.vy = Math.abs(d) < 1 ? 0 : Math.sign(d) * 40;
      if (Math.abs(d) < 1.2) { this.y += d; this.pi++; if (this.pi >= this.path.length || this.path[this.pi].a !== 3) { this.climbing = false; this.vy = 0; } }
    } else {
      if (this.climbing && ty === n.y) this.climbing = false;
      const dx = tx - this.cx;
      this.vx = Math.abs(dx) < 1 ? 0 : Math.sign(dx) * speed;
      if (this.vx) this.facing = Math.sign(this.vx);
      // a small hop helps with steps when auto-step can't catch it
      if (n.a === 1 && this.onGround && this.hitWall) this.vy = -170;
      if (Math.abs(dx) < 1.6 && (ty === n.y || Math.abs(this.feet - (n.y + 1) * TILE) < 3)) this.pi++;
    }
    // stuck detection
    const pos = Math.round(this.x) * 1000 + Math.round(this.y);
    if (pos === this.lastPos) this.stuckT += dt; else this.stuckT = 0;
    this.lastPos = pos;
    if (this.stuckT > 1.6) { this.stuckT = 0; this.climbing = false; return 'stuck'; }
    return this.pi >= this.path.length;
  }

  // ---------------------------------------------------------------- update
  update(dt, t) {
    if (this.dead) return;
    this.animT += dt;
    if (this.bubble && (this.bubble.t -= dt) <= 0) this.bubble = null;
    this.atkT -= dt; this.hurtT -= dt;
    if (this.happy > 0) this.happy -= dt;
    if (this.alarm) this.updateAlarm(dt);
    else this.routine(dt, t);
    if (!this.sleeping) this.physics(this.game.world, dt, true);
  }

  routine(dt, t) {
    const ph = this.phase(t);
    if (!this.act || (this.act.phase !== ph && !(this.sleeping && ph === 'sleep'))) this.startAct(this.plan(ph));
    const a = this.act;
    if (a.moving) {
      const res = this.follow(dt, a.pose === 'play' ? this.speed * 1.5 : this.speed);
      this.pose = this.climbing ? 'climb' : this.carry ? 'carry' : 'walk';
      if (res === 'stuck') {
        if (!this.goTo(a.target)) { a.moving = false; a.t = a.dur - 2; }
      } else if (res === true) {
        a.moving = false; this.vx = 0;
        if (a.face) this.facing = a.face;
        if (a.pose === 'sleep') this.sleeping = true;
        if (a.carry !== undefined && a.pose !== 'work') this.carry = a.carry;
      }
      return;
    }
    this.vx = 0;
    a.t += dt;
    this.pose = a.pose === 'play' ? 'idle' : a.pose;
    if (a.pose === 'sleep') { this.sleeping = true; if (Math.floor(this.animT) % 4 === 0 && !this.bubble) this.say('z', 1.5); return; }
    if (a.pose === 'work') {
      if (a.carry !== undefined && a.t > 1 && a.carry !== this.carry) this.carry = a.carry;
      if (a.tool === 'hammer' && Math.floor(this.animT * 4) % 2 === 0 && Math.random() < dt * 4) {
        const st = a.station; if (st) this.game.fx.sparks(st.x * TILE + st.w * 4, st.y * TILE + 2);
      }
      if (a.dig && Math.random() < dt * 3) this.game.fx.burst(this.cx + this.facing * 8, this.cy, ['#5a4030', '#6a707d'], 2, 30);
    }
    if (a.chat && !this.bubble && Math.random() < dt * 0.15) this.say(['...', 'HA', '?', '..!'][Math.floor(Math.random() * 4)], 2);
    if (a.look && Math.random() < dt * 0.5) this.facing *= -1;
    if (a.pose === 'play' && this.onGround && Math.random() < dt * 1.2) this.vy = -150;
    if (a.chase && !a.chase.dead) {
      const d = a.chase.cx - this.cx;
      if (Math.abs(d) > 6) { this.vx = Math.sign(d) * this.speed * 1.4; this.facing = Math.sign(d); this.pose = 'walk'; }
    }
    if (a.t >= a.dur) {
      if (a.carryAfter !== undefined) this.carry = a.carryAfter;
      this.startAct(this.plan(a.phase));
    }
  }

  startAct(a) {
    this.act = a;
    this.sleeping = false;
    if (a.bubble) this.say(a.bubble, 2);
    if (a.target && (Math.abs(a.target.x - this.tx) > 0 || Math.abs(a.target.y - this.ty) > 0)) {
      a.moving = this.goTo(a.target);
      if (!a.moving) a.dur = 2 + Math.random() * 2;       // couldn't get there: wait a bit and rethink
    } else a.moving = false;
  }

  // ---------------------------------------------------------------- reactions
  alarmed(threat, byPlayer) {
    if (this.dead) return;
    const g = this.v.grudge;
    let mode = 'flee';
    if (this.role === 'guard') mode = 'fight';
    else if (!this.kid && this.role !== 'elder' && BRAVE.has(this.role) && (!byPlayer || g >= 4)) mode = 'fight';
    if (this.alarm && this.alarm.mode === 'fight' && mode === 'flee') return;
    const wasSleeping = this.sleeping;
    this.sleeping = false; this.carry = false;
    this.alarm = { mode, threat, calm: 0, repath: 0, fleeTo: null };
    this.act = null; this.path = null;
    this.say(wasSleeping ? '!?' : '!', 3, '#ff5040');
  }

  hurt(dmg, from) {
    if (this.dead) return;
    this.hp -= dmg; this.hurtT = 0.25;
    const dir = Math.sign(this.cx - from.cx) || 1;
    this.vx = dir * 90; this.vy = -120; this.climbing = false; this.sleeping = false;
    this.game.fx.hit(this.cx, this.cy, '#c84040');
    this.game.audio.play(this.kid ? 'yelp2' : 'yelp');
    if (this.hp <= 0) { this.die(from); return; }
    this.game.villageAggression(this.v, from, this, from.kind === 'player' ? 1 : 0);
    this.alarmed(from, from.kind === 'player');
  }

  die(from) {
    this.dead = true;
    this.game.villagerDied(this, from);
  }

  updateAlarm(dt) {
    const al = this.alarm, th = al.threat;
    const gone = !th || th.dead;
    const d = gone ? 999 : dist(this, th) / TILE;
    // calm down when the threat is gone, far, or has left them alone for a while
    if (gone || d > 22) al.calm += dt * 2;
    else if (d > (al.mode === 'fight' ? 3 : 10)) al.calm += dt;
    if (th && th.kind === 'player' && this.v.grudge >= 6 && d < 14 && al.mode === 'fight') al.calm = 0;
    if (al.calm > (al.mode === 'fight' ? 10 : 14)) {
      this.alarm = null; this.act = null; this.say('...', 2.5); this.climbing = false;
      return;
    }
    if (al.mode === 'fight' && !gone) {
      this.pose = this.climbing ? 'climb' : 'walk';
      const dx = th.cx - this.cx, dy = th.cy - this.cy;
      const reach = this.role === 'guard' ? 18 : 12;
      if (Math.abs(dx) < reach && Math.abs(dy) < 16) {
        this.vx = 0; this.facing = Math.sign(dx) || this.facing; this.pose = 'work';
        if (this.atkT <= 0) {
          this.atkT = 0.9;
          th.hurt(this.role === 'guard' ? 3 : 2, this, this.game);
          this.game.audio.play('swing');
        }
        return;
      }
      al.repath -= dt;
      if (al.repath <= 0 || !this.path) { al.repath = 0.8; this.goTo({ x: th.tx, y: th.ty }); }
      const res = this.path ? this.follow(dt, this.speed * 1.7) : true;
      if (!this.path || res === 'stuck') { this.vx = Math.sign(dx) * this.speed * 1.5; this.facing = Math.sign(dx) || 1; if (this.hitWall && this.onGround) this.vy = -190; }
      return;
    }
    // flee: get away, then cower
    const w = this.game.world;
    if (!al.fleeTo || (al.hiding && d < 5)) {
      al.hiding = false;
      const dir = gone ? 1 : Math.sign(this.cx - th.cx) || 1;
      let best = null;
      for (let k = 0; k < 8 && !best; k++) {
        const fx = this.tx + dir * (12 + Math.floor(Math.random() * 16));
        const s = nearestStand(w, fx, this.ty + Math.floor(Math.random() * 7) - 3, 5);
        if (s) best = s;
      }
      if (this.bed && this.bed.alive && (gone || Math.sign(this.bed.x * TILE - th.cx) === dir)) best = { x: this.bed.x + 1, y: this.bed.y + this.bed.h - 1 };
      al.fleeTo = best || { x: this.tx + dir * 10, y: this.ty };
      this.goTo(al.fleeTo);
    }
    if (this.path) {
      const res = this.follow(dt, this.speed * 1.9);
      this.pose = this.climbing ? 'climb' : 'flee';
      if (res === 'stuck') { al.fleeTo = null; this.path = null; }
      if (res === true) { this.path = null; al.hiding = true; }
    } else {
      this.vx = 0; this.pose = 'cower'; al.hiding = true;
      if (!this.bubble && Math.random() < dt) this.say('!', 1.2, '#ff5040');
    }
  }

  // which sprite frame to draw
  frame() {
    const T = this.animT;
    if (this.hurtT > 0) return 'flee0';
    switch (this.pose) {
      case 'walk': return Math.abs(this.vx) > 1 ? 'walk' + (Math.floor(T * 8) % 4) : 'idle';
      case 'carry': return 'carry' + (Math.abs(this.vx) > 1 ? Math.floor(T * 8) % 4 : 0);
      case 'climb': return Math.floor(T * 6) % 2 ? 'climb0' : 'climb1';
      case 'work': return Math.floor(T * (this.act?.tool === 'spoon' ? 3 : 4)) % 2 ? 'work0' : 'work1';
      case 'sit': return 'sit';
      case 'flee': return 'flee' + (Math.floor(T * 10) % 2);
      case 'cower': return 'cower';
      default: return this.carry ? 'carry0' : 'idle';
    }
  }
}

// ------------------------------------------------------------------ wolves
export class Wolf extends Body {
  constructor(game, x, y, den, rand) {
    super(x, y, 14, 9);
    this.kind = 'wolf'; this.game = game; this.den = den; this.rand = rand;
    this.maxHp = 16; this.hp = 16; this.speed = 64 + rand() * 12;
    this.state = den ? 'sleep' : 'hunt'; this.target = null;
    this.atkT = 0; this.hurtT = 0; this.fleeT = 0; this.animT = rand() * 5; this.wanderT = 0; this.dir = 1;
    this.hunter = !den;
  }

  hurt(dmg, from) {
    if (this.dead) return;
    this.hp -= dmg; this.hurtT = 0.25;
    const dir = Math.sign(this.cx - from.cx) || 1;
    this.vx = dir * 120; this.vy = -130;
    this.game.fx.hit(this.cx, this.cy, '#a02020');
    this.game.audio.play('growl');
    this.target = from; this.state = 'chase';
    if (this.hp < this.maxHp * 0.35) this.fleeT = 3;
    // pack: wake the others
    for (const o of this.game.wolves) if (o !== this && !o.dead && dist(o, this) < 12 * TILE) { o.target = from; o.state = 'chase'; }
    if (this.hp <= 0) { this.dead = true; this.game.wolfDied(this, from); }
  }

  update(dt, t) {
    if (this.dead) return;
    this.animT += dt; this.atkT -= dt; this.hurtT -= dt; this.fleeT -= dt;
    const g = this.game, p = g.player;
    const night = t < 0.24 || t > 0.78;
    const dp = p.dead ? 999 : dist(this, p) / TILE;
    if (this.state === 'sleep') {
      this.vx = 0;
      if (dp < 6 || (night && this.rand() < dt * 0.02)) { this.state = dp < 6 ? 'chase' : 'wander'; this.target = dp < 6 ? p : null; g.audio.play('growl'); }
    } else if (!this.target || this.target.dead) {
      this.target = null;
      if (dp < 11 && Math.abs(p.cy - this.cy) < 7 * TILE) { this.target = p; this.state = 'chase'; }
      else if (this.hunter || night) {
        for (const v of g.villagers) if (!v.dead && !v.sleeping && dist(this, v) < 9 * TILE) { this.target = v; this.state = 'chase'; break; }
      }
      if (!this.target) this.state = this.hunter ? 'hunt' : 'wander';
    }
    if (this.target && (this.target.dead || dist(this, this.target) > 30 * TILE)) { this.target = null; this.state = 'wander'; }

    if (this.state === 'chase' && this.target) {
      const tg = this.target, dx = tg.cx - this.cx, dy = tg.cy - this.cy;
      let dir = Math.sign(dx) || 1;
      if (this.fleeT > 0) dir = -dir;
      this.facing = dir;
      this.vx = dir * this.speed;
      if (this.onGround && (this.hitWall || (dy < -12 && Math.abs(dx) < 30))) this.vy = -250;
      if (this.fleeT <= 0 && Math.abs(dx) < 13 && Math.abs(dy) < 14 && this.atkT <= 0) {
        this.atkT = 1.1;
        tg.hurt(3, this, g);
        if (this.onGround) this.vy = -120;
      }
    } else if (this.state === 'wander' || this.state === 'hunt') {
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderT = 1.5 + this.rand() * 3; this.dir = this.rand() < 0.5 ? -1 : 1; this.idle = this.rand() < 0.4; }
      if (this.den && !this.hunter) {
        const home = this.den.x * TILE;
        if (Math.abs(this.cx - home) > 16 * TILE) this.dir = Math.sign(home - this.cx);
        if (!night && Math.abs(this.cx - home) < 10 * TILE && this.rand() < dt * 0.1) this.state = 'sleep';
      }
      this.vx = this.idle ? 0 : this.dir * this.speed * 0.4;
      if (this.vx) this.facing = this.dir;
      if (this.onGround && this.hitWall) this.vy = -230;
    }
    this.physics(g.world, dt, true);
  }

  frame() {
    if (this.state === 'sleep') return 'sleep';
    return Math.abs(this.vx) > 2 && Math.floor(this.animT * 10) % 2 ? 'walk' : 'stand';
  }
}
