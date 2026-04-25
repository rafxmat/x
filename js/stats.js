// stats.js — İstatistik & Başarım Yönetimi

const STATS_KEY = 'rafx_stats';
const ACH_KEY   = 'rafx_ach';

/* ── Varsayılan istatistik yapısı ── */
function defaultStats() {
  return {
    totalGames:    0,
    totalWins:     0,
    totalMoves:    0,
    totalTime:     0,
    got3stars:     false,
    subMinuteWin:  false,
    lowMovesWin:   false,
    dailyWins:     0,
    byDiff: {
      easy:   { games: 0, wins: 0 },
      medium: { games: 0, wins: 0 },
      hard:   { games: 0, wins: 0 },
    },
    endless: { games: 0, best: 0 },
    timed:   { games: 0, wins: 0 },
    streak:      0,
    bestStreak:  0,
    lastPlayDate: null,
  };
}

function getStats() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATS_KEY));
    if (!raw) return defaultStats();
    const def = defaultStats();
    return {
      ...def, ...raw,
      byDiff:  { ...def.byDiff,  ...raw.byDiff  },
      endless: { ...def.endless, ...raw.endless },
      timed:   { ...def.timed,   ...raw.timed   },
    };
  } catch { return defaultStats(); }
}

function saveStats(s) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

/* ── Oyun sonu istatistik kaydet ── */
function recordGame({ difficulty, mode, seconds, moves, won, stars, isDaily }) {
  const s = getStats();
  s.totalGames++;
  if (['easy', 'medium', 'hard'].includes(difficulty)) {
    s.byDiff[difficulty].games++;
  }
  if (mode === 'timed') { s.timed.games++; }

  // Streak (her gün ilk oyunda güncelle)
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (s.lastPlayDate !== today) {
    s.streak      = s.lastPlayDate === yesterday ? s.streak + 1 : 1;
    s.bestStreak  = Math.max(s.bestStreak, s.streak);
    s.lastPlayDate = today;
  }

  if (won) {
    s.totalWins++;
    s.totalMoves += moves;
    s.totalTime  += seconds;
    if (stars === 3)   s.got3stars    = true;
    if (seconds < 60)  s.subMinuteWin = true;
    if (moves <= 18)   s.lowMovesWin  = true;
    if (isDaily)       s.dailyWins++;

    if (['easy', 'medium', 'hard'].includes(difficulty)) {
      s.byDiff[difficulty].wins++;
    }
    if (mode === 'timed')   { s.timed.wins++; }
    if (mode === 'endless') { s.endless.games++; }
  }

  saveStats(s);
  return checkNewAchievements(s);
}

/* ── Sonsuz mod skoru güncelle ── */
function recordEndlessScore(score) {
  const s = getStats();
  if (score > s.endless.best) {
    s.endless.best = score;
    saveStats(s);
    return checkNewAchievements(s);
  }
  return [];
}

/* ════════════════════════════════════════
   BAŞARIMLAR
════════════════════════════════════════ */
const ACHIEVEMENTS = [
  {
    id: 'first',
    icon: '🎯',
    name: 'İlk Adım',
    desc: 'İlk oyununu tamamla',
    check: s => s.totalWins >= 1,
  },
  {
    id: 'ten',
    icon: '🏅',
    name: 'On Oyun',
    desc: '10 oyunu tamamla',
    check: s => s.totalWins >= 10,
  },
  {
    id: 'fifty',
    icon: '🏆',
    name: 'Elli Oyun',
    desc: '50 oyunu tamamla',
    check: s => s.totalWins >= 50,
  },
  {
    id: 'stars3',
    icon: '⭐',
    name: 'Yıldız Avcısı',
    desc: 'Bir oyunda 3 yıldız kazan',
    check: s => s.got3stars,
  },
  {
    id: 'fast',
    icon: '⚡',
    name: 'Fırtına',
    desc: '60 saniyenin altında bitir',
    check: s => s.subMinuteWin,
  },
  {
    id: 'moves15',
    icon: '🎭',
    name: 'Hamle Ustası',
    desc: '15 hamlede veya azla bitir',
    check: s => s.lowMovesWin,
  },
  {
    id: 'daily',
    icon: '📅',
    name: 'Günlük Kahraman',
    desc: 'Günlük bulmacayı çöz',
    check: s => s.dailyWins >= 1,
  },
  {
    id: 'streak7',
    icon: '🔥',
    name: 'Tutku',
    desc: '7 gün üst üste oyna',
    check: s => s.bestStreak >= 7,
  },
  {
    id: 'timed',
    icon: '⏱',
    name: 'Süre Avcısı',
    desc: 'Süre sınırı modunda kazan',
    check: s => s.timed.wins >= 1,
  },
  {
    id: 'endless20',
    icon: '∞',
    name: 'Sonsuz Yolculuk',
    desc: 'Sonsuz modda 20 raf tamamla',
    check: s => s.endless.best >= 20,
  },
];

function getUnlockedIds() {
  try { return new Set(JSON.parse(localStorage.getItem(ACH_KEY)) || []); }
  catch { return new Set(); }
}

function checkNewAchievements(stats) {
  const unlocked = getUnlockedIds();
  const newOnes  = [];
  ACHIEVEMENTS.forEach(a => {
    if (!unlocked.has(a.id) && a.check(stats)) {
      unlocked.add(a.id);
      newOnes.push(a);
    }
  });
  if (newOnes.length) {
    localStorage.setItem(ACH_KEY, JSON.stringify([...unlocked]));
  }
  return newOnes;
}

/* ── Günlük bulmaca tamamlama kaydı ── */
function getDailyKey(difficulty) {
  const today = new Date().toISOString().slice(0, 10);
  return `rafx_daily_${today}_${difficulty}`;
}

function getDailyResult(difficulty) {
  try { return JSON.parse(localStorage.getItem(getDailyKey(difficulty))); }
  catch { return null; }
}

function saveDailyResult(difficulty, stars, time, moves) {
  const key = getDailyKey(difficulty);
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ stars, time, moves }));
  }
}
