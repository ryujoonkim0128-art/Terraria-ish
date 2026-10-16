// Headless phone-sized run: boot, buy seeds, plant, grow, harvest, sell, expand, reload. Saves screenshots to test/shots.
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from './serve.mjs';

const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForFunction('window.game && window.ui', null, { timeout: 20000 });
await page.waitForTimeout(300);
const shot = async (name) => { await page.waitForTimeout(150); await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
// tap at logical canvas coordinates
const tap = (lx, ly) => page.evaluate(([lx, ly]) => { window.ui.render(0); return window.ui.tap(lx, ly); }, [lx, ly]);
const g = (fn) => page.evaluate(fn);

await shot('00_fresh');
let st = await g(() => ({ money: window.game.money, plots: window.game.plots.length, W: window.ui.W, H: window.ui.H, scale: window.ui.scale }));
console.log(JSON.stringify(st));
assert.equal(st.money, 20); assert.equal(st.plots, 20); assert.ok(st.scale >= 2, 'phone should get at least 2x pixels');

// seed shop: carrot always in stock, buy two
await g(() => window.ui.open('seeds'));
await shot('01_seed_shop');
await g(() => { window.game.stock.carrot = 10; window.game.buySeed('carrot'); window.game.buySeed('carrot'); });
st = await g(() => ({ money: window.game.money, seeds: window.game.seeds }));
assert.equal(st.money, 0); assert.equal(st.seeds.carrot, 2);
// the BUY button of the first row is a real hit target
await g(() => { window.game.money = 10; window.ui.scroll = 0; window.ui.render(0); });
const buyHit = await g(() => { const h = window.ui.hits.filter((h) => h.clip).at(0); window.ui.tap(h.x + 2, h.y + 2); return !!h; });
assert.ok(buyHit);
assert.equal(await g(() => window.game.seeds.carrot), 3);
await g(() => window.ui.close());

// tap an empty plot -> plant picker -> plant via tapping the PLANT button
const [gx, gy] = await g(() => window.ui.gridOrigin());
await tap(gx + 5, gy + 5);
await shot('02_plant_picker');
assert.equal(await g(() => window.ui.modal), 'plant');
await g(() => { window.ui.render(0); const h = window.ui.hits.filter((h) => h.clip).at(0); window.ui.tap(h.x + 2, h.y + 2); });
st = await g(() => ({ plot: window.game.plots[0], modal: window.ui.modal }));
assert.equal(st.plot.crop, 'carrot'); assert.equal(st.modal, null);
await g(() => { window.game.plant(1, 'carrot'); window.game.plant(2, 'carrot'); });
await shot('03_planted');

// grow: fast forward through ticks and check it ripens
await g(() => { for (let i = 0; i < 50; i++) window.game.tick(1); window.ui.render(0); });
await shot('04_growing');
await g(() => { window.game.plots[1].growth = 39; window.game.tick(2); window.ui.render(0); });
assert.equal(await g(() => window.game.plots[1].ready), true);
await tap(gx + CELLX(1), gy + 5);
await shot('05_plot_popup_and_ready');
function CELLX(i) { return i * 21 + 5; }
// tapping a growing plot opens the popup, tapping a ready plot harvests
assert.equal(await g(() => window.ui.modal), null);
assert.equal(await g(() => window.game.items.length), 1);
assert.equal(await g(() => window.game.plots[1]), null);
await g(() => { window.game.plots[0].growth = 5; window.game.plots[0].ready = false; });
await tap(gx + 5, gy + 5);
assert.equal(await g(() => window.ui.modal), 'plot');
await shot('06_plot_popup');
await g(() => window.ui.close());

// weather mutations: thunderstorm on a ready crop
await g(() => { window.game.seeds.carrot = 10; window.game.plant(5, 'carrot'); window.game.stock.strawberry = 3; window.game.money = 100; window.game.buySeed('strawberry'); window.game.plant(6, 'strawberry'); window.game.plots[6].growth = 1000; window.game.tick(0.1); });
await g(() => { window.game.startWeather('THUNDER'); for (let i = 0; i < 300; i++) window.game.tick(0.5); });
st = await g(() => ({ muts: window.game.plots[6].muts, weather: window.game.weather }));
console.log('thunder', JSON.stringify(st));
assert.ok(st.muts.includes('Wet') || st.muts.includes('Shocked'), 'expected a weather mutation');
await g(() => { window.game.plots[6].muts = ['Gold', 'Wet']; window.ui.render(0); });
await shot('07_mutated_strawberry');
const got = await g(() => window.game.harvest(6));
assert.ok(got.length >= 2 && got[0].muts.includes('Gold'));
assert.equal(await g(() => window.game.plots[6].ready), false, 'multi-harvest crops regrow');

// sell
await g(() => window.ui.open('sell'));
await shot('08_sell');
const before = await g(() => window.game.money);
const val = await g(() => window.game.inventoryValue());
await g(() => { window.ui.render(0); const h = window.ui.hits.at(-1); window.ui.tap(h.x + 2, h.y + 2); });
st = await g(() => ({ money: window.game.money, items: window.game.items.length, modal: window.ui.modal }));
assert.equal(st.money, before + val); assert.equal(st.items, 0); assert.equal(st.modal, null);
assert.ok(val > 300, 'gold+wet strawberries should be worth a lot: ' + val);

// gear: watering can, sprinkler, expansion
await g(() => { window.game.money = 5000; window.game.buyGear('can'); window.game.buyGear('sprinkler'); window.ui.open('gear'); });
await shot('09_gear');
await g(() => { window.game.placeSprinkler(10); window.game.plant(11, 'carrot'); window.game.water(11); });
st = await g(() => ({ can: window.game.gear.can, g: window.game.plots[11].growth, mult: window.game.growthMult(11) }));
assert.equal(st.can, 9); assert.ok(st.g >= 30 && st.g < 32, "watered growth " + st.g); assert.equal(st.mult, 1.5);
await g(() => { window.game.expand(); window.ui.close(); window.ui.render(0); });
st = await g(() => ({ cols: window.game.cols, rows: window.game.rows, n: window.game.plots.length, p0: window.game.plots[0]?.crop, sp: window.game.plots[12]?.sprinkler }));
assert.equal(st.cols, 5); assert.equal(st.n, 25); assert.equal(st.p0, 'carrot'); assert.equal(st.sp, true, 'sprinkler moved with the grid');
await shot('10_expanded');

// save + reload keeps the garden and grows offline
await g(() => { window.game.save(); const d = JSON.parse(localStorage.getItem('grow-a-garden-save')); d.savedAt -= 60000; localStorage.setItem('grow-a-garden-save', JSON.stringify(d)); window.game.save = () => {}; /* pagehide would re-stamp savedAt */ });
await page.reload();
await page.waitForFunction('window.game && window.ui', null, { timeout: 20000 });
st = await g(() => ({ n: window.game.plots.length, c: window.game.plots[13], money: window.game.money }));
assert.equal(st.n, 25); assert.ok(st.c.ready, 'carrot should have ripened while away'); assert.ok(st.money > 0);
await shot('11_reloaded');

await browser.close(); server.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('smoke ok');
