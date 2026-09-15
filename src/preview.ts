// Quick Look overlay — macOS-style file preview inside the explorer.
// Fetches file:// content over XHR (the same trick the crumb dropdown uses)
// and hands it to a renderer picked by extension. No new permissions needed.
import type { Entry, IconRule, PreviewLayout } from './types';
import { esc, fmtSize, getExt, copyToClipboard } from './utils';
import { getPreviewLayout, savePreviewLayout } from './storage';
import { rememberFocus, restoreFocus } from './dialog';
import { getIcon, IMG_EXTS } from './icons';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderJsonTree, renderJsonl, renderMarkdown,
  parseDSV, numericCols, sortDSVRows, renderDSVTable,
  sniffBinary,
} from './renderers';
import { fetchFileText, FileFetchError } from './file-fetch';
import { notes, NotesError, noteTitle, stampUpdated, slugForTitle, type NoteDoc } from './notes';
import {
  attachBuffer, moveLines, duplicateLines, indentLines, continueList, wrapSelection, tableSnippet, type TextEdit,
} from './editor';
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
let layout: PreviewLayout = getPreviewLayout();
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
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open natively in a new tab (⌘-click / middle-click also work)"></a>
        <span id="fe-ql-meta"></span>
        <button id="fe-ql-copy" title="Copy full file contents to clipboard" disabled>
          <svg width="11" height="12" viewBox="0 0 11 12"><rect x="3" y="3" width="7" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1 1h6v1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
          <span>copy</span>
        </button>
        <a id="fe-ql-open" target="_blank" rel="noopener" title="Open raw file in a new tab">open raw ↗</a>
        <button id="fe-ql-dock" title="Dock the preview to the side">
          <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1.5" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.5v10" stroke="currentColor" stroke-width="1.3"/></svg>
        </button>
        <button id="fe-ql-close" title="Close (Esc)">✕</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
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
  document.getElementById('fe-ql-dock')!.addEventListener('click', () => {
    layout = { ...layout, mode: layout.mode === 'side' ? 'modal' : 'side' };
    savePreviewLayout(layout);
    applyLayout();
  });
  applyLayout();

  // Corner grip (modal) sets the dialog's size; left-edge grip (side) sets
  // the panel width. Same mousedown/move/up shape as the column resizers.
  const dialog = document.getElementById('fe-ql-dialog')!;
  const drag = (grip: HTMLElement, onMove: (e: MouseEvent) => void, onUp: () => void) => {
    grip.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const move = (ev: MouseEvent) => onMove(ev);
      const up = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        document.body.style.cursor = '';
        onUp();
        savePreviewLayout(layout);
      };
      document.body.style.cursor = getComputedStyle(grip).cursor;
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  };
  drag(document.getElementById('fe-ql-rz')!, ev => {
    const r = dialog.getBoundingClientRect();
    layout.modalW = Math.min(window.innerWidth - r.left - 8, Math.max(360, ev.clientX - r.left));
    layout.modalH = Math.min(window.innerHeight - r.top - 8, Math.max(240, ev.clientY - r.top));
    applyLayout();
  }, () => {});
  drag(document.getElementById('fe-ql-rz-side')!, ev => {
    const r = overlay.getBoundingClientRect();
    layout.sideW = Math.min(window.innerWidth * 0.8, Math.max(280, r.right - ev.clientX));
    applyLayout();
  }, () => {});

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

export function isPreviewDocked(): boolean {
  return layout.mode === 'side';
}

