// Everything the world is made of: tiles, background walls, furniture, items, recipes.

export const TILE = 8;

export const T = {
  AIR: 0, DIRT: 1, GRASS: 2, STONE: 3, COAL: 4, COPPER: 5, IRON: 6, PLANK: 7, BRICK: 8, TIMBER: 9,
  THATCH: 10, GLASS: 11, MOSS: 12, CRYSTAL: 13, COBBLE: 14, BEDROCK: 15, CLAY: 16, SNOW: 17,
  LADDER: 20, PLATFORM: 21, TRUNK: 22, LEAVES: 23, PINE: 24, TALLGRASS: 25, FLOWER: 26,
  SUPPORT: 27, FENCE: 28, ROOTS: 29, SHROOM: 30,
};

export const tiles = [];
function tile(id, o) {
  tiles[id] = {
    id, name: '', solid: false, opaque: false, hardness: 0.3, drop: null, light: null,
    climb: false, platform: false, tree: false, soft: false, ...o,
  };
}
tile(T.AIR, { name: 'Air', soft: true, hardness: 0 });
tile(T.DIRT, { name: 'Dirt', solid: true, opaque: true, hardness: 0.35, drop: 'dirt' });
tile(T.GRASS, { name: 'Grass', solid: true, opaque: true, hardness: 0.35, drop: 'dirt' });
tile(T.STONE, { name: 'Stone', solid: true, opaque: true, hardness: 0.85, drop: 'stone' });
tile(T.COAL, { name: 'Coal', solid: true, opaque: true, hardness: 1.0, drop: 'coal' });
tile(T.COPPER, { name: 'Copper', solid: true, opaque: true, hardness: 1.1, drop: 'copper' });
tile(T.IRON, { name: 'Iron', solid: true, opaque: true, hardness: 1.4, drop: 'iron' });
tile(T.PLANK, { name: 'Planks', solid: true, opaque: true, hardness: 0.5, drop: 'planks' });
tile(T.BRICK, { name: 'Stone Brick', solid: true, opaque: true, hardness: 0.9, drop: 'brick' });
tile(T.TIMBER, { name: 'Timber', solid: true, opaque: true, hardness: 0.6, drop: 'timber' });
tile(T.THATCH, { name: 'Thatch', solid: true, opaque: true, hardness: 0.3, drop: 'thatch' });
tile(T.GLASS, { name: 'Glass', solid: true, opaque: false, hardness: 0.3, drop: 'glass' });
tile(T.MOSS, { name: 'Glowmoss', solid: true, opaque: true, hardness: 0.8, drop: 'moss', light: [0.16, 0.62, 0.58] });
tile(T.CRYSTAL, { name: 'Amber Crystal', solid: true, opaque: true, hardness: 1.2, drop: 'crystal', light: [1.35, 0.78, 0.3] });
tile(T.COBBLE, { name: 'Cobble', solid: true, opaque: true, hardness: 0.9, drop: 'cobble' });
tile(T.BEDROCK, { name: 'Bedrock', solid: true, opaque: true, hardness: Infinity });
tile(T.CLAY, { name: 'Clay', solid: true, opaque: true, hardness: 0.4, drop: 'clay' });
tile(T.SNOW, { name: 'Snow', solid: true, opaque: true, hardness: 0.25, drop: 'snow' });
tile(T.LADDER, { name: 'Ladder', climb: true, hardness: 0.2, drop: 'ladder' });
tile(T.PLATFORM, { name: 'Platform', platform: true, hardness: 0.2, drop: 'platform' });
tile(T.TRUNK, { name: 'Tree', tree: true, hardness: 0.6, drop: 'wood' });
tile(T.LEAVES, { name: 'Leaves', tree: true, soft: true, hardness: 0.05 });
tile(T.PINE, { name: 'Pine Needles', tree: true, soft: true, hardness: 0.05 });
tile(T.TALLGRASS, { name: 'Tall Grass', soft: true, hardness: 0.02, drop: 'fiber' });
tile(T.FLOWER, { name: 'Flower', soft: true, hardness: 0.02, drop: 'flower' });
tile(T.SUPPORT, { name: 'Support Post', hardness: 0.4, drop: 'support' });
tile(T.FENCE, { name: 'Fence', hardness: 0.3, drop: 'fence' });
tile(T.ROOTS, { name: 'Roots', soft: true, hardness: 0.05, drop: 'fiber' });
tile(T.SHROOM, { name: 'Glowshroom', soft: true, hardness: 0.05, drop: 'glowshroom', light: [0.3, 0.95, 1.0] });

export const W = { NONE: 0, DIRT: 1, STONE: 2, PLANK: 3, DAUB: 4, BRICK: 5 };
export const walls = [
  null,
  { name: 'Dirt Wall', drop: 'wall_dirt', hardness: 0.3 },
  { name: 'Stone Wall', drop: 'wall_stone', hardness: 0.6 },
  { name: 'Plank Wall', drop: 'wall_plank', hardness: 0.35 },
  { name: 'Daub Wall', drop: 'wall_daub', hardness: 0.35 },
  { name: 'Brick Wall', drop: 'wall_brick', hardness: 0.6 },
];

