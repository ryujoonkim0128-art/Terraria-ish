// Scene renderer: ground, y-sorted sprites, fruit with mutation glows, weather particles, lighting.
import { TILE, CROP, GEARMAP, EGGMAP, PETS, MUTATIONS, WEATHER, NIGHT_AT } from './content.js';
import { VW, VH } from './game.js';
import { MW, MH, G_SOIL } from './world.js';
import * as S from './sprites.js';
import { plantSprite, fruitSprite } from './plants.js';
import { canvas, mix, hsl } from './pix.js';
import { text } from './font.js';
import { clamp, lerp } from './rng.js';

const NPC_X = 40;
export class Renderer {
  constructor(game) {
    this.g = game;
    this.ctx = game.view.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    [this.light, this.lctx] = canvas(VW, VH);
    this.rain = []; this.snow = []; this.bees = []; this.leaves = []; this.flies = []; this.streaks = [];
    this.spray = [];
    this.lastT = 0;
    this.funnel = { x: 0, y: 0 };
  }

  stage(p) { return p.ripe ? 3 : Math.min(3, Math.floor(p.progress * 4)); }

  draw() {
    const g = this.g, ctx = this.ctx, cam = g.cam, t = g.t;
    const dt = Math.min(0.1, t - this.lastT); this.lastT = t;
    const sx = g.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0, sy = g.shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2a4a2a'; ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(-cam.x + sx, -cam.y + sy);
    const vx0 = cam.x - 48, vy0 = cam.y - 64, vx1 = cam.x + VW + 48, vy1 = cam.y + VH + 48;
    const vis = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1;

    // 1. ground
    ctx.drawImage(g.world.ground2(), 0, 0);
    // wet soil during rain / watered plants
    const wid = g.s.weather?.id;
    if (wid === 'rain' || wid === 'storm' || wid === 'choc') { ctx.fillStyle = wid === 'choc' ? 'rgba(60,30,10,0.3)' : 'rgba(20,30,90,0.25)'; for (const b of g.world.beds) ctx.fillRect(b.x0 * TILE, b.y0 * TILE, (b.x1 - b.x0 + 1) * TILE, (b.y1 - b.y0 + 1) * TILE); }
    else if (wid === 'frost') { ctx.fillStyle = 'rgba(200,235,255,0.22)'; ctx.fillRect(0, 0, MW * TILE, MH * TILE); }
    for (const p of g.s.plants) if (p.water > 0) { ctx.fillStyle = 'rgba(20,30,90,0.3)'; ctx.fillRect(p.tx * TILE, p.ty * TILE, TILE, TILE); }
    // cloud shadows by day
    const daylight = this.daylight();
    if (daylight > 0.5 && !wid) {
      ctx.globalAlpha = (daylight - 0.5) * 2;
      for (let i = 0; i < 4; i++) { const c = S.cloudShadow(i); const x = ((t * 6 + i * 230) % (MW * TILE + 240)) - 120, y = ((i * 170 + t * 1.5) % (MH * TILE + 140)) - 70; ctx.drawImage(c, Math.round(x), Math.round(y)); }
      ctx.globalAlpha = 1;
    }
    // sprinkler / aura ranges
    for (const o of g.s.objects) if (o.type === 'sprinkler') this.ring(o.tx * TILE + 8, o.ty * TILE + 8, GEARMAP[o.id].spr.r * TILE, 'rgba(120,200,255,0.22)');
    for (const p of g.equippedPets()) if (p.aura) this.ring(p.x, p.y, p.aura.r * TILE, { nap: 'rgba(255,220,120,0.25)', variantAura: 'rgba(255,210,60,0.3)', growthAura: 'rgba(140,220,100,0.3)', mutAura: 'rgba(210,140,255,0.3)' }[p.aura.type]);
    // tile cursor
    if (g.target?.ok && !g.ui.panel) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(g.target.tx * TILE + 0.5, g.target.ty * TILE + 0.5, TILE - 1, TILE - 1); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(g.target.tx * TILE, g.target.ty * TILE, TILE, TILE); }
    if (g.carried) { ctx.fillStyle = 'rgba(255,230,120,0.25)'; for (const b of g.world.beds) ctx.fillRect(b.x0 * TILE, b.y0 * TILE, (b.x1 - b.x0 + 1) * TILE, (b.y1 - b.y0 + 1) * TILE); }

