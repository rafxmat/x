// screens.js — Tüm modal/overlay/toast ekranları
// Bağımlılıklar (global): durum değişkenleri (difficulty, gameMode, isDailyMode, timerSec,
//   moves, hintsUsed, shelves, prevLocked, pesShelfIds, isPaused), finalStars(),
//   saveRecord/getRecord [storage.js], recordGame/getStats/saveDailyResult [stats.js],
//   sndWinMelody [audio.js], startConfetti [confetti.js], formatTime [storage.js],
//   updateHintButton [hint.js], initGame [game.js],
//   getSfxVolume/getMusicVolume/getControlMode/getHaptic/getMusicTrack/setSfxVolume/setMusicVolume/
//   setControlMode/setMusicTrack [audio.js + storage.js], applyTheme [theme.js],
//   startAmbientMusic/stopAmbientMusic [audio.js]

/* ── Tutorial overlay ── */
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

/* ── Kazanma ekranı ── */
function showWin() {
  const stars    = finalStars();
  const timeStr  = formatTime(timerSec);
  const isRecord = saveRecord(difficulty, timerSec, moves);
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];

  // ÖNEMLİ: Macera başarımları getCompletedCount/getTotalStars'a bakar.
  // recordGame içindeki achievement check öncesinde sonucu kaydet.
  if (isDailyMode) saveDailyResult(difficulty, stars, timerSec, moves);
  if (currentLevel > 0 && typeof saveLevelResult === 'function') {
    saveLevelResult(currentLevel, stars, timerSec, moves);
  }

  const newAchs = recordGame({
    difficulty, mode: gameMode,
    seconds: timerSec, moves,
    won: true, stars,
    isDaily: isDailyMode,
    hintsUsed,
  });
  newAchs.forEach(a => scheduleAchToast(a));

  sndWinMelody();
  startConfetti();

  document.getElementById('win-time').textContent  = timeStr;
  document.getElementById('win-moves').textContent = moves;
  const diffEl = document.getElementById('win-diff');
  diffEl.textContent   = currentLevel > 0 ? `Seviye ${currentLevel}` : diffName;
  diffEl.dataset.diff  = difficulty;
  document.getElementById('win-stars').innerHTML = [0,1,2].map(i =>
    `<span class="win-star${i < stars ? ' win-star-earned' : ' win-star-empty'}" style="animation-delay:${i * 0.13}s">★</span>`
  ).join('');

  // Macera modu: "Sonraki Seviye" butonu + "Haritaya Dön"
  updateWinActionsForLevel();

  document.getElementById('win-screen').classList.add('show');
  updateHintButton();

  const streak = getStats().streak;
  if (streak >= 3) setTimeout(() => showStreakOverlay(streak), 900);
}

/* ── Macera modu için kazanma butonlarını uyarla ── */
function updateWinActionsForLevel() {
  const actions = document.querySelector('#win-screen .win-actions');
  if (!actions) return;

  // Macera modu değilse → varsayılan halini geri yükle
  if (currentLevel === 0) {
    actions.innerHTML = `
      <button class="btn btn-primary" onclick="initGame()">Tekrar</button>
      <div class="win-actions-sub">
        <button class="btn btn-ghost win-share-btn" id="win-share-btn" onclick="shareResult()">↗ Paylaş</button>
        <a class="btn btn-ghost" href="index.html">Menü</a>
      </div>
    `;
    return;
  }

  // Macera modu → "Sonraki Seviye" + "Haritaya Dön"
  const nextLvl = currentLevel + 1;
  const hasNext = nextLvl <= 100;
  actions.innerHTML = `
    ${hasNext ? `<a class="btn btn-primary" href="game.html?level=${nextLvl}">Sonraki Seviye →</a>` : '<div class="btn btn-primary" style="opacity:.5;pointer-events:none">Son Seviye!</div>'}
    <div class="win-actions-sub">
      <button class="btn btn-ghost" onclick="initGame()">↻ Tekrar</button>
      <a class="btn btn-ghost" href="map.html">🗺 Harita</a>
    </div>
  `;
}

