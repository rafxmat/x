// game.js — Oyun mantığı

/* ── Durum ── */
let shelves      = [];
let moves        = 0;
let timerSec     = 0;
let timerInt     = null;
let gameOver     = false;
let difficulty   = 'easy';
let gameMode     = 'normal';   // 'normal' | 'timed' | 'endless'
let isDailyMode  = false;
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
const HINTS_MAX  = 3;

const enteringIds   = new Set();
const completingIds = new Set();
const prevLocked    = new Set();
const pesShelfIds   = new Set();

/* ── Yıldız eşikleri ── */
const STARS = {
  easy:   { three: { sec: 75,  moves: 24 }, two: { sec: 150, moves: 42 } },
  medium: { three: { sec: 110, moves: 36 }, two: { sec: 220, moves: 60 } },
  hard:   { three: { sec: 180, moves: 60 }, two: { sec: 360, moves: 96 } },
};

const TIMED_LIMITS = { easy: 150, medium: 120, hard: 180 };

function calcStars(sec, mv, diff) {
  const t = STARS[diff];
  if (!t) return 1;
  if (sec <= t.three.sec && mv <= t.three.moves) return 3;
  if (sec <= t.two.sec   && mv <= t.two.moves)   return 2;
  return 1;
}

/* Final yıldız: ipucu cezası dahil tek doğruluk kaynağı */
function finalStars() {
  if (gameMode === 'endless') return 0;
  let stars = calcStars(timerSec, moves, difficulty);
  if (hintsUsed > 0) stars = Math.max(1, stars - hintsUsed);
  return stars;
}

/* ── Zamanlayıcı ── */
function startTimer() {
  clearInterval(timerInt);
  timerSec = 0;

  timerInt = setInterval(() => {
    if (gameOver) return;
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
    }
  }, 1000);
}

/* ── Yardımcı ── */
function product(nums) {
  return nums.length === 0 ? null : nums.reduce((a, b) => a * b, 1);
}

/* ── Animasyonlu sayaç pop efekti ── */
function popEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth; // reflow
  el.classList.add('pop');
}

/* ── Çarpım tablosu yardımcısı ── */
function getFactorPairs(n) {
  const pairs = [];
  for (let i = 2; i <= Math.floor(Math.sqrt(n)); i++) {
    if (n % i === 0) pairs.push([i, n / i]);
  }
  return pairs;
}

function showFactorTooltip(anchor, n) {
  document.querySelector('.factor-tooltip')?.remove();
  const pairs = getFactorPairs(n);
  const tooltip = document.createElement('div');
  tooltip.className = 'factor-tooltip';
  const rows = pairs.length
    ? pairs.map(([a, b]) => `<span>${a} × ${b} = ${n}</span>`).join('')
    : `<span>${n} — asal sayı</span>`;
  tooltip.innerHTML = `<div class="factor-tooltip-title">${n}'nin çarpanları</div>${rows}`;
  document.body.appendChild(tooltip);
  const rect = anchor.getBoundingClientRect();
  tooltip.style.top  = (rect.bottom + 6) + 'px';
  tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 190)) + 'px';
  const dismiss = e => {
    if (!tooltip.contains(e.target)) { tooltip.remove(); document.removeEventListener('pointerdown', dismiss); }
  };
  setTimeout(() => document.addEventListener('pointerdown', dismiss), 100);
  setTimeout(() => tooltip.remove(), 4500);
}

