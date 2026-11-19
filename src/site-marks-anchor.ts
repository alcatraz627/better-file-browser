// Finding a comment's words again on a page that may have changed.
//
// A comment remembers the words it was made on, a little of what came before
// and after them, and roughly where they sat. On a later visit the page text is
// searched for the words, and the copy whose surroundings match best wins, so
// the same phrase elsewhere on the page does not steal it. Nothing here touches
// the page, so it is unit tested on its own.

/** Text with the raw offset of each of its characters. */
export interface Mapped { s: string; o: number[] }

/** The words a comment was made on, with enough around them to find them again. */
export interface Quote { exact: string; prefix: string; suffix: string; start: number }

const CONTEXT = 32;

/** The text with whitespace runs collapsed to one space, mapped back to raw offsets. */
export function collapseSpace(raw: string): Mapped {
  const out: Mapped = { s: '', o: [] };
  let space = true;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (/\s/.test(ch)) {
      if (space) continue;
      space = true;
      out.s += ' ';
    } else {
      space = false;
      out.s += ch;
    }
    out.o.push(i);
  }
  return out;
}

/** The quote for text[start, end) of a collapsed page text. */
export function makeQuote(text: string, start: number, end: number): Quote {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    start,
  };
}

/** Characters shared at the end of a and b. */
function sharedEnd(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** Characters shared at the start of a and b. */
function sharedStart(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Where a quote's words are in the page text now, or null when they are gone.
 * Each copy scores by how much of the remembered surroundings it shares, and a
 * tie goes to the copy nearest where the words used to be.
 */
export function findQuote(text: string, q: Quote): { start: number; end: number } | null {
  if (!q.exact) return null;
  let best: { start: number; score: number } | null = null;
  let from = 0;
  for (let found = 0; found < 500; found++) {
    const at = text.indexOf(q.exact, from);
    if (at < 0) break;
    const before = text.slice(Math.max(0, at - CONTEXT), at);
    const after = text.slice(at + q.exact.length, at + q.exact.length + CONTEXT);
    const nearness = 1 - Math.min(1, Math.abs(at - q.start) / Math.max(1, text.length));
    const score = sharedEnd(before, q.prefix) + sharedStart(after, q.suffix) + nearness;
    if (!best || score > best.score) best = { start: at, score };
    from = at + 1;
  }
  return best && { start: best.start, end: best.start + q.exact.length };
}

/** The index in a collapsed text of the character at or after a raw offset. */
export function collapsedIndex(map: Mapped, raw: number): number {
  let lo = 0, hi = map.o.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (map.o[mid] < raw) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// Query parameters that only track how a visitor arrived.
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|_hsenc|_hsmi)$/i;

/**
 * The address that a page's marks are kept under. Tracking parameters and the
 * fragment are dropped, except a fragment that is a single-page app's route.
 */
export function pageKey(href: string): string {
  const url = new URL(href);
  for (const name of [...url.searchParams.keys()]) if (TRACKING.test(name)) url.searchParams.delete(name);
  url.searchParams.sort();
  const route = /^#!?\//.test(url.hash) ? url.hash : '';
  const search = url.searchParams.toString();
  return `${url.origin}${url.pathname}${search ? `?${search}` : ''}${route}`;
}
