// Boot: load the save, build the world and UI, keep the camera fitted to the phone, run the loop.
import * as State from './state.js';
import { G, load, save, on } from './state.js';
import { update as sim, catchUp } from './sim.js';
import * as World from './world.js';
import { makeIcons } from './icons.js';
import * as UI from './ui.js';
import { resumeAudio, setNight } from './audio.js';

const app = document.getElementById('app');
// a sliding sheet or a focused button must never scroll the game layer out from under your thumb
app.addEventListener('scroll', () => { app.scrollTop = 0; app.scrollLeft = 0; });
const away = load();
World.init(app);
makeIcons();
UI.build(app);

function resize() { World.resize(app.clientWidth, app.clientHeight); }
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

// the next frame is asked for first, so one error can't freeze the game; it shows on screen instead (see crash.js)
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  try {
    if (running) for (let k = 0; k < (window.game.speed || 1); k++) sim(dt);
    World.update(dt, UI.input);
    UI.update(dt);
    setNight(World.env.night > 0.5);
    if ((saveT += dt) > 5) { saveT = 0; save(); }
  } catch (e) {
    if (window.crashReport) window.crashReport(e);
  }
}
window.game = { get G() { return State.G; }, sim, save, speed: 1, World, UI, State };
requestAnimationFrame(frame);
