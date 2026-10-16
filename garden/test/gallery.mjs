// Screenshots of many game states on several screen sizes, for eyeballing the art.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch();
const errors = [];
const CROPS = ['carrot','strawberry','blueberry','tulip','tomato','corn','watermelon','pumpkin','apple','coconut','dragonfruit','mango','grape','mushroom','beanstalk'];

async function open(name, device) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(name + ' console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction('window.game && window.game.L.W', null, { timeout: 15000 });
  const box = await page.locator('#view').boundingBox();
  const L = await page.evaluate(() => window.game.L);
  const k = box.width / L.W;
  return {
    page, L, ctx,
    tap: async (x, y) => { await page.mouse.click(box.x + x * k, box.y + y * k); await page.waitForTimeout(150); },
    run: (fn, arg) => page.evaluate(fn, arg),
    shot: async (n, wait = 300) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${name}_${n}.png` }); console.log('shot', name, n); },
  };
}
const tile = (L, i) => ({ x: L.gx + (i % 7) * 24 + 12, y: L.gy + Math.floor(i / 7) * 24 + 12 });

// --- a mid-game garden on an iPhone 13
{
  const s = await open('mid', { ...devices['iPhone 13'], deviceScaleFactor: 3 });
  await s.tap(s.L.W / 2, s.L.H / 2);
  await s.run((crops) => {
    const g = window.game.G;
    g.tut = 9; g.rows = 5; g.money = 48210; g.cans = 7; g.spr = { sprinkler: 2, super: 1 };
    g.seeds = { carrot: 6, strawberry: 3, blueberry: 2, tomato: 1, corn: 2, apple: 1 };
    window.game.UI.toasts = [];
  }, CROPS);
  await s.run(() => window.game.save());
  const plan = ['strawberry','strawberry','carrot','carrot','carrot','blueberry','tomato','corn','apple','carrot','carrot','strawberry','blueberry','corn'];
  for (let i = 0; i < plan.length; i++) { await s.run((c) => { window.game.G.seeds[c] = (window.game.G.seeds[c] || 0) + 1; window.game.G.sel = 'seed:' + c; }, plan[i]); await s.tap(tile(s.L, i * 2 % 35).x, tile(s.L, i * 2 % 35).y); }
  await s.run(() => { for (let i = 0; i < 90; i++) window.game.update(1); });
  await s.run(() => { window.game.G.sel = 'spr:sprinkler'; });
  await s.tap(tile(s.L, 15).x, tile(s.L, 15).y);
  await s.run(() => { window.game.G.sel = 'can'; });
  await s.tap(tile(s.L, 4).x, tile(s.L, 4).y);
  await s.run(() => { const g = window.game.G; g.pets = [{ type: 'puppy' }, { type: 'kitten' }]; g.eggs = [{ id: 'rare', t: 50 }]; g.sel = 'seed:carrot'; window.game.UI.selT = 2; });
  await s.shot('garden', 1200);
  await s.tap(tile(s.L, 16).x, tile(s.L, 16).y);
  await s.run(() => { window.game.G.sel = null; });
  await s.tap(tile(s.L, 14).x, tile(s.L, 14).y);
  await s.shot('info', 400);
  await s.tap(s.L.W - 10, s.L.hudY + 6);
  await s.shot('settings', 600);
  await s.run(() => { window.game.UI.panel = null; window.game.G.sel = 'shovel'; });
  await s.page.waitForTimeout(100);
  await s.tap(tile(s.L, 16).x, tile(s.L, 16).y);
  await s.shot('confirm', 400);
  await s.run(() => { window.game.UI.confirm = null; window.game.G.time = 600 * 0.66; });
  await s.shot('sunset', 1500);
  await s.run(() => { window.game.G.time = 600 * 0.8; });
  await s.shot('night', 1500);
  await s.run(() => { window.game.G.time = 600 * 0.3; window.game.G.weather = { type: 'storm', left: 60 }; });
  await s.page.waitForTimeout(3000);
  await s.run(() => window.game.G.plots.forEach((p) => p && p.fr.forEach((f) => f && (f.p = 1))));
  await s.page.waitForTimeout(6000);
  await s.shot('storm', 0);
  await s.run(() => { window.game.G.weather = { type: 'clear', left: 0 }; });
  await s.page.waitForTimeout(500);
  await s.tap(s.L.harvestBtn.x + 30, s.L.harvestBtn.y + 8);
  await s.shot('harvest_all', 250);
  await s.tap(s.L.bagBtn.x + 20, s.L.bagBtn.y + 8);
  await s.shot('basket', 700);
  await s.ctx.close();
}
// --- small phone and a desktop window
for (const [name, dev] of [['se', { ...devices['iPhone SE'] }], ['desk', { viewport: { width: 1280, height: 800 } }], ['android', { ...devices['Pixel 7'] }]]) {
  const s = await open(name, dev);
  await s.tap(s.L.W / 2, s.L.H / 2);
  await s.run(() => { const g = window.game.G; g.tut = 9; g.rows = 7; window.game.UI.toasts = []; g.pets = [{ type: 'bee' }, { type: 'dragon' }, { type: 'capybara' }]; });
  for (let i = 0; i < 49; i++) { await s.run((c) => { window.game.G.seeds[c] = 1; window.game.G.sel = 'seed:' + c; }, CROPS[(i * 4) % 15]); await s.tap(tile(s.L, i).x, tile(s.L, i).y); }
  await s.run(() => { for (let i = 0; i < 600; i++) window.game.update(1); window.game.UI.toasts = []; });
  await s.shot('full', 1500);
  await s.ctx.close();
}
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
server.close();
