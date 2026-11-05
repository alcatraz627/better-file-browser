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
import { textPref, getSettings } from './storage';
import { notes, NotesError } from './notes';
import { attachBuffer, diffText, mapCaret, indentLines, continueList, absorbTypedMarker, autoMarkerAfter, moveLines, duplicateLines, type AutoMarker, type TextEdit } from './editor';
import { formatButtons, fileButtons, wireBar, formatEdit, formatKey, tableAt, mountVersions, wirePictures } from './note-tools';
import { wholeText, windowedText, lineStart, type TextWindow } from './text-window';
import { UI_ICON } from './control-icons';
import { carrier } from './comment-anchor';
import { errorText } from './errors';
import { morphInto } from './morph-view';
import { watch } from './watch';
import { lineDiffHtml } from './line-diff';

const AUTOSAVE_MS = 800;
const CHECK_MS = 300;
const RENDER_MS = 150;      // the rendered side waits this long after a key, so typing never waits on a redraw
const RETRY_MS = 4000;      // a failed save tries again this often while the text differs
const modePref = textPref('bfb-edit-mode-v1');
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

/** The folders whose text files can be edited: the ones allowed, plus the notes folder, whose
 *  files bfb already writes. */
export function editableFoldersOf(s: { editableFolders?: string[]; notesRoot?: string }): string[] {
  return [...(s.editableFolders ?? []), ...(s.notesRoot ? [s.notesRoot] : [])];
}

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
  /** The file cannot be opened for editing, and why. */
  cannotEdit?(why: string): void;
  // The saved text, so the reading view shows it when the editor closes.
  saved(text: string): void;
  /** The file as already read, so the page can keep showing until the editor is ready. */
  doc?: { text: string; mtime: number };
  /** Where in the text the caret starts: the spot being read when Edit was pressed. Top when absent. */
  startAt?(text: string): number;
  /** Ask a yes or no question in the page's own style. */
  confirm?(message: string, yes: string): Promise<boolean>;
  /** Whether this text is too large to wrap while it is edited. */
  noWrap?(fixed: boolean): void;
  /** A short message at the bottom of the page. */
  notify?(text: string): void;
  /** The text as it stands while editing, so the counts around the page follow it. */
  typed?(text: string): void;
  closed(): void;
  /** Ask for a new name beside `anchor`. The page goes to the renamed file, so the editor needs nothing back. */
  rename?(anchor: HTMLElement): void;
  /** Move the file to .trash and leave the page. False when it stayed. */
  del?(): Promise<boolean>;
  /** Comment threads on the file, marked in the gutter; offsets are in the text as last saved. */
  comments?: { marks(): { id: string; offset: number; length: number }[]; open(id: string): void; fromSelection(): boolean };
}

export interface FileEditor {
  dirty(): boolean; close(): void;
  /** Show a span given in the text as last saved, carried over unsaved edits: its line comes into view and the caret goes there, while focus stays where it is. */
  select(start: number, end: number): void;
  /** The comment threads changed: mark the gutter again. */
  marks(): void;
}

