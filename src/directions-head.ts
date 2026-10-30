// The top of a directions doc answers "what do I do next" in two short
// lists: what waits on the owner (the Waiting-on-you asks first) and what an
// agent can pick up now, three lines each. Each item jumps to its row, so the
// ask is read in its own context; what happens on silence shows on hover.
// Whether the doc has gone stale sits in the state bar beside it.
import { esc } from './utils';
import type { DirModel, DirRow } from './directions-model';

const CAP = 3;
const STALE_DAYS = 3;
const WHEN_ORDER = { now: 0, next: 1, later: 3 } as const;

export interface NextHead {
  you: DirRow[];
  ready: DirRow[];
  /** Whole days since the doc's last update, when that is more than a few. */
  staleDays: number | null;
  waiting: number;
}

/** Sort the doc's rows into the three lists. */
export function nextHead(m: DirModel, now = new Date()): NextHead {
  const tasks = m.rows.filter(r => !r.summary);
  const asks = tasks.filter(r => r.asks);
  const ids = new Set(asks.map(r => r.id).filter(Boolean));
  const you = [...asks, ...tasks.filter(r => !r.asks && r.state === 'needs' && !(r.id && ids.has(r.id)))];
  const ready = tasks
    .map((r, i) => ({ r, i }))
    .filter(x => x.r.state === 'ready')
    .sort((a, b) => (WHEN_ORDER[a.r.when ?? 'next'] + (a.r.when ? 0 : 0.5)) - (WHEN_ORDER[b.r.when ?? 'next'] + (b.r.when ? 0 : 0.5)) || a.i - b.i)
    .map(x => x.r);
  const days = m.lastUpdated ? Math.floor((now.getTime() - m.lastUpdated.getTime()) / 86400000) : null;
  return { you, ready, staleDays: days !== null && days > STALE_DAYS ? days : null, waiting: tasks.filter(r => r.state === 'waiting').length };
}

// The doc's marks are already said by the group and its words; shown text drops them.
const plain = (t: string) => t.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u23E9-\u23FA\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim();
// One line per item: the id, what it is, and one muted clause; the rest of the ask reads on hover.
const item = (r: DirRow, i: number, sub: string, tip: string) => `<li><button type="button" class="fe-dir-next-i" data-row="${i}"${tip ? ` title="${esc(tip)}"` : ''}>${r.id ? `<span class="fe-dir-next-id">${esc(r.id)}</span>` : ''}<span class="fe-dir-next-t">${esc(plain(r.text || r.section?.title || 'Row'))}</span>${sub ? `<span class="fe-dir-next-sub">${sub}</span>` : ''}</button></li>`;

/** The head's markup. Row numbers index into the model's rows. */
export function nextHeadHtml(m: DirModel, h: NextHead): string {
  const at = (r: DirRow) => m.rows.indexOf(r);
  // The count is the state chip's own: every row in that state, so the head and the bar agree.
  const inState = (s: string) => m.rows.filter(r => !r.summary && (r.el.dataset.state ?? r.state) === s).length;
  const group = (key: string, title: string, rows: DirRow[], sub: (r: DirRow) => string, tip: (r: DirRow) => string, empty: string, more: string) => {
    const n = Math.max(inState(more), rows.length);
    return `
    <div class="fe-dir-next-g" data-g="${key}">
      <div class="sect" data-level="group" role="heading" aria-level="3">${title}<span class="fe-grp-n">${n || ''}</span>${n > CAP ? `<button type="button" class="fe-dir-next-more" data-more="${more}" title="Show every row in this state">all ${n}</button>` : ''}</div>
      ${rows.length ? `<ol>${rows.slice(0, CAP).map(r => item(r, at(r), sub(r), tip(r))).join('')}</ol>` : `<p class="fe-dir-next-none">${empty}</p>`}
    </div>`;
  };
  const youSub = (r: DirRow) => r.need ? esc(r.need) : r.section && !r.asks ? esc(plain(r.section.title)) : '';
  const youTip = (r: DirRow) => [r.need, r.silent && `If you say nothing: ${r.silent}`].filter(Boolean).join('\n');
  const readySub = (r: DirRow) => [r.when, r.section && plain(r.section.title)].filter(Boolean).map(s => esc(s!)).join(' · ');
  return `${group('you', 'On you', h.you, youSub, youTip, 'Nothing waits on you.', 'needs')}${group('ready', 'Ready for an agent', h.ready, readySub, () => '', 'Nothing is ready to pick up.', 'ready')}`;
}

/** How fresh the doc is, for the state bar: days since its update when stale, and what waits on others. */
export function staleHtml(h: NextHead): string {
  const parts = [h.staleDays !== null ? `updated ${h.staleDays} days ago` : '', h.waiting ? `${h.waiting} waiting on others` : ''].filter(Boolean);
  return parts.length ? `<span class="fe-dir-next-stale">${parts.join(' · ')}</span>` : '';
}
