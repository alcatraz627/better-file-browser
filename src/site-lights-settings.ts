// The saved Lights choices, shared by the engine on web pages and the Settings
// tab in bfb: a default mode for every site, and each site's own mode. Kept in
// chrome.storage.local so every tab and the background read the same thing.

export type LightsMode = 'off' | 'auto' | 'native' | 'smart' | 'invert';
export const LIGHTS_MODES: LightsMode[] = ['off', 'auto', 'native', 'smart', 'invert'];
export const LIGHTS_KEY = 'bfb-lights-v1';

export interface LightsSettings { default: LightsMode; sites: Record<string, LightsMode> }

/** Short names, the same in the page panel, the menu and Settings. */
export const MODE_LABEL: Record<LightsMode, string> = { off: 'Off', auto: 'Auto', native: 'Site', smart: 'Smart', invert: 'Invert' };
export const MODE_TIP: Record<LightsMode, string> = {
  off: 'Leave the site as it is',
  auto: 'Pick the best way for each page',
  native: 'Turn on the site\'s own dark theme',
  smart: 'Rewrite the site\'s colours, keep pictures',
  invert: 'Flip the whole page, flip pictures back',
};

export const isMode = (m: unknown): m is LightsMode => LIGHTS_MODES.includes(m as LightsMode);

/** Saved settings read safely: anything unrecognised falls back to off. */
export function readSettings(raw: unknown): LightsSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<LightsSettings>;
  const sites: Record<string, LightsMode> = {};
  for (const [h, m] of Object.entries(s.sites ?? {})) if (isMode(m)) sites[h] = m;
  return { default: isMode(s.default) ? s.default : 'off', sites };
}

/**
 * The host a person means by what they typed: "github.com", "https://github.com/x"
 * and "GitHub.com/" all give "github.com". Null for anything that is not a host.
 */
export function hostFrom(typed: string): string | null {
  const t = typed.trim().toLowerCase();
  if (!t) return null;
  try {
    const host = new URL(/^[a-z]+:\/\//.test(t) ? t : `https://${t}`).hostname;
    return /^[a-z0-9.-]{1,253}$/.test(host) && host.includes('.') || host === 'localhost' ? host : null;
  } catch {
    return null;
  }
}
