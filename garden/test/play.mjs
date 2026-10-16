// Input-driven playthrough: walk to Sam with the keyboard, buy a carrot seed with the mouse, plant it,
// fast-forward, harvest, walk to Steven and sell. Verifies the real input path end to end.
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
await page.waitForFunction('window.game');
await page.waitForTimeout(400);
const stage = page.locator('#stage');
const shot = async (name) => { await page.waitForTimeout(200); await stage.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const rect = await page.evaluate(() => { const r = document.getElementById('hud').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
const toCss = (x, y) => [rect.l + x * rect.w / 480, rect.t + y * rect.h / 270];
const clickNative = async (x, y) => { const [cx, cy] = toCss(x, y); await page.mouse.move(cx, cy); await page.waitForTimeout(50); await page.mouse.click(cx, cy); await page.waitForTimeout(80); };
const pos = () => page.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y, cam: window.game.cam }));
async function walkTo(tx, ty) {
  for (let i = 0; i < 200; i++) {
    const p = await pos();
    const dx = tx - p.x, dy = ty - p.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return true;
    const key = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'KeyD' : 'KeyA') : (dy > 0 ? 'KeyS' : 'KeyW');
    const dist = Math.max(Math.abs(dx), Math.abs(dy));
    await page.keyboard.down(key); await page.waitForTimeout(Math.min(400, Math.max(20, dist / 85 * 1000 - 10))); await page.keyboard.up(key);
    await page.waitForTimeout(30);
  }
  return false;
}
const assert = (c, m) => { if (!c) { errors.push('assert: ' + m); console.log('FAIL', m); } else console.log('ok', m); };

// 1. walk to Sam and open the shop with E
assert(await walkTo(7 * 16 + 8, 7 * 16 + 4), 'walked to Sam');
await page.keyboard.press('KeyE');
await page.waitForTimeout(150);
assert(await page.evaluate(() => window.game.ui.panel) === 'seeds', 'seed shop opened with E');
await shot('p1_shop');
// 2. click Buy on the first row (carrot)
await clickNative(360 + 28, 49 + 6);
const afterBuy = await page.evaluate(() => ({ s: window.game.s.sheckles, inv: window.game.s.inv[0] }));
assert(afterBuy.inv && afterBuy.inv.id === 'carrot' && afterBuy.s === 10, 'bought a carrot seed: ' + JSON.stringify(afterBuy));
await page.keyboard.press('Escape');
// 3. walk into the garden and plant on soil at tile (6,13)
assert(await walkTo(22 * 16, 7 * 16 + 8), 'walked to gate path');
assert(await walkTo(22 * 16, 13 * 16 + 8), 'walked into garden');
assert(await walkTo(7 * 16 + 8, 13 * 16 + 8), 'walked to bed');
await page.keyboard.press('Digit1');
let p = await pos();
await clickNative(6 * 16 + 8 - p.cam.x, 13 * 16 + 8 - p.cam.y);
const planted = await page.evaluate(() => window.game.s.plants.map((q) => [q.crop, q.tx, q.ty]));
assert(planted.length === 1 && planted[0][0] === 'carrot', 'planted carrot via click: ' + JSON.stringify(planted));
await shot('p2_planted');
// 4. fast-forward with T until ripe
await page.keyboard.down('KeyT'); await page.waitForTimeout(5500); await page.keyboard.up('KeyT');
const ripe = await page.evaluate(() => window.game.s.plants[0]?.ripe);
assert(ripe, 'carrot ripened during fast-forward');
await shot('p3_ripe');
// 5. harvest by clicking the plant with an empty hand
await page.keyboard.press('Digit2');
p = await pos();
await clickNative(6 * 16 + 8 - p.cam.x, 13 * 16 + 8 - p.cam.y);
const bag = await page.evaluate(() => window.game.s.backpack.map((f) => f.crop + ' ' + f.w));
assert(bag.length === 1, 'harvested into backpack: ' + JSON.stringify(bag));
// 6. walk to Steven and sell all
assert(await walkTo(22 * 16, 13 * 16 + 8), 'back to centre');
assert(await walkTo(22 * 16, 7 * 16 + 8), 'back to path');
assert(await walkTo(37 * 16 + 8, 7 * 16 + 4), 'walked to Steven');
await page.keyboard.press('KeyE');
await page.waitForTimeout(150);
assert(await page.evaluate(() => window.game.ui.panel) === 'sell', 'sell panel opened');
await shot('p4_sell');
await clickNative(56 + 75, 35 + 7);
const sold = await page.evaluate(() => ({ s: window.game.s.sheckles, bag: window.game.s.backpack.length }));
assert(sold.bag === 0 && sold.s > 10, 'sold the carrot: ' + JSON.stringify(sold));
await page.keyboard.press('Escape');
await shot('p5_done');
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
