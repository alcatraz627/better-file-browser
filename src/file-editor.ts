// Editing a text file in place on its file page. Only files inside a folder
// the owner allowed (or a file allowed on its own) can be edited; the native
// host enforces that boundary and keeps a backup of the previous text on
// every save. The reading column becomes coloured, numbered source, a small
// floating pill holds the save state, the Raw / Split / Rich switch for
// formats with a rendered view, the problem count and Done, and the text
// saves itself shortly after you stop typing (⌘S saves at once).
import { esc } from './utils';
import { highlightCode, splitHighlighted } from './renderers';
import { formatFor, diagnose, type Diagnostic } from './formats';
import { kvGet, kvSet } from './kv';
import { notes, NotesError } from './notes';
import { attachBuffer, indentLines } from './editor';
import { wholeText, windowedText, lineStart, type TextWindow } from './text-window';
import { UI_ICON } from './control-icons';
import { carrier } from './comment-anchor';

const AUTOSAVE_MS = 800;
const CHECK_MS = 300;
const MODE_KEY = 'bfb-edit-mode-v1';
type Mode = 'raw' | 'split' | 'rich';
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'raw', label: 'Raw', hint: 'The text alone' },
  { id: 'split', label: 'Split', hint: 'Text and rendered view side by side' },
  { id: 'rich', label: 'Rich', hint: 'The rendered view alone' },
];
// Past this size a file edits in large mode: lines do not wrap, so every row
// has one height and only the rows near the viewport are painted, coloured a
// block of lines at a time. Below it every line is a painted row, which costs
// about 12 µs per line on each key (24 ms at 2,000 lines).
const BIG_LINES = 4000, BIG_CHARS = 400_000;
const BLOCK = 200;          // lines coloured together in large mode
const WIN_PAD = 60;         // rows painted beyond each edge of the viewport
// Checks and the rendered view parse the whole text, so very large files skip
// the checks and redraw the rendered view only after a longer pause.
const CHECK_MAX = 2_000_000, BIG_RENDER_MS = 1000;
const TA_LINES = 3000;      // lines the textarea holds at once in large mode

export { splitHighlighted };

/** The allowed folder holding `path`, or null; ~ and trailing slashes are tolerated.
 *  An entry naming the file itself allows that file alone, with its folder as root. */
export function editableRoot(path: string, folders: string[] | undefined, home = ''): string | null {
  for (const raw of folders ?? []) {
    let f = raw.trim().replace(/\/+$/, '');
    if (!f) continue;
    if (f === '~' || f.startsWith('~/')) { if (!home) continue; f = home + f.slice(1); }
    if (path.startsWith(f + '/')) return f;
    if (path === f) return f.slice(0, f.lastIndexOf('/'));
  }
  return null;
}

export interface FileEditorHost {
  root: string; rel: string; ext: string; href: string;
  status(text: string): void;
  // The saved text, so the reading view shows it when the editor closes.
  saved(text: string): void;
  closed(): void;
  /** Comment threads on the file, marked in the gutter; offsets are in the text as last saved. */
  comments?: { marks(): { id: string; offset: number; length: number }[]; open(id: string): void };
}

export interface FileEditor {
  dirty(): boolean; close(): void;
  /** Select a span given in the text as last saved, carried over unsaved edits. */
  select(start: number, end: number): void;
  /** The comment threads changed: mark the gutter again. */
  marks(): void;
}

