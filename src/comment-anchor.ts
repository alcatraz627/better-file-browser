// Where a comment points: the bridge between the rendered markdown page and
// the source text. A reader selects words on the page; the host needs the
// span of the source those words came from. Both directions use one notion of
// "what a reader sees of the source" (markers, link targets and HTML gone,
// whitespace collapsed), so a span found one way is found again the other.
import { lineStart } from './text-window';

/** Text with the source offset of each of its characters. */
interface Mapped { s: string; o: number[] }

type Piece = number | string;
/** Replace every match of `re` with the listed groups (kept with their source
 *  offsets) and literal strings (placed at the match's offset). */
function pass(t: Mapped, re: RegExp, pieces: Piece[]): Mapped {
  const out: Mapped = { s: '', o: [] };
  let at = 0;
  const flags = re.flags.includes('d') ? re.flags : re.flags + 'd';
  for (const m of t.s.matchAll(new RegExp(re.source, flags))) {
    out.s += t.s.slice(at, m.index); out.o.push(...t.o.slice(at, m.index));
    const here = t.o[m.index] ?? t.o[t.o.length - 1] ?? 0;
    for (const p of pieces) {
      if (typeof p === 'string') { out.s += p; for (let i = 0; i < p.length; i++) out.o.push(here); continue; }
      // The `d` flag's group positions; the project's TypeScript lib predates them.
      const span = (m as RegExpMatchArray & { indices: ([number, number] | undefined)[] }).indices[p];
      if (!span) continue;
      out.s += t.s.slice(span[0], span[1]); out.o.push(...t.o.slice(span[0], span[1]));
    }
    at = m.index + m[0].length;
  }
  out.s += t.s.slice(at); out.o.push(...t.o.slice(at));
  return out;
}

