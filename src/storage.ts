import type { Bookmark, IconRule, Place, RecentDir, Settings, SortConfig, GroupMode, PreviewLayout, Tag } from './types';
import { dedupePlaces, mergeLegacy, reconcileTags, samePlace, upsertPlace, removePlace } from './places';
import { kvGet, kvSet, kvKeys, onKvChange } from './kv';

export const BM_KEY        = 'bfb-bookmarks-v2';
export const RECENTS_KEY   = 'bfb-recents-v1';
export const COL_WIDTHS_KEY = 'bfb-col-widths-v1';
export const PLACES_KEY    = 'bfb-places-v1';
export const SAVED_KEY     = 'bfb-saved-v1';
export const TAGS_KEY      = 'bfb-tags-v1';
export const VIEW_KEY      = 'bfb-view';
export const THEME_KEY     = 'bfb-theme';
export const PALETTE_KEY   = 'bfb-palette';
export const PALETTES      = ['slate', 'violet', 'sand', 'ink', 'ocean', 'forest', 'ember', 'nord',
  'mocha', 'solar', 'grove', 'velvet', 'coral', 'neon', 'matcha', 'plum'];
export const DENSITY_KEY   = 'bfb-density';
export const HIDDEN_KEY    = 'bfb-show-hidden';
export const ICON_RULES_KEY = 'bfb-icon-rules-v1';
export const SETTINGS_KEY  = 'bfb-settings-v1';
export const SORT_KEY      = 'bfb-sort-v1';
export const GROUP_KEY     = 'bfb-group-v1';
export const PREVIEW_LAYOUT_KEY = 'bfb-preview-layout-v1';

export const DEFAULT_ICON_RULES: IconRule[] = [
  { id: 'r1', pattern: '\\.claude$|^Claude', label: 'Cld', color: '#d97757', enabled: true },
  { id: 'r2', pattern: '\\.md$',             label: 'MD↓', color: '#4a9eff', enabled: true },
  { id: 'r3', pattern: '^\\.DS_Store$',      label: 'DS',  color: '#8b949e', enabled: true },
];

export const DEFAULT_SETTINGS: Settings = {
  compactMode: false,
  showSidebar: true,
  dateFormat:  'short',
  terminalApp: 'ghostty',
  terminalCmd: '',
  excludedFileExtensions: ['pdf', 'html', 'htm'],
};

export const TERMINAL_CMDS: Record<string, string> = {
  ghostty:  'open -a Ghostty "${p}"',
  terminal: 'open -a Terminal "${p}"',
  iterm:    'open -a iTerm "${p}"',
  wezterm:  'wezterm start --cwd "${p}"',
  kitty:    'kitty --directory "${p}"',
};

export function getIconRules(): IconRule[] {
  try {
    const r = JSON.parse(kvGet(ICON_RULES_KEY) ?? 'null');
    return Array.isArray(r) && r.length > 0 ? r : DEFAULT_ICON_RULES.map(r => ({ ...r }));
  } catch { return DEFAULT_ICON_RULES.map(r => ({ ...r })); }
}
export function saveIconRules(r: IconRule[]): void {
  kvSet(ICON_RULES_KEY, JSON.stringify(r));
}

// Each page, and each Chrome tab, reads the settings once and saves its copy
// later. A save writes only the keys this copy changed since it was read (or
// last saved), over what is stored now, so it cannot undo a change another
// copy made meanwhile. A copy this module did not hand out is written whole.
const readAs = new WeakMap<Settings, Record<string, string>>();
const snapshot = (s: Settings) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, JSON.stringify(v)]));
function storedSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(kvGet(SETTINGS_KEY) ?? '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function getSettings(): Settings {
  const s = storedSettings();
  readAs.set(s, snapshot(s));
  return s;
}
export function saveSettings(s: Settings): void {
  const was = readAs.get(s);
  let out: Settings = s;
  if (was) {
    out = storedSettings();
    const o = out as unknown as Record<string, unknown>, mine = s as unknown as Record<string, unknown>;
    for (const k of new Set([...Object.keys(was), ...Object.keys(s)])) {
      if (JSON.stringify(mine[k]) === was[k]) continue;
      if (mine[k] === undefined) delete o[k]; else o[k] = mine[k];
    }
    Object.assign(s, out);   // the copy now also holds what others saved
  }
  kvSet(SETTINGS_KEY, JSON.stringify(out));
  readAs.set(s, snapshot(s));
  syncHtmlGuard(out);
}

