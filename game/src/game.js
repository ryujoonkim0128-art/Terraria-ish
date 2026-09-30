// The game: owns the world and entities, runs the loop, handles the player's hands.
import { generate } from './worldgen.js';
import { T, tiles, walls, OBJ, ITEMS, TILE } from './content.js';
import { ChunkCache, Sky, Compositor, sunAt, VW, VH } from './render.js';
import { CS } from './world.js';
import { Lighting } from './light.js';
import { Player, Drop, FX } from './entities.js';
import { Villager, Wolf, ROLE_NAMES } from './ai.js';
import { Inventory } from './inventory.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { checkHome, roleForHome } from './housing.js';
import { playerSprite, villagerSprite, sleeperSprite, wolfSprite, flipped, objSprite } from './sprites.js';
import { rng } from './noise.js';
import { icon } from './ui.js';

const DAY_LEN = 480; // seconds per day

class Input {
  constructor(el, game) {
    this.keys = new Set(); this.pressedSet = new Set();
    this.game = game;
    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedSet.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); game.mouse.l = game.mouse.r = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    const pos = (e) => {
      const r = el.getBoundingClientRect();
      game.mouse.x = Math.floor((e.clientX - r.left) / r.width * VW);
      game.mouse.y = Math.floor((e.clientY - r.top) / r.height * VH);
    };
    el.addEventListener('pointermove', pos);
    el.addEventListener('pointerdown', (e) => {
      pos(e);
      if (game.ui.click(game.mouse.x, game.mouse.y, e.button)) return;
      if (e.button === 0) { game.mouse.l = true; game.mouse.lPressed = true; }
      if (e.button === 2) { game.mouse.r = true; game.mouse.rPressed = true; }
    });
    addEventListener('pointerup', (e) => { if (e.button === 0) game.mouse.l = false; if (e.button === 2) game.mouse.r = false; });
    el.addEventListener('wheel', (e) => { e.preventDefault(); const inv = game.inv; inv.sel = (inv.sel + (e.deltaY > 0 ? 1 : 9)) % 10; }, { passive: false });
  }
  down(c) { return this.keys.has(c); }
  pressed(c) { return this.pressedSet.has(c); }
  endFrame() { this.pressedSet.clear(); this.game.mouse.rPressed = false; this.game.mouse.lPressed = false; }
}

