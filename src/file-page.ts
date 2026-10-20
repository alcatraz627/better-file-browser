// A file opened directly in the tab gets the same picture as the preview,
// inside the explorer's own shell: the main column shows a small bar (size,
// raw, copy), a table of contents for markdown, and the matching renderer.
// main.ts builds the shell and calls mountFileContent. HTML source is fetched
// after takeover because the document contains rendered text, not source.
import { esc, copyToClipboard } from './utils';
import { kvGet, kvSet } from './kv';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderMarkdown, renderJsonTree, renderJsonl, parseDSV, numericCols, renderDSVTable,
} from './renderers';
import { fetchFileText } from './file-fetch';
import { fileMeta, metaChips, metaSummary } from './file-meta';
import { UI_ICON } from './control-icons';
import { getSettings, saveSettings } from './storage';
import { editableRoot, openFileEditor, type FileEditor } from './file-editor';
import { attachFind } from './find-in-page';
import type { Settings } from './types';

const SCROLL_KEY = 'bfb-page-scroll-v1';
const TOC_KEY = 'bfb-page-toc-v1';
export const COLUMN_KEY = 'bfb-page-column-v2';
type ColumnMode = 'unset' | 'xl' | 'lg' | 'md';
const COLUMN_MODES: ColumnMode[] = ['unset', 'xl', 'lg', 'md'];
const COLUMN_WIDTHS: Record<ColumnMode, string> = { unset: 'full', xl: '150ch', lg: '130ch', md: '110ch' };
export function columnMode(value: unknown): ColumnMode {
  if (value === true || value === '1') return 'md';
  return COLUMN_MODES.includes(value as ColumnMode) ? value as ColumnMode : 'unset';
}
export function savedColumnMode(fallback: unknown): ColumnMode {
  return columnMode(kvGet(COLUMN_KEY) ?? kvGet('bfb-page-column-v1') ?? fallback);
}
const RELOAD_MS = 2000;

export function parseExcludedExtensions(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map(x => x.replace(/^\*?\./, '').toLowerCase())
    .filter(x => /^[a-z0-9][a-z0-9_-]*$/.test(x)))];
}

export function filePageExt(pathname: string): string | null {
  if (pathname.endsWith('/')) return null;
  const name = decodeURIComponent(pathname.split('/').pop() || '');
  const bare = name.toLowerCase();
  const ext = ['dockerfile', 'containerfile', 'makefile', 'gitignore'].includes(bare)
    ? bare : name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (!ext) return null;
  if (CODE_EXTS.has(ext) || TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === 'json') return ext;
  return null;
}

// The Settings choice: every text file, everything but markdown, or none.
export function filePagesEnabled(ext: string, settings: Settings): boolean {
  const mode = settings.renderFilePages || 'all';
  const excluded = Array.isArray(settings.excludedFileExtensions) ? settings.excludedFileExtensions : ['pdf', 'html', 'htm'];
  return !(excluded.includes(ext.toLowerCase()) || mode === 'off' || (mode === 'not-md' && (ext === 'md' || ext === 'mdx')));
}

function renderBody(text: string, ext: string, href: string): string {
  if (TABLE_EXTS.has(ext)) {
    const rows = parseDSV(text, ext === 'tsv' ? '\t' : ',');
    return rows.length ? renderDSVTable(rows[0], rows.slice(1), numericCols(rows)) : '<div class="fe-ql-note">Empty file.</div>';
  }
  if (JSONL_EXTS.has(ext)) return renderJsonl(text);
  if (ext === 'json') return renderJsonTree(text);
  if (ext === 'md' || ext === 'mdx') return `<div class="fe-md">${renderMarkdown(text, href)}</div>`;
  return renderCode(text, ext);
}