/* ── Raf parçacık patlaması ── */
function burstParticles(shelfEl) {
  const rect = shelfEl.getBoundingClientRect();
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;
  const COLORS = ['#4dfa7a','#fbbf24','#d4f03c','#60a5fa','#f87171','#a78bfa'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'shelf-particle';
    const angle = (i / 14) * Math.PI * 2;
    const dist  = 35 + Math.random() * 50;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${COLORS[i % COLORS.length]};--dx:${(Math.cos(angle)*dist).toFixed(1)}px;--dy:${(Math.sin(angle)*dist).toFixed(1)}px;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

/* ── Render ── */
function render(skipSound = false) {
  const area = document.getElementById('game-area');
  const page = document.querySelector('.game-page');
  const scrollTop = page ? page.scrollTop : 0;
  area.innerHTML = '';

  const correct = shelves.filter(s => {
    const p = product(s.nums);
    return p !== null && p === s.target;
  }).length;

  const prevCorrectNum = parseInt(document.getElementById('correct-num').textContent) || 0;

  if (gameMode === 'endless') {
    document.getElementById('correct-num').textContent  = endlessScore;
    document.getElementById('progress-bar').style.width = `${(endlessScore % 10) / 10 * 100}%`;
  } else {
    document.getElementById('correct-num').textContent  = correct;
    document.getElementById('progress-bar').style.width = `${(correct / shelves.length) * 100}%`;
  }
  document.getElementById('moves-val').textContent = moves;

  // Pop animasyonları
  if (moves > prevMoves) popEl('moves-val');
  if (gameMode === 'endless' ? endlessScore > prevCorrectNum : correct > prevCorrectNum) popEl('correct-num');
  prevMoves = moves;

  if (!skipSound && correct > prevCorrect) {
    const idx = gameMode === 'endless' ? endlessScore % 10 : correct - 1;
    sndCorrect(idx);
  }
  prevCorrect = correct;

  shelves.forEach((shelf, shelfIdx) => {
    const prod      = product(shelf.nums);
    const isCorrect = prod !== null && prod === shelf.target;
    const isWrong   = prod !== null && prod !== shelf.target;
    const justDone  = isCorrect && !prevLocked.has(shelf.id) && !completingIds.has(shelf.id);

    if (isCorrect) shelf.locked = true;

    const el  = document.createElement('div');
    let   cls = 'shelf';

    if (justDone) {
      completingIds.add(shelf.id);
      cls += ' completing';
      setTimeout(() => {
        completingIds.delete(shelf.id);
        if (gameMode === 'endless') {
          replaceShelf(shelf.id);
        } else {
          prevLocked.add(shelf.id);
          render(true);
          checkWin();
        }
      }, 420);
    } else if (completingIds.has(shelf.id)) {
      cls += ' completing';
    } else if (prevLocked.has(shelf.id)) {
      cls += ' correct locked';
    } else if (isWrong) {
      cls += ' wrong';
    }

    if (enteringIds.has(shelf.id)) cls += ' entering';

    el.className      = cls;
    el.dataset.shelfId = shelf.id;

    const isAnimating = justDone || completingIds.has(shelf.id);

    el.innerHTML = `
      <div class="shelf-top">
        <span class="shelf-num">Raf ${shelfIdx + 1}</span>
        <span class="shelf-target">${shelf.target}</span>
      </div>
      <div class="numbers-row" id="row-${shelf.id}">
        ${shelf.nums.length === 0 ? '<span class="empty-hint">· · ·</span>' : ''}
      </div>
    `;
    area.appendChild(el);

    // Çarpım tablosu yardımcısı
    const targetEl = el.querySelector('.shelf-target');
    if (targetEl) {
      let _pt = null;
      // Dokunmatik / kalem: uzun basış (600ms)
      targetEl.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        _pt = setTimeout(() => showFactorTooltip(targetEl, shelf.target), 600);
      });
      ['pointerup', 'pointerleave'].forEach(ev =>
        targetEl.addEventListener(ev, e => {
          if (e.pointerType !== 'mouse') clearTimeout(_pt);
        })
      );
      // Bilgisayar: sağ tık
      targetEl.addEventListener('contextmenu', e => {
        e.preventDefault();
        showFactorTooltip(targetEl, shelf.target);
      });
    }

    // Parçacık patlaması
    if (justDone) burstParticles(el);

    const row = el.querySelector(`#row-${shelf.id}`);
    shelf.nums.forEach((num, idx) => {
      const chip = document.createElement('div');
      chip.className      = 'num-chip' + (pesShelfIds.has(shelf.id) ? ' pes-chip' : '');
      chip.textContent    = num;
      chip.dataset.shelfId = shelf.id;
      chip.dataset.numIdx  = idx;
      if (!shelf.locked && !isAnimating) {
        if (getControlMode() === 'click') {
          chip.addEventListener('click', onChipClick);
          // Seçili chip'i vurgula
          if (getClickSelected()
              && getClickSelected().fromShelf === shelf.id
              && getClickSelected().numIdx    === idx) {
            chip.classList.add('selected');
          }
        } else {
          chip.addEventListener('mousedown',  onMouseDown);
          chip.addEventListener('touchstart', onTouchStart, { passive: false });
        }
      }
      row.appendChild(chip);
    });

    if (!shelf.locked && !isAnimating) {
      if (getControlMode() === 'click') {
        el.addEventListener('click', () => onShelfClickForMove(shelf.id));
      } else {
        el.addEventListener('mouseenter', () => { if (getDragState()) el.classList.add('drag-over'); });
        el.addEventListener('mouseleave', () => el.classList.remove('drag-over'));
      }
    }
  });

  if (page) page.scrollTop = scrollTop;
}

