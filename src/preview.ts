// Quick Look overlay — macOS-style file preview inside the explorer.
// Fetches file:// content over XHR (the same trick the crumb dropdown uses)
// and hands it to a renderer picked by extension. No new permissions needed.
import { resizable } from './resize';
import type { Entry, IconRule, PreviewLayout } from './types';
import { esc, fmtSize, getExt, copyToClipboard, fileHref, whenText } from './utils';
import { copyWithCheck } from './copy-done';
import { getPreviewLayout, savePreviewLayout, getSettings, isSaved, toggleSavedWithUndo, flagPref, textPref } from './storage';
import { openSplitHtml, openWithMenu, parseCommands } from './open-with';
import type { Toast } from './toast';
import { rememberFocus, restoreFocus } from './dialog';
import { raise, lower, focusTrap } from './layer';
import { getIcon, IMG_EXTS, PI } from './icons';
import { UI_ICON, GLYPH } from './control-icons';
import { SIZE_BTN, wireSize } from './panel-size';
import { fileMeta, kindName, metaSummary } from './file-meta';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, renderMarkdown,
  parseDSV, numericCols, sortDSVRows, renderDSVTable,
  sniffBinary, unrenderableNote,
} from './renderers';
import { fetchFileText, FileFetchError } from './file-fetch';
import { hasClash, isoNow } from './notefmt';
import { formatButtons, fileButtons, wireBar, formatEdit, formatKey, tableAt, mountVersions, wirePictures } from './note-tools';
import { notes, NotesError, noteTitle, stampUpdated, slugForTitle, settleClash, clashSides, splitNote, readProps, setField, setFirstLine, applyChange, changedKeys, frontmatterDrift, type Keep, type NoteDoc } from './notes';
import { mountMetaBar, closePropsMenu } from './note-meta-ui';
import { mountImageTools } from './image-tools';
import {
  attachBuffer, moveLines, duplicateLines, indentLines, continueList, absorbTypedMarker, autoMarkerAfter, type AutoMarker, type TextEdit,
  diffText, mapCaret,
} from './editor';
import { watch } from './watch';
import { lineDiffHtml } from './line-diff';
import { emptyHtml } from './empty-state';
import { go, reload } from './nav';
import { errorText } from './errors';
import { morphInto } from './morph-view';
import { formatFor, renderFile } from './formats';

const FETCH_WARN_BYTES = 8 * 1024 * 1024;