// In order: line prefixes and table pipes, then inline syntax, then spacing.
const PASSES: [RegExp, Piece[]][] = [
  [/^[^\S\n]*#{1,6}[^\S\n]+/gm, []],
  [/^[^\S\n]*>[^\S\n]?/gm, []],
  [/^[^\S\n]*(?:[-*+]|\d+[.)])[^\S\n]+(?:\[[ xX]\][^\S\n]+)?/gm, []],
  [/\|/g, [' ']],
  [/\n/g, [' ']],
  [/!\[([^\]]*)\]\([^)]*\)/g, [1]],
  [/\[([^\]]*)\]\([^)]*\)/g, [1]],
  [/<(https?:\/\/[^>]+)>/g, [1]],
  [/\[\^[^\]]+\]/g, []],
  [/<[^>]+>/g, []],
  [/`+/g, []],
  [/\*\*|__|~~/g, []],
  [/(^|[^\w*])[*_](?=\S)/g, [1]],
  [/(\S)[*_](?=[^\w*]|$)/g, [1]],
  [/\s+/g, [' ']],
];

/** What a reader sees of `src`, with the offset in `src` of each character. */
export function visibleMap(src: string): Mapped {
  let t: Mapped = { s: src, o: Array.from({ length: src.length }, (_v, i) => i) };
  for (const [re, pieces] of PASSES) t = pass(t, re, pieces);
  const lead = t.s.length - t.s.trimStart().length;
  const keep = t.s.trim().length;
  return { s: t.s.slice(lead, lead + keep), o: t.o.slice(lead, lead + keep) };
}

/** What a reader sees of a span of markdown source. */
export const visibleOf = (src: string): string => visibleMap(src).s;

const SKIP = 'script,style,svg,textarea,.fe-md-anchor,.fe-md-code-bar,[hidden]';

/** The rendered blocks covering source lines first..last. */
const blocksFor = (page: HTMLElement, first: number, last: number) =>
  [...page.querySelectorAll<HTMLElement>('[data-sl]')].filter(b => {
    const [a, z] = b.dataset.sl!.split('-').map(Number);
    return z >= first && a <= last;
  });

/** The blocks' text with whitespace collapsed, and each kept character's text node and offset. */
function flatText(blocks: HTMLElement[]): { flat: string; at: [Text, number][] } {
  let flat = '';
  const at: [Text, number][] = [];
  let ws = true;
  for (const b of blocks) {
    const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      for (let i = 0; i < t.data.length; i++) {
        const sp = /\s/.test(t.data[i]);
        if (sp && ws) continue;
        flat += sp ? ' ' : t.data[i];
        at.push([t, i]);
        ws = sp;
      }
    }
    if (!ws && at.length) { flat += ' '; at.push(at[at.length - 1]); ws = true; }
  }
  return { flat, at };
}

/** A DOM Range over the rendered text of source lines first..last that reads `needle`, or null. */
export function rangeFor(page: HTMLElement, first: number, last: number, needle: string): Range | null {
  const blocks = blocksFor(page, first, last);
  if (!blocks.length) return null;
  const { flat, at } = flatText(blocks);
  const range = document.createRange();
  let s = needle ? flat.indexOf(needle) : -1;
  if (s === -1 && needle) s = flat.toLowerCase().indexOf(needle.toLowerCase());
  if (s === -1) {
    range.selectNodeContents(blocks[0]);   // the words are not on the page as typed: mark the block
    return range;
  }
  const [sn, so] = at[s], [en, eo] = at[s + needle.length - 1];
  range.setStart(sn, so);
  range.setEnd(en, eo + 1);
  return range;
}

/** Where offsets in `before` sit in `after`, for showing comments while the text
 *  is being edited: text before the change stays put, text after it shifts by
 *  the change's length, and an offset inside the change goes to its start.
 *  For display only; the host re-anchors properly once the text is saved. */
export function carrier(before: string, after: string): (offset: number) => number {
  if (before === after) return o => o;
  let p = 0;
  const n = Math.min(before.length, after.length);
  while (p < n && before.charCodeAt(p) === after.charCodeAt(p)) p++;
  let q = 0;
  while (q < n - p && before.charCodeAt(before.length - 1 - q) === after.charCodeAt(after.length - 1 - q)) q++;
  const tail = before.length - q, shift = after.length - before.length;
  return o => o < p ? o : o >= tail ? o + shift : p;
}

/** A span of the source a comment can hang on; `block` when it is a whole block because the words could not be placed. */
export interface SourceSpan { start: number; end: number; block: boolean }

const MARKS = '*_~`';
// `**` opens once, so balance counts runs of a marker, not characters.
const runs = (s: string, c: string) => s.match(new RegExp(`\\${c}+`, 'g'))?.length ?? 0;

/** Grow a span over markup it cuts in half, and over markup wrapped round all of it,
 *  so the stored quote reads `**risky**` and `[smoke run](notes.txt)`, never `risky**`. */
export function widen(text: string, start: number, end: number): [number, number] {
  for (let guard = 0; guard < 50; guard++) {
    const span = text.slice(start, end);
    if (text.startsWith('](', end)) {   // ends inside a link's text
      const close = text.indexOf(')', end);
      if (close !== -1) { end = close + 1; continue; }
    }
    const cut = span.indexOf('](');
    const lb = text.lastIndexOf('[', start - 1), nl = text.lastIndexOf('\n', start - 1);
    if (cut !== -1 && !span.slice(0, cut).includes('[') && lb > nl) { start = lb; continue; }   // starts inside a link's text
    // An underscore between letters (snake_case) is part of the word, not emphasis.
    const mark = (i: number) => MARKS.includes(text[i] ?? '\0') && !(text[i] === '_' && /\w/.test(text[i - 1] ?? '') && /\w/.test(text[i + 1] ?? ''));
    const after = text[end], before = text[start - 1];
    if (mark(end) && runs(span, after) % 2) { while (text[end] === after) end++; continue; }
    if (mark(start - 1) && runs(span, before) % 2) { while (text[start - 1] === before) start--; continue; }
    if (mark(start - 1) && before === after) { start--; end++; continue; }
    break;
  }
  return [start, end];
}

/** The source span a selection on the rendered page stands for, or null when
 *  it cannot carry a comment (empty, outside the page, in front matter). */
export function sourceSpan(page: HTMLElement, text: string, range: Range): SourceSpan | null {
  if (range.collapsed) return null;
  const holder = (n: Node) => (n.nodeType === 1 ? n as Element : n.parentElement);
  if (holder(range.startContainer)?.closest('.fe-md-fm') || holder(range.endContainer)?.closest('.fe-md-fm')) return null;
  // A drag from the margin starts or ends between blocks, so take the first
  // and last block the selection touches rather than the ones its ends are in.
  const touched = [...page.querySelectorAll<HTMLElement>('[data-sl]')].filter(b => range.intersectsNode(b));
  const a = touched[0], z = touched[touched.length - 1];
  if (!a || !z) return null;
  const first = Number(a.dataset.sl!.split('-')[0]);
  const last = Number(z.dataset.sl!.split('-')[1]);
  const from = lineStart(text, first - 1);
  let to = lineStart(text, last);
  if (to > from && text[to - 1] === '\n') to--;
  const block: SourceSpan = { start: from, end: to, block: true };

  const { flat, at } = flatText(blocksFor(page, first, last));
  let s = at.findIndex(([n, o]) => { try { return range.comparePoint(n, o) >= 0; } catch { return false; } });
  let e = -1;
  for (let i = at.length - 1; i >= 0; i--) {
    try { if (range.comparePoint(at[i][0], at[i][1]) === 0) { e = i + 1; break; } } catch { /* outside */ }
  }
  if (s === -1 || e <= s) return block;
  while (s < e && flat[s] === ' ') s++;
  while (e > s && flat[e - 1] === ' ') e--;
  const needle = flat.slice(s, e);
  if (!needle) return null;

  const vis = visibleMap(text.slice(from, to));
  const hits: number[] = [];
  for (const hay of [vis.s, vis.s.toLowerCase()]) {
    const n = hay === vis.s ? needle : needle.toLowerCase();
    for (let i = hay.indexOf(n); i !== -1; i = hay.indexOf(n, i + 1)) hits.push(i);
    if (hits.length) break;
  }
  if (!hits.length) return block;
  // The page and the visible source line up closely, so the occurrence nearest
  // the selection's place on the page is the one selected.
  const v = hits.reduce((best, i) => Math.abs(i - s) < Math.abs(best - s) ? i : best, hits[0]);
  const [ws, we] = widen(text, from + vis.o[v], from + vis.o[v + needle.length - 1] + 1);
  return { start: ws, end: we, block: false };
}
