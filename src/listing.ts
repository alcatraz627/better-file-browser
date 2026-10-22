// The folder listing: what is shown (sort, group, filter, text search,
// deep search), how (view, detail level, hidden files, column widths) and which rows
// are selected. Pointer and key handling live in listing-input.ts and drive
// this module through the selection functions it returns.
import { resizable } from './resize';
import type { App } from './app';
import type { Entry, SortConfig, FilterConfig, GroupMode } from './types';
import type { FindQuery, ContentHit } from './find';
import { el, els } from './el';
import { esc, fmtSize, fullPath, copyToClipboard } from './utils';
import { kvGet, kvSet } from './kv';
import {
  VIEW_KEY, DENSITY_KEY, HIDDEN_KEY, getColWidths, saveColWidths, getSaved, getTags, saveSaved,
  getSortConfig, saveSortConfig, getGroupMode, saveGroupMode,
} from './storage';
import { upsertPlace } from './places';
import { selectionRange } from './selection';
import { applyFilter, applySort, buildGroups } from './sort-filter';
import { crawl } from './deep-search';
import { parseListing } from './parse';
import { loadOpenCounts } from './doc-comments';
import { isTextCandidate, searchContents, findToHash, findFromHash, describeFind, textPatternError } from './find';
import { filterNames } from './name-filter';
import { SearchFileReader, SearchSession } from './search-session';
import { renderRow, renderTile, renderHitSnippet, type RenderContext } from './render';
import { getIcon, CHEVRON_DOWN } from './icons';
import { openPreview, canPreview } from './preview';
import { upgradeControls, type ValuedEl, type DropdownEl, type Opt } from './controls';
import { emptyHtml, CLEAR } from './empty-state';

export interface ListingState {
  all: Entry[];
  visible: Entry[];      // rendered order; data-idx indexes into it
  baseStatus: string;    // the count line shown when nothing is selected
  sort: SortConfig; group: GroupMode; filter: FilterConfig;
  deepOn: boolean; deepEntries: Entry[] | null; deepFolders: number; deepTruncated: boolean; deepCap: string; deepScanning: boolean; deepSeq: number;
  contentHits: Map<string, ContentHit> | null; contentText: string; findSeq: number; pendingFindText: string | null;
  selSet: Set<number>;   // every selected visible index
  selIdx: number;        // the lead: last touched, drives scroll and the status line
  anchor: number;        // the fixed end of a shift range
}

export interface Selection {
  entryShown(en: Entry): boolean;
  selectable(i: number): boolean;
  setSel(i: number): void;
  toggleSel(i: number): void;
  rangeSel(i: number): void;
  selectAll(): void;
  moveSel(step: number): void;
  copySelection(): void;
  tryPreview(en: Entry): void;
  previewStep(step: number): void;
}

export interface Listing { ls: ListingState; sel: Selection; applyAll(): void; applyFindFromHash(): void }

