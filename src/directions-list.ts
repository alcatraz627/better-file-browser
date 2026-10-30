// The List layout of a directions doc: every task row in one table, grouped by
// direction, each group with a bar of how its rows stand. It shows exactly the
// rows the doc would show under the same filter, because it reads what the doc
// view left visible rather than filtering on its own. A row jumps to its place
// in the doc; a group heading folds its rows or opens its section.
import { esc } from './utils';
import { jsonPref } from './storage';
import { segHtml, upgradeControls } from './controls';
import { UI_ICON } from './control-icons';
import { pillHtml, meterHtml } from './docview-status';
import { directionOf, type DirModel, type DirRow, type DirSection } from './directions-model';
import type { DirState } from './directions';
import { isFiltered, type DirFilter, type DirLayout } from './directions-state';

const layoutPref = jsonPref<Record<string, DirLayout>>('bfb-dir-layout-v1', {}, v => !!v && typeof v === 'object' && !Array.isArray(v));
const docKey = () => decodeURIComponent(location.pathname);
export const savedLayout = (): DirLayout | undefined => layoutPref.get()[docKey()];
export const saveLayout = (l: DirLayout) => layoutPref.set({ ...layoutPref.get(), [docKey()]: l });

const STATES: { id: DirState; label: string }[] = [
  { id: 'needs', label: 'needs you' }, { id: 'waiting', label: 'waiting' }, { id: 'ready', label: 'ready' }, { id: 'parked', label: 'parked' }, { id: 'done', label: 'done' },
];
const plain = (t: string) => t.replace(/[\u{1F300}-\u{1FAFF}☀-➿⏩-⏺️]/gu, '').replace(/\s{2,}/g, ' ').trim();

interface Group { key: string; title: string; section: DirSection | null; rows: DirRow[] }

/** One link a row points at, named the way a reader would say it. */
export interface RowLink { kind: 'pr' | 'issue' | 'commit' | 'linear' | 'doc' | 'web' | 'file'; label: string; title: string; href: string }

const GOOGLE: Record<string, string> = { document: 'Google Doc', spreadsheets: 'Google Sheet', presentation: 'Google Slides' };

/** What a link in a row is: a PR, an issue, a commit, a Linear ticket, a
 *  Google doc, any other page, or a file. `raw` is the link as written in the
 *  doc; `href` is where it resolves. A link within the page is not one. */
