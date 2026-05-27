// audio.js — Ses sistemi

const SFX_KEY = 'rafx_sfx';
let _actx     = null;

function getSfxVolume() {
  const v = parseInt(localStorage.getItem(SFX_KEY));
  return isNaN(v) ? 80 : Math.max(0, Math.min(100, v));
}
function setSfxVolume(v) {
  localStorage.setItem(SFX_KEY, String(Math.max(0, Math.min(100, v))));
}
function isMuted() { return getSfxVolume() === 0; }

function actx() {
  return _actx || (_actx = new (window.AudioContext || window.webkitAudioContext)());
}

function tone(freq, type, dur, vol = 0.12) {
  const sfxVol = getSfxVolume();
  if (sfxVol === 0) return;
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    g.gain.setValueAtTime(vol * sfxVol / 100, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur);
  } catch(e) { console.warn('RAF× ses hatası:', e); }
}

/* ── Müzik parçası seçimi ── */
const MUSIC_TRACK_KEY = 'rafx_music_track';
const MUSIC_TRACKS    = ['ambient', 'lofi', 'arpeji', 'minimal'];

function getMusicTrack() {
  const t = localStorage.getItem(MUSIC_TRACK_KEY);
  return MUSIC_TRACKS.includes(t) ? t : 'ambient';
}
function setMusicTrack(track) {
  localStorage.setItem(MUSIC_TRACK_KEY, track);
  // Müzik çalıyorsa yeni parçayı geç başlat
  if (_musicGain) {
    stopAmbientMusic();
    setTimeout(startAmbientMusic, 1700);
  }
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
function setMusicVolume(v) {
  const vol = Math.max(0, Math.min(100, v));
  localStorage.setItem(MUSIC_KEY, String(vol));
  if (_musicGain) {
    const ctx = actx();
    _musicGain.gain.cancelScheduledValues(ctx.currentTime);
    _musicGain.gain.setValueAtTime(0.08 * vol / 100, ctx.currentTime);
  }
}
function isMusicOn()       { return getMusicVolume() > 0; }
function setMusicOn(val)   { setMusicVolume(val ? 70 : 0); }

/* ── Parça 1: Ambient — A minör pentatonik drone + evolving pads ── */
function _startAmbient(ctx) {
  const bass     = ctx.createOscillator();
  const bassGain = ctx.createGain();
  const bassLfo  = ctx.createOscillator();
  const bassLfoG = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.value    = 110;
  bassGain.gain.value     = 0.45;
  bassLfo.frequency.value = 0.07;
  bassLfoG.gain.value     = 0.12;
  bassLfo.connect(bassLfoG);
  bassLfoG.connect(bassGain.gain);
  bass.connect(bassGain);
  bassGain.connect(_musicGain);
  bass.start(); bassLfo.start();
  _musicNodes.push(bass, bassLfo);

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
    const t   = ctx.currentTime;
    const dur = 6 + Math.random() * 4;
    const f1  = scale[ni % scale.length];
    const f2  = scale[(ni + 2) % scale.length];
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

/* ── Parça 2: Lo-fi — C majör pentatonik, üçgen dalgalar, sıcak ── */
function _startLofi(ctx) {
  const bass = ctx.createOscillator(), bassG = ctx.createGain();
  bass.type = 'triangle';
  bass.frequency.value = 130.8; // C3
  bassG.gain.value = 0.30;
  bass.connect(bassG); bassG.connect(_musicGain);
  bass.start();
  _musicNodes.push(bass);

  const scale = [261.6, 293.7, 329.6, 392, 440, 523.3]; // C majör pentatonik
  const pad1 = ctx.createOscillator(), pad1G = ctx.createGain();
  const pad2 = ctx.createOscillator(), pad2G = ctx.createGain();
  const pad3 = ctx.createOscillator(), pad3G = ctx.createGain(); // hafif detune
  [pad1, pad2, pad3].forEach(p => { p.type = 'triangle'; p.start(); _musicNodes.push(p); });
  pad1.frequency.value = scale[0]; pad1G.gain.value = 0;
  pad2.frequency.value = scale[2]; pad2G.gain.value = 0;
  pad3.frequency.value = scale[0] + 2.5; pad3G.gain.value = 0; // chorus etkisi
  pad1.connect(pad1G); pad1G.connect(_musicGain);
  pad2.connect(pad2G); pad2G.connect(_musicGain);
  pad3.connect(pad3G); pad3G.connect(_musicGain);

  let ni = 0;
  function evolve() {
    if (!_musicGain) return;
    const t   = ctx.currentTime;
    const dur = 10 + Math.random() * 6;
    const f1  = scale[ni % scale.length];
    const f2  = scale[(ni + 3) % scale.length];
    ni++;
    pad1.frequency.linearRampToValueAtTime(f1, t + 2.5);
    pad3.frequency.linearRampToValueAtTime(f1 + 2.5, t + 2.5);
    [pad1G, pad3G].forEach(g => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.16, t + 3);
      g.gain.linearRampToValueAtTime(0.10, t + dur - 2);
      g.gain.linearRampToValueAtTime(0, t + dur);
    });
    pad2.frequency.linearRampToValueAtTime(f2, t + 3);
    pad2G.gain.cancelScheduledValues(t);
    pad2G.gain.setValueAtTime(pad2G.gain.value, t);
    pad2G.gain.linearRampToValueAtTime(0.13, t + 3.5);
    pad2G.gain.linearRampToValueAtTime(0.08, t + dur - 2);
    pad2G.gain.linearRampToValueAtTime(0, t + dur);
    _musicNoteTimer = setTimeout(evolve, (dur - 2) * 1000);
  }
  setTimeout(evolve, 1200);
}

