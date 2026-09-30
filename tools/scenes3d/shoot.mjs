// Serve this folder, render each scene in headless Chromium, save PNGs.
//   node shoot.mjs [versions...]   e.g. node shoot.mjs 1 3
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../mockups/villages3d');
fs.mkdirSync(out, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(here, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(0);
const port = server.address().port;
const names = { 1: '1_underground', 2: '2_village_golden_hour', 3: '3_village_blue_dusk', 4: '4_hillside_wolf_cave' };
const versions = process.argv.slice(2).length ? process.argv.slice(2) : ['1', '2', '3', '4'];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
for (const v of versions) {
  await page.goto(`http://localhost:${port}/render.html?v=${v}&scale=3`);
  await page.waitForFunction('window.ready === true', null, { timeout: 120000 });
  const url = await page.evaluate('window.shot()');
  const file = path.join(out, `${names[v]}.png`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', file);
}
await browser.close();
server.close();
