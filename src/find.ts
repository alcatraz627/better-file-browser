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
  textRegex: boolean;
  maxDepth: number;
}

export const EMPTY_FIND: FindQuery = { scope: 'here', name: '', regex: false, exts: [], text: '', caseSensitive: false, textRegex: false, maxDepth: 8 };

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

export interface ContentHit { count: number; line: string; start: number; end: number; lineNumber: number }
export interface ContentsResult { hits: Map<string, ContentHit>; scanned: number; failed: number; cancelled: boolean }

export function textPatternError(q: FindQuery): string | null {
  if (!q.textRegex || !q.text) return null;
  if (q.text.length > 160) return 'Text regex is limited to 160 characters';
  try { new RegExp(q.text, q.caseSensitive ? 'gu' : 'giu'); return null; }
  catch { return 'Invalid text regex'; }
}

export function scanContent(text: string, q: FindQuery): ContentHit | null {
  if (!q.text) return null;
  const pattern = q.textRegex ? new RegExp(q.text, q.caseSensitive ? 'gu' : 'giu') : null;
  const needle = q.caseSensitive ? q.text : q.text.toLowerCase();
  let count = 0, first: { line: string; at: number; length: number; number: number } | null = null;
  let lineStart = 0, lineNumber = 1;
  while (lineStart <= text.length) {
    const breakAt = text.indexOf('\n', lineStart);
    const end = breakAt < 0 ? text.length : breakAt;
    const line = text.slice(lineStart, end);
    if (pattern) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line))) {
        count++;
        if (!first) first = { line, at: match.index, length: match[0].length, number: lineNumber };
        if (!match[0].length) {
          const codePoint = line.codePointAt(pattern.lastIndex);
          pattern.lastIndex += codePoint !== undefined && codePoint > 0xffff ? 2 : 1;
        }
      }
    } else {
      const hay = q.caseSensitive ? line : line.toLowerCase();
      for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + Math.max(1, needle.length))) {
        count++;
        if (!first) first = { line, at, length: q.text.length, number: lineNumber };
      }
    }
    if (breakAt < 0) break;
    lineStart = breakAt + 1;
    lineNumber++;
  }
  if (!first) return null;
  const from = Math.max(0, first.at - 60);
  const to = Math.min(first.line.length, from + 180);
  const line = (from ? '…' : '') + first.line.slice(from, to) + (to < first.line.length ? '…' : '');
  const start = first.at - from + (from ? 1 : 0);
  return { count, line, start, end: Math.min(line.length, start + first.length), lineNumber: first.number };
}

export async function searchContents(
  files: Entry[],
  read: (href: string) => Promise<string>,
  q: FindQuery,
  onProgress?: (done: number, total: number) => void,
  isCancelled: () => boolean = () => false,
  concurrency = 4,
  match: (text: string, q: FindQuery) => Promise<ContentHit | null> = async (text, query) => scanContent(text, query),
): Promise<ContentsResult> {
  const hits = new Map<string, ContentHit>();
  let scanned = 0, failed = 0, next = 0;
  const worker = async () => {
    while (next < files.length && !isCancelled()) {
      const f = files[next++];
      try {
        const text = await read(f.href);
        if (isCancelled()) break;
        const hit = await match(text, q);
        if (isCancelled()) break;
        if (hit) hits.set(f.href, hit);
      } catch { failed++; }
      if (isCancelled()) break;
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
    return { ...EMPTY_FIND, ...q, exts: Array.isArray(q.exts) ? q.exts : [], maxDepth: [1, 2, 4, 8].includes(q.maxDepth) ? q.maxDepth : 8 };
  } catch { return null; }
}
export function isViewPath(path: string): boolean { return path.includes('#find='); }

export function describeFind(q: FindQuery): string {
  const bits: string[] = [];
  if (q.name) bits.push(q.regex ? `/${q.name}/` : q.name);
  if (q.exts.length) bits.push('.' + q.exts.join(' .'));
  if (q.text) bits.push(q.textRegex ? `/${q.text}/` : `"${q.text}"`);
  const what = bits.join(' ') || 'everything';
  return q.scope === 'deep' ? `${what} in subfolders` : what;
}
