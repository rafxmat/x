// confetti.js — Kazanma konfetisi (canvas)
// Bağımlılık: #confetti-canvas DOM elementi

let _confettiParticles = [];
let _confettiAF        = null;
const CONF_COLORS = ['#4ade80','#fbbf24','#a78bfa','#f87171','#60a5fa','#fb923c'];

class ConfettiParticle {
  constructor(canvas) { this.reset(canvas); }
  reset(canvas) {
    this.x       = Math.random() * canvas.width;
    this.y       = -12;
    this.size    = Math.random() * 7 + 4;
    this.ratio   = Math.random() * 0.6 + 0.3;
    this.color   = CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)];
    this.speedY  = Math.random() * 2.5 + 2;
    this.speedX  = (Math.random() - 0.5) * 2.2;
    this.rot     = Math.random() * Math.PI * 2;
    this.rotSpd  = (Math.random() - 0.5) * 0.14;
    this.gravity = 0.04;
  }
  update() {
    this.y += this.speedY; this.x += this.speedX;
    this.rot += this.rotSpd; this.speedY += this.gravity;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size * this.ratio / 2, this.size, this.size * this.ratio);
    ctx.restore();
  }
}

function _confettiFrame() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  _confettiParticles = _confettiParticles.filter(p => p.y < canvas.height + 20);
  _confettiParticles.forEach(p => { p.update(); p.draw(ctx); });
  if (_confettiParticles.length > 0) _confettiAF = requestAnimationFrame(_confettiFrame);
  else _confettiAF = null;
}

function startConfetti() {
  const canvas  = document.getElementById('confetti-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  _confettiParticles = Array.from({ length: 140 }, () => new ConfettiParticle(canvas));
  if (_confettiAF) cancelAnimationFrame(_confettiAF);
  _confettiAF = null;
  _confettiFrame();
}

/* Milestone kutlaması için hafif patlama — mevcut animasyona eklenir */
function burstConfetti(count) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const burst = Array.from({ length: count || 55 }, () => new ConfettiParticle(canvas));
  _confettiParticles = [..._confettiParticles, ...burst];
  if (!_confettiAF) _confettiFrame();
}

function stopConfetti() {
  if (_confettiAF) { cancelAnimationFrame(_confettiAF); _confettiAF = null; }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  _confettiParticles = [];
}
