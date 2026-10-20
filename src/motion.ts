// Shared motion for the shell: the sidebar slides open and shut instead of
// popping, and anyone who asks the system for less motion gets the snap.
import { el } from './el';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let running: Animation | null = null;

/// Show or hide the sidebar card and its resize gutter. The card's width
/// animates to and from zero, so the page beside it widens smoothly.
export function setSidebarShown(show: boolean): void {
  const side = el('fe-side'), rz = el('fe-side-rz');
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
