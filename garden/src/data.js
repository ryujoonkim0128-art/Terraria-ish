// Game content: crops, mutations, weather and timing. All times in seconds, distances in voxels.

export const RARITIES = {
  common: { name: 'Common', col: '#c9c4d6', chance: 1, qty: [4, 9] },
  uncommon: { name: 'Uncommon', col: '#7be36d', chance: 0.75, qty: [2, 5] },
  rare: { name: 'Rare', col: '#62b3ff', chance: 0.5, qty: [1, 3] },
  legendary: { name: 'Legendary', col: '#ffd23f', chance: 0.3, qty: [1, 2] },
  mythical: { name: 'Mythical', col: '#d08bff', chance: 0.14, qty: [1, 2] },
  divine: { name: 'Divine', col: '#ff9a4a', chance: 0.06, qty: [1, 1] },
  prismatic: { name: 'Prismatic', col: '#ff8fd8', chance: 0.025, qty: [1, 1] },
};

// multi: keeps fruiting after it is grown (n fruits, each regrows in `regrow`). r: room the plant needs.
export const CROPS = [
  { id: 'carrot', name: 'Carrot', rarity: 'common', price: 10, grow: 25, value: 20, kg: 0.24, r: 1.6 },
  { id: 'strawberry', name: 'Strawberry', rarity: 'common', price: 50, grow: 40, multi: true, n: 3, regrow: 20, value: 16, kg: 0.29, r: 2.6 },
  { id: 'blueberry', name: 'Blueberry', rarity: 'uncommon', price: 350, grow: 60, multi: true, n: 5, regrow: 25, value: 32, kg: 0.17, r: 3 },
  { id: 'tulip', name: 'Orange Tulip', rarity: 'uncommon', price: 500, grow: 50, value: 1200, kg: 0.05, r: 1.7 },
  { id: 'tomato', name: 'Tomato', rarity: 'rare', price: 800, grow: 80, multi: true, n: 3, regrow: 30, value: 60, kg: 0.44, r: 2.8 },
  { id: 'corn', name: 'Corn', rarity: 'rare', price: 1300, grow: 90, multi: true, n: 2, regrow: 35, value: 140, kg: 1.9, r: 2.8 },
  { id: 'watermelon', name: 'Watermelon', rarity: 'legendary', price: 2500, grow: 110, value: 6000, kg: 7.3, r: 4.2 },
  { id: 'pumpkin', name: 'Pumpkin', rarity: 'legendary', price: 3000, grow: 120, value: 7500, kg: 6.9, r: 4 },
  { id: 'apple', name: 'Apple', rarity: 'legendary', price: 3250, grow: 150, multi: true, n: 5, regrow: 40, value: 250, kg: 2.9, r: 5.2 },
  { id: 'coconut', name: 'Coconut', rarity: 'mythical', price: 6000, grow: 180, multi: true, n: 3, regrow: 50, value: 1000, kg: 5.8, r: 4.5 },
  { id: 'dragonfruit', name: 'Dragon Fruit', rarity: 'mythical', price: 50000, grow: 200, multi: true, n: 3, regrow: 55, value: 4500, kg: 11.4, r: 4 },
  { id: 'mango', name: 'Mango', rarity: 'mythical', price: 100000, grow: 240, multi: true, n: 4, regrow: 60, value: 6000, kg: 14.3, r: 5.4 },
  { id: 'grape', name: 'Grape', rarity: 'divine', price: 850000, grow: 300, multi: true, n: 4, regrow: 70, value: 40000, kg: 2.9, r: 4.4 },
  { id: 'mushroom', name: 'Mushroom', rarity: 'divine', price: 150000, grow: 220, value: 450000, kg: 25.9, r: 4.2 },
  { id: 'beanstalk', name: 'Beanstalk', rarity: 'prismatic', price: 10000000, grow: 400, multi: true, n: 3, regrow: 90, value: 300000, kg: 9.5, r: 3.6 },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

// Environmental mutations add together; growth mutations (gold, rainbow) multiply.
export const MUTS = {
  rainbow: { name: 'Rainbow', mult: 50, growth: true, col: '#ff8fd8' },
  gold: { name: 'Gold', mult: 20, growth: true, col: '#ffd23f' },
  shocked: { name: 'Shocked', mult: 100, col: '#fff36b' },
  frozen: { name: 'Frozen', mult: 10, col: '#9fe4ff' },
  bloodlit: { name: 'Bloodlit', mult: 4, col: '#ff4b5c' },
  moonlit: { name: 'Moonlit', mult: 2, col: '#b9a2ff' },
  chilled: { name: 'Chilled', mult: 2, col: '#cdeeff' },
  wet: { name: 'Wet', mult: 2, col: '#6cb6ff' },
};
export const MUT_ORDER = Object.keys(MUTS);
export function mutMult(muts) {
  let g = 1, env = 1;
  for (const m of muts || []) {
    const d = MUTS[m];
    if (!d) continue;
    if (d.growth) g *= d.mult; else env += d.mult - 1;
  }
  return g * env;
}
export const fruitValue = (crop, size, muts) => Math.max(1, Math.round(CROP[crop].value * size * size * mutMult(muts)));

export const WEATHER = {
  clear: { name: 'Sunny', grow: 1 },
  rain: { name: 'Rain', grow: 1.5, msg: 'Rain! Crops grow faster and fruit can get Wet (x2).' },
  storm: { name: 'Storm', grow: 1.5, msg: 'Thunderstorm! Lightning can Shock your fruit (x100).' },
  snow: { name: 'Snow', grow: 1, msg: 'Snow! Fruit can get Chilled, or Frozen if Wet (x10).' },
};
export const DAY_LEN = 600;
export const NIGHT_START = 0.68, NIGHT_END = 0.96;
export const RESTOCK = 300;
export const BASKET = 300;
export const MAX_PLANTS = 90;

// the garden bed, in voxels
export const BED = { rx: 27, rz: 28, top: 2 };
export function bedR(a) { return 1 + 0.06 * Math.sin(3 * a + 0.5) + 0.04 * Math.sin(5 * a + 2) + 0.02 * Math.sin(9 * a); }
export function inBed(x, z, margin = 0) {
  const a = Math.atan2(z / BED.rz, x / BED.rx);
  const r = bedR(a);
  const d = Math.hypot(x / BED.rx, z / BED.rz);
  return d < r - margin / BED.rx;
}
