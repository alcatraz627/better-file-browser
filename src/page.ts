// The page shell: path bar, sidebar, main column and the two dialogs, as one
// HTML string. main.ts renders it once for a listing or a file page; the
// modules then wire the elements by id.
import type { Entry, Settings } from './types';
import { esc, fileHref } from './utils';
import { PI, CHEVRON_DOWN } from './icons';
import { UI_ICON, line, VIEW_ICONS } from './control-icons';
import { getSaved, getTags, homeDir, getFoldedGroups } from './storage';
import { renderMarkdown } from './renderers';
import { HELP_TABS } from './help';
import { renderDialog, type DialogSpec } from './dialog';
import { settingsDialog } from './settings-page';
import { renderFileContent } from './file-page';
import { renderRows, renderTiles, renderSavedList, renderCrumbs, type RenderContext } from './render';

export interface PageParams {
  initTheme: string; initPalette: string; initView: string; initZoom: number; initHidden: boolean;
  fileMode: boolean; rawPath: string; folderPath: string; fileName: string; segments: string[];
  settings: Settings; curIsBookmarked: boolean;
  dirs: number; files: number; extOpts: string; recentsHTML: string;
  entries: Entry[]; ctx: RenderContext;
}

/** The Places list: Home and the Finder favourites under it, then
 *  Applications and Root. Paths under Home are relative, so nothing names one
 *  account; with no home known yet, only Applications and Root show. */
export function placesHTML(home: string, rawPath: string): string {
  const places = [
    ...(home ? [
      { label: 'Home',                icon: 'home',   sub: '' },
      { label: 'Desktop',             icon: 'desk',   sub: 'Desktop/' },
      { label: 'Documents',           icon: 'docs',   sub: 'Documents/' },
      { label: 'Downloads',           icon: 'down',   sub: 'Downloads/' },
      { label: 'Pictures',            icon: 'pics',   sub: 'Pictures/' },
      { label: 'Screenshots',         icon: 'scrnsh', sub: 'Pictures/Screenshots/' },
      { label: 'Code',                icon: 'code',   sub: 'Code/' },
      { label: 'Versable',            icon: 'folder', sub: 'Code/Versable/' },
      { label: 'enhancement-product', icon: 'folder', sub: 'Code/Versable/enhancement-product/' },
      { label: 'resumes',             icon: 'docs',   sub: 'Code/Claude/resumes/' },
    ].map(p => ({ label: p.label, icon: p.icon, href: fileHref(home + '/' + p.sub) })) : []),
    { label: 'Applications', icon: 'apps', href: 'file:///Applications/' },
    { label: 'Root /',       icon: 'root', href: 'file:///' },
  ];
  return places.map(p =>
    `<a href="${p.href}" class="fe-si${p.href.replace(/\/$/, '') === fileHref(rawPath).replace(/\/$/, '') ? ' active' : ''}" title="${esc(p.label)}\n${esc(p.href)}">${(PI[p.icon] ?? PI.folder)}<span class="fe-sl">${esc(p.label)}</span></a>`
  ).join('');
}

