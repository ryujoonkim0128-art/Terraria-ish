// Fast simulation without rendering: three in-game days with an extra bedroom and farm. Checks that nothing throws,
// folk keep eating and sleeping, and newcomers arrive.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
await page.goto(`http://localhost:${server.address().port}/index.html#new`);
await page.waitForFunction('window.game');
const r = await page.evaluate(() => {
  const g = window.game, w = g.world;
  g.ui.startGame(); g.speed = 1;
  const h = w.rooms[0], b = w.rooms[1];
  // a farm under the hearth room reached by a hatch, and a bedroom past the existing tunnel
  g.res.wood = 60; g.res.stone = 40;
  const bed = w.placeRoom('bedroom', b.x + b.w + 6, b.y);
  for (let x = b.x + b.w; x < b.x + b.w + 6; x++) for (const y of [b.y + b.h - 1, b.y + b.h - 2]) if (w.diggable(x, y)) w.mark[w.idx(x, y)] = 1;
  const farm = w.placeRoom('farm', h.x, h.y + h.h + 1);
  const lx = h.x + 1;
  for (let y = h.y + h.h; y <= farm.y + farm.h - 1; y++) { if (w.tile(lx, y) === 7) { w.fg[w.idx(lx, y)] = 0; w.bg[w.idx(lx, y)] = 1; } w.ladder[w.idx(lx, y)] = 1; if (w.diggable(lx, y)) w.mark[w.idx(lx, y)] = 1; }
  g.countMarks();
  const log = [];
  const t0 = performance.now();
  for (let i = 0; i < 300 * 3 * 20; i++) {
    g.update(0.05);
    if (i % 3000 === 0) { g.light.lw = 0; log.push({ day: g.day, t: g.time.toFixed(2), folk: g.folk.length, rooms: w.rooms.map((r) => r.type.slice(0, 3) + ':' + r.state).join(' '), food: g.res.food, meal: g.res.meal, joy: g.avgJoy().toFixed(2), marks: g.markCount, sleeping: g.folk.filter((f) => f.task?.kind === 'sleep').length, hunger: Math.min(...g.folk.map((f) => f.hunger)).toFixed(2) }); }
  }
  return { log, ms: Math.round(performance.now() - t0), stuck: g.folk.filter((f) => g.world.solid(f.cx, f.cy)).length };
});
for (const l of r.log) console.log(JSON.stringify(l));
console.log('ms', r.ms, 'stuck', r.stuck);
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
if (errors.length) process.exit(1);
