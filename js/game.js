// game.js — Çekirdek oyun mantığı + giriş noktası
//
// Bu dosya state + game lifecycle merkezi.
// UI render → render.js · Modal/Overlay → screens.js · İpucu → hint.js · Konfeti → confetti.js

/* ════════════════════════════════════════
   GLOBAL DURUM
════════════════════════════════════════ */
let shelves      = [];
let moves        = 0;
let timerSec     = 0;
let timerInt     = null;
let gameOver     = false;
let difficulty   = 'easy';
let gameMode     = 'normal';   // 'normal' | 'timed' | 'endless'
let isDailyMode  = false;
let currentLevel = 0;          // 0 = normal mod, >0 = macera modu seviye no
let prevCorrect  = 0;
let prevMoves    = 0;
let endlessScore = 0;
let _bestMisplaced   = Infinity;
let _movesSinceBest  = 0;
let _stuckToastShown = false;
let nextShelfId  = 12;
let hintsUsed    = 0;
let _solution    = [];
let _hintCache   = null; // { candidateId, srcId, srcIdx } — her hamlede sıfırlanır
let _pesSnapshot = null; // pes anındaki oyuncu durumu — replay için
const HINTS_MAX  = 3;
let isPaused     = false;

const enteringIds   = new Set();
const completingIds = new Set();
const prevLocked    = new Set();
const pesShelfIds   = new Set();

/* ════════════════════════════════════════
   SABİTLER: yıldız eşikleri + mod limitleri
════════════════════════════════════════ */
const STARS = {
  easy:   { three: { sec: 75,  moves: 24 }, two: { sec: 150, moves: 42 } },
  medium: { three: { sec: 110, moves: 36 }, two: { sec: 220, moves: 60 } },
  hard:   { three: { sec: 180, moves: 60 }, two: { sec: 360, moves: 96 } },
};
const TIMED_LIMITS = { easy: 150, medium: 120, hard: 180 };
const MOVE_LIMITS  = { easy: 60,  medium: 80,  hard: 100 };

/* ════════════════════════════════════════
   YILDIZ HESAPLAMA
════════════════════════════════════════ */
function calcStars(sec, mv, diff) {
  const t = STARS[diff];
  if (!t) return 1;
  if (sec <= t.three.sec && mv <= t.three.moves) return 3;
  if (sec <= t.two.sec   && mv <= t.two.moves)   return 2;
  return 1;
}

/* Normal mod: sadece hamle bazlı (süre yok) */
function calcNormalStars(mv, diff) {
  const t = STARS[diff];
  if (!t) return 1;
  if (mv <= t.three.moves) return 3;
  if (mv <= t.two.moves)   return 2;
  return 1;
}

/* Final yıldız: ipucu cezası dahil */
function finalStars() {
  if (gameMode === 'endless') return 0;
  let stars = gameMode === 'normal'
    ? calcNormalStars(moves, difficulty)
    : calcStars(timerSec, moves, difficulty);
  if (hintsUsed > 0) stars = Math.max(1, stars - hintsUsed);
  return stars;
}

/* ════════════════════════════════════════
   ZAMANLAYICI
════════════════════════════════════════ */
function startTimer() {
  clearInterval(timerInt);
  timerSec = 0;

  timerInt = setInterval(() => {
    if (gameOver || isPaused) return;
    timerSec++;
    const tv = document.getElementById('timer-val');

    if (gameMode === 'timed') {
      const rem = TIMED_LIMITS[difficulty] - timerSec;
      if (rem <= 0) {
        clearInterval(timerInt);
        gameOver = true;
        tv.textContent = '0:00';
        tv.style.color = 'var(--red)';
        setTimeout(showFail, 300);
        return;
      }
      const m = Math.floor(rem / 60), s = rem % 60;
      tv.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      if      (rem <= 15) tv.style.color = 'var(--red)';
      else if (rem <= 30) tv.style.color = 'var(--gold)';
      else                tv.style.color = '';
    } else {
      const m = Math.floor(timerSec / 60), s = timerSec % 60;
      tv.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      if      (timerSec > 180) tv.style.color = 'var(--red)';
      else if (timerSec > 90)  tv.style.color = 'var(--gold)';
      else                     tv.style.color = '';
      updateLiveStars();
    }
  }, 1000);
}

