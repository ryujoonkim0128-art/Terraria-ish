import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game();
const fresh = !game.load();
const ui = new UI(document.getElementById('g'), game);
window.game = game; window.ui = ui;
if (fresh) { game.toast('TAP A PLOT TO PLANT'); game.toast('BUY SEEDS WITH 20 SHECKLES'); }

addEventListener('resize', () => ui.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) game.save(); });
addEventListener('pagehide', () => game.save());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  game.tick(dt); ui.render(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
