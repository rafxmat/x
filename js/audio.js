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

/* ── Ambient müzik ── */
const MUSIC_KEY  = 'rafx_music';
let _musicGain   = null;
let _musicNodes  = [];
let _musicNoteTimer = null;

function getMusicVolume() {
  const v = parseInt(localStorage.getItem(MUSIC_KEY));
  return isNaN(v) ? 70 : Math.max(0, Math.min(100, v));
}
function setMusicVolume(v) { localStorage.setItem(MUSIC_KEY, String(Math.max(0, Math.min(100, v)))); }
function isMusicOn()       { return getMusicVolume() > 0; }
function setMusicOn(val)   { setMusicVolume(val ? 70 : 0); }

function startAmbientMusic() {
  if (_musicGain) return;
  const ctx = actx();
  ctx.resume();

  _musicGain = ctx.createGain();
  const _vol = getMusicVolume() / 100;
  _musicGain.gain.setValueAtTime(0, ctx.currentTime);
  _musicGain.gain.linearRampToValueAtTime(0.08 * _vol, ctx.currentTime + 4);
  _musicGain.connect(ctx.destination);

  // ── Nefes alan bas drone (A2 = 110 Hz) ──
  const bass     = ctx.createOscillator();
  const bassGain = ctx.createGain();
  const bassLfo  = ctx.createOscillator();
  const bassLfoG = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.value  = 110;
  bassGain.gain.value   = 0.45;
  bassLfo.frequency.value = 0.07;   // çok yavaş nefes
  bassLfoG.gain.value   = 0.12;
  bassLfo.connect(bassLfoG);
  bassLfoG.connect(bassGain.gain);
  bass.connect(bassGain);
  bassGain.connect(_musicGain);
  bass.start(); bassLfo.start();
  _musicNodes.push(bass, bassLfo);

  // ── İki melodic pad — A minör pentatonik ──
  // A, C, D, E, G, A(oktav), C(oktav)
  const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];

  const pad1 = ctx.createOscillator(), pad1G = ctx.createGain();
  const pad2 = ctx.createOscillator(), pad2G = ctx.createGain();
  [pad1, pad2].forEach(p => { p.type = 'sine'; p.start(); _musicNodes.push(p); });
  pad1.frequency.value = scale[0]; pad1G.gain.value = 0;
  pad2.frequency.value = scale[2]; pad2G.gain.value = 0;
  pad1.connect(pad1G); pad1G.connect(_musicGain);
  pad2.connect(pad2G); pad2G.connect(_musicGain);

  let ni = 0;
  function evolve() {
    if (!_musicGain) return;
    const t    = ctx.currentTime;
    const dur  = 6 + Math.random() * 4;
    const f1   = scale[ni % scale.length];
    const f2   = scale[(ni + 2) % scale.length];
    ni++;

    pad1.frequency.linearRampToValueAtTime(f1, t + 1.2);
    pad1G.gain.cancelScheduledValues(t);
    pad1G.gain.setValueAtTime(pad1G.gain.value, t);
    pad1G.gain.linearRampToValueAtTime(0.22, t + 2);
    pad1G.gain.linearRampToValueAtTime(0.14, t + dur - 1.5);
    pad1G.gain.linearRampToValueAtTime(0,    t + dur);

    pad2.frequency.linearRampToValueAtTime(f2, t + 1.8);
    pad2G.gain.cancelScheduledValues(t);
    pad2G.gain.setValueAtTime(pad2G.gain.value, t);
    pad2G.gain.linearRampToValueAtTime(0.18, t + 2.5);
    pad2G.gain.linearRampToValueAtTime(0.10, t + dur - 1.5);
    pad2G.gain.linearRampToValueAtTime(0,    t + dur);

    _musicNoteTimer = setTimeout(evolve, (dur - 1) * 1000);
  }
  setTimeout(evolve, 800);
}

function stopAmbientMusic() {
  if (!_musicGain) return;
  clearTimeout(_musicNoteTimer);
  _musicNoteTimer = null;
  const ctx = actx();
  _musicGain.gain.cancelScheduledValues(ctx.currentTime);
  _musicGain.gain.setValueAtTime(_musicGain.gain.value, ctx.currentTime);
  _musicGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
  setTimeout(() => {
    _musicNodes.forEach(n => { try { n.stop(); } catch(e) {} });
    _musicNodes = [];
    try { _musicGain.disconnect(); } catch(e) {}
    _musicGain = null;
  }, 1600);
}

function toggleAmbientMusic() {
  const on = !isMusicOn();
  setMusicOn(on);
  if (on) startAmbientMusic(); else stopAmbientMusic();
  return on;
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