export async function openFileEditor(box: HTMLElement, host: FileEditorHost): Promise<FileEditor | null> {
  let doc: { text: string; mtime: number };
  try { doc = await notes.fileRead(host.root, host.rel); }
  catch (err) { host.status(`cannot edit: ${(err as NotesError).message}`); return null; }
  let lineCount = 1;
  for (let p = doc.text.indexOf('\n'); p !== -1 && lineCount <= BIG_LINES; p = doc.text.indexOf('\n', p + 1)) lineCount++;
  const big = lineCount > BIG_LINES || doc.text.length > BIG_CHARS;

  const fmt = formatFor(host.ext);
  const isMd = fmt?.id === 'markdown';
  box.innerHTML = `
    <div id="fe-fe-banner" style="display:none"></div>
    <div id="fe-fe-scroll">
      <div id="fe-fe-col">
        <div id="fe-fe-src">
          <pre id="fe-fe-paint" aria-hidden="true">${big ? '<div id="fe-fe-win"></div>' : ''}</pre>
          <textarea id="fe-fe-ta" spellcheck="false" aria-label="File text"${big ? ' wrap="off"' : ''}></textarea>
        </div>
        ${fmt ? `<div id="fe-fe-view" class="${isMd ? 'fe-md' : 'fe-fe-rich'}" hidden></div>` : ''}
      </div>
    </div>
    <div id="fe-fe-pill" role="toolbar" aria-label="Editing">
      <span id="fe-fe-state"></span>
      <button type="button" class="btn" id="fe-fe-diag" data-act="diag" hidden></button>
      ${fmt ? `<span class="fe-seg fe-fe-modes" role="group" aria-label="View">${MODES.map(m =>
        `<button type="button" class="fe-seg-b" data-mode="${m.id}" title="${m.hint} (⌘⇧P cycles)">${m.label}</button>`).join('')}</span>` : ''}
      <button type="button" class="btn" data-variant="solid" data-act="done" title="Back to reading (Esc)">Done</button>
    </div>`;
  const ta = box.querySelector<HTMLTextAreaElement>('#fe-fe-ta')!;
  const paintEl = box.querySelector<HTMLElement>('#fe-fe-paint')!;
  const src = box.querySelector<HTMLElement>('#fe-fe-src')!;
  const view = box.querySelector<HTMLElement>('#fe-fe-view');
  const state = box.querySelector<HTMLElement>('#fe-fe-state')!;
  const banner = box.querySelector<HTMLElement>('#fe-fe-banner')!;
  const diagBtn = box.querySelector<HTMLElement>('#fe-fe-diag')!;
  const scroller = box.querySelector<HTMLElement>('#fe-fe-scroll')!;
  box.classList.toggle('fe-fe-big', big);
  // Painted rows round their height to whole pixels while textarea lines keep
  // the fraction (22 against 22.1 px), so the two drift apart a line every few
  // hundred lines. A whole-pixel line height keeps them in step.
  const lhPx = Math.round(parseFloat(getComputedStyle(ta).fontSize) * 1.7);
  paintEl.style.lineHeight = ta.style.lineHeight = lhPx + 'px';
  const tw: TextWindow = big ? windowedText(ta, doc.text, TA_LINES) : wholeText(ta, doc.text);
  const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`, { get: tw.text, set: tw.set });
  let base = doc.text;
  let saving = false;
  let failed = '';   // why the last save failed, until one succeeds
  const saved = kvGet(MODE_KEY) as Mode | null;
  let mode: Mode = fmt && saved && MODES.some(m => m.id === saved) ? saved : 'raw';
  let diags: Diagnostic[] = [];
  let checkTimer = 0;
  let timer = 0;

  const isDirty = () => tw.text() !== base;
  // The coloured copy behind the textarea: one numbered row per line, so a
  // wrapped line keeps one number and the caret sits over its own text.
  let curRow = -1;
  const markLine = () => {
    // Read the value once: each read of ta.value copies all of it.
    const v = ta.value, end = ta.selectionStart;
    let i = tw.first();
    for (let p = v.indexOf('\n'); p !== -1 && p < end; p = v.indexOf('\n', p + 1)) i++;
    if (i === curRow) return;
    rowEl(curRow)?.classList.remove('cur');
    rowEl(i)?.classList.add('cur');
    curRow = i;
  };
  // A keystroke usually changes one row, so only the rows between the first
  // and last difference are rebuilt; a large file would otherwise rebuild and
  // lay out every row per key. The textarea is absolutely placed, so its
  // height follows the painted copy without being reset first.
  let painted: string[] = [];
  const rowHtml = (r: string, i: number) => `<div class="fe-fe-row"><span class="fe-fe-ln">${i + 1}</span><span class="fe-fe-code">${r || ' '}</span></div>`;
  // Large mode: the painted copy is a window of rows inside a box as tall as
  // the whole text. Colours come a block of lines at a time, cached by the
  // block's text, so a key re-colours only the block it touched. A comment or
  // string that spans a block edge may be coloured as plain text there.
  const win = box.querySelector<HTMLElement>('#fe-fe-win');
  let lines: string[] = [];
  let lh = 0, winFirst = 0, winLast = -1;
  const blockCache = new Map<string, string[]>();
  const blockRows = (b: number) => {
    const text = lines.slice(b * BLOCK, (b + 1) * BLOCK).join('\n');
    let rows = blockCache.get(text);
    if (!rows) {
      rows = splitHighlighted(highlightCode(text, host.ext));
      if (blockCache.size > 64) blockCache.delete(blockCache.keys().next().value!);
      blockCache.set(text, rows);
    }
    return rows;
  };
  const rowEl = (i: number): HTMLElement | undefined =>
    (big ? (i >= winFirst && i <= winLast ? win!.children[i - winFirst] : undefined) : paintEl.children[i]) as HTMLElement | undefined;
  const lineAtY = (clientY: number) => Math.floor((clientY - paintEl.getBoundingClientRect().top) / lh);
  // In Split the text side scrolls on its own; otherwise the whole column does.
  const viewport = () => mode === 'split' ? src : scroller;
  const paintWindow = (force = false) => {
    const vp = viewport();
    const top = vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top;
    const first = Math.max(0, Math.floor(top / lh) - WIN_PAD);
    const last = Math.min(lines.length - 1, Math.ceil((top + vp.clientHeight) / lh) + WIN_PAD);
    // Scrolling within the padding keeps the painted rows.
    if (!force && first >= winFirst && last <= winLast && (winFirst === 0 || first - winFirst < WIN_PAD) && (winLast === lines.length - 1 || winLast - last < WIN_PAD)) return;
    let html = '';
    for (let b = Math.floor(first / BLOCK); b <= Math.floor(last / BLOCK); b++) {
      const rows = blockRows(b);
      const from = Math.max(first, b * BLOCK), to = Math.min(last, b * BLOCK + rows.length - 1);
      for (let i = from; i <= to; i++) html += rowHtml(rows[i - b * BLOCK], i);
    }
    win!.style.transform = `translateY(${first * lh}px)`;
    win!.innerHTML = html;
    winFirst = first; winLast = last;
    rowEl(curRow)?.classList.add('cur');
    markProblems();
    markComments();
  };
  let widest = 0, charW = 0;
  // The textarea sits over the lines it holds.
  const placeTa = () => { ta.style.top = tw.first() * lh + 'px'; ta.style.height = tw.size() * lh + 'px'; };
  // Keep the view where it is while the window moves under it.
  const moveWindow = (line: number) => {
    const vp = viewport(), top = vp.scrollTop, from = tw.first();
    tw.center(line);
    if (tw.first() !== from) { placeTa(); vp.scrollTop = top; curRow = -1; markLine(); }
  };
  const paintBig = () => {
    lines = tw.text().split('\n');
    lh = parseFloat(getComputedStyle(ta).lineHeight);
    if (!charW) {
      const probe = win!.appendChild(document.createElement('span'));
      probe.textContent = '0'.repeat(100);
      charW = probe.getBoundingClientRect().width / 100;
      probe.remove();
    }
    // Without wrapping the text is as wide as its longest line.
    let w = 0;
    for (const l of lines) if (l.length > w) w = l.length;
    if (w > widest || w < widest - 40) { widest = w; src.style.minWidth = `${52 + (w + 4) * charW}px`; }
    paintEl.style.height = lines.length * lh + 'px';
    placeTa();
    paintWindow(true);
  };
  if (big) for (const el of [scroller, src]) el.addEventListener('scroll', () => {
    paintWindow();
    const vp = viewport();
    moveWindow(Math.floor((vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top + vp.clientHeight / 2) / lh));
  }, { passive: true });

  const paintSource = () => {
    if (big) { paintBig(); curRow = -1; markLine(); return; }
    const rows = splitHighlighted(highlightCode(tw.text(), host.ext));
    let a = 0;
    while (a < rows.length && a < painted.length && rows[a] === painted[a]) a++;
    let b = painted.length, c = rows.length;
    while (b > a && c > a && rows[c - 1] === painted[b - 1]) { b--; c--; }
    for (let i = b - 1; i >= a; i--) paintEl.children[i].remove();
    const html = rows.slice(a, c).map((r, k) => rowHtml(r, a + k)).join('');
    const next = paintEl.children[a];
    if (next) next.insertAdjacentHTML('beforebegin', html); else paintEl.insertAdjacentHTML('beforeend', html);
    if (rows.length !== painted.length) for (let i = c; i < rows.length; i++) paintEl.children[i].firstChild!.textContent = String(i + 1);
    painted = rows;
    ta.style.height = paintEl.offsetHeight + 'px';
    paintEl.querySelector('.cur')?.classList.remove('cur');   // kept rows keep their old mark
    curRow = -1; markLine();
    markProblems();
    markComments();
  };
  // Problem rows: the gutter number turns red or amber and the message shows
  // on hover; the pill counts them and a click goes to the first.
  const markProblems = () => {
    for (const r of paintEl.querySelectorAll('.fe-fe-row.err, .fe-fe-row.warn')) { r.classList.remove('err', 'warn'); r.removeAttribute('title'); }
    for (const d of diags) {
      const row = rowEl(d.line - 1);
      if (!row) continue;
      row.classList.add(d.severity === 'error' || row.classList.contains('err') ? 'err' : 'warn');
      if (row.classList.contains('err')) row.classList.remove('warn');
      row.title = row.title ? `${row.title}\n${d.message}` : `Line ${d.line}: ${d.message}`;
    }
    const errors = diags.filter(d => d.severity === 'error').length;
    diagBtn.hidden = !diags.length;
    diagBtn.className = `btn fe-fe-diag ${errors ? 'error' : 'warn'}`;
    const warns = diags.length - errors;
    diagBtn.textContent = [errors && `${errors} error${errors > 1 ? 's' : ''}`, warns && `${warns} warning${warns > 1 ? 's' : ''}`].filter(Boolean).join(', ');
    diagBtn.title = diags.slice(0, 12).map(d => `Line ${d.line}: ${d.message}`).join('\n') + (diags.length > 12 ? `\nand ${diags.length - 12} more` : '');
  };
  // Rows holding the start of an open comment get a marker in the gutter;
  // while typing they follow the edit without anything being saved.
  let cmRows = new Map<number, string>();
  const markComments = () => {
    for (const r of paintEl.querySelectorAll('.fe-fe-row.cm')) { r.classList.remove('cm'); r.removeAttribute('data-cm'); }
    cmRows = new Map();
    const ms = host.comments?.marks() ?? [];
    if (!ms.length) return;
    const t = tw.text();
    const at = carrier(base, t);
    let line = 0, p = -1;
    for (const m of ms.map(m => ({ id: m.id, o: at(m.offset) })).sort((a, b) => a.o - b.o)) {
      for (let nl = t.indexOf('\n', p + 1); nl !== -1 && nl < m.o; nl = t.indexOf('\n', p + 1)) { p = nl; line++; }
      cmRows.set(line, cmRows.has(line) ? cmRows.get(line)! : m.id);
    }
    for (const l of cmRows.keys()) rowEl(l)?.classList.add('cm');
  };
  const check = () => { const t = tw.text(); diags = t.length > CHECK_MAX ? [] : diagnose(host.ext, t); markProblems(); };
  const checkLater = () => { clearTimeout(checkTimer); checkTimer = window.setTimeout(check, CHECK_MS); };
  const paint = () => {
    const dirty = isDirty();
    state.innerHTML = saving ? 'Saving…' : failed && dirty ? '<span class="fe-fe-dot"></span>Not saved' : dirty ? '<span class="fe-fe-dot"></span>Edited' : `${UI_ICON.check}Saved`;
    state.className = saving ? 'busy' : failed && dirty ? 'failed' : dirty ? 'dirty' : 'saved';
    state.title = failed && dirty ? failed : '';
    renderView();
  };
  // The rendered view follows the text; an HTML frame is only rebuilt when
  // the text changed, so typing elsewhere does not reload the page in it.
  let shown = '';
  let renderTimer = 0;
  const renderView = () => {
    if (!view || !fmt || mode === 'raw' || shown === tw.text()) return;
    if (big && shown) { clearTimeout(renderTimer); renderTimer = window.setTimeout(drawView, BIG_RENDER_MS); return; }
    drawView();
  };
  const drawView = () => {
    const t = tw.text();
    if (!view || !fmt || mode === 'raw' || shown === t) return;
    const top = view.scrollTop;
    view.innerHTML = fmt.rich(t, host.href);
    view.scrollTop = top;
    shown = t;
  };
  const setMode = (m: Mode) => {
    if (!view) return;
    mode = m;
    kvSet(MODE_KEY, m);
    box.dataset.mode = m;
    view.hidden = m === 'raw'; src.hidden = m === 'rich';
    if (big && m !== 'rich') paintWindow(true);
    box.querySelectorAll<HTMLElement>('[data-mode]').forEach(b => { b.classList.toggle('on', b.dataset.mode === m); b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
    renderView();
    if (m !== 'rich') ta.focus({ preventScroll: true });
  };
  const nextMode = () => setMode(MODES[(MODES.findIndex(x => x.id === mode) + 1) % MODES.length].id);
  // In Split the rendered side keeps pace with the text side.
  box.addEventListener('scroll', e => {
    if (mode !== 'split' || !view || e.target !== src) return;
    const sc = src;
    const ratio = sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight);
    view.scrollTop = ratio * (view.scrollHeight - view.clientHeight);
  }, true);

  const write = async (expect: number) => {
    saving = true; paint();
    let retryAt = 0;
    try {
      const text = tw.text();
      const r = await notes.fileWrite(host.root, host.rel, text, expect);
      doc = { text, mtime: r.mtime }; base = text; failed = '';
      banner.style.display = 'none';
      host.saved(text);
    } catch (err) {
      const e = err as NotesError;
      if (e.code === 'notes_conflict') {
        // Only the time moved (touched, same bytes): save over it once.
        const now = await notes.fileRead(host.root, host.rel).catch(() => null);
        if (now && now.text === doc.text && expect !== now.mtime) { doc = now; retryAt = now.mtime; }
        else showConflict();
      }
      else { failed = `Not saved: ${e.message}`; host.status(`not saved: ${e.message}`); }
    } finally { saving = false; paint(); }
    if (retryAt) await write(retryAt);
  };
  const save = () => { clearTimeout(timer); if (!saving && isDirty()) void write(doc.mtime); };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(save, AUTOSAVE_MS); };

  function showConflict(): void {
    banner.style.display = '';
    banner.innerHTML = `<span>${esc(host.rel.split('/').pop()!)} changed on disk since you opened it.</span>
      <button class="btn" data-act="reload" title="Drop your changes and load the file as it is now">Load from disk</button>
      <button class="btn" data-act="overwrite" title="Save your text over the newer file (the newer one is kept as a backup)">Keep mine</button>`;
  }
  // Called by the page's autoreload when the file changed underneath us.
  const external = async () => {
    try {
      // A stat first, so an unchanged large file is not read again every poll.
      if ((await notes.fileStat(host.root, host.rel)).mtime === doc.mtime) return;
      const now = await notes.fileRead(host.root, host.rel);
      if (now.mtime === doc.mtime) return;
      // Touched but unchanged (a sync tool, a formatter that wrote the same
      // bytes): take the new time quietly, there is nothing to choose between.
      if (now.text === doc.text) { doc = now; return; }
      if (!isDirty()) { doc = now; base = now.text; buf.snap(); tw.set(now.text); buf.snap(); check(); paintSource(); paint(); }
      else showConflict();
    } catch { /* host gone; the next save reports it */ }
  };

  // Done saves what is pending first; only a failed or conflicting save asks.
  const close = async () => {
    clearTimeout(timer);
    if (isDirty() && !saving && banner.style.display === 'none') await write(doc.mtime);
    if (isDirty() && !confirm('Your last changes are not saved. Leave anyway?')) return;
    clearInterval(watch);
    clearTimeout(checkTimer);
    clearTimeout(renderTimer);
    document.removeEventListener('selectionchange', onSelection);
    box.innerHTML = '';
    host.closed();
  };

  const selectSpan = (pos: number, end: number) => {
    if (mode === 'rich') setMode('split');
    const t = tw.text();
    let line = 0;
    for (let p = t.indexOf('\n'); p !== -1 && p < pos; p = t.indexOf('\n', p + 1)) line++;
    ta.focus({ preventScroll: true });
    tw.select(pos, end);
    if (big) { placeTa(); const vp = viewport(); vp.scrollTop += line * lh - (vp.getBoundingClientRect().top - paintEl.getBoundingClientRect().top) - vp.clientHeight / 2; paintWindow(true); }
    else rowEl(line)?.scrollIntoView({ block: 'center' });
    markLine();
  };
  const goToLine = (line: number) => {
    const t = tw.text();
    const pos = lineStart(t, line - 1);
    const end = t.indexOf('\n', pos);
    selectSpan(pos, end === -1 ? t.length : end);
  };
  // The textarea covers the gutter too, so a click on a comment marker lands on it.
  ta.addEventListener('mousedown', e => {
    if (!cmRows.size || e.button !== 0 || e.offsetX > parseFloat(getComputedStyle(ta).paddingLeft)) return;
    const line = big ? lineAtY(e.clientY) : [...paintEl.children].findIndex(r => r.getBoundingClientRect().bottom > e.clientY);
    const id = cmRows.get(line);
    if (!id) return;
    e.preventDefault();
    host.comments?.open(id);
  });
  box.addEventListener('click', e => {
    const m = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]')?.dataset.mode as Mode | undefined;
    if (m) setMode(m);
  });
  box.addEventListener('click', async e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'save') save();
    else if (act === 'done') void close();
    else if (act === 'diag' && diags.length) goToLine(diags[0].line);
    else if (act === 'reload') { const now = await notes.fileRead(host.root, host.rel); doc = now; base = now.text; buf.snap(); tw.set(now.text); banner.style.display = 'none'; paintSource(); paint(); }
    else if (act === 'overwrite') { const now = await notes.fileRead(host.root, host.rel); void write(now.mtime); }
  });
  ta.addEventListener('input', () => { paintSource(); paint(); later(); checkLater(); });
  const onSelection = () => { if (document.activeElement === ta) markLine(); };
  document.addEventListener('selectionchange', onSelection);
  for (const ev of ['selectionchange', 'mouseup', 'keyup', 'focus']) ta.addEventListener(ev, markLine);
  // The textarea only covers the text itself, so a click on the blank space
  // below a short file or beside the column would otherwise do nothing. Put
  // the caret at the end of the line level with the click, or at the end.
  box.querySelector('#fe-fe-scroll')!.addEventListener('mousedown', e => {
    const me = e as MouseEvent;
    if (me.button !== 0 || mode === 'rich' || me.target === ta || view?.contains(me.target as Node)) return;
    me.preventDefault();
    const t = tw.text();
    const line = big ? lineAtY(me.clientY) : [...paintEl.children].findIndex(r => r.getBoundingClientRect().bottom > me.clientY);
    let pos = t.length;
    if (line >= 0) { const nl = t.indexOf('\n', lineStart(t, line)); if (nl !== -1) pos = nl; }
    ta.focus({ preventScroll: true });
    const top = viewport().scrollTop;
    tw.select(pos, pos);
    if (big) { placeTa(); viewport().scrollTop = top; }
    markLine();
  });
  box.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p' && fmt) { e.preventDefault(); nextMode(); }
    else if (e.key === 'Escape' && mode === 'rich') { e.preventDefault(); setMode('raw'); }
  });
  // Large mode: keys that move the caret far bring the window along first.
  if (big) ta.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      const toEnd = e.key === 'ArrowDown' || e.key === 'End';
      const at = toEnd ? tw.text().length : 0;
      const keep = e.shiftKey ? tw.selection() : null;
      tw.select(keep ? (toEnd ? keep.start : at) : at, keep ? (toEnd ? at : keep.end) : at);
      placeTa();
      const vp = viewport(); vp.scrollTop = toEnd ? vp.scrollHeight : 0;
      paintWindow(true); curRow = -1; markLine();
    } else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
      markLine();
      moveWindow(curRow);
    }
  });
  ta.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === 'p') return;   // the box cycles the view
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    // The undo buffer's own listener takes the step; this only keeps the
    // browser's undo, which knows nothing of the buffer, from running too.
    else if (mod && e.key.toLowerCase() === 'z') e.preventDefault();
    else if (e.key === 'Escape') { e.preventDefault(); void close(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      buf.snap();
      const r = indentLines(ta.value, { start: ta.selectionStart, end: ta.selectionEnd }, e.shiftKey);
      ta.value = r.text; ta.setSelectionRange(r.start, r.end);
      paintSource(); paint(); later();
    }
    e.stopPropagation();   // page keys (r, t, w, [ ]) must not fire while typing
  });
  const watch = setInterval(() => { if (document.visibilityState === 'visible' && !saving) void external(); }, 2000);
  window.addEventListener('beforeunload', e => { if (box.isConnected && isDirty()) e.preventDefault(); });

  diags = doc.text.length > CHECK_MAX ? [] : diagnose(host.ext, doc.text);
  paintSource();
  paint();
  if (fmt) setMode(mode);
  ta.focus();
  return {
    dirty: isDirty, close: () => void close(),
    select: (start, end) => { const at = carrier(base, tw.text()); selectSpan(at(start), at(end)); },
    marks: markComments,
  };
}
