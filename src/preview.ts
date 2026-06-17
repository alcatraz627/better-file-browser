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
import { llmAvailability, llmQuery, LLM_ERROR_TEXT, type LlmAvailability } from './llm';

const FETCH_WARN_BYTES = 8 * 1024 * 1024;

// Media types rendered straight from file:// (like images): no fetch, no text
// copy, no AI bar. Only formats Chrome plays/renders natively are claimed.
const PDF_EXTS   = new Set(['pdf']);
const VIDEO_EXTS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const FONT_EXTS  = new Set(['ttf', 'otf', 'woff', 'woff2']);

export function canPreview(e: Entry): boolean {
  if (e.isDir || e.isParent) return false;
  const ext = getExt(e);
  return IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext)
    || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext)
    || TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext)
    || ext === 'json' || CODE_EXTS.has(ext) || ext === '';
}

function fontSpecimen(href: string): string {
  const sample = 'The quick brown fox jumps over the lazy dog 0123456789';
  const sizes = [14, 20, 28, 40, 56];
  return `<style>@font-face{font-family:'bfb-spec';src:url("${esc(href)}")}</style>
    <div class="fe-ql-font">
      ${sizes.map(s => `<div style="font-size:${s}px">${sample}</div>`).join('')}
      <div style="font-size:30px">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz</div>
    </div>`;
}

interface PreviewDeps {
  iconRules: () => IconRule[] | null;
  aiModel?:  () => string | undefined;   // chosen -m override, or undefined for default
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

// AI bar state: one in-flight query at a time, cancelled on close/rerun
let aiCancel: (() => void) | null = null;
let aiSeq = 0;

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
      <div id="fe-ql-ai" style="display:none">
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="fe-ql-ai-btn" id="fe-ql-ai-exp"></button>
        <input id="fe-ql-ai-q" type="text" placeholder="Ask about this file…" autocomplete="off" spellcheck="false">
        <button class="fe-ql-ai-btn" id="fe-ql-ai-ask" title="Answer grounded in this file only">Ask</button>
      </div>
      <div id="fe-ql-ai-out" style="display:none">
        <div id="fe-ql-ai-out-body"></div>
        <div id="fe-ql-ai-out-meta"></div>
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