// Media types rendered straight from file:// (like images): no fetch, no text
// copy, no AI bar. Only formats Chrome plays/renders natively are claimed.
const PDF_EXTS   = new Set(['pdf']);
export const VIDEO_EXTS = new Set(['mp4', 'm4v', 'webm', 'ogv', 'mov']);
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
  askAbout?: (e: Entry) => void;   // hand a file to the sidebar's Ask
  keepTab?:  (path: string) => void;     // keep the previewed file as a background strip tab
  saveError?: (message: string) => void;
  toast?: Toast;
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
/** Hand a file to its default app. The Ghostty host does this too; a missing host answers not-ok. */
const openNative = (path: string) => new Promise<boolean>(res => chrome.runtime.sendMessage(
  { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_file', path } },
  r => res(!chrome.runtime.lastError && !!r?.ok && r.response?.success === true)));

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
// Ask about a row from its menu, in the sidebar.
export function askAbout(e: Entry): void { deps.askAbout?.(e); }
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
        <a id="fe-ql-name" target="_blank" rel="noopener" title="Open in a new tab"></a>
        <span id="fe-ql-meta"></span>
        <span id="fe-ql-modes" class="fe-seg" role="group" aria-label="View" hidden></span>
        <button id="fe-ql-copy" class="btn" data-icon title="Copy the file" aria-label="Copy the file" disabled>${GLYPH.copySmall}</button>
        <a id="fe-ql-open" class="btn" data-icon target="_blank" rel="noopener" title="The raw file, in a new tab" aria-label="The raw file, in a new tab">${UI_ICON.file}</a>
        <button id="fe-ql-go" class="btn" data-icon title="Open in this tab (Enter)" aria-label="Open in this tab">${UI_ICON.files}</button>
        <button id="fe-ql-tab" class="btn" data-icon title="Keep as a strip tab (t)" aria-label="Keep as a strip tab">${UI_ICON.tab}</button>
        <span id="fe-ql-app-group">
          <span class="bar-sep" aria-hidden="true"></span>
          ${openSplitHtml('id="fe-ql-app"', 'id="fe-ql-app-more"')}
        </span>
        <span class="bar-sep" aria-hidden="true"></span>
        <button id="fe-ql-rename" class="btn" data-icon title="Rename this file (F2 in the list)">${UI_ICON.rename}</button>
        <button id="fe-ql-save" class="btn" data-icon title="Save this file">${PI.bm}</button>
        <button id="fe-ql-term" class="btn" data-icon title="Open its folder in the terminal">${UI_ICON.terminal}</button>
        <button id="fe-ql-ai-btn" class="btn" data-icon title="Ask about this file in the sidebar (a)" hidden>${UI_ICON.ai}</button>
        <span class="bar-sep" aria-hidden="true"></span>
        ${SIZE_BTN('fe-ql-size')}
        <button id="fe-ql-dock" class="btn" data-icon title="Dock the preview to the side">
          ${GLYPH.dock}
        </button>
        <button id="fe-ql-close" class="btn" data-icon title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div id="fe-ql-rz" title="Drag to resize"></div>
      <div id="fe-ql-rz-side" title="Drag to resize"></div>
      <div id="fe-ql-body"></div>
    </div>`;
  document.getElementById('fe')!.appendChild(overlay);

  document.getElementById('fe-ql-close')!.addEventListener('click', closePreview);
  document.getElementById('fe-ql-go')!.addEventListener('click', () => {
    if (currentEntry) go(currentEntry.href);
    else if (edit) go(fileHref(edit.root.replace(/\/$/, '') + '/' + edit.rel));
  });
  document.getElementById('fe-ql-tab')!.addEventListener('click', keepPreviewedAsTab);
  document.getElementById('fe-ql-app')!.addEventListener('click', () => {
    const p = previewedPath();
    if (p) void openNative(p).then(ok => { if (!ok) deps.toast?.('Open in app needs the native host: run native/install.sh'); });
  });
  document.getElementById('fe-ql-app-more')!.addEventListener('click', e => {
    const p = previewedPath();
    if (p) openWithMenu(e.currentTarget as HTMLElement, p, false, parseCommands(getSettings().openWithCmds), m => deps.toast?.(m));
  });
  document.getElementById('fe-ql-save')!.addEventListener('click', () => {
    const p = previewedPath();
    if (!p) return;
    toggleSavedWithUndo(p, p.split('/').pop() || p, deps.toast ?? (() => {}), () => { syncSaveBtn(); deps.savedChanged?.(); });
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
  focusTrap(overlay, { when: () => !isPreviewDocked() });

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
    void copyWithCheck(copyBtn, currentText).then(ok => { if (!ok) deps.toast?.('Copy failed'); });
  });

  document.getElementById('fe-ql-ai-btn')!.addEventListener('click', askInPreview);

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
  return layout.mode === 'side' || !!galleryHost;
}

// The Gallery view holds the preview in its stage above the thumbnails. While
// it does, the panel is part of the page: it never floats, folds the sidebar
// or closes on Esc, and follows the selected thumbnail.
let galleryHost: HTMLElement | null = null;
/** Put the preview in a gallery stage, or give it back to its own layout with null. */
export function setPreviewHost(host: HTMLElement | null): void {
  galleryHost = host;
  if (overlay) applyLayout();
}
/** Whether the preview lives in the Gallery view's stage. */
export function isPreviewInGallery(): boolean { return !!galleryHost; }

// Modal: a fixed overlay under #fe with a scrim. Side: the same element moved
// into #fe-body as a flex sibling of the listing, no scrim, owner-set width.
function applyLayout(): void {
  const dialog = document.getElementById('fe-ql-dialog')!;
  const side = layout.mode === 'side' || !!galleryHost;
  overlay.classList.toggle('side', side);
  overlay.classList.toggle('gal', !!galleryHost);
  dialog.toggleAttribute('data-dock', side);
  // Docked, the header's text buttons show their icon alone; their title names them.
  overlay.querySelectorAll<HTMLElement>('#fe-ql-hdr > .btn').forEach(b => {
    if (!b.querySelector(':scope > span')) return;
    if (side) { b.dataset.icon = ''; b.dataset.dockIcon = ''; }
    else if ('dockIcon' in b.dataset) { delete b.dataset.icon; delete b.dataset.dockIcon; }
  });
  const host = galleryHost ?? (side ? document.getElementById('fe-body') : document.getElementById('fe'));
  if (host && overlay.parentElement !== host) host.appendChild(overlay);
  // Remembered sizes are pixels from a wider window; cap them by the window
  // now, so a narrower window keeps room for the listing and the close button.
  overlay.style.width = side && !galleryHost && layout.sideW ? `min(${layout.sideW}px, max(280px, calc(100vw - 600px)))` : '';
  // Large and extra large take their size from the window, not the grip.
  const own = !side && !dialog.dataset.size;
  dialog.style.width  = own && layout.modalW ? `min(${layout.modalW}px, calc(100vw - 16px))` : '';
  dialog.style.height = own && layout.modalH ? `min(${layout.modalH}px, calc(100vh - 16px))` : '';
  // Floating, it stacks with the other floating parts; docked, it is part of the page.
  if (side) lower(overlay);
  else if (overlay.style.display !== 'none') raise(overlay);
  if (overlay.style.display !== 'none') deps.dockRoom?.(side && !galleryHost);
  const dock = document.getElementById('fe-ql-dock')!;
  dock.title = side ? 'Float the preview as a window' : 'Dock the preview to the side';
  dock.classList.toggle('on', side);
}

export function closePreview(): void {
  if (galleryHost && overlay.style.display !== 'none') return;
  if (edit) {
    // A note in conflict stays open: closing would throw away the words on screen.
    const clash = document.getElementById('fe-ed-conflict');
    if (clash) {
      clash.classList.add('flash');
      setTimeout(() => clash.classList.remove('flash'), 700);
      deps.toast?.('Choose one first.');
      return;
    }
    // Leaving the editor flushes a pending autosave; the write completes
    // after the panel is gone and the sidebar refreshes from its callback.
    if (edit.timer) clearTimeout(edit.timer);
    if (edit.dirty) void saveNote();
    leaveNote(edit);
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
}

// Hands the file in the panel to the sidebar's Ask. A floating panel would cover the sidebar, so it docks first.
export function askInPreview(): boolean {
  if (!currentEntry || !canAsk(currentEntry)) return false;
  if (layout.mode !== 'side' && !galleryHost) document.getElementById('fe-ql-dock')?.click();
  deps.askAbout?.(currentEntry);
  return true;
}

// ── Note editor: the same panel, a textarea beside the render ─────────
interface EditState {
  root: string; rel: string; mtime: number; text: string;
  // text is always head + the editor's text: the properties block is never in the textarea
  head: string; base: string; touched: Set<string>; ta?: HTMLTextAreaElement; redrawMeta?: () => void;
  dirty: boolean; saving: boolean; version: number; timer: ReturnType<typeof setTimeout> | null;
  onSaved?: (rel: string) => void; actions?: NoteActions;
  stopWatch?: () => void;
  // A note made in this editor keeps following its title until the editor closes,
  // so a pause halfway through typing the title does not name the file for good.
  autoName?: boolean;
}
let edit: EditState | null = null;

/// Done with a note: stop watching the disk, and a new note nothing was ever written in leaves no file behind.
function leaveNote(st: EditState): void {
  st.stopWatch?.();
  st.autoName = false;
  if (st.base === '' && !st.dirty && !st.head && /^untitled-/.test(st.rel.split('/').pop()!) && !st.ta?.value.trim()) {
    void notes.delete(st.root, st.rel).then(r => notes.purge(st.root, r.trashed)).then(() => st.onSaved?.(st.rel)).catch(() => {});
  }
}

// Leaving the page with words not yet saved: save them and let the browser ask.
window.addEventListener('beforeunload', e => {
  if (!edit?.dirty) return;
  void saveNote();
  e.preventDefault();
});

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

const stripFrontMatter = (t: string) => splitNote(t).body;

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
  document.getElementById('fe-ed-conflict')?.remove();
  closePreview();
}

export function openNote(root: string, doc: NoteDoc, onSaved?: (rel: string) => void, actions?: NoteActions): void {
  if (edit && edit.dirty) void saveNote();
  if (edit) leaveNote(edit);
  document.getElementById('fe-ed-conflict')?.remove();
  document.getElementById('fe-ed-diff')?.remove();
  currentEntry = null; reqSeq++;
  const { head, body: noteBody } = splitNote(doc.text);
  edit = { root, rel: doc.rel, mtime: doc.mtime, text: doc.text, head, base: doc.text, touched: new Set(), dirty: false, saving: false, version: 0, timer: null, onSaved, actions };
  currentText = doc.text;
  document.getElementById('fe-ql-icon')!.innerHTML = '';
  document.getElementById('fe-ql-modes')!.hidden = true;
  const nameEl = document.getElementById('fe-ql-name') as HTMLAnchorElement;
  nameEl.href = fileHref(root.replace(/\/$/, '') + '/' + doc.rel);
  (document.getElementById('fe-ql-open') as HTMLAnchorElement).href = nameEl.href;
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.style.display = ''; copyBtn.disabled = false;
  if (overlay.style.display === 'none') rememberFocus();
  overlay.style.display = 'flex';
  deps.dockRoom?.(layout.mode === 'side' && !galleryHost);
  if (!isPreviewDocked()) raise(overlay);
  syncSaveBtn();

  const body = document.getElementById('fe-ql-body')!;
  body.classList.add('fe-editing');
  body.innerHTML = `
    <div id="fe-ed-meta"></div>
    <div id="fe-ed-bar" class="bar">
      ${formatButtons({ linkKey: true })}
      <span class="bar-sep" aria-hidden="true"></span>
      ${fileButtons({ steps: !!actions, manage: !!actions })}
      <span class="fe-ed-hint">⌥↑↓ move line · ⌥⇧↑↓ duplicate · ⇥ indent · Enter continues lists</span>
    </div>
    <div id="fe-ed-hist" hidden></div>
    <div class="fe-ed"><textarea id="fe-ed-src" spellcheck="true"></textarea><div id="fe-ed-view" class="fe-md"></div></div>`;
  const ta = document.getElementById('fe-ed-src') as HTMLTextAreaElement;
  const view = document.getElementById('fe-ed-view')!;
  ta.value = noteBody;
  edit.ta = ta;
  const buf = attachBuffer(ta, `note:${root}/${doc.rel}`);
  edit.autoName = doc.text === '' && /^untitled-/.test(doc.rel.split('/').pop()!);
  const apply = (r: TextEdit) => {
    buf.snap();
    ta.value = r.text;
    ta.setSelectionRange(r.start, r.end);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  };
  const sel = () => ({ start: ta.selectionStart, end: ta.selectionEnd });
  const act = (name: string) => {
    const change = formatEdit(name, ta.value, sel());
    if (change) { apply(change); return; }
    if (name === 'table')  buf.insert(tableAt(ta.value, ta.selectionStart));
    if (name === 'image')  body.querySelector<HTMLInputElement>('.fe-ed-file')!.click();
    if (name === 'versions') toggleVersions();
    if (name === 'prev')   actions?.step(edit!.rel, -1);
    if (name === 'next')   actions?.step(edit!.rel, 1);
    if (name === 'rename') actions?.rename(edit!.rel);
    if (name === 'delete') actions?.del(edit!.rel);
  };
  const toggleVersions = mountVersions(document.getElementById('fe-ed-hist')!, {
    root: () => root,
    // The note may have been renamed since it opened (a first save names it), so ask under its current name.
    rel: () => edit?.rel ?? doc.rel,
    show: (head, text) => { view.innerHTML = head + renderMarkdown(stripFrontMatter(text), nameEl.href); },
    use: text => { buf.snap(); ta.value = splitNote(text).body; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus(); },
    back: () => renderView(),
    emptyHint: notRepo => notRepo
      ? 'The notes folder is not a git repository; Switchboard makes it one on its first save.'
      : 'This note has not been committed to the notes folder\'s git history.',
  });
  wireBar(document.getElementById('fe-ed-bar')!, act);
  wirePictures(ta, body.querySelector<HTMLInputElement>('.fe-ed-file'), {
    root: () => root,
    rel: () => edit?.rel ?? doc.rel,
    notesRoot: () => root,
    insert: t => { if (edit?.root === root) buf.insert(t); },
    failed: t => editHeader(t),
    warn: t => deps.toast?.(t),
  });
  const drawInto = morphInto(view);
  const renderView = () => { drawInto(renderMarkdown(ta.value, nameEl.href)); };
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
    if (e.isComposing) { e.stopPropagation(); return; }   // these keys belong to the input method
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod && k === 's') { stop(); void saveNote(); }
    else if (e.key === 'Escape') { stop(); closePreview(); }
    else if (mod && !e.shiftKey && k === 'k') { stop(); act('link'); }
    else if (formatKey(e)) { stop(); act(formatKey(e)!); }
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
    if (hasClash(st.text)) { editHeader('settle the two versions before changing properties'); return false; }
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
  // Another device or program writing the note: a clean editor follows it,
  // keeping the caret on its words; one holding typed text asks at once.
  st.stopWatch = watch(async () => {
    if (edit !== st) return;
    try {
      if ((await notes.fileStat(st.root, st.rel)).mtime === st.mtime || edit !== st || st.saving) return;
      const now = await notes.read(st.root, st.rel);
      if (edit !== st || st.saving || now.mtime === st.mtime) return;
      if (now.text === st.base) { st.mtime = now.mtime; return; }
      if (st.dirty) { showNoteClash(st, 'Changed on disk.'); return; }
      const parts = splitNote(now.text), was = sel(), change = diffText(ta.value, parts.body), top = ta.scrollTop;
      buf.snap();
      ta.value = parts.body;
      ta.setSelectionRange(mapCaret(was.start, change), mapCaret(was.end, change));
      ta.scrollTop = top;
      buf.snap();
      st.head = parts.head; st.text = now.text; st.base = now.text; st.mtime = now.mtime; currentText = now.text;
      renderView();
      st.redrawMeta?.();
      editHeader('saved');
    } catch (err) {
      if ((err as NotesError).code === 'notes_missing' && !st.saving) showNoteClash(st, 'Moved or deleted. Your text is only here.', true);
    }
  }, { pause: () => st.saving });
}

/// The banner for a note that cannot simply be saved: what happened and every way out.
function showNoteClash(st: EditState, why: string, gone = false): void {
  if (edit !== st) return;
  editHeader(gone ? 'not on disk' : 'changed on disk, not saved');
  document.getElementById('fe-ed-conflict')?.remove();
  document.getElementById('fe-ql-body')!.insertAdjacentHTML('afterbegin',
    `<div id="fe-ed-conflict" class="notice fe-ql-note" data-tone="danger">${esc(why)} `
    + (gone
      ? `<button id="fe-ed-resave" class="btn" data-size="sm" data-variant="outline" title="Write your text back as this note">${UI_ICON.check}<span>Save again</span></button> <button id="fe-ed-drop" class="btn" data-size="sm" data-variant="outline" title="Close and lose the text on screen">${UI_ICON.trash}<span>Discard</span></button>`
      : `<button id="fe-ed-compare" class="btn" data-size="sm" data-variant="outline" title="Show what differs from your text">${UI_ICON.versions}<span>Compare</span></button> <button id="fe-ed-reload" class="btn" data-size="sm" data-variant="outline" title="Replace your text with the disk copy">${UI_ICON.rotate}<span>Reload</span></button> <button id="fe-ed-force" class="btn" data-size="sm" data-variant="outline" title="Save yours; the disk copy is backed up">${UI_ICON.check}<span>Keep mine</span></button>`)
    + '</div>');
  const on = (id: string, run: () => void) => document.getElementById(id)?.addEventListener('click', run);
  const clear = () => { document.getElementById('fe-ed-conflict')?.remove(); document.getElementById('fe-ed-diff')?.remove(); };
  on('fe-ed-resave', () => { clear(); void notes.write(st.root, st.rel, stampUpdated(st.text)).then(r => { st.mtime = r.mtime; st.dirty = false; editHeader('saved'); st.onSaved?.(st.rel); }).catch(err => showNoteClash(st, errorText(err, 'Saving'), true)); });
  on('fe-ed-drop', () => { clear(); discardEditor(); });
  on('fe-ed-reload', () => { clear(); void notes.read(st.root, st.rel).then(d => openNote(st.root, d, st.onSaved, st.actions)); });
  on('fe-ed-force', () => {
    void notes.read(st.root, st.rel).then(d => notes.fileWrite(st.root, st.rel, stampUpdated(st.text), d.mtime)).then(r => { clear(); st.mtime = r.mtime; st.dirty = false; editHeader('saved'); st.onSaved?.(st.rel); })
      .catch(err => editHeader(errorText(err, 'Saving')));
  });
  on('fe-ed-compare', () => {
    const open = document.getElementById('fe-ed-diff');
    if (open) { open.remove(); return; }
    void notes.read(st.root, st.rel).then(d => {
      if (document.getElementById('fe-ed-conflict')) document.getElementById('fe-ed-conflict')!.insertAdjacentHTML('afterend', `<div id="fe-ed-diff">${lineDiffHtml(d.text, st.text)}</div>`);
    }).catch(err => editHeader(errorText(err, 'Reading the file on disk')));
  });
}

/// A note that could not be saved after its editor closed: its words go to a new note beside it, never nowhere.
function rescueNote(st: EditState, text: string): void {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const rel = st.rel.replace(/\.md$/, '') + `-rescued-${stamp}.md`;
  notes.create(st.root, rel, text).then(() => { deps.toast?.(`Could not save it, so your text is in ${rel}`); st.onSaved?.(rel); })
    .catch(() => { void navigator.clipboard.writeText(text).catch(() => {}); deps.toast?.('Could not save the note. Your text is on the clipboard.'); });
}
async function saveNote(st = edit): Promise<void> {
  if (!st || st.saving) return;
  if (st.timer) { clearTimeout(st.timer); st.timer = null; }
  st.saving = true;
  const version = st.version;
  // A note made here and saved for the first time gets the moment it was made, as every note in the folder carries one.
  if (st.base === '' && !st.head && /^untitled-/.test(st.rel.split('/').pop()!) && st.ta?.value.trim()) {
    st.head = setField(st.head, 'created', isoNow());
    st.touched.add('created');
    st.text = st.head + st.ta.value;
  }
  let text = stampUpdated(st.text);
  // Guard: the saved properties block must equal what was read, apart from fields set through the chips.
  // A pasted --- block at the top of a note without properties would otherwise be read as properties.
  // Settling a clash legitimately turns a header-less file into one with a header, so the guard waits until it is settled.
  if (!hasClash(st.base) && frontmatterDrift(st.base, text, st.touched).length) {
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
    if ((/^untitled-/.test(st.rel.split('/').pop()!) || st.autoName) && !/^untitled/.test(want)) {
      const to = st.rel.replace(/[^/]+$/, want);
      if (to !== st.rel) try { await notes.rename(st.root, st.rel, to); st.rel = to; st.autoName = true; } catch { /* keep the old name */ }
    }
    if (edit === st) { editHeader(st.dirty ? 'unsaved' : 'saved ' + whenText(Date.now()).replace('Today ', '')); st.redrawMeta?.(); }
    st.onSaved?.(st.rel);
  } catch (err) {
    const e = err as NotesError;
    if (edit === st) {
      if (e.code === 'notes_conflict') { if (!document.getElementById('fe-ed-conflict')) showNoteClash(st, 'Changed on disk.'); }
      else if (e.code === 'notes_missing') showNoteClash(st, 'Moved or deleted. Your text is only here.', true);
      else {
        editHeader(errorText(e, 'Saving'));
        // A passing failure (a locked file, a busy disk) tries again by itself.
        if (st.timer) clearTimeout(st.timer);
        st.timer = setTimeout(() => void saveNote(st), 4000);
      }
    } else rescueNote(st, text);
  } finally {
    st.saving = false;
    if (wrote && st.dirty) void saveNote(st);
  }
}

export function openPreview(e: Entry): void {
  if (!canPreview(e)) return;
  if (edit) { if (edit.timer) clearTimeout(edit.timer); if (edit.dirty) void saveNote(); leaveNote(edit); edit = null; document.getElementById('fe-ed-conflict')?.remove(); }
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
  deps.dockRoom?.(layout.mode === 'side' && !galleryHost);
  if (!isPreviewDocked()) raise(overlay);
  syncSaveBtn();
  dsvHeader = []; dsvRows = []; dsvSort = null;
  currentText = null;
  currentImage = null;
  document.getElementById('fe-ql-ai-btn')!.hidden = !canAsk(e);
  const copyBtn = document.getElementById('fe-ql-copy') as HTMLButtonElement;
  copyBtn.disabled = true;
  // A picture has this button in its own bar; every other file has it here. Only an HTML page has modes.
  document.getElementById('fe-ql-modes')!.hidden = true;
  document.getElementById('fe-ql-app-group')!.hidden = IMG_EXTS.has(ext);

  if (IMG_EXTS.has(ext) || PDF_EXTS.has(ext) || VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext) || FONT_EXTS.has(ext)) {
    copyBtn.style.display = 'none';   // binary media: rendered from file://, no text; images still take Ask
    if (IMG_EXTS.has(ext)) {
      currentImage = decodeURIComponent(new URL(e.href, location.href).pathname);
      body.innerHTML = '<div class="fe-ql-imgwrap"></div>';
      mountImageTools(body.querySelector<HTMLElement>('.fe-ql-imgwrap')!, {
        href: e.href, name: e.name,
        path: decodeURIComponent(new URL(e.href, location.href).pathname),
        notify: m => deps.toast?.(m),
        openMore: anchor => openWithMenu(anchor, currentImage!, false, parseCommands(getSettings().openWithCmds), m => deps.toast?.(m)),
        openNative,
      });
    }
    else if (PDF_EXTS.has(ext))   body.innerHTML = `<embed class="fe-ql-pdf" src="${esc(e.href)}" type="application/pdf">`;
    else if (VIDEO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-media-wrap"><video class="fe-ql-media" src="${esc(e.href)}" controls autoplay muted></video></div>`;
    else if (AUDIO_EXTS.has(ext)) body.innerHTML = `<div class="fe-ql-center"><audio src="${esc(e.href)}" controls></audio></div>`;
    else                          body.innerHTML = fontSpecimen(e.href);
    return;
  }
  copyBtn.style.display = '';

  if (e.rawBytes > FETCH_WARN_BYTES) {
    body.innerHTML = `
      <div class="fe-ql-center">
        <div class="notice fe-ql-note">This file is ${fmtSize(e.rawBytes)}, so it may render slowly.</div>
        <button id="fe-ql-force" class="btn" title="Render despite the size">${UI_ICON.eye}Load anyway</button>
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
        ? `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">The extension was reloaded; this page needs a refresh.</div><button id="fe-ql-retry" class="btn" title="Reload this page">${UI_ICON.refresh}Refresh page</button></div>`
        : `<div class="fe-ql-center"><div class="notice fe-ql-note" data-tone="danger">Could not read file.</div><button id="fe-ql-retry" class="btn" title="Try reading the file again">${UI_ICON.refresh}Retry</button></div>`;
      document.getElementById('fe-ql-retry')!.addEventListener('click', () => {
        if (stale) reload(); else fetchAndRender(e, ext, seq);
      });
    });
}

