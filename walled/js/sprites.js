'use strict';
// Tiny procedural people, cats, rats and pigeons. Sprites are cached per look/pose/frame/facing.

const SKIN = ['#e3b88f', '#d1a37a', '#c4946a', '#b5855d'];
const HAIR = ['#151210', '#211a16', '#2c231d', '#3a2e24'];
const HAIR_OLD = ['#8a8580', '#b4aea6', '#d4d0c8', '#6a6560'];
const SHIRT = ['#d8d4c8', '#6b7f99', '#8a3b3b', '#6f7d55', '#c2a46b', '#4d4f6b', '#b06a7a', '#9a9a8a', '#5a7a7a', '#c8c0a0', '#7a5a8a', '#3a4a5a'];
const PANTS = ['#2e2c33', '#3d3a30', '#4a4d5a', '#2a3038', '#5a4e40'];

let LOOK_ID = 0;
function makeLook(kind, female) {
  const elder = kind === 'elder';
  return {
    id: LOOK_ID++, kind, female,
    skin: pick(SKIN), hair: elder ? pick(HAIR_OLD) : pick(HAIR),
    shirt: pick(SHIRT), pants: pick(PANTS), style: female ? pick(['long', 'bun', 'bob']) : pick(['short', 'short', 'cap', 'bald']),
    apron: false,
  };
}
const PLAYER_LOOK = { id: -1, kind: 'player', skin: '#d8ab82', hair: '#17120f', shirt: '#3d6d74', pants: '#2b2a35', style: 'messy', scarf: '#b8402e', bag: '#7a4e2c' };

const LEGS = {
  stand: ['..PP..', '..PP..', '..PP..', '..FF..'],
  walk0: ['..PP..', '.P..P.', '.P..P.', '.F..F.'],
  walk1: ['..PP..', '..PP..', '..PP..', '..FF..'],
  walk2: ['..PP..', '..PP..', '.P.P..', '.F.F..'],
  air: ['..PP..', '.P..P.', '.P...P', 'F.....'],
};

function bodyRows(look, pose, frame) {
  const k = look.kind;
  if (k === 'kid') {
    const top = look.female ? ['.HHH.', 'HHHS.', 'HSES.', '.CCC.', '.CAC.', '.CCC.'] : ['.HHH.', 'HHHS.', '.SES.', '.CCC.', '.CAC.', '.CCC.'];
    const leg = pose === 'walk' ? (frame % 2 ? ['.P.P.', 'F...F'] : ['..PP.', '..FF.']) : ['.P.P.', '.F.F.'];
    if (pose === 'sit') return top.concat(['.PPP.', '...F.']);
    return top.concat(leg);
  }
  let head;
  const st = look.style;
  if (st === 'long') head = ['.HHH..', 'HHHSS.', 'HHSES.', 'H.SS..'];
  else if (st === 'bun') head = ['HH....', 'HHHH..', '.HSES.', '..SS..'].map((r, i) => (i === 0 ? '.HH...' : i === 1 ? 'HHHHS.' : r));
  else if (st === 'bob') head = ['.HHH..', 'HHHSS.', 'HHSES.', '..SS..'];
  else if (st === 'cap') head = ['.KKK..', 'KKKKK.', '.HSES.', '..SS..'];
  else if (st === 'bald') head = ['.SSS..', 'SSSSS.', '.SSES.', '..SS..'];
  else if (st === 'messy') head = ['H.HH..', 'HHHHS.', '.HSES.', '..SS..'];
  else head = ['.HHH..', 'HHHSS.', '.HSES.', '..SS..'];
  let torso = ['.CCCC.', '.CCAC.', '.CCAC.', '.CCCS.'];
  if (look.scarf) torso = ['.XXXX.', 'BCCAC.', 'BCCAC.', 'BCCCS.'];
  if (look.apron) torso = ['.CCCC.', '.WWAW.', '.WWAW.', '.WWWS.'];
  if (pose === 'walk' && frame % 2 === 0) torso = torso.map((r, i) => (i === 3 ? r.replace('S', 'C').slice(0, 3) + 'S' + r.slice(4) : r));
  if (pose === 'work') torso = torso.map((r, i) => (i === 1 ? r.slice(0, 4) + 'SS'.slice(0, 2) : r)).map((r) => r.slice(0, 6));
  let legs;
  if (pose === 'walk') legs = [LEGS.walk0, LEGS.walk1, LEGS.walk2, LEGS.walk1][frame % 4];
  else if (pose === 'air') legs = LEGS.air;
  else if (pose === 'sit') legs = ['..PPPP', '.....P'];
  else legs = LEGS.stand;
  let rows = head.concat(torso, legs);
  if (k === 'elder') { rows = rows.map((r, i) => (i < 4 ? ('.' + r).slice(0, 6) : r)); rows.splice(5, 1); }
  return rows;
}

function climbRows(look, frame) {
  const a = frame % 2;
  return [
    a ? 'S.HH..' : '..HH.S', a ? 'AHHHH.' : '.HHHHA', a ? 'A.HH..' : '..HH.A', '.XXXX.', '.BBBB.', '.BBBB.', '.CBBC.', '.CCCC.',
    '..PP..', a ? '.P..P.' : '.P..P.', a ? '.P..P.' : '..P.P.', a ? '.F..F.' : '.F..F.',
  ];
}

