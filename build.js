#!/usr/bin/env node
// build.js — JS concat+minify + CSS minify
// Kullanım: node build.js
// Çıktı: dist/game.bundle.min.js, dist/core.bundle.min.js,
//         dist/settings.bundle.min.js, dist/style.min.css

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

const BUNDLES = {
  'game.bundle.min.js': [
    'js/audio.js',
    'js/storage.js',
    'js/stats.js',
    'js/levels.js',
    'js/puzzle.js',
    'js/drag.js',
    'js/confetti.js',
    'js/render.js',
    'js/hint.js',
    'js/stopwatch.js',
    'js/screens.js',
    'js/game.js',
    'js/theme.js',
  ],
  'core.bundle.min.js': [
    'js/storage.js',
    'js/stats.js',
    'js/levels.js',
    'js/theme.js',
  ],
  'settings.bundle.min.js': [
    'js/storage.js',
    'js/stats.js',
    'js/audio.js',
    'js/theme.js',
  ],
};

function kb(file) {
  return (fs.statSync(file).size / 1024).toFixed(1) + ' KB';
}

// ── JS bundles ──────────────────────────────────────────────
for (const [out, files] of Object.entries(BUNDLES)) {
  const tmp = path.join(DIST, '_tmp.js');
  const src = files.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  fs.writeFileSync(tmp, src);

  const outPath = path.join(DIST, out);
  execSync(`npx --yes terser "${tmp}" --compress --mangle -o "${outPath}"`, {
    cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
  });
  fs.unlinkSync(tmp);

  const srcKb = (Buffer.byteLength(src) / 1024).toFixed(1);
  console.log(`  ${out}: ${srcKb} KB → ${kb(outPath)}`);
}

// ── CSS ─────────────────────────────────────────────────────
const cssOut = path.join(DIST, 'style.min.css');
const cssSrc = path.join(ROOT, 'css/style.css');
execSync(`npx --yes clean-css-cli "${cssSrc}" -o "${cssOut}"`, {
  cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'],
});
console.log(`  style.min.css: ${kb(path.join(ROOT, 'css/style.css'))} → ${kb(cssOut)}`);

console.log('\nBuild tamamlandı.');