/* ════════════════════════════════════════
   YARDIMCILAR
════════════════════════════════════════ */
function product(nums) {
  return nums.length === 0 ? null : nums.reduce((a, b) => a * b, 1);
}

function vibrate(ms) {
  if (typeof getHaptic === 'function' && !getHaptic()) return;
  if ('vibrate' in navigator) navigator.vibrate(ms);
}

/* ════════════════════════════════════════
   PES (teslim ol → çözümü göster)
════════════════════════════════════════ */
function onPes() {
  if (gameOver) return;
  document.getElementById('pes-confirm').classList.add('show');
}

function closePesConfirm() {
  document.getElementById('pes-confirm').classList.remove('show');
}

function closePesConfirmAndExecute() {
  closePesConfirm();
  executePes();
}

function executePes() {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerInt);

  const btn = document.getElementById('pes-btn');
  if (btn) btn.disabled = true;
  updateHintButton();

  // Oyuncunun son durumunu replay için sakla
  _pesSnapshot = shelves.map(s => ({
    id: s.id, target: s.target, size: s.size,
    nums: [...s.nums],
    locked: prevLocked.has(s.id) || completingIds.has(s.id),
  }));

  shelves.forEach(shelf => {
    if (prevLocked.has(shelf.id) || completingIds.has(shelf.id)) return;
    const sol = _solution[shelf.id];
    if (!sol) return;

    // Mevcut sayılar çözümden farklıysa → pes-chip olarak işaretle
    const cur  = [...shelf.nums].sort((a, b) => a - b);
    const need = [...sol].sort((a, b) => a - b);
    const alreadyCorrect = cur.length === need.length && cur.every((v, i) => v === need[i]);

    if (!alreadyCorrect) {
      shelf.nums = [...sol];
      pesShelfIds.add(shelf.id);
    }

    shelf.locked = true;
    prevLocked.add(shelf.id);
  });

  // 1. Rafları çözüme getir ve render et
  render(true);

  // 2. Pes-chipleri başlangıçta gizle, sırayla bir bir belirt
  const pesChips = [...document.querySelectorAll('.num-chip.pes-chip')];

  pesChips.forEach(chip => {
    chip.style.transition = 'none';
    chip.style.opacity    = '0';
    chip.style.transform  = 'scale(0.5) translateY(-14px)';
  });

  // Tek reflow — başlangıç durumu DOM'a işlensin
  if (pesChips.length > 0) pesChips[0].getBoundingClientRect();

  pesChips.forEach((chip, i) => {
    setTimeout(() => {
      chip.style.transition = 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s ease';
      chip.style.opacity    = '1';
      chip.style.transform  = '';
      setTimeout(() => { chip.style.transition = chip.style.transform = ''; }, 450);
    }, i * 80);
  });

  const totalDelay = pesChips.length > 0 ? pesChips.length * 80 + 500 : 600;
  setTimeout(showPesScreen, totalDelay);
}

/* ════════════════════════════════════════
   KAZANMA KONTROLÜ
════════════════════════════════════════ */
function checkWin() {
  if (gameOver || gameMode === 'endless') return;
  if (shelves.every(s => prevLocked.has(s.id)) && shelves.length > 0) {
    gameOver = true;
    clearInterval(timerInt);
    setTimeout(showWin, 380);
  }
}

/* ════════════════════════════════════════
   SONSUZ MOD: raf değiştir
════════════════════════════════════════ */
function replaceShelf(completedId) {
  endlessScore++;
  recordEndlessScore(endlessScore);
  checkEndlessMilestone(endlessScore);

  const idx = shelves.findIndex(s => s.id === completedId);
  if (idx === -1) return;

  const { target, size, nums } = generateSingleShelfNums(difficulty);

  const newShelf = { id: nextShelfId++, target, size, nums: [], locked: false };
  shelves[idx] = newShelf;
  _solution[newShelf.id] = [...nums]; // ipucu için çözümü kaydet

  const unlocked = shelves.filter(s => !s.locked && !completingIds.has(s.id));
  if (unlocked.length === 0) {
    newShelf.nums = [...nums];
  } else {
    nums.forEach(n => {
      const pick = unlocked[Math.floor(Math.random() * unlocked.length)];
      pick.nums.push(n);
    });
  }

  enteringIds.add(newShelf.id);
  render(true);
  setTimeout(() => enteringIds.delete(newShelf.id), 460);
}

