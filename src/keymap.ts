// Every key the app answers to, in one list. The command palette, the key
// hints and the keyboard map in Help all read it, so they cannot disagree.
// A key is written as it is pressed: modifiers then the key ("⌘K", "⇧T"), a
// sequence with a space ("g h"). `own` marks the keys the command layer
// binds itself; the rest are answered by the surface that owns them.
export type Scope = 'any' | 'listing' | 'tree' | 'preview' | 'file' | 'editor' | 'sidebar' | 'tabs' | 'menu' | 'dialog' | 'goto' | 'bar';
/// `field`: the key is a chord no text box types (such as ⌥↩), so it runs while typing too.
/// `over`: an anywhere key that also works over the open preview; true for all its keys, or the ones listed.
export interface KeyDef { id: string; group: string; title: string; keys: string[]; scope?: Scope; own?: boolean; field?: boolean; over?: true | string[] }

export const GROUPS: { name: string; icon: string }[] = [
  { name: 'Anywhere', icon: 'apps' },
  { name: 'Go', icon: 'home' },
  { name: 'Listing', icon: 'folder' },
  { name: 'View', icon: 'pics' },
  { name: 'Tabs', icon: 'tabset' },
  { name: 'Sidebar', icon: 'bm' },
  { name: 'Preview', icon: 'search' },
  { name: 'File page', icon: 'docs' },
  { name: 'Editor', icon: 'code' },
  { name: 'Menus and dialogs', icon: 'gear' },
];

