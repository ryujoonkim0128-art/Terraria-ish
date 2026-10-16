// Tiny synthesized sound effects and weather ambience with WebAudio.
export class Sfx {
  constructor() { this.ctx = null; this.muted = false; this.amb = null; this.ambId = null; }
  unlock() { if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; } try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0.25; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; } }
  tone(f0, f1, dur, type = 'square', vol = 1, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, delay = 0, lp = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay, n = this.ctx.sampleRate * dur;
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lp; s.buffer = b; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  play(name) {
    switch (name) {
      case 'click': this.tone(600, 400, 0.05, 'square', 0.4); break;
      case 'plant': this.tone(220, 120, 0.12, 'triangle', 0.8); this.noise(0.08, 0.15); break;
      case 'harvest': this.tone(500, 800, 0.08, 'square', 0.5); this.tone(800, 1100, 0.1, 'square', 0.4, 0.07); break;
      case 'buy': this.tone(700, 900, 0.07, 'square', 0.5); this.tone(1000, 1300, 0.1, 'square', 0.4, 0.08); break;
      case 'sell': for (let i = 0; i < 5; i++) this.tone(900 + i * 150, 1200 + i * 150, 0.08, 'square', 0.4, i * 0.06); break;
      case 'deny': this.tone(200, 120, 0.15, 'sawtooth', 0.4); break;
      case 'water': this.noise(0.25, 0.2, 0, 2500); this.tone(900, 500, 0.15, 'sine', 0.3); break;
      case 'place': this.tone(300, 200, 0.1, 'triangle', 0.6); break;
      case 'rare': for (let i = 0; i < 4; i++) this.tone([523, 659, 784, 1046][i], [523, 659, 784, 1046][i], 0.15, 'triangle', 0.5, i * 0.08); break;
      case 'mutate': this.tone(300, 1200, 0.25, 'sine', 0.5); break;
      case 'hatch': for (let i = 0; i < 6; i++) this.tone(400 + i * 120, 500 + i * 120, 0.1, 'triangle', 0.5, i * 0.07); break;
      case 'eat': this.tone(300, 200, 0.08, 'square', 0.4); this.tone(300, 200, 0.08, 'square', 0.4, 0.12); break;
      case 'thunder': this.noise(1.2, 0.8, 0, 400); this.tone(80, 30, 0.8, 'sawtooth', 0.4); break;
      case 'meteor': this.tone(1500, 100, 0.6, 'sawtooth', 0.3); this.noise(0.4, 0.3, 0.5, 600); break;
      case 'weather': this.tone(400, 600, 0.3, 'sine', 0.4); this.tone(600, 800, 0.3, 'sine', 0.3, 0.25); break;
    }
  }
  ambient(id, night) {
    const want = (id === 'rain' || id === 'storm' || id === 'choc') ? 'rain' : null;
    if (!this.ctx) return;
    if (want === this.ambId) { if (this.amb) this.amb.gain.gain.value = this.muted ? 0 : 0.12; return; }
    if (this.amb) { this.amb.src.stop(); this.amb = null; }
    this.ambId = want;
    if (!want) return;
    const n = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    src.buffer = b; src.loop = true; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = this.muted ? 0 : 0.12;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.amb = { src, gain: g };
  }
}
