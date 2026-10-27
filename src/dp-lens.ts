// The Decisions lens: every page an agent asked the owner to answer, from
// gcc's registry, in three bands (waiting on you, answered, never answered),
// newest first. A page waiting and never opened carries a dot. Each row says
// where it came from and how old it is; a click opens the page. The list
// refreshes every 10 seconds while the lens is open, so a new ask shows up
// without a reload. Read only: gcc writes the registry.
import { notes } from './notes';
import { esc, whenText } from './utils';
import { UI_ICON } from './control-icons';
import { addPaletteSource } from './commands';
import { emptyHtml, CLEAR } from './empty-state';
import { errorText } from './errors';
import { DISCLOSE } from './icons';
import { jsonPref } from './storage';

export interface DpRow {
  slug: string; path: string; title?: string; items?: number; mtime: number; answered?: number | null;
  state: 'waiting' | 'answered' | 'cleared' | 'never' | 'broken'; seen?: boolean; broken?: boolean;
  origin?: { project?: string; topic?: string; session?: string; goal?: string; milestone?: string; card?: string; board?: string };
  /** For a waiting page gcc lists as pending: whether the agent that asked can be woken. */
  reach?: 'hot' | 'cold' | 'absent' | 'unknown';
  /** For an answered page: whether the agent that asked was told. */
  told?: 'requested' | 'queued' | 'undelivered' | 'no-origin' | null;
}

/** How each reach reads on a row, and where it sorts: a live agent first, a gone one last. */
export const REACH: Record<NonNullable<DpRow['reach']>, { label: string; tip: string; rank: number }> = {
  hot: { label: 'agent live', tip: 'The agent that asked is running and sees your answer at once', rank: 0 },
  cold: { label: 'agent idle', tip: 'The agent that asked is idle; it sees your answer when it next runs', rank: 1 },
  unknown: { label: 'agent unknown', tip: 'Could not tell whether the agent that asked is running', rank: 1 },
  absent: { label: 'agent gone', tip: 'The session that asked has ended; your answer is kept for whoever picks this up', rank: 2 },
};
const reachRank = (r: DpRow) => (r.reach ? REACH[r.reach].rank : 1);

/** Where a row is listed. Answered pages, pages an agent marked handled, and
 *  pages archived by hand all sit in Archived, last and folded. */
export type DpBand = 'waiting' | 'never' | 'broken' | 'archived';
export const BANDS: { state: DpBand; label: string }[] = [
  { state: 'waiting', label: 'Waiting on you' },
  { state: 'never', label: 'Never answered' },
  { state: 'broken', label: 'Cannot be read' },
  { state: 'archived', label: 'Archived' },
];
export const bandOf = (r: DpRow, archived: ReadonlySet<string> = new Set()): DpBand =>
  archived.has(r.slug) || r.state === 'answered' || r.state === 'cleared' ? 'archived' : r.state;

/** The rows a filter keeps, banded in BANDS order. Inside a band a live agent's
 *  page comes first and a gone one's last, newest first otherwise. */
export function dpBands(rows: DpRow[], q = '', archived: ReadonlySet<string> = new Set()): { state: DpBand; label: string; rows: DpRow[] }[] {
  const n = q.trim().toLowerCase();
  const hit = (r: DpRow) => !n || [r.title, r.slug, r.origin?.project, r.origin?.topic].some(v => v?.toLowerCase().includes(n));
  return BANDS.map(b => ({ ...b, rows: rows.filter(r => bandOf(r, archived) === b.state && hit(r)).sort((a, z) => reachRank(a) - reachRank(z) || z.mtime - a.mtime) })).filter(b => b.rows.length);
}

