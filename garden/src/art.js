// Procedural pixel art: fruit, plants, characters, pets, stalls, icons. Everything is cached.
import { canvas, build, painter, addOutline, flipX, recolor, ramp, mix, darken, lighten, INK, rng, hsl, rgb, luma, hash } from './util.js';
import { text, textWidth } from './font.js';
import { CROP, EGG, SPRINKLERS } from './data.js';

const cache = new Map();
export const memo = (key, fn) => {
  let v = cache.get(key);
  if (v === undefined) { v = fn(); cache.set(key, v); }
  return v;
};

export const PAL = {
  ink: INK, cream: '#fff6dc', paper: '#f7e8c6', paperDark: '#e3c995', paperLine: '#d4b47c',
  soil: ['#3a221f', '#55332a', '#73452f', '#8f5d3a', '#ab774b'],
  wet: ['#24161b', '#352225', '#4a2f2a', '#5e3d2f', '#73503a'],
  grass: ['#1f4d3a', '#2d6c3d', '#43903f', '#67b448', '#98d461', '#caec88'],
  wood: ['#3a2421', '#5c382a', '#7f5238', '#a5704a', '#cb9864', '#e9c48d'],
  path: ['#8a6a4e', '#a98563', '#c6a27a', '#dcbf94', '#ecd8b0'],
  stone: ['#5c5a6e', '#82809a', '#a9a7bd', '#cfcde0'],
  leaf: ['#1c5534', '#2b8441', '#56b34a', '#a2df69'],
  leafDark: ['#163b37', '#225c4b', '#3a865c', '#78bd85'],
  leafLime: ['#2c5a26', '#4a8c32', '#86c23f', '#c9ea6e'],
  gold: ['#6b4a10', '#a8781a', '#e0b02a', '#ffd84a', '#fff4a8'],
};
const LEAF = PAL.leaf, STEM = '#2f7a3a', STEM_D = '#1f5a30';

// ---------------------------------------------------------------- fruit
const S = (rows, pal) => (P) => P.rows(0, 0, rows, pal);
const FR = {
  carrotTop: S(['.oho.', 'oohoO', '.oOO.'], { o: '#f0862a', O: '#c4561c', h: '#ffbd6e' }),
  carrot: S(['.g.g.g.', '..gGg..', '...G...', '.ohooO.', '.ohooO.', '.ohooO.', '..hoO..', '..hoO..', '..ooO..', '...oO..', '...o...'],
    { g: '#7ccf55', G: '#2f7d3a', o: '#f0862a', O: '#c4561c', h: '#ffbd6e' }),
  strawberry: S(['.GgGg.', 'rhhrrr', 'rhryrR', 'ryrrrR', '.rryR.', '..rR..'],
    { r: '#e8334a', R: '#a8203a', h: '#ff9a9a', y: '#ffe7a0', g: '#7ccf55', G: '#3a8a3e' }),
  tulip: S(['o.O.o', 'oohOo', 'ohooO', 'ohooO', '.oOO.'], { o: '#ff8a2e', O: '#d0521c', h: '#ffc98a' }),
  tulipIcon: S(['.o.O.o.', '.oohOo.', '.ohooO.', '.ohooO.', '..oOO..', '...g...', '.l.g.l.', '.llg.l.', '..lgll.', '...g...', '...g...'],
    { o: '#ff8a2e', O: '#d0521c', h: '#ffc98a', l: '#6cc24a', g: '#2f7a3a' }),
  corn: S(['.hyy.', 'hyyyY', 'yhyYY', 'hyhyY', 'yhyyY', 'gyhyG', 'gGyYG', '.gGG.', '..G..'],
    { y: '#ffd23f', Y: '#d49a1e', h: '#fff3a8', g: '#7ccf55', G: '#3a8a3e' }),
  bean: S(['..G.', '.gG.', 'ghgG', 'glgG', 'ghgG', 'glgG', 'ghgG', '.ggG', '.gG.', '..G.'],
    { h: '#e2ff9e', l: '#a6f070', g: '#5fc24a', G: '#2f7d3a' }),
};

function fruitArt(crop, k = 1) {
  switch (crop) {
    case 'carrot': return build(5, 3, FR.carrotTop);
    case 'strawberry': return build(6, 6, FR.strawberry);
    case 'blueberry': return build(5, 5, (P) => { P.ball(2.5, 2.6, 2.5, 2.4, ['#283a86', '#4766cc', '#93b2ff', '#e6eeff']); P.dot(2, 0, '#1f2a66'); });
    case 'tulip': return build(5, 5, FR.tulip);
    case 'tomato': return build(7, 6, (P) => {
      P.ball(3.5, 3.4, 3.5, 2.7, ['#a3202e', '#e6413a', '#ff8a6a', '#fff0e0']);
      P.dot(3, 0, STEM); P.dot(2, 1, '#5fb84a'); P.dot(3, 1, STEM); P.dot(4, 1, '#5fb84a');
    });
    case 'corn': return build(5, 9, FR.corn);
    case 'watermelon': {
      const w = Math.round(12 * k), h = Math.round(9 * k);
      return build(w, h, (P) => {
        const cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
        P.ball(cx, cy, rx, ry, ['#1f6236', '#3c9a46', '#7fd05a', '#d4f5a8']);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy > 0.92) continue;
          const u = Math.round((x - cx) * (1 + Math.abs(dy) * 0.5));
          if (((u % 3) + 3) % 3 === 0) P.dot(x, y, dx * -0.5 + dy * -0.8 > 0.3 ? '#2f7d3a' : '#1a4f2e');
        }
      });
    }
    case 'pumpkin': {
      const w = Math.round(12 * k), h = Math.round(9 * k), rib = w / 3.4;
      return build(w, h + 2, (P) => {
        const cols = ['#b4501a', '#ec8a2a', '#ffbe5a', '#ffe7b0'];
        P.ball(rib, 2 + h / 2, rib, h / 2 - 0.3, cols);
        P.ball(w - rib, 2 + h / 2, rib, h / 2 - 0.3, cols);
        P.ball(w / 2, 2 + h / 2, rib * 1.05, h / 2, cols);
        P.rect(Math.floor(w / 2) - 1, 0, 2, 3, '#5a7a2a'); P.dot(Math.floor(w / 2) + 1, 0, '#7ca83a');
      });
    }
    case 'apple': return build(6, 7, (P) => {
      P.ball(3, 4, 3, 3, ['#93202c', '#dc3a3a', '#ff8a7a', '#ffffff']);
      P.dot(3, 0, '#6b4228'); P.dot(3, 1, '#6b4228'); P.dot(4, 0, '#6cc24a'); P.dot(5, 0, '#3a8a3e');
    });
    case 'coconut': return build(6, 6, (P) => {
      P.ball(3, 3, 3, 3, ['#3b2318', '#6b4228', '#9a6a40', '#c49464']);
      P.dot(2, 2, '#2a1810'); P.dot(4, 2, '#2a1810'); P.dot(3, 4, '#2a1810');
    });
    case 'dragonfruit': return build(7, 9, (P) => {
      P.ball(3.5, 5, 3.5, 4, ['#9a1c64', '#e8408f', '#ff8ac0', '#ffe0f0']);
      for (const [x, y] of [[3, 0], [2, 1], [4, 1], [0, 3], [6, 4], [0, 6], [6, 7], [3, 8]]) P.dot(x, y, '#7ccf55');
      P.dot(3, 1, '#3a8a3e');
    });
    case 'mango': return build(6, 8, (P) => {
      P.ball(3, 4.5, 3, 3.6, ['#c2402a', '#f29a2e', '#ffd85a', '#fff4c0']);
      P.dot(3, 0, '#5a7a2a'); P.dot(4, 0, '#6cc24a');
    });
    case 'grape': return build(7, 9, (P) => {
      const cols = ['#3a1f5a', '#7a3fb0', '#c08aff', '#f4e8ff'];
      for (const [x, y] of [[1.6, 3], [3.5, 2.8], [5.4, 3], [2.5, 4.8], [4.5, 4.8], [3.5, 6.6], [3.5, 8.2]]) P.ball(x, y, 1.6, 1.6, cols);
      P.dot(3, 0, '#6b4228'); P.dot(3, 1, '#6b4228'); P.dot(4, 0, '#6cc24a'); P.dot(5, 0, '#3a8a3e');
    });
    case 'mushroom': return mushroomArt(k);
    case 'beanstalk': return build(4, 10, FR.bean);
  }
}
function mushroomArt(k) {
  const w = Math.max(6, Math.round(18 * k)), capH = Math.max(3, Math.round(9 * k)), stemH = Math.max(2, Math.round(7 * k));
  return build(w, capH + stemH, (P) => {
    const sw = Math.max(2, Math.round(w * 0.36)), sx = Math.round((w - sw) / 2);
    P.rect(sx, capH - 1, sw, stemH + 1, '#f4ead6');
    P.rect(sx + sw - Math.max(1, sw >> 2), capH - 1, Math.max(1, sw >> 2), stemH + 1, '#cbb898');
    P.rect(sx, capH - 1, sw, 1, '#cbb898');
    // cap = upper half of a lit ellipse
    const c = canvas(w, capH * 2);
    painter(c).ball(w / 2, capH, w / 2, capH, ['#9a1e2a', '#e0383a', '#ff7a6a', '#ffd0c0']);
    P.g.drawImage(c, 0, 0, w, capH, 0, 0, w, capH);
    P.rect(1, capH - 1, w - 2, 1, '#e8d2b0');
    const spots = [[0.3, 0.35, 1.4], [0.62, 0.22, 1.2], [0.72, 0.6, 1.1], [0.15, 0.72, 0.9], [0.47, 0.62, 0.9]];
    for (const [u, v, r] of spots) {
      const rr = Math.max(0.6, r * k * 1.3);
      P.oval(u * w, v * capH, rr, rr, '#fff6e8');
    }
  });
}

