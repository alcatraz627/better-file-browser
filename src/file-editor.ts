// Editing a text file in place on its file page. Only files inside a folder
// the owner allowed (or a file allowed on its own) can be edited; the native
// host enforces that boundary and keeps a backup of the previous text on
// every save. The reading column becomes coloured, numbered source, a small
// floating pill holds the save state, a preview toggle and Done, and the text
// saves itself shortly after you stop typing (⌘S saves at once).
import { esc } from './utils';
import { renderMarkdown, highlightCode } from './renderers';
import { notes, NotesError } from './notes';
import { attachBuffer, indentLines } from './editor';
import { UI_ICON } from './control-icons';

const AUTOSAVE_MS = 800;
// Opening cost grows with line count (every line is a painted row): about 3 s
// at 14,000 lines and 20 s at 40,000, so longer files are refused for now.
const EDIT_MAX_LINES = 15000;

// Split highlighted HTML into one string per source line, closing the open
// token spans at each line end and reopening them on the next line.
export function splitHighlighted(html: string): string[] {
  const out: string[] = [];
  const open: string[] = [];
  let line = '';
  const re = /<span[^>]*>|<\/span>|\n|[^<\n]+|</g;
  for (const m of html.match(re) ?? []) {
    if (m === '\n') { out.push(line + '</span>'.repeat(open.length)); line = open.join(''); }
    else if (m.startsWith('<span')) { open.push(m); line += m; }
    else if (m === '</span>') { open.pop(); line += m; }
    else line += m;
  }
  out.push(line);
  return out;
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
  // The saved text, so the reading view shows it when the editor closes.
  saved(text: string): void;
  closed(): void;
}

export interface FileEditor { dirty(): boolean; close(): void }