// Furniture & fixtures: occupy w×h non-solid tiles. (x, y) is the top-left tile.
// mount: floor = needs solid/platform under every column; wall = needs a wall or solid neighbour; hang = needs solid above.
export const OBJ = {
  bed: { name: 'Bed', w: 3, h: 2, mount: 'floor', tags: ['bed'] },
  table: { name: 'Table', w: 3, h: 2, mount: 'floor', tags: ['table'] },
  chair: { name: 'Chair', w: 1, h: 2, mount: 'floor', tags: ['chair'] },
  workbench: { name: 'Workbench', w: 3, h: 2, mount: 'floor', tags: ['station', 'craft'] },
  anvil: { name: 'Anvil', w: 2, h: 1, mount: 'floor', tags: ['station', 'smith'] },
  furnace: { name: 'Furnace', w: 2, h: 3, mount: 'floor', tags: ['station', 'smith'], light: [1.25, 0.55, 0.2] },
  hearth: { name: 'Hearth', w: 3, h: 3, mount: 'floor', tags: ['station', 'cook'], light: [1.3, 0.62, 0.25] },
  loom: { name: 'Loom', w: 3, h: 3, mount: 'floor', tags: ['station', 'weave'] },
  barrel: { name: 'Barrel', w: 2, h: 2, mount: 'floor', tags: ['storage'] },
  crate: { name: 'Crate', w: 2, h: 2, mount: 'floor', tags: ['storage'] },
  sack: { name: 'Grain Sack', w: 1, h: 1, mount: 'floor', tags: ['storage'] },
  chest: { name: 'Chest', w: 2, h: 2, mount: 'floor', tags: ['storage', 'loot'] },
  shelf: { name: 'Jar Shelf', w: 3, h: 2, mount: 'wall', tags: [] },
  bookshelf: { name: 'Bookshelf', w: 3, h: 4, mount: 'floor', tags: [] },
  torch: { name: 'Torch', w: 1, h: 1, mount: 'wall', tags: ['light'], light: [1.0, 0.68, 0.34] },
  lantern: { name: 'Lantern', w: 1, h: 1, mount: 'hang', tags: ['light'], light: [1.05, 0.76, 0.42] },
  lamppost: { name: 'Lamp Post', w: 1, h: 4, mount: 'floor', tags: ['light'], light: [1.05, 0.78, 0.45] },
  campfire: { name: 'Campfire', w: 2, h: 1, mount: 'floor', tags: ['light', 'gather'], light: [1.3, 0.6, 0.25] },
  banner: { name: 'Banner', w: 1, h: 3, mount: 'wall', tags: [] },
  potplant: { name: 'Potted Plant', w: 1, h: 1, mount: 'floor', tags: [] },
  bones: { name: 'Bone Pile', w: 2, h: 1, mount: 'floor', tags: [] },
  well: { name: 'Well', w: 4, h: 4, mount: 'floor', tags: [] },
  yarn: { name: 'Yarn Rack', w: 2, h: 3, mount: 'floor', tags: [] },
  cauldron: { name: 'Cauldron', w: 2, h: 2, mount: 'floor', tags: ['station', 'cook'], light: [0.7, 0.35, 0.15] },
  minecart: { name: 'Ore Cart', w: 3, h: 2, mount: 'floor', tags: [] },
};

