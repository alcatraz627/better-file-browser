// The command layer: every action with a name, run by its key, from the
// command palette (⌘K), or from a key sequence such as "g h". Modules bind
// the actions they own with bind(); the keys themselves come from keymap.ts.
import { KEYMAP, GROUPS, type KeyDef, type Scope } from './keymap';
import { PI } from './icons';
import { UI_ICON } from './control-icons';
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
  if (ctx.blocked) { setPending(''); return false; }
  if (ctx.typing) {
    setPending('');
    const d = OWN.find(x => x.field && x.keys.includes(tok) && live(x, ctx) && canRun(x.id));
    if (d) { e.preventDefault(); e.stopImmediatePropagation(); runCommand(d.id); return true; }
    return false;
  }
  if (pending) {
    const want = `${pending} ${tok}`;
    setPending('');
    const seq = OWN.filter(x => x.keys.includes(want) && live(x, ctx) && canRun(x.id));
    const d = seq.find(x => (x.scope ?? 'any') !== 'any') ?? seq[0];
    if (d && runCommand(d.id)) { e.preventDefault(); e.stopImmediatePropagation(); return true; }
    return false;
  }
  // A command for where the keyboard is beats one that works anywhere.
  const all = OWN.filter(x => x.keys.includes(tok) && live(x, ctx) && canRun(x.id));
  const d = all.find(x => (x.scope ?? 'any') !== 'any') ?? all[0];
  if (d) { e.preventDefault(); e.stopImmediatePropagation(); runCommand(d.id); return true; }
  if (!e.metaKey && !e.ctrlKey && !e.altKey && OWN.some(x => live(x, ctx) && canRun(x.id) && x.keys.some(k => k.startsWith(tok + ' ')))) {
    e.preventDefault(); e.stopImmediatePropagation();
    setPending(tok);
    return true;
  }
  return false;
}

// The palette: every command that can run now with its key, then places to
// go, in tabs (actions, tabs, saved, recent, notes, this folder, comments,
// chats), all filtered by what is typed. A source may answer later, as the
// comments list does; its entries appear when they arrive.
export type PaletteTab = 'actions' | 'tabs' | 'saved' | 'recent' | 'notes' | 'here' | 'comments' | 'chats';
export interface PaletteItem { title: string; sub?: string; icon?: string; keys?: string[]; group: string; tab?: PaletteTab; run: () => void; runAlt?: () => void }
type Source = () => PaletteItem[] | Promise<PaletteItem[]>;
const sources: Source[] = [];
export function addPaletteSource(fn: Source): void { sources.push(fn); }

const TABS: { id: PaletteTab | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: PI.apps },
  { id: 'actions', label: 'Actions', icon: UI_ICON.keyboard },
  { id: 'tabs', label: 'Tabs', icon: PI.tabset },
  { id: 'saved', label: 'Saved', icon: PI.bm },
  { id: 'recent', label: 'Recent', icon: PI.recent },
  { id: 'notes', label: 'Notes', icon: UI_ICON.notes },
  { id: 'here', label: 'Here', icon: PI.folder },
  { id: 'comments', label: 'Comments', icon: UI_ICON.comment },
  { id: 'chats', label: 'Chats', icon: UI_ICON.ai },
];
const TAB_OF_GROUP: Record<string, PaletteTab> = { Tabs: 'tabs', Saved: 'saved', Recent: 'recent', Notes: 'notes', 'This folder': 'here', Comments: 'comments', Chats: 'chats' };
const tabOf = (it: PaletteItem): PaletteTab => it.tab ?? TAB_OF_GROUP[it.group] ?? 'actions';