export async function openFileEditor(box: HTMLElement, host: FileEditorHost): Promise<FileEditor | null> {
  let doc: { text: string; mtime: number };
  try { doc = await notes.fileRead(host.root, host.rel); }
  catch (err) { host.status(`cannot edit: ${(err as NotesError).message}`); return null; }
  let lines = 1;
  for (let p = doc.text.indexOf('\n'); p !== -1 && lines <= EDIT_MAX_LINES; p = doc.text.indexOf('\n', p + 1)) lines++;
  if (lines > EDIT_MAX_LINES) {
    host.status(`cannot edit: files over ${EDIT_MAX_LINES.toLocaleString('en-US')} lines are too slow to edit here`);
    return null;
  }

  const isMd = host.ext === 'md' || host.ext === 'mdx';
  box.innerHTML = `
    <div id="fe-fe-banner" style="display:none"></div>
    <div id="fe-fe-scroll">
      <div id="fe-fe-col">
        <div id="fe-fe-src">
          <pre id="fe-fe-paint" aria-hidden="true"></pre>
          <textarea id="fe-fe-ta" spellcheck="false" aria-label="File text"></textarea>
        </div>
        ${isMd ? '<div id="fe-fe-view" class="fe-md" hidden></div>' : ''}
      </div>
    </div>
    <div id="fe-fe-pill" role="toolbar" aria-label="Editing">
      <span id="fe-fe-state"></span>
      ${isMd ? `<button type="button" class="btn" data-icon data-hover-shade data-act="preview" title="Preview (⌘⇧P)">${UI_ICON.eye}</button>` : ''}
      <button type="button" class="btn" data-variant="solid" data-act="done" title="Back to reading (Esc)">Done</button>
    </div>`;
  const ta = box.querySelector<HTMLTextAreaElement>('#fe-fe-ta')!;
  const paintEl = box.querySelector<HTMLElement>('#fe-fe-paint')!;
  const src = box.querySelector<HTMLElement>('#fe-fe-src')!;
  const view = box.querySelector<HTMLElement>('#fe-fe-view');
  const state = box.querySelector<HTMLElement>('#fe-fe-state')!;
  const banner = box.querySelector<HTMLElement>('#fe-fe-banner')!;
  ta.value = doc.text;
  const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`);
  let base = doc.text;
  let saving = false;
  let previewing = false;
  let timer = 0;

  const isDirty = () => ta.value !== base;
  // The coloured copy behind the textarea: one numbered row per line, so a
  // wrapped line keeps one number and the caret sits over its own text.
  let curRow = -1;
  const markLine = () => {
    let i = 0;
    for (let p = ta.value.indexOf('\n'); p !== -1 && p < ta.selectionStart; p = ta.value.indexOf('\n', p + 1)) i++;
    if (i === curRow) return;
    paintEl.children[curRow]?.classList.remove('cur');
    paintEl.children[i]?.classList.add('cur');
    curRow = i;
  };
  // A keystroke usually changes one row, so only the rows between the first
  // and last difference are rebuilt; a large file would otherwise rebuild and
  // lay out every row per key. The textarea is absolutely placed, so its
  // height follows the painted copy without being reset first.
  let painted: string[] = [];
  const rowHtml = (r: string, i: number) => `<div class="fe-fe-row"><span class="fe-fe-ln">${i + 1}</span><span class="fe-fe-code">${r || ' '}</span></div>`;
  const paintSource = () => {
    const rows = splitHighlighted(highlightCode(ta.value, host.ext));
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
  };
  const paint = () => {
    const dirty = isDirty();
    state.innerHTML = saving ? 'Saving…' : dirty ? '<span class="fe-fe-dot"></span>Edited' : `${UI_ICON.check}Saved`;
    state.className = saving ? 'busy' : dirty ? 'dirty' : 'saved';
    if (view && previewing) view.innerHTML = renderMarkdown(ta.value, host.href);
  };
  const setPreview = (on: boolean) => {
    if (!view) return;
    previewing = on;
    view.hidden = !on; src.hidden = on;
    box.querySelector('[data-act="preview"]')?.classList.toggle('on', on);
    paint();
    if (!on) ta.focus();
  };

  const write = async (expect: number) => {
    saving = true; paint();
    try {
      const text = ta.value;
      const r = await notes.fileWrite(host.root, host.rel, text, expect);
      doc = { text, mtime: r.mtime }; base = text;
      banner.style.display = 'none';
      host.saved(text);
    } catch (err) {
      const e = err as NotesError;
      if (e.code === 'notes_conflict') showConflict();
      else host.status(`not saved: ${e.message}`);
    } finally { saving = false; paint(); }
  };
  const save = () => { clearTimeout(timer); if (!saving && isDirty()) void write(doc.mtime); };
  const later = () => { clearTimeout(timer); timer = window.setTimeout(save, AUTOSAVE_MS); };

  function showConflict(): void {
    banner.style.display = '';
    banner.innerHTML = `<span>${esc(host.rel.split('/').pop()!)} changed on disk since you opened it.</span>
      <button class="fe-pbn" data-act="reload" title="Drop your changes and load the file as it is now">Load from disk</button>
      <button class="fe-pbn" data-act="overwrite" title="Save your text over the newer file (the newer one is kept as a backup)">Keep mine</button>`;
  }
  // Called by the page's autoreload when the file changed underneath us.
  const external = async () => {
    try {
      const now = await notes.fileRead(host.root, host.rel);
      if (now.mtime === doc.mtime) return;
      if (!isDirty()) { doc = now; base = now.text; buf.snap(); ta.value = now.text; buf.snap(); paintSource(); paint(); }
      else showConflict();
    } catch { /* host gone; the next save reports it */ }
  };

  // Done saves what is pending first; only a failed or conflicting save asks.
  const close = async () => {
    clearTimeout(timer);
    if (isDirty() && !saving && banner.style.display === 'none') await write(doc.mtime);
    if (isDirty() && !confirm('Your last changes are not saved. Leave anyway?')) return;
    clearInterval(watch);
    document.removeEventListener('selectionchange', onSelection);
    box.innerHTML = '';
    host.closed();
  };

  box.addEventListener('click', async e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'save') save();
    else if (act === 'done') void close();
    else if (act === 'preview') setPreview(!previewing);
    else if (act === 'reload') { const now = await notes.fileRead(host.root, host.rel); doc = now; base = now.text; buf.snap(); ta.value = now.text; banner.style.display = 'none'; paintSource(); paint(); }
    else if (act === 'overwrite') { const now = await notes.fileRead(host.root, host.rel); void write(now.mtime); }
  });
  ta.addEventListener('input', () => { paintSource(); paint(); later(); });
  const onSelection = () => { if (document.activeElement === ta) markLine(); };
  document.addEventListener('selectionchange', onSelection);
  for (const ev of ['selectionchange', 'mouseup', 'keyup', 'focus']) ta.addEventListener(ev, markLine);
  // The textarea only covers the text itself, so a click on the blank space
  // below a short file or beside the column would otherwise do nothing. Put
  // the caret at the end of the line level with the click, or at the end.
  box.querySelector('#fe-fe-scroll')!.addEventListener('mousedown', e => {
    const me = e as MouseEvent;
    if (me.button !== 0 || previewing || me.target === ta) return;
    me.preventDefault();
    const rows = [...paintEl.children];
    let line = rows.findIndex(r => r.getBoundingClientRect().bottom > me.clientY);
    const lines = ta.value.split('\n');
    let pos = ta.value.length;
    if (line !== -1) {
      pos = 0;
      for (let i = 0; i < line; i++) pos += lines[i].length + 1;
      pos += lines[line]?.length ?? 0;
    }
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(pos, pos);
    markLine();
  });
  box.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPreview(!previewing); }
    else if (e.key === 'Escape' && previewing) { e.preventDefault(); setPreview(false); }
  });
  ta.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === 'p') return;   // the box handles preview
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) buf.redo(); else buf.undo(); }
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

  paintSource();
  paint();
  ta.focus();
  return { dirty: isDirty, close: () => void close() };
}