export function linkOf(raw: string, href = raw): RowLink | null {
  if (!raw || raw.startsWith('#') || /^(mailto|javascript):/i.test(raw)) return null;
  const gh = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues|commit)\/([0-9a-f]+)/i.exec(raw);
  if (gh) {
    const [, org, repo, what, n] = gh;
    if (what === 'commit') return { kind: 'commit', label: n.slice(0, 7), title: `Commit ${n.slice(0, 7)} in ${org}/${repo}`, href };
    return what === 'pull'
      ? { kind: 'pr', label: `PR #${n}`, title: `Pull request #${n} in ${org}/${repo}`, href }
      : { kind: 'issue', label: `#${n}`, title: `Issue #${n} in ${org}/${repo}`, href };
  }
  const lin = /^https?:\/\/linear\.app\/[^/]+\/issue\/([a-z]+-\d+)/i.exec(raw);
  if (lin) return { kind: 'linear', label: lin[1].toUpperCase(), title: `Linear ${lin[1].toUpperCase()}`, href };
  const gd = /^https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\//i.exec(raw);
  if (gd) return { kind: 'doc', label: GOOGLE[gd[1].toLowerCase()], title: raw, href };
  if (/^https?:\/\//i.test(raw)) {
    try { return { kind: 'web', label: new URL(raw).hostname.replace(/^www\./, ''), title: raw, href }; } catch { return null; }
  }
  const path = decodeURIComponent(raw.replace(/^file:\/\//, '').split(/[?#]/)[0]).replace(/\/+$/, '');
  const name = path.split('/').pop();
  return name ? { kind: 'file', label: name, title: path, href } : null;
}

/** The links in a row, in order and each once. */
export function rowLinks(el: HTMLTableRowElement): RowLink[] {
  const seen = new Set<string>();
  const out: RowLink[] = [];
  [...el.cells].forEach(c => c.querySelectorAll('a[href]').forEach(a => {
    const l = linkOf(a.getAttribute('href') ?? '', (a as HTMLAnchorElement).href);
    if (l && !seen.has(l.href)) { seen.add(l.href); out.push(l); }
  }));
  return out;
}

const LINK_ICON: Record<RowLink['kind'], string> = {
  pr: UI_ICON.versions, issue: UI_ICON.circleDashed, commit: UI_ICON.fmtCode, linear: UI_ICON.task, doc: UI_ICON.contents, web: UI_ICON.external, file: UI_ICON.file,
};
const chipsHtml = (ls: RowLink[]) => ls.map(l =>
  `<a class="chip fe-dl-link" data-kind="${l.kind}" href="${esc(l.href)}" target="_blank" rel="noopener" title="${esc(l.title)}">${LINK_ICON[l.kind]}<span>${esc(l.label)}</span></a>`).join('');

/** Task rows in doc order, grouped by direction, with the ask table first. */
export function groupRows(m: DirModel): Group[] {
  const groups = new Map<string, Group>();
  for (const r of m.rows) {
    if (r.summary) continue;
    const d = directionOf(r.section, m);
    const key = d === 'other' ? 'other' : d ? String(m.sections.indexOf(d)) : 'none';
    const title = d === 'other' ? 'Other sections' : d ? plain(d.title) : 'Before the first heading';
    if (!groups.has(key)) groups.set(key, { key, title, section: d && d !== 'other' ? d : null, rows: [] });
    groups.get(key)!.rows.push(r);
  }
  return [...groups.values()].sort((a, b) => Number(b.section?.kind === 'waiting') - Number(a.section?.kind === 'waiting'));
}

const meterOf = (rows: DirRow[]) => {
  const n = (s: DirState) => rows.filter(r => r.el.dataset.state === s).length;
  const done = n('done');
  return meterHtml(STATES.map(s => ({ state: s.id, n: n(s.id), label: s.label })), `${done}/${rows.length}`, `${done} of ${rows.length} done`);
};

/** The list's markup for the rows the doc view shows; `brief` folds every group to its heading. */
export function listHtml(m: DirModel, groups: Group[], brief: boolean, open: Set<string>): string {
  const at = (r: DirRow) => m.rows.indexOf(r);
  // The links column shows only when some row has a link; each row lists its own.
  const links = new Map(groups.flatMap(g => g.rows).map(r => [r, rowLinks(r.el)]));
  const linked = [...links.values()].some(ls => ls.length);
  const cols = linked ? 5 : 4;
  const body = groups.map(g => {
    const shown = brief ? g.rows : g.rows.filter(r => !r.el.hidden);
    if (!shown.length) return '';
    const folded = brief ? !open.has(g.key) : open.has('-' + g.key);
    const rows = folded ? '' : shown.map(r => {
      const st = r.el.dataset.state as DirState | undefined;
      const label = STATES.find(s => s.id === st)?.label;
      const sub = r.need || (r.section && r.section !== g.section ? plain(r.section.title) : '');
      return `<tr data-row="${at(r)}"${st ? ` data-state="${st}"` : ''}><td class="fe-dl-st">${st ? pillHtml(st, label!) : '<span class="fe-dl-none">unmarked</span>'}</td>`
        + `<td class="fe-dl-id">${r.id ? esc(r.id) : ''}</td><td class="fe-dl-t"><span class="fe-dl-tx">${esc(plain(r.text || 'Row'))}</span>${sub ? `<span class="fe-dl-sub">${esc(plain(sub))}</span>` : ''}</td>`
        + (linked ? `<td class="fe-dl-links">${chipsHtml(links.get(r) ?? [])}</td>` : '')
        + `<td class="fe-dl-when">${r.when ?? ''}</td></tr>`;
    }).join('');
    return `<tbody data-group="${esc(g.key)}"><tr class="fe-dl-g"><th colspan="${cols}"><span class="fe-dl-gh">`
      + `<button type="button" class="fe-dl-fold" aria-expanded="${!folded}" title="${folded ? 'Show' : 'Hide'} these rows">${esc(g.title)}</button>`
      + `${meterOf(g.rows)}<span class="fe-dl-n">${shown.length}${shown.length !== g.rows.length ? ` of ${g.rows.length}` : ''}</span>`
      + `${g.section ? `<button type="button" class="fe-dl-go" data-sec="${esc(g.section.el.id)}" title="Read this section in the doc">In doc</button>` : ''}</span></th></tr>${rows}</tbody>`;
  }).join('');
  return body ? `<table class="fe-dl">${body}</table>` : '<p class="fe-dl-empty">No row matches the filter.</p>';
}

/** The Doc / List switch, for the state bar; `onChange` hears the user's picks. */
export function mountLayoutSeg(host: HTMLElement, onChange: (l: DirLayout) => void): { set(l: DirLayout): void } {
  const wrap = document.createElement('div');
  wrap.className = 'fe-dir-layout';
  wrap.innerHTML = segHtml('fe-dir-layout', [
    { value: 'doc', icon: UI_ICON.file, hint: 'Doc: the doc as written' },
    { value: 'list', icon: UI_ICON.list, hint: 'List: every row in one list, grouped by direction' },
  ], 'Doc or list');
  host.prepend(wrap);
  upgradeControls(wrap);
  const seg = wrap.querySelector<HTMLElement & { value: string }>('.fe-seg')!;
  let quiet = false;
  seg.addEventListener('change', () => { if (!quiet) onChange(seg.value as DirLayout); });
  return { set(l) { if (seg.value === l) return; quiet = true; seg.value = l; quiet = false; } };
}

export interface ListHooks {
  /** Show a row in the doc. */
  row(row: HTMLTableRowElement): void;
  /** Read a section in the doc. */
  section(id: string): void;
}

/** The list box, placed after the bar; `paint` draws it for a filter. */
export function mountList(bar: HTMLElement, m: DirModel, hooks: ListHooks): { paint(f: DirFilter): void } {
  const box = document.createElement('div');
  box.className = 'fe-dir-list';
  box.hidden = true;
  bar.after(box);
  const groups = groupRows(m);
  const open = new Set<string>();
  let last: DirFilter | null = null;
  const paint = (f: DirFilter) => {
    last = f;
    box.hidden = f.layout !== 'list';
    if (!box.hidden) box.innerHTML = listHtml(m, groups, f.depth === 'overview' && !isFiltered(f), open);
  };
  box.addEventListener('click', e => {
    const t = e.target as Element;
    if (t.closest('.fe-dl-link')) return;   // a link chip opens its link, not the row
    const fold = t.closest<HTMLElement>('.fe-dl-fold');
    if (fold && last) {
      const key = fold.closest<HTMLElement>('[data-group]')!.dataset.group!;
      const k = last.depth === 'overview' && !isFiltered(last) ? key : '-' + key;
      if (open.has(k)) open.delete(k); else open.add(k);
      paint(last);
      return;
    }
    const sec = t.closest<HTMLElement>('[data-sec]');
    if (sec) { hooks.section(sec.dataset.sec!); return; }
    const row = m.rows[Number(t.closest<HTMLElement>('tr[data-row]')?.dataset.row)]?.el;
    if (row) hooks.row(row);
  });
  return { paint };
}

/** A row of the list, for the head's links while the list shows. */
export function listRow(box: ParentNode, at: number): HTMLTableRowElement | null {
  return box.querySelector<HTMLTableRowElement>(`.fe-dir-list tr[data-row="${at}"]`);
}