const SPR = new Map();
function personSprite(look, pose, frame, face) {
  const key = look.id + pose + frame + face;
  let c = SPR.get(key);
  if (c) return c;
  const rows = pose === 'climb' ? climbRows(look, frame) : bodyRows(look, pose, frame);
  const hgt = rows.length, wid = 6;
  c = document.createElement('canvas'); c.width = wid + 2; c.height = hgt + 1;
  const x = c.getContext('2d');
  const col = {
    H: look.hair, S: look.skin, E: '#1a1412', C: look.shirt, A: shade(look.shirt, 0.78), P: look.pants, F: '#1c1a18',
    K: '#3a4a6a', X: look.scarf || look.shirt, B: look.bag || shade(look.shirt, 0.6), W: '#e8e4d8',
  };
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) {
      const ch = r[i]; if (ch === '.') continue;
      x.fillStyle = col[ch] || '#f0f';
      const xx = face < 0 ? r.length - 1 - i : i;
      x.fillRect(xx + 1, j, 1, 1);
    }
  });
  if (look.kind === 'elder' && pose !== 'sit') { x.fillStyle = '#6a5038'; const cx = face < 0 ? 0 : wid + 1; x.fillRect(cx, hgt - 6, 1, 6); }
  SPR.set(key, c);
  return c;
}

function drawPerson(ctx, look, x, y, pose, frame, face) {
  if (pose === 'sleep') {
    ctx.fillStyle = look.hair; ctx.fillRect(x - 7, y - 9, 3, 2);
    ctx.fillStyle = look.skin; ctx.fillRect(x - 6, y - 8, 2, 1);
    return;
  }
  const s = personSprite(look, pose, frame, face);
  const dy = pose === 'sit' ? 2 : 0;
  ctx.drawImage(s, Math.round(x - 4), Math.round(y - s.height + 1 + dy));
}

const CAT_COL = { orange: ['#d08040', '#a85e2a'], black: ['#1e1c1c', '#2e2a2a'], grey: ['#7a7a80', '#5a5a60'], calico: ['#e8e0d0', '#c07030'] };
function drawCat(ctx, x, y, face, col, pose, frame, eyesGlow) {
  const [a, b] = CAT_COL[col] || CAT_COL.orange;
  const P = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + (face < 0 ? -dx - w : dx)), Math.round(y + dy), w, h); };
  if (pose === 'sit') {
    P(-2, -6, 4, 6, a); P(1, -8, 3, 3, a); P(1, -9, 1, 1, a); P(3, -9, 1, 1, a); P(-3, -2, 2, 1, b); P(-4, -3, 1, 1, b);
    P(2, -7, 1, 1, eyesGlow ? '#c8ff60' : '#1a1a10');
    return;
  }
  const lg = frame % 2;
  P(-4, -4, 7, 3, a); P(2, -6, 3, 3, a); P(2, -7, 1, 1, a); P(4, -7, 1, 1, a); P(-6, -6 + lg, 2, 1, b); P(-5, -5, 1, 1, b);
  P(-3, -1, 1, 1, b); P(1, -1, 1, 1, b); if (lg) { P(-2, -1, 1, 1, b); P(2, -1, 1, 1, b); }
  P(4, -5, 1, 1, eyesGlow ? '#c8ff60' : '#1a1a10');
}
function drawRat(ctx, x, y, face, frame) {
  const P = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + (face < 0 ? -dx - w : dx)), Math.round(y + dy), w, h); };
  P(-3, -3, 5, 2, '#3a3028'); P(2, -3, 2, 1, '#3a3028'); P(3, -2, 1, 1, '#c89080'); P(-6, -2 + (frame % 2), 3, 1, '#5a4a40'); P(-2, -1, 1, 1, '#2a2018'); P(1, -1, 1, 1, '#2a2018');
  P(2, -4, 1, 1, '#4a3a30');
}
function drawPigeon(ctx, x, y, face, fly, frame) {
  const P = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + (face < 0 ? -dx - w : dx)), Math.round(y + dy), w, h); };
  if (fly) { P(-2, -2, 4, 2, '#6a6e78'); P(-3, frame % 2 ? -4 : -1, 2, 1, '#8a8e98'); P(1, frame % 2 ? -4 : -1, 2, 1, '#8a8e98'); P(2, -3, 1, 1, '#5a5e68'); return; }
  P(-2, -3, 4, 2, '#7a7e88'); P(1, -4, 2, 2, '#6a6e78'); P(2, -3, 1, 1, '#4a8a7a'); P(-1, -1, 1, 1, '#c86050'); P(1, -1, 1, 1, '#c86050'); P(-3, -3, 1, 1, '#5a5e68');
}

// Items held by the player
function drawItem(ctx, it, x, y) {
  const P = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + dx), Math.round(y + dy), w, h); };
  switch (it.icon) {
    case 'bucket': P(-2, -3, 5, 4, '#7a8a92'); P(-2, -4, 5, 1, '#9aaab2'); if (it.full) P(-1, -3, 3, 1, '#5ab0e0'); break;
    case 'box': P(-2, -4, 5, 4, '#a07a48'); P(-2, -4, 5, 1, '#c09a68'); P(0, -4, 1, 4, '#7a5a30'); break;
    case 'bowl': P(-2, -2, 5, 2, '#e8e4dc'); P(-1, -3, 3, 1, '#d8c070'); break;
    case 'bag': P(-2, -4, 4, 4, '#c8b080'); P(-1, -5, 2, 1, '#a08a60'); break;
    case 'bottle': P(-1, -5, 2, 5, '#3a8a5a'); P(-1, -6, 2, 1, '#e8e4dc'); break;
    case 'letter': P(-2, -3, 5, 3, '#e8e0cc'); P(-2, -3, 5, 1, '#c8b890'); break;
    case 'cloth': P(-2, -3, 5, 3, '#c84a5a'); P(-2, -1, 5, 1, '#a83a4a'); break;
    default: P(-2, -3, 4, 3, '#c8a040');
  }
}
