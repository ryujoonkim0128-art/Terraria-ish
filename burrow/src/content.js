// Game data: tiles, resources, rooms and furniture.

export const TILE = 8;

export const T = { AIR: 0, DIRT: 1, STONE: 2, IRON: 3, CRYSTAL: 4, BEDROCK: 5, TOPSOIL: 6, FLOOR: 7, CLAY: 8 };
export const TILES = [
  { solid: false },
  { solid: true, hard: 0.9 },
  { solid: true, hard: 2.2, give: 'stone' },
  { solid: true, hard: 2.8, give: 'iron' },
  { solid: true, hard: 2.0, give: 'crystal', light: [0.18, 0.4, 0.75] },
  { solid: true, hard: Infinity },
  { solid: true, hard: 0.9 },
  { solid: true, hard: Infinity },
  { solid: true, hard: 1.3, give: 'stone', chance: 0.4 },
];

export const RES = ['wood', 'stone', 'iron', 'crystal', 'food', 'meal'];

// Rooms are pods: w x h interior cells, the top corners rounded off, a plank floor under them.
// Furniture: [type, dx from the left interior column, lift above the floor (wall objects)].
export const ROOMS = {
  hearth: {
    w: 12, h: 5, cost: { wood: 10, stone: 6 }, comfort: 3,
    wall: ['#5e3420', '#6b3c25', '#4c2a1a'], pattern: 'logs',
    furn: [['hearth', 4], ['rug', 3], ['armchair', 1], ['armchair', 8], ['painting', 9, 2], ['lamp', 2], ['lamp', 9]],
  },
  bedroom: {
    w: 10, h: 4, cost: { wood: 8 }, comfort: 2,
    wall: ['#4c3d5c', '#58476a', '#3e324c'], pattern: 'stripes',
    furn: [['bed', 1], ['bed', 6], ['nightstand', 4], ['painting', 4, 2], ['lamp', 5]],
  },
  kitchen: {
    w: 10, h: 4, cost: { wood: 6, stone: 4 }, comfort: 2,
    wall: ['#6b5a3c', '#7a6845', '#594a30'], pattern: 'tiles',
    furn: [['stove', 1], ['shelf', 3, 2], ['table', 5], ['stool', 4], ['stool', 7], ['barrel', 8], ['lamp', 5]],
  },
  farm: {
    w: 12, h: 4, cost: { wood: 4, stone: 2 }, comfort: 1,
    wall: ['#3a3424', '#443d2b', '#2e291c'], pattern: 'roots',
    furn: [['plot', 1], ['plot', 4], ['plot', 7], ['plot', 10], ['growlamp', 3], ['growlamp', 8]],
  },
  storage: {
    w: 8, h: 4, cost: { wood: 6 }, comfort: 1,
    wall: ['#55402a', '#614a31', '#463422'], pattern: 'planks',
    furn: [['crates', 1], ['crates', 3], ['barrel', 5], ['barrel', 6], ['lamp', 4]],
  },
  bath: {
    w: 10, h: 4, cost: { stone: 10, iron: 2 }, comfort: 3,
    wall: ['#35545a', '#3e6067', '#2b464b'], pattern: 'tiles',
    furn: [['tub', 2], ['stool', 7], ['plant', 8], ['lamp', 4]],
  },
  library: {
    w: 10, h: 4, cost: { wood: 10, iron: 1 }, comfort: 3,
    wall: ['#3c2a24', '#46322a', '#30211c'], pattern: 'panels',
    furn: [['bookshelf', 1], ['armchair', 3], ['phonograph', 6], ['bookshelf', 7], ['lamp', 5]],
  },
};
export const ROOM_ORDER = ['bedroom', 'kitchen', 'farm', 'storage', 'hearth', 'bath', 'library'];

// mount: floor objects stand on the floor, wall objects hang `lift` cells above it, ceil objects hang from the top.
export const OBJ = {
  hearth: { w: 3, h: 3, mount: 'floor', light: [1.25, 0.62, 0.28], comfort: 3 },
  rug: { w: 4, h: 1, mount: 'floor', comfort: 1, cost: { wood: 2 } },
  armchair: { w: 2, h: 2, mount: 'floor', comfort: 1, seat: true, cost: { wood: 3 } },
  painting: { w: 2, h: 1, mount: 'wall', lift: 2, comfort: 1, cost: { wood: 2 } },
  lamp: { w: 1, h: 1, mount: 'ceil', light: [1.0, 0.74, 0.42], comfort: 0.5 },
  growlamp: { w: 1, h: 1, mount: 'ceil', light: [0.75, 0.5, 0.95], comfort: 0 },
  bed: { w: 3, h: 2, mount: 'floor', comfort: 1, bed: true, cost: { wood: 5 } },
  nightstand: { w: 1, h: 1, mount: 'floor', light: [0.7, 0.5, 0.28], comfort: 0.5 },
  stove: { w: 2, h: 2, mount: 'floor', light: [0.9, 0.45, 0.2], comfort: 1 },
  shelf: { w: 2, h: 1, mount: 'wall', lift: 2, comfort: 0.5 },
  table: { w: 2, h: 1, mount: 'floor', comfort: 0.5, cost: { wood: 2 } },
  stool: { w: 1, h: 1, mount: 'floor', comfort: 0.2, seat: true, cost: { wood: 1 } },
  barrel: { w: 1, h: 1, mount: 'floor', comfort: 0.2, cost: { wood: 2 } },
  plot: { w: 2, h: 1, mount: 'floor', comfort: 0.3 },
  crates: { w: 2, h: 2, mount: 'floor', comfort: 0.2 },
  tub: { w: 4, h: 2, mount: 'floor', light: [0.3, 0.55, 0.6], comfort: 2 },
  plant: { w: 1, h: 1, mount: 'floor', comfort: 1, cost: { wood: 1, food: 1 } },
  bookshelf: { w: 2, h: 3, mount: 'floor', comfort: 1, cost: { wood: 4 } },
  phonograph: { w: 1, h: 2, mount: 'floor', comfort: 1 },
  lantern: { w: 1, h: 1, mount: 'wall', lift: 1, light: [0.95, 0.68, 0.36], comfort: 0.5, cost: { wood: 1, iron: 1 } },
  crystallamp: { w: 1, h: 2, mount: 'floor', light: [0.35, 0.75, 1.1], comfort: 1.5, cost: { crystal: 1, stone: 2 } },
  banner: { w: 1, h: 2, mount: 'wall', lift: 1, comfort: 0.5, cost: { wood: 1 } },
  snowman: { w: 2, h: 2, mount: 'floor', comfort: 1, surface: true, cost: {} },
  bell: { w: 1, h: 3, mount: 'floor', comfort: 0 },
};
export const DECOR = ['bed', 'lantern', 'crystallamp', 'rug', 'armchair', 'plant', 'painting', 'bookshelf', 'banner', 'barrel', 'table', 'stool', 'snowman'];

export const DAY_LEN = 300; // real seconds per in-game day at 1x speed
export const STORE_BASE = 40, STORE_ROOM = 50;