// Items. kind: tile | wall | object | tool | weapon | mat | food
export const ITEMS = {};
function item(id, o) { ITEMS[id] = { id, max: 999, ...o }; }
item('dirt', { name: 'Dirt', kind: 'tile', place: T.DIRT });
item('stone', { name: 'Stone', kind: 'tile', place: T.STONE });
item('cobble', { name: 'Cobble', kind: 'tile', place: T.COBBLE });
item('clay', { name: 'Clay', kind: 'tile', place: T.CLAY });
item('snow', { name: 'Snow', kind: 'tile', place: T.SNOW });
item('planks', { name: 'Planks', kind: 'tile', place: T.PLANK });
item('brick', { name: 'Stone Brick', kind: 'tile', place: T.BRICK });
item('timber', { name: 'Timber Beam', kind: 'tile', place: T.TIMBER });
item('thatch', { name: 'Thatch', kind: 'tile', place: T.THATCH });
item('glass', { name: 'Glass', kind: 'tile', place: T.GLASS });
item('moss', { name: 'Glowmoss', kind: 'tile', place: T.MOSS });
item('crystal', { name: 'Amber Crystal', kind: 'tile', place: T.CRYSTAL });
item('ladder', { name: 'Ladder', kind: 'tile', place: T.LADDER });
item('platform', { name: 'Platform', kind: 'tile', place: T.PLATFORM });
item('support', { name: 'Support Post', kind: 'tile', place: T.SUPPORT });
item('fence', { name: 'Fence', kind: 'tile', place: T.FENCE });
item('flower', { name: 'Wildflower', kind: 'tile', place: T.FLOWER, gift: 2 });
item('glowshroom', { name: 'Glowshroom', kind: 'tile', place: T.SHROOM, gift: 1 });
item('wall_dirt', { name: 'Dirt Wall', kind: 'wall', place: W.DIRT });
item('wall_stone', { name: 'Stone Wall', kind: 'wall', place: W.STONE });
item('wall_plank', { name: 'Plank Wall', kind: 'wall', place: W.PLANK });
item('wall_daub', { name: 'Daub Wall', kind: 'wall', place: W.DAUB });
item('wall_brick', { name: 'Brick Wall', kind: 'wall', place: W.BRICK });
for (const k of Object.keys(OBJ)) item(k, { name: OBJ[k].name, kind: 'object', place: k });
item('wood', { name: 'Wood', kind: 'mat' });
item('fiber', { name: 'Plant Fiber', kind: 'mat' });
item('coal', { name: 'Coal', kind: 'mat' });
item('copper', { name: 'Copper Ore', kind: 'mat' });
item('iron', { name: 'Iron Ore', kind: 'mat' });
item('pelt', { name: 'Wolf Pelt', kind: 'mat' });
item('bone', { name: 'Bone', kind: 'mat' });
item('coin', { name: 'Coin', kind: 'mat' });
item('bread', { name: 'Bread', kind: 'food', heal: 6, gift: 3 });
item('meat', { name: 'Raw Meat', kind: 'food', heal: 3 });
item('stew', { name: 'Stew', kind: 'food', heal: 10, gift: 4 });
item('pickaxe', { name: 'Copper Pickaxe', kind: 'tool', max: 1, mine: 1, dmg: 3, reach: 5.5 });
item('iron_pickaxe', { name: 'Iron Pickaxe', kind: 'tool', max: 1, mine: 1.8, dmg: 4, reach: 6 });
item('wood_sword', { name: 'Wooden Sword', kind: 'weapon', max: 1, dmg: 5, reach: 2.6 });
item('copper_sword', { name: 'Copper Sword', kind: 'weapon', max: 1, dmg: 7, reach: 2.8 });
item('iron_sword', { name: 'Iron Sword', kind: 'weapon', max: 1, dmg: 10, reach: 3 });

export const RECIPES = [
  { out: 'planks', n: 4, cost: { wood: 1 } },
  { out: 'timber', n: 2, cost: { wood: 1 } },
  { out: 'ladder', n: 3, cost: { wood: 1 } },
  { out: 'platform', n: 4, cost: { planks: 2 } },
  { out: 'support', n: 2, cost: { planks: 1 } },
  { out: 'fence', n: 3, cost: { planks: 2 } },
  { out: 'torch', n: 4, cost: { wood: 1, coal: 1 } },
  { out: 'brick', n: 2, cost: { stone: 2 } },
  { out: 'thatch', n: 3, cost: { fiber: 2 } },
  { out: 'glass', n: 2, cost: { crystal: 1 } },
  { out: 'wall_plank', n: 4, cost: { planks: 1 } },
  { out: 'wall_daub', n: 4, cost: { dirt: 1, fiber: 1 } },
  { out: 'wall_brick', n: 4, cost: { brick: 1 } },
  { out: 'wall_stone', n: 4, cost: { stone: 1 } },
  { out: 'wall_dirt', n: 4, cost: { dirt: 1 } },
  { out: 'workbench', n: 1, cost: { planks: 8 } },
  { out: 'table', n: 1, cost: { planks: 6 } },
  { out: 'chair', n: 1, cost: { planks: 4 } },
  { out: 'bed', n: 1, cost: { planks: 8, fiber: 4 } },
  { out: 'chest', n: 1, cost: { planks: 10, copper: 1 } },
  { out: 'barrel', n: 1, cost: { planks: 6, copper: 1 } },
  { out: 'bookshelf', n: 1, cost: { planks: 12 } },
  { out: 'shelf', n: 1, cost: { planks: 4, clay: 2 } },
  { out: 'lantern', n: 1, cost: { copper: 2, torch: 1 } },
  { out: 'lamppost', n: 1, cost: { timber: 2, lantern: 1 } },
  { out: 'campfire', n: 1, cost: { wood: 3, stone: 2 } },
  { out: 'banner', n: 1, cost: { fiber: 6, pelt: 1 } },
  { out: 'potplant', n: 1, cost: { clay: 2, flower: 1 } },
  { out: 'hearth', n: 1, cost: { stone: 12, brick: 4 } },
  { out: 'furnace', n: 1, cost: { stone: 20, coal: 2 } },
  { out: 'anvil', n: 1, cost: { iron: 8 } },
  { out: 'loom', n: 1, cost: { planks: 10, fiber: 6 } },
  { out: 'copper_sword', n: 1, cost: { copper: 6, wood: 2 } },
  { out: 'iron_sword', n: 1, cost: { iron: 8, wood: 2 } },
  { out: 'iron_pickaxe', n: 1, cost: { iron: 10, wood: 3 } },
  { out: 'stew', n: 1, cost: { meat: 1, glowshroom: 1 } },
];