/* ── Pes ekranı ── */
function showPesScreen() {
  const correct  = shelves.filter(s => prevLocked.has(s.id) && !pesShelfIds.has(s.id)).length;
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];

  const newAchs = recordGame({
    difficulty, mode: gameMode,
    seconds: timerSec, moves,
    won: false, stars: 0,
    isDaily: false,
    hintsUsed,
  });
  newAchs.forEach(a => scheduleAchToast(a));

  document.getElementById('pes-correct').textContent = correct;
  document.getElementById('pes-time').textContent    = formatTime(timerSec);
  document.getElementById('pes-moves').textContent   = moves;
  document.getElementById('pes-screen').classList.add('show');
  updateHintButton();
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

/* ── Süre doldu / Hamle bitti ekranı ── */
function showFail() {
  updateHintButton();
  const correct  = shelves.filter(s => prevLocked.has(s.id)).length;
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];

  // Normal modda "Hamle Hakkın Bitti", diğerlerinde "Süre Doldu"
  const isMoveFail = gameMode === 'normal';
  const iconEl  = document.querySelector('#fail-screen .fail-icon');
  const titleEl = document.querySelector('#fail-screen .fail-title');
  if (iconEl)  iconEl.textContent  = isMoveFail ? '🎯' : '⏱';
  if (titleEl) titleEl.textContent = isMoveFail ? 'Hamle Hakkın Bitti!' : 'Süre Doldu!';

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

/* ── Günlük bulmaca bitti ekranı ── */
function showDailyDoneScreen(result) {
  const diffName = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' }[difficulty];
  const stars = result.stars;
  const dateStr = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  document.getElementById('daily-done-sub').textContent = diffName + ' · ' + dateStr;
  document.getElementById('daily-done-stars').innerHTML = [0,1,2].map(i =>
    `<span class="win-star${i < stars ? ' win-star-earned' : ' win-star-empty'}">★</span>`
  ).join('');
  document.getElementById('daily-done-stats').innerHTML = `
    <div class="daily-done-stat">
      <span class="daily-done-stat-val">${formatTime(result.time)}</span>
      <span class="daily-done-stat-label">Süre</span>
    </div>
    <div class="daily-done-stat">
      <span class="daily-done-stat-val">${result.moves}</span>
      <span class="daily-done-stat-label">Hamle</span>
    </div>
  `;
  document.getElementById('daily-done-screen').classList.add('show');
}

function startDailyAnyway() {
  document.getElementById('daily-done-screen').classList.remove('show');
  initGame();
}

/* ── Duraklama menüsü ── */
function openPauseMenu() {
  if (gameOver) return;
  isPaused = true;

  const diffNames = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
  const modeNames = { normal: 'Normal', timed: 'Süre Sınırı', endless: 'Sonsuz' };
  const info = document.getElementById('pause-card-info');
  if (info) {
    let txt = diffNames[difficulty] || '';
    const modeLabel = isDailyMode ? 'Günlük' : modeNames[gameMode];
    if (modeLabel) txt += ' · ' + modeLabel;
    info.textContent = txt;
  }

  document.getElementById('pause-menu').classList.add('show');
}

function closePauseMenu() {
  isPaused = false;
  document.getElementById('pause-menu').classList.remove('show');
}

function pauseMenuNewGame() {
  closePauseMenu();
  initGame();
}

