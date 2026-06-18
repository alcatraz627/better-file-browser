import type { SortConfig, FilterConfig, GroupMode } from './types';
import { parseEntries, parseListing } from './parse';
import { getExt, fmtSize, fullPath, copyToClipboard } from './utils';
import { esc } from './utils';
import { icoCustom, PI } from './icons';
import {
  BM_KEY, VIEW_KEY, THEME_KEY, ZOOM_KEY, HIDDEN_KEY,
  ICON_RULES_KEY, SETTINGS_KEY, TERMINAL_CMDS, DEFAULT_ICON_RULES,
  getBM, saveBM, toggleBM, getView, getTheme, getZoom, getShowHidden,
  getIconRules, saveIconRules, getSettings, saveSettings,
  getRecents, pushRecent, getColWidths, saveColWidths,
  getPlaces, savePlaces,
} from './storage';
import { upsertPlace, removePlace, renamePlace, movePlace } from './places';
import {
  initPreview, openPreview, closePreview, isPreviewOpen, canPreview,
} from './preview';
import { fetchFileText } from './file-fetch';
import { llmAvailability, llmWarm, type LlmAvailability } from './llm';
import { selectionRange } from './selection';
import { renderMarkdown } from './renderers';
import { HELP_MD } from './help';
import { CSS } from './styles';
import type { Entry } from './types';
import { applyFilter, applySort, buildGroups } from './sort-filter';
import {
  renderRows, renderTiles, renderBMList, renderPlacesList, renderCrumbs,
  renderRow, renderTile, type RenderContext,
} from './render';
import { getIcon } from './icons';

