// The file page's floating card (Contents or Comments) can be moved by its
// header and resized from its lower-left corner. Each pane keeps its own place
// and size; the reset button at the card's top right, shown once either was
// changed, puts it back where it docks by default.
import { jsonPref } from './storage';
import { resizable, startDrag } from './resize';
import { UI_ICON } from './control-icons';

/** Where a pane's card sits: right and top are distances from the page's edges. */
export interface RailBox { right?: number; top?: number; w?: number; h?: number }
type Tab = 'toc' | 'cm';

const boxPref = jsonPref<Partial<Record<Tab, RailBox>>>('bfb-rail-box-v1', {}, v => !!v && typeof v === 'object' && !Array.isArray(v));
const MIN_W = 240, MAX_W = 760, MIN_H = 160, EDGE = 8;

/** A box kept inside the page: never off an edge, never smaller than usable. */
export function clampBox(b: RailBox, page: { w: number; h: number }, card: { w: number; h: number }): RailBox {
  const out: RailBox = {};
  const w = b.w === undefined ? card.w : Math.round(Math.min(Math.max(MIN_W, b.w), MAX_W, page.w - 2 * EDGE));
  if (b.w !== undefined) out.w = w;
  const top = b.top === undefined ? undefined : Math.round(Math.min(Math.max(0, b.top), Math.max(0, page.h - MIN_H)));
  if (top !== undefined) out.top = top;
  if (b.h !== undefined) out.h = Math.round(Math.min(Math.max(MIN_H, b.h), page.h - (top ?? 12) - EDGE));
  if (b.right !== undefined) out.right = Math.round(Math.min(Math.max(0, b.right), Math.max(0, page.w - w)));
  return out;
}

export function wireRailBox(rail: HTMLElement, onChange: () => void): { placed: (t: Tab) => boolean; apply: () => void } {
  const head = rail.querySelector<HTMLElement>('.fe-toc-head')!;
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'btn fe-rail-reset';
  reset.dataset.icon = '';
  reset.dataset.size = 'xs';
  reset.title = 'Put the card back';
  reset.innerHTML = UI_ICON.reset;
  head.appendChild(reset);
  const grip = document.createElement('div');
  grip.className = 'fe-rail-rz';
  rail.appendChild(grip);

  const tab = (): Tab => rail.dataset.tab === 'cm' ? 'cm' : 'toc';
  const host = () => rail.offsetParent as HTMLElement | null;
  const pageSize = () => { const p = host(); return { w: p?.clientWidth ?? innerWidth, h: p?.clientHeight ?? innerHeight }; };
  const cardSize = () => ({ w: rail.offsetWidth, h: rail.offsetHeight });
  // The pane's saved box, and what a drag in progress shows before it is kept.
  let cur: RailBox = {};
  let shown: RailBox = {};
  const paintBox = (b: RailBox) => {
    shown = b;
    rail.style.right = b.right === undefined ? '' : `${b.right}px`;
    rail.style.top = b.top === undefined ? '' : `${b.top}px`;
    rail.style.width = b.w === undefined ? '' : `${b.w}px`;
    rail.style.height = b.h === undefined ? '' : `${b.h}px`;
    rail.style.maxHeight = b.h === undefined ? '' : 'none';
    reset.hidden = !Object.keys(b).length;
  };
  const apply = () => { cur = boxPref.get()[tab()] ?? {}; paintBox(clampBox(cur, pageSize(), cardSize())); };
  const keep = (b: RailBox) => { cur = b; boxPref.set({ ...boxPref.get(), [tab()]: b }); paintBox(b); onChange(); };

  // Moving: a press on the header, away from its buttons, carries the card.
  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (e.target as Element).closest('button, a, input, [role="tab"]')) return;
    const p = host()?.getBoundingClientRect(), r = rail.getBoundingClientRect();
    if (!p) return;
    const start = { right: p.right - r.right, top: r.top - p.top };
    rail.dataset.moving = '';
    startDrag(e, 'grabbing', (dx, dy) => paintBox(clampBox({ ...cur, right: start.right - dx, top: start.top + dy }, pageSize(), cardSize())),
      () => { delete rail.dataset.moving; keep(shown); });
  });
  // Resizing: the lower-left corner, since the card hangs from the right.
  resizable(grip, {
    axis: 'xy', dir: -1, label: 'Resize the card',
    size: () => cardSize(),
    apply: (w, h) => paintBox(clampBox({ ...cur, w, h }, pageSize(), cardSize())),
    commit: () => keep(shown),
    reset: () => keep({}),
  });
  reset.addEventListener('click', () => keep({}));

  return { placed: t => Object.keys(boxPref.get()[t] ?? {}).length > 0, apply };
}
