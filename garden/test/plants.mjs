// Screenshots the crop preview page: node test/plants.mjs [out.png] ["crops=apple,corn&stages=2,3,4,5"] [width] [height]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [out = 'test/shots/plants.png', query = '', w = '1400', h = '900'] = process.argv.slice(2);
fs.mkdirSync('test/shots', { recursive: true });
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await page.goto(`http://localhost:${server.address().port}/test/plants.html?${query}`);
await page.waitForFunction('document.title === "ready"', null, { timeout: 60000 }).catch((e) => errs.push(e.message));
await page.screenshot({ path: out });
console.log(errs.join('\n') || 'ok');
await browser.close(); server.close();
