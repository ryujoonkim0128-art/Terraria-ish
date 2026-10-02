// Synthesised sound: small effects, wind, and a music box for the phonograph. Starts on the first click.
const PENTA = [0, 2, 4, 7, 9];
const note = (n) => 440 * Math.pow(2, (n - 9) / 12); // n = semitones from C4

export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.last = {}; this.musicOn = false; this.nextNote = 0; this.step = 0; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const c = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = c.createGain(); this.master.gain.value = 0.32; this.master.connect(c.destination);
      // wind: looped filtered noise
      const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      let v = 0;
      for (let i = 0; i < len; i++) { v = v * 0.98 + (Math.random() * 2 - 1) * 0.02; d[i] = v * 6; }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      this.windF = c.createBiquadFilter(); this.windF.type = 'lowpass'; this.windF.frequency.value = 500;
      this.wind = c.createGain(); this.wind.gain.value = 0;
      src.connect(this.windF); this.windF.connect(this.wind); this.wind.connect(this.master); src.start();
    } catch { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.32; }

  tone(f0, f1, dur, type = 'square', vol = 0.3, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, freq, vol = 0.3, type = 'lowpass', when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const len = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  bellTone(f, vol, dur, when = 0) {
    this.tone(f, f, dur, 'sine', vol, when);
    this.tone(f * 2.76, f * 2.76, dur * 0.4, 'sine', vol * 0.3, when);
    this.tone(f * 5.4, f * 5.4, dur * 0.15, 'sine', vol * 0.12, when);
  }

  play(name, arg = 0) {
    if (!this.ctx || this.muted) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 40) return;
    this.last[name] = now;
    switch (name) {
      case 'dig': this.noise(0.08, 700 + Math.random() * 300, 0.4); break;
      case 'clink': this.tone(1400 + Math.random() * 300, 900, 0.07, 'triangle', 0.12); this.noise(0.05, 3000, 0.15, 'highpass'); break;
      case 'crumble': this.noise(0.25, 500, 0.45); this.tone(120, 60, 0.15, 'sine', 0.2); break;
      case 'pop': this.tone(500 + arg * 60, 900 + arg * 80, 0.08, 'sine', 0.22); break;
      case 'place': this.tone(300, 150, 0.07, 'triangle', 0.3); this.noise(0.05, 1200, 0.15); break;
      case 'hop': this.tone(380, 760, 0.12, 'sine', 0.18); break;
      case 'giggle': [0, 1, 2].forEach((i) => this.tone(700 + i * 90, 900 + i * 90, 0.06, 'sine', 0.12, i * 0.07)); break;
      case 'grab': this.tone(520, 680, 0.06, 'sine', 0.15); break;
      case 'thud': this.noise(0.08, 300, 0.4); this.tone(140, 70, 0.08, 'sine', 0.25); break;
      case 'purr': for (let i = 0; i < 8; i++) this.noise(0.07, 180, 0.3, 'lowpass', i * 0.09); this.tone(900, 1300, 0.1, 'sine', 0.06, 0.8); break;
      case 'meow': this.tone(700, 1000, 0.08, 'sawtooth', 0.05); this.tone(1000, 600, 0.22, 'sawtooth', 0.05, 0.08); break;
      case 'bell': this.bellTone(660, 0.3, 2.2); this.bellTone(660, 0.18, 1.8, 0.45); break;
      case 'chime': { const n = PENTA[arg % 5] + 12 * (1 + Math.floor(arg / 5) % 2); this.bellTone(note(n), 0.16, 1.4); break; }
      case 'click': this.tone(1800, 1200, 0.025, 'square', 0.08); break;
      case 'switch': this.tone(arg ? 900 : 500, arg ? 1200 : 350, 0.05, 'square', 0.08); break;
      case 'whoosh': this.noise(0.6, 2500, 0.15, 'bandpass'); this.tone(2000, 600, 0.6, 'sine', 0.05); break;
      case 'crackle': for (let i = 0; i < 6; i++) this.noise(0.03, 2500 + Math.random() * 2000, 0.25, 'highpass', i * 0.05 + Math.random() * 0.03); this.noise(0.5, 300, 0.25); break;
      case 'splash': this.noise(0.35, 1600, 0.35, 'bandpass'); this.tone(500, 900, 0.1, 'sine', 0.1, 0.05); break;
      case 'chop': this.noise(0.06, 1500, 0.4); this.tone(260, 180, 0.06, 'triangle', 0.25); break;
      case 'timber': this.noise(0.7, 400, 0.5); this.tone(110, 50, 0.4, 'sine', 0.3, 0.3); break;
      case 'cheer': [0, 4, 7, 12].forEach((s, i) => this.tone(note(12 + s), note(12 + s), 0.18, 'triangle', 0.12, i * 0.08)); break;
      case 'arrive': [0, 4, 7, 11, 14].forEach((s, i) => this.bellTone(note(12 + s), 0.12, 0.9, i * 0.12)); break;
      case 'nope': this.tone(220, 180, 0.12, 'square', 0.07); this.tone(180, 150, 0.12, 'square', 0.07, 0.1); break;
      case 'snow': this.noise(0.25, 3500, 0.12, 'highpass'); break;
      case 'harvest': this.tone(600, 1200, 0.1, 'sine', 0.2); this.tone(900, 1800, 0.1, 'sine', 0.15, 0.06); break;
      case 'sizzle': this.noise(0.5, 5000, 0.12, 'highpass'); break;
      case 'page': this.noise(0.12, 4000, 0.1, 'bandpass'); break;
      case 'boing': this.tone(200, 500, 0.15, 'sine', 0.2); this.tone(500, 260, 0.15, 'sine', 0.12, 0.12); break;
      case 'build': this.tone(240 + Math.random() * 60, 200, 0.05, 'square', 0.1); this.noise(0.04, 2000, 0.2); break;
      case 'done': [0, 7, 12].forEach((s, i) => this.tone(note(7 + s), note(7 + s), 0.2, 'triangle', 0.14, i * 0.1)); break;
      case 'yawn': this.tone(400, 250, 0.5, 'sine', 0.06); break;
      case 'munch': for (let i = 0; i < 3; i++) this.noise(0.04, 1200, 0.2, 'lowpass', i * 0.12); break;
      default: break;
    }
  }

  // Called every frame: wind level, phonograph music box, and a sparse lullaby in quiet moments.
  update(dt, windLevel, music) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(windLevel * 0.5, t, 0.5);
    this.windF.frequency.setTargetAtTime(350 + Math.sin(t * 0.3) * 150, t, 0.5);
    if (music > 0) {
      if (this.nextNote < t) this.nextNote = t + 0.05;
      while (this.nextNote < t + 0.2) {
        const tune = [0, 4, 7, 9, 7, 4, 2, 4, 0, 2, 4, 7, 12, 9, 7, 4];
        const bass = [-12, -5, -8, -5];
        const s = this.step++;
        const when = this.nextNote - t;
        this.bellTone(note(12 + tune[s % 16]), 0.11 * music, 0.7, when);
        if (s % 4 === 0) this.tone(note(bass[(s / 4) % 4] + 12), note(bass[(s / 4) % 4] + 12), 1.0, 'triangle', 0.06 * music, when);
        this.nextNote += 0.3;
      }
    } else if (Math.random() < dt * 0.06) {
      const n = PENTA[Math.floor(Math.random() * 5)] + 12 * (1 + Math.floor(Math.random() * 2));
      this.bellTone(note(n), 0.035, 1.6);
    }
  }
}
