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

/** The decision pages still open, in the Decisions lens's own order. */
export const openPages = (rows: DpRow[], archived: ReadonlySet<string> = new Set()) =>
  dpBands(rows, '', archived).filter(b => b.state !== 'archived').flatMap(b => b.rows);
