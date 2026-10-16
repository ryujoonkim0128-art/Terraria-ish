// Screenshot helper: node test/look.mjs out.png [js to run after start] [wait ms]
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
const [out = 'test/shots/look.png', js = '', wait = '1500'] = process.argv.slice(2);
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message + '\n' + e.stack)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const cache = '/tmp/claude-0/fontcache'; fs.mkdirSync(cache, { recursive: true });
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
  const url = r.request().url(), f = cache + '/' + Buffer.from(url).toString('base64url').slice(-120);
  try { if (!fs.existsSync(f)) execSync(`curl -sS -A "Mozilla/5.0 Chrome/120" -o ${JSON.stringify(f)} ${JSON.stringify(url)}`); r.fulfill({ path: f, contentType: url.includes('css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } }); } catch { r.abort(); }
});
await p.goto(`http://localhost:${server.address().port}/index.html`);
await p.waitForFunction('window.game', null, { timeout: 30000 }).catch(() => {});
await p.waitForTimeout(800);
if (js) { await p.evaluate(js).catch((e) => errs.push('eval: ' + e.message)); }
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
console.log(errs.join('\n') || 'ok');
await browser.close(); server.close();
