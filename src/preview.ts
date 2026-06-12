// Quick Look overlay — macOS-style file preview inside the explorer.
// Fetches file:// content over XHR (the same trick the crumb dropdown uses)
// and hands it to a renderer picked by extension. No new permissions needed.
import type { Entry, IconRule } from './types';
import { esc, fmtSize, getExt } from './utils';
import { getIcon, IMG_EXTS } from './icons';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderJsonTree, renderJsonl, renderMarkdown,
  parseDSV, numericCols, sortDSVRows, renderDSVTable,
  sniffBinary,
} from './renderers';
import { fetchFileText } from './file-fetch';

const FETCH_WARN_BYTES = 8 * 1024 * 1024;

export function canPreview(e: Entry): boolean {
  if (e.isDir || e.isParent) return false;
  const ext = getExt(e);
  return IMG_EXTS.has(ext) || TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext)
    || ext === 'json' || CODE_EXTS.has(ext) || ext === '';
}

interface PreviewDeps {
  iconRules: () => IconRule[] | null;
}

let deps: PreviewDeps;
let overlay: HTMLElement;
let currentEntry: Entry | null = null;
let currentText: string | null = null;   // raw fetched contents, for copy
let reqSeq = 0;

// Table-sort state for the currently previewed .tsv/.csv
let dsvHeader: string[] = [];
let dsvRows:   string[][] = [];
let dsvNum:    Set<number> = new Set();
let dsvSort:   { col: number; dir: 'asc' | 'desc' } | null = null;

export function initPreview(d: PreviewDeps): void {
  deps = d;
  overlay = document.createElement('div');
  overlay.id = 'fe-qlook';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div id="fe-ql-bg"></div>
    <div id="fe-ql-dialog">
      <div id="fe-ql-hdr">
        <span id="fe-ql-icon"></span>
        <span id="fe-ql-name"></span>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>copy</span>
        </button>
        <a id="fe-ql-open" title="Open raw file in this tab">open raw ↗</a>
        <button id="fe-ql-close" title="Close (Esc)">✕</button>
      </div>
      <div id="fe-ql-body"></div>
    </div>`;
  document.getElementById('fe')!.appendChild(overlay);

  document.getElementById('fe-ql-close')!.addEventListener('click', closePreview);
  document.getElementById('fe-ql-bg')!.addEventListener('click', closePreview);

  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.addEventListener('click', () => {
    if (currentText === null) return;
    const flash = (ok: boolean) => {
      copyBtn.querySelector('span')!.textContent = ok ? '✓ copied' : 'failed';
      setTimeout(() => { copyBtn.querySelector('span')!.textContent = 'copy'; }, 1400);
    };
    navigator.clipboard.writeText(currentText).then(() => flash(true)).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = currentText!; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove(); flash(ok);
    });
  });

  // Table header sorting via delegation — the body is re-rendered per click
  document.getElementById('fe-ql-body')!.addEventListener('click', e => {
    const th = (e.target as HTMLElement).closest<HTMLElement>('.fe-ql-table th');
    if (!th || !dsvHeader.length) return;
    const col = parseInt(th.dataset.col!);
    dsvSort = dsvSort?.col === col
      ? { col, dir: dsvSort.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' };
    const sorted = sortDSVRows(dsvRows, col, dsvSort.dir, dsvNum.has(col));
    document.getElementById('fe-ql-body')!.innerHTML =
      renderDSVTable(dsvHeader, sorted, dsvNum, dsvSort);
  });
}

export function isPreviewOpen(): boolean {
  return overlay?.style.display !== 'none';
}

export function previewedEntry(): Entry | null {
  return isPreviewOpen() ? currentEntry : null;
}

export function closePreview(): void {
  overlay.style.display = 'none';
  currentEntry = null;
  currentText  = null;
  dsvHeader = []; dsvRows = []; dsvSort = null;
  document.getElementById('fe-ql-body')!.innerHTML = '';
}

export function openPreview(e: Entry): void {
  if (!canPreview(e)) return;
  currentEntry = e;
  const seq = ++reqSeq;
  const ext = getExt(e);

  document.getElementById('fe-ql-icon')!.innerHTML = getIcon(e, deps.iconRules());
  document.getElementById('fe-ql-name')!.textContent = e.name;
  document.getElementById('fe-ql-meta')!.textContent =
    `${fmtSize(e.rawBytes)}${ext ? ' · .' + ext : ''}`;
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = e.href;
  const body = document.getElementById('fe-ql-body')!;
  overlay.style.display = 'flex';
  dsvHeader = []; dsvRows = []; dsvSort = null;
  currentText = null;
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.disabled = true;

  if (IMG_EXTS.has(ext)) {
    copyBtn.style.display = 'none';   // no text contents to copy
    body.innerHTML = `<div class="fe-ql-imgwrap"><img class="fe-ql-img" src="${esc(e.href)}" alt="${esc(e.name)}"></div>`;
    return;
  }
  copyBtn.style.display = '';

  if (e.rawBytes > FETCH_WARN_BYTES) {
    body.innerHTML = `
      <div class="fe-ql-center">
        <div class="fe-ql-note">File is ${fmtSize(e.rawBytes)} — large files can be slow to render.</div>
        <button id="fe-ql-force" class="fe-pbn">Load anyway</button>
      </div>`;
    document.getElementById('fe-ql-force')!.addEventListener('click', () => fetchAndRender(e, ext, seq));
    return;
  }

  fetchAndRender(e, ext, seq);
}

function fetchAndRender(e: Entry, ext: string, seq: number): void {
  const body = document.getElementById('fe-ql-body')!;
  body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Loading…</div></div>`;
  fetchFileText(e.href)
    .then(text => {
      if (seq !== reqSeq) return;
      currentText = text;
      (document.getElementById('fe-ql-copy') as HTMLButtonElement).disabled = false;
      render(text, ext);
    })
    .catch(err => {
      if (seq !== reqSeq) return;
      console.error('[BFB] preview failed:', e.href, err);
      body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note err">Could not read file.</div></div>`;
    });
}

function render(text: string, ext: string): void {
  const body = document.getElementById('fe-ql-body')!;
  if (sniffBinary(text)) {
    body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Binary file — no text preview.</div></div>`;
    return;
  }
  if (TABLE_EXTS.has(ext)) {
    const rows = parseDSV(text, ext === 'tsv' ? '\t' : ',');
    if (rows.length) {
      dsvHeader = rows[0];
      dsvRows   = rows.slice(1);
      dsvNum    = numericCols(rows);
      body.innerHTML = renderDSVTable(dsvHeader, dsvRows, dsvNum);
      return;
    }
    body.innerHTML = `<div class="fe-ql-center"><div class="fe-ql-note">Empty file.</div></div>`;
    return;
  }
  if (JSONL_EXTS.has(ext)) { body.innerHTML = renderJsonl(text); return; }
  if (ext === 'json')      { body.innerHTML = renderJsonTree(text); return; }
  if (ext === 'md' || ext === 'mdx') { body.innerHTML = renderMarkdown(text); return; }
  body.innerHTML = renderCode(text, ext);
}