// Pages archived by hand, by slug, in this browser.
const archivedPref = jsonPref<string[]>('bfb-dp-archived-v1', [], Array.isArray);

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
  const folded = new Set<string>(['never', 'archived']);
  const archived = () => new Set(archivedPref.get());
  box.innerHTML = `<div class="bar fe-lens-tools" data-inset hidden>
      <label class="fe-lens-box"><input id="fe-dpl-q" class="tb" data-size="lg" data-lead="search" type="search" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches a page's title, name, project and topic. Esc clears."></label>
    </div><div class="fe-dpl-rows"></div>`;
  const top = box.querySelector<HTMLElement>('.fe-lens-tools')!, rowsBox = box.querySelector<HTMLElement>('.fe-dpl-rows')!;
  const input = box.querySelector<HTMLInputElement>('#fe-dpl-q')!;
  const rowHtml = (r: DpRow) => {
    const unseen = r.state === 'waiting' && !r.seen;
    const when = r.state === 'answered' && r.answered ? r.answered : r.mtime;
    const byHand = archived().has(r.slug);
    // Archive by hand any page that is not already archived; take one back the same way.
    const arch = r.state === 'answered' || r.state === 'cleared' ? ''
      : `<span class="btn fe-dpl-arch" role="button" tabindex="-1" data-icon data-size="xs" data-arch="${esc(r.slug)}" title="${byHand ? 'Put back' : 'Archive'}" aria-label="${byHand ? 'Put back' : 'Archive'} ${esc(r.title ?? r.slug)}">${byHand ? UI_ICON.reset : UI_ICON.archive}</span>`;
    const origin = originLine(r.origin);
    const reach = r.reach && REACH[r.reach];
    const reachHtml = reach ? `<span class="fe-dpl-reach" data-reach="${r.reach}" title="${esc(reach.tip)}">${esc(reach.label)}</span>` : '';
    // An answer nobody heard is said on the row, so a failed wake is never silent.
    const lost = r.state === 'answered' && r.told === 'undelivered';
    const toldHtml = lost ? `<span class="fe-dpl-told" data-told="undelivered" title="The answer was saved, but the agent that asked could not be told. It sees it next time it reads its pages.">agent not told</span>` : '';
    const sub = [toldHtml, reachHtml, origin && esc(origin)].filter(Boolean).join(' · ');
    return `<button type="button" class="row fe-dpl-row${unseen ? ' unseen' : ''}"${lost ? ' data-told="undelivered"' : ''} data-path="${esc(r.path)}" data-slug="${esc(r.slug)}"${r.reach ? ` data-reach="${r.reach}"` : ''} title="${esc(r.title ?? r.slug)}${unseen ? ' · you have not opened this one yet' : ''}${reach ? ` · ${esc(reach.tip)}` : ''}">
        <span class="fe-row-ico">${UI_ICON.opinion}${unseen ? '<i class="fe-dpl-dot" aria-label="Not opened yet"></i>' : ''}</span>
        <span class="fe-dpl-tx"><span class="fe-dpl-title">${esc(r.title ?? r.slug)}</span>${sub ? `<span class="fe-dpl-origin">${sub}</span>` : ''}</span>
        <span class="fe-dpl-age" title="${esc(whenText(when * 1000))}">${esc(ago(when))}</span>
        ${arch}${r.items ? `<span class="badge fe-dpl-n" data-tone="${r.state === 'waiting' ? 'solid' : 'quiet'}" title="${r.items} item${r.items === 1 ? '' : 's'}">${r.items}</span>` : ''}
      </button>`;
  };
  const paint = () => {
    top.hidden = !all.length;
    if (!all.length) { rowsBox.innerHTML = emptyHtml('empty', 'No decision pages yet', { icon: UI_ICON.opinion, hintHtml: 'Pages an agent asks you<br>to answer show up here' }); return; }
    const bands = dpBands(all, q, archived());
    if (!bands.length) { rowsBox.innerHTML = emptyHtml('filtered', 'No page matches', { actions: [CLEAR] }); return; }
    // A filter opens every band so no match hides inside a folded one.
    rowsBox.innerHTML = bands.map(b => `<details class="fe-grp fe-dpl-band" data-band="${b.state}"${q || !folded.has(b.state) ? ' open' : ''}>
        <summary class="sect" data-level="group">${DISCLOSE}${esc(b.label)}<span class="fe-grp-n">${b.rows.length}</span></summary>
        <div class="fe-grp-body">${b.rows.map(rowHtml).join('')}</div>
      </details>`).join('');
  };
  // Only the newest read counts: one begun before an answer was sent must not
  // put the page back under Waiting when it lands.
  let seq = 0;
  const load = () => { const mine = ++seq; return notes.dpPages().then(rows => { if (mine === seq) { all = rows; paint(); } }).catch(err => {
    if (mine !== seq) return;
    top.hidden = true;
    rowsBox.innerHTML = emptyHtml('failed', 'Decision pages could not be listed', { hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'List the decision pages again' }] });
  }); };
  input.addEventListener('input', () => { q = input.value; paint(); });
  rowsBox.addEventListener('toggle', e => {
    const d = e.target as HTMLDetailsElement;
    if (!d.dataset?.band || q) return;
    if (d.open) folded.delete(d.dataset.band); else folded.add(d.dataset.band);
  }, true);
  rowsBox.addEventListener('click', e => {
    const arch = (e.target as Element).closest<HTMLElement>('[data-arch]');
    if (arch) {
      e.stopPropagation();
      const slug = arch.dataset.arch!, now = archivedPref.get();
      archivedPref.set(now.includes(slug) ? now.filter(s => s !== slug) : [...now, slug]);
      paint();
      return;
    }
    const b = (e.target as Element).closest<HTMLElement>('.fe-dpl-row');
    if (b) { go(b.dataset.path! + '/'); return; }
    const a = (e.target as Element).closest<HTMLElement>('.empty [data-a]')?.dataset.a;
    if (a === 'clear') { input.value = ''; q = ''; paint(); input.focus(); }
    else if (a === 'retry') { rowsBox.innerHTML = emptyHtml('loading', 'Loading…'); void load(); }
  });
  // Every page is in the palette too; the list loads on first use.
  addPaletteSource(() => (loaded ? Promise.resolve(all) : (loaded = true, load().then(() => all))).then(rows => dpBands(rows).flatMap(b => b.rows).map(r => ({
    title: r.title ?? r.slug, sub: `${BANDS.find(x => x.state === bandOf(r, archived()))!.label} · ${ago(r.mtime)}`, group: 'Decisions',
    icon: UI_ICON.opinion, run: () => go(r.path + '/'),
  }))));
  // An answer sent from the page: its row moves to Answered at once, and the
  // registry is read again to confirm.
  document.addEventListener('bfb-dp-answered', e => {
    const slug = (e as CustomEvent).detail as string;
    const row = all.find(r => r.slug === slug);
    if (!row) return;
    seq++;
    row.state = 'answered'; row.answered = Date.now() / 1000; row.seen = true;
    paint();
    if (timer) void load();
  });
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
