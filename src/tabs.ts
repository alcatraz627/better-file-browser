// The working set of one Chrome tab: a strip of folders and files. Pure
// list operations here; strip.ts keeps the record in sessionStorage with a
// recovery copy in chrome.storage.local.
export type TabKind = 'folder' | 'file';
export interface Tab { id: string; path: string; kind: TabKind; label: string; pinned: boolean }
export interface TabState { list: Tab[]; active: string | null }

export const EMPTY: TabState = { list: [], active: null };

export function labelFor(path: string): string {
  return path.split('/').filter(Boolean).pop() || '/';
}

// Folder paths carry a trailing slash, as location.pathname does for a listing.
export function kindOf(path: string): TabKind {
  return path.endsWith('/') ? 'folder' : 'file';
}

const newId = () => Math.random().toString(36).slice(2, 10);
const pinnedCount = (s: TabState) => s.list.filter(t => t.pinned).length;

// Open a tab for a path. A tab for the same path already open becomes
// active instead of being duplicated. New tabs land after the active one,
// never inside the pinned block.
export function openTab(s: TabState, path: string): TabState {
  const found = s.list.find(t => t.path === path);
  if (found) return { ...s, active: found.id };
  const tab: Tab = { id: newId(), path, kind: kindOf(path), label: labelFor(path), pinned: false };
  const i = s.list.findIndex(t => t.id === s.active);
  const list = [...s.list];
  list.splice(Math.max(i < 0 ? list.length : i + 1, pinnedCount(s)), 0, tab);
  return { list, active: tab.id };
}

export function closeTab(s: TabState, id: string): TabState {
  const i = s.list.findIndex(t => t.id === id);
  if (i < 0) return s;
  const list = s.list.filter(t => t.id !== id);
  let active = s.active;
  if (active === id) active = list[Math.min(i, list.length - 1)]?.id ?? null;
  return { list, active };
}

// Pinned tabs survive; so does the one named.
export function closeOthers(s: TabState, id: string): TabState {
  if (!s.list.some(t => t.id === id)) return s;
  const list = s.list.filter(t => t.pinned || t.id === id);
  return { list, active: list.some(t => t.id === s.active) ? s.active : id };
}

export function activate(s: TabState, id: string): TabState {
  return s.list.some(t => t.id === id) ? { ...s, active: id } : s;
}

// Pinning moves the tab to the end of the pinned block; unpinning drops it
// at the front of the rest.
export function togglePin(s: TabState, id: string): TabState {
  const t = s.list.find(x => x.id === id);
  if (!t) return s;
  const rest = s.list.filter(x => x.id !== id);
  const at = rest.filter(x => x.pinned).length;
  rest.splice(at, 0, { ...t, pinned: !t.pinned });
  return { ...s, list: rest };
}

// Step to the neighbouring tab, wrapping at the ends.
export function step(s: TabState, dir: 1 | -1): Tab | null {
  if (!s.list.length) return null;
  const i = s.list.findIndex(t => t.id === s.active);
  const j = i < 0 ? (dir > 0 ? 0 : s.list.length - 1) : (i + dir + s.list.length) % s.list.length;
  return s.list[j];
}

// Drag reorder within the pinned block or within the rest, never across.
export function moveTab(s: TabState, id: string, toId: string): TabState {
  const from = s.list.findIndex(t => t.id === id), to = s.list.findIndex(t => t.id === toId);
  if (from < 0 || to < 0 || from === to || s.list[from].pinned !== s.list[to].pinned) return s;
  const list = [...s.list];
  const [t] = list.splice(from, 1);
  list.splice(to, 0, t);
  return { ...s, list };
}

export function isTabState(v: unknown): v is TabState {
  const s = v as TabState;
  return !!s && Array.isArray(s.list) && s.list.every(t => t && typeof t.id === 'string' && typeof t.path === 'string')
    && (s.active === null || typeof s.active === 'string');
}

// Fill in what an older record lacks so every tab has a kind and a pin flag.
export function normalize(s: TabState): TabState {
  return { active: s.active, list: s.list.map(t => ({ ...t, kind: t.kind ?? kindOf(t.path), label: t.label ?? labelFor(t.path), pinned: !!t.pinned })) };
}

// A copy of a strip kept in chrome.storage.local so a closed Chrome tab can
// be brought back. closed is set on pagehide and cleared on the next load.
export interface RecoveryEntry { state: TabState; at: number; closed: boolean }

export const RECOVERY_MAX_AGE = 24 * 60 * 60 * 1000;

// The newest strip whose Chrome tab closed within the window; null when
// every candidate is live, empty or too old.
export function pickRecovery(entries: Record<string, RecoveryEntry>, now: number, maxAge = RECOVERY_MAX_AGE): string | null {
  let best: string | null = null;
  for (const [sid, e] of Object.entries(entries)) {
    if (!e.closed || !e.state.list.length || now - e.at > maxAge) continue;
    if (best === null || e.at > entries[best].at) best = sid;
  }
  return best;
}

export function isStale(e: RecoveryEntry, now: number, maxAge = RECOVERY_MAX_AGE): boolean {
  return now - e.at > maxAge || !e.state.list.length;
}
