import type { Entry, IconRule } from './types';
import { esc } from './utils';

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

export function icoCustom(label: string, color: string): string {
  const lbl = String(label || '?').slice(0, 4);
  const safe = lbl.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<svg width="16" height="18" viewBox="0 0 16 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 0.5h8l5.5 5.5V17a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V1A.5.5 0 0 1 2 0.5z" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1.1"/>
    <path d="M10 0.5L15.5 6H10z" fill="${color}" fill-opacity="0.75"/>
    <text x="8" y="14.5" text-anchor="middle" font-family="'SF Mono',Menlo,Consolas,monospace" font-size="4.5" font-weight="700" fill="${color}">${safe}</text>
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

/** Place icons used in the sidebar */
export const PI: Record<string, string> = {
  root:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1 5h12" stroke="currentColor" stroke-width="1.3"/><circle cx="3.5" cy="3.5" r=".9" fill="currentColor"/><circle cx="5.8" cy="3.5" r=".9" fill="currentColor"/><path d="M3 13h8M7 11v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  home:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 7L7 2l6 5v6H9.5V9.5h-5V13H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  desk:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1.5" width="12" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 12.5h5M7 9.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  docs:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3.5 1h5l3 3v9h-8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8.5 1v3.5H11.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h4M5 9h4M5 11h2.5" stroke="currentColor" stroke-width="1" stroke-linecap="round"/></svg>`,
  down:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1v9M4 7.5l3 3.5 3-3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  code:   `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M4.5 4.5L2 7l2.5 2.5M9.5 4.5L12 7l-2.5 2.5M8 3l-2 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pics:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="4.5" cy="5.5" r="1.2" fill="currentColor" opacity=".7"/><path d="M1 10l3.5-3.5L7 9l2.5-2.5L13 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  apps:   `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="1" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="1" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/><rect x="7.8" y="7.8" width="5.2" height="5.2" rx="1" fill="currentColor" opacity=".5"/></svg>`,
  folder: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 3.5a.8.8 0 0 1 .8-.8h3l1.4 1.5H13.2a.8.8 0 0 1 .8.8V11a.8.8 0 0 1-.8.8H1.8A.8.8 0 0 1 1 11z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
  scrnsh: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="2" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 5.5l2.5 2.5L9 4.5M5 9.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bm:     `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h8v12l-4-3-4 3z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  drag:   `<svg width="10" height="14" viewBox="0 0 10 14"><circle cx="3" cy="3" r="1.2" fill="currentColor"/><circle cx="3" cy="7" r="1.2" fill="currentColor"/><circle cx="3" cy="11" r="1.2" fill="currentColor"/><circle cx="7" cy="3" r="1.2" fill="currentColor"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="7" cy="11" r="1.2" fill="currentColor"/></svg>`,
};
