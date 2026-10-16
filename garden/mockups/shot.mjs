import fs from 'node:fs';
import { execSync } from 'node:child_process';
// node mockups/shot.mjs sticker,clay out.png
import { chromium } from 'playwright';
import { serve } from '../test/serve.mjs';
const [names = 'sticker', out = 'test/shots/style.png'] = process.argv.slice(2);
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const n = names.split(',').length;
const p = await browser.newPage({ viewport: { width: 20 + n * 370, height: 760 }, ignoreHTTPSErrors: true });
// fetch Google Fonts through curl (which uses the session proxy), cached on disk
const cache = '/tmp/claude-0/fontcache'; fs.mkdirSync(cache, { recursive: true });
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => {
  const url = r.request().url(), f = cache + '/' + Buffer.from(url).toString('base64url').slice(-120);
  if (!fs.existsSync(f)) execSync(`curl -sS -A "Mozilla/5.0 Chrome/120" -o ${JSON.stringify(f)} ${JSON.stringify(url)}`);
  r.fulfill({ path: f, contentType: url.includes('css') ? 'text/css' : 'font/woff2', headers: { 'access-control-allow-origin': '*' } });
});
await p.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ path: 'node_modules/three/build/three.min.js', contentType: 'text/javascript' }));
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://localhost:${server.address().port}/mockups/preview.html?${names}`);
await p.waitForFunction('window.done', null, { timeout: 60000 }).catch((e) => errs.push('timeout'));
await p.waitForTimeout(500);
await p.screenshot({ path: out });
console.log(errs.join('\n') || 'ok');
await browser.close(); server.close();
