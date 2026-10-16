// All game data: crops, mutations, weather, gear, eggs, pets. Numbers follow Grow a Garden's
// economy (Sheckles, base weights, multipliers); growth times are scaled so a session feels alive.
export const TILE = 16;
export const START_SHECKLES = 20;
export const BACKPACK_CAP = 200;
export const INV_SLOTS = 12;
export const MAX_PETS = 3;
export const MAX_EGGS = 3;
export const SEED_RESTOCK = 300;
export const GEAR_RESTOCK = 300;
export const EGG_RESTOCK = 600;
export const DAY_LEN = 480;      // seconds per full day
export const NIGHT_AT = 0.72;    // fraction of day where night starts

export const RARITY = {
  Common:    { color: '#d6dde3', order: 0 },
  Uncommon:  { color: '#6fe07a', order: 1 },
  Rare:      { color: '#5ab4ff', order: 2 },
  Legendary: { color: '#ffd23f', order: 3 },
  Mythical:  { color: '#d58bff', order: 4 },
  Divine:    { color: '#ff7a6b', order: 5 },
  Prismatic: { color: '#ffa3e8', order: 6 },
};

// stock: [chance per restock, min, max]
export const CROPS = [
  { id: 'carrot',         name: 'Carrot',          rarity: 'Common',    price: 10,       value: 18,     weight: 0.24,  grow: 30,   multi: false, fruits: 1, form: 'root',     stock: [1.0, 10, 25], pal: { leaf: '#46b34f', fruit: '#ff8c1a', fruit2: '#d9611a' } },
  { id: 'strawberry',     name: 'Strawberry',      rarity: 'Common',    price: 50,       value: 14,     weight: 0.29,  grow: 60,   multi: true,  fruits: 5, form: 'bush',     stock: [1.0, 1, 6],   pal: { leaf: '#3f9b3a', fruit: '#ec3b32', fruit2: '#ffe066' }, size: 1 },
  { id: 'blueberry',      name: 'Blueberry',       rarity: 'Uncommon',  price: 400,      value: 18,     weight: 0.17,  grow: 90,   multi: true,  fruits: 6, form: 'bush',     stock: [1.0, 1, 5],   pal: { leaf: '#2f8a4e', fruit: '#4e62d8', fruit2: '#8fa0ff' }, size: 1 },
  { id: 'orangetulip',    name: 'Orange Tulip',    rarity: 'Uncommon',  price: 600,      value: 767,    weight: 0.05,  grow: 100,  multi: false, fruits: 1, form: 'flower',   stock: [0.35, 5, 25], pal: { leaf: '#4caf50', fruit: '#ff8a1f', fruit2: '#ffc04d' } },
  { id: 'tomato',         name: 'Tomato',          rarity: 'Rare',      price: 800,      value: 27,     weight: 0.44,  grow: 120,  multi: true,  fruits: 4, form: 'bush',     stock: [1.0, 1, 3],   pal: { leaf: '#3c9a3c', fruit: '#ef3b2d', fruit2: '#ff8a7a' }, size: 1.3, stake: true },
  { id: 'corn',           name: 'Corn',            rarity: 'Rare',      price: 1300,     value: 36,     weight: 1.9,   grow: 150,  multi: true,  fruits: 3, form: 'stalk',    stock: [0.25, 1, 3],  pal: { leaf: '#5cb85c', fruit: '#f5d442', fruit2: '#fff2a8' } },
  { id: 'daffodil',       name: 'Daffodil',        rarity: 'Rare',      price: 1000,     value: 903,    weight: 0.16,  grow: 140,  multi: false, fruits: 1, form: 'flower',   stock: [0.2, 1, 3],   pal: { leaf: '#4caf50', fruit: '#fff04a', fruit2: '#ffb21a' } },
  { id: 'watermelon',     name: 'Watermelon',      rarity: 'Legendary', price: 2500,     value: 2708,   weight: 7.3,   grow: 240,  multi: false, fruits: 1, form: 'vine',     stock: [0.16, 1, 4],  pal: { leaf: '#3e9c47', fruit: '#2f8a3a', fruit2: '#9ad66b' } },
  { id: 'pumpkin',        name: 'Pumpkin',         rarity: 'Legendary', price: 3000,     value: 3069,   weight: 6.9,   grow: 270,  multi: false, fruits: 1, form: 'vine',     stock: [0.14, 1, 3],  pal: { leaf: '#4a9a3c', fruit: '#f28c28', fruit2: '#ffc266' } },
  { id: 'apple',          name: 'Apple',           rarity: 'Legendary', price: 3250,     value: 248,    weight: 2.85,  grow: 300,  multi: true,  fruits: 6, form: 'tree',     stock: [0.1, 1, 3],   pal: { leaf: '#3f9a46', fruit: '#e23b2e', fruit2: '#ff9f8a', bark: '#7a4f2a' } },
  { id: 'bamboo',         name: 'Bamboo',          rarity: 'Legendary', price: 4000,     value: 3610,   weight: 3.8,   grow: 200,  multi: false, fruits: 1, form: 'bamboo',   stock: [0.25, 5, 20], pal: { leaf: '#7bc96f', fruit: '#8fd36a', fruit2: '#c8f0a0' } },
  { id: 'coconut',        name: 'Coconut',         rarity: 'Mythical',  price: 6000,     value: 361,    weight: 13.3,  grow: 420,  multi: true,  fruits: 3, form: 'palm',     stock: [0.06, 1, 2],  pal: { leaf: '#3f9c4a', fruit: '#8b5a2b', fruit2: '#c08a55', bark: '#9c7a4a' } },
  { id: 'cactus',         name: 'Cactus',          rarity: 'Mythical',  price: 15000,    value: 3068,   weight: 6.65,  grow: 480,  multi: true,  fruits: 3, form: 'cactus',   stock: [0.06, 1, 2],  pal: { leaf: '#3f9c5a', fruit: '#e85d9c', fruit2: '#ffb0d5' } },
  { id: 'dragonfruit',    name: 'Dragon Fruit',    rarity: 'Mythical',  price: 50000,    value: 4287,   weight: 11.38, grow: 600,  multi: true,  fruits: 3, form: 'dragon',   stock: [0.04, 1, 1],  pal: { leaf: '#2f8a5a', fruit: '#ff3f8e', fruit2: '#8fe08a' } },
  { id: 'mango',          name: 'Mango',           rarity: 'Mythical',  price: 100000,   value: 5866,   weight: 14.28, grow: 720,  multi: true,  fruits: 4, form: 'tree',     stock: [0.04, 1, 1],  pal: { leaf: '#2e8b45', fruit: '#ffb833', fruit2: '#ff6a3d', bark: '#6e4a2a' } },
  { id: 'grape',          name: 'Grape',           rarity: 'Divine',    price: 850000,   value: 7085,   weight: 2.85,  grow: 900,  multi: true,  fruits: 5, form: 'trellis',  stock: [0.02, 1, 1],  pal: { leaf: '#4a9a3c', fruit: '#7a3fbf', fruit2: '#c79cff' } },
  { id: 'mushroom',       name: 'Mushroom',        rarity: 'Divine',    price: 150000,   value: 136278, weight: 25.9,  grow: 840,  multi: false, fruits: 1, form: 'mushroom', stock: [0.03, 1, 25], pal: { leaf: '#e8d9b0', fruit: '#b5651d', fruit2: '#f3e3c3' } },
  { id: 'pepper',         name: 'Pepper',          rarity: 'Divine',    price: 1000000,  value: 7220,   weight: 4.75,  grow: 960,  multi: true,  fruits: 4, form: 'bush',     stock: [0.02, 1, 1],  pal: { leaf: '#2e8b3a', fruit: '#e3242b', fruit2: '#ff7a5a' }, size: 1.2 },
  { id: 'cacao',          name: 'Cacao',           rarity: 'Divine',    price: 2500000,  value: 10830,  weight: 7.6,   grow: 1200, multi: true,  fruits: 4, form: 'tree',     stock: [0.015, 1, 1], pal: { leaf: '#2f7a3a', fruit: '#8b4513', fruit2: '#d08a4a', bark: '#5a3a1e' } },
  { id: 'beanstalk',      name: 'Beanstalk',       rarity: 'Prismatic', price: 10000000, value: 25270,  weight: 9.5,   grow: 1500, multi: true,  fruits: 3, form: 'beanstalk', stock: [0.01, 1, 1], pal: { leaf: '#4fbf5a', fruit: '#7ed957', fruit2: '#c7f7a0' } },
  { id: 'emberlily',      name: 'Ember Lily',      rarity: 'Prismatic', price: 15000000, value: 50138,  weight: 11.4,  grow: 1800, multi: true,  fruits: 3, form: 'flower',   stock: [0.008, 1, 1], pal: { leaf: '#3f8a3a', fruit: '#ff4d1a', fruit2: '#ffd23f' }, glow: '#ff7a2a' },
  { id: 'sugarapple',     name: 'Sugar Apple',     rarity: 'Prismatic', price: 25000000, value: 43320,  weight: 8.55,  grow: 2100, multi: true,  fruits: 4, form: 'tree',     stock: [0.006, 1, 1], pal: { leaf: '#3a9a4f', fruit: '#8fd36a', fruit2: '#d8ffb0', bark: '#7a5a3a' } },
  { id: 'burningbud',     name: 'Burning Bud',     rarity: 'Prismatic', price: 40000000, value: 70000,  weight: 11.4,  grow: 2400, multi: true,  fruits: 3, form: 'flower',   stock: [0.005, 1, 1], pal: { leaf: '#6b3a2a', fruit: '#ff2e2e', fruit2: '#ffb000' }, glow: '#ff5a1a' },
  { id: 'giantpinecone',  name: 'Giant Pinecone',  rarity: 'Prismatic', price: 55000000, value: 64980,  weight: 15.2,  grow: 2700, multi: true,  fruits: 2, form: 'conifer',  stock: [0.004, 1, 1], pal: { leaf: '#2f6f45', fruit: '#8b5a2b', fruit2: '#d9a066', bark: '#5a3a22' } },
  { id: 'elderstrawberry', name: 'Elder Strawberry', rarity: 'Prismatic', price: 70000000, value: 88000, weight: 23.75, grow: 3000, multi: true, fruits: 4, form: 'bush',   stock: [0.003, 1, 1], pal: { leaf: '#2a7a3a', fruit: '#ff2d55', fruit2: '#ffe680' }, size: 1.8 },
];
export const CROP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export const VARIANTS = { Normal: { mult: 1 }, Gold: { mult: 20, color: '#ffd23f' }, Rainbow: { mult: 50, color: '#ff7ad9' } };