/* ── Oyun İçi Ayarlar ── */
function openInGameSettings() {
  const sfx   = getSfxVolume();
  const music = getMusicVolume();
  const isDark = document.documentElement.dataset.theme === 'dark';
  const isDrag = getControlMode() !== 'click';

  const sfxEl = document.getElementById('igs-sfx');
  if (sfxEl) { sfxEl.value = sfx; igsSetFill(sfxEl); }
  document.getElementById('igs-sfx-val').textContent = sfx;

  const musicEl = document.getElementById('igs-music');
  if (musicEl) { musicEl.value = music; igsSetFill(musicEl); }
  document.getElementById('igs-music-val').textContent = music;

  document.getElementById('igs-haptic').checked = getHaptic();
  document.getElementById('igs-theme-toggle').checked = isDark;

  const swEl = document.getElementById('igs-stopwatch');
  const swWidget = document.getElementById('stopwatch-widget');
  if (swEl) swEl.checked = !!(swWidget && swWidget.classList.contains('show'));

  document.getElementById('igs-pill-drag').classList.toggle('active', isDrag);
  document.getElementById('igs-pill-click').classList.toggle('active', !isDrag);

  const currentTrack = getMusicTrack();
  ['ambient', 'lofi', 'arpeji', 'minimal'].forEach(t => {
    const btn = document.getElementById('igs-pill-track-' + t);
    if (btn) btn.classList.toggle('active', t === currentTrack);
  });

  document.getElementById('ingame-settings').classList.add('show');
}

function igsSetTrack(track) {
  setMusicTrack(track);
  ['ambient', 'lofi', 'arpeji', 'minimal'].forEach(t => {
    const btn = document.getElementById('igs-pill-track-' + t);
    if (btn) btn.classList.toggle('active', t === track);
  });
}

function closeInGameSettings() {
  document.getElementById('ingame-settings').classList.remove('show');
}

function igsSetFill(slider) {
  const pct = ((slider.value - slider.min) / (slider.max - slider.min) * 100).toFixed(1) + '%';
  slider.style.setProperty('--fill', pct);
}

function igsOnSfx(v) {
  setSfxVolume(parseInt(v));
  document.getElementById('igs-sfx-val').textContent = v;
  igsSetFill(document.getElementById('igs-sfx'));
}

function igsOnMusic(v) {
  const vol = parseInt(v);
  const wasOff = getMusicVolume() === 0;
  setMusicVolume(vol);
  document.getElementById('igs-music-val').textContent = vol;
  igsSetFill(document.getElementById('igs-music'));
  if (vol > 0 && wasOff) startAmbientMusic();
  else if (vol === 0) stopAmbientMusic();
}

function igsSetTheme(dark) {
  localStorage.setItem('rafx_theme', dark ? 'dark' : 'light');
  if (!dark) {
    const slider = document.querySelector('#igs-theme-toggle + .slider');
    if (slider) {
      slider.classList.add('toggling-light');
      setTimeout(() => slider.classList.remove('toggling-light'), 700);
    }
  }
  applyTheme(dark, true);
}

function igsSetControl(mode) {
  setControlMode(mode);
  const isDrag = mode !== 'click';
  document.getElementById('igs-pill-drag').classList.toggle('active', isDrag);
  document.getElementById('igs-pill-click').classList.toggle('active', !isDrag);
}

function igsToggleStopwatch(on) {
  if (on) openStopwatch();
  else    closeStopwatch();
}

/* ── Başarım toast kuyruğu ── */
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

/* ════════════════════════════════════════
   SONSUZ MOD MİLESTONE KUTLAMASI
════════════════════════════════════════ */

const ENDLESS_MILESTONES = {
  10:  { icon: '🔟', label: '10 Raf!',  sub: 'Isınma bitti!',        color: '#4dfa7a' },
  25:  { icon: '⚡', label: '25 Raf!',  sub: 'Durdurulamıyorsun!',  color: '#f5a623' },
  50:  { icon: '💥', label: '50 Raf!',  sub: 'Efsane!',              color: '#d4f03c' },
  100: { icon: '🌌', label: '100 Raf!', sub: 'Sonsuz aşıldı!',      color: '#a78bfa' },
};

