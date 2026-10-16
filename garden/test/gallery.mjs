import { chromium, devices } from 'playwright';
import { serve } from './serve.mjs';
const server = await serve();
const url = `http://localhost:${server.address().port}/index.html`;
const browser = await chromium.launch();
for (const [name, opts] of [['phone', { ...devices['iPhone 13'] }], ['desktop', { viewport: { width: 1320, height: 760 } }]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  await page.goto(url); await page.waitForFunction('window.game && window.ui');
  await page.evaluate(() => {
    const g = window.game; g.cols = 6; g.rows = 7; g.plots = new Array(42).fill(null);
    const ids = Object.keys(g.stock);
    ids.forEach((id, i) => { g.seeds[id] = 3; g.plant(i, id); g.plots[i].growth = 1e9; g.ripenIfDone(i); g.plots[i].muts = []; });
    ids.forEach((id, i) => { g.plant(i + 18, id); g.plots[i + 18].growth = 0.7 * 1000; });
    g.plots[36] = { crop: 'strawberry', growth: 80, ready: true, muts: ['Gold'] };
    g.plots[37] = { crop: 'tomato', growth: 150, ready: true, muts: ['Rainbow'] };
    g.plots[38] = { crop: 'apple', growth: 320, ready: true, muts: ['Frozen'] };
    g.plots[39] = { crop: 'corn', growth: 160, ready: true, muts: ['Shocked'] };
    g.plots[40] = { crop: 'pumpkin', growth: 280, ready: true, muts: ['Chilled'] };
    g.plots[41] = { sprinkler: true, t: 100 };
    g.weather = 'RAIN'; g.weatherT = 45; g.toasts = [];
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test/shots/gallery_${name}.png` });
  await ctx.close();
}
await browser.close(); server.close();