export async function openFileEditor(box: HTMLElement, host: FileEditorHost): Promise<FileEditor | null> {
  let doc: { text: string; mtime: number };
  try { doc = host.doc ?? await notes.fileRead(host.root, host.rel); }
  catch (err) { const why = errorText(err, 'Opening it for editing'); if (host.cannotEdit) host.cannotEdit(why); else host.status(why); return null; }
  let lineCount = 1;
  for (let p = doc.text.indexOf('\n'); p !== -1 && lineCount <= BIG_LINES; p = doc.text.indexOf('\n', p + 1)) lineCount++;
  const big = lineCount > BIG_LINES || doc.text.length > BIG_CHARS;

  const fmt = formatFor(host.ext);
  const isMd = fmt?.id === 'markdown';
  box.innerHTML = `
    <div id="fe-fe-banner" class="notice" data-tone="warn" hidden></div>
    <div id="fe-fe-diff" hidden></div>
    <div id="fe-fe-bar" class="bar" role="toolbar" aria-label="Format and file">
      ${isMd ? `${formatButtons({ linkKey: false })}<span class="bar-sep" aria-hidden="true"></span>` : ''}
      ${fileButtons({ steps: false, manage: !!host.rename })}
    </div>
    <div id="fe-ed-hist" hidden></div>
    <div id="fe-fe-stage">
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
      <button type="button" class="btn" data-variant="solid" data-shape="pill" data-act="done" title="Back to reading (Esc)">Done</button>
    </div>
    </div>`;
  const ta = box.querySelector<HTMLTextAreaElement>('#fe-fe-ta')!;
  const paintEl = box.querySelector<HTMLElement>('#fe-fe-paint')!;
  const src = box.querySelector<HTMLElement>('#fe-fe-src')!;
  const view = box.querySelector<HTMLElement>('#fe-fe-view');
  const state = box.querySelector<HTMLElement>('#fe-fe-state')!;
  const banner = box.querySelector<HTMLElement>('#fe-fe-banner')!;
  const diffBox = box.querySelector<HTMLElement>('#fe-fe-diff')!;
  const diagBtn = box.querySelector<HTMLElement>('#fe-fe-diag')!;
  const scroller = box.querySelector<HTMLElement>('#fe-fe-scroll')!;
  box.classList.toggle('fe-fe-big', big);
  host.noWrap?.(big);
  // Painted rows round their height to whole pixels while textarea lines keep
  // the fraction (22 against 22.1 px), so the two drift apart a line every few
  // hundred lines. A whole-pixel line height keeps them in step.
  const lhPx = Math.round(parseFloat(getComputedStyle(ta).fontSize) * 1.7);
  paintEl.style.lineHeight = ta.style.lineHeight = lhPx + 'px';
  const tw: TextWindow = big ? windowedText(ta, doc.text, TA_LINES) : wholeText(ta, doc.text);
  // An undo far from the view brings the caret's line back into it, once the rows are painted.
  const revealCaret = () => requestAnimationFrame(() => { markLine(); rowEl(curRow)?.scrollIntoView({ block: 'nearest' }); });
  const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`, { get: tw.text, set: tw.set, caret: big ? undefined : at => { tw.select(at, at); revealCaret(); } });
  let base = doc.text;
  let saving = false;
  let failed = '';   // why the last save failed, until one succeeds
  const saved = modePref.get() as Mode;
  let mode: Mode = fmt && saved && MODES.some(m => m.id === saved) ? saved : 'raw';
  // Two panes side by side do not fit a phone, so it opens on the text alone.
  if (mode === 'split' && matchMedia('(max-width:760px)').matches) mode = 'raw';
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

  // The painted copy re-wraps on its own when the column changes width (window
  // resize, sidebar, Split, a font arriving late); the textarea must follow, or
  // it ends up shorter than its text, scrolls inside itself, and the caret
  // drifts off the words. It never scrolls itself: the page scrolls instead.
  const sizeTa = new ResizeObserver(() => { if (!big) ta.style.height = paintEl.offsetHeight + 'px'; });
  sizeTa.observe(paintEl);
  ta.addEventListener('scroll', () => { if (big) return; if (ta.scrollTop) ta.scrollTop = 0; if (ta.scrollLeft) ta.scrollLeft = 0; });

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
    for (const r of paintEl.querySelectorAll('.fe-fe-row.err, .fe-fe-row.warn')) { r.classList.remove('err', 'warn'); r.removeAttribute('title'); delete (r as HTMLElement).dataset.tip; }
    for (const d of diags) {
      const row = rowEl(d.line - 1);
      if (!row) continue;
      row.classList.add(d.severity === 'error' || row.classList.contains('err') ? 'err' : 'warn');
      if (row.classList.contains('err')) row.classList.remove('warn');
      row.title = row.title ? `${row.title}\n${d.message}` : `Line ${d.line}: ${d.message}`;
      row.dataset.tip = 'problem';
      row.dataset.line = String(d.line);
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
  const check = () => { const t = tw.text(); diags = t.length > CHECK_MAX ? [] : diagnose(host.ext, t); markProblems(); host.typed?.(t); };
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
    if (!shown) { drawView(); return; }
    clearTimeout(renderTimer);
    renderTimer = window.setTimeout(drawView, big ? BIG_RENDER_MS : RENDER_MS);
  };
  const morphView = view ? morphInto(view) : () => {};
  const drawView = () => {
    const t = tw.text();
    if (!view || !fmt || mode === 'raw' || shown === t) return;
    const top = view.scrollTop;
    morphView(fmt.rich(t, host.href));
    view.scrollTop = top;
    shown = t;
  };
  const setMode = (m: Mode) => {
    if (!view) return;
    mode = m;
    modePref.set(m);
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

  let inflight: Promise<void> | null = null;
  let saveAgain = false;   // ⌘S pressed during a save
  let retryTimer = 0;
  let gone = false;        // the file was moved or deleted while open
  const write = (expect: number): Promise<void> => { const p = writeNow(expect); inflight = p; return p; };
  const writeNow = async (expect: number): Promise<void> => {
    saving = true; paint();
    clearTimeout(retryTimer);
    let retryAt = 0;
    try {
      const text = tw.text();
      const r = await notes.fileWrite(host.root, host.rel, text, expect);
      doc = { text, mtime: r.mtime }; base = text; failed = '';
      banner.hidden = true; diffBox.hidden = true;
      host.saved(text);
    } catch (err) {
      const e = err as NotesError;
      if (e.code === 'notes_conflict') {
        // Only the time moved (touched, same bytes): save over it once.
        const now = await notes.fileRead(host.root, host.rel).catch(() => null);
        if (now && now.text === doc.text && expect !== now.mtime) { doc = now; retryAt = now.mtime; }
        else showConflict();
      }
      else if (e.code === 'notes_missing') { failed = 'The file is no longer there.'; showGone(); }
      else {
        failed = errorText(e, 'Saving');
        host.status(failed);
        retryTimer = window.setTimeout(() => { if (isDirty()) save(false); }, RETRY_MS);
      }
    } finally { saving = false; paint(); }
    if (retryAt) return write(retryAt);
    // Words typed while that save ran are still waiting for one of their own.
    if (saveAgain) { saveAgain = false; save(); }
    else if (isDirty() && !failed && banner.hidden) later();
  };
  // While the banner is up the file on disk is newer than the text this save
  // was based on, so a save would only be refused again. Say what to do instead.
  const save = (asked = true) => {
    clearTimeout(timer);
    if (saving) { if (asked) saveAgain = true; return; }
    if (!isDirty()) return;
    if (gone) { if (asked) askToChoose(); return; }
    if (!banner.hidden) { if (asked) askToChoose(); return; }
    void write(doc.mtime);
  };
  const askToChoose = () => {
    const msg = 'Not saved: choose Reload, Compare or Keep mine.';
    (host.notify ?? host.status)(msg);
    banner.classList.add('flash');
    setTimeout(() => banner.classList.remove('flash'), 700);
  };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(() => save(false), AUTOSAVE_MS); };

  // Moved or deleted under the editor: nothing can be saved to it, so offer the text itself.
  function showGone(): void {
    gone = true;
    banner.hidden = false;
    banner.innerHTML = `<span>File moved or deleted. Your text is only here.</span>
      <button class="btn" data-size="sm" data-variant="outline" data-act="copy-all" title="Copy all the text">${UI_ICON.copyImage}<span>Copy</span></button>
      <button class="btn" data-size="sm" data-variant="outline" data-act="recheck" title="Look for the file again">${UI_ICON.rotate}<span>Try again</span></button>`;
  }
  function showConflict(): void {
    banner.hidden = false;
    banner.innerHTML = `<span>Changed on disk.</span>
      <button class="btn" data-size="sm" data-variant="outline" data-act="reload" title="Drop your changes, load the file">${UI_ICON.rotate}<span>Reload</span></button>
      <button class="btn" data-size="sm" data-variant="outline" data-act="compare" title="Show what differs from your text">${UI_ICON.versions}<span>Compare</span></button>
      <button class="btn" data-size="sm" data-variant="outline" data-act="overwrite" title="Save yours; the newer file is backed up">${UI_ICON.check}<span>Keep mine</span></button>`;
  }
  // The lines that differ, the copy on disk against this one, under the banner.
  const showDiff = async () => {
    if (!diffBox.hidden) { diffBox.hidden = true; return; }
    let disk: string;
    try { disk = (await notes.fileRead(host.root, host.rel)).text; }
    catch (err) { host.status(errorText(err, 'Reading the file on disk')); return; }
    diffBox.innerHTML = lineDiffHtml(disk, tw.text());
    diffBox.hidden = false;
  };
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
      if (!isDirty()) { doc = now; takeFromDisk(now.text); buf.snap(); check(); paint(); }
      else showConflict();
    } catch (err) {
      if ((err as NotesError).code === 'notes_missing') { if (!gone) showGone(); }
      /* otherwise the host is gone; the next save reports it */
    }
  };
  // New text from disk: the caret keeps its words and the view stays put.
  function takeFromDisk(next: string): void {
    const was = tw.selection(), change = diffText(tw.text(), next), vp = viewport(), top = vp.scrollTop;
    base = next;
    buf.snap();
    tw.set(next);
    tw.select(mapCaret(was.start, change), mapCaret(was.end, change));
    paintSource();
    vp.scrollTop = top;
  }

  // Done saves what is pending first; only a failed or conflicting save asks.
  const settle = async () => {
    clearTimeout(timer);
    clearTimeout(retryTimer);
    if (saving && inflight) await inflight;
    if (isDirty() && banner.hidden) await write(doc.mtime);
    return !isDirty();
  };
  const close = async () => {
    if (!(await settle()) && !(await (host.confirm ?? (m => Promise.resolve(confirm(m))))('Your last changes are not saved. Leave anyway?', 'Leave without saving'))) return;
    clearTimeout(timer);
    clearTimeout(retryTimer);
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('keydown', strayKey, true);
    stopWatch();
    clearTimeout(checkTimer);
    clearTimeout(renderTimer);
    document.removeEventListener('selectionchange', onSelection);
    sizeTa.disconnect();
    host.noWrap?.(false);
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
    else if (act === 'compare') void showDiff();
    else if (act === 'reload') { const now = await notes.fileRead(host.root, host.rel); doc = now; takeFromDisk(now.text); banner.hidden = true; diffBox.hidden = true; paint(); host.typed?.(now.text); }
    else if (act === 'copy-all') { await navigator.clipboard.writeText(tw.text()); host.status('Copied all of the text'); }
    else if (act === 'recheck') {
      try { const now = await notes.fileStat(host.root, host.rel); doc = { ...doc, mtime: now.mtime }; gone = false; failed = ''; banner.hidden = true; save(false); }
      catch { host.status('Still not there'); }
    }
    else if (act === 'overwrite') { const now = await notes.fileRead(host.root, host.rel); void write(now.mtime); }
  });
  // Typing at the very bottom keeps a little room under the caret's line.
  const keepCaretClear = () => {
    const row = rowEl(curRow), vp = viewport();
    if (!row) return;
    const gap = vp.getBoundingClientRect().bottom - row.getBoundingClientRect().bottom;
    if (gap < lhPx) vp.scrollTop += lhPx - gap;
  };
  // The pill floats over the text. When the caret's own words reach under it, it fades
  // so they can be read, and comes back under the pointer.
  const pill = box.querySelector<HTMLElement>('#fe-fe-pill')!;
  const clearPill = () => {
    const words = rowEl(curRow)?.querySelector('.fe-fe-code');
    let under = false;
    if (words && mode !== 'rich') {
      const r = document.createRange();
      r.selectNodeContents(words);
      const a = r.getBoundingClientRect(), b = pill.getBoundingClientRect();
      under = a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
    }
    pill.classList.toggle('under', under);
  };
  box.addEventListener('scroll', clearPill, true);
  ta.addEventListener('input', () => { paintSource(); paint(); later(); checkLater(); if (!big) keepCaretClear(); markLine(); clearPill(); });
  const onSelection = () => { if (document.activeElement === ta) { markLine(); clearPill(); } };
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
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); save(); }
    else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p' && fmt) { e.preventDefault(); nextMode(); }
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
  // A markdown file's lists behave as in Notes: Enter continues one, an empty
  // item ends it, and a marker typed over the one Enter put there is folded in.
  const listy = /^(md|markdown|mdx)$/i.test(host.ext);
  let autoMarker: AutoMarker | null = null;
  const applyEdit = (r: TextEdit) => {
    buf.snap();
    ta.value = r.text; ta.setSelectionRange(r.start, r.end);
    paintSource(); paint(); later(); checkLater();
  };
  // Renaming or deleting takes the words typed so far along; if they cannot be saved, nothing moves.
  const whenSaved = async (then: () => void) => {
    if (await settle()) then();
    else (host.notify ?? host.status)('Not saved yet, so the file stays where it is.');
  };
  const rename = () => { const b = box.querySelector<HTMLElement>('#fe-fe-bar [data-act="rename"]'); if (b) void whenSaved(() => host.rename?.(b)); };
  const del = () => { void whenSaved(() => void host.del?.()); };
  const fileName = () => host.rel.split('/').pop() ?? host.rel;
  // Looking at an old version: Markdown shows it rendered, in Split so the text stays
  // in sight; other files show how it differs from the text now.
  let modeWas: Mode | null = null;
  const leaveVersion = () => {
    diffBox.hidden = true;
    if (view) { view.innerHTML = ''; shown = ''; if (modeWas && modeWas !== mode) setMode(modeWas); else renderView(); }
    modeWas = null;
  };
  const toggleVersions = mountVersions(box.querySelector<HTMLElement>('#fe-ed-hist')!, {
    root: () => host.root,
    rel: () => host.rel,
    show: (head, text) => {
      if (view && fmt) {
        modeWas ??= mode;
        if (mode === 'raw') setMode('split');
        clearTimeout(renderTimer);
        shown = tw.text();
        view.innerHTML = head + fmt.rich(text, host.href);
      } else { diffBox.innerHTML = head + lineDiffHtml(text, tw.text()); diffBox.hidden = false; }
    },
    use: text => { buf.snap(); tw.set(text); leaveVersion(); paintSource(); paint(); later(); checkLater(); host.typed?.(text); ta.focus({ preventScroll: true }); },
    back: leaveVersion,
    emptyHint: notRepo => notRepo
      ? 'This folder is not a git repository, so earlier saves are not kept here.'
      : `${fileName()} has not been committed to this folder's git history.`,
  });
  wireBar(box.querySelector<HTMLElement>('#fe-fe-bar')!, name => {
    const change = formatEdit(name, ta.value, { start: ta.selectionStart, end: ta.selectionEnd });
    if (change) { applyEdit(change); return; }
    if (name === 'table') buf.insert(tableAt(ta.value, ta.selectionStart));
    if (name === 'image') box.querySelector<HTMLInputElement>('.fe-ed-file')?.click();
    if (name === 'versions') toggleVersions();
    if (name === 'rename') rename();
    if (name === 'delete') del();
  });
  if (isMd) wirePictures(ta, box.querySelector<HTMLInputElement>('.fe-ed-file'), {
    root: () => host.root,
    rel: () => host.rel,
    notesRoot: () => getSettings().notesRoot ?? '',
    insert: t => buf.insert(t),
    failed: t => (host.notify ?? host.status)(t),
    warn: t => (host.notify ?? host.status)(t),
  });
  if (listy) ta.addEventListener('input', () => {
    if (!autoMarker) return;
    const fix = absorbTypedMarker(ta.value, { start: ta.selectionStart, end: ta.selectionEnd }, autoMarker);
    if (fix) { autoMarker = null; applyEdit(fix); return; }
    const typed = ta.value.slice(autoMarker.lineStart + autoMarker.prefix.length, ta.selectionStart);
    if (!ta.value.startsWith(autoMarker.prefix, autoMarker.lineStart) || ta.selectionStart < autoMarker.lineStart + autoMarker.prefix.length || !/^[-*+\d.)[\] xX]*$/.test(typed)) autoMarker = null;
  });
  ta.addEventListener('keydown', e => {
    if (e.isComposing) { e.stopPropagation(); return; }   // these keys belong to the input method
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && e.shiftKey && k === 'p') return;   // the box cycles the view
    if (mod && !e.shiftKey && k === 'k') return;   // the palette, here as everywhere
    // Words selected on the rendered side leave focus here, so c means comment on them, not a letter in the text.
    if (k === 'c' && !mod && !e.altKey && !e.shiftKey && view?.contains(getSelection()?.anchorNode ?? null) && !getSelection()?.isCollapsed && host.comments?.fromSelection()) { e.preventDefault(); e.stopPropagation(); return; }
    const fmtName = isMd ? formatKey(e) : null;
    if (fmtName) {
      e.preventDefault();
      applyEdit(formatEdit(fmtName, ta.value, { start: ta.selectionStart, end: ta.selectionEnd })!);
    }
    else if (e.key === 'F2' && host.rename) { e.preventDefault(); rename(); }
    else if (mod && e.shiftKey && e.key === 'Backspace' && host.del) { e.preventDefault(); del(); }
    else if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const s = { start: ta.selectionStart, end: ta.selectionEnd };
      applyEdit(e.shiftKey ? duplicateLines(ta.value, s) : moveLines(ta.value, s, e.key === 'ArrowDown' ? 1 : -1));
    }
    else if (!big && !mod && !e.altKey && (e.key === 'PageDown' || e.key === 'PageUp')) {
      // The column scrolls, not the textarea, so the caret has to be brought along.
      e.preventDefault();
      const vp = viewport(), dir = e.key === 'PageDown' ? 1 : -1;
      const y = rowEl(curRow)?.getBoundingClientRect().top ?? vp.getBoundingClientRect().top;
      vp.scrollTop += dir * vp.clientHeight * 0.9;
      const rows = [...paintEl.children];
      let line = rows.findIndex(r => r.getBoundingClientRect().bottom > y);
      if (line < 0) line = rows.length - 1;
      const at = lineStart(ta.value, line);
      ta.setSelectionRange(e.shiftKey ? ta.selectionStart : at, at);
      markLine();
    }
    else if (mod && k === 's') { e.preventDefault(); save(); }
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
    else if (listy && e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
      const r = continueList(ta.value, { start: ta.selectionStart, end: ta.selectionEnd });
      if (r) { e.preventDefault(); applyEdit(r); autoMarker = autoMarkerAfter(r); }
    }
    e.stopPropagation();   // page keys (r, t, w, [ ]) must not fire while typing
  });
  const stopWatch = watch(external, { pause: () => saving });
  const onUnload = (e: BeforeUnloadEvent) => { if (box.isConnected && isDirty()) e.preventDefault(); };
  window.addEventListener('beforeunload', onUnload);
  // Focus can fall out of the text (a closed field, a click on the status bar).
  // A plain key then belongs in the text, never to the page commands behind it.
  function strayKey(e: KeyboardEvent): void {
    const on = document.activeElement as HTMLElement | null;
    const lost = !on || on === document.body || on === document.documentElement || !!on.closest?.('#fe-fe-pill, #fe-fe-bar, #fe-ed-hist, #fe-status, #fe-ed-meta');
    if (!lost || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || mode === 'rich' || [...document.querySelectorAll<HTMLElement>('[role="dialog"], .fe-dlg')].some(d => d.checkVisibility())) return;
    e.stopPropagation();
    ta.focus({ preventScroll: true });
  }
  window.addEventListener('keydown', strayKey, true);

  diags = doc.text.length > CHECK_MAX ? [] : diagnose(host.ext, doc.text);
  paintSource();
  paint();
  if (fmt) setMode(mode);
  ta.focus({ preventScroll: true });
  // The caret starts at the spot being read, not at the end of the file.
  const startAt = Math.min(host.startAt?.(doc.text) ?? 0, tw.text().length);
  tw.select(startAt, startAt);
  if (big) { if (startAt) selectSpan(startAt, startAt); }
  else if (startAt) { markLine(); rowEl(curRow)?.scrollIntoView({ block: 'start' }); }
  return {
    dirty: isDirty, close: () => void close(),
    select: (start) => {
      // Selecting would let the next key replace the words a comment is about, so the caret just goes to them.
      const pos = carrier(base, tw.text())(start);
      if (mode === 'rich') setMode('split');
      const was = document.activeElement as HTMLElement | null;
      if (big) selectSpan(pos, pos);
      else { tw.select(pos, pos); markLine(); rowEl(curRow)?.scrollIntoView({ block: 'center' }); }
      if (was && was !== ta) was.focus?.({ preventScroll: true });
    },
    marks: markComments,
  };
}