// The Settings choice: every text file, everything but markdown, or none.
export function filePagesEnabled(ext: string, settings: Settings): boolean {
  const mode = settings.renderFilePages || 'all';
  const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : ['pdf', 'html', 'htm'];
  return !(excluded.includes(ext.toLowerCase()) || mode === 'off' || (mode === 'not-md' && (ext === 'md' || ext === 'mdx')));
}

// An HTML file the explorer takes over must not run its own scripts first.
// loader.js decides that before Chrome parses the page, too early to read
// chrome.storage, so it reads this copy from localStorage instead. Chrome
// shares one localStorage across file:// pages; where it does not, the copy
// is missing and the page behaves as before.
export const HTML_GUARD_KEY = 'bfbHtmlTakeover';
// The same route carries the page's background colour, so the loader's cover
// matches the theme and palette in use.
export const PAGE_BG_KEY = 'bfbPageBg';
/** Kept per theme, with the theme choice, so a page following the system covers in the colour the system wants now.
 *  `shapes` are the shell's cards (sidebar, main pane) as insets from the window's edges, which the
 *  loader paints into the cover so the frame between two pages still shows the app's outline. */
export interface CoverShape { x: number; y: number; r: number; b: number; c: string }
export function keepPageBg(color: string, theme: string, mode: string, shapes: CoverShape[] = []): void {
  const t = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(`${PAGE_BG_KEY}-${t}`, color);
    localStorage.setItem(`${PAGE_BG_KEY}-mode`, mode);
    localStorage.setItem(`${PAGE_BG_KEY}-shapes-${t}`, JSON.stringify(shapes));
  } catch { /* storage blocked: the loader keeps its default */ }
}

// The Notes list as last drawn, read synchronously before the notes host
// answers so the next page shows it at once. It is drawn escaped and replaced
// by the host's answer, so a stale or tampered copy only shows for a moment.
const NOTES_KEPT = 'bfbNotesKept';
export function keptNotesList<T>(root: string): T[] | null {
  try { const k = JSON.parse(localStorage.getItem(NOTES_KEPT) || 'null'); return k?.root === root && Array.isArray(k.notes) ? k.notes : null; }
  catch { return null; }
}
export function keepNotesList<T>(root: string, notes: T[]): void {
  try { localStorage.setItem(NOTES_KEPT, JSON.stringify({ root, notes })); } catch { /* full or blocked: the next page waits for the host */ }
}
export function syncHtmlGuard(s: Settings): void {
  try { localStorage.setItem(HTML_GUARD_KEY, ['html', 'htm'].filter(x => filePagesEnabled(x, s)).join(' ')); }
  catch { /* storage blocked: the guard stays off */ }
}

