// Wolves vs guards, theft, hostility.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1320, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(`http://localhost:${server.address().port}/index.html#12345`);
await page.waitForFunction('window.game');
const box = await page.locator('#stage').boundingBox();
await page.mouse.click(box.x + 300, box.y + 200);
const ev = (f, a) => page.evaluate(f, a);
const check = (l, c) => console.log((c ? 'PASS ' : 'FAIL ') + l);
// a wolf walks into Rookley at dusk
const g0 = await ev(async () => {
  const g = window.game, v = g.world.villages[0];
  const guard = g.villagers.find((x) => x.v === v && x.role === 'guard');
  g.time = 0.5;
  const { Wolf } = await import('./src/ai.js');
  const wf = new Wolf(g, guard.x + 60, guard.y - 4, null, Math.random);
  g.wolves.push(wf);
  const p = g.player; p.x = guard.x - 80; p.y = guard.y - 8; g.camSnap = true;
  return { guard: guard.name };
});
await page.waitForTimeout(2500);
const r1 = await ev(([n]) => { const g = window.game; const gd = g.villagers.find((x) => x.name === n); return { mode: gd?.alarm?.mode, threat: gd?.alarm?.threat?.kind, wolves: g.wolves.filter((w) => w.hunter).map((w) => w.hp) }; }, [g0.guard]);
console.log(JSON.stringify(r1));
check('guard fights the wolf', r1.mode === 'fight' && r1.threat === 'wolf');
await page.waitForTimeout(8000);
const r2 = await ev(([n]) => { const g = window.game; const gd = g.villagers.find((x) => x.name === n); const w = g.wolves.find((w) => w.hunter); return { wolfHp: w ? w.hp : 'dead', guardHp: gd?.hp, d: w && gd ? Math.round(Math.hypot(w.cx - gd.cx, w.cy - gd.cy)) : null }; }, [g0.guard]);
console.log(JSON.stringify(r2));
check('the guard hurt the wolf', r2.wolfHp === 'dead' || r2.wolfHp < 16);
// theft in plain sight
const r3 = await ev(() => {
  const g = window.game, v = g.world.villages[0];
  g.wolves = g.wolves.filter((w) => !w.hunter);
  for (const x of g.villagers) { x.alarm = null; x.act = null; }
  v.grudge = 0;
  const vl = g.villagers.find((x) => x.v === v && !x.sleeping && x.role !== 'guard');
  const o = g.world.objects.find((o) => o.alive && o.owner === v.id && Math.abs(o.x * 8 - vl.cx) < 60 && o.type !== 'lantern');
  const p = g.player; p.x = o.x * 8; p.y = (o.y + o.h) * 8 - p.h;
  g.breakObject(o);
  return { grudge: v.grudge, obj: o.type };
});
console.log(JSON.stringify(r3));
check('theft was noticed', r3.grudge >= 2);
// long grudge: guards attack on sight
await ev(() => { const g = window.game; g.world.villages[0].grudge = 8; });
await page.waitForTimeout(1500);
console.log(await ev(() => { const g = window.game, p = g.player; return JSON.stringify(g.villagers.filter((x) => x.v === g.world.villages[0] && x.role === 'guard').map((x) => ({ d: Math.round(Math.hypot(x.cx - p.cx, x.cy - p.cy) / 8), sl: x.sleeping, al: x.alarm?.mode, th: x.alarm?.threat?.kind, dead: x.dead }))); }));
const r4 = await ev(() => { const g = window.game; return g.villagers.filter((x) => x.v === g.world.villages[0] && x.role === 'guard' && x.alarm?.mode === 'fight' && x.alarm.threat === g.player).length; });
check(`hostile village sends guards (${r4})`, r4 > 0);
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close(); server.close();
