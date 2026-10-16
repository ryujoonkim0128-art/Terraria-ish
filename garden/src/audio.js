// Tiny WebAudio synth: sound effects and a gentle generative music loop. Starts on first tap.
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let soundOn = true, musicOn = true;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { ctx = null; return; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.5 : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.16 : 0; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  startMusic();
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function setSound(on) { soundOn = on; if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.05); }
export function setMusic(on) { musicOn = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.3); }

function tone(freq, t0, dur, { type = 'square', vol = 0.2, slide = 0, bus = sfxBus, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', bus = sfxBus } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
let lastPlay = {};
const BUZZ = { plant: 6, harvest: 8, sell: [12, 40, 12], hatch: [20, 60, 20], error: 15, thunder: 30, expand: 20 };
export function sfx(name, arg = 0) {
  if (soundOn && BUZZ[name] && navigator.vibrate) { try { navigator.vibrate(BUZZ[name]); } catch { /* not allowed */ } }
  if (!ctx || !soundOn) return;
  const t = ctx.currentTime;
  if (lastPlay[name] && t - lastPlay[name] < 0.035) return;
  lastPlay[name] = t;
  switch (name) {
    case 'tap': tone(N(84), t, 0.04, { type: 'square', vol: 0.06 }); break;
    case 'plant': noise(t, 0.08, { vol: 0.25, freq: 600 }); tone(N(67 + (arg % 5) * 2), t + 0.02, 0.1, { type: 'triangle', vol: 0.25, slide: 1.5 }); break;
    case 'harvest': tone(N(76 + (arg % 6) * 2), t, 0.08, { type: 'square', vol: 0.09 }); tone(N(83 + (arg % 6) * 2), t + 0.05, 0.12, { type: 'triangle', vol: 0.18 }); break;
    case 'pop': tone(N(72), t, 0.06, { type: 'sine', vol: 0.3, slide: 2.2 }); break;
    case 'coin': tone(N(88), t, 0.07, { type: 'square', vol: 0.07 }); tone(N(95), t + 0.06, 0.18, { type: 'square', vol: 0.07 }); break;
    case 'sell': [0, 4, 7, 12].forEach((s, k) => tone(N(79 + s), t + k * 0.06, 0.16, { type: 'square', vol: 0.07 })); noise(t, 0.2, { vol: 0.08, freq: 5000, q: 2 }); break;
    case 'buy': tone(N(72), t, 0.07, { type: 'triangle', vol: 0.25 }); tone(N(79), t + 0.06, 0.12, { type: 'triangle', vol: 0.25 }); break;
    case 'error': tone(N(50), t, 0.12, { type: 'square', vol: 0.08 }); tone(N(47), t + 0.1, 0.16, { type: 'square', vol: 0.08 }); break;
    case 'dig': noise(t, 0.15, { vol: 0.3, freq: 400, q: 0.8 }); tone(N(48), t, 0.1, { type: 'triangle', vol: 0.2, slide: 0.6 }); break;
    case 'water': noise(t, 0.35, { vol: 0.12, freq: 3000, q: 0.6 }); break;
    case 'open': tone(N(67), t, 0.06, { type: 'triangle', vol: 0.18, slide: 1.3 }); tone(N(74), t + 0.05, 0.08, { type: 'triangle', vol: 0.15 }); break;
    case 'close': tone(N(74), t, 0.06, { type: 'triangle', vol: 0.15, slide: 0.75 }); break;
    case 'thunder': noise(t, 1.6, { vol: 0.6, freq: 120, q: 0.4, type: 'lowpass' }); noise(t, 0.3, { vol: 0.3, freq: 2500, q: 0.3 }); break;
    case 'hatch': [0, 4, 7, 11, 12, 16].forEach((s, k) => tone(N(72 + s), t + k * 0.07, 0.22, { type: 'square', vol: 0.06 })); break;
    case 'crack': noise(t, 0.05, { vol: 0.3, freq: 3000, q: 3 }); break;
    case 'mut': tone(N(91), t, 0.1, { type: 'sine', vol: 0.12 }); tone(N(98), t + 0.05, 0.15, { type: 'sine', vol: 0.1 }); break;
    case 'expand': [0, 2, 4, 7, 9, 12].forEach((s, k) => tone(N(67 + s), t + k * 0.05, 0.15, { type: 'triangle', vol: 0.2 })); break;
    case 'fanfare': [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.5], [12, 0.62]].forEach(([s, d]) => tone(N(72 + s), t + d, 0.22, { type: 'square', vol: 0.07 })); noise(t + 0.62, 0.4, { vol: 0.1, freq: 6000, q: 1 }); break;
  }
}

// --- music: a slow pentatonic lullaby over soft chords, re-rolled every bar ---
const SCALE = [0, 2, 4, 7, 9];
const CHORDS = [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]];
let nextBar = 0, bar = 0, night = false, festival = false;
export function setNight(n) { night = n; }
export function setFestival(f) { festival = f; }
function startMusic() {
  nextBar = ctx.currentTime + 0.3;
  setInterval(schedule, 200);
}
function schedule() {
  if (!ctx || ctx.state !== 'running') return;
  while (nextBar < ctx.currentTime + 1.2) {
    const beat = festival ? 0.3 : night ? 0.6 : 0.42, root = 60 + (night && !festival ? -3 : festival ? 2 : 0);
    const ch = CHORDS[bar % 4];
    ch.forEach((s) => tone(N(root - 12 + s), nextBar, beat * 4, { type: 'triangle', vol: 0.05, bus: musicBus, attack: 0.08 }));
    tone(N(root - 24 + ch[0]), nextBar, beat * 2, { type: 'sine', vol: 0.12, bus: musicBus, attack: 0.02 });
    tone(N(root - 24 + ch[0] + 7), nextBar + beat * 2, beat * 2, { type: 'sine', vol: 0.09, bus: musicBus, attack: 0.02 });
    let deg = 2 + ((bar * 3) % 5);
    for (let i = 0; i < 4; i++) {
      if (Math.random() < 0.28) continue;
      deg = Math.max(0, Math.min(9, deg + [-2, -1, 1, 2, 0][(Math.random() * 5) | 0]));
      const n = root + 12 + SCALE[deg % 5] + 12 * Math.floor(deg / 5) - 12;
      tone(N(n), nextBar + i * beat, beat * 0.9, { type: night && !festival ? 'sine' : 'square', vol: night && !festival ? 0.07 : festival ? 0.035 : 0.025, bus: musicBus, attack: 0.01 });
    }
    // on Market Day: a shaker on every beat and a little oom-pah
    if (festival) for (let i = 0; i < 4; i++) {
      noise(nextBar + i * beat, 0.05, { vol: 0.05, freq: 7000, q: 1.5, bus: musicBus });
      if (i % 2) tone(N(root - 12 + ch[1]), nextBar + i * beat, beat * 0.5, { type: 'triangle', vol: 0.06, bus: musicBus });
    }
    nextBar += beat * 4;
    bar++;
  }
}
