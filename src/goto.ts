// Going straight to a path: the tab strip's path button opens a small box to
// paste or type a file or folder path, with recent places offered as you
// type. The box keeps what was last typed in it, like a scratch pad, and a
// click anywhere else closes it.
import { esc, fileHref, pageHref } from './utils';
import { getRecents } from './storage';
import { kvGet, kvSet } from './kv';

const LAST_KEY = 'bfb-goto-last-v1';

/** The address for a typed or pasted path: `~` is home, a file:// URL is kept,
 *  quotes and a trailing newline from a copied path are dropped. Null when it
 *  is not an absolute path. */
export function pathToHref(input: string, home: string): string | null {
  let p = input.trim().replace(/^['"]|['"]$/g, '');
  if (!p) return null;
  if (/^file:\/\//i.test(p)) { try { p = decodeURIComponent(new URL(p).pathname); } catch { return null; } }
  if (p === '~' || p.startsWith('~/')) { if (!home) return null; p = home + p.slice(1); }
  if (!p.startsWith('/')) return null;
  return pageHref(fileHref(p));
}

export function mountGoto(btn: HTMLElement, home: () => string): void {
  let box: HTMLElement | null = null;
  const close = () => {
    if (!box) return;
    kvSet(LAST_KEY, box.querySelector('input')!.value);
    box.remove(); box = null;
    document.removeEventListener('pointerdown', away, true);
    btn.classList.remove('on');
  };
  const away = (e: PointerEvent) => { if (box && !box.contains(e.target as Node) && !btn.contains(e.target as Node)) close(); };
  const open = () => {
    box = document.createElement('form');
    box.id = 'fe-goto';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Go to a path');
    const recents = getRecents().slice(0, 30);
    box.innerHTML = `<input type="text" list="fe-goto-list" spellcheck="false" autocomplete="off" placeholder="Path to a file or folder" aria-label="Path to a file or folder">
      <datalist id="fe-goto-list">${recents.map(r => `<option value="${esc(r.path)}"></option>`).join('')}</datalist>
      <p class="fe-goto-msg" hidden></p>`;
    document.getElementById('fe')!.appendChild(box);
    const r = btn.getBoundingClientRect();
    box.style.top = `${r.bottom + 6}px`;
    box.style.left = `${Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8))}px`;
    const input = box.querySelector('input')!;
    input.value = kvGet(LAST_KEY) ?? '';
    input.focus(); input.select();
    btn.classList.add('on');
    box.addEventListener('submit', e => {
      e.preventDefault();
      const href = pathToHref(input.value, home());
      if (!href) {
        const msg = box!.querySelector<HTMLElement>('.fe-goto-msg')!;
        msg.hidden = false; msg.textContent = 'Paste a full path, such as ~/Code or /Users/you/notes.md';
        return;
      }
      kvSet(LAST_KEY, input.value);
      location.href = href;
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.focus(); } });
    input.addEventListener('input', () => kvSet(LAST_KEY, input.value));
    document.addEventListener('pointerdown', away, true);
  };
  btn.addEventListener('click', e => { e.preventDefault(); if (box) close(); else open(); });
}