const BUD = () => memo('bud', () => build(3, 3, S(['.w.', 'wyw', '.w.'], { w: '#fff6e8', y: '#ffd23f' })));
// Ripe fruit on the plant / in UI. stage: 0 bud, 1 unripe, 2 ripe. k: size class for big single crops
export function fruit(crop, stage = 2, k = 1) {
  return memo(`f|${crop}|${stage}|${k}`, () => {
    if (stage === 0) return BUD();
    const base = fruitArt(crop, k);
    if (stage === 2) return base;
    return recolor(base, (p) => {
      const l = luma(p);
      return [...rgb(mix(mix(rgb2hex(p), '#7cc24a', 0.55), l > 0.5 ? '#c8ec8a' : '#3f8a3e', 0.25)), p[3]];
    });
  });
}
const rgb2hex = (p) => '#' + ((1 << 24) | (p[0] << 16) | (p[1] << 8) | p[2]).toString(16).slice(1);

export function cropIcon(crop) {
  return memo('icon|' + crop, () => {
    if (crop === 'carrot') return build(7, 11, FR.carrot);
    if (crop === 'tulip') return build(7, 11, FR.tulipIcon);
    if (crop === 'mushroom') return mushroomArt(0.62);
    if (crop === 'watermelon' || crop === 'pumpkin') return fruitArt(crop, 0.92);
    return fruitArt(crop, 1);
  });
}

// Mutation looks. Rainbow cycles through 8 hue frames.
export function mutated(src, mut, frame = 0) {
  if (!mut) return src;
  if (!src._mut) src._mut = new Map();
  const key = mut === 'rainbow' ? mut + (frame & 7) : mut;
  let c = src._mut.get(key);
  if (c) return c;
  switch (mut) {
    case 'gold': c = ramp(src, PAL.gold); break;
    case 'frozen': c = ramp(src, ['#21507e', '#4b8fd0', '#8fd6ff', '#d4f6ff', '#ffffff']); break;
    case 'rainbow': c = recolor(src, (p, x, y) => [...rgb(hsl(frame * 45 + (x + y) * 22, 90, 30 + luma(p) * 50)), p[3]]); break;
    case 'chilled': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), '#d8f2ff', 0.42)), p[3]]); break;
    case 'bloodlit': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), luma(p) > 0.45 ? '#ff5a6a' : '#7a0a1e', 0.5)), p[3]]); break;
    case 'moonlit': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), luma(p) > 0.45 ? '#d6c8ff' : '#4a2a8a', 0.5)), p[3]]); break;
    case 'shocked': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), '#fff7a0', 0.3)), p[3]]); break;
    case 'pollinated': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), '#ffd23f', 0.3)), p[3]]); break;
    case 'wet': c = recolor(src, (p) => [...rgb(mix(rgb2hex(p), '#3a6ad0', 0.16)), p[3]]); break;
    default: c = src;
  }
  src._mut.set(key, c);
  return c;
}
// The single tint used to show a fruit's mutations (highest priority wins).
const LOOK = ['rainbow', 'gold', 'shocked', 'frozen', 'bloodlit', 'moonlit', 'pollinated', 'chilled', 'wet'];
export function mainLook(muts) {
  if (!muts || !muts.length) return null;
  for (const m of LOOK) if (muts.includes(m)) return m;
  return null;
}

// ---------------------------------------------------------------- plants
// Plants are drawn around a ground anchor; the canvas is PW x PH with the anchor at (AX, AY).
export const PW = 40, PH = 58, AX = 20, AY = 54;
const fx = (n) => Math.round(n);

function mound(P, R) {
  P.rect(-3, -1, 7, 2, PAL.soil[3]);
  P.rect(-2, -2, 5, 1, PAL.soil[4]);
  P.dot(0, -2, '#e8d29a');
}
function sprout(P, col, s) {
  const h = fx(2 + 4 * s);
  P.line(0, 0, 0, -h, STEM);
  P.rect(-2, -h, 2, 1, col[2]); P.dot(-3, -h - 1, col[2]); P.dot(-1, -h + 1, col[1]);
  P.rect(1, -h - 1, 2, 1, col[2]); P.dot(3, -h - 2, col[3]); P.dot(1, -h, col[1]);
}
const ballAt = (P, x, y, r, cols, ry) => P.ball(x, y, r, ry ?? r * 0.86, cols);

