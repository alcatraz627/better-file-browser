// The command layer: every action with a name, run by its key, from the
// command palette (⌘K), or from a key sequence such as "g h". Modules bind
// the actions they own with bind(); the keys themselves come from keymap.ts.
import { KEYMAP, type KeyDef, type Scope } from './keymap';
import { esc } from './utils';
import { openLayer, raise } from './layer';

interface Bound { run: () => void; when?: () => boolean }
const bound = new Map<string, Bound>();

/// Make the command `id` from the key map do something.
export function bind(id: string, run: () => void, when?: () => boolean): void {
  bound.set(id, { run, when });
}
export function canRun(id: string): boolean {
  const b = bound.get(id);
  return !!b && (!b.when || b.when());
}
export function runCommand(id: string): boolean {
  if (!canRun(id)) return false;
  bound.get(id)!.run();
  return true;
}

/// The key as written in the key map for a key event, such as "⌘K", "⇧T",
/// "⇧[" or "↩".
const NAMED: Record<string, string> = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: '↩', Backspace: '⌫', Delete: '⌫',
  Escape: 'Esc', ' ': 'Space', Tab: '⇥', PageUp: 'PgUp', PageDown: 'PgDn', Home: 'Home', End: 'End',
};
const SHIFT_OF: Record<string, string> = { '{': '[', '}': ']', '~': '`' };
export function keyToken(e: KeyboardEvent): string {
  const named = NAMED[e.key];
  let k = named ?? e.key;
  let shift = e.shiftKey;
  if (named) { /* arrows and the like keep ⇧ */ }
  else if (SHIFT_OF[k]) { k = SHIFT_OF[k]; shift = true; }
  else if (/^[a-z]$/i.test(k)) k = shift || e.metaKey ? k.toUpperCase() : k.toLowerCase();
  else if (k.length === 1) shift = false;   // "?" and "#" already say shift
  // ⌥ turns letters into other characters on a Mac; read the key's place instead.
  if (e.altKey && /^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  return (e.metaKey ? '⌘' : '') + (e.ctrlKey ? '⌃' : '') + (e.altKey ? '⌥' : '') + (shift ? '⇧' : '') + k;
}

// Which keys are live depends on what has the keyboard right now.
export interface Context { scopes: Set<Scope>; typing: boolean; blocked: boolean }
let contextOf: () => Context = () => ({ scopes: new Set(['any']), typing: false, blocked: false });
export function setContext(fn: () => Context): void { contextOf = fn; }

const OWN = KEYMAP.filter(d => d.own);
const live = (d: KeyDef, ctx: Context) => (d.scope ?? 'any') === 'any' ? !ctx.scopes.has('preview') || ['palette', 'area-next', 'area-prev', 'sidebar', 'theme', 'hints'].includes(d.id) : ctx.scopes.has(d.scope!);

// A sequence such as "g h": the first key waits a moment for the second, with
// a small pill showing what was typed.
let pending = '';
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pill: HTMLElement | null = null;
function setPending(p: string): void {
  pending = p;
  if (pendingTimer) clearTimeout(pendingTimer);
  if (!p) { pill?.remove(); pill = null; return; }
  pendingTimer = setTimeout(() => setPending(''), 1600);
  if (!pill) { pill = document.createElement('div'); pill.className = 'fe-chord'; (document.getElementById('fe') ?? document.body).appendChild(pill); raise(pill); }
  const next = OWN.filter(d => canRun(d.id) && d.keys.some(k => k.startsWith(p + ' ')));
  pill.innerHTML = `<kbd>${esc(p)}</kbd><span>then</span>${next.slice(0, 8).map(d => `<span class="fe-chord-o"><kbd>${esc(d.keys.find(k => k.startsWith(p + ' '))!.slice(p.length + 1))}</kbd>${esc(d.title)}</span>`).join('')}`;
}

/// Route a key press to its command. Returns true when one ran.
export function dispatch(e: KeyboardEvent): boolean {
  const ctx = contextOf();
  const tok = keyToken(e);
  // A text area or editor that binds ⌘K itself (the note editor's link) keeps it.
  const ae = document.activeElement as HTMLElement | null;
  if (tok === '⌘K' && !(ae?.tagName === 'TEXTAREA' || ae?.isContentEditable)) { e.preventDefault(); return runCommand('palette'); }
  if (ctx.blocked || ctx.typing) { setPending(''); return false; }
  if (pending) {
    const want = `${pending} ${tok}`;
    setPending('');
    const d = OWN.find(x => x.keys.includes(want) && live(x, ctx));
    if (d && runCommand(d.id)) { e.preventDefault(); e.stopImmediatePropagation(); return true; }
    return false;
  }
  const d = OWN.find(x => x.keys.includes(tok) && live(x, ctx) && canRun(x.id));
  if (d) { e.preventDefault(); e.stopImmediatePropagation(); runCommand(d.id); return true; }
  if (!e.metaKey && !e.ctrlKey && !e.altKey && OWN.some(x => live(x, ctx) && canRun(x.id) && x.keys.some(k => k.startsWith(tok + ' ')))) {
    e.preventDefault(); e.stopImmediatePropagation();
    setPending(tok);
    return true;
  }
  return false;
}

// The palette: every command that can run now with its key, then places to
// go (tabs, saved, notes, recent, this folder), all filtered by what is typed.
export interface PaletteItem { title: string; sub?: string; icon?: string; keys?: string[]; group: string; run: () => void; runAlt?: () => void }
const sources: (() => PaletteItem[])[] = [];
export function addPaletteSource(fn: () => PaletteItem[]): void { sources.push(fn); }

// A loose match: every typed character in order, earlier and tighter is better.
export function score(text: string, q: string): number {
  if (!q) return 1;
  const t = text.toLowerCase(), s = q.toLowerCase();
  const at = t.indexOf(s);
  if (at >= 0) return 1000 - at - (t.length - s.length) * 0.1 + (at === 0 || t[at - 1] === ' ' ? 200 : 0);
  let i = 0, gaps = 0, last = -1;
  for (const ch of s) {
    const j = t.indexOf(ch, last + 1);
    if (j < 0) return 0;
    gaps += j - last - 1; last = j; i++;
  }
  return 100 - gaps;
}

let paletteEl: HTMLElement | null = null;
export function paletteOpen(): boolean { return !!paletteEl; }
export function openPalette(prefill = ''): void {
  if (paletteEl) { paletteEl.querySelector('input')?.focus(); return; }
  const ctx = contextOf();
  const cmds: PaletteItem[] = KEYMAP.filter(d => d.id !== 'palette' && canRun(d.id) && (d.scope === undefined || d.scope === 'any' || ctx.scopes.has(d.scope)))
    .map(d => ({ title: d.title, keys: d.keys, group: d.group, run: () => runCommand(d.id) }));
  const items = [...cmds, ...sources.flatMap(f => { try { return f(); } catch { return []; } })];
  const box = document.createElement('div');
  box.className = 'fe-pal-wrap';
  box.innerHTML = `<div class="fe-pal" role="dialog" aria-label="Command palette">
    <div class="fe-pal-q"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="Type a command or a place" spellcheck="false" autocomplete="off" aria-label="Command or place"><kbd>esc</kbd></div>
    <div class="fe-pal-list" role="listbox"></div>
    <div class="fe-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↩</kbd> run</span><span><kbd>⌥↩</kbd> background tab</span></div>
  </div>`;
  paletteEl = box;
  const input = box.querySelector('input')!;
  const list = box.querySelector<HTMLElement>('.fe-pal-list')!;
  let shown: PaletteItem[] = [];
  let at = 0;
  const paint = () => {
    const q = input.value.trim();
    shown = items.map(it => ({ it, s: Math.max(score(it.title, q), score(it.sub ?? '', q) * 0.6, q ? score((it.keys ?? []).join(' '), q) * 0.9 : 0) }))
      .filter(x => x.s > 0)
      .sort((a, b) => q ? b.s - a.s : 0)
      .slice(0, 60).map(x => x.it);
    at = Math.min(at, Math.max(0, shown.length - 1));
    let lastGroup = '';
    list.innerHTML = shown.length ? shown.map((it, i) => {
      const head = !q && it.group !== lastGroup ? `<div class="fe-pal-g">${esc(it.group)}</div>` : '';
      lastGroup = it.group;
      return `${head}<div class="fe-pal-i${i === at ? ' on' : ''}" role="option" data-i="${i}">${it.icon ?? ''}<span class="fe-pal-t">${esc(it.title)}</span>${it.sub ? `<span class="fe-pal-s">${esc(it.sub)}</span>` : ''}${(it.keys ?? []).slice(0, 1).map(k => `<kbd>${esc(k)}</kbd>`).join('')}</div>`;
    }).join('') : '<div class="fe-pal-none">Nothing matches</div>';
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const fire = (i: number, alt = false) => {
    const it = shown[i];
    if (!it) return;
    layer.close('pick');
    if (alt && it.runAlt) it.runAlt(); else it.run();
  };
  input.addEventListener('input', () => { at = 0; paint(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); at = (at + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); fire(at, e.altKey); }
    else if (e.key === 'Tab') e.preventDefault();
    e.stopPropagation();
  });
  list.addEventListener('mousemove', e => {
    const row = (e.target as Element).closest<HTMLElement>('.fe-pal-i');
    if (row && Number(row.dataset.i) !== at) { at = Number(row.dataset.i); list.querySelectorAll('.fe-pal-i').forEach(r => r.classList.toggle('on', r === row)); }
  });
  list.addEventListener('click', e => { const row = (e.target as Element).closest<HTMLElement>('.fe-pal-i'); if (row) fire(Number(row.dataset.i), e.altKey); });
  input.value = prefill;
  paint();
  // The palette sits over every other layer; focus goes back to where it was when it closes.
  const layer = openLayer(box, { kind: 'command', place: 'none', focus: input, backdrop: box, onClose: () => { paletteEl = null; } });
}
