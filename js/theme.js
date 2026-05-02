// theme.js — Tema yönetimi

const THEME_KEY = 'rafx_theme';

/* ── Tema ── */
function applyTheme(dark, animate = false) {
  if (animate) {
    document.documentElement.classList.add('theme-transitioning');
    // double-rAF: transition class'ı önce hesaplansın, sonra tema değişsin
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      });
    });
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 600);
  } else {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }
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
  applyTheme(dark, true);
}

/* ── Başlatma ── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('change', onThemeToggle);
});

// bfcache'den geri dönüldüğünde temayı yeniden uygula (sayfa yenilenmez)
window.addEventListener('pageshow', initTheme);

