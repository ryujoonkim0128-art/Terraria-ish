// Drives the real game through its core loops and checks the state after each.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright')); }
const server = http.createServer((req, rs) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  fs.readFile(path.join(root, p), (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'content-type': p.endsWith('.js') ? 'text/javascript' : 'text/html' }); rs.end(p === '/index.html' ? '<!doctype html><html><head></head><body>' + d + '</body></html>' : d); });
}).listen(0);
await new Promise((r) => server.on('listening', r));
const out = path.join(root, 'test/shots'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
await page.goto(`http://localhost:${server.address().port}/#${process.env.SEED || 4242}`);
await page.waitForFunction('window.game && window.game.npcs');
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { const g = window.game; g.mode = 'play'; UI.title(false); UI.hud(true); UI.tasks(); g.nextPlane = 999; g.nextPower = 999; g.rainTarget = 0.5; });
let fails = 0;
const check = (name, ok, extra = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!ok) fails++; };
const pressE = async (n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press('e'); await page.waitForTimeout(140); } };
const place = (x, y) => ev(([x, y]) => { if (UI.dialogOpen) UI.close(); const p = window.game.player; p.x = x; p.y = y; p.vx = p.vy = 0; p.climbing = false; p.onGround = true; p.airTop = y; snapCam(); }, [x, y]);

// climbing the stair spine
const sp = await ev(() => { const w = window.game.world, b = w.blds[w.yours.b]; return { x: b.sx * 8 + 4, y: w.G * 8, f1: b.fr[1] * 8, f5: b.fr[w.yours.k] * 8 }; });
await place(sp.x, sp.y);
await page.keyboard.down('w'); await page.waitForTimeout(2600); await page.keyboard.up('w');
let st = await ev(() => { const g = window.game, p = g.player; return { y: p.y, climbing: p.climbing, stam: g.stam }; });
check('climb up the stairwell ladder', st.y < sp.f1, JSON.stringify(st));
check('climbing costs breath', st.stam < 95);
// get off at a floor and walk
await page.keyboard.down('d'); await page.waitForTimeout(300); await page.keyboard.up('d');
await page.keyboard.down('s'); await page.waitForTimeout(250); await page.keyboard.up('s');
st = await ev(() => { const p = window.game.player; return { y: p.y, climbing: p.climbing, onGround: p.onGround }; });
console.log('after stepping off', JSON.stringify(st));

// a delivery job
const offer = await ev(() => { const g = window.game; const n = g.npcs.find((m) => m.offer && m.offer.type === 'deliver' && m.offer.stage === 'offered' && m.presence !== 'gone'); n.presence = 'awake'; return { x: n.x, y: n.y, id: n.id, tx: n.offer.target.x, ty: n.offer.target.y, reward: n.offer.reward }; });
await place(offer.x + 4, offer.y); await page.waitForTimeout(200);
await pressE(1); await page.waitForTimeout(800); await page.screenshot({ path: out + '/p1_offer.png' });
await pressE(3);
let jobs = await ev(() => window.game.jobs.map((j) => j.type));
check('accept a delivery', jobs.length === 1 && jobs[0] === 'deliver', JSON.stringify(jobs));
check('carrying the parcel', await ev(() => window.game.player.carry.length === 1));
const coins0 = await ev(() => window.game.coins);
await ev(() => { const g = window.game; g.time = 14; });
await place(offer.tx + 4, offer.ty); await page.waitForTimeout(200);
await pressE(1); await page.waitForTimeout(500); await page.screenshot({ path: out + '/p2_deliver.png' });
await pressE(6);
st = await ev(() => ({ coins: window.game.coins, done: window.game.done, jobs: window.game.jobs.length, lam: window.game.lamStage }));
check('delivery pays', st.coins === coins0 + offer.reward && st.done === 1 && st.jobs === 0, JSON.stringify(st));
check('a clue about Lam', st.lam === 1);