// An icon for each command, so the palette reads at a glance; a command not
// listed takes its group's icon.
const ACTION_ICON: Record<string, string> = {
  keys: UI_ICON.keyboard, settings: PI.gear, hints: UI_ICON.keyboard, sidebar: UI_ICON.preview, theme: UI_ICON.appearance, esc: UI_ICON.close,
  up: UI_ICON.prev, home: PI.home, path: UI_ICON.link, 'goto-bg': UI_ICON.link, 'note-rename': UI_ICON.rename, 'note-delete': UI_ICON.trash, 'open-pick': UI_ICON.folderOpen, save: PI.bm, terminal: UI_ICON.terminal, 'terminal-copy': UI_ICON.copy,
  'area-next': UI_ICON.stack, 'area-prev': UI_ICON.stack, 'to-listing': UI_ICON.list, 'to-sidebar': UI_ICON.preview, 'to-tabs': UI_ICON.tab, 'to-toolbar': UI_ICON.stack, 'to-path': UI_ICON.link,
  'lens-places': PI.home, 'lens-saved': PI.bm, 'lens-notes': UI_ICON.notes, 'lens-recent': PI.recent, 'lens-search': PI.search, 'lens-ask': UI_ICON.ai, 'lens-docs': UI_ICON.comment,
  'open-bg': UI_ICON.tab, 'open-chrome': UI_ICON.external, menu: UI_ICON.list, 'select-all': UI_ICON.task, 'copy-paths': UI_ICON.copy, 'copy-path': UI_ICON.copy, 'copy-name': UI_ICON.copy,
  filter: PI.search, 'new-note': UI_ICON.add, 'tree-open': UI_ICON.folderOpen, 'tree-close': PI.folder, deep: UI_ICON.stack,
  'view-details': UI_ICON.table, 'view-list': UI_ICON.list, 'view-tree': UI_ICON.contents, 'view-tiles': PI.apps, 'view-icons': UI_ICON.image,
  'sort-name': UI_ICON.contents, 'sort-date': UI_ICON.clock, 'sort-size': UI_ICON.data, 'sort-type': UI_ICON.file, 'sort-rev': UI_ICON.rotate, group: UI_ICON.stack,
  'filter-panel': PI.search, hidden: UI_ICON.eye, 'zoom-in': UI_ICON.zoomIn, 'zoom-out': UI_ICON.zoomOut, 'zoom-reset': UI_ICON.actualSize,
  'tab-keep': UI_ICON.tab, 'tab-close': UI_ICON.close, 'tab-pin': UI_ICON.pin, 'tab-step': UI_ICON.next, 'tab-reopen': UI_ICON.reset, 'tab-left': UI_ICON.prev, 'tab-right': UI_ICON.next, 'tab-list': UI_ICON.list,
  'pv-dock': UI_ICON.preview, 'pv-copy': UI_ICON.copy, 'pv-ask': UI_ICON.ai, 'pv-tab': UI_ICON.tab, 'pv-open': UI_ICON.external,
  'fp-raw': UI_ICON.fmtCode, 'fp-edit': UI_ICON.rename, 'fp-find': PI.search, 'fp-toc': UI_ICON.contents, 'fp-width': UI_ICON.fit, 'fp-comments': UI_ICON.comment, 'fp-comment': UI_ICON.comment, 'fp-cm-reply': UI_ICON.comment, 'fp-cm-step': UI_ICON.comment,
};
const iconFor = (d: KeyDef) => ACTION_ICON[d.id] ?? PI[GROUPS.find(g => g.name === d.group)?.icon ?? 'apps'] ?? '';

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
    .map(d => ({ title: d.title, keys: d.keys, group: d.group, tab: 'actions', icon: iconFor(d), run: () => runCommand(d.id) }));
  const items: PaletteItem[] = [...cmds];
  const late: Promise<PaletteItem[]>[] = [];
  for (const f of sources) {
    try { const r = f(); if (Array.isArray(r)) items.push(...r); else late.push(r); } catch { /* a broken source leaves the rest */ }
  }
  const box = document.createElement('div');
  box.className = 'fe-pal-wrap';
  box.innerHTML = `<div class="fe-pal" role="dialog" aria-label="Command palette">
    <div class="fe-pal-q"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="text" placeholder="Type a command or a place" spellcheck="false" autocomplete="off" aria-label="Command or place"><kbd>esc</kbd></div>
    <div class="fe-pal-tabs" role="tablist"></div>
    <div class="fe-pal-list" role="listbox"></div>
    <div class="fe-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↩</kbd> run</span><span><kbd>⌥↩</kbd> background tab</span><span><kbd>⇥</kbd><kbd>⇧⇥</kbd> tabs</span></div>
  </div>`;
  paletteEl = box;
  const input = box.querySelector('input')!;
  const tabsEl = box.querySelector<HTMLElement>('.fe-pal-tabs')!;
  const list = box.querySelector<HTMLElement>('.fe-pal-list')!;
  let shown: PaletteItem[] = [];
  let at = 0;
  let tab: PaletteTab | 'all' = 'all';
  const matches = (it: PaletteItem, q: string) => Math.max(score(it.title, q), score(it.sub ?? '', q) * 0.6, q ? score((it.keys ?? []).join(' '), q) * 0.9 : 0);
  const paint = () => {
    const q = input.value.trim();
    // Tabs show how many entries match what is typed; an empty one dims.
    const counts = new Map<string, number>();
    for (const it of items) if (matches(it, q) > 0) { const t = tabOf(it); counts.set(t, (counts.get(t) ?? 0) + 1); counts.set('all', (counts.get('all') ?? 0) + 1); }
    tabsEl.innerHTML = TABS.map(t => `<button type="button" role="tab" class="fe-pal-tab${t.id === tab ? ' on' : ''}${counts.get(t.id) ? '' : ' empty'}" data-tab="${t.id}" aria-selected="${t.id === tab}" tabindex="-1">${t.icon}<span>${t.label}</span>${counts.get(t.id) ? `<i>${counts.get(t.id)}</i>` : ''}</button>`).join('');
    tabsEl.querySelector('.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    shown = items.filter(it => tab === 'all' || tabOf(it) === tab)
      .map(it => ({ it, s: matches(it, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => q ? b.s - a.s : 0)
      .slice(0, 80).map(x => x.it);
    at = Math.min(at, Math.max(0, shown.length - 1));
    let lastGroup = '';
    list.innerHTML = shown.length ? shown.map((it, i) => {
      const head = !q && it.group !== lastGroup ? `<div class="fe-pal-g">${esc(it.group)}</div>` : '';
      lastGroup = it.group;
      return `${head}<div class="fe-pal-i${i === at ? ' on' : ''}" role="option" data-i="${i}" data-tab="${tabOf(it)}">${it.icon ?? ''}<span class="fe-pal-t">${esc(it.title)}</span>${it.sub ? `<span class="fe-pal-s">${esc(it.sub)}</span>` : ''}${(it.keys ?? []).slice(0, 1).map(k => `<kbd>${esc(k)}</kbd>`).join('')}</div>`;
    }).join('') : `<div class="fe-pal-none">${late.length && tab !== 'all' && !counts.get(tab) ? 'Loading…' : 'Nothing matches'}</div>`;
    list.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  };
  const setTab = (t: PaletteTab | 'all') => { tab = t; at = 0; paint(); };
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
    else if (e.key === 'Tab') {
      // Tab and Shift+Tab walk the tabs, skipping the empty ones.
      e.preventDefault();
      const ids = TABS.map(t => t.id);
      const live = ids.filter(id => id === 'all' || tabsEl.querySelector(`[data-tab="${id}"]:not(.empty)`));
      const i = live.indexOf(tab);
      setTab(live[(i + (e.shiftKey ? -1 : 1) + live.length) % live.length]);
    }
    e.stopPropagation();
  });
  tabsEl.addEventListener('click', e => { const b = (e.target as Element).closest<HTMLElement>('.fe-pal-tab'); if (b) { setTab(b.dataset.tab as PaletteTab | 'all'); input.focus(); } });
  list.addEventListener('mousemove', e => {
    const row = (e.target as Element).closest<HTMLElement>('.fe-pal-i');
    if (row && Number(row.dataset.i) !== at) { at = Number(row.dataset.i); list.querySelectorAll('.fe-pal-i').forEach(r => r.classList.toggle('on', r === row)); }
  });
  list.addEventListener('click', e => { const row = (e.target as Element).closest<HTMLElement>('.fe-pal-i'); if (row) fire(Number(row.dataset.i), e.altKey); });
  input.value = prefill;
  paint();
  for (const p of late) p.then(r => { if (paletteEl !== box) return; items.push(...r); paint(); }).catch(() => { /* that tab stays empty */ });
  // The palette sits over every other layer; focus goes back to where it was when it closes.
  const layer = openLayer(box, { kind: 'command', place: 'none', focus: input, backdrop: box, onClose: () => { paletteEl = null; } });
}