// Environmental mutations: multiplier and tint colour. Price = base * (1 + sum(mult) - count).
export const MUTATIONS = {
  Wet:         { mult: 2,   color: '#6fb6ff', desc: 'Soaked by rain' },
  Chilled:     { mult: 2,   color: '#aee8ff', desc: 'Touched by frost' },
  Frozen:      { mult: 10,  color: '#d8f6ff', desc: 'Frozen solid' },
  Moonlit:     { mult: 2,   color: '#c9a8ff', desc: 'Kissed by moonlight' },
  Choc:        { mult: 2,   color: '#7a4a2a', desc: 'Coated in chocolate' },
  Pollinated:  { mult: 3,   color: '#ffe066', desc: 'Visited by bees' },
  Bloodlit:    { mult: 4,   color: '#ff3b3b', desc: 'Grown under a blood moon' },
  Burnt:       { mult: 4,   color: '#5a3a2a', desc: 'Scorched by heat' },
  HoneyGlazed: { mult: 5,   color: '#ffb000', desc: 'Dripping with honey' },
  Twisted:     { mult: 5,   color: '#9a9aa8', desc: 'Warped by a tornado' },
  Shocked:     { mult: 100, color: '#fff44f', desc: 'Struck by lightning' },
  Celestial:   { mult: 120, color: '#ffe9ff', desc: 'Hit by a meteor' },
  Disco:       { mult: 125, color: '#ff4fd8', desc: 'Groovy' },
};
export const MUT_ORDER = Object.keys(MUTATIONS);

