// A file opened directly in the tab gets the same picture as the preview,
// inside the explorer's own shell: the main column shows a small bar (size,
// raw, copy), a table of contents for markdown, and the matching renderer.
// main.ts builds the shell and calls mountFileContent. HTML source is fetched
// after takeover because the document contains rendered text, not source.
import { esc, copyToClipboard } from './utils';
import {
  CODE_EXTS, TABLE_EXTS, JSONL_EXTS,
  renderCode, parseDSV, numericCols, renderDSVTable, unrenderableNote,
} from './renderers';
import { formatFor, diagnose, renderFile, type Diagnostic } from './formats';
import { fetchFileText } from './file-fetch';
import { fileMeta, metaChips, metaSummary } from './file-meta';
import { UI_ICON } from './control-icons';
import { openLayer } from './layer';
import { getSettings, saveSettings, textPref, jsonPref, flagPref, choicePref } from './storage';
import { editableRoot, editableFoldersOf, openFileEditor, type FileEditor } from './file-editor';
import { setSidebarShown, sidebarShown } from './motion';
import { attachFind } from './find-in-page';
import { mountComments, type CommentsPanel, type CommentAction } from './comments-ui';
import type { Settings } from './types';
import { markPlace } from './nav';
import { watch } from './watch';

const scrollPref = jsonPref<Record<string, number>>('bfb-page-scroll-v1', {}, v => !!v && typeof v === 'object');
const tocPref = flagPref('bfb-page-toc-v1', true);
// Which tab the rail shows, Contents or Comments; a per-reader choice.
const railTabPref = choicePref('bfb-page-rail-tab-v1', ['toc', 'cm'], 'toc');
/** The reading column's width; v1 held a plain on or off. */
export const columnPref = textPref('bfb-page-column-v2');
const oldColumnPref = textPref('bfb-page-column-v1');
type ColumnMode = 'unset' | 'xl' | 'lg' | 'md';
const COLUMN_MODES: ColumnMode[] = ['unset', 'xl', 'lg', 'md'];
const COLUMN_WIDTHS: Record<ColumnMode, string> = { unset: 'full', xl: '150ch', lg: '130ch', md: '110ch' };
export function columnMode(value: unknown): ColumnMode {
  if (value === true || value === '1') return 'md';
  return COLUMN_MODES.includes(value as ColumnMode) ? value as ColumnMode : 'unset';
}
export function savedColumnMode(fallback: unknown): ColumnMode {
  return columnMode(columnPref.get() || oldColumnPref.get() || fallback);
}

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

// HTML reads as its source here; its rendered page is Chrome's own, or the editor's Rich view.
const renderBody = (text: string, ext: string, href: string): string => renderFile(text, ext, href, 'page');

/** One problem: its line number, which jumps to the source, and what is wrong. */
const diagRow = (d: Diagnostic) =>
  `<button type="button" class="fe-diag-row ${d.severity}" data-line="${d.line}" title="Show line ${d.line} in the source"><span class="fe-diag-ln">${d.line}</span><span>${esc(d.message)}</span></button>`;

/** The problems a checker found, as one quiet strip; each line number jumps to the source. */
function diagStrip(diags: Diagnostic[]): string {
  if (!diags.length) return '';
  const errors = diags.filter(d => d.severity === 'error').length;
  const warns = diags.length - errors;
  const head = [errors && `${errors} error${errors > 1 ? 's' : ''}`, warns && `${warns} warning${warns > 1 ? 's' : ''}`].filter(Boolean).join(', ');
  const rows = diags.slice(0, 8).map(diagRow).join('');
  const more = diags.length > 8 ? `<span class="fe-diag-more">and ${diags.length - 8} more</span>` : '';
  return `<details class="fe-diag card ${errors ? 'error' : 'warn'}"${errors ? ' open' : ''}><summary>${head}</summary>${rows}${more}</details>`;
}

/** Marks the source rows that have a problem, with the message on hover. */
export function markRows(rows: ArrayLike<Element>, diags: Diagnostic[]): void {
  for (const d of diags) {
    const row = rows[d.line - 1] as HTMLElement | undefined;
    if (!row) continue;
    if (!row.classList.contains('err')) row.classList.add(d.severity === 'error' ? 'err' : 'warn');
    if (d.severity === 'error') row.classList.replace('warn', 'err');
    row.title = row.title ? `${row.title}\n${d.message}` : d.message;
    row.dataset.tip = 'problem';
    row.dataset.line = String(d.line);
  }
}

