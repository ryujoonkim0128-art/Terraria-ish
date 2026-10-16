// Screenshot of mockups/styles.html (CDN and fonts served locally for the headless browser).
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from '../test/serve.mjs';
const [out = 'test/shots/styles.png', width = '1240'] = process.argv.slice(2);
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage({ viewport: { width: +width, height: 900 }, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
const cache = '/tmp/claude-0/fontcache'; fs.mkdirSync(cache, { recursive: true });
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
  const url = r.request().url(), f = cache + '/' + Buffer.from(url).toString('base64url').slice(-120);
  if (!fs.existsSync(f)) execSync(`curl -sS -A "Mozilla/5.0 Chrome/120" -o ${JSON.stringify(f)} ${JSON.stringify(url)}`);
  r.fulfill({ path: f, contentType: url.includes('css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
});
await p.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: 'node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
await p.goto(`http://localhost:${server.address().port}/mockups/styles.html`);
await p.waitForFunction('window.done', null, { timeout: 90000 });
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
console.log(errs.join('\n') || 'ok');
await browser.close(); server.close();
