// Screenshots of a full garden in several conditions: node test/gallery.mjs [DEVICE="iPhone 13"]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
const out = 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
const cache = '/tmp/claude-0/fontcache'; fs.mkdirSync(cache, { recursive: true });
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
  const url = r.request().url(), f = cache + '/' + Buffer.from(url).toString('base64url').slice(-120);
  try { if (!fs.existsSync(f)) execSync(`curl -sS -A "Mozilla/5.0 Chrome/120" -o ${JSON.stringify(f)} ${JSON.stringify(url)}`); r.fulfill({ path: f, contentType: url.includes('css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); } catch { r.abort(); }
});
// the game saves on pagehide, so start over through the game's own reset
await p.goto(`http://localhost:${server.address().port}/index.html`);
await p.waitForFunction('window.game');
await p.evaluate(() => window.game.State.reset());
await p.reload();
await p.waitForFunction('window.game && document.querySelector("#title button")');
await p.click('#title button', { force: true });
await p.evaluate(() => {
  const { G, State, World, sim } = window.game;
  G.tut = 7; G.money = 1234567;
  const crops = ['apple', 'corn', 'tulip', 'tulip', 'strawberry', 'tomato', 'blueberry', 'carrot', 'carrot', 'carrot', 'pumpkin', 'watermelon', 'coconut', 'dragonfruit', 'mango', 'grape', 'mushroom', 'beanstalk', 'strawberry', 'tomato'];
  const spots = [[-13, -14], [12, -16], [-22, -2], [-20, 2], [-6, -2], [10, -4], [20, 4], [0, 8], [3, 9], [-2, 10], [-13, 12], [12, 14], [-4, -18], [22, -6], [-17, -24], [3, -26], [6, 20], [-8, 21], [15, 21], [-20, 12]];
  crops.forEach((c, i) => { G.seeds[c] = (G.seeds[c] || 0) + 1; State.plant(c, spots[i][0], spots[i][1]); });
  for (let i = 0; i < 700; i++) sim(1);
  G.plants.forEach((pl, i) => pl.fr.forEach((f, k) => { if (f && k === 0 && i % 3 === 0) f.m = [['gold', 'rainbow', 'frozen', 'shocked', 'wet', 'moonlit'][i % 6]]; }));
  G.time = 600 * 0.3; G.weather = { type: 'clear', left: 0 };
  // pull the camera back over the whole garden
  World.teleport({ x: 0, z: 31 });
  Object.assign(World.camState, { dist: 74, pitch: 0.95, lead: 26 });
  World.snapCamera(0);
  document.querySelectorAll('.toast').forEach((t) => t.remove());
});
const shot = async (n, wait = 1500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/g_${n}.png` }); console.log('shot', n); };
await shot('day', 2500);
await p.evaluate(() => { window.game.G.time = 600 * 0.66; });
await shot('sunset', 3000);
await p.evaluate(() => { window.game.G.time = 600 * 0.82; });
await shot('night', 4000);
await p.evaluate(() => { window.game.G.time = 600 * 0.3; window.game.G.weather = { type: 'snow', left: 200 }; });
await shot('snow', 8000);
await p.evaluate(() => { window.game.G.weather = { type: 'storm', left: 200 }; });
await shot('storm', 8000);
console.log(errs.join('\n') || 'no errors');
await browser.close(); server.close();
