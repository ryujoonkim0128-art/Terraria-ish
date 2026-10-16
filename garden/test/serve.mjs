// Minimal static server for the garden folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
export function serve(port = 0) {
  return new Promise((res) => {
    const s = http.createServer((req, rs) => {
      let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (p === '/') p = '/index.html';
      const f = path.join(root, path.normalize(p));
      if (!f.startsWith(root)) { rs.writeHead(403); rs.end(); return; }
      fs.readFile(f, (e, d) => {
        if (e) { rs.writeHead(404); rs.end(); return; }
        rs.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
        rs.end(d);
      });
    }).listen(port, () => res(s));
  });
}
