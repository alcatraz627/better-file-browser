// The text behind the file editor's textarea. A browser textarea re-lays out
// all of its text on every key, which costs about 4 µs a line (400 ms for a
// 100,000-line file), so a large file keeps only a window of lines in the
// textarea and the rest in memory. The window moves when the view or the caret
// nears its edge. Small files hold everything in the textarea, as before.
//
// Offsets passed in and out are into the whole text. Select-all, copy, cut and
// typing over a select-all act on the whole text, not just the window.

export interface TextWindow {
  /** The whole text. */
  text(): string;
  /** Replace the whole text, keeping the window near where it was. */
  set(text: string): void;
  /** The first line the textarea holds. */
  first(): number;
  /** Lines the textarea holds. */
  size(): number;
  /** The selection as offsets into the whole text. */
  selection(): { start: number; end: number };
  /** Select a range of the whole text, moving the window to it if needed. */
  select(start: number, end: number): void;
  /** Move the window so it is centred on `line`, keeping the selection where it can. */
  center(line: number): void;
}

/** Everything in the textarea: the small-file editor. */
export function wholeText(ta: HTMLTextAreaElement, text: string): TextWindow {
  ta.value = text;
  return {
    text: () => ta.value,
    set: t => { ta.value = t; },
    first: () => 0,
    size: () => countLines(ta.value),
    selection: () => ({ start: ta.selectionStart, end: ta.selectionEnd }),
    select: (a, b) => ta.setSelectionRange(a, b),
    center: () => {},
  };
}

export const countLines = (t: string) => {
  let n = 1;
  for (let p = t.indexOf('\n'); p !== -1; p = t.indexOf('\n', p + 1)) n++;
  return n;
};

/** Offset where line `line` (0-based) starts, or the text's length past the end. */
export function lineStart(t: string, line: number, from = 0, fromLine = 0): number {
  let p = from;
  for (let i = fromLine; i < line; i++) {
    const nl = t.indexOf('\n', p);
    if (nl === -1) return t.length;
    p = nl + 1;
  }
  return p;
}

/** A window of `lines` lines in the textarea; the text before and after it stays in memory. */
export function windowedText(ta: HTMLTextAreaElement, text: string, lines = 3000): TextWindow {
  // The whole text is always pre + ta.value + post. pre ends with the newline
  // before the window's first line; post starts with the newline after its last.
  let pre = '', post = '', first = 0, held = 1, after = 0;
  const text_ = () => pre + ta.value + post;
  const allSelected = () => ta.selectionStart === 0 && ta.selectionEnd === ta.value.length && (pre || post) !== '';
  let selectAll = false;

  const place = (t: string, center: number, selStart: number, selEnd: number) => {
    const total = countLines(t);
    first = Math.max(0, Math.min(center - (lines >> 1), total - lines));
    const a = lineStart(t, first);
    let b = lineStart(t, first + lines, a, first);
    if (b > a && b <= t.length && t[b - 1] === '\n' && first + lines < total) b--;   // leave the newline to post
    pre = t.slice(0, a); post = t.slice(b);
    ta.value = t.slice(a, b);
    held = Math.min(lines, total - first);
    after = total - first - held;
    const clamp = (x: number) => Math.max(0, Math.min(ta.value.length, x - a));
    ta.setSelectionRange(clamp(selStart), clamp(selEnd));
  };
  const lineOf = (t: string, offset: number) => {
    let n = 0;
    for (let p = t.indexOf('\n'); p !== -1 && p < offset; p = t.indexOf('\n', p + 1)) n++;
    return n;
  };
  const selection = () => selectAll && allSelected()
    ? { start: 0, end: text_().length }
    : { start: pre.length + ta.selectionStart, end: pre.length + ta.selectionEnd };

  ta.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) { selectAll = true; return; }
    if (!['Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) selectAll = false;
  }, true);
  ta.addEventListener('mousedown', () => { selectAll = false; });
  const copyAll = (e: ClipboardEvent, cut: boolean) => {
    if (!selectAll || !allSelected()) return;
    e.preventDefault();
    e.clipboardData?.setData('text/plain', text_());
    if (cut) { pre = post = ''; first = 0; after = 0; ta.value = ''; held = 1; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  };
  ta.addEventListener('copy', e => copyAll(e, false));
  ta.addEventListener('cut', e => copyAll(e, true));
  // Typing over a select-all replaces the whole text, not only the window.
  ta.addEventListener('beforeinput', () => {
    if (selectAll && allSelected()) { pre = post = ''; first = 0; after = 0; }
    selectAll = false;
  });
  ta.addEventListener('input', () => { held = countLines(ta.value); });

  place(text, 0, 0, 0);
  return {
    text: text_,
    set: t => { const s = selection(); place(t, first + (lines >> 1), s.start, s.end); },
    first: () => first,
    size: () => held,
    selection,
    select: (s, e) => {
      if (s >= pre.length && e <= pre.length + ta.value.length) { ta.setSelectionRange(s - pre.length, e - pre.length); return; }
      const t = text_();
      place(t, lineOf(t, s), s, e);
    },
    center: line => {
      const total = first + held + after;
      const target = Math.max(0, Math.min(line - (lines >> 1), total - lines));
      // Stay put while the line is well inside, or the window cannot move.
      if (target === first || (line - first > lines >> 3 && first + held - line > lines >> 3)) return;
      const s = selection();
      place(text_(), line, s.start, s.end);
    },
  };
}
