// The page shell: path bar, sidebar, main column and the two dialogs, as one
// HTML string. main.ts renders it once for a listing or a file page; the
// modules then wire the elements by id.
import type { Entry, Settings } from './types';
import { esc, fileHref } from './utils';
import { PI } from './icons';
import { UI_ICON, line } from './control-icons';
import { getSaved, getTags, homeDir, getFoldedGroups } from './storage';
import { renderMarkdown } from './renderers';
import { HELP_TABS } from './help';
import { renderDialog, type DialogSpec } from './dialog';
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
  const VIEW_MODES = [
    { id: 'details', label: 'Details',     ico: `<svg width="13" height="11" viewBox="0 0 13 11"><path d="M1 1h11M1 4h11M1 7h11M1 10h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: 'list',    label: 'List',        ico: `<svg width="13" height="11" viewBox="0 0 13 11"><circle cx="2" cy="2" r="1.1" fill="currentColor"/><path d="M5 2h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="5.5" r="1.1" fill="currentColor"/><path d="M5 5.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="2" cy="9" r="1.1" fill="currentColor"/><path d="M5 9h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
    { id: 'tree',    label: 'Tree',        ico: `<svg width="13" height="13" viewBox="0 0 13 13"><path d="M2 1.5v8h3M2 5.5h3M6 4.5h6M6 9.5h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="5.5" cy="4.5" r=".8" fill="currentColor"/><circle cx="5.5" cy="9.5" r=".8" fill="currentColor"/></svg>` },
    { id: 'tiles',   label: 'Tiles',       ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="1" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx=".8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>` },
    { id: 'icons',   label: 'Large Icons', ico: `<svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="1" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="1" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/><rect x="7" y="7" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/></svg>` },
  ] as const;

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

  const lensHead = (title: string, actions = '') =>
    `<div class="fe-lens-h"><span class="fe-lens-t"><b>${title}</b></span>${actions}</div>`;
  const railBtn = (lens: string, label: string, icon: string, hint: string, hidden = false) =>
    `<button type="button" class="fe-rail-btn" role="tab" data-lens="${lens}" id="fe-rail-${lens}" aria-controls="fe-lens-${lens}" title="${hint}"${hidden ? ' hidden' : ''}>${icon}<em>${label}</em></button>`;


  // Settings reads as a list of plain sentences: each row names the setting,
  // says what it changes, and keeps its control on the right. Rows sit in
  // cards by subject, each card under a small heading of its own; on/off
  // settings are switches. Control ids are what settings-ui.ts binds to, so
  // they stay stable.
  const stRow = (label: string, desc: string, ctl: string, attrs = '') =>
    `<div class="fe-set"${attrs}><div class="fe-set-tx"><span class="fe-set-l">${label}</span>${desc ? `<span class="fe-set-d">${desc}</span>` : ''}</div><div class="fe-set-c">${ctl}</div></div>`;
  const stCard = (title: string, rows: string, action = '') =>
    `<section class="fe-set-group"><h3 class="fe-set-h"><span>${title}</span>${action}</h3><div class="fe-set-card">${rows}</div></section>`;
  const stSwitch = (id: string, title: string) => `<input type="checkbox" class="fe-switch" id="${id}" title="${title}">`;
  const stNote = (text: string, id = '') => `<p class="fe-set-note"${id ? ` id="${id}"` : ''}>${text}</p>`;
  // A small window drawn in the colours it picks: a sidebar, two lines of
  // text and an accent pill, so the choice shows what it will look like.
  const thumb = (group: string, value: string, name: string, title: string) =>
    `<label class="fe-set-sw" title="${title}"><input type="radio" name="${group}" value="${value}" title="${title}"><span class="fe-set-thumb" data-${group === 'bfb-theme' ? 'mode' : 'p'}="${value}"><i class="sb"></i><i class="r1"></i><i class="r2"></i><i class="pill"></i></span><span>${name}</span></label>`;
  const SETTINGS_DIALOG: DialogSpec = {
    id: 'fe-settings-modal', mark: PI.gear, title: 'Settings', subtitle: 'Saved in this browser profile',
    tabs: [
      { key: 'look', label: 'Look', hint: 'Theme, colour and size', icon: UI_ICON.appearance, tone: 'var(--nc-pink)', desc: 'How bfb looks: the theme, its colours, and the size of everything.', body:
        stCard('Theme',
          stRow('Mode', 'Dark or light surfaces', `<div class="fe-set-sws">${
            thumb('bfb-theme', 'dark', 'Dark', 'Dark theme') +
            thumb('bfb-theme', 'light', 'Light', 'Light theme')}</div>`) +
          stRow('Palette', 'Accent and surface colours', `<div class="fe-set-sws">${
            thumb('bfb-palette', 'slate', 'Slate', 'Slate and teal') +
            thumb('bfb-palette', 'violet', 'Violet', 'Violet') +
            thumb('bfb-palette', 'sand', 'Sand', 'Sand and rose') +
            thumb('bfb-palette', 'ink', 'Ink', 'Ink, black and white')}</div>`)) +
        stCard('Size',
          stRow('Interface size', 'Scales everything', `<select id="fe-st-uiscale" class="fe-st-select" title="Scale the whole interface, sidebar and text included">${[90, 100, 110, 125, 150].map(n => `<option value="${n}">${n}%</option>`).join('')}</select>`) +
          stRow('Text size', 'Text throughout the app', `<select id="fe-st-rd-size" class="fe-st-select" title="Text size throughout the app">${[13, 14, 15, 16, 17].map(n => `<option value="${n}">${n} px</option>`).join('')}</select>`) +
          stRow('Compact rows', 'Tighter rows in lists and tiles', stSwitch('fe-st-compact', 'Tighter rows and tiles'))) +
        stCard('Help',
          stRow('Tooltips', 'Labels on hover', stSwitch('fe-st-tooltips', 'Native tooltips on every control')) +
          stRow('Keyboard shortcuts', 'Every key on one page', `<button id="fe-st-keys" class="fe-pbn" title="Open Help on the Keyboard tab">${UI_ICON.keyboard}Show keys</button>`)) },
      { key: 'folders', label: 'Folders', hint: 'Views, order and the sidebar', icon: UI_ICON.folderOpen, tone: 'var(--nc-blue)', desc: 'What a folder shows when it opens, and what a click on a file does.', body:
        stCard('Opening a folder',
          stRow('View', 'How a folder first appears', `<select id="fe-st-defview" class="fe-st-select" title="View a folder opens in"><option value="details">Details</option><option value="list">List</option><option value="tree">Tree</option><option value="tiles">Tiles</option><option value="icons">Large icons</option></select>`) +
          stRow('Sort', '', `<select id="fe-st-sort" class="fe-st-select" title="Order every folder opens in"><option value="">As listed</option><option value="name">Name</option><option value="date">Modified</option><option value="size">Size</option><option value="type">Type</option><option value="ext">Extension</option></select><select id="fe-st-sort-dir" class="fe-st-select" title="Direction"><option value="asc">Ascending</option><option value="desc">Descending</option></select>`) +
          stRow('Group', '', `<select id="fe-st-group" class="fe-st-select" title="Grouping every folder opens with"><option value="none">None</option><option value="folders-first">Folders first</option><option value="files-first">Files first</option><option value="ext">By extension</option><option value="type">By type</option></select>`) +
          stRow('Dates', 'How the Modified column reads', `<select id="fe-st-datefmt" class="fe-st-select" title="How the Modified column reads"><option value="short">Apr 17</option><option value="full">April 17, 2025</option></select>`)) +
        stCard('Opening a file',
          stRow('A click on a file', '', `<select id="fe-st-click" class="fe-st-select" title="What a plain click on a file does"><option value="look">Preview it</option><option value="go">Open it</option></select>`) +
          stRow('Preview', 'Where the preview opens', `<select id="fe-st-panel" class="fe-st-select" title="Where the preview opens"><option value="modal">Floating window</option><option value="side">Docked to the side</option></select><button id="fe-st-panel-reset" class="fe-pbn" title="Forget the dragged sizes">${UI_ICON.reset}Reset sizes</button>`)) +
        stCard('Sidebar',
          stRow('Show the sidebar', '', stSwitch('fe-st-sidebar', 'Places, Notes and History on the left')) +
          stRow('History lens', 'Recent folders, files and closed tabs', stSwitch('fe-st-sec-recent', 'Folders and files you opened lately, and closed tabs'))) +
        stCard('Terminal',
          stRow('Open folders in', '', `<select id="fe-st-terminal" class="fe-st-select" title="Terminal app to open the current folder in"><option value="ghostty">Ghostty</option><option value="terminal">Terminal</option><option value="iterm">iTerm2</option><option value="wezterm">WezTerm</option><option value="kitty">Kitty</option><option value="custom">Custom command</option></select>`) +
          stRow('Command', 'Use ${p} for the folder; it is copied, not run', `<input type="text" id="fe-st-term-custom" class="fe-st-input" placeholder='open -a MyTerm "\${p}"' title='Shell command template. Use \${p} for the folder path.'>`, ' id="fe-st-term-custom-row" style="display:none"') +
          stNote('', 'fe-st-term-hint')) },
      { key: 'files', label: 'Files', hint: 'Reading and file pages', icon: UI_ICON.files, tone: 'var(--nc-teal)', desc: 'How files read as pages, which ones Chrome keeps, and their icons.', body:
        stCard('Reading',
          stRow('Reading width', 'Default for Markdown pages', `<select id="fe-st-rd-column" class="fe-st-select" title="Starting width for Markdown file pages"><option value="unset">Full width</option><option value="xl">Wide, 150 characters</option><option value="lg">Medium, 130 characters</option><option value="md">Narrow, 110 characters</option></select>`) +
          stRow('Line height', '', `<select id="fe-st-rd-lh" class="fe-st-select" title="Line height on file pages">${['1.5', '1.65', '1.8'].map(n => `<option value="${n}">${n}</option>`).join('')}</select>`) +
          stRow('Code size', '', `<select id="fe-st-rd-code" class="fe-st-select" title="Code size on file pages">${[12, 13, 14].map(n => `<option value="${n}">${n} px</option>`).join('')}</select>`) +
          stRow('Wrap long lines', 'Raw text and code', stSwitch('fe-st-wrap', 'Wrap long lines in raw text and code'))) +
        stCard('File pages',
          stRow('Show files as pages', '', `<select id="fe-st-filepages" class="fe-st-select" title="Which files opened directly get the rendered page"><option value="all">All text files</option><option value="not-md">All except Markdown</option><option value="off">Off, Chrome shows plain text</option></select>`) +
          stRow('Leave to Chrome', 'Open these in Chrome’s own viewer', `<input id="fe-st-excluded-exts" class="fe-st-input" type="text" placeholder=".pdf, .html, .htm" spellcheck="false" title="Extensions Chrome opens natively, separated by commas or spaces"><button id="fe-st-excluded-reset" class="fe-pbn" title="Restore the default list">${UI_ICON.reset}Defaults</button>`)) +
        stCard('Icon rules', `
          <p class="fe-set-note">Matches file names in any case, and wins over the built-in icons.</p>
          <div class="fe-st-rules-cols">
            <span></span><span></span>
            <span class="fe-st-col-lbl">Pattern</span>
            <span class="fe-st-col-lbl">Label</span>
            <span class="fe-st-col-lbl">Colour</span>
            <span></span>
          </div>
          <div id="fe-st-rules-list"></div>
          <button id="fe-st-reset-rules" class="fe-pbn fe-set-danger" title="Replace every rule with the built-in set">${UI_ICON.reset}Reset to built-in rules</button>`,
          `<button id="fe-st-add-rule" class="fe-pbn" title="Add an icon rule">${UI_ICON.add}Add rule</button>`) },
      { key: 'notes', label: 'Notes', hint: 'Notes and editing', icon: UI_ICON.notes, tone: 'var(--nc-orange)', desc: 'Where your notes live, and the folders you can edit files in.', body:
        stCard('Notes',
          stRow('Notes folder', 'A folder of Markdown files', `<input type="text" id="fe-st-notes-root" class="fe-st-input" placeholder="/Users/you/Notes" spellcheck="false" title="Absolute path of the notes folder"><button id="fe-st-notes-pick" class="fe-pbn" title="Pick the notes folder in the system chooser">${UI_ICON.folderOpen}<span>Choose</span></button>`) +
          stNote('', 'fe-st-notes-hint')) +
        stCard('Editing',
          stRow('Editable folders', 'Text files inside these get an Edit button (e)', `<input type="text" id="fe-st-edit-roots" class="fe-st-input" placeholder="~/Code, ~/Documents/notes" spellcheck="false" title="Folders separated by commas; ~ means home">`) +
          stNote('Each save keeps a 14-day backup in ~/Library/Application Support/BetterFileBrowser.')) },
      { key: 'ai', label: 'AI', hint: 'Local model', icon: UI_ICON.ai, tone: 'var(--nc-purple)', desc: 'The model on this Mac that answers questions in Ask.', body:
        stCard('Local model', `
          <div id="fe-st-ai-card">
            <div class="fe-st-ai-head">
              <span class="fe-st-ai-blink"><span class="dot"></span></span>
              <span class="fe-st-ai-state">Checking…</span>
            </div>
            <div class="fe-st-ai-grid" id="fe-st-ai-grid"></div>
            <div class="fe-st-ai-controls" id="fe-st-ai-controls" style="display:none">
              <span class="fe-set-l">Model</span>
              <select id="fe-st-ai-model" class="fe-st-select" title="Model used for questions"></select>
              <button id="fe-st-ai-warm" class="fe-pbn" title="Keep the model loaded"></button>
            </div>
            <div class="fe-st-ai-hint" id="fe-st-ai-hint"></div>
          </div>`,
          `<button id="fe-st-ai-refresh" class="fe-pbn" title="Check the model server again">${UI_ICON.reset}Check again</button>`) },
      { key: 'data', label: 'Data', hint: 'Export and import', icon: UI_ICON.data, tone: 'var(--nc-green)', desc: 'Take your settings and saved places to another browser.', body:
        stCard('Your data',
          stRow('Export', 'Settings and Saved list, as JSON', `<button id="fe-st-export" class="fe-pbn" title="Copy everything this extension stores as JSON">${UI_ICON.export}Export</button>`) +
          stRow('Import', 'Loads an export, then reloads', `<button id="fe-st-import" class="fe-pbn" title="Load a JSON export and reload">${UI_ICON.import}Import</button><input type="file" id="fe-st-import-file" accept="application/json" style="display:none" title="The JSON export to load">`) +
          `<textarea id="fe-st-export-out" class="fe-st-input" style="display:none;width:100%;height:120px;font:var(--fs-sm) var(--mono)" spellcheck="false" title="The export, also on the clipboard"></textarea>`) },
    ],
  };
  const HELP_DIALOG: DialogSpec = {
    id: 'fe-help-modal', mark: PI.help, title: 'Help', subtitle: 'Everything runs on your machine',
    tabs: HELP_TABS.map(t => ({ key: t.key, label: t.label, hint: t.hint, body: `<div class="fe-md">${renderMarkdown(t.md)}</div>` })),
  };

  const PAGE_HTML = `
<div id="fe" data-theme="${initTheme}" data-palette="${initPalette}" data-view="${initView}"${fileMode ? ' class="fe-file-page"' : ''}>

  <div id="fe-bar">
    <button id="fe-side-toggle" data-icon title="Show or hide the sidebar">${line('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 15)}</button>
    <div id="fe-bc">${renderCrumbs(folderPath, segments)}${fileMode ? `<span class="fe-sep">›</span><span class="fe-crumb fe-crumb-file">${esc(fileName)}</span>` : ''}</div>
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
      <div id="fe-rail" role="tablist" aria-label="Sidebar" aria-orientation="vertical">
        ${railBtn('places', 'Places', PI.home, 'Places: Home, your folders, Applications and Root')}
        ${railBtn('notes', 'Notes', PI.docs, 'Notes: saved places, saved views and your notes')}
        ${railBtn('history', 'History', PI.recent, 'History: folders and files you opened lately, and closed tabs', !!settings.hideRecent)}
        ${railBtn('search', 'Search', PI.search, 'Search: find text in the files of this folder')}
        ${railBtn('ask', 'Ask', PI.ask, 'Ask: put a question about this file or folder to the local model')}
      </div>
      <div id="fe-lenses">
      <div class="fe-lens" id="fe-lens-places" data-lens="places" role="tabpanel" aria-labelledby="fe-rail-places" hidden>
        ${lensHead('Places')}
        <div class="fe-sec" data-sec="places">
        ${placesHTML(homeDir(rawPath), rawPath)}
        </div>
      </div>
      <div class="fe-lens" id="fe-lens-notes" data-lens="notes" role="tabpanel" aria-labelledby="fe-rail-notes" hidden>
      ${lensHead('Notes')}
      <input id="fe-lens-filter" type="text" placeholder="Filter saved and notes" spellcheck="false" autocomplete="off" title="Matches label, path, title and tag, and words inside notes. #work matches tags only. Esc clears." hidden>
      <div id="fe-lens-tags" class="fe-lens-tags" hidden></div>
      <div class="fe-sec" data-collapse="saved">
        <div class="fe-sh" style="justify-content:space-between"><span class="fe-sh-label">Saved</span>
          <button id="fe-sv-add" title="Save this ${fileMode ? 'file' : 'folder'} and name it">+</button></div>
        <input id="fe-sv-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-sv-list">${renderSavedList(getSaved(), getTags(), rawPath, '', getFoldedGroups())}</div>
      </div>
      <div class="fe-sec" id="fe-notes-sec" data-collapse="notes">
        <div class="fe-sh" style="justify-content:space-between"><span class="fe-sh-label">Notes</span><a id="fe-notes-root" title="Open the notes folder" aria-label="Open the notes folder">${PI.folder}</a>
          <button id="fe-nt-add" title="New note (n)">+</button></div>
        <input id="fe-nt-filter" class="fe-proxy-filter" type="text" tabindex="-1" aria-hidden="true">
        <div id="fe-nt-list"></div>
      </div>
      </div>
      <div class="fe-lens" id="fe-lens-history" data-lens="history" role="tabpanel" aria-labelledby="fe-rail-history" hidden>
        ${lensHead('History')}
        ${recentsHTML}
      </div>
      <div class="fe-lens" id="fe-lens-search" data-lens="search" role="tabpanel" aria-labelledby="fe-rail-search" hidden>
        ${lensHead('Search')}
        <div id="fe-srch"></div>
      </div>
      <div class="fe-lens" id="fe-lens-ask" data-lens="ask" role="tabpanel" aria-labelledby="fe-rail-ask" hidden>
        ${lensHead('Ask')}
        <div id="fe-ask"></div>
      </div>
      </div>
    </nav>
    <div id="fe-side-rz" title="Drag to resize the sidebar"></div>

    <div id="fe-main">
      <div id="fe-tabs" title="Tabs of this Chrome tab (t keeps this one, w closes, p pins, [ ] switch, 1-9 jump)"></div>
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
          <button id="fe-hidden-btn" data-icon class="${initHidden ? 'on' : ''}" title="Hidden files: ${initHidden ? 'showing' : 'hiding'} dotfiles · click to toggle">
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
          <input id="fe-find-text" type="text" placeholder="Words to look for" autocomplete="off" spellcheck="false" title="Reads text files (up to 2 MB each) in this folder, or every subfolder when deep search is on. Enter runs."/>
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