function checkEndlessMilestone(score) {
  const m = ENDLESS_MILESTONES[score];
  if (m) setTimeout(() => showMilestoneToast(m), 480);
}

function showMilestoneToast(m) {
  document.querySelector('.milestone-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'milestone-toast';
  toast.style.setProperty('--mc', m.color);
  toast.innerHTML = `
    <div class="milestone-toast-icon">${m.icon}</div>
    <div class="milestone-toast-body">
      <div class="milestone-toast-title">${m.label}</div>
      <div class="milestone-toast-sub">${m.sub}</div>
    </div>
  `;
  document.body.appendChild(toast);
  burstConfetti(55);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 340);
  }, 2600);
}

/* ════════════════════════════════════════
   ADIM ADIM ÇÖZÜM REPLAY
════════════════════════════════════════ */

let _replaySwaps = [];
let _replayStep  = 0;
let _replayTimer = null;

/* Oyuncunun snapshot'ından çözüme giden minimum hamle dizisi */
function computeReplaySwaps(snapshot) {
  const working = snapshot
    .filter(s => !s.locked)
    .map(s => ({ id: s.id, nums: [...s.nums] }));

  const swaps = [];

  for (let iter = 0; iter < 300; iter++) {
    let moved = false;

    for (const shelf of working) {
      const sol = _solution[shelf.id];
      if (!sol) continue;

      const have = {}, need = {};
      shelf.nums.forEach(n => have[n] = (have[n] || 0) + 1);
      sol.forEach(n => need[n] = (need[n] || 0) + 1);

      let foundNum = null;
      for (const n of shelf.nums) {
        if ((have[n] || 0) > (need[n] || 0)) { foundNum = n; break; }
      }
      if (foundNum === null) continue;

      for (const other of working) {
        if (other.id === shelf.id) continue;
        const otherSol = _solution[other.id];
        if (!otherSol) continue;

        const otherHave = {}, otherNeed = {};
        other.nums.forEach(n => otherHave[n] = (otherHave[n] || 0) + 1);
        otherSol.forEach(n => otherNeed[n] = (otherNeed[n] || 0) + 1);

        if ((otherNeed[foundNum] || 0) > (otherHave[foundNum] || 0)) {
          const idx = shelf.nums.indexOf(foundNum);
          shelf.nums.splice(idx, 1);
          other.nums.push(foundNum);
          swaps.push({ fromId: shelf.id, toId: other.id, num: foundNum });
          moved = true;
          break;
        }
      }
      if (moved) break;
    }

    if (!moved) break;
  }

  return swaps;
}

/* Board'u snapshot'a döndür ve animasyonu başlat */
function startStepReplay() {
  if (!_pesSnapshot) return;

  document.getElementById('pes-screen').classList.remove('show');

  // Replay butonunu "Tekrar İzle" olarak sıfırla
  const replayBtn = document.getElementById('replay-btn');
  if (replayBtn) replayBtn.textContent = '▷ Çözümü Adım Adım Gör';

  // Board'u oyuncunun son durumuna döndür
  prevLocked.clear();
  pesShelfIds.clear();
  completingIds.clear();

  _pesSnapshot.forEach(snap => {
    const s = shelves.find(x => x.id === snap.id);
    if (!s) return;
    s.nums   = [...snap.nums];
    s.locked = snap.locked;
    if (snap.locked) prevLocked.add(snap.id);
  });

  render(true);

  _replaySwaps = computeReplaySwaps(_pesSnapshot);
  _replayStep  = 0;

  const bar = document.getElementById('replay-bar');
  if (bar) bar.style.display = 'flex';
  _updateReplayBar();

  _replayTimer = setTimeout(_doReplayStep, 800);
}

