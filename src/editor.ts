// The editing core a textarea gets: undo that survives the element being
// rebuilt, keystrokes coalesced so a sentence is one undo step, and insert at
// the caret. Carried over from the kanban board's editor.js, typed.
const BUF_CAP = 60, BUF_COALESCE = 600;
// History holds the changed span of each step, not a copy of the text, so a
// large file keeps its undo steps without holding dozens of full copies.
// Oldest steps go first once their spans pass this many characters.
const BUF_CHARS = 8_000_000;
/** Replace `len` characters at `at` with `ins`. */
export interface Patch { at: number; len: number; ins: string }
interface Hist { cur: string; past: Patch[]; future: Patch[]; timer: ReturnType<typeof setTimeout> | null }
const bufHist = new Map<string, Hist>();

/** The patch that turns `a` into `b`: the span between their shared start and shared end. */
export function diffText(a: string, b: string): Patch {
  let p = 0;
  const max = Math.min(a.length, b.length);
  while (p < max && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  let s = 0;
  while (s < max - p && a.charCodeAt(a.length - 1 - s) === b.charCodeAt(b.length - 1 - s)) s++;
  return { at: p, len: a.length - p - s, ins: b.slice(p, b.length - s) };
}
export const applyPatch = (t: string, p: Patch) => t.slice(0, p.at) + p.ins + t.slice(p.at + p.len);

export function insertAtCursor(el: HTMLTextAreaElement, text: string): void {
  const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
  el.value = el.value.slice(0, a) + text + el.value.slice(b);
  const at = a + text.length;
  el.setSelectionRange(at, at);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

// ── Pure text operations on a selection ────────────────────────────
// Each takes the text and a selection and returns the new text and where
// the selection lands, so the keyboard layer stays thin and these get tests.
export interface Sel { start: number; end: number }
export interface TextEdit { text: string; start: number; end: number }

// The full lines that the selection touches.
function lineSpan(text: string, sel: Sel): { from: number; to: number } {
  const from = text.lastIndexOf('\n', sel.start - 1) + 1;
  let to = text.indexOf('\n', Math.max(sel.end - (sel.end > sel.start && text[sel.end - 1] === '\n' ? 1 : 0), sel.start));
  if (to < 0) to = text.length;
  return { from, to };
}

export function moveLines(text: string, sel: Sel, dir: 1 | -1): TextEdit {
  const { from, to } = lineSpan(text, sel);
  const block = text.slice(from, to);
  if (dir < 0) {
    if (from === 0) return { text, ...sel };
    const prevFrom = text.lastIndexOf('\n', from - 2) + 1;
    const prev = text.slice(prevFrom, from - 1);
    const out = text.slice(0, prevFrom) + block + '\n' + prev + text.slice(to);
    const shift = -(prev.length + 1);
    return { text: out, start: sel.start + shift, end: sel.end + shift };
  }
  if (to >= text.length) return { text, ...sel };
  let nextTo = text.indexOf('\n', to + 1);
  if (nextTo < 0) nextTo = text.length;
  const next = text.slice(to + 1, nextTo);
  const out = text.slice(0, from) + next + '\n' + block + text.slice(nextTo);
  const shift = next.length + 1;
  return { text: out, start: sel.start + shift, end: sel.end + shift };
}

export function duplicateLines(text: string, sel: Sel): TextEdit {
  const { from, to } = lineSpan(text, sel);
  const block = text.slice(from, to);
  const out = text.slice(0, to) + '\n' + block + text.slice(to);
  const shift = block.length + 1;
  return { text: out, start: sel.start + shift, end: sel.end + shift };
}

export function indentLines(text: string, sel: Sel, outdent: boolean, unit = '  '): TextEdit {
  const { from, to } = lineSpan(text, sel);
  const lines = text.slice(from, to).split('\n');
  let firstDelta = 0, total = 0;
  const changed = lines.map((l, i) => {
    let d: number;
    if (outdent) { const n = l.startsWith(unit) ? unit.length : (l.startsWith(' ') ? 1 : 0); d = -n; l = l.slice(n); }
    else { l = unit + l; d = unit.length; }
    if (i === 0) firstDelta = d;
    total += d;
    return l;
  });
  const out = text.slice(0, from) + changed.join('\n') + text.slice(to);
  return { text: out, start: Math.max(from, sel.start + firstDelta), end: Math.max(from, sel.end + total) };
}

// Enter inside a list item continues the list; Enter on an empty item ends it.
export function continueList(text: string, sel: Sel): TextEdit | null {
  const from = text.lastIndexOf('\n', sel.start - 1) + 1;
  const line = text.slice(from, sel.start);
  const m = line.match(/^(\s*)([-*+]|\d+[.)])\s(\[[ xX]\]\s)?(.*)$/);
  if (!m) return null;
  const [, ind, marker, box, rest] = m;
  if (!rest.trim() && !box) {
    const out = text.slice(0, from) + text.slice(sel.end);
    return { text: out, start: from, end: from };
  }
  if (!rest.trim() && box) {
    const out = text.slice(0, from) + text.slice(sel.end);
    return { text: out, start: from, end: from };
  }
  const nextMarker = /^\d+/.test(marker) ? String(parseInt(marker) + 1) + marker.slice(-1) : marker;
  const ins = '\n' + ind + nextMarker + ' ' + (box ? '[ ] ' : '');
  const out = text.slice(0, sel.start) + ins + text.slice(sel.end);
  return { text: out, start: sel.start + ins.length, end: sel.start + ins.length };
}

export function wrapSelection(text: string, sel: Sel, left: string, right = left): TextEdit {
  const inner = text.slice(sel.start, sel.end);
  const out = text.slice(0, sel.start) + left + inner + right + text.slice(sel.end);
  return { text: out, start: sel.start + left.length, end: sel.end + left.length };
}

export function tableSnippet(cols = 2, rows = 2): string {
  const head = '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const sep  = '|' + Array.from({ length: cols }, () => ' --- |').join('');
  const body = Array.from({ length: rows }, () => '|' + Array.from({ length: cols }, () => '   |').join('')).join('\n');
  return `${head}\n${sep}\n${body}\n`;
}

export interface Buffer { undo: () => boolean; redo: () => boolean; snap: () => void; depth: () => number; insert: (t: string) => void }

/** `io` reads and writes the whole text when the textarea holds only part of it. */
export function attachBuffer(el: HTMLTextAreaElement, id: string,
  io: { get(): string; set(v: string): void } = { get: () => el.value, set: v => { el.value = v; } }): Buffer {
  const h: Hist = bufHist.get(id) ?? { cur: '', past: [], future: [], timer: null };
  bufHist.set(id, h);
  h.cur = io.get() ?? '';
  h.past = [];
  h.future = [];

  // Each past step turns the current text back into the one before it.
  const snap = () => {
    const now = io.get() ?? '';
    if (now === h.cur) return;
    h.past.push(diffText(now, h.cur));
    h.cur = now;
    let chars = h.past.reduce((n, p) => n + p.ins.length, 0);
    while (h.past.length > BUF_CAP || (h.past.length > 1 && chars > BUF_CHARS)) chars -= h.past.shift()!.ins.length;
    h.future = [];                       // a new edit forks the timeline
  };
  const record = () => { if (h.timer) clearTimeout(h.timer); h.timer = setTimeout(snap, BUF_COALESCE); };
  const put = (v: string) => { h.cur = v; io.set(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const step = (from: Patch[], to: Patch[]) => {
    const prev = applyPatch(h.cur, from.pop()!);
    to.push(diffText(prev, h.cur));
    put(prev);
  };
  const undo = () => {
    if (h.timer) clearTimeout(h.timer);
    snap();
    if (!h.past.length) return false;
    step(h.past, h.future);
    return true;
  };
  const redo = () => {
    if (!h.future.length) return false;
    step(h.future, h.past);
    return true;
  };
  el.addEventListener('input', record);
  el.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { if (undo()) { e.preventDefault(); e.stopPropagation(); } }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { if (redo()) { e.preventDefault(); e.stopPropagation(); } }
  });
  return { undo, redo, snap, depth: () => h.past.length + 1, insert: t => insertAtCursor(el, t) };
}
