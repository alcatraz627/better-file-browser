// The tab strip of one Chrome tab. State lives in sessionStorage, so it
// survives navigation and refresh in that Chrome tab and dies with it; a
// copy in chrome.storage.local, keyed by a per-tab session id, lets a fresh
// Chrome tab bring back a strip whose tab was closed in the last day.
// Mounted by the explorer and by the file page; the pure list operations
// are in tabs.ts.
import { esc, copyToClipboard, pageHref } from './utils';
import { icoFile, icoFolder, PI } from './icons';
import { isSaved, toggleSaved } from './storage';
import { UI_ICON } from './control-icons';
import {
  EMPTY, openTab, closeTab, closeOthers, activate, togglePin, step, moveTab, labelFor, kindOf, insertTab, displayLabels, splitLabel,
  isTabState, normalize, isStale, type TabState, type Tab, type RecoveryEntry,
} from './tabs';
import type { Toast } from './toast';
import { openLayer, type Layer } from './layer';

const SESSION_KEY = 'bfb-strip-v2';
const RECOVERY_PREFIX = 'bfb-strip-v2:';

export interface StripHost {
  el: HTMLElement;
  rawPath: string;
  toast: Toast;
  onSavedChange?: () => void;
  openInTerminal?: (folder: string) => void;
}
// The tabs of a Chrome tab that was closed, offered in Recent.
export interface ClosedSet { id: string; at: number; labels: string[] }
export interface Strip {
  // True when the key was a strip key and has been handled.
  handleKey(e: KeyboardEvent): boolean;
  // Keep a path as a tab; in the background it does not become active.
  open(path: string, background?: boolean): void;
  // A bookmark's click: switch to the tab that already holds the path, or
  // keep a new one, then navigate there.
  go(path: string, hash?: string): void;
  state(): TabState;
  closedSets(): Promise<ClosedSet[]>;
  // Add a closed set's tabs to this strip, with undo.
  restoreSet(id: string): Promise<void>;
  // Move a tab one place left or right, within its pinned or unpinned block.
  move(id: string, dir: 1 | -1): void;
}

const storageArea = () => (typeof chrome !== 'undefined' && chrome.storage?.local) || null;

interface Closed { tab: Tab; index: number }
function readSession(): { sid: string; state: TabState; closed: Closed[] } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return v && typeof v.sid === 'string' && isTabState(v.state)
      ? { sid: v.sid, state: normalize(v.state), closed: Array.isArray(v.closed) ? v.closed : [] }
      : null;
  } catch { return null; }
}
function writeSession(sid: string, state: TabState, closed: Closed[]): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sid, state, closed })); } catch { /* storage full or disabled */ }
}
function writeRecovery(sid: string, state: TabState, closed: boolean): void {
  const area = storageArea();
  if (!area) return;
  try {
    if (!state.list.length) area.remove(RECOVERY_PREFIX + sid, () => void chrome.runtime.lastError);
    else area.set({ [RECOVERY_PREFIX + sid]: { state, at: Date.now(), closed } satisfies RecoveryEntry }, () => void chrome.runtime.lastError);
  } catch { /* extension context gone */ }
}
function readRecoveries(): Promise<Record<string, RecoveryEntry>> {
  return new Promise(resolve => {
    const area = storageArea();
    if (!area) return resolve({});
    try {
      area.get(null, all => {
        const out: Record<string, RecoveryEntry> = {};
        for (const [k, v] of Object.entries(all || {})) {
          if (!k.startsWith(RECOVERY_PREFIX)) continue;
          const e = v as RecoveryEntry;
          if (e && isTabState(e.state) && typeof e.at === 'number') out[k.slice(RECOVERY_PREFIX.length)] = { state: normalize(e.state), at: e.at, closed: !!e.closed };
        }
        resolve(out);
      });
    } catch { resolve({}); }
  });
}

