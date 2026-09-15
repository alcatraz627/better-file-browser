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

// Give every heading an id from its text and list them in the rail.
function buildToc(page: HTMLElement, toc: HTMLElement): void {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  const seen = new Map<string, number>();
  const items = heads.map(h => {
    let id = (h.textContent || '').trim().toLowerCase().replace(/[^a-z0-9À-ɏͰ-﷏]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
    const n = seen.get(id) ?? 0; seen.set(id, n + 1);
    if (n) id += '-' + n;
    h.id = id;
    return `<a href="#${esc(id)}" class="fe-toc-${h.tagName.toLowerCase()}" title="Jump to this heading">${esc(h.textContent || '')}</a>`;
  });
  toc.innerHTML = items.join('');
  toc.style.display = items.length > 1 ? '' : 'none';
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
        <button id="fe-fp-raw" title="Raw text (r)">raw</button>
        <button id="fe-fp-copy" title="Copy file contents">copy</button>
      </div>
      <div id="fe-fp">
        <nav id="fe-toc" style="display:none"></nav>
        <div id="fe-page"></div>
      </div>`;
}

export interface FileContent { toggleRaw(): void }

export function mountFileContent(opts: { ext: string; text: string; rawPath: string; href: string }): FileContent {
  const { ext, rawPath, href } = opts;
  let text = opts.text;
  const page = document.getElementById('fe-page')!;
  const toc = document.getElementById('fe-toc')!;
  const rawBtn = document.getElementById('fe-fp-raw')!;
  const meta = document.getElementById('fe-fp-meta')!;
  let raw = false;

  meta.textContent = fmtSize(new Blob([text]).size);
  const render = () => {
    const top = page.scrollTop;
    page.innerHTML = raw ? renderCode(text, 'txt') : renderBody(text, ext, href);
    if (!raw && (ext === 'md' || ext === 'mdx')) buildToc(page, toc); else toc.style.display = 'none';
    page.scrollTop = top;
    rawBtn.classList.toggle('on', raw);
  };
  render();

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