  const aiQ = document.getElementById('fe-ql-ai-q') as HTMLInputElement;
  document.getElementById('fe-ql-ai-sum')!.addEventListener('click', () => runAi('summarize'));
  document.getElementById('fe-ql-ai-exp')!.addEventListener('click', function () {
    runAi((this as HTMLElement).dataset.intent || 'explain-code');
  });
  const askAi = () => {
    const q = aiQ.value.trim();
    if (!q) { aiQ.focus(); return; }
    runAi('qa', q);
  };
  document.getElementById('fe-ql-ai-ask')!.addEventListener('click', askAi);
  aiQ.addEventListener('keydown', e => {
    if (e.key === 'Enter') askAi();
    else if (e.key === 'Escape') { e.stopPropagation(); aiQ.blur(); }
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
  resetAiUi();
}

function resetAiUi(): void {
  aiCancel?.();
  aiCancel = null;
  aiSeq++;
  document.getElementById('fe-ql-ai')!.style.display = 'none';
  document.getElementById('fe-ql-ai-out')!.style.display = 'none';
  document.getElementById('fe-ql-ai-out-body')!.innerHTML = '';
  document.getElementById('fe-ql-ai-out-meta')!.textContent = '';
  (document.getElementById('fe-ql-ai-q') as HTMLInputElement).value = '';
}

// Show the AI bar once the host confirms lm is reachable. "unavailable"
// (host not installed / lm missing) keeps the bar hidden entirely — the
// preview works exactly as before for users without the toolkit.
function setupAi(e: Entry, ext: string): void {
  llmAvailability().then((av: LlmAvailability) => {
    if (currentEntry !== e || !isPreviewOpen()) return;
    if (av.kind === 'unavailable') return;
    const tabular = TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === 'json';
    const exp = document.getElementById('fe-ql-ai-exp') as HTMLButtonElement;
    exp.textContent    = tabular ? 'Describe' : 'Explain';
    exp.dataset.intent = tabular ? 'describe-data' : 'explain-code';
    exp.title = tabular
      ? 'Schema + notable observations (local model)'
      : 'What this does, with safety callouts (local model)';
    const ready = av.kind === 'ready';
    const chip = document.getElementById('fe-ql-ai-chip')!;
    chip.className = ready ? (av.cold ? 'cold' : 'ready') : 'down';
    document.getElementById('fe-ql-ai-chip-txt')!.textContent =
      ready ? (av.cold ? 'AI · cold start' : 'AI · ready') : 'AI · lm server down';
    document.querySelectorAll<HTMLButtonElement>('.fe-ql-ai-btn').forEach(b => { b.disabled = !ready; });
    (document.getElementById('fe-ql-ai-q') as HTMLInputElement).disabled = !ready;
    document.getElementById('fe-ql-ai')!.style.display = '';
  });
}

function runAi(intent: string, question?: string): void {
  if (currentText === null || !currentEntry) return;   // fetch not done yet
  aiCancel?.();
  const seq = ++aiSeq;
  const body = document.getElementById('fe-ql-ai-out-body')!;
  const meta = document.getElementById('fe-ql-ai-out-meta')!;
  document.getElementById('fe-ql-ai-out')!.style.display = '';
  body.textContent = '';
  meta.textContent = 'Thinking…';
  let full = '';
  aiCancel = llmQuery(
    { ctx: currentText, ctxName: currentEntry.name, intent, question, model: deps.aiModel?.() },
    {
      onChunk: t => {
        if (seq !== aiSeq) return;
        full += t;
        body.textContent = full;
      },
      onDone: info => {
        if (seq !== aiSeq) return;
        aiCancel = null;
        body.innerHTML = renderMarkdown(full);
        meta.textContent = `${info.model} · ${(info.ms / 1000).toFixed(1)}s` +
          (info.truncated ? ' · input truncated to fit the model' : '');
      },
      onError: (code, message) => {
        if (seq !== aiSeq) return;
        aiCancel = null;
        if (code === 'cancelled') return;
        body.textContent = LLM_ERROR_TEXT[code] ?? message;
        meta.textContent = '';
      },
    },
  );
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
  resetAiUi();
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.disabled = true;

  if (IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext)) {
    copyBtn.style.display = 'none';   // binary media: rendered from file://, no text/AI
    if (IMG_EXTS.has(ext)) {
      body.innerHTML = `<div class="fe-ql-imgwrap"><img class="fe-ql-img" src="${esc(e.href)}" alt="${esc(e.name)}"><div class="fe-ql-dim"></div></div>`;
      const img = body.querySelector<HTMLImageElement>('img.fe-ql-img');
      const dim = body.querySelector<HTMLElement>('.fe-ql-dim');
      if (img && dim) {
        const show = () => { if (img.naturalWidth) dim.textContent = `${img.naturalWidth} × ${img.naturalHeight}`; };
        if (img.complete) show(); else img.addEventListener('load', show, { once: true });
      }
    }
    else if (PDF_EXTS.has(ext))   body.innerHTML = `<embed class="fe-ql-pdf" src="${esc(e.href)}" type="application/pdf">`;
    else if (VIDEO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-media-wrap"><video class="fe-ql-media" src="${esc(e.href)}" controls autoplay muted></video></div>`;
    else if (AUDIO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-center"><audio src="${esc(e.href)}" controls></audio></div>`;
    else                          body.innerHTML = fontSpecimen(e.href);
    return;
  }
  copyBtn.style.display = '';
  setupAi(e, ext);

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
    document.getElementById('fe-ql-ai')!.style.display = 'none';   // nothing for a model to read
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
  if (ext === 'md' || ext === 'mdx') {
    body.innerHTML = renderMarkdown(text, currentEntry?.href ?? '');
    return;
  }
  body.innerHTML = renderCode(text, ext);
}
