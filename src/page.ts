// The page shell: path bar, sidebar, main column and the two dialogs, as one
// HTML string. main.ts renders it once for a listing or a file page; the
// modules then wire the elements by id.
import type { Entry, Settings } from './types';
import { esc, fileHref } from './utils';
import { PI, CHEVRON_DOWN } from './icons';
import { UI_ICON, line, VIEW_ICONS } from './control-icons';
import { getSaved, getTags, homeDir, getFoldedGroups } from './storage';
import { HELP_TABS } from './help';
import { renderDialog, type DialogSpec } from './dialog';
import { settingsDialog, SORT_OPTS, SORT_DIR_OPTS, GROUP_OPTS } from './settings-page';
import { renderFileContent } from './file-page';
import { renderRows, renderTiles, renderSavedList, renderCrumbs, type RenderContext } from './render';
import { segHtml, ddHtml, sliderHtml } from './controls';
import { DENSITY_NAMES } from './storage';

const SORT_ICON = line('<path d="m3 16 4 4 4-4M7 20V4M11 4h10M11 8h7M11 12h4"/>', 14);
const PI_FOLDER = '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>';
const STAR = '<path d="M11.53 2.3a.53.53 0 0 1 .94 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.9l5.16-.76a2.12 2.12 0 0 0 1.6-1.16z"/>';

