// The top of a directions doc answers "what do I do next" in three short
// lists: what waits on the owner (the Waiting-on-you asks first, each with
// what is needed and what happens on silence), what an agent can pick up
// now, and whether the doc has gone stale. Each item jumps to its row, so the
// ask is read in its own context; nothing is copied out of the doc.
import { esc } from './utils';
import type { DirModel, DirRow } from './directions-model';

const CAP = 5;
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
const item = (r: DirRow, i: number, sub: string) => `<li><button type="button" class="fe-dir-next-i" data-row="${i}">${r.id ? `<span class="fe-dir-next-id">${esc(r.id)}</span>` : ''}<span class="fe-dir-next-t">${esc(plain(r.text || r.section?.title || 'Row'))}</span></button>${sub ? `<div class="fe-dir-next-sub">${sub}</div>` : ''}</li>`;

/** The head's markup. Row numbers index into the model's rows. */
export function nextHeadHtml(m: DirModel, h: NextHead): string {
  const at = (r: DirRow) => m.rows.indexOf(r);
  const group = (key: string, title: string, rows: DirRow[], sub: (r: DirRow) => string, empty: string, more: string) => `
    <div class="fe-dir-next-g" data-g="${key}">
      <div class="sect" data-level="group" role="heading" aria-level="3">${title}<span class="fe-grp-n">${rows.length || ''}</span></div>
      ${rows.length ? `<ol>${rows.slice(0, CAP).map(r => item(r, at(r), sub(r))).join('')}</ol>` : `<p class="fe-dir-next-none">${empty}</p>`}
      ${rows.length > CAP ? `<button type="button" class="fe-dir-next-more" data-more="${more}">and ${rows.length - CAP} more</button>` : ''}
    </div>`;
  const youSub = (r: DirRow) => [r.need && `<span>${esc(r.need)}</span>`, r.silent && `<span class="fe-dir-next-silent">If you say nothing: ${esc(r.silent)}</span>`, !r.need && !r.silent && r.section && !r.asks ? `<span>${esc(plain(r.section.title))}</span>` : ''].filter(Boolean).join('');
  const readySub = (r: DirRow) => [r.when && `<span class="fe-dir-next-when">${r.when}</span>`, r.section && `<span>${esc(plain(r.section.title))}</span>`].filter(Boolean).join('');
  const stale = h.staleDays !== null || h.waiting
    ? `<p class="fe-dir-next-stale">${[h.staleDays !== null ? `Last updated ${h.staleDays} days ago` : '', h.waiting ? `${h.waiting} waiting on others` : ''].filter(Boolean).join(' · ')}</p>` : '';
  return `<div class="sect fe-dir-next-h" data-level="panel">What to do next</div>${group('you', 'On you', h.you, youSub, 'Nothing waits on you.', 'needs')}${group('ready', 'Ready for an agent', h.ready, readySub, 'Nothing is ready to pick up.', 'ready')}${stale}`;
}
