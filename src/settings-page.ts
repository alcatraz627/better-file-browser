// The Settings dialog's contents. Each row names a setting in a few words and
// keeps its control on the right; a choice between a few values is a row of
// buttons, a range is a slider, a longer list is a dropdown with icons. Control
// ids are what settings-ui.ts binds to.
import type { DialogSpec } from './dialog';
import { PI } from './icons';
import { UI_ICON, VIEW_ICONS, line } from './control-icons';
import { segHtml, sliderHtml, ddHtml, chipsHtml, switchHtml, type Opt } from './controls';
import { APP_ICONS } from './theme';

const row = (label: string, desc: string, ctl: string, attrs = '') =>
  `<div class="fe-set"${attrs}><div class="fe-set-tx"><span class="fe-set-l">${label}</span>${desc ? `<span class="fe-set-d">${desc}</span>` : ''}</div><div class="fe-set-c">${ctl}</div></div>`;
// A row whose control needs the full width sits under its label.
const wide = (label: string, desc: string, ctl: string) =>
  `<div class="fe-set wide"><div class="fe-set-tx"><span class="fe-set-l">${label}</span>${desc ? `<span class="fe-set-d">${desc}</span>` : ''}</div><div class="fe-set-c">${ctl}</div></div>`;
const card = (title: string, rows: string, action = '') =>
  `<section class="fe-set-group"><h3 class="fe-set-h"><span>${title}</span>${action}</h3><div class="fe-set-card">${rows}</div></section>`;
const sw = (id: string, title: string) => switchHtml({ id, title });
const iconBtn = (id: string, icon: string, title: string) => `<button type="button" id="${id}" class="btn fe-ibtn" data-icon title="${title}" aria-label="${title}">${icon}</button>`;
const note = (text: string, id = '') => `<p class="fe-set-note"${id ? ` id="${id}"` : ''}>${text}</p>`;

// A small window drawn in the colours it picks, so the choice shows what it
// will look like.
const thumb = (group: string, value: string, name: string, kind: 'mode' | 'p') =>
  `<label class="fe-set-sw" title="${name}"><input type="radio" name="${group}" value="${value}" title="${name}"><span class="fe-set-thumb" data-${kind}="${value}"><i class="sb"></i><i class="r1"></i><i class="r2"></i><i class="pill"></i></span><span>${name}</span></label>`;

export const PALETTE_NAMES: [string, string][] = [
  ['slate', 'Slate'], ['violet', 'Violet'], ['sand', 'Sand'], ['ink', 'Ink'],
  ['ocean', 'Ocean'], ['forest', 'Forest'], ['ember', 'Ember'], ['nord', 'Nord'],
];

const i = (body: string) => line(body, 14);
export const SORT_OPTS: Opt[] = [
  { value: '', label: 'As listed', icon: i('<path d="M3 6h18M3 12h18M3 18h18"/>') },
  { value: 'name', label: 'Name', icon: i('<path d="M4 18 8 6l4 12M5.5 14h5M15 6h5l-5 12h5"/>') },
  { value: 'date', label: 'Modified', icon: i('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') },
  { value: 'size', label: 'Size', icon: i('<path d="M3 20h18M6 20v-5M10 20V9M14 20v-8M18 20V4"/>') },
  { value: 'type', label: 'Type', icon: i('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h6"/>') },
  { value: 'ext', label: 'Extension', icon: i('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>') },
];
export const SORT_DIR_OPTS: Opt[] = [
  { value: 'asc', icon: i('<path d="M12 19V5M5 12l7-7 7 7"/>'), hint: 'Ascending' },
  { value: 'desc', icon: i('<path d="M12 5v14M19 12l-7 7-7-7"/>'), hint: 'Descending' },
];
export const GROUP_OPTS: Opt[] = [
  { value: 'none', label: 'None', icon: i('<path d="M3 6h18M3 12h18M3 18h18"/>') },
  { value: 'folders-first', label: 'Folders first', icon: i('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>') },
  { value: 'files-first', label: 'Files first', icon: i('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>') },
  { value: 'ext', label: 'By extension', icon: i('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>') },
  { value: 'type', label: 'By type', icon: i('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/>') },
];
const TERM_OPTS: Opt[] = [
  { value: 'ghostty', label: 'Ghostty' }, { value: 'terminal', label: 'Terminal' }, { value: 'iterm', label: 'iTerm2' },
  { value: 'wezterm', label: 'WezTerm' }, { value: 'kitty', label: 'Kitty' }, { value: 'custom', label: 'Custom', hint: 'your own command' },
].map(o => ({ ...o, icon: UI_ICON.terminal }));

