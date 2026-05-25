// render.js — DOM render katmanı
// Bağımlılıklar (global): shelves, moves, prevMoves, prevCorrect, gameMode, endlessScore,
//   prevLocked, completingIds, enteringIds, pesShelfIds, difficulty, hintsUsed,
//   product(), checkWin(), replaceShelf(), vibrate(), calcNormalStars(), MOVE_LIMITS,
//   sndCorrect() [audio.js], getControlMode/getClickSelected/getDragState() [drag.js+storage.js],
//   onChipClick/onMouseDown/onTouchStart/onShelfClickForMove() [drag.js]

/* ── Pop efekti ── */
function popEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth; // reflow
  el.classList.add('pop');
}

/* ── Çarpan ipucu (uzun basış / sağ tık) ── */
function getFactorPairs(n) {
  const pairs = [];
  for (let i = 2; i <= Math.floor(Math.sqrt(n)); i++) {
    if (n % i === 0) pairs.push([i, n / i]);
  }
  return pairs;
}

function showFactorTooltip(anchor, n) {
  document.querySelector('.factor-tooltip')?.remove();
  const pairs = getFactorPairs(n);
  const tooltip = document.createElement('div');
  tooltip.className = 'factor-tooltip';
  const rows = pairs.length
    ? pairs.map(([a, b]) => `<span>${a} × ${b} = ${n}</span>`).join('')
    : `<span>${n} — asal sayı</span>`;
  tooltip.innerHTML = `<div class="factor-tooltip-title">${n}'nin çarpanları</div>${rows}`;
  document.body.appendChild(tooltip);
  const rect = anchor.getBoundingClientRect();
  tooltip.style.top  = (rect.bottom + 6) + 'px';
  tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 190)) + 'px';
  const dismiss = e => {
    if (!tooltip.contains(e.target)) { tooltip.remove(); document.removeEventListener('pointerdown', dismiss); }
  };
  setTimeout(() => document.addEventListener('pointerdown', dismiss), 100);
  setTimeout(() => tooltip.remove(), 4500);
}