/* Bir hamleyi işaretle ve uygula */
function _doReplayStep() {
  if (_replayStep >= _replaySwaps.length) {
    _finishReplay();
    return;
  }

  const swap = _replaySwaps[_replayStep];
  _replayStep++;
  _updateReplayBar();

  // Kaynak chip ve hedef rafı vurgula
  _highlightReplay(swap.fromId, swap.num, swap.toId);

  _replayTimer = setTimeout(() => {
    // Hamleyi shelves verisine uygula
    const from = shelves.find(s => s.id === swap.fromId);
    const to   = shelves.find(s => s.id === swap.toId);
    if (from && to) {
      const idx = from.nums.indexOf(swap.num);
      if (idx !== -1) { from.nums.splice(idx, 1); to.nums.push(swap.num); }
    }
    render(true);
    _replayTimer = setTimeout(_doReplayStep, 500);
  }, 750);
}

/* DOM'a highlight class'larını ekle (render sonrası çağrılır) */
function _highlightReplay(fromId, num, toId) {
  const fromShelf = document.querySelector(`.shelf[data-shelf-id="${fromId}"]`);
  const toShelf   = document.querySelector(`.shelf[data-shelf-id="${toId}"]`);

  if (fromShelf) {
    for (const chip of fromShelf.querySelectorAll('.num-chip')) {
      if (parseInt(chip.textContent) === num) {
        chip.classList.add('replay-glow');
        break;
      }
    }
  }
  if (toShelf) toShelf.classList.add('replay-target');
}

function _updateReplayBar() {
  const el = document.getElementById('replay-status');
  if (el) el.textContent = `${_replayStep} / ${_replaySwaps.length} hamle`;
}

/* Tüm animasyon bitti — çözümü kilitle ve pes ekranını geri göster */
function _finishReplay() {
  const bar = document.getElementById('replay-bar');
  if (bar) bar.style.display = 'none';

  shelves.forEach(s => {
    const sol = _solution[s.id];
    if (sol && !prevLocked.has(s.id)) {
      s.nums = [...sol];
      s.locked = true;
      prevLocked.add(s.id);
    }
  });
  render(true);

  const replayBtn = document.getElementById('replay-btn');
  if (replayBtn) replayBtn.textContent = '↺ Tekrar İzle';
  document.getElementById('pes-screen').classList.add('show');
}

/* "Atla" butonuna basıldığında hemen bitir */
function skipReplay() {
  if (_replayTimer) { clearTimeout(_replayTimer); _replayTimer = null; }
  _finishReplay();
}

/* ════════════════════════════════════════
   SONUÇ PAYLAŞMA — PNG KARTI
════════════════════════════════════════ */

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,       y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r,   y,         r);
  ctx.closePath();
}

