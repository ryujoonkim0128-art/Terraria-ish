// Headless play-through: boot, start, dig, build, interact, fast-forward; screenshots and invariant checks.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html#4242`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push('console: ' + m.text()); });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.goto(url);
await page.waitForFunction('window.game', null, { timeout: 30000 });
await page.waitForTimeout(600);
const stage = page.locator('#stage');
const shot = async (name) => { await page.waitForTimeout(250); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const box = await stage.boundingBox();
const S = box.width / 480;
const at = (x, y) => [box.x + x * S, box.y + y * S];
const click = async (x, y, opts) => { const [a, b] = at(x, y); await page.mouse.click(a, b, opts); };
await shot('00_title');
await click(240, 118);
await page.waitForTimeout(300);
const ok = await page.evaluate(() => window.game.started);
if (!ok) throw new Error('did not start');
await shot('01_start');

// mark a tunnel with the dig tool, drag across
const g = () => page.evaluate(() => { const g = window.game; return { cam: g.cam, cabin: g.world.cabin, rooms: g.world.rooms.map((r) => [r.type, r.x, r.y, r.state]) }; });
const info = await g();
console.log(JSON.stringify(info));
const toScreen = (cx, cy, cam) => [cx * 8 + 4 - cam.x, cy * 8 + 4 - cam.y];
await page.keyboard.press('Digit2');
const hearth = info.rooms[0];
const bed = info.rooms[1];
// tunnel to the right of the bedroom at floor level
{
  const fy = bed[2] + 3; // bottom row of bedroom
  const [x0, y0] = toScreen(bed[1] + 10, fy, info.cam);
  const [x1, y1] = toScreen(bed[1] + 20, fy, info.cam);
  const [a, b] = at(x0, y0); const [c, d] = at(x1, y1);
  await page.mouse.move(a, b); await page.mouse.down(); await page.mouse.move(c, d, { steps: 12 }); await page.mouse.up();
}
const marks = await page.evaluate(() => window.game.markCount);
console.log('marks', marks);
await shot('02_marked');
// place a kitchen room left of the hearth room
await page.keyboard.press('Digit4');
await page.evaluate(() => { window.game.pick = 'kitchen'; });
{
  const [x, y] = toScreen(hearth[1] - 8, hearth[2] + 4, info.cam);
  await page.mouse.move(...at(x, y));
  await shot('03_room_ghost');
  await click(x, y);
}
// connect it to the hearth room with a short tunnel
await page.keyboard.press('Digit2');
{
  const [x0, y0] = toScreen(hearth[1] - 4, hearth[2] + 4, info.cam);
  const [x1, y1] = toScreen(hearth[1] - 1, hearth[2] + 4, info.cam);
  await page.mouse.move(...at(x0, y0)); await page.mouse.down(); await page.mouse.move(...at(x1, y1), { steps: 6 }); await page.mouse.up();
}
await page.keyboard.press('Digit1');
// mark the two nearest trees for chopping
await page.evaluate(() => {
  const g = window.game, sx = g.world.cabin.shaft;
  const trees = [...g.world.trees].sort((a, b) => Math.abs(a.x - sx) - Math.abs(b.x - sx)).slice(0, 2);
  for (const t of trees) g.interact({ kind: 'tree', ref: t });
});
// interactions: poke a folk, toggle a lamp, stoke the hearth
const poke = await page.evaluate(() => {
  const g = window.game, f = g.folk[0];
  const before = f.pokes;
  g.interact({ kind: 'folk', ref: f });
  const lamp = g.world.objects.find((o) => o.type === 'lamp');
  g.useObject(lamp); const off = !lamp.on; g.useObject(lamp);
  const h = g.world.objects.find((o) => o.type === 'hearth'); h.fuel = 0.2; const w0 = g.res.wood; g.useObject(h);
  return { poked: f.pokes > before, lampToggled: off && lamp.on, stoked: h.fuel === 1 && g.res.wood === w0 - 1 };
});
console.log(JSON.stringify(poke));
// fast forward
await page.evaluate(() => { window.game.speed = 3; });
for (let i = 0; i < 14; i++) {
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => { const g = window.game; return { t: g.time.toFixed(2), day: g.day, marks: g.markCount, res: g.res, rooms: g.world.rooms.map((r) => r.type + ':' + r.state + ':' + r.progress.toFixed(1)), chopped: g.stats.chopped, goal: g.goal, joy: g.avgJoy().toFixed(2), tasks: g.folk.map((f) => (f.task ? f.task.kind + '/' + f.task.stage : '-')), fps: g.fps }; });
  console.log(JSON.stringify(st));
}
await shot('04_after');
// look at the surface by night
await page.evaluate(() => { const g = window.game; g.time = 0.95; g.cam.y = (g.world.cabin.y - 22) * 8; g.cam.x = g.world.cabin.shaft * 8 - 240; g.speed = 1; });
await shot('05_night_surface');
await page.evaluate(() => { const g = window.game; g.time = 0.5; });
await shot('06_day_surface');
await page.evaluate(() => { const g = window.game; g.time = 0.8; g.cam.y = (g.world.cabin.y + 2) * 8; });
await shot('07_burrow_evening');
// hover a folk to see their card
const fpos = await page.evaluate(() => { const g = window.game, f = g.folk[0]; return [f.x - g.cam.x, f.y - 6 - g.cam.y]; });
await page.mouse.move(...at(fpos[0], fpos[1]));
await shot('08_hover');
// decor palette
await page.keyboard.press('Digit5');
await page.evaluate(() => { window.game.pick = 'lantern'; });
await page.mouse.move(...at(240, 160));
await shot('09_decor');
// place a lantern in the hearth room, then drag it somewhere else and drag a folk around
const dec = await page.evaluate(() => {
  const g = window.game, r = g.world.rooms[0];
  g.camGlide = null; g.cam.x = r.x * 8 - 100; g.cam.y = r.y * 8 - 80; g.speed = 0;
  return { cam: { ...g.cam }, r: [r.x, r.y, r.w, r.h], wood: g.res.wood, iron: g.res.iron };
});
await page.evaluate(() => { window.game.res.iron += 2; });
{
  const [x, y] = toScreen(dec.r[0] + 10, dec.r[1] + 2, dec.cam);
  await click(x, y);
  await page.waitForTimeout(100);
  const n = await page.evaluate(() => window.game.world.objects.filter((o) => o.type === 'lantern').length);
  console.log('lanterns placed', n);
  await page.keyboard.press('Digit1');
  const lp = await page.evaluate(() => { const g = window.game, o = g.world.objects.find((o) => o.type === 'lantern'); return [o.x * 8 + 4 - g.cam.x, o.y * 8 + 4 - g.cam.y]; });
  await page.mouse.move(...at(lp[0], lp[1])); await page.mouse.down();
  const [x2, y2] = toScreen(dec.r[0] + 3, dec.r[1] + 2, dec.cam);
  await page.mouse.move(...at(x2, y2), { steps: 8 });
  await shot('09b_drag_lantern');
  await page.mouse.up();
  const where = await page.evaluate(() => window.game.world.objects.filter((o) => o.type === 'lantern').map((o) => [o.x, o.y]));
  console.log('lantern now at', JSON.stringify(where), 'room x', dec.r[0]);
}
{
  const f = await page.evaluate(() => { const g = window.game, f = g.folk[1]; return [f.x - g.cam.x, f.y - 6 - g.cam.y, f.x]; });
  await page.mouse.move(...at(f[0], f[1])); await page.mouse.down();
  await page.mouse.move(...at(f[0] + 20, f[1] - 30), { steps: 8 });
  const held = await page.evaluate(() => window.game.folk[1].held);
  await shot('09c_carry_folk');
  await page.mouse.up();
  await page.evaluate(() => { window.game.speed = 1; });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => { const f = window.game.folk[1]; return { held: f.held, x: f.x, y: f.y, standable: window.game.world.footing(f.cx, f.cy) }; });
  console.log('carried', held, JSON.stringify(after));
}
// a shaft dug straight down gets ladders, and the digger can climb back out
const shaftOk = await page.evaluate(() => {
  const g = window.game, w = g.world, r = w.rooms[1];
  const x = r.x + r.w + 3, top = r.y + r.h - 1; // in the tunnel right of the bedroom
  for (let y = top + 1; y <= top + 6; y++) g.digDone(x, y, null);
  let ladders = 0; for (let y = top + 1; y <= top + 6; y++) if (w.ladder[w.idx(x, y)]) ladders++;
  const f = g.folk[0];
  return { ladders, canClimb: !!(f && w.standable(x, top + 6) && w.standable(x, top + 5)) };
});
console.log('shaft', JSON.stringify(shaftOk));
// save & reload
await page.evaluate(() => window.game.save());
const saved = await page.evaluate(() => (localStorage.getItem('hearthburrow-save-v1') || '').length);
console.log('save bytes', saved);
await page.reload();
await page.waitForFunction('window.game', null, { timeout: 30000 });
const reloaded = await page.evaluate(() => ({ hasSave: window.game.hasSave, folk: window.game.folk.length, rooms: window.game.world.rooms.length }));
console.log('reloaded', JSON.stringify(reloaded));
await shot('10_reload_title');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
if (errors.length) process.exit(1);
