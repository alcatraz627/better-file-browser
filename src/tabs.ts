// The working set of folders: a tab strip shared by every explorer window.
// Pure list operations here; main.ts keeps the record in chrome.storage.local
// so other windows see changes through storage.onChanged.
export interface Tab { id: string; path: string; label: string }
export interface TabState { list: Tab[]; active: string | null }

export const EMPTY: TabState = { list: [], active: null };

export function labelFor(path: string): string {
  return path.split('/').filter(Boolean).pop() || '/';
}

const newId = () => Math.random().toString(36).slice(2, 10);

// Open a tab for a folder. A tab for the same folder already open becomes
// active instead of being duplicated.
export function openTab(s: TabState, path: string): TabState {
  const found = s.list.find(t => t.path === path);
  if (found) return { ...s, active: found.id };
  const tab = { id: newId(), path, label: labelFor(path) };
  const i = s.list.findIndex(t => t.id === s.active);
  const list = [...s.list];
  list.splice(i < 0 ? list.length : i + 1, 0, tab);
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

export function activate(s: TabState, id: string): TabState {
  return s.list.some(t => t.id === id) ? { ...s, active: id } : s;
}

// Step to the neighbouring tab, wrapping at the ends.
export function step(s: TabState, dir: 1 | -1): Tab | null {
  if (!s.list.length) return null;
  const i = s.list.findIndex(t => t.id === s.active);
  const j = i < 0 ? (dir > 0 ? 0 : s.list.length - 1) : (i + dir + s.list.length) % s.list.length;
  return s.list[j];
}

export function moveTab(s: TabState, id: string, toId: string): TabState {
  const from = s.list.findIndex(t => t.id === id), to = s.list.findIndex(t => t.id === toId);
  if (from < 0 || to < 0 || from === to) return s;
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
