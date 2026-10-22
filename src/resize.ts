// One way to resize anything: drag a handle, or focus it and press the
// arrows, and double-click to go back to the natural size. The sidebar, the
// preview's edge and corner, and the listing's columns all use it, so they
// look and answer alike (docs/system/resize.md).

export interface ResizeSpec {
  /** Which way the handle moves: x for a vertical edge, xy for a corner. */
  axis: 'x' | 'xy';
  /** The size when a drag or key press starts. */
  size(): { w: number; h: number };
  /** Show a new size; called on every pointer move and key press. */
  apply(w: number, h: number): void;
  /** Keep the size once a drag or key press is done. */
  commit?(): void;
  /** Double-click: back to the natural size. */
  reset?(): void;
  /** -1 for a handle on the left edge, where dragging left grows the box. */
  dir?: 1 | -1;
  /** What a screen reader calls the handle. */
  label: string;
}

/// A drag that follows the pointer until it lets go, with the resize cursor
/// held on the page meanwhile. Shared by handles and by column edges, which
/// start a drag from any cell.
export function startDrag(e: PointerEvent, cursor: string, move: (dx: number, dy: number) => void, end: () => void): void {
  e.preventDefault();
  const x0 = e.clientX, y0 = e.clientY;
  const target = e.target as Element;
  try { target.setPointerCapture?.(e.pointerId); } catch { /* the pointer is gone */ }
  document.body.style.cursor = cursor;
  document.body.classList.add('fe-resizing');
  const onMove = (ev: PointerEvent) => move(ev.clientX - x0, ev.clientY - y0);
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    document.body.style.cursor = '';
    document.body.classList.remove('fe-resizing');
    end();
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

/// Wire a handle element: class rz, a separator for assistive tech, one Tab
/// stop, arrows (Shift for a bigger step), drag, and double-click to reset.
export function resizable(handle: HTMLElement, s: ResizeSpec): void {
  const dir = s.dir ?? 1;
  handle.classList.add('rz');
  handle.dataset.axis = s.axis;
  handle.tabIndex = 0;
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', s.label);
  const cursor = s.axis === 'xy' ? 'nwse-resize' : 'col-resize';
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { w, h } = s.size();
    handle.classList.add('drag');
    startDrag(e, cursor, (dx, dy) => s.apply(w + dx * dir, h + dy), () => { handle.classList.remove('drag'); s.commit?.(); });
  });
  handle.addEventListener('click', e => e.stopPropagation());
  handle.addEventListener('dblclick', e => { e.stopPropagation(); s.reset?.(); s.commit?.(); });
  handle.addEventListener('keydown', e => {
    const step = e.shiftKey ? 64 : 16;
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    const dy = s.axis === 'xy' ? (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0) : 0;
    if (!dx && !dy) return;
    e.preventDefault(); e.stopPropagation();
    const { w, h } = s.size();
    s.apply(w + dx * dir, h + dy);
    s.commit?.();
  });
}