/* ════════════════════════════════════════
   SAYI BIRAKMA (drag.js → setDropHandler ile bağlanır)
════════════════════════════════════════ */
function dropOnShelf(toId) {
  dismissTutorial();
  const ds = getDragState();
  if (!ds) return;
  const { fromShelf, numIdx } = ds;

  const targetShelf = shelves.find(s => s.id === toId);
  const sourceShelf = shelves.find(s => s.id === fromShelf);

  if (!targetShelf || targetShelf.locked || completingIds.has(toId)) {
    clearDragState(); render(true); return;
  }
  if (!sourceShelf || fromShelf === toId) { clearDragState(); render(true); return; }
  if (targetShelf.nums.length >= 4) { clearDragState(); render(true); showShelfFullToast(); sndShelfFull(); return; }

  const val = sourceShelf.nums.splice(numIdx, 1)[0];
  targetShelf.nums.push(val);
  moves++;
  _hintCache = null;
  clearDragState();

  // Normal mod hamle limiti kontrolü
  if (gameMode === 'normal') {
    const limit = MOVE_LIMITS[difficulty] || 60;
    if (moves >= limit && !gameOver) {
      gameOver = true;
      clearInterval(timerInt);
      render(true);
      setTimeout(showFail, 300);
      return;
    }
  }

  const p = product(targetShelf.nums);
  if (p !== null && p !== targetShelf.target) sndWrong();

  render();
  checkDeadlock();
}

/* ════════════════════════════════════════
   RAF DOLU TOAST
════════════════════════════════════════ */
let _shelfFullTimer = null;
function showShelfFullToast() {
  let t = document.querySelector('.shelf-full-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'shelf-full-toast';
    t.textContent = 'Raf Dolu';
    document.body.appendChild(t);
  }
  clearTimeout(_shelfFullTimer);
  // reflow → animasyon sıfırlansın
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  _shelfFullTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 340);
  }, 2000);
}

/* ════════════════════════════════════════
   YENİ OYUN BAŞLAT
════════════════════════════════════════ */
function initGame() {
  setDropHandler(dropOnShelf);
  isPaused = false;
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('fail-screen').classList.remove('show');
  document.getElementById('pes-screen').classList.remove('show');
  document.getElementById('pes-confirm').classList.remove('show');
  document.getElementById('pause-menu').classList.remove('show');
  document.getElementById('daily-done-screen').classList.remove('show');
  stopConfetti();

  moves = 0; gameOver = false; prevCorrect = 0; prevMoves = 0;
  endlessScore = 0; nextShelfId = 12; hintsUsed = 0; _hintCache = null; _pesSnapshot = null;
  _bestMisplaced = Infinity; _movesSinceBest = 0; _stuckToastShown = false;
  document.querySelector('.stuck-toast')?.remove();
  enteringIds.clear();
  completingIds.clear();
  prevLocked.clear();
  pesShelfIds.clear();
  clearClickSelected();
  const pesBtn = document.getElementById('pes-btn');
  if (pesBtn) {
    pesBtn.disabled = false;
    pesBtn.style.display = gameMode === 'endless' ? 'none' : '';
  }

  const tv = document.getElementById('timer-val');
  tv.textContent = gameMode === 'timed' ? formatTime(TIMED_LIMITS[difficulty]) : '0:00';
  tv.style.color = '';

  // Normal modda süre yerine canlı yıldız göster
  const timerItem = document.getElementById('timer-item');
  const starsItem = document.getElementById('live-stars-item');
  const isNormal = gameMode === 'normal';
  if (timerItem) timerItem.style.display = isNormal ? 'none' : '';

  // Kalan hamle alanı
  if (starsItem) {
    starsItem.style.display = isNormal ? '' : 'none';
    const lbl = starsItem.querySelector('.stat-label');
    if (lbl) lbl.textContent = 'kalan hamle';
    const sv = document.getElementById('live-stars-val');
    if (sv) { sv.textContent = MOVE_LIMITS[difficulty] || 60; sv.style.color = ''; }
  }

  // Canlı yıldız alanı (hamle sayacının yerine)
  const movesItem       = document.getElementById('moves-item');
  const normalStarsItem = document.getElementById('normal-stars-item');
  if (movesItem)       movesItem.style.display       = isNormal ? 'none' : '';
  if (normalStarsItem) {
    normalStarsItem.style.display = isNormal ? '' : 'none';
    const sv = document.getElementById('normal-stars-val');
    if (sv) { sv.innerHTML = ''; sv.dataset.stars = '3'; }
  }

  // Rozetler
  const diffNames = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
  const modeBadge = document.getElementById('mode-badge');
  const modeNames = { normal: '', timed: 'Süre Sınırı', endless: 'Sonsuz' };

  document.getElementById('diff-badge').textContent  = diffNames[difficulty];
  document.getElementById('diff-badge').dataset.diff = difficulty;

  let modeLabel = modeNames[gameMode];
  if (isDailyMode)     modeLabel = (modeLabel ? modeLabel + ' · ' : '') + '📅 Günlük';
  if (currentLevel > 0) {
    const bossTag = (typeof isBossLevel === 'function' && isBossLevel(currentLevel)) ? ' 👑' : '';
    modeLabel = `Seviye ${currentLevel}${bossTag}`;
  }
  modeBadge.textContent   = modeLabel;
  modeBadge.style.display = modeLabel ? '' : 'none';

  const _gen = isDailyMode ? generateDailyGame(difficulty) : generateGame(difficulty);
  shelves   = _gen.shelves;
  _solution = _gen.solution;

  if (gameMode === 'endless') recordEndlessStart();

  // İlerleme etiketi — raf sayısı dinamik
  document.querySelector('.progress-text').innerHTML = gameMode === 'endless'
    ? '<strong id="correct-num">0</strong> raf tamamlandı'
    : `<strong id="correct-num">0</strong> / ${shelves.length} raf tamamlandı`;
  updateHintButton();
  startTimer();
  render(true);
}

