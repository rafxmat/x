// drag.js — Sürükle-bırak sistemi

let _dragState     = null;
let _ghostEl       = null;
let _clickSelected = null; // { fromShelf, numIdx } — tıkla modu için
let _dropHandler   = null; // game.js tarafından initGame'de set edilir

// rAF throttle için
let _rafPending  = false;
let _pendingX    = 0;
let _pendingY    = 0;

// touch drag-over takibi — querySelectorAll'ı önler
let _lastDragOverEl = null;

function getDragState()        { return _dragState; }
function clearDragState()      { _dragState = null; }
function getClickSelected()    { return _clickSelected; }
function clearClickSelected()  { _clickSelected = null; }
function setDropHandler(fn)    { _dropHandler = fn; }

/* ── Tıkla: chip seç ── */
function onChipClick(e) {
  e.stopPropagation();
  const chip      = e.currentTarget;
  const fromShelf = parseInt(chip.dataset.shelfId);
  const numIdx    = parseInt(chip.dataset.numIdx);

  if (_clickSelected && _clickSelected.fromShelf === fromShelf && _clickSelected.numIdx === numIdx) {
    _clickSelected = null;
    render(true);
    return;
  }

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
  const zone = vh * 0.2;

  let speed = 0;
  if (clientY > vh - zone) {
    speed = Math.round(((clientY - (vh - zone)) / zone) * 12);
  } else if (clientY < zone) {
    speed = -Math.round(((zone - clientY) / zone) * 12);
  }

  if (speed === 0) return;

  function step() {
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

    // querySelectorAll yerine: önceki elementi temizle, yenisini bul
    const hit = document.elementFromPoint(t.clientX, t.clientY)?.closest?.('.shelf:not(.locked)') || null;
    if (hit !== _lastDragOverEl) {
      _lastDragOverEl?.classList.remove('drag-over');
      hit?.classList.add('drag-over');
      _lastDragOverEl = hit;
    }
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
  // transform'u hemen ayarla (left/top değil)
  _ghostEl.style.transform = `translate(${x - 22}px, ${y - 16}px) scale(1.12) rotate(2deg)`;
}

/* Ghost'u transform ile taşı — rAF ile throttle edilir */
function moveGhost(x, y) {
  if (!_ghostEl) return;
  _pendingX = x;
  _pendingY = y;
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => {
    _rafPending = false;
    if (!_ghostEl) return;
    _ghostEl.style.transform = `translate(${_pendingX - 22}px, ${_pendingY - 16}px) scale(1.12) rotate(2deg)`;
  });
}

function killGhost() {
  if (_ghostEl) { _ghostEl.remove(); _ghostEl = null; }
  _rafPending = false;
  // drag-over sadece takip ettiğimiz elementten kaldırılır
  _lastDragOverEl?.classList.remove('drag-over');
  _lastDragOverEl = null;
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