const PLANT = {
  carrot(P, s, R) {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.7 + (R() - 0.5) * 0.25;
      const L = (9 + R() * 5) * s;
      const tx = Math.sin(a) * L * 0.75, ty = -Math.cos(a) * L - 2;
      P.line(0, -2, fx(tx), fx(ty), STEM);
      for (let j = 2; j <= L; j += 2) {
        const u = j / L, x = fx(Math.sin(a) * j * 0.75), y = fx(-Math.cos(a) * j - 2);
        P.dot(x - 1, y, j % 4 ? '#6cc24a' : '#4aa040');
        P.dot(x + 1, y - 1, u > 0.6 ? '#a8e070' : '#6cc24a');
      }
      P.dot(fx(tx), fx(ty) - 1, '#a8e070');
    }
  },
  strawberry(P, s, R) {
    const blobs = [[-6, -5, 5], [6, -5, 5], [0, -9, 6], [-3, -3, 4.5], [4, -3, 4.5]];
    for (const [x, y, r] of blobs) ballAt(P, x * s, y * s, r * s + 0.5, LEAF);
    if (s > 0.8) for (const [x, y] of [[-3, -11], [5, -8]]) { P.dot(x, y - 1, '#fff6e8'); P.dot(x - 1, y, '#fff6e8'); P.dot(x + 1, y, '#fff6e8'); P.dot(x, y + 1, '#fff6e8'); P.dot(x, y, '#ffd23f'); }
  },
  blueberry(P, s) {
    P.rect(-1, fx(-4 * s), 2, fx(4 * s) + 1, '#5a3a2a');
    for (const [x, y, r] of [[-5, -8, 6], [5, -9, 6], [0, -14, 6.5], [-1, -6, 6], [6, -5, 4.5]]) ballAt(P, x * s, y * s, r * s + 0.5, PAL.leafDark);
  },
  tulip(P, s) {
    const h = fx(15 * s);
    P.line(0, 0, 0, -h, STEM);
    for (const d of [-1, 1]) {
      for (let y = 0; y < 10 * s; y++) {
        const w = Math.sin((y / (10 * s)) * Math.PI) * 2.6 * s + 0.5;
        for (let x = 0; x < w; x++) P.dot(d * (1 + x + fx(y * 0.18)), -y, x > w - 1.2 ? LEAF[1] : y > 6 * s ? LEAF[3] : LEAF[2]);
      }
    }
    if (s > 0.75) for (const d of [-1, 1]) { P.line(0, -4, d * 6, -9, STEM); P.oval(d * 6 + 0.5, -10.5, 1.2, 2, '#8fd06a'); P.dot(d * 6, -12, '#ffb070'); }
  },
  tomato(P, s, R) {
    const h = fx(26 * s);
    P.rect(-1, -h, 2, h + 1, PAL.wood[3]); P.rect(-1, -h, 1, h + 1, PAL.wood[4]); P.rect(-1, -h, 2, 1, PAL.wood[2]);
    for (let i = 0; i < 5; i++) {
      const y = -3 - i * 5, x = i % 2 ? 4 : -4;
      if (-y > h + 2) break;
      ballAt(P, x * (0.6 + 0.4 * s), y * s, 4.2 * s + 0.6, LEAF);
    }
    ballAt(P, 0, -h - 1, 3 * s + 0.5, LEAF);
  },
  corn(P, s, R) {
    const stalks = [[-4, 31], [4, 27]];
    for (const [sx, H] of stalks) {
      const h = fx(H * s);
      P.rect(sx, -h, 2, h + 1, '#72b040'); P.rect(sx + 1, -h, 1, h + 1, '#4f8a2e');
      for (let i = 0; i < 4; i++) {
        const y0 = -fx((6 + i * 6) * s), dir = i % 2 ? 1 : -1, L = (9 - i) * s;
        let px = sx + (dir > 0 ? 2 : -1), py = y0;
        for (let j = 0; j < L; j++) {
          const nx = px + dir, ny = py + (j < L * 0.45 ? -1 : j > L * 0.7 ? 1 : 0);
          P.dot(nx, ny, j < L * 0.5 ? '#86c23f' : '#5c9a34'); P.dot(nx, ny + 1, '#3f7a2a');
          px = nx; py = ny;
        }
      }
      if (s > 0.8) { P.line(sx, -h, sx - 2, -h - 3, '#d9b45a'); P.line(sx + 1, -h, sx + 3, -h - 3, '#d9b45a'); P.line(sx, -h, sx, -h - 4, '#ecd07a'); }
    }
  },
  watermelon(P, s, R) { vine(P, s, R, [[-8, -3, 4.5], [8, -3, 4.5], [-3, -6, 4.5], [4, -7, 4.5], [0, -3, 3.5]]); },
  pumpkin(P, s, R) { vine(P, s, R, [[-8, -4, 5], [8, -4, 5], [-2, -8, 5.5], [5, -8, 4.5], [0, -3, 4]]); },
  apple(P, s) { tree(P, s, 15, [[0, -25, 9], [-7, -20, 6.5], [7, -20, 6.5], [-4, -29, 6.5], [4, -30, 6]], LEAF); },
  mango(P, s) { tree(P, s, 13, [[0, -21, 10], [-9, -18, 6], [9, -18, 6], [-4, -26, 7], [5, -26, 6.5]], PAL.leafDark); },
  coconut(P, s) {
    const h = fx(28 * s), xt = fx(4 * s);
    for (let i = 0; i <= h; i++) {
      const x = fx(Math.sin((i / h) * 1.3) * 4 * s);
      P.rect(x - 1, -i, 3, 1, i % 3 === 0 ? '#7a5434' : '#a8784a');
      P.dot(x + 1, -i, '#6b4428');
    }
    const top = -h;
    const fr = [[-1, -0.2], [-0.8, 0.5], [1, -0.2], [0.8, 0.5], [-0.3, -1], [0.35, -1]];
    for (const [dx, dy] of fr) {
      let x = xt, y = top;
      const L = 13 * s;
      for (let j = 0; j < L; j++) {
        const u = j / L;
        x += dx; y += dy + u * 0.9;
        P.dot(fx(x), fx(y), u < 0.5 ? '#6cc24a' : '#3f9a3e');
        P.dot(fx(x), fx(y) + 1, '#2b6e34');
        if (j % 2 && u > 0.2) P.dot(fx(x), fx(y) + 2, '#2b6e34');
      }
    }
    ballAt(P, xt, top, 2.5 * s + 0.5, PAL.leafLime);
  },
  dragonfruit(P, s, R) {
    P.rect(-1, -fx(18 * s), 2, fx(18 * s) + 1, PAL.wood[2]); P.rect(-1, -fx(18 * s), 1, fx(18 * s) + 1, PAL.wood[3]);
    const arms = [[-1, -6, -9, -14], [1, -10, 9, -17], [0, -16, -6, -24]];
    for (const [x0, y0, x1, y1] of arms) {
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = fx((x0 + (x1 - x0) * u) * s), y = fx((y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 4) * s);
        P.rect(x - 1, y - 1, 3, 3, '#4fa04a'); P.dot(x - 1, y - 1, '#8fd06a'); P.dot(x + 1, y + 1, '#2f6e34');
        if (i % 3 === 1) P.dot(x, y - 2, '#a8e070');
      }
    }
  },
  grape(P, s) {
    const h = fx(22 * s), w = fx(10 * s);
    for (const x of [-w, w - 1]) { P.rect(x, -h, 2, h + 1, PAL.wood[2]); P.rect(x, -h, 1, h + 1, PAL.wood[3]); }
    P.rect(-w - 1, -h - 1, w * 2 + 3, 2, PAL.wood[3]); P.rect(-w - 1, -h - 1, w * 2 + 3, 1, PAL.wood[4]);
    for (let i = 0; i < h; i++) P.dot(-w + 2 + fx(Math.sin(i * 0.5)), -i, '#6b4a2a');
    for (const [x, y, r] of [[-8, -21, 4.5], [-1, -23, 4.5], [7, -21, 4.5], [-4, -19, 3.5], [4, -18, 3.5]]) ballAt(P, x * s, y * s, r * s + 0.5, LEAF);
  },
  mushroom(P, s) {
    for (const [x, y] of [[-6, 0], [7, 0]]) { P.rect(x, y - 2, 1, 2, '#f4ead6'); P.rect(x - 1, y - 3, 3, 1, '#c8844a'); }
    for (let i = -8; i <= 8; i += 3) { P.dot(i, 0, '#5fb84a'); P.dot(i + 1, -1, '#3f9a3e'); }
  },
  beanstalk(P, s) {
    const h = fx(46 * s);
    for (let i = 0; i <= h; i++) {
      const x = fx(Math.sin(i * 0.2) * 4 * s);
      P.rect(x - 1, -i, 3, 1, '#4fb04a'); P.dot(x - 1, -i, '#8fe06a'); P.dot(x + 1, -i, '#2b7a3a');
    }
    for (let i = 6; i < h - 2; i += 7) {
      const x = fx(Math.sin(i * 0.2) * 4 * s), d = (i / 7) % 2 ? 1 : -1;
      ballAt(P, x + d * 4, -i - 1, 3.6 * s + 0.6, ['#1c6a34', '#3aa848', '#7ee06a', '#c8ff9a'], 2.6 * s + 0.5);
    }
    const tx = fx(Math.sin(h * 0.2) * 4 * s);
    P.dot(tx + 1, -h - 1, '#8fe06a'); P.dot(tx + 2, -h - 2, '#8fe06a'); P.dot(tx + 1, -h - 3, '#8fe06a');
  },
};
function vine(P, s, R, blobs) {
  for (let i = -9; i <= 9; i += 1) P.dot(fx(i * s), fx(-1 - Math.sin(i * 0.7) * 1.2), '#3f8a3a');
  for (const [x, y, r] of blobs) ballAt(P, x * s, y * s, r * s + 0.5, LEAF, (r * 0.7) * s + 0.5);
  if (s > 0.7) for (const [x, y] of [[-11, -2], [11, -1]]) { P.dot(x, y, '#6cc24a'); P.dot(x + (x < 0 ? -1 : 1), y - 1, '#6cc24a'); P.dot(x, y - 2, '#6cc24a'); }
}
function tree(P, s, trunkH, blobs, cols) {
  const h = fx(trunkH * s + 4);
  P.rect(-1, -h, 3, h + 1, '#7a5434'); P.rect(-1, -h, 1, h + 1, '#a8784a'); P.rect(1, -h, 1, h + 1, '#5a3a24');
  P.dot(-2, 0, '#7a5434'); P.dot(2, 0, '#5a3a24');
  const lift = (1 - s) * 12;
  for (const [x, y, r] of blobs) ballAt(P, x * s, y * s + lift * 0.5, r * s + 0.6, cols);
}

