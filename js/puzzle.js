// puzzle.js — Bulmaca üreteci (asal tabanlı)

// Asal havuzlar: her zorluğa özgü, çakışma yaratmayan sayılar
const PRIME_POOLS = {
  easy:   [2, 3, 5, 7],
  medium: [2, 3, 5, 7, 11, 13],
  hard:   [2, 3, 5, 7, 11, 13, 17, 19],
};

// Sonsuz mod replaceShelf için geriye dönük uyumluluk etiketi
const DIFF_CONFIG = {
  easy:   { min: 2, max: 7  },
  medium: { min: 2, max: 13 },
  hard:   { min: 2, max: 19 },
};

/* Fisher-Yates karıştırıcı */
function shuffleArr(arr, rng) {
  const r = rng || Math.random;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* Seeded RNG (Mulberry32) */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDailySeed(difficulty) {
  const d = new Date();
  const dateNum = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const diffNum = { easy: 1, medium: 2, hard: 3 }[difficulty] || 1;
  return dateNum * 10 + diffNum;
}

/* Havuzdan `size` adet asal seç (tekrar mümkün) */
function _pickNums(pool, size, r) {
  return Array.from({ length: size }, () => pool[Math.floor(r() * pool.length)]);
}

/*
 * Temel üretici:
 * 1. Her raf için asallardan çözüm üret → target = çarpımları
 * 2. 2'li ve 3'lü rafların sayılarını ayrı havuzlarda karıştır
 * 3. Karıştırılmış sayıları aynı büyüklükteki raflara dağıt
 *
 * Çözülebilirlik garantisi: sayılar her zaman aynı büyüklükteki
 * raflar arasında kalır; oyuncu swap yaparak çözüme ulaşabilir.
 */
function _generate(difficulty, rng) {
  const r    = rng || Math.random;
  const pool = PRIME_POOLS[difficulty] || PRIME_POOLS.easy;

  // Her boyut grubu için benzersiz target üret
  const solution = [];
  const usedTargets2 = new Set();
  const usedTargets3 = new Set();

  for (let i = 0; i < 12; i++) {
    const size = r() < 0.5 ? 2 : 3;
    const usedSet = size === 2 ? usedTargets2 : usedTargets3;
    let nums, target;
    let tries = 0;
    do {
      nums   = _pickNums(pool, size, r);
      target = nums.reduce((a, b) => a * b, 1);
      tries++;
    } while (usedSet.has(target) && tries < 30);
    usedSet.add(target);
    solution.push({ id: i, target, size, nums: [...nums] });
  }

  const pool2 = [], pool3 = [];
  solution.forEach(s => (s.size === 2 ? pool2 : pool3).push(...s.nums));
  shuffleArr(pool2, r);
  shuffleArr(pool3, r);

  const scrambled = solution.map(s => ({
    id: s.id, target: s.target, size: s.size, nums: [], locked: false,
  }));

  let i2 = 0, i3 = 0;
  scrambled.forEach(s => {
    s.nums = s.size === 2
      ? [pool2[i2++], pool2[i2++]]
      : [pool3[i3++], pool3[i3++], pool3[i3++]];
  });

  const solutionMap = solution.map(s => [...s.nums]);
  return { shelves: scrambled, solution: solutionMap };
}

/* Başlangıçta kaç rafın kazara doğru geldiğini say */
function _preSolvedCount(shelves) {
  return shelves.filter(s => s.nums.reduce((a, b) => a * b, 1) === s.target).length;
}

/* Normal oyun üretici */
function generateGame(difficulty = 'easy') {
  let best = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    const result = _generate(difficulty);
    if (_preSolvedCount(result.shelves) === 0) return result;
    if (!best || _preSolvedCount(result.shelves) < _preSolvedCount(best.shelves)) {
      best = result;
    }
  }
  return best;
}

/* Günlük bulmaca üretici */
function generateDailyGame(difficulty = 'medium') {
  const seed = getDailySeed(difficulty);
  for (let attempt = 0; attempt < 15; attempt++) {
    const result = _generate(difficulty, mulberry32(seed + attempt));
    if (_preSolvedCount(result.shelves) === 0) return result;
  }
  return _generate(difficulty, mulberry32(seed));
}

/* Sonsuz mod — tek raf üret */
function generateSingleShelfNums(difficulty) {
  const pool   = PRIME_POOLS[difficulty] || PRIME_POOLS.easy;
  const size   = Math.random() < 0.5 ? 2 : 3;
  const nums   = _pickNums(pool, size, Math.random);
  const target = nums.reduce((a, b) => a * b, 1);
  return { target, size, nums };
}