export function mountStrip(host: StripHost): Strip {
  const { el, rawPath, toast } = host;
  const hereIn = (s: TabState) => s.list.find(t => t.path === rawPath);
  // On load, point active at this page's tab; if the page has no tab (go-up to
  // a folder that was never kept), clear active so [ ] and the next insert
  // anchor on the page you are on, not a stale tab.
  const activateHere = (s: TabState) => { const h = hereIn(s); return h ? activate(s, h.id) : { ...s, active: null }; };

  let sid = '';
  let state: TabState = EMPTY;
  let closed: Closed[] = [];   // the reopen stack, newest last
  let drag: string | null = null;

  function commit(next: TabState): void {
    // Anything that left the list goes on the reopen stack with its place.
    state.list.forEach((t, i) => { if (!next.list.some(x => x.id === t.id)) closed.push({ tab: t, index: i }); });
    if (closed.length > 20) closed = closed.slice(-20);
    state = next;
    writeSession(sid, state, closed);
    writeRecovery(sid, state, false);
    render();
  }
  function reopenClosed(): void {
    const last = closed.pop();
    if (!last) return;
    writeSession(sid, state, closed);
    // Already open (reopened, then opened again by hand): switch to it rather
    // than toast a reopen that insertTab would silently drop as a duplicate.
    const open = state.list.find(t => t.path === last.tab.path);
    if (open) { goTab(open.id); return; }
    commit(insertTab(state, last.tab, last.index));
    toast(`Reopened ${last.tab.label}`);
  }
  // Encode each segment so a '#' or '?' in a filename is not read as a URL
  // fragment or query and lost.
  const fileUrl = (p: string) => 'file://' + p.split('/').map(encodeURIComponent).join('/');
  function hrefFor(t: Tab): string { return fileUrl(t.path); }
  // Switching away from a page that was never kept keeps it as a background
  // tab first, the same as a sidebar click, so the doc you were reading is
  // never lost by switching.
  function goTab(id: string): void {
    const t = state.list.find(x => x.id === id);
    if (!t) return;
    const s = t.path !== rawPath && rawPath && !hereIn(state) ? openTab(state, rawPath, true) : state;
    commit(activate(s, id));
    if (t.path !== rawPath) location.href = pageHref(hrefFor(t));
  }
  function closeHere(): void {
    const here = hereIn(state);
    if (!here) return;
    const next = closeTab(state, here.id);
    commit(next);
    const to = next.list.find(t => t.id === next.active);
    if (to && to.path !== rawPath) location.href = pageHref(hrefFor(to));
  }
  function closeById(id: string): void {
    if (hereIn(state)?.id === id) closeHere();
    else commit(closeTab(state, id));
  }

  // ── Hover menu ────────────────────────────────────────────────────
  const listBtn = document.getElementById('fe-tab-list');
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-tab-menu';
  let layer: Layer | null = null;
  const closeMenu = () => layer?.close('pick');
  // Right-click on any tab opens its menu; a pinned tab has no "…" button,
  // so this is how it reaches Copy path, Save, Unpin and Close others.
  el.addEventListener('contextmenu', e => {
    const a = (e.target as Element).closest<HTMLElement>('.fe-tab[data-id]');
    const t = a && state.list.find(x => x.id === a.dataset.id);
    if (!t) return;
    e.preventDefault();
    openMenu(t, a!);
  });
  function openMenu(t: Tab, anchor: HTMLElement): void {
    const saved = isSaved(t.path);
    menu.innerHTML = [
      `<div class="fe-ctx-item" data-act="copy">${UI_ICON.copy}<span>Copy path</span></div>`,
      `<div class="fe-ctx-item" data-act="save">${PI.bm}<span>${saved ? 'Unsave' : 'Save'}</span></div>`,
      host.openInTerminal ? `<div class="fe-ctx-item" data-act="term">${UI_ICON.terminal}<span>Open in terminal</span></div>` : '',
      `<div class="fe-ctx-item" data-act="pin">${UI_ICON.pin}<span>${t.pinned ? 'Unpin' : 'Pin'}</span><span class="fe-ctx-key">p</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="fe-ctx-item" data-act="close">${UI_ICON.close}<span>Close</span><span class="fe-ctx-key">w</span></div>`,
      `<div class="fe-ctx-item" data-act="others">${UI_ICON.stack}<span>Close others</span></div>`,
    ].join('');
    menu.dataset.id = t.id;
    layer = openLayer(menu, { kind: 'popover', anchor, role: 'menu', group: 'menu' });
  }
  menu.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fe-ctx-item');
    closeMenu();
    if (item?.dataset.go) { goTab(item.dataset.go); return; }
    const t = state.list.find(x => x.id === menu.dataset.id);
    if (!item || !t) return;
    const act = item.dataset.act;
    if (act === 'copy') void copyToClipboard(t.path).then(ok => toast(ok ? 'Copied path' : 'Copy failed'));
    else if (act === 'save') {
      const now = toggleSaved(t.path, t.label);
      host.onSavedChange?.();
      toast(now ? 'Saved' : 'Removed from Saved');
    }
    else if (act === 'term') host.openInTerminal?.(t.kind === 'file' ? t.path.replace(/\/[^/]*$/, '') || '/' : t.path);
    else if (act === 'pin') commit(togglePin(state, t.id));
    else if (act === 'close') closeById(t.id);
    else if (act === 'others') commit(closeOthers(state, t.id));
  });

  // ── Render ────────────────────────────────────────────────────────
  // A cut-off name keeps its start and any extension: the head is trimmed to
  // the room left and ends in an ellipsis, measured so no gap opens before
  // the extension (a CSS ellipsis stops a part-character short of the edge).
  function fitHeads(): void {
    for (const head of el.querySelectorAll<HTMLElement>('.fe-tab-head')) {
      const full = head.dataset.full ?? head.textContent ?? '';
      head.dataset.full = full;
      head.textContent = full;
      if (head.scrollWidth <= head.clientWidth) continue;
      let lo = 0, hi = full.length;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        head.textContent = full.slice(0, mid) + '…';
        if (head.scrollWidth <= head.clientWidth) lo = mid; else hi = mid - 1;
      }
      head.textContent = full.slice(0, lo).trimEnd() + '…';
    }
  }
  function lblHtml(label: string): string {
    const { head, tail } = splitLabel(label);
    return `<span class="fe-tab-lbl"><span class="fe-tab-head">${esc(head)}</span>${tail ? `<span class="fe-tab-tail">${esc(tail)}</span>` : ''}</span>`;
  }
  function tabHtml(t: Tab, i: number, on: boolean, label: string): string {
    const ico = t.kind === 'file'
      ? `<span class="fe-tab-ico">${icoFile(t.label.includes('.') ? t.label.split('.').pop()!.toLowerCase() : '')}</span>`
      : `<span class="fe-tab-ico">${icoFolder(t.label)}</span>`;
    const tip = `${t.path}\n${i < 9 ? `${i + 1} jumps · ` : ''}click switches · ${t.pinned ? 'pinned (p unpins, right-click for more)' : 'middle-click closes'} · drag reorders`;
    return `<a class="fe-tab${on ? ' on' : ''}${t.pinned ? ' pinned' : ''}"${on ? ' aria-current="page"' : ''} draggable="true" data-id="${esc(t.id)}" href="${esc(hrefFor(t))}" title="${esc(tip)}">
      ${ico}${lblHtml(label)}
      <button class="btn fe-tab-more" data-icon data-size="xs" data-id="${esc(t.id)}" title="Copy path · save · pin · close others">…</button>
      ${t.pinned ? '' : `<button class="btn fe-tab-x" data-icon data-size="xs" data-tone="danger" data-id="${esc(t.id)}" title="Close (w)">✕</button>`}
    </a>`;
  }
  function render(): void {
    const here = hereIn(state);
    const labels = displayLabels(state.list);
    const rows = state.list.map((t, i) => tabHtml(t, i, t.id === here?.id, labels[i]));
    if (!here) {
      const ico = kindOf(rawPath) === 'file' ? `<span class="fe-tab-ico">${icoFile(labelFor(rawPath).split('.').pop()!.toLowerCase())}</span>` : `<span class="fe-tab-ico">${icoFolder(labelFor(rawPath))}</span>`;
      rows.push(`<a class="fe-tab on temp" data-id="" href="${esc(fileUrl(rawPath))}" title="${esc(rawPath)}\nNot kept yet · t or double-click keeps · p pins">${ico}${lblHtml(labelFor(rawPath))}</a>`);
    }
    el.innerHTML = rows.join('');
    fitHeads();
    el.classList.toggle('empty', state.list.length === 0);
    el.querySelector<HTMLElement>('.fe-tab.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    if (listBtn) {
      listBtn.hidden = state.list.length < 2;
      listBtn.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        menu.innerHTML = state.list.map((t, i) => `<div class="fe-ctx-item${t.id === here?.id ? ' on' : ''}" data-go="${esc(t.id)}">`
          + `${t.kind === 'file' ? icoFile(t.label.includes('.') ? t.label.split('.').pop()!.toLowerCase() : '') : icoFolder(t.label)}<span>${esc(labels[i])}</span>${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}</div>`).join('');
        menu.dataset.id = '';
        layer = openLayer(menu, { kind: 'popover', anchor: listBtn, align: 'end', role: 'menu', group: 'menu' });
      };
    }
    el.querySelectorAll<HTMLElement>('.fe-tab').forEach(a => {
      a.addEventListener('click', e => {
        if ((e.target as HTMLElement).closest('button')) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;   // Chrome's own new-window gestures keep the anchor
        e.preventDefault();
        if (e.detail > 1) return;                            // a double-click is not two switches
        if (a.dataset.id) goTab(a.dataset.id);
      });
      a.addEventListener('dblclick', e => { e.preventDefault(); if (!a.dataset.id) commit(openTab(state, rawPath)); });
      a.addEventListener('auxclick', e => {
        if (e.button !== 1) return;
        e.preventDefault();                                  // middle click closes, as in Chrome's strip
        const t = state.list.find(x => x.id === a.dataset.id);
        if (t && !t.pinned) closeById(t.id);
      });
      a.addEventListener('dragstart', () => { drag = a.dataset.id || null; });
      a.addEventListener('dragover', e => { e.preventDefault(); a.classList.add('drag-over'); });
      a.addEventListener('dragleave', () => a.classList.remove('drag-over'));
      a.addEventListener('drop', e => {
        e.preventDefault(); a.classList.remove('drag-over');
        if (drag && a.dataset.id && drag !== a.dataset.id) commit(moveTab(state, drag, a.dataset.id));
        drag = null;
      });
    });
    el.querySelectorAll<HTMLElement>('.fe-tab-x').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); closeById(btn.dataset.id!); });
    });
    el.querySelectorAll<HTMLElement>('.fe-tab-more').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const t = state.list.find(x => x.id === btn.dataset.id);
        if (t) openMenu(t, btn);
      });
    });
  }

  // ── Keys ──────────────────────────────────────────────────────────
  function handleKey(e: KeyboardEvent): boolean {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    const here = hereIn(state);
    if (e.key === 't') { commit(openTab(state, rawPath)); return true; }
    if (e.key === 'w') { if (here && !here.pinned) closeHere(); return true; }
    if (e.key === 'T') { reopenClosed(); return true; }
    if (e.key === 'p') {
      const s = here ? state : openTab(state, rawPath);
      commit(togglePin(s, here?.id ?? s.active!));
      return true;
    }
    if (e.key === '[' || e.key === ']') {
      const t = step({ ...state, active: here?.id ?? null }, e.key === ']' ? 1 : -1);
      if (t) goTab(t.id);
      return true;
    }
    if (/^[1-9]$/.test(e.key)) {
      const t = state.list[parseInt(e.key) - 1];
      if (t) { goTab(t.id); return true; }
    }
    return false;
  }

  // ── Closed tab sets, restored only on request ─────────────────────
  // Tab sets of Chrome tabs closed in the last day, newest first. A set seen
  // closed for under 2.5s may be a live tab mid-navigation; the caller waits
  // until it is older before showing it.
  async function closedSets(): Promise<ClosedSet[]> {
    const all = await readRecoveries();
    const now = Date.now();
    const area = storageArea();
    for (const [k, e] of Object.entries(all)) if (isStale(e, now)) { try { area?.remove(RECOVERY_PREFIX + k, () => void chrome.runtime.lastError); } catch { /* gone */ } delete all[k]; }
    return Object.entries(all)
      .filter(([k, e]) => k !== sid && e.closed)
      .sort((a, b) => b[1].at - a[1].at)
      .map(([k, e]) => ({ id: k, at: e.at, labels: e.state.list.map(t => labelFor(t.path)) }));
  }
  async function restoreSet(id: string): Promise<void> {
    const old = (await readRecoveries())[id];
    if (!old) { toast('That tab set is gone'); return; }
    const area = storageArea();
    try { area?.remove(RECOVERY_PREFIX + id, () => void chrome.runtime.lastError); } catch { /* gone */ }
    // Merge, never replace: a tab kept while the re-read waited stays.
    let merged = old.state;
    for (const t of state.list) merged = insertTab(merged, t, merged.list.length);
    commit(activateHere(merged));
    const n = old.state.list.length;
    toast(`Restored ${n} tab${n === 1 ? '' : 's'}`, 6000, {
      label: 'undo',
      run: () => {
        // Remove only the restored tabs, so anything opened during the 6s
        // toast window survives; wiping to EMPTY dropped those too.
        let back = state;
        for (const t of old.state.list) back = closeTab(back, t.id);
        commit(back);
        try { area?.set({ [RECOVERY_PREFIX + id]: old }, () => void chrome.runtime.lastError); } catch { /* gone */ }
      },
    });
  }

  const stored = readSession();
  if (stored) {
    sid = stored.sid;
    closed = stored.closed;
    state = stored.state;
    commit(activateHere(stored.state));
  } else {
    sid = Math.random().toString(36).slice(2, 12);
    writeSession(sid, state, closed);
    render();
  }
  window.addEventListener('pagehide', () => writeRecovery(sid, state, true));

  return {
    handleKey,
    move(id, dir) {
      const i = state.list.findIndex(t => t.id === id);
      const to = state.list[i + dir];
      if (i >= 0 && to) commit(moveTab(state, id, to.id));
    },
    open: (path, background = false) => commit(openTab(state, path, background)),
    go: (path, hash = '') => {
      // Keep the current place: if this folder or file was only a temp tab,
      // insert it as a kept background tab before navigating away, so a sidebar
      // click adds the target and never drops the tab the user was on.
      let s = state;
      if (rawPath && !s.list.some(t => t.path === rawPath)) s = openTab(s, rawPath, true);
      commit(openTab(s, path));
      if (path !== rawPath) location.href = pageHref(fileUrl(path)) + hash;
      else if (hash) location.hash = hash;
    },
    state: () => state,
    closedSets,
    restoreSet,
  };
}