// Fruit positions on mature plants (relative to the ground anchor). mode: hang = fruit top here, sit = fruit bottom here
export const ANCHORS = {
  carrot: { sit: true, pts: [[0, 1]] },
  strawberry: { pts: [[-7, -5], [7, -5], [0, -3]] },
  blueberry: { pts: [[-7, -11], [5, -13], [-3, -5], [7, -6]] },
  tulip: { sit: true, pts: [[0, -14]] },
  tomato: { pts: [[-6, -9], [5, -14], [-5, -20]] },
  corn: { pts: [[-7, -17], [6, -13]] },
  watermelon: { sit: true, pts: [[0, 2]] },
  pumpkin: { sit: true, pts: [[0, 2]] },
  apple: { pts: [[-7, -21], [6, -23], [0, -30], [-3, -17], [7, -17]] },
  coconut: { pts: [[1, -27], [6, -27], [4, -25]] },
  dragonfruit: { pts: [[-10, -16], [9, -19], [-7, -26]] },
  mango: { pts: [[-8, -18], [7, -19], [-2, -24], [2, -15]] },
  grape: { pts: [[-7, -18], [-1, -19], [5, -17], [9, -16]] },
  mushroom: { sit: true, pts: [[0, 1]] },
  beanstalk: { pts: [[-7, -15], [6, -26], [-6, -36]] },
};

export function stageOf(f) { return f < 0.08 ? 0 : f < 0.25 ? 1 : f < 0.5 ? 2 : f < 0.75 ? 3 : f < 1 ? 4 : 5; }
const STAGE_S = [0, 0.3, 0.5, 0.68, 0.84, 1];
export function plantSprite(crop, stage, variant) {
  return memo(`p|${crop}|${stage}|${variant}`, () => {
    const c = canvas(PW, PH), P = painter(c), R = rng(hash(variant, stage, crop.length * 31 + crop.charCodeAt(0)));
    c.g.translate(AX, AY);
    if (stage === 0) mound(P, R);
    else if (stage === 1) { mound(P, R); sprout(P, CROP[crop].rarity === 'divine' ? PAL.leafLime : LEAF, 0.5 + R() * 0.5); }
    else PLANT[crop](P, STAGE_S[stage], R);
    c.g.setTransform(1, 0, 0, 1, 0, 0);
    return addOutline(c);
  });
}

// ---------------------------------------------------------------- characters
export const SKINS = ['#f4c49a', '#d89a6a', '#a8673e', '#7a4a2e'];
function person(o, frame, front) {
  return build(12, 20, (P) => {
    const bob = frame === 1 || frame === 3 ? 1 : 0;
    const y0 = bob;
    // legs
    const pants = o.pants;
    if (front || frame === 0 || frame === 2) {
      P.rect(3, 16, 2, 3, pants); P.rect(7, 16, 2, 3, pants);
      P.rect(3, 19, 2, 1, o.boots); P.rect(7, 19, 2, 1, o.boots);
    } else {
      const d = frame === 1 ? 1 : -1;
      P.rect(4 + d, 16, 2, 3, pants); P.rect(6 - d, 16, 2, 2, darken(pants, 0.25));
      P.rect(4 + d, 19, 2, 1, o.boots); P.rect(6 - d, 18, 2, 1, o.boots);
    }
    // torso
    P.rect(2, 11 + y0, 8, 5, o.shirt);
    P.rect(2, 15 + y0, 8, 1, darken(o.shirt, 0.2));
    if (o.overalls) {
      P.rect(3, 12 + y0, 6, 5 - y0, o.overalls); P.rect(3, 11 + y0, 1, 1, o.overalls); P.rect(8, 11 + y0, 1, 1, o.overalls);
      P.dot(4, 12 + y0, '#ffd23f'); P.dot(7, 12 + y0, '#ffd23f'); P.rect(3, 16, 6, 1, o.overalls);
    }
    if (o.apron) { P.rect(3, 12 + y0, 6, 5 - y0, o.apron); P.rect(4, 11 + y0, 4, 1, o.apron); P.rect(5, 14 + y0, 2, 1, lighten(o.apron, 0.35)); }
    // arms
    const swing = !front && frame ? (frame === 1 ? 1 : -1) : 0;
    P.rect(1, 11 + y0 + Math.max(0, swing), 1, 4, o.shirt); P.dot(1, 15 + y0 + Math.max(0, swing), o.skin);
    P.rect(10, 11 + y0 + Math.max(0, -swing), 1, 4, darken(o.shirt, 0.15)); P.dot(10, 15 + y0 + Math.max(0, -swing), o.skin);
    // head
    P.rect(3, 4 + y0, 6, 7, o.skin);
    P.rect(3, 10 + y0, 6, 1, darken(o.skin, 0.12));
    if (front) {
      P.dot(4, 7 + y0, INK); P.dot(7, 7 + y0, INK);
      if (o.blink) { P.dot(4, 7 + y0, darken(o.skin, 0.3)); P.dot(7, 7 + y0, darken(o.skin, 0.3)); }
      P.dot(3, 8 + y0, '#f08a7a'); P.dot(8, 8 + y0, '#f08a7a');
      P.rect(5, 9 + y0, 2, 1, '#b85a50');
      if (o.glasses) { P.rect(3, 7 + y0, 2, 1, '#2a2a3a'); P.rect(6, 7 + y0, 2, 1, '#2a2a3a'); P.dot(5, 7 + y0, '#2a2a3a'); P.dot(3, 7 + y0, '#9ad0ff'); P.dot(6, 7 + y0, '#9ad0ff'); }
      if (o.beard) { P.rect(3, 9 + y0, 6, 2, o.hair); P.rect(5, 9 + y0, 2, 1, '#b85a50'); }
      P.rect(3, 4 + y0, 6, 1, o.hair); P.rect(3, 5 + y0, 1, 2, o.hair); P.rect(8, 5 + y0, 1, 2, o.hair);
    } else {
      P.dot(7, 7 + y0, INK); P.dot(8, 8 + y0, '#f08a7a');
      P.rect(3, 4 + y0, 6, 2, o.hair); P.rect(3, 6 + y0, 2, 2, o.hair); P.dot(4, 8 + y0, darken(o.skin, 0.2));
    }
    if (o.long) { P.rect(2, 5 + y0, 1, 6, o.hair); if (front) P.rect(9, 5 + y0, 1, 6, o.hair); }
    // hats
    const hy = y0;
    if (o.hat === 'straw') {
      P.rect(3, hy, 6, 4, '#e8c35e'); P.rect(4, hy, 4, 1, '#f6dc8a'); P.rect(3, 3 + hy, 6, 1, '#c8423a');
      P.rect(0, 4 + hy, 12, 1, '#e8c35e'); P.rect(1, 4 + hy, 2, 1, '#f6dc8a'); P.rect(1, 5 + hy, 10, 1, front ? darken(o.skin, 0.25) : darken(o.skin, 0.25));
    } else if (o.hat === 'cap') {
      P.rect(3, 1 + hy, 6, 3, o.hatCol); P.rect(4, 1 + hy, 3, 1, lighten(o.hatCol, 0.3));
      if (front) P.rect(2, 4 + hy, 8, 1, darken(o.hatCol, 0.25)); else P.rect(6, 4 + hy, 5, 1, darken(o.hatCol, 0.25));
    } else if (o.hat === 'bandana') {
      P.rect(3, 2 + hy, 6, 3, o.hatCol); P.rect(4, 2 + hy, 3, 1, lighten(o.hatCol, 0.3)); P.dot(5, 3 + hy, '#fff6e8'); P.dot(7, 4 + hy, '#fff6e8');
      if (front) P.dot(2, 4 + hy, o.hatCol);
    } else if (o.hat === 'bun') {
      P.rect(3, 3 + hy, 6, 2, o.hair); P.oval(6, 2 + hy, 2, 1.6, o.hair); P.dot(5, 1 + hy, lighten(o.hair, 0.3));
    } else if (o.hat === 'beret') {
      P.rect(2, 2 + hy, 8, 2, o.hatCol); P.rect(3, 1 + hy, 5, 1, o.hatCol); P.dot(6, 0 + hy, darken(o.hatCol, 0.3)); P.rect(3, 2 + hy, 3, 1, lighten(o.hatCol, 0.3));
    }
  }, INK);
}
export const FARMER = { skin: SKINS[0], hair: '#7a4a2c', shirt: '#e0584c', overalls: '#4f7fd6', pants: '#3f66b8', boots: '#5a3a2a', hat: 'straw' };
export const NPCS = {
  seeds: { skin: SKINS[1], hair: '#3a2a22', shirt: '#f2e6c8', apron: '#4fae5a', pants: '#5a4a3a', boots: '#3a2a22', hat: 'cap', hatCol: '#3f9a4a' },
  sell: { skin: SKINS[0], hair: '#b8763a', shirt: '#5a8ad8', apron: '#e8d8b0', pants: '#3a3a5a', boots: '#3a2a22', hat: 'none', glasses: true, beard: true },
  gear: { skin: SKINS[2], hair: '#2a1a1a', shirt: '#f2d7a0', apron: '#8a5a3a', pants: '#4a3a3a', boots: '#2a1a1a', hat: 'bandana', hatCol: '#d9534f', long: true },
  eggs: { skin: SKINS[0], hair: '#e8e0f0', shirt: '#9b6bd6', apron: '#f4e8ff', pants: '#5a4a7a', boots: '#3a2a3a', hat: 'bun' },
};
export function farmerFrames() {
  return memo('farmer', () => {
    const r = [0, 1, 2, 3].map((f) => person(FARMER, f, false));
    return { right: r, left: r.map(flipX) };
  });
}
export function npcFrames(kind) {
  return memo('npc' + kind, () => [person(NPCS[kind], 0, true), person(NPCS[kind], 1, true), person({ ...NPCS[kind], blink: true }, 0, true)]);
}

