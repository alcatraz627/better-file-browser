// Where comments and pins on web pages are kept, and how two copies of one
// page's marks are brought together. A page's marks are one list under one
// key, so two tabs on the same page each hold a copy and each saves the whole
// list; the merge keeps what either tab added and drops what either deleted.

/** A page's marks are stored under this prefix plus the page's key. */
export const MARKS_PREFIX = 'bfb-marks-v1:';
/** One entry per page that has marks, for the lists in Settings and the panel. */
export const MARKS_INDEX = 'bfb-marks-index-v1';

interface Stamped { id: string; updated: number }

/**
 * This tab's marks brought up to date with the stored list.
 *
 * `known` holds the ids this tab last saw in storage, `gone` the ids it deleted
 * since. A mark missing from storage that this tab knew was deleted elsewhere;
 * a stored mark this tab lacks and did not delete was added elsewhere. For a
 * mark both hold, the later edit wins, on this tab's own object.
 */
export function mergeMarks<M extends Stamped>(stored: M[], mine: M[], known: Set<string>, gone: Set<string>): M[] {
  const theirs = new Map(stored.map(m => [m.id, m]));
  const out: M[] = [];
  for (const m of mine) {
    const s = theirs.get(m.id);
    if (!s && known.has(m.id)) continue;
    out.push(s && s.updated > m.updated ? Object.assign(m, s) : m);
  }
  const have = new Set(mine.map(m => m.id));
  for (const s of stored) if (!have.has(s.id) && !gone.has(s.id)) out.push(s);
  return out;
}

/** Rows that have the shape a mark needs; a damaged row is left out. */
export const markRows = <M extends Stamped>(v: unknown): M[] =>
  Array.isArray(v) ? v.filter(m => !!m && typeof m === 'object' && typeof m.id === 'string' && typeof m.updated === 'number') : [];
