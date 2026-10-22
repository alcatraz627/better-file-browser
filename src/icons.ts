import type { Entry, IconRule } from './types';
import { esc } from './utils';
import { line, LINE_ICON } from './control-icons';

export const EXT_COLORS: Record<string, string> = {
  js:'#f0db4f',mjs:'#f0db4f',cjs:'#f0db4f',
  ts:'#3178c6',tsx:'#61dafb',jsx:'#61dafb',
  html:'#e34c26',htm:'#e34c26',xml:'#e06c75',vue:'#42b883',svelte:'#ff3e00',
  css:'#264de4',scss:'#cc6699',less:'#1d365d',
  json:'#00b894',yaml:'#cc2936',yml:'#cc2936',toml:'#9c4221',
  md:'#a8b4c1',mdx:'#a8b4c1',txt:'#c0c8d0',rst:'#c0c8d0',
  py:'#3776ab',rb:'#cc342d',go:'#00add8',rs:'#dea584',
  java:'#ed8b00',kt:'#7f52ff',swift:'#f05138',dart:'#0175c2',
  sh:'#4eaa25',bash:'#4eaa25',zsh:'#4eaa25',fish:'#4eaa25',
  c:'#a8b9cc',cpp:'#00599c',h:'#a8b9cc',cs:'#239120',php:'#777bb4',r:'#276dc2',
  sql:'#e38d13',db:'#e38d13',sqlite:'#e38d13',
  pdf:'#e44c38',
  png:'#9b59b6',jpg:'#9b59b6',jpeg:'#9b59b6',gif:'#9b59b6',
  svg:'#ff9900',webp:'#9b59b6',ico:'#9b59b6',avif:'#9b59b6',
  mp4:'#e74c3c',mov:'#e74c3c',avi:'#e74c3c',mkv:'#e74c3c',webm:'#e74c3c',
  mp3:'#e67e22',wav:'#e67e22',flac:'#e67e22',ogg:'#e67e22',m4a:'#e67e22',
  zip:'#795548',tar:'#795548',gz:'#795548',rar:'#795548','7z':'#795548',
  env:'#ffd700',dockerfile:'#2496ed',lock:'#8b949e',
};

export const IMG_EXTS = new Set(['png','jpg','jpeg','gif','svg','webp','ico','avif','bmp']);

export const CHEVRON_RIGHT = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m4.5 2.5 3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const CHEVRON_DOWN = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 4.5 3.5 3 3.5-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const SPECIAL_FOLDERS = new Set([
  'Desktop','Documents','Downloads','Projects','Library',
  'Movies','Music','Pictures','Applications','Code','Public','Sites',
]);

export function icoFile(ext: string): string {
  const c = EXT_COLORS[ext.toLowerCase()] ?? '#6e7681';
  const lbl = ext.length <= 3 ? ext.toUpperCase() : ext.slice(0, 3).toUpperCase();
  return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}1a" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5v5.5h5.5" fill="none" stroke="${c}" stroke-width="1.1"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${lbl}</text>
  </svg>`;
}

export function icoFolder(name = ''): string {
  const special = SPECIAL_FOLDERS.has(name);
  const c = special ? '#e8a838' : '#4a9eff';
  const d = special ? '#c4882a' : '#2980d9';
  return `<svg width="18" height="15" viewBox="0 0 18 15" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.5 3.8A.8.8 0 0 1 1.3 3h3.9l1.7 2H17.2a.8.8 0 0 1 .8.8V13.2a.8.8 0 0 1-.8.8H1.3a.8.8 0 0 1-.8-.8z" fill="${c}"/>
    <path d="M0.5 3.8A.8.8 0 0 1 1.3 3h3.9l1.7 2H17.2a.8.8 0 0 1 .8.8V13.2a.8.8 0 0 1-.8.8H1.3a.8.8 0 0 1-.8-.8z" fill="none" stroke="${d}" stroke-width=".6"/>
  </svg>`;
}

export function icoParent(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 3.5L5 8l4 4.5M5 8h9" fill="none" stroke="#6e7681" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/** A color safe to drop into SVG attributes: hex or a bare CSS keyword, else a default. */
export function safeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^[a-zA-Z]{1,20}$/.test(color) ? color : '#6e7681';
}

// Small pictures an icon rule can show in place of its text badge, on the
// same 24-unit outline grid as every other icon.
export const RULE_GLYPHS: Record<string, string> = {
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3-3a2 2 0 0 0-3 0L6 21"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  test: '<path d="M9 2v6L4 18a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3L15 8V2M8 2h8M7 14h10"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  bug: '<rect width="8" height="14" x="8" y="6" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  video: '<rect width="14" height="12" x="2" y="6" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  chart: '<path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  branch: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="8" r="3"/><path d="M6 9v6M18 11a6 6 0 0 1-6 6H9"/>',
  bot: '<rect width="16" height="12" x="4" y="8" rx="2"/><path d="M12 8V4H8M2 14h2M20 14h2M15 13v2M9 13v2"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
};

/** A file icon for an icon rule: a picture when the rule has one, else its badge text. */
export function icoCustom(label: string, color: string, glyph?: string): string {
  const c = safeColor(color);
  const sheet = `<path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${c}" fill-opacity="0.75"/>`;
  if (glyph && RULE_GLYPHS[glyph]) {
    return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">${sheet}
    <svg x="3" y="7" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${RULE_GLYPHS[glyph]}</svg></svg>`;
  }
  const lbl = String(label || '?').slice(0, 4);
  const safe = lbl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">${sheet}
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${safe}</text>
  </svg>`;
}

export function getIcon(e: Entry, iconRules: IconRule[] | null): string {
  if (e.isParent) return icoParent();
  if (iconRules) {
    for (const rule of iconRules) {
      if (!rule.enabled) continue;
      try {
        if (new RegExp(rule.pattern, 'i').test(e.name)) return icoCustom(rule.label, rule.color, rule.glyph);
      } catch { /* invalid regex — skip */ }
    }
  }
  if (e.isDir) return icoFolder(e.name);
  const ext = e.name.includes('.') ? e.name.split('.').pop()! : '';
  return icoFile(ext || '—');
}

/** Place icons used in the sidebar, from the shared outline family. */
export const PI: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LINE_ICON).map(([k, body]) => [k, line(body)])),
  drag:   `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`,
};
