// Usage: node test/shoot.mjs <page> <out.png> [w h]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [page = 'test/sheet.html', out = 'test/shots/sheet.png', w = '1600', h = '1200'] = process.argv.slice(2);
const server = await serve();
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(`http://localhost:${server.address().port}/${page}`);
await p.waitForFunction('window.done', null, { timeout: 10000 }).catch(() => {});
await p.screenshot({ path: out });
console.log(errs.join('\n') || 'ok');
await browser.close(); server.close();
