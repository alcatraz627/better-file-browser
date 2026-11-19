// The layer bfb draws on ordinary web pages: pins, comment badges, the note
// card and the page panel. It lives in a shadow root so the site's styles cannot
// reach it, and it carries data-bfb-overlay so Lights leaves it alone (and
// Invert flips it back).

import { line } from './control-icons';

export const ICON = {
  pin: line('<path d="M20 10c0 4.99-5.54 10.19-7.4 11.79a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', 16),
  comment: line('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', 16),
  moon: line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 16),
  sun: line('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>', 16),
  trash: line('<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>', 15),
  copy: line('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', 15),
  close: line('<path d="M18 6 6 18M6 6l12 12"/>', 16),
  globe: line('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>', 15),
  check: line('<path d="M20 6 9 17l-5-5"/>', 15),
  gear: line('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>', 16),
};

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --bg: #ffffff; --bg-2: #f4f4f5; --fg: #18181b; --fg-2: #52525b; --line: #e4e4e7;
  --accent: #b45309; --accent-bg: #fef3c7; --danger: #b91c1c; --shadow: 0 8px 28px rgba(0,0,0,.18), 0 1px 3px rgba(0,0,0,.12);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: var(--fg);
}
.root.dark {
  --bg: #1f1f23; --bg-2: #2a2a30; --fg: #ececee; --fg-2: #a1a1aa; --line: #3a3a42;
  --accent: #fbbf24; --accent-bg: #3b2f12; --danger: #f87171; --shadow: 0 8px 28px rgba(0,0,0,.55), 0 1px 3px rgba(0,0,0,.4);
}
.layer { position: absolute; top: 0; left: 0; width: 0; height: 0; }

button { font: inherit; color: inherit; cursor: pointer; }
.btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 7px;
  border: 1px solid var(--line); background: var(--bg); }
