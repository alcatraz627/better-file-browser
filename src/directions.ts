// A directions doc (DIRECTIONS.md, or any *directions*.md) is a plan the owner
// reads to pick what comes next: tables of tasks, each row carrying a state
// mark (needs you, waiting, ready, parked, done). It is one of the doc views
// (docview.ts). On its file page the doc gains what to do next at the top,
// then one pinned row of controls: Doc or List, a chip per state (any mix),
// Overview or Full, a filter box, and a line saying what is showing. One
// filter record drives the doc, the list and the page address
// (directions-state.ts). Bare marks read as named pills, the doc's key to the
// marks folds away, and pictures open large. The markdown is untouched.
import { esc } from './utils';
import type { DocView } from './docview';
import { markDocView } from './docview';
import { pillHtml, meterHtml, chipBarHtml, type Tally } from './docview-status';
import { wireMedia } from './docview-media';
import { readDirections } from './directions-model';
import { nextHead, nextHeadHtml } from './directions-head';
import { applyView, mountDepth, markOutline, savedDepth, saveDepth } from './directions-views';
import { markDone } from './directions-done';
import { UI_ICON } from './control-icons';
import { mountList, mountLayoutSeg, listRow, savedLayout, saveLayout } from './directions-list';
import { startFilter, hashFor, filterFromHash, isFiltered, ownsHash, type DirFilter } from './directions-state';

/** Light a row up for a moment, so the eye finds it after a jump. */
function flashRow(row: HTMLTableRowElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  row.dataset.flash = '';
  for (const td of row.cells) td.animate([{ backgroundColor: 'color-mix(in srgb, var(--ac) 24%, transparent)' }, { backgroundColor: 'transparent' }], { duration: 1400, easing: 'ease-out' });
  window.setTimeout(() => delete row.dataset.flash, 1400);
}

export type DirState = 'needs' | 'waiting' | 'ready' | 'parked' | 'done';
export const DIR_STATES: { id: DirState; mark: string; label: string }[] = [
  { id: 'needs', mark: '🔴', label: 'needs you' },
  { id: 'waiting', mark: '🟠', label: 'waiting' },
  { id: 'ready', mark: '🟢', label: 'ready' },
  { id: 'parked', mark: '💤', label: 'parked' },
  { id: 'done', mark: '✅', label: 'done' },
];

/** Whether a file name is a directions doc. */
export const isDirectionsDoc = (path: string) => /directions[^/]*\.md$/i.test(path);

/** A row's state: the first state mark anywhere in its text, or null. */
export function rowState(text: string): DirState | null {
  let best: { at: number; id: DirState } | null = null;
  for (const s of DIR_STATES) {
    const at = text.indexOf(s.mark);
    if (at >= 0 && (!best || at < best.at)) best = { at, id: s.id };
  }
  return best?.id ?? null;
}

/** How many rows hold each state. */
export function tally(states: (DirState | null)[]): Record<DirState, number> {
  const t = { needs: 0, waiting: 0, ready: 0, parked: 0, done: 0 };
  for (const s of states) if (s) t[s]++;
  return t;
}

const marksIn = (text: string) => DIR_STATES.filter(s => text.includes(s.mark)).length;
/** The doc's key to its own marks: a line naming three or more of them, which repeats what the state bar says. */
export const isMarkKey = (text: string): boolean => /^\s*\**(marks|key|legend|states?)\**\s*:?/i.test(text) && marksIn(text) >= 3;
/** A table row that is the key rather than a task: no task row carries three state marks. */
const isKeyRow = (text: string): boolean => marksIn(text) >= 3;

/** A heading whose table rows all wait on the owner even when unmarked ("Waiting on you", "Needs you"). */
const asksOwner = (heading: string) => /\b(waiting on you|needs you|for you)\b/i.test(heading);

const tallies = (t: Record<DirState, number>): Tally[] => DIR_STATES.map(s => ({ state: s.id, n: t[s.id], label: s.label }));
const meter = (t: Record<DirState, number>) => {
  const total = DIR_STATES.reduce((n, s) => n + t[s.id], 0);
  return meterHtml(tallies(t), `${t.done}/${total}`, `${t.done} of ${total} done`);
};

