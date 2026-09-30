// Minimal static server for the game folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png' };
export function serve() {
  return new Promise((res) => {
    const s = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (p === '/') p = '/index.html';
      fs.readFile(path.join(root, p), (e, d) => {
        if (e) { rs.writeHead(404); rs.end(); return; }
        rs.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
        rs.end(d);
      });
    }).listen(0, () => res(s));
  });
}
