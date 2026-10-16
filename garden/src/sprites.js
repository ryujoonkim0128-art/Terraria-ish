// Pixel sprites and a 3x5 bitmap font, all drawn from ASCII with a 1px ink outline. Flat colours, no shading.
import { SEED, MUT } from './data.js';

export const INK = '#1c1c1c';

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  return [c, x];
}
function hexRGB(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function outline(c, col = INK) {
  const x = c.getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data, W = c.width, H = c.height;
  const src = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) src[i] = a[i * 4 + 3] > 0 ? 1 : 0;
  const [r, g, b] = hexRGB(col);
  for (let y = 0; y < H; y++) for (let x2 = 0; x2 < W; x2++) {
    const i = y * W + x2;
    if (src[i]) continue;
    if ((x2 > 0 && src[i - 1]) || (x2 < W - 1 && src[i + 1]) || (y > 0 && src[i - W]) || (y < H - 1 && src[i + W])) { a[i * 4] = r; a[i * 4 + 1] = g; a[i * 4 + 2] = b; a[i * 4 + 3] = 255; }
  }
  x.putImageData(d, 0, 0);
  return c;
}

// ASCII rows -> outlined canvas. pal maps characters to colours; '.' is transparent.
export function ascii(rows, pal, pad = 1) {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const [c, x] = canvas(w + pad * 2, h + pad * 2);
  rows.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const col = pal[row[i]]; if (col) { x.fillStyle = col; x.fillRect(i + pad, y + pad, 1, 1); } } });
  return pad ? outline(c) : c;
}

// ------------------------------------------------------------------ font
const GLYPHS = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001011001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', '!': '010010010000010', '?': '111001011000010', '-': '000000111000000',
  '+': '000010111010000', '/': '001001010100100', '%': '101001010100101', '(': '010100100100010', ')': '010001001001010', "'": '010010000000000',
  '>': '100010001010100', '<': '001010100010001', '=': '000111000111000', 'x': '000101010101000', '$': '010111110011111',
};
const glyphCache = new Map();
function glyph(ch, col) {
  const key = ch + col;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const bits = GLYPHS[ch] || GLYPHS[ch.toUpperCase()];
  let c = null;
  if (bits) {
    const [cv, x] = canvas(3, 5);
    x.fillStyle = col;
    for (let i = 0; i < 15; i++) if (bits[i] === '1') x.fillRect(i % 3, (i / 3) | 0, 1, 1);
    c = cv;
  }
  glyphCache.set(key, c);
  return c;
}
export function textWidth(str, size = 1) { return (str.length * 4 - 1) * size; }
export function text(ctx, str, x, y, col = INK, size = 1, align = 'left') {
  str = String(str);
  if (align === 'center') x -= (textWidth(str, size) / 2) | 0; else if (align === 'right') x -= textWidth(str, size);
  for (let i = 0; i < str.length; i++) {
    const g = glyph(str[i], col);
    if (g) ctx.drawImage(g, x, y, 3 * size, 5 * size);
    x += 4 * size;
  }
}

