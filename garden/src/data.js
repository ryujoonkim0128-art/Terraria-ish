// Game content: crops, mutations, weather and timing. All times in seconds, distances in voxels.

export const RARITIES = {
  common: { name: 'Common', col: '#c9c4d6', chance: 1, qty: [3, 6] },
  uncommon: { name: 'Uncommon', col: '#7be36d', chance: 1, qty: [1, 3] },
  rare: { name: 'Rare', col: '#62b3ff', chance: 0.85, qty: [1, 2] },
  legendary: { name: 'Legendary', col: '#ffd23f', chance: 0.6, qty: [1, 1] },
  mythical: { name: 'Mythical', col: '#d08bff', chance: 0.3, qty: [1, 1] },
  divine: { name: 'Divine', col: '#ff9a4a', chance: 0.12, qty: [1, 1] },
  prismatic: { name: 'Prismatic', col: '#ff8fd8', chance: 0.05, qty: [1, 1] },
};

// multi: keeps fruiting after it is grown (n fruits, each regrows in `regrow`). r: room the plant needs.
// size: how big the plant is drawn (the starter crops are kept small so a young garden stays tidy).
// qty: how many the shop gets per restock, when it differs from the rarity's usual amount.
// Prices and sell values come from test/economy.mjs: the two carrots you start with pay for a Strawberry within the
// tutorial, an attentive player gets Blueberry about four minutes later, Tulip ten after that, and each seed after
// takes longer, up to two hours for the Beanstalk: about eleven hours from a fresh start, Market Day included.
export const CROPS = [
  { id: 'carrot', name: 'Carrot', rarity: 'common', price: 10, grow: 30, value: 15, kg: 0.24, r: 1.2, size: 0.68, qty: [10, 15] },
  { id: 'strawberry', name: 'Strawberry', rarity: 'common', price: 25, grow: 20, multi: true, n: 3, regrow: 17, value: 2, kg: 0.29, r: 1.9, size: 0.7, qty: [10, 14] },
  { id: 'blueberry', name: 'Blueberry', rarity: 'uncommon', price: 380, grow: 30, multi: true, n: 5, regrow: 20, value: 8, kg: 0.17, r: 2.3, size: 0.76, qty: [8, 12] },
  { id: 'tulip', name: 'Orange Tulip', rarity: 'uncommon', price: 25000, grow: 60, value: 30000, kg: 0.05, r: 1.3, size: 0.78 },
  { id: 'tomato', name: 'Tomato', rarity: 'rare', price: 330000, grow: 60, multi: true, n: 3, regrow: 25, value: 2300, kg: 0.44, r: 2.3, size: 0.85 },
  { id: 'corn', name: 'Corn', rarity: 'rare', price: 500000, grow: 70, multi: true, n: 2, regrow: 30, value: 3900, kg: 1.9, r: 2.5, size: 0.88 },
  { id: 'watermelon', name: 'Watermelon', rarity: 'legendary', price: 2200000, grow: 120, value: 2500000, kg: 7.3, r: 4.2 },
  { id: 'pumpkin', name: 'Pumpkin', rarity: 'legendary', price: 33000000, grow: 135, value: 37000000, kg: 6.9, r: 4 },
  { id: 'apple', name: 'Apple', rarity: 'legendary', price: 370000000, grow: 100, multi: true, n: 5, regrow: 35, value: 780000, kg: 2.9, r: 5.2 },
  { id: 'coconut', name: 'Coconut', rarity: 'mythical', price: 560000000, grow: 120, multi: true, n: 3, regrow: 40, value: 1600000, kg: 5.8, r: 4.5 },
  { id: 'dragonfruit', name: 'Dragon Fruit', rarity: 'mythical', price: 2400000000, grow: 140, multi: true, n: 3, regrow: 45, value: 5200000, kg: 11.4, r: 4 },
  { id: 'mango', name: 'Mango', rarity: 'mythical', price: 11000000000, grow: 160, multi: true, n: 4, regrow: 50, value: 14000000, kg: 14.3, r: 5.4 },
  { id: 'grape', name: 'Grape', rarity: 'divine', price: 26000000000, grow: 200, multi: true, n: 4, regrow: 60, value: 31000000, kg: 2.9, r: 4.4 },
  { id: 'mushroom', name: 'Mushroom', rarity: 'divine', price: 96000000000, grow: 240, value: 110000000000, kg: 25.9, r: 4.2 },
  { id: 'beanstalk', name: 'Beanstalk', rarity: 'prismatic', price: 3200000000000, grow: 300, multi: true, n: 3, regrow: 80, value: 5100000000, kg: 9.5, r: 3.6 },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));
const PLURAL = { Strawberry: 'Strawberries', Blueberry: 'Blueberries', Tomato: 'Tomatoes', Mango: 'Mangoes', Corn: 'Corn', 'Dragon Fruit': 'Dragon Fruit', Beanstalk: 'Beanstalk beans' };
export const plural = (id) => PLURAL[CROP[id].name] || CROP[id].name + 's';

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
// Market Day: every twelve minutes two pop-up carts open on the plaza for four, each selling seeds from its pool
export const MARKET_LEN = 240, MARKET_GAP = 720;
export const POOLS = { veg: ['tulip', 'tomato', 'corn', 'watermelon', 'pumpkin', 'mushroom', 'beanstalk'], berry: ['blueberry', 'apple', 'coconut', 'dragonfruit', 'mango', 'grape'] };
export const BASKET = 200;
export const MAX_PLANTS = 120;

// the garden bed: a neat rectangle of soil cells, x0..x1 by z0..z1, its surface at height `top`
export const BED = { x0: -32, x1: 32, z0: -30, z1: 30, top: 2 };
export const inRect = (R, x, z, margin = 0) => x >= R.x0 - 0.5 + margin && x <= R.x1 + 0.5 - margin && z >= R.z0 - 0.5 + margin && z <= R.z1 + 0.5 - margin;
export const inBed = (x, z, margin = 0) => inRect(BED, x, z, margin);
// The five other gardens on the street, each the size of yours: one either side of it and three across the market
// street. `face` points along z to the street; each owner's home spot is on the far side, like yours.
export const PLOTS = [
  { x0: -110, x1: -46, z0: -30, z1: 30, face: -1 },
  { x0: 46, x1: 110, z0: -30, z1: 30, face: -1 },
  { x0: -110, x1: -46, z0: -172, z1: -112, face: 1 },
  { x0: -32, x1: 32, z0: -172, z1: -112, face: 1 },
  { x0: 46, x1: 110, z0: -172, z1: -112, face: 1 },
].map((R) => ({ ...R, top: BED.top, cx: (R.x0 + R.x1) / 2, cz: (R.z0 + R.z1) / 2 }));
export const plotHome = (R) => ({ x: R.cx, z: R.face < 0 ? R.z1 + 9 : R.z0 - 9 });
export const plotAt = (x, z, margin = 0) => PLOTS.findIndex((R) => inRect(R, x, z, margin));
