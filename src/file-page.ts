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
import { editableRoot, openFileEditor, type FileEditor } from './file-editor';
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

// List the headings (the renderer gave them ids) in the rail.
function buildToc(page: HTMLElement, toc: HTMLElement, open: boolean): void {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  const items = heads.map(h => {
    const text = (h.textContent || '').replace(/#$/, '').trim();
    return `<a href="#${esc(h.id)}" class="fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="${esc(text)}">${esc(text)}</a>`;
  });
  toc.innerHTML = items.join('');
  toc.style.display = items.length > 1 && open ? '' : 'none';
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
  // Keep the marked row in view inside whichever box holds the contents.
  const box = toc.closest<HTMLElement>('#fe-side-toc') ?? toc;
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
        <button id="fe-fp-toc" title="Show or hide the table of contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M2 2h9M2 5h9M2 8h9M2 11h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>Contents</button>
        <button id="fe-fp-column" title="Cycle reading width"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg><span class="fe-fp-column-label">Full width</span></button>
        <button id="fe-fp-edit" title="Edit this file (e)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Edit</button>
        <button id="fe-fp-raw" title="Raw text (r)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Raw</button>
        <button id="fe-fp-copy" title="Copy file contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Copy</button>
      </div>
      <div id="fe-fp">
        <nav id="fe-toc" style="display:none"></nav>
        <div id="fe-page"></div>
        <div id="fe-fe" style="display:none"></div>
      </div>`;
}

export interface FileContent { toggleRaw(): void; setText(text: string): void; edit(): void }

export function mountFileContent(opts: { ext: string; text: string; rawPath: string; href: string; column?: boolean | ColumnMode; editableFolders?: string[] }): FileContent {
  const { ext, rawPath, href } = opts;
  let text = opts.text;
  const page = document.getElementById('fe-page')!;
  const toc = document.getElementById('fe-toc')!;
  const rawBtn = document.getElementById('fe-fp-raw')!;
  const tocBtn = document.getElementById('fe-fp-toc')!;
  const colBtn = document.getElementById('fe-fp-column')!;
  const meta = document.getElementById('fe-fp-meta')!;
  const isMd = ext === 'md' || ext === 'mdx';
  let raw = false;
  // Two remembered choices: the ToC rail open, and a reading column instead
  // of the full width (full width is the owner's default).
  let tocOpen = kvGet(TOC_KEY) !== '0';
  let column = savedColumnMode(opts.column);
  const fe = document.getElementById('fe')!;

  // A markdown page's contents take the top half of the sidebar, so the
  // headings and the saved places sit in one column. With the sidebar hidden
  // the contents stay as a rail beside the page.
  const side = document.getElementById('fe-side');
  if (isMd && side && side.style.display !== 'none') {
    const rest = document.createElement('div');
    rest.id = 'fe-side-rest';
    while (side.firstChild) rest.appendChild(side.firstChild);
    const top = document.createElement('div');
    top.id = 'fe-side-toc';
    top.innerHTML = '<div class="fe-sh"><span class="fe-sh-label">Contents</span></div>';
    top.appendChild(toc);
    side.append(top, rest);
    side.classList.add('fe-side-split');
  }

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
    tocBtn.classList.toggle('on', tocOpen);
    tocBtn.style.display = isMd && !raw ? '' : 'none';
    colBtn.style.display = isMd && !raw ? '' : 'none';
  };
  const render = () => {
    paintMeta();
    const top = page.scrollTop;
    page.innerHTML = raw ? renderCode(text, JSONL_EXTS.has(ext) ? 'json' : ext) : renderBody(text, ext, href);
    if (!raw && isMd) buildToc(page, toc, tocOpen); else toc.style.display = 'none';
    page.scrollTop = top;
    rawBtn.classList.toggle('on', raw);
    paint();
    spy(page, toc);
  };
  render();
  tocBtn.addEventListener('click', () => { tocOpen = !tocOpen; kvSet(TOC_KEY, tocOpen ? '1' : '0'); render(); });
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
  const root = editableRoot(rawPath, opts.editableFolders, home);
  let editor: FileEditor | null = null;
  editBtn.title = root ? 'Edit this file (e)' : 'Edit (e): add this folder under Settings → Notes → Editable folders first';
  const edit = async () => {
    if (editor) return;
    if (!root) { status('To edit, add this folder under Settings → Notes → Editable folders'); return; }
    page.style.display = 'none'; toc.style.display = 'none'; editBox.style.display = '';
    editBtn.classList.add('on');
    editor = await openFileEditor(editBox, {
      root, rel: rawPath.slice(root.length + 1), ext, href,
      status,
      saved: fresh => { text = fresh; paintMeta(); status('saved'); },
      // The file may have changed while editing (a reload from disk), so read it again.
      closed: () => {
        editor = null; editBox.style.display = 'none'; page.style.display = ''; editBtn.classList.remove('on');
        fetchFileText(href).then(fresh => { text = fresh; paintMeta(); }).catch(() => {}).finally(render);
      },
    });
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
