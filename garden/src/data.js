// Crops, mutations, weather and gear. Numbers are tuned for a phone session (seconds, not hours).

export const SEEDS = [
  { id: 'carrot',     name: 'CARROT',      price: 10,     sell: 18,   grow: 40,  multi: false, form: 'ground', fruit: '#f08a24', dark: '#c46514', chance: 1,    stock: [10, 25], baseW: 0.3 },
  { id: 'strawberry', name: 'STRAWBERRY',  price: 50,     sell: 14,   grow: 80,  multi: true,  form: 'bush',   fruit: '#e63946', dark: '#a8202c', chance: 1,    stock: [3, 6],   baseW: 0.3, yield: [2, 4] },
  { id: 'blueberry',  name: 'BLUEBERRY',   price: 400,    sell: 18,   grow: 120, multi: true,  form: 'bush',   fruit: '#4361ee', dark: '#2a3fb5', chance: 1,    stock: [2, 5],   baseW: 0.2, yield: [2, 5] },
  { id: 'tulip',      name: 'ORANGE TULIP', price: 600,   sell: 750,  grow: 100, multi: false, form: 'flower', fruit: '#ff7b1c', dark: '#c85a0a', chance: 0.4,  stock: [5, 20],  baseW: 0.05 },
  { id: 'tomato',     name: 'TOMATO',      price: 800,    sell: 27,   grow: 150, multi: true,  form: 'bush',   fruit: '#e8341c', dark: '#a82212', chance: 1,    stock: [1, 4],   baseW: 0.5, yield: [2, 4] },
  { id: 'corn',       name: 'CORN',        price: 1300,   sell: 36,   grow: 160, multi: true,  form: 'stalk',  fruit: '#f6d53a', dark: '#c9a81c', chance: 0.6,  stock: [1, 3],   baseW: 2.0, yield: [1, 3] },
  { id: 'daffodil',   name: 'DAFFODIL',    price: 1000,   sell: 900,  grow: 140, multi: false, form: 'flower', fruit: '#ffe66d', dark: '#d9b821', chance: 0.4,  stock: [3, 8],   baseW: 0.2 },
  { id: 'watermelon', name: 'WATERMELON',  price: 2500,   sell: 2700, grow: 240, multi: false, form: 'vine',   fruit: '#2d9d4f', dark: '#1d6b35', chance: 0.4,  stock: [1, 4],   baseW: 7.0 },
  { id: 'pumpkin',    name: 'PUMPKIN',     price: 3000,   sell: 3000, grow: 280, multi: false, form: 'vine',   fruit: '#f5862b', dark: '#c45f10', chance: 0.4,  stock: [1, 4],   baseW: 7.0 },
  { id: 'apple',      name: 'APPLE',       price: 3250,   sell: 248,  grow: 320, multi: true,  form: 'tree',   fruit: '#e4342a', dark: '#a81f18', chance: 0.4,  stock: [1, 3],   baseW: 3.0, yield: [2, 4] },
  { id: 'bamboo',     name: 'BAMBOO',      price: 4000,   sell: 3600, grow: 200, multi: false, form: 'stalk',  fruit: '#7ccf5a', dark: '#4e9a36', chance: 0.4,  stock: [5, 15],  baseW: 4.0 },
  { id: 'coconut',    name: 'COCONUT',     price: 6000,   sell: 360,  grow: 400, multi: true,  form: 'tree',   fruit: '#8d6748', dark: '#5f432c', chance: 0.3,  stock: [1, 2],   baseW: 14.0, yield: [1, 3] },
  { id: 'cactus',     name: 'CACTUS',      price: 15000,  sell: 3000, grow: 420, multi: true,  form: 'cactus', fruit: '#f05fa3', dark: '#b83a78', chance: 0.25, stock: [1, 2],   baseW: 7.0, yield: [1, 2] },
  { id: 'dragon',     name: 'DRAGONFRUIT', price: 50000,  sell: 4300, grow: 480, multi: true,  form: 'tree',   fruit: '#ff4f9a', dark: '#c0266c', chance: 0.2,  stock: [1, 2],   baseW: 12.0, yield: [1, 2] },
  { id: 'mango',      name: 'MANGO',       price: 100000, sell: 5800, grow: 540, multi: true,  form: 'tree',   fruit: '#ffb627', dark: '#d1860a', chance: 0.15, stock: [1, 2],   baseW: 15.0, yield: [1, 3] },
  { id: 'grape',      name: 'GRAPE',       price: 850000, sell: 7000, grow: 600, multi: true,  form: 'bush',   fruit: '#8e44ad', dark: '#5f2d78', chance: 0.1,  stock: [1, 1],   baseW: 3.0, yield: [2, 4] },
];
export const SEED = Object.fromEntries(SEEDS.map((s) => [s.id, s]));

// Growth mutations are rolled once when a crop ripens; environmental ones come from weather while it waits.
export const MUT = {
  Gold:    { mult: 20,  kind: 'growth', fruit: '#ffd23f', dark: '#d9a400' },
  Rainbow: { mult: 50,  kind: 'growth' },
  Wet:     { mult: 2,   kind: 'env' },
  Chilled: { mult: 2,   kind: 'env', fruit: '#bfe9ff', dark: '#7cc7f0' },
  Frozen:  { mult: 10,  kind: 'env', fruit: '#e6f8ff', dark: '#9fdcff', leaf: '#9fdcff', leafDark: '#5fb0e8' },
  Shocked: { mult: 100, kind: 'env', fruit: '#fff58a', dark: '#e5d13a' },
};
export const MUT_ORDER = ['Shocked', 'Frozen', 'Chilled', 'Wet', 'Rainbow', 'Gold'];

export const WEATHER = {
  SUNNY:   { growth: 1,   label: 'SUNNY' },
  RAIN:    { growth: 1.5, label: 'RAIN',    wet: 0.06 },
  FROST:   { growth: 1,   label: 'FROST',   chill: 0.06 },
  THUNDER: { growth: 1.5, label: 'THUNDER', wet: 0.06, shock: 0.006 },
};

export const GEAR = {
  can:       { name: 'WATERING CAN', price: 50,   desc: '10 USES, +30S EACH' },
  sprinkler: { name: 'SPRINKLER',    price: 1500, desc: 'PLACE ON PLOT 5MIN' },
};
export const SPRINKLER_TIME = 300;
export const RESTOCK = 300;
export const EXPANSIONS = [{ cols: 5, rows: 5, price: 500 }, { cols: 5, rows: 6, price: 2500 }, { cols: 6, rows: 6, price: 12000 }, { cols: 6, rows: 7, price: 60000 }];

export function itemValue(item) {
  const s = SEED[item.crop];
  const ratio = item.w / s.baseW;
  let growth = 1, env = 1;
  for (const m of item.muts) { if (MUT[m].kind === 'growth') growth = Math.max(growth, MUT[m].mult); else env += MUT[m].mult - 1; }
  return Math.round(s.sell * Math.max(1, ratio * ratio) * growth * env);
}