async function _generateShareCanvas() {
  const W = 640, H = 360, DPR = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  await document.fonts.ready;

  const BG        = '#0c0b09';
  const PANEL     = '#161412';
  const BORDER    = '#252219';
  const ACCENT    = '#d4f03c';
  const TEXT      = '#ede7d9';
  const MUTED     = '#7a7060';
  const MUTED2    = '#2a261e';
  const GOLD      = '#f5a623';
  const GREEN     = '#4dfa7a';
  const RED       = '#ff4545';
  const diffColor = { easy: GREEN, medium: GOLD, hard: RED }[difficulty] || MUTED;

  // ── Arka plan ──
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Radyal parıltı (sol üst, accent)
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 300);
  glow.addColorStop(0, 'rgba(212,240,60,0.07)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Arka plan dekoratif sayılar (math-bg tarzı)
  ctx.font = '700 72px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(237,231,217,0.018)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [[558,72,7],[92,292,3],[506,304,11],[148,112,5],[52,184,2],[592,196,13]].forEach(([x,y,n]) => ctx.fillText(n,x,y));

  // Dış border
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Üst accent şerit
  const barG = ctx.createLinearGradient(0, 0, 380, 0);
  barG.addColorStop(0, ACCENT);
  barG.addColorStop(1, 'transparent');
  ctx.fillStyle = barG;
  ctx.fillRect(0, 0, W, 3);

  // ── RAF× logo ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 40px "Outfit", sans-serif';
  ctx.fillStyle = TEXT;
  ctx.fillText('RAF', 40, 64);
  ctx.fillStyle = ACCENT;
  ctx.fillText('×', 40 + ctx.measureText('RAF').width, 64);

  // Alt başlık
  ctx.font = '400 9.5px "JetBrains Mono", monospace';
  ctx.fillStyle = MUTED;
  if (isDailyMode) {
    const d = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    ctx.fillText('GÜNLÜK BULMACA  ·  ' + d, 40, 84);
  } else {
    ctx.fillText('ÇARPIM BULMACASI', 40, 84);
  }

  // ── Zorluk rozeti (sağ üst) ──
  const diffLabel = ({ easy: 'KOLAY', medium: 'ORTA', hard: 'ZOR' }[difficulty] || difficulty.toUpperCase())
    + (gameMode === 'timed' ? '  ⏱' : '');
  ctx.font = '700 9.5px "JetBrains Mono", monospace';
  const bw = ctx.measureText(diffLabel).width + 22;
  const bx = W - bw - 32, by = 46, bh = 22;
  ctx.fillStyle = diffColor + '1a';
  _roundRect(ctx, bx, by, bw, bh, 5); ctx.fill();
  ctx.strokeStyle = diffColor + '55'; ctx.lineWidth = 1;
  _roundRect(ctx, bx, by, bw, bh, 5); ctx.stroke();
  ctx.fillStyle = diffColor;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(diffLabel, bx + bw / 2, by + bh / 2);

  // ── Yatay ayırıcı ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BORDER;
  ctx.fillRect(40, 103, W - 80, 1);

  // ── Yıldızlar ──
  const stars = finalStars();
  ctx.font = '42px "Outfit", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 3; i++) {
    const cx = W / 2 + (i - 1) * 54;
    ctx.fillStyle   = i < stars ? GOLD : MUTED2;
    ctx.shadowColor = i < stars ? GOLD : 'transparent';
    ctx.shadowBlur  = i < stars ? 18 : 0;
    ctx.fillText('★', cx, 152);
  }
  ctx.shadowBlur = 0;

  // ── İstatistik kutuları ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const sW = 136, sH = 68, sGap = 14;
  const sX = (W - 2 * sW - sGap) / 2, sY = 208;
  [{ val: formatTime(timerSec), label: 'SÜRE' }, { val: String(moves), label: 'HAMLE' }]
    .forEach((s, i) => {
      const sx = sX + i * (sW + sGap);
      ctx.fillStyle = PANEL;
      _roundRect(ctx, sx, sY, sW, sH, 8); ctx.fill();
      ctx.strokeStyle = BORDER; ctx.lineWidth = 1;
      _roundRect(ctx, sx, sY, sW, sH, 8); ctx.stroke();
      ctx.fillStyle = ACCENT + 'aa';
      ctx.fillRect(sx, sY + 10, 2, sH - 20);
      ctx.font = '700 22px "JetBrains Mono", monospace';
      ctx.fillStyle = ACCENT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.val, sx + sW / 2, sY + sH / 2 - 9);
      ctx.font = '400 8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = MUTED;
      ctx.fillText(s.label, sx + sW / 2, sY + sH / 2 + 17);
    });

  // ── URL ──
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.font = '400 9px "JetBrains Mono", monospace';
  ctx.fillStyle = MUTED;
  ctx.fillText('rafxmat.github.io/x/', W - 32, H - 22);

  return canvas;
}