    // 2. drawables
    const items = [];
    for (const d of g.world.decor) if (vis(d.x, d.y)) items.push({ y: d.y, f: () => this.drawDecor(d) });
    for (const st of g.world.stalls) {
      const x = st.x0 * TILE, y = st.y0 * TILE;
      items.push({ y: y + 16, f: () => { ctx.drawImage(S.stallBack(st.kind), x - 4, y - 8); const sg = S.stallSign(st.kind); ctx.drawImage(sg, x + 19, y + 4); text(ctx, st.sign, x + 40, y + 7, '#fff4d0', { align: 'center' }); } });
      items.push({ y: y + 40, f: () => { this.shadow(x + NPC_X, y + 42, 6, 2); const idle = Math.floor(t * 2) % 8 === 0 ? 1 : 0; ctx.drawImage(S.personSprite(st.npc, 'down', idle), x + NPC_X - 8, y + 42 - 21); } });
      items.push({ y: y + 48, f: () => ctx.drawImage(S.stallFront(st.kind), x - 4, y + 32) });
    }
    for (const p of g.s.plants) if (vis(p.tx * TILE, p.ty * TILE)) items.push({ y: p.ty * TILE + 16, f: () => this.drawPlant(p) });
    for (const o of g.s.objects) if (vis(o.tx * TILE, o.ty * TILE)) items.push({ y: o.ty * TILE + 15, f: () => this.drawObject(o) });
    for (const p of g.equippedPets()) items.push({ y: p.y, f: () => this.drawPet(p) });
    const pl = g.player;
    items.push({ y: pl.y, f: () => { this.shadow(pl.x, pl.y + 1, 6, 2); ctx.drawImage(S.personSprite('player', pl.dir, pl.frame), Math.round(pl.x) - 8, Math.round(pl.y) - 21); if (g.carried) { const sp = plantSprite(g.carried.crop, this.stage(g.carried)); ctx.drawImage(sp.c, Math.round(pl.x) + sp.ox, Math.round(pl.y) - 24 + sp.oy); } } });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.f();

