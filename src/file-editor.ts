// Editing a text file in place on its file page. Only files inside a folder
// the owner listed under Settings → Notes → Editable folders can be edited;
// the native host enforces that boundary and keeps a backup of the previous
// text on every save. Markdown gets the source beside a live render; other
// text gets the source alone. Saving is explicit (⌘S), unlike notes.
import { esc } from './utils';
import { renderMarkdown } from './renderers';
import { notes, NotesError } from './notes';
import { attachBuffer, indentLines } from './editor';

/** The allowed folder holding `path`, or null; ~ and trailing slashes are tolerated. */
export function editableRoot(path: string, folders: string[] | undefined, home = ''): string | null {
  for (const raw of folders ?? []) {
    let f = raw.trim().replace(/\/+$/, '');
    if (!f) continue;
    if (f === '~' || f.startsWith('~/')) { if (!home) continue; f = home + f.slice(1); }
    if (path.startsWith(f + '/')) return f;
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

  const isMd = host.ext === 'md' || host.ext === 'mdx';
  box.innerHTML = `
    <div id="fe-fe-bar">
      <button class="fe-pbn" data-act="save" title="Save (⌘S)">Save</button>
      <button class="fe-pbn" data-act="done" title="Back to reading (Esc)">Done</button>
      <span id="fe-fe-state"></span>
    </div>
    <div id="fe-fe-banner" style="display:none"></div>
    <div class="fe-ed">
      <textarea id="fe-ed-src" spellcheck="false" aria-label="File text"></textarea>
      ${isMd ? '<div id="fe-ed-view"></div>' : ''}
    </div>`;
  const ta = box.querySelector<HTMLTextAreaElement>('#fe-ed-src')!;
  const view = box.querySelector<HTMLElement>('#fe-ed-view');
  const state = box.querySelector<HTMLElement>('#fe-fe-state')!;
  const banner = box.querySelector<HTMLElement>('#fe-fe-banner')!;
  ta.value = doc.text;
  const buf = attachBuffer(ta, `file:${host.root}/${host.rel}`);
  let base = doc.text;
  let saving = false;

  const isDirty = () => ta.value !== base;
  const paint = () => {
    state.textContent = saving ? 'saving…' : isDirty() ? '● unsaved' : 'saved';
    state.classList.toggle('dirty', isDirty());
    if (view) view.innerHTML = `<div class="fe-md">${renderMarkdown(ta.value, host.href)}</div>`;
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
  const save = () => { if (!saving && isDirty()) void write(doc.mtime); };

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
      if (!isDirty()) { doc = now; base = now.text; buf.snap(); ta.value = now.text; buf.snap(); paint(); }
      else showConflict();
    } catch { /* host gone; the next save reports it */ }
  };

  const close = () => {
    if (isDirty() && !confirm('Discard unsaved changes?')) return;
    clearInterval(watch);
    box.innerHTML = '';
    host.closed();
  };

  box.addEventListener('click', async e => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'save') save();
    else if (act === 'done') close();
    else if (act === 'reload') { const now = await notes.fileRead(host.root, host.rel); doc = now; base = now.text; buf.snap(); ta.value = now.text; banner.style.display = 'none'; paint(); }
    else if (act === 'overwrite') { const now = await notes.fileRead(host.root, host.rel); void write(now.mtime); }
  });
  ta.addEventListener('input', paint);
  ta.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) buf.redo(); else buf.undo(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') {
      e.preventDefault();
      buf.snap();
      const r = indentLines(ta.value, { start: ta.selectionStart, end: ta.selectionEnd }, e.shiftKey);
      ta.value = r.text; ta.setSelectionRange(r.start, r.end);
      paint();
    }
    e.stopPropagation();   // page keys (r, t, w, [ ]) must not fire while typing
  });
  const watch = setInterval(() => { if (document.visibilityState === 'visible' && !saving) void external(); }, 2000);
  window.addEventListener('beforeunload', e => { if (box.isConnected && isDirty()) e.preventDefault(); });

  paint();
  ta.focus();
  return { dirty: isDirty, close };
}
