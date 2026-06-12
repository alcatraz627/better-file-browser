import type { SortConfig, FilterConfig, GroupMode } from './types';
import { parseEntries, parseListing } from './parse';
import { getExt } from './utils';
import { esc } from './utils';
import { icoCustom, PI } from './icons';
import {
  BM_KEY, VIEW_KEY, THEME_KEY, ZOOM_KEY, HIDDEN_KEY,
  ICON_RULES_KEY, SETTINGS_KEY, TERMINAL_CMDS, DEFAULT_ICON_RULES,
  getBM, saveBM, toggleBM, getView, getTheme, getZoom, getShowHidden,
  getIconRules, saveIconRules, getSettings, saveSettings,
  getRecents, pushRecent,
} from './storage';
import {
  initPreview, openPreview, closePreview, isPreviewOpen, canPreview,
} from './preview';
import { fetchFileText } from './file-fetch';
import type { Entry } from './types';
import { applyFilter, applySort, buildGroups } from './sort-filter';
import {
  renderRows, renderTiles, renderBMList, renderCrumbs,
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
    setSel(-1);
  }

  // ── Counts ────────────────────────────────────────────────────────
  const nonPar  = ALL_ENTRIES.filter(e => !e.isParent);
  const dirs    = nonPar.filter(e => e.isDir).length;
  const files   = nonPar.filter(e => !e.isDir).length;
  const hidden  = nonPar.filter(e => e.isHidden).length;
  const allExts = [...new Set(nonPar.filter(e => !e.isDir && getExt(e)).map(getExt))].sort();
  const extOpts = allExts.map(x => `<option value="${x}">.${x}</option>`).join('');

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
    <button id="fe-settings-btn" title="Settings — customize theme, views, terminal, icon rules">
      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M8.5 1H5.5L4.5 2.8 2.5 4 1 5.5v3L2.5 10l2 1.2L5.5 13h3l1-1.8 2-1.2L13 8.5v-3L11.5 4l-2-1.2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="7" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div class="fe-sec">
        <div class="fe-sh">Bookmarks</div>
        <div id="fe-bm-list">${renderBMList(initBM, rawPath)}</div>
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
              <th class="c-nm" data-sort="name">Name <span class="si">↕</span></th>
              <th class="c-tp">Type</th>
              <th class="c-sz" data-sort="size">Size <span class="si">↕</span></th>
              <th class="c-dt" data-sort="date">Modified <span class="si">↕</span></th>
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
</div>`;

  // ── CSS ───────────────────────────────────────────────────────────
  const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d1117;--s1:#161b22;--s2:#1c2230;--s3:#21262d;
  --bd:#30363d;--tx:#e6edf3;--mt:#8b949e;--dm:#484f58;
  --ac:#58a6ff;--dir:#79c0ff;--gold:#d29922;--green:#3fb950;
  --hover:#21262d;--act:#1a3a5c;--r:6px;
}
#fe[data-theme="light"]{
  --bg:#ffffff;--s1:#f6f8fa;--s2:#eaeef2;--s3:#e2e8f0;
  --bd:#d0d7de;--tx:#1f2328;--mt:#656d76;--dm:#8c959f;
  --hover:#f3f4f6;--act:#dbeafe;--ac:#0969da;--dir:#0550ae;
}
html,body{height:100%;background:var(--bg);color:var(--tx);
  font:13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow:hidden}
body{opacity:1!important}
#fe{display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tx)}
#fe-bar{display:flex;align-items:center;gap:6px;padding:8px 14px;
  background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0;min-height:42px}
#fe-bc{display:flex;align-items:center;gap:1px;flex:1;overflow:hidden;white-space:nowrap;min-width:0}
.fe-crumb{color:var(--mt);text-decoration:none;padding:2px 5px;border-radius:4px;
  font-size:12px;flex-shrink:0;transition:background .1s,color .1s}
.fe-crumb:last-of-type{color:var(--tx);font-weight:500}
.fe-crumb:hover{background:var(--hover);color:var(--tx)}
.fe-sep{color:var(--dm);font-size:11px;flex-shrink:0;padding:0 1px}
#fe-bar .fe-crumb-dd{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:0 2px;font-size:9px;border-radius:3px;line-height:1;opacity:0.35;
  transition:opacity .1s,color .1s,background .1s;flex-shrink:0;min-width:0}
#fe-bar .fe-crumb-dd:hover{background:var(--hover);color:var(--ac);opacity:1;border:none}
#fe-crumb-menu{
  position:fixed;z-index:300;
  background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:220px;max-width:340px;max-height:340px;overflow-y:auto;
  box-shadow:0 8px 24px #0009;display:none;padding:4px 0;
}
.fe-dd-item{display:flex;align-items:center;gap:8px;padding:6px 12px;
  color:var(--tx);text-decoration:none;font-size:12px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis;transition:background .08s}
.fe-dd-item:hover{background:var(--hover)}
.fe-dd-item.dir{color:var(--dir)}
.fe-dd-item svg{flex-shrink:0}
.fe-dd-spinner,.fe-dd-empty{padding:10px 14px;font-size:12px;color:var(--dm);font-style:italic}
#fe-bar button{background:none;border:1px solid var(--bd);color:var(--mt);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);line-height:1;display:flex;align-items:center;
  justify-content:center;gap:5px;transition:all .15s;flex-shrink:0}
#fe-bar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-bm-btn.on{color:var(--gold);border-color:var(--gold)}
#fe-bm-btn.on:hover{color:var(--gold)}
#fe-term-btn:hover{border-color:var(--green);color:var(--green)}
#fe-theme-btn #fe-sun{display:none}
#fe-theme-btn #fe-moon{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-sun{display:block}
#fe[data-theme="light"] #fe-theme-btn #fe-moon{display:none}
#fe-body{display:flex;flex:1;overflow:hidden}
#fe-side{width:220px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bd);overflow-y:auto;padding:6px 0}
.fe-sec{margin-bottom:4px}
.fe-sh{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding:10px 14px 5px;display:flex;align-items:center;gap:6px}
.fe-si{display:flex;align-items:center;gap:10px;padding:8px 14px;
  color:var(--mt);text-decoration:none;transition:background .1s,color .1s}
.fe-si:hover{background:var(--hover);color:var(--tx)}
.fe-si.active{background:var(--act);color:var(--ac)}
.fe-si svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-sl{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fe-hint{font-size:12px;color:var(--dm);padding:6px 14px;font-style:italic;line-height:1.7}
.fe-bm-item{display:flex;align-items:center;gap:0;position:relative;user-select:none}
.fe-drag-h{padding:7px 4px 7px 10px;color:var(--dm);cursor:grab;opacity:0;transition:opacity .1s;flex-shrink:0;display:flex;align-items:center}
.fe-bm-item:hover .fe-drag-h{opacity:1}
.fe-bm-item.dragging{opacity:.4;background:var(--hover)}
.fe-bm-item.drag-over{border-top:2px solid var(--ac)}
.fe-si-link{display:flex;align-items:center;gap:10px;flex:1;padding:7px 6px 7px 4px;
  color:var(--mt);text-decoration:none;min-width:0;transition:color .1s}
.fe-si-link:hover{color:var(--tx)}
.fe-si-link.active{color:var(--ac)}
.fe-si-link svg{flex-shrink:0;opacity:.7;width:19px;height:19px}
.fe-rm-btn{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:4px 10px 4px 4px;font-size:12px;opacity:0;transition:opacity .1s,color .1s;flex-shrink:0}
.fe-bm-item:hover .fe-rm-btn{opacity:1}
.fe-rm-btn:hover{color:#f85149}
#fe-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
#fe-toolbar{display:flex;align-items:center;gap:10px;padding:7px 14px;
  background:var(--s2);border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-count{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-tb-right{display:flex;align-items:center;gap:6px}
#fe-toolbar button{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:4px 8px;border-radius:var(--r);display:flex;align-items:center;gap:4px;
  font-size:12px;transition:all .15s}
#fe-toolbar button:hover{border-color:var(--ac);color:var(--ac)}
#fe-hidden-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-sg-btn.on,#fe-filter-btn.on{border-color:var(--ac);color:var(--ac);background:var(--act)}
#fe-zoom-wrap{display:flex;align-items:center;gap:5px;color:var(--dm)}
#fe-zoom{width:80px;accent-color:var(--ac);cursor:pointer}
#fe-zoom-val{font-size:10px;color:var(--dm);width:34px;text-align:right}
#fe-view-group{display:flex;gap:2px}
.fe-view-btn{background:none;border:1px solid transparent;color:var(--dm);cursor:pointer;
  padding:4px 7px;border-radius:5px;display:flex;align-items:center;transition:all .12s}
.fe-view-btn:hover{background:var(--hover);color:var(--tx)}
.fe-view-btn.active{background:var(--s3);border-color:var(--bd);color:var(--tx)}
#fe-search{background:var(--s1);border:1px solid var(--bd);color:var(--tx);
  padding:4px 10px;border-radius:var(--r);font-size:12px;width:150px;outline:none;transition:border-color .15s}
#fe-search:focus{border-color:var(--ac)}
#fe-search::placeholder{color:var(--dm)}
#fe-sg-panel,#fe-filter-bar{
  padding:8px 14px;background:var(--s1);border-bottom:1px solid var(--bd);flex-shrink:0}
.fe-panel-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fe-panel-lbl{font-size:11px;color:var(--dm);font-weight:500;white-space:nowrap}
.fe-btn-group{display:flex;gap:4px;flex-wrap:wrap}
.fe-pbn{background:none;border:1px solid var(--bd);color:var(--dm);cursor:pointer;
  padding:3px 9px;border-radius:5px;font-size:11px;transition:all .12s;white-space:nowrap}
.fe-pbn:hover{border-color:var(--ac);color:var(--ac)}
.fe-pbn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-filter-q{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:12px;width:200px;outline:none;transition:border-color .15s}
#fe-filter-q:focus{border-color:var(--ac)}
#fe-type-filter{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 8px;border-radius:var(--r);font-size:12px;outline:none;cursor:pointer}
#fe-regex-btn.active{background:var(--act);border-color:var(--ac);color:var(--ac)}
#fe-scroll{flex:1;overflow-y:auto;transform-origin:top left}
#fe-table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{position:sticky;top:0;z-index:5;background:var(--s2)}
thead th{padding:6px 12px;text-align:left;font-size:11px;font-weight:600;
  text-transform:uppercase;letter-spacing:.07em;color:var(--dm);
  border-bottom:1px solid var(--bd);user-select:none;white-space:nowrap}
thead th[data-sort]{cursor:pointer}
thead th[data-sort]:hover{color:var(--tx)}
.si{opacity:.35;font-size:10px}
th.sorted .si{opacity:1;color:var(--ac)}
.c-nm{width:46%}.c-tp{width:16%}.c-sz{width:13%;text-align:right}.c-dt{width:25%}
tbody tr{border-bottom:1px solid var(--bg);transition:background .08s}
tbody tr:hover{background:var(--hover)}
tbody td{padding:5px 12px;vertical-align:middle}
td.c-sz{text-align:right;color:var(--dm);font-variant-numeric:tabular-nums;font-size:12px}
td.c-dt{color:var(--dm);font-size:12px}
td.c-tp{color:var(--dm);font-size:11px}
.fe-lnk{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--tx)}
.fe-lnk svg{flex-shrink:0}
.fe-lnk:hover .fe-nm{color:var(--ac);text-decoration:underline}
.fe-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dir .fe-nm{color:var(--dir)}
.par td.c-nm .fe-nm{color:var(--dm)}
.par:hover .fe-nm{color:var(--mt)}
.dotfile{opacity:.65}
.fe-group-hdr td{padding:5px 12px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm);
  background:var(--s2);border-bottom:1px solid var(--bd);border-top:1px solid var(--bd)}
.fe-group-hdr-tile{width:100%;padding:6px 4px 2px;font-size:10.5px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;color:var(--dm)}
#fe:not(.show-hidden) .fe-row.dotfile,
#fe:not(.show-hidden) .fe-tile.dotfile{display:none!important}
#fe[data-view="list"] .c-tp,#fe[data-view="list"] .c-sz,#fe[data-view="list"] .c-dt{display:none}
#fe[data-view="list"] .c-nm{width:100%}
#fe[data-view="list"] tbody td{padding:4px 12px}
#fe-tiles{display:none;flex-wrap:wrap;gap:6px;padding:12px;align-content:flex-start}
#fe[data-view="tiles"] #fe-table,#fe[data-view="icons"] #fe-table{display:none}
#fe[data-view="tiles"] #fe-tiles,#fe[data-view="icons"] #fe-tiles{display:flex}
.fe-tile{display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:10px 8px 8px;border-radius:var(--r);text-decoration:none;
  color:var(--tx);border:1px solid transparent;transition:all .12s;
  width:90px;overflow:hidden;cursor:pointer;position:relative}
.fe-tile:hover{background:var(--hover);border-color:var(--bd)}
.fe-tile-ic{font-size:0;line-height:0}
.fe-tile-ic svg{display:block}
.fe-tile-nm{font-size:11px;text-align:center;word-break:break-all;
  overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  line-height:1.3}
.fe-tile-sz{font-size:10px;color:var(--dm)}
.fe-tile.dir .fe-tile-nm{color:var(--dir)}
.fe-tile.par .fe-tile-nm{color:var(--dm)}
#fe[data-view="tiles"] .fe-tile-ic svg{transform:scale(1.5);margin:4px}
#fe[data-view="icons"] .fe-tile{width:110px;padding:14px 8px 10px}
#fe[data-view="icons"] .fe-tile-ic svg{transform:scale(2.2);margin:10px}
#fe[data-view="icons"] .fe-tile-nm{font-size:12px}
.fe-tile-img-wrap{display:block;width:68px;height:56px;border-radius:5px;overflow:hidden;
  box-shadow:0 1px 4px #0005;flex-shrink:0}
.fe-tile-thumb{width:100%;height:100%;object-fit:cover;display:block;border-radius:5px}
.fe-tile-img-wrap svg{display:none;transform:none!important;margin:4px!important;width:24px;height:24px}
.fe-tile-img-wrap.err .fe-tile-thumb{display:none}
.fe-tile-img-wrap.err svg{display:block}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap{width:68px;height:56px}
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap{width:86px;height:70px}
#fe[data-view="tiles"] .fe-tile-ic .fe-tile-img-wrap svg,
#fe[data-view="icons"] .fe-tile-ic .fe-tile-img-wrap svg{transform:none!important;margin:8px!important}
.fe-row .fe-acts{
  display:inline-flex;align-items:center;gap:3px;
  position:absolute;right:8px;top:50%;transform:translateY(-50%);
  opacity:0;transition:opacity .12s;pointer-events:none}
.fe-row:hover .fe-acts{opacity:1;pointer-events:auto}
.fe-tile .fe-acts{
  display:flex;justify-content:center;gap:4px;
  position:absolute;bottom:0;left:0;right:0;
  padding:4px 4px 5px;
  background:linear-gradient(transparent,var(--s1)cc 40%,var(--s1) 100%);
  border-radius:0 0 var(--r) var(--r);
  opacity:0;transition:opacity .14s;pointer-events:none}
.fe-tile:hover .fe-acts{opacity:1;pointer-events:auto}
#fe[data-view="list"] .fe-tile .fe-acts{
  position:absolute;right:6px;top:50%;transform:translateY(-50%);
  background:none;border-radius:0;padding:0;width:auto;left:auto}
.fe-act-btn{
  background:var(--s2);border:1px solid var(--bd);border-radius:4px;
  color:var(--mt);cursor:pointer;padding:3px 5px;
  transition:background .1s,color .1s,border-color .1s;
  display:flex;align-items:center;justify-content:center}
.fe-act-btn:hover{background:var(--hover);color:var(--ac);border-color:var(--ac)}
.fe-row td.c-nm{position:relative}
#fe-statusbar{display:flex;justify-content:space-between;padding:4px 14px;
  background:var(--s1);border-top:1px solid var(--bd);flex-shrink:0;font-size:11px;color:var(--dm)}
#fe-tip{
  position:fixed;pointer-events:none;z-index:200;
  background:var(--s2);border:1px solid var(--bd);border-radius:var(--r);
  padding:9px 12px;font-size:11.5px;line-height:1.7;color:var(--tx);
  max-width:380px;overflow-wrap:anywhere;word-break:break-word;
  box-shadow:0 4px 20px #000a;opacity:0;
  transition:opacity .15s ease-out;
}
#fe-tip.show{opacity:1;transition:opacity .18s ease-in .06s}
.tip-header{display:flex;align-items:center;gap:7px;margin-bottom:4px}
.tip-icon{flex-shrink:0;display:flex;align-items:center}
.tip-icon svg{display:block}
.tip-name{font-weight:600;font-size:12px;word-break:break-all;color:var(--tx)}
.tip-line{color:var(--mt);font-size:11px;line-height:1.6}
.tip-warn{color:var(--dm);font-size:10.5px;margin-top:3px;border-top:1px solid var(--bd);padding-top:3px}
#fe-toast{
  position:fixed;bottom:32px;left:50%;transform:translateX(-50%) translateY(6px);
  background:#1f2937;color:#e5e7eb;padding:8px 18px;border-radius:20px;
  font-size:12px;opacity:0;transition:all .22s;pointer-events:none;white-space:nowrap;
  border:1px solid #374151;z-index:200
}
#fe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:var(--dm)}
#fe.compact tbody td{padding:2px 12px}
#fe.compact .fe-tile{padding:6px 6px 5px;gap:3px}
#fe-settings-modal{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center}
#fe-settings-bg{position:absolute;inset:0;background:#00000088;backdrop-filter:blur(2px)}
#fe-settings-dialog{
  position:relative;z-index:1;
  background:var(--s1);border:1px solid var(--bd);border-radius:10px;
  width:520px;max-width:calc(100vw - 40px);max-height:82vh;
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;
}
#fe-settings-hdr{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px;border-bottom:1px solid var(--bd);flex-shrink:0;
}
#fe-settings-hdr>span{font-size:14px;font-weight:600;color:var(--tx)}
#fe-settings-close{background:none;border:none;color:var(--dm);cursor:pointer;
  font-size:14px;padding:3px 7px;border-radius:4px;line-height:1;transition:color .1s,background .1s}
#fe-settings-close:hover{background:var(--hover);color:var(--tx)}
#fe-settings-body{overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:20px}
.fe-st-section{display:flex;flex-direction:column;gap:10px}
.fe-st-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;
  color:var(--dm);padding-bottom:4px;border-bottom:1px solid var(--bd)}
.fe-st-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.fe-st-lbl{font-size:12px;color:var(--mt);min-width:90px;flex-shrink:0}
.fe-st-radio{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--tx);cursor:pointer}
.fe-st-radio input{accent-color:var(--ac);cursor:pointer}
.fe-st-check{display:flex;align-items:center;gap:7px;font-size:13px;color:var(--tx);cursor:pointer}
.fe-st-check input{accent-color:var(--ac);cursor:pointer;width:14px;height:14px}
.fe-st-select{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:12px;outline:none;cursor:pointer}
.fe-st-input{background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:4px 8px;border-radius:var(--r);font-size:12px;outline:none;width:100%;
  font-family:inherit;box-sizing:border-box}
.fe-st-input:focus{border-color:var(--ac)}
.fe-st-rules-hint{font-size:11px;color:var(--dm);font-style:italic}
.fe-st-rules-cols{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;padding:0 2px 4px;align-items:center;font-size:10px;color:var(--dm)}
.fe-st-col-lbl{font-size:10px;color:var(--dm);font-weight:500}
.fe-st-rule{display:grid;grid-template-columns:16px 22px 1fr 58px 32px 24px;
  gap:6px;align-items:center;padding:5px 2px;border-bottom:1px solid var(--bd)}
.fe-st-rule:last-child{border-bottom:none}
.fe-st-rule input[type="checkbox"]{accent-color:var(--ac);cursor:pointer;width:13px;height:13px}
.fe-st-rule-preview{display:flex;align-items:center;justify-content:center;height:20px}
.fe-st-rule-pattern,.fe-st-rule-label{
  background:var(--s2);border:1px solid var(--bd);color:var(--tx);
  padding:3px 6px;border-radius:var(--r);font-size:11px;
  font-family:'SF Mono',Consolas,monospace;outline:none;transition:border-color .15s;width:100%}
.fe-st-rule-pattern:focus,.fe-st-rule-label:focus{border-color:var(--ac)}
.fe-st-rule-label{text-align:center}
.fe-st-rule-color{border:1px solid var(--bd);background:none;cursor:pointer;
  width:28px;height:24px;padding:1px;border-radius:4px;flex-shrink:0}
.fe-st-rule-del{background:none;border:none;color:var(--dm);cursor:pointer;
  padding:3px 5px;font-size:12px;border-radius:3px;line-height:1;transition:color .1s,background .1s;text-align:center}
.fe-st-rule-del:hover{color:#f85149;background:var(--hover)}
.fe-st-rules-empty{font-size:12px;color:var(--dm);padding:8px 2px;font-style:italic}
.fe-row.selected td{background:var(--act)}
.fe-row.selected .fe-nm{color:var(--ac)}
.fe-tile.selected{background:var(--act);border-color:var(--ac)}
#fe-qlook{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center}
#fe-ql-bg{position:absolute;inset:0;background:#0009;backdrop-filter:blur(2px)}
#fe-ql-dialog{position:relative;z-index:1;background:var(--s1);border:1px solid var(--bd);
  border-radius:10px;width:min(880px,calc(100vw - 64px));height:min(78vh,900px);
  display:flex;flex-direction:column;box-shadow:0 24px 64px #000d;overflow:hidden}
#fe-ql-hdr{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--bd);flex-shrink:0}
#fe-ql-icon svg{display:block}
#fe-ql-name{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#fe-ql-meta{font-size:11px;color:var(--dm);flex:1;white-space:nowrap}
#fe-ql-open{font-size:11px;color:var(--ac);text-decoration:none;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap}
#fe-ql-open:hover{border-color:var(--ac)}
#fe-ql-copy{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--mt);background:none;
  cursor:pointer;padding:3px 8px;border:1px solid var(--bd);border-radius:5px;white-space:nowrap;line-height:1.4}
#fe-ql-copy:hover:not(:disabled){border-color:var(--ac);color:var(--ac)}
#fe-ql-copy:disabled{opacity:.45;cursor:default}
#fe-ql-close{background:none;border:none;color:var(--dm);cursor:pointer;font-size:13px;padding:3px 7px;border-radius:4px;line-height:1}
#fe-ql-close:hover{background:var(--hover);color:var(--tx)}
#fe-ql-body{flex:1;overflow:auto;font-size:12px}
.fe-ql-center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px}
.fe-ql-note{font-size:11.5px;color:var(--dm);padding:6px 14px}
.fe-ql-note.err{color:#f85149}
.fe-ql-imgwrap{display:flex;align-items:center;justify-content:center;height:100%;padding:16px}
.fe-ql-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:4px}
.fe-code-wrap{display:flex;font:11.5px/1.55 'SF Mono',Menlo,Consolas,monospace;min-height:100%}
.fe-code-gut{padding:10px 8px 14px 12px;text-align:right;color:var(--dm);user-select:none;
  border-right:1px solid var(--bd);background:var(--s2);min-width:34px;flex-shrink:0}
.fe-code{padding:10px 14px 14px;white-space:pre;flex:1}
.tok-cmt{color:var(--mt);font-style:italic}
.tok-str{color:#7ee787}
.tok-kw{color:#ff7b72}
.tok-num{color:#79c0ff}
.tok-var{color:#d2a8ff}
#fe[data-theme="light"] .tok-str{color:#0a7d33}
#fe[data-theme="light"] .tok-kw{color:#cf222e}
#fe[data-theme="light"] .tok-num{color:#0550ae}
#fe[data-theme="light"] .tok-var{color:#8250df}
.fe-ql-table{border-collapse:collapse;width:100%;font:11.5px 'SF Mono',Menlo,Consolas,monospace}
.fe-ql-table th{position:sticky;top:0;background:var(--s2);padding:6px 10px;text-align:left;
  border-bottom:1px solid var(--bd);cursor:pointer;white-space:nowrap;color:var(--mt);font-weight:600;z-index:1}
.fe-ql-table th:hover{color:var(--tx)}
.fe-ql-table th.sorted{color:var(--ac)}
.fe-ql-table td{padding:4px 10px;border-bottom:1px solid var(--s2);white-space:nowrap;
  max-width:340px;overflow:hidden;text-overflow:ellipsis}
.fe-ql-table th.num,.fe-ql-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.fe-ql-table tbody tr:hover{background:var(--hover)}
.fe-jt-root,.fe-jl-root{padding:10px 14px;font:11.5px/1.6 'SF Mono',Menlo,Consolas,monospace}
.fe-jt summary,.fe-jl-line summary{cursor:pointer;list-style:none}
.fe-jt summary::-webkit-details-marker,.fe-jl-line summary::-webkit-details-marker{display:none}
.fe-jt summary::before{content:'▸';display:inline-block;width:12px;color:var(--dm);font-size:9px}
.fe-jt[open]>summary::before{content:'▾'}
.fe-jt summary:hover{background:var(--hover)}
.fe-jt-kids{padding-left:16px;border-left:1px solid var(--s3);margin-left:4px}
.fe-jt-key{color:#79c0ff}
#fe[data-theme="light"] .fe-jt-key{color:#0550ae}
.fe-jt-colon{color:var(--dm)}
.fe-jt-badge{color:var(--dm);font-size:10.5px}
.fe-jt-row{padding-left:12px}
.fe-jl-line{border-bottom:1px solid var(--s2);padding:2px 0}
.fe-jl-line summary{display:flex;gap:8px;align-items:baseline}
.fe-jl-line summary::before{content:'▸';color:var(--dm);font-size:9px;flex-shrink:0}
.fe-jl-line[open]>summary::before{content:'▾'}
.fe-jl-n{color:var(--dm);min-width:28px;text-align:right;user-select:none;font-size:10.5px;flex-shrink:0}
.fe-jl-prev{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--mt)}
.fe-jl-line.bad{display:flex;gap:8px;align-items:baseline}
.fe-jl-err{color:#f85149;font-size:10px;border:1px solid #f8514940;border-radius:3px;padding:0 4px;flex-shrink:0}
#fe-ctx{position:fixed;z-index:360;background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);
  min-width:180px;box-shadow:0 8px 24px #0009;display:none;padding:4px 0}
.fe-ctx-item{display:flex;align-items:center;gap:8px;padding:6px 12px;color:var(--tx);
  font-size:12px;cursor:pointer;white-space:nowrap}
.fe-ctx-item:hover{background:var(--hover)}
.fe-ctx-key{margin-left:auto;color:var(--dm);font-size:10px;padding-left:16px}
.fe-ctx-sep{height:1px;background:var(--bd);margin:4px 0}
`;

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

  initPreview({ iconRules: () => iconRules });

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
  (document.getElementById('fe-search') as HTMLInputElement).addEventListener('input', function () {
    filterConfig.q = this.value;
    const fq = document.getElementById('fe-filter-q') as HTMLInputElement | null;
    if (fq) fq.value = this.value;
    applyAll();
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
      try {
        const port = chrome.runtime.connectNative('com.better_file_browser.ghostty');
        port.postMessage({ action: 'open_terminal', path });
        port.onDisconnect.addListener(() => { if (chrome.runtime.lastError) fallbackCopy(path); });
        return;
      } catch { /* fall through to copy */ }
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
      crumbMenu.innerHTML = entries.map(e =>
        `<a href="${esc(e.href)}" class="fe-dd-item${e.isDir ? ' dir' : ''}">${getIcon(e, iconRules)}<span>${esc(e.name)}</span></a>`
      ).join('');
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
    navigator.clipboard.writeText(val).then(() => toast(`Copied: ${val}`)).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = val; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); toast(`Copied: ${val}`);
    });
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
    // Clicking row whitespace (not the name link) selects the entry
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    if (holder && !(e.target as HTMLElement).closest('a')) {
      setSel(parseInt(holder.dataset.idx!));
    }
  });

  // ── Selection & keyboard navigation ───────────────────────────────
  let selIdx = -1;
  function entryShown(en: Entry): boolean {
    return !en.isHidden || fe.classList.contains('show-hidden');
  }
  function setSel(i: number): void {
    document.querySelectorAll('#fe-scroll .selected').forEach(el => el.classList.remove('selected'));
    selIdx = i;
    if (i < 0) return;
    document.querySelectorAll<HTMLElement>(`#fe-scroll [data-idx="${i}"]`).forEach(el => {
      el.classList.add('selected');
      if (el.offsetParent) el.scrollIntoView({ block: 'nearest' });
    });
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

  document.addEventListener('keydown', e => {
    const ae = document.activeElement;
    if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName)) return;
    if (settingsModal.style.display !== 'none') return;
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
    else if (e.key === 'Enter' && selIdx >= 0) { location.href = VISIBLE[selIdx].href; }
    else if (e.key === 'Backspace') {
      e.preventDefault();
      const up = ALL_ENTRIES.find(x => x.isParent);
      if (up) location.href = up.href;
      else if (rawPath !== '/') location.href = 'file:///';
    }
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
    setSel(idx);
    ctxMenu.innerHTML = [
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
    const fullPath = rawPath.replace(/\/$/, '') + '/' + en.name + (en.isDir ? '/' : '');
    if      (item.dataset.act === 'pv')      openPreview(en);
    else if (item.dataset.act === 'cp-path') copyText(fullPath);
    else if (item.dataset.act === 'cp-name') copyText(en.name);
    else if (item.dataset.act === 'term')    openInTerminal(en.isDir ? fullPath : rawPath);
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
        <input type="color" class="fe-st-rule-color"  value="${rule.color}"        title="Icon color">
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
    settingsModal.style.display = 'flex';
  }
  function closeSettings(): void { settingsModal.style.display = 'none'; }

  document.getElementById('fe-settings-btn')!.addEventListener('click', openSettings);
  document.getElementById('fe-settings-close')!.addEventListener('click', closeSettings);
  document.getElementById('fe-settings-bg')!.addEventListener('click', closeSettings);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && settingsModal.style.display !== 'none') closeSettings();
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

})();
