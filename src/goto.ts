// Going straight to a path: the tab strip's path button opens a small box to
// paste or type a file or folder path, with recent places offered as you
// type. The box keeps what was last typed in it, like a scratch pad, and a
// click anywhere else closes it.
import { esc, fileHref, pageHref } from './utils';
import { getRecents, textPref } from './storage';
import { fetchFileText } from './file-fetch';
import { parseListing } from './parse';
import { openLayer, type Layer } from './layer';

const lastPref = textPref('bfb-goto-last-v1');

/** The address for a typed or pasted path: `~` is home, a file:// URL is kept,
 *  quotes and a trailing newline from a copied path are dropped. Null when it
 *  is not an absolute path. */
export function pathToHref(input: string, home: string): string | null {
  const p = absPath(input, home);
  return p ? pageHref(fileHref(p)) : null;
}

/** The absolute path a typed or pasted entry names, or null (see pathToHref). */
export function absPath(input: string, home: string): string | null {
  let p = input.trim().replace(/^['"]|['"]$/g, '');
  if (!p) return null;
  if (/^file:\/\//i.test(p)) { try { p = decodeURIComponent(new URL(p).pathname); } catch { return null; } }
  if (p === '~' || p.startsWith('~/')) { if (!home) return null; p = home + p.slice(1); }
  return p.startsWith('/') ? p.replace(/\/{2,}/g, '/') : null;
}

/** Whether the browser can list a folder (a path ending in /); a file always
 *  counts. A folder that exists but cannot be read would throw the tab out to
 *  Chrome's error page, so it is refused before going there. */
export async function readable(path: string, waitMs = 9000): Promise<boolean> {
  if (!path.endsWith('/')) return true;
  // Reading a folder the browser has no permission for never answers, so
  // silence counts as unreadable; the wait is long enough for a folder with
  // a hundred thousand files to list.
  const timeout = new Promise<boolean>(r => setTimeout(() => r(false), waitMs));
  const read = fetchFileText(fileHref(path)).then(() => true, () => false);
  return Promise.race([read, timeout]);
}

/** The path as the strip names it (a folder ends in /), or null when nothing
 *  is there. Read from the parent folder's listing, so a large file is never
 *  read. When the parent cannot be listed, the folders above it are checked
 *  instead: a missing ancestor means nothing is there, and an unreadable but
 *  real one keeps the path as typed, since "nothing there" is only said after
 *  looking. */
export async function resolvePath(path: string): Promise<string | null> {
  const clean = path.replace(/\/+$/, '');
  if (!clean) return '/';
  const parent = clean.slice(0, clean.lastIndexOf('/') + 1) || '/';
  const name = clean.slice(clean.lastIndexOf('/') + 1);
  let listing: string;
  const dir = fileHref(parent);
  try { listing = await fetchFileText(dir); } catch {
    if (parent === '/') return path;
    return (await resolvePath(parent)) === null ? null : path;
  }
  const hit = parseListing(listing, dir).find(e => e.name === name);
  return hit ? clean + (hit.isDir ? '/' : '') : null;
}

// Go to's submit while it is open; ⌥↩ calls it with background set.
let submitOpen: ((background: boolean) => void) | null = null;

/// Open what is typed in Go to as a tab kept in the background. False when Go to is closed.
export function gotoBackground(): boolean {
  if (!submitOpen) return false;
  submitOpen(true);
  return true;
}

export function mountGoto(btn: HTMLElement, home: () => string, go: (path: string, background: boolean) => void): void {
  let box: HTMLElement | null = null;
  let layer: Layer | null = null;
  const close = () => layer?.close('api');
  const open = () => {
    box = document.createElement('form');
    box.id = 'fe-goto';
    const recents = getRecents().slice(0, 30);
    box.innerHTML = `<input class="tb" data-size="lg" type="text" list="fe-goto-list" spellcheck="false" autocomplete="off" placeholder="Path to a file or folder" aria-label="Path to a file or folder">
      <datalist id="fe-goto-list">${recents.map(r => `<option value="${esc(r.path)}"></option>`).join('')}</datalist>
      <p class="fe-goto-msg" hidden></p>`;
    const form = box;
    const input = box.querySelector('input')!;
    input.value = lastPref.get();
    // A click away or Esc closes it and keeps what was typed for next time.
    layer = openLayer(box, { kind: 'popover', anchor: btn, offset: 6, role: 'dialog', label: 'Go to a path', focus: input,
      onClose: () => { lastPref.set(input.value); if (box === form) { box = null; submitOpen = null; } btn.classList.remove('on'); } });
    if (!layer.open) { box = null; return; }
    input.select();
    btn.classList.add('on');
    const say = (text: string) => { const msg = box!.querySelector<HTMLElement>('.fe-goto-msg')!; msg.hidden = false; msg.textContent = text; };
    const submit = async (background: boolean) => {
      const path = absPath(input.value, home());
      if (!path) { say('Paste a full path, such as ~/Code or /Users/you/notes.md'); return; }
      lastPref.set(input.value);
      const found = await resolvePath(path);
      if (!found) { say(`Nothing at ${path}. Check the spelling, or pick a recent place below.`); return; }
      const slow = setTimeout(() => say('Checking that folder…'), 600);
      const ok = await readable(found);
      clearTimeout(slow);
      if (!ok) { say(`The browser could not open ${found}. It may not have permission to read that folder.`); return; }
      close();
      go(found, background);
    };
    submitOpen = background => void submit(background);
    box.addEventListener('submit', e => { e.preventDefault(); void submit(false); });
    input.addEventListener('input', () => lastPref.set(input.value));
  };
  btn.addEventListener('click', e => { e.preventDefault(); if (box) close(); else open(); });
}