// ---------------------------------------------------------------- pets
const quad = (o) => (P, f) => {
  const legY = 9, lift = (i) => (f === 1 && i % 2 === 0) || (f === 0 && i % 2 === 1 && o.step) ? 1 : 0;
  if (o.tail) o.tail(P, f);
  [2, 4, 8, 10].forEach((x, i) => P.rect(x, legY - lift(i), 1, 2, i === 0 || i === 2 ? darken(o.cols[1], 0.3) : o.legs || o.cols[1]));
  P.ball(6, 7, 5, 3, o.cols);
  if (o.belly) P.rect(5, 9, 4, 1, o.belly);
  if (o.back) o.back(P, f);
  P.ball(10, 4.5, 3.6, 3.2, o.head || o.cols);
  if (o.ears) o.ears(P, f);
  if (o.face) o.face(P, f);
  P.dot(11, 4, INK); P.dot(12, 6, o.nose || INK); P.dot(10, 6, '#f59a9a');
};
const PETDEF = {
  bunny: quad({ cols: ['#c8b8a8', '#efe6da', '#ffffff'], tail: (P) => P.ball(1, 6, 1.6, 1.6, ['#d8d0c8', '#ffffff', '#ffffff']), ears: (P, f) => { P.rect(9, -2 + f, 1, 4, '#efe6da'); P.rect(11, -3 + f, 1, 5, '#efe6da'); P.dot(11, -1 + f, '#f5a8b8'); }, nose: '#e88a9a' }),
  puppy: quad({ cols: ['#a8702e', '#d9a066', '#f2c890'], tail: (P, f) => { P.line(1, 6, 0, 3 + f, '#d9a066'); }, ears: (P) => { P.rect(8, 2, 2, 4, '#7a4a22'); }, belly: '#f2dcb0' }),
  kitten: quad({ cols: ['#6e6a80', '#a7a2b8', '#d6d2e2'], tail: (P, f) => { P.line(1, 6, 0, 2 + f, '#a7a2b8'); P.dot(1, 1 + f, '#a7a2b8'); }, ears: (P) => { P.dot(8, 1, '#a7a2b8'); P.rect(8, 2, 2, 1, '#a7a2b8'); P.dot(12, 1, '#a7a2b8'); P.rect(11, 2, 2, 1, '#a7a2b8'); }, back: (P) => { P.dot(4, 5, '#6e6a80'); P.dot(6, 5, '#6e6a80'); P.dot(8, 5, '#6e6a80'); }, nose: '#e88a9a' }),
  fox: quad({ cols: ['#b04a1a', '#ec7a2a', '#ffb060'], tail: (P, f) => { P.ball(1.5, 5 - f * 0.5, 2.6, 2, ['#b04a1a', '#ec7a2a', '#ffb060']); P.dot(-1, 4 - f, '#fff6e8'); P.dot(-1, 5 - f, '#fff6e8'); }, ears: (P) => { P.rect(8, 1, 2, 2, '#ec7a2a'); P.dot(8, 0, '#3a1a10'); P.rect(11, 1, 2, 2, '#ec7a2a'); P.dot(12, 0, '#3a1a10'); }, face: (P) => { P.rect(11, 6, 2, 1, '#fff6e8'); }, belly: '#fff6e8', legs: '#3a1a10' }),
  hedgehog: quad({ cols: ['#7a5a3a', '#c8a070', '#e8c898'], back: (P) => { P.ball(5.5, 5.5, 5, 3.2, ['#3a2418', '#5c3a26', '#8a6040']); for (let x = 1; x < 10; x += 2) P.dot(x, 2 + (x % 4 === 1 ? 0 : 1), '#3a2418'); }, head: ['#a8804a', '#d8b078', '#f2d8a8'] }),
  panda: quad({ cols: ['#c8c8d0', '#f4f4f8', '#ffffff'], legs: '#2a2a3a', ears: (P) => { P.dot(8, 1, '#2a2a3a'); P.dot(12, 1, '#2a2a3a'); }, face: (P) => { P.rect(10, 3, 2, 2, '#2a2a3a'); P.dot(11, 3, '#ffffff'); }, back: (P) => P.rect(4, 5, 5, 2, '#2a2a3a') }),
  capybara: quad({ cols: ['#6b4228', '#9a6a40', '#c49464'], head: ['#6b4228', '#9a6a40', '#c49464'], ears: (P) => P.dot(9, 1, '#5a3420'), face: (P) => { P.rect(12, 4, 2, 3, '#9a6a40'); P.ball(10, 0, 1.6, 1.4, ['#c4561c', '#f0862a', '#ffbd6e']); }, nose: '#3a2418' }),
  dragon: quad({ cols: ['#1f6b3a', '#3fae4a', '#9ae070'], belly: '#ffd85a', tail: (P) => { P.line(1, 7, -1, 4, '#3fae4a'); P.dot(-2, 3, '#ff5a4a'); P.dot(-1, 3, '#ff5a4a'); }, back: (P, f) => { P.rect(4, 1 + f, 1, 4 - f, '#ff8a5a'); P.rect(5, 2 + f, 2, 3 - f, '#ffb08a'); P.rect(7, 3 + f, 1, 2 - f, '#ff8a5a'); }, ears: (P) => { P.dot(9, 1, '#fff2c0'); P.dot(11, 0, '#fff2c0'); }, nose: '#1f4a2a' }),
  chick: (P, f) => { P.rect(4, 9, 1, 2 - f, '#ff9a2e'); P.rect(7, 9, 1, 1 + f, '#ff9a2e'); P.ball(6, 6, 4.5, 4, ['#d9a21e', '#ffd84a', '#fff3a8']); P.rect(3, 6 + f, 3, 2, '#e8b22e'); P.dot(8, 4, INK); P.rect(10, 5, 2, 1, '#ff9a2e'); P.dot(7, 1, '#ffd84a'); P.dot(8, 0, '#ffd84a'); },
  duck: (P, f) => { P.rect(4, 9, 1, 2 - f, '#ff9a2e'); P.rect(7, 9, 1, 1 + f, '#ff9a2e'); P.ball(5.5, 7, 5, 3, ['#b8c0cc', '#eef2f6', '#ffffff']); P.ball(9, 3.5, 2.6, 2.6, ['#2a6a4a', '#3a9a5a', '#7ad08a']); P.rect(11, 4, 3, 1, '#ff9a2e'); P.dot(9, 3, INK); P.rect(3, 6, 4, 2, '#d0d8e2'); P.dot(0, 5, '#eef2f6'); },
  bee: (P, f) => { P.ball(6, 6, 4.5, 3.2, ['#c88a1a', '#ffd23f', '#fff3a0']); P.rect(4, 3, 1, 6, '#2a2030'); P.rect(7, 3, 1, 6, '#2a2030'); P.dot(1, 6, '#2a2030'); P.ball(9.5, 5.5, 2, 2, ['#2a2030', '#3a3040', '#5a5060']); P.dot(10, 5, '#ffffff'); P.dot(10, 2, '#2a2030'); P.dot(11, 1, '#2a2030'); P.oval(5, 1.5 + f, 2.5, 1.6 - f * 0.5, '#e8f6ff'); P.oval(7.5, 2 + f, 1.8, 1.4 - f * 0.4, '#c8e8ff'); },
  owl: (P, f) => { P.ball(6, 6, 5, 5, ['#5a3a24', '#8a5c3a', '#b88a5a']); P.oval(6, 8, 3, 2.5, '#e8d0a8'); P.rect(2, 3, 3, 3, '#ffffff'); P.rect(7, 3, 3, 3, '#ffffff'); P.dot(3, 4, INK); P.dot(8, 4, INK); P.dot(5, 6, '#ffb03a'); P.dot(6, 6, '#ffb03a'); P.dot(1, 1, '#5a3a24'); P.dot(10, 1, '#5a3a24'); P.rect(0, 5 + f, 1, 4, '#6b4428'); P.rect(11, 5 + f, 1, 4, '#6b4428'); P.dot(4, 11, '#ffb03a'); P.dot(7, 11, '#ffb03a'); },
  dragonfly: (P, f) => { P.rect(0, 6, 9, 1, '#2aa8a0'); P.dot(2, 6, '#1a6a70'); P.dot(5, 6, '#1a6a70'); P.ball(10, 5.5, 2, 1.8, ['#1a6a70', '#2ad0c0', '#a0fff0']); P.dot(11, 5, INK); P.oval(5, 3 + f, 3.5, 1.2, '#d0f4ff'); P.oval(8, 3 - f, 2.5, 1, '#e8fbff'); P.oval(5, 8 - f, 3, 1, '#c0ecff'); },
};
export const FLYERS = { bee: true, dragonfly: true, owl: false };
export function petFrames(type) {
  return memo('pet' + type, () => {
    const r = [0, 1].map((f) => build(14, 12, (P) => { P.g.translate(1, 0); PETDEF[type](P, f); }, INK));
    return { right: r, left: r.map(flipX) };
  });
}

