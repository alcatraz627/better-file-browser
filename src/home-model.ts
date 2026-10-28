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

/** One stat on Home: which it is, a value, what it counts, and a small aside. */
export interface UsageStat { id: 'asked' | 'chats' | 'answered' | 'opened' | 'saved' | 'top'; label: string; value: string; sub: string }

/** Light, slightly idle facts about how bfb gets used, from what bfb already
 *  keeps: chats, places opened and saved, and decision pages answered. */
export function usageStats(
  chats: { subject: string; chat: { at: number; turns: { at: number }[] } }[],
  recents: { path: string; ts: number }[],
  saved: { path: string; tags?: string[] }[],
  pages: { answered?: number | null }[],
  now = Date.now(),
): UsageStat[] {
  const week = now - 7 * 86400_000;
  const day = new Date(now); day.setHours(0, 0, 0, 0);
  const turns = chats.flatMap(c => c.chat.turns);
  const perSubject = new Map<string, number>();
  for (const c of chats) perSubject.set(c.subject, (perSubject.get(c.subject) ?? 0) + c.chat.turns.length);
  const top = [...perSubject].sort((a, b) => b[1] - a[1])[0];
  const answered = pages.filter(p => p.answered).map(p => p.answered! * 1000);
  const tags = new Set(saved.flatMap(s => s.tags ?? []));
  const n = (v: number) => v.toLocaleString('en-US');
  return [
    { id: 'asked', label: 'questions asked', value: n(turns.length), sub: `${n(turns.filter(t => t.at >= week).length)} this week` },
    { id: 'chats', label: 'chats', value: n(chats.length), sub: `about ${n(perSubject.size)} ${perSubject.size === 1 ? 'thing' : 'things'}` },
    { id: 'answered', label: 'decisions answered', value: n(answered.length), sub: `${n(answered.filter(t => t >= week).length)} this week` },
    { id: 'opened', label: 'places opened lately', value: n(recents.length), sub: `${n(recents.filter(r => r.ts >= day.getTime()).length)} today` },
    { id: 'saved', label: 'places saved', value: n(saved.length), sub: tags.size ? `${n(tags.size)} ${tags.size === 1 ? 'tag' : 'tags'}` : 'no tags yet' },
    { id: 'top', label: 'asked about most', value: top ? (top[0].split('/').filter(Boolean).pop() || '/') : 'nothing yet', sub: top ? `${n(top[1])} ${top[1] === 1 ? 'question' : 'questions'}` : 'ask about any file' },
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
