'use strict';
// All sound is synthesised: rain, the hum of the walls, drips, mahjong, planes, and the radio in your room.

const Sfx = {
  ctx: null, on: true,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(c.destination);
    const len = c.sampleRate * 2;
    const nb = c.createBuffer(1, len, c.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;
    this.noise = nb;
    const bb = c.createBuffer(1, len, c.sampleRate), bd = bb.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;
    // rain bed
    const rs = c.createBufferSource(); rs.buffer = nb; rs.loop = true;
    const rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 1400;
    const rf2 = c.createBiquadFilter(); rf2.type = 'highpass'; rf2.frequency.value = 300;
    this.rainG = c.createGain(); this.rainG.gain.value = 0;
    rs.connect(rf).connect(rf2).connect(this.rainG).connect(this.master); rs.start();
    // building hum and low city rumble
    const hs = c.createBufferSource(); hs.buffer = bb; hs.loop = true;
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 180;
    this.rumbleG = c.createGain(); this.rumbleG.gain.value = 0.25;
    hs.connect(hf).connect(this.rumbleG).connect(this.master); hs.start();
    const o1 = c.createOscillator(); o1.frequency.value = 100; const o2 = c.createOscillator(); o2.frequency.value = 50; o2.type = 'triangle';
    this.humG = c.createGain(); this.humG.gain.value = 0;
    o1.connect(this.humG); o2.connect(this.humG); this.humG.connect(this.master); o1.start(); o2.start();
    // plane
    const ps = c.createBufferSource(); ps.buffer = bb; ps.loop = true;
    this.planeF = c.createBiquadFilter(); this.planeF.type = 'lowpass'; this.planeF.frequency.value = 400;
    const ps2 = c.createBufferSource(); ps2.buffer = nb; ps2.loop = true;
    const pf2 = c.createBiquadFilter(); pf2.type = 'bandpass'; pf2.frequency.value = 2400; pf2.Q.value = 3;
    this.whineG = c.createGain(); this.whineG.gain.value = 0;
    this.planeG = c.createGain(); this.planeG.gain.value = 0;
    ps.connect(this.planeF).connect(this.planeG).connect(this.master); ps.start();
    ps2.connect(pf2).connect(this.whineG).connect(this.master); ps2.start();
    // radio
    this.radioG = c.createGain(); this.radioG.gain.value = 0;
    const rlp = c.createBiquadFilter(); rlp.type = 'bandpass'; rlp.frequency.value = 1100; rlp.Q.value = 0.6;
    const dl = c.createDelay(); dl.delayTime.value = 0.33; const fb = c.createGain(); fb.gain.value = 0.3;
    this.radioIn = c.createGain();
    this.radioIn.connect(rlp); rlp.connect(this.radioG); rlp.connect(dl); dl.connect(fb).connect(dl); dl.connect(this.radioG);
    this.radioG.connect(this.master);
    this.nextNote = 0; this.beat = 0;
  },
  resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); },
  setMuted(m) { this.on = !m; if (this.master) this.master.gain.value = m ? 0 : 0.8; },
  set(g, v, t = 0.3) { if (!this.ctx) return; g.gain.setTargetAtTime(v, this.ctx.currentTime, t); },
  blip(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(dur, freq, vol = 0.2, q = 1, delay = 0, type = 'bandpass') {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  step(metal) { this.hiss(0.05, metal ? 2500 : 900, metal ? 0.06 : 0.05, 2); },
  clank() { this.blip(rnd(300, 380), 0.08, 'square', 0.025); this.hiss(0.04, 3000, 0.04, 4); },
  drip(v = 1) { this.blip(rnd(900, 1700), 0.12, 'sine', 0.05 * v, rnd(200, 600)); },
  clack(v = 1) { const n = irnd(1, 4); for (let i = 0; i < n; i++) this.hiss(0.025, rnd(2800, 4200), 0.12 * v, 6, i * rnd(0.05, 0.12)); },
  coin() { this.blip(1320, 0.12, 'square', 0.04); this.blip(1760, 0.2, 'square', 0.035, 0, 0.07); },
  hurt() { this.blip(180, 0.25, 'sawtooth', 0.12, -120); this.hiss(0.15, 400, 0.3, 1); },
  thud() { this.blip(90, 0.25, 'sine', 0.35, -50); this.hiss(0.1, 200, 0.3, 1); },
  meow() { this.blip(700, 0.32, 'triangle', 0.06, 300); this.blip(900, 0.2, 'sine', 0.03, -400, 0.15); },
  squeak() { this.blip(2400, 0.08, 'square', 0.03, 800); },
  spark() { this.hiss(0.18, 5000, 0.18, 1, 0, 'highpass'); this.blip(60, 0.2, 'sawtooth', 0.08); },
  splash() { this.hiss(0.4, 700, 0.25, 0.7); },
  coo() { this.blip(420, 0.25, 'sine', 0.04, -80); this.blip(400, 0.3, 'sine', 0.04, -60, 0.28); },
  talk() { this.blip(rnd(260, 420), 0.05, 'triangle', 0.04); },
  ui() { this.blip(880, 0.06, 'triangle', 0.05); },
  thunder() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime; const s = c.createBufferSource(); s.buffer = this.brown; const g = c.createGain(); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.2, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 3.5); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + 4); },
  // pentatonic tune, half-heard through a cheap speaker
  radioTick(vol) {
    if (!this.ctx) return;
    this.set(this.radioG, vol, 0.4);
    if (vol < 0.005) return;
    const c = this.ctx, now = c.currentTime;
    if (this.nextNote < now) this.nextNote = now + 0.05;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    while (this.nextNote < now + 0.3) {
      const t = this.nextNote, s = this.beat++;
      const bar = Math.floor(s / 8) % 4;
      const root = [220, 196, 174.6, 196][bar];
      if (s % 8 === 0 || s % 8 === 5) this.note(root / 2, t, 0.9, 'triangle', 0.09);
      if (Math.random() < 0.72) {
        const deg = scale[(s * 3 + bar * 2 + (Math.random() < 0.3 ? 1 : 0)) % scale.length];
        this.note(root * Math.pow(2, deg / 12), t, 0.45, 'sine', 0.07);
      }
      this.nextNote += 0.32;
    }
  },
  note(f, t, d, type, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5; vg.gain.value = f * 0.006; vib.connect(vg).connect(o.frequency); vib.start(t); vib.stop(t + d + 0.1);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(this.radioIn); o.start(t); o.stop(t + d + 0.1);
  },
};