export function eggSprite(id, crack = 0) {
  return memo(`egg|${id}|${crack}`, () => {
    const e = EGG[id];
    return build(8, 10, (P) => {
      P.ball(4, 5.5, 4, 4.5, [darken(e.col, 0.25), e.col, lighten(e.col, 0.5), '#ffffff']);
      const R = rng(id.length * 7);
      for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(R() * 6), y = 2 + Math.floor(R() * 7); P.dot(x, y, e.spot); }
      if (crack) { P.line(1, 5, 3, 4, INK); P.line(3, 4, 4, 6, INK); P.line(4, 6, 6, 4, INK); if (crack > 1) P.line(6, 4, 7, 6, INK); }
    }, 'sel');
  });
}
export function nestSprite() {
  return memo('nest', () => build(14, 5, (P) => {
    P.oval(7, 3, 7, 2.5, '#a8784a');
    for (let x = 0; x < 14; x += 2) { P.dot(x, 2 + (x % 4 ? 1 : 0), '#e8c070'); P.dot(x + 1, 3, '#7a5434'); }
    P.rect(2, 1, 10, 1, '#c89a5a');
  }));
}

// ---------------------------------------------------------------- icons
export function coinIcon() {
  return memo('coin', () => build(7, 7, (P) => {
    P.ball(3.5, 3.5, 3.5, 3.5, ['#a8781a', '#f2c230', '#fff0a0', '#ffffff']);
    P.rect(3, 2, 1, 3, '#b8861e'); P.dot(2, 2, '#b8861e'); P.dot(4, 4, '#b8861e');
  }));
}
export function sproutIcon() {
  return memo('sprouticon', () => build(7, 7, (P) => {
    P.rect(3, 3, 1, 4, STEM); P.oval(1.5, 2.5, 1.6, 1.2, '#6cc24a'); P.oval(5.5, 1.5, 1.8, 1.3, '#8fd86a');
  }));
}
export function packet(crop) {
  return memo('pk' + crop, () => {
    const rar = CROP[crop].rarity, band = { common: '#9a96a8', uncommon: '#4fae5a', rare: '#3f86d8', legendary: '#e8a81e', mythical: '#9a5ad0', divine: '#e8642e', prismatic: '#e05aa8' }[rar];
    const c = build(13, 15, (P) => {
      P.rect(0, 1, 13, 14, '#f7e8c6'); P.rect(0, 13, 13, 2, '#e3c995');
      P.rect(0, 1, 13, 4, band); P.rect(0, 1, 13, 1, lighten(band, 0.3));
      for (let x = 0; x < 13; x += 2) P.dot(x, 0, '#f7e8c6');
      P.rect(12, 5, 1, 8, '#e3c995');
    });
    const ic = cropIcon(crop);
    const h = Math.min(ic.height, 12);
    c.g.drawImage(ic, 0, 0, ic.width, h, Math.round((c.width - ic.width) / 2), c.height - h - 1, ic.width, h);
    return c;
  });
}
export function toolIcon(id) {
  return memo('tool' + id, () => {
    switch (id) {
      case 'shovel': return build(12, 12, (P) => {
        P.line(10, 1, 4, 7, '#a8744b'); P.line(11, 1, 5, 7, '#7f5238'); P.rect(9, 0, 3, 2, '#7f5238');
        P.ball(3, 9, 3, 2.8, ['#6a6880', '#a9a7bd', '#e2e0f0', '#ffffff']);
      });
      case 'can': return build(13, 10, (P) => {
        P.line(9, 4, 12, 1, '#3f9a4a'); P.dot(12, 0, '#7ccf55');
        P.rect(2, 3, 8, 7, '#4fae5a'); P.rect(2, 3, 8, 1, '#8fdc7a'); P.rect(8, 4, 2, 6, '#2f7d3a'); P.rect(3, 5, 1, 3, '#a8ec90');
        P.line(0, 4, 1, 2, '#2f7d3a'); P.rect(3, 1, 6, 1, '#2f7d3a'); P.dot(2, 2, '#2f7d3a'); P.dot(9, 2, '#2f7d3a');
      });
      case 'basket': return build(13, 11, (P) => {
        P.oval(3.5, 3.5, 2.6, 2.6, '#e8334a'); P.oval(7, 3, 2.4, 2.4, '#f0862a'); P.oval(10, 3.5, 2.2, 2.2, '#7ccf55'); P.dot(3, 2, '#ff9a9a'); P.dot(7, 2, '#ffbd6e');
        P.rect(0, 5, 13, 6, '#c8904a');
        for (let y = 5; y < 11; y++) for (let x = (y % 2); x < 13; x += 2) P.dot(x, y, '#a8703a');
        P.rect(0, 5, 13, 1, '#e8b870'); P.rect(1, 10, 11, 1, '#7a4a2a');
      });
      case 'expand': return build(13, 11, (P) => {
        for (let x = 0; x < 13; x += 4) { P.rect(x, 3, 2, 8, '#cb9864'); P.dot(x, 2, '#cb9864'); P.rect(x + 1, 3, 1, 8, '#a5704a'); }
        P.rect(0, 5, 13, 1, '#a5704a'); P.rect(0, 8, 13, 1, '#a5704a');
        P.rect(8, 0, 5, 1, '#5fd04a'); P.rect(10, -2, 1, 5, '#5fd04a');
      });
      case 'gear': return build(9, 9, (P) => { P.ball(4.5, 4.5, 4.5, 4.5, ['#6a6880', '#a9a7bd', '#e2e0f0']); P.oval(4.5, 4.5, 1.6, 1.6, '#4a4860'); for (const [x, y] of [[4, 0], [4, 8], [0, 4], [8, 4]]) P.dot(x, y, '#6a6880'); });
    }
  });
}
export function sprinklerIcon(kind, big = true) {
  return memo('spr' + kind + big, () => {
    const col = SPRINKLERS[kind].col;
    return build(9, 9, (P) => {
      P.rect(3, 4, 3, 5, darken(col, 0.3)); P.rect(3, 4, 1, 5, lighten(col, 0.2));
      P.ball(4.5, 3, 3.5, 2.5, [darken(col, 0.35), col, lighten(col, 0.45), '#ffffff']);
      P.dot(4, 0, darken(col, 0.4)); P.rect(1, 8, 7, 1, darken(col, 0.45));
    });
  });
}
export function weatherIcon(kind) {
  return memo('w' + kind, () => {
    switch (kind) {
      case 'clear': return build(9, 9, (P) => {
        for (const [x, y] of [[4, 0], [4, 8], [0, 4], [8, 4], [1, 1], [7, 1], [1, 7], [7, 7]]) P.dot(x, y, '#ffb43a');
        P.ball(4.5, 4.5, 2.8, 2.8, ['#f29a2e', '#ffd23f', '#fff4a0']);
      });
      case 'rain': case 'storm': return build(10, 9, (P) => {
        const dark = kind === 'storm';
        P.ball(3, 3.5, 2.6, 2.4, dark ? ['#4a4a62', '#6e6e8a', '#9a9ab4'] : ['#a8b8d0', '#d8e4f4', '#ffffff']);
        P.ball(6.5, 3, 3.2, 2.8, dark ? ['#4a4a62', '#6e6e8a', '#9a9ab4'] : ['#a8b8d0', '#d8e4f4', '#ffffff']);
        if (dark) { P.line(5, 6, 4, 7, '#ffe14a'); P.line(4, 7, 6, 7, '#ffe14a'); P.line(6, 7, 5, 8, '#ffe14a'); }
        else for (const x of [2, 5, 8]) P.dot(x, 7 + (x % 2), '#5aa8ff');
      });
      case 'snow': return build(9, 9, (P) => {
        P.line(4, 0, 4, 8, '#e0f4ff'); P.line(0, 4, 8, 4, '#e0f4ff'); P.line(1, 1, 7, 7, '#a8d8ff'); P.line(7, 1, 1, 7, '#a8d8ff'); P.dot(4, 4, '#ffffff');
      });
      case 'night': case 'blood': return build(8, 8, (P) => {
        const c = kind === 'blood' ? ['#7a1020', '#e0303a', '#ff8a8a'] : ['#b8b0d8', '#f4f0d0', '#ffffff'];
        P.ball(4, 4, 4, 4, c); P.g.globalCompositeOperation = 'destination-out'; P.oval(6, 2.5, 3, 3, '#000'); P.g.globalCompositeOperation = 'source-over';
      });
    }
  });
}
export function speakerIcon(on) {
  return memo('spk' + on, () => build(9, 7, (P) => {
    P.rect(0, 2, 2, 3, '#fff6dc'); P.line(2, 2, 4, 0, '#fff6dc'); P.line(2, 4, 4, 6, '#fff6dc'); P.rect(3, 1, 2, 5, '#fff6dc');
    if (on) { P.dot(6, 2, '#fff6dc'); P.dot(6, 4, '#fff6dc'); P.line(7, 1, 7, 5, '#fff6dc'); P.dot(8, 0, '#fff6dc'); P.dot(8, 6, '#fff6dc'); }
    else { P.line(6, 1, 8, 5, '#ff7a6a'); P.line(8, 1, 6, 5, '#ff7a6a'); }
  }, INK));
}
export function heart() { return memo('heart', () => build(5, 4, S(['rr.rr', 'rhrrr', '.rrr.', '..r..'], { r: '#ff5a7a', h: '#ffb0c0' }))); }
export function sparkle(i) {
  return memo('spk' + i, () => [
    build(3, 3, S(['.w.', 'www', '.w.'], { w: '#fffbe0' }), false),
    build(5, 5, S(['..w..', '..y..', 'wyWyw', '..y..', '..w..'], { w: '#fff6c0', y: '#ffe060', W: '#ffffff' }), false),
  ][i]);
}

