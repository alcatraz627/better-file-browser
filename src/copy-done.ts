// Every copy control answers the same way: its icon turns into a green check
// for three seconds, whether it was clicked or its key was pressed, and a
// second copy restarts the three seconds. The check takes the icon's size, so
// nothing around it moves.
import { UI_ICON } from './control-icons';
import { copyToClipboard } from './utils';

const SHOWN_MS = 3000;
const held = new WeakMap<HTMLElement, { icon: string; timer: number }>();

function swapIcon(btn: HTMLElement, html: string): void {
  const old = btn.querySelector('svg');
  if (!old) return;
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const next = t.content.firstElementChild as SVGElement | null;
  if (!next) return;
  for (const a of ['width', 'height', 'class']) {
    const v = old.getAttribute(a);
    if (v !== null) next.setAttribute(a, v);
  }
  next.setAttribute('aria-hidden', 'true');
  old.replaceWith(next);
}

/** Show the copied check on a control. A control without an icon only turns green. */
export function flashCopied(btn: HTMLElement | null | undefined): void {
  if (!btn) return;
  let st = held.get(btn);
  if (!st) {
    st = { icon: btn.querySelector('svg')?.outerHTML ?? '', timer: 0 };
    held.set(btn, st);
    if (st.icon) swapIcon(btn, UI_ICON.check);
  }
  clearTimeout(st.timer);
  btn.dataset.done = '';
  const s = st;
  s.timer = window.setTimeout(() => {
    delete btn.dataset.done;
    if (s.icon) swapIcon(btn, s.icon);
    held.delete(btn);
  }, SHOWN_MS);
}

/** Copy text and show the check on the control that asked for it. Resolves to success. */
export async function copyWithCheck(btn: HTMLElement | null | undefined, text: string): Promise<boolean> {
  const ok = await copyToClipboard(text);
  if (ok) flashCopied(btn);
  return ok;
}
