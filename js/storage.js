// storage.js — Kayıtlar (localStorage)

const STORAGE_KEY = 'rafx_v1';

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch(e) { return {}; }
}

function saveRecord(difficulty, seconds, moves) {
  const records = getRecords();
  if (!records[difficulty]) records[difficulty] = {};
  const rec = records[difficulty];
  let isNewRecord = false;

  const betterTime  = !rec.bestTime  || seconds < rec.bestTime;
  const betterMoves = !rec.bestMoves || moves   < rec.bestMoves;
  if (betterTime)  rec.bestTime  = seconds;
  if (betterMoves) rec.bestMoves = moves;
  if (betterTime || betterMoves) isNewRecord = true;
  rec.gamesWon = (rec.gamesWon || 0) + 1;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return isNewRecord;
}

function getRecord(difficulty) {
  return getRecords()[difficulty] || null;
}

function formatTime(sec) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