/* ── Parça 3: Arpeji — E minör pentatonik yukarı-aşağı arpeji ── */
function _startArpeji(ctx) {
  const bass = ctx.createOscillator(), bassG = ctx.createGain();
  bass.type = 'triangle';
  bass.frequency.value = 82.4; // E2
  bassG.gain.value = 0.22;
  bass.connect(bassG); bassG.connect(_musicGain);
  bass.start();
  _musicNodes.push(bass);

  const scale = [164.8, 196, 220, 293.7, 329.6, 392, 440, 587.3];
  let idx = 0, dir = 1;

  function playNote() {
    if (!_musicGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = scale[idx];
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(g); g.connect(_musicGain);
    osc.start(t); osc.stop(t + 0.6);
    idx += dir;
    if (idx >= scale.length - 1) dir = -1;
    if (idx <= 0)                 dir =  1;
    _musicNoteTimer = setTimeout(playNote, 370 + Math.random() * 60);
  }
  setTimeout(playNote, 600);
}

/* ── Parça 4: Minimal — seyrek kristal notalar ── */
function _startMinimal(ctx) {
  const bass = ctx.createOscillator(), bassG = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.value = 65.4; // C2
  bassG.gain.value = 0.10;
  bass.connect(bassG); bassG.connect(_musicGain);
  bass.start();
  _musicNodes.push(bass);

  const tones = [523.3, 587.3, 659.3, 783.9, 880, 1046.5];

  function playNote() {
    if (!_musicGain) return;
    const t    = ctx.currentTime;
    const freq = tones[Math.floor(Math.random() * tones.length)];
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    osc.connect(g); g.connect(_musicGain);
    osc.start(t); osc.stop(t + 2.5);
    _musicNoteTimer = setTimeout(playNote, 3200 + Math.random() * 3800);
  }
  setTimeout(playNote, 1800);
}

function startAmbientMusic() {
  if (_musicGain) return;
  const ctx = actx();
  ctx.resume();

  _musicGain = ctx.createGain();
  const _vol = getMusicVolume() / 100;
  _musicGain.gain.setValueAtTime(0, ctx.currentTime);
  _musicGain.gain.linearRampToValueAtTime(0.08 * _vol, ctx.currentTime + 4);
  _musicGain.connect(ctx.destination);

  const track = getMusicTrack();
  if      (track === 'lofi')    _startLofi(ctx);
  else if (track === 'arpeji')  _startArpeji(ctx);
  else if (track === 'minimal') _startMinimal(ctx);
  else                          _startAmbient(ctx);
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

// Do Re Mi Fa Sol La Si Do Re Mi (C4–E5)
const SCALE_FREQS = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3, 587.3, 659.3];

const sndPickup  = () => tone(480, 'sine', 0.07, 0.06);
const sndCorrect = (shelfIndex = 0) => {
  const freq = SCALE_FREQS[Math.min(shelfIndex, SCALE_FREQS.length - 1)];
  tone(freq, 'sine', 0.18, 0.12);
};
const sndWrong   = () => tone(220, 'sawtooth', 0.08, 0.06);
const sndWinMelody = () => {
  SCALE_FREQS.forEach((f, i) =>
    setTimeout(() => tone(f, 'sine', 0.22, 0.13), i * 90)
  );
};

/* Raf dolu — başka hiçbir yerde kullanılmaz */
const sndShelfFull = () => {
  tone(310, 'square',   0.055, 0.11);
  setTimeout(() => tone(200, 'triangle', 0.10,  0.09), 35);
};
