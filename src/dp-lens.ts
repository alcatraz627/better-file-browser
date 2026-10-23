// The Decisions lens: every page an agent asked the owner to answer, from
// gcc's registry, in three bands (waiting on you, answered, never answered),
// newest first. A page waiting and never opened carries a dot. Each row says
// where it came from and how old it is; a click opens the page. The list
// refreshes every 10 seconds while the lens is open, so a new ask shows up
// without a reload. Read only: gcc writes the registry.
import { notes } from './notes';
import { esc } from './utils';
import { UI_ICON } from './control-icons';
import { addPaletteSource } from './commands';
import { emptyHtml, CLEAR } from './empty-state';
import { errorText } from './errors';
import { DISCLOSE } from './icons';

export interface DpRow {
  slug: string; path: string; title?: string; items?: number; mtime: number; answered?: number | null;
  state: 'waiting' | 'answered' | 'never' | 'broken'; seen?: boolean; broken?: boolean;
  origin?: { project?: string; topic?: string; session?: string; goal?: string; milestone?: string; card?: string; board?: string };
}

export const BANDS: { state: DpRow['state']; label: string }[] = [
  { state: 'waiting', label: 'Waiting on you' },
  { state: 'answered', label: 'Answered' },
  { state: 'never', label: 'Never answered' },
  { state: 'broken', label: 'Cannot be read' },
];

/** The rows a filter keeps, banded in BANDS order and newest first within a band. */
export function dpBands(rows: DpRow[], q = ''): { state: DpRow['state']; label: string; rows: DpRow[] }[] {
  const n = q.trim().toLowerCase();
  const hit = (r: DpRow) => !n || [r.title, r.slug, r.origin?.project, r.origin?.topic].some(v => v?.toLowerCase().includes(n));
  return BANDS.map(b => ({ ...b, rows: rows.filter(r => r.state === b.state && hit(r)).sort((a, z) => z.mtime - a.mtime) })).filter(b => b.rows.length);
}

/** How long ago, in the words a person would use: "just now", "5 min", "3 h", "2 d", "6 w". */
export function ago(sec: number, now = Date.now() / 1000): string {
  const s = Math.max(0, now - sec);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)} d`;
  return `${Math.floor(s / (86400 * 7))} w`;
}

const originLine = (o: DpRow['origin']) => [o?.project, o?.topic, o?.goal && `goal ${o.goal}`, o?.milestone, o?.card && `card ${o.card}`].filter(Boolean).join(' · ');

export function initDpLens(box: HTMLElement, go: (path: string) => void): void {
  let all: DpRow[] = [], q = '', loaded = false, timer: ReturnType<typeof setInterval> | null = null;
  const folded = new Set<string>(['never']);
  box.innerHTML = `<div class="bar fe-lens-tools" data-inset hidden>
      <label class="fe-lens-box"><input id="fe-dpl-q" class="tb" data-size="lg" data-lead="search" type="search" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches a page's title, name, project and topic. Esc clears."></label>
    </div><div class="fe-dpl-rows"></div>`;
  const top = box.querySelector<HTMLElement>('.fe-lens-tools')!, rowsBox = box.querySelector<HTMLElement>('.fe-dpl-rows')!;
  const input = box.querySelector<HTMLInputElement>('#fe-dpl-q')!;
  const rowHtml = (r: DpRow) => {
    const unseen = r.state === 'waiting' && !r.seen;
    const when = r.state === 'answered' && r.answered ? r.answered : r.mtime;
    const origin = originLine(r.origin);
    return `<button type="button" class="row fe-dpl-row${unseen ? ' unseen' : ''}" data-path="${esc(r.path)}" data-slug="${esc(r.slug)}" title="${esc(r.title ?? r.slug)}${unseen ? ' · you have not opened this one yet' : ''}">
        <span class="fe-row-ico">${UI_ICON.opinion}${unseen ? '<i class="fe-dpl-dot" aria-label="Not opened yet"></i>' : ''}</span>
        <span class="fe-dpl-tx"><span class="fe-dpl-title">${esc(r.title ?? r.slug)}</span>${origin ? `<span class="fe-dpl-origin">${esc(origin)}</span>` : ''}</span>
        <span class="fe-dpl-age" title="${esc(new Date(when * 1000).toLocaleString())}">${esc(ago(when))}</span>
        ${r.items ? `<span class="badge fe-dpl-n" data-tone="${r.state === 'waiting' ? 'solid' : 'quiet'}" title="${r.items} item${r.items === 1 ? '' : 's'}">${r.items}</span>` : ''}
      </button>`;
  };
  const paint = () => {
    top.hidden = !all.length;
    if (!all.length) { rowsBox.innerHTML = emptyHtml('empty', 'No decision pages yet', { icon: UI_ICON.opinion, hintHtml: 'Pages an agent asks you<br>to answer show up here' }); return; }
    const bands = dpBands(all, q);
    if (!bands.length) { rowsBox.innerHTML = emptyHtml('filtered', 'No page matches', { actions: [CLEAR] }); return; }
    // A filter opens every band so no match hides inside a folded one.
    rowsBox.innerHTML = bands.map(b => `<details class="fe-grp fe-dpl-band" data-band="${b.state}"${q || !folded.has(b.state) ? ' open' : ''}>
        <summary class="sect" data-level="group">${DISCLOSE}${esc(b.label)}<span class="fe-grp-n">${b.rows.length}</span></summary>
        <div class="fe-grp-body">${b.rows.map(rowHtml).join('')}</div>
      </details>`).join('');
  };
  const load = () => notes.dpPages().then(rows => { all = rows; paint(); }).catch(err => {
    top.hidden = true;
    rowsBox.innerHTML = emptyHtml('failed', 'Decision pages could not be listed', { hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'List the decision pages again' }] });
  });
  input.addEventListener('input', () => { q = input.value; paint(); });
  rowsBox.addEventListener('toggle', e => {
    const d = e.target as HTMLDetailsElement;
    if (!d.dataset?.band || q) return;
    if (d.open) folded.delete(d.dataset.band); else folded.add(d.dataset.band);
  }, true);
  rowsBox.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-dpl-row');
    if (b) { go(b.dataset.path! + '/'); return; }
    const a = (e.target as Element).closest<HTMLElement>('.empty [data-a]')?.dataset.a;
    if (a === 'clear') { input.value = ''; q = ''; paint(); input.focus(); }
    else if (a === 'retry') { rowsBox.innerHTML = emptyHtml('loading', 'Loading…'); void load(); }
  });
  // Every page is in the palette too; the list loads on first use.
  addPaletteSource(() => (loaded ? Promise.resolve(all) : (loaded = true, load().then(() => all))).then(rows => dpBands(rows).flatMap(b => b.rows).map(r => ({
    title: r.title ?? r.slug, sub: `${BANDS.find(x => x.state === r.state)!.label} · ${ago(r.mtime)}`, group: 'Decisions',
    icon: UI_ICON.opinion, run: () => go(r.path + '/'),
  }))));
  // Poll only while the lens is open and the tab is in front.
  document.addEventListener('bfb-lens', e => {
    const on = (e as CustomEvent).detail === 'decisions';
    if (timer) { clearInterval(timer); timer = null; }
    if (!on) return;
    if (!loaded) rowsBox.innerHTML = emptyHtml('loading', 'Loading…');
    loaded = true;
    void load();
    timer = setInterval(() => { if (!document.hidden) void load(); }, 10_000);
  });
}
