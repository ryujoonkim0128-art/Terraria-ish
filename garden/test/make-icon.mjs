// Writes icon.png (512x512) from test/icon.html.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from './serve.mjs';
const server = await serve();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${server.address().port}/test/icon.html`);
await page.waitForFunction('window.done');
const url = await page.evaluate(() => window.icon);
fs.writeFileSync('icon.png', Buffer.from(url.split(',')[1], 'base64'));
console.log('wrote icon.png');
await browser.close(); server.close();
