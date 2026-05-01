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
    got3starsHard: false,
    subMinuteWin:  false,
    lowMovesWin:   false,
    noHintWin:     false,
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
function recordGame({ difficulty, mode, seconds, moves, won, stars, isDaily, hintsUsed = 0 }) {
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
    if (stars === 3)                        s.got3stars     = true;
    if (stars === 3 && difficulty === 'hard') s.got3starsHard = true;
    if (seconds < 60)                       s.subMinuteWin  = true;
    if (moves <= 18)                        s.lowMovesWin   = true;
    if (hintsUsed === 0)                    s.noHintWin     = true;
    if (isDaily)       s.dailyWins++;

    if (['easy', 'medium', 'hard'].includes(difficulty)) {
      s.byDiff[difficulty].wins++;
    }
    if (mode === 'timed')   { s.timed.wins++; }
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

/* ── Sonsuz mod yeni oyun başlangıcı sayacı ── */
function recordEndlessStart() {
  const s = getStats();
  s.endless.games++;
  saveStats(s);
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
    desc: '18 hamlede veya azla bitir',
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
  {
    id: 'easy_win',
    icon: '🟢',
    name: 'Kolay Zafer',
    desc: 'Kolay modda bir oyun tamamla',
    check: s => s.byDiff.easy.wins >= 1,
  },
  {
    id: 'medium_win',
    icon: '🟡',
    name: 'Orta Güç',
    desc: 'Orta modda bir oyun tamamla',
    check: s => s.byDiff.medium.wins >= 1,
  },
  {
    id: 'hard_win',
    icon: '🔴',
    name: 'Zorlu Zafer',
    desc: 'Zor modda bir oyun tamamla',
    check: s => s.byDiff.hard.wins >= 1,
  },
  {
    id: 'hard3stars',
    icon: '💎',
    name: 'Elmas',
    desc: 'Zor modda 3 yıldız kazan',
    check: s => s.got3starsHard,
  },
  {
    id: 'nohint',
    icon: '🧠',
    name: 'Saf Zeka',
    desc: 'İpucu kullanmadan bir oyunu bitir',
    check: s => s.noHintWin,
  },
  {
    id: 'daily10',
    icon: '📆',
    name: 'Günlük Alışkanlık',
    desc: '10 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 10,
  },
  {
    id: 'endless10',
    icon: '🔟',
    name: 'İlk On',
    desc: 'Sonsuz modda 10 raf tamamla',
    check: s => s.endless.best >= 10,
  },
  {
    id: 'endless50',
    icon: '🌊',
    name: 'Dalgakıran',
    desc: 'Sonsuz modda 50 raf tamamla',
    check: s => s.endless.best >= 50,
  },
  {
    id: 'games100',
    icon: '💯',
    name: 'Yüzlük',
    desc: '100 oyun oyna',
    check: s => s.totalGames >= 100,
  },
  {
    id: 'hour',
    icon: '⌛',
    name: 'Saatler Geçti',
    desc: 'Toplam 1 saat oyna',
    check: s => s.totalTime >= 3600,
  },

  /* ── Kazanma serileri ── */
  {
    id: 'wins25',
    icon: '🥈',
    name: 'Gümüş',
    desc: '25 oyunu kazan',
    check: s => s.totalWins >= 25,
  },
  {
    id: 'wins100',
    icon: '🎖',
    name: 'Yüz Zafer',
    desc: '100 oyunu kazan',
    check: s => s.totalWins >= 100,
  },
  {
    id: 'wins250',
    icon: '🏅',
    name: 'Efsane',
    desc: '250 oyunu kazan',
    check: s => s.totalWins >= 250,
  },
  {
    id: 'wins500',
    icon: '👑',
    name: 'Kral',
    desc: '500 oyunu kazan',
    check: s => s.totalWins >= 500,
  },

  /* ── Oyun sayısı ── */
  {
    id: 'games50',
    icon: '📊',
    name: 'Ellinci Maç',
    desc: '50 oyun oyna',
    check: s => s.totalGames >= 50,
  },
  {
    id: 'games200',
    icon: '📈',
    name: 'Deneyimli',
    desc: '200 oyun oyna',
    check: s => s.totalGames >= 200,
  },
  {
    id: 'games500',
    icon: '🎰',
    name: 'Veteran',
    desc: '500 oyun oyna',
    check: s => s.totalGames >= 500,
  },

  /* ── Sonsuz mod ── */
  {
    id: 'endless5',
    icon: '🌱',
    name: 'Sonsuz Başlar',
    desc: 'Sonsuz modda 5 raf tamamla',
    check: s => s.endless.best >= 5,
  },
  {
    id: 'endless30',
    icon: '🌀',
    name: 'Otuzda Bir',
    desc: 'Sonsuz modda 30 raf tamamla',
    check: s => s.endless.best >= 30,
  },
  {
    id: 'endless100',
    icon: '🌌',
    name: 'Sonsuz Aşan',
    desc: 'Sonsuz modda 100 raf tamamla',
    check: s => s.endless.best >= 100,
  },
  {
    id: 'endless_go',
    icon: '🔁',
    name: 'Sonsuz Meraklı',
    desc: 'Sonsuz modda 5 oyun başlat',
    check: s => s.endless.games >= 5,
  },

  /* ── Günlük seri ── */
  {
    id: 'streak3',
    icon: '🕯',
    name: 'Ateş Yakmak',
    desc: '3 gün üst üste oyna',
    check: s => s.bestStreak >= 3,
  },
  {
    id: 'streak14',
    icon: '🌤',
    name: 'İki Hafta',
    desc: '14 gün üst üste oyna',
    check: s => s.bestStreak >= 14,
  },
  {
    id: 'streak30',
    icon: '☀',
    name: 'Bir Ay',
    desc: '30 gün üst üste oyna',
    check: s => s.bestStreak >= 30,
  },

  /* ── Günlük bulmaca ── */
  {
    id: 'daily5',
    icon: '📅',
    name: 'Beş Günlük',
    desc: '5 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 5,
  },
  {
    id: 'daily25',
    icon: '🗓',
    name: 'Yirmi Beş Gün',
    desc: '25 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 25,
  },
  {
    id: 'daily50',
    icon: '📆',
    name: 'Günlük Efsane',
    desc: '50 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 50,
  },

  /* ── Süre sınırı modu ── */
  {
    id: 'timed5',
    icon: '⚡',
    name: 'Hız Tutkunu',
    desc: 'Süre sınırı modunda 5 kez kazan',
    check: s => s.timed.wins >= 5,
  },
  {
    id: 'timed10',
    icon: '⏰',
    name: 'Zaman Efendisi',
    desc: 'Süre sınırı modunda 10 kez kazan',
    check: s => s.timed.wins >= 10,
  },
  {
    id: 'timed_play',
    icon: '🎯',
    name: 'Süre Delisi',
    desc: 'Süre sınırı modunda 10 oyun oyna',
    check: s => s.timed.games >= 10,
  },

  /* ── Zorluk bazlı ── */
  {
    id: 'easy10',
    icon: '🟢',
    name: 'Kolay Ustası',
    desc: 'Kolay modda 10 oyun kazan',
    check: s => s.byDiff.easy.wins >= 10,
  },
  {
    id: 'medium5',
    icon: '🟡',
    name: 'Orta Yolcu',
    desc: 'Orta modda 5 oyun kazan',
    check: s => s.byDiff.medium.wins >= 5,
  },
  {
    id: 'medium10',
    icon: '🟠',
    name: 'Orta Uzman',
    desc: 'Orta modda 10 oyun kazan',
    check: s => s.byDiff.medium.wins >= 10,
  },
  {
    id: 'hard5',
    icon: '🔴',
    name: 'Zoru Sevenler',
    desc: 'Zor modda 5 oyun kazan',
    check: s => s.byDiff.hard.wins >= 5,
  },
  {
    id: 'hard10',
    icon: '💪',
    name: 'Demir İrade',
    desc: 'Zor modda 10 oyun kazan',
    check: s => s.byDiff.hard.wins >= 10,
  },
  {
    id: 'alldiff',
    icon: '🌐',
    name: 'Tam Paket',
    desc: 'Üç zorlukta da en az 1 oyun kazan',
    check: s => s.byDiff.easy.wins >= 1 && s.byDiff.medium.wins >= 1 && s.byDiff.hard.wins >= 1,
  },

  /* ── Toplam süre ── */
  {
    id: 'hour2',
    icon: '⏳',
    name: 'İki Saat',
    desc: 'Toplam 2 saat oyna',
    check: s => s.totalTime >= 7200,
  },
  {
    id: 'hour5',
    icon: '🕰',
    name: 'Beş Saat',
    desc: 'Toplam 5 saat oyna',
    check: s => s.totalTime >= 18000,
  },
  {
    id: 'hour10',
    icon: '🌙',
    name: 'On Saat',
    desc: 'Toplam 10 saat oyna',
    check: s => s.totalTime >= 36000,
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
