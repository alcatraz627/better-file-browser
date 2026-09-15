// The tab strip of one Chrome tab. State lives in sessionStorage, so it
// survives navigation and refresh in that Chrome tab and dies with it; a
// copy in chrome.storage.local, keyed by a per-tab session id, lets a fresh
// Chrome tab bring back a strip whose tab was closed in the last day.
// Mounted by the explorer and by the file page; the pure list operations
// are in tabs.ts.
import { esc, copyToClipboard } from './utils';
import { icoFile, icoFolder } from './icons';
import { getSaved, saveSaved } from './storage';
import { upsertPlace, removePlace } from './places';
import {
  EMPTY, openTab, closeTab, closeOthers, activate, togglePin, step, moveTab, labelFor, kindOf, insertTab, displayLabels,
  isTabState, normalize, pickRecovery, isStale, type TabState, type Tab, type RecoveryEntry,
} from './tabs';
import type { Toast } from './toast';

const SESSION_KEY = 'bfb-strip-v2';
const RECOVERY_PREFIX = 'bfb-strip-v2:';

export interface StripHost {
  el: HTMLElement;
  rawPath: string;
  toast: Toast;
  onSavedChange?: () => void;
}
export interface Strip {
  // True when the key was a strip key and has been handled.
  handleKey(e: KeyboardEvent): boolean;
  // Keep a path as a tab; in the background it does not become active.
  open(path: string, background?: boolean): void;
  // A bookmark's click: switch to the tab that already holds the path, or
  // keep a new one, then navigate there.
  go(path: string): void;
  state(): TabState;
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
  const activateHere = (s: TabState) => { const h = hereIn(s); return h ? activate(s, h.id) : s; };

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
    commit(insertTab(state, last.tab, last.index));
    toast(`Reopened ${last.tab.label}`);
  }
  function hrefFor(t: Tab): string { return 'file://' + t.path; }
  function goTab(id: string): void {
    const t = state.list.find(x => x.id === id);
    if (!t) return;
    commit(activate(state, id));
    if (t.path !== rawPath) location.href = hrefFor(t);
  }
  function closeHere(): void {
    const here = hereIn(state);
    if (!here) return;
    const next = closeTab(state, here.id);
    commit(next);
    const to = next.list.find(t => t.id === next.active);
    if (to && to.path !== rawPath) location.href = hrefFor(to);
  }
  function closeById(id: string): void {
    if (hereIn(state)?.id === id) closeHere();
    else commit(closeTab(state, id));
  }

  // ── Hover menu ────────────────────────────────────────────────────
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-tab-menu';
  menu.style.display = 'none';
  (el.closest('#fe') ?? document.body).appendChild(menu);
  const closeMenu = () => { menu.style.display = 'none'; };
  function openMenu(t: Tab, anchor: HTMLElement): void {
    const saved = getSaved().some(p => p.path === t.path);
    menu.innerHTML = [
      `<div class="fe-ctx-item" data-act="copy">Copy path</div>`,
      `<div class="fe-ctx-item" data-act="save">${saved ? 'Unsave' : 'Save'}</div>`,
      `<div class="fe-ctx-item" data-act="pin">${t.pinned ? 'Unpin' : 'Pin'}<span class="fe-ctx-key">p</span></div>`,
      `<div class="fe-ctx-sep"></div>`,
      `<div class="fe-ctx-item" data-act="close">Close<span class="fe-ctx-key">w</span></div>`,
      `<div class="fe-ctx-item" data-act="others">Close others</div>`,
    ].join('');
    menu.dataset.id = t.id;
    menu.style.display = 'block';
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + 'px';
    menu.style.top = r.bottom + 4 + 'px';
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
      const was = getSaved().some(p => p.path === t.path);
      saveSaved(was ? removePlace(getSaved(), t.path) : upsertPlace(getSaved(), { path: t.path, label: t.label }));
      host.onSavedChange?.();
      toast(was ? 'Removed from Saved' : 'Saved');
    }
    else if (act === 'pin') commit(togglePin(state, t.id));
    else if (act === 'close') closeById(t.id);
    else if (act === 'others') commit(closeOthers(state, t.id));
  });
  document.addEventListener('click', e => { if (menu.style.display !== 'none' && !menu.contains(e.target as Node)) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // ── Render ────────────────────────────────────────────────────────
  function tabHtml(t: Tab, i: number, on: boolean, label: string): string {
    const ico = t.kind === 'file'
      ? `<span class="fe-tab-ico">${icoFile(t.label.includes('.') ? t.label.split('.').pop()!.toLowerCase() : '')}</span>`
      : (t.pinned ? `<span class="fe-tab-ico">${icoFolder(t.label)}</span>` : '');
    const tip = `${t.path}\n${i < 9 ? `${i + 1} jumps · ` : ''}click switches · ${t.pinned ? 'pinned (p unpins)' : 'middle-click closes'} · drag reorders`;
    return `<a class="fe-tab${on ? ' on' : ''}${t.pinned ? ' pinned' : ''}" draggable="true" data-id="${esc(t.id)}" href="${esc(hrefFor(t))}" title="${esc(tip)}">
      ${ico}<span class="fe-tab-lbl">${esc(label)}</span>
      <button class="fe-tab-more" data-id="${esc(t.id)}" title="Copy path · save · pin · close others">…</button>
      ${t.pinned ? '' : `<button class="fe-tab-x" data-id="${esc(t.id)}" title="Close (w)">✕</button>`}
    </a>`;
  }
  function render(): void {
    const here = hereIn(state);
    const labels = displayLabels(state.list);
    const rows = state.list.map((t, i) => tabHtml(t, i, t.id === here?.id, labels[i]));
    if (!here) {
      const ico = kindOf(rawPath) === 'file' ? `<span class="fe-tab-ico">${icoFile(labelFor(rawPath).split('.').pop()!.toLowerCase())}</span>` : '';
      rows.push(`<a class="fe-tab on temp" data-id="" href="file://${esc(rawPath)}" title="Not kept yet · t or double-click keeps · p pins">${ico}<span class="fe-tab-lbl">${esc(labelFor(rawPath))}</span></a>`);
    }
    if (state.list.length > 1) rows.push(`<button class="fe-tab-list" title="All tabs">⌄</button>`);
    el.innerHTML = rows.join('');
    el.classList.toggle('empty', state.list.length === 0);
    el.querySelector<HTMLElement>('.fe-tab.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    el.querySelector<HTMLElement>('.fe-tab-list')?.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      menu.innerHTML = state.list.map((t, i) => `<div class="fe-ctx-item" data-go="${esc(t.id)}">${esc(labels[i])}</div>`).join('');
      menu.dataset.id = '';
      menu.style.display = 'block';
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + 'px';
      menu.style.top = r.bottom + 4 + 'px';
    });
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

  // ── Load, or recover ──────────────────────────────────────────────
  async function recover(): Promise<void> {
    const all = await readRecoveries();
    const now = Date.now();
    const area = storageArea();
    for (const [k, e] of Object.entries(all)) if (isStale(e, now)) { try { area?.remove(RECOVERY_PREFIX + k, () => void chrome.runtime.lastError); } catch { /* gone */ } delete all[k]; }
    const pick = pickRecovery(all, now);
    if (!pick) return;
    const old = all[pick];
    try { area?.remove(RECOVERY_PREFIX + pick, () => void chrome.runtime.lastError); } catch { /* gone */ }
    commit(activateHere(old.state));
    const n = old.state.list.length;
    toast(`Restored ${n} tab${n === 1 ? '' : 's'}`, 6000, {
      label: 'undo',
      run: () => {
        commit(EMPTY);
        try { area?.set({ [RECOVERY_PREFIX + pick]: old }, () => void chrome.runtime.lastError); } catch { /* gone */ }
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
    void recover();
  }
  window.addEventListener('pagehide', () => writeRecovery(sid, state, true));

  return {
    handleKey,
    open: (path, background = false) => commit(openTab(state, path, background)),
    go: path => { commit(openTab(state, path)); if (path !== rawPath) location.href = 'file://' + path; },
    state: () => state,
  };
}
