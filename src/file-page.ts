// A file opened directly in the tab gets the same picture as the preview,
// inside the explorer's own shell: the main column shows a small bar (size,
// raw, copy), a table of contents for markdown, and the matching renderer.
// main.ts builds the shell and calls mountFileContent; the text is already
// in the document, so no fetch is needed to render.
import { esc, fmtSize, copyToClipboard } from './utils';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderMarkdown, renderJsonTree, renderJsonl, parseDSV, numericCols, renderDSVTable,
} from './renderers';
import { fetchFileText } from './file-fetch';
import type { Settings } from './types';

const SCROLL_KEY = 'bfb-page-scroll-v1';
const TOC_KEY = 'bfb-page-toc-v1';
const COLUMN_KEY = 'bfb-page-column-v1';
const RELOAD_MS = 2000;

export function filePageExt(pathname: string): string | null {
  if (pathname.endsWith('/')) return null;
  const name = decodeURIComponent(pathname.split('/').pop() || '');
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (!ext) return null;
  if (CODE_EXTS.has(ext) || TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === 'json') return ext;
  return null;
}

// The Settings choice: every text file, everything but markdown, or none.
export function filePagesEnabled(ext: string, settings: Settings): boolean {
  const mode = settings.renderFilePages || 'all';
  return !(mode === 'off' || (mode === 'not-md' && (ext === 'md' || ext === 'mdx')));
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
    return `<a href="#${esc(h.id)}" class="fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="Jump to this heading">${esc(text)}</a>`;
  });
  toc.innerHTML = items.join('');
  toc.style.display = items.length > 1 && open ? '' : 'none';
}

// Mark the ToC row of the heading in view, on every scroll of the page.
function spy(page: HTMLElement, toc: HTMLElement): void {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  const top = page.getBoundingClientRect().top + 40;
  let current: HTMLElement | null = null;
  for (const h of heads) { if (h.getBoundingClientRect().top <= top) current = h; else break; }
  toc.querySelectorAll<HTMLElement>('a').forEach(a => a.classList.toggle('on', !!current && a.dataset.id === current.id));
}

function scrollMemory(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}'); } catch { return {}; }
}
function rememberScroll(path: string, top: number): void {
  const m = scrollMemory();
  m[path] = top;
  const keys = Object.keys(m);
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
  localStorage.setItem(SCROLL_KEY, JSON.stringify(m));
}

// The markup the shell places in its main column, under the strip.
export function renderFileContent(): string {
  return `
      <div id="fe-fp-bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-toc" title="Show or hide the table of contents">toc</button>
        <button id="fe-fp-column" title="Reading column: narrow the text to 80 characters">column</button>
        <button id="fe-fp-raw" title="Raw text (r)">raw</button>
        <button id="fe-fp-copy" title="Copy file contents">copy</button>
      </div>
      <div id="fe-fp">
        <nav id="fe-toc" style="display:none"></nav>
        <div id="fe-page"></div>
      </div>`;
}

export interface FileContent { toggleRaw(): void }

export function mountFileContent(opts: { ext: string; text: string; rawPath: string; href: string; column?: boolean }): FileContent {
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
  let tocOpen = localStorage.getItem(TOC_KEY) !== '0';
  const columnStored = localStorage.getItem(COLUMN_KEY);
  let column = columnStored === null ? !!opts.column : columnStored === '1';
  const fe = document.getElementById('fe')!;

  meta.textContent = fmtSize(new Blob([text]).size);
  const paint = () => {
    fe.classList.toggle('fe-column', column);
    colBtn.classList.toggle('on', column);
    tocBtn.classList.toggle('on', tocOpen);
    tocBtn.style.display = isMd && !raw ? '' : 'none';
    colBtn.style.display = isMd && !raw ? '' : 'none';
  };
  const render = () => {
    const top = page.scrollTop;
    page.innerHTML = raw ? renderCode(text, 'txt') : renderBody(text, ext, href);
    if (!raw && isMd) buildToc(page, toc, tocOpen); else toc.style.display = 'none';
    page.scrollTop = top;
    rawBtn.classList.toggle('on', raw);
    paint();
    spy(page, toc);
  };
  render();
  tocBtn.addEventListener('click', () => { tocOpen = !tocOpen; localStorage.setItem(TOC_KEY, tocOpen ? '1' : '0'); render(); });
  colBtn.addEventListener('click', () => { column = !column; localStorage.setItem(COLUMN_KEY, column ? '1' : '0'); paint(); });
  page.addEventListener('scroll', () => { if (isMd && !raw) spy(page, toc); });

  const remembered = scrollMemory()[rawPath];
  if (remembered) page.scrollTop = remembered;
  else if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  page.addEventListener('scroll', () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => rememberScroll(rawPath, page.scrollTop), 300);
  });

  const toggleRaw = () => { raw = !raw; render(); };
  rawBtn.addEventListener('click', toggleRaw);
  document.getElementById('fe-fp-copy')!.addEventListener('click', () => {
    copyToClipboard(text).then(ok => { document.getElementById('fe-status-text')!.textContent = ok ? 'copied' : 'copy failed'; });
  });

  // Autoreload: while the tab is visible, poll the file and re-render on change.
  const reloadEl = document.getElementById('fe-fp-reload')!;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    fetchFileText(href).then(fresh => {
      if (fresh === text) return;
      text = fresh;
      meta.textContent = fmtSize(new Blob([text]).size);
      render();
      reloadEl.textContent = 'reloaded ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }).catch(() => { reloadEl.textContent = 'not watching (cannot read file)'; });
  }, RELOAD_MS);

  return { toggleRaw };
}
