// A file opened directly in the tab gets the same picture as the preview:
// Chrome's raw text page is replaced by a shell with the folder crumbs, a
// header, a table of contents for markdown, and the matching renderer. The
// text is already in the document, so no fetch is needed to render.
import { esc, fmtSize } from './utils';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderMarkdown, renderJsonTree, renderJsonl, parseDSV, numericCols, renderDSVTable,
} from './renderers';
import { fetchFileText } from './file-fetch';
import { getTheme, getSettings, THEME_KEY } from './storage';
import { CSS } from './styles';
import { renderCrumbs } from './render';
import { copyToClipboard } from './utils';
import { mountStrip } from './strip';
import { makeToast } from './toast';

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

export function mountFilePage(ext: string): void {
  const settings = getSettings();
  const mode = settings.renderFilePages || 'all';
  if (mode === 'off' || (mode === 'not-md' && (ext === 'md' || ext === 'mdx'))) return;

  let text = document.body.textContent || '';
  const rawPath = decodeURIComponent(location.pathname);
  const segments = rawPath.split('/').filter(Boolean);
  const name = segments.pop() || '';
  const folderPath = '/' + segments.join('/') + (segments.length ? '/' : '');
  const href = location.href;
  const theme = getTheme();

  document.documentElement.innerHTML = `<head><meta charset="utf-8"><title>${esc(name)} | Better File Browser</title></head><body></body>`;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  document.body.innerHTML = `
<div id="fe" data-theme="${esc(theme)}" class="fe-file-page">
  <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this file, w closes, p pins, [ ] switch, 1-9 jump)"></div>
  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs(folderPath, segments)}<span class="fe-sep">›</span><span class="fe-crumb fe-crumb-file">${esc(name)}</span></div>
    <span id="fe-fp-meta">${fmtSize(new Blob([text]).size)}</span>
    <button id="fe-fp-raw" title="Raw text (r)">raw</button>
    <button id="fe-fp-copy" title="Copy file contents">copy</button>
    <button id="fe-theme-btn" title="Toggle theme">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>
  <div id="fe-body">
    <nav id="fe-toc" style="display:none"></nav>
    <div id="fe-page"></div>
  </div>
  <div id="fe-statusbar"><span id="fe-status-text">${esc(name)}</span><span id="fe-fp-reload" title="Re-rendered when the file changes on disk">watching for changes</span></div>
  <div id="fe-toast"></div>
</div>`;

  const fe = document.getElementById('fe')!;
  const toast = makeToast(document.getElementById('fe-toast')!);
  const strip = mountStrip({ el: document.getElementById('fe-tabs')!, rawPath, toast });
  const page = document.getElementById('fe-page')!;
  const toc = document.getElementById('fe-toc')!;
  const rawBtn = document.getElementById('fe-fp-raw')!;
  let raw = false;

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

  rawBtn.addEventListener('click', () => { raw = !raw; render(); });
  document.getElementById('fe-fp-copy')!.addEventListener('click', () => {
    copyToClipboard(text).then(ok => { document.getElementById('fe-status-text')!.textContent = ok ? 'copied' : 'copy failed'; });
  });
  document.getElementById('fe-theme-btn')!.addEventListener('click', () => {
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    fe.dataset.theme = next; localStorage.setItem(THEME_KEY, next);
  });
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement)?.tagName)) return;
    if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { raw = !raw; render(); }
    else if (e.key === 'Backspace' || (e.metaKey && e.key === 'ArrowUp')) { e.preventDefault(); location.href = 'file://' + folderPath; }
    else if (strip.handleKey(e)) e.preventDefault();
  });

  // Autoreload: while the tab is visible, poll the file and re-render on change.
  const reloadEl = document.getElementById('fe-fp-reload')!;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    fetchFileText(href).then(fresh => {
      if (fresh === text) return;
      text = fresh;
      document.getElementById('fe-fp-meta')!.textContent = fmtSize(new Blob([text]).size);
      render();
      reloadEl.textContent = 'reloaded ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }).catch(() => { reloadEl.textContent = 'not watching (cannot read file)'; });
  }, RELOAD_MS);
}
