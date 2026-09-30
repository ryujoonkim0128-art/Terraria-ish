// Headless smoke test: boot, start, look around the world, exercise the systems, save screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html#12345`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1320, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForFunction('window.game', null, { timeout: 30000 });
await page.waitForTimeout(800);
const stage = page.locator('#stage');
const shot = async (name) => { await page.waitForTimeout(400); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
await shot('00_title');
await page.mouse.click(660, 380);
await page.waitForTimeout(300);
const steps = JSON.parse(process.env.STEPS || '[]');
const tp = (x, y, t) => page.evaluate(([x, y, t]) => {
  const g = window.game; const p = g.player;
  if (x !== null) { p.x = x * 8; p.y = (y ?? g.world.surface[x] - 3) * 8; p.vx = p.vy = 0; g.camSnap = true; }
  if (t !== null) g.time = t;
}, [x, y, t]);
const info = await page.evaluate(() => {
  const g = window.game, w = g.world;
  return { spawn: w.spawn, villages: w.villages.map((v) => ({ name: v.name, type: v.type, x0: v.x0, x1: v.x1, gy: w.surface[(v.x0 + v.x1) >> 1] })), dens: w.dens.map((d) => ({ x: d.x, y: d.y })), grottos: w.grottos, villagers: g.villagers.length, wolves: g.wolves.length };
});
console.log(JSON.stringify(info));
await shot('01_spawn');
for (const s of steps) {
  await tp(s.x ?? null, s.y ?? null, s.t ?? null);
  if (s.js) await page.evaluate(s.js);
  await page.waitForTimeout(s.wait ?? 1500);
  await shot(s.name);
}
const stats = await page.evaluate(() => {
  const g = window.game;
  const acts = {};
  for (const v of g.villagers) { const k = v.alarm ? 'alarm-' + v.alarm.mode : v.sleeping ? 'sleep' : (v.act?.phase || '-') + (v.act?.moving ? '*' : ''); acts[k] = (acts[k] || 0) + 1; }
  return { t: g.time.toFixed(3), villagers: g.villagers.length, acts, fps: g.fps };
});
console.log(JSON.stringify(stats));
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
