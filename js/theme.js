// theme.js — Tema yönetimi

const THEME_KEY = 'rafx_theme';

/* ── Tema ── */
function applyTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = dark;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const dark  = saved !== null ? saved === 'dark' : true;
  applyTheme(dark);
}

function onThemeToggle(e) {
  const dark = e.target.checked;
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  applyTheme(dark);
}

/* ── Başlatma ── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('change', onThemeToggle);
});
