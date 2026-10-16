// Plays a fresh game on an emulated phone through real taps and checks the results.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction('window.game && window.game.L.W', null, { timeout: 15000 });

let box, L, k;
const measure = async () => { box = await page.locator('#view').boundingBox(); L = await page.evaluate(() => window.game.L); k = box.width / L.W; };
await measure();
const at = (x, y) => [box.x + x * k, box.y + y * k];
const tap = async (x, y) => { await page.mouse.click(...at(x, y)); await page.waitForTimeout(80); };
const G = (fn, a) => page.evaluate(fn, a);
const frames = (n = 3) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const tile = (i) => [L.gx + (i % 7) * 24 + 12, L.gy + Math.floor(i / 7) * 24 + 12];
const press = async (id) => {
  await frames(2);
  const h = await G((id) => { const h = window.game.UI.hits.find((h) => h.id === id); return h && { x: h.x + h.w / 2, y: h.y + h.h / 2 }; }, id);
  if (!h) throw new Error('no button ' + id);
  await tap(h.x, h.y);
  await frames(2);
};
const grow = (sec) => G((s) => { for (let i = 0; i < s * 4; i++) window.game.update(0.25); }, sec);
let failed = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? '  ' + JSON.stringify(info) : '')); if (!ok) failed++; };
const shot = (n) => page.screenshot({ path: `${out}/play_${n}.png` });

check('title shows first', await G(() => window.game.UI.title));
await tap(L.W / 2, L.H / 2);
check('title dismissed', !(await G(() => window.game.UI.title)));

await tap(...tile(0));
let s = await G(() => ({ planted: window.game.G.plots.filter(Boolean).length, seeds: window.game.G.seeds.carrot }));
check('tap plants a carrot', s.planted === 1 && s.seeds === 4, s);

await page.mouse.move(...at(...tile(1)));
await page.mouse.down();
for (let i = 1; i <= 6; i++) await page.mouse.move(...at(...tile(i)), { steps: 3 });
await page.mouse.up();
s = await G(() => ({ planted: window.game.G.plots.filter(Boolean).length, seeds: window.game.G.seeds.carrot || 0, sel: window.game.G.sel }));
check('drag plants the rest', s.planted === 5 && s.seeds === 0 && s.sel === null, s);

await grow(30);
s = await G(() => window.game.G.plots.filter((p) => p && p.fr[0].p >= 1).length);
check('carrots ripen in ~25s', s === 5, s);
await shot('ripe');

await tap(...tile(0));
s = await G(() => window.game.G.bag.length);
check('tap harvests', s === 1, s);
await press('hall');
s = await G(() => ({ bag: window.game.G.bag.length, plots: window.game.G.plots.filter(Boolean).length }));
check('harvest all', s.bag === 5 && s.plots === 0, s);

await tap(L.stalls.sell.x + 22, L.stalls.sell.y + 32);
await page.waitForTimeout(400);
check('sell stand opens', (await G(() => window.game.UI.panel?.kind)) === 'sell');
await shot('sell');
const before = await G(() => window.game.G.money);
await press('sellall');
s = await G(() => ({ money: window.game.G.money, bag: window.game.G.bag.length }));
check('sell all pays out', s.money > before + 50 && s.bag === 0, s);
await press('close');
await page.waitForTimeout(400);
check('panel closes', (await G(() => window.game.UI.panel)) === null);

await tap(L.stalls.seeds.x + 22, L.stalls.seeds.y + 32);
await page.waitForTimeout(400);
check('seed shop opens', (await G(() => window.game.UI.panel?.kind)) === 'seeds');
const m0 = await G(() => window.game.G.money);
await press('seedcarrot');
s = await G(() => ({ money: window.game.G.money, seeds: window.game.G.seeds.carrot, sel: window.game.G.sel }));
check('buy a carrot seed', s.seeds === 1 && s.money === m0 - 10 && s.sel === 'seed:carrot', s);
// hold to buy several
const hb = await G(() => { const h = window.game.UI.hits.find((h) => h.id === 'seedcarrot'); return { x: h.x + h.w / 2, y: h.y + h.h / 2 }; });
await page.mouse.move(...at(hb.x, hb.y));
await page.mouse.down();
await page.waitForTimeout(900);
await page.mouse.up();
s = await G(() => window.game.G.seeds.carrot);
check('hold to buy repeats', s >= 3, s);
await shot('seeds');
await press('close');
await page.waitForTimeout(400);

