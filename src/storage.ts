import type { Bookmark, IconRule, Settings } from './types';

export const BM_KEY        = 'bfb-bookmarks-v2';
export const VIEW_KEY      = 'bfb-view';
export const THEME_KEY     = 'bfb-theme';
export const ZOOM_KEY      = 'bfb-zoom';
export const HIDDEN_KEY    = 'bfb-show-hidden';
export const ICON_RULES_KEY = 'bfb-icon-rules-v1';
export const SETTINGS_KEY  = 'bfb-settings-v1';

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

export function getView():       string  { return localStorage.getItem(VIEW_KEY)   ?? 'details'; }
export function getTheme():      string  { return localStorage.getItem(THEME_KEY)  ?? 'dark'; }
export function getZoom():       number  { return parseInt(localStorage.getItem(ZOOM_KEY) ?? '100'); }
export function getShowHidden(): boolean { return localStorage.getItem(HIDDEN_KEY) === 'true'; }
