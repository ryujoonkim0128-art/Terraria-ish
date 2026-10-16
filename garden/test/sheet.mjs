// Renders every plant stage, fruit variant/mutation, pet, icon into one sheet for art review.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';
const out = process.env.SHOTS || 'test/shots';
fs.mkdirSync(out, { recursive: true });
const server = await serve();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:${server.address().port}/index.html#new`);
await page.waitForFunction('window.game');
await page.evaluate(async () => {
  const C = await import('./src/content.js'); const P = await import('./src/plants.js'); const S = await import('./src/sprites.js');
  const cv = document.createElement('canvas'); cv.width = 560; cv.height = 420; cv.id = 'sheet'; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
  cv.style.cssText = 'position:fixed;left:0;top:0;width:1680px;height:1260px;image-rendering:pixelated;z-index:10;background:#7a4f2e';
  document.body.appendChild(cv);
  x.drawImage(S.soilTile(0), 0, 0); const pat = x.createPattern(S.soilTile(0), 'repeat'); x.fillStyle = pat; x.fillRect(0, 0, 560, 420);
  let cx = 4, cy = 6;
  C.CROPS.forEach((c, i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const bx = 8 + col * 110, by = 60 + row * 70;
    for (let s = 0; s < 4; s++) { const sp = P.plantSprite(c.id, s); const px = bx + s * 22 + 8, py = by; x.drawImage(sp.c, px + sp.ox, py + sp.oy); if (s === 3) for (let k = 0; k < sp.anchors.length; k++) { const a = sp.anchors[k]; const f = P.fruitSprite(c.id, k === 1 ? 'Gold' : k === 2 ? 'Rainbow' : 'Normal', k === 3 ? ['Wet'] : k === 4 ? ['Frozen'] : []); x.drawImage(f, px + sp.ox + a.x - f.width / 2, py + sp.oy + a.y - f.height / 2); } }
    const f = P.fruitSprite(c.id); x.drawImage(f, bx + 90, by - 10);
    x.drawImage(P.seedIcon(c.id, C.RARITY[c.rarity].color), bx + 90, by - 28);
  });
  // pets
  Object.keys(C.PETS).forEach((id, i) => { x.drawImage(S.petSprite(id, i % 2, false), 8 + (i % 18) * 30, 400 - Math.floor(i / 18) * 22 - 20); });
  // gear + eggs + people
  C.GEAR.forEach((g, i) => x.drawImage(S.gearIcon(g.id), 8 + i * 18, 2));
  C.EGGS.forEach((e, i) => x.drawImage(S.eggSprite(e.id, true), 220 + i * 18, 0));
  ['player', 'sam', 'gus', 'edna', 'steven'].forEach((w, i) => { ['down', 'up', 'right', 'left'].forEach((d, j) => x.drawImage(S.personSprite(w, d, j), 360 + i * 40 + j * 9, 0)); });
  // mutations row
  C.MUT_ORDER.forEach((m, i) => x.drawImage(P.fruitSprite('apple', 'Normal', [m]), 8 + i * 14, 30));
  ['Normal', 'Gold', 'Rainbow'].forEach((v, i) => x.drawImage(P.fruitSprite('strawberry', v, []), 220 + i * 14, 30));
  x.drawImage(S.tree(0), 260, 20); x.drawImage(S.tree(1), 300, 20); x.drawImage(S.bush(0), 340, 30); x.drawImage(S.rock(0), 360, 36); x.drawImage(S.lantern(), 380, 20); x.drawImage(S.scarecrow(), 400, 16); x.drawImage(S.nest(), 430, 36); x.drawImage(S.sprinklerSprite('sprinkler3'), 450, 28); x.drawImage(S.rodSprite(), 470, 20);
  x.drawImage(S.stallBack('seeds'), 400, 60); x.drawImage(S.stallFront('seeds'), 400, 100);
});
await page.locator('#sheet').screenshot({ path: `${out}/sheet.png` });
console.log(errors.length ? errors.join('\n') : 'sheet ok');
await browser.close(); server.close();
