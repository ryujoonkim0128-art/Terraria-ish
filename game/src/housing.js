// "Build it and they'll come": a room counts as a home when it has a back wall behind every open tile,
// a bed, a light, and a table or chair. Empty homes attract travelling settlers.
import { OBJ, tiles } from './content.js';

export function checkHome(world, bed) {
  const start = [bed.x + 1, bed.y];
  const seen = new Set(), q = [start];
  const key = (x, y) => y * world.w + x;
  seen.add(key(...start));
  let minX = start[0], maxX = start[0], minY = start[1], maxY = start[1];
  const need = [];
  while (q.length) {
    const [x, y] = q.pop();
    if (seen.size > 500) return { ok: false, why: 'This room is too big to be a home.' };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (seen.has(k) || !world.inb(nx, ny)) continue;
      if (tiles[world.get(nx, ny)].solid) continue;
      if (!world.getWall(nx, ny)) { need.push([nx, ny]); continue; }  // open to the outside here
      seen.add(k); q.push([nx, ny]);
      minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
    }
  }
  if (!world.getWall(...start)) return { ok: false, why: 'Put a background wall behind the bed.' };
  if (seen.size < 24) return { ok: false, why: 'This room is too small to live in.' };
  const objs = world.objectsIn(minX, minY, maxX, maxY, (o) => seen.has(key(o.x, o.y + o.h - 1)) || seen.has(key(o.x, o.y)));
  const light = objs.some((o) => OBJ[o.type].light);
  const sit = objs.some((o) => o.type === 'table' || o.type === 'chair');
  if (!light) return { ok: false, why: 'The room needs a light: a torch or lantern.' };
  if (!sit) return { ok: false, why: 'The room needs a table or a chair.' };
  // openings without a back wall are fine as doorways, but not as missing walls
  if (need.length > 8) return { ok: false, why: 'Fill in the back wall so the room feels enclosed.' };
  const stations = objs.filter((o) => OBJ[o.type].tags.includes('station'));
  return { ok: true, tiles: seen, box: [minX, minY, maxX, maxY], objs, stations };
}

export function roleForHome(home) {
  const tags = new Set(home.stations.flatMap((s) => OBJ[s.type].tags));
  if (tags.has('smith')) return 'smith';
  if (tags.has('cook')) return 'cook';
  if (tags.has('weave')) return 'weaver';
  return 'settler';
}