function render(text: string, ext: string): void {
  const body = document.getElementById('fe-ql-body')!;
  const note = unrenderableNote(text);
  if (note) {
    if (sniffBinary(text)) document.getElementById('fe-ql-ai-btn')!.hidden = true;   // nothing for a model to read
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
  const btn = (v: 'page' | 'src', icon: string, title: string, on: boolean) =>
    `<button type="button" class="fe-seg-b ico${on ? ' on' : ''}" data-v="${v}" aria-pressed="${on}" title="${title}" aria-label="${title}">${icon}</button>`;
  const modes = document.getElementById('fe-ql-modes')!;
  modes.hidden = false;
  modes.innerHTML = btn('page', UI_ICON.eye, 'Show the rendered page', !htmlSource) + btn('src', UI_ICON.fmtCode, 'Show the HTML source', htmlSource);
  body.innerHTML = htmlSource ? renderCode(text, 'html') : '<iframe class="fe-ql-html" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>';
  const frame = body.querySelector<HTMLIFrameElement>('iframe.fe-ql-html');
  if (frame && currentEntry) frame.src = currentEntry.href;
  modes.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.addEventListener('click', () => {
    htmlSource = b.dataset.v === 'src';
    renderHtml(body, text);
  }));
}
function restoreScroll(body: HTMLElement): void {
  const top = currentEntry ? scrollMemo.get(currentEntry.href) : undefined;
  if (top) body.scrollTop = top;
}