// List the headings (the renderer gave them ids) in the rail; returns how many.
function buildToc(page: HTMLElement, toc: HTMLElement): number {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  toc.innerHTML = heads.map(h => {
    const text = (h.textContent || '').replace(/#$/, '').trim();
    return `<a href="#${esc(h.id)}" class="fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="${esc(text)}">${esc(text)}</a>`;
  }).join('');
  return heads.length;
}

// Mark the ToC row of the heading in view, on every scroll of the page.
function spy(page: HTMLElement, toc: HTMLElement): void {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  const top = page.getBoundingClientRect().top + 40;
  // The section you are reading: the last heading above the line, the first
  // one before any is reached, and the last one once the page bottoms out.
  let current: HTMLElement | null = heads[0] ?? null;
  for (const h of heads) { if (h.getBoundingClientRect().top <= top) current = h; else break; }
  if (heads.length && page.scrollTop + page.clientHeight >= page.scrollHeight - 2) current = heads[heads.length - 1];
  // A heading picked from the contents stays marked while it is on screen,
  // even when the page cannot scroll it to the top.
  const picked = toc.dataset.pin ? document.getElementById(toc.dataset.pin) : null;
  if (picked) {
    const r = picked.getBoundingClientRect(), p = page.getBoundingClientRect();
    if (r.top >= p.top - 1 && r.top < p.bottom) current = picked;
  }
  let on: HTMLElement | null = null;
  toc.querySelectorAll<HTMLElement>('a').forEach(a => { const hit = !!current && a.dataset.id === current.id; a.classList.toggle('on', hit); if (hit) on = a; });
  // Keep the marked row in view inside the rail.
  const box = toc;
  const row = on as HTMLElement | null;
  if (row) {
    const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - box.clientHeight / 3;
  }
}

function scrollMemory(): Record<string, number> {
  try { return JSON.parse(kvGet(SCROLL_KEY) || '{}'); } catch { return {}; }
}
function rememberScroll(path: string, top: number): void {
  const m = scrollMemory();
  m[path] = top;
  const keys = Object.keys(m);
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
  kvSet(SCROLL_KEY, JSON.stringify(m));
}

// The markup the shell places in its main column, under the strip.
export function renderFileContent(): string {
  return `
      <div id="fe-fp-bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-column" title="Cycle reading width"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg><span class="fe-fp-column-label">Full width</span></button>
        <button id="fe-fp-edit" title="Edit this file (e)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Edit</button>
        <button id="fe-fp-raw" title="Raw text (r)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Raw</button>
        <button id="fe-fp-copy" title="Copy file contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Copy</button>
        <span id="fe-ff" title="Find in this file (/) · Enter next · Shift+Enter previous · Esc clears">
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.4 8.4 11.5 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <input id="fe-ff-q" type="text" placeholder="Find in file" spellcheck="false" autocomplete="off" aria-label="Find in this file" title="Find in this file (/)">
          <span id="fe-ff-n" aria-live="polite"></span>
          <button id="fe-ff-prev" data-icon data-size="sm" title="Previous match (Shift+Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 7 5.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button id="fe-ff-next" data-icon data-size="sm" title="Next match (Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </span>
      </div>
      <div id="fe-fp">
        <div id="fe-page"></div>
        <div id="fe-fe" style="display:none"></div>
        <aside id="fe-toc-rail" hidden>
          <div class="fe-toc-head"><span class="fe-toc-title">On this page</span>
            <button id="fe-toc-fold" type="button" title="Collapse the contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M5 3l3.5 3.5L5 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
          <nav id="fe-toc"></nav>
        </aside>
      </div>`;
}

export interface FileContent { toggleRaw(): void; setText(text: string): void; edit(): void }

export function mountFileContent(opts: { ext: string; text: string; rawPath: string; href: string; column?: boolean | ColumnMode; editableFolders?: string[] }): FileContent {
  const { ext, rawPath, href } = opts;
  let text = opts.text;
  const page = document.getElementById('fe-page')!;
  const toc = document.getElementById('fe-toc')!;
  const rail = document.getElementById('fe-toc-rail')!;
  const foldBtn = document.getElementById('fe-toc-fold')!;
  const rawBtn = document.getElementById('fe-fp-raw')!;
  const colBtn = document.getElementById('fe-fp-column')!;
  const meta = document.getElementById('fe-fp-meta')!;
  const findBox = document.getElementById('fe-ff')!;
  const find = attachFind(page, document.getElementById('fe-ff-q') as HTMLInputElement, document.getElementById('fe-ff-n')!,
    document.getElementById('fe-ff-prev')!, document.getElementById('fe-ff-next')!);
  const isMd = ext === 'md' || ext === 'mdx';
  let raw = false;
  let headings = 0;
  // Two remembered choices: the contents rail open or folded, and a reading
  // column instead of the full width (full width is the owner's default).
  let tocOpen = kvGet(TOC_KEY) !== '0';
  let column = savedColumnMode(opts.column);
  const fe = document.getElementById('fe')!;

  // One record of the file's facts feeds the file bar, status bar and count.
  const paintMeta = () => {
    const fm = fileMeta(text, ext, rawPath);
    meta.textContent = fm.kind;
    const row = document.getElementById('fe-status-meta');
    if (row) row.innerHTML = metaChips(fm);
    const count = document.getElementById('fe-count');
    if (count) count.textContent = metaSummary(fm);
  };
  paintMeta();
  const paint = () => {
    for (const mode of COLUMN_MODES) fe.classList.toggle(`fe-column-${mode}`, column === mode);
    colBtn.classList.toggle('on', column !== 'unset');
    colBtn.querySelector('.fe-fp-column-label')!.textContent = column === 'unset' ? 'Full width' : `${column.toUpperCase()} width`;
    const next = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length];
    colBtn.title = `Reading width: ${column === 'unset' ? 'full' : `${column.toUpperCase()} (${COLUMN_WIDTHS[column]})`}. Click for ${next === 'unset' ? 'full' : `${next.toUpperCase()} (${COLUMN_WIDTHS[next]})`}`;
    colBtn.style.display = isMd && !raw ? '' : 'none';
    // The rail shows for a markdown page with at least two headings; folded,
    // it keeps only its button so it can open again.
    rail.hidden = !isMd || raw || headings < 2 || !!editor;
    rail.classList.toggle('folded', !tocOpen);
    foldBtn.title = tocOpen ? 'Collapse the contents' : 'Show the contents';
    foldBtn.setAttribute('aria-expanded', String(tocOpen));
    findBox.hidden = !!editor;
  };
  const render = () => {
    paintMeta();
    const top = page.scrollTop;
    page.innerHTML = raw ? renderCode(text, JSONL_EXTS.has(ext) ? 'json' : ext) : renderBody(text, ext, href);
    headings = !raw && isMd ? buildToc(page, toc) : 0;
    page.scrollTop = top;
    rawBtn.classList.toggle('on', raw);
    paint();
    spy(page, toc);
    find.refresh();
  };
  // `editor` is declared below; render runs before any editor exists.
  let editor: FileEditor | null = null;
  render();
  foldBtn.addEventListener('click', () => { tocOpen = !tocOpen; kvSet(TOC_KEY, tocOpen ? '1' : '0'); paint(); if (tocOpen) spy(page, toc); });
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || editor) return;
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
    e.preventDefault();
    find.focus();
  });
  colBtn.addEventListener('click', () => { column = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length]; kvSet(COLUMN_KEY, column); paint(); });
  page.addEventListener('scroll', () => { if (isMd && !raw) spy(page, toc); });
  // A contents click glides to the heading and keeps the address in step.
  toc.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-id]');
    const target = a && document.getElementById(a.dataset.id!);
    if (!target) return;
    e.preventDefault();
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    toc.dataset.pin = a.dataset.id!;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    history.replaceState(null, '', '#' + encodeURIComponent(a.dataset.id!));
    spy(page, toc);
  });
  // Scrolling by hand hands the marker back to the scroll position.
  const unpin = () => { delete toc.dataset.pin; };
  page.addEventListener('wheel', unpin, { passive: true });
  page.addEventListener('pointerdown', unpin);
  page.addEventListener('keydown', unpin);

  const remembered = scrollMemory()[rawPath];
  if (remembered) page.scrollTop = remembered;
  else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  page.addEventListener('scroll', () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => rememberScroll(rawPath, page.scrollTop), 300);
  });

  const toggleRaw = () => { if (!editor) { raw = !raw; render(); } };

  // Edit in place: the reading view hides while the editor is open, and a
  // save re-renders it with the new text.
  const editBox = document.getElementById('fe-fe')!;
  const editBtn = document.getElementById('fe-fp-edit')!;
  const status = (t: string) => { document.getElementById('fe-status-text')!.textContent = t; };
  const home = rawPath.match(/^\/Users\/[^/]+/)?.[0] ?? '';
  let root = editableRoot(rawPath, opts.editableFolders, home);
  const folder = rawPath.slice(0, rawPath.lastIndexOf('/'));
  editBtn.title = 'Edit this file (e)';

  // A folder not allowed yet asks once, next to the button you pressed.
  const askToAllow = (): Promise<boolean> => new Promise(resolve => {
    document.getElementById('fe-allow')?.remove();
    const pop = document.createElement('div');
    pop.id = 'fe-allow';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Allow editing');
    const short = home && folder.startsWith(home + '/') ? '~' + folder.slice(home.length) : folder;
    pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Allow editing here?</div>
      <p>Saves write to <code>${esc(short)}</code>. Each save keeps the old text for 14 days.</p>
      <div class="fe-allow-acts"><button type="button" class="btn" data-hover-shade data-a="cancel">Cancel</button>
      <button type="button" class="btn" data-variant="outline" data-a="file">Just this file</button>
      <button type="button" class="btn" data-variant="solid" data-a="folder">Allow folder</button></div>`;
    document.getElementById('fe')!.appendChild(pop);
    const r = editBtn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8))}px`;
    const done = (ok: boolean) => { pop.remove(); document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onAway, true); resolve(ok); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } };
    const onAway = (e: PointerEvent) => { if (!pop.contains(e.target as Node) && e.target !== editBtn) done(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onAway, true);
    pop.addEventListener('click', e => {
      const a = (e.target as Element).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'cancel') { done(false); return; }
      const s = getSettings();
      s.editableFolders = [...new Set([...(s.editableFolders ?? []), a === 'folder' ? folder : rawPath])];
      saveSettings(s);
      root = editableRoot(rawPath, s.editableFolders, home);
      done(!!root);
    });
    pop.querySelector<HTMLElement>('[data-a="folder"]')!.focus();
  });

  // A failure to open says so next to the button, where the eye already is.
  const noteAtButton = (msg: string) => {
    document.getElementById('fe-allow')?.remove();
    const pop = document.createElement('div');
    pop.id = 'fe-allow';
    pop.className = 'fe-allow-note';
    pop.setAttribute('role', 'alert');
    pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Cannot edit this file</div><p>${esc(msg)}</p>`;
    document.getElementById('fe')!.appendChild(pop);
    const r = editBtn.getBoundingClientRect();
    pop.style.top = `${r.bottom + 8}px`;
    pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8))}px`;
    const away = () => { pop.remove(); document.removeEventListener('pointerdown', away, true); };
    document.addEventListener('pointerdown', away, true);
    setTimeout(away, 8000);
  };

  const edit = async () => {
    if (editor || editBtn.classList.contains('busy')) return;
    if (!root && !(await askToAllow())) return;
    if (!root) return;
    editBtn.classList.add('busy');
    page.style.display = 'none'; editBox.style.display = '';
    find.clear();
    editBtn.classList.add('on');
    editor = await openFileEditor(editBox, {
      root, rel: rawPath.slice(root.length + 1), ext, href,
      status: t => { status(t); if (t.startsWith('cannot edit: ')) noteAtButton(t.slice(13)); },
      saved: fresh => { text = fresh; paintMeta(); },   // the pill shows Saved
      // The file may have changed while editing (a reload from disk), so read it again.
      closed: () => {
        editor = null; editBox.style.display = 'none'; page.style.display = ''; editBtn.classList.remove('on');
        fetchFileText(href).then(fresh => { text = fresh; paintMeta(); }).catch(() => {}).finally(render);
      },
    });
    editBtn.classList.remove('busy');
    paint();
    if (!editor) { editBox.style.display = 'none'; page.style.display = ''; editBtn.classList.remove('on'); render(); }
  };
  editBtn.addEventListener('click', () => void edit());
  rawBtn.addEventListener('click', toggleRaw);
  document.getElementById('fe-fp-copy')!.addEventListener('click', () => {
    copyToClipboard(text).then(ok => { document.getElementById('fe-status-text')!.textContent = ok ? 'copied' : 'copy failed'; });
  });

  // Autoreload: while the tab is visible, poll the file and re-render on change.
  const reloadEl = document.getElementById('fe-fp-reload')!;
  const live = (ok: boolean, label: string) => {
    reloadEl.innerHTML = `<span class="fe-live-dot"${ok ? '' : ' style="background:var(--dm)"'}></span>${label}`;
  };
  setInterval(() => {
    if (document.visibilityState !== 'visible' || editor) return;
    fetchFileText(href).then(fresh => {
      if (fresh === text) return;
      text = fresh;
      paintMeta();
      render();
      live(true, 'reloaded ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }).catch(() => live(false, 'not watching'));
  }, RELOAD_MS);

  return {
    toggleRaw,
    edit: () => void edit(),
    setText(fresh) {
      text = fresh;
      paintMeta();
      render();
    },
  };
}