export function initListing(app: App, all: Entry[], init: { view: string; density: number; hidden: boolean }): Listing {
  const { fe, toast, rawPath } = app;
  const ls: ListingState = {
    all, visible: all, baseStatus: '',
    sort: getSortConfig(), group: getGroupMode(), filter: { q: '', regex: false, type: 'all' },
    deepOn: false, deepEntries: null, deepFolders: 0, deepTruncated: false, deepCap: '', deepScanning: false, deepSeq: 0,
    contentHits: null, contentText: '', findSeq: 0, pendingFindText: null,
    selSet: new Set(), selIdx: -1, anchor: -1,
  };
  let openComments = new Map<string, number>();
  const ctx = (): RenderContext => {
    const colour = new Map(getTags().map(t => [t.name, t.color]));
    const byPath = new Map(getSaved().filter(p => p.tags?.length).map(p => [p.path.replace(/\/+$/, ''), p.tags!]));
    return {
      rawPath, iconRules: app.iconRules, settings: app.settings,
      tagsOf: path => (byPath.get(path.replace(/\/+$/, '')) ?? []).map(name => ({ name, color: colour.get(name) ?? '#8b949e' })),
      openComments: name => openComments.get(name) ?? 0,
    };
  };
  const nonPar = all.filter(e => !e.isParent);
  const dirs   = nonPar.filter(e => e.isDir).length;
  const files  = nonPar.filter(e => !e.isDir).length;
  const hidden = nonPar.filter(e => e.isHidden).length;
  const treeExpanded = new Set<string>();
  const treeChildren = new Map<string, Entry[]>();
  const treeLoading = new Set<string>();
  const treeErrors = new Set<string>();
  const treeReaders = new Map<string, SearchFileReader>();
  const treeRootUrl = new URL('./', location.href).href;
  let findSession: SearchSession | null = null;
  let deepReader: SearchFileReader | null = null;
  let nameMatches: Set<string> | null = null;
  let nameFilterAbort: AbortController | null = null;
  let nameFilterReady: Promise<void> = Promise.resolve();
  let nameFilterFailure = '';
  // The folder count matches the rows on screen: hidden items count only while
  // shown, and otherwise are named so an all-hidden folder does not look empty.
  const countText = () => {
    const showHidden = fe.classList.contains('show-hidden');
    const d = showHidden ? dirs : nonPar.filter(e => e.isDir && !e.isHidden).length;
    const f = showHidden ? files : nonPar.filter(e => !e.isDir && !e.isHidden).length;
    return `${d} folder${d !== 1 ? 's' : ''}, ${f} file${f !== 1 ? 's' : ''}${!showHidden && hidden ? ` · ${hidden} hidden` : ''}`;
  };
  ls.baseStatus = countText();

  function renderTree(entries: Entry[], parent: Entry[]): void {
    const rows: string[] = [];
    const add = (en: Entry, depth: number) => {
      const idx = ls.visible.length;
      ls.visible.push(en);
      const name = en.isParent ? 'Parent Directory' : en.name.split('/').pop()!;
      const expanded = treeExpanded.has(en.href);
      const hit = ls.contentHits?.get(en.href);
      rows.push(`<div class="row fe-tree-row${en.isHidden ? ' dotfile' : ''}${en.isDir ? ' dir' : ''}" data-idx="${idx}" style="padding-left:${10 + depth * 20}px">
        ${en.isDir && !en.isParent ? `<button class="fe-tree-toggle" data-url="${esc(en.href)}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${esc(name)}" aria-expanded="${expanded}">${CHEVRON_DOWN}</button>` : '<span class="fe-tree-spacer"></span>'}
        <a href="${esc(en.href)}" class="fe-tree-link" title="${esc(name)}">${getIcon(en, app.iconRules)}<span class="fe-nm">${esc(name)}</span></a>${hit ? `<span class="badge fe-find-badge">${hit.count}</span>${renderHitSnippet(hit)}` : ''}
      </div>`);
      if (!en.isDir || !expanded) return;
      if (treeLoading.has(en.href)) { rows.push(emptyHtml('loading', 'Loading…', { inline: true, style: `padding-left:${34 + (depth + 1) * 20}px` })); return; }
      if (treeErrors.has(en.href)) { rows.push(emptyHtml('failed', 'This folder could not be read', { inline: true, hint: 'Collapse and expand it to try again', style: `padding-left:${34 + (depth + 1) * 20}px` })); return; }
      const children = treeChildren.get(en.href);
      if (!children) return;
      if (!children.length) rows.push(emptyHtml('empty', 'Empty folder', { inline: true, style: `padding-left:${34 + (depth + 1) * 20}px` }));
      for (const child of applySort(applyFilter(children, ls.filter, nameMatches ?? undefined), ls.sort)) {
        if (!ls.contentHits || ls.contentHits.has(child.href) || child.isDir) add(child, depth + 1);
      }
    };
    parent.forEach(en => add(en, 0));
    entries.forEach(en => add(en, 0));
    el('fe-tree').innerHTML = rows.join('');
  }

  // A big list draws only the rows near the viewport; one spacer row above
  // and one below stand in for the rest, so the scrollbar keeps its full
  // length. Small lists, and the tile and tree views, draw everything.
  const WINDOW_MIN = 300, OVERSCAN = 40;
  let win: { parts: string[]; idxOf: number[]; tops: number[]; total: number; a: number; b: number } | null = null;
  const firstAtOrAfter = (tops: number[], y: number) => {
    let lo = 0, hi = tops.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tops[mid] < y) lo = mid + 1; else hi = mid; }
    return lo;
  };
  function paintWindow(force = false): void {
    if (!win) return;
    const scroller = el('fe-scroll'), tbody = el('fe-tbody');
    const offset = tbody.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const top = scroller.scrollTop - offset;
    const n = win.parts.length;
    const a = Math.max(0, firstAtOrAfter(win.tops, top) - OVERSCAN);
    const b = Math.min(n, firstAtOrAfter(win.tops, top + scroller.clientHeight) + OVERSCAN);
    if (!force && a >= win.a && b <= win.b) return;
    win.a = Math.max(0, a - OVERSCAN); win.b = Math.min(n, b + OVERSCAN);
    const above = win.tops[win.a] ?? 0, below = win.total - (win.b < n ? win.tops[win.b] : win.total);
    const spacer = (h: number) => h > 0 ? `<tr class="fe-spacer" aria-hidden="true"><td colspan="6" style="height:${h}px"></td></tr>` : '';
    tbody.innerHTML = spacer(above) + win.parts.slice(win.a, win.b).join('') + spacer(below);
    paintSel();
  }
  // Row heights come from the rows themselves, so compact mode and zoom stay right.
  function measureWindow(): void {
    if (!win) return;
    const tbody = el('fe-tbody');
    tbody.innerHTML = win.parts.slice(0, 60).join('');
    const row = tbody.querySelector<HTMLElement>('tr[data-idx]')?.offsetHeight || 36;
    const hdr = tbody.querySelector<HTMLElement>('.fe-group-hdr')?.offsetHeight || row;
    let y = 0;
    win.tops = win.parts.map((part, i) => { const t = y; y += win!.idxOf[i] < 0 ? hdr : row; return t; });
    win.total = y; win.a = win.b = 0;
    paintWindow(true);
  }
  let windowFrame = 0;
  el('fe-scroll').addEventListener('scroll', () => {
    if (!win || windowFrame) return;
    windowFrame = requestAnimationFrame(() => { windowFrame = 0; paintWindow(); });
  }, { passive: true });

  function applyAll(): void {
    const parent  = all.filter(e => e.isParent);
    let entries   = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
    entries = applyFilter(entries, ls.filter, nameMatches ?? undefined);
    if (ls.contentHits) entries = entries.filter(e => ls.contentHits!.has(e.href));
    entries = applySort(entries, ls.sort);
    const c = ctx();
    const tbody = el('fe-tbody');
    const tiles = el('fe-tiles');
    ls.visible = [];
    // Only the view on screen is built; switching views redraws.
    const view = fe.dataset.view ?? 'details';
    const wantTiles = view === 'tiles' || view === 'icons', wantRows = !wantTiles && view !== 'tree';
    const showHidden = fe.classList.contains('show-hidden');
    const rowParts: string[] = [], tileParts: string[] = [], idxOf: number[] = [], hiddenRow: boolean[] = [];
    const pushEntry = (e: Entry) => {
      const idx = ls.visible.length;
      ls.visible.push(e);
      const hit = ls.contentHits?.get(e.href);
      if (wantRows) { rowParts.push(renderRow(e, c, idx, hit)); idxOf.push(idx); hiddenRow.push(e.isHidden); }
      if (wantTiles) tileParts.push(renderTile(e, c, idx, hit));
    };
    parent.forEach(pushEntry);
    if (ls.group !== 'none') {
      for (const g of buildGroups(entries, ls.group)) {
        if (wantRows) { rowParts.push(`<tr class="fe-group-hdr"><td colspan="6">${esc(g.label)}</td></tr>`); idxOf.push(-1); hiddenRow.push(false); }
        if (wantTiles) tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
        g.items.forEach(pushEntry);
      }
    } else {
      entries.forEach(pushEntry);
    }
    // A small list keeps hidden files' rows and hides them with CSS; a windowed
    // one leaves them out, because every drawn row must take up its height.
    const kept = rowParts.map((p, i) => showHidden || !hiddenRow[i] ? i : -1).filter(i => i >= 0);
    win = rowParts.length > WINDOW_MIN
      ? { parts: kept.map(i => rowParts[i]), idxOf: kept.map(i => idxOf[i]), tops: [], total: 0, a: 0, b: 0 }
      : null;
    if (win) measureWindow(); else tbody.innerHTML = rowParts.join('');
    tiles.innerHTML = tileParts.join('');
    fe.classList.toggle('fe-has-find-hits', !!ls.contentHits);
    if (fe.dataset.view === 'tree') {
      ls.visible = [];
      renderTree(entries, parent);
    }

    const shown = fe.dataset.view === 'tree' ? entries.length : ls.visible.filter(en => !en.isParent).length;
    const filtered = !!ls.filter.q || ls.filter.type !== 'all';
    if (ls.contentHits) {
      ls.baseStatus = `${shown} file${shown !== 1 ? 's' : ''} containing "${ls.contentText}"${ls.deepOn ? ` in ${ls.deepFolders} folders` : ''}`;
    } else if (ls.deepOn) {
      ls.baseStatus = ls.deepScanning
        ? `Scanning… ${ls.deepFolders} folder${ls.deepFolders !== 1 ? 's' : ''}`
        : `${shown} of ${ls.deepEntries?.length ?? 0} items in ${ls.deepFolders} folders${ls.deepTruncated ? ` (${ls.deepCap})` : ''}`;
    } else {
      ls.baseStatus = filtered
        ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? 's' : ''} shown`
        : countText();
    }
    if (!app.fileMode) el('fe-count').textContent = ls.baseStatus;   // a file page shows its line count there
    lastEntries = entries;
    paintEmpty();
    sel.setSel(-1);
  }
  // With no row to show, the listing says why: an empty folder, only hidden
  // files, or a filter that hides everything. Quiet while a search is running.
  let lastEntries: Entry[] = [];
  function paintEmpty(): void {
    const box = el('fe-empty');
    const showHidden = fe.classList.contains('show-hidden');
    const seen = lastEntries.filter(e => showHidden || !e.isHidden).length;
    const busy = ls.deepScanning || !!nameFilterAbort || app.fileMode;
    const filtered = !!ls.filter.q || ls.filter.type !== 'all' || !!ls.contentHits;
    box.hidden = busy || seen > 0;
    box.innerHTML = box.hidden ? ''
      : filtered ? emptyHtml('filtered', 'Nothing here matches', { actions: [CLEAR] })
      : lastEntries.length ? emptyHtml('empty', 'Only hidden files here', { hintHtml: 'Press <kbd>.</kbd> to show them' })
      : emptyHtml('empty', 'This folder is empty');
  }
  app.applyAll = applyAll;
  void loadOpenCounts(all).then(m => { if (m.size) { openComments = m; applyAll(); } });
  app.setOrder = (sort, group) => { ls.sort = { ...sort }; ls.group = group; syncSortUi(); applyAll(); };

  function refreshNameMatches(): void {
    nameFilterAbort?.abort();
    nameFilterAbort = null;
    nameFilterFailure = '';
    if (!ls.filter.regex || !ls.filter.q) {
      nameMatches = null;
      nameFilterReady = Promise.resolve();
      applyAll();
      return;
    }
    nameMatches = new Set();
    applyAll();
    const controller = new AbortController();
    nameFilterAbort = controller;
    const entries = [...nonPar, ...(ls.deepEntries ?? []), ...[...treeChildren.values()].flat()];
    nameFilterReady = filterNames(entries, ls.filter.q, controller.signal).then(matches => {
      if (nameFilterAbort !== controller) return;
      nameMatches = matches;
      nameFilterAbort = null;
      applyAll();
    }).catch(error => {
      if (nameFilterAbort !== controller) return;
      nameMatches = new Set();
      nameFilterAbort = null;
      nameFilterFailure = String(error instanceof Error ? error.message : error);
      applyAll();
      el('fe-count').textContent = nameFilterFailure;
    });
  }

  // Selection: selSet holds every selected visible index, selIdx the lead.
  const sel: Selection = {
    entryShown: en => !en.isHidden || fe.classList.contains('show-hidden'),
    selectable: i => { const en = ls.visible[i]; return !!en && !en.isParent && sel.entryShown(en); },
    setSel(i) {
      ls.selSet.clear();
      ls.selIdx = i; ls.anchor = i;
      if (i >= 0) ls.selSet.add(i);
      paintSel(); scrollToLead();
    },
    toggleSel(i) {
      if (ls.selSet.has(i)) ls.selSet.delete(i); else ls.selSet.add(i);
      ls.selIdx = i; ls.anchor = i;
      paintSel();
    },
    rangeSel(target) {
      const a = ls.anchor >= 0 ? ls.anchor : target;
      ls.selSet.clear();
      selectionRange(a, target).filter(sel.selectable).forEach(i => ls.selSet.add(i));
      ls.selIdx = target;
      paintSel(); scrollToLead();
    },
    selectAll() {
      ls.selSet.clear();
      for (let i = 0; i < ls.visible.length; i++) if (sel.selectable(i)) ls.selSet.add(i);
      if (ls.selSet.size && ls.selIdx < 0) ls.selIdx = [...ls.selSet][0];
      paintSel();
    },
    moveSel(step) {
      let i = ls.selIdx;
      for (let n = 0; n < ls.visible.length; n++) {
        i += step;
        if (i < 0 || i >= ls.visible.length) return;
        if (sel.entryShown(ls.visible[i])) { sel.setSel(i); return; }
      }
    },
    copySelection() {
      const paths = [...ls.selSet].sort((a, b) => a - b).map(i => fullPath(rawPath, ls.visible[i]));
      if (!paths.length) return;
      copyToClipboard(paths.join('\n')).then(() => toast(`Copied ${paths.length} path${paths.length !== 1 ? 's' : ''}`));
    },
    tryPreview(en) {
      if (canPreview(en)) { sel.setSel(ls.visible.indexOf(en)); openPreview(en); }
      else if (en.isDir || en.isParent) toast('Folders have no preview. Press Enter to open');
      else toast('No preview for this file type');
    },
    previewStep(step) {
      let i = ls.selIdx;
      for (let n = 0; n < ls.visible.length; n++) {
        i += step;
        if (i < 0 || i >= ls.visible.length) return;
        const en = ls.visible[i];
        if (sel.entryShown(en) && canPreview(en)) { sel.setSel(i); openPreview(en); return; }
      }
    },
  };
  function paintSel(): void {
    // Walk the drawn rows, not the selection: a select-all on a big folder
    // would otherwise run one query per selected entry.
    els<HTMLElement>('#fe-scroll [data-idx]').forEach(x => x.classList.toggle('selected', ls.selSet.has(Number(x.dataset.idx))));
    const t = el('fe-status-text');
    if (ls.selSet.size > 1) {
      t.textContent = `${ls.selSet.size} selected`;
    } else {
      const en = ls.selIdx >= 0 ? ls.visible[ls.selIdx] : null;
      t.textContent = en && !en.isParent
        ? (en.isDir ? `${en.name}/` : `${en.name} · ${fmtSize(en.rawBytes)}`)
        : app.fileMode ? '' : ls.baseStatus;   // a file page's facts live in #fe-status-meta
    }
  }
  function scrollToLead(): void {
    if (ls.selIdx < 0) return;
    // A row outside the drawn window is scrolled to first, then drawn.
    if (win && !el('fe-tbody').querySelector(`[data-idx="${ls.selIdx}"]`)) {
      const part = win.idxOf.indexOf(ls.selIdx);
      if (part >= 0) {
        const scroller = el('fe-scroll'), tbody = el('fe-tbody');
        const offset = tbody.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
        scroller.scrollTop = Math.max(0, offset + win.tops[part] - scroller.clientHeight / 2);
        paintWindow(true);
      }
    }
    els(`#fe-scroll [data-idx="${ls.selIdx}"]`).forEach(x => { if (x.offsetParent) x.scrollIntoView({ block: 'nearest' }); });
  }

  // The view switch, hidden files, zoom.
  el('fe-view-group').addEventListener('change', () => {
    const v = el<ValuedEl>('fe-view-group').value;
    fe.dataset.view = v;
    kvSet(VIEW_KEY, v);
    applyAll();
  });
  el('fe-tree').addEventListener('click', e => {
    const toggle = (e.target as HTMLElement).closest<HTMLButtonElement>('.fe-tree-toggle');
    if (!toggle) return;
    e.preventDefault(); e.stopPropagation();
    const url = toggle.dataset.url!;
    if (treeExpanded.delete(url)) {
      treeReaders.get(url)?.close();
      treeReaders.delete(url);
      treeLoading.delete(url);
      applyAll(); return;
    }
    treeExpanded.add(url);
    if (treeChildren.has(url) || treeLoading.has(url)) { applyAll(); return; }
    treeErrors.delete(url);
    treeLoading.add(url);
    applyAll();
    const absoluteUrl = new URL(url, location.href).href;
    const reader = new SearchFileReader();
    treeReaders.set(url, reader);
    reader.read(absoluteUrl).then(html => {
      if (treeReaders.get(url) !== reader) return;
      const children = parseListing(html, absoluteUrl).map(child => {
        const rel = child.href.startsWith(treeRootUrl)
          ? decodeURIComponent(child.href.slice(treeRootUrl.length)).replace(/\/$/, '')
          : child.name;
        return { ...child, name: rel, isHidden: rel.split('/').some(part => part.startsWith('.')) };
      });
      treeChildren.set(url, children);
      if (ls.filter.regex && ls.filter.q) refreshNameMatches();
    }).catch(() => { if (treeReaders.get(url) === reader) treeErrors.add(url); }).finally(() => {
      reader.close();
      if (treeReaders.get(url) !== reader) return;
      treeReaders.delete(url);
      treeLoading.delete(url);
      if (fe.dataset.view === 'tree') applyAll();
    });
  });
  const hiddenBtn = el('fe-hidden-btn');
  if (init.hidden) fe.classList.add('show-hidden');
  hiddenBtn.addEventListener('click', () => {
    const on = fe.classList.toggle('show-hidden');
    hiddenBtn.classList.toggle('on', on);
    hiddenBtn.title = `Hidden files: ${on ? 'showing' : 'hiding'} dotfiles and comment files · click to toggle`;
    kvSet(HIDDEN_KEY, String(on));
    toast(on ? `Showing ${hidden} hidden file${hidden !== 1 ? 's' : ''}` : 'Hidden files concealed');
    if (!app.fileMode) el('fe-count').textContent = ls.baseStatus = countText();
    if (win) applyAll();   // a windowed list leaves hidden files' rows out, so it is drawn again
    else paintEmpty();
  });
  upgradeControls(el('fe-toolbar'));
  upgradeControls(el('fe-sg-panel'));
  upgradeControls(el('fe-filter-bar'));
  el<ValuedEl>('fe-view-group').value = init.view;
  el<ValuedEl>('fe-type-filter').value = ls.filter.type;
  el<ValuedEl>('fe-find-depth').value = '8';
  // Detail: one scale from a few big items with names only to small items
  // with every fact. The styles key off data-density on #fe, per view.
  const density = el<ValuedEl>('fe-density');
  density.value = String(init.density);
  const setDensity = (d: number) => {
    const n = Math.max(1, Math.min(5, d));
    fe.dataset.density = String(n);
    density.value = String(n);
    kvSet(DENSITY_KEY, String(n));
    applyAll();   // rows change height, so a windowed list measures again
  };
  density.addEventListener('input', () => { fe.dataset.density = density.value; });
  density.addEventListener('change', () => setDensity(Number(density.value)));
  const scroll  = el('fe-scroll');
  // This Chrome tab remembers where each folder was scrolled to.
  const scrollKey = 'bfb-scroll:' + rawPath;
  try { const top = Number(sessionStorage.getItem(scrollKey)); if (top) scroll.scrollTop = top; } catch { /* fine */ }
  scroll.addEventListener('scroll', () => { try { sessionStorage.setItem(scrollKey, String(scroll.scrollTop)); } catch { /* fine */ } });

  // Sort state: panel controls, the Sort button's label, header arrows, storage.
  const sortCols = el<ValuedEl>('fe-sort-cols'), sortDir = el<ValuedEl>('fe-sort-dir'), groupSeg = el<ValuedEl>('fe-group-btns');
  const SORT_NAMES: Record<string, string> = { name: 'Name', size: 'Size', date: 'Modified', type: 'Type', ext: 'Extension' };
  function syncSortUi(): void {
    const { col, dir } = ls.sort;
    sortCols.value = col ?? '';
    sortDir.value = dir;
    el('fe-sg-cur').textContent = col ? `${SORT_NAMES[col]} ${dir === 'asc' ? '↑' : '↓'}` : 'Sort';
    els('th[data-sort]').forEach(h => {
      const on = h.dataset.sort === col;
      h.classList.toggle('sorted', on);
      h.querySelector('.si')!.textContent = on ? (dir === 'asc' ? '↑' : '↓') : '↕';
    });
    groupSeg.value = ls.group;
    saveSortConfig(ls.sort);
    saveGroupMode(ls.group);
  }
  function setSortCol(col: SortConfig['col']): void {
    if (ls.sort.col === col) ls.sort.dir = ls.sort.dir === 'asc' ? 'desc' : 'asc';
    else { ls.sort.col = col; ls.sort.dir = 'asc'; }
    syncSortUi();
    applyAll();
  }
  els('th[data-sort]').forEach(th => th.addEventListener('click', () => setSortCol(th.dataset.sort as SortConfig['col'])));

  // Column resize: drag handles on the Details headers. Once any width is set,
  // Modified (which has no handle) takes whatever room is left, so a drag
  // sticks both ways; double-click a handle to give a column its default back.
  const MIN_W = 48, LAST_MIN = 110;   // room for a date like "Oct 20, 2026"
  const lastTh = el('fe-table').querySelector<HTMLElement>('thead th.c-dt')!;
  const applyWidths = () => {
    const w = getColWidths();
    els('thead th[data-ck]').forEach(th => { const px = w[th.dataset.ck!]; th.style.width = px ? px + 'px' : ''; });
    lastTh.style.width = Object.keys(w).length ? 'auto' : '';
  };
  applyWidths();
  // A width saved in a wider window (or before there was a limit) can leave
  // no room for the rest; start over rather than show only Name.
  if (el('fe-table').offsetWidth && lastTh.offsetWidth < LAST_MIN) { saveColWidths({}); applyWidths(); }
  els('.fe-col-rz').forEach(handle => {
    handle.title = 'Drag to resize this column · double-click to reset';
    const th = handle.closest<HTMLElement>('th')!;
    const key = th.dataset.ck!;
    // The last column gives up its room, down to its own minimum.
    let maxW = Infinity;
    resizable(handle, {
      axis: 'x', label: `Resize the ${th.textContent?.trim() || 'column'} column`,
      size: () => { maxW = th.offsetWidth + Math.max(0, lastTh.offsetWidth - LAST_MIN); lastTh.style.width = 'auto'; return { w: th.offsetWidth, h: 0 }; },
      apply: w => { th.style.width = Math.min(maxW, Math.max(MIN_W, w)) + 'px'; },
      reset: () => { const widths = getColWidths(); delete widths[key]; saveColWidths(widths); applyWidths(); },
      commit: () => { if (!th.style.width || th.style.width === 'auto') return; const widths = getColWidths(); widths[key] = parseFloat(th.style.width); saveColWidths(widths); },
    });
  });

  // Sort and group panel.
  const sgPanel = el('fe-sg-panel');
  el('fe-sg-btn').addEventListener('click', () => {
    const open = sgPanel.style.display === 'none';
    sgPanel.style.display = open ? '' : 'none';
    el('fe-sg-btn').classList.toggle('on', open);
    el('fe-sg-btn').setAttribute('aria-expanded', String(open));
  });
  sortCols.addEventListener('change', () => {
    ls.sort.col = (sortCols.value || null) as SortConfig['col'];
    syncSortUi();
    applyAll();
  });
  sortDir.addEventListener('change', () => {
    ls.sort.dir = sortDir.value as SortConfig['dir'];
    if (!ls.sort.col) ls.sort.col = 'name';   // a direction implies a column
    syncSortUi();
    applyAll();
  });
  groupSeg.addEventListener('change', () => {
    ls.group = groupSeg.value as GroupMode;
    syncSortUi();
    applyAll();
  });
  syncSortUi();

  // Filter bar: name, regex, type, and the text-inside-files pass.
  const filterBar = el('fe-filter-bar');
  el('fe-filter-btn').addEventListener('click', () => {
    const open = filterBar.style.display === 'none';
    filterBar.style.display = open ? '' : 'none';
    el('fe-filter-btn').classList.toggle('on', open);
    el('fe-filter-btn').setAttribute('aria-expanded', String(open));
    if (open) el<HTMLInputElement>('fe-filter-q').focus();
  });
  el<HTMLInputElement>('fe-filter-q').addEventListener('input', function () { stopFind(); ls.filter.q = this.value; refreshNameMatches(); });
  el('fe-regex-btn').addEventListener('click', function () {
    stopFind();
    ls.filter.regex = !ls.filter.regex;
    (this as HTMLElement).classList.toggle('active', ls.filter.regex);
    (this as HTMLElement).setAttribute('aria-pressed', String(ls.filter.regex));
    (this as HTMLElement).title = ls.filter.regex ? 'Regex mode on' : 'Toggle regex mode';
    refreshNameMatches();
  });
  el<HTMLSelectElement>('fe-type-filter').addEventListener('change', function () { stopFind(); ls.filter.type = this.value; applyAll(); });

  const findText   = el<HTMLInputElement>('fe-find-text');
  const findCase   = el<HTMLInputElement>('fe-find-case');
  const findRegex  = el<HTMLInputElement>('fe-find-text-regex');
  const findDepth  = el<HTMLSelectElement>('fe-find-depth');
  const findStatus = el('fe-find-status');
  const findError  = el('fe-find-error');
  const findCancel = el('fe-find-cancel');
  function stopFind(): void {
    ls.findSeq++;
    findSession?.close();
    findSession = null;
    ls.pendingFindText = null;
    ls.contentHits = null;
    findCancel.style.display = 'none';
    findStatus.textContent = '';
  }
  function currentFind(): FindQuery {
    const type = ls.filter.type;
    return {
      scope: ls.deepOn ? 'deep' : 'here',
      name: ls.filter.q, regex: ls.filter.regex,
      exts: ['all', 'folders', 'files'].includes(type) ? [] : [type],
      kind: type === 'folders' || type === 'files' ? type : undefined,
      text: findText.value.trim(), caseSensitive: findCase.checked,
      textRegex: findRegex.checked, maxDepth: Number(findDepth.value) || 8,
    };
  }
  async function runFind(text: string): Promise<void> {
    findSession?.close();
    const seq = ++ls.findSeq;
    findSession = null;
    ls.contentText = text;
    findError.textContent = '';
    ls.contentHits = null;
    applyAll();
    if (!text) { findStatus.textContent = ''; findCancel.style.display = 'none'; return; }
    const query = { ...currentFind(), text };
    const patternError = textPatternError(query);
    if (patternError) { findError.textContent = patternError; findStatus.textContent = ''; findCancel.style.display = 'none'; return; }
    if (ls.deepOn && ls.deepScanning) {
      ls.pendingFindText = text;
      findStatus.textContent = 'waiting for the folder scan…';
      findCancel.style.display = '';
      findCancel.onclick = () => {
        ls.pendingFindText = null;
        ls.deepSeq++;
        deepReader?.close(); deepReader = null;
        ls.deepScanning = false; ls.deepOn = false;
        deepBtn.classList.remove('on');
        el('fe-find-depth-wrap').style.display = 'none';
        findCancel.style.display = 'none';
        findStatus.textContent = 'stopped before scanning';
        applyAll();
      };
      return;
    }
    if (ls.filter.regex && ls.filter.q) {
      await nameFilterReady;
      if (seq !== ls.findSeq) return;
      if (nameFilterFailure) { findError.textContent = nameFilterFailure; findCancel.style.display = 'none'; return; }
    }
    const source = ls.deepOn && ls.deepEntries ? ls.deepEntries : nonPar;
    const candidates = applyFilter(source, ls.filter, nameMatches ?? undefined).filter(isTextCandidate);
    findStatus.textContent = `scanning 0/${candidates.length}`;
    findCancel.style.display = '';
    let session: SearchSession;
    let cancelled = false;
    findCancel.onclick = () => { cancelled = true; session?.close(); findStatus.textContent = 'stopping…'; };
    try { session = await SearchSession.open(); }
    catch (error) {
      if (seq !== ls.findSeq) return;
      findCancel.style.display = 'none';
      findError.textContent = `Search could not start: ${String(error)}`;
      return;
    }
    if (seq !== ls.findSeq) { session.close(); return; }
    if (cancelled) session.close();
    findSession = session;
    const r = await searchContents(candidates, session.read, query,
      (d, t) => { if (seq === ls.findSeq) findStatus.textContent = `scanning ${d}/${t}`; },
      () => cancelled || session.dead || seq !== ls.findSeq, 4, session.match);
    const failure = session.failure;
    session.close();
    if (findSession === session) findSession = null;
    if (seq !== ls.findSeq) return;
    findCancel.style.display = 'none';
    ls.contentHits = r.hits;
    findStatus.textContent = `${r.hits.size} matching file${r.hits.size === 1 ? '' : 's'} of ${r.scanned} scanned${r.failed ? `, ${r.failed} unreadable or timed out` : ''}${r.cancelled ? ' (partial, stopped)' : ''}`;
    if (failure && failure !== 'search stopped') findError.textContent = failure;
    applyAll();
  }
  el('fe-find-run').addEventListener('click', () => void runFind(findText.value.trim()));
  findText.addEventListener('input', () => { stopFind(); findError.textContent = ''; applyAll(); });
  findRegex.addEventListener('change', () => { stopFind(); findError.textContent = ''; applyAll(); });
  findCase.addEventListener('change', () => { stopFind(); applyAll(); });
  findText.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); void runFind(findText.value.trim()); }
    else if (e.key === 'Escape') { e.stopPropagation(); findText.value = ''; void runFind(''); }
  });
  el('fe-find-save').addEventListener('click', () => {
    const q = currentFind();
    const hash = findToHash(q);
    if (!hash) { toast('Set a name, type, text or deep scope first'); return; }
    saveSaved(upsertPlace(getSaved(), { path: rawPath + hash, label: describeFind(q) }));
    app.refreshSaved();
    toast('View saved');
  });
  // A saved view arrives as a hash on the folder URL; apply it, including
  // when only the hash changes on an already open page.
  function applyFindFromHash(): void {
    const q = findFromHash(location.hash);
    if (!q) { if (location.hash.startsWith('#find=')) toast('This saved view link is damaged, so the folder shows unfiltered'); return; }
    ls.filter.q = q.name; ls.filter.regex = q.regex;
    ls.filter.type = q.kind ?? (q.exts.length === 1 ? q.exts[0] : 'all');
    el<HTMLInputElement>('fe-filter-q').value = q.name;
    el<HTMLInputElement>('fe-search').value = q.name;
    el('fe-regex-btn').classList.toggle('active', q.regex);
    el('fe-regex-btn').setAttribute('aria-pressed', String(q.regex));
    // A view saved elsewhere can name an extension this folder lacks; list it so it reads ".rs".
    const typeDd = el<DropdownEl>('fe-type-filter');
    const typeOpts: Opt[] = JSON.parse(typeDd.dataset.opts || '[]');
    if (!typeOpts.some(o => o.value === ls.filter.type)) typeDd.setOptions([...typeOpts, { value: ls.filter.type, label: '.' + ls.filter.type }]);
    typeDd.value = ls.filter.type;
    findText.value = q.text; findCase.checked = q.caseSensitive;
    findRegex.checked = q.textRegex;
    findDepth.value = String(q.maxDepth);
    filterBar.style.display = ''; el('fe-filter-btn').classList.add('on');
    if ((q.scope === 'deep') !== ls.deepOn) deepBtn.click();
    ls.contentHits = null;
    refreshNameMatches();
    if (q.text) { if (ls.deepOn && (ls.deepScanning || !ls.deepEntries)) ls.pendingFindText = q.text; else void runFind(q.text); }
  }
  window.addEventListener('hashchange', applyFindFromHash);

  // Deep search: the listing source becomes the crawled subtree.
  const deepBtn = el('fe-deep-btn');
  const searchEl = el<HTMLInputElement>('fe-search');
  function startDeepCrawl(): void {
    deepReader?.close();
    const seq = ++ls.deepSeq;
    ls.deepScanning = true;
    let reader: SearchFileReader;
    try { reader = new SearchFileReader(); }
    catch (error) { ls.deepScanning = false; findError.textContent = `Folder scan could not start: ${String(error)}`; return; }
    deepReader = reader;
    let scanFailures = 0;
    crawl(
      treeRootUrl,
      url => reader.read(url).then(html => parseListing(html, url)).catch(error => {
        scanFailures++;
        if (seq === ls.deepSeq) findError.textContent = `Could not read ${scanFailures} folder${scanFailures === 1 ? '' : 's'}: ${String(error)}`;
        throw error;
      }),
      {
        maxDepth: Number(findDepth.value) || 8,
        includeHidden: fe.classList.contains('show-hidden'),
        onProgress: f => { if (seq === ls.deepSeq) { ls.deepFolders = f; applyAll(); } },
      },
      () => seq !== ls.deepSeq,
    ).then(r => {
      reader.close();
      if (deepReader === reader) deepReader = null;
      if (seq !== ls.deepSeq) return;
      // Name the limit that stopped it, so "0 found" is not read as "not there".
      ls.deepCap = [r.entryCapped ? 'stopped at 5,000 items' : '', r.depthCapped ? `not deeper than ${findDepth.value} level${findDepth.value === '1' ? '' : 's'}` : ''].filter(Boolean).join(', ');
      ls.deepEntries = r.entries; ls.deepFolders = r.folders; ls.deepTruncated = r.truncated;
      ls.deepScanning = false;
      refreshNameMatches();
      if (r.truncated) toast(`Deep search ${ls.deepCap}`);
      if (ls.pendingFindText !== null) { const t = ls.pendingFindText; ls.pendingFindText = null; void runFind(t); }
    });
  }
  deepBtn.addEventListener('click', () => {
    stopFind();
    ls.deepOn = !ls.deepOn;
    deepBtn.classList.toggle('on', ls.deepOn);
    el('fe-find-depth-wrap').style.display = ls.deepOn ? '' : 'none';
    searchEl.placeholder = ls.deepOn ? 'Search subfolders' : 'Filter';
    if (ls.deepOn) { if (!ls.deepEntries) startDeepCrawl(); else refreshNameMatches(); searchEl.focus(); }
    else { ls.deepSeq++; deepReader?.close(); deepReader = null; ls.deepScanning = false; refreshNameMatches(); }
  });
  findDepth.addEventListener('change', () => {
    stopFind();
    ls.deepEntries = null;
    if (ls.deepOn) startDeepCrawl();
    else applyAll();
  });

  // The quick filter box mirrors the filter bar's name field.
  searchEl.addEventListener('input', function () {
    stopFind();
    ls.filter.q = this.value;
    el<HTMLInputElement>('fe-filter-q').value = this.value;
    refreshNameMatches();
  });
  searchEl.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (searchEl.value) {
      searchEl.value = '';
      ls.filter.q = '';
      el<HTMLInputElement>('fe-filter-q').value = '';
      refreshNameMatches();
    }
    searchEl.blur();
  });
  // The empty listing's Clear drops every filter: name, type and text search.
  el('fe-empty').addEventListener('click', e => {
    if ((e.target as Element).closest<HTMLElement>('[data-a]')?.dataset.a !== 'clear') return;
    stopFind();
    findText.value = '';
    searchEl.value = ls.filter.q = '';
    el<HTMLInputElement>('fe-filter-q').value = '';
    ls.filter.type = 'all';
    el<DropdownEl>('fe-type-filter').value = 'all';
    refreshNameMatches();
    searchEl.focus();
  });
  window.addEventListener('pagehide', () => {
    nameFilterAbort?.abort();
    findSession?.close();
    deepReader?.close();
    for (const reader of treeReaders.values()) reader.close();
    treeReaders.clear();
  });

  return { ls, sel, applyAll, applyFindFromHash };
}
