// levels.js — Macera Modu seviye sistemi
//
// Kural:
//   - 9 veya 10'un katı  → ZOR
//   - 4 veya 5'in katı   → ORTA (zor değilse)
//   - Geri kalan         → KOLAY
//   - 20'nin katı (4, 5, 10'un kesişimi) → BOSS (ekstra ödüllü)

const LEVELS_KEY = 'rafx_levels_v1';
const MAX_LEVEL  = 100;

/* ── Seviye numarasından zorluk hesapla ── */
function getLevelDifficulty(level) {
  if (level % 9 === 0 || level % 10 === 0) return 'hard';
  if (level % 4 === 0 || level % 5 === 0)  return 'medium';
  return 'easy';
}

/* ── Boss seviye mi? (her 20'de bir) ── */
function isBossLevel(level) {
  return level % 20 === 0;
}

/* ── Seviye etiketi ── */
function getLevelLabel(level) {
  if (isBossLevel(level)) return 'BOSS';
  const d = getLevelDifficulty(level);
  return d === 'hard' ? 'Zor' : d === 'medium' ? 'Orta' : 'Kolay';
}

/* ── Kaydedilmiş ilerlemeyi al ── */
function getLevelProgress() {
  try { return JSON.parse(localStorage.getItem(LEVELS_KEY)) || {}; }
  catch { return {}; }
}

function _saveProgress(obj) {
  localStorage.setItem(LEVELS_KEY, JSON.stringify(obj));
}

/* ── Bir seviyede kaç yıldız kazanıldı? (yoksa 0) ── */
function getLevelStars(level) {
  const p = getLevelProgress();
  return (p[level] && p[level].stars) || 0;
}

function getLevelRecord(level) {
  const p = getLevelProgress();
  return p[level] || null;
}

/* ── Seviye sonucunu kaydet (sadece daha iyiyse) ── */
function saveLevelResult(level, stars, time, moves) {
  const p = getLevelProgress();
  const prev = p[level];
  if (!prev || stars > prev.stars ||
     (stars === prev.stars && (time < prev.time || moves < prev.moves))) {
    p[level] = {
      stars: Math.max(stars, prev ? prev.stars : 0),
      time:  prev ? Math.min(prev.time, time) : time,
      moves: prev ? Math.min(prev.moves, moves) : moves,
    };
    _saveProgress(p);
    return true;
  }
  return false;
}

/* ── Seviye açık mı? (önceki bitirilmişse) ── */
function isLevelUnlocked(level) {
  if (level <= 1) return true;
  return getLevelStars(level - 1) > 0;
}

/* ── En son açık seviye numarası ── */
function getMaxUnlockedLevel() {
  for (let i = MAX_LEVEL; i >= 1; i--) {
    if (isLevelUnlocked(i)) return i;
  }
  return 1;
}

/* ── Toplam yıldız ── */
function getTotalStars() {
  const p = getLevelProgress();
  return Object.values(p).reduce((sum, r) => sum + (r.stars || 0), 0);
}

/* ── Tamamlanan seviye sayısı ── */
function getCompletedCount() {
  const p = getLevelProgress();
  return Object.keys(p).filter(k => p[k].stars > 0).length;
}