// ---------------------------------------------------------------- stalls
export const STALL_W = 44, STALL_H = 58;
export const STALLS = {
  seeds: { label: 'SEEDS', col: '#4fae5a' },
  sell: { label: 'SELL', col: '#f0a830' },
  gear: { label: 'GEAR', col: '#d9534f' },
  eggs: { label: 'EGGS', col: '#9b6bd6' },
};
export function stallSprites(kind) {
  return memo('stall' + kind, () => {
    const st = STALLS[kind], W = STALL_W, H = STALL_H, wood = PAL.wood;
    const back = canvas(W, H), front = canvas(W, H);
    const B = painter(back), F = painter(front);
    // back wall + shelf with goods
    B.rect(4, 22, W - 8, 18, wood[1]);
    for (let x = 6; x < W - 6; x += 5) B.rect(x, 22, 1, 18, wood[0]);
    B.rect(4, 22, W - 8, 2, darken(wood[1], 0.35));
    B.rect(5, 30, W - 10, 2, wood[3]); B.rect(5, 32, W - 10, 1, wood[0]);
    const R = rng(kind.length * 99);
    for (let x = 7; x < W - 8; x += 4) {
      const t = R();
      if (kind === 'seeds') { const c = ['#4fae5a', '#e8a81e', '#3f86d8', '#e8334a'][Math.floor(t * 4)]; B.rect(x, 26, 3, 4, '#f7e8c6'); B.rect(x, 26, 3, 1, c); }
      else if (kind === 'sell') { B.ball(x + 1.5, 28.5, 1.6, 1.6, [['#a3202e', '#e6413a', '#ff8a6a'], ['#c4561c', '#f0862a', '#ffbd6e'], ['#3f8a3e', '#7ccf55', '#c8f0a0']][Math.floor(t * 3)]); }
      else if (kind === 'gear') { B.rect(x + 1, 24, 1, 6, wood[4]); B.rect(x, 28 + (t > 0.5 ? 0 : 1), 3, 2, '#a9a7bd'); }
      else { B.ball(x + 1.5, 28, 1.4, 1.9, [['#c9b48a', '#f4ead2', '#ffffff'], ['#5fae4c', '#bff0a8', '#ffffff'], ['#3f7fd0', '#a8d4ff', '#ffffff']][Math.floor(t * 3)]); }
    }
    for (let x = 7; x < W - 8; x += 6) B.rect(x, 34, 4, 3, darken(wood[2], 0.2));
    // posts
    for (const x of [3, W - 5]) { F.rect(x, 9, 2, H - 9, wood[2]); F.rect(x, 9, 1, H - 9, wood[4]); }
    // counter
    F.rect(1, 40, W - 2, 3, wood[4]); F.rect(1, 40, W - 2, 1, wood[5]); F.rect(1, 43, W - 2, 1, wood[1]);
    F.rect(2, 44, W - 4, H - 46, wood[3]);
    for (let x = 2; x < W - 2; x += 6) { F.rect(x, 44, 1, H - 46, wood[2]); F.dot(x + 3, 46, wood[2]); F.dot(x + 3, H - 5, wood[2]); }
    F.rect(2, H - 3, W - 4, 2, wood[1]);
    // cloth banner on the counter front
    F.rect(W / 2 - 8, 44, 16, 9, st.col); F.rect(W / 2 - 8, 44, 16, 1, lighten(st.col, 0.35));
    for (let x = W / 2 - 8; x < W / 2 + 8; x += 4) { F.dot(x + 1, 53, st.col); F.dot(x + 2, 53, st.col); F.dot(x + 1, 54, darken(st.col, 0.2)); }
    F.rect(W / 2 - 8, 52, 16, 1, darken(st.col, 0.25));
    // goods on the counter
    if (kind === 'seeds') for (let i = 0; i < 3; i++) { F.rect(6 + i * 4, 36, 3, 4, '#f7e8c6'); F.rect(6 + i * 4, 36, 3, 1, ['#4fae5a', '#e8a81e', '#3f86d8'][i]); }
    if (kind === 'sell') { F.rect(W - 15, 38, 9, 2, '#a9a7bd'); F.rect(W - 11, 34, 1, 4, '#82809a'); F.rect(W - 15, 33, 9, 1, '#a9a7bd'); F.ball(8, 37.5, 2.5, 2.5, ['#a8781a', '#f2c230', '#fff0a0']); F.ball(11, 38.5, 2, 1.6, ['#a8781a', '#f2c230', '#fff0a0']); }
    if (kind === 'gear') { F.rect(6, 36, 7, 4, '#4fae5a'); F.rect(6, 36, 7, 1, '#8fdc7a'); F.line(13, 37, 15, 35, '#3f9a4a'); }
    if (kind === 'eggs') { F.oval(W - 10, 38.5, 5, 2, '#a8784a'); F.ball(W - 12, 36.5, 1.6, 2, ['#c9b48a', '#f4ead2', '#ffffff']); F.ball(W - 9, 36, 1.6, 2, ['#5fae4c', '#bff0a8', '#ffffff']); F.rect(W - 15, 38, 10, 2, '#c89a5a'); }
    // awning with scalloped edge
    const ay = 11, aw = W, sw = 5;
    for (let x = 0; x < aw; x++) {
      const stripe = Math.floor(x / sw) % 2 === 0, col = stripe ? st.col : '#fff2d6';
      F.rect(x, ay, 1, 9, col);
      F.rect(x, ay + 6, 1, 3, darken(col, 0.12));
      F.dot(x, ay, lighten(col, 0.35));
      const lx = x % sw;
      if (lx >= 1 && lx <= 3) F.dot(x, ay + 9, darken(col, 0.12));
      if (lx === 2) F.dot(x, ay + 10, darken(col, 0.2));
    }
    F.rect(0, ay - 1, aw, 1, darken(st.col, 0.45));
    // sign board
    const tw = textWidth(st.label), sw2 = tw + 8, sx = Math.round((W - sw2) / 2);
    F.rect(sx, 0, sw2, 10, wood[3]); F.rect(sx, 0, sw2, 1, wood[5]); F.rect(sx, 9, sw2, 1, wood[1]);
    F.rect(sx, 0, 1, 10, wood[1]); F.rect(sx + sw2 - 1, 0, 1, 10, wood[1]);
    F.dot(sx + 2, 2, wood[1]); F.dot(sx + sw2 - 3, 2, wood[1]);
    text(F.g, st.label, W / 2, 2, '#3a2421', { align: 'center', shadow: wood[5] });
    // lantern
    F.rect(W - 4, 20, 1, 2, INK); F.rect(W - 6, 22, 5, 5, INK); F.rect(W - 5, 23, 3, 3, '#ffd36b'); F.dot(W - 5, 23, '#fff6c0');
    addOutline(back, 'sel'); addOutline(front, 'sel');
    return { back, front };
  });
}

