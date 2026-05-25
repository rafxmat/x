// hint.js — İpucu sistemi + çıkmaz tespiti
// Bağımlılıklar (global): shelves, _solution, _hintCache, hintsUsed, HINTS_MAX, gameOver, gameMode,
//   completingIds, _bestMisplaced, _movesSinceBest, _stuckToastShown, moves, render()

/* ── İpucu butonu ── */
function updateHintButton() {
  const btn = document.getElementById('hint-btn');
  if (!btn) return;
  const remaining = HINTS_MAX - hintsUsed;
  btn.innerHTML = `💡 <span class="hint-count">${remaining}</span>`;
  btn.disabled = remaining === 0 || gameOver;
  btn.classList.toggle('depleted', remaining === 0);
}

/* Verilen durumda: hangi chip nereye gitmeli? */
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
  _hintCache = null;

  hintsUsed++;
  updateHintButton();

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
