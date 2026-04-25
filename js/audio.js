// audio.js — Ses sistemi

const MUTE_KEY = 'rafx_muted';
let _muted = localStorage.getItem(MUTE_KEY) === '1';
let _actx   = null;

function isMuted()    { return _muted; }
function toggleMute() {
  _muted = !_muted;
  localStorage.setItem(MUTE_KEY, _muted ? '1' : '0');
}

function actx() {
  return _actx || (_actx = new (window.AudioContext || window.webkitAudioContext)());
}

function tone(freq, type, dur, vol = 0.12) {
  if (_muted) return;
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur);
  } catch(e) {}
}

const sndPickup  = () => tone(480, 'sine', 0.07, 0.06);
const sndCorrect = () => {
  tone(523, 'sine', 0.1, 0.1);
  setTimeout(() => tone(659, 'sine', 0.13, 0.1), 75);
  setTimeout(() => tone(784, 'sine', 0.22, 0.12), 155);
};
const sndWrong   = () => tone(220, 'sawtooth', 0.08, 0.06);
const sndWin     = () => {
  [523, 659, 784, 1047].forEach((f, i) =>
    setTimeout(() => tone(f, 'sine', 0.28, 0.17), i * 85)
  );
};
