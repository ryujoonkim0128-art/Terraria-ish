// A* over "standing" tiles for 2-tile-tall walkers: walk, step up 1, drop down, climb ladders.

class Heap {
  constructor() { this.a = []; }
  push(n, f) { const a = this.a; a.push([f, n]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } }
    return top[1];
  }
  get size() { return this.a.length; }
}

export function standable(w, x, y) {
  return w.passable(x, y) && w.passable(x, y - 1) && (w.support(x, y + 1) || w.ladder(x, y));
}

// nearest standable tile to (x,y) within radius r (prefers the same row, then below)
export function nearestStand(w, x, y, r = 3) {
  if (standable(w, x, y)) return { x, y };
  for (let d = 1; d <= r; d++) {
    for (let dy = 0; dy <= d; dy++) for (const sy of [1, -1]) for (const sx of [1, -1]) {
      const dx = d - dy;
      const tx = x + dx * sx, ty = y + dy * sy;
      if (standable(w, tx, ty)) return { x: tx, y: ty };
    }
  }
  // look straight down for ground
  for (let dy = 1; dy < 12; dy++) if (standable(w, x, y + dy)) return { x, y: y + dy };
  return null;
}

export function findPath(w, sx, sy, gx, gy, maxNodes = 5000) {
  const start = nearestStand(w, sx, sy, 2), goal = nearestStand(w, gx, gy, 3);
  if (!start || !goal) return null;
  const pad = 30;
  const x0 = Math.min(start.x, goal.x) - pad, y0 = Math.min(start.y, goal.y) - pad;
  const W = Math.abs(start.x - goal.x) + pad * 2 + 1, H = Math.abs(start.y - goal.y) + pad * 2 + 1;
  if (W * H > 400000) return null;
  const key = (x, y) => (y - y0) * W + (x - x0);
  const g = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const act = new Uint8Array(W * H);
  const open = new Heap();
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y) * 1.2;
  const sk = key(start.x, start.y);
  g[sk] = 0; open.push(sk, h(start.x, start.y));
  let expanded = 0, found = -1;
  const inside = (x, y) => x >= x0 && y >= y0 && x < x0 + W && y < y0 + H;
  while (open.size && expanded < maxNodes) {
    const k = open.pop();
    const x = (k % W) + x0, y = Math.floor(k / W) + y0;
    if (x === goal.x && y === goal.y) { found = k; break; }
    expanded++;
    const gk = g[k];
    const relax = (nx, ny, cost, a) => {
      if (!inside(nx, ny)) return;
      const nk = key(nx, ny), ng = gk + cost;
      if (ng < g[nk]) { g[nk] = ng; from[nk] = k; act[nk] = a; open.push(nk, ng + h(nx, ny)); }
    };
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      if (standable(w, nx, y)) relax(nx, y, 1, 0);
      else if (w.passable(x, y - 2) && standable(w, nx, y - 1) && w.passable(nx, y - 2)) relax(nx, y - 1, 1.6, 1);
      else if (w.passable(nx, y) && w.passable(nx, y - 1)) {
        for (let fy = y + 1; fy <= y + 6; fy++) {
          if (!w.passable(nx, fy)) break;
          if (standable(w, nx, fy)) { relax(nx, fy, 1 + (fy - y) * 0.4, 2); break; }
        }
      }
    }
    // ladders: up if a rung is in our body column, down if a rung is under our feet
    if ((w.ladder(x, y) || w.ladder(x, y - 1)) && w.passable(x, y - 2) && standable(w, x, y - 1)) relax(x, y - 1, 1.3, 3);
    if (w.ladder(x, y + 1) && standable(w, x, y + 1)) relax(x, y + 1, 1.2, 3);
  }
  if (found < 0) return null;
  const out = [];
  for (let k = found; k !== sk; k = from[k]) out.push({ x: (k % W) + x0, y: Math.floor(k / W) + y0, a: act[k] });
  out.reverse();
  return out;
}