export const KEYMAP: KeyDef[] = [
  // Anywhere
  { id: 'palette', group: 'Anywhere', title: 'Command palette', keys: ['⌘K'], own: true, over: true },
  { id: 'keys', group: 'Anywhere', title: 'Keyboard map', keys: ['?'], own: true, over: true },
  { id: 'settings', group: 'Anywhere', title: 'Settings', keys: [','], own: true, over: true },
  { id: 'hints', group: 'Anywhere', title: 'Show keys on screen', keys: ['hold ⌥'], own: true, over: true },
  { id: 'area-next', group: 'Anywhere', title: 'Next area', keys: ['F6', '⌃`'], own: true, over: true },
  { id: 'area-prev', group: 'Anywhere', title: 'Previous area', keys: ['⇧F6', '⌃⇧`'], own: true, over: true },
  { id: 'sidebar', group: 'Anywhere', title: 'Sidebar on or off', keys: ['\\'], own: true, over: true },
  { id: 'theme', group: 'Anywhere', title: 'Dark or light', keys: ['⇧L'], own: true, over: true },
  { id: 'esc', group: 'Anywhere', title: 'Close, or step back', keys: ['Esc'] },

  // Go
  { id: 'up', group: 'Go', title: 'Parent folder', keys: ['⌫', '⌘↑'], own: true, over: ['⌘↑'] },
  { id: 'home', group: 'Go', title: 'Home', keys: ['g h'], own: true },
  { id: 'path', group: 'Go', title: 'Type a path', keys: ['l'], own: true },
  { id: 'goto-bg', group: 'Go', title: 'Open the typed path as a background tab', keys: ['⌥↩'], scope: 'goto', own: true, field: true },
  { id: 'open-pick', group: 'Go', title: 'Open a file or folder', keys: ['o'], own: true },
  { id: 'save', group: 'Go', title: 'Save or unsave folder', keys: ['b'], own: true },
  { id: 'terminal', group: 'Go', title: 'Terminal here', keys: ['`'], own: true },
  { id: 'terminal-copy', group: 'Go', title: 'Copy terminal command', keys: ['⇧`'], own: true },
  { id: 'to-listing', group: 'Go', title: 'Focus the listing', keys: ['g l'], own: true },
  { id: 'area-leave', group: 'Go', title: 'Close the sidebar over the page, or go back to the listing', keys: ['Esc'], own: true, over: true },
  { id: 'crumb-menu', group: 'Go', title: 'Folder menu of a path crumb', keys: ['↓'], scope: 'bar', own: true },
  { id: 'to-sidebar', group: 'Go', title: 'Focus the sidebar', keys: ['g s'], own: true },
  { id: 'to-tabs', group: 'Go', title: 'Focus the tabs', keys: ['g t'], own: true },
  { id: 'to-toolbar', group: 'Go', title: 'Focus the toolbar', keys: ['g b'], own: true },
  { id: 'to-path', group: 'Go', title: 'Focus the path bar', keys: ['g p'], own: true },
  { id: 'lens-places', group: 'Go', title: 'Places', keys: ['g 1'], own: true },
  { id: 'lens-saved', group: 'Go', title: 'Saved', keys: ['g 2'], own: true },
  { id: 'lens-notes', group: 'Go', title: 'Notes', keys: ['g 3'], own: true },
  { id: 'lens-recent', group: 'Go', title: 'History', keys: ['g 4'], own: true },
  { id: 'lens-search', group: 'Go', title: 'Search', keys: ['g 5'], own: true },
  { id: 'lens-ask', group: 'Go', title: 'Ask', keys: ['g 6'], own: true },
  { id: 'lens-docs', group: 'Go', title: 'Comments', keys: ['g 7'], own: true },

  // Listing
  { id: 'move', group: 'Listing', title: 'Move', keys: ['↑', '↓'], scope: 'listing', own: true },
  { id: 'extend-up', group: 'Listing', title: 'Select upward', keys: ['⇧↑'], scope: 'listing', own: true },
  { id: 'extend-down', group: 'Listing', title: 'Select downward', keys: ['⇧↓'], scope: 'listing', own: true },
  { id: 'first', group: 'Listing', title: 'First item', keys: ['Home'], scope: 'listing', own: true },
  { id: 'last', group: 'Listing', title: 'Last item', keys: ['End'], scope: 'listing', own: true },
  { id: 'page-up', group: 'Listing', title: 'Page up', keys: ['PgUp'], scope: 'listing', own: true },
  { id: 'page-down', group: 'Listing', title: 'Page down', keys: ['PgDn'], scope: 'listing', own: true },
  { id: 'open', group: 'Listing', title: 'Open', keys: ['↩'], scope: 'listing', own: true },
  { id: 'open-bg', group: 'Listing', title: 'Keep as a background tab', keys: ['⌥↩'], scope: 'listing', own: true },
  { id: 'open-chrome', group: 'Listing', title: 'Open in a Chrome tab', keys: ['⌘↩'], scope: 'listing', own: true },
  { id: 'look', group: 'Listing', title: 'Preview', keys: ['Space'], scope: 'listing', own: true },
  { id: 'tree-open', group: 'Listing', title: 'Expand folder (Tree)', keys: ['→'], scope: 'tree', own: true },
  { id: 'tree-close', group: 'Listing', title: 'Collapse folder (Tree)', keys: ['←'], scope: 'tree', own: true },
  { id: 'menu', group: 'Listing', title: 'Item menu', keys: ['x', '⇧F10'], scope: 'listing', own: true },
  { id: 'select-all', group: 'Listing', title: 'Select all', keys: ['⌘A'], scope: 'listing', own: true },
  { id: 'copy-paths', group: 'Listing', title: 'Copy selected paths', keys: ['⌘C'], scope: 'listing', own: true },
  { id: 'copy-path', group: 'Listing', title: 'Copy path', keys: ['y'], scope: 'listing', own: true },
  { id: 'copy-name', group: 'Listing', title: 'Copy name', keys: ['⇧Y'], scope: 'listing', own: true },
  { id: 'filter', group: 'Listing', title: 'Filter', keys: ['/', '⌘F'], own: true },
  { id: 'new-note', group: 'Listing', title: 'New note', keys: ['n'], own: true },

  // View
  { id: 'view-details', group: 'View', title: 'Details', keys: ['v d'], own: true },
  { id: 'view-list', group: 'View', title: 'List', keys: ['v l'], own: true },
  { id: 'view-tree', group: 'View', title: 'Tree', keys: ['v t'], own: true },
  { id: 'view-tiles', group: 'View', title: 'Tiles', keys: ['v i'], own: true },
  { id: 'view-icons', group: 'View', title: 'Large icons', keys: ['v g'], own: true },
  { id: 'sort-name', group: 'View', title: 'Sort by name', keys: ['s n'], own: true },
  { id: 'sort-date', group: 'View', title: 'Sort by modified', keys: ['s m'], own: true },
  { id: 'sort-size', group: 'View', title: 'Sort by size', keys: ['s z'], own: true },
  { id: 'sort-type', group: 'View', title: 'Sort by type', keys: ['s t'], own: true },
  { id: 'sort-rev', group: 'View', title: 'Reverse the order', keys: ['s r'], own: true },
  { id: 'group', group: 'View', title: 'Next grouping', keys: ['s g'], own: true },
  { id: 'filter-panel', group: 'View', title: 'Filter panel', keys: ['f'], own: true },
  { id: 'deep', group: 'View', title: 'Include subfolders', keys: ['⇧D'], scope: 'listing', own: true },
  { id: 'hidden', group: 'View', title: 'Hidden files', keys: ['.'], own: true },
  { id: 'zoom-in', group: 'View', title: 'Less detail, bigger items', keys: ['='], own: true },
  { id: 'zoom-out', group: 'View', title: 'More detail, smaller items', keys: ['-'], own: true },
  { id: 'zoom-reset', group: 'View', title: 'Standard detail', keys: ['0'], own: true },

  // Tabs
  { id: 'tab-keep', group: 'Tabs', title: 'Keep this place', keys: ['t'], own: true },
  { id: 'tab-close', group: 'Tabs', title: 'Close', keys: ['w'], own: true },
  { id: 'tab-pin', group: 'Tabs', title: 'Pin', keys: ['p'], own: true },
  { id: 'tab-step', group: 'Tabs', title: 'Previous or next', keys: ['[', ']'], own: true, over: true },
  { id: 'tab-jump', group: 'Tabs', title: 'Jump to tab 1 to 9', keys: ['e 1…9'], own: true, over: true },
  { id: 'tab-reopen', group: 'Tabs', title: 'Reopen closed', keys: ['⇧T'], own: true },
  { id: 'tab-left', group: 'Tabs', title: 'Move tab left', keys: ['⇧['], own: true },
  { id: 'tab-right', group: 'Tabs', title: 'Move tab right', keys: ['⇧]'], own: true },
  { id: 'tab-list', group: 'Tabs', title: 'All tabs', keys: ['g a'], own: true },
  { id: 'tab-focus-move', group: 'Tabs', title: 'Move between tabs', keys: ['←', '→'], scope: 'tabs' },
  { id: 'tab-focus-shift', group: 'Tabs', title: 'Drag the focused tab', keys: ['⇧←', '⇧→'], scope: 'tabs', own: true },
  { id: 'tab-focus-close', group: 'Tabs', title: 'Close the focused tab', keys: ['⌫'], scope: 'tabs', own: true },
  { id: 'tab-focus-menu', group: 'Tabs', title: 'Menu of the focused tab', keys: ['⇧F10'], scope: 'tabs', own: true },

  // Sidebar
  { id: 'side-move', group: 'Sidebar', title: 'Move', keys: ['↑', '↓'], scope: 'sidebar' },
  { id: 'side-lens', group: 'Sidebar', title: 'Switch lens (on the bar)', keys: ['←', '→'], scope: 'sidebar' },
  { id: 'side-open', group: 'Sidebar', title: 'Open as a tab', keys: ['↩'], scope: 'sidebar' },
  { id: 'side-bg', group: 'Sidebar', title: 'Background tab', keys: ['⌥↩'], scope: 'sidebar', own: true },
  { id: 'side-rename', group: 'Sidebar', title: 'Rename', keys: ['F2'], scope: 'sidebar', own: true },
  { id: 'side-tags', group: 'Sidebar', title: 'Tags', keys: ['#'], scope: 'sidebar' },
  { id: 'side-remove', group: 'Sidebar', title: 'Remove', keys: ['⌫'], scope: 'sidebar', own: true },
  { id: 'side-rail', group: 'Sidebar', title: 'To the lens bar', keys: ['←'], scope: 'sidebar', own: true },
  { id: 'side-into', group: 'Sidebar', title: 'Into the open lens (on the bar)', keys: ['⌥↓'], scope: 'sidebar', own: true },
  { id: 'side-fold', group: 'Sidebar', title: 'Fold a group', keys: ['Space'], scope: 'sidebar' },
  { id: 'lens-filter', group: 'Sidebar', title: 'Filter this list', keys: ['/'], scope: 'sidebar', own: true },
  { id: 'ask-quote', group: 'Sidebar', title: 'Quote the selection or the part of a chat under the pointer into a chat', keys: ['q'], own: true },
  { id: 'lens-tags', group: 'Sidebar', title: 'Tag chips', keys: ['g #'], own: true },
  { id: 'side-look', group: 'Sidebar', title: 'Preview a file', keys: ['Space'], scope: 'sidebar', own: true },
  { id: 'side-chrome', group: 'Sidebar', title: 'Open in a Chrome tab', keys: ['⌘↩'], scope: 'sidebar', own: true },
  { id: 'side-props', group: 'Sidebar', title: 'Note colour, pin and tags', keys: ['#'], scope: 'sidebar', own: true },

  // Preview
  { id: 'pv-close', group: 'Preview', title: 'Close', keys: ['Space', 'Esc'], scope: 'preview', own: true },
  { id: 'pv-step', group: 'Preview', title: 'Previous or next file', keys: ['↑', '↓', '←', '→'], scope: 'preview', own: true },
  { id: 'pv-open', group: 'Preview', title: 'Open the page', keys: ['↩'], scope: 'preview', own: true },
  { id: 'pv-tab', group: 'Preview', title: 'Keep as a tab', keys: ['t'], scope: 'preview', own: true },
  { id: 'pv-dock', group: 'Preview', title: 'Dock or float', keys: ['d'], scope: 'preview', own: true },
  { id: 'pv-copy', group: 'Preview', title: 'Copy contents', keys: ['c'], scope: 'preview', own: true },
  { id: 'pv-ask', group: 'Preview', title: 'Ask about it', keys: ['a'], scope: 'preview', own: true },

  // File page
  { id: 'fp-raw', group: 'File page', title: 'Raw or rendered', keys: ['r'], scope: 'file', own: true },
  { id: 'fp-edit', group: 'File page', title: 'Edit', keys: ['e e'], scope: 'file', own: true },
  { id: 'fp-find', group: 'File page', title: 'Find in file', keys: ['/'], scope: 'file', own: true },
  { id: 'fp-comment', group: 'File page', title: 'Comment on the selection or paragraph', keys: ['c'], scope: 'file', own: true },
  { id: 'fp-cm-reply', group: 'File page', title: 'Reply to the comment', keys: ['⇧R'], scope: 'file', own: true },
  { id: 'fp-toc', group: 'File page', title: 'Contents', keys: ['⇧O'], scope: 'file', own: true },
  { id: 'fp-width', group: 'File page', title: 'Reading width', keys: ['⇧W'], scope: 'file', own: true },
  { id: 'fp-comments', group: 'File page', title: 'Comments panel', keys: ['⇧C'], scope: 'file', own: true },
  { id: 'fp-cm-step', group: 'File page', title: 'Previous or next comment', keys: ['⌥↑', '⌥↓'], scope: 'file', own: true },
  { id: 'fp-cm-clear', group: 'File page', title: 'Let go of the comment being looked at or written', keys: ['Esc'], scope: 'file', own: true },
  { id: 'fp-cm-post', group: 'File page', title: 'Post, or post a reply', keys: ['⌘↩', '⌘⇧↩'], scope: 'file' },

  // Editor
  { id: 'ed-save', group: 'Editor', title: 'Save', keys: ['⌘S'], scope: 'editor' },
  { id: 'ed-bold', group: 'Editor', title: 'Bold, italic, code', keys: ['⌘B', '⌘I', '⌘E'], scope: 'editor' },
  { id: 'ed-move', group: 'Editor', title: 'Move line', keys: ['⌥↑', '⌥↓'], scope: 'editor' },
  { id: 'ed-dup', group: 'Editor', title: 'Copy line', keys: ['⌥⇧↑', '⌥⇧↓'], scope: 'editor' },
  { id: 'ed-indent', group: 'Editor', title: 'Indent', keys: ['⇥', '⇧⇥'], scope: 'editor' },
  { id: 'ed-undo', group: 'Editor', title: 'Undo, redo', keys: ['⌘Z', '⌘⇧Z'], scope: 'editor' },
  { id: 'ed-link', group: 'Editor', title: 'Link', keys: ['⌘K'], scope: 'editor' },
  { id: 'ed-more', group: 'Editor', title: 'Strike, heading, quote, numbered list', keys: ['⌘⇧X', '⌘⇧H', '⌘⇧.', '⌘⇧7'], scope: 'editor' },
  { id: 'ed-mode', group: 'Editor', title: 'Raw, split or rich', keys: ['⌘⇧P'], scope: 'editor' },
  { id: 'note-rename', group: 'Editor', title: 'Rename this note', keys: ['F2'], scope: 'editor', own: true, field: true },
  { id: 'note-delete', group: 'Editor', title: 'Move this note to .trash', keys: ['⌘⇧⌫'], scope: 'editor', own: true, field: true },

  // Menus and dialogs
  { id: 'menu-move', group: 'Menus and dialogs', title: 'Move in a menu', keys: ['↑', '↓'], scope: 'menu', own: true },
  { id: 'menu-pick', group: 'Menus and dialogs', title: 'Pick', keys: ['↩'], scope: 'menu', own: true },
  { id: 'dlg-tabs', group: 'Menus and dialogs', title: 'Dialog pages', keys: ['[', ']'], scope: 'dialog', own: true },
  { id: 'dlg-fields', group: 'Menus and dialogs', title: 'Next control', keys: ['⇥'], scope: 'dialog' },
  { id: 'dlg-choice', group: 'Menus and dialogs', title: 'Change a choice', keys: ['←', '→'], scope: 'dialog' },
];

