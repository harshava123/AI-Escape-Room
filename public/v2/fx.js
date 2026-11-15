// Canvas visual effects: drifting background particles, bursts and confetti.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setupCanvas(id) {
  const canvas = document.getElementById(id);
  const ctx = canvas.getContext('2d');
  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  return ctx;
}

const bg = setupCanvas('fx-bg');
const top = setupCanvas('fx-top');

const COLORS = ['#00f0ff', '#ff2bd6', '#39ff88', '#ffb400'];
const dust = Array.from({ length: reduced ? 0 : 70 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  r: Math.random() * 1.6 + 0.3,
  vx: (Math.random() - 0.5) * 0.15,
  vy: -Math.random() * 0.25 - 0.05,
  a: Math.random() * 0.5 + 0.15,
  c: Math.random() < 0.8 ? '#00f0ff' : '#ff2bd6',
}));

let particles = [];
let mood = '#00f0ff';

export function setMood(color) {
  mood = color;
}

export function burst(x, y, { count = 40, colors = COLORS, speed = 6, gravity = 0.12, life = 60 } = {}) {
  if (reduced) return;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const v = Math.random() * speed + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      g: gravity,
      life,
      max: life,
      size: Math.random() * 3 + 1.5,
      color: colors[(Math.random() * colors.length) | 0],
      spin: Math.random() * 0.4,
      rot: Math.random() * Math.PI,
      rect: false,
    });
  }
}

export function confetti() {
  if (reduced) return;
  const w = window.innerWidth;
  for (let i = 0; i < 220; i++) {
    particles.push({
      x: Math.random() * w,
      y: -20 - Math.random() * window.innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      g: 0.03,
      life: 260,
      max: 260,
      size: Math.random() * 6 + 4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      spin: (Math.random() - 0.5) * 0.3,
      rot: Math.random() * Math.PI,
      rect: true,
    });
  }
}

export function floatText(text, x, y) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function frame() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  bg.clearRect(0, 0, w, h);
  for (const d of dust) {
    d.x += d.vx;
    d.y += d.vy;
    if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
    if (d.x < -5) d.x = w + 5;
    if (d.x > w + 5) d.x = -5;
    bg.globalAlpha = d.a;
    bg.fillStyle = d.c === '#00f0ff' ? mood : d.c;
    bg.beginPath();
    bg.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    bg.fill();
  }

  top.clearRect(0, 0, w, h);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g;
    p.vx *= 0.99;
    p.rot += p.spin;
    p.life--;
    top.globalAlpha = Math.min(1, p.life / (p.max * 0.4));
    top.fillStyle = p.color;
    top.shadowColor = p.color;
    top.shadowBlur = p.rect ? 0 : 10;
    top.save();
    top.translate(p.x, p.y);
    top.rotate(p.rot);
    if (p.rect) top.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    else top.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    top.restore();
  }
  top.globalAlpha = 1;
  top.shadowBlur = 0;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
