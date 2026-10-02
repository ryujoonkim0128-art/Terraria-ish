// Fast-forwards several in-game days while the player wanders, to catch runtime errors.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')); }
const server = http.createServer((req, rs) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); rs.end(p === '/index.html' ? '<!doctype html><html><head></head><body>' + d + '</body></html>' : d); }); }).listen(0);
await new Promise((r) => server.on('listening', r));
const browser = await chromium.launch();
const errors = [];
for (const seed of [1, 77, 31337]) {
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  page.on('pageerror', (e) => errors.push(seed + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(seed + ': ' + m.text()); });
  await page.goto(`http://localhost:${server.address().port}/#${seed}`);
  await page.waitForFunction('window.game && window.game.npcs');
  await page.evaluate(() => { const g = window.game; g.mode = 'play'; UI.title(false); UI.hud(true); g.hp = 1e9; g.coins = 999; });
  await page.keyboard.down('t');
  const keys = ['a', 'd', 'w', 's', ' ', 'e'];
  for (let i = 0; i < 60; i++) {
    const k = keys[i % keys.length];
    await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k);
    if (i % 10 === 0) await page.evaluate(() => { const g = window.game; if (UI.dialogOpen) UI.close(); advanceHours(7); const n = g.npcs[Math.floor(Math.random() * g.npcs.length)]; const p = g.player; p.x = n.x; p.y = n.y; p.airTop = p.y; snapCam(); });
  }
  await page.keyboard.up('t');
  const st = await page.evaluate(() => { const g = window.game; return { day: g.day, time: g.time.toFixed(1), fps: Math.round(g.fps), parts: g.parts.length, jobs: g.jobs.length, offers: g.npcs.filter((n) => n.offer).length }; });
  console.log(seed, JSON.stringify(st));
  await page.close();
}
console.log(errors.length ? errors.slice(0, 10).join('\n') : 'no errors');
await browser.close(); server.close();