/// The physical keys a written key presses, for lighting them on the map:
/// "⌘K" → ["meta", "k"], "?" → ["shift", "/"], "g h" → ["g", "h"].
const SHIFTED: Record<string, string> = { '?': '/', '{': '[', '}': ']', '#': '3', '~': '`', '_': '-', '+': '=', '<': ',', '>': '.', '"': "'", ':': ';', '|': '\\' };
const NAMED: Record<string, string> = {
  '⌘': 'meta', '⇧': 'shift', '⌥': 'alt', '⌃': 'ctrl', '↑': 'up', '↓': 'down', '←': 'left', '→': 'right',
  '↩': 'enter', '⌫': 'backspace', '⇥': 'tab', esc: 'esc', space: 'space', home: 'left', end: 'right', pgup: 'up', pgdn: 'down',
};
export function capsFor(key: string): string[] {
  if (key.endsWith('1…9')) return [...key.slice(0, -3).split(' ').filter(Boolean), '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const out = new Set<string>();
  for (const part of key.replace(/^hold /, '').split(' ')) {
    if (/^(home|end|pgup|pgdn)$/i.test(part)) { out.add('fn'); out.add(NAMED[part.toLowerCase()]); continue; }
    if (/^F\d+$/.test(part)) { out.add(part.toLowerCase()); continue; }
    if (/^(esc|space)$/i.test(part)) { out.add(part.toLowerCase()); continue; }
    let rest = part;
    while (rest && '⌘⇧⌥⌃'.includes(rest[0]) && rest.length > 1) { out.add(NAMED[rest[0]]); rest = rest.slice(1); }
    const m = /^⇧(F\d+)$/.exec(part);
    if (m) { out.add(m[1].toLowerCase()); continue; }
    if (/^F\d+$/.test(rest)) { out.add(rest.toLowerCase()); continue; }
    if (NAMED[rest]) { out.add(NAMED[rest]); continue; }
    if (SHIFTED[rest]) { out.add('shift'); out.add(SHIFTED[rest]); continue; }
    if (/^[A-Z]$/.test(rest) && !part.startsWith('⌘')) { out.add('shift'); out.add(rest.toLowerCase()); continue; }
    out.add(rest.toLowerCase());
  }
  return [...out];
}
