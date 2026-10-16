// Boot: load the save, fit a crisp pixel buffer to the phone screen, run the loop, route touches.
import { canvas } from './util.js';
import { G, load, save, on } from './state.js';
import { update, catchUp } from './sim.js';
import { layout, updateScene, drawWorld, drawOverlayFx, L, W8 } from './scene.js';
import { UI, updateUI, drawUI, pointerDown, pointerMove, pointerUp, wheel } from './ui.js';
import { resumeAudio } from './audio.js';

const view = document.getElementById('view');
const vg = view.getContext('2d');
const probe = document.getElementById('safe');
let buf = null, scale = 1;

const away = load();

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  const cssW = Math.min(vw, Math.round(vh * 0.62));
  const Dw = Math.round(cssW * dpr), Dh = Math.round(vh * dpr);
  scale = Math.max(1, Math.min(Math.floor(Dw / 188), Math.floor(Dh / 352)));
  const W = Math.min(272, Math.ceil(Dw / scale)), H = Math.ceil(Dh / scale);
  view.width = W * scale; view.height = H * scale;
  view.style.width = (W * scale) / dpr + 'px';
  view.style.height = (H * scale) / dpr + 'px';
  vg.imageSmoothingEnabled = false;
  buf = canvas(W, H);
  const cs = getComputedStyle(probe);
  const toL = (v) => Math.ceil((parseFloat(v) || 0) * dpr / scale);
  layout(W, H, toL(cs.paddingTop), Math.max(toL(cs.paddingBottom), 2));
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

catchUp(away);

// ---- input
const toLogical = (e) => {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * buf.width, y: ((e.clientY - r.top) / r.height) * buf.height };
};
view.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  e.preventDefault();
  try { view.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  resumeAudio();
  const p = toLogical(e);
  pointerDown(p.x, p.y);
});
view.addEventListener('pointermove', (e) => { if (!e.isPrimary) return; const p = toLogical(e); pointerMove(p.x, p.y); });
view.addEventListener('pointerup', (e) => { if (!e.isPrimary) return; const p = toLogical(e); pointerUp(p.x, p.y); });
view.addEventListener('pointercancel', (e) => { if (!e.isPrimary) return; const p = toLogical(e); pointerUp(-999, -999); });
view.addEventListener('wheel', (e) => { e.preventDefault(); wheel(e.deltaY * 0.4); }, { passive: false });
view.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---- saving and time away
let saveT = 0, hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); save(); }
  else if (hiddenAt) { catchUp(Math.min(8 * 3600, (Date.now() - hiddenAt) / 1000)); hiddenAt = 0; last = performance.now(); }
});
window.addEventListener('pagehide', save);
on('sell', () => save());
on('buy', () => save());

// ---- loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const steps = window.game.speed || 1;
  for (let k = 0; k < steps; k++) update(dt);
  updateScene(dt);
  updateUI(dt);
  const g = buf.g;
  drawWorld(g);
  drawUI(g);
  drawOverlayFx(g);
  vg.drawImage(buf, 0, 0, view.width, view.height);
  if ((saveT += dt) > 5) { saveT = 0; save(); }
  requestAnimationFrame(frame);
}
window.game = { get G() { return G; }, UI, L, W8, speed: 1, save, update };
requestAnimationFrame(frame);
