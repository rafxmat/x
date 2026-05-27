// stopwatch.js — Bağımsız kronometre (sınıf yarışmaları için)
// Oyunun puanlama timer'ından tamamen ayrı. Yıldız/puan etkilemez.
// Sürüklenebilir pencere, position localStorage'a kaydedilir.

const SW_POS_KEY = 'rafx_sw_pos';

let _swStartTime = 0;   // running başladığı andaki Date.now()
let _swElapsedMs = 0;   // Toplam birikmiş süre (ms)
let _swRunning   = false;
let _swInterval  = null;

/* ── Format: MM:SS.t veya H:MM:SS.t ── */
function _swFormat(totalMs) {
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const t = Math.floor((totalMs % 1000) / 100);
  const pad = n => n.toString().padStart(2, '0');
  return h > 0
    ? `${h}:${pad(m)}:${pad(s)}.${t}`
    : `${pad(m)}:${pad(s)}.${t}`;
}

function _swGetTotal() {
  return _swElapsedMs + (_swRunning ? Date.now() - _swStartTime : 0);
}

function _swUpdateDisplay() {
  const el = document.getElementById('sw-display');
  if (el) el.textContent = _swFormat(_swGetTotal());
}

function _swUpdateButton() {
  const btn = document.getElementById('sw-start-btn');
  if (!btn) return;
  if (_swRunning) {
    btn.textContent = '⏸ Durdur';
    btn.classList.add('running');
  } else {
    btn.textContent = '▷ Başlat';
    btn.classList.remove('running');
  }
}

function startStopwatch() {
  if (_swRunning) return;
  _swStartTime = Date.now();
  _swRunning   = true;
  _swInterval  = setInterval(_swUpdateDisplay, 100);
  _swUpdateButton();
}

function stopStopwatch() {
  if (!_swRunning) return;
  _swElapsedMs += Date.now() - _swStartTime;
  _swRunning = false;
  clearInterval(_swInterval);
  _swInterval = null;
  _swUpdateDisplay();
  _swUpdateButton();
}

function toggleStopwatch() {
  _swRunning ? stopStopwatch() : startStopwatch();
}

function resetStopwatch() {
  const wasRunning = _swRunning;
  if (wasRunning) clearInterval(_swInterval);
  _swElapsedMs = 0;
  _swStartTime = Date.now();
  if (!wasRunning) _swRunning = false;
  _swUpdateDisplay();
  _swUpdateButton();
}

/* ── Aç / Kapat ── */
function openStopwatch() {
  const w = document.getElementById('stopwatch-widget');
  if (!w) return;

  // Kaydedilmiş konumu uygula (yoksa varsayılan üst-sağ köşe)
  const pos = _swGetPos();
  if (pos && _swPosInBounds(pos.x, pos.y)) {
    w.style.left  = pos.x + 'px';
    w.style.top   = pos.y + 'px';
    w.style.right = 'auto';
  } else {
    w.style.left  = '';
    w.style.top   = '';
    w.style.right = '';
  }

  w.classList.add('show');
  _swUpdateDisplay();
  _swUpdateButton();
}

function closeStopwatch() {
  const w = document.getElementById('stopwatch-widget');
  if (w) w.classList.remove('show');
  // Timer arkada çalışmaya devam eder; yeniden açıldığında doğru süreyi gösterir.
}

/* ── Konum kaydı ── */
function _swGetPos() {
  try { return JSON.parse(localStorage.getItem(SW_POS_KEY)); }
  catch { return null; }
}
function _swSavePos(x, y) {
  localStorage.setItem(SW_POS_KEY, JSON.stringify({ x, y }));
}
function _swPosInBounds(x, y) {
  return x >= 0 && y >= 0 &&
         x < window.innerWidth - 50 &&
         y < window.innerHeight - 50;
}

/* ── Sürükleme ── */
function _swInitDrag() {
  const w = document.getElementById('stopwatch-widget');
  if (!w) return;
  const header = w.querySelector('.sw-header');
  if (!header) return;

  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  function onStart(e) {
    // Kapatma butonunda sürüklemeyi başlatma
    if (e.target.closest('.sw-close')) return;
    e.preventDefault();
    const pt = e.touches ? e.touches[0] : e;
    dragging = true;
    startX = pt.clientX;
    startY = pt.clientY;
    const rect = w.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    w.style.right      = 'auto';
    w.style.transition = 'none';
    document.body.style.userSelect = 'none';
  }

  function onMove(e) {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    if (e.touches) e.preventDefault();
    const dx = pt.clientX - startX;
    const dy = pt.clientY - startY;
    let nx = origX + dx;
    let ny = origY + dy;
    // Viewport içinde tut
    const maxX = window.innerWidth  - w.offsetWidth;
    const maxY = window.innerHeight - w.offsetHeight;
    nx = Math.max(4, Math.min(maxX - 4, nx));
    ny = Math.max(4, Math.min(maxY - 4, ny));
    w.style.left = nx + 'px';
    w.style.top  = ny + 'px';
  }

  function onEnd() {
    if (!dragging) return;
    dragging = false;
    w.style.transition = '';
    document.body.style.userSelect = '';
    _swSavePos(parseInt(w.style.left), parseInt(w.style.top));
  }

  header.addEventListener('mousedown',  onStart);
  header.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, { passive: false });
  window.addEventListener('mouseup',    onEnd);
  window.addEventListener('touchend',   onEnd);
  window.addEventListener('touchcancel',onEnd);
}

window.addEventListener('DOMContentLoaded', _swInitDrag);
