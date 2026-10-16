// Boot: size the canvases to whole-pixel multiples, load the save, start the loop.
import { Game, VW, VH } from './game.js';

const view = document.getElementById('view');
const hud = document.getElementById('hud');
const stage = document.getElementById('stage');
const note = document.getElementById('note');

function fit() {
  const aw = Math.max(240, stage.parentElement.clientWidth), ah = Math.max(135, window.innerHeight - 32);
  let s = Math.min(aw / VW, ah / VH);
  if (s >= 1) s = Math.floor(s);
  const w = Math.floor(VW * s), h = Math.floor(VH * s);
  for (const c of [view, hud]) { c.style.width = w + 'px'; c.style.height = h + 'px'; }
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
}

function start() {
  const fresh = location.hash === '#new';
  const saved = fresh ? null : Game.load();
  try {
    const game = new Game(view, hud, saved);
    window.game = game;
    fit();
    addEventListener('resize', fit);
    game.camSnap = true;
    if (!game.s.welcomed) { game.s.welcomed = true; game.toast('Welcome to your garden! Buy a Carrot seed from Sam to get started.', '#ffe680'); game.toast('Press H for help.', '#d0d0d0'); }
    let last = performance.now();
    let frames = 0, acc = 0;
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      game.frame(dt);
      frames++; acc += dt; if (acc >= 1) { game.fps = frames; frames = 0; acc = 0; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if (matchMedia('(pointer: coarse)').matches) note.hidden = false;
  } catch (e) {
    note.hidden = false;
    note.textContent = 'This browser could not start the game: ' + e.message;
    console.error(e);
  }
}
start();
