// Tiny synthesized sound effects (WebAudio). Starts after the first click.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.last = {}; }
  start() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.gain.value = 0.28; this.master.connect(this.ctx.destination); } catch { this.ctx = null; }
  }
  tone(f0, f1, dur, type = 'square', vol = 0.3) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, freq, vol = 0.3) {
    const c = this.ctx, t = c.currentTime;
    const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 45) return;
    this.last[name] = now;
    switch (name) {
      case 'dig': this.noise(0.07, 900, 0.35); break;
      case 'break': this.noise(0.14, 1400, 0.4); this.tone(180, 90, 0.08, 'triangle', 0.2); break;
      case 'place': this.tone(320, 160, 0.06, 'triangle', 0.35); break;
      case 'pickup': this.tone(660, 990, 0.07, 'square', 0.12); break;
      case 'swing': this.noise(0.06, 3000, 0.15); break;
      case 'hit': this.tone(220, 110, 0.08, 'square', 0.2); break;
      case 'hurt': this.tone(300, 120, 0.18, 'sawtooth', 0.2); break;
      case 'yelp': this.tone(520, 300, 0.16, 'sawtooth', 0.14); break;
      case 'yelp2': this.tone(820, 520, 0.14, 'sawtooth', 0.12); break;
      case 'growl': this.noise(0.3, 300, 0.4); this.tone(90, 70, 0.3, 'sawtooth', 0.12); break;
      case 'craft': this.tone(523, 784, 0.12, 'triangle', 0.2); setTimeout(() => this.tone(784, 1046, 0.12, 'triangle', 0.18), 90); break;
      case 'chime': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.25, 'triangle', 0.15), i * 110)); break;
      case 'heart': this.tone(700, 1100, 0.15, 'sine', 0.2); break;
      default: break;
    }
  }
}
