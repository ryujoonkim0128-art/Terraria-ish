// Physics bodies, the player, item drops and particles.
import { tiles, T, TILE } from './content.js';

export const GRAV = 880;

export class Body {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.climbing = false; this.dropT = 0;
    this.hitWall = 0; this.facing = 1; this.dead = false;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get feet() { return this.y + this.h; }
  get tx() { return Math.floor(this.cx / TILE); }
  get ty() { return Math.floor((this.y + this.h - 1) / TILE); }

  overlapsLadder(world) {
    const x = Math.floor(this.cx / TILE);
    const y0 = Math.floor(this.y / TILE), y1 = Math.floor((this.y + this.h - 1) / TILE);
    for (let y = y0; y <= y1; y++) if (world.ladder(x, y)) return true;
    return false;
  }

  boxFree(world, x, y) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + this.w - 0.01) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + this.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solid(tx, ty)) return false;
    return true;
  }

  moveX(world, dx, canStep) {
    this.x += dx;
    const y0 = Math.floor(this.y / TILE), y1 = Math.floor((this.y + this.h - 0.01) / TILE);
    const tx = dx > 0 ? Math.floor((this.x + this.w - 0.01) / TILE) : Math.floor(this.x / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      if (!world.solid(tx, ty)) continue;
      // auto-step onto a one-tile ledge
      if (canStep && this.onGround && !this.climbing && ty === y1) {
        const ny = ty * TILE - this.h;
        if (this.y - ny <= TILE + 0.5 && this.boxFree(world, this.x, ny)) { this.y = ny; this.stepped = 0.1; return; }
      }
      this.x = dx > 0 ? tx * TILE - this.w : (tx + 1) * TILE;
      this.vx = 0; this.hitWall = dx > 0 ? 1 : -1;
      return;
    }
  }

  moveY(world, dy) {
    const prevFeet = this.y + this.h;
    this.y += dy;
    const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
    if (dy > 0) {
      const ty = Math.floor((this.y + this.h - 0.01) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const t = tiles[world.get(tx, ty)];
        let land = t.solid;
        if (!land && !this.climbing && this.dropT <= 0 && prevFeet <= ty * TILE + 0.5) {
          land = t.platform || (t.climb && !world.ladder(tx, ty - 1));
        }
        if (land) { this.y = ty * TILE - this.h; this.vy = 0; this.onGround = true; return; }
      }
    } else if (dy < 0) {
      const ty = Math.floor(this.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (world.solid(tx, ty)) { this.y = (ty + 1) * TILE; this.vy = 0; return; }
      }
    }
  }

  physics(world, dt, canStep = true) {
    this.hitWall = 0;
    this.dropT -= dt;
    if (this.stepped) this.stepped = Math.max(0, this.stepped - dt);
    if (!this.climbing) this.vy = Math.min(this.vy + GRAV * dt, 420);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vx), Math.abs(this.vy)) * dt / 3));
    const sdt = dt / steps;
    const wasGround = this.onGround;
    this.onGround = false;
    for (let i = 0; i < steps; i++) {
      this.onGround = this.onGround || (i === 0 && wasGround);
      this.moveX(world, this.vx * sdt, canStep);
      this.onGround = false;
      this.moveY(world, this.vy * sdt);
    }
    // still resting on something?
    if (!this.onGround && this.vy >= 0 && !this.climbing) {
      const ty = Math.floor((this.y + this.h + 0.5) / TILE);
      if (Math.abs(this.y + this.h - ty * TILE) < 0.6) {
        const x0 = Math.floor(this.x / TILE), x1 = Math.floor((this.x + this.w - 0.01) / TILE);
        for (let tx = x0; tx <= x1; tx++) {
          const t = tiles[world.get(tx, ty)];
          if (t.solid || ((t.platform || (t.climb && !world.ladder(tx, ty - 1))) && this.dropT <= 0)) { this.onGround = true; break; }
        }
      }
    }
    if (this.climbing && !this.overlapsLadder(world)) this.climbing = false;
    this.x = Math.max(0, Math.min(this.x, world.w * TILE - this.w));
  }
}

// ------------------------------------------------------------------ player
export class Player extends Body {
  constructor(x, y) {
    super(x, y, 7, 15);
    this.maxHp = 20; this.hp = 20;
    this.inv = null;
    this.swingT = 0; this.hurtT = 0; this.regenT = 0; this.animT = 0;
    this.spawn = { x, y };
    this.kind = 'player';
  }

