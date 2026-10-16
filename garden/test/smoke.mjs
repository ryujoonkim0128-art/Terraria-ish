// Headless smoke test: boot a fresh garden, exercise buying/planting/growing/weather/harvest/sell, save screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html#new`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForFunction('window.game', null, { timeout: 30000 });
await page.waitForTimeout(600);
const stage = page.locator('#stage');
const shot = async (name) => { await page.waitForTimeout(250); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const ev = (fn, arg) => page.evaluate(fn, arg);
await shot('01_spawn');

// Cheat sheckles, buy and plant a sampler of every crop across the beds.
const r1 = await ev(() => {
  const g = window.game, s = g.s;
  s.sheckles = 5e9;
  for (const k of ['seeds', 'gear', 'eggs']) for (const id in s.shops[k].stock) s.shops[k].stock[id] = Math.max(s.shops[k].stock[id], 5);
  const ok = g.buy('seeds', 'carrot', 5);
  const crops = Object.keys(window.CROPS || {});
  return { ok, sheckles: s.sheckles, inv: s.inv.filter(Boolean).map((i) => i.id + 'x' + i.n) };
});
console.log(JSON.stringify(r1));
await ev(async () => {
  const g = window.game;
  const m = await import('./src/content.js');
  const beds = g.world.beds;
  let i = 0;
  for (const c of m.CROPS) {
    for (let k = 0; k < 3; k++) {
      const b = beds[i % 4]; const slot = Math.floor(i / 4);
      const tx = b.x0 + 1 + (slot % 7) * 2, ty = b.y0 + (Math.floor(slot / 7) % 3) * 2;
      g.s.inv[0] = { kind: 'seed', id: c.id, n: 1, uses: 0 };
      g.plantSeed(tx, ty, g.s.inv[0]);
      i++;
    }
  }
  g.player.x = 22 * 16; g.player.y = 17 * 16; g.camSnap = true;
});
await shot('02_planted');
// grow: stage sweeps
for (const [name, secs] of [['03_growing', 40], ['04_mature', 400], ['05_ripe', 4000]]) {
  await ev((secs) => { const g = window.game; for (const p of g.s.plants) { p.progress += secs / (p.ripe ? 1e9 : 1) * 0 ; } for (let t = 0; t < secs; t += 5) { for (const p of g.s.plants) { const c = p.crop; } } const m = { }; for (const p of g.s.plants) { const grow = p.ripe ? 0 : 1; } g.s.weather = null; for (let t = 0; t < secs; t += 2) g.update(2); g.s.weather = null; g.floaters.length = 0; g.particles.length = 0; g.toasts.length = 0; }, secs);
  await shot(name);
}
const grown = await ev(() => { const g = window.game; return { plants: g.s.plants.length, ripe: g.s.plants.filter((p) => p.ripe).length, fruits: g.s.plants.reduce((a, p) => a + p.fruits.filter(Boolean).length, 0) }; });
console.log(JSON.stringify(grown));

// weather showcase
for (const w of ['rain', 'storm', 'frost', 'bees', 'disco', 'tornado', 'meteor']) {
  await ev((w) => { const g = window.game; g.startWeather(w); for (let t = 0; t < 30; t += 1) g.update(1); g.floaters.length = 0; g.toasts.length = 0; g.frame(0.016); g.frame(0.016); }, w);
  await shot('06_weather_' + w);
}
await ev(() => { const g = window.game; g.s.weather = null; g.s.time = 480 * 0.8; g.s.bloodMoon = false; for (let t = 0; t < 30; t += 1) g.update(1); g.floaters.length = 0; g.toasts.length = 0; });
await shot('07_night');
await ev(() => { const g = window.game; g.s.time = 480 * 0.5; });

// mutations summary and harvest/sell
const h = await ev(() => {
  const g = window.game;
  const muts = {};
  for (const p of g.s.plants) for (const f of p.fruits) if (f) for (const m of f.muts) muts[m] = (muts[m] || 0) + 1;
  const before = g.s.sheckles;
  g.s.sheckles = 0;
  let n = 0;
  for (const p of [...g.s.plants]) { if (p.ripe) for (let i = p.fruits.length - 1; i >= 0; i--) if (p.fruits[i] && g.harvest(p, i, true)) n++; }
  const bp = g.s.backpack.length;
  const got = g.sellAll();
  return { muts, harvested: n, backpack: bp, got, sheckles: g.s.sheckles, best: g.s.stats.best };
});
console.log(JSON.stringify(h));
if (h.harvested < 10 || h.got <= 0) errors.push('harvest/sell failed: ' + JSON.stringify(h));

// panels
await ev(() => { const g = window.game; g.player.x = 7 * 16 + 8; g.player.y = 6 * 16 + 8; g.camSnap = true; g.frame(0.016); g.interact(); });
await shot('08_seedshop');
await ev(() => { window.game.ui.open('gear'); });
await shot('09_gearshop');
await ev(() => { window.game.ui.open('eggs'); });
await shot('10_eggshop');
// eggs & pets
await ev(() => {
  const g = window.game; g.ui.close();
  for (const e of ['common', 'rare', 'legendary']) { g.s.inv[1] = { kind: 'egg', id: e, n: 1, uses: 0 }; g.placeEgg(10 + Object.keys(g.s.pets).length * 3, 24, g.s.inv[1]); }
  for (const o of [...g.s.objects]) if (o.type === 'egg') g.hatch(o);
  for (const id of ['cat', 'dragonfly', 'frog', 'cow', 'snail', 'chicken']) g.s.pets.push({ uid: id, id, name: id, xp: 500, hunger: 80, equipped: false, x: 0, y: 0, cd: 1, aura: null, tgt: null, idle: 0, frame: 0 });
  g.s.inv[2] = { kind: 'gear', id: 'sprinkler3', n: 1, uses: 1 }; g.useOn = g.useOn.bind(g); g.selected = 2; g.useOn(12, 17);
  g.s.inv[3] = { kind: 'gear', id: 'rod', n: 1, uses: 1 }; g.selected = 3; g.useOn(30, 17);
  g.player.x = 22 * 16; g.player.y = 23 * 16; g.camSnap = true;
  for (let t = 0; t < 10; t++) g.update(1);
});
await shot('11_pets');
await ev(() => { window.game.ui.open('pets'); });
await shot('12_petpanel');
await ev(() => { window.game.ui.open('help'); });
await shot('13_help');
await ev(() => { const g = window.game; g.ui.close(); g.s.backpack.push(...g.s.plants.filter((p) => p.ripe).flatMap((p) => p.fruits.filter(Boolean))); g.ui.open('sell'); });
await shot('14_sell');
const stats = await ev(() => { const g = window.game; g.ui.close(); g.save(); return { fps: g.fps, pets: g.s.pets.length, equipped: g.equippedPets().length, objects: g.s.objects.length }; });
console.log(JSON.stringify(stats));
// reload from save
await page.goto(url.replace('#new', ''));
await page.waitForFunction('window.game', null, { timeout: 30000 });
await page.waitForTimeout(500);
const reloaded = await ev(() => ({ plants: window.game.s.plants.length, pets: window.game.s.pets.length, sheckles: window.game.s.sheckles }));
console.log('reloaded', JSON.stringify(reloaded));
if (!reloaded.plants) errors.push('save/load failed');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