    // 3. particles & floaters & fx
    for (const p of g.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size || 2, p.size || 2); }
    ctx.globalAlpha = 1;
    this.drawFx(dt);
    for (const f of g.floaters) { ctx.globalAlpha = Math.min(1, f.life); text(ctx, f.text, f.x, f.y, f.col, { align: 'center', shadow: '#1b1220' }); }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 4. weather (screen space)
    this.drawWeather(dt);
    // 5. lighting
    this.drawLighting();
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, g.flash * 3)})`; ctx.fillRect(0, 0, VW, VH); }
  }

  ring(x, y, r, col) {
    const ctx = this.ctx;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); ctx.stroke();
  }
  shadow(x, y, rx, ry) { const ctx = this.ctx; ctx.fillStyle = 'rgba(10,20,20,0.3)'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  daylight() {
    const f = this.g.dayFrac;
    if (f < 0.05) return f / 0.05;                       // dawn
    if (f < NIGHT_AT - 0.07) return 1;
    if (f < NIGHT_AT) return 1 - (f - (NIGHT_AT - 0.07)) / 0.07; // dusk
    return 0;
  }

  drawDecor(d) {
    const ctx = this.ctx;
    if (d.type === 'tree') { this.shadow(d.x, d.y, 12, 4); ctx.drawImage(S.tree(d.v), d.x - 18, d.y - 45); }
    else if (d.type === 'bush') { this.shadow(d.x, d.y, 8, 2); ctx.drawImage(S.bush(d.v), d.x - 10, d.y - 13); }
    else if (d.type === 'rock') ctx.drawImage(S.rock(d.v), d.x - 7, d.y - 9);
    else if (d.type === 'lantern') { this.shadow(d.x, d.y, 4, 1); ctx.drawImage(S.lantern(), d.x - 5, d.y - 23); }
    else if (d.type === 'sign') { ctx.drawImage(S.signBoard(), d.x - 11, d.y - 17); text(ctx, 'GARDEN', d.x, d.y - 14, '#f8ecc8', { align: 'center' }); }
    else if (d.type === 'scarecrow') { this.shadow(d.x, d.y, 5, 2); ctx.drawImage(S.scarecrow(), d.x - 10, d.y - 29); }
  }

  drawPlant(p) {
    const ctx = this.ctx, g = this.g, t = g.t;
    const c = CROP[p.crop];
    const st = this.stage(p);
    const sp = plantSprite(p.crop, st);
    const bx = p.tx * TILE + 8, by = p.ty * TILE + 15;
    const sway = (g.s.weather?.id === 'tornado' || g.s.weather?.id === 'storm') ? Math.round(Math.sin(t * 9 + p.tx) * 1.5) : 0;
    if (st >= 2 && (c.form === 'tree' || c.form === 'conifer' || c.form === 'palm')) this.shadow(bx, by + 1, 8, 3);
    if (c.glow && st === 3) { ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.08; ctx.fillStyle = c.glow; ctx.beginPath(); ctx.ellipse(bx, by - 8, 12, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.drawImage(sp.c, bx + sp.ox + sway, by + sp.oy);
    if (p.variant !== 'Normal' && st >= 1) { ctx.globalAlpha = 0.18 + Math.sin(t * 3 + p.tx) * 0.06; ctx.fillStyle = p.variant === 'Gold' ? '#ffd23f' : hsl(t * 0.3, 1, 0.6); ctx.fillRect(p.tx * TILE, p.ty * TILE, TILE, TILE); ctx.globalAlpha = 1; }
    if (p.ripe) {
      const frame = Math.floor(t * 8) % 12;
      p.fruits.forEach((f, i) => {
        if (!f) return;
        const a = sp.anchors[i % sp.anchors.length] || { x: sp.w / 2, y: sp.h / 2 };
        const fs = fruitSprite(f.crop, f.variant, f.muts, frame);
        const bob = (f.muts.length || f.variant !== 'Normal') ? Math.round(Math.sin(t * 3 + i * 1.3) * 0.9) : 0;
        const fx = bx + sp.ox + a.x + sway, fy = by + sp.oy + a.y + bob;
        this.fruitGlow(f, fx, fy, t, i);
        ctx.drawImage(fs, Math.round(fx - fs.width / 2), Math.round(fy - fs.height / 2));
        if (f.muts.includes('Shocked') && Math.random() < 0.3) { ctx.fillStyle = '#fff44f'; ctx.fillRect(Math.round(fx + (Math.random() - 0.5) * 12), Math.round(fy + (Math.random() - 0.5) * 12), 1, 2); }
        if (f.muts.includes('Celestial') && Math.floor(t * 6 + i) % 3 === 0) { ctx.fillStyle = '#ffffff'; const ox = Math.round(Math.sin(t * 2 + i) * 5), oy = Math.round(Math.cos(t * 1.7 + i) * 4); ctx.fillRect(Math.round(fx + ox), Math.round(fy + oy - 1), 1, 3); ctx.fillRect(Math.round(fx + ox - 1), Math.round(fy + oy), 3, 1); }
      });
    }
    if (p.fav) text(ctx, '★', bx - 2, by + sp.oy - 9 + Math.round(Math.sin(t * 2) * 1), '#ffd23f', { shadow: '#1b1220' });
    if (p.water > 0 && Math.random() < 0.2) g.particles.push({ x: p.tx * TILE + 2 + Math.random() * 12, y: p.ty * TILE + 4 + Math.random() * 10, vx: 0, vy: -6, life: 0.4, col: '#aee8ff', g: 0, size: 1 });
  }
  fruitGlow(f, x, y, t, i) {
    const ctx = this.ctx;
    let col = null, r = 7;
    if (f.variant === 'Rainbow') { col = hsl(t * 0.5 + i * 0.1, 1, 0.6); r = 8; }
    else if (f.variant === 'Gold') col = '#ffd23f';
    for (const m of f.muts) { if (m === 'Moonlit' || m === 'Celestial' || m === 'Shocked' || m === 'Disco' || m === 'Bloodlit') { col = m === 'Disco' ? hsl(t * 2 + i, 1, 0.6) : MUTATIONS[m].color; r = 8; } }
    if (!col) return;
    ctx.globalAlpha = 0.22 + Math.sin(t * 4 + i) * 0.08;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), r, r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  drawObject(o) {
    const ctx = this.ctx, g = this.g, t = g.t;
    const x = o.tx * TILE + 8, y = o.ty * TILE + 15;
    if (o.type === 'sprinkler') {
      this.shadow(x, y, 5, 2);
      ctx.drawImage(S.sprinklerSprite(o.id), x - 7, y - 15);
      const r = GEARMAP[o.id].spr.r * TILE;
      if (Math.random() < 0.6) { const a = t * 3 + Math.random() * 0.6; g.particles.push({ x: x, y: y - 12, vx: Math.cos(a) * r * 1.3, vy: Math.sin(a) * r - 25, life: 0.7, col: Math.random() < 0.5 ? '#8fd0ff' : '#dff4ff', g: 70, size: 1 }); }
      const frac = o.left / GEARMAP[o.id].spr.life;
      ctx.fillStyle = '#1b1220'; ctx.fillRect(x - 6, y + 1, 12, 2); ctx.fillStyle = '#6fb6ff'; ctx.fillRect(x - 6, y + 1, Math.round(12 * frac), 2);
    } else if (o.type === 'rod') {
      this.shadow(x, y, 4, 1);
      ctx.drawImage(S.rodSprite(), x - 5, y - 25);
      if (g.s.weather?.id === 'storm' && Math.random() < 0.2) { ctx.fillStyle = '#fff44f'; ctx.fillRect(x - 3 + Math.round(Math.random() * 6), y - 26 + Math.round(Math.random() * 4), 1, 2); }
      for (let i = 0; i < o.charges; i++) { ctx.fillStyle = '#fff44f'; ctx.fillRect(x - 4 + i * 3, y + 1, 2, 2); }
    } else if (o.type === 'egg') {
      ctx.drawImage(S.nest(), x - 9, y - 7);
      const e = EGGMAP[o.id];
      const wob = o.left < 20 ? Math.round(Math.sin(t * 20) * 1) : 0;
      ctx.drawImage(S.eggSprite(o.id, true), x - 8 + wob, y - 20);
      const frac = 1 - o.left / e.hatch;
      ctx.fillStyle = '#1b1220'; ctx.fillRect(x - 7, y + 1, 14, 3); ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 6, y + 2, Math.round(12 * frac), 1);
    }
  }
  drawPet(p) {
    const ctx = this.ctx, t = this.g.t;
    const def = PETS[p.id], s = def.look.size || 1;
    this.shadow(p.x, p.y + 1, Math.round(6 * s), 2);
    const sp = S.petSprite(p.id, p.frame, p.flip);
    const bob = (!p.tgt && !(p.aura?.type === 'nap')) ? (Math.floor(t * 2 + p.x) % 2 ? 0 : -1) : 0;
    ctx.drawImage(sp, Math.round(p.x) - 12, Math.round(p.y) - 18 + bob);
    if (p.aura?.type === 'nap') { text(ctx, 'z', Math.round(p.x) + 6 + Math.round(Math.sin(t * 2) * 2), Math.round(p.y) - 22 - ((t * 6) % 8), '#cfe6ff', { shadow: '#1b1220' }); }
    if (p.hunger <= 0) text(ctx, '!', Math.round(p.x) - 2, Math.round(p.y) - 26 + Math.round(Math.sin(t * 6)), '#ff6b6b', { shadow: '#1b1220' });
  }

  drawFx(dt) {
    const ctx = this.ctx, g = this.g, t = g.t;
    for (const f of g.fx) {
      if (f.type === 'bolt') {
        ctx.strokeStyle = Math.random() < 0.5 ? '#fff' : '#fff44f'; ctx.lineWidth = 2;
        ctx.beginPath(); let x = f.x + 20, y = f.y - 200; ctx.moveTo(x, y);
        while (y < f.y) { y += 12 + Math.random() * 10; x += (Math.random() - 0.5) * 16 + (f.x - x) * 0.3; ctx.lineTo(x, y); }
        ctx.lineTo(f.x, f.y); ctx.stroke();
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff44f'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 12, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.type === 'meteor') {
        const k = 1 - f.t / f.total; const sx = f.x + 160, sy = f.y - 220;
        const x = lerp(sx, f.x, k), y = lerp(sy, f.y, k);
        ctx.strokeStyle = 'rgba(255,200,120,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 30, y - 40); ctx.lineTo(x, y); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4); ctx.fillStyle = '#ffe9ff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      } else if (f.type === 'bee') {
        const k = 1 - f.t / f.total;
        const x = f.x + Math.sin(k * Math.PI) * 40 * Math.cos(k * 20) * (1 - k), y = f.y - 10 - Math.abs(Math.sin(k * Math.PI * 3)) * 20 - (1 - Math.min(1, k * 3)) * 60;
        this.bee(x, y, t);
      }
    }
  }
  bee(x, y, t) {
    const ctx = this.ctx;
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 2, y, 4, 2); ctx.fillStyle = '#1b1220'; ctx.fillRect(x - 1, y, 1, 2); ctx.fillRect(x + 1, y, 1, 2);
    ctx.fillStyle = Math.floor(t * 30) % 2 ? '#dff4ff' : '#ffffff'; ctx.fillRect(x - 2, y - 2, 2, 1); ctx.fillRect(x + 1, y - 2, 2, 1);
  }

  drawWeather(dt) {
    const ctx = this.ctx, g = this.g, t = g.t, cam = g.cam;
    const id = g.s.weather?.id;
    if (id === 'rain' || id === 'storm' || id === 'choc') {
      const n = id === 'storm' ? 160 : 110;
      while (this.rain.length < n) this.rain.push({ x: Math.random() * (VW + 60), y: Math.random() * VH, v: 240 + Math.random() * 120, l: 4 + Math.random() * 5 });
      ctx.strokeStyle = id === 'choc' ? 'rgba(120,70,30,0.8)' : 'rgba(190,220,255,0.65)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.rain) { d.y += d.v * dt; d.x -= 50 * dt; if (d.y > VH) { d.y = -10; d.x = Math.random() * (VW + 60); } ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1, d.y + d.l); }
      ctx.stroke();
      if (Math.random() < 0.5) { ctx.fillStyle = id === 'choc' ? 'rgba(150,90,40,0.7)' : 'rgba(220,240,255,0.7)'; const x = Math.random() * VW, y = Math.random() * VH; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); }
    } else this.rain.length = 0;
    if (id === 'frost') {
      while (this.snow.length < 70) this.snow.push({ x: Math.random() * VW, y: Math.random() * VH, v: 20 + Math.random() * 25, p: Math.random() * 6 });
      ctx.fillStyle = 'rgba(240,250,255,0.9)';
      for (const f of this.snow) { f.y += f.v * dt; f.x += Math.sin(t * 2 + f.p) * 12 * dt; if (f.y > VH) { f.y = -4; f.x = Math.random() * VW; } ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2); }
      ctx.fillStyle = 'rgba(200,235,255,0.10)'; ctx.fillRect(0, 0, VW, VH);
    } else this.snow.length = 0;
    if (id === 'bees') {
      while (this.bees.length < 14) this.bees.push({ x: Math.random() * VW, y: Math.random() * VH, a: Math.random() * 7, s: 30 + Math.random() * 30 });
      for (const b of this.bees) { b.a += (Math.random() - 0.5) * dt * 6; b.x += Math.cos(b.a) * b.s * dt; b.y += Math.sin(b.a) * b.s * dt * 0.6; if (b.x < -10) b.x = VW + 10; if (b.x > VW + 10) b.x = -10; if (b.y < -10) b.y = VH + 10; if (b.y > VH + 10) b.y = -10; this.bee(b.x, b.y + Math.sin(t * 8 + b.a) * 2, t); }
    } else this.bees.length = 0;
    if (id === 'tornado') {
      while (this.leaves.length < 60) this.leaves.push({ a: Math.random() * 7, r: 10 + Math.random() * 50, h: Math.random() * 90, s: 4 + Math.random() * 6, c: Math.random() < 0.5 ? '#8fd36a' : '#c9a06a' });
      const gw = g.world.garden;
      const fx = (gw.x0 + 8 + ((t * 0.07) % 1) * 26) * TILE - cam.x, fy = (gw.y0 + 4 + Math.sin(t * 0.3) * 6) * TILE - cam.y;
      this.funnel = { x: fx, y: fy };
      for (let i = 0; i < 9; i++) { const w = 6 + i * 4, y = fy - i * 9, x = fx + Math.sin(t * 5 + i) * (2 + i); ctx.fillStyle = `rgba(200,190,170,${0.35 - i * 0.02})`; ctx.beginPath(); ctx.ellipse(x, y, w, 3 + i * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
      for (const l of this.leaves) { l.a += l.s * dt; l.h = (l.h + 30 * dt) % 90; const x = fx + Math.cos(l.a) * l.r * (0.3 + l.h / 90), y = fy - l.h + Math.sin(l.a) * 4; ctx.fillStyle = l.c; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); }
      ctx.fillStyle = 'rgba(180,170,140,0.12)'; ctx.fillRect(0, 0, VW, VH);
    } else this.leaves.length = 0;
    if (id === 'disco') {
      for (let i = 0; i < 6; i++) { const a = t * 1.5 + i * Math.PI / 3; const x = VW / 2 + Math.cos(a) * 170, y = VH / 2 + Math.sin(a * 1.3) * 100; ctx.fillStyle = hsl(i / 6 + t * 0.2, 1, 0.55); ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.ellipse(x, y, 34, 24, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = hsl(t * 0.7, 1, 0.5); ctx.globalAlpha = 0.06; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    }
    if (id === 'meteor') {
      if (Math.random() < 0.06) this.streaks.push({ x: Math.random() * VW + 100, y: -10, t: 0.6 });
      for (let i = this.streaks.length - 1; i >= 0; i--) { const s = this.streaks[i]; s.t -= dt; s.x -= 260 * dt; s.y += 200 * dt; ctx.strokeStyle = `rgba(255,230,200,${Math.max(0, s.t)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(s.x + 18, s.y - 14); ctx.lineTo(s.x, s.y); ctx.stroke(); if (s.t <= 0) this.streaks.splice(i, 1); }
    } else this.streaks.length = 0;
    if (id === 'heat') { ctx.fillStyle = 'rgba(255,170,60,0.10)'; ctx.fillRect(0, 0, VW, VH); if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(Math.random() * VW, Math.random() * VH, 2, 1); } }
    // fireflies at night in the garden
    if (this.g.isNight && !this.g.s.bloodMoon) {
      while (this.flies.length < 18) { const gw = g.world.garden; this.flies.push({ x: (gw.x0 + Math.random() * (gw.x1 - gw.x0)) * TILE, y: (gw.y0 + Math.random() * (gw.y1 - gw.y0)) * TILE, p: Math.random() * 7 }); }
      for (const f of this.flies) { f.x += Math.sin(t * 0.7 + f.p) * 8 * dt; f.y += Math.cos(t * 0.9 + f.p * 2) * 6 * dt; const on = Math.sin(t * 3 + f.p * 5) > 0.3; if (on) { ctx.fillStyle = '#eaff7a'; ctx.fillRect(Math.round(f.x - cam.x), Math.round(f.y - cam.y), 1, 1); } }
    } else this.flies.length = 0;
  }

  drawLighting() {
    const g = this.g, ctx = this.ctx, l = this.lctx, cam = g.cam, t = g.t;
    const day = this.daylight();
    const id = g.s.weather?.id;
    let amb = mix('#2b3272', '#ffffff', day);
    if (g.s.bloodMoon && day < 1) amb = mix(amb, '#8a1a2a', 1 - day);
    if (day > 0 && day < 1) amb = mix(amb, '#ff9a4a', 0.25 * Math.sin(day * Math.PI));
    const dims = { rain: ['#96a4c8', 0.5], storm: ['#5a6490', 0.7], frost: ['#cfe6ff', 0.3], choc: ['#b89a80', 0.4], tornado: ['#b8b098', 0.4], heat: ['#ffe0b0', 0.3], meteor: ['#8c8cc0', 0.5] };
    if (dims[id]) amb = mix(amb, dims[id][0], dims[id][1]);
    if (id === 'disco') amb = mix(amb, hsl(t * 0.5, 0.8, 0.5), 0.35);
    if (amb === '#ffffff') return;
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = amb; l.fillRect(0, 0, VW, VH);
    const dark = 1 - day;
    if (dark > 0.05 || id === 'storm') {
      l.globalCompositeOperation = 'lighter';
      const flick = 0.9 + Math.sin(t * 7) * 0.05 + Math.sin(t * 13) * 0.05;
      for (const L of g.world.lights) {
        const x = L.x - cam.x, y = L.y - cam.y;
        if (x < -80 || x > VW + 80 || y < -80 || y > VH + 80) continue;
        const r = (L.r || 34) * flick;
        for (const [k, a] of [[1, 0.22], [0.66, 0.28], [0.36, 0.4]]) { l.fillStyle = L.c || `rgba(255,200,110,${a * dark})`; l.globalAlpha = L.c ? a * dark : 1; l.beginPath(); l.ellipse(x, y, r * k, r * k * 0.8, 0, 0, Math.PI * 2); l.fill(); }
      }
      l.globalAlpha = 1;
      // glowing fruit / plants
      for (const p of g.s.plants) {
        const c = CROP[p.crop];
        const glow = (c.glow && this.stage(p) === 3) ? c.glow : null;
        let fruitGlow = null;
        if (p.ripe) for (const f of p.fruits) if (f && (f.variant !== 'Normal' || f.muts.some((m) => ['Moonlit', 'Celestial', 'Shocked', 'Disco', 'Bloodlit'].includes(m)))) fruitGlow = f.variant === 'Gold' ? '#ffd23f' : '#c9a8ff';
        const col = glow || fruitGlow; if (!col) continue;
        const x = p.tx * TILE + 8 - cam.x, y = p.ty * TILE + 8 - cam.y;
        l.globalAlpha = 0.2 * dark; l.fillStyle = col; l.beginPath(); l.ellipse(x, y, 12, 9, 0, 0, Math.PI * 2); l.fill();
      }
      l.globalAlpha = 1;
      // player lantern-ish glow so it never gets too dark around the player
      const px = g.player.x - cam.x, py = g.player.y - cam.y;
      l.fillStyle = `rgba(120,120,160,${0.5 * dark})`; l.beginPath(); l.ellipse(px, py - 8, 40, 32, 0, 0, Math.PI * 2); l.fill();
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.light, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // moon / stars at night
    if (dark > 0.3) {
      ctx.globalAlpha = (dark - 0.3) / 0.7;
      const mx = VW - 50, my = 26;
      ctx.fillStyle = g.s.bloodMoon ? '#ff5a5a' : '#fff6d0'; ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
      if (!g.s.bloodMoon) { ctx.fillStyle = '#e8dcb0'; ctx.fillRect(mx - 3, my - 2, 2, 2); ctx.fillRect(mx + 2, my + 3, 2, 1); }
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 30; i++) { const sx = (i * 97 + 13) % VW, sy = (i * 61 + 7) % 90; if (Math.sin(t * 2 + i) > -0.4) ctx.fillRect(sx, sy, 1, 1); }
      ctx.globalAlpha = 1;
    }
  }
}
