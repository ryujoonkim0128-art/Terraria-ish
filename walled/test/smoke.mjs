// Headless smoke test: boot, play through the opening, visit places, save screenshots.
// Run: node test/smoke.mjs   (uses the playwright package installed globally or locally)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  const g = execSync('npm root -g').toString().trim();
  ({ chromium } = createRequire(g + '/')('playwright'));
}
const types = { '.js': 'text/javascript', '.html': 'text/html' };
const server = http.createServer((req, rs) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (e, d) => {
    if (e) { rs.writeHead(404); rs.end(); return; }
    let body = d;
    if (p === '/index.html') body = '<!doctype html><html><head></head><body>' + d + '</body></html>';
    rs.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); rs.end(body);
  });
}).listen(0);
await new Promise((r) => server.on('listening', r));
const out = process.env.SHOTS || path.join(root, 'test/shots');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(`http://localhost:${server.address().port}/#${process.env.SEED || 4242}`);
await page.waitForFunction('window.game && window.game.npcs', null, { timeout: 30000 });
await page.waitForTimeout(1200);
const shot = async (n) => { await page.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
await shot('00_title');
await page.keyboard.press('Enter');
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.keyboard.press('e'); }
await page.waitForTimeout(2600); await shot('01_zoom');
await page.waitForTimeout(3200); await shot('02_start');
const info = await page.evaluate(() => { const g = window.game, w = g.world; return { mode: g.mode, blds: w.blds.length, rooms: w.rooms.length, npcs: g.npcs.length, wells: w.wells.length, fps: Math.round(g.fps), offers: g.npcs.filter((n) => n.offer).length }; });
console.log(JSON.stringify(info));
// walk a bit
await page.keyboard.down('d'); await page.waitForTimeout(900); await page.keyboard.up('d');
await shot('03_walk');
const tp = (js) => page.evaluate(js);
const steps = JSON.parse(process.env.STEPS || 'null') || [
  { name: '04_yourroom', js: `(()=>{const g=window.game,r=g.world.yours,p=g.player;p.x=(r.x0+1)*8+4;p.y=(r.y1+1)*8;p.climbing=false;p.airTop=p.y;g.time=21.5;})()` },
  { name: '05_well', js: `(()=>{const g=window.game,w=g.world,wl=w.wells[1]||w.wells[0],p=g.player,br=wl.bridges[0];p.x=(wl.x0+1)*8+4;p.y=br.y*8;p.airTop=p.y;g.time=22;})()` },
  { name: '06_roof_day', js: `(()=>{const g=window.game,w=g.world,b=w.blds[w.coop.b],p=g.player;p.x=w.coop.x+70;p.y=b.roof*8;p.airTop=p.y;g.time=13;g.nextPlane=0.2;})()`, wait: 2600 },
  { name: '07_roof_night', js: `(()=>{const g=window.game;g.time=23;})()`, wait: 900 },
  { name: '08_sewer', js: `(()=>{const g=window.game,w=g.world,p=g.player;p.x=w.sewer.x0*8+200;p.y=(w.sewer.y1+1)*8;p.airTop=p.y;})()` },
  { name: '09_street', js: `(()=>{const g=window.game,w=g.world,p=g.player;p.x=(w.blds[0].x0-9)*8;p.y=w.G*8;p.airTop=p.y;g.time=20.5;})()` },
  { name: '10_map', js: `(()=>{const g=window.game;g.mapZoom=2;})()` },
];
for (const s of steps) { await tp(s.js); await page.waitForTimeout(s.wait ?? 1400); await shot(s.name); }
await tp(`window.game.mapZoom=0`);
const st = await page.evaluate(() => { const g = window.game; return { fps: Math.round(g.fps), hp: g.hp, mode: g.mode, t: g.time.toFixed(2) }; });
console.log(JSON.stringify(st));
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