// Weather events. rate = chance per fruit per second of gaining `mut`. strikes = targeted hits per event.
export const WEATHER = {
  clear:   { name: 'Sunny',          dur: [0, 0] },
  night:   { name: 'Night',          dur: [0, 0],     mut: 'Moonlit', rate: 0.0012 },
  rain:    { name: 'Rain',           dur: [90, 150],  weight: 32, mut: 'Wet', rate: 0.0058, growth: 1.5, msg: 'Rain! Crops may become Wet and grow faster.' },
  storm:   { name: 'Thunderstorm',   dur: [80, 130],  weight: 12, mut: 'Wet', rate: 0.0045, growth: 1.5, strikes: 'Shocked', strikeEvery: 14, msg: 'Thunderstorm! Lightning can Shock your crops.' },
  frost:   { name: 'Frost',          dur: [90, 140],  weight: 16, mut: 'Chilled', rate: 0.0035, msg: 'Frost! Crops may become Chilled, or Frozen if Wet.' },
  bees:    { name: 'Bee Swarm',      dur: [80, 120],  weight: 10, strikes: 'Pollinated', strikeEvery: 7, honey: 0.15, msg: 'Bee Swarm! Bees pollinate your crops.' },
  meteor:  { name: 'Meteor Shower',  dur: [60, 90],   weight: 4,  strikes: 'Celestial', strikeEvery: 18, msg: 'Meteor Shower! Meteors leave crops Celestial.' },
  disco:   { name: 'Disco',          dur: [60, 90],   weight: 3,  mut: 'Disco', rate: 0.0012, msg: 'Disco! Get down and get Disco crops.' },
  choc:    { name: 'Chocolate Rain', dur: [80, 120],  weight: 5,  mut: 'Choc', rate: 0.005, growth: 1.3, msg: 'Chocolate Rain! Crops get coated in Choc.' },
  tornado: { name: 'Tornado',        dur: [50, 80],   weight: 5,  mut: 'Twisted', rate: 0.002, msg: 'Tornado! Crops may get Twisted.' },
  heat:    { name: 'Heatwave',       dur: [80, 120],  weight: 7,  mut: 'Burnt', rate: 0.0025, growth: 0.8, msg: 'Heatwave! Crops may get Burnt.' },
  blood:   { name: 'Blood Moon',     dur: [0, 0],     mut: 'Bloodlit', rate: 0.003, msg: 'Blood Moon! Crops become Bloodlit tonight.' },
};