export function renderPage(p: PageParams): string {
  const { initTheme, initPalette, initView, initZoom, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings, curIsBookmarked, dirs, files, extOpts, recentsHTML } = p;
  const ALL_ENTRIES = p.entries;
  const ctx0 = p.ctx;
  const VIEW_MODES = VIEW_ICONS;

  const VIEW_LABELS: Record<string, string> = {
    details: 'Full table: name, type, size, modified',
    list:    'Compact single-column rows',
    tree:    'Expand folders without leaving this page',
    tiles:   'Medium icon grid with filename below',
    icons:   'Large icon grid',
  };

  const viewBtnsHTML = VIEW_MODES.map(v =>
    `<button class="fe-view-btn" data-icon data-view="${v.id}" title="${v.label} view: ${VIEW_LABELS[v.id]}${v.id === initView ? ' (active)' : ''}">${v.ico}</button>`
  ).join('');

  const railBtn = (lens: string, label: string, icon: string, hint: string, hidden = false) =>
    `<button type="button" class="fe-rail-btn" role="tab" data-lens="${lens}" id="fe-rail-${lens}" aria-controls="fe-lens-${lens}" title="${hint}" data-hint="${hint}"${hidden ? ' hidden' : ''}>${icon}<em>${label}</em></button>`;


  const SETTINGS_DIALOG = settingsDialog();
  const HELP_DIALOG: DialogSpec = {
    id: 'fe-help-modal', mark: PI.help, title: 'Help', subtitle: 'What is here and how to use it',
    tabs: HELP_TABS.map(t => ({ key: t.key, label: t.label, hint: t.hint, body: `<div class="fe-md">${renderMarkdown(t.md)}</div>` })),
  };

  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-palette="${initPalette}" data-view="${initView}"${fileMode ? ' class="fe-file-page"' : ''}>

  <div id="fe-bar">
    <button id="fe-side-toggle" data-icon title="Show or hide the sidebar">${line('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 15)}</button>
    <div id="fe-bc">${renderCrumbs(folderPath, segments, fileMode, homeDir(rawPath))}${fileMode ? `<span class="fe-crumb fe-crumb-file cur">${esc(fileName)}</span>` : ''}<button id="fe-crumb-more" class="fe-crumb-more" title="Folders hidden for room" aria-label="Folders hidden for room" hidden>…</button></div>
    <button id="fe-term-btn" data-icon title="Open in terminal (${settings.terminalApp || 'ghostty'}), click opens the current folder, shift-click copies the command">${UI_ICON.terminal}</button>
    <button id="fe-bm-btn" data-icon class="${curIsBookmarked ? 'on' : ''}" title="${curIsBookmarked ? `Remove this ${fileMode ? 'file' : 'folder'} from Saved` : `Save this ${fileMode ? 'file' : 'folder'} (sidebar)`}">
      ${line(`<path id="fe-bm-path" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="${curIsBookmarked ? 'currentColor' : 'none'}"/>`)}
    </button>
    <button id="fe-theme-btn" data-icon title="Switch between dark and light">
      ${UI_ICON.appearance.replace('<svg ', '<svg id="fe-sun" ')}
      ${line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>').replace('<svg ', '<svg id="fe-moon" ')}
    </button>
    <button id="fe-help-btn" data-icon title="Help (press ?), what's here and how to use it">
      ${PI.help}
    </button>
    <button id="fe-settings-btn" data-icon title="Settings (press ,), theme, views, terminal, icon rules">
      ${PI.gear}
    </button>
  </div>

  <div id="fe-body">
    <nav id="fe-side">
      <div id="fe-rail" role="tablist" aria-label="Sidebar" aria-orientation="horizontal">
        ${railBtn('places', 'Places', PI.home, 'Places: Home, your folders, Applications and Root')}
        ${railBtn('saved', 'Saved', PI.bm, 'Saved: places and views you kept')}
        ${railBtn('notes', 'Notes', PI.docs, 'Notes: your notes folder')}
        ${railBtn('history', 'History', PI.recent, 'History: folders and files you opened lately, and closed tabs', !!settings.hideRecent)}
        ${railBtn('search', 'Search', PI.search, 'Search: find text in the files of this folder')}
        ${railBtn('ask', 'Ask', PI.ask, 'Ask: put a question about this file or folder to the local model')}
        ${railBtn('comments', 'Comments', UI_ICON.comment, 'Comments: every document with comments')}
      </div>
      <div id="fe-lenses">
      <div class="fe-lens" id="fe-lens-places" data-lens="places" role="tabpanel" aria-labelledby="fe-rail-places" hidden>
        <div class="fe-sec" data-sec="places">
        ${placesHTML(homeDir(rawPath), rawPath)}
        </div>
      </div>
      <div class="fe-lens" id="fe-lens-saved" data-lens="saved" role="tabpanel" aria-labelledby="fe-rail-saved" hidden>
      <div class="fe-lens-tools">
        <button id="fe-sv-add" class="fe-lens-ib accent" title="Save this ${fileMode ? 'file' : 'folder'} and name it" aria-label="Save this ${fileMode ? 'file' : 'folder'}">${UI_ICON.add}</button>
        <label class="fe-lens-box">
          <input id="fe-lens-filter" type="text" placeholder="Filter" spellcheck="false" autocomplete="off" title="Matches names and tags. #work matches tags only. Esc clears.">
          <button type="button" id="fe-lens-depth" class="fe-lens-depth" aria-pressed="false" title="Names only. Click to search inside too">Names</button>
        </label>
      </div>
      <div id="fe-lens-tags" class="fe-lens-tags" hidden></div>
      <div class="fe-sec" data-sec="saved">
        <input id="fe-sv-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath, '', getFoldedGroups())}</div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-notes" data-lens="notes" role="tabpanel" aria-labelledby="fe-rail-notes" hidden>
      <div class="fe-lens-tools">
        <button id="fe-nt-add" class="fe-lens-ib accent" title="New note (n)" aria-label="New note">${UI_ICON.add}</button>
        <a id="fe-notes-root" class="fe-lens-ib" title="Open the notes folder" aria-label="Open the notes folder">${UI_ICON.folderOpen}</a>
      </div>
      <div class="fe-sec" id="fe-notes-sec" data-sec="notes">
        <input id="fe-nt-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-nt-list"></div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-history" data-lens="history" role="tabpanel" aria-labelledby="fe-rail-history" hidden>
        ${recentsHTML}
      </div>
      <div class="fe-lens" id="fe-lens-search" data-lens="search" role="tabpanel" aria-labelledby="fe-rail-search" hidden>
        <div id="fe-srch"></div>
      </div>
      <div class="fe-lens" id="fe-lens-ask" data-lens="ask" role="tabpanel" aria-labelledby="fe-rail-ask" hidden>
        <div id="fe-ask"></div>
      </div>
      <div class="fe-lens" id="fe-lens-comments" data-lens="comments" role="tabpanel" aria-labelledby="fe-rail-comments" hidden>
        <div id="fe-docs-list"></div>
      </div>
      </div>
    </nav>
    <div id="fe-side-rz" title="Drag to resize the sidebar"></div>

    <div id="fe-main">
      <div id="fe-tabbar">
        <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
        <div id="fe-tabs-end">
          <button id="fe-tab-list" class="btn" data-hover-shade data-icon data-size="sm" hidden title="All tabs" aria-label="All tabs" aria-haspopup="menu">${CHEVRON_DOWN}</button>
          <button id="fe-open-pick" class="btn" data-hover-shade data-icon data-size="sm" title="Open a file or folder" aria-label="Open a file or folder">${UI_ICON.add}</button>
          <button id="fe-open-path" class="btn" data-hover-shade data-icon data-size="sm" title="Go to a path you paste or type" aria-label="Go to a path">${UI_ICON.link}</button>
        </div>
      </div>
      ${fileMode ? renderFileContent() : ''}
      <div id="fe-toolbar">
        <span id="fe-count">${fileMode ? '' : `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" title="Sort and group">
            ${line('<path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/>', 13)}
            Sort
          </button>
          <button id="fe-filter-btn" data-icon title="Filter by name or type">
            ${line('<path d="M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z"/>', 13)}
          </button>
          <button id="fe-hidden-btn" data-icon class="${initHidden ? 'on' : ''}" title="Hidden files: ${initHidden ? 'showing' : 'hiding'} dotfiles and comment files · click to toggle">
            ${line(`<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3" fill="${initHidden ? 'currentColor' : 'none'}"/>`, 13)}
          </button>
          <div id="fe-zoom-wrap" title="Zoom: ${initZoom}% · drag to scale the list (50 to 320%)">
            ${line('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 11)}
            <input type="range" id="fe-zoom" min="50" max="320" value="${initZoom}" step="5" title="Zoom: ${initZoom}% · drag to scale">
            <span id="fe-zoom-val">${initZoom}%</span>
          </div>
          <div id="fe-view-group">${viewBtnsHTML}</div>
          <button id="fe-deep-btn" data-icon title="Deep search: include every subfolder in the filter">
            ${line('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/><path d="M2 10h20"/>', 13)}
          </button>
          <input id="fe-search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Filter this folder by name"/>
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
            <button class="fe-pbn active" data-group="none" title="No grouping">None</button>
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
          <input id="fe-filter-q" type="text" placeholder="Pattern" autocomplete="off" spellcheck="false" title="Filter by name; turn on .* for a regular expression"/>
          <button id="fe-regex-btn" class="fe-pbn" title="Treat the pattern as a regular expression">.*</button>
          <span class="fe-panel-lbl" style="margin-left:12px">Type</span>
          <select id="fe-type-filter" title="Show only folders, files or one extension">
            <option value="all">All types</option>
            <option value="folders">Folders only</option>
            <option value="files">Files only</option>
            ${extOpts}
          </select>
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text inside files</span>
          <input id="fe-find-text" type="text" placeholder="Search text" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when deep search is on. Enter runs."/>
          <label class="fe-st-check" title="Use a regular expression for text inside files (advanced)"><input type="checkbox" id="fe-find-text-regex" title="Text regex"> Text regex</label>
          <label class="fe-st-check" title="Match case"><input type="checkbox" id="fe-find-case" title="Match case"> Aa</label>
          <label id="fe-find-depth-wrap" class="fe-st-check" style="display:none" title="Maximum subfolder depth to scan">Depth
            <select id="fe-find-depth" title="Maximum subfolder depth"><option value="1">1</option><option value="2">2</option><option value="4">4</option><option value="8" selected>8</option></select>
          </label>
          <button id="fe-find-run" class="fe-pbn" title="Run the text search (Enter)">Run</button>
          <button id="fe-find-cancel" class="fe-pbn" style="display:none" title="Stop scanning">Cancel</button>
          <span id="fe-find-status"></span>
          <span id="fe-find-error" role="alert"></span>
          <button id="fe-find-save" class="fe-pbn" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">☆ Save view</button>
        </div>
      </div>

      <div id="fe-scroll" style="zoom:${initZoom / 100}">
        <table id="fe-table">
          <thead>
            <tr>
              <th class="c-nm" data-ck="nm" data-sort="name" title="Sort by name · again flips · drag the edge to resize">Name <span class="si">↕</span><span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-tp" data-ck="tp" title="Type · drag the edge to resize">Type<span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-tg" data-ck="tg" title="Tags of saved files and folders · drag the edge to resize">Tags<span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-sz" data-ck="sz" data-sort="size" title="Sort by size · again flips">Size <span class="si">↕</span><span class="fe-col-rz" title="Drag to resize this column"></span></th>
              <th class="c-dt" data-ck="dt" data-sort="date" title="Sort by modified date · again flips">Modified <span class="si">↕</span></th>
              <th class="c-match" title="Number of content matches">Matches</th>
            </tr>
          </thead>
          <tbody id="fe-tbody">${renderRows(ALL_ENTRIES, ctx0)}</tbody>
        </table>
        <div id="fe-tiles">${renderTiles(ALL_ENTRIES, ctx0)}</div>
        <div id="fe-tree"></div>
      </div>

      <div id="fe-statusbar">
        ${fileMode ? '<span id="fe-status-meta"></span>' : ''}
        <span id="fe-status-text">${fileMode ? '' : `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`}</span>
        <span class="fe-status-grow"></span>
        ${fileMode ? '<span id="fe-fp-reload" hidden></span>' : ''}
        <button type="button" id="fe-status-path" title="Click to copy the path"><bdi>${esc(rawPath)}</bdi></button>
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
