// What the Home lens shows, as plain records: every Ask chat newest first,
// the decision pages still open (waiting first, archived ones left out), and
// each repo's directions doc with how much in it waits on the owner and how
// much an agent can pick up now. The counts come from the same reader the
// directions page uses, so Home and the doc always agree; the asks themselves
// are never copied out of the doc.
import { renderMarkdown } from './renderers';
import { readDirections } from './directions-model';
import { nextHead } from './directions-head';
import { dpBands, type DpRow } from './dp-lens';

export interface RepoDoc { path: string; repo: string; mtime: number; text: string }
export interface RepoSummary {
  path: string; repo: string; mtime: number;
  /** Rows waiting on the owner, and rows an agent can do now. */
  onYou: number; ready: number;
  /** Days since the doc's own "Last updated", when it has gone stale. */
  staleDays: number | null;
}

/** How much of one directions doc waits on the owner. */
export function summarizeRepo(doc: RepoDoc, now = new Date()): RepoSummary {
  const root = document.createElement('div');
  root.innerHTML = renderMarkdown(doc.text);
  const h = nextHead(readDirections(root), now);
  return { path: doc.path, repo: doc.repo, mtime: doc.mtime, onYou: h.you.length, ready: h.ready.length, staleDays: h.staleDays };
}

/** Repos with something on the owner first, most asks first, then by when the doc changed. */
export const sortRepos = (repos: RepoSummary[]) =>
  [...repos].sort((a, b) => Number(b.onYou > 0) - Number(a.onYou > 0) || b.onYou - a.onYou || b.mtime - a.mtime);

/** One number on Home: what it counts, a small aside, the last seven days
 *  when a trend helps (oldest first, today last), and whether it needs the
 *  owner now. Each id is also where a click on it goes. */
export interface HomeStat { id: 'waiting' | 'asks' | 'asked' | 'opened' | 'saved' | 'notes'; label: string; value: string; sub: string; series?: number[]; hot?: boolean }

/** How many of `times` (ms) fall on each of the last seven local days. */
export function lastSevenDays(times: number[], now = Date.now()): number[] {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => start.getTime() - (6 - i) * 86400_000);
  return days.map((d, i) => times.filter(t => t >= d && t < (days[i + 1] ?? Infinity)).length);
}

/** The six numbers on Home, each one something the owner can act on. */
export function homeStats(o: {
  waiting: number; asks: number; askRepos: number;
  chats: { chat: { turns: { at: number }[] } }[];
  recents: { ts: number }[];
  saved: { tags?: string[] }[];
  notes: { mtime: number }[];
}, now = Date.now()): HomeStat[] {
  const n = (v: number) => v.toLocaleString('en-US');
  const plural = (v: number, one: string, many = one + 's') => `${n(v)} ${v === 1 ? one : many}`;
  const asked = lastSevenDays(o.chats.flatMap(c => c.chat.turns.map(t => t.at)), now);
  const opened = lastSevenDays(o.recents.map(r => r.ts), now);
  const tags = new Set(o.saved.flatMap(s => s.tags ?? []));
  // A note's time may come in seconds or milliseconds; anything below 1e12 is seconds.
  const week = now - 7 * 86400_000;
  const changed = o.notes.filter(x => (x.mtime < 1e12 ? x.mtime * 1000 : x.mtime) >= week).length;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  return [
    { id: 'waiting', label: 'waiting on you', value: n(o.waiting), sub: o.waiting ? 'pages to answer' : 'nothing to answer', hot: o.waiting > 0 },
    { id: 'asks', label: 'asks on you', value: n(o.asks), sub: o.asks ? `in ${plural(o.askRepos, 'repo')}` : 'no repo needs you', hot: o.asks > 0 },
    { id: 'asked', label: 'questions', value: n(sum(asked)), sub: 'this week', series: asked },
    { id: 'opened', label: 'places opened', value: n(opened[6]), sub: 'today', series: opened },
    { id: 'saved', label: 'saved', value: n(o.saved.length), sub: tags.size ? plural(tags.size, 'tag') : 'no tags yet' },
    { id: 'notes', label: 'notes', value: n(o.notes.length), sub: `${n(changed)} changed this week` },
  ];
}

/** Waiting decision pages split by age: the ones touched in the last `days`
 *  days, which Home lists, and the older ones, which it only counts. */
export function splitByAge<T extends { mtime: number }>(rows: T[], days = 14, now = Date.now()): { recent: T[]; older: T[] } {
  const cut = now / 1000 - days * 86400;
  return { recent: rows.filter(r => r.mtime >= cut), older: rows.filter(r => r.mtime < cut) };
}

/** The decision pages still open, in the Decisions lens's own order. */
export const openPages = (rows: DpRow[], archived: ReadonlySet<string> = new Set()) =>
  dpBands(rows, '', archived).filter(b => b.state !== 'archived').flatMap(b => b.rows);