function readList<T>(key: string): T[] {
  try { const v = JSON.parse(kvGet(key) ?? '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Saved folders. The first read after the merge builds the list from the two
// old keys, which stay in place untouched so nothing is lost if this rolls back.
export function getSaved(): Place[] {
  if (kvGet(SAVED_KEY) !== null) return dedupePlaces(readList<Place>(SAVED_KEY));
  const merged = mergeLegacy(readList<Bookmark>(BM_KEY), readList<Place>(PLACES_KEY));
  kvSet(SAVED_KEY, JSON.stringify(merged));
  return merged;
}
/// Whether a file or folder is in Saved.
export const isSaved = (path: string): boolean => getSaved().some(p => samePlace(p.path, path));
/// Saves a file or folder, or takes it out of Saved when it is there; true when it is now saved.
export function toggleSaved(path: string, label: string): boolean {
  const list = getSaved();
  const was = list.some(p => samePlace(p.path, path));
  saveSaved(was ? removePlace(list, path) : upsertPlace(list, { path, label }));
  return !was;
}
export function saveSaved(list: Place[]): void {
  list = dedupePlaces(list);
  kvSet(SAVED_KEY, JSON.stringify(list));
  kvSet(TAGS_KEY, JSON.stringify(reconcileTags(list, readList<Tag>(TAGS_KEY))));
}
export function getTags(): Tag[] {
  return reconcileTags(getSaved(), readList<Tag>(TAGS_KEY));
}
export function saveTags(tags: Tag[]): void {
  kvSet(TAGS_KEY, JSON.stringify(tags));
}

export function getRecents(): RecentDir[] {
  // A damaged entry is dropped rather than taking the whole page down with it.
  try {
    const list = JSON.parse(kvGet(RECENTS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(r => typeof r?.path === 'string') : [];
  } catch { return []; }
}
export function pushRecent(path: string): void {
  const list = getRecents().filter(r => r.path !== path);
  list.unshift({ path, ts: Date.now() });
  kvSet(RECENTS_KEY, JSON.stringify(list.slice(0, 40)));
}

// Your home folder, read from any page under /Users/<name> and remembered,
// so Places can offer Home, Desktop and the rest from a page outside it too.
const HOME_KEY = 'bfb-home-v1';
export function homeDir(path: string): string {
  const seen = path.match(/^\/Users\/[^/]+/)?.[0];
  if (seen && seen !== '/Users/Shared') {
    if (kvGet(HOME_KEY) !== seen) kvSet(HOME_KEY, seen);
    return seen;
  }
  return kvGet(HOME_KEY) ?? '';
}
// Saved tag groups the person folded, by tag name.
const FOLDED_KEY = 'bfb-saved-folded-v1';
export function getFoldedGroups(): Set<string> {
  try { return new Set(JSON.parse(kvGet(FOLDED_KEY) ?? '[]')); } catch { return new Set(); }
}
export function saveFoldedGroups(s: Set<string>): void { kvSet(FOLDED_KEY, JSON.stringify([...s])); }

/** Remember a home folder reported by the native host; returns whether it was taken. */
export function setHomeDir(home: string): boolean {
  if (!/^\/Users\/[^/]+$/.test(home) || home === '/Users/Shared') return false;
  kvSet(HOME_KEY, home);
  return true;
}

export function getColWidths(): Record<string, number> {
  try { return JSON.parse(kvGet(COL_WIDTHS_KEY) ?? '{}'); }
  catch { return {}; }
}
export function saveColWidths(w: Record<string, number>): void {
  kvSet(COL_WIDTHS_KEY, JSON.stringify(w));
}

const SORT_COLS: SortConfig['col'][] = ['name', 'size', 'date', 'type', 'ext'];
const GROUP_MODES: GroupMode[] = ['none', 'folders-first', 'files-first', 'ext', 'type'];

// Sort and group are global, like view: the same order in every folder.
export function getSortConfig(): SortConfig {
  try {
    const s = JSON.parse(kvGet(SORT_KEY) ?? 'null');
    if (s && SORT_COLS.includes(s.col) && (s.dir === 'asc' || s.dir === 'desc')) return { col: s.col, dir: s.dir };
  } catch { /* fall through */ }
  return { col: null, dir: 'asc' };
}
export function saveSortConfig(s: SortConfig): void {
  kvSet(SORT_KEY, JSON.stringify(s));
}
export function getGroupMode(): GroupMode {
  const g = kvGet(GROUP_KEY) as GroupMode | null;
  return g && GROUP_MODES.includes(g) ? g : 'none';
}
export function saveGroupMode(g: GroupMode): void {
  kvSet(GROUP_KEY, g);
}

const px = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;

export function getPreviewLayout(): PreviewLayout {
  try {
    const l = JSON.parse(kvGet(PREVIEW_LAYOUT_KEY) ?? 'null');
    if (l && (l.mode === 'modal' || l.mode === 'side'))
      return { mode: l.mode, modalW: px(l.modalW), modalH: px(l.modalH), sideW: px(l.sideW) };
  } catch { /* fall through */ }
  return { mode: 'modal' };
}
export function savePreviewLayout(l: PreviewLayout): void {
  kvSet(PREVIEW_LAYOUT_KEY, JSON.stringify(l));
}

export function getView():       string  { return viewPref.get(); }
export function getTheme():      string  { return kvGet(THEME_KEY)  ?? 'dark'; }
export function getPalette():    string  { return palettePref.get(); }
/// How much a folder shows, from 1 (few big items, names only) to 5 (small items, every detail).
export const DENSITY_NAMES = ['Overview', 'Large', 'Standard', 'Detailed', 'Full detail'];
export function getDensity():    number  { return densityPref.get(); }
export function getShowHidden(): boolean { return hiddenPref.get(); }

/** The size a floating panel was last left at ('md', 'lg' or 'xl'). */
export function getPanelSize(key: string): string {
  try { return kvGet(`bfb-panel-size:${key}`) || ''; } catch { return ''; }
}
export function savePanelSize(key: string, size: string): void {
  try { kvSet(`bfb-panel-size:${key}`, size); } catch { /* fine */ }
}

/** Where a dialog opens: as a window over the page, or in the sidebar. */
export function getDialogPlace(id: string): 'window' | 'side' {
  try { return kvGet(`bfb-dialog-place:${id}`) === 'side' ? 'side' : 'window'; } catch { return 'window'; }
}
export function saveDialogPlace(id: string, place: 'window' | 'side'): void {
  try { kvSet(`bfb-dialog-place:${id}`, place); } catch { /* fine */ }
}

// ── Remembered choices ──────────────────────────────────────────────────────
// Every other module reaches stored values through a Pref declared here, so
// the key, its default and how it is written sit in one place. A profile Pref
// lives in the shared store (every tab, every folder); a tab Pref lives in
// this tab's session only and is gone when the tab closes.

/** One remembered value: read it, change it, hear when another tab changes it. */
export interface Pref<T> { get(): T; set(v: T): void; onChange(fn: () => void): void }
type Where = 'profile' | 'tab';

function sessionGet(id: string): string | null { try { return sessionStorage.getItem(id); } catch { return null; } }
function sessionSet(id: string, v: string): void { try { sessionStorage.setItem(id, v); } catch { /* storage full or disabled */ } }

function makePref<T>(id: string, read: (raw: string | null) => T, write: (v: T) => string, where: Where = 'profile'): Pref<T> {
  const tab = where === 'tab';
  return {
    get: () => read(tab ? sessionGet(id) : kvGet(id)),
    set: v => { const s = write(v); if (tab) sessionSet(id, s); else kvSet(id, s); },
    onChange: fn => { if (!tab) onKvChange(k => { if (k === id) fn(); }); },
  };
}

/** A remembered word or line, `init` until something is saved. */
export const textPref = (id: string, init = '', where?: Where): Pref<string> =>
  makePref(id, r => r ?? init, v => v, where);

/** A remembered word from a fixed list; anything else reads as `init`. */
export const choicePref = <T extends string>(id: string, choices: readonly T[], init: T): Pref<T> =>
  makePref(id, r => (choices as readonly string[]).includes(r ?? '') ? r as T : init, v => v);

/** A remembered on or off, stored as `on` and `off` (kept as each key always wrote them). */
export const flagPref = (id: string, init: boolean, on = '1', off = '0'): Pref<boolean> =>
  makePref(id, r => r === on ? true : r === off ? false : init, v => v ? on : off);

/** A remembered list, map or record. `valid` turns away a damaged value, which then reads as `init`. */
export function jsonPref<T>(id: string, init: T, valid: (v: unknown) => boolean = () => true, where?: Where): Pref<T> {
  // A fresh copy each time, so a caller that changes what it read cannot change the default.
  const fresh = (): T => JSON.parse(JSON.stringify(init));
  return makePref(id, r => {
    if (r === null) return fresh();
    try { const v = JSON.parse(r); return valid(v) ? v as T : fresh(); } catch { return fresh(); }
  }, v => JSON.stringify(v), where);
}

/** A remembered whole number; one that is missing or fails `ok` reads as `init`. */
export const numberPref = (id: string, init: number, ok: (n: number) => boolean = Number.isFinite): Pref<number> =>
  makePref(id, r => { const n = parseInt(r ?? ''); return ok(n) ? n : init; }, v => String(v));

export const viewPref = textPref(VIEW_KEY, 'details');
export const palettePref = choicePref(PALETTE_KEY, PALETTES, 'slate');
export const densityPref = numberPref(DENSITY_KEY, 3, n => n >= 1 && n <= 5);
export const hiddenPref = flagPref(HIDDEN_KEY, false, 'true', 'false');
/** Whether a sorted listing keeps folders above files, with no group headers. */
export const dirsFirstPref = flagPref('bfb-dirs-first-v1', false);

/** A remembered set of names, such as which groups are folded. */
export const setPref = (id: string): Pref<Set<string>> =>
  makePref(id, r => {
    try { const v = JSON.parse(r || '[]'); return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []); }
    catch { return new Set(); }
  }, v => JSON.stringify([...v]));

/** Every stored setting, for Settings' export. Values that are JSON come out parsed. */
export function exportAll(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of kvKeys().sort()) { const raw = kvGet(k)!; try { out[k] = JSON.parse(raw); } catch { out[k] = raw; } }
  return out;
}

/** Write back an export; only the explorer's own keys are taken. Returns how many. */
export function importAll(data: Record<string, unknown>): number {
  let n = 0;
  for (const [k, val] of Object.entries(data)) if (k.startsWith('bfb-')) { kvSet(k, typeof val === 'string' ? val : JSON.stringify(val)); n++; }
  return n;
}
