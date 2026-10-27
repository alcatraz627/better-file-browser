// How much of a directions doc to show: the overview (the head, where things
// stand, the shape table, and each section's heading and done-when line), only
// what is on the owner, only what an agent can do now, or the whole doc. The
// filtered views keep each row's section headings above it, so a row is never
// read without its context. The choice is kept per doc.
import { jsonPref } from './storage';
import { segHtml, upgradeControls } from './controls';
import type { DirModel, DirRow, DirSection } from './directions-model';

export type DirView = 'overview' | 'me' | 'agent' | 'all';
export const DIR_VIEWS: { id: DirView; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Headings, where things stand, and what done means' },
  { id: 'me', label: 'On me', hint: 'Only what waits on you' },
  { id: 'agent', label: 'Agent can do now', hint: 'Only what an agent can pick up' },
  { id: 'all', label: 'All', hint: 'The whole doc' },
];

const viewPref = jsonPref<Record<string, DirView>>('bfb-dir-view-v1', {}, v => !!v && typeof v === 'object' && !Array.isArray(v));
const docKey = () => decodeURIComponent(location.pathname);

/** Whether a row shows in a view. */
export function rowInView(r: DirRow, view: DirView): boolean {
  if (view === 'all') return true;
  if (view === 'overview') return r.summary;
  if (r.summary) return false;
  return view === 'me' ? r.state === 'needs' : r.state === 'ready';
}

/** The section a heading, paragraph or table sits in: the nearest heading above it. */
const sectionOf = (el: Element, model: DirModel): DirSection | null => {
  let n: Element | null = el;
  while (n && !/^H[23]$/.test(n.tagName)) n = n.previousElementSibling;
  return model.sections.find(s => s.el === n) ?? null;
};
const within = (s: DirSection | null, top: DirSection) => { for (let x = s; x; x = x.parent) if (x === top) return true; return false; };
const standing = (s: DirSection | null) => !!s && /where things stand|state today|current state/i.test(s.title);
const isAccepted = (el: Element) => /^\s*(✅|accepted when|done when)/i.test(el.textContent ?? '');

/** Show a view, narrowed further by a state chip when one is pressed. */
export function applyView(root: HTMLElement, model: DirModel, view: DirView, chip: string): void {
  root.dataset.dirView = view;
  for (const r of model.rows) r.el.hidden = !rowInView(r, view) || (!!chip && r.el.dataset.state !== chip);
  const kids = [...root.children] as HTMLElement[];
  const filtered = view !== 'all' || !!chip;
  // Rows that are not tasks (a legend's lines) step aside in any narrowed view.
  const known = new Set<Element>(model.rows.map(r => r.el));
  root.querySelectorAll('tbody tr').forEach(tr => { if (!known.has(tr)) tr.toggleAttribute('data-view-hide', filtered); });
  for (const k of kids) {
    k.toggleAttribute('data-view-hide', false);
    if (!filtered || k.matches('h1, .fe-dir-next, .fe-dir-sum, .fe-dir-views, .fe-md-fm')) continue;
    const table = k.matches('table') ? k : k.querySelector(':scope > table');
    if (table) {
      const shown = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].some(r => !r.hidden && !r.hasAttribute('data-view-hide'));
      k.toggleAttribute('data-view-hide', !shown);
      continue;
    }
    if (/^H[23]$/.test(k.tagName)) {
      const s = model.sections.find(x => x.el === k);
      if (view === 'overview' && !chip) continue;
      // A heading stays when any row under it shows.
      const any = !!s && model.rows.some(r => !r.el.hidden && within(r.section, s));
      k.toggleAttribute('data-view-hide', !any);
      continue;
    }
    if (/^H[456]$/.test(k.tagName)) { k.toggleAttribute('data-view-hide', true); continue; }
    // Prose: the overview keeps where things stand, the done-when lines and the intro; the narrow views keep only done-when lines.
    const s = sectionOf(k, model);
    const keep = view === 'overview' && !chip ? (!s || standing(s) || isAccepted(k)) : isAccepted(k) && !!s && model.rows.some(r => !r.el.hidden && within(r.section, s));
    k.toggleAttribute('data-view-hide', !keep);
  }
}

/** Draw the view switch after the state bar and wire it; returns the view in force. */
export function mountViews(root: HTMLElement, bar: HTMLElement, onChange: (v: DirView) => void): DirView {
  const wrap = document.createElement('div');
  wrap.className = 'fe-dir-views';
  wrap.innerHTML = segHtml('fe-dir-view', DIR_VIEWS.map(v => ({ value: v.id, label: v.label, hint: v.hint })), 'How much of the doc to show');
  bar.after(wrap);
  upgradeControls(wrap);
  const seg = wrap.querySelector<HTMLElement & { value: string }>('.fe-seg')!;
  const saved = viewPref.get()[docKey()] ?? 'all';
  seg.value = saved;
  seg.addEventListener('change', () => {
    const v = seg.value as DirView;
    viewPref.set({ ...viewPref.get(), [docKey()]: v });
    onChange(v);
  });
  return saved;
}

/** Give each section in the Contents rail a dot in its most pressing state and a count of what is still open. */
export function markOutline(model: DirModel): void {
  const toc = document.getElementById('fe-toc');
  if (!toc) return;
  const rank = ['needs', 'waiting', 'ready', 'parked'] as const;
  for (const s of model.sections) {
    const a = toc.querySelector<HTMLElement>(`a[data-id="${CSS.escape(s.el.id)}"]`);
    if (!a || a.querySelector('.fe-toc-n')) continue;
    const open = model.rows.filter(r => !r.summary && r.state && r.state !== 'done' && within(r.section, s));
    if (!open.length) continue;
    const worst = rank.find(st => open.some(r => r.state === st)) ?? 'ready';
    a.insertAdjacentHTML('beforeend', `<span class="fe-toc-n" data-state="${worst}" title="${open.length} still open">${open.length}</span>`);
  }
}