async function shareResult() {
  const btn = document.getElementById('win-share-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const canvas = await _generateShareCanvas();
    canvas.toBlob(async blob => {
      const file = new File([blob], 'rafx-sonuc.png', { type: 'image/png' });

      // Mobil: native paylaşım
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'RAF× — Çarpım Bulmacası' });
          if (btn) { btn.disabled = false; btn.textContent = '↗ Paylaş'; }
          return;
        } catch (e) {
          if (e.name === 'AbortError') {
            if (btn) { btn.disabled = false; btn.textContent = '↗ Paylaş'; }
            return;
          }
        }
      }

      // Masaüstü: PNG indir
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'rafx-sonuc.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Kaydedildi!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = '↗ Paylaş'; btn.classList.remove('copied'); }, 2200);
      }
    }, 'image/png');
  } catch (_) {
    if (btn) { btn.disabled = false; btn.textContent = '↗ Paylaş'; }
  }
}

/* ═══════════════════════════════════════════════
   ONBOARDING
════════════════════════════════════════════════ */
function showOnboarding() {
  let _sel = null;
  const _placed = [];

  const overlay = document.createElement('div');
  overlay.id = 'ob-overlay';
  overlay.innerHTML = `
    <div class="ob-card">
      <div class="ob-head">
        <span class="ob-logo">RAF×</span>
        <button class="ob-skip-btn">Atla →</button>
      </div>
      <div class="ob-title">Nasıl oynanır?</div>
      <div class="ob-hint" id="ob-hint">Sayılara tıkla, ardından rafa yerleştir</div>
      <div class="ob-shelf" id="ob-shelf">
        <div class="ob-shelf-inner">
          <span class="ob-shelf-label">Raf 1</span>
          <div class="ob-shelf-slots" id="ob-placed"></div>
          <span class="ob-shelf-target">6</span>
        </div>
      </div>
      <div class="ob-chips" id="ob-chips">
        <div class="ob-chip ob-chip-pulse" data-val="2">2</div>
        <div class="ob-chip ob-chip-pulse" data-val="3">3</div>
      </div>
      <div class="ob-success" id="ob-success">✓ Harika! Tam olarak böyle!</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const finish = () => {
    localStorage.setItem('rafx_onboarded', '1');
    localStorage.setItem('rafx_tut', '1');
    overlay.classList.add('ob-out');
    setTimeout(() => { overlay.remove(); initGame(); }, 320);
  };

  overlay.querySelector('.ob-skip-btn').addEventListener('click', finish);

  overlay.querySelectorAll('.ob-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chip.classList.contains('ob-placed')) return;
      overlay.querySelectorAll('.ob-chip').forEach(c => c.classList.remove('ob-selected', 'ob-chip-pulse'));
      chip.classList.add('ob-selected');
      _sel = parseInt(chip.dataset.val);
      document.getElementById('ob-shelf').classList.add('ob-shelf-ready');
      document.getElementById('ob-hint').textContent = 'Şimdi rafa tıkla →';
    });
  });

  document.getElementById('ob-shelf').addEventListener('click', () => {
    if (_sel === null) return;
    _placed.push(_sel);

    const chip = overlay.querySelector(`.ob-chip[data-val="${_sel}"]`);
    chip.classList.remove('ob-selected');
    chip.classList.add('ob-placed');
    _sel = null;
    document.getElementById('ob-shelf').classList.remove('ob-shelf-ready');

    document.getElementById('ob-placed').innerHTML =
      _placed.map(v => `<span class="ob-placed-chip">${v}</span>`).join('');

    if (_placed.length === 2) {
      document.getElementById('ob-shelf').classList.add('ob-shelf-correct');
      const chips = document.getElementById('ob-chips');
      chips.style.opacity = '0.3'; chips.style.pointerEvents = 'none';
      document.getElementById('ob-hint').style.display = 'none';
      document.getElementById('ob-success').classList.add('ob-success-show');
      setTimeout(finish, 1800);
    } else {
      overlay.querySelectorAll('.ob-chip:not(.ob-placed)').forEach(c => c.classList.add('ob-chip-pulse'));
      document.getElementById('ob-hint').textContent = 'Diğer sayıyı da ekle →';
    }
  });
}
