'use strict';
// Lighting: an ambient grid from sky exposure, additive light gradients clipped to rooms,
// then the scene is multiplied by a Bayer-dithered, quantised copy of that light.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const LEVELS = 10;

const Light = {
  init() {
    this.lc = document.createElement('canvas'); this.lc.width = VW; this.lc.height = VH;
    this.lx = this.lc.getContext('2d', { willReadFrequently: true });
    this.ac = document.createElement('canvas'); this.ac.width = VW / T + 3; this.ac.height = VH / T + 3;
    this.ax = this.ac.getContext('2d');
    this.aimg = this.ax.createImageData(this.ac.width, this.ac.height);
  },

  // sky = {r,g,b} ambient light colour outside (0..255), base interior ambient
  ambient(w, cx, cy, sky, flash) {
    const { W, H, exp, bg } = w;
    const tx0 = Math.floor(cx / T) - 1, ty0 = Math.floor(cy / T) - 1;
    const d = this.aimg.data, aw = this.ac.width, ah = this.ac.height;
    for (let j = 0; j < ah; j++) for (let i = 0; i < aw; i++) {
      const tx = clamp(tx0 + i, 0, W - 1), ty = clamp(ty0 + j, 0, H - 1), k = ty * W + tx;
      const e = exp[k], b = bg[k];
      let r = 21, g = 20, bl = 27;
      if (b === B_SEWER) { r = 16; g = 20; bl = 18; }
      else if (b === B_EARTH) { r = 8; g = 8; bl = 10; }
      r += sky[0] * e + flash * e * 200; g += sky[1] * e + flash * e * 210; bl += sky[2] * e + flash * e * 255;
      const o = (j * aw + i) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = bl; d[o + 3] = 255;
    }
    this.ax.putImageData(this.aimg, 0, 0);
    const x = this.lx;
    x.globalCompositeOperation = 'source-over';
    x.imageSmoothingEnabled = true;
    x.drawImage(this.ac, 0, 0, aw, ah, tx0 * T - cx, ty0 * T - cy, aw * T, ah * T);
  },

  add(xx, yy, r, c, k, clip, sx = 1) {
    const x = this.lx;
    x.save();
    x.globalCompositeOperation = 'lighter';
    if (clip) { x.beginPath(); x.rect(clip[0], clip[1], clip[2], clip[3]); x.clip(); }
    x.translate(xx, yy); x.scale(sx, 1);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, `rgba(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0},1)`);
    g.addColorStop(0.45, `rgba(${c[0] * k * 0.55 | 0},${c[1] * k * 0.55 | 0},${c[2] * k * 0.55 | 0},1)`);
    g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g;
    x.fillRect(-r, -r, r * 2, r * 2);
    x.restore();
  },

  // multiply scene canvas by the dithered light
  apply(sctx, cx, cy) {
    const L = this.lx.getImageData(0, 0, VW, VH).data;
    const S = sctx.getImageData(0, 0, VW, VH);
    const s = S.data;
    const gain = 1.35;
    for (let y = 0; y < VH; y++) {
      const by = ((y + cy) & 3) << 2;
      for (let x = 0; x < VW; x++) {
        const o = (y * VW + x) * 4;
        if (s[o + 3] === 0) continue;
        const th = BAYER[by | ((x + cx) & 3)];
        for (let c = 0; c < 3; c++) {
          const v = L[o + c] / 255 * LEVELS;
          let q = Math.floor(v); if (v - q > th) q++;
          s[o + c] = Math.min(255, s[o + c] * q / LEVELS * gain);
        }
      }
    }
    sctx.putImageData(S, 0, 0);
  },
};

