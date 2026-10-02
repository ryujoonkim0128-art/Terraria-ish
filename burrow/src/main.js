// Boot: scale the canvases in whole pixels and start the game.
import { Game, VW, VH } from './game.js';

const view = document.getElementById('view');
const hud = document.getElementById('hud');
const stage = document.getElementById('stage');
const note = document.getElementById('note');

function fit() {
  const aw = Math.max(200, window.innerWidth - 32), ah = Math.max(150, window.innerHeight - 32);
  let s = Math.min(aw / VW, ah / VH);
  if (s >= 1) s = Math.floor(s);
  const w = Math.floor(VW * s), h = Math.floor(VH * s);
  for (const c of [view, hud]) { c.style.width = w + 'px'; c.style.height = h + 'px'; }
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
}

let seed = parseInt((location.hash || '').replace('#', ''), 10);
if (!Number.isFinite(seed)) seed = Math.floor(Math.random() * 1e6);
try {
  const game = new Game(view, hud, seed);
  window.game = game;
  fit();
  addEventListener('resize', fit);
  game.start();
} catch (e) {
  note.hidden = false;
  note.textContent = 'This browser could not start the game: ' + e.message;
  console.error(e);
}