export const GEAR = [
  { id: 'wateringcan',  name: 'Watering Can',       price: 50000,    uses: 10, stock: [1.0, 1, 3],  desc: 'Water a plant to speed its growth.' },
  { id: 'trowel',       name: 'Trowel',             price: 100000,   uses: 5,  stock: [1.0, 1, 2],  desc: 'Dig up a plant and move it.' },
  { id: 'favtool',      name: 'Favorite Tool',      price: 20000,    uses: 0,  stock: [1.0, 1, 3],  desc: 'Favorite a plant so its fruit is never sold.' },
  { id: 'harvesttool',  name: 'Harvest Tool',       price: 30000,    uses: 0,  stock: [1.0, 1, 2],  desc: 'Harvest every ripe fruit in a 3x3 area.' },
  { id: 'cleanspray',   name: 'Cleaning Spray',     price: 15000,    uses: 5,  stock: [0.5, 1, 2],  desc: 'Remove all mutations from a plant.' },
  { id: 'sprinkler1',   name: 'Basic Sprinkler',    price: 25000,    uses: 1,  stock: [1.0, 1, 3],  desc: 'Boosts growth and size nearby for 5 minutes.', spr: { r: 1.5, growth: 1.25, size: 0.02, mut: 1.1, life: 300 } },
  { id: 'sprinkler2',   name: 'Advanced Sprinkler', price: 50000,    uses: 1,  stock: [0.6, 1, 2],  desc: 'Boosts growth, size and mutations nearby.', spr: { r: 2.5, growth: 1.5, size: 0.03, mut: 1.3, life: 300 } },
  { id: 'sprinkler3',   name: 'Godly Sprinkler',    price: 120000,   uses: 1,  stock: [0.35, 1, 2], desc: 'Big boosts to growth, size and mutations.', spr: { r: 3.5, growth: 1.75, size: 0.045, mut: 1.6, life: 300 } },
  { id: 'sprinkler4',   name: 'Master Sprinkler',   price: 10000000, uses: 1,  stock: [0.08, 1, 1], desc: 'Huge boosts in a wide area for 10 minutes.', spr: { r: 5, growth: 2.2, size: 0.07, mut: 2.2, life: 600 } },
  { id: 'rod',          name: 'Lightning Rod',      price: 1000000,  uses: 1,  stock: [0.2, 1, 1],  desc: 'Attracts lightning to nearby crops. 3 charges.' },
  { id: 'wrench',       name: 'Recall Wrench',      price: 150000,   uses: 1,  stock: [0.5, 1, 1],  desc: 'Teleport to the gear shop.' },
];
export const GEARMAP = Object.fromEntries(GEAR.map((g) => [g.id, g]));

