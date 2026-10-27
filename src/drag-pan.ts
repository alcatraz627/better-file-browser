// Holding a key (Shift unless Settings says otherwise) over a reading surface
// turns the pointer into a hand: dragging then scrolls whatever is under it,
// a wide table or a long code line sideways, the page up and down. Controls,
// links, fields and the comments keep their own pointer and clicks.
import { getSettings } from './storage';

const SURFACES = '#fe-page, #fe-ql-body, #fe-ed-view';
const NOT_HERE = 'input, textarea, select, button, a, label, [contenteditable="true"], [role="toolbar"], #fe-cm, #fe-toc-rail, .fe-md-copy';

export type PanKey = 'Shift' | 'Alt' | 'Meta' | 'off';
const held = (e: KeyboardEvent | PointerEvent | MouseEvent, k: PanKey) =>
  k === 'Shift' ? e.shiftKey : k === 'Alt' ? e.altKey : k === 'Meta' ? e.metaKey : false;

/** The surface the pointer is over, when a drag there should scroll; null over controls and comments. */
function surfaceAt(t: EventTarget | null): HTMLElement | null {
  const el = t instanceof Element ? t : null;
  if (!el || el.closest(NOT_HERE)) return null;
  return el.closest<HTMLElement>(SURFACES);
}

/** The nearest element from `start` up to `root` that can scroll along one axis. */
function scroller(start: Element, root: HTMLElement, axis: 'x' | 'y'): HTMLElement | null {
  for (let n: Element | null = start; n; n = n.parentElement) {
    const e = n as HTMLElement, cs = getComputedStyle(e);
    const over = axis === 'x' ? cs.overflowX : cs.overflowY;
    const room = axis === 'x' ? e.scrollWidth > e.clientWidth + 1 : e.scrollHeight > e.clientHeight + 1;
    if (room && (over === 'auto' || over === 'scroll')) return e;
    if (n === root) break;
  }
  return null;
}

export function initDragPan(): void {
  const doc = document.documentElement;
  let marked: HTMLElement | null = null;
  let drag: { id: number; x: number; y: number; ex: HTMLElement | null; ey: HTMLElement | null; left: number; top: number } | null = null;
  const key = (): PanKey => (getSettings().panKey as PanKey | undefined) ?? 'Shift';
  // The hand shows on the surface under the pointer while the key is held; it is read from each pointer move.
  const mark = (root: HTMLElement | null) => {
    if (root === marked) return;
    marked?.removeAttribute('data-pan-on');
    marked = root;
    marked?.setAttribute('data-pan-on', '');
  };

  document.addEventListener('pointermove', e => {
    if (drag && e.pointerId === drag.id) {
      if (drag.ex) drag.ex.scrollLeft = drag.left - (e.clientX - drag.x);
      if (drag.ey) drag.ey.scrollTop = drag.top - (e.clientY - drag.y);
      return;
    }
    mark(held(e, key()) ? surfaceAt(e.target) : null);
  }, { passive: true });
  document.addEventListener('keyup', e => { if (e.key === key()) mark(null); });
  window.addEventListener('blur', () => mark(null));

  // A press on the app, not the document: it is a drag, never an outside click.
  const app = document.getElementById('fe') ?? document.body;
  app.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !held(e, key())) return;
    const root = surfaceAt(e.target);
    if (!root) return;
    const start = e.target as Element;
    const ex = scroller(start, root, 'x'), ey = scroller(start, root, 'y');
    if (!ex && !ey) return;
    e.preventDefault();   // no text selection, no Shift-click extending one
    getSelection()?.removeAllRanges();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ex, ey, left: ex?.scrollLeft ?? 0, top: ey?.scrollTop ?? 0 };
    doc.setAttribute('data-pan', 'grabbing');
    start.setPointerCapture?.(e.pointerId);
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    doc.removeAttribute('data-pan');
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}