.btn:hover { background: var(--bg-2); }
.btn:focus-visible, .seg button:focus-visible, .icon-btn:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.btn.primary { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.btn.primary:hover { opacity: .9; }
.btn:disabled { opacity: .45; cursor: default; }
.icon-btn { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 7px; border: 0; background: transparent; color: var(--fg-2); }
.icon-btn:hover { background: var(--bg-2); color: var(--fg); }
.icon-btn.danger:hover { color: var(--danger); }

/* A pin on the page, its point at the spot it marks. */
.pin { position: absolute; width: 26px; height: 26px; margin: -24px 0 0 -13px; display: grid; place-items: center;
  border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: var(--accent); color: #fff; border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.35); cursor: grab; pointer-events: auto; }
.pin svg { transform: rotate(45deg); width: 13px; height: 13px; stroke-width: 2.4; }
.pin.dragging { cursor: grabbing; opacity: .85; }
.pin.flash, .badge.flash { animation: flash .9s ease-out 2; }
@keyframes flash { 50% { box-shadow: 0 0 0 8px rgba(251,191,36,.45); } }

/* A comment's badge, raised above the end of its first line so it covers no words. */
.badge { position: absolute; display: grid; place-items: center; width: 16px; height: 16px; margin: -11px 0 0 -5px; border-radius: 50%;
  background: var(--accent); color: #fff; border: 1.5px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,.3); cursor: pointer; pointer-events: auto; }
.badge svg { width: 9px; height: 9px; stroke-width: 2.6; }

.card { position: fixed; width: 300px; background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: var(--shadow); padding: 10px; pointer-events: auto; z-index: 2; }
.card .quote { margin: 0 0 8px; padding: 4px 8px; border-left: 3px solid var(--accent); background: var(--accent-bg); color: var(--fg);
  border-radius: 0 6px 6px 0; max-height: 4.5em; overflow: hidden; font-size: 12px; }
.card textarea { width: 100%; min-height: 64px; max-height: 240px; resize: vertical; font: inherit; color: var(--fg); background: var(--bg-2);
  border: 1px solid var(--line); border-radius: 7px; padding: 6px 8px; }
.card .row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
.card .when { color: var(--fg-2); font-size: 11px; margin-right: auto; }

.panel { position: fixed; top: 12px; right: 12px; bottom: 12px; width: 330px; display: flex; flex-direction: column;
  background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); pointer-events: auto; z-index: 3; }
.panel header { display: flex; align-items: center; gap: 8px; padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--line); }
.panel header h2 { margin: 0; font-size: 13px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.panel section { padding: 12px 14px; border-bottom: 1px solid var(--line); }
.panel section:last-child { border-bottom: 0; }
.panel h3 { margin: 0 0 8px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--fg-2);
  display: flex; align-items: center; gap: 6px; }
.panel .scroll { flex: 1; overflow: auto; }
.seg { display: flex; padding: 2px; background: var(--bg-2); border-radius: 8px; }
.seg button { flex: 1; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--fg-2); font-size: 12px; }
.seg button[aria-pressed="true"] { background: var(--bg); color: var(--fg); box-shadow: 0 1px 2px rgba(0,0,0,.15); font-weight: 600; }
.note { margin: 6px 0 0; font-size: 12px; color: var(--fg-2); }
.check { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--fg-2); cursor: pointer; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.list { list-style: none; margin: 8px 0 0; padding: 0; }
.list li { display: flex; gap: 8px; align-items: flex-start; padding: 7px 6px; border-radius: 7px; cursor: pointer; }
.list li:hover { background: var(--bg-2); }
.list li > svg { flex: none; margin-top: 2px; color: var(--accent); }
.list .text { flex: 1; min-width: 0; }
.list .q { color: var(--fg-2); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list .n { overflow-wrap: anywhere; }
.list .lost { color: var(--danger); font-size: 11px; }
.list a { color: inherit; text-decoration: none; }
.empty { color: var(--fg-2); font-size: 12px; margin: 6px 0 0; }

.flip :is(.card, .panel, .hint, .pin, .badge) { filter: invert(1) hue-rotate(180deg); }

.veil { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto; z-index: 4; }
.hint { position: fixed; left: 50%; top: 16px; transform: translateX(-50%); padding: 7px 12px; border-radius: 999px; background: var(--fg); color: var(--bg);
  box-shadow: var(--shadow); font-size: 12px; pointer-events: none; z-index: 5; white-space: nowrap; }
.hint.undo { pointer-events: auto; display: flex; align-items: center; gap: 10px; }
.hint.undo button { border: 0; background: transparent; color: inherit; font-weight: 600; text-decoration: underline; padding: 0; }
`;

let root: HTMLDivElement | null = null;
let hostEl: HTMLDivElement | null = null;

/** The overlay's root inside its shadow, created on first use. */
export function overlay(): HTMLDivElement {
  if (root && hostEl?.isConnected) return root;
  hostEl = document.createElement('div');
  hostEl.id = 'bfb-site-tools';
  hostEl.setAttribute('data-bfb-overlay', '');
  hostEl.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646;';
  const shadow = hostEl.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CSS;
  root = document.createElement('div');
  root.className = 'root';
  root.innerHTML = '<div class="layer"></div>';
  shadow.append(style, root);
  document.documentElement.append(hostEl);
  syncTheme();
  return root;
}

/** The layer that scrolls with the page, for pins and badges. */
export const pageLayer = () => overlay().querySelector<HTMLDivElement>('.layer')!;

/** Dark controls when the page is dark (Lights on) or the system prefers dark. */
export function syncTheme() {
  if (!root) return;
  const lights = document.documentElement.getAttribute('data-bfb-lights');
  // Under Invert the page filter flips the overlay too, so each piece flips
  // itself back to its dark colours; filtering the host instead would pin the
  // panel to the top of the page rather than the window.
  const flip = lights === 'invert';
  const dark = lights ? lights !== 'off' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.classList.toggle('dark', dark);
  root.classList.toggle('flip', flip);
}

/** True when an event or node came from inside the overlay. */
export function inOverlay(target: EventTarget | null): boolean {
  return !!hostEl && (target === hostEl || (target instanceof Node && hostEl.contains(target)));
}

/** A short message at the top of the page. */
export function hint(text: string, ms = 1800): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'hint';
  el.textContent = text;
  overlay().append(el);
  if (ms) setTimeout(() => el.remove(), ms);
  return el;
}

/** A message with an Undo button, for a few seconds. */
export function offerUndo(text: string, undo: () => void) {
  overlay().querySelector('.hint.undo')?.remove();
  const el = hint(text, 6000);
  el.classList.add('undo');
  const btn = document.createElement('button');
  btn.textContent = 'Undo';
  btn.addEventListener('click', () => { el.remove(); undo(); });
  el.append(btn);
}

/** Escapes text for innerHTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** "just now", "5 min ago", "3 Nov". */
export function when(ms: number): string {
  const d = Date.now() - ms;
  if (d < 60_000) return 'just now';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