// ------------------------------------------------------------------ plants
// L leaf, l dark leaf, S stem, T trunk, F fruit, f dark fruit. Fruits become leaves until the crop is ripe.
const SPROUT = ['L...L', 'lL.Ll', '.lSl.', '..S..'];
const FORMS = {
  ground: { small: ['.L.L.', 'lL.Ll', '.lSl.', '..S..'], full: ['.L..L..L.', '.lL.L.Ll.', '..lLLLl..', '..FFFFF..', '...fFf...'] },
  bush:   { small: ['..LLL..', '.LLlLL.', 'LLlLLlL', '.lLLLl.', '..lSl..'],
            full: ['...LLLL...', '..LLFLLLL.', '.LLLLLlLLL', 'LLFLLLLLFL', 'LLLLlLLLLL', '.LLLFLLLL.', '..llLLll..', '...lSSl...'] },
  stalk:  { small: ['.L.', 'LSL', '.S.', 'LS.', '.S.'], full: ['..L..L..', '.LlL.lL.', 'L.lSlL..', '.LlSlL..', '..lSl.L.', '.LFSFl..', '..lSl...', '..lSl...'] },
  flower: { small: ['.L.', 'LSL', '.S.', '.S.'], full: ['..FF..', '.FfFF.', '.FFfF.', '..fF..', 'L.S.L.', '.lSl..', '..S...'] },
  vine:   { small: ['L..L', 'lLLl', '.lS.', '..S.'], full: ['L..LL..L', 'lL.lL.Ll', '.lLLLLl.', '..FFFF..', '.FfFFFf.', '.FFFFFF.', '..ffff..'] },
  tree:   { small: ['.LLL.', 'LLlLL', '.lLl.', '..T..', '..T..'],
            full: ['...LLLLL...', '..LLFLLLL..', '.LLLLLLlLL.', '.LFLLLLLFL.', '.LLLLlLLLL.', '..LLFLLLl..', '...llLll...', '.....T.....', '.....T.....', '....TT.....'] },
  cactus: { small: ['.LL.', '.LL.', 'lLLl', '.LL.'], full: ['...FF...', '...LL...', 'LL.LL.LL', 'LL.LL.LL', 'lLLLLLLl', '..lLLl..', '...LL...', '...lL...'] },
};
const spriteCache = new Map();
export function plantSprite(crop, stage, muts, hue) {
  // stage: 0 sprout, 1 small, 2 full (unripe), 3 ripe
  const key = crop + stage + muts.join() + (hue | 0);
  if (spriteCache.has(key)) return spriteCache.get(key);
  const s = SEED[crop], form = FORMS[s.form];
  let rows = stage === 0 ? SPROUT : stage === 1 ? form.small : form.full;
  let fruit = s.fruit, dark = s.dark, leaf = '#3cb043', leafDark = '#2a7d31';
  if (s.form === 'cactus') { leaf = '#4caf50'; leafDark = '#2e7d32'; }
  for (const m of muts) { const d = MUT[m]; if (d.fruit) { fruit = d.fruit; dark = d.dark; } if (d.leaf) { leaf = d.leaf; leafDark = d.leafDark; } }
  if (muts.includes('Rainbow')) { fruit = `hsl(${hue},90%,55%)`; dark = `hsl(${(hue + 40) % 360},90%,40%)`; }
  if (stage < 3) rows = rows.map((r) => r.replace(/F/g, 'L').replace(/f/g, 'l'));
  const c = ascii(rows, { L: leaf, l: leafDark, S: '#2a7d31', T: '#8d5a2b', F: fruit, f: dark });
  if (muts.includes('Wet') && stage === 3) { const x = c.getContext('2d'); x.fillStyle = '#4cc9f0'; for (const [px, py] of [[2, 2], [c.width - 3, 4], [4, c.height - 4]]) x.fillRect(px, py, 1, 2); }
  if (muts.includes('Shocked') && stage === 3) { const x = c.getContext('2d'); x.fillStyle = '#ffffff'; for (const [px, py] of [[1, 1], [c.width - 2, 2], [3, c.height - 3]]) x.fillRect(px, py, 1, 1); }
  spriteCache.set(key, c);
  return c;
}

// ------------------------------------------------------------------ icons
const ICON = {
  coin:      ['.YYYY.', 'YYyYYY', 'YYyyYY', 'YYyYYY', '.YYYY.'],
  can:       ['...GG.', 'GGGGGG', 'G.GGGG', '..GGGG', '..GGGG'],
  sprinkler: ['..GG..', '..GG..', '.GGGG.', '.GGGG.', 'GGGGGG'],
  seed:      ['..W..', '.WWw.', 'WWwww', '.www.', '..w..'],
  drop:      ['..B..', '.BBB.', 'BBBBB', 'BBBBB', '.BBB.'],
  snow:      ['B.B.B', '.BBB.', 'BBBBB', '.BBB.', 'B.B.B'],
  bolt:      ['..YY.', '.YY..', 'YYYY.', '..YY.', '.YY..'],
  sun:       ['.YYY.', 'YYYYY', 'YYyYY', 'YYYYY', '.YYY.'],
  x:         ['R...R', '.R.R.', '..R..', '.R.R.', 'R...R'],
  check:     ['....g', '...gg', 'g.gg.', 'ggg..', '.g...'],
  plus:      ['..G..', '..G..', 'GGGGG', '..G..', '..G..'],
};
const ICONPAL = { Y: '#ffd23f', y: '#d9a400', G: '#7d8597', g: '#3cb043', W: '#f1e4c7', w: '#c8b48a', B: '#4cc9f0', R: '#1c1c1c' };
const iconCache = new Map();
export function icon(name) {
  if (!iconCache.has(name)) iconCache.set(name, ascii(ICON[name], ICONPAL));
  return iconCache.get(name);
}
// Round fruit badge for lists.
const FRUIT = ['..L...', '.FFFF.', 'FFWFFF', 'FFFFFF', 'FFFFFF', '.ffff.'];
export function fruitIcon(crop, muts = []) {
  const key = 'fruit' + crop + muts.join();
  if (iconCache.has(key)) return iconCache.get(key);
  const s = SEED[crop];
  let fruit = s.fruit, dark = s.dark;
  for (const m of muts) { const d = MUT[m]; if (d && d.fruit) { fruit = d.fruit; dark = d.dark; } }
  if (muts.includes('Rainbow')) { fruit = '#ff4fd8'; dark = '#5f5fff'; }
  const c = ascii(FRUIT, { L: '#3cb043', F: fruit, f: dark, W: '#ffffff' });
  iconCache.set(key, c);
  return c;
}
