// drag.js — Sürükle-bırak sistemi

let _dragState     = null;
let _ghostEl       = null;
let _clickSelected = null; // { fromShelf, numIdx } — tıkla modu için
let _dropHandler   = null; // game.js tarafından initGame'de set edilir

function getDragState()        { return _dragState; }
function clearDragState()      { _dragState = null; }
function getClickSelected()    { return _clickSelected; }
function clearClickSelected()  { _clickSelected = null; }
function setDropHandler(fn)    { _dropHandler = fn; }

/* ── Tıkla: chip seç ── */
function onChipClick(e) {
  e.stopPropagation(); // raf click handler'ını tetikleme
  const chip      = e.currentTarget;
  const fromShelf = parseInt(chip.dataset.shelfId);
  const numIdx    = parseInt(chip.dataset.numIdx);

  // Aynı chip'e tekrar basılırsa seçimi kaldır
  if (_clickSelected && _clickSelected.fromShelf === fromShelf && _clickSelected.numIdx === numIdx) {
    _clickSelected = null;
    render(true);
    return;
  }

  // Farklı chip → seç
  sndPickup();
  _clickSelected = { fromShelf, numIdx };
  render(true);
}

/* ── Tıkla: rafa bırak ── */
function onShelfClickForMove(shelfId) {
  if (!_clickSelected) return;
  const { fromShelf, numIdx } = _clickSelected;
  _clickSelected = null;

  if (fromShelf === shelfId) { render(true); return; }

  // game.js'in dropOnShelf'ini kayıtlı handler üzerinden çağır
  _dragState = { fromShelf, numIdx };
  _dropHandler?.(shelfId);
}

/* ── Mouse ── */
function onMouseDown(e) {
  e.preventDefault();
  const chip = e.currentTarget;
  startDrag(chip, e.clientX, e.clientY);

  const onMove = ev => moveGhost(ev.clientX, ev.clientY);
  const onUp   = ev => { endDrag(ev.clientX, ev.clientY); cleanup(); };
  const onBlur = ()  => { cleanup(); killGhost(); _dragState = null; render(true); };
  const cleanup = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup',   onUp);
    window.removeEventListener('blur',      onBlur);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup',   onUp);
  window.addEventListener('blur',      onBlur);
}

/* ── Auto-scroll (touch sürükleme sırasında) ── */
let _scrollAF = null;

function startAutoScroll(clientY) {
  stopAutoScroll();
  const vh = window.innerHeight;
  const zone = vh * 0.2; // alt/üst %20 tetik bölgesi

  let speed = 0;
  if (clientY > vh - zone) {
    // Alta yakın: ne kadar yakınsa o kadar hızlı
    speed = Math.round(((clientY - (vh - zone)) / zone) * 12);
  } else if (clientY < zone) {
    // Üste yakın
    speed = -Math.round(((zone - clientY) / zone) * 12);
  }

  if (speed === 0) return;

  function step() {
    // Hem window hem de scroll container'ı (game-page) kaydır
    window.scrollBy(0, speed);
    const page = document.querySelector('.game-page');
    if (page) page.scrollTop += speed;
    _scrollAF = requestAnimationFrame(step);
  }
  _scrollAF = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (_scrollAF) { cancelAnimationFrame(_scrollAF); _scrollAF = null; }
}

/* ── Touch ── */
function onTouchStart(e) {
  e.preventDefault();
  const chip = e.currentTarget;
  const t = e.touches[0];
  startDrag(chip, t.clientX, t.clientY);

  const onMove = ev => {
    ev.preventDefault();
    const t = ev.touches[0];
    moveGhost(t.clientX, t.clientY);
    startAutoScroll(t.clientY);
    document.querySelectorAll('.shelf:not(.locked)').forEach(s => s.classList.remove('drag-over'));
    const hit = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('.shelf:not(.locked)');
    if (hit) hit.classList.add('drag-over');
  };
  const onEnd = ev => {
    stopAutoScroll();
    const t = ev.changedTouches[0];
    endDrag(t.clientX, t.clientY);
    window.removeEventListener('touchmove', onMove);
    window.removeEventListener('touchend',  onEnd);
  };
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend',  onEnd);
}

/* ── Core ── */
function startDrag(chip, x, y) {
  sndPickup();
  _dragState = {
    fromShelf: parseInt(chip.dataset.shelfId),
    numIdx:    parseInt(chip.dataset.numIdx),
    val:       parseInt(chip.textContent),
  };
  chip.classList.add('dragging');

  _ghostEl = document.createElement('div');
  _ghostEl.className = 'num-chip ghost';
  _ghostEl.textContent = _dragState.val;
  document.body.appendChild(_ghostEl);
  moveGhost(x, y);
}

function moveGhost(x, y) {
  if (!_ghostEl) return;
  _ghostEl.style.left = (x - 22) + 'px';
  _ghostEl.style.top  = (y - 16) + 'px';
}

function killGhost() {
  if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
  document.querySelectorAll('.shelf').forEach(s => s.classList.remove('drag-over'));
  document.querySelectorAll('.num-chip.dragging').forEach(c => c.classList.remove('dragging'));
}

function endDrag(x, y) {
  killGhost();
  const els    = document.elementsFromPoint(x, y);
  const target = els.map(el => el.closest?.('.shelf')).find(Boolean) || null;

  if (target && _dragState && !target.classList.contains('locked')) {
    _dropHandler?.(parseInt(target.dataset.shelfId));
  } else {
    _dragState = null;
    render(true);
  }
}
