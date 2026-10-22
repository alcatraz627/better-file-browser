// How bfb looks overall: dark, light, or following the system, which app
// icon the tab (and an installed app window) shows, and the fonts.
import { THEME_KEY, choicePref, textPref } from './storage';

export type ThemeMode = 'dark' | 'light' | 'system';

const themePref = choicePref<ThemeMode>(THEME_KEY, ['dark', 'light', 'system'], 'dark');
export function themeMode(): ThemeMode {
  return themePref.get();
}
const systemDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? (systemDark() ? 'dark' : 'light') : mode;
}

/// Set the mode, paint the page with what it resolves to, and remember it.
export function setThemeMode(fe: HTMLElement, mode: ThemeMode, save = true): void {
  fe.dataset.mode = mode;
  fe.dataset.theme = resolveTheme(mode);
  if (save) themePref.set(mode);
}

/// In System mode the page follows the OS as it switches between dark and light.
export function followSystem(fe: HTMLElement): void {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (fe.dataset.mode === 'system') fe.dataset.theme = resolveTheme('system');
  });
}

export interface AppIcon { id: string; file: string; name: string }
// The list mirrors assets/app-icons/index.json; the first is the original.
export const APP_ICONS: AppIcon[] = [
  { id: 'classic', file: '01-classic.svg', name: 'Classic' },
  { id: 'stack', file: '02-stack.svg', name: 'Stack' },
  { id: 'tree', file: '03-tree.svg', name: 'Tree' },
  { id: 'lens', file: '04-lens.svg', name: 'Lens' },
  { id: 'panes', file: '05-panes.svg', name: 'Panes' },
  { id: 'map', file: '06-map.svg', name: 'Map' },
  { id: 'drawer', file: '07-drawer.svg', name: 'Drawer' },
  { id: 'tabs', file: '08-tabs.svg', name: 'Tabs' },
  { id: 'fan', file: '09-fan.svg', name: 'Fan' },
  { id: 'prompt', file: '10-prompt.svg', name: 'Prompt' },
  { id: 'orbit', file: '11-orbit.svg', name: 'Orbit' },
  { id: 'sprout', file: '12-sprout.svg', name: 'Sprout' },
  { id: 'grid', file: '13-grid.svg', name: 'Grid' },
  { id: 'starred', file: '14-starred.svg', name: 'Starred' },
  { id: 'mono-b', file: '15-mono-b.svg', name: 'Mono B' },
  { id: 'outline', file: '16-outline.svg', name: 'Outline' },
  { id: 'vault', file: '17-vault.svg', name: 'Vault' },
  { id: 'compass', file: '18-compass.svg', name: 'Compass' },
  { id: 'shelf', file: '19-shelf.svg', name: 'Shelf' },
  { id: 'pages', file: '20-pages.svg', name: 'Pages' },
  { id: 'hex', file: '21-hex.svg', name: 'Hex' },
  { id: 'sunset', file: '22-sunset.svg', name: 'Sunset' },
  { id: 'pixel', file: '23-pixel.svg', name: 'Pixel' },
  { id: 'neon', file: '24-neon.svg', name: 'Neon' },
];
/** Which app icon the tab shows, by id. */
export const appIconPref = textPref('bfb-app-icon', 'classic');
export function appIconUrl(id = appIconPref.get()): string {
  const icon = APP_ICONS.find(i => i.id === id) ?? APP_ICONS[0];
  return chrome.runtime.getURL(`assets/app-icons/${icon.file}`);
}
/// Show an app icon in the tab now and remember it for every page.
export function setAppIcon(id: string): void {
  appIconPref.set(id);
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = appIconUrl(id);
  try { void chrome.runtime.sendMessage({ type: 'bfb-app-icon', id }); } catch { /* no worker in tests */ }
}

// Fonts a page on this Mac can draw: the system's own, faces macOS ships, and
// ones installed in ~/Library/Fonts. A face that is missing on another Mac
// falls back to the system font.
export interface FontChoice { id: string; name: string; stack: string }
const SYS = "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif";
const font = (id: string, name: string, family: string, fallback = SYS): FontChoice => ({ id, name, stack: `${family},${fallback}` });
export const TEXT_FONTS: FontChoice[] = [
  { id: 'system', name: 'System', stack: SYS },
  font('inter', 'Inter', 'Inter'),
  font('manrope', 'Manrope', 'Manrope'),
  font('open-sans', 'Open Sans', "'Open Sans'"),
  font('avenir', 'Avenir Next', "'Avenir Next',Avenir"),
  font('helvetica', 'Helvetica Neue', "'Helvetica Neue',Helvetica"),
  font('rounded', 'SF Rounded', "'SF Pro Rounded'"),
  font('seravek', 'Seravek', 'Seravek'),
  font('charter', 'Charter', 'Charter', 'Georgia,serif'),
  font('iowan', 'Iowan Old Style', "'Iowan Old Style'", 'Georgia,serif'),
];
export const HEAD_FONTS: FontChoice[] = [
  { id: 'system', name: 'System', stack: SYS },
  font('inter', 'Inter', 'Inter'),
  font('montserrat', 'Montserrat', 'Montserrat'),
  font('avenir', 'Avenir Next', "'Avenir Next',Avenir"),
  font('futura', 'Futura', 'Futura'),
  font('rounded', 'SF Rounded', "'SF Pro Rounded'"),
  font('gill', 'Gill Sans', "'Gill Sans'"),
  font('editorial', 'Editorial', "'PP Editorial Old'", 'Georgia,serif'),
  font('charter', 'Charter', 'Charter', 'Georgia,serif'),
  font('baskerville', 'Baskerville', 'Baskerville', 'Georgia,serif'),
];
const MONO = 'Menlo,Consolas,monospace';
export const CODE_FONTS: FontChoice[] = [
  { id: 'system', name: 'System mono', stack: `'SF Mono',${MONO}` },
  font('jetbrains', 'JetBrains Mono', "'JetBrains Mono'", MONO),
  font('fira', 'Fira Code', "'Fira Code'", MONO),
  font('source', 'Source Code Pro', "'Source Code Pro'", MONO),
  font('google', 'Google Sans Code', "'Google Sans Code'", MONO),
];
export const fontPrefs = {
  text: textPref('bfb-font-text', 'system'),
  head: textPref('bfb-font-head', 'system'),
  code: textPref('bfb-font-code', 'system'),
};
const FONT_LISTS = { text: TEXT_FONTS, head: HEAD_FONTS, code: CODE_FONTS };
const FONT_VARS = { text: '--font-text', head: '--font-head', code: '--mono' };
/// Draw the page in the remembered fonts.
export function applyFonts(fe: HTMLElement): void {
  for (const k of ['text', 'head', 'code'] as const) {
    const list = FONT_LISTS[k];
    fe.style.setProperty(FONT_VARS[k], (list.find(f => f.id === fontPrefs[k].get()) ?? list[0]).stack);
  }
}
