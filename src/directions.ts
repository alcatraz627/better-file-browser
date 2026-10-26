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

/** The doc's key to its own marks: a paragraph naming three or more of them, which repeats what the state bar says. */
export const isMarkKey = (text: string): boolean => /^\s*(marks|key|legend)\s*:/i.test(text) && DIR_STATES.filter(s => text.includes(s.mark)).length >= 3;

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
  const rows = [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  // The heading a row sits under, for tables whose section says who they wait on.
  const headingOf = (r: HTMLElement) => {
    let n: Element | null = r.closest('table')?.closest('.fe-md-tablewrap') ?? r.closest('table');
    while (n && !/^H[1-6]$/.test(n.tagName)) n = n.previousElementSibling;
    return n?.textContent ?? '';
  };
  const states = rows.map(r => rowState(r.textContent ?? '') ?? (asksOwner(headingOf(r)) ? 'needs' : null));
  if (!states.some(Boolean)) return;
  root.dataset.directions = 'on';
  rows.forEach((r, i) => { if (states[i]) r.dataset.state = states[i]!; });

  // A cell holding only a mark becomes a pill that names it.
  for (const td of root.querySelectorAll<HTMLTableCellElement>('tbody td')) {
    const s = DIR_STATES.find(x => x.mark === td.textContent?.trim());
    if (s) td.innerHTML = pillHtml(s.id, s.label);
  }
  // The doc's key to the marks, and its reader and date lines, step back.
  for (const p of root.querySelectorAll<HTMLElement>(':scope > p')) {
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
  bar.innerHTML = chipBarHtml(tallies(all), `<span class="fe-dir-total">${meter(all)}</span>`);
  const h1 = root.querySelector('h1');
  if (h1) h1.after(bar); else root.prepend(bar);

  // A chip narrows every table to its rows; tables left with none fold away. Pressing it again shows all.
  wireChipBar(bar, want => {
    root.dataset.dirFilter = want;
    rows.forEach(r => { r.hidden = !!want && r.dataset.state !== want; });
    root.querySelectorAll('table').forEach(t => {
      const visible = [...t.querySelectorAll<HTMLTableRowElement>('tbody tr')].some(r => !r.hidden);
      (t.closest<HTMLElement>('.fe-md-tablewrap') ?? t).hidden = !!want && !visible;
    });
  });
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
