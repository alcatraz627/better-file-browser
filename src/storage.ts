import type { Bookmark, IconRule, Place, RecentDir, Settings, SortConfig, GroupMode, PreviewLayout, Tag } from './types';
import { mergeLegacy, reconcileTags } from './places';
import { kvGet, kvSet } from './kv';

export const BM_KEY        = 'bfb-bookmarks-v2';
export const RECENTS_KEY   = 'bfb-recents-v1';
export const COL_WIDTHS_KEY = 'bfb-col-widths-v1';
export const PLACES_KEY    = 'bfb-places-v1';
export const SAVED_KEY     = 'bfb-saved-v1';
export const TAGS_KEY      = 'bfb-tags-v1';
export const VIEW_KEY      = 'bfb-view';
export const THEME_KEY     = 'bfb-theme';
export const ZOOM_KEY      = 'bfb-zoom';
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

export function getSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(kvGet(SETTINGS_KEY) ?? '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings): void {
  kvSet(SETTINGS_KEY, JSON.stringify(s));
}

function readList<T>(key: string): T[] {
  try { const v = JSON.parse(kvGet(key) ?? '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Saved folders. The first read after the merge builds the list from the two
// old keys, which stay in place untouched so nothing is lost if this rolls back.
export function getSaved(): Place[] {
  if (kvGet(SAVED_KEY) !== null) return readList<Place>(SAVED_KEY);
  const merged = mergeLegacy(readList<Bookmark>(BM_KEY), readList<Place>(PLACES_KEY));
  kvSet(SAVED_KEY, JSON.stringify(merged));
  return merged;
}
export function saveSaved(list: Place[]): void {
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
  try { return JSON.parse(kvGet(RECENTS_KEY) ?? '[]'); }
  catch { return []; }
}
export function pushRecent(path: string): void {
  const list = getRecents().filter(r => r.path !== path);
  list.unshift({ path, ts: Date.now() });
  kvSet(RECENTS_KEY, JSON.stringify(list.slice(0, 20)));
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

export function getView():       string  { return kvGet(VIEW_KEY)   ?? 'details'; }
export function getTheme():      string  { return kvGet(THEME_KEY)  ?? 'dark'; }
export function getZoom():       number  { const z = parseInt(kvGet(ZOOM_KEY) ?? '100'); return Number.isFinite(z) ? z : 100; }
export function getShowHidden(): boolean { return kvGet(HIDDEN_KEY) === 'true'; }