export class Game {
  constructor(view, hud, seed, saved) {
    this.view = view; this.hud = hud;
    this.hx = hud.getContext('2d');
    this.seed = seed;
    this.world = generate(seed);
    this.rand = rng(seed ^ 0x5eed);
    this.chunks = new ChunkCache(this.world);
    this.light = new Lighting(this.world);
    this.sky = new Sky(seed);
    this.comp = new Compositor(view);
    const mk = () => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(VW, VH) : Object.assign(document.createElement('canvas'), { width: VW, height: VH }));
    this.front = mk(); this.fx2d = this.front.getContext('2d');
    this.back = mk(); this.bx2d = this.back.getContext('2d');
    this.fx2d.imageSmoothingEnabled = false;
    this.fx = new FX();
    this.audio = new Audio();
    this.mouse = { x: VW / 2, y: VH / 2, l: false, r: false };
    this.ui = new UI(this);
    this.input = new Input(hud, this);
    this.time = 0.29; this.day = 1; this.clock = 0;
    this.drops = []; this.villagers = []; this.wolves = []; this.homes = [];
    this.cam = { x: 0, y: 0 };
    const sp = this.world.spawn;
    this.player = new Player(sp.x * TILE, sp.y * TILE - 16);
    this.player.spawn = { x: this.player.x, y: this.player.y };
    this.inv = new Inventory();
    for (const [id, n] of [['pickaxe', 1], ['wood_sword', 1], ['planks', 60], ['wall_plank', 40], ['torch', 12], ['ladder', 16], ['platform', 12], ['bread', 4], ['bed', 1], ['table', 1], ['timber', 20]]) this.inv.add(id, n);
    this.homestead = { id: 'home', name: 'Your Homestead', x0: sp.x - 20, x1: sp.x + 20, grudge: 0, residents: [], buildings: [], storage: [], tables: [], stations: [], posts: [], gather: null, type: 'home' };
    // villagers & wolves
    for (const v of this.world.villages) {
      v.residents.forEach((res, i) => { const vl = new Villager(this, v, res, i, this.rand); this.villagers.push(vl); });
    }
    for (const d of this.world.dens) for (let k = 0; k < 3; k++) this.wolves.push(new Wolf(this, (d.x - 8 + k * 7) * TILE, (d.y - 1) * TILE - 2, d, this.rand));
    this.world.onChange = (kind, x, y, o) => this.onWorldChange(kind, x, y, o);
    if (saved) this.restore(saved);
    this.camSnap = true;
    this.last = performance.now();
    this.acc = 0;
    this.spawnT = 0; this.homeCheckT = 0; this.ambT = 0;
    this.mining = null; this.placeT = 0;
    this.dead = false;
  }

  // a small snapshot so an open game survives a page update
  snapshot() {
    const p = this.player;
    return { seed: this.seed, time: this.time, day: this.day, player: { x: p.x, y: p.y, hp: p.hp, spawn: p.spawn }, slots: this.inv.slots, started: this.ui.started };
  }
  restore(s) {
    const p = this.player;
    Object.assign(p, { x: s.player.x, y: s.player.y, hp: s.player.hp, spawn: s.player.spawn });
    this.time = s.time; this.day = s.day;
    this.inv.slots = s.slots.map((x) => (x ? { ...x } : null));
    this.ui.started = !!s.started;
  }

  // ---------------------------------------------------------------- loop
  start() {
    const frame = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.render(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  step(dt) {
    const inp = this.input;
    if (!this.ui.started) { this.clock += dt; this.updateCamera(dt); inp.endFrame(); return; }
    if (inp.pressed('KeyE') || inp.pressed('Tab')) { this.ui.open = !this.ui.open; if (!this.ui.open && this.inv.cursor) { this.inv.add(this.inv.cursor.id, this.inv.cursor.n); this.inv.cursor = null; } }
    if (inp.pressed('Escape')) this.ui.open = false;
    if (inp.pressed('KeyH')) this.ui.help = !this.ui.help;
    if (inp.pressed('KeyM')) { this.audio.muted = !this.audio.muted; this.ui.toast(this.audio.muted ? 'Sound off' : 'Sound on'); }
    for (let i = 0; i < 10; i++) if (inp.pressed('Digit' + ((i + 1) % 10))) this.inv.sel = i;
    this.timeFast = inp.down('KeyT');
    const tdt = dt * (this.timeFast ? 24 : 1);
    this.clock += dt;
    this.time += tdt / DAY_LEN;
    if (this.time >= 1) { this.time -= 1; this.day++; }

    const p = this.player;
    if (!this.dead) {
      if (!this.ui.open) p.control(this.world, inp, dt);
      else { p.vx *= 0.8; }
      p.physics(this.world, dt, true);
      p.swingT -= dt; p.hurtT -= dt; p.regenT += dt; p.animT += dt;
      if (p.regenT > 5 && p.hp < p.maxHp && Math.floor(p.regenT * 10) % 40 === 0) { p.hp = Math.min(p.maxHp, p.hp + 1); p.regenT = 4.1; }
      if (p.y > this.world.h * TILE) this.playerDied();
      this.hands(dt);
    } else {
      this.deadT -= dt;
      if (this.deadT <= 0) this.respawn();
    }

    // NPCs: villagers run on game time so fast-forwarding shows their day
    const sub = this.timeFast ? 3 : 1;
    for (let s = 0; s < sub; s++) {
      for (const v of this.villagers) if (Math.abs(v.cx - p.cx) < 160 * TILE) v.update(dt, this.time);
      for (const w of this.wolves) if (Math.abs(w.cx - p.cx) < 120 * TILE) w.update(dt, this.time);
    }
    this.villagers = this.villagers.filter((v) => !v.dead);
    this.wolves = this.wolves.filter((w) => !w.dead);
    this.societies(dt);
    this.updateDrops(dt);
    this.fx.update(dt, this.world);
    this.ambient(dt);
    this.spawner(dt);
    this.housing(dt);
    this.updateCamera(dt);
    inp.endFrame();
  }

  // ---------------------------------------------------------------- the player's hands
  hands(dt) {
    const p = this.player, m = this.mouse, w = this.world, inv = this.inv;
    const wx = m.x + this.cam.x, wy = m.y + this.cam.y;
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    const held = inv.held ? ITEMS[inv.held.id] : null;
    const reach = (held?.reach || 5.5) * TILE;
    const inReach = Math.hypot(tx * TILE + 4 - p.cx, ty * TILE + 4 - p.cy) <= Math.max(reach, 5.5 * TILE);
    this.cursor = { x: tx, y: ty, inReach, ghost: null };
    // what's under the cursor
    this.hoverEnt = null;
    for (const e of [...this.villagers, ...this.wolves]) {
      if (!e.dead && wx >= e.x - 2 && wx <= e.x + e.w + 2 && wy >= e.y - 3 && wy <= e.y + e.h + 1) { this.hoverEnt = e; break; }
    }
    if (this.ui.open) { this.mining = null; return; }
    // placement ghost
    if (held && (held.kind === 'object')) {
      const d = OBJ[held.place];
      const ax = this.anchor(held.place, tx, ty);
      this.cursor.ghost = { img: objSprite(held.place), x: ax.x, y: ax.y, w: d.w, h: d.h, ok: inReach && w.canPlaceObject(held.place, ax.x, ax.y) };
    }
    const ent = this.hoverEnt;
    // left: attack or mine
    if (m.l || m.lPressed) {
      const eReach = (held?.kind === 'weapon' ? held.reach : 2.4) * TILE;
      if (ent && Math.hypot(ent.cx - p.cx, ent.cy - p.cy) < eReach + 6) {
        this.mining = null;
        if (p.swingT <= 0) {
          p.swingT = 0.3; p.facing = Math.sign(ent.cx - p.cx) || p.facing;
          const dmg = held?.dmg || 1;
          this.audio.play('swing'); this.audio.play('hit');
          ent.hurt(dmg, p);
        }
      } else if (inReach) this.mine(tx, ty, dt, held);
      else this.mining = null;
    } else this.mining = null;
    // right: give / eat / place (repeats while held, for fast building)
    this.placeT -= dt;
    if ((m.r || m.rPressed) && (m.rPressed || this.placeT <= 0)) {
      this.placeT = 0.11;
      if (ent && ent.kind === 'villager' && held && held.gift && m.rPressed) this.gift(ent);
      else if (held && held.kind === 'food' && m.rPressed) this.eat(held);
      else if (held && inReach) this.place(held, tx, ty);
      else if (!held && m.rPressed) this.useObject(tx, ty);
    }
  }

  anchor(type, tx, ty) {
    const d = OBJ[type];
    if (d.mount === 'hang') return { x: tx, y: ty };
    if (d.mount === 'wall') return { x: tx - (d.w >> 1), y: ty - (d.h >> 1) };
    return { x: tx - ((d.w - 1) >> 1), y: ty - d.h + 1 };
  }

  mine(tx, ty, dt, held) {
    const w = this.world;
    const obj = w.objectAt(tx, ty);
    const fg = w.get(tx, ty);
    const wall = w.getWall(tx, ty);
    let target, hard;
    if (obj) { target = 'obj'; hard = 0.35 + obj.w * obj.h * 0.05; }
    else if (fg !== T.AIR) { target = 'fg'; hard = tiles[fg].hardness; }
    else if (wall) { target = 'wall'; hard = walls[wall].hardness; }
    else { this.mining = null; return; }
    if (!isFinite(hard)) return;
    const speed = held?.mine || 0.45;
    if (!this.mining || this.mining.x !== tx || this.mining.y !== ty || this.mining.target !== target) this.mining = { x: tx, y: ty, p: 0, target, tick: 0 };
    const m = this.mining;
    m.p += dt * speed / Math.max(0.05, hard);
    m.tick -= dt;
    if (m.tick <= 0) { m.tick = 0.14; this.audio.play('dig'); this.fx.burst(tx * 8 + 4, ty * 8 + 4, ['#6b4d38', '#8a7a68'], 2, 30); this.player.swingT = Math.max(this.player.swingT, 0.2); }
    if (m.p < 1) return;
    this.mining = null;
    this.audio.play('break');
    if (target === 'obj') return this.breakObject(obj);
    if (target === 'wall') { w.setWall(tx, ty, 0); this.drop(tx, ty, walls[wall].drop, 1); return; }
    this.breakTile(tx, ty, fg);
  }

  breakTile(tx, ty, fg) {
    const w = this.world, td = tiles[fg];
    this.fx.burst(tx * 8 + 4, ty * 8 + 4, ['#6b4d38', '#555a67', '#8a7a68'], 10, 70);
    if (td.tree) return this.fellTree(tx, ty);
    w.setTile(tx, ty, T.AIR);
    if (td.drop) {
      if (fg === T.TALLGRASS || fg === T.ROOTS) { if (Math.random() < 0.5) this.drop(tx, ty, td.drop, 1); }
      else this.drop(tx, ty, td.drop, 1);
    }
    // things resting on this tile come down with it
    const up = w.get(tx, ty - 1);
    if (tiles[up].soft && up !== T.AIR && !tiles[up].tree) { w.setTile(tx, ty - 1, T.AIR); if (tiles[up].drop && Math.random() < 0.6) this.drop(tx, ty - 1, tiles[up].drop, 1); }
    const o = w.objectAt(tx, ty - 1);
    if (o && OBJ[o.type].mount === 'floor' && o.y + o.h === ty) this.breakObject(o);
  }

  fellTree(tx, ty) {
    const w = this.world;
    // find the trunk base, then everything above it that belongs to the tree
    let by = ty;
    while (w.get(tx, by + 1) === T.TRUNK) by++;
    const q = [[tx, by]], seen = new Set();
    let wood = 0, leaves = 0;
    while (q.length) {
      const [x, y] = q.pop();
      const k = y * w.w + x;
      if (seen.has(k) || Math.abs(x - tx) > 5 || y > by) continue;
      const t = w.get(x, y);
      if (t !== T.TRUNK && t !== T.LEAVES && t !== T.PINE) continue;
      seen.add(k);
      if (t === T.TRUNK) wood++; else leaves++;
      w.setTile(x, y, T.AIR);
      if (t !== T.TRUNK) for (let i = 0; i < 1; i++) this.fx.add(x * 8 + 4, y * 8 + 4, (Math.random() - 0.5) * 40, -20, 1.2, t === T.PINE ? '#2b5646' : '#3e6c38', 120, 1);
      q.push([x + 1, y], [x - 1, y], [x, y - 1], [x, y + 1]);
    }
    this.drop(tx, by, 'wood', wood + 1);
    if (leaves) this.drop(tx, by - 3, 'fiber', Math.ceil(leaves / 6));
    if (Math.random() < 0.4) this.drop(tx, by - 3, 'flower', 1);
  }

  breakObject(o) {
    const w = this.world;
    w.removeObject(o);
    this.drop(o.x + (o.w >> 1), o.y + (o.h >> 1), o.type, 1);
    if (o.type === 'chest' && o.owner !== null) {
      for (const [id, n] of [['coin', 3 + Math.floor(Math.random() * 6)], ['bread', 2], [['copper', 'iron', 'crystal'][Math.floor(Math.random() * 3)], 2]]) this.drop(o.x, o.y, id, n);
    }
    if (o.type === 'sack' && o.owner !== null && Math.random() < 0.5) this.drop(o.x, o.y, 'bread', 1);
    // theft?
    if (o.owner !== null && o.owner !== undefined) {
      const v = this.world.villages[o.owner];
      if (v) this.theft(v, o);
    }
    for (const vl of this.villagers) if (vl.bed === o) vl.bed = null;
  }

  place(item, tx, ty) {
    const w = this.world, p = this.player;
    if (item.kind === 'tile') {
      const cur = w.get(tx, ty);
      if (cur !== T.AIR && !tiles[cur].soft) return;
      if (w.objectAt(tx, ty)) return;
      const td = tiles[item.place];
      if (td.solid) {
        for (const e of [p, ...this.villagers, ...this.wolves]) {
          if (e.x < tx * 8 + 8 && e.x + e.w > tx * 8 && e.y < ty * 8 + 8 && e.y + e.h > ty * 8) return;
        }
      }
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.get(tx + dx, ty + dy) !== T.AIR) || w.getWall(tx, ty);
      if (!nb) return;
      if ((item.place === T.FLOWER || item.place === T.SHROOM) && !w.solid(tx, ty + 1)) return;
      w.setTile(tx, ty, item.place);
    } else if (item.kind === 'wall') {
      if (w.getWall(tx, ty)) return;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.getWall(tx + dx, ty + dy) || w.solid(tx + dx, ty + dy));
      if (!nb) return;
      w.setWall(tx, ty, item.place);
    } else if (item.kind === 'object') {
      const a = this.anchor(item.place, tx, ty);
      const o = w.addObject(item.place, a.x, a.y, null);
      if (!o) return;
      if (item.place === 'bed') this.considerHome(o, true);
      else this.homeCheckT = Math.min(this.homeCheckT, 0.5);
    } else return;
    this.inv.useHeld();
    this.audio.play('place');
    this.fx.burst(tx * 8 + 4, ty * 8 + 6, ['#e8dcc0'], 3, 20);
  }

  useObject(tx, ty) {
    const o = this.world.objectAt(tx, ty);
    if (o && o.type === 'bed' && o.owner === null) {
      this.player.spawn = { x: (o.x + 1) * 8, y: (o.y + o.h) * 8 - this.player.h };
      this.ui.toast('Spawn point set');
    }
  }

  gift(v) {
    const item = ITEMS[this.inv.held.id];
    this.inv.useHeld();
    v.v.grudge = Math.max(0, v.v.grudge - item.gift);
    v.happy = 2.5;
    if (v.alarm) { v.alarm = null; v.act = null; }
    this.audio.play('heart');
    this.ui.toast(`${v.name} liked the ${item.name}`, '#f0a0a8');
  }

  eat(item) {
    const p = this.player;
    if (p.hp >= p.maxHp) { this.ui.toast('You are not hungry'); return; }
    this.inv.useHeld();
    p.hp = Math.min(p.maxHp, p.hp + item.heal);
    this.audio.play('pickup');
  }

  drop(tx, ty, id, n) {
    if (!id || !ITEMS[id] || n <= 0) return;
    this.drops.push(new Drop(tx * TILE + 4, ty * TILE + 4, id, n));
  }

  updateDrops(dt) {
    const p = this.player;
    for (const d of this.drops) {
      d.age += dt;
      const dx = p.cx - d.cx, dy = p.cy - d.cy, dd = Math.hypot(dx, dy);
      if (d.age > 0.4 && dd < 40 && !this.dead) {
        // pulled items glide straight to the player, through the terrain
        const sp = 60 + (40 - dd) * 6;
        d.x += (dx / dd) * sp * dt; d.y += (dy / dd) * sp * dt; d.vx = d.vy = 0;
      } else {
        d.vx *= 0.96;
        d.physics(this.world, dt, false);
        if (d.onGround) d.vx *= 0.8;
      }
      if (d.age > 0.4 && dd < 10) {
        const left = this.inv.add(d.id, d.n);
        if (left < d.n) this.audio.play('pickup');
        d.n = left;
        if (!left) d.dead = true;
      }
    }
    this.drops = this.drops.filter((d) => !d.dead && d.age < 300);
  }

  // ---------------------------------------------------------------- villages reacting
  villageAggression(v, attacker, victim, severity) {
    if (attacker.kind === 'player') {
      v.grudge += severity;
    }
    for (const o of this.villagers) {
      if (o === victim || o.v !== v || o.dead) continue;
      if (Math.hypot(o.cx - victim.cx, o.cy - victim.cy) > 20 * TILE) continue;
      o.alarmed(attacker, attacker.kind === 'player');
    }
  }

  theft(v, o) {
    const p = this.player;
    const seen = this.villagers.filter((vl) => vl.v === v && !vl.dead && !vl.sleeping && Math.abs(vl.cx - p.cx) < 14 * TILE && Math.abs(vl.cy - p.cy) < 8 * TILE);
    if (!seen.length) return;
    v.grudge += 2;
    this.ui.toast(`${seen[0].name} saw you take the ${OBJ[o.type].name}!`, '#e09048');
    for (const vl of seen) {
      if (v.grudge >= 4) vl.alarmed(p, true);
      else { vl.say('HEY!', 2.5, '#e05a48'); vl.facing = Math.sign(p.cx - vl.cx) || 1; }
    }
  }

  villagerDied(vl, from) {
    const loot = { cook: ['bread', 3], smith: ['iron', 2], keeper: ['stew', 1], weaver: ['fiber', 5], hauler: ['planks', 6], farmer: ['glowshroom', 2], miner: ['copper', 3], guard: ['copper_sword', 1], elder: ['coin', 5], kid: ['flower', 1], settler: ['coin', 2] }[vl.role];
    this.drop(vl.tx, vl.ty - 1, 'coin', 1 + Math.floor(Math.random() * 3));
    if (loot) this.drop(vl.tx, vl.ty - 1, loot[0], loot[1]);
    this.fx.burst(vl.cx, vl.cy, ['#8a3030', '#c8a878'], 14, 70);
    if (from.kind === 'player') {
      vl.v.grudge += 5;
      this.ui.toast(`${vl.v.name} will remember this.`, '#e05a48');
      this.villageAggression(vl.v, from, vl, 0);
    }
  }

  wolfDied(wf, from) {
    this.drop(wf.tx, wf.ty, 'pelt', 1);
    this.drop(wf.tx, wf.ty, 'meat', 1 + Math.floor(Math.random() * 2));
    if (Math.random() < 0.5) this.drop(wf.tx, wf.ty, 'bone', 1);
  }

  playerDied() {
    if (this.dead) return;
    this.dead = true; this.deadT = 3;
    this.player.dead = true;
    this.ui.toast('You fell. Waking up at your spawn point...', '#e05a48');
  }
  respawn() {
    const p = this.player;
    this.dead = false; p.dead = false; p.hp = p.maxHp;
    p.x = p.spawn.x; p.y = p.spawn.y; p.vx = p.vy = 0;
    this.camSnap = true;
  }

  societies(dt) {
    const p = this.player;
    this.nearVillage = null;
    for (const v of [...this.world.villages, this.homestead]) {
      v.grudge = Math.max(0, v.grudge - dt / 40);
      if (p.tx >= v.x0 - 6 && p.tx <= v.x1 + 6 && v.type !== 'home') this.nearVillage = v;
    }
    for (const vl of this.villagers) {
      if (vl.dead || vl.sleeping) continue;
      // grudges: guards chase a hated player on sight
      if (!vl.alarm && vl.v.grudge >= 6 && !this.dead) {
        const d = Math.hypot(vl.cx - p.cx, vl.cy - p.cy) / TILE;
        const inside = p.tx >= vl.v.x0 - 6 && p.tx <= vl.v.x1 + 6;
        if ((vl.role === 'guard' && (d < 30 || inside)) || d < 8) vl.alarmed(p, true);
      }
      // wolves near the village: guards fight, everyone else runs
      if (!vl.alarm) {
        for (const wf of this.wolves) {
          if (wf.dead || wf.state === 'sleep') continue;
          const d = Math.hypot(wf.cx - vl.cx, wf.cy - vl.cy) / TILE;
          if ((vl.role === 'guard' && d < 14) || d < 7) { vl.alarmed(wf, false); break; }
        }
      }
    }
  }

  // ---------------------------------------------------------------- spawning & homes
  spawner(dt) {
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    this.spawnT = 8;
    const t = this.time, night = t < 0.22 || t > 0.8, p = this.player, w = this.world;
    const hunters = this.wolves.filter((wf) => wf.hunter);
    if (night && hunters.length < 3 && p.ty < w.surface[p.tx] + 4 && Math.random() < 0.45) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = p.tx + side * (44 + Math.floor(Math.random() * 12));
      if (x > 2 && x < w.w - 2) {
        const inVillage = w.villages.some((v) => x >= v.x0 && x <= v.x1);
        if (!inVillage) this.wolves.push(new Wolf(this, x * TILE, (w.surface[x] - 2) * TILE, null, this.rand));
      }
    }
    if (!night) this.wolves = this.wolves.filter((wf) => !(wf.hunter && Math.abs(wf.cx - p.cx) > 50 * TILE));
  }

  considerHome(bed, announce) {
    const r = checkHome(this.world, bed);
    let h = this.homes.find((x) => x.bed === bed);
    if (!r.ok) { if (announce) this.ui.toast(r.why, '#d8c060'); if (h) h.ok = false; return; }
    if (!h) { h = { bed, resident: null, t: 18 + Math.random() * 14 }; this.homes.push(h); }
    h.ok = true; h.info = r;
    if (announce && !h.resident) this.ui.toast('This room could be a home. Someone may move in soon.', '#8ac060');
  }

  housing(dt) {
    this.homeCheckT -= dt;
    if (this.homeCheckT <= 0) {
      this.homeCheckT = 4;
      for (const o of this.world.objects) if (o.alive && o.type === 'bed' && o.owner === null) this.considerHome(o, false);
      this.homes = this.homes.filter((h) => h.bed.alive);
    }
    for (const h of this.homes) {
      if (!h.ok || h.resident) continue;
      h.t -= dt * (this.timeFast ? 24 : 1);
      if (h.t <= 0) this.settlerArrives(h);
    }
  }

  settlerArrives(h) {
    const w = this.world, hs = this.homestead;
    const role = roleForHome(h.info);
    const [x0, y0, x1] = h.info.box;
    hs.x0 = Math.min(hs.x0, x0 - 6); hs.x1 = Math.max(hs.x1, x1 + 6);
    hs.tables = w.objects.filter((o) => o.alive && o.owner === null && (o.type === 'table' || o.type === 'chair'));
    hs.stations = w.objects.filter((o) => o.alive && o.owner === null && OBJ[o.type].tags.includes('station'));
    hs.storage = w.objects.filter((o) => o.alive && o.owner === null && OBJ[o.type].tags.includes('storage'));
    const fire = w.objects.find((o) => o.alive && o.owner === null && o.type === 'campfire');
    hs.gather = fire ? { x: fire.x, y: fire.y } : { x: h.bed.x + 1, y: h.bed.y + h.bed.h - 1 };
    const work = { stations: h.info.stations, floors: [{ y: h.bed.y + h.bed.h - 1, x0, x1 }] };
    const vl = new Villager(this, hs, { role, bed: h.bed, work }, this.villagers.length, this.rand);
    // walk in from the edge of the view
    const side = Math.random() < 0.5 ? -1 : 1;
    let sx = h.bed.x + side * 44;
    sx = Math.max(3, Math.min(w.w - 4, sx));
    let sy = w.surface[sx] - 1;
    for (let k = 0; k < 40 && !(w.passable(sx, sy) && w.passable(sx, sy - 1) && w.support(sx, sy + 1)); k++) sy--;
    vl.x = sx * TILE + 1; vl.y = (sy + 1) * TILE - vl.h;
    this.villagers.push(vl);
    h.resident = vl;
    this.audio.play('chime');
    this.ui.toast(`${vl.name} the ${ROLE_NAMES[role]} is moving into your house!`, '#8ac060');
  }

  onWorldChange() { /* chunk dirtiness is handled by the world */ }

  // ---------------------------------------------------------------- ambience
  ambient(dt) {
    const w = this.world, cam = this.cam, t = this.time, night = t < 0.23 || t > 0.79;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 0.05;
    // chimney smoke
    for (const v of w.villages) for (const c of v.chimneys || []) {
      const sx = c.x * 8 - cam.x;
      if (sx > -40 && sx < VW + 40 && Math.random() < 0.5) this.fx.smoke(c.x * 8 + 4, c.y * 8 + 6);
    }
    // campfire embers
    for (const o of w.objects) {
      if (!o.alive || (o.type !== 'campfire' && o.type !== 'hearth' && o.type !== 'furnace')) continue;
      const sx = o.x * 8 - cam.x;
      if (sx < -20 || sx > VW + 20 || Math.random() > 0.25) continue;
      this.fx.add(o.x * 8 + o.w * 4 + (Math.random() - 0.5) * 6, o.y * 8 + (o.type === 'campfire' ? 2 : 10), (Math.random() - 0.5) * 8, -25 - Math.random() * 15, 1 + Math.random(), Math.random() < 0.5 ? '#ffb050' : '#ff7a30', -8, 1, true);
    }
    // glowing spores drifting through grottos
    for (const gr of w.grottos || []) {
      if (Math.abs(gr.x * 8 - (cam.x + VW / 2)) > VW || Math.abs(gr.y * 8 - (cam.y + VH / 2)) > VH) continue;
      for (let k = 0; k < 3; k++) {
        const sx = gr.x + (Math.random() - 0.5) * gr.rx * 2, sy = gr.y + (Math.random() - 0.5) * gr.ry * 1.6;
        if (w.get(Math.floor(sx), Math.floor(sy)) === T.AIR) this.fx.add(sx * 8, sy * 8, (Math.random() - 0.5) * 6, -3 - Math.random() * 4, 5 + Math.random() * 4, Math.random() < 0.7 ? '#9ff0e0' : '#ffd88a', -1, 1, true);
      }
    }
    // fireflies on summer nights, falling leaves by day
    const tx = Math.floor((cam.x + Math.random() * VW) / 8), ty = Math.floor((cam.y + Math.random() * VH) / 8);
    if (night && w.inb(tx, ty) && ty < w.surface[tx] + 1 && w.get(tx, ty) === T.AIR && Math.random() < 0.5) {
      this.fx.add(tx * 8, ty * 8, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, 4 + Math.random() * 3, '#d8f080', 0, 1, true);
    }
    if (!night && (w.get(tx, ty) === T.LEAVES || w.get(tx, ty) === T.PINE) && w.get(tx, ty + 1) === T.AIR && Math.random() < 0.6) {
      this.fx.add(tx * 8 + 4, ty * 8 + 8, 8 + Math.random() * 6, 10, 4, w.get(tx, ty) === T.PINE ? '#335a48' : '#78a856', 6, 1);
    }
  }

  updateCamera(dt) {
    const p = this.player, w = this.world;
    const tx = p.cx - VW / 2 + p.facing * 20, ty = p.cy - VH / 2 - 10;
    if (this.camSnap) { this.cam.x = tx; this.cam.y = ty; this.camSnap = false; }
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 5);
    this.cam.x = Math.max(0, Math.min(w.w * TILE - VW, this.cam.x));
    this.cam.y = Math.max(0, Math.min(w.h * TILE - VH, this.cam.y));
  }

  // ---------------------------------------------------------------- render
  render(dt) {
    this.fps = this.fps ? this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05 : 60;
    const cam = { x: Math.round(this.cam.x), y: Math.round(this.cam.y) };
    const w = this.world, f = this.fx2d;
    const surfPx = w.surface[Math.max(0, Math.min(w.w - 1, Math.floor((cam.x + VW / 2) / 8)))] * 8;
    this.sky.draw(this.bx2d, this.time, cam.x, cam.y, surfPx, this.clock);
    f.clearRect(0, 0, VW, VH);
    const cx0 = Math.floor(cam.x / (CS * 8)), cy0 = Math.floor(cam.y / (CS * 8));
    for (let cy = cy0; cy <= Math.floor((cam.y + VH) / (CS * 8)); cy++) {
      for (let cx = cx0; cx <= Math.floor((cam.x + VW) / (CS * 8)); cx++) {
        if (cx < 0 || cy < 0 || cx * CS >= w.w || cy * CS >= w.h) continue;
        f.drawImage(this.chunks.get(cx, cy), cx * CS * 8 - cam.x, cy * CS * 8 - cam.y);
      }
    }
    // mining cracks
    if (this.mining && this.mining.p > 0) {
      const m = this.mining, n = Math.floor(m.p * 6);
      f.fillStyle = '#140e12';
      for (let i = 0; i < n * 3; i++) {
        const a = (i * 2.4) % 8, b = (i * 5.3) % 8;
        f.fillRect(m.x * 8 - cam.x + Math.floor(a), m.y * 8 - cam.y + Math.floor(b), 1, 1);
      }
    }
    this.drawEntities(f, cam);
    // particles
    for (const q of this.fx.p) {
      f.globalAlpha = q.g < 0 ? Math.min(0.7, q.life / q.max) : 1;
      f.fillStyle = q.col;
      f.fillRect(Math.round(q.x - cam.x), Math.round(q.y - cam.y), q.size, q.size);
    }
    f.globalAlpha = 1;
    // lighting
    const lx0 = Math.floor(cam.x / 8) - 16, ly0 = Math.floor(cam.y / 8) - 16;
    const lw = Math.ceil(VW / 8) + 33, lh = Math.ceil(VH / 8) + 33;
    const dyn = [];
    const p = this.player;
    dyn.push({ x: p.cx / 8, y: p.cy / 8, r: 0.28, g: 0.26, b: 0.24 });
    const held = this.inv.held;
    if (held && (held.id === 'torch' || held.id === 'lantern')) dyn.push({ x: p.cx / 8 + p.facing * 0.6, y: p.cy / 8, r: 0.95, g: 0.66, b: 0.34 });
    for (const q of this.fx.p) {
      if (!q.glow || dyn.length > 80) continue;
      const teal = q.col === '#9ff0e0';
      dyn.push({ x: q.x / 8, y: q.y / 8, r: teal ? 0.08 : 0.4, g: teal ? 0.32 : 0.32, b: teal ? 0.3 : 0.1 });
    }
    const light = this.light.compute(lx0, ly0, lw, lh, sunAt(this.time), dyn, this.clock);
    this.comp.draw(this.back, this.front, light, lw, lh, lx0 * 8 - cam.x, ly0 * 8 - cam.y);
    this.ui.draw(this.hx, dt);
  }

  drawEntities(f, cam) {
    const vis = (e) => e.x + e.w > cam.x - 30 && e.x < cam.x + VW + 30 && e.y + e.h > cam.y - 30 && e.y < cam.y + VH + 30;
    for (const vl of this.villagers) {
      if (!vis(vl)) continue;
      if (vl.sleeping && vl.bed) {
        const s = sleeperSprite(vl.role, vl.skin);
        f.drawImage(s, vl.bed.x * 8 + 3 - cam.x, vl.bed.y * 8 + 4 - cam.y);
        continue;
      }
      const fr = vl.frame();
      let s = villagerSprite(vl.role, vl.skin, fr, vl.kid);
      if (vl.facing < 0) s = flipped(s);
      const sx = Math.round(vl.cx - s.width / 2 - cam.x), sy = Math.round(vl.feet - s.height + 1 - cam.y) + (fr === 'sit' ? 2 : 0) + (fr === 'cower' ? 2 : 0);
      if (vl.hurtT > 0) f.globalAlpha = 0.6;
      f.drawImage(s, sx, sy);
      f.globalAlpha = 1;
      this.drawTool(f, vl, sx, sy, s.width, fr);
    }
    for (const wf of this.wolves) {
      if (!vis(wf)) continue;
      let s = wolfSprite(wf.frame());
      if (wf.facing < 0) s = flipped(s);
      if (wf.hurtT > 0) f.globalAlpha = 0.6;
      f.drawImage(s, Math.round(wf.cx - s.width / 2 - cam.x), Math.round(wf.feet - s.height + 1 - cam.y));
      f.globalAlpha = 1;
    }
    for (const d of this.drops) {
      const bob = Math.round(Math.sin(d.age * 4) * 1);
      f.drawImage(icon(d.id), Math.round(d.cx - 6 - cam.x), Math.round(d.feet - 11 - cam.y + bob));
    }
    const p = this.player;
    if (!this.dead) {
      let s = playerSprite(p.pose(this.clock));
      if (p.facing < 0) s = flipped(s);
      if (!(p.hurtT > 0 && Math.floor(this.clock * 20) % 2)) f.drawImage(s, Math.round(p.cx - s.width / 2 - cam.x), Math.round(p.feet - s.height + 1 - cam.y));
      const held = this.inv.held;
      if (held && (ITEMS[held.id].kind === 'tool' || ITEMS[held.id].kind === 'weapon' || held.id === 'torch')) {
        const ic = icon(held.id);
        const ang = p.swingT > 0 ? (-1.4 + (0.3 - p.swingT) / 0.3 * 2.4) : 0.2;
        f.save();
        f.translate(Math.round(p.cx + p.facing * 4 - cam.x), Math.round(p.cy + 1 - cam.y));
        f.scale(p.facing, 1); f.rotate(ang);
        f.drawImage(ic, -2, -10);
        f.restore();
      }
    }
  }

  drawTool(f, vl, sx, sy, sw, fr) {
    const face = vl.facing, hx = face > 0 ? sx + sw - 2 : sx + 1;
    f.fillStyle = '#4a3220';
    if (vl.role === 'guard') {
      f.fillRect(hx, sy - 3, 1, 16); f.fillStyle = '#b8bcc6'; f.fillRect(hx - 1, sy - 5, 3, 2); f.fillRect(hx, sy - 6, 1, 1);
    } else if (vl.role === 'elder') {
      f.fillRect(hx, sy + 3, 1, 14); f.fillStyle = '#e8a040'; f.fillRect(hx - 1, sy + 2, 3, 2);
    } else if (fr === 'work0' || fr === 'work1') {
      const tool = vl.act?.tool;
      const up = fr === 'work0';
      if (tool === 'hammer' || tool === 'pick' || tool === 'hoe') {
        const ty = up ? sy + 2 : sy + 8;
        f.fillRect(hx, ty, 1, 6);
        f.fillStyle = tool === 'hammer' ? '#6a6d78' : '#8a8e98';
        if (tool === 'pick') f.fillRect(hx - 2, ty, 5, 1); else f.fillRect(hx - 1, ty, 3, 2);
      } else if (tool === 'spoon') f.fillRect(hx, sy + 8 + (up ? 0 : 1), 1, 6);
    }
  }
}

export { VW, VH };