// A lit night view of the whole city, used for the map and the opening shot.
function bakeLitWorld(w, worldCv) {
  const PW = w.W * T, PH = w.H * T;
  const lc = document.createElement('canvas'); lc.width = PW; lc.height = PH;
  const x = lc.getContext('2d', { willReadFrequently: true });
  const amb = document.createElement('canvas'); amb.width = w.W; amb.height = w.H;
  const ax = amb.getContext('2d');
  const im = ax.createImageData(w.W, w.H);
  for (let i = 0; i < w.W * w.H; i++) {
    const e = w.exp[i];
    im.data[i * 4] = 14 + 40 * e; im.data[i * 4 + 1] = 14 + 46 * e; im.data[i * 4 + 2] = 22 + 80 * e; im.data[i * 4 + 3] = 255;
  }
  ax.putImageData(im, 0, 0);
  x.imageSmoothingEnabled = true;
  x.drawImage(amb, 0, 0, PW, PH);
  x.globalCompositeOperation = 'lighter';
  for (const L of w.lights) {
    const rm = L.room !== undefined ? w.rooms[L.room] : null;
    x.save();
    if (rm) { x.beginPath(); x.rect(rm.x0 * T - 2, rm.y0 * T, (rm.x1 - rm.x0 + 1) * T + 4, (rm.y1 - rm.y0 + 1) * T); x.clip(); }
    const g = x.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 1.1);
    const c = L.c;
    g.addColorStop(0, `rgb(${c[0]},${c[1]},${c[2]})`); g.addColorStop(0.5, `rgb(${c[0] * 0.5 | 0},${c[1] * 0.5 | 0},${c[2] * 0.5 | 0})`); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(L.x - L.r * 1.1, L.y - L.r * 1.1, L.r * 2.2, L.r * 2.2);
    x.restore();
  }
  const Ld = x.getImageData(0, 0, PW, PH).data;
  const out = document.createElement('canvas'); out.width = PW; out.height = PH;
  const ox = out.getContext('2d');
  ox.drawImage(worldCv, 0, 0);
  const S = ox.getImageData(0, 0, PW, PH), s = S.data;
  for (let i = 0; i < s.length; i += 4) {
    if (!s[i + 3]) continue;
    s[i] = Math.min(255, s[i] * Ld[i] / 190); s[i + 1] = Math.min(255, s[i + 1] * Ld[i + 1] / 190); s[i + 2] = Math.min(255, s[i + 2] * Ld[i + 2] / 190);
  }
  ox.putImageData(S, 0, 0);
  for (const wn of w.wins) if (wn.on) { ox.fillStyle = wn.c; ox.fillRect(wn.x, wn.y, wn.w, wn.h); }
  for (const s2 of w.signs) drawSignLit(ox, s2, s2.x, s2.y, 1);
  for (const L of w.lights) if (L.kind === 'bulb' || L.kind === 'tube') { ox.fillStyle = '#fff4d8'; ox.fillRect(L.x - (L.kind === 'tube' ? 6 : 0), L.y + 1, L.kind === 'tube' ? 13 : 2, 1); }
  return out;
}

function drawSignLit(ctx, s, x, y, k) {
  ctx.globalAlpha = k;
  ctx.fillStyle = s.col;
  ctx.fillRect(x, y, s.w, 1); ctx.fillRect(x, y + s.h - 1, s.w, 1); ctx.fillRect(x, y, 1, s.h); ctx.fillRect(x + s.w - 1, y, 1, s.h);
  const gl = s.glyphs || [];
  ctx.globalAlpha = k * 0.5;
  gl.forEach((g, gi) => { for (let j = 0; j < 81; j++) if (g[j]) { const gx = x + 2 + (j % 9), gy = y + 2 + gi * 11 + ((j / 9) | 0); ctx.fillRect(gx - 1, gy, 3, 1); ctx.fillRect(gx, gy - 1, 1, 3); } });
  ctx.globalAlpha = k;
  ctx.fillStyle = '#fff';
  gl.forEach((g, gi) => { for (let j = 0; j < 81; j++) if (g[j]) ctx.fillRect(x + 2 + (j % 9), y + 2 + gi * 11 + ((j / 9) | 0), 1, 1); });
  ctx.globalAlpha = 1;
}
