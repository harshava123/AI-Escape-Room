// All sound effects are synthesized with the Web Audio API - no audio files needed.

let ctx = null;
let master = null;
let ambient = null;
let muted = localStorage.getItem('room404-muted') === '1';

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  startAmbient();
}

export const isMuted = () => muted;

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('room404-muted', muted ? '1' : '0');
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
  return muted;
}

function tone(freq, { dur = 0.15, type = 'sine', vol = 0.2, delay = 0, slide = null } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur = 0.2, vol = 0.15) {
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  gain.gain.value = vol;
  src.buffer = buffer;
  src.connect(filter).connect(gain).connect(master);
  src.start();
}

function startAmbient() {
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sawtooth';
  osc.frequency.value = 55;
  osc2.type = 'sine';
  osc2.frequency.value = 82.4;
  filter.type = 'lowpass';
  filter.frequency.value = 220;
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 0.015;
  gain.gain.value = 0.03;
  lfo.connect(lfoGain).connect(gain.gain);
  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(master);
  osc.start();
  osc2.start();
  lfo.start();
  ambient = { gain };
}

export const sfx = {
  click: () => tone(1400, { dur: 0.04, type: 'square', vol: 0.05 }),
  key: () => tone(900 + Math.random() * 200, { dur: 0.06, type: 'square', vol: 0.06 }),
  blip: () => tone(2200 + Math.random() * 400, { dur: 0.015, type: 'square', vol: 0.015 }),
  send: () => tone(600, { dur: 0.12, type: 'triangle', vol: 0.12, slide: 1200 }),
  success: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { dur: 0.18, type: 'triangle', vol: 0.16, delay: i * 0.08 })),
  error: () => {
    tone(180, { dur: 0.22, type: 'sawtooth', vol: 0.18 });
    tone(140, { dur: 0.3, type: 'sawtooth', vol: 0.18, delay: 0.18 });
  },
  pickup: () => {
    tone(700, { dur: 0.12, type: 'sine', vol: 0.18, slide: 1600 });
    tone(1600, { dur: 0.2, type: 'triangle', vol: 0.1, delay: 0.1 });
  },
  alarm: () => {
    for (let i = 0; i < 4; i++) tone(i % 2 ? 620 : 880, { dur: 0.14, type: 'square', vol: 0.1, delay: i * 0.14 });
    noise(0.3, 0.12);
  },
  hint: () => [880, 1320].forEach((f, i) => tone(f, { dur: 0.3, type: 'sine', vol: 0.12, delay: i * 0.12 })),
  achievement: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, { dur: 0.25, type: 'triangle', vol: 0.12, delay: i * 0.07 })),
  tick: () => tone(1000, { dur: 0.05, type: 'square', vol: 0.08 }),
  unlock: () => {
    noise(0.12, 0.2);
    tone(300, { dur: 0.1, type: 'square', vol: 0.12, delay: 0.05 });
    tone(450, { dur: 0.2, type: 'square', vol: 0.12, delay: 0.15 });
  },
  victory: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, { dur: 0.3, type: 'triangle', vol: 0.18, delay: i * 0.12 }));
    if (ambient) ambient.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  },
  defeat: () => {
    tone(400, { dur: 1.2, type: 'sawtooth', vol: 0.2, slide: 60 });
    if (ambient) ambient.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  },
  boot: () => tone(120, { dur: 0.6, type: 'sawtooth', vol: 0.15, slide: 880 }),
  restoreAmbient: () => ambient && ambient.gain.gain.setTargetAtTime(0.03, ctx.currentTime, 0.5),
};