/* ── Raf tamamlama parçacık patlaması ── */
function burstParticles(shelfEl) {
  const rect = shelfEl.getBoundingClientRect();
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;
  const COLORS = ['#4dfa7a','#fbbf24','#d4f03c','#60a5fa','#f87171','#a78bfa'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'shelf-particle';
    const angle = (i / 14) * Math.PI * 2;
    const dist  = 35 + Math.random() * 50;
    p.style.cssText = `left:${cx}px;top:${cy}px;background:${COLORS[i % COLORS.length]};--dx:${(Math.cos(angle)*dist).toFixed(1)}px;--dy:${(Math.sin(angle)*dist).toFixed(1)}px;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  }
}

/* ── Normal mod: canlı yıldız + kalan hamle göstergesi ── */
function updateLiveStars() {
  if (gameMode !== 'normal') return;

  // Kalan hamle
  const remainEl  = document.getElementById('live-stars-val');
  if (remainEl) {
    const limit     = MOVE_LIMITS[difficulty] || 60;
    const remaining = Math.max(0, limit - moves);
    remainEl.textContent = remaining;
    if      (remaining <= 10) remainEl.style.color = 'var(--red)';
    else if (remaining <= 20) remainEl.style.color = 'var(--gold)';
    else                      remainEl.style.color = '';
  }

  // Canlı yıldız
  const starEl = document.getElementById('normal-stars-val');
  if (starEl) {
    const stars = Math.max(1, calcNormalStars(moves, difficulty) - hintsUsed);
    const prev  = starEl.dataset.stars !== undefined ? parseInt(starEl.dataset.stars) : 3;
    const dropped = stars < prev;
    starEl.innerHTML = [0, 1, 2].map(i => {
      let cls = 'live-star ' + (i < stars ? 'on' : 'off');
      if (dropped && i === stars) cls += ' dropping';
      return `<span class="${cls}">★</span>`;
    }).join('');
    starEl.dataset.stars = stars;
    if (dropped) {
      setTimeout(() => {
        starEl.querySelectorAll('.live-star.dropping').forEach(s => s.classList.remove('dropping'));
      }, 500);
    }
  }
}

/* ── Ana render ── */
function render(skipSound = false) {
  const area = document.getElementById('game-area');
  const page = document.querySelector('.game-page');
  const scrollTop = page ? page.scrollTop : 0;
  area.innerHTML = '';

  const correct = shelves.filter(s => {
    const p = product(s.nums);
    return p !== null && p === s.target;
  }).length;

  const prevCorrectNum = parseInt(document.getElementById('correct-num').textContent) || 0;

  if (gameMode === 'endless') {
    document.getElementById('correct-num').textContent  = endlessScore;
    document.getElementById('progress-bar').style.width = `${(endlessScore % 10) / 10 * 100}%`;
  } else {
    document.getElementById('correct-num').textContent  = correct;
    document.getElementById('progress-bar').style.width = `${(correct / shelves.length) * 100}%`;
  }
  document.getElementById('moves-val').textContent = moves;

  if (moves > prevMoves) popEl('moves-val');
  if (gameMode === 'endless' ? endlessScore > prevCorrectNum : correct > prevCorrectNum) popEl('correct-num');
  prevMoves = moves;

  if (!skipSound && correct > prevCorrect) {
    const idx = gameMode === 'endless' ? endlessScore % 10 : correct - 1;
    sndCorrect(idx);
  }
  prevCorrect = correct;

  shelves.forEach((shelf, shelfIdx) => {
    const prod      = product(shelf.nums);
    const isCorrect = prod !== null && prod === shelf.target;
    const isWrong   = prod !== null && prod !== shelf.target;
    const justDone  = isCorrect && !prevLocked.has(shelf.id) && !completingIds.has(shelf.id);

    if (isCorrect) shelf.locked = true;

    const el  = document.createElement('div');
    let   cls = 'shelf';

    if (justDone) {
      completingIds.add(shelf.id);
      cls += ' completing';
      setTimeout(() => {
        completingIds.delete(shelf.id);
        if (gameMode === 'endless') {
          replaceShelf(shelf.id);
        } else {
          prevLocked.add(shelf.id);
          render(true);
          checkWin();
        }
      }, 420);
    } else if (completingIds.has(shelf.id)) {
      cls += ' completing';
    } else if (prevLocked.has(shelf.id)) {
      cls += ' correct locked';
    } else if (isWrong) {
      cls += ' wrong';
    }

    if (enteringIds.has(shelf.id)) cls += ' entering';

    el.className      = cls;
    el.dataset.shelfId = shelf.id;

    const isAnimating = justDone || completingIds.has(shelf.id);

    // Tamamlanan rafa mühür damgası (pes-rafları hariç)
    const isPesShelf = pesShelfIds.has(shelf.id);
    const showSeal   = !isPesShelf && (justDone || completingIds.has(shelf.id) || prevLocked.has(shelf.id));
    const sealCls    = 'shelf-seal' + (justDone ? ' stamping' : '');
    const sealHtml   = showSeal
      ? `<div class="${sealCls}" aria-hidden="true"><span class="seal-check">✓</span><span class="seal-num">${shelf.target}</span></div>`
      : '';

    el.innerHTML = `
      ${sealHtml}
      <div class="shelf-top">
        <span class="shelf-num">Raf ${shelfIdx + 1}</span>
        <span class="shelf-target">${shelf.target}</span>
      </div>
      <div class="numbers-row" id="row-${shelf.id}">
        ${shelf.nums.length === 0 ? '<span class="empty-hint">· · ·</span>' : ''}
      </div>
    `;
    area.appendChild(el);

    // Çarpım tablosu yardımcısı (uzun basış / sağ tık)
    const targetEl = el.querySelector('.shelf-target');
    if (targetEl) {
      let _pt = null;
      targetEl.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        _pt = setTimeout(() => showFactorTooltip(targetEl, shelf.target), 600);
      });
      ['pointerup', 'pointerleave'].forEach(ev =>
        targetEl.addEventListener(ev, e => {
          if (e.pointerType !== 'mouse') clearTimeout(_pt);
        })
      );
      targetEl.addEventListener('contextmenu', e => {
        e.preventDefault();
        showFactorTooltip(targetEl, shelf.target);
      });
    }

    if (justDone) { burstParticles(el); vibrate(40); }

    const row = el.querySelector(`#row-${shelf.id}`);
    shelf.nums.forEach((num, idx) => {
      const chip = document.createElement('div');
      chip.className      = 'num-chip' + (pesShelfIds.has(shelf.id) ? ' pes-chip' : '');
      chip.textContent    = num;
      chip.dataset.shelfId = shelf.id;
      chip.dataset.numIdx  = idx;
      if (!shelf.locked && !isAnimating) {
        if (getControlMode() === 'click') {
          chip.addEventListener('click', onChipClick);
          if (getClickSelected()
              && getClickSelected().fromShelf === shelf.id
              && getClickSelected().numIdx    === idx) {
            chip.classList.add('selected');
          }
        } else {
          chip.addEventListener('mousedown',  onMouseDown);
          chip.addEventListener('touchstart', onTouchStart, { passive: false });
        }
      }
      row.appendChild(chip);
    });

    if (!shelf.locked && !isAnimating) {
      if (getControlMode() === 'click') {
        el.addEventListener('click', () => onShelfClickForMove(shelf.id));
      } else {
        el.addEventListener('mouseenter', () => { if (getDragState()) el.classList.add('drag-over'); });
        el.addEventListener('mouseleave', () => el.classList.remove('drag-over'));
      }
    }
  });

  if (page) page.scrollTop = scrollTop;
  updateLiveStars();
}