export const EGGS = [
  { id: 'common',    name: 'Common Egg',    price: 50000,    hatch: 300,  stock: [1.0, 1, 3],  color: '#f1e9d6', spot: '#d9c9a8', pets: [['dog', 33], ['goldenlab', 33], ['bunny', 34]] },
  { id: 'uncommon',  name: 'Uncommon Egg',  price: 150000,   hatch: 480,  stock: [0.6, 1, 2],  color: '#aee9b0', spot: '#5fbf6a', pets: [['blackbunny', 25], ['chicken', 25], ['cat', 25], ['deer', 25]] },
  { id: 'rare',      name: 'Rare Egg',      price: 600000,   hatch: 720,  stock: [0.35, 1, 1], color: '#9cc9ff', spot: '#3f7fd6', pets: [['tabby', 33], ['spotteddeer', 25], ['pig', 17], ['rooster', 17], ['monkey', 8]] },
  { id: 'legendary', name: 'Legendary Egg', price: 3000000,  hatch: 1000, stock: [0.2, 1, 1],  color: '#ffe27a', spot: '#e0a020', pets: [['cow', 42], ['silvermonkey', 42], ['seaotter', 11], ['turtle', 3], ['polarbear', 2]] },
  { id: 'mythical',  name: 'Mythical Egg',  price: 8000000,  hatch: 1300, stock: [0.1, 1, 1],  color: '#d9a8ff', spot: '#8a3fd6', pets: [['greymouse', 36], ['brownmouse', 27], ['squirrel', 27], ['redant', 8], ['redfox', 2]] },
  { id: 'bug',       name: 'Bug Egg',       price: 50000000, hatch: 1600, stock: [0.05, 1, 1], color: '#c8e86a', spot: '#6a8a2a', pets: [['snail', 40], ['giantant', 30], ['caterpillar', 25], ['mantis', 4], ['dragonfly', 1]] },
  { id: 'night',     name: 'Night Egg',     price: 25000000, hatch: 1400, stock: [0.05, 1, 1], color: '#3a3f6a', spot: '#8a90d6', pets: [['hedgehog', 49], ['mole', 22], ['frog', 14], ['echofrog', 10], ['nightowl', 4], ['raccoon', 1]] },
];
export const EGGMAP = Object.fromEntries(EGGS.map((e) => [e.id, e]));