export interface PageParams {
  initTheme: string; initPalette: string; initView: string; initDensity: number; initHidden: boolean;
  fileMode: boolean; rawPath: string; folderPath: string; fileName: string; segments: string[];
  settings: Settings; curIsBookmarked: boolean;
  dirs: number; files: number; extOpts: string[]; recentsHTML: string;
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
  const { initTheme, initPalette, initView, initDensity, initHidden, fileMode, rawPath, folderPath, fileName, segments, settings, curIsBookmarked, dirs, files, extOpts, recentsHTML } = p;
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
    `<button class="btn fe-view-btn" data-icon data-view="${v.id}" title="${v.label} view: ${VIEW_LABELS[v.id]}${v.id === initView ? ' (active)' : ''}">${v.ico}</button>`
  ).join('');

  const railBtn = (lens: string, label: string, icon: string, hint: string, hidden = false) =>
    `<button type="button" class="fe-rail-btn" role="tab" data-lens="${lens}" id="fe-rail-${lens}" aria-controls="fe-lens-${lens}" title="${hint}" data-hint="${hint}"${hidden ? ' hidden' : ''}>${icon}<em>${label}</em></button>`;


  const SETTINGS_DIALOG = settingsDialog();
  const HELP_DIALOG: DialogSpec = {
    id: 'fe-help-modal', mark: PI.help, title: 'Help', subtitle: 'What is here and how to use it',
    tabs: HELP_TABS,
  };

  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-palette="${initPalette}" data-view="${initView}" data-density="${initDensity}"${fileMode ? ' class="fe-file-page"' : ''}>

  <div id="fe-bar">
    <button id="fe-side-toggle" class="btn" data-icon title="Show or hide the sidebar">${line('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 15)}</button>
    <div id="fe-bc">${renderCrumbs(folderPath, segments, fileMode, homeDir(rawPath))}${fileMode ? `<span class="fe-crumb fe-crumb-file cur">${esc(fileName)}</span>` : ''}<button id="fe-crumb-more" class="btn fe-crumb-more" title="Folders hidden for room" aria-label="Folders hidden for room" hidden>…</button></div>
    <button id="fe-term-btn" class="btn" data-icon title="Open in terminal (${settings.terminalApp || 'ghostty'}), click opens the current folder, shift-click copies the command">${UI_ICON.terminal}</button>
    <button id="fe-bm-btn" data-icon class="btn ${curIsBookmarked ? 'on' : ''}" title="${curIsBookmarked ? `Remove this ${fileMode ? 'file' : 'folder'} from Saved` : `Save this ${fileMode ? 'file' : 'folder'} (sidebar)`}">
      ${line(`<path id="fe-bm-path" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="${curIsBookmarked ? 'currentColor' : 'none'}"/>`)}
    </button>
    <button id="fe-theme-btn" class="btn" data-icon title="Switch between dark and light">
      ${UI_ICON.appearance.replace('<svg ', '<svg id="fe-sun" ')}
      ${line('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>').replace('<svg ', '<svg id="fe-moon" ')}
    </button>
    <button id="fe-help-btn" class="btn" data-icon title="Help (press ?), what's here and how to use it">
      ${PI.help}
    </button>
    <button id="fe-settings-btn" class="btn" data-icon title="Settings (press ,), theme, views, terminal, icon rules">
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
        <button id="fe-sv-add" class="btn fe-lens-ib" data-icon data-size="lg" data-tone="accent" title="Save this ${fileMode ? 'file' : 'folder'} and name it" aria-label="Save this ${fileMode ? 'file' : 'folder'}">${UI_ICON.add}</button>
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
        <button id="fe-nt-add" class="btn fe-lens-ib" data-icon data-size="lg" data-tone="accent" title="New note (n)" aria-label="New note">${UI_ICON.add}</button>
        <a id="fe-notes-root" class="btn fe-lens-ib" data-icon data-size="lg" title="Open the notes folder" aria-label="Open the notes folder">${UI_ICON.folderOpen}</a>
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
          <button id="fe-tab-list" class="btn" data-icon data-size="sm" hidden title="All tabs" aria-label="All tabs" aria-haspopup="menu">${CHEVRON_DOWN}</button>
          <button id="fe-open-pick" class="btn" data-icon data-size="sm" title="Open a file or folder" aria-label="Open a file or folder">${UI_ICON.add}</button>
          <button id="fe-open-path" class="btn" data-icon data-size="sm" title="Go to a path you paste or type" aria-label="Go to a path">${UI_ICON.link}</button>
        </div>
      </div>
      ${fileMode ? renderFileContent() : ''}
      <div id="fe-toolbar">
        <span id="fe-count">${fileMode ? '' : `${dirs} folder${dirs !== 1 ? 's' : ''}, ${files} file${files !== 1 ? 's' : ''}`}</span>
        <div id="fe-tb-right">
          <button id="fe-sg-btn" class="btn" title="Sort and group" aria-expanded="false">
            ${SORT_ICON}<span id="fe-sg-cur">Sort</span>
          </button>
          <span class="fe-tb-sep"></span>
          <button id="fe-filter-btn" class="btn" data-icon title="Filter by name, type or text inside files" aria-expanded="false">
            ${line('<path d="M10 20a1 1 0 0 0 .55.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .52-1.34L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.74 1.67l7.22 7.99A2 2 0 0 1 10 14z"/>', 14)}
          </button>
          <button id="fe-deep-btn" class="btn" data-icon title="Subfolders: filter every folder under this one too">
            ${line('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/><path d="M2 10h20"/>', 14)}
          </button>
          <button id="fe-hidden-btn" data-icon class="btn ${initHidden ? 'on' : ''}" title="Hidden files: ${initHidden ? 'showing' : 'hiding'} dotfiles and comment files · click to toggle">
            ${line(`<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3" fill="${initHidden ? 'currentColor' : 'none'}"/>`, 14)}
          </button>
          <span class="fe-tb-sep"></span>
          <div id="fe-density-wrap" title="Detail: drag left for fewer, bigger items, right for smaller items with more facts (- and =)">
            <span class="fe-density-end" aria-hidden="true">${line('<rect width="16" height="16" x="4" y="4" rx="2"/>', 13)}</span>
            ${sliderHtml('fe-density', [1, 2, 3, 4, 5], '', 'Detail', DENSITY_NAMES)}
            <span class="fe-density-end" aria-hidden="true">${line('<path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16"/>', 13)}</span>
          </div>
          <span class="fe-tb-sep"></span>
          <div id="fe-view-group" role="group" aria-label="View">${viewBtnsHTML}</div>
          <label class="fe-in-box fe-tb-box"><input id="fe-search" type="text" placeholder="Filter" autocomplete="off" spellcheck="false" title="Filter this folder by name"/></label>
        </div>
      </div>

      <div id="fe-sg-panel" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Sort by</span>
          ${ddHtml('fe-sort-cols', SORT_OPTS, 'Sort this folder by')}
          ${segHtml('fe-sort-dir', SORT_DIR_OPTS, 'Direction')}
          <span class="fe-panel-lbl fe-panel-gap">Group by</span>
          ${ddHtml('fe-group-btns', GROUP_OPTS, 'Group this folder by')}
        </div>
      </div>

      <div id="fe-filter-bar" style="display:none">
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Name</span>
          <label class="fe-in-box fe-in-name">
            <input id="fe-filter-q" type="text" placeholder="Pattern" autocomplete="off" spellcheck="false" title="Filter by name; turn on .* for a regular expression"/>
            <span class="fe-in-chips"><button type="button" id="fe-regex-btn" class="fe-in-chip" title="Treat the pattern as a regular expression">.*</button></span>
          </label>
          <span class="fe-panel-lbl">Type</span>
          ${ddHtml('fe-type-filter', [
            { value: 'all', label: 'All types', icon: line('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>', 14) },
            { value: 'folders', label: 'Folders only', icon: line(PI_FOLDER, 14) },
            { value: 'files', label: 'Files only', icon: UI_ICON.file },
            ...extOpts.map(x => ({ value: x, label: '.' + x })),
          ], 'Show only folders, files or one extension')}
        </div>
        <div class="fe-panel-row">
          <span class="fe-panel-lbl">Text</span>
          <label class="fe-in-box fe-in-text">
            <input id="fe-find-text" type="text" placeholder="Find text" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when Subfolders is on. Enter runs."/>
            <span class="fe-in-chips">
              <label class="fe-in-chip" title="Match case"><input type="checkbox" id="fe-find-case" title="Match case">Aa</label>
              <label class="fe-in-chip" title="Use a regular expression for the text"><input type="checkbox" id="fe-find-text-regex" title="Use a regular expression for the text">.*</label>
            </span>
          </label>
          <span id="fe-find-depth-wrap" class="fe-panel-sub" style="display:none" title="How many levels of subfolders to look in">
            <span class="fe-panel-lbl">Depth</span>
            ${ddHtml('fe-find-depth', [1, 2, 4, 8].map(n => ({ value: String(n), label: n === 1 ? '1 level' : `${n} levels` })), 'Maximum subfolder depth')}
          </span>
          <button id="fe-find-run" class="btn" data-variant="outline" title="Run the text search (Enter)">${line('<path d="M6 4l13 8-13 8z"/>', 12)}Run</button>
          <button id="fe-find-cancel" class="btn" data-variant="outline" style="display:none" title="Stop scanning">${UI_ICON.close}Cancel</button>
          <span id="fe-find-status"></span>
          <span id="fe-find-error" role="alert"></span>
          <button id="fe-find-save" class="btn" data-variant="outline" style="margin-left:auto" title="Keep this search as a Saved view: this folder plus these fields">${line(STAR, 13)}Save view</button>
        </div>
      </div>

      <div id="fe-scroll">
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
