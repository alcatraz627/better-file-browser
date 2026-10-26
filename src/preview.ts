// Quick Look overlay — macOS-style file preview inside the explorer.
// Fetches file:// content over XHR (the same trick the crumb dropdown uses)
// and hands it to a renderer picked by extension. No new permissions needed.
import { resizable } from './resize';
import type { Entry, IconRule, PreviewLayout } from './types';
import { esc, fmtSize, getExt, copyToClipboard, midHtml, pageHref, fileHref } from './utils';
import { getPreviewLayout, savePreviewLayout, isSaved, toggleSaved, flagPref, textPref } from './storage';
import { rememberFocus, restoreFocus } from './dialog';
import { raise, lower, focusTrap } from './layer';
import { getIcon, IMG_EXTS, PI } from './icons';
import { UI_ICON, GLYPH } from './control-icons';
import { SIZE_BTN, wireSize } from './panel-size';
import { fileMeta, kindName, metaSummary } from './file-meta';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderJsonTree, renderJsonl, renderMarkdown,
  parseDSV, numericCols, sortDSVRows, renderDSVTable,
  sniffBinary, unrenderableNote,
} from './renderers';
import { fetchFileText, FileFetchError } from './file-fetch';
import { closeOpenFence, splitThinking } from './ask-quote';
import { notes, NotesError, noteTitle, stampUpdated, slugForTitle, settleClash, clashSides, splitNote, readProps, setField, setFirstLine, applyChange, changedKeys, frontmatterDrift, type Keep, type NoteDoc } from './notes';
import { mountMetaBar, closePropsMenu } from './note-meta-ui';
import { mountImageTools } from './image-tools';
import {
  attachBuffer, moveLines, duplicateLines, indentLines, continueList, absorbTypedMarker, autoMarkerAfter, type AutoMarker, wrapSelection, tableSnippet, type TextEdit,
} from './editor';
import { llmAvailability, llmQuery, LLM_ERROR_TEXT, type LlmAvailability } from './llm';
import { addTurn, chatsFor, turnMeta, type AskTurn } from './ask-history';
import { emptyHtml } from './empty-state';
import { go, reload } from './nav';
import { errorText } from './errors';
import { formatFor, renderFile } from './formats';

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
      ${sizes.map(s => `<div style="--fs:${s}px">${sample}</div>`).join('')}
      <div style="--fs:30px">ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz</div>
    </div>`;
}

interface PreviewDeps {
  iconRules: () => IconRule[] | null;
  aiModel?:  () => string | undefined;   // chosen -m override, or undefined for default
  keepTab?:  (path: string) => void;     // keep the previewed file as a background strip tab
  saveError?: (message: string) => void;
  toast?: (message: string) => void;
  savedChanged?: () => void;               // Saved changed from the preview's own button
  openInTerminal?: (folder: string) => void;
  dockRoom?: (docked: boolean) => void;   // a docked preview is showing (true) or not (false)
  rename?: (anchor: HTMLElement, path: string) => void;   // rename the previewed file on disk
}
// Scroll position per previewed file, for this page's lifetime.
const scrollMemo = new Map<string, number>();
export function previewEntry(): Entry | null { return currentEntry; }
// The file in the panel: a previewed file comes from currentEntry; a note
// being edited nulls that, so it falls back to the note's own path.
function previewedPath(): string | null {
  return currentEntry ? decodeURIComponent(new URL(currentEntry.href, location.href).pathname)
       : edit ? edit.root.replace(/\/$/, '') + '/' + edit.rel : null;
}
// Whether a row has text to copy or ask about: not a folder, not a picture,
// film, sound, font or PDF.
export function hasText(e: Entry): boolean {
  const ext = getExt(e);
  return !e.isDir && canPreview(e) && !IMG_EXTS.has(ext) && !PDF_EXTS.has(ext) && !VIDEO_EXTS.has(ext) && !AUDIO_EXTS.has(ext) && !FONT_EXTS.has(ext);
}
// Images take Ask too: the vision model reads them.
export function canAsk(e: Entry): boolean { return hasText(e) || (!e.isDir && IMG_EXTS.has(getExt(e))); }
// Copy a file's whole text without opening it, as the preview's Copy does.
export function copyContents(e: Entry, say: (m: string) => void): void {
  fetchFileText(e.href)
    .then(text => sniffBinary(text) ? say(`${e.name} is not a text file`) : copyToClipboard(text).then(ok => say(ok ? `Copied the contents of ${e.name}` : 'Copy failed')))
    .catch(() => say(`Could not read ${e.name}`));
}
// Open the preview with the question box focused, as pressing a there does.
let askWhenReady: Entry | null = null;
export function askAbout(e: Entry): void {
  askWhenReady = e;
  openPreview(e);
}
export function keepPreviewedAsTab(): void {
  const path = previewedPath();
  if (path && deps.keepTab) deps.keepTab(path);
}
// The Save button shows whether the file in the panel is saved.
function syncSaveBtn(): void {
  const p = previewedPath(), b = document.getElementById('fe-ql-save');
  if (!b) return;
  const on = !!p && isSaved(p);
  b.classList.toggle('on', on);
  b.title = on ? 'Remove from Saved' : 'Save this file';
}

let deps: PreviewDeps;
let overlay: HTMLElement;
let layout: PreviewLayout = { mode: 'modal' };   // read in initPreview, once settings have loaded
let currentEntry: Entry | null = null;
let currentText: string | null = null;   // raw fetched contents, for copy
// An image's path when one is shown; Ask sends it to the local vision model.
let currentImage: string | null = null;
let reqSeq = 0;

// Table-sort state for the currently previewed .tsv/.csv
let dsvHeader: string[] = [];
let dsvRows:   string[][] = [];
let dsvNum:    Set<number> = new Set();
let dsvSort:   { col: number; dir: 'asc' | 'desc' } | null = null;

// AI bar state: one in-flight query at a time, cancelled on close/rerun
let aiCancel: (() => void) | null = null;
let aiSeq = 0;
// Whether AI is offered for what is open, and whether the bar is showing; the
// bar folds away from the header button and stays that way.
let aiOn = false;
const aiBarPref = flagPref('bfb-ql-ai-bar-v1', true);
// When the host was last found missing, so a tab without it does not flash the bar on every preview.
const aiNonePref = textPref('bfb-ql-ai-none-v1', '', 'tab');
const aiMissing = () => Date.now() - Number(aiNonePref.get() || 0) < 60_000;
// What the last answer was asked, for Retry.
let aiRun: { intent: string; question?: string } | null = null;

export function initPreview(d: PreviewDeps): void {
  deps = d;
  layout = getPreviewLayout();
  overlay = document.createElement('div');
  overlay.id = 'fe-qlook';
  overlay.style.display = 'none';
  overlay.innerHTML = `
    <div id="fe-ql-bg" class="scrim"></div>
    <div id="fe-ql-dialog" class="panel">
      <div id="fe-ql-hdr" class="bar">
        <span id="fe-ql-icon"></span>
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open natively in a new tab (⌘-click / middle-click also work)"></a>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" class="btn" title="Copy full file contents to clipboard" disabled>
          ${GLYPH.copySmall}
          <span>Copy</span>
        </button>
        <a id="fe-ql-open" class="btn" target="_blank" rel="noopener" title="The raw file, in a new tab">${UI_ICON.external}<span>Raw</span></a>
        <button id="fe-ql-go" class="btn" title="Open in this tab (Enter)">${UI_ICON.files}<span>Open</span></button>
        <button id="fe-ql-tab" class="btn" title="Keep as a strip tab (t)">${UI_ICON.tab}<span>Tab</span></button>
        <button id="fe-ql-rename" class="btn" data-icon title="Rename this file (F2 in the list)">${UI_ICON.rename}</button>
        <button id="fe-ql-save" class="btn" data-icon title="Save this file">${PI.bm}</button>
        <button id="fe-ql-term" class="btn" data-icon title="Open its folder in the terminal">${UI_ICON.terminal}</button>
        <button id="fe-ql-ai-btn" class="btn" data-icon title="Ask about this file (a)" aria-pressed="false" hidden>${UI_ICON.ai}</button>
        ${SIZE_BTN('fe-ql-size')}
        <button id="fe-ql-dock" class="btn" data-icon title="Dock the preview to the side">
          ${GLYPH.dock}
        </button>
        <button id="fe-ql-close" class="btn" data-icon title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
      <div id="fe-ql-ai" hidden>
        <span id="fe-ql-ai-chip"><span class="dot"></span><span id="fe-ql-ai-chip-txt"></span></span>
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-sum" title="TL;DR of this file (local model)">Summarize</button>
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-exp" title="Explain this file, or describe a table (local model)"></button>
        <input id="fe-ql-ai-q" class="tb" type="text" placeholder="Ask about this file" autocomplete="off" spellcheck="false">
        <button class="btn fe-ql-ai-btn" id="fe-ql-ai-ask" title="Answer grounded in this file only">Ask</button>
        <button class="btn" id="fe-ql-ai-recheck" data-variant="outline" title="Check the model again" hidden>Retry</button>
      </div>
      <div id="fe-ql-ai-out" hidden>
        <div id="fe-ql-ai-out-q"></div>
        <div id="fe-ql-ai-out-body"></div>
        <div id="fe-ql-ai-out-foot">
          <span id="fe-ql-ai-out-meta"></span>
          <button class="btn" id="fe-ql-ai-stop" data-size="sm" data-variant="outline" title="Stop this answer (Esc)" hidden>Stop</button>
          <button class="btn" id="fe-ql-ai-retry" data-size="sm" data-variant="outline" title="Ask this again" hidden>Retry</button>
        </div>
      </div>
      <div id="fe-ql-body"></div>
    </div>`;
  document.getElementById('fe')!.appendChild(overlay);

  document.getElementById('fe-ql-close')!.addEventListener('click', closePreview);
  document.getElementById('fe-ql-go')!.addEventListener('click', () => {
    if (currentEntry) go(currentEntry.href);
    else if (edit) go(fileHref(edit.root.replace(/\/$/, '') + '/' + edit.rel));
  });
  document.getElementById('fe-ql-tab')!.addEventListener('click', keepPreviewedAsTab);
  document.getElementById('fe-ql-save')!.addEventListener('click', () => {
    const p = previewedPath();
    if (!p) return;
    const now = toggleSaved(p, p.split('/').pop() || p);
    syncSaveBtn();
    deps.savedChanged?.();
    deps.toast?.(now ? 'Saved' : 'Removed from Saved');
  });
  document.getElementById('fe-ql-rename')!.addEventListener('click', e => {
    // A note open in the panel renames the way notes do: by its title.
    if (!currentEntry) { noteAction('rename'); return; }
    const p = previewedPath();
    if (p) deps.rename?.(e.currentTarget as HTMLElement, p);
  });
  document.getElementById('fe-ql-term')!.addEventListener('click', () => {
    const p = previewedPath();
    if (p) deps.openInTerminal?.(p.replace(/\/[^/]*$/, '') || '/');
  });
  const bodyEl = document.getElementById('fe-ql-body')!;
  bodyEl.addEventListener('scroll', () => { if (currentEntry) scrollMemo.set(currentEntry.href, bodyEl.scrollTop); });
  document.getElementById('fe-ql-bg')!.addEventListener('click', closePreview);
  document.getElementById('fe-ql-dock')!.addEventListener('click', () => {
    layout = { ...layout, mode: layout.mode === 'side' ? 'modal' : 'side' };
    savePreviewLayout(layout);
    applyLayout();
  });
  applyLayout();

  // While the floating preview is open, Tab moves through its own controls
  // and wraps, rather than walking the listing hidden behind its scrim.
  focusTrap(overlay, { when: () => layout.mode !== 'side' });

  // The corner grip (floating) sets the window's size; the left edge (docked)
  // sets the panel's width. Both are the shared resize handle.
  const dialog = document.getElementById('fe-ql-dialog')!;
  const sizer = wireSize(document.getElementById('fe-ql-size')!, dialog, 'preview', () => applyLayout());
  resizable(document.getElementById('fe-ql-rz')!, {
    axis: 'xy', label: 'Resize the preview',
    size: () => { const r = dialog.getBoundingClientRect(); return { w: r.width, h: r.height }; },
    apply: (w, h) => {
      const r = dialog.getBoundingClientRect();
      layout.modalW = Math.min(window.innerWidth - r.left - 8, Math.max(360, w));
      layout.modalH = Math.min(window.innerHeight - r.top - 8, Math.max(240, h));
      // A hand-set size replaces large and extra large.
      if (dialog.dataset.size) sizer.set('md');
      applyLayout();
    },
    reset: () => { delete layout.modalW; delete layout.modalH; if (dialog.dataset.size) sizer.set('md'); applyLayout(); },
    commit: () => savePreviewLayout(layout),
  });
  resizable(document.getElementById('fe-ql-rz-side')!, {
    axis: 'x', dir: -1, label: 'Resize the preview',
    size: () => ({ w: overlay.getBoundingClientRect().width, h: 0 }),
    apply: w => { layout.sideW = Math.min(window.innerWidth * 0.8, Math.max(280, w)); applyLayout(); },
    reset: () => { delete layout.sideW; applyLayout(); },
    commit: () => savePreviewLayout(layout),
  });

  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.addEventListener('click', () => {
    if (currentText === null) return;
    const flash = (ok: boolean) => {
      copyBtn.querySelector('span')!.textContent = ok ? '✓ copied' : 'failed';
      setTimeout(() => { copyBtn.querySelector('span')!.textContent = 'copy'; }, 1400);
    };
    copyToClipboard(currentText).then(flash);
  });

  const aiQ = document.getElementById('fe-ql-ai-q') as HTMLInputElement;
  document.querySelectorAll<HTMLButtonElement>('.fe-ql-ai-btn').forEach(b => { b.dataset.title = b.title; });
  document.getElementById('fe-ql-ai-btn')!.addEventListener('click', () => {
    if (aiBarPref.get()) { aiBarPref.set(false); syncAiBar(); } else askInPreview();
  });
  document.getElementById('fe-ql-ai-stop')!.addEventListener('click', () => aiCancel?.());
  document.getElementById('fe-ql-ai-retry')!.addEventListener('click', () => { if (aiRun) runAi(aiRun.intent, aiRun.question); });
  document.getElementById('fe-ql-ai-recheck')!.addEventListener('click', () => { if (currentEntry) setupAi(currentEntry, aiExt); });
  document.getElementById('fe-ql-ai-sum')!.addEventListener('click', () => runAi('summarize'));
  document.getElementById('fe-ql-ai-exp')!.addEventListener('click', function () {
    runAi((this as HTMLElement).dataset.intent || 'explain-code');
  });
  const askAi = () => {
    const q = aiQ.value.trim();
    if (!q) { aiQ.focus(); return; }
    runAi('qa', q);
    aiQ.value = '';
  };
  document.getElementById('fe-ql-ai-ask')!.addEventListener('click', askAi);
  aiQ.addEventListener('keydown', e => {
    if (e.key === 'Enter') askAi();
    else if (e.key === 'Escape') {
      // Esc steps back one thing at a time: the answer being written, then the
      // typed question, then the preview itself.
      if (aiCancel) { e.stopPropagation(); aiCancel(); }
      else if (aiQ.value) { e.stopPropagation(); aiQ.value = ''; }
      else { e.stopPropagation(); closePreview(); }
    }
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

export function isPreviewDocked(): boolean {
  return layout.mode === 'side';
}

// Modal: a fixed overlay under #fe with a scrim. Side: the same element moved
// into #fe-body as a flex sibling of the listing, no scrim, owner-set width.
function applyLayout(): void {
  const dialog = document.getElementById('fe-ql-dialog')!;
  const side = layout.mode === 'side';
  overlay.classList.toggle('side', side);
  dialog.toggleAttribute('data-dock', side);
  // Docked, the header's text buttons show their icon alone; their title names them.
  overlay.querySelectorAll<HTMLElement>('#fe-ql-hdr > .btn').forEach(b => {
    if (!b.querySelector(':scope > span')) return;
    if (side) { b.dataset.icon = ''; b.dataset.dockIcon = ''; }
    else if ('dockIcon' in b.dataset) { delete b.dataset.icon; delete b.dataset.dockIcon; }
  });
  const host = side ? document.getElementById('fe-body') : document.getElementById('fe');
  if (host && overlay.parentElement !== host) host.appendChild(overlay);
  // Remembered sizes are pixels from a wider window; cap them by the window
  // now, so a narrower window keeps room for the listing and the close button.
  overlay.style.width = side && layout.sideW ? `min(${layout.sideW}px, max(280px, calc(100vw - 600px)))` : '';
  // Large and extra large take their size from the window, not the grip.
  const own = !side && !dialog.dataset.size;
  dialog.style.width  = own && layout.modalW ? `min(${layout.modalW}px, calc(100vw - 16px))` : '';
  dialog.style.height = own && layout.modalH ? `min(${layout.modalH}px, calc(100vh - 16px))` : '';
  // Floating, it stacks with the other floating parts; docked, it is part of the page.
  if (side) lower(overlay);
  else if (overlay.style.display !== 'none') raise(overlay);
  if (overlay.style.display !== 'none') deps.dockRoom?.(side);
  const dock = document.getElementById('fe-ql-dock')!;
  dock.title = side ? 'Float the preview as a window' : 'Dock the preview to the side';
  dock.classList.toggle('on', side);
}

export function closePreview(): void {
  if (edit) {
    // Leaving the editor flushes a pending autosave; the write completes
    // after the panel is gone and the sidebar refreshes from its callback.
    if (edit.timer) clearTimeout(edit.timer);
    if (edit.dirty) void saveNote();
    edit = null;
  }
  overlay.style.display = 'none';
  deps.dockRoom?.(false);
  restoreFocus();
  document.getElementById('fe-ql-body')!.classList.remove('fe-editing');
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
  aiOn = false;
  aiRun = null;
  syncAiBar();
  document.getElementById('fe-ql-ai-out')!.hidden = true;
  document.getElementById('fe-ql-ai-out-q')!.textContent = '';
  document.getElementById('fe-ql-ai-out-body')!.innerHTML = '';
  document.getElementById('fe-ql-ai-out-meta')!.textContent = '';
  setAiBusy(false);
  (document.getElementById('fe-ql-ai-q') as HTMLInputElement).value = '';
}

// The bar shows when AI is offered here and the person has not folded it away.
function syncAiBar(): void {
  const open = aiOn && aiBarPref.get();
  document.getElementById('fe-ql-ai')!.hidden = !open;
  const btn = document.getElementById('fe-ql-ai-btn')!;
  btn.hidden = !aiOn;
  btn.classList.toggle('on', open);
  btn.setAttribute('aria-pressed', String(open));
  btn.title = open ? 'Hide the AI bar' : 'Ask about this file (a)';
}

/// Open the AI bar if it was folded away and put the cursor in its question box; false when AI is not offered here.
export function askInPreview(): boolean {
  if (!aiOn) return false;
  aiBarPref.set(true);
  syncAiBar();
  (document.getElementById('fe-ql-ai-q') as HTMLInputElement).focus();
  return true;
}

/// The AI bar's Stop while an answer is being written, and Retry once it has ended.
function setAiBusy(busy: boolean): void {
  document.getElementById('fe-ql-ai-stop')!.hidden = !busy;
  document.getElementById('fe-ql-ai-retry')!.hidden = busy || !aiRun || document.getElementById('fe-ql-ai-out')!.hidden;
}

let aiExt = '';

// Show the AI bar as soon as the preview opens, in a "checking" state, so it
// does not push the file down when the model answers. "unavailable" (host not
// installed / lm missing) hides it again and is remembered for a minute, so a
// machine without the toolkit sees the preview exactly as before.
function setupAi(e: Entry, ext: string): void {
  if (aiMissing()) return;
  aiExt = ext;
  const tabular = TABLE_EXTS.has(ext) || JSONL_EXTS.has(ext) || ext === 'json';
  const image = ext === 'image';
  const exp = document.getElementById('fe-ql-ai-exp') as HTMLButtonElement;
  exp.textContent    = tabular || image ? 'Describe' : 'Explain';
  exp.dataset.intent = image ? 'describe-image' : tabular ? 'describe-data' : 'explain-code';
  exp.dataset.title = image ? 'What the image shows, read by the local vision model; it never leaves this Mac'
    : tabular ? 'Schema + notable observations (local model)'
    : 'What this does, with safety callouts (local model)';
  const chip = document.getElementById('fe-ql-ai-chip')!;
  const chipTxt = document.getElementById('fe-ql-ai-chip-txt')!;
  const recheck = document.getElementById('fe-ql-ai-recheck')!;
  const q = document.getElementById('fe-ql-ai-q') as HTMLInputElement;
  // Why the controls are off is said beside them, since a disabled button shows no hint of its own.
  const paint = (state: 'checking' | 'ready' | 'cold' | 'down', why = '') => {
    chip.className = state === 'checking' ? '' : state;
    chipTxt.textContent = state === 'ready' ? 'AI · ready' : state === 'cold' ? 'AI · cold start' : state === 'down' ? why : 'AI · checking';
    // While the check runs the controls stay live, so a click is never lost to it; only a known-down model switches them off.
    const on = state !== 'down';
    document.querySelectorAll<HTMLButtonElement>('.fe-ql-ai-btn').forEach(b => { b.disabled = !on; b.title = on ? b.dataset.title ?? '' : why; });
    q.disabled = !on;
    q.placeholder = on ? 'Ask about this file' : 'Ask is off until the model runs';
    recheck.hidden = state !== 'down';
  };
  paint('checking');
  aiOn = true;
  syncAiBar();
  restoreAiAnswer(e);
  llmAvailability().then((av: LlmAvailability) => {
    if (currentEntry !== e || !isPreviewOpen()) return;
    // Ask from a row's menu opens the preview and puts the cursor in the question box once the model answers.
    const asked = askWhenReady === e;
    if (asked) askWhenReady = null;
    if (av.kind === 'unavailable') {
      aiNonePref.set(String(Date.now())); aiOn = false; syncAiBar();
      if (asked) deps.toast?.('Ask needs the lm toolkit, which is not installed');
      return;
    }
    aiNonePref.set('');
    paint(av.kind === 'ready' ? (av.cold ? 'cold' : 'ready') : 'down', LLM_ERROR_TEXT.server_down);
    if (asked && av.kind === 'ready') (document.getElementById('fe-ql-ai-q') as HTMLInputElement).focus();
  });
}

// Answers from the preview's AI bar join the file's Ask history, one chat per
// file per preview, so the Ask lens on that file's page lists them too.
let aiChat = { href: '', id: '' };
const AI_ASKED: Record<string, string> = { summarize: 'Summarize', explain: 'Explain', describe: 'Describe', 'explain-code': 'Explain', 'describe-data': 'Describe', 'describe-image': 'Describe' };
// What the image buttons ask, since an image has no text for the model to summarize.
const IMAGE_ASKED: Record<string, string> = { summarize: 'Summarize what this image shows in a few lines.', 'describe-image': 'Describe this image in detail, with any text in it verbatim.' };
const pathOf = (e: Entry) => decodeURIComponent(new URL(e.href, location.href).pathname);

// The newest preview answer about this file comes back when it is opened again.
function restoreAiAnswer(e: Entry): void {
  let last: { id: string; turn: AskTurn } | null = null;
  try {
    for (const c of chatsFor(pathOf(e))) {
      const ok = c.turns.filter(x => !x.error && !x.via && x.a);
      const t = ok[ok.length - 1];
      if (c.id.startsWith('pv-') && t) { last = { id: c.id, turn: t }; break; }
    }
  } catch { /* history is a convenience */ }
  if (!last) return;
  const { id, turn } = last;
  aiChat = { href: e.href, id };
  const exp = document.getElementById('fe-ql-ai-exp') as HTMLElement;
  const byLabel: Record<string, string> = { Summarize: 'summarize', Explain: 'explain-code', Describe: exp.dataset.intent || 'describe-data' };
  aiRun = turn.intent ? { intent: turn.intent } : byLabel[turn.q] ? { intent: byLabel[turn.q] } : { intent: 'qa', question: turn.q };
  document.getElementById('fe-ql-ai-out')!.hidden = false;
  document.getElementById('fe-ql-ai-out-q')!.textContent = turn.q;
  document.getElementById('fe-ql-ai-out-body')!.innerHTML = renderMarkdown(closeOpenFence(splitThinking(turn.a).answer));
  document.getElementById('fe-ql-ai-out-meta')!.textContent = turnMeta(turn);
  setAiBusy(false);
}

function runAi(intent: string, question?: string): void {
  if ((currentText === null && !currentImage) || !currentEntry) return;   // fetch not done yet
  const entry = currentEntry;
  const run = { intent, question };
  aiRun = run;
  const asked = question || AI_ASKED[intent] || intent;
  // An image goes to the host as a file, read by the vision model, with the question.
  const image = currentImage;
  if (image) { question = question || IMAGE_ASKED[intent] || IMAGE_ASKED['describe-image']; intent = 'qa'; }
  if (aiChat.href !== entry.href) aiChat = { href: entry.href, id: 'pv-' + Date.now().toString(36) };
  aiCancel?.();
  const seq = ++aiSeq;
  const startedAt = Date.now();
  const body = document.getElementById('fe-ql-ai-out-body')!;
  const meta = document.getElementById('fe-ql-ai-out-meta')!;
  document.getElementById('fe-ql-ai-out')!.hidden = false;
  document.getElementById('fe-ql-ai-out-q')!.textContent = asked;
  body.textContent = '';
  meta.textContent = 'Thinking…';
  let full = '';
  let frame = 0;
  let over = false;
  const model = deps.aiModel?.();
  // The answer is drawn as markdown with any open code fence closed, so a half-written block still reads as code.
  const paint = () => { body.innerHTML = renderMarkdown(closeOpenFence(splitThinking(full).answer)); };
  const file = (extra: Partial<AskTurn>) => {
    const turn: AskTurn = { q: asked, a: full, model: model || 'default', ms: Date.now() - startedAt, at: startedAt,
      ...(run.intent !== 'qa' ? { intent: run.intent } : {}), ...extra };
    try { addTurn(pathOf(entry), aiChat.id, turn); } catch { /* history is a convenience; the answer is already shown */ }
    return turn;
  };
  setAiBusy(true);
  const stopQuery = llmQuery(
    { ctx: image ? '' : currentText ?? '', ctxName: entry.name, intent, question, model, files: image ? [image] : undefined },
    {
      onStep: t => { if (seq === aiSeq && !over) meta.textContent = t + '…'; },
      onChunk: t => {
        if (seq !== aiSeq || over) return;
        full += t;
        meta.textContent = '';
        frame ||= requestAnimationFrame(() => { frame = 0; if (!over && seq === aiSeq) paint(); });
      },
      onDone: info => {
        if (seq !== aiSeq || over) return;
        over = true; cancelAnimationFrame(frame);
        aiCancel = null;
        paint();
        meta.textContent = turnMeta(file({ model: info.model, ms: info.ms, tokensIn: info.tokensIn, tokensOut: info.tokensOut }), info.truncated);
        setAiBusy(false);
      },
      onError: (code, message) => {
        if (seq !== aiSeq || over) return;
        over = true; cancelAnimationFrame(frame);
        aiCancel = null;
        setAiBusy(false);
        if (code === 'cancelled') return;
        body.textContent = LLM_ERROR_TEXT[code] ?? message;
        meta.textContent = '';
      },
    },
  );
  // Stop (the button, or Esc in the question box) keeps what was written, marked as stopped.
  if (!over) aiCancel = () => {
    if (over) return;
    over = true; cancelAnimationFrame(frame);
    stopQuery();
    aiCancel = null;
    if (full.trim()) { paint(); meta.textContent = turnMeta(file({ stopped: true })); }
    else { body.textContent = 'Stopped before an answer came.'; meta.textContent = ''; }
    setAiBusy(false);
  };
}

// ── Note editor: the same panel, a textarea beside the render ─────────
interface EditState {
  root: string; rel: string; mtime: number; text: string;
  // text is always head + the editor's text: the properties block is never in the textarea
  head: string; base: string; touched: Set<string>; ta?: HTMLTextAreaElement; redrawMeta?: () => void;
  dirty: boolean; saving: boolean; version: number; timer: ReturnType<typeof setTimeout> | null;
  onSaved?: (rel: string) => void; actions?: NoteActions;
}
let edit: EditState | null = null;

export function isEditing(): boolean { return !!edit; }
/// The note the editor holds right now, or null; it follows the first-save rename.
export function editingRel(): string | null { return edit ? edit.rel : null; }
/// Write the editor's pending text to disk and wait for it.
export function saveEditor(): Promise<void> { return saveNote(); }

function editHeader(status: string): void {
  if (!edit) return;
  // The title has its own field just below, so the header names the file only.
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.hidden = true;
  document.getElementById('fe-ql-meta')!.textContent = `${edit.dirty ? '● ' : ''}${edit.rel} · ${status}`;
}

const stripFrontMatter = (t: string) => t.replace(/^---\n[\s\S]*?\n---\n?/, '');

/// What the editor's prev, next, rename and delete buttons do; the sidebar owns the list they act on.
/// `rename`'s `now` is for a key press, which has no pointer click left to wait out.
export interface NoteActions { step(rel: string, dir: 1 | -1): void; rename(rel: string, now?: boolean): void; del(rel: string): void }

/// Rename or delete the open note from a key; false when no note with those actions is open.
export function noteAction(name: 'rename' | 'delete'): boolean {
  if (!edit?.actions) return false;
  if (name === 'rename') edit.actions.rename(edit.rel, true); else edit.actions.del(edit.rel);
  return true;
}

/// Close the editor without saving: the note is about to be moved away, and an autosave would bring it back.
export function discardEditor(): void {
  if (edit) { if (edit.timer) clearTimeout(edit.timer); edit.dirty = false; }
  closePreview();
}

export function openNote(root: string, doc: NoteDoc, onSaved?: (rel: string) => void, actions?: NoteActions): void {
  if (edit && edit.dirty) void saveNote();
  currentEntry = null; reqSeq++;
  const { head, body: noteBody } = splitNote(doc.text);
  edit = { root, rel: doc.rel, mtime: doc.mtime, text: doc.text, head, base: doc.text, touched: new Set(), dirty: false, saving: false, version: 0, timer: null, onSaved, actions };
  currentText = doc.text;
  document.getElementById('fe-ql-icon')!.innerHTML = '';
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.href = fileHref(root.replace(/\/$/, '') + '/' + doc.rel);
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = nameEl.href;
  resetAiUi();
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.style.display = ''; copyBtn.disabled = false;
  if (overlay.style.display === 'none') rememberFocus();
  overlay.style.display = 'flex';
  deps.dockRoom?.(layout.mode === 'side');
  if (layout.mode !== 'side') raise(overlay);
  syncSaveBtn();

  const body = document.getElementById('fe-ql-body')!;
  body.classList.add('fe-editing');
  body.innerHTML = `
    <div id="fe-ed-meta"></div>
    <div id="fe-ed-bar" class="bar">
      <button class="btn" data-icon data-act="bold" title="Bold (⌘B)">${UI_ICON.fmtBold}</button>
      <button class="btn" data-icon data-act="italic" title="Italic (⌘I)">${UI_ICON.fmtItalic}</button>
      <button class="btn" data-icon data-act="code" title="Code (⌘E)">${UI_ICON.fmtCode}</button>
      <button class="btn" data-icon data-act="strike" title="Strikethrough (⌘⇧X)">${UI_ICON.fmtStrike}</button>
      <button class="btn" data-act="heading" title="Heading: each press adds a level, up to ###, then clears (⌘⇧H)" data-icon>${UI_ICON.fmtHeading}</button>
      <button class="btn" data-icon data-act="link" title="Link (⌘K)">${UI_ICON.link}</button>
      <button class="btn" data-icon data-act="quote" title="Quote (⌘⇧.)">${UI_ICON.fmtQuote}</button>
      <button class="btn" data-icon data-act="olist" title="Numbered list (⌘⇧7)">${UI_ICON.fmtOlist}</button>
      <button class="btn" data-icon data-act="list" title="Bullet list">${UI_ICON.list}</button>
      <button class="btn" data-icon data-act="task" title="Task list">${UI_ICON.task}</button>
      <button class="btn" data-icon data-act="table" title="Insert a table">${UI_ICON.table}</button>
      <button class="btn" data-icon data-act="image" title="Insert an image (or paste / drop one)">${UI_ICON.image}</button>
      <span class="bar-sep" aria-hidden="true"></span>
      <button class="btn" data-act="versions" title="Every save of this note, from the folder's git history">${UI_ICON.versions}<span>Versions</span></button>
      ${actions ? `<button class="btn" data-act="prev" title="Previous note in the list (⌥⌘↑)">${UI_ICON.prev}<span>Previous</span></button>
      <button class="btn" data-act="next" title="Next note in the list (⌥⌘↓)">${UI_ICON.next}<span>Next</span></button>
      <button class="btn" data-act="rename" title="Rename this note (F2)">${UI_ICON.rename}<span>Rename</span></button>
      <button class="btn" data-act="delete" title="Move this note to .trash (⌘⇧⌫)">${UI_ICON.trash}<span>Delete</span></button>` : ''}
      <input type="file" id="fe-ed-file" accept="image/*" hidden>
      <span class="fe-ed-hint">⌥↑↓ move line · ⌥⇧↑↓ duplicate · ⇥ indent · Enter continues lists</span>
    </div>
    <div id="fe-ed-hist" hidden></div>
    <div class="fe-ed"><textarea id="fe-ed-src" spellcheck="true"></textarea><div id="fe-ed-view" class="fe-md"></div></div>`;
  const ta = document.getElementById('fe-ed-src') as HTMLTextAreaElement;
  const view = document.getElementById('fe-ed-view')!;
  ta.value = noteBody;
  edit.ta = ta;
  const buf = attachBuffer(ta, `note:${root}/${doc.rel}`);
  const apply = (r: TextEdit) => {
    buf.snap();
    ta.value = r.text;
    ta.setSelectionRange(r.start, r.end);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  };
  const sel = () => ({ start: ta.selectionStart, end: ta.selectionEnd });
  const prefixLines = (prefix: string) => {
    const s = sel();
    const from = ta.value.lastIndexOf('\n', s.start - 1) + 1;
    let to = ta.value.indexOf('\n', s.end); if (to < 0) to = ta.value.length;
    const lines = ta.value.slice(from, to).split('\n').map(l => prefix + l);
    apply({ text: ta.value.slice(0, from) + lines.join('\n') + ta.value.slice(to), start: from, end: from + lines.join('\n').length });
  };
  const act = (name: string) => {
    if (name === 'bold')   apply(wrapSelection(ta.value, sel(), '**'));
    if (name === 'italic') apply(wrapSelection(ta.value, sel(), '_'));
    if (name === 'code')   apply(wrapSelection(ta.value, sel(), '`'));
    if (name === 'strike') apply(wrapSelection(ta.value, sel(), '~~'));
    if (name === 'quote')  prefixLines('> ');
    if (name === 'olist') {
      const s = sel();
      const from = ta.value.lastIndexOf('\n', s.start - 1) + 1;
      let to = ta.value.indexOf('\n', s.end); if (to < 0) to = ta.value.length;
      const lines = ta.value.slice(from, to).split('\n').map((l, n) => `${n + 1}. ${l}`).join('\n');
      apply({ text: ta.value.slice(0, from) + lines + ta.value.slice(to), start: from, end: from + lines.length });
    }
    if (name === 'heading') {
      const s = sel();
      const from = ta.value.lastIndexOf('\n', s.start - 1) + 1;
      let to = ta.value.indexOf('\n', from); if (to < 0) to = ta.value.length;
      const line = ta.value.slice(from, to);
      const level = line.match(/^(#{1,6}) /)?.[1].length ?? 0;
      const next = level >= 3 ? line.replace(/^#{1,6} /, '') : '#'.repeat(level + 1) + ' ' + line.replace(/^#{1,6} /, '');
      apply({ text: ta.value.slice(0, from) + next + ta.value.slice(to), start: from + next.length, end: from + next.length });
    }
    if (name === 'link') {
      const s = sel();
      const label = ta.value.slice(s.start, s.end) || 'text';
      const t = `[${label}](url)`;
      const at = s.start + label.length + 3;
      apply({ text: ta.value.slice(0, s.start) + t + ta.value.slice(s.end), start: at, end: at + 3 });
    }
    if (name === 'list')   prefixLines('- ');
    if (name === 'task')   prefixLines('- [ ] ');
    if (name === 'table')  buf.insert((ta.value.slice(0, ta.selectionStart).endsWith('\n') || !ta.selectionStart ? '' : '\n') + tableSnippet());
    if (name === 'image')  (document.getElementById('fe-ed-file') as HTMLInputElement).click();
    if (name === 'versions') void toggleVersions();
    if (name === 'prev')   actions?.step(edit!.rel, -1);
    if (name === 'next')   actions?.step(edit!.rel, 1);
    if (name === 'rename') actions?.rename(edit!.rel);
    if (name === 'delete') actions?.del(edit!.rel);
  };

  // Versions: the folder's git log for this file (Switchboard commits every save).
  // A row shows that version rendered where the preview is; "Use this version"
  // puts its text in the editor, and the save that follows keeps today's text in the log.
  const hist = document.getElementById('fe-ed-hist')!;
  const escHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  const whenText = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const toggleVersions = async () => {
    if (!hist.hidden) { hist.hidden = true; renderView(); return; }
    hist.hidden = false;
    hist.innerHTML = emptyHtml('loading', 'Reading versions…', { inline: true });
    try {
      // The note may have been renamed since it opened (a first save names it), so ask under its current name.
      const { versions: vs, repo } = await notes.history(root, edit?.rel ?? doc.rel);
      if (!vs.length) {
        hist.innerHTML = emptyHtml('empty', 'No versions yet', { inline: true, hint: repo === false
          ? 'The notes folder is not a git repository; Switchboard makes it one on its first save.'
          : 'This note has not been committed to the notes folder\'s git history.' });
        return;
      }
      hist.innerHTML = vs.slice(0, 30).map(v =>
        `<button class="row fe-hist-row" data-sha="${v.sha}"><span>${whenText(v.when)}</span><span>${escHtml(v.reason)}</span><code>${v.sha}</code></button>`).join('')
        + (vs.length > 30 ? `<span class="fe-ed-hint">and ${vs.length - 30} older</span>` : '');
      hist.querySelectorAll<HTMLElement>('.fe-hist-row').forEach(b => b.addEventListener('click', () => void showVersion(b.dataset.sha!)));
    } catch (err) {
      hist.innerHTML = emptyHtml('failed', 'Versions could not be read', { inline: true, hint: errorText(err), actions: [{ a: 'retry', label: 'Try again', title: 'Read the versions again' }] });
      hist.querySelector('[data-a="retry"]')?.addEventListener('click', () => { hist.hidden = true; void toggleVersions(); });
    }
  };
  const showVersion = async (sha: string) => {
    hist.querySelectorAll<HTMLElement>('.fe-hist-row').forEach(b => b.classList.toggle('active', b.dataset.sha === sha));
    try {
      const v = await notes.version(root, edit?.rel ?? doc.rel, sha);
      view.innerHTML = `<div class="fe-hist-head"><span>version ${sha}</span>`
        + `<button class="btn" id="fe-hist-use" title="Put this text in the editor; today's text stays in the versions">Use this version</button>`
        + `<button class="btn" id="fe-hist-back">Back to now</button></div>` + renderMarkdown(stripFrontMatter(v.text), nameEl.href);
      document.getElementById('fe-hist-use')!.addEventListener('click', () => {
        buf.snap(); ta.value = splitNote(v.text).body; ta.dispatchEvent(new Event('input', { bubbles: true }));
        hist.hidden = true; ta.focus();
      });
      document.getElementById('fe-hist-back')!.addEventListener('click', () => renderView());
    } catch (err) { hist.textContent = errorText(err, 'Reading that version'); }
  };
  document.getElementById('fe-ed-bar')!.querySelectorAll<HTMLElement>('[data-act]').forEach(b =>
    b.addEventListener('mousedown', e => { e.preventDefault(); act(b.dataset.act!); }));

  // Images: paste, drop, or the file button. Stored beside the note under
  // attachments/ and referenced by relative path, per the contract.
  const addImage = async (file: File) => {
    const st = edit; if (!st || st.root !== root) return;
    const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    const rel = `attachments/${slugForTitle(noteTitle(st.rel, st.text)).replace(/\.md$/, '')}-${Date.now().toString(36)}.${ext}`;
    const b64 = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.readAsDataURL(file); });
    try {
      await notes.writeBinary(root, rel, b64);
      const depth = st.rel.split('/').length - 1;
      buf.insert(`![${file.name.replace(/\.[^.]+$/, '')}](${'../'.repeat(depth)}${rel})`);
    } catch (err) { editHeader(errorText(err, 'Adding the image')); }
  };
  const imageFiles = (dt: DataTransfer | null) => [...(dt?.files ?? [])].filter(f => f.type.startsWith('image/'));
  ta.addEventListener('paste', e => { const fs = imageFiles(e.clipboardData); if (fs.length) { e.preventDefault(); fs.forEach(f => void addImage(f)); } });
  ta.addEventListener('drop', e => { const fs = imageFiles(e.dataTransfer); if (fs.length) { e.preventDefault(); fs.forEach(f => void addImage(f)); } });
  ta.addEventListener('dragover', e => e.preventDefault());
  (document.getElementById('fe-ed-file') as HTMLInputElement).addEventListener('change', function () {
    [...(this.files ?? [])].forEach(f => void addImage(f)); this.value = '';
  });
  const renderView = () => { view.innerHTML = renderMarkdown(ta.value, nameEl.href); };
  renderView();
  // a note edited in two places: keep one side or both (owner ruling N1)
  const showClash = () => {
    document.getElementById('fe-ed-clash')?.remove();
    const sides = clashSides(ta.value);
    if (!sides) return;
    document.getElementById('fe-ql-body')!.insertAdjacentHTML('afterbegin',
      `<div id="fe-ed-clash" class="notice fe-ql-note">Two versions, keep: `
      + `<button class="btn" data-keep="first">${UI_ICON.files}<span>${esc(sides[0])}</span></button> `
      + `<button class="btn" data-keep="second">${UI_ICON.files}<span>${esc(sides[1])}</span></button> `
      + `<button class="btn" data-keep="both">${UI_ICON.notes}<span>both</span></button></div>`);
    document.querySelectorAll<HTMLButtonElement>('#fe-ed-clash [data-keep]').forEach(b => b.addEventListener('click', () => {
      ta.value = settleClash(ta.value, b.dataset.keep as Keep);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      void saveNote();
    }));
  };
  showClash();
  let viewTimer: ReturnType<typeof setTimeout> | null = null;
  // The marker Enter just put on a new list line; a person typing the same marker over it is folded into it.
  let autoMarker: AutoMarker | null = null;
  ta.addEventListener('input', () => {
    if (!edit) return;
    if (autoMarker) {
      const fix = absorbTypedMarker(ta.value, sel(), autoMarker);
      if (fix) { autoMarker = null; apply(fix); return; }
      const typed = ta.value.slice(autoMarker.lineStart + autoMarker.prefix.length, ta.selectionStart);
      if (!ta.value.startsWith(autoMarker.prefix, autoMarker.lineStart) || ta.selectionStart < autoMarker.lineStart + autoMarker.prefix.length || !/^[-*+\d.)[\] xX]*$/.test(typed)) autoMarker = null;
    }
    if (!!document.getElementById('fe-ed-clash') !== !!clashSides(ta.value)) showClash();
    edit.text = edit.head + ta.value; edit.dirty = true; edit.version++; currentText = edit.text;
    editHeader('unsaved');
    if (viewTimer) clearTimeout(viewTimer);
    viewTimer = setTimeout(renderView, 120);
    if (edit.timer) clearTimeout(edit.timer);
    edit.timer = setTimeout(() => void saveNote(), 1500);
  });
  ta.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && k === 's') { stop(); void saveNote(); }
    else if (e.key === 'Escape') { stop(); closePreview(); }
    else if (mod && !e.shiftKey && k === 'b') { stop(); act('bold'); }
    else if (mod && !e.shiftKey && k === 'i') { stop(); act('italic'); }
    else if (mod && !e.shiftKey && k === 'e') { stop(); act('code'); }
    else if (mod && !e.shiftKey && k === 'k') { stop(); act('link'); }
    else if (mod && e.shiftKey && k === 'x') { stop(); act('strike'); }
    else if (mod && e.shiftKey && k === 'h') { stop(); act('heading'); }
    else if (mod && e.shiftKey && (k === '.' || k === '>')) { stop(); act('quote'); }
    else if (mod && e.shiftKey && (k === '7' || k === '&')) { stop(); act('olist'); }
    else if (mod && e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && actions) {
      stop(); actions.step(edit!.rel, e.key === 'ArrowDown' ? 1 : -1);
    }
    else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      stop();
      apply(e.shiftKey ? duplicateLines(ta.value, sel()) : moveLines(ta.value, sel(), e.key === 'ArrowDown' ? 1 : -1));
    }
    else if (e.key === 'Tab') { stop(); apply(indentLines(ta.value, sel(), e.shiftKey)); }
    else if (e.key === 'Enter' && !mod && !e.shiftKey) {
      const r = continueList(ta.value, sel());
      if (r) { stop(); apply(r); autoMarker = autoMarkerAfter(r); }
    }
  });
  // The chip row above the text: title, pin, colour, tags. Each change edits only its own line of the properties block.
  const st = edit;
  const change = (fn: (head: string) => string, keys: string[]): boolean => {
    if (/^<{7} /m.test(st.text)) { editHeader('settle the two versions before changing properties'); return false; }
    st.head = fn(st.head);
    keys.forEach(k => st.touched.add(k));
    st.text = st.head + ta.value; st.dirty = true; st.version++; currentText = st.text;
    editHeader('unsaved');
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => void saveNote(), 1500);
    return true;
  };
  st.redrawMeta = mountMetaBar(document.getElementById('fe-ed-meta')!, {
    props: () => readProps(st.rel, st.text),
    untitled: () => !st.head && !ta.value.trim(),
    // A note with a properties block keeps its title there; one without keeps it
    // as its first line, so the chip writes the heading line in the text.
    setTitle: v => {
      if (st.head) { change(h => setField(h, 'title', JSON.stringify(v)), ['title']); st.redrawMeta?.(); return; }
      const next = setFirstLine(ta.value, v) ?? `# ${v}\n\n`;
      apply({ text: next, start: next.length, end: next.length });
      st.redrawMeta?.();
    },
    apply: c => { change(h => applyChange(h, c), changedKeys(c)); return readProps(st.rel, st.text); },
  });
  editHeader('saved');
  // Open at the top, where the render starts; focusing alone leaves the caret
  // and the scroll at the end of a long note.
  ta.setSelectionRange(0, 0);
  ta.focus();
  ta.scrollTop = 0;
}
async function saveNote(st = edit): Promise<void> {
  if (!st || st.saving) return;
  if (st.timer) { clearTimeout(st.timer); st.timer = null; }
  st.saving = true;
  const version = st.version;
  let text = stampUpdated(st.text);
  // Guard: the saved properties block must equal what was read, apart from fields set through the chips.
  // A pasted --- block at the top of a note without properties would otherwise be read as properties.
  if (frontmatterDrift(st.base, text, st.touched).length) {
    if (st.ta && !st.head) {
      st.ta.value = '\n' + st.ta.value;
      st.text = st.head + st.ta.value;
      text = stampUpdated(st.text);
    }
    if (frontmatterDrift(st.base, text, st.touched).length) {
      st.saving = false;
      if (edit === st) editHeader('not saved: this would change the note properties');
      return;
    }
  }
  let wrote = false;
  try {
    const r = await notes.write(st.root, st.rel, text, st.mtime);
    wrote = true;
    st.mtime = r.mtime; st.dirty = st.version !== version; st.base = text;
    // A note created as "untitled-…" takes its title as file name on first save.
    const want = slugForTitle(noteTitle(st.rel, st.text));
    if (/^untitled-/.test(st.rel.split('/').pop()!) && !/^untitled/.test(want)) {
      const to = st.rel.replace(/[^/]+$/, want);
      try { await notes.rename(st.root, st.rel, to); st.rel = to; } catch { /* keep the old name */ }
    }
    if (edit === st) { editHeader(st.dirty ? 'unsaved' : 'saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); st.redrawMeta?.(); }
    st.onSaved?.(st.rel);
  } catch (err) {
    const e = err as NotesError;
    if (edit === st) {
      editHeader(e.code === 'notes_conflict' ? 'changed on disk, not saved' : errorText(e, 'Saving'));
      if (e.code === 'notes_conflict') {
        const body = document.getElementById('fe-ql-body')!;
        if (!document.getElementById('fe-ed-conflict')) {
          body.insertAdjacentHTML('afterbegin',
            `<div id="fe-ed-conflict" class="notice fe-ql-note" data-tone="danger">Another program changed this note. <button id="fe-ed-reload" class="btn" title="Replace the editor text with the file on disk">Reload from disk</button> <button id="fe-ed-force" class="btn" title="Write the editor text over the disk copy">Overwrite</button></div>`);
          document.getElementById('fe-ed-reload')!.addEventListener('click', () => {
            notes.read(st.root, st.rel).then(d => openNote(st.root, d, st.onSaved, st.actions));
          });
          document.getElementById('fe-ed-force')!.addEventListener('click', () => {
            st.mtime = 0 as unknown as number;
            notes.read(st.root, st.rel).then(d => { st.mtime = d.mtime; document.getElementById('fe-ed-conflict')?.remove(); void saveNote(); });
          });
        }
      }
    } else deps.saveError?.(errorText(e, 'Saving the note'));
  } finally {
    st.saving = false;
    if (wrote && st.dirty) void saveNote(st);
  }
}

export function openPreview(e: Entry): void {
  if (!canPreview(e)) return;
  if (edit) { if (edit.timer) clearTimeout(edit.timer); if (edit.dirty) void saveNote(); edit = null; }
  document.getElementById('fe-ql-body')!.classList.remove('fe-editing');
  closePropsMenu();
  currentEntry = e;
  const seq = ++reqSeq;
  const ext = getExt(e);

  document.getElementById('fe-ql-icon')!.innerHTML = getIcon(e, deps.iconRules());
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.hidden = false;
  nameEl.textContent = e.name;
  nameEl.href = e.href;
  document.getElementById('fe-ql-meta')!.textContent =
    [kindName(ext), e.rawBytes >= 0 ? fmtSize(e.rawBytes) : ''].filter(Boolean).join(' · ');
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = e.href;
  const body = document.getElementById('fe-ql-body')!;
  if (overlay.style.display === 'none') rememberFocus();
  overlay.style.display = 'flex';
  deps.dockRoom?.(layout.mode === 'side');
  if (layout.mode !== 'side') raise(overlay);
  syncSaveBtn();
  dsvHeader = []; dsvRows = []; dsvSort = null;
  currentText = null;
  currentImage = null;
  resetAiUi();
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.disabled = true;

  if (IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext)) {
    copyBtn.style.display = 'none';   // binary media: rendered from file://, no text; images still take Ask
    if (IMG_EXTS.has(ext)) {
      currentImage = decodeURIComponent(new URL(e.href, location.href).pathname);
      setupAi(e, 'image');
      body.innerHTML = '<div class="fe-ql-imgwrap"></div>';
      mountImageTools(body.querySelector<HTMLElement>('.fe-ql-imgwrap')!, {
        href: e.href, name: e.name,
        path: decodeURIComponent(new URL(e.href, location.href).pathname),
        notify: m => deps.toast?.(m),
        // the Ghostty host also opens a file in its default app; a missing host answers not-ok
        openNative: p => new Promise(res => chrome.runtime.sendMessage(
          { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_file', path: p } },
          r => res(!chrome.runtime.lastError && !!r?.ok && r.response?.success === true))),
      });
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
        <div class="notice fe-ql-note">This file is ${fmtSize(e.rawBytes)}, so it may render slowly.</div>
        <button id="fe-ql-force" class="btn" title="Render despite the size">Load anyway</button>
      </div>`;
    document.getElementById('fe-ql-force')!.addEventListener('click', () => fetchAndRender(e, ext, seq));
    return;
  }

  fetchAndRender(e, ext, seq);
}

function fetchAndRender(e: Entry, ext: string, seq: number): void {
  const body = document.getElementById('fe-ql-body')!;
  body.innerHTML = `<div class="fe-ql-center"><div class="notice fe-ql-note">Loading…</div></div>`;
  fetchFileText(e.href)
    .then(text => {
      if (seq !== reqSeq) return;
      currentText = text;
      (document.getElementById('fe-ql-copy') as HTMLButtonElement).disabled = false;
      document.getElementById('fe-ql-meta')!.textContent = metaSummary(fileMeta(text, ext, e.href, e.rawBytes >= 0 ? e.rawBytes : undefined));
      render(text, ext);
    })
    .catch(err => {
      if (seq !== reqSeq) return;
      console.error('[BFB] preview failed:', e.href, err);
      const stale = err instanceof FileFetchError && err.code === 'context-invalidated';
      body.innerHTML = stale
        ? `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">The extension was reloaded; this page needs a refresh.</div><button id="fe-ql-retry" class="btn" title="Reload this page">Refresh page</button></div>`
        : `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">Could not read file.</div><button id="fe-ql-retry" class="btn" title="Try reading the file again">Retry</button></div>`;
      document.getElementById('fe-ql-retry')!.addEventListener('click', () => {
        if (stale) reload(); else fetchAndRender(e, ext, seq);
      });
    });
}

function render(text: string, ext: string): void {
  const body = document.getElementById('fe-ql-body')!;
  const note = unrenderableNote(text);
  if (note) {
    if (sniffBinary(text)) { aiOn = false; syncAiBar(); }   // nothing for a model to read
    body.innerHTML = `<div class="fe-ql-center">${note}</div>`;
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
    body.innerHTML = `<div class="fe-ql-center">${unrenderableNote('')}</div>`;
    return;
  }
  // HTML runs live here, with a Source toggle; everything else is the file page's renderer.
  if (formatFor(ext)?.id === 'html') { renderHtml(body, text); return; }
  body.innerHTML = renderFile(text, ext, currentEntry?.href ?? '', 'preview');
  // Links leave the explorer in place: every one opens a new tab.
  body.querySelectorAll<HTMLAnchorElement>('.fe-md a[href]:not(.fe-md-anchor)').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  restoreScroll(body);
}
// HTML previews as the page it describes: the frame loads the file itself, so
// its relative images, styles and scripts resolve as they would opened
// directly. A sandboxed srcdoc copy cannot do that: its opaque origin is
// refused every file:// image. Each file:// file is its own origin in Chrome,
// so the page still cannot reach the explorer around it. Source flips to the
// highlighted markup, and the choice holds for the next HTML file.
let htmlSource = false;
function renderHtml(body: HTMLElement, text: string): void {
  const btn = (v: 'page' | 'src', label: string, on: boolean) =>
    `<button class="btn${on ? ' on' : ''}" data-v="${v}" title="${v === 'page' ? 'Show the rendered page' : 'Show the HTML source'}">${label}</button>`;
  body.innerHTML = `<div class="bar fe-ql-htmlbar">${btn('page', 'Page', !htmlSource)}${btn('src', 'Source', htmlSource)}</div>`
    + (htmlSource ? renderCode(text, 'html') : '<iframe class="fe-ql-html" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>');
  const frame = body.querySelector<HTMLIFrameElement>('iframe.fe-ql-html');
  if (frame && currentEntry) frame.src = currentEntry.href;
  body.querySelectorAll<HTMLButtonElement>('.fe-ql-htmlbar button').forEach(b => b.addEventListener('click', () => {
    htmlSource = b.dataset.v === 'src';
    renderHtml(body, text);
  }));
}
function restoreScroll(body: HTMLElement): void {
  const top = currentEntry ? scrollMemo.get(currentEntry.href) : undefined;
  if (top) body.scrollTop = top;
}
