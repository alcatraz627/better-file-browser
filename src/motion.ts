// Shared motion for the shell: the sidebar slides open and shut instead of
// popping, and anyone who asks the system for less motion gets the snap.
import { el } from './el';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let running: Animation | null = null;

// A fold still running, and the step that ends it, so a second click can
// land the first one before it measures.
const folding = new WeakMap<HTMLElement, { anim: Animation; end: () => void }>();
/// Fold or unfold a block (a sidebar section, a tag group, Pinned) with its
/// height easing between the two states. `flip` toggles the state and must
/// undo itself when called twice; it runs twice up front to measure the
/// target height, then once more for real: at the start when opening, at the
/// end when closing, so the contents stay visible while the block shrinks.
/// `done` runs once the new state is in place.
export function foldTo(box: HTMLElement, flip: () => void, done?: () => void): void {
  const prev = folding.get(box);
  if (prev) { prev.anim.cancel(); prev.end(); }
  if (reduced()) { flip(); done?.(); return; }
  const from = box.offsetHeight;
  flip();
  const to = box.offsetHeight;
  flip();
  const closing = to < from;
  if (!closing) flip();
  box.style.overflow = 'hidden';
  const anim = box.animate(
    [{ height: from + 'px', opacity: closing ? 1 : 0.4 }, { height: to + 'px', opacity: closing ? 0.4 : 1 }],
    { duration: 200, easing: EASE });
  const end = () => {
    folding.delete(box);
    box.style.overflow = '';
    if (closing) flip();
    done?.();
  };
  folding.set(box, { anim, end });
  anim.onfinish = () => { if (folding.get(box)?.anim === anim) end(); };
}

// Windows this wide fold the sidebar away to give the page room; narrower
// ones keep the lens rail, which opens the sidebar over the page.
export const FOLD_SIDE_QUERY = '(max-width: 960px) and (min-width: 521px)';

// Where the sidebar is headed, set the moment it is asked to move, so a
// second press during the slide reverses it rather than repeating it.
let wanted: boolean | null = null;

/** Whether the sidebar is showing, or on its way to showing. */
export function sidebarShown(): boolean {
  return wanted ?? el('fe-side').style.display !== 'none';
}

/// Show or hide the sidebar card and its resize gutter. The card's width
/// animates to and from zero, so the page beside it widens smoothly.
export function setSidebarShown(show: boolean): void {
  wanted = show;
  const side = el('fe-side'), rz = el('fe-side-rz');
  side.classList.remove('peek');   // a peek ends when the sidebar is shown or hidden for good
  running?.cancel();
  running = null;
  const shown = side.style.display !== 'none';
  if (show === shown) return;
  if (reduced()) { side.style.display = rz.style.display = show ? '' : 'none'; return; }
  if (show) side.style.display = rz.style.display = '';
  const w = side.offsetWidth;
  const open = [{ width: '0px', opacity: 0, marginRight: '-10px' }, { width: w + 'px', opacity: 1, marginRight: '0px' }];
  running = side.animate(show ? open : [...open].reverse(), { duration: 220, easing: EASE });
  running.onfinish = () => {
    running = null;
    if (!show) side.style.display = rz.style.display = 'none';
  };
}
