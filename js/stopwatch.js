// stopwatch.js — Bağımsız kronometre (sınıf yarışmaları için)
// Oyunun puanlama timer'ından tamamen ayrı. Yıldız/puan etkilemez.
// Sürüklenebilir pencere, position localStorage'a kaydedilir.

const SW_POS_KEY  = 'rafx_sw_pos';
const SW_HIST_KEY = 'rafx_sw_history';
const SW_HIST_MAX = 50;

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
  _swSaveToHistory(_swGetTotal());
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

  // Kaydedilmiş konum ve boyutu uygula (yoksa varsayılan üst-sağ köşe)
  const st = _swGetPos();
  if (st && Number.isFinite(st.x) && Number.isFinite(st.y) && _swPosInBounds(st.x, st.y)) {
    w.style.left  = st.x + 'px';
    w.style.top   = st.y + 'px';
    w.style.right = 'auto';
  } else {
    w.style.left  = '';
    w.style.top   = '';
    w.style.right = '';
  }
  if (st && Number.isFinite(st.w) && Number.isFinite(st.h)) {
    w.style.width  = st.w + 'px';
    w.style.height = st.h + 'px';
  } else {
    w.style.width  = '';
    w.style.height = '';
  }

  w.classList.add('show');
  _swUpdateDisplay();
  _swUpdateButton();
}

function closeStopwatch() {
  const w = document.getElementById('stopwatch-widget');
  if (w) w.classList.remove('show');
  // Kapatınca sıfırlan: sayım durur, süre 0'a döner. Önce geçmişe kaydet.
  _swSaveToHistory(_swGetTotal());
  if (_swInterval) { clearInterval(_swInterval); _swInterval = null; }
  _swRunning   = false;
  _swElapsedMs = 0;
  _swStartTime = 0;
  _swUpdateDisplay();
  _swUpdateButton();
}

/* ── Konum + boyut kaydı ── */
function _swGetPos() {
  try { return JSON.parse(localStorage.getItem(SW_POS_KEY)); }
  catch { return null; }
}
function _swSaveState(patch) {
  const prev = _swGetPos() || {};
  localStorage.setItem(SW_POS_KEY, JSON.stringify({ ...prev, ...patch }));
}
function _swSavePos(x, y) { _swSaveState({ x, y }); }
function _swSaveSize(w, h) { _swSaveState({ w, h }); }
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
    // Kapatma veya Geçmiş butonunda sürüklemeyi başlatma
    if (e.target.closest('.sw-close, .sw-history-btn')) return;
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

/* ── Resize (sol alt köşeden) ── */
function _swInitResize() {
  const w = document.getElementById('stopwatch-widget');
  if (!w) return;
  const handle = w.querySelector('.sw-resize-handle');
  if (!handle) return;

  // CSS min/max ile uyumlu sınırlar
  const MIN_W = 160, MAX_W = 500;
  const MIN_H = 140, MAX_H = 400;

  let resizing = false;
  let startX = 0, startY = 0;
  let startW = 0, startH = 0, startLeft = 0;

  function onStart(e) {
    e.preventDefault();
    e.stopPropagation(); // drag handler'a gitmesin
    const pt = e.touches ? e.touches[0] : e;
    const rect = w.getBoundingClientRect();
    resizing = true;
    startX = pt.clientX;
    startY = pt.clientY;
    startW = rect.width;
    startH = rect.height;
    startLeft = rect.left;
    // Sağ köşeyi sabitle: right'ı kaldır, left'i pixele çevir
    w.style.right = 'auto';
    w.style.left  = startLeft + 'px';
    w.style.transition = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'sw-resize';
  }

  function onMove(e) {
    if (!resizing) return;
    const pt = e.touches ? e.touches[0] : e;
    if (e.touches) e.preventDefault();
    const dx = pt.clientX - startX;
    const dy = pt.clientY - startY;
    // Sol-alt köşe: sağ üst sabit. dx pozitif (sağa) → genişlik küçülür, left artar.
    //                                 dy pozitif (aşağı) → yükseklik artar.
    let newW = startW - dx;
    let newH = startH + dy;
    newW = Math.max(MIN_W, Math.min(MAX_W, newW));
    newH = Math.max(MIN_H, Math.min(MAX_H, newH));
    // Sağ kenar sabit: left = startLeft + (startW - newW)
    const newLeft = startLeft + (startW - newW);
    w.style.width  = newW + 'px';
    w.style.height = newH + 'px';
    w.style.left   = newLeft + 'px';
  }

  function onEnd() {
    if (!resizing) return;
    resizing = false;
    w.style.transition = '';
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    const rect = w.getBoundingClientRect();
    _swSavePos(Math.round(rect.left), Math.round(rect.top));
    _swSaveSize(Math.round(rect.width), Math.round(rect.height));
  }

  handle.addEventListener('mousedown',  onStart);
  handle.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove',  onMove);
  window.addEventListener('touchmove',  onMove, { passive: false });
  window.addEventListener('mouseup',    onEnd);
  window.addEventListener('touchend',   onEnd);
  window.addEventListener('touchcancel',onEnd);
}

window.addEventListener('DOMContentLoaded', () => { _swInitDrag(); _swInitResize(); });

/* ── Geçmiş süreler ── */
function _swGetHistory() {
  try { return JSON.parse(localStorage.getItem(SW_HIST_KEY)) || []; }
  catch { return []; }
}
function _swSetHistory(arr) {
  localStorage.setItem(SW_HIST_KEY, JSON.stringify(arr));
}
function _swSaveToHistory(ms) {
  if (!ms || ms < 100) return; // 100ms'den kısaysa kayıt etme (kazara reset)
  const hist = _swGetHistory();
  hist.unshift({ ms: Math.round(ms), ts: Date.now() });
  if (hist.length > SW_HIST_MAX) hist.length = SW_HIST_MAX;
  _swSetHistory(hist);
  _swRenderHistory();
}

function _swFormatWhen(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function _swRenderHistory() {
  const listEl = document.getElementById('sw-hist-list');
  if (!listEl) return;
  const hist = _swGetHistory();
  if (!hist.length) {
    listEl.innerHTML = '<div class="sw-hist-empty">Henüz kayıtlı süre yok</div>';
    return;
  }
  listEl.innerHTML = hist.map((rec, i) => `
    <div class="sw-hist-item">
      <span class="sw-hist-time">${_swFormat(rec.ms)}</span>
      <span class="sw-hist-when">${_swFormatWhen(rec.ts)}</span>
      <button class="sw-hist-del" onclick="_swDeleteHistoryItem(${i})" aria-label="Sil" title="Sil">×</button>
    </div>
  `).join('');
}

function _swDeleteHistoryItem(i) {
  const hist = _swGetHistory();
  hist.splice(i, 1);
  _swSetHistory(hist);
  _swRenderHistory();
}

function clearSwHistory() {
  if (!_swGetHistory().length) return;
  if (!confirm('Tüm kayıtlı süreler silinsin mi?')) return;
  _swSetHistory([]);
  _swRenderHistory();
}

function openSwHistory() {
  const w = document.getElementById('sw-history-window');
  if (!w) return;
  _swRenderHistory();
  w.classList.add('show');
}

function closeSwHistory() {
  const w = document.getElementById('sw-history-window');
  if (w) w.classList.remove('show');
}
