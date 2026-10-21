// How many open comment threads each document in a folder has, read from the
// companions beside them (plan.md.bfb.json), so the listing can show a count
// on the document's row while the companion itself stays hidden.
import type { Entry } from './types';
import { fetchFileText } from './file-fetch';

const SUFFIX = '.bfb.json';

/** Open threads in a companion's text: not deleted and not done; 0 for text that will not parse. */
export function openThreads(text: string): number {
  try {
    const threads = JSON.parse(text)?.comments?.threads;
    return Array.isArray(threads) ? threads.filter(t => !t?.deleted && t?.status !== 'done').length : 0;
  } catch { return 0; }
}

/** The documents in a listing that have a companion beside them, by name. */
export function commentedDocs(all: Entry[]): { doc: string; href: string }[] {
  const names = new Set(all.filter(e => !e.isDir).map(e => e.name));
  return all.filter(e => !e.isDir && e.name.endsWith(SUFFIX) && names.has(e.name.slice(0, -SUFFIX.length)))
    .map(e => ({ doc: e.name.slice(0, -SUFFIX.length), href: e.href }));
}

/** Read every companion in the folder; resolves to open counts by document name (zero counts left out). */
export async function loadOpenCounts(all: Entry[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await Promise.all(commentedDocs(all).map(async ({ doc, href }) => {
    const n = openThreads(await fetchFileText(href, 1).catch(() => ''));
    if (n) out.set(doc, n);
  }));
  return out;
}
