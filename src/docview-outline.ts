// A doc view's rail: every item on the page in one short list, each with a
// state dot and its current value (a decision's pick, an item's agree), so
// the owner sees the whole page at once and jumps to any item. The item in
// view is marked as the page scrolls.
import { esc } from './utils';

/** The longest id the rail shows in its own column. */
const SHORT_ID = 4;

export interface OutlineItem { id: string; label: string; value?: string; state?: string; group?: string }

/** The rail's markup: items under their group names, in the order given. */
export function outlineHtml(items: OutlineItem[], title: string): string {
  let group: string | undefined;
  const rows = items.map(it => {
    const head = it.group && it.group !== group ? `<li class="fe-dv-outline-grp">${esc(it.group)}</li>` : '';
    group = it.group;
    // A short id (D1, s3) is worth its column; a long one would crowd out the label, so it moves to the tooltip.
    const shortId = it.id.length <= SHORT_ID;
    return `${head}<li><button type="button" class="row fe-dv-outline-row" data-target="${esc(it.id)}" data-state="${esc(it.state ?? '')}" title="${esc(shortId ? it.label : `${it.id}: ${it.label}`)}">
      <i></i>${shortId ? `<span class="fe-dv-outline-id">${esc(it.id)}</span>` : ''}<span class="fe-dv-outline-lbl">${esc(it.label)}</span><span class="fe-dv-outline-val">${esc(it.value ?? '')}</span>
    </button></li>`;
  }).join('');
  return `<nav class="fe-dv-outline" aria-label="${esc(title)}"><div class="fe-dv-outline-h">${esc(title)}</div><ol>${rows}</ol></nav>`;
}

/** Change one row's value or state after an answer changes. */
export function updateOutline(nav: HTMLElement, id: string, o: { value?: string; state?: string }): void {
  const row = nav.querySelector<HTMLElement>(`.fe-dv-outline-row[data-target="${CSS.escape(id)}"]`);
  if (!row) return;
  if (o.state !== undefined) row.dataset.state = o.state;
  if (o.value !== undefined) row.querySelector('.fe-dv-outline-val')!.textContent = o.value;
}

/**
 * Jump to an item when its row is pressed, and keep a row marked as current:
 * the view's own current item while it is on screen (the one its keys act
 * on), else the item nearest the top of the scroller. Returns a function
 * the view calls when its current item changes.
 */
export function followOutline(nav: HTMLElement, scroller: HTMLElement, targets: HTMLElement[], jump: (id: string) => void, prefer: () => HTMLElement | null = () => null): () => void {
  nav.addEventListener('click', e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-dv-outline-row');
    if (row) jump(row.dataset.target!);
  });
  const seen = new Map<HTMLElement, boolean>();
  const onScreen = (t: HTMLElement) => {
    const a = t.getBoundingClientRect(), s = scroller.getBoundingClientRect();
    return a.bottom > s.top && a.top < s.bottom;
  };
  const mark = () => {
    const p = prefer();
    const first = p && onScreen(p) ? p : targets.find(t => seen.get(t));
    if (!first) return;
    nav.querySelectorAll('.fe-dv-outline-row.active').forEach(r => { r.classList.remove('active'); r.removeAttribute('aria-current'); });
    const row = nav.querySelector<HTMLElement>(`.fe-dv-outline-row[data-target="${CSS.escape(first.dataset.id ?? '')}"]`);
    if (!row) return;
    row.classList.add('active');
    row.setAttribute('aria-current', 'location');
    // Keep the current row in sight inside a long rail without moving the page.
    const ol = row.closest<HTMLElement>('ol')!;
    if (row.offsetTop < ol.scrollTop || row.offsetTop + row.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTop = row.offsetTop - ol.clientHeight / 2;
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => seen.set(en.target as HTMLElement, en.isIntersecting));
    mark();
  }, { root: scroller, rootMargin: '0px 0px -55% 0px' });
  targets.forEach(t => io.observe(t));
  return mark;
}