// water: fill, fall, spill
await ev(() => { const g = window.game; const n = g.npcs.find((m) => m.room && m.room.k >= 6 && m.kind === 'adult' && !m.offer); acceptJob(createJob(n, 'water')); });
const pipe = await ev(() => { const o = window.game.world.objs.find((o) => o.kind === 'standpipe'); return { x: o.x + 3, y: o.y }; });
await place(pipe.x, pipe.y); await page.waitForTimeout(200); console.log('pipe focus', await ev(() => { const f = window.game.focus; return JSON.stringify({ k: f && f.kind, o: f && f.o && f.o.kind, n: f && f.n && f.n.name, dlg: UI.dialogOpen }); })); await pressE(1);
check('bucket fills at the standpipe', await ev(() => window.game.player.carry.some((c) => c.icon === 'bucket' && c.full)));
const hp0 = await ev(() => window.game.hp);
await ev(() => { const g = window.game, p = g.player; p.x = (g.world.blds[0].x0 - 3) * 8; p.y = g.world.G * 8 - 100; p.airTop = p.y; p.onGround = false; });
await page.waitForTimeout(1200);
st = await ev(() => ({ fall: window.game.lastFall, carry: JSON.stringify(window.game.player.carry.map((c) => [c.icon, c.full])), hp: window.game.hp, full: window.game.player.carry.some((c) => c.icon === 'bucket' && c.full) }));
check('a long fall hurts', st.hp < hp0 - 10, `hp ${hp0.toFixed(0)} -> ${st.hp.toFixed(0)}`);
check('a long fall spills the water', !st.full, JSON.stringify(st));

// sleep through the night
await ev(() => { const g = window.game; g.time = 22; });
const bed = await ev(() => { const o = window.game.world.objs.find((o) => o.kind === 'bed'); return { x: o.x, y: o.y }; });
await place(bed.x, bed.y); await page.waitForTimeout(200);
await page.screenshot({ path: out + '/p3_room_night.png' });
await pressE(1); await page.waitForTimeout(3600);
st = await ev(() => ({ day: window.game.day, time: window.game.time }));
check('sleep until morning', st.day === 2 && st.time > 6 && st.time < 7, JSON.stringify(st));

// rent comes due
await ev(() => { const g = window.game; g.coins = 3; g.rentDue = 3; g.day = 3; g.time = 5.995; });
await page.waitForTimeout(600);
st = await ev(() => ({ strikes: window.game.strikes, rentDue: window.game.rentDue }));
check('unpaid rent is a strike', st.strikes === 1 && st.rentDue === 6, JSON.stringify(st));

// Lam and the letter
await ev(() => { const g = window.game; g.lamStage = 4; g.time = 17.5; });
const lam = await ev(() => ({ x: window.game.lam.x, y: window.game.lam.y }));
await place(lam.x - 6, lam.y); await page.waitForTimeout(400);
await page.screenshot({ path: out + '/p4_lam.png' });
await pressE(1); await page.waitForTimeout(600); await pressE(12);
for (let i = 0; i < 6; i++) { await page.waitForTimeout(500); await page.keyboard.press('e'); }
await page.waitForTimeout(800);
check('the letter is delivered', await ev(() => window.game.lamDone));
await page.screenshot({ path: out + '/p5_after.png' });

// a power cut and the fuse box
await ev(() => { const g = window.game; g.nextPower = 0; });
await page.waitForTimeout(300);
const fz = await ev(() => { const g = window.game; const bi = Object.keys(g.power).find((k) => g.power[k] === false); const j = g.npcs.find((n) => n.offer && n.offer.type === 'fuse'); if (j) acceptJob(j.offer); const o = g.world.objs.find((o) => o.kind === 'fuse' && o.block === +bi); return { bi, x: o.x + 4, y: o.y }; });
await place(fz.x, fz.y); await page.waitForTimeout(200); console.log('fuse focus', await ev(() => { const f = window.game.focus; return JSON.stringify({ k: f && f.kind, o: f && f.o && f.o.kind, story: UI.storyOpen, dlg: UI.dialogOpen }); })); await pressE(1); await page.waitForTimeout(300);
check('fixing the fuse restores power', await ev((bi) => window.game.power[bi] === true, fz.bi));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
console.log(fails ? `${fails} failed` : 'all passed');
await browser.close(); server.close();
process.exit(fails ? 1 : 0);