  control(world, input, dt) {
    const left = input.down('KeyA') || input.down('ArrowLeft');
    const right = input.down('KeyD') || input.down('ArrowRight');
    const up = input.down('KeyW') || input.down('ArrowUp');
    const down = input.down('KeyS') || input.down('ArrowDown');
    const jump = input.pressed('Space') || (!this.overlapsLadder(world) && input.pressed('KeyW'));
    const speed = 72;
    const target = (right ? 1 : 0) - (left ? 1 : 0);
    if (target) this.facing = target;
    const acc = this.onGround ? 1100 : 650;
    const want = target * speed;
    if (this.vx < want) this.vx = Math.min(want, this.vx + acc * dt);
    else if (this.vx > want) this.vx = Math.max(want, this.vx - acc * dt);
    const onL = this.overlapsLadder(world);
    if (onL && (up || (down && !this.onGround) || (down && world.ladder(this.tx, this.ty + 1)))) {
      this.climbing = true;
    }
    if (this.climbing) {
      this.vy = up ? -52 : down ? 52 : 0;
      this.vx *= 0.6;
      const lx = this.tx * TILE + 4 - this.w / 2;
      if (!target) this.x += (lx - this.x) * Math.min(1, dt * 12);
      if (input.pressed('Space')) { this.climbing = false; this.vy = -170; }
    } else {
      if (down && this.onGround && world.platform(this.tx, this.ty + 1)) this.dropT = 0.25;
      if (jump && this.onGround) { this.vy = -218; this.onGround = false; }
      if (!input.down('Space') && !input.down('KeyW') && this.vy < -80) this.vy += 900 * dt;   // short hops
    }
  }

  pose(time) {
    if (this.swingT > 0) return 'swing' + Math.min(2, Math.floor((0.3 - this.swingT) / 0.1));
    if (this.climbing) return Math.abs(this.vy) > 1 ? (Math.floor(time * 8) % 2 ? 'climb0' : 'climb1') : 'climb0';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 8) return 'walk' + (Math.floor(time * 10) % 4);
    return 'idle';
  }

  hurt(dmg, from, game) {
    if (this.hurtT > 0 || this.dead) return;
    this.hp -= dmg; this.hurtT = 0.7; this.regenT = 0;
    const dir = Math.sign(this.cx - (from ? from.cx : this.cx)) || 1;
    this.vx = dir * 110; this.vy = -140; this.climbing = false;
    game?.fx.hit(this.cx, this.cy, '#c84040');
    game?.audio.play('hurt');
    if (this.hp <= 0) game?.playerDied();
  }
}

// ------------------------------------------------------------------ drops
export class Drop extends Body {
  constructor(x, y, id, n) {
    super(x - 3, y - 3, 6, 6);
    this.id = id; this.n = n; this.age = 0;
    this.vx = (Math.random() - 0.5) * 60; this.vy = -80 - Math.random() * 40;
    this.kind = 'drop';
  }
}

// ------------------------------------------------------------------ particles
export class FX {
  constructor() { this.p = []; }
  add(x, y, vx, vy, life, col, g = 300, size = 1, glow = false) {
    if (this.p.length > 900) return;
    this.p.push({ x, y, vx, vy, life, max: life, col, g, size, glow });
  }
  burst(x, y, cols, n = 8, speed = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.add(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.4 + Math.random() * 0.4, cols[i % cols.length], 400, Math.random() < 0.3 ? 2 : 1);
    }
  }
  hit(x, y, col) { this.burst(x, y, [col, '#ffffff'], 6, 70); }
  sparks(x, y) { for (let i = 0; i < 4; i++) this.add(x, y, (Math.random() - 0.5) * 90, -40 - Math.random() * 60, 0.35, Math.random() < 0.5 ? '#ffd070' : '#ff9a40', 380, 1, true); }
  smoke(x, y) { this.add(x + (Math.random() - 0.5) * 3, y, (Math.random() - 0.3) * 6, -10 - Math.random() * 6, 3 + Math.random() * 2, '#8a8a92', -2, 2); }
  update(dt, world) {
    const p = this.p;
    for (let i = p.length - 1; i >= 0; i--) {
      const q = p[i];
      q.life -= dt;
      q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.g > 0 && world.solid(Math.floor(q.x / TILE), Math.floor(q.y / TILE))) { q.vy *= -0.3; q.vx *= 0.5; q.y -= 1; }
      if (q.life <= 0) { p[i] = p[p.length - 1]; p.pop(); }
    }
  }
}

export { T };