/* ── Pes: sayıları otomatik yerleştir ── */
function onPes() {
  if (gameOver) return;
  gameOver = true;
  clearInterval(timerInt);

  const btn = document.getElementById('pes-btn');
  if (btn) btn.disabled = true;
  updateHintButton();

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

  // 1. Render'dan ÖNCE ekrandaki tüm chip konumlarını kaydet (değere göre)
  const chipPool = {};
  document.querySelectorAll('.num-chip').forEach(chip => {
    const val = chip.textContent.trim();
    if (!chipPool[val]) chipPool[val] = [];
    chipPool[val].push(chip.getBoundingClientRect());
  });

  // 2. Rafları çözüme getir ve render et
  render(true);

  // 3. Her pes-chip'i eski konumundan yeni konumuna kaydır (FLIP)
  const pesChips = [...document.querySelectorAll('.num-chip.pes-chip')];
  pesChips.forEach((chip, i) => {
    const val      = chip.textContent.trim();
    const fromRect = chipPool[val]?.shift();
    const toRect   = chip.getBoundingClientRect();

    if (!fromRect) {
      // Kaynak konumu yoksa yukarıdan belirir
      chip.style.opacity   = '0';
      chip.style.transform = 'translateY(-20px) scale(0.5)';
      setTimeout(() => {
        chip.style.transition = 'transform 0.36s cubic-bezier(0.34,1.56,0.64,1), opacity 0.22s';
        chip.style.opacity    = '1';
        chip.style.transform  = '';
      }, i * 85);
      return;
    }

    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top  - toRect.top;

    // Chip'i anlık olarak eski konumuna taşı
    chip.style.transition = 'none';
    chip.style.transform  = `translate(${dx}px, ${dy}px)`;
    chip.style.zIndex     = '50';
    chip.getBoundingClientRect(); // reflow — bir sonraki frame için gerekli

    // Stagger ile hedef konuma süzül
    setTimeout(() => {
      chip.style.transition = `transform 0.44s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      chip.style.transform  = '';
      setTimeout(() => { chip.style.transition = chip.style.zIndex = ''; }, 500);
    }, i * 85);
  });

  const totalDelay = pesChips.length > 0 ? pesChips.length * 85 + 600 : 800;
  setTimeout(showWin, totalDelay);
}

/* ── Kazanma kontrolü ── */
function checkWin() {
  if (gameOver || gameMode === 'endless') return;
  if (shelves.every(s => prevLocked.has(s.id)) && shelves.length > 0) {
    gameOver = true;
    clearInterval(timerInt);
    setTimeout(showWin, 380);
  }
}

/* ── Sonsuz: raf değiştir ── */
function replaceShelf(completedId) {
  endlessScore++;
  recordEndlessScore(endlessScore);

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

/* ── İpucu sistemi ── */
function updateHintButton() {
  const btn = document.getElementById('hint-btn');
  if (!btn) return;
  const remaining = HINTS_MAX - hintsUsed;
  btn.innerHTML = `💡 ipucu <span class="hint-count">${remaining}</span>`;
  btn.disabled = remaining === 0 || gameOver;
  btn.classList.toggle('depleted', remaining === 0);
}

function computeHintData() {
  // 1) Eksik sayısı olan açık bir raf bul
  const candidate = shelves.find(shelf => {
    if (shelf.locked || completingIds.has(shelf.id)) return false;
    const target = _solution[shelf.id];
    if (!target) return false;
    const cur = {}; shelf.nums.forEach(n => cur[n] = (cur[n] || 0) + 1);
    const tgt = {}; target.forEach(n => tgt[n] = (tgt[n] || 0) + 1);
    return Object.keys(tgt).some(v => (cur[v] || 0) < tgt[v]);
  });
  if (!candidate) return null;

  // 2) Bu raf için eksik bir değer seç
  const target = _solution[candidate.id];
  const cur = {}; candidate.nums.forEach(n => cur[n] = (cur[n] || 0) + 1);
  const tgt = {}; target.forEach(n => tgt[n] = (tgt[n] || 0) + 1);
  let missingVal = null;
  for (const v of Object.keys(tgt)) {
    if ((cur[v] || 0) < tgt[v]) { missingVal = parseInt(v); break; }
  }
  if (missingVal === null) return null;

  // 3) Bu değeri başka bir kilitsiz rafta bul (öncelik: orada fazlalık olan)
  let srcId = null, srcIdx = null;
  for (const s of shelves) {
    if (s.id === candidate.id || s.locked || completingIds.has(s.id)) continue;
    const tCounts = {}; (_solution[s.id] || []).forEach(n => tCounts[n] = (tCounts[n] || 0) + 1);
    const cCounts = {}; s.nums.forEach(n => cCounts[n] = (cCounts[n] || 0) + 1);
    if ((cCounts[missingVal] || 0) > (tCounts[missingVal] || 0)) {
      const idx = s.nums.indexOf(missingVal);
      if (idx !== -1) { srcId = s.id; srcIdx = idx; break; }
    }
  }
  // Yedek: fazlalık yoksa ilk buluşa git
  if (srcId === null) {
    for (const s of shelves) {
      if (s.id === candidate.id || s.locked || completingIds.has(s.id)) continue;
      const idx = s.nums.indexOf(missingVal);
      if (idx !== -1) { srcId = s.id; srcIdx = idx; break; }
    }
  }
  if (srcId === null) return null;

  return { candidateId: candidate.id, srcId, srcIdx };
}

function useHint() {
  if (gameOver || hintsUsed >= HINTS_MAX) return;

  if (!_hintCache) _hintCache = computeHintData();
  if (!_hintCache) return;

  const { candidateId, srcId, srcIdx } = _hintCache;
  _hintCache = null; // bir sonraki hint için yeniden hesaplanacak

  hintsUsed++;
  updateHintButton();

  // 4) Vurgula: kaynak chip + hedef raf
  const srcShelfEl = document.querySelector(`.shelf[data-shelf-id="${srcId}"]`);
  const tgtShelfEl = document.querySelector(`.shelf[data-shelf-id="${candidateId}"]`);
  const srcChip    = srcShelfEl?.querySelectorAll('.num-chip')[srcIdx];

  if (srcChip)    srcChip.classList.add('hint-glow');
  if (tgtShelfEl) tgtShelfEl.classList.add('hint-glow-shelf');

  setTimeout(() => {
    srcChip?.classList.remove('hint-glow');
    tgtShelfEl?.classList.remove('hint-glow-shelf');
  }, 2100);
}

/* ── Kazanma ekranı ── */
function showWin() {
  const isPes    = pesShelfIds.size > 0;
  const stars    = isPes ? 0 : finalStars();
  const timeStr  = formatTime(timerSec);
  const isRecord = isPes ? false : saveRecord(difficulty, timerSec, moves);
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];

  // İstatistik kaydet — pes oyunları kazanılmış sayılmaz
  const newAchs = recordGame({
    difficulty, mode: gameMode,
    seconds: timerSec, moves,
    won: !isPes, stars,
    isDaily: isDailyMode,
    hintsUsed,
  });
  if (isDailyMode && !isPes) saveDailyResult(difficulty, stars, timerSec, moves);
  newAchs.forEach(a => scheduleAchToast(a));

  if (!isPes) { sndWinMelody(); startConfetti(); }

  document.getElementById('win-time').textContent  = timeStr;
  document.getElementById('win-moves').textContent = moves;
  document.getElementById('win-diff').textContent  = diffName;
  document.getElementById('win-stars').innerHTML   =
    '★'.repeat(stars) + `<span style="opacity:.18">★</span>`.repeat(3 - stars);

  const rec = document.getElementById('win-record');
  rec.style.display = isRecord ? 'block' : 'none';

  const dailyBadge = document.getElementById('win-daily-badge');
  if (dailyBadge) dailyBadge.style.display = isDailyMode ? 'block' : 'none';

  const winTitle = document.querySelector('.win-title');
  if (winTitle) winTitle.textContent = pesShelfIds.size > 0 ? 'Tamamlandı (pes)' : 'Tamamlandı';

  document.getElementById('win-screen').classList.add('show');
  updateHintButton();

  const streak = getStats().streak;
  if (!isPes && streak >= 3) setTimeout(() => showStreakOverlay(streak), 900);
}

/* ── Seri kutlama overlay ── */
function showStreakOverlay(streak) {
  const overlay = document.createElement('div');
  overlay.className = 'streak-overlay';
  overlay.innerHTML = `
    <div class="streak-overlay-bg"></div>
    <div class="streak-card">
      <div class="streak-fire">🔥</div>
      <div class="streak-count">${streak}</div>
      <div class="streak-label">Günlük Seri</div>
      <div class="streak-sub">${streak} gün üst üste oynadın!</div>
    </div>
  `;

  const dismiss = () => {
    overlay.classList.add('hiding');
    setTimeout(() => overlay.remove(), 350);
  };

  overlay.querySelector('.streak-overlay-bg').addEventListener('click', dismiss);
  overlay.querySelector('.streak-card').addEventListener('click', dismiss);
  document.body.appendChild(overlay);
  setTimeout(dismiss, 3800);
}

/* ── Süre doldu ekranı ── */
function showFail() {
  updateHintButton();
  const correct  = shelves.filter(s => prevLocked.has(s.id)).length;
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];

  const newAchs = recordGame({
    difficulty, mode: gameMode,
    seconds: timerSec, moves,
    won: false, stars: 0,
    isDaily: false,
  });
  newAchs.forEach(a => scheduleAchToast(a));

  document.getElementById('fail-correct').textContent = correct;
  document.getElementById('fail-moves').textContent   = moves;
  document.getElementById('fail-diff').textContent    = diffName;
  document.getElementById('fail-screen').classList.add('show');
}

/* ── Çıkmaz tespiti ── */
function countMisplaced() {
  let count = 0;
  shelves.forEach(s => {
    if (s.locked || completingIds.has(s.id)) return;
    const sol = _solution[s.id];
    if (!sol) return;
    const has = {}, need = {};
    s.nums.forEach(n => has[n] = (has[n] || 0) + 1);
    sol.forEach(n => need[n] = (need[n] || 0) + 1);
    for (const [n, cnt] of Object.entries(has)) {
      count += Math.max(0, cnt - (need[n] || 0));
    }
  });
  return count;
}

function checkDeadlock() {
  if (gameOver || gameMode === 'endless') return;
  const misplaced = countMisplaced();
  if (misplaced === 0) { _bestMisplaced = 0; _movesSinceBest = 0; return; }
  if (misplaced < _bestMisplaced) {
    _bestMisplaced = misplaced;
    _movesSinceBest = 0;
  } else {
    _movesSinceBest++;
  }
  if (_movesSinceBest >= 15 && !_stuckToastShown) {
    _stuckToastShown = true;
    showStuckDialog();
  }
}

function showStuckDialog() {
  if (document.querySelector('.stuck-toast')) return;
  const t = document.createElement('div');
  t.className = 'stuck-toast';
  t.innerHTML = `
    <div class="stuck-msg">Çıkmaz gibi görünüyor?</div>
    <div class="stuck-sub">Sayıları yeniden karıştırayım mı?</div>
    <div class="stuck-actions">
      <button onclick="reshuffleNums()" class="btn btn-primary btn-sm">Karıştır</button>
      <button onclick="dismissStuck()" class="btn btn-ghost btn-sm">İptal</button>
    </div>
  `;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
}

function dismissStuck() {
  document.querySelector('.stuck-toast')?.remove();
  _stuckToastShown = false;
  _movesSinceBest = 0;
}

function reshuffleNums() {
  document.querySelector('.stuck-toast')?.remove();
  _bestMisplaced = Infinity; _movesSinceBest = 0; _stuckToastShown = false;

  const unlocked = shelves.filter(s => !s.locked && !completingIds.has(s.id));
  const pool = [];
  unlocked.forEach(s => pool.push(...s.nums));

  const assign = () => {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    let pi = 0;
    unlocked.forEach(s => {
      s.nums = pool.slice(pi, pi + s.size);
      pi += s.size;
    });
  };

  for (let attempt = 0; attempt < 20; attempt++) {
    assign();
    if (!unlocked.some(s => s.nums.length > 0 && s.nums.reduce((a, b) => a * b, 1) === s.target)) break;
  }

  moves++;
  _hintCache = null;
  render();
}

/* ── Drop ── */
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

  const val = sourceShelf.nums.splice(numIdx, 1)[0];
  targetShelf.nums.push(val);
  moves++;
  _hintCache = null;
  clearDragState();

  const p = product(targetShelf.nums);
  if (p !== null && p !== targetShelf.target) sndWrong();

  render();
  checkDeadlock();
}

/* ── Başarım toastları ── */
let _toastQueue = [];
let _toastActive = false;

function scheduleAchToast(ach) {
  _toastQueue.push(ach);
  if (!_toastActive) showNextToast();
}

function showNextToast() {
  if (!_toastQueue.length) { _toastActive = false; return; }
  _toastActive = true;
  const ach = _toastQueue.shift();

  const t = document.createElement('div');
  t.className = 'ach-toast';
  t.innerHTML = `
    <div class="ach-toast-icon">${ach.icon}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-title">Başarım Kazanıldı!</div>
      <div class="ach-toast-name">${ach.name}</div>
    </div>
  `;
  document.body.appendChild(t);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('show'));
  });

  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => { t.remove(); showNextToast(); }, 400);
  }, 3200);
}

/* ── Yeni oyun ── */
function initGame() {
  setDropHandler(dropOnShelf);
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('fail-screen').classList.remove('show');
  stopConfetti();

  moves = 0; gameOver = false; prevCorrect = 0; prevMoves = 0;
  endlessScore = 0; nextShelfId = 12; hintsUsed = 0; _hintCache = null;
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

  // Rozetler
  const diffNames = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
  const modeBadge = document.getElementById('mode-badge');
  const modeNames = { normal: '', timed: 'Süre Sınırı', endless: 'Sonsuz' };

  document.getElementById('diff-badge').textContent  = diffNames[difficulty];
  document.getElementById('diff-badge').dataset.diff = difficulty;

  let modeLabel = modeNames[gameMode];
  if (isDailyMode) modeLabel = (modeLabel ? modeLabel + ' · ' : '') + '📅 Günlük';
  modeBadge.textContent   = modeLabel;
  modeBadge.style.display = modeLabel ? '' : 'none';

  const _gen = isDailyMode ? generateDailyGame(difficulty) : generateGame(difficulty);
  shelves   = _gen.shelves;
  _solution = _gen.solution;

  // Sonsuz mod oyun başlangıcı sayacı
  if (gameMode === 'endless') recordEndlessStart();

  // İlerleme etiketi — raf sayısı dinamik
  document.querySelector('.progress-text').innerHTML = gameMode === 'endless'
    ? '<strong id="correct-num">0</strong> raf tamamlandı'
    : `<strong id="correct-num">0</strong> / ${shelves.length} raf tamamlandı`;
  updateHintButton();
  startTimer();
  render(true);
  showTutorial();
}

function showTutorial() {
  if (localStorage.getItem('rafx_tut')) return;
  const el = document.getElementById('tut-overlay');
  if (el) el.classList.add('show');
}

function dismissTutorial() {
  localStorage.setItem('rafx_tut', '1');
  const el = document.getElementById('tut-overlay');
  if (el) { el.classList.add('hide'); setTimeout(() => el.classList.remove('show','hide'), 350); }
}

/* ── Konfeti ── */
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

function startConfetti() {
  const canvas  = document.getElementById('confetti-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  _confettiParticles = Array.from({ length: 140 }, () => new ConfettiParticle(canvas));

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    _confettiParticles = _confettiParticles.filter(p => p.y < canvas.height + 20);
    _confettiParticles.forEach(p => { p.update(); p.draw(ctx); });
    if (_confettiParticles.length > 0) _confettiAF = requestAnimationFrame(frame);
  }
  if (_confettiAF) cancelAnimationFrame(_confettiAF);
  frame();
}

function stopConfetti() {
  if (_confettiAF) { cancelAnimationFrame(_confettiAF); _confettiAF = null; }
  const canvas = document.getElementById('confetti-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  _confettiParticles = [];
}

/* ── Başlatma ── */
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const d = params.get('d');
  const m = params.get('m');
  if (d && ['easy', 'medium', 'hard'].includes(d)) difficulty = d;
  if (m && ['normal', 'timed', 'endless'].includes(m)) gameMode = m;
  isDailyMode = params.get('daily') === '1';
  initGame();

  // Müzik: ilk etkileşimde başlat (AudioContext policy)
  if (isMusicOn()) {
    document.addEventListener('pointerdown', startAmbientMusic, { once: true });
  }
});