export function settingsDialog(): DialogSpec {
  return {
    id: 'fe-settings-modal', mark: PI.gear, title: 'Settings', subtitle: 'Kept in this browser',
    tabs: [
      { key: 'look', label: 'Look', hint: 'Theme, colour, size', icon: UI_ICON.appearance, tone: 'var(--nc-pink)', desc: 'Theme, colours, icon and size.', body:
        card('Theme',
          row('Mode', '', `<div class="fe-set-sws">${thumb('bfb-theme', 'dark', 'Dark', 'mode') + thumb('bfb-theme', 'light', 'Light', 'mode') + thumb('bfb-theme', 'system', 'System', 'mode')}</div>`) +
          row('Palette', '', `<div class="fe-set-sws grid4">${PALETTE_NAMES.map(([v, n]) => thumb('bfb-palette', v, n, 'p')).join('')}</div>`)) +
        card('App icon',
          wide('', 'Shows in the tab and in an installed app window', `<div class="fe-appicons" role="radiogroup" aria-label="App icon">${APP_ICONS.map(a =>
            `<label class="fe-appicon" title="${a.name}"><input type="radio" name="bfb-appicon" value="${a.id}" aria-label="${a.name}" title="${a.name}"><img alt="" data-src="assets/app-icons/${a.file}"><span>${a.name}</span></label>`).join('')}</div>`)) +
        card('Size',
          row('Interface', 'Everything', sliderHtml('fe-st-uiscale', [80, 90, 100, 110, 125, 150], '%', 'Interface size')) +
          row('Text', 'Lists, sidebar, pages', sliderHtml('fe-st-rd-size', [12, 13, 14, 15, 16, 17, 18], ' px', 'Text size')) +
          row('Density', '', segHtml('fe-st-density', [
            { value: 'roomy', label: 'Roomy', icon: i('<path d="M3 5h18M3 12h18M3 19h18"/>') },
            { value: 'compact', label: 'Compact', icon: i('<path d="M3 7h18M3 11h18M3 15h18M3 19h18"/>') }], 'Row spacing', 'lg'))) +
        card('Help',
          row('Tooltips', 'Labels on hover', sw('fe-st-tooltips', 'Tooltips on every control')) +
          row('Keyboard', 'Every key, on a map', `<button id="fe-st-keys" class="btn" data-size="lg" title="Open the keyboard map">${UI_ICON.keyboard}Keys</button>`)) },

      { key: 'folders', label: 'Folders', hint: 'View, order, sidebar', icon: UI_ICON.folderOpen, tone: 'var(--nc-blue)', desc: 'How folders open, and what a click does.', body:
        card('Opening a folder',
          row('View', '', segHtml('fe-st-defview', VIEW_ICONS.map(v => ({ value: v.id, icon: v.ico, hint: v.label })), 'View a folder opens in', 'lg')) +
          row('Sort', '', ddHtml('fe-st-sort', SORT_OPTS, 'Order a folder opens in', 'lg') + segHtml('fe-st-sort-dir', SORT_DIR_OPTS, 'Direction', 'lg')) +
          row('Group', '', ddHtml('fe-st-group', GROUP_OPTS, 'Grouping a folder opens with', 'lg')) +
          row('Dates', '', segHtml('fe-st-datefmt', [{ value: 'short', label: 'Apr 17' }, { value: 'full', label: 'April 17, 2025' }], 'How dates read', 'lg'))) +
        card('Opening a file',
          row('Click a file', '', segHtml('fe-st-click', [
            { value: 'look', label: 'Preview', icon: UI_ICON.eye },
            { value: 'go', label: 'Open', icon: UI_ICON.external }], 'What a click on a file does', 'lg')) +
          row('Preview', '', segHtml('fe-st-panel', [
            { value: 'modal', label: 'Float', icon: i('<rect width="14" height="12" x="5" y="6" rx="2"/>') },
            { value: 'side', label: 'Dock', icon: UI_ICON.preview }], 'Where the preview opens', 'lg') + iconBtn('fe-st-panel-reset', UI_ICON.reset, 'Reset dragged sizes'))) +
        card('Sidebar',
          row('Sidebar', '', sw('fe-st-sidebar', 'Show the sidebar')) +
          row('History', 'Recent places and closed tabs', sw('fe-st-sec-recent', 'Show the History lens'))) +
        card('Terminal',
          row('Open in', '', ddHtml('fe-st-terminal', TERM_OPTS, 'Terminal app', 'lg')) +
          row('Command', '${p} is the folder', `<input type="text" id="fe-st-term-custom" class="tb fe-st-input" data-size="lg" placeholder='open -a MyTerm "\${p}"' spellcheck="false" title='Shell command. \${p} is the folder.'>`, ' id="fe-st-term-custom-row" style="display:none"') +
          note('', 'fe-st-term-hint')) },

      { key: 'files', label: 'Files', hint: 'Pages, icons', icon: UI_ICON.files, tone: 'var(--nc-teal)', desc: 'Reading, file pages and icons.', body:
        card('Reading',
          row('Width', 'Markdown pages', segHtml('fe-st-rd-column', [
            { value: 'unset', label: 'Full' }, { value: 'xl', label: 'Wide' }, { value: 'lg', label: 'Medium' }, { value: 'md', label: 'Narrow' }], 'Reading width', 'lg')) +
          row('Line height', '', sliderHtml('fe-st-rd-lh', [1.4, 1.5, 1.65, 1.8, 2], '', 'Line height')) +
          row('Code', '', sliderHtml('fe-st-rd-code', [11, 12, 13, 14, 15, 16], ' px', 'Code size')) +
          row('Wrap lines', 'Raw text and code', sw('fe-st-wrap', 'Wrap long lines'))) +
        card('File pages',
          row('Pages for', '', segHtml('fe-st-filepages', [
            { value: 'all', label: 'All text' }, { value: 'not-md', label: 'Not .md' }, { value: 'off', label: 'Off' }], 'Which files open as pages', 'lg')) +
          row('Chrome opens', 'In its own viewer', chipsHtml('fe-st-excluded-exts', '.ext', 'Extensions Chrome opens itself') + iconBtn('fe-st-excluded-reset', UI_ICON.reset, 'Restore .pdf .html .htm'))) +
        card('Icon rules', `
          <div class="fe-rule-sugg" id="fe-st-rule-sugg"></div>
          <div id="fe-st-rules-list"></div>`,
          `<span class="fe-set-h-acts">${iconBtn('fe-st-reset-rules', UI_ICON.reset, 'Reset to the built-in rules')}<button id="fe-st-add-rule" class="btn" data-size="sm" title="Add a rule">${UI_ICON.add}Rule</button></span>`) },

      { key: 'notes', label: 'Notes', hint: 'Notes, editing', icon: UI_ICON.notes, tone: 'var(--nc-orange)', desc: 'Your notes folder, and where you can edit.', body:
        card('Notes',
          row('Folder', 'Markdown files', `<input type="text" id="fe-st-notes-root" class="tb fe-st-input" data-size="lg" placeholder="~/Notes" spellcheck="false" title="Notes folder">${iconBtn('fe-st-notes-pick', UI_ICON.folderOpen, 'Choose a folder')}`) +
          note('', 'fe-st-notes-hint')) +
        card('Editing',
          wide('Editable folders', 'Text files inside get Edit (e). Saves keep a 14-day backup.', chipsHtml('fe-st-edit-roots', '~/Code', 'Folders you can edit in'))) },

      { key: 'ai', label: 'AI', hint: 'Models', icon: UI_ICON.ai, tone: 'var(--nc-purple)', desc: 'Models that answer in Ask and the preview.', body: `
        <div id="fe-st-ai-card" class="fe-ai-hero">
          <span class="fe-st-ai-head"><span class="fe-st-ai-blink"><span class="dot"></span></span></span>
          <div class="fe-ai-hero-tx"><b class="fe-st-ai-state">Checking…</b><span id="fe-st-ai-sub"></span></div>
          ${iconBtn('fe-st-ai-refresh', UI_ICON.reset, 'Check again')}
        </div>` +
        card('On this Mac',
          row('Model', '', ddHtml('fe-st-ai-model', [], 'Local model', 'lg')) +
          row('Keep warm', 'Replies start at once', sw('fe-st-ai-warm', 'Keep the model loaded')) +
          `<div class="fe-st-ai-grid" id="fe-st-ai-grid"></div>` +
          note('', 'fe-st-ai-hint')) +
        card('Ask can use', `<div class="fe-ai-models" id="fe-st-ai-models"><p class="fe-set-note">Loading…</p></div>`) },

      { key: 'data', label: 'Data', hint: 'Export, import', icon: UI_ICON.data, tone: 'var(--nc-green)', desc: 'Move your settings and Saved list.', body:
        card('Your data',
          row('Export', 'Copies JSON', `<button id="fe-st-export" class="btn" data-size="lg" title="Copy everything as JSON">${UI_ICON.export}Export</button>`) +
          row('Import', 'Then reloads', `<button id="fe-st-import" class="btn" data-size="lg" title="Load a JSON export">${UI_ICON.import}Import</button><input type="file" id="fe-st-import-file" accept="application/json" style="display:none">`) +
          `<textarea id="fe-st-export-out" class="tb fe-st-input" style="display:none;width:100%;height:120px;font:var(--fs-sm) var(--mono)" spellcheck="false" title="The export, also on the clipboard"></textarea>`) },
    ],
  };
}