/* ════════════════════════════════════════
   ARKA PLAN: KAYAN ASAL SAYILAR
════════════════════════════════════════ */
function initMathBg() {
  const bg = document.getElementById('math-bg');
  if (!bg) return;
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37];
  const COUNT  = 14;
  let html = '';
  for (let i = 0; i < COUNT; i++) {
    const num   = PRIMES[Math.floor(Math.random() * PRIMES.length)];
    const left  = (Math.random() * 92 + 4).toFixed(1);       // 4–96%
    const size  = (Math.random() * 4 + 3).toFixed(2);        // 3–7 rem
    const dur   = (Math.random() * 120 + 140).toFixed(0);    // 140–260s (≈5px/sn ort.)
    const delay = -Math.floor(Math.random() * dur);          // -dur..0
    const tilt  = (Math.random() * 10 - 5).toFixed(1);       // -5..5 deg
    html += `<span class="math-num" style="left:${left}%;font-size:${size}rem;animation-duration:${dur}s;animation-delay:${delay}s;--tilt:${tilt}deg">${num}</span>`;
  }
  bg.innerHTML = html;
}

/* ════════════════════════════════════════
   BAŞLATMA (entry point)
════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const d = params.get('d');
  const m = params.get('m');
  const lvl = parseInt(params.get('level'));

  // Macera modu: ?level=N
  if (lvl && lvl >= 1 && lvl <= 100 && typeof getLevelDifficulty === 'function') {
    currentLevel = lvl;
    difficulty   = getLevelDifficulty(lvl);
    gameMode     = 'normal';
    isDailyMode  = false;
  } else {
    if (d && ['easy', 'medium', 'hard'].includes(d)) difficulty = d;
    if (m && ['normal', 'timed', 'endless'].includes(m)) gameMode = m;
    isDailyMode = params.get('daily') === '1';
  }

  initMathBg();

  if (isDailyMode) {
    const result = getDailyResult(difficulty);
    if (result) { showDailyDoneScreen(result); return; }
  }

  if (!isDailyMode && !localStorage.getItem('rafx_onboarded') && !localStorage.getItem('rafx_tut')) {
    showOnboarding();
    return;
  }

  initGame();

  // Müzik: ilk etkileşimde başlat (AudioContext policy)
  if (isMusicOn()) {
    document.addEventListener('pointerdown', startAmbientMusic, { once: true });
  }
});