(function () {
  const preload = document.getElementById('bfb-preload');
  if (!document.title.startsWith('Index of')) {
    preload?.remove();
    return;
  }

  const rawPath  = decodeURIComponent(window.location.pathname);
  const segments = rawPath.split('/').filter(Boolean);

  const ALL_ENTRIES = parseEntries();

  // Chrome's listing no longer includes a "../" table row (the parent link
  // lives outside the table now) — synthesize one so the Parent Directory
  // row and up-navigation keep working.
  if (segments.length && !ALL_ENTRIES.some(e => e.isParent)) {
    const parentSegs = segments.slice(0, -1);
    ALL_ENTRIES.unshift({
      name: '..',
      href: 'file:///' + parentSegs.map(encodeURIComponent).join('/') + (parentSegs.length ? '/' : ''),
      isDir: true, isParent: true, isHidden: false, rawBytes: -1, dateMs: NaN, dateStr: '',
    });
  }

  let sortConfig:   SortConfig   = { col: null, dir: 'asc' };
  let groupConfig:  GroupMode    = 'none';
  let filterConfig: FilterConfig = { q: '', regex: false, type: 'all' };

  let iconRules = getIconRules();
  let settings  = getSettings();

  function getRenderCtx(): RenderContext {
    return { rawPath, iconRules, settings };
  }

  // The currently rendered entries, in on-screen order. data-idx attributes
  // index into this array — it's what keyboard selection and the context
  // menu resolve against.
  let VISIBLE: Entry[] = ALL_ENTRIES;
  let baseStatus = '';   // count line shown when nothing is selected

  function applyAll(): void {
    const parent  = ALL_ENTRIES.filter(e => e.isParent);
    let entries   = ALL_ENTRIES.filter(e => !e.isParent);
    entries = applyFilter(entries, filterConfig);
    entries = applySort(entries, sortConfig);
    const ctx = getRenderCtx();

    const tbody = document.getElementById('fe-tbody')!;
    const tiles = document.getElementById('fe-tiles')!;

    VISIBLE = [];
    const rowParts: string[] = [], tileParts: string[] = [];
    const pushEntry = (e: Entry) => {
      const idx = VISIBLE.length;
      VISIBLE.push(e);
      rowParts.push(renderRow(e, ctx, idx));
      tileParts.push(renderTile(e, ctx, idx));
    };

    parent.forEach(pushEntry);
    if (groupConfig !== 'none') {
      for (const g of buildGroups(entries, groupConfig)) {
        rowParts.push(`<tr class="fe-group-hdr"><td colspan="4">${esc(g.label)}</td></tr>`);
        tileParts.push(`<div class="fe-group-hdr-tile">${esc(g.label)}</div>`);
        g.items.forEach(pushEntry);
      }
    } else {
      entries.forEach(pushEntry);
    }
    tbody.innerHTML = rowParts.join('');
    tiles.innerHTML = tileParts.join('');

    const shown = VISIBLE.filter(en => !en.isParent).length;
    const filtered = !!filterConfig.q || filterConfig.type !== 'all';
    baseStatus = filtered
      ? `${shown} of ${nonPar.length} item${nonPar.length !== 1 ? 's' : ''} shown`
      : `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`;
    document.getElementById('fe-count')!.textContent = baseStatus;
    setSel(-1);
  }

  // ── Counts ────────────────────────────────────────────────────────
  const nonPar  = ALL_ENTRIES.filter(e => !e.isParent);
  const dirs    = nonPar.filter(e => e.isDir).length;
  const files   = nonPar.filter(e => !e.isDir).length;
  const hidden  = nonPar.filter(e => e.isHidden).length;
  const allExts = [...new Set(nonPar.filter(e => !e.isDir && getExt(e)).map(getExt))].sort();
  const extOpts = allExts.map(x => `<option value="${x}">.${x}</option>`).join('');

  baseStatus = `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`;

  const initZoom   = getZoom();
  const initView   = getView();
  const initTheme  = getTheme();
  const initHidden = getShowHidden();
  const initBM     = getBM();
  const curIsBookmarked = initBM.some(b => b.path === rawPath);

  const VIEW_MODES = [
    { id: 'details', label: 'Details',     ico: `<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: 'list',    label: 'List',        ico: `<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: 'tiles',   label: 'Tiles',       ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
    { id: 'icons',   label: 'Large Icons', ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` },
  ] as const;

  const VIEW_LABELS: Record<string, string> = {
    details: 'Full table — Name, Type, Size, Modified',
    list:    'Compact single-column rows',
    tiles:   'Medium icon grid with filename below',
    icons:   'Large icon grid',
  };

  const viewBtnsHTML = VIEW_MODES.map(v =>
    `<button class="fe-view-btn" data-view="${v.id}" title="${v.label} view — ${VIEW_LABELS[v.id]}${v.id === initView ? ' (active)' : ''}">${v.ico}</button>`
  ).join('');

  const FINDER_FAVORITES = [
    { label: 'Screenshots',         icon: 'scrnsh', href: 'file:///Users/alcatraz627/Pictures/Screenshots/' },
    { label: 'Downloads',           icon: 'down',   href: 'file:///Users/alcatraz627/Downloads/' },
    { label: 'Documents',           icon: 'docs',   href: 'file:///Users/alcatraz627/Documents/' },
    { label: 'Code',                icon: 'code',   href: 'file:///Users/alcatraz627/Code/' },
    { label: 'Versable',            icon: 'folder', href: 'file:///Users/alcatraz627/Code/Versable/' },
    { label: 'enhancement-product', icon: 'folder', href: 'file:///Users/alcatraz627/Code/Versable/enhancement-product/' },
    { label: 'Applications',        icon: 'apps',   href: 'file:///Applications/' },
    { label: 'Pictures',            icon: 'pics',   href: 'file:///Users/alcatraz627/Pictures/' },
    { label: 'Desktop',             icon: 'desk',   href: 'file:///Users/alcatraz627/Desktop/' },
    { label: 'resumes',             icon: 'docs',   href: 'file:///Users/alcatraz627/Code/Claude/resumes/' },
  ];

  // Snapshot history BEFORE recording this visit so the list shown
  // excludes the directory we're currently in.
  const recents = getRecents().filter(r => r.path !== rawPath).slice(0, 6);
  pushRecent(rawPath);
  const recentsHTML = recents.length ? `
      <div class="fe-sec">
        <div class="fe-sh">Recent</div>
        ${recents.map(r => {
          const lbl = r.path.split('/').filter(Boolean).pop() || '/';
          return `<a href="file://${esc(r.path)}" class="fe-si" title="${esc(r.path)}">${PI.recent}<span class="fe-sl">${esc(lbl)}</span></a>`;
        }).join('')}
      </div>` : '';

  const ctx0 = getRenderCtx();

  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-view="${initView}">

  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs(rawPath, segments)}</div>
    <button id="fe-term-btn" title="Open in terminal (${settings.terminalApp || 'ghostty'}) — Click to open current folder · Shift+click copies command"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" class="${curIsBookmarked ? 'on' : ''}" title="${curIsBookmarked ? 'Remove bookmark for this folder' : 'Bookmark this folder — saved in sidebar'}">
      <svg width="13" height="13" viewBox="0 0 13 13"><path id="fe-bm-path" d="M2.5 1h8v11l-4-2.8L2.5 12z" fill="${curIsBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
    </button>
    <button id="fe-theme-btn" title="Toggle theme — currently ${initTheme === 'light' ? 'Light' : 'Dark'}">
      <svg id="fe-sun" width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="2.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1 1M10.1 10.1l1 1M10.1 2.9l-1 1M3.9 10.1l-1 1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      <svg id="fe-moon" width="14" height="14" viewBox="0 0 14 14"><path d="M11.5 8.5A5 5 0 0 1 5.5 2.5a5 5 0 1 0 6 6z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
    <button id="fe-help-btn" title="Help — what's here and how to use it">
      <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.2 5.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.6-.8 1.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="7" cy="10.3" r="0.9" fill="currentColor"/></svg>
    </button>
    <button id="fe-settings-btn" title="Settings — customize theme, views, terminal, icon rules">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh">Bookmarks</div>
        <div id="fe-bm-list">${renderBMList(initBM, rawPath)}</div>
      </div>
      <div class="fe-sec">
        <div class="fe-sh" style="justify-content:space-between">My Places
          <button id="fe-pl-add" title="Add this folder to Places">+</button></div>
        <div id="fe-pl-list">${renderPlacesList(getPlaces(), rawPath)}</div>
      </div>${recentsHTML}
      <div class="fe-sec">
        <div class="fe-sh">Finder Favorites</div>
        ${FINDER_FAVORITES.map(p =>
          `<a href="${p.href}" class="fe-si${p.href.replace(/\/$/, '') === 'file://' + rawPath.replace(/\/$/, '') ? ' active' : ''}" title="${p.label}\n${p.href}">${(PI[p.icon] ?? PI.folder)}<span class="fe-sl">${p.label}</span></a>`
        ).join('')}
      </div>
      <div class="fe-sec">
        <div class="fe-sh">System</div>
        <a href="file:///" class="fe-si" title="Root\nfile:///">${PI.root}<span class="fe-sl">Root /</span></a>
        <a href="file:///Users/alcatraz627/" class="fe-si" title="Home\nfile:///Users/alcatraz627/">${PI.home}<span class="fe-sl">Home</span></a>
      </div>
    </nav>

    <div id="fe-main">
      <div id="fe-toolbar">
        <span id="fe-count">${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" title="Sort &amp; Group — Click to toggle sort/group panel">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11M2 5h9M3.5 8h6M5.5 11h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Sort
          </button>
          <button id="fe-filter-btn" title="Filter — Filter by filename pattern or file type">
            <svg width="13" height="12" viewBox="0 0 13 12"><path d="M1 2h11l-4.5 5v4l-2-1V7z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button id="fe-hidden-btn" class="${initHidden ? 'on' : ''}" title="Hidden files — Currently: ${initHidden ? 'showing' : 'hiding'} dotfiles · Click to toggle">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom — Scale the file list (50–320%) · Currently: ${initZoom}% · Drag slider to adjust">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% — drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <input id="fe-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false" title="Quick filter — Type to filter files by name in any view"/>
        </div>
      </div>

      <div id="fe-sg-panel" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Sort by</span>
          <div class="fe-btn-group" id="fe-sort-cols">
            <button class="fe-pbn active" data-col="name" title="Sort by name (A–Z or Z–A)">Name</button>
            <button class="fe-pbn" data-col="size" title="Sort by file size">Size</button>
            <button class="fe-pbn" data-col="date" title="Sort by last modified date">Modified</button>
            <button class="fe-pbn" data-col="type" title="Sort by file type (folder, JS, image…)">Type</button>
            <button class="fe-pbn" data-col="ext" title="Sort alphabetically by file extension">Extension</button>
          </div>
          <button class="fe-pbn" id="fe-sort-dir" title="Toggle sort direction (ascending / descending)">↑ Asc</button>
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Group by</span>
          <div class="fe-btn-group" id="fe-group-btns">
            <button class="fe-pbn active" data-group="none" title="No grouping — flat list">None</button>
            <button class="fe-pbn" data-group="folders-first" title="Show all folders above files">Folders first</button>
            <button class="fe-pbn" data-group="files-first" title="Show all files above folders">Files first</button>
            <button class="fe-pbn" data-group="ext" title="Group items by file extension">Extension</button>
            <button class="fe-pbn" data-group="type" title="Group items by broad file type (image, video, code…)">Type</button>
          </div>
        </div>
      </div>

      <div id="fe-filter-bar" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Name</span>
          <input id="fe-filter-q" type="text" placeholder="pattern…" autocomplete="off" spellcheck="false" title="Filter by name — supports plain text or regex (enable .* button)"/>
          <button id="fe-regex-btn" class="fe-pbn" title="Toggle regex mode — when active, pattern is treated as a regular expression">.*</button>
          <span class="fe-panel-lbl" style="margin-left:12px">Type</span>
          <select id="fe-type-filter" title="Filter by file type — show only folders, files, or a specific extension">
            <option value="all">All types</option>
            <option value="folders">Folders only</option>
            <option value="files">Files only</option>
            ${extOpts}
          </select>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name">Name <span class="si">↕</span><span class="fe-col-rz"></span></th>
              <th class="c-tp" data-ck="tp">Type<span class="fe-col-rz"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size">Size <span class="si">↕</span><span class="fe-col-rz"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date">Modified <span class="si">↕</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
      </div>

      <div id="fe-statusbar">
        <span id="fe-status-text">${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}</span>
        <span id="fe-status-path">${rawPath}</span>
      </div>
    </div>
  </div>

  <div id="fe-crumb-menu"></div>
  <div id="fe-tip"></div>
  <div id="fe-toast"></div>

  <div id="fe-settings-modal" style="display:none">
    <div id="fe-settings-bg"></div>
    <div id="fe-settings-dialog">
      <div id="fe-settings-hdr">
        <span>Settings</span>
        <button id="fe-settings-close" title="Close">✕</button>
      </div>
      <div id="fe-settings-body">

        <div class="fe-st-section">
          <div class="fe-st-title">Theme</div>
          <div class="fe-st-row">
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="dark"> Dark</label>
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="light"> Light</label>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title">Appearance</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Default view</span>
            <select id="fe-st-defview" class="fe-st-select">
              <option value="details">Details</option>
              <option value="list">List</option>
              <option value="tiles">Tiles</option>
              <option value="icons">Large Icons</option>
            </select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-compact"> Compact mode</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sidebar"> Show sidebar</label>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Date format</span>
            <select id="fe-st-datefmt" class="fe-st-select">
              <option value="short">Short — Apr 17</option>
              <option value="full">Full — April 17, 2025</option>
            </select>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title">Terminal</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="Which terminal app to open when clicking the terminal button">Open with</span>
            <select id="fe-st-terminal" class="fe-st-select" title="Terminal app to open current folder in">
              <option value="ghostty">Ghostty (native host)</option>
              <option value="terminal">Terminal.app</option>
              <option value="iterm">iTerm2</option>
              <option value="wezterm">WezTerm</option>
              <option value="kitty">Kitty</option>
              <option value="custom">Custom command…</option>
            </select>
          </div>
          <div class="fe-st-row" id="fe-st-term-custom-row" style="display:none">
            <input type="text" id="fe-st-term-custom" class="fe-st-input" placeholder='open -a MyTerm "\${p}"' title='Shell command template. Use \${p} as placeholder for the folder path.'>
          </div>
          <div class="fe-st-hint" id="fe-st-term-hint" style="font-size:11px;color:var(--dm);margin-top:-4px"></div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Local Model (AI)</span>
            <button id="fe-st-ai-refresh" class="fe-pbn" title="Re-check the lm server status">↻ Refresh</button>
          </div>
          <div id="fe-st-ai-card">
            <div class="fe-st-ai-head">
              <span class="fe-st-ai-blink"><span class="dot"></span></span>
              <span class="fe-st-ai-state">Checking…</span>
            </div>
            <div class="fe-st-ai-grid" id="fe-st-ai-grid"></div>
            <div class="fe-st-ai-controls" id="fe-st-ai-controls" style="display:none">
              <span class="fe-st-lbl">Model</span>
              <select id="fe-st-ai-model" class="fe-st-select" title="Model used for AI queries (-m)"></select>
              <button id="fe-st-ai-warm" class="fe-pbn" title="Keep the model resident (lm warm)"></button>
            </div>
            <div class="fe-st-ai-hint" id="fe-st-ai-hint"></div>
          </div>
        </div>

        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Custom Icon Rules</span>
            <button id="fe-st-add-rule" class="fe-pbn">+ Add rule</button>
          </div>
          <div class="fe-st-rules-hint">Regex matched against filename (case-insensitive). Rules override built-in icons.</div>
          <div class="fe-st-rules-cols">
            <span></span><span></span>
            <span class="fe-st-col-lbl">Pattern (regex)</span>
            <span class="fe-st-col-lbl">Label</span>
            <span class="fe-st-col-lbl">Color</span>
            <span></span>
          </div>
          <div id="fe-st-rules-list"></div>
          <button id="fe-st-reset-rules" class="fe-pbn" style="margin-top:8px;align-self:flex-start;color:#f85149;border-color:#f8514940">Reset to defaults</button>
        </div>

      </div>
    </div>
  </div>

  <div id="fe-help-modal" style="display:none">
    <div id="fe-help-bg"></div>
    <div id="fe-help-dialog">
      <div id="fe-help-hdr">
        <span>Help &amp; shortcuts</span>
        <button id="fe-help-close" title="Close (Esc)">✕</button>
      </div>
      <div id="fe-help-body"></div>
    </div>
  </div>
</div>`;



  // ── Inject DOM ────────────────────────────────────────────────────
  const dirName  = segments[segments.length - 1] || '/';
  const shortDir = dirName.length > 20 ? dirName.slice(0, 20) + '…' : dirName;
  document.title = `${shortDir} | Better File Browser`;
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%230d1117"/><path d="M3 12.5A1.5 1.5 0 0 1 4.5 11h5.5l2.5 3H28a1.5 1.5 0 0 1 1.5 1.5V24A1.5 1.5 0 0 1 28 25.5H4.5A1.5 1.5 0 0 1 3 24z" fill="%234a9eff"/><path d="M9 18.5h14M9 22h9" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.75"/></svg>`;
  document.head.innerHTML = `<meta charset="utf-8"><title>${document.title}</title><link rel="icon" href="data:image/svg+xml,${faviconSvg}">`;
  document.body.innerHTML = PAGE_HTML;
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
  preload?.remove();

  const fe = document.getElementById('fe')!;

  if (!settings.showSidebar) (document.getElementById('fe-side') as HTMLElement).style.display = 'none';
  if (settings.compactMode) fe.classList.add('compact');

  initPreview({ iconRules: () => iconRules, aiModel: () => settings.aiModel });

  // ── Toast ─────────────────────────────────────────────────────────
  const toastEl = document.getElementById('fe-toast') as HTMLElement & { _tid?: ReturnType<typeof setTimeout> };
  function toast(msg: string, ms = 2400): void {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._tid);
    toastEl._tid = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // ── View buttons ──────────────────────────────────────────────────
  document.querySelectorAll<HTMLButtonElement>('.fe-view-btn').forEach(btn => {
    if (btn.dataset.view === initView) btn.classList.add('active');
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fe-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      (fe as HTMLElement & { dataset: DOMStringMap }).dataset.view = btn.dataset.view!;
      localStorage.setItem(VIEW_KEY, btn.dataset.view!);
    });
  });

  // ── Hidden files ──────────────────────────────────────────────────
  const hiddenBtn = document.getElementById('fe-hidden-btn')!;
  if (initHidden) fe.classList.add('show-hidden');
  hiddenBtn.addEventListener('click', () => {
    const on = fe.classList.toggle('show-hidden');
    hiddenBtn.classList.toggle('on', on);
    hiddenBtn.title = `Hidden files — Currently: ${on ? 'showing' : 'hiding'} dotfiles · Click to toggle`;
    localStorage.setItem(HIDDEN_KEY, String(on));
    toast(on ? `Showing ${hidden} hidden file${hidden !== 1 ? 's' : ''}` : 'Hidden files concealed');
  });

  // ── Zoom ──────────────────────────────────────────────────────────
  const zoomEl  = document.getElementById('fe-zoom') as HTMLInputElement;
  const zoomVal = document.getElementById('fe-zoom-val')!;
  const scroll  = document.getElementById('fe-scroll')!;
  zoomEl.addEventListener('input', () => {
    const z = parseInt(zoomEl.value);
    (scroll as HTMLElement & { style: CSSStyleDeclaration }).style.zoom = String(z / 100);
    zoomVal.textContent = z + '%';
    zoomEl.title = `Zoom: ${z}% — drag to scale`;
    document.getElementById('fe-zoom-wrap')!.title = `Zoom — Scale the file list (50–320%) · Currently: ${z}% · Drag slider to adjust`;
    localStorage.setItem(ZOOM_KEY, String(z));
  });

  // ── Column sort (header clicks) ───────────────────────────────────
  document.querySelectorAll<HTMLElement>('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort as SortConfig['col'];
      if (sortConfig.col === col) sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
      else { sortConfig.col = col; sortConfig.dir = 'asc'; }
      document.querySelectorAll('#fe-sort-cols .fe-pbn').forEach(b =>
        (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset.col === col));
      document.getElementById('fe-sort-dir')!.textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
      document.querySelectorAll<HTMLElement>('th[data-sort]').forEach(h => {
        h.classList.remove('sorted');
        h.querySelector('.si')!.textContent = '↕';
      });
      th.classList.add('sorted');
      th.querySelector('.si')!.textContent = sortConfig.dir === 'asc' ? '↑' : '↓';
      applyAll();
    });
  });

  // ── Column resize (drag handles on Details headers) ───────────────
  function applyColWidths(): void {
    const w = getColWidths();
    document.querySelectorAll<HTMLElement>('thead th[data-ck]').forEach(th => {
      const px = w[th.dataset.ck!];
      if (px) th.style.width = px + 'px';
    });
  }
  applyColWidths();
  document.querySelectorAll<HTMLElement>('.fe-col-rz').forEach(handle => {
    // Stop the click reaching the th's sort handler when the grip is used.
    handle.addEventListener('click', e => e.stopPropagation());
    handle.addEventListener('mousedown', e => {
      e.preventDefault(); e.stopPropagation();
      const th = handle.closest<HTMLElement>('th')!;
      const key = th.dataset.ck!;
      const startX = e.clientX, startW = th.offsetWidth;
      const onMove = (ev: MouseEvent) => { th.style.width = Math.max(48, startW + ev.clientX - startX) + 'px'; };
      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const all = getColWidths();
        all[key] = Math.max(48, startW + ev.clientX - startX);
        saveColWidths(all);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });

  // ── Sort & Group panel ────────────────────────────────────────────
  const sgPanel = document.getElementById('fe-sg-panel')!;
  document.getElementById('fe-sg-btn')!.addEventListener('click', () => {
    const open = sgPanel.style.display === 'none';
    sgPanel.style.display = open ? '' : 'none';
    document.getElementById('fe-sg-btn')!.classList.toggle('on', open);
  });

  document.querySelectorAll<HTMLElement>('#fe-sort-cols .fe-pbn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col as SortConfig['col'];
      if (sortConfig.col === col) sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
      else { sortConfig.col = col; sortConfig.dir = 'asc'; }
      document.querySelectorAll('#fe-sort-cols .fe-pbn').forEach(b => (b as HTMLElement).classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('fe-sort-dir')!.textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
      applyAll();
    });
  });

  document.getElementById('fe-sort-dir')!.addEventListener('click', () => {
    sortConfig.dir = sortConfig.dir === 'asc' ? 'desc' : 'asc';
    document.getElementById('fe-sort-dir')!.textContent = sortConfig.dir === 'asc' ? '↑ Asc' : '↓ Desc';
    applyAll();
  });

  document.querySelectorAll<HTMLElement>('#fe-group-btns .fe-pbn').forEach(btn => {
    btn.addEventListener('click', () => {
      groupConfig = btn.dataset.group as GroupMode;
      document.querySelectorAll('#fe-group-btns .fe-pbn').forEach(b => (b as HTMLElement).classList.remove('active'));
      btn.classList.add('active');
      applyAll();
    });
  });

  // ── Filter bar ────────────────────────────────────────────────────
  const filterBar = document.getElementById('fe-filter-bar')!;
  document.getElementById('fe-filter-btn')!.addEventListener('click', () => {
    const open = filterBar.style.display === 'none';
    filterBar.style.display = open ? '' : 'none';
    document.getElementById('fe-filter-btn')!.classList.toggle('on', open);
    if (open) (document.getElementById('fe-filter-q') as HTMLInputElement).focus();
  });

  (document.getElementById('fe-filter-q') as HTMLInputElement).addEventListener('input', function () {
    filterConfig.q = this.value;
    applyAll();
  });

  document.getElementById('fe-regex-btn')!.addEventListener('click', function () {
    filterConfig.regex = !filterConfig.regex;
    (this as HTMLElement).classList.toggle('active', filterConfig.regex);
    (this as HTMLElement).title = filterConfig.regex ? 'Regex mode on' : 'Toggle regex mode';
    applyAll();
  });

  (document.getElementById('fe-type-filter') as HTMLSelectElement).addEventListener('change', function () {
    filterConfig.type = this.value;
    applyAll();
  });

  // ── Search ────────────────────────────────────────────────────────
  const searchEl = document.getElementById('fe-search') as HTMLInputElement;
  searchEl.addEventListener('input', function () {
    filterConfig.q = this.value;
    const fq = document.getElementById('fe-filter-q') as HTMLInputElement | null;
    if (fq) fq.value = this.value;
    applyAll();
  });
  searchEl.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (searchEl.value) {
      searchEl.value = '';
      filterConfig.q = '';
      const fq = document.getElementById('fe-filter-q') as HTMLInputElement | null;
      if (fq) fq.value = '';
      applyAll();
    }
    searchEl.blur();
  });

  // ── Bookmark toggle ───────────────────────────────────────────────
  document.getElementById('fe-bm-btn')!.addEventListener('click', function () {
    const newBm = toggleBM(rawPath);
    const on = newBm.some(b => b.path === rawPath);
    (this as HTMLElement).classList.toggle('on', on);
    document.getElementById('fe-bm-path')!.setAttribute('fill', on ? 'currentColor' : 'none');
    document.getElementById('fe-bm-list')!.innerHTML = renderBMList(newBm, rawPath);
    attachBMEvents();
    toast(on ? 'Bookmarked' : 'Bookmark removed');
  });

  // ── Theme ─────────────────────────────────────────────────────────
  document.getElementById('fe-theme-btn')!.addEventListener('click', () => {
    const next = fe.dataset.theme === 'dark' ? 'light' : 'dark';
    fe.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
  });

  // ── Terminal ──────────────────────────────────────────────────────
  function getTermCmd(path: string): string {
    const app = settings.terminalApp || 'ghostty';
    const tpl = app === 'custom'
      ? (settings.terminalCmd || 'cd "${p}"')
      : (TERMINAL_CMDS[app] || TERMINAL_CMDS.ghostty);
    return tpl.replace(/\$\{p\}/g, path);
  }
  function openInTerminal(path: string): void {
    const app = settings.terminalApp || 'ghostty';
    if (app === 'ghostty') {
      // connectNative is unavailable in content scripts — round-trip through
      // the background worker, falling back to copy if the host isn't there.
      chrome.runtime.sendMessage(
        { type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'open_terminal', path } },
        res => { if (chrome.runtime.lastError || !res?.ok) fallbackCopy(path); },
      );
      return;
    }
    fallbackCopy(path);
  }
  document.getElementById('fe-term-btn')!.addEventListener('click', () => openInTerminal(rawPath));
  function fallbackCopy(path: string): void {
    const cmd = getTermCmd(path);
    navigator.clipboard.writeText(cmd).catch(() => {});
    toast(`Copied: ${cmd}`);
  }

  // ── Tooltip ───────────────────────────────────────────────────────
  const tip = document.getElementById('fe-tip')!;
  let tipTimeout: ReturnType<typeof setTimeout>;
  scroll.addEventListener('mousemove', e => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (!target) { hideTip(); return; }
    clearTimeout(tipTimeout);
    tipTimeout = setTimeout(() => showTip(target, e as MouseEvent), 300);
  });
  scroll.addEventListener('mouseleave', hideTip);

  function showTip(el: HTMLElement, ev: MouseEvent): void {
    try {
      const d = JSON.parse(el.getAttribute('data-tip') ?? '{}');
      const iconHtml  = d.icon  ? `<span class="tip-icon">${d.icon}</span>` : '';
      const linesHtml = (d.lines || []).map((l: string) => `<div class="tip-line">${esc(l)}</div>`).join('');
      const warnHtml  = d.warn  ? `<div class="tip-warn">⚠ ${esc(d.warn)}</div>` : '';
      tip.innerHTML = `<div class="tip-header">${iconHtml}<span class="tip-name">${esc(d.name || '')}</span></div>${linesHtml}${warnHtml}`;
    } catch {
      tip.innerHTML = `<div class="tip-name">${esc(el.getAttribute('data-tip') ?? '')}</div>`;
    }
    tip.classList.add('show');
    positionTip(ev);
  }
  function hideTip(): void {
    clearTimeout(tipTimeout);
    tip.classList.remove('show');
  }
  document.addEventListener('mousemove', e => { if (tip.classList.contains('show')) positionTip(e as MouseEvent); });
  function positionTip(e: MouseEvent): void {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tw = tip.offsetWidth || 280, th = tip.offsetHeight || 100;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + tw > vw - 8) x = e.clientX - tw - 10;
    if (y + th > vh - 8) y = e.clientY - th - 10;
    tip.style.left = x + 'px';
    tip.style.top  = y + 'px';
  }

  // ── Crumb dropdown ────────────────────────────────────────────────
  const crumbMenu = document.getElementById('fe-crumb-menu')!;
  let crumbMenuUrl: string | null = null;

  document.getElementById('fe-bc')!.addEventListener('click', async e => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.fe-crumb-dd');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation();
    const url = btn.dataset.url!;
    if (crumbMenu.style.display !== 'none' && crumbMenuUrl === url) { closeCrumbMenu(); return; }
    const rect = btn.getBoundingClientRect();
    crumbMenu.style.left    = Math.min(rect.left, window.innerWidth - 260) + 'px';
    crumbMenu.style.top     = (rect.bottom + 4) + 'px';
    crumbMenu.style.display = 'block';
    crumbMenu.innerHTML     = '<div class="fe-dd-spinner">Loading…</div>';
    crumbMenuUrl = url;

    const text = await fetchFileText(url)
      .catch(err => { console.error('[BFB] crumb dropdown failed:', url, err); return null; });

    if (text === null) {
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
      return;
    }
    if (crumbMenuUrl !== url) return;
    try {
      const entries = parseListing(text, url);
      if (!entries.length) { crumbMenu.innerHTML = '<div class="fe-dd-empty">Empty folder</div>'; return; }
      crumbMenu.innerHTML =
        `<div class="fe-dd-search-wrap"><input class="fe-dd-search" type="text" placeholder="Filter…" autocomplete="off" spellcheck="false"></div>` +
        `<div class="fe-dd-items">${entries.map(en =>
          `<a href="${esc(en.href)}" class="fe-dd-item${en.isDir ? ' dir' : ''}" data-name="${esc(en.name.toLowerCase())}">${getIcon(en, iconRules)}<span>${esc(en.name)}</span></a>`
        ).join('')}</div>`;
      const ddSearch = crumbMenu.querySelector<HTMLInputElement>('.fe-dd-search')!;
      ddSearch.focus();
      ddSearch.addEventListener('input', () => {
        const q = ddSearch.value.toLowerCase();
        crumbMenu.querySelectorAll<HTMLElement>('.fe-dd-item').forEach(it => {
          it.style.display = it.dataset.name!.includes(q) ? '' : 'none';
        });
      });
      ddSearch.addEventListener('keydown', ke => {
        if (ke.key === 'Escape') { ke.stopPropagation(); closeCrumbMenu(); }
        else if (ke.key === 'Enter') {
          const first = [...crumbMenu.querySelectorAll<HTMLAnchorElement>('.fe-dd-item')]
            .find(it => it.style.display !== 'none');
          if (first) location.href = first.href;
        }
      });
    } catch (err) {
      console.error('[BFB] crumb dropdown parse error:', url, err);
      if (crumbMenuUrl === url) crumbMenu.innerHTML = '<div class="fe-dd-empty">Cannot load directory</div>';
    }
  });

  document.addEventListener('click', e => {
    if (!crumbMenu.contains(e.target as Node) && !(e.target as HTMLElement).classList.contains('fe-crumb-dd'))
      closeCrumbMenu();
  });
  function closeCrumbMenu(): void { crumbMenu.style.display = 'none'; crumbMenuUrl = null; }

  // ── Per-item actions ──────────────────────────────────────────────
  function copyText(val: string): void {
    copyToClipboard(val).then(() => toast(`Copied: ${val}`));
  }

  scroll.addEventListener('click', e => {
    const pv = (e.target as HTMLElement).closest<HTMLElement>('.fe-act-pv');
    if (pv) {
      e.preventDefault(); e.stopPropagation();
      const en = ALL_ENTRIES.find(x => x.name === pv.dataset.pv);
      if (en) { setSel(VISIBLE.indexOf(en)); openPreview(en); }
      return;
    }
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.fe-act-btn');
    if (btn) {
      e.preventDefault(); e.stopPropagation();
      copyText(btn.dataset.copy || '');
      return;
    }
    // Modifier-clicks select (overriding link navigation); a plain click on
    // row whitespace single-selects; a plain click on the name link navigates.
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    if (!holder) return;
    const i = parseInt(holder.dataset.idx!);
    if ((e.shiftKey || e.metaKey || e.ctrlKey) && selectable(i)) {
      e.preventDefault();
      if (e.shiftKey) rangeSel(i); else toggleSel(i);
      return;
    }
    if (!(e.target as HTMLElement).closest('a') && selectable(i)) setSel(i);
  });

  // ── Selection & keyboard navigation ───────────────────────────────
  // selSet holds every selected VISIBLE index; selIdx is the lead (last
  // touched, drives scroll + the single-item status line); anchor is the
  // fixed end of a shift-range.
  const selSet = new Set<number>();
  let selIdx = -1;
  let anchor = -1;
  function entryShown(en: Entry): boolean {
    return !en.isHidden || fe.classList.contains('show-hidden');
  }
  function selectable(i: number): boolean {
    const en = VISIBLE[i];
    return !!en && !en.isParent && entryShown(en);
  }
  function paintSel(): void {
    document.querySelectorAll('#fe-scroll .selected').forEach(el => el.classList.remove('selected'));
    selSet.forEach(i =>
      document.querySelectorAll<HTMLElement>(`#fe-scroll [data-idx="${i}"]`).forEach(el => el.classList.add('selected')));
    const t = document.getElementById('fe-status-text')!;
    if (selSet.size > 1) {
      t.textContent = `${selSet.size} selected`;
    } else {
      const en = selIdx >= 0 ? VISIBLE[selIdx] : null;
      t.textContent = en && !en.isParent
        ? (en.isDir ? `${en.name}/` : `${en.name} — ${fmtSize(en.rawBytes)}`)
        : baseStatus;
    }
  }
  function scrollToLead(): void {
    if (selIdx < 0) return;
    document.querySelectorAll<HTMLElement>(`#fe-scroll [data-idx="${selIdx}"]`).forEach(el => {
      if (el.offsetParent) el.scrollIntoView({ block: 'nearest' });
    });
  }
  function setSel(i: number): void {     // single-select, replacing any set
    selSet.clear();
    selIdx = i; anchor = i;
    if (i >= 0) selSet.add(i);
    paintSel();
    scrollToLead();
  }
  function toggleSel(i: number): void {  // ⌘/ctrl-click
    if (selSet.has(i)) selSet.delete(i); else selSet.add(i);
    selIdx = i; anchor = i;
    paintSel();
  }
  function rangeSel(target: number): void {  // shift-click from anchor
    const a = anchor >= 0 ? anchor : target;
    selSet.clear();
    selectionRange(a, target).filter(selectable).forEach(i => selSet.add(i));
    selIdx = target;
    paintSel();
    scrollToLead();
  }
  function selectAll(): void {
    selSet.clear();
    for (let i = 0; i < VISIBLE.length; i++) if (selectable(i)) selSet.add(i);
    if (selSet.size && selIdx < 0) selIdx = [...selSet][0];
    paintSel();
  }
  function selectedPaths(): string[] {
    return [...selSet].sort((a, b) => a - b).map(i => fullPath(rawPath, VISIBLE[i]));
  }
  function copySelection(): void {
    const paths = selectedPaths();
    if (!paths.length) return;
    copyToClipboard(paths.join('\n')).then(() => toast(`Copied ${paths.length} path${paths.length !== 1 ? 's' : ''}`));
  }
  function moveSel(step: number): void {
    let i = selIdx;
    for (let n = 0; n < VISIBLE.length; n++) {
      i += step;
      if (i < 0 || i >= VISIBLE.length) return;
      if (entryShown(VISIBLE[i])) { setSel(i); return; }
    }
  }
  function tryPreview(en: Entry): void {
    if (canPreview(en)) { setSel(VISIBLE.indexOf(en)); openPreview(en); }
    else if (en.isDir || en.isParent) toast('Folders have no preview — press Enter to open');
    else toast('No preview for this file type');
  }
  // With the overlay open, arrows step between previewable files
  function previewStep(step: number): void {
    let i = selIdx;
    for (let n = 0; n < VISIBLE.length; n++) {
      i += step;
      if (i < 0 || i >= VISIBLE.length) return;
      const en = VISIBLE[i];
      if (entryShown(en) && canPreview(en)) { setSel(i); openPreview(en); return; }
    }
  }

  function goUp(): void {
    const up = ALL_ENTRIES.find(x => x.isParent);
    if (up) location.href = up.href;
    else if (rawPath !== '/') location.href = 'file:///';
  }

  document.addEventListener('keydown', e => {
    // Cmd/Ctrl+F focuses the list filter; when it's already focused, fall
    // through so the browser's native find opens instead.
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
      const s = document.getElementById('fe-search') as HTMLInputElement;
      if (document.activeElement !== s) { e.preventDefault(); s.focus(); s.select(); }
      return;
    }
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
    if (settingsModal.style.display !== 'none') return;
    if (document.getElementById('fe-help-modal')!.style.display !== 'none') return;
    if (e.metaKey && e.key === 'ArrowUp') { e.preventDefault(); goUp(); return; }   // Finder: go to parent
    if (ctxMenu.style.display !== 'none') {
      if (e.key === 'Escape') closeCtx();
      return;
    }
    if (isPreviewOpen()) {
      if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); closePreview(); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); previewStep(1); }
      else if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); previewStep(-1); }
      return;
    }
    if      (e.key === 'ArrowDown') { e.preventDefault(); moveSel(1); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); moveSel(-1); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); selectAll(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && selSet.size) { e.preventDefault(); copySelection(); }
    else if (e.key === 'Enter' && selIdx >= 0) { location.href = VISIBLE[selIdx].href; }
    else if (e.key === 'Backspace') { e.preventDefault(); goUp(); }
    else if (e.key === ' ' && selIdx >= 0) { e.preventDefault(); tryPreview(VISIBLE[selIdx]); }
  });

  // ── Context menu ──────────────────────────────────────────────────
  const ctxMenu = document.createElement('div');
  ctxMenu.id = 'fe-ctx';
  ctxMenu.style.display = 'none';
  fe.appendChild(ctxMenu);
  function closeCtx(): void { ctxMenu.style.display = 'none'; }

  scroll.addEventListener('contextmenu', e => {
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    if (!holder) return;
    const idx = parseInt(holder.dataset.idx!);
    const en = VISIBLE[idx];
    if (!en || en.isParent) return;
    e.preventDefault();
    // Right-clicking inside an existing multi-selection keeps it (bulk menu);
    // otherwise the click single-selects the row under the cursor.
    const multi = selSet.size > 1 && selSet.has(idx);
    if (!multi) setSel(idx);
    ctxMenu.innerHTML = multi
      ? [
          `<div class="fe-ctx-item" data-act="cp-paths">Copy ${selSet.size} paths</div>`,
          `<div class="fe-ctx-item" data-act="cp-names">Copy ${selSet.size} names</div>`,
        ].join('')
      : [
          canPreview(en) ? `<div class="fe-ctx-item" data-act="pv">Preview<span class="fe-ctx-key">Space</span></div>` : '',
          `<div class="fe-ctx-item" data-act="cp-path">Copy path</div>`,
          `<div class="fe-ctx-item" data-act="cp-name">Copy name</div>`,
          `<div class="fe-ctx-sep"></div>`,
          `<div class="fe-ctx-item" data-act="term">Open in terminal</div>`,
        ].join('');
    ctxMenu.dataset.idx = String(idx);
    ctxMenu.style.display = 'block';
    ctxMenu.style.left = Math.min(e.clientX, window.innerWidth  - ctxMenu.offsetWidth  - 8) + 'px';
    ctxMenu.style.top  = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 8) + 'px';
  });

  ctxMenu.addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.fe-ctx-item');
    if (!item) return;
    const en = VISIBLE[parseInt(ctxMenu.dataset.idx!)];
    closeCtx();
    if (!en) return;
    const fp = fullPath(rawPath, en);
    if      (item.dataset.act === 'pv')      openPreview(en);
    else if (item.dataset.act === 'cp-path') copyText(fp);
    else if (item.dataset.act === 'cp-name') copyText(en.name);
    else if (item.dataset.act === 'term')    openInTerminal(en.isDir ? fp : rawPath);
    else if (item.dataset.act === 'cp-paths') copySelection();
    else if (item.dataset.act === 'cp-names') {
      const names = [...selSet].sort((a, b) => a - b).map(i => VISIBLE[i].name).join('\n');
      copyToClipboard(names).then(() => toast(`Copied ${selSet.size} names`));
    }
  });

  document.addEventListener('click', e => {
    if (ctxMenu.style.display !== 'none' && !ctxMenu.contains(e.target as Node)) closeCtx();
  });

  // ── Settings modal ────────────────────────────────────────────────
  const settingsModal = document.getElementById('fe-settings-modal')!;

  function renderRulesList(): void {
    const list = document.getElementById('fe-st-rules-list')!;
    if (!iconRules.length) {
      list.innerHTML = '<div class="fe-st-rules-empty">No rules — click "+ Add rule" to create one.</div>';
      return;
    }
    list.innerHTML = iconRules.map((rule, i) => `
      <div class="fe-st-rule" data-idx="${i}">
        <input type="checkbox" class="fe-st-rule-en" title="Enable" ${rule.enabled ? 'checked' : ''}>
        <div class="fe-st-rule-preview">${icoCustom(rule.label, rule.color)}</div>
        <input type="text" class="fe-st-rule-pattern" value="${esc(rule.pattern)}" placeholder="regex…" title="Regex (case-insensitive)">
        <input type="text" class="fe-st-rule-label"   value="${esc(rule.label)}"   placeholder="LBL"   maxlength="4" title="Badge text (≤4 chars)">
        <input type="color" class="fe-st-rule-color"  value="${esc(rule.color)}"        title="Icon color">
        <button class="fe-st-rule-del" data-idx="${i}" title="Delete">✕</button>
      </div>`).join('');
  }

  function updateTermHint(): void {
    const app  = settings.terminalApp || 'ghostty';
    const hint = document.getElementById('fe-st-term-hint');
    if (!hint) return;
    const cmd = app === 'custom' ? (settings.terminalCmd || '') : (TERMINAL_CMDS[app] || '');
    hint.textContent = cmd ? `Command: ${cmd.replace(/\$\{p\}/g, rawPath)}` : '';
  }

  function openSettings(): void {
    document.querySelectorAll<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => {
      r.checked = r.value === (fe.dataset.theme || 'dark');
    });
    (document.getElementById('fe-st-defview')  as HTMLSelectElement).value   = getView();
    (document.getElementById('fe-st-compact')  as HTMLInputElement).checked  = !!settings.compactMode;
    (document.getElementById('fe-st-sidebar')  as HTMLInputElement).checked  = settings.showSidebar !== false;
    (document.getElementById('fe-st-datefmt')  as HTMLSelectElement).value   = settings.dateFormat || 'short';
    (document.getElementById('fe-st-terminal') as HTMLSelectElement).value   = settings.terminalApp || 'ghostty';
    (document.getElementById('fe-st-term-custom-row') as HTMLElement).style.display =
      settings.terminalApp === 'custom' ? '' : 'none';
    (document.getElementById('fe-st-term-custom') as HTMLInputElement).value = settings.terminalCmd || '';
    updateTermHint();
    renderRulesList();
    refreshAiStatus();
    settingsModal.style.display = 'flex';
  }
  function closeSettings(): void { settingsModal.style.display = 'none'; }

  function refreshAiStatus(): void {
    const head = document.querySelector<HTMLElement>('.fe-st-ai-head')!;
    const state = document.querySelector<HTMLElement>('.fe-st-ai-state')!;
    const grid  = document.getElementById('fe-st-ai-grid')!;
    const hint  = document.getElementById('fe-st-ai-hint')!;
    const controls = document.getElementById('fe-st-ai-controls')!;
    const modelSel = document.getElementById('fe-st-ai-model') as HTMLSelectElement;
    const warmBtn  = document.getElementById('fe-st-ai-warm') as HTMLButtonElement;
    head.className = 'fe-st-ai-head';
    state.textContent = 'Checking…';
    grid.innerHTML = '';
    hint.innerHTML = '';
    controls.style.display = 'none';
    const row = (k: string, v: string, cls = '') =>
      `<span class="k">${esc(k)}</span><span class="v ${cls}">${esc(v)}</span>`;

    llmAvailability().then((av: LlmAvailability) => {
      if (av.kind === 'unavailable') {
        head.classList.add('off');
        state.textContent = 'Not installed';
        hint.innerHTML = `The native host isn't registered (${esc(av.reason)}). ` +
          `Install it once: run <code>native/install.sh &lt;extension-id&gt;</code> and reload the extension.`;
        return;
      }
      const s = av.status;
      const cls = av.kind === 'down' ? 'down' : (av.cold ? 'cold' : 'ready');
      head.classList.add(cls);
      state.textContent = av.kind === 'down' ? 'Server down'
        : (av.cold ? 'Ready (cold — first reply loads the model)' : 'Ready & warm');
      grid.innerHTML = [
        row('Default model', s.default_model || '—'),
        row('Warm', s.warm ? 'yes — model resident' : 'no — loads on first use', s.warm ? 'warm-yes' : 'warm-no'),
        row('Latency', s.latency_class),
        row('Server', `${s.server}${s.host ? '  ' + s.host : ''}`),
        s.toolkit_version ? row('Toolkit', `lm ${s.toolkit_version}`) : '',
      ].join('');

      // Model picker — populate from available_models, mark the default, persist choice
      if (av.kind === 'ready' && s.available_models?.length) {
        const chosen = settings.aiModel || s.default_model;
        modelSel.innerHTML = s.available_models.map(m =>
          `<option value="${esc(m)}"${m === chosen ? ' selected' : ''}>${esc(m)}${m === s.default_model ? ' (default)' : ''}</option>`,
        ).join('');
        // Warm toggle reflects + controls the DEFAULT model's residency
        warmBtn.textContent = s.warm ? 'Unload (warm off)' : 'Keep warm';
        warmBtn.disabled = false;
        controls.style.display = '';
      }
      hint.innerHTML = av.kind === 'down'
        ? `Ollama isn't responding. Start it, then Refresh.`
        : (av.cold
            ? `Cold start — first reply loads the model (~2–3s). "Keep warm" makes replies instant.`
            : `Model is resident — replies are near-instant.`);
    });
  }
  document.getElementById('fe-st-ai-refresh')!.addEventListener('click', refreshAiStatus);
  (document.getElementById('fe-st-ai-model') as HTMLSelectElement).addEventListener('change', function () {
    settings.aiModel = this.value || undefined;
    saveSettings(settings);
  });
  document.getElementById('fe-st-ai-warm')!.addEventListener('click', function () {
    const btn = this as HTMLButtonElement;
    const turnOn = btn.textContent !== 'Unload (warm off)';
    btn.disabled = true; btn.textContent = turnOn ? 'Warming…' : 'Unloading…';
    llmWarm(turnOn).then(r => {
      if (!r.ok) toast(r.message ? `Warm failed: ${r.message}` : 'Warm failed');
      refreshAiStatus();
    });
  });

  document.getElementById('fe-settings-btn')!.addEventListener('click', openSettings);
  document.getElementById('fe-settings-close')!.addEventListener('click', closeSettings);
  document.getElementById('fe-settings-bg')!.addEventListener('click', closeSettings);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && settingsModal.style.display !== 'none') closeSettings();
  });

  // ── Help modal ────────────────────────────────────────────────────
  const helpModal = document.getElementById('fe-help-modal')!;
  document.getElementById('fe-help-body')!.innerHTML = renderMarkdown(HELP_MD);
  const openHelp  = () => { helpModal.style.display = 'flex'; };
  const closeHelp = () => { helpModal.style.display = 'none'; };
  document.getElementById('fe-help-btn')!.addEventListener('click', openHelp);
  document.getElementById('fe-help-close')!.addEventListener('click', closeHelp);
  document.getElementById('fe-help-bg')!.addEventListener('click', closeHelp);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && helpModal.style.display !== 'none') closeHelp();
  });

  document.querySelectorAll<HTMLInputElement>('input[name="bfb-theme"]').forEach(r => {
    r.addEventListener('change', () => { fe.dataset.theme = r.value; localStorage.setItem(THEME_KEY, r.value); });
  });
  (document.getElementById('fe-st-defview') as HTMLSelectElement).addEventListener('change', function () {
    localStorage.setItem(VIEW_KEY, this.value);
  });
  (document.getElementById('fe-st-compact') as HTMLInputElement).addEventListener('change', function () {
    settings.compactMode = this.checked; saveSettings(settings);
    fe.classList.toggle('compact', this.checked);
  });
  (document.getElementById('fe-st-sidebar') as HTMLInputElement).addEventListener('change', function () {
    settings.showSidebar = this.checked; saveSettings(settings);
    (document.getElementById('fe-side') as HTMLElement).style.display = this.checked ? '' : 'none';
  });
  (document.getElementById('fe-st-datefmt') as HTMLSelectElement).addEventListener('change', function () {
    settings.dateFormat = this.value as 'short' | 'full'; saveSettings(settings); applyAll();
  });
  (document.getElementById('fe-st-terminal') as HTMLSelectElement).addEventListener('change', function () {
    settings.terminalApp = this.value; saveSettings(settings);
    (document.getElementById('fe-st-term-custom-row') as HTMLElement).style.display =
      this.value === 'custom' ? '' : 'none';
    updateTermHint();
    const termBtn = document.getElementById('fe-term-btn');
    if (termBtn) termBtn.title = `Open in ${this.options[this.selectedIndex].text}`;
  });
  (document.getElementById('fe-st-term-custom') as HTMLInputElement).addEventListener('input', function () {
    settings.terminalCmd = this.value; saveSettings(settings); updateTermHint();
  });

  const rulesList = document.getElementById('fe-st-rules-list')!;
  rulesList.addEventListener('change', e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-st-rule');
    if (!row) return;
    const idx = parseInt(row.dataset.idx!);
    if (isNaN(idx) || idx >= iconRules.length) return;
    if ((e.target as HTMLElement).classList.contains('fe-st-rule-en'))
      iconRules[idx].enabled = (e.target as HTMLInputElement).checked;
    if ((e.target as HTMLElement).classList.contains('fe-st-rule-color')) {
      iconRules[idx].color = (e.target as HTMLInputElement).value;
      row.querySelector('.fe-st-rule-preview')!.innerHTML = icoCustom(iconRules[idx].label, iconRules[idx].color);
    }
    saveIconRules(iconRules); applyAll();
  });
  rulesList.addEventListener('input', e => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-st-rule');
    if (!row) return;
    const idx = parseInt(row.dataset.idx!);
    if (isNaN(idx) || idx >= iconRules.length) return;
    if ((e.target as HTMLElement).classList.contains('fe-st-rule-pattern'))
      iconRules[idx].pattern = (e.target as HTMLInputElement).value;
    if ((e.target as HTMLElement).classList.contains('fe-st-rule-label')) {
      iconRules[idx].label = (e.target as HTMLInputElement).value;
      row.querySelector('.fe-st-rule-preview')!.innerHTML = icoCustom(iconRules[idx].label, iconRules[idx].color);
    }
    saveIconRules(iconRules); applyAll();
  });
  rulesList.addEventListener('click', e => {
    const del = (e.target as HTMLElement).closest<HTMLElement>('.fe-st-rule-del');
    if (!del) return;
    const idx = parseInt(del.dataset.idx!);
    if (!isNaN(idx)) { iconRules.splice(idx, 1); saveIconRules(iconRules); applyAll(); renderRulesList(); }
  });
  document.getElementById('fe-st-add-rule')!.addEventListener('click', () => {
    iconRules.push({ id: 'r' + Date.now(), pattern: '', label: 'NEW', color: '#58a6ff', enabled: true });
    saveIconRules(iconRules);
    renderRulesList();
    rulesList.querySelectorAll<HTMLElement>('.fe-st-rule-pattern').forEach((el, i, arr) => {
      if (i === arr.length - 1) (el as HTMLInputElement).focus();
    });
  });
  document.getElementById('fe-st-reset-rules')!.addEventListener('click', () => {
    iconRules = DEFAULT_ICON_RULES.map(r => ({ ...r }));
    saveIconRules(iconRules); applyAll(); renderRulesList();
    toast('Icon rules reset to defaults');
  });

  // ── Bookmark drag-to-reorder ──────────────────────────────────────
  let dragSrc: HTMLElement | null = null;
  function attachBMEvents(): void {
    const bmList = document.getElementById('fe-bm-list')!;
    bmList.querySelectorAll<HTMLElement>('.fe-rm-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        const bm = getBM().filter(b => b.path !== btn.dataset.path);
        saveBM(bm);
        bmList.innerHTML = renderBMList(bm, rawPath);
        attachBMEvents();
        toast('Bookmark removed');
      });
    });
    bmList.querySelectorAll<HTMLElement>('.fe-bm-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = item;
        (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend',  () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.stopPropagation(); e.preventDefault();
        item.classList.remove('drag-over');
        if (!dragSrc || dragSrc === item) return;
        const bm = getBM();
        const fi = bm.findIndex(b => b.path === dragSrc!.dataset.path);
        const ti = bm.findIndex(b => b.path === item.dataset.path);
        if (fi >= 0 && ti >= 0) {
          const [moved] = bm.splice(fi, 1);
          bm.splice(ti, 0, moved);
          saveBM(bm);
          bmList.innerHTML = renderBMList(bm, rawPath);
          attachBMEvents();
        }
      });
    });
  }
  attachBMEvents();

  // ── Custom Places (editable sidebar quick-access) ─────────────────
  const plList = document.getElementById('fe-pl-list')!;
  function refreshPlaces(): void {
    plList.innerHTML = renderPlacesList(getPlaces(), rawPath);
    attachPlaceEvents();
  }
  function startRename(lbl: HTMLElement): void {
    const item = lbl.closest<HTMLElement>('.fe-pl-item')!;
    const path = item.dataset.path!;
    const orig = lbl.textContent || '';
    lbl.contentEditable = 'true';
    lbl.classList.add('editing');
    lbl.focus();
    const range = document.createRange(); range.selectNodeContents(lbl);
    const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    let done = false;
    const finish = (save: boolean) => {
      if (done) return; done = true;
      const val = (lbl.textContent || '').trim();
      lbl.contentEditable = 'false'; lbl.classList.remove('editing');
      if (save && val && val !== orig) savePlaces(renamePlace(getPlaces(), path, val));
      refreshPlaces();
    };
    lbl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); lbl.textContent = orig; finish(false); }
    });
    lbl.addEventListener('blur', () => finish(true), { once: true });
  }
  function attachPlaceEvents(): void {
    plList.querySelectorAll<HTMLElement>('.fe-rm-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation(); e.preventDefault();
        savePlaces(removePlace(getPlaces(), btn.dataset.path!));
        refreshPlaces(); toast('Removed from Places');
      });
    });
    plList.querySelectorAll<HTMLElement>('.fe-pl-label').forEach(lbl => {
      lbl.addEventListener('dblclick', e => { e.preventDefault(); e.stopPropagation(); startRename(lbl); });
    });
    plList.querySelectorAll<HTMLElement>('.fe-pl-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = item; (e as DragEvent).dataTransfer!.effectAllowed = 'move';
        setTimeout(() => item.classList.add('dragging'), 0);
      });
      item.addEventListener('dragend',  () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', e => {
        e.stopPropagation(); e.preventDefault();
        item.classList.remove('drag-over');
        if (!dragSrc || dragSrc === item) return;
        savePlaces(movePlace(getPlaces(), dragSrc.dataset.path!, item.dataset.path!));
        refreshPlaces();
      });
    });
  }
  document.getElementById('fe-pl-add')!.addEventListener('click', () => {
    const label = rawPath.split('/').filter(Boolean).pop() || '/';
    savePlaces(upsertPlace(getPlaces(), { path: rawPath, label }));
    refreshPlaces();
    toast('Added to Places');
    const fresh = [...plList.querySelectorAll<HTMLElement>('.fe-pl-item')].find(i => i.dataset.path === rawPath);
    const lbl = fresh?.querySelector<HTMLElement>('.fe-pl-label');
    if (lbl) startRename(lbl);
  });
  attachPlaceEvents();

})();
