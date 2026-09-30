// Boot: size the canvases to whole-pixel multiples and start the game.
import { Game, VW, VH } from './game.js';

const view = document.getElementById('view');
const hud = document.getElementById('hud');
const stage = document.getElementById('stage');
const note = document.getElementById('note');

function fit() {
  const pad = 16;
  const aw = Math.max(200, stage.parentElement.clientWidth - 0), ah = Math.max(150, window.innerHeight - pad * 2);
  let s = Math.min(aw / VW, ah / VH);
  if (s >= 1) s = Math.floor(s);
  const w = Math.floor(VW * s), h = Math.floor(VH * s);
  for (const c of [view, hud]) { c.style.width = w + 'px'; c.style.height = h + 'px'; }
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
}

function start(saved) {
  let seed = parseInt((location.hash || '').replace('#', ''), 10);
  if (saved?.seed) seed = saved.seed;
  if (!Number.isFinite(seed)) seed = Math.floor(Math.random() * 1e6);
  try {
    const game = new Game(view, hud, seed, saved?.player ? saved : null);
    window.game = game;
    window.claude?.hot?.snapshot?.(() => game.snapshot());
    fit();
    addEventListener('resize', fit);
    game.start();
    if (matchMedia('(pointer: coarse)').matches) note.hidden = false;
  } catch (e) {
    note.hidden = false;
    note.textContent = 'This browser could not start the game: ' + e.message;
    console.error(e);
  }
}
const hot = window.claude?.hot;
if (hot?.ready) hot.ready(start); else start(hot?.data ?? {});
