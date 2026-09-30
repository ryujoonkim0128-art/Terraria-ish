// Drives the real input paths: mine, place, attack a villager, watch the village react, build a home.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1320, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/index.html#12345`);
await page.waitForFunction('window.game');
const stage = page.locator('#stage');
const box = await stage.boundingBox();
const S = box.width / 640;
const shot = async (n) => { await page.waitForTimeout(300); await stage.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const toScreen = (x, y) => page.evaluate(([x, y]) => [x - window.game.cam.x, y - window.game.cam.y], [x, y]);
const click = async (wx, wy, button = 'left', hold = 0) => {
  const [sx, sy] = await toScreen(wx, wy);
  await page.mouse.move(box.x + sx * S, box.y + sy * S);
  await page.mouse.down({ button });
  await page.waitForTimeout(hold);
  await page.mouse.up({ button });
};
const ev = (f, a) => page.evaluate(f, a);
const check = (label, cond) => console.log((cond ? 'PASS ' : 'FAIL ') + label);

await page.mouse.click(box.x + 300, box.y + 200);                       // title card
await page.waitForTimeout(500);
// --- mining: dig the dirt under the player's feet side
const p0 = await ev(() => { const g = window.game, p = g.player; p.x = 700 * 8; p.y = (g.world.surface[700] - 2) * 8; g.camSnap = true; return { tx: p.tx, ty: p.ty }; });
await page.waitForTimeout(600);
const before = await ev(() => window.game.inv.count('dirt'));
const tgt = await ev(([tx]) => { const w = window.game.world; const x = tx + 2; return { x, y: w.surface[x] }; }, [p0.tx]);
await click(tgt.x * 8 + 4, tgt.y * 8 + 4, 'left', 1500);
await page.waitForTimeout(700);
const after = await ev(() => window.game.inv.count('dirt'));
check(`mining gives dirt (${before} -> ${after})`, after > before);
// --- placing: put planks back into the hole
await ev(() => { window.game.inv.sel = 2; });
await click(tgt.x * 8 + 4, tgt.y * 8 + 4, 'right', 60);
await page.waitForTimeout(200);
const placed = await ev(([x, y]) => window.game.world.get(x, y), [tgt.x, tgt.y]);
check(`placing planks (tile ${placed})`, placed === 7);

// --- a day in Rookley, sped up
await ev(() => { const g = window.game, p = g.player; p.x = 790 * 8; p.y = (g.world.surface[790] - 3) * 8; g.camSnap = true; g.time = 0.33; });
await page.waitForTimeout(3500);
await shot('10_workday');
const routine = await ev(() => window.game.villagers.filter((v) => v.v.name === window.game.world.villages[0].name).map((v) => `${v.name}:${v.role}:${v.act?.phase}${v.act?.moving ? '*' : ''}:${v.pose}${v.climbing ? ':ladder' : ''}`));
console.log(routine.join('  '));
// --- hit a villager
const target = await ev(() => {
  const g = window.game, p = g.player;
  const v = g.villagers.filter((v) => v.v === g.world.villages[0] && v.role !== 'guard' && !v.sleeping).sort((a, b) => Math.abs(a.cx - p.cx) - Math.abs(b.cx - p.cx))[0];
  p.x = v.x - 14; p.y = v.y; p.vx = 0; g.camSnap = true; g.inv.sel = 1;
  return { name: v.name, role: v.role };
});
await page.waitForTimeout(500);
for (let i = 0; i < 2; i++) {
  const pos = await ev(([n]) => { const v = window.game.villagers.find((v) => v.name === n); return v ? [v.cx, v.cy] : null; }, [target.name]);
  if (pos) await click(pos[0], pos[1], 'left', 80);
  await page.waitForTimeout(450);
}
await page.waitForTimeout(600);
await shot('11_reaction');
const react = await ev(() => { const g = window.game, v0 = g.world.villages[0]; return { grudge: v0.grudge.toFixed(1), alarms: g.villagers.filter((v) => v.v === v0 && v.alarm).map((v) => v.role + ':' + v.alarm.mode) }; });
console.log(JSON.stringify(react));
check('village reacted', react.alarms.length > 0);
// run away and let them calm down
await ev(() => { const g = window.game, p = g.player; p.x = 690 * 8; p.y = (g.world.surface[690] - 3) * 8; g.camSnap = true; });
await page.waitForTimeout(9000);
const calm = await ev(() => { const g = window.game, v0 = g.world.villages[0]; return { grudge: v0.grudge.toFixed(1), alarms: g.villagers.filter((v) => v.v === v0 && v.alarm).length }; });
console.log('after running off', JSON.stringify(calm));

// --- build a home: box of planks with a back wall, bed, torch, table
const home = await ev(() => {
  const g = window.game, w = g.world, x0 = 672, gy = w.surface[672];
  for (let x = x0; x < x0 + 12; x++) for (let y = gy - 7; y < gy; y++) { w.setTile(x, y, 0); w.setWall(x, y, 0); }
  for (let x = x0; x < x0 + 12; x++) { w.setTile(x, gy, 7); w.setTile(x, gy - 7, 7); }
  for (let y = gy - 7; y <= gy; y++) { w.setTile(x0, y, 9); w.setTile(x0 + 11, y, 9); }
  for (let y = gy - 3; y < gy; y++) w.setTile(x0 + 11, y, 0);                    // doorway
  for (let x = x0 + 1; x < x0 + 11; x++) for (let y = gy - 6; y < gy; y++) w.setWall(x, y, 3);
  w.addObject('torch', x0 + 5, gy - 5, null);
  w.addObject('table', x0 + 6, gy - 2, null);
  const bed = w.addObject('bed', x0 + 1, gy - 2, null);
  g.considerHome(bed, true);
  const p = g.player; p.x = (x0 + 14) * 8; p.y = (gy - 3) * 8; g.camSnap = true;
  return { ok: g.homes.some((h) => h.ok), n: g.villagers.length };
});
check('room counts as a home', home.ok);
await page.keyboard.down('KeyT');
await page.waitForTimeout(2500);
await page.keyboard.up('KeyT');
await page.waitForTimeout(3000);
const moved = await ev(() => window.game.homes.map((h) => h.resident ? `${h.resident.name}:${h.resident.role}` : 'empty'));
console.log('homes', moved.join(','));
check('a settler moved in', moved.some((m) => m !== 'empty'));
await shot('12_home');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
