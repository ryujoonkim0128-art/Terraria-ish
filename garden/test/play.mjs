// Plays a fresh game on an emulated iPhone through real input (taps, the joystick, the Collect
// button, the teleport buttons) and checks each step, saving screenshots along the way.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push('pageerror: ' + e.message); console.log('PAGEERROR', e.message, String(e.stack || '').slice(0, 300)); });
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push('console: ' + m.text()); });
const cache = '/tmp/claude-0/fontcache'; fs.mkdirSync(cache, { recursive: true });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
  const url = r.request().url(), f = cache + '/' + Buffer.from(url).toString('base64url').slice(-120);
  try { if (!fs.existsSync(f)) execSync(`curl -sS -A "Mozilla/5.0 Chrome/120" -o ${JSON.stringify(f)} ${JSON.stringify(url)}`); r.fulfill({ path: f, contentType: url.includes('css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); } catch { r.abort(); }
});
await page.goto(`http://localhost:${server.address().port}/index.html`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction('window.game && document.querySelector("#title button")', null, { timeout: 30000 });
const G = (fn, a) => page.evaluate(fn, a);
const scr = (x, z, y = 2) => G(([x, y, z]) => window.game.World.project(x, y, z), [x, y, z]);
const tapAt = async (p) => { await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); };
const grow = (sec) => G((s) => { for (let i = 0; i < s * 4; i++) window.game.sim(0.25); }, sec);
const tick = () => G(() => window.game.UI.update(0.05));
const player = () => G(() => { const p = window.game.World.W.player; return { x: p.x, z: p.z }; });
let failed = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== '' ? '  ' + JSON.stringify(info) : '')); if (!ok) failed++; };
const shot = async (n, wait = 400) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/play_${n}.png` }); };

// walk with the on-screen joystick: keep pushing the thumb toward the target until we arrive
const STICK = { x: 90, y: 470 };
async function walkTo(tx, tz, stop = 3, maxSteps = 60) {
  await page.mouse.move(STICK.x, STICK.y); await page.mouse.down();
  let p = await player();
  for (let i = 0; i < maxSteps && Math.hypot(tx - p.x, tz - p.z) > stop; i++) {
    const a = await scr(p.x, p.z), b = await scr(tx, tz);
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    await page.mouse.move(STICK.x + (dx / l) * 50, STICK.y + (dy / l) * 50, { steps: 2 });
    await page.waitForTimeout(120);
    p = await player();
  }
  await page.mouse.up();
  await page.waitForTimeout(150);
  return p;
}

await page.click('#title button', { force: true });
await page.waitForFunction(() => !document.querySelector('#goal').hidden && !document.querySelector('#hand').hidden, null, { timeout: 8000 }).catch(() => {});
let s = await G(() => ({ goal: document.querySelector('#goal .txt').textContent, n: document.querySelector('#goal .n').textContent, money: window.game.G.money, seeds: Object.keys(window.game.G.seeds).length, hand: !document.querySelector('#hand').hidden, tp: document.querySelectorAll('#tp .tp').length }));
check('a fresh start: $20, no seeds, and the first goal is buying two carrots', s.goal === 'Buy seeds' && s.n === '0/2' && s.money === 20 && s.seeds === 0 && s.hand && s.tp === 3, s);
await shot('1_start');

// ---- the first carrots come from the shop
await page.click('[data-tp="seeds"]');
await page.waitForTimeout(900);
s = await G(() => ({ open: document.querySelector('#sheet').classList.contains('open'), h: document.querySelector('#sheet h2').textContent, near: window.game.World.nearShop(14) }));
check('Seeds teleport goes to the stand and opens the shop', s.open && s.h === 'Seeds' && s.near === 'seeds', s);
await page.click('[data-id="buy-carrot"]'); await page.click('[data-id="buy-carrot"]');
await tick();
s = await G(() => ({ seeds: window.game.G.seeds, money: window.game.G.money, tut: window.game.G.tut }));
check('two carrots cost the whole $20, and the tutorial says go home', s.seeds.carrot === 2 && s.money === 0 && s.tut === 1, s);
await shot('2_bought');
await page.click('[data-tp="garden"]');
await page.waitForTimeout(700);
await tick();
s = await G(() => ({ tut: window.game.G.tut, open: document.querySelector('#sheet').classList.contains('open'), d: window.game.World.distTo(window.game.World.HOME.x, window.game.World.HOME.z) }));
check('Garden teleport goes home and the tutorial says plant', s.tut === 2 && !s.open && s.d < 2, s);

// ---- plant: tap the soil
await tapAt(await scr(6, 25));
s = await G(() => ({ n: window.game.G.plants.length, seeds: window.game.G.seeds.carrot }));
check('tap the soil plants a seed', s.n === 1 && s.seeds === 1, s);
await tapAt(await scr(6.5, 25.3));
check('too close to another plant is refused', (await G(() => window.game.G.plants.length)) === 1);
await tapAt(await scr(-9, 46, 1));
check('grass outside the garden is refused', (await G(() => window.game.G.plants.length)) === 1);
await tapAt(await scr(11, 23));
await tick();
s = await G(() => ({ n: window.game.G.plants.length, tut: window.game.G.tut, sel: window.game.G.sel }));
check('both carrots planted, tutorial moves on, hand empties', s.n === 2 && s.tut === 3 && s.sel === null, s);
await shot('3_growing');
await grow(10); await tick();
s = await G(() => ({ ripe: window.game.G.plants.filter((p) => p.fr[0].p >= 1).length, tut: window.game.G.tut }));
check('tutorial carrots grow in seconds', s.ripe === 2 && s.tut === 4, s);
await shot('4_collect_goal', 900);
s = await G(() => ({ hand: document.querySelector('#hand').className, act: document.querySelector('#act').hidden }));
check('far from the crops the hand teaches the joystick', s.hand === 'drag' && s.act, s);

// ---- walk over with the joystick
const p0 = await player();
const p1 = await walkTo(10, 22, 3);
check('joystick walks the farmer to the crops', Math.hypot(p1.x - 10, p1.z - 22) <= 3.5 && Math.hypot(p1.x - p0.x, p1.z - p0.z) > 10, { p0, p1 });
await tick();
s = await G(() => ({ act: !document.querySelector('#act').hidden, prompt: !document.querySelector('#prompt').hidden, lbl: document.querySelector('#act .lbl').textContent, sub: document.querySelector('#prompt small').textContent }));
check('Collect button and prompt pop up next to ripe crops', s.act && s.prompt && s.lbl === 'Collect' && /Carrot/.test(s.sub), s);
await shot('5_near_crops');
await page.click('#act');
s = await G(() => window.game.G.bag.length);
check('tap Collect picks one carrot', s === 1, s);
// hold Collect to grab everything in reach
const ab = await page.locator('#act').boundingBox();
await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2); await page.mouse.down();
for (let i = 0; i < 40 && (await G(() => window.game.G.bag.length)) < 2; i++) await page.waitForTimeout(150);
await page.mouse.up();
await tick();
s = await G(() => ({ bag: window.game.G.bag.length, plants: window.game.G.plants.length, tut: window.game.G.tut, badge: document.querySelector('#bagN').textContent }));
check('holding Collect grabs the rest, Sell badge counts them', s.bag === 2 && s.plants === 0 && s.tut === 5 && s.badge === '2', s);

// ---- sell them, and that pays for a Strawberry
await page.click('[data-tp="sell"]');
await page.waitForTimeout(900);
s = await G(() => ({ open: document.querySelector('#sheet').classList.contains('open'), h: document.querySelector('#sheet h2').textContent, near: window.game.World.nearShop(14) }));
check('Sell teleport goes to the stand and opens the sheet', s.open && s.h === 'Sell' && s.near === 'sell', s);
await shot('6_sell_sheet');
await page.click('#sellAll');
await tick();
s = await G(() => ({ money: window.game.G.money, bag: window.game.G.bag.length, tut: window.game.G.tut }));
check('two carrots sell for enough to buy a Strawberry', s.money >= 25 && s.bag === 0 && s.tut === 6, s);
await page.click('[data-tp="seeds"]');
await page.waitForTimeout(900);
await shot('7_seed_sheet');
await page.click('[data-id="buy-strawberry"]');
await tick();
s = await G(() => ({ tut: window.game.G.tut, seeds: window.game.G.seeds, sel: window.game.G.sel }));
check('buying a Strawberry moves the tutorial to "go home"', s.tut === 7 && s.seeds.strawberry === 1 && s.sel === 'seed:strawberry', s);
await page.click('[data-tp="garden"]');
await page.waitForTimeout(700);
await tick();
await G(() => { for (let i = 0; i < 4; i++) window.game.UI.update(0.5); });
s = await G(() => ({ tut: window.game.G.tut, goal: document.querySelector('#goal').hidden, hand: document.querySelector('#hand').hidden }));
check('going home finishes the tutorial and its chip and hand go away', s.tut === 8 && s.goal && s.hand, s);
await shot('8_home', 200);

// ---- your first Strawberry fruits again and again
await tapAt(await scr(-10, 18));
s = await G(() => window.game.G.plants.length);
check('the Strawberry is planted from the hotbar', s === 1, s);
await G(() => window.game.World.teleport({ x: -10, z: 27 }));
await grow(40); await tick(); await page.waitForTimeout(300);
const fr = await G(() => { const pl = window.game.G.plants.find((p) => p._fw && p._fw.some((f) => f && f.ripe)); const k = pl._fw.findIndex((f) => f && f.ripe), f = pl._fw[k]; return window.game.World.project(f.x, f.y - 1, f.z); });
await tapAt(fr);
s = await G(() => window.game.G.bag.length);
check('tapping a ripe fruit picks it', s === 1, s);
await G(() => { window.game.G.bag = []; window.game.World.teleport(window.game.World.HOME); });

// ---- walk to a shop and use the proximity prompt
await G(() => window.game.World.teleport({ x: -14, z: -50 }));
await page.waitForTimeout(300);
const p2 = await walkTo(-14, -60, 4);
await tick();
s = await G(() => ({ act: !document.querySelector('#act').hidden, lbl: document.querySelector('#act .lbl').textContent }));
check('walking up to the seed stand shows a Shop button', s.act && s.lbl === 'Shop', { ...s, p2 });
await page.click('#act');
await page.waitForTimeout(400);
s = await G(() => ({ open: document.querySelector('#sheet').classList.contains('open'), h: document.querySelector('#sheet h2').textContent }));
check('the Shop button opens the seed shop', s.open && s.h === 'Seeds', s);
await page.click('#sheet .x');
await page.waitForTimeout(350);
// stalls block the way
await G(() => window.game.World.teleport({ x: 14, z: -60 }));
await walkTo(14, -80, 1, 25);
s = await player();
check('you cannot walk through the sell stand', s.z > -69, s);
await G(() => window.game.World.teleport(window.game.World.HOME));

// ---- keyboard and camera
const k0 = await player();
await page.keyboard.down('w');
for (let i = 0; i < 30 && (await player()).z > k0.z - 3; i++) await page.waitForTimeout(150);
await page.keyboard.up('w');
const k1 = await player();
check('W walks forward on a keyboard', k1.z < k0.z - 2 && Math.abs(k1.x - k0.x) < 0.5, { k0, k1 });
const yaw0 = await G(() => window.game.World.camYaw());
await page.mouse.move(320, 300); await page.mouse.down(); await page.mouse.move(250, 300, { steps: 6 }); await page.mouse.up();
const yaw1 = await G(() => window.game.World.camYaw());
check('dragging the right side turns the camera', Math.abs(yaw1 - yaw0) > 0.3, { yaw0, yaw1 });
// the island ends in a cliff: walk toward the edge and you stop short of it
await G(() => window.game.World.teleport({ x: 0, z: 46 }));
await page.keyboard.down('s');
for (let i = 0; i < 25; i++) await page.waitForTimeout(150);
await page.keyboard.up('s');
s = await G(() => { const p = window.game.World.W.player; return { x: p.x, y: p.y, z: p.z }; });
check("you can't walk off the edge of the island", s.z > 47 && s.z < 60 && s.y > 0.9, s);
await G(() => window.game.World.teleport(window.game.World.HOME));

// ---- shovel
await page.click('#hotbar [data-id="shovel"]');
await tapAt(await scr(-10, 18, 3));
check('shovel digs a cheap plant', (await G(() => window.game.G.plants.length)) === 0);

// ---- Market Day: a chip counts down, the carts sell rare seeds at a discount, one crop sells for triple
await G(() => { window.game.G.mkt.next = 0.05; window.game.sim(0.1); window.game.UI.update(0.05); });
s = await G(() => ({ chip: !document.querySelector('#event').hidden, t: document.querySelector('#event .t').textContent, hot: window.game.G.mkt.hot, wares: Object.keys(window.game.G.mkt.wares || {}) }));
check('Market Day opens with a chip and two carts of seeds', s.chip && s.t === 'Market Day' && !!s.hot && s.wares.join() === 'veg,berry', s);
await page.click('#event');
await page.waitForTimeout(900);
s = await G(() => ({ open: document.querySelector('#sheet').classList.contains('open'), h: document.querySelector('#sheet h2').textContent }));
check('the chip teleports to a cart and opens it', s.open && s.h === 'Veggie Cart', s);
await shot('9_market_cart');
const ware = await G(() => { const w = window.game.G.mkt.wares.veg[0]; window.game.G.money = w.price + 5; window.game.UI.update(0.05); return { id: w.id, n: w.n, had: window.game.G.seeds[w.id] || 0 }; });
await page.click('#sheet .list .row:not(.x) button.buy');
s = await G((id) => ({ seeds: window.game.G.seeds[id] || 0, n: window.game.G.mkt.wares.veg[0].n, money: window.game.G.money }), ware.id);
check('buying from a cart costs a quarter less and hands over the seed', s.seeds === ware.had + 1 && s.n === ware.n - 1 && s.money === 5, { ware, s });
await page.click('#sheet .x'); await page.waitForTimeout(350);
await G(() => { const g = window.game.G; g.bag.push({ c: g.mkt.hot, kg: 0.3, m: [], v: 10, big: false }); });
await page.click('[data-tp="sell"]');
await page.waitForTimeout(900);
s = await G(() => ({ tag: !!document.querySelector('#sheet .x3'), m0: window.game.G.money }));
await page.click('#sellAll');
s.gain = (await G(() => window.game.G.money)) - s.m0;
check("the crop of the day sells for triple", s.tag && s.gain === 30, s);
await page.click('#sheet .x'); await page.waitForTimeout(350);
await G(() => { window.game.G.mkt.left = 0.05; window.game.sim(0.1); window.game.UI.update(0.05); });
s = await G(() => ({ chip: document.querySelector('#event').hidden, open: window.game.G.mkt.left > 0, next: window.game.G.mkt.next }));
check('the market packs up and the next one is scheduled', s.chip && !s.open && s.next > 600, s);
await G(() => window.game.World.teleport(window.game.World.HOME));

// ---- rain mutations
await G(() => { window.game.G.seeds.strawberry = 1; window.game.G.sel = 'seed:strawberry'; });
await tapAt(await scr(-4, 22));
await grow(80);
await G(() => { window.game.G.weather = { type: 'rain', left: 300 }; });
await grow(90);
s = await G(() => window.game.G.plants[0].fr.filter((f) => f && f.m.includes('wet')).length);
check('rain makes fruit wet', s > 0, s);
await shot('10_rain', 2500);

await G(() => window.game.save());
await page.reload();
await page.waitForFunction('window.game && document.querySelector("#title button")');
s = await G(() => ({ tut: window.game.G.tut, plants: window.game.G.plants.length }));
check('save survives a reload', s.tut === 8 && s.plants === 1, s);
check('no errors', errors.length === 0, errors);
await browser.close(); server.close();
console.log(failed ? `${failed} failed` : 'all checks passed');
process.exit(failed ? 1 : 0);
