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

export function icoCustom(label: string, color: string): string {
  const lbl = String(label || '?').slice(0, 4);
  const safe = lbl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const c = safeColor(color);
  return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${c}" fill-opacity="0.12" stroke="${c}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${c}" fill-opacity="0.75"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${c}">${safe}</text>
  </svg>`;
}

export function getIcon(e: Entry, iconRules: IconRule[] | null): string {
  if (e.isParent) return icoParent();
  if (iconRules) {
    for (const rule of iconRules) {
      if (!rule.enabled) continue;
      try {
        if (new RegExp(rule.pattern, 'i').test(e.name)) return icoCustom(rule.label, rule.color);
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
