// A directions doc (DIRECTIONS.md, or any *directions*.md) is a plan the owner
// reads to pick what comes next: tables of tasks, each row carrying a state
// mark (needs you, waiting, ready, parked, done). On its file page the doc
// gains a bar counting each mark, which narrows every table to that mark on a
// click, a meter beside each section showing how its rows stand, and a
// coloured edge on each row. The markdown itself is untouched.
import { esc } from './utils';

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

const meterHtml = (t: Record<DirState, number>) => {
  const total = DIR_STATES.reduce((n, s) => n + t[s.id], 0);
  if (!total) return '';
  // One equal segment per row, grouped by state, so the bar needs no widths of its own.
  const parts = DIR_STATES.filter(s => t[s.id]).map(s => `<i data-state="${s.id}" title="${t[s.id]} ${s.label}"></i>`.repeat(t[s.id])).join('');
  return `<span class="fe-dir-meter" title="${t.done} of ${total} done"><span class="fe-dir-bar">${parts}</span><span class="fe-dir-n">${t.done}/${total}</span></span>`;
};

/** Add the bar, the meters and the row marks to a rendered directions doc. Safe to call again. */
export function enhanceDirections(root: HTMLElement): void {
  if (root.dataset.directions) return;
  const rows = [...root.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const states = rows.map(r => rowState(r.textContent ?? ''));
  if (!states.some(Boolean)) return;
  root.dataset.directions = 'on';
  rows.forEach((r, i) => { if (states[i]) r.dataset.state = states[i]!; });

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
    const m = meterHtml(t);
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
  bar.innerHTML = DIR_STATES.filter(s => all[s.id]).map(s =>
    `<button type="button" class="chip fe-dir-chip" data-state="${s.id}" aria-pressed="false" title="Show only rows marked ${esc(s.label)}"><span>${s.mark}</span>${esc(s.label)}<b>${all[s.id]}</b></button>`).join('')
    + `<span class="fe-dir-total">${meterHtml(all)}</span>`;
  const h1 = root.querySelector('h1');
  if (h1) h1.after(bar); else root.prepend(bar);

  // A chip narrows every table to its rows; sections left with none fold away. Clicking it again shows all.
  bar.addEventListener('click', e => {
    const chip = (e.target as Element).closest<HTMLElement>('.fe-dir-chip');
    if (!chip) return;
    const on = chip.getAttribute('aria-pressed') !== 'true';
    bar.querySelectorAll('.fe-dir-chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    chip.setAttribute('aria-pressed', String(on));
    const want = on ? chip.dataset.state! : '';
    root.dataset.dirFilter = want;
    rows.forEach(r => { r.hidden = !!want && r.dataset.state !== want; });
    root.querySelectorAll('table').forEach(t => {
      const visible = [...t.querySelectorAll<HTMLTableRowElement>('tbody tr')].some(r => !r.hidden);
      (t.closest<HTMLElement>('.fe-md-tablewrap') ?? t).hidden = !!want && !visible;
    });
  });
}
