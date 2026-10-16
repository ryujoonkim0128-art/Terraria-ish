// Game content: crops, mutations, gear, eggs, pets, weather. All times in seconds.

export const RARITIES = {
  common: { name: 'Common', col: '#c9c4d6', dark: '#6e6880', chance: 1, qty: [4, 9] },
  uncommon: { name: 'Uncommon', col: '#7be36d', dark: '#2f7d3a', chance: 0.75, qty: [2, 5] },
  rare: { name: 'Rare', col: '#62b3ff', dark: '#2a5aa8', chance: 0.5, qty: [1, 3] },
  legendary: { name: 'Legendary', col: '#ffd23f', dark: '#a87818', chance: 0.3, qty: [1, 2] },
  mythical: { name: 'Mythical', col: '#d08bff', dark: '#6b3aa0', chance: 0.14, qty: [1, 2] },
  divine: { name: 'Divine', col: '#ff9a4a', dark: '#a8451e', chance: 0.06, qty: [1, 1] },
  prismatic: { name: 'Prismatic', col: '#ff8fd8', dark: '#7a3a8a', chance: 0.025, qty: [1, 1], rainbow: true },
};
export const RARITY_ORDER = Object.keys(RARITIES);

// multi: keeps fruiting after it is grown (n fruits, each regrows in `regrow`).
export const CROPS = [
  { id: 'carrot', name: 'Carrot', rarity: 'common', price: 10, grow: 25, value: 20, kg: 0.24 },
  { id: 'strawberry', name: 'Strawberry', rarity: 'common', price: 50, grow: 40, multi: true, n: 3, regrow: 20, value: 16, kg: 0.29 },
  { id: 'blueberry', name: 'Blueberry', rarity: 'uncommon', price: 350, grow: 60, multi: true, n: 4, regrow: 25, value: 40, kg: 0.17 },
  { id: 'tulip', name: 'Orange Tulip', rarity: 'uncommon', price: 500, grow: 50, value: 1200, kg: 0.05 },
  { id: 'tomato', name: 'Tomato', rarity: 'rare', price: 800, grow: 80, multi: true, n: 3, regrow: 30, value: 60, kg: 0.44 },
  { id: 'corn', name: 'Corn', rarity: 'rare', price: 1300, grow: 90, multi: true, n: 2, regrow: 35, value: 140, kg: 1.9 },
  { id: 'watermelon', name: 'Watermelon', rarity: 'legendary', price: 2500, grow: 110, value: 6000, kg: 7.3 },
  { id: 'pumpkin', name: 'Pumpkin', rarity: 'legendary', price: 3000, grow: 120, value: 7500, kg: 6.9 },
  { id: 'apple', name: 'Apple', rarity: 'legendary', price: 3250, grow: 150, multi: true, n: 5, regrow: 40, value: 250, kg: 2.9 },
  { id: 'coconut', name: 'Coconut', rarity: 'mythical', price: 6000, grow: 180, multi: true, n: 3, regrow: 50, value: 1000, kg: 5.8 },
  { id: 'dragonfruit', name: 'Dragon Fruit', rarity: 'mythical', price: 50000, grow: 200, multi: true, n: 3, regrow: 55, value: 4500, kg: 11.4 },
  { id: 'mango', name: 'Mango', rarity: 'mythical', price: 100000, grow: 240, multi: true, n: 4, regrow: 60, value: 6000, kg: 14.3 },
  { id: 'grape', name: 'Grape', rarity: 'divine', price: 850000, grow: 300, multi: true, n: 4, regrow: 70, value: 40000, kg: 2.9 },
  { id: 'mushroom', name: 'Mushroom', rarity: 'divine', price: 150000, grow: 220, value: 450000, kg: 25.9 },
  { id: 'beanstalk', name: 'Beanstalk', rarity: 'prismatic', price: 10000000, grow: 400, multi: true, n: 3, regrow: 90, value: 300000, kg: 9.5 },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

// Environmental mutations add together; growth mutations (gold, rainbow) multiply.
export const MUTS = {
  rainbow: { name: 'Rainbow', mult: 50, growth: true, col: '#ff8fd8' },
  gold: { name: 'Gold', mult: 20, growth: true, col: '#ffd23f' },
  shocked: { name: 'Shocked', mult: 100, col: '#fff36b' },
  frozen: { name: 'Frozen', mult: 10, col: '#9fe4ff' },
  bloodlit: { name: 'Bloodlit', mult: 4, col: '#ff4b5c' },
  pollinated: { name: 'Pollinated', mult: 3, col: '#ffcf3f' },
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
export function fruitValue(crop, size, muts) {
  return Math.max(1, Math.round(CROP[crop].value * size * size * mutMult(muts)));
}

export const SPRINKLERS = {
  sprinkler: { name: 'Sprinkler', price: 4000, r: 1, mult: 1.5, dur: 300, col: '#9aa7b8', desc: 'Plants around it grow 1.5x faster for 5 min.' },
  super: { name: 'Super Sprinkler', price: 25000, r: 2, mult: 1.75, dur: 300, col: '#5aa8ff', desc: 'Big reach. 1.75x growth for 5 min.' },
  golden: { name: 'Golden Sprinkler', price: 300000, r: 2, mult: 2, dur: 480, gold: true, col: '#ffd23f', desc: '2x growth for 8 min, and more Gold fruit.' },
};

export const EXPANSIONS = [750, 6000, 45000, 300000];
export const BASKET_BASE = 200;
export const basketPrice = (lvl) => Math.round(1500 * Math.pow(4, lvl));
export const CAN_PRICE = 300;
export const CAN_USES = 10;
export const CAN_DUR = 60;

export const PETS = {
  bunny: { name: 'Bunny', rarity: 'common', desc: 'Plants grow 6% faster.', grow: 0.06 },
  puppy: { name: 'Puppy', rarity: 'common', desc: 'Digs up a free seed every 90s.', dig: 90 },
  chick: { name: 'Chick', rarity: 'common', desc: 'Fruit grows 8% bigger.', size: 0.08 },
  kitten: { name: 'Kitten', rarity: 'uncommon', desc: 'Harvest sells for 8% more.', sell: 0.08 },
  duck: { name: 'Duck', rarity: 'uncommon', desc: 'Splashes a fruit Wet every 45s.', splash: 45 },
  hedgehog: { name: 'Hedgehog', rarity: 'uncommon', desc: 'Plants grow 10% faster.', grow: 0.1 },
  bee: { name: 'Bee', rarity: 'rare', desc: 'Pollinates a fruit every 40s.', pollinate: 40 },
  fox: { name: 'Fox', rarity: 'rare', desc: 'Harvest sells for 15% more.', sell: 0.15 },
  owl: { name: 'Owl', rarity: 'rare', desc: 'Makes fruit Moonlit at night.', moon: 30 },
  dragonfly: { name: 'Dragonfly', rarity: 'legendary', desc: 'Turns a fruit Gold every 2 min.', goldify: 120 },
  panda: { name: 'Panda', rarity: 'legendary', desc: 'Plants grow 20% faster.', grow: 0.2 },
  capybara: { name: 'Capybara', rarity: 'mythical', desc: 'Harvest sells for 30% more.', sell: 0.3 },
  dragon: { name: 'Dragon', rarity: 'mythical', desc: 'Turns a fruit Rainbow every 4 min.', rainbowify: 240 },
};
export const EGGS = [
  { id: 'common', name: 'Common Egg', price: 2000, hatch: 30, col: '#f4ead2', spot: '#c9b48a', pets: [['bunny', 45], ['puppy', 35], ['chick', 20]] },
  { id: 'uncommon', name: 'Uncommon Egg', price: 20000, hatch: 60, col: '#bff0a8', spot: '#5fae4c', pets: [['kitten', 40], ['duck', 35], ['hedgehog', 25]] },
  { id: 'rare', name: 'Rare Egg', price: 150000, hatch: 90, col: '#a8d4ff', spot: '#3f7fd0', pets: [['bee', 40], ['fox', 35], ['owl', 25]] },
  { id: 'legendary', name: 'Legendary Egg', price: 1500000, hatch: 120, col: '#ffe48a', spot: '#d49a1e', pets: [['dragonfly', 55], ['panda', 45]] },
  { id: 'mythical', name: 'Mythical Egg', price: 15000000, hatch: 180, col: '#e2b8ff', spot: '#8a4ad0', pets: [['capybara', 60], ['dragon', 40]] },
];
export const EGG = Object.fromEntries(EGGS.map((e) => [e.id, e]));
export const MAX_PETS = 3;
export const MAX_EGGS = 2;

export const WEATHER = {
  clear: { name: 'Sunny', grow: 1 },
  rain: { name: 'Rain', grow: 1.5, msg: 'It started raining! Crops grow faster and may get Wet.' },
  storm: { name: 'Thunderstorm', grow: 1.5, msg: 'Thunderstorm! Lightning can Shock your fruit (x100)!' },
  snow: { name: 'Snowfall', grow: 1, msg: 'Snow is falling! Fruit can get Chilled, or Frozen if Wet.' },
};
export const DAY_LEN = 600; // full day/night cycle
export const NIGHT_START = 0.68, NIGHT_END = 0.96;

export const COLS = 7, ROWS = 7, START_ROWS = 3, TILE = 24;
export const RESTOCK = 300;
