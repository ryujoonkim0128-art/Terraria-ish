// Breadth-first search over standable cells. Moves: walk, step up one, drop down a few, climb ladders.
import { W, H } from './world.js';

const prev = new Int32Array(W * H);
const seen = new Uint32Array(W * H);
const queue = new Int32Array(W * H);
let stamp = 0;

function neighbours(w, x, y, out) {
  out.length = 0;
  for (const dx of [-1, 1]) {
    const nx = x + dx;
    if (w.standable(nx, y)) out.push(nx, y);
    else if (w.solid(nx, y) || w.solid(nx, y - 1)) {
      // step up one cell (needs head room above the current cell)
      if (!w.solid(x, y - 2) && w.standable(nx, y - 1)) out.push(nx, y - 1);
    } else {
      // walk off the edge and drop
      for (let k = 1; k <= 4; k++) {
        if (w.solid(nx, y + k)) break;
        if (w.standable(nx, y + k)) { out.push(nx, y + k); break; }
      }
    }
  }
  if ((w.isLadder(x, y) || w.isLadder(x, y - 1)) && w.standable(x, y - 1)) out.push(x, y - 1);
  if (w.isLadder(x, y + 1) && w.standable(x, y + 1)) out.push(x, y + 1);
  return out;
}

// Returns the list of cells from start (exclusive) to the first cell satisfying goal (inclusive),
// [] if the start already satisfies it, or null if unreachable.
export function bfs(w, sx, sy, goal, limit = W * H) {
  if (!w.inb(sx, sy)) return null;
  if (goal(sx, sy)) return [];
  stamp++;
  const s = sy * W + sx;
  let head = 0, tail = 0;
  queue[tail++] = s; seen[s] = stamp; prev[s] = -1;
  const nb = [];
  while (head < tail && head < limit) {
    const k = queue[head++], x = k % W, y = (k / W) | 0;
    neighbours(w, x, y, nb);
    for (let n = 0; n < nb.length; n += 2) {
      const nk = nb[n + 1] * W + nb[n];
      if (seen[nk] === stamp) continue;
      seen[nk] = stamp; prev[nk] = k;
      if (goal(nb[n], nb[n + 1])) {
        const path = [];
        let c = nk;
        while (c !== s) { path.push({ x: c % W, y: (c / W) | 0 }); c = prev[c]; }
        return path.reverse();
      }
      queue[tail++] = nk;
    }
  }
  return null;
}

// All cells reachable from a start, as a Set of indices (used for "is this connected" checks).
export function reach(w, sx, sy, limit = W * H) {
  const out = new Set();
  if (!w.inb(sx, sy)) return out;
  stamp++;
  const s = sy * W + sx;
  let head = 0, tail = 0;
  queue[tail++] = s; seen[s] = stamp;
  const nb = [];
  while (head < tail && tail < limit) {
    const k = queue[head++];
    out.add(k);
    neighbours(w, k % W, (k / W) | 0, nb);
    for (let n = 0; n < nb.length; n += 2) {
      const nk = nb[n + 1] * W + nb[n];
      if (seen[nk] !== stamp) { seen[nk] = stamp; queue[tail++] = nk; }
    }
  }
  return out;
}