/** Add the bar, the meters, the pills and the row marks to a rendered directions doc. Safe to call again. */
export function enhanceDirections(root: HTMLElement): void {
  if (root.dataset.directions) return;
  // Read before anything below rewrites the cells.
  const model = readDirections(root);
  const allRows = [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const keyRows = allRows.filter(r => isKeyRow(r.textContent ?? ''));
  const rows = allRows.filter(r => !keyRows.includes(r));
  // The heading a row sits under, for tables whose section says who they wait on.
  const headingOf = (r: HTMLElement) => {
    let n: Element | null = r.closest('table')?.closest('.fe-md-tablewrap') ?? r.closest('table');
    while (n && !/^H[1-6]$/.test(n.tagName)) n = n.previousElementSibling;
    return n?.textContent ?? '';
  };
  // A state written as a word in a state column (read by the model) counts too.
  const worded = new Map(model.rows.map(r => [r.el, r.state]));
  const states = rows.map(r => rowState(r.textContent ?? '') ?? (asksOwner(headingOf(r)) ? 'needs' : null) ?? worded.get(r) ?? null);
  if (!states.some(Boolean)) return;
  root.dataset.directions = 'on';
  // A line of the overview table only names a direction; it is not a task, so it takes no state and no count.
  const summaries = new Set<Element>(model.rows.filter(r => r.summary).map(r => r.el));
  rows.forEach((r, i) => { if (states[i] && !summaries.has(r)) r.dataset.state = states[i]!; });

  // A cell that starts with a mark gets a pill naming it: the mark alone or the
  // mark and its own name become the pill; any other words after it stay.
  for (const td of rows.flatMap(r => [...r.cells])) {
    const text = td.textContent?.trim() ?? '';
    const s = DIR_STATES.find(x => text.startsWith(x.mark));
    if (!s) continue;
    const rest = text.slice(s.mark.length).trim();
    if (!rest || rest.toLowerCase() === s.label) { td.innerHTML = pillHtml(s.id, s.label); continue; }
    const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const at = n.data.indexOf(s.mark);
      if (at < 0) continue;
      const after = n.splitText(at);
      after.data = after.data.slice(s.mark.length).replace(/^\s*/, ' ');
      after.before(document.createRange().createContextualFragment(pillHtml(s.id, s.label)));
      break;
    }
  }
  // The doc's key to the marks and its note to agents step aside; its date
  // moves into the state bar when the bar can say it.
  for (const r of keyRows) r.hidden = true;
  for (const p of root.querySelectorAll<HTMLElement>(':scope > p, :scope > ul > li')) {
    const text = p.textContent ?? '';
    if (isMarkKey(text) || /^\s*\**reader\**\s*:/i.test(text) || (model.lastUpdated && /^\s*\**last updated/i.test(text))) p.hidden = true;
  }

  // A cell of the overview naming a section links to it, with a meter of that
  // section's rows (up to the next heading of its level or higher). The
  // headings themselves stay plain: the pills and the Contents counts say it.
  const heads = [...root.querySelectorAll<HTMLElement>('h2, h3')];
  for (const h of heads) {
    const level = Number(h.tagName[1]);
    const mine: (DirState | null)[] = [];
    for (let n = h.nextElementSibling; n; n = n.nextElementSibling) {
      if (/^H[1-6]$/.test(n.tagName) && Number(n.tagName[1]) <= level) break;
      n.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(r => mine.push((r.dataset.state as DirState) || null));
    }
    const t = tally(mine);
    const m = meter(t);
    if (!m) continue;
    const name = (h.firstChild?.textContent ?? '').trim();
    for (const td of root.querySelectorAll<HTMLTableCellElement>('tbody td:first-child')) {
      if (td.dataset.dirLink || td.textContent?.trim() !== name || !h.id) continue;
      td.dataset.dirLink = '1';
      td.innerHTML = `<a href="#${esc(h.id)}">${esc(name)}</a>${m}`;
    }
  }

  const all = tally(rows.map((r, i) => summaries.has(r) ? null : states[i]));
  const tasks = model.rows.filter(r => !r.summary).map(r => r.el);
  const next = nextHead(model);
  // One row of controls: Doc or List, the state chips, Overview or Full, the
  // filter box, then a status line that says what is showing.
  const bar = document.createElement('div');
  bar.className = 'fe-dir-sum';
  bar.innerHTML = `<div class="fe-dir-chips">${chipBarHtml(tallies(all))}</div>`
    + `<label class="fe-dir-q" title="Narrow the rows to those holding these words"><input type="search" placeholder="Filter rows" spellcheck="false" autocomplete="off" aria-label="Filter rows"></label>`
    + `<span class="fe-dir-status" aria-live="polite"></span>`;
  const h1 = root.querySelector('h1');
  if (h1) h1.after(bar); else root.prepend(bar);
  const chips = bar.querySelector<HTMLElement>('.fe-dir-chips')!;
  const qBox = bar.querySelector<HTMLInputElement>('.fe-dir-q input')!;
  const status = bar.querySelector<HTMLElement>('.fe-dir-status')!;
  // Rows the doc gives no state are counted, not silently left out.
  const unmarked = model.rows.filter(r => !r.summary && !r.state && !r.el.dataset.state).length;

  // What to do next, above the bar; each item jumps to its row and flashes it.
  const head = document.createElement('section');
  head.className = 'fe-dir-next';
  head.setAttribute('aria-label', 'What to do next');
  head.innerHTML = nextHeadHtml(model, next);
  bar.before(head);

  markDone(model);
  let f: DirFilter = startFilter(location.hash, { layout: savedLayout(), depth: savedDepth() });
  const layoutSeg = mountLayoutSeg(bar, l => { saveLayout(l); set({ layout: l }); });
  const depthSeg = mountDepth(bar, d => { saveDepth(d); set({ depth: d }); });
  bar.append(qBox.parentElement!, status);

  // Show a row in the doc: a row the filter hides brings the whole doc back.
  const jump = (row: HTMLTableRowElement) => {
    if (row.hidden || f.layout !== 'doc') set({ layout: 'doc', ...(row.hidden ? { states: new Set(), q: '', depth: 'full' as const } : {}) });
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    flashRow(row);
  };
  const list = mountList(bar, model, {
    row: jump,
    section: id => { set({ layout: 'doc' }); document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); },
  });

  // The doc's "How to read this" section explains the marks and the layout;
  // it folds into a legend at the end of the bar instead of taking a screen.
  const howTo = model.sections.find(s => s.level === 2 && /^how to read/i.test(s.title));
  if (howTo && !model.rows.some(r => !r.summary && r.section === howTo)) {
    const parts: Element[] = [];
    for (let n = howTo.el.nextElementSibling; n && !/^H[12]$/.test(n.tagName) && !n.matches('.fe-dir-next, .fe-dir-sum, .fe-dir-list'); n = n.nextElementSibling) parts.push(n);
    const legend = document.createElement('details');
    legend.className = 'fe-dir-legend';
    legend.innerHTML = `<summary class="fe-dir-legend-b" title="How to read this doc">${UI_ICON.info}</summary><div class="fe-dir-legend-body"><div class="fe-dir-legend-h">${esc(howTo.title)}</div></div>`;
    legend.querySelector('.fe-dir-legend-body')!.append(...parts);
    // The marks key hides from the doc because the chips name each state; in the legend it is the point.
    legend.querySelectorAll<HTMLElement>('[hidden]').forEach(n => { n.hidden = false; });
    bar.append(legend);
    howTo.el.hidden = true;
    document.querySelector(`#fe-toc a[data-id="${CSS.escape(howTo.el.id)}"]`)?.remove();
    // A click outside closes it, as a menu would.
    document.addEventListener('pointerdown', e => { if (legend.open && !legend.contains(e.target as Node)) legend.open = false; });
  }

  // Draw everything from the filter, then write it to the address.
  function render(): void {
    applyView(root, model, f);
    list.paint(f);
    root.dataset.dirLayout = f.layout;
    layoutSeg.set(f.layout);
    depthSeg.set(f.depth);
    chips.querySelectorAll<HTMLElement>('.fe-dv-chip').forEach(c => c.setAttribute('aria-pressed', String(f.states.has(c.dataset.state as DirState))));
    if (qBox.value !== f.q && document.activeElement !== qBox) qBox.value = f.q;
    const shown = tasks.filter(r => !r.hidden).length;
    status.innerHTML = isFiltered(f)
      ? `Showing ${shown} of ${tasks.length} <button type="button" class="fe-dir-clear" title="Show every row again">Clear</button>`
      : [`<span class="fe-dir-total" title="${all.done} of ${tasks.length} rows done">${all.done}/${tasks.length} done</span>`,
        unmarked ? `<span class="fe-dir-unmarked" title="Rows with no state mark or state word">${unmarked} unmarked</span>` : '',
        next.staleDays !== null ? `<span class="fe-dir-next-stale" title="The doc's Last updated line">updated ${next.staleDays} days ago</span>` : ''].filter(Boolean).join('');
    status.dataset.filtered = String(isFiltered(f));
    if (ownsHash(location.hash)) {
      const want = hashFor(f);
      const cur = location.hash.startsWith('#dir?') ? location.hash : '';
      if (want !== cur && (want || cur)) history.replaceState(history.state, '', location.pathname + location.search + (want || ''));
    }
  }
  function set(p: Partial<DirFilter>): void { f = { ...f, ...p }; render(); }

  chips.addEventListener('click', e => {
    const c = (e.target as Element).closest<HTMLElement>('.fe-dv-chip');
    if (!c) return;
    const s = new Set(f.states), id = c.dataset.state as DirState;
    if (s.has(id)) s.delete(id); else s.add(id);
    set({ states: s });
  });
  let typing = 0;
  qBox.addEventListener('input', () => { clearTimeout(typing); typing = window.setTimeout(() => set({ q: qBox.value }), 120); });
  qBox.addEventListener('keydown', e => { if (e.key === 'Escape' && qBox.value) { e.stopPropagation(); qBox.value = ''; set({ q: '' }); } });
  status.addEventListener('click', e => { if ((e.target as Element).closest('.fe-dir-clear')) { qBox.value = ''; set({ states: new Set(), q: '' }); } });
  head.addEventListener('click', e => {
    const t = e.target as Element;
    const more = t.closest<HTMLElement>('[data-more]');
    if (more) { set({ states: new Set([more.dataset.more as DirState]) }); return; }
    const at = Number(t.closest<HTMLElement>('[data-row]')?.dataset.row);
    const row = model.rows[at]?.el;
    if (!row) return;
    // While the list shows, the head's links find the row in the list.
    if (f.layout === 'list') {
      if (row.hidden) set({ states: new Set(), q: '', depth: 'full' });
      const hit = listRow(root, at);
      if (hit) { hit.scrollIntoView({ block: 'center', behavior: 'smooth' }); flashRow(hit); return; }
    }
    jump(row);
  });
  // The contents rail lists the doc's headings; picking one reads it in the doc.
  document.getElementById('fe-toc')?.addEventListener('click', e => { if (f.layout === 'list' && (e.target as Element).closest('a')) set({ layout: 'doc' }); }, true);
  // An address edited by hand, or pasted in, takes over.
  addEventListener('hashchange', () => { const p = filterFromHash(location.hash); if (p) { f = { ...f, ...p }; render(); } });
  // The bar stays pinned while the doc scrolls; the list's group headings sit under it.
  new ResizeObserver(() => root.style.setProperty('--dir-bar-h', `${bar.offsetHeight}px`)).observe(bar);
  render();
  markOutline(model);
}

/** The directions view: decorates a rendered directions doc in place, and opens its pictures large. */
export const directionsView: DocView = {
  id: 'directions',
  on: 'file',
  claims: path => isDirectionsDoc(path),
  mount({ root, toast }) {
    if (root.dataset.docview) return true;
    enhanceDirections(root);
    markDocView(root, 'directions');
    wireMedia(root, toast);
    return true;
  },
};
