// How much of a directions doc to show, and which rows. Overview keeps the
// head, where things stand, the shape table and each section's heading and
// done-when line; Full is the whole doc. State chips and the filter box narrow
// the task rows, and a narrowed doc keeps each row's section headings above
// it, so a row is never read without its context. Overview or Full is kept
// per doc.
import { jsonPref } from './storage';
import { segHtml, upgradeControls } from './controls';
import { UI_ICON } from './control-icons';
import type { DirModel, DirRow, DirSection } from './directions-model';
import { isFiltered, type DirDepth, type DirFilter } from './directions-state';

export const DIR_DEPTHS: { id: DirDepth; icon: string; hint: string }[] = [
  { id: 'overview', icon: UI_ICON.contents, hint: 'Overview: headings, where things stand, and what done means' },
  { id: 'full', icon: UI_ICON.expand, hint: 'Full: the whole doc' },
];

// Older docs remember one of four views; any but the overview reads as Full.
const depthPref = jsonPref<Record<string, string>>('bfb-dir-view-v1', {}, v => !!v && typeof v === 'object' && !Array.isArray(v));
const docKey = () => decodeURIComponent(location.pathname);
export const savedDepth = (): DirDepth | undefined => { const v = depthPref.get()[docKey()]; return v ? (v === 'overview' ? 'overview' : 'full') : undefined; };
export const saveDepth = (d: DirDepth) => depthPref.set({ ...depthPref.get(), [docKey()]: d });

/** Whether a row shows under a filter. Overview alone shows the summary rows; a chip or words show matching task rows. */
export function rowShown(r: DirRow, f: DirFilter): boolean {
  if (!isFiltered(f)) return f.depth === 'full' || r.summary;
  if (r.summary) return false;
  if (f.states.size && !f.states.has(r.el.dataset.state as never)) return false;
  const q = f.q.trim().toLowerCase();
  return !q || (r.el.textContent ?? '').toLowerCase().includes(q);
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

/** Show the doc as a filter asks. */
export function applyView(root: HTMLElement, model: DirModel, f: DirFilter): void {
  const narrowed = isFiltered(f);
  const overview = f.depth === 'overview' && !narrowed;
  root.dataset.dirView = overview ? 'overview' : narrowed ? 'filtered' : 'all';
  for (const r of model.rows) r.el.hidden = !rowShown(r, f);
  const kids = [...root.children] as HTMLElement[];
  const filtered = overview || narrowed;
  // Rows that are not tasks (a legend's lines) step aside in any narrowed view.
  const known = new Set<Element>(model.rows.map(r => r.el));
  root.querySelectorAll('tbody tr').forEach(tr => { if (!known.has(tr) && !tr.closest('.fe-dir-list')) tr.toggleAttribute('data-view-hide', filtered); });
  for (const k of kids) {
    k.toggleAttribute('data-view-hide', false);
    if (!filtered || k.matches('h1, .fe-dir-next, .fe-dir-sum, .fe-dir-list, .fe-md-fm')) continue;
    const table = k.matches('table') ? k : k.querySelector(':scope > table');
    if (table) {
      const shown = [...table.querySelectorAll<HTMLTableRowElement>('tbody tr')].some(r => !r.hidden && !r.hasAttribute('data-view-hide'));
      k.toggleAttribute('data-view-hide', !shown);
      continue;
    }
    if (/^H[23]$/.test(k.tagName)) {
      if (overview) continue;
      // A heading stays when any row under it shows.
      const s = model.sections.find(x => x.el === k);
      const any = !!s && model.rows.some(r => !r.el.hidden && within(r.section, s));
      k.toggleAttribute('data-view-hide', !any);
      continue;
    }
    if (/^H[456]$/.test(k.tagName)) { k.toggleAttribute('data-view-hide', true); continue; }
    // Prose: the overview keeps where things stand, the done-when lines and the intro; a narrowed doc keeps only done-when lines.
    const s = sectionOf(k, model);
    const keep = overview ? (!s || standing(s) || isAccepted(k)) : isAccepted(k) && !!s && model.rows.some(r => !r.el.hidden && within(r.section, s));
    k.toggleAttribute('data-view-hide', !keep);
  }
}

/** The Overview / Full switch for the state bar; `onChange` hears the user's picks. */
export function mountDepth(host: HTMLElement, onChange: (d: DirDepth) => void): { set(d: DirDepth): void } {
  const wrap = document.createElement('div');
  wrap.className = 'fe-dir-views';
  wrap.innerHTML = segHtml('fe-dir-view', DIR_DEPTHS.map(v => ({ value: v.id, icon: v.icon, hint: v.hint })), 'How much of the doc to show');
  host.append(wrap);
  upgradeControls(wrap);
  const seg = wrap.querySelector<HTMLElement & { value: string }>('.fe-seg')!;
  let quiet = false;
  seg.addEventListener('change', () => { if (!quiet) onChange(seg.value as DirDepth); });
  return { set(d) { if (seg.value === d) return; quiet = true; seg.value = d; quiet = false; } };
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
