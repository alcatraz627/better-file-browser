import type { Bookmark, IconRule, Place, RecentDir, Settings, SortConfig, GroupMode, PreviewLayout } from './types';

export const BM_KEY        = 'bfb-bookmarks-v2';
export const RECENTS_KEY   = 'bfb-recents-v1';
export const COL_WIDTHS_KEY = 'bfb-col-widths-v1';
export const PLACES_KEY    = 'bfb-places-v1';
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
    const r = JSON.parse(localStorage.getItem(ICON_RULES_KEY) ?? 'null');
    return Array.isArray(r) && r.length > 0 ? r : DEFAULT_ICON_RULES.map(r => ({ ...r }));
  } catch { return DEFAULT_ICON_RULES.map(r => ({ ...r })); }
}
export function saveIconRules(r: IconRule[]): void {
  localStorage.setItem(ICON_RULES_KEY, JSON.stringify(r));
}

export function getSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getBM(): Bookmark[] {
  try { return JSON.parse(localStorage.getItem(BM_KEY) ?? '[]'); }
  catch { return []; }
}
export function saveBM(bm: Bookmark[]): void {
  localStorage.setItem(BM_KEY, JSON.stringify(bm));
}
export function toggleBM(path: string): Bookmark[] {
  const bm = getBM();
  const idx = bm.findIndex(b => b.path === path);
  if (idx >= 0) bm.splice(idx, 1);
  else bm.unshift({ path, label: path.split('/').filter(Boolean).pop() || '/' });
  saveBM(bm);
  return bm;
}

export function getRecents(): RecentDir[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]'); }
  catch { return []; }
}
export function pushRecent(path: string): void {
  const list = getRecents().filter(r => r.path !== path);
  list.unshift({ path, ts: Date.now() });
  localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 8)));
}

export function getPlaces(): Place[] {
  try { return JSON.parse(localStorage.getItem(PLACES_KEY) ?? '[]'); }
  catch { return []; }
}
export function savePlaces(p: Place[]): void {
  localStorage.setItem(PLACES_KEY, JSON.stringify(p));
}

export function getColWidths(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(COL_WIDTHS_KEY) ?? '{}'); }
  catch { return {}; }
}
export function saveColWidths(w: Record<string, number>): void {
  localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(w));
}

const SORT_COLS: SortConfig['col'][] = ['name', 'size', 'date', 'type', 'ext'];
const GROUP_MODES: GroupMode[] = ['none', 'folders-first', 'files-first', 'ext', 'type'];

// Sort and group are global, like view: the same order in every folder.
export function getSortConfig(): SortConfig {
  try {
    const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null');
    if (s && SORT_COLS.includes(s.col) && (s.dir === 'asc' || s.dir === 'desc')) return { col: s.col, dir: s.dir };
  } catch { /* fall through */ }
  return { col: null, dir: 'asc' };
}
export function saveSortConfig(s: SortConfig): void {
  localStorage.setItem(SORT_KEY, JSON.stringify(s));
}
export function getGroupMode(): GroupMode {
  const g = localStorage.getItem(GROUP_KEY) as GroupMode | null;
  return g && GROUP_MODES.includes(g) ? g : 'none';
}
export function saveGroupMode(g: GroupMode): void {
  localStorage.setItem(GROUP_KEY, g);
}

const px = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;

export function getPreviewLayout(): PreviewLayout {
  try {
    const l = JSON.parse(localStorage.getItem(PREVIEW_LAYOUT_KEY) ?? 'null');
    if (l && (l.mode === 'modal' || l.mode === 'side'))
      return { mode: l.mode, modalW: px(l.modalW), modalH: px(l.modalH), sideW: px(l.sideW) };
  } catch { /* fall through */ }
  return { mode: 'modal' };
}
export function savePreviewLayout(l: PreviewLayout): void {
  localStorage.setItem(PREVIEW_LAYOUT_KEY, JSON.stringify(l));
}

export function getView():       string  { return localStorage.getItem(VIEW_KEY)   ?? 'details'; }
export function getTheme():      string  { return localStorage.getItem(THEME_KEY)  ?? 'dark'; }
export function getZoom():       number  { const z = parseInt(localStorage.getItem(ZOOM_KEY) ?? '100'); return Number.isFinite(z) ? z : 100; }
export function getShowHidden(): boolean { return localStorage.getItem(HIDDEN_KEY) === 'true'; }
