// One Find record covers everything the search panel asks: where to look,
// what the name must match, which extensions, and text inside the files.
// A Saved row can carry a Find, which makes a saved view: a folder plus a
// query, reopened by URL hash. The contents pass is async and cancellable.
import type { Entry } from './types';
import { CODE_EXTS, TABLE_EXTS, JSONL_EXTS } from './renderers';

export interface FindQuery {
  scope: 'here' | 'deep';
  name:  string;       // substring, or a regex when `regex` is on
  regex: boolean;
  exts:  string[];     // lowercase, no dot; empty = any
  text:  string;       // text inside files; empty = no contents pass
  caseSensitive: boolean;
}

export const EMPTY_FIND: FindQuery = { scope: 'here', name: '', regex: false, exts: [], text: '', caseSensitive: false };

export function isEmptyFind(q: FindQuery): boolean {
  return q.scope === 'here' && !q.name && !q.exts.length && !q.text;
}

export function parseExts(s: string): string[] {
  const out: string[] = [];
  for (const raw of s.split(/[,\s]+/)) {
    const e = raw.trim().replace(/^\*?\./, '').toLowerCase();
    if (e && !out.includes(e)) out.push(e);
  }
  return out;
}

const ext = (e: Entry) => (e.isDir ? '' : (e.name.includes('.') ? e.name.split('.').pop()!.toLowerCase() : ''));

export function matchesFind(e: Entry, q: FindQuery): boolean {
  if (q.exts.length && !q.exts.includes(ext(e))) return false;
  if (q.name) {
    if (q.regex) { try { if (!new RegExp(q.name, q.caseSensitive ? '' : 'i').test(e.name)) return false; } catch { return false; } }
    else if (q.caseSensitive ? !e.name.includes(q.name) : !e.name.toLowerCase().includes(q.name.toLowerCase())) return false;
  }
  return true;
}

// Files worth reading for a contents pass: text types, not too big.
export const TEXT_MAX_BYTES = 2 * 1024 * 1024;
export function isTextCandidate(e: Entry): boolean {
  if (e.isDir || e.isParent) return false;
  const x = ext(e);
  if (!(CODE_EXTS.has(x) || TABLE_EXTS.has(x) || JSONL_EXTS.has(x) || x === 'json')) return false;
  return e.rawBytes < 0 || e.rawBytes <= TEXT_MAX_BYTES;
}

export interface ContentHit { count: number; line: string }
export interface ContentsResult { hits: Map<string, ContentHit>; scanned: number; failed: number; cancelled: boolean }

export async function searchContents(
  files: Entry[],
  read: (href: string) => Promise<string>,
  q: FindQuery,
  onProgress?: (done: number, total: number) => void,
  isCancelled: () => boolean = () => false,
  concurrency = 4,
): Promise<ContentsResult> {
  const hits = new Map<string, ContentHit>();
  let scanned = 0, failed = 0, next = 0;
  const needle = q.caseSensitive ? q.text : q.text.toLowerCase();
  const worker = async () => {
    while (next < files.length && !isCancelled()) {
      const f = files[next++];
      try {
        const text = await read(f.href);
        const hay = q.caseSensitive ? text : text.toLowerCase();
        let count = 0, at = hay.indexOf(needle);
        while (at >= 0) { count++; at = hay.indexOf(needle, at + needle.length); }
        if (count) {
          const first = hay.indexOf(needle);
          const ls = text.lastIndexOf('\n', first) + 1;
          let le = text.indexOf('\n', first); if (le < 0) le = text.length;
          hits.set(f.href, { count, line: text.slice(ls, le).trim().slice(0, 160) });
        }
      } catch { failed++; }
      scanned++;
      onProgress?.(scanned, files.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { hits, scanned, failed, cancelled: isCancelled() };
}

// A saved view is a folder URL with the query in its hash.
export function findToHash(q: FindQuery): string {
  return isEmptyFind(q) ? '' : '#find=' + encodeURIComponent(JSON.stringify(q));
}
export function findFromHash(hash: string): FindQuery | null {
  const m = hash.match(/^#find=(.+)$/);
  if (!m) return null;
  try {
    const q = JSON.parse(decodeURIComponent(m[1]));
    return { ...EMPTY_FIND, ...q, exts: Array.isArray(q.exts) ? q.exts : [] };
  } catch { return null; }
}
export function isViewPath(path: string): boolean { return path.includes('#find='); }

export function describeFind(q: FindQuery): string {
  const bits: string[] = [];
  if (q.name) bits.push(q.regex ? `/${q.name}/` : q.name);
  if (q.exts.length) bits.push('.' + q.exts.join(' .'));
  if (q.text) bits.push(`"${q.text}"`);
  const what = bits.join(' ') || 'everything';
  return q.scope === 'deep' ? `${what} in subfolders` : what;
}