// Modal: a fixed overlay under #fe with a scrim. Side: the same element moved
// into #fe-body as a flex sibling of the listing, no scrim, owner-set width.
function applyLayout(): void {
  const dialog = document.getElementById('fe-ql-dialog')!;
  const side = layout.mode === 'side';
  overlay.classList.toggle('side', side);
  const host = side ? document.getElementById('fe-body') : document.getElementById('fe');
  if (host && overlay.parentElement !== host) host.appendChild(overlay);
  overlay.style.width = side && layout.sideW ? layout.sideW + 'px' : '';
  dialog.style.width  = !side && layout.modalW ? layout.modalW + 'px' : '';
  dialog.style.height = !side && layout.modalH ? layout.modalH + 'px' : '';
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

// ── Note editor: the same panel, a textarea beside the render ─────────
interface EditState {
  root: string; rel: string; mtime: number; text: string;
  dirty: boolean; saving: boolean; timer: ReturnType<typeof setTimeout> | null;
  onSaved?: (rel: string) => void;
}
let edit: EditState | null = null;

export function isEditing(): boolean { return !!edit; }

function editHeader(status: string): void {
  if (!edit) return;
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.textContent = (edit.dirty ? '● ' : '') + noteTitle(edit.rel, edit.text);
  document.getElementById('fe-ql-meta')!.textContent = `${edit.rel} · ${status}`;
}

const stripFrontMatter = (t: string) => t.replace(/^---\n[\s\S]*?\n---\n?/, '');

export function openNote(root: string, doc: NoteDoc, onSaved?: (rel: string) => void): void {
  if (edit && edit.dirty) void saveNote();
  currentEntry = null; reqSeq++;
  edit = { root, rel: doc.rel, mtime: doc.mtime, text: doc.text, dirty: false, saving: false, timer: null, onSaved };
  currentText = doc.text;
  document.getElementById('fe-ql-icon')!.innerHTML = '';
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.href = 'file://' + root.replace(/\/$/, '') + '/' + doc.rel;
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = nameEl.href;
  resetAiUi();
  document.getElementById('fe-ql-ai')!.style.display = 'none';
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.style.display = ''; copyBtn.disabled = false;
  if (overlay.style.display === 'none') rememberFocus();
  overlay.style.display = 'flex';

  const body = document.getElementById('fe-ql-body')!;
  body.classList.add('fe-editing');
  body.innerHTML = `
    <div id="fe-ed-bar">
      <button class="fe-pbn" data-act="bold" title="Bold (⌘B)"><b>B</b></button>
      <button class="fe-pbn" data-act="italic" title="Italic (⌘I)"><i>I</i></button>
      <button class="fe-pbn" data-act="code" title="Code (⌘E)">‹›</button>
      <button class="fe-pbn" data-act="list" title="Bullet list">• list</button>
      <button class="fe-pbn" data-act="task" title="Task list">☐ task</button>
      <button class="fe-pbn" data-act="table" title="Insert a table">table</button>
      <button class="fe-pbn" data-act="image" title="Insert an image (or paste / drop one)">image</button>
      <input type="file" id="fe-ed-file" accept="image/*" style="display:none">
      <span class="fe-ed-hint">⌥↑↓ move line · ⌥⇧↑↓ duplicate · ⇥ indent · Enter continues lists</span>
    </div>
    <div class="fe-ed"><textarea id="fe-ed-src" spellcheck="true"></textarea><div id="fe-ed-view" class="fe-md"></div></div>`;
  const ta = document.getElementById('fe-ed-src') as HTMLTextAreaElement;
  const view = document.getElementById('fe-ed-view')!;
  ta.value = doc.text;
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
    if (name === 'list')   prefixLines('- ');
    if (name === 'task')   prefixLines('- [ ] ');
    if (name === 'table')  buf.insert((ta.value.slice(0, ta.selectionStart).endsWith('\n') || !ta.selectionStart ? '' : '\n') + tableSnippet());
    if (name === 'image')  (document.getElementById('fe-ed-file') as HTMLInputElement).click();
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
    } catch (err) { editHeader(`image failed: ${(err as NotesError).message}`); }
  };
  const imageFiles = (dt: DataTransfer | null) => [...(dt?.files ?? [])].filter(f => f.type.startsWith('image/'));
  ta.addEventListener('paste', e => { const fs = imageFiles(e.clipboardData); if (fs.length) { e.preventDefault(); fs.forEach(f => void addImage(f)); } });
  ta.addEventListener('drop', e => { const fs = imageFiles(e.dataTransfer); if (fs.length) { e.preventDefault(); fs.forEach(f => void addImage(f)); } });
  ta.addEventListener('dragover', e => e.preventDefault());
  (document.getElementById('fe-ed-file') as HTMLInputElement).addEventListener('change', function () {
    [...(this.files ?? [])].forEach(f => void addImage(f)); this.value = '';
  });
  const renderView = () => { view.innerHTML = renderMarkdown(stripFrontMatter(ta.value), nameEl.href); };
  renderView();
  let viewTimer: ReturnType<typeof setTimeout> | null = null;
  ta.addEventListener('input', () => {
    if (!edit) return;
    edit.text = ta.value; edit.dirty = true; currentText = ta.value;
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
    else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      stop();
      apply(e.shiftKey ? duplicateLines(ta.value, sel()) : moveLines(ta.value, sel(), e.key === 'ArrowDown' ? 1 : -1));
    }
    else if (e.key === 'Tab') { stop(); apply(indentLines(ta.value, sel(), e.shiftKey)); }
    else if (e.key === 'Enter' && !mod && !e.shiftKey) {
      const r = continueList(ta.value, sel());
      if (r) { stop(); apply(r); }
    }
  });
  editHeader('saved');
  ta.focus();
}
async function saveNote(): Promise<void> {
  const st = edit;
  if (!st || st.saving) return;
  if (st.timer) { clearTimeout(st.timer); st.timer = null; }
  st.saving = true;
  const text = stampUpdated(st.text);
  try {
    const r = await notes.write(st.root, st.rel, text, st.mtime);
    st.mtime = r.mtime; st.dirty = false;
    // A note created as "untitled-…" takes its title as file name on first save.
    const want = slugForTitle(noteTitle(st.rel, st.text));
    if (/^untitled-/.test(st.rel.split('/').pop()!) && !/^untitled/.test(want)) {
      const to = st.rel.replace(/[^/]+$/, want);
      try { await notes.rename(st.root, st.rel, to); st.rel = to; } catch { /* keep the old name */ }
    }
    if (edit === st) editHeader('saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    st.onSaved?.(st.rel);
  } catch (err) {
    const e = err as NotesError;
    if (edit === st) {
      editHeader(e.code === 'notes_conflict' ? 'changed on disk, not saved' : `save failed: ${e.message}`);
      if (e.code === 'notes_conflict') {
        const body = document.getElementById('fe-ql-body')!;
        if (!document.getElementById('fe-ed-conflict')) {
          body.insertAdjacentHTML('afterbegin',
            `<div id="fe-ed-conflict" class="fe-ql-note err">Another program changed this note. <button id="fe-ed-reload" class="fe-pbn">Reload from disk</button> <button id="fe-ed-force" class="fe-pbn">Overwrite</button></div>`);
          document.getElementById('fe-ed-reload')!.addEventListener('click', () => {
            notes.read(st.root, st.rel).then(d => openNote(st.root, d, st.onSaved));
          });
          document.getElementById('fe-ed-force')!.addEventListener('click', () => {
            st.mtime = 0 as unknown as number;
            notes.read(st.root, st.rel).then(d => { st.mtime = d.mtime; document.getElementById('fe-ed-conflict')?.remove(); void saveNote(); });
          });
        }
      }
    }
  } finally {
    st.saving = false;
  }
}

export function openPreview(e: Entry): void {
  if (!canPreview(e)) return;
  if (edit) { if (edit.timer) clearTimeout(edit.timer); if (edit.dirty) void saveNote(); edit = null; }
  document.getElementById('fe-ql-body')!.classList.remove('fe-editing');
  currentEntry = e;
  const seq = ++reqSeq;
  const ext = getExt(e);

  document.getElementById('fe-ql-icon')!.innerHTML = getIcon(e, deps.iconRules());
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.textContent = e.name;
  nameEl.href = e.href;
  document.getElementById('fe-ql-meta')!.textContent =
    `${fmtSize(e.rawBytes)}${ext ? ' · .' + ext : ''}`;
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = e.href;
  const body = document.getElementById('fe-ql-body')!;
  if (overlay.style.display === 'none') rememberFocus();
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
      const stale = err instanceof FileFetchError && err.code === 'context-invalidated';
      body.innerHTML = stale
        ? `<div class="fe-ql-center"><div class="fe-ql-note err">The extension was reloaded; this page needs a refresh.</div><button id="fe-ql-retry" class="fe-pbn">Refresh page</button></div>`
        : `<div class="fe-ql-center"><div class="fe-ql-note err">Could not read file.</div><button id="fe-ql-retry" class="fe-pbn">Retry</button></div>`;
      document.getElementById('fe-ql-retry')!.addEventListener('click', () => {
        if (stale) location.reload(); else fetchAndRender(e, ext, seq);
      });
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
    // Links leave the explorer in place: every one opens a new tab.
    body.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
    return;
  }
  body.innerHTML = renderCode(text, ext);
}
