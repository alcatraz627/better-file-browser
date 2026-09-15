// The page shell: path bar, sidebar, main column and the two dialogs, as one
// HTML string. main.ts renders it once for a listing or a file page; the
// modules then wire the elements by id.
import type { Entry, Settings } from './types';
import { esc } from './utils';
import { PI } from './icons';
import { getSaved, getTags } from './storage';
import { renderMarkdown } from './renderers';
import { HELP_TABS } from './help';
import { renderDialog, type DialogSpec } from './dialog';
import { renderFileContent } from './file-page';
import { renderRows, renderTiles, renderSavedList, renderCrumbs, type RenderContext } from './render';

export interface PageParams {
  initTheme: string; initView: string; initZoom: number; initHidden: boolean;
  fileMode: boolean; rawPath: string; folderPath: string; fileName: string; segments: string[];
  settings: Settings; curIsBookmarked: boolean;
  dirs: number; files: number; extOpts: string; recentsHTML: string;
  entries: Entry[]; ctx: RenderContext;
}

export function renderPage(p: PageParams): string {
  const { initTheme, initView, initZoom, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings, curIsBookmarked, dirs, files, extOpts, recentsHTML } = p;
  const ALL_ENTRIES = p.entries;
  const ctx0 = p.ctx;
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


  const SETTINGS_DIALOG: DialogSpec = {
    id: 'fe-settings-modal', mark: PI.gear, title: 'Settings', subtitle: 'Stored in this browser profile',
    tabs: [
      { key: 'appearance', label: 'Appearance', hint: 'theme, view, density', body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Theme</div>
          <div class="fe-st-row">
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="dark" title="Dark theme"> Dark</label>
            <label class="fe-st-radio"><input type="radio" name="bfb-theme" value="light" title="Light theme"> Light</label>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title">Appearance</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Default view</span>
            <select id="fe-st-defview" class="fe-st-select" title="View a folder opens in">
              <option value="details">Details</option>
              <option value="list">List</option>
              <option value="tiles">Tiles</option>
              <option value="icons">Large Icons</option>
            </select>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-compact" title="Tighter rows and tiles"> Compact mode</label>
          </div>
          <div class="fe-st-row">
            <label class="fe-st-check"><input type="checkbox" id="fe-st-sidebar" title="Saved, Notes, Recent and Favorites on the left"> Show sidebar</label>
          </div>
          <div class="fe-st-row">
            <span class="fe-st-lbl">Date format</span>
            <select id="fe-st-datefmt" class="fe-st-select" title="How the Modified column reads">
              <option value="short">Short — Apr 17</option>
              <option value="full">Full — April 17, 2025</option>
            </select>
          </div>
        </div>
` },
      { key: 'files', label: 'Files', hint: 'file pages, icon rules', body: `
        <div class="fe-st-section">
          <div class="fe-st-title">File pages</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="A file opened directly in the tab renders like the preview">Render file pages</span>
            <select id="fe-st-filepages" class="fe-st-select" title="Which files opened directly get the rendered page">
              <option value="all">All text files</option>
              <option value="not-md">All except markdown</option>
              <option value="off">Off (Chrome's plain text)</option>
            </select>
          </div>
        </div>
        <div class="fe-st-section">
          <div class="fe-st-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Custom Icon Rules</span>
            <button id="fe-st-add-rule" class="fe-pbn" title="Add an icon rule">+ Add rule</button>
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
          <button id="fe-st-reset-rules" class="fe-pbn" style="margin-top:8px;align-self:flex-start;color:#f85149;border-color:#f8514940" title="Replace every rule with the built-in set">Reset to defaults</button>
        </div>
` },
      { key: 'notes', label: 'Notes', hint: 'the notes folder', body: `
        <div class="fe-st-section">
          <div class="fe-st-title">Notes</div>
          <div class="fe-st-row">
            <span class="fe-st-lbl" title="A folder of .md files. See docs/notes-contract.md">Notes folder</span>
            <input type="text" id="fe-st-notes-root" class="fe-st-input" placeholder="/Users/you/Notes" spellcheck="false" title="Absolute path of the notes folder">
          </div>
          <div class="fe-st-hint" id="fe-st-notes-hint" style="font-size:11px;color:var(--dm);margin-top:-4px"></div>
        </div>
` },
      { key: 'terminal', label: 'Terminal', hint: 'which app opens', body: `
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
` },
      { key: 'ai', label: 'AI', hint: 'local model', body: `
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
` },
    ],
  };
  const HELP_DIALOG: DialogSpec = {
    id: 'fe-help-modal', mark: PI.help, title: 'Help', subtitle: 'Better File Browser · everything runs on your machine',
    tabs: HELP_TABS.map(t => ({ key: t.key, label: t.label, hint: t.hint, body: `<div class="fe-md">${renderMarkdown(t.md)}</div>` })),
  };

  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-view="${initView}"${fileMode ? ' class="fe-file-page"' : ''}>

  <div id="fe-bar">
    <div id="fe-bc">${renderCrumbs(folderPath, segments)}${fileMode ? `<span class="fe-sep">›</span><span class="fe-crumb fe-crumb-file">${esc(fileName)}</span>` : ''}</div>
    <button id="fe-term-btn" title="Open in terminal (${settings.terminalApp || 'ghostty'}) — Click to open current folder · Shift+click copies command"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 5l3 2-3 2M8 9h3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <button id="fe-bm-btn" class="${curIsBookmarked ? 'on' : ''}" title="${curIsBookmarked ? `Remove this ${fileMode ? 'file' : 'folder'} from Saved` : `Save this ${fileMode ? 'file' : 'folder'} (sidebar)`}">
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
        <div class="fe-sh" style="justify-content:space-between">Saved
          <button id="fe-sv-add" title="Save this ${fileMode ? 'file' : 'folder'} and name it">+</button></div>
        <input id="fe-sv-filter" type="text" placeholder="Filter saved…" spellcheck="false" autocomplete="off" title="Matches label, path and tag">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath)}</div>
      </div>
      <div class="fe-sec" id="fe-notes-sec" style="display:none">
        <div class="fe-sh" style="justify-content:space-between"><a id="fe-notes-root" title="Open the notes folder">Notes</a>
          <button id="fe-nt-add" title="New note (n)">+</button></div>
        <div id="fe-nt-list"></div>
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
      <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
      ${fileMode ? renderFileContent() : ''}
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
          <button id="fe-hidden-btn" class="${initHidden ? 'on' : ''}" title="Hidden files: ${initHidden ? 'showing' : 'hiding'} dotfiles · click to toggle">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5C2.5 3 4.8 1.5 6.5 1.5S10.5 3 12 6.5C10.5 10 8.2 11.5 6.5 11.5S2.5 10 1 6.5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="6.5" cy="6.5" r="2" fill="${initHidden ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <div id="fe-zoom-wrap" title="Zoom: ${initZoom}% · drag to scale the list (50 to 320%)">
            <svg width="11" height="11" viewBox="0 0 11 11"><circle cx="4.5" cy="4.5" r="3.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% · drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <button id="fe-deep-btn" title="Deep search: include every subfolder in the filter">
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 2.5h4l1 1.2h6v7H1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M3.5 6h3l.8 1h2.7v2.5H3.5z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
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
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text inside files</span>
          <input id="fe-find-text" type="text" placeholder="words to look for…" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when deep search is on. Enter runs."/>
          <label class="fe-st-check" title="Match case"><input type="checkbox" id="fe-find-case" title="Match case"> Aa</label>
          <button id="fe-find-run" class="fe-pbn" title="Run the text search (Enter)">Run</button>
          <button id="fe-find-cancel" class="fe-pbn" style="display:none" title="Stop scanning">Cancel</button>
          <span id="fe-find-status"></span>
          <button id="fe-find-save" class="fe-pbn" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">☆ Save view</button>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name" title="Sort by name · again flips · drag the edge to resize">Name <span class="si">↕</span><span class="fe-col-rz"></span></th>
              <th class="c-tp" data-ck="tp" title="Type · drag the edge to resize">Type<span class="fe-col-rz"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size" title="Sort by size · again flips">Size <span class="si">↕</span><span class="fe-col-rz"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date" title="Sort by modified date · again flips">Modified <span class="si">↕</span></th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
      </div>

      <div id="fe-statusbar">
        <span id="fe-status-text">${fileMode ? esc(fileName) : `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`}</span>
        ${fileMode ? '<span id="fe-fp-reload" title="Re-rendered when the file changes on disk">watching for changes</span>' : ''}
        <span id="fe-status-path">${esc(rawPath)}</span>
      </div>
    </div>
  </div>

  <div id="fe-crumb-menu"></div>
  <div id="fe-tip"></div>
  <div id="fe-toast"></div>

  ${renderDialog(SETTINGS_DIALOG)}
  ${renderDialog(HELP_DIALOG)}
</div>`;
  return PAGE_HTML;
}