// List the headings (the renderer gave them ids) in the rail; returns how many.
function buildToc(page: HTMLElement, toc: HTMLElement): number {
  const heads = [...page.querySelectorAll<HTMLElement>('.fe-md h1, .fe-md h2, .fe-md h3, .fe-md h4')];
  toc.innerHTML = heads.map(h => {
    const text = (h.textContent || '').replace(/#$/, '').trim();
    return `<a href="#${esc(h.id)}" class="row fe-toc-${h.tagName.toLowerCase()}" data-id="${esc(h.id)}" title="${esc(text)}">${esc(text)}</a>`;
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
  return scrollPref.get();
}
function rememberScroll(path: string, top: number): void {
  const m = scrollMemory();
  m[path] = top;
  const keys = Object.keys(m);
  if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete m[k];
  scrollPref.set(m);
}

// The markup the shell places in its main column, under the strip.
export function renderFileContent(): string {
  return `
      <div id="fe-fp-bar" class="bar">
        <span id="fe-fp-meta"></span>
        <button id="fe-fp-column" class="btn" title="Cycle reading width"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="1.5" y="1.5" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 1.5v10M9 1.5v10" stroke="currentColor" stroke-width="1.1"/></svg><span class="fe-fp-column-label">Full width</span></button>
        <button id="fe-fp-edit" class="btn" title="Edit this file (e e)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M8.5 2.5l2 2L4.5 10.5H2.5v-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>Edit</button>
        <button id="fe-fp-wrap" class="btn" title="Wrap long lines in raw text and code"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M1.5 3.5h10M1.5 6.5h8a2 2 0 0 1 0 4H7m1.5-1.5L7 10.5 8.5 12M1.5 9.5h3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Wrap</button>
        <button id="fe-fp-raw" class="btn" title="Raw text (r)"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M4.5 3 1.5 6.5 4.5 10M8.5 3l3 3.5-3 3.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>Raw</button>
        <button id="fe-fp-copy" class="btn" title="Copy file contents"><svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 9H1.5V2a.5.5 0 0 1 .5-.5h7V2" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>Copy</button>
        <span id="fe-ff" title="Find in this file (/) · Enter next · Shift+Enter previous · Esc clears">
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><circle cx="5.5" cy="5.5" r="3.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8.4 8.4 11.5 11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <input id="fe-ff-q" type="text" placeholder="Find" spellcheck="false" autocomplete="off" aria-label="Find in this file" title="Find in this file (/)">
          <span id="fe-ff-n" aria-live="polite"></span>
          <button id="fe-ff-prev" class="btn" data-icon data-size="xs" title="Previous match (Shift+Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 7 5.5 4l3 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button id="fe-ff-next" class="btn" data-icon data-size="xs" title="Next match (Enter)" disabled><svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2.5 4l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </span>
        <span class="fe-fp-panes">
          <button id="fe-fp-toc" class="btn" data-icon title="On this page: the headings" aria-label="On this page" hidden>${UI_ICON.contents}</button>
          <button id="fe-fp-cm" class="btn" data-icon title="Comments (⇧C)" aria-label="Comments" hidden>${UI_ICON.comment}<span id="fe-fp-cm-n"></span></button>
        </span>
      </div>
      <div id="fe-fp">
        <div id="fe-page" tabindex="-1"></div>
        <div id="fe-fe" style="display:none"></div>
        <aside id="fe-toc-rail" hidden>
          <div class="fe-toc-head"><h3 class="sect fe-rail-title" data-level="panel"><span class="fe-rail-ico"></span><span class="fe-rail-name"></span><span class="badge fe-rt-n" data-tone="solid" id="fe-cm-n"></span></h3></div>
          <nav id="fe-toc"></nav>
          <div id="fe-cm" role="tabpanel" aria-label="Comments" hidden></div>
        </aside>
      </div>`;
}

export interface FileContent {
  toggleRaw(): void; setText(text: string): void; edit(): void;
  /** A comments action by name; false when the page has no comments or nothing to act on. */
  comment(a: CommentAction): boolean;
  /** Whether comments can be made here now (a rendered Markdown page, not editing). */
  commentable(): boolean;
  /** Whether a comment is being looked at or written, which Esc lets go of. */
  commentHeld(): boolean;
  /** Whether the file is open in the editor. */
  editing(): boolean;
}

/// The pane width at which the open Contents card fits beside a full text column.
const TOC_ROOMY = 1000;

export function mountFileContent(opts: { ext: string; text: string; rawPath: string; href: string; column?: boolean | ColumnMode; editableFolders?: string[] }): FileContent {
  const { ext, rawPath, href } = opts;
  let text = opts.text;
  const page = document.getElementById('fe-page')!;
  const toc = document.getElementById('fe-toc')!;
  const rail = document.getElementById('fe-toc-rail')!;
  const tocBtn = document.getElementById('fe-fp-toc')!;
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
  let tocOpen = tocPref.get();
  // A pane too narrow for a full text column beside the card folds the card
  // to its button; opening it then lays it over the text for a moment
  // instead of squeezing the column.
  let tight = false, peek = false;
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
    // While editing, the editor's own Raw / Split / Rich switch is the only view control.
    rawBtn.style.display = editor ? 'none' : '';
    // The rail holds Contents (a markdown page with at least two headings) and
    // Comments (any markdown page); the two buttons right of find show it on
    // one or the other, or hide it. While editing only Comments stays.
    const cmOpen = comments?.open() ?? 0;
    const hasToc = headings >= 2 && !editor;
    const tab = railTab === 'toc' && !hasToc ? 'cm' : railTab;
    const open = tight ? peek : tocOpen;
    rail.hidden = !isMd || raw || !open || (tab === 'cm' ? railTab !== 'cm' && !cmOpen : !hasToc);
    rail.dataset.tab = tab;
    toc.hidden = tab !== 'toc';
    cmBox.hidden = tab !== 'cm';
    rail.querySelector('.fe-rail-ico')!.innerHTML = tab === 'cm' ? UI_ICON.comment : UI_ICON.contents;
    rail.querySelector('.fe-rail-name')!.textContent = tab === 'cm' ? 'Comments' : 'On this page';
    cmN.textContent = tab === 'cm' && cmOpen ? String(cmOpen) : '';
    cmBtn.hidden = !isMd || raw;
    tocBtn.hidden = !hasToc || raw;
    for (const [b, t] of [[tocBtn, 'toc'], [cmBtn, 'cm']] as const) {
      const on = !rail.hidden && tab === t;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    cmBtnN.textContent = cmOpen ? String(cmOpen) : '';
    rail.classList.toggle('peek', tight && peek);
    findBox.hidden = !!editor;
  };
  const render = () => {
    paintMeta();
    const top = page.scrollTop;
    const diags = diagnose(ext, text);
    // What a strict YAML reader said about the front matter shows inside the
    // front matter box, which still lists every value it could read.
    const fmEnd = isMd && !raw && /^---\r?\n/.test(text) ? text.split('\n').findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l)) + 1 : 0;
    const inBox = fmEnd > 0 ? diags.filter(d => d.line <= fmEnd) : [];
    page.innerHTML = diagStrip(diags.filter(d => !inBox.includes(d))) + (raw ? renderCode(text, JSONL_EXTS.has(ext) ? 'json' : ext) : renderBody(text, ext, href));
    const box = inBox.length ? page.querySelector('.fe-md-fm') : null;
    if (box) box.insertAdjacentHTML('beforeend', `<div class="fe-md-fm-warn notice" data-tone="warn">${inBox.map(diagRow).join('')}<span class="fe-md-fm-note">Shown as written; a strict YAML reader would not accept it.</span></div>`);
    else if (inBox.length) page.insertAdjacentHTML('afterbegin', diagStrip(inBox));
    markRows(page.querySelectorAll('.fe-cl'), diags);
    headings = !raw && isMd ? buildToc(page, toc) : 0;
    page.scrollTop = top;
    rawBtn.classList.toggle('on', raw);
    paint();
    spy(page, toc);
    find.refresh();
    comments?.redraw();
  };
  // `editor` is declared below; render runs before any editor exists.
  let editor: FileEditor | null = null;
  // The comments panel shares the rail; it mounts once the editable root is known.
  const cmBox = document.getElementById('fe-cm')!;
  const cmN = document.getElementById('fe-cm-n')!;
  const cmBtn = document.getElementById('fe-fp-cm')!;
  const cmBtnN = document.getElementById('fe-fp-cm-n')!;
  let comments: CommentsPanel | null = null;
  let railTab = railTabPref.get();
  // Show the rail on one pane; the remembered open state follows.
  const showPane = (t: 'toc' | 'cm') => {
    railTab = t; railTabPref.set(t);
    if (tight) peek = true; else if (!tocOpen) { tocOpen = true; tocPref.set(true); }
    paint();
    if (t === 'toc') spy(page, toc);
  };
  // The bar's button for a pane hides the rail when that pane is showing.
  const togglePane = (t: 'toc' | 'cm') => {
    if (rail.hidden || rail.dataset.tab !== t) { showPane(t); return; }
    if (tight) peek = false; else { tocOpen = false; tocPref.set(false); }
    paint();
  };
  const fp = document.getElementById('fe-fp');
  // Measured before the first paint, so a #comments link opening the card at
  // load is not undone when the observer first reports the width.
  if (fp) tight = fp.clientWidth < TOC_ROOMY;
  render();
  if (fp) new ResizeObserver(() => {
    const was = tight;
    tight = fp.clientWidth < TOC_ROOMY;
    if (tight !== was) { peek = false; paint(); }
  }).observe(fp);
  toc.addEventListener('click', e => { if (tight && (e.target as Element).closest('a')) { peek = false; paint(); } });
  colBtn.addEventListener('click', () => { column = COLUMN_MODES[(COLUMN_MODES.indexOf(column) + 1) % COLUMN_MODES.length]; columnPref.set(column); paint(); });
  page.addEventListener('scroll', () => { if (isMd && !raw) spy(page, toc); });
  // A problem's line number opens the source at that line.
  page.addEventListener('click', e => {
    const row = (e.target as Element).closest<HTMLElement>('.fe-diag-row');
    if (!row) return;
    if (!raw) { raw = true; render(); }
    const line = page.querySelectorAll<HTMLElement>('.fe-cl')[Number(row.dataset.line) - 1];
    if (!line) return;
    line.scrollIntoView({ block: 'center' });
    line.classList.add('flash');
    setTimeout(() => line.classList.remove('flash'), 1200);
  });
  // A contents click glides to the heading and keeps the address in step.
  toc.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-id]');
    const target = a && document.getElementById(a.dataset.id!);
    if (!target) return;
    e.preventDefault();
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    toc.dataset.pin = a.dataset.id!;
    target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    markPlace('#' + encodeURIComponent(a.dataset.id!));
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
    const pop = document.createElement('div');
    pop.id = 'fe-allow';
    const short = home && folder.startsWith(home + '/') ? '~' + folder.slice(home.length) : folder;
    pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Allow editing here?</div>
      <p>Saves write to <code>${esc(short)}</code>. Each save keeps the old text for 14 days.</p>
      <div class="fe-allow-acts"><button type="button" class="btn" data-a="cancel">Cancel</button>
      <button type="button" class="btn" data-variant="outline" data-a="file">Just this file</button>
      <button type="button" class="btn" data-variant="solid" data-a="folder">Allow folder</button></div>`;
    // Esc, a click away or a second Edit press answer no; only a pick answers yes.
    let ok = false;
    const layer = openLayer(pop, { kind: 'popover', anchor: editBtn, align: 'end', offset: 8, role: 'dialog', label: 'Allow editing', group: 'allow',
      focus: pop.querySelector<HTMLElement>('[data-a="folder"]')!, onClose: () => resolve(ok) });
    if (!layer.open) { resolve(false); return; }
    pop.addEventListener('click', e => {
      const a = (e.target as Element).closest<HTMLElement>('[data-a]')?.dataset.a;
      if (!a) return;
      if (a !== 'cancel') {
        const s = getSettings();
        s.editableFolders = [...new Set([...(s.editableFolders ?? []), a === 'folder' ? folder : rawPath])];
        saveSettings(s);
        root = editableRoot(rawPath, editableFoldersOf(s), home);
        ok = !!root;
      }
      layer.close('pick');
    });
  });

  // A failure to open says so next to the button, where the eye already is.
  const noteAtButton = (msg: string) => {
    const pop = document.createElement('div');
    pop.id = 'fe-allow';
    pop.className = 'fe-allow-note';
    pop.innerHTML = `<div class="fe-allow-title">${UI_ICON.lock}Cannot edit this file</div><p>${esc(msg)}</p>`;
    const layer = openLayer(pop, { kind: 'popover', anchor: editBtn, align: 'end', offset: 8, role: 'alert', group: 'allow', focus: 'none' });
    setTimeout(() => layer.close('api'), 8000);
  };

  const edit = async () => {
    if (editor || editBtn.classList.contains('busy')) return;
    // Allowed since this page loaded, perhaps in another tab: ask the stored settings, not the copy from load.
    if (!root) root = editableRoot(rawPath, editableFoldersOf(getSettings()), home);
    if (!root && !(await askToAllow())) return;
    if (!root) return;
    editBtn.classList.add('busy');
    // Editing gets the room: the sidebar folds away (its edge still opens it) and comes back on Done.
    const sideWas = sidebarShown();
    if (sideWas) setSidebarShown(false);
    const sideBack = () => { if (sideWas) setSidebarShown(true); };
    page.style.display = 'none'; editBox.style.display = '';
    find.clear();
    editBtn.classList.add('on');
    editor = await openFileEditor(editBox, {
      root, rel: rawPath.slice(root.length + 1), ext, href,
      status,
      cannotEdit: why => { status(why); noteAtButton(why); },
      saved: fresh => { text = fresh; paintMeta(); },   // the pill shows Saved
      // The file may have changed while editing (a reload from disk), so read it again.
      closed: () => {
        editor = null; editBox.style.display = 'none'; page.style.display = ''; editBtn.classList.remove('on'); sideBack();
        fetchFileText(href).then(fresh => { text = fresh; paintMeta(); }).catch(() => {}).finally(render);
      },
      comments: comments ? { marks: () => comments!.marks(), open: id => { showComments(); comments!.show(id); } } : undefined,
    });
    editBtn.classList.remove('busy');
    paint();
    if (!editor) { editBox.style.display = 'none'; page.style.display = ''; editBtn.classList.remove('on'); sideBack(); render(); }
  };
  editBtn.addEventListener('click', () => void edit());
  const showComments = () => showPane('cm');
  const toggleComments = () => togglePane('cm');
  if (isMd) comments = mountComments({
    page, box: cmBox, href, path: rawPath,
    root: () => root, rel: () => rawPath.slice((root ?? '').length + 1), text: () => text,
    allow: askToAllow, status, changed: () => { paint(); editor?.marks(); },
    reveal: showComments, toggle: toggleComments,
    picked: span => editor?.select(span.offset, span.offset + span.length),
    editing: () => !!editor,
    edited: fresh => { text = fresh; paintMeta(); render(); },
  });
  cmBtn.addEventListener('click', toggleComments);
  tocBtn.addEventListener('click', () => togglePane('toc'));
  // Find splits text into marks, which moves the highlights' text; draw them again.
  document.getElementById('fe-ff-q')!.addEventListener('input', () => setTimeout(() => comments?.redraw(), 0));
  rawBtn.addEventListener('click', toggleRaw);
  // Wrap applies to every code view, here and in previews, and is remembered.
  const wrapBtn = document.getElementById('fe-fp-wrap')!;

  const syncWrap = () => wrapBtn.classList.toggle('on', fe.dataset.wrap === 'on');
  syncWrap();
  wrapBtn.addEventListener('click', () => {
    const s = getSettings();
    s.wrapLines = fe.dataset.wrap !== 'on';
    fe.dataset.wrap = s.wrapLines ? 'on' : 'off';
    saveSettings(s); syncWrap();
  });
  document.getElementById('fe-fp-copy')!.addEventListener('click', () => {
    copyToClipboard(text).then(ok => { document.getElementById('fe-status-text')!.textContent = ok ? 'copied' : 'copy failed'; });
  });

  // Autoreload: while the tab is visible, poll the file and re-render on change.
  const reloadEl = document.getElementById('fe-fp-reload')!;
  // Silent while all is well: it says "Updated from disk" for a moment after
  // a reload, and stays only while the file cannot be watched.
  let liveTimer = 0;
  const live = (ok: boolean, label: string) => {
    clearTimeout(liveTimer);
    reloadEl.hidden = false;
    reloadEl.classList.toggle('off', !ok);
    reloadEl.textContent = ok ? 'Updated from disk' : 'Not watching for changes';
    reloadEl.title = label;
    if (ok) liveTimer = window.setTimeout(() => { reloadEl.hidden = true; }, 4000);
  };
  watch(() => fetchFileText(href).then(fresh => {
      if (fresh === text) return;
      text = fresh;
      paintMeta();
      render();
      live(true, 'reloaded ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }).catch(() => live(false, 'not watching')), { pause: () => !!editor });

  return {
    toggleRaw,
    edit: () => void edit(),
    comment: a => !editor && !raw && !!comments?.act(a),
    commentable: () => !editor && !raw && !!comments,
    commentHeld: () => !editor && !raw && !!comments?.held(),
    editing: () => !!editor,
    setText(fresh) {
      text = fresh;
      paintMeta();
      render();
    },
  };
}
