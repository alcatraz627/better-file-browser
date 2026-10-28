// Mermaid diagrams in bfb, drawn by the same viewer gcc pages use
// (src/vendor/diagram-lab.js, copied from ~/.claude by `npm run sync:diagram`;
// edit it there, never here). The mermaid in the file is never changed: layout,
// direction, lines and moved boxes are view choices bfb remembers.
import './vendor/diagram-lab.js';
import LAB_CSS from './vendor/diagram-lab.css';
import { UI_ICON } from './control-icons';

export interface LabTool { act: string; icon: string; title: string; label?: string; pressed?: boolean }
export interface LabOptions {
  src: string;
  name?: string;
  /** The markdown the diagram sits in: its tables and text path fill the side panel. */
  md?: string;
  /** That markdown file's URL, so the panel can link to the part of the doc it quotes. */
  file?: string;
  compact?: boolean;
  panel?: boolean;
  height?: string;
  expand?: boolean | ((o: LabOptions) => void);
  tools?: LabTool[];
  onTool?: (act: string, button: HTMLElement | null) => void;
  onError?: (e: unknown) => void;
  onReady?: (svg: SVGSVGElement | null) => void;
}
interface Lab { mount(el: HTMLElement, o: Record<string, unknown>): { fit(): void } }
const lab = () => (window as unknown as { MermaidLab: Lab }).MermaidLab;

// The viewer's colour names, read from bfb's palette so every palette and theme carries over.
const TOKENS = `.dl{--bg:var(--s1);--surface:var(--s2);--surface-2:var(--s3);--border:var(--bd);
  --text:var(--tx);--text-2:var(--mt);--text-3:var(--dm);--dim:var(--dm);--brand:var(--ac);--brand-content:var(--tx-on-ac);
  --accent:var(--nc-orange);--radius-sm:var(--r-sm);--radius-md:10px;--shadow-sm:0 1px 2px rgb(var(--ink) / .14);
  --shadow-md:var(--pop-sh);--shadow-lg:var(--pop-sh);--p-neutral-950:#0b0d0f;--p-neutral-800:#2b3035;--p-neutral-50:#f7f8f9;
  --kit-sans:var(--font-text);--kit-mono:var(--mono)}`;
let styled = false;
function style(): void {
  if (styled) return;
  styled = true;
  const el = document.createElement('style');
  el.id = 'fe-diagram-lab-css';
  el.textContent = LAB_CSS + TOKENS;
  document.head.append(el);
}

// View choices (layout, flow, lines, moved boxes), kept in the extension's own
// storage, never the file:// localStorage any opened HTML file can write.
const VIEW_KEY = 'diagram-view-v1';
let prefs: Record<string, unknown> | null = null;
let prefsLoad: Promise<void> | null = null;
function loadPrefs(): Promise<void> {
  prefsLoad ??= chrome.storage.local.get(VIEW_KEY)
    .then(r => { prefs = (r[VIEW_KEY] as Record<string, unknown>) ?? {}; })
    .catch(() => { prefs = {}; });
  return prefsLoad;
}
// Moved boxes and a flipped direction belong to their diagram; every other
// choice (layout, lines, colour) follows the reader to the next one.
const own = (k: string) => k.startsWith('pos-') || k === 'dir';
const store = (key: string) => ({
  get: (k: string, d: unknown) => (own(k) ? prefs?.[`${key}:${k}`] : prefs?.[k]) ?? d,
  set: (k: string, v: unknown) => {
    if (!prefs) return;
    prefs[own(k) ? `${key}:${k}` : k] = v;
    void chrome.storage.local.set({ [VIEW_KEY]: prefs }).catch(() => {});
  },
});

// A diagram seen before draws without loading mermaid: its parsed steps and
// drawing are kept, the 60 newest of them.
const CACHE_KEY = 'diagram-cache-v2';
const cache = {
  async get(k: string): Promise<unknown> {
    try { return ((await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] ?? {})[k] ?? null; } catch { return null; }
  },
  set(k: string, v: unknown): void {
    if (typeof v === 'string' && v.length > 300_000) return;
    void chrome.storage.local.get(CACHE_KEY).then(r => {
      const all: Record<string, unknown> = r[CACHE_KEY] ?? {};
      delete all[k];
      all[k] = v;
      const keys = Object.keys(all);
      for (const old of keys.slice(0, Math.max(0, keys.length - 60))) delete all[old];
      return chrome.storage.local.set({ [CACHE_KEY]: all });
    }).catch(() => { /* extension reloaded or storage full: draw it next time */ });
  },
};

const loadMermaid = async () => (await import(chrome.runtime.getURL('vendor-mermaid.js')) as typeof import('./mermaid-runtime')).default;
const hashOf = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); };

/** Draw a mermaid diagram into `el` with the full viewer, or its compact form inside a document. */
export async function mountDiagram(el: HTMLElement, o: LabOptions): Promise<void> {
  style();
  await loadPrefs();
  if (!el.isConnected) return;
  const key = hashOf(o.src);
  lab().mount(el, {
    ...o, key, store: store(key), cache, mermaid: loadMermaid,
    themeHost: document.getElementById('fe') ?? document.documentElement,
  });
}

export const SOURCE_TOOL: LabTool = { act: 'source', icon: UI_ICON.fmtCode, title: 'Show the mermaid source', pressed: false };