// expansion via the sign
await G(() => { window.game.G.money += 1000; });
await frames(3);
await measure();
const sign = L.expandSign;
await tap(sign.x + sign.w / 2, sign.y + 8);
check('expand asks first', !!(await G(() => window.game.UI.confirm)));
await press('cyes');
s = await G(() => window.game.G.rows);
check('garden expands', s === 4, s);

// sprinkler + watering can from the gear shop
await G(() => { window.game.G.money += 10000; });
await tap(L.stalls.gear.x + 22, L.stalls.gear.y + 32);
await page.waitForTimeout(400);
await press('gearcan');
await press('gearsprinkler');
s = await G(() => ({ cans: window.game.G.cans, spr: window.game.G.spr.sprinkler }));
check('buy gear', s.cans === 10 && s.spr === 1, s);
await press('close');
await page.waitForTimeout(400);
await G(() => { window.game.G.sel = 'seed:carrot'; });
await tap(...tile(8));
await G(() => { window.game.G.sel = 'spr:sprinkler'; });
await tap(...tile(9));
await G(() => { window.game.G.sel = 'can'; });
await tap(...tile(8));
s = await G(() => ({ placed: window.game.G.placed.length, w: window.game.G.plots[8]?.w, cans: window.game.G.cans }));
check('place sprinkler and water', s.placed === 1 && s.w > 50 && s.cans === 9, s);
s = await G(() => { const sp = window.game.G.plots[8]; const g0 = sp.g; window.game.update(1); return sp.g - g0; });
check('watered + sprinkler grows 3x', Math.abs(s - 3) < 0.01, s);

// eggs and pets
await G(() => { window.game.G.money += 3000; });
await tap(L.stalls.eggs.x + 22, L.stalls.eggs.y + 32);
await page.waitForTimeout(400);
await press('eggcommon');
check('egg goes to the nest', (await G(() => window.game.G.eggs.length)) === 1);
await grow(31);
s = await G(() => window.game.G.pets.map((p) => p.type));
check('egg hatches a pet', s.length === 1, s);

// shovel: cheap growing plants dig right away (ripe ones get harvested instead)
await G(() => { window.game.G.plots[8] = null; window.game.G.seeds.carrot = 1; window.game.G.sel = 'seed:carrot'; });
await tap(...tile(8));
await G(() => { window.game.G.sel = 'shovel'; });
await tap(...tile(8));
check('shovel digs', (await G(() => window.game.G.plots[8])) === null);

// weather mutations
await G(() => { window.game.G.seeds.strawberry = 1; window.game.G.sel = 'seed:strawberry'; });
await tap(...tile(10));
await grow(80);
await G(() => { window.game.G.weather = { type: 'rain', left: 300 }; });
await grow(120);
s = await G(() => window.game.G.plots[10].fr.filter((f) => f && f.m.includes('wet')).length);
check('rain makes fruit wet', s > 0, s);

// persistence
await G(() => window.game.save());
await page.reload();
await page.waitForFunction('window.game && window.game.L.W', null, { timeout: 15000 });
s = await G(() => ({ rows: window.game.G.rows, pets: window.game.G.pets.length, tut: window.game.G.tut }));
check('save survives reload', s.rows === 4 && s.pets === 1, s);

check('no console errors', errors.length === 0, errors);
await browser.close();
server.close();
console.log(failed ? `${failed} check(s) failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
