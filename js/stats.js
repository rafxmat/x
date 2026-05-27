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

  /* ── Toplam hamle ── */
  {
    id: 'moves1000',
    icon: '🎲',
    name: 'Bin Hamle',
    desc: 'Toplam 1000 hamle gerçekleştir',
    check: s => s.totalMoves >= 1000,
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

  /* ═══════════════════════════════════════════════════════
     YENİ BAŞARIMLAR (51–100)
     ═══════════════════════════════════════════════════════ */

  /* ── Düşük eşikli zaferler ── */
  { id: 'wins5',    icon: '🌟', name: 'Beş Zafer',        desc: '5 oyun kazan',
    check: s => s.totalWins >= 5 },
  { id: 'wins750',  icon: '🎗', name: 'Yedi Yüz Elli',    desc: '750 oyun kazan',
    check: s => s.totalWins >= 750 },
  { id: 'wins1000', icon: '💫', name: 'Bin Zafer',        desc: '1000 oyun kazan',
    check: s => s.totalWins >= 1000 },

  /* ── Daha fazla oyun ── */
  { id: 'games10',   icon: '🎮', name: 'Acemi',           desc: '10 oyun oyna',
    check: s => s.totalGames >= 10 },
  { id: 'games25',   icon: '🎯', name: 'Çırak',           desc: '25 oyun oyna',
    check: s => s.totalGames >= 25 },
  { id: 'games750',  icon: '📚', name: 'Kitap Dolu',      desc: '750 oyun oyna',
    check: s => s.totalGames >= 750 },
  { id: 'games1000', icon: '🌐', name: 'Bin Oyun',        desc: '1000 oyun oyna',
    check: s => s.totalGames >= 1000 },

  /* ── Hamle eşikleri ── */
  { id: 'moves500',   icon: '⚡', name: 'Beş Yüz Hamle',   desc: 'Toplam 500 hamle',
    check: s => s.totalMoves >= 500 },
  { id: 'moves2500',  icon: '🚀', name: 'İki Bin Beş Yüz', desc: 'Toplam 2500 hamle',
    check: s => s.totalMoves >= 2500 },
  { id: 'moves5000',  icon: '💎', name: 'Beş Bin Hamle',   desc: 'Toplam 5000 hamle',
    check: s => s.totalMoves >= 5000 },
  { id: 'moves10000', icon: '🪐', name: 'On Bin Hamle',    desc: 'Toplam 10.000 hamle',
    check: s => s.totalMoves >= 10000 },

  /* ── Süre kategorileri ── */
  { id: 'min5',     icon: '🕐', name: 'Beş Dakika',  desc: 'Toplam 5 dakika oyna',
    check: s => s.totalTime >= 300 },
  { id: 'min30',    icon: '⏲', name: 'Yarım Saat',  desc: 'Toplam 30 dakika oyna',
    check: s => s.totalTime >= 1800 },
  { id: 'hour20',   icon: '🌒', name: 'Yirmi Saat',  desc: 'Toplam 20 saat oyna',
    check: s => s.totalTime >= 72000 },
  { id: 'hour50',   icon: '🌓', name: 'Elli Saat',   desc: 'Toplam 50 saat oyna',
    check: s => s.totalTime >= 180000 },
  { id: 'hour100',  icon: '🌕', name: 'Yüz Saat',    desc: 'Toplam 100 saat oyna',
    check: s => s.totalTime >= 360000 },

  /* ── Zorluk bazlı (yüksek eşikler) ── */
  { id: 'easy25',   icon: '🌾', name: 'Kolay Hâkimi', desc: 'Kolay modda 25 oyun kazan',
    check: s => s.byDiff.easy.wins >= 25 },
  { id: 'easy50',   icon: '🌳', name: 'Kolay Üstadı', desc: 'Kolay modda 50 oyun kazan',
    check: s => s.byDiff.easy.wins >= 50 },
  { id: 'medium25', icon: '🍂', name: 'Orta Hâkimi',  desc: 'Orta modda 25 oyun kazan',
    check: s => s.byDiff.medium.wins >= 25 },
  { id: 'medium50', icon: '🔶', name: 'Orta Üstadı',  desc: 'Orta modda 50 oyun kazan',
    check: s => s.byDiff.medium.wins >= 50 },
  { id: 'hard25',   icon: '🌶', name: 'Zor Hâkimi',   desc: 'Zor modda 25 oyun kazan',
    check: s => s.byDiff.hard.wins >= 25 },
  { id: 'hard50',   icon: '🗡', name: 'Zor Üstadı',   desc: 'Zor modda 50 oyun kazan',
    check: s => s.byDiff.hard.wins >= 50 },

  /* ── Günlük bulmaca ── */
  { id: 'daily100', icon: '📓', name: 'Yüz Günlük',     desc: '100 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 100 },
  { id: 'daily200', icon: '📔', name: 'İki Yüz Günlük', desc: '200 günlük bulmaca tamamla',
    check: s => s.dailyWins >= 200 },

  /* ── Sonsuz mod ── */
  { id: 'endless15',  icon: '🐟', name: 'On Beş Dalga',  desc: 'Sonsuz modda 15 raf',
    check: s => s.endless.best >= 15 },
  { id: 'endless75',  icon: '🐋', name: 'Yetmiş Beş',    desc: 'Sonsuz modda 75 raf',
    check: s => s.endless.best >= 75 },
  { id: 'endless150', icon: '🦈', name: 'Yüz Elli Raf',  desc: 'Sonsuz modda 150 raf',
    check: s => s.endless.best >= 150 },
  { id: 'endless200', icon: '🐉', name: 'İki Yüz Raf',   desc: 'Sonsuz modda 200 raf',
    check: s => s.endless.best >= 200 },
  { id: 'endless500', icon: '🌠', name: 'Beş Yüz Raf',   desc: 'Sonsuz modda 500 raf',
    check: s => s.endless.best >= 500 },

  /* ── Streaks ── */
  { id: 'streak60',  icon: '🎇', name: 'Altmış Gün', desc: '60 gün üst üste oyna',
    check: s => s.bestStreak >= 60 },
  { id: 'streak100', icon: '💯', name: 'Yüz Gün',    desc: '100 gün üst üste oyna',
    check: s => s.bestStreak >= 100 },
  { id: 'streak365', icon: '🏆', name: 'Yıl Boyu',   desc: '365 gün üst üste oyna',
    check: s => s.bestStreak >= 365 },

  /* ── Süre sınırı ── */
  { id: 'timed25', icon: '🕜', name: 'Hız Tutkunu II',  desc: 'Süre sınırı modunda 25 kez kazan',
    check: s => s.timed.wins >= 25 },
  { id: 'timed50', icon: '🕔', name: 'Hız Tutkunu III', desc: 'Süre sınırı modunda 50 kez kazan',
    check: s => s.timed.wins >= 50 },

  /* ════════════════════════════════════════
     MACERA MODU BAŞARIMLARI
     ════════════════════════════════════════ */
  { id: 'adv_first', icon: '🗺', name: 'Macera Başladı', desc: 'İlk macera seviyesini bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 1 },
  { id: 'adv_5',     icon: '🚶', name: 'Yolcu',           desc: '5 macera seviyesi bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 5 },
  { id: 'adv_15',    icon: '🥾', name: 'Kâşif',           desc: '15 macera seviyesi bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 15 },
  { id: 'adv_25',    icon: '🧭', name: 'Maceracı',        desc: '25 macera seviyesi bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 25 },
  { id: 'adv_50',    icon: '🗻', name: 'Yarı Yolda',      desc: '50 macera seviyesi bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 50 },
  { id: 'adv_75',    icon: '🌋', name: 'Sona Yaklaş',     desc: '75 macera seviyesi bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 75 },
  { id: 'adv_100',   icon: '🏔', name: 'Macera Tamam',    desc: 'Tüm 100 macera seviyesini bitir',
    check: () => typeof getCompletedCount === 'function' && getCompletedCount() >= 100 },

  { id: 'adv_boss1',    icon: '⚔', name: 'Boss Avcısı', desc: 'İlk boss seviyesini (20) bitir',
    check: () => typeof getLevelStars === 'function' && getLevelStars(20) > 0 },
  { id: 'adv_boss_all', icon: '👹', name: 'Beş Boss',    desc: 'Tüm boss seviyelerini bitir',
    check: () => typeof getLevelStars === 'function' && [20,40,60,80,100].every(n => getLevelStars(n) > 0) },

  { id: 'adv_chapter1',  icon: '🌱', name: 'Tohum Çiçeklendi', desc: 'Bölüm 1 (1–10) tamamla',
    check: () => {
      if (typeof getLevelStars !== 'function') return false;
      for (let i = 1; i <= 10; i++) if (getLevelStars(i) === 0) return false;
      return true;
    }},
  { id: 'adv_chapter5',  icon: '⛰', name: 'Dağı Aştı',        desc: 'Bölüm 5 (41–50) tamamla',
    check: () => {
      if (typeof getLevelStars !== 'function') return false;
      for (let i = 41; i <= 50; i++) if (getLevelStars(i) === 0) return false;
      return true;
    }},
  { id: 'adv_chapter10', icon: '🌌', name: 'Son Bölüm',        desc: 'Bölüm 10 (91–100) tamamla',
    check: () => {
      if (typeof getLevelStars !== 'function') return false;
      for (let i = 91; i <= 100; i++) if (getLevelStars(i) === 0) return false;
      return true;
    }},

  { id: 'adv_stars30',  icon: '✨', name: 'Otuz Yıldız',      desc: 'Macera modunda 30 yıldız topla',
    check: () => typeof getTotalStars === 'function' && getTotalStars() >= 30 },
  { id: 'adv_stars100', icon: '🌟', name: 'Yüz Yıldız',       desc: 'Macera modunda 100 yıldız topla',
    check: () => typeof getTotalStars === 'function' && getTotalStars() >= 100 },
  { id: 'adv_stars200', icon: '💫', name: 'İki Yüz Yıldız',   desc: 'Macera modunda 200 yıldız topla',
    check: () => typeof getTotalStars === 'function' && getTotalStars() >= 200 },
  { id: 'adv_stars300', icon: '💎', name: 'Mükemmel Macera',  desc: 'Tüm 300 macera yıldızını topla',
    check: () => typeof getTotalStars === 'function' && getTotalStars() >= 300 },
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
