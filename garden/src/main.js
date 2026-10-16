// Boot: load the save, build the world and UI, keep the camera fitted to the phone, run the loop.
import { G, load, save, on } from './state.js';
import { update as sim, catchUp } from './sim.js';
import * as World from './world.js';
import { makeIcons } from './icons.js';
import * as UI from './ui.js';
import { resumeAudio, setNight } from './audio.js';

const app = document.getElementById('app');
const away = load();
World.init(app);
makeIcons();
UI.build(app);

const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0';
document.body.appendChild(probe);
function resize() {
  const cs = getComputedStyle(probe);
  const st = parseFloat(cs.paddingTop) || 0, sb = parseFloat(cs.paddingBottom) || 0;
  World.resize(app.clientWidth, app.clientHeight, st + 100, sb + 170);
}
resize();
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 250));
catchUp(away);

let running = false, last = performance.now(), saveT = 0;
UI.showTitle(app, () => { running = true; });
app.addEventListener('pointerdown', resumeAudio);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { G.hiddenAt = Date.now(); save(); }
  else if (G.hiddenAt) { catchUp(Math.min(8 * 3600, (Date.now() - G.hiddenAt) / 1000)); G.hiddenAt = 0; last = performance.now(); }
});
addEventListener('pagehide', save);
on('buy', save);

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (running) for (let k = 0; k < (window.game.speed || 1); k++) sim(dt);
  World.update(dt);
  UI.update(dt);
  setNight(World.env.night > 0.5);
  if ((saveT += dt) > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
window.game = { get G() { return G; }, sim, save, speed: 1, World, UI };
requestAnimationFrame(frame);
