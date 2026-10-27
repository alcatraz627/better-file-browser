// A directions doc (DIRECTIONS.md, or any *directions*.md) is a plan the owner
// reads to pick what comes next: tables of tasks, each row carrying a state
// mark (needs you, waiting, ready, parked, done). It is one of the doc views
// (docview.ts). On its file page the doc gains a bar counting each state,
// which narrows every table to that state on a click; a meter beside each
// section; a state pill in place of each bare mark; and pictures that open
// large. The doc's own key to the marks folds away, since the bar names
// each state. The markdown itself is untouched.
import { esc } from './utils';
import type { DocView } from './docview';
import { markDocView } from './docview';
import { pillHtml, meterHtml, chipBarHtml, wireChipBar, type Tally } from './docview-status';
import { wireMedia } from './docview-media';
import { readDirections } from './directions-model';
import { nextHead, nextHeadHtml } from './directions-head';
import { applyView, mountViews, markOutline, type DirView } from './directions-views';
import { markDone } from './directions-done';

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
  rows.forEach((r, i) => { if (states[i]) r.dataset.state = states[i]!; });

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
  // The doc's key to the marks, and its reader and date lines, step back.
  for (const r of keyRows) r.hidden = true;
  for (const p of root.querySelectorAll<HTMLElement>(':scope > p, :scope > ul > li')) {
    const text = p.textContent ?? '';
    if (isMarkKey(text)) p.hidden = true;
    else if (/^\s*(reader|last updated)\s*:/i.test(text)) p.classList.add('fe-dir-meta');
  }

  // Each section heading gets a meter of the rows below it, up to the next heading of its level or higher.
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
    h.insertAdjacentHTML('beforeend', m);
    // A table cell naming this section (the overview's direction column) links to it and shows the same meter.
    const name = (h.firstChild?.textContent ?? '').trim();
    for (const td of root.querySelectorAll<HTMLTableCellElement>('tbody td:first-child')) {
      if (td.dataset.dirLink || td.textContent?.trim() !== name || !h.id) continue;
      td.dataset.dirLink = '1';
      td.innerHTML = `<a href="#${esc(h.id)}">${esc(name)}</a>${m}`;
    }
  }

  const all = tally(states);
  const bar = document.createElement('div');
  bar.className = 'fe-dir-sum';
  // Rows the doc gives no state are shown as a count, not silently left out.
  const unmarked = model.rows.filter(r => !r.summary && !r.state && !r.el.dataset.state).length;
  bar.innerHTML = chipBarHtml(tallies(all), `<span class="fe-dir-total">${meter(all)}</span>${unmarked ? `<span class="fe-dir-unmarked" title="Rows with no state mark or state word">${unmarked} unmarked</span>` : ''}`);
  const h1 = root.querySelector('h1');
  if (h1) h1.after(bar); else root.prepend(bar);

  // What to do next, above the bar; each item jumps to its row and flashes it.
  const head = document.createElement('section');
  head.className = 'fe-dir-next';
  head.setAttribute('aria-label', 'What to do next');
  head.innerHTML = nextHeadHtml(model, nextHead(model));
  bar.before(head);
  head.addEventListener('click', e => {
    const t = e.target as Element;
    const more = t.closest<HTMLElement>('[data-more]');
    if (more) { bar.querySelector<HTMLElement>(`.fe-dv-chip[data-state="${more.dataset.more}"]`)?.click(); return; }
    const row = model.rows[Number(t.closest<HTMLElement>('[data-row]')?.dataset.row)]?.el;
    if (!row) return;
    // A row the view or a chip hides comes back with the whole doc.
    if (row.hidden) {
      bar.querySelector<HTMLElement>('.fe-dv-chip[aria-pressed="true"]')?.click();
      const seg = root.querySelector<HTMLElement & { value: string }>('#fe-dir-view');
      if (seg && row.hidden) { seg.value = 'all'; seg.dispatchEvent(new Event('change')); }
    }
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    flashRow(row);
  });

  // A chip narrows every table to its rows, inside the view in force; tables
  // left with none fold away. Pressing it again shows all.
  markDone(model);
  let view: DirView = 'all', chip = '';
  const apply = () => applyView(root, model, view, chip);
  wireChipBar(bar, want => { chip = want; root.dataset.dirFilter = want; apply(); });
  view = mountViews(root, bar, v => { view = v; apply(); });
  apply();
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