// ---------------------------------------------------------------- scenery
export function cloudSprite(i, dark = false) {
  return memo(`cloud${i}${dark}`, () => {
    const R = rng(i * 77 + 3), w = 26 + i * 8, h = 12 + i * 2;
    const c = canvas(w, h), P = painter(c);
    const cols = dark ? ['#6e7088', '#8e90a8', '#b0b2c6'] : ['#c4d8ee', '#eef6ff', '#ffffff'];
    const n = 4 + i;
    for (let k = 0; k < n; k++) {
      const x = 5 + (k / (n - 1)) * (w - 10) + (R() - 0.5) * 3, r = 3.5 + R() * (2.5 + i) * (1 - Math.abs(k / (n - 1) - 0.5));
      P.ball(x, h - r - 1, r * 1.15, r, cols, { hi: 0.25, lo: -0.15 });
    }
    P.rect(3, h - 3, w - 6, 2, cols[0]);
    return c;
  });
}
export function bush(seed, r = 5) {
  return memo(`bush${seed}|${r}`, () => build(r * 2 + 4, r * 2, (P) => {
    const R = rng(seed);
    P.ball(r * 0.7 + 1, r * 1.1, r * 0.75, r * 0.7, LEAF);
    P.ball(r * 1.4 + 3, r * 1.15, r * 0.75, r * 0.65, LEAF);
    P.ball(r + 2, r * 0.9, r * 0.85, r * 0.8, LEAF);
    if (R() > 0.4) for (let k = 0; k < 3; k++) { const x = 2 + R() * r * 2, y = 2 + R() * r; P.dot(x, y, R() > 0.5 ? '#ff8ab0' : '#fff6e8'); }
  }));
}
export function treeSprite(seed) {
  return memo('tree' + seed, () => build(26, 34, (P) => {
    P.rect(11, 18, 4, 16, '#6b4428'); P.rect(11, 18, 1, 16, '#9a6a40');
    P.ball(13, 13, 11, 10, LEAF); P.ball(7, 17, 6, 5, LEAF); P.ball(19, 16, 6, 5.5, LEAF); P.ball(12, 7, 7, 6, LEAF);
  }));
}
export function lampSprite() {
  return memo('lamp', () => build(5, 20, (P) => {
    P.rect(2, 4, 1, 16, '#3a3448'); P.rect(1, 19, 3, 1, '#3a3448');
    P.rect(0, 0, 5, 1, '#3a3448'); P.rect(0, 1, 5, 3, '#ffd36b'); P.dot(1, 1, '#fff6c0'); P.rect(0, 4, 5, 1, '#3a3448');
  }, INK));
}
export function flowerPot(seed) {
  return memo('pot' + seed, () => build(7, 9, (P) => {
    const c = ['#ff6a8a', '#ffd23f', '#9a7aff', '#ff8a3a'][seed % 4];
    P.rect(1, 5, 5, 4, '#c8603a'); P.rect(0, 5, 7, 1, '#e07a4a'); P.rect(5, 6, 1, 3, '#9a4428');
    P.ball(3.5, 3, 3.5, 2.6, LEAF);
    P.dot(2, 1, c); P.dot(5, 2, c); P.dot(3, 3, c); P.dot(1, 3, c);
  }));
}
export function signSprite() {
  return memo('sign', () => build(30, 16, (P) => {
    P.rect(13, 9, 3, 7, PAL.wood[2]); P.rect(13, 9, 1, 7, PAL.wood[3]);
    P.rect(0, 0, 30, 11, PAL.wood[3]); P.rect(0, 0, 30, 1, PAL.wood[5]); P.rect(0, 10, 30, 1, PAL.wood[1]);
    P.rect(1, 1, 28, 9, PAL.wood[4]);
  }));
}
export function pointerSprite() {
  return memo('hand', () => build(9, 11, S([
    '...ww....', '...wW....', '...wW....', '...wWwww.', '.wwwWWWWw', 'wWwWWWWWw', 'wWWWWWWWw', '.wWWWWWWw', '..wWWWWw.', '...wWWWw.', '...wwww..',
  ], { w: '#fff6dc', W: '#ffe0c0' }), INK));
}