// look: kind (quad/bird/bug/frog/turtle/snail), body colours, ear/tail styles, size.
export const PETS = {
  dog:         { name: 'Dog',            look: { kind: 'quad', body: '#c9a06a', belly: '#f1dcb3', ear: 'floppy', tail: 'curl' },         ability: { type: 'digSeed', cd: 60, chance: 0.1, msg: 'dug up a seed' }, desc: 'Every 60s, 10% chance to dig up a random seed.' },
  goldenlab:   { name: 'Golden Lab',     look: { kind: 'quad', body: '#e8c25a', belly: '#fff0b8', ear: 'floppy', tail: 'thin' },         ability: { type: 'digSeed', cd: 60, chance: 0.2, msg: 'dug up a seed' }, desc: 'Every 60s, 20% chance to dig up a random seed.' },
  bunny:       { name: 'Bunny',          look: { kind: 'quad', body: '#f0f0f0', belly: '#ffd9e6', ear: 'long', tail: 'puff', size: 0.8 }, ability: { type: 'eatCrop', cd: 45, crop: 'carrot', mult: 1.5, msg: 'ate a carrot' }, desc: 'Every 45s eats a carrot from your backpack for 1.5x its value.' },
  blackbunny:  { name: 'Black Bunny',    look: { kind: 'quad', body: '#2a2a33', belly: '#5a5a66', ear: 'long', tail: 'puff', size: 0.8 }, ability: { type: 'eatCrop', cd: 45, crop: 'carrot', mult: 2.5, msg: 'ate a carrot' }, desc: 'Every 45s eats a carrot for 2.5x its value.' },
  chicken:     { name: 'Chicken',        look: { kind: 'bird', body: '#f5f0e6', comb: '#e03030', size: 0.8 },                          ability: { type: 'hatchSpeed', bonus: 0.1 }, desc: 'Eggs hatch 10% faster.' },
  cat:         { name: 'Cat',            look: { kind: 'quad', body: '#9a9aa6', belly: '#e0e0e8', ear: 'pointy', tail: 'thin', size: 0.85 }, ability: { type: 'nap', cd: 80, dur: 20, r: 3, size: 0.012, msg: 'is napping' }, desc: 'Naps every 80s; nearby fruit grows larger while it sleeps.' },
  deer:        { name: 'Deer',           look: { kind: 'quad', body: '#b07a4a', belly: '#f0d9b0', ear: 'pointy', tail: 'puff', antlers: true, size: 1.1 }, ability: { type: 'dupeHarvest', chance: 0.05 }, desc: '5% chance a harvested fruit is doubled.' },
  tabby:       { name: 'Orange Tabby',   look: { kind: 'quad', body: '#e89a3a', belly: '#ffe0b0', ear: 'pointy', tail: 'thin', stripes: '#b8641a', size: 0.9 }, ability: { type: 'nap', cd: 70, dur: 25, r: 4, size: 0.02, msg: 'is napping' }, desc: 'Naps every 70s; a bigger size boost for nearby fruit.' },
  spotteddeer: { name: 'Spotted Deer',   look: { kind: 'quad', body: '#b07a4a', belly: '#f0d9b0', ear: 'pointy', tail: 'puff', antlers: true, spots: '#f7ead0', size: 1.1 }, ability: { type: 'dupeHarvest', chance: 0.1 }, desc: '10% chance a harvested fruit is doubled.' },
  pig:         { name: 'Pig',            look: { kind: 'quad', body: '#f2a7c0', belly: '#ffd6e3', ear: 'pointy', tail: 'curl', snout: true }, ability: { type: 'variantAura', cd: 120, dur: 15, r: 3, gold: 0.08, rainbow: 0.01, msg: 'is boosting variants' }, desc: 'Every 2 min emits an aura: newly planted seeds nearby are likelier Gold or Rainbow.' },
  rooster:     { name: 'Rooster',        look: { kind: 'bird', body: '#d94a2a', comb: '#ff2020', tailFeathers: '#2a6a3a', size: 0.9 }, ability: { type: 'hatchSpeed', bonus: 0.2 }, desc: 'Eggs hatch 20% faster.' },
  monkey:      { name: 'Monkey',         look: { kind: 'quad', body: '#8a5a3a', belly: '#e8c9a0', ear: 'round', tail: 'long', size: 0.9 }, ability: { type: 'refundSell', chance: 0.03 }, desc: '3% chance a sold fruit is refunded to your backpack.' },
  cow:         { name: 'Cow',            look: { kind: 'quad', body: '#f5f5f5', belly: '#f5f5f5', ear: 'round', tail: 'thin', patches: '#222', size: 1.2 }, ability: { type: 'growthAura', cd: 90, dur: 15, r: 3, mult: 2, msg: 'is boosting growth' }, desc: 'Every 90s emits an aura that doubles nearby growth for 15s.' },
  silvermonkey: { name: 'Silver Monkey', look: { kind: 'quad', body: '#b8bcc8', belly: '#eef0f5', ear: 'round', tail: 'long', size: 0.9 }, ability: { type: 'refundSell', chance: 0.07 }, desc: '7% chance a sold fruit is refunded.' },
  seaotter:    { name: 'Sea Otter',      look: { kind: 'quad', body: '#6a4a33', belly: '#c9a98a', ear: 'round', tail: 'thin' },         ability: { type: 'water', cd: 30, r: 4, amount: 0.1, msg: 'watered a plant' }, desc: 'Every 30s waters a nearby plant.' },
  turtle:      { name: 'Turtle',         look: { kind: 'turtle', body: '#5a9a4a', shell: '#3a6a2a' },                                     ability: { type: 'hatchSpeed', bonus: 0.3 }, desc: 'Eggs hatch 30% faster. Slow and steady.' },
  polarbear:   { name: 'Polar Bear',     look: { kind: 'quad', body: '#f4f8ff', belly: '#dfe8f5', ear: 'round', tail: 'none', size: 1.25 }, ability: { type: 'chill', cd: 60, chance: 0.35, msg: 'chilled a fruit' }, desc: 'Every 60s, 35% chance to Chill a ripe fruit (Frozen if Wet).' },
  greymouse:   { name: 'Grey Mouse',     look: { kind: 'quad', body: '#9a9aa6', belly: '#d9d9e0', ear: 'round', tail: 'long', size: 0.6 }, ability: { type: 'xpAura', mult: 1.5 }, desc: 'Other pets gain XP 50% faster.' },
  brownmouse:  { name: 'Brown Mouse',    look: { kind: 'quad', body: '#8a6a4a', belly: '#d9c0a0', ear: 'round', tail: 'long', size: 0.6 }, ability: { type: 'xpAura', mult: 1.5 }, desc: 'Other pets gain XP 50% faster.' },
  squirrel:    { name: 'Squirrel',       look: { kind: 'quad', body: '#a05a2a', belly: '#f0d0a0', ear: 'pointy', tail: 'bushy', size: 0.75 }, ability: { type: 'seedSave', chance: 0.1 }, desc: '10% chance a planted seed is not consumed.' },
  redant:      { name: 'Red Giant Ant',  look: { kind: 'bug', body: '#c0392b', size: 0.8 },                                             ability: { type: 'dupeHarvest', chance: 0.1 }, desc: '10% chance a harvested fruit is doubled.' },
  redfox:      { name: 'Red Fox',        look: { kind: 'quad', body: '#e2642a', belly: '#fff0e0', ear: 'pointy', tail: 'bushy' },       ability: { type: 'stealSeed', cd: 120, chance: 0.3, msg: 'stole a seed' }, desc: 'Every 2 min, 30% chance to steal a seed from the shop for you.' },
  snail:       { name: 'Snail',          look: { kind: 'snail', body: '#c9b27a', shell: '#8a5a3a', size: 0.7 },                          ability: { type: 'seedSave', chance: 0.05 }, desc: '5% chance a planted seed is not consumed.' },
  giantant:    { name: 'Giant Ant',      look: { kind: 'bug', body: '#2a2a2a', size: 0.8 },                                             ability: { type: 'dupeHarvest', chance: 0.05 }, desc: '5% chance a harvested fruit is doubled.' },
  caterpillar: { name: 'Caterpillar',    look: { kind: 'bug', body: '#7ed957', stripes: '#3a8a2a', size: 0.7, legs: 0 },                ability: { type: 'advance', cd: 60, chance: 0.2, amount: 0.25, msg: 'nibbled a plant' }, desc: 'Every 60s, 20% chance a nearby plant grows 25%.' },
  mantis:      { name: 'Praying Mantis', look: { kind: 'bug', body: '#8fd36a', size: 0.9, arms: true },                                  ability: { type: 'mutAura', cd: 80, dur: 15, r: 3, mult: 2, msg: 'is boosting mutations' }, desc: 'Every 80s emits an aura doubling nearby mutation chance for 15s.' },
  dragonfly:   { name: 'Dragonfly',      look: { kind: 'bug', body: '#3fb8c8', wings: '#c8f4ff', size: 0.8, legs: 0 },                  ability: { type: 'goldify', cd: 300, msg: 'turned a fruit Gold' }, desc: 'Every 5 min turns a random fruit Gold.' },
  hedgehog:    { name: 'Hedgehog',       look: { kind: 'quad', body: '#6a5a4a', belly: '#d9c0a0', ear: 'round', tail: 'none', spikes: '#3a2a1a', size: 0.7 }, ability: { type: 'sizeBoost', cd: 60, amount: 0.15, msg: 'bulked up a plant' }, desc: 'Every 60s boosts a random plant\'s size.' },
  mole:        { name: 'Mole',           look: { kind: 'quad', body: '#4a3a3a', belly: '#8a6a6a', ear: 'round', tail: 'none', size: 0.65 }, ability: { type: 'dig', cd: 120, msg: 'dug something up' }, desc: 'Every 2 min digs up Sheckles or a gear item.' },
  frog:        { name: 'Frog',           look: { kind: 'frog', body: '#5fbf5a', belly: '#c8f0a0', size: 0.8 },                           ability: { type: 'ripen', cd: 300, msg: 'croaked a plant ripe' }, desc: 'Every 5 min croaks a random plant fully ripe.' },
  echofrog:    { name: 'Echo Frog',      look: { kind: 'frog', body: '#3a8ad6', belly: '#b0e0ff', size: 0.8 },                           ability: { type: 'ripen', cd: 200, msg: 'croaked a plant ripe' }, desc: 'Every 200s croaks a random plant fully ripe.' },
  nightowl:    { name: 'Night Owl',      look: { kind: 'bird', body: '#5a4a6a', belly: '#c9b8d9', owl: true },                           ability: { type: 'moonlit', cd: 90, chance: 0.5, msg: 'moonlit a fruit' }, desc: 'At night, every 90s 50% chance to Moonlight a fruit. Pets gain XP faster.' },
  raccoon:     { name: 'Raccoon',        look: { kind: 'quad', body: '#7a7a86', belly: '#d0d0d8', ear: 'pointy', tail: 'ring', mask: '#2a2a33' }, ability: { type: 'copyCrop', cd: 300, msg: 'swiped a copy of a fruit' }, desc: 'Every 5 min duplicates a random fruit in your backpack.' },
};
export function petsOfEgg(eggId) { return EGGMAP[eggId].pets.map(([id]) => id); }
