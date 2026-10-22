// How bfb looks overall: dark, light, or following the system, and which app
// icon the tab (and an installed app window) shows.
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
