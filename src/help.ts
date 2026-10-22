// Help, as pages of small cards rather than paragraphs: a keyboard map you
// can hover, a quick tour, mouse gestures, what files open as, notes and AI,
// and how the app holds together. Every key shown comes from keymap.ts.
import type { DialogTab } from './dialog';
import { KEYMAP, GROUPS, capsFor } from './keymap';
import { UI_ICON, line } from './control-icons';
import { PI } from './icons';
import { esc } from './utils';

const kbd = (k: string) => k.startsWith('hold ')
  ? `<i class="fe-km-then">hold</i><kbd>${esc(k.slice(5))}</kbd>`
  : k.split(' ').map(p => `<kbd>${esc(p)}</kbd>`).join('<i class="fe-km-then">then</i>');
const keys = (list: string[]) => list.map(kbd).join('<i class="fe-km-or">or</i>');

// A Mac keyboard, row by row: [cap id, label, width in key units].
type Cap = [string, string, number?];
const ROWS: Cap[][] = [
  [['esc', 'esc', 1.5], ...Array.from({ length: 12 }, (_, i): Cap => [`f${i + 1}`, `F${i + 1}`])],
  [['`', '`'], ...'1234567890'.split('').map((c): Cap => [c, c]), ['-', '-'], ['=', '='], ['backspace', '⌫', 2]],
  [['tab', '⇥', 1.5], ...'qwertyuiop'.split('').map((c): Cap => [c, c.toUpperCase()]), ['[', '['], [']', ']'], ['\\', '\\', 1.5]],
  [['caps', '⇪', 1.75], ...'asdfghjkl'.split('').map((c): Cap => [c, c.toUpperCase()]), [';', ';'], ["'", "'"], ['enter', '↩', 2.25]],
  [['shift', '⇧', 2.25], ...'zxcvbnm'.split('').map((c): Cap => [c, c.toUpperCase()]), [',', ','], ['.', '.'], ['/', '/'], ['shift', '⇧', 2.75]],
  [['fn', 'fn'], ['ctrl', '⌃'], ['alt', '⌥'], ['meta', '⌘', 1.25], ['space', '', 5], ['meta', '⌘', 1.25], ['alt', '⌥'], ['left', '←'], ['updown', '', 1], ['right', '→']],
];

function keyboardMap(): string {
  const uses = new Map<string, number>();
  for (const d of KEYMAP) for (const k of d.keys) for (const c of capsFor(k)) uses.set(c, (uses.get(c) ?? 0) + 1);
  const cap = ([id, label, w = 1]: Cap) => id === 'updown'
    ? `<span class="fe-km-ud"><span class="fe-km-cap half${uses.has('up') ? ' used' : ''}" data-cap="up">↑</span><span class="fe-km-cap half${uses.has('down') ? ' used' : ''}" data-cap="down">↓</span></span>`
    : `<span class="fe-km-cap${uses.has(id) ? ' used' : ''}${/^f\d/.test(id) || id === 'esc' ? ' fn' : ''}" data-cap="${esc(id)}" style="--w:${w}">${esc(label)}</span>`;
  const board = `<div class="fe-km-board" aria-hidden="true">${ROWS.map(r => `<div class="fe-km-row-k">${r.map(cap).join('')}</div>`).join('')}</div>`;
  const list = GROUPS.map(g => {
    const defs = KEYMAP.filter(d => d.group === g.name);
    if (!defs.length) return '';
    return `<section class="fe-km-g"><h3>${PI[g.icon] ?? ''}${esc(g.name)}</h3>${defs.map(d =>
      `<div class="fe-km-i" data-caps="${esc([...new Set(d.keys.flatMap(capsFor))].join(' '))}" data-q="${esc((d.title + ' ' + d.keys.join(' ') + ' ' + g.name).toLowerCase())}"><span>${esc(d.title)}</span><span class="fe-km-k">${keys(d.keys)}</span></div>`).join('')}</section>`;
  }).join('');
  return `<div class="fe-km">
    ${board}
    <div class="fe-km-bar"><input type="search" class="fe-km-q" placeholder="Find a key or an action" spellcheck="false" aria-label="Find a key or an action">
      <span class="fe-km-legend"><kbd>⌘K</kbd> run any of these · hold <kbd>⌥</kbd> to see keys on screen</span></div>
    <div class="fe-km-list">${list}</div>
  </div>`;
}

// One card: a coloured icon tile, a few words, and the keys or gesture.
const card = (icon: string, tone: string, title: string, text: string, how = '') =>
  `<div class="fe-hc" style="--tone:${tone}"><span class="fe-hc-ico">${icon}</span><div class="fe-hc-tx"><b>${title}</b><span>${text}</span></div>${how ? `<div class="fe-hc-how">${how}</div>` : ''}</div>`;
const cards = (title: string, body: string) => `<section class="fe-hs"><h3>${title}</h3><div class="fe-hcs">${body}</div></section>`;
const i = (body: string) => line(body, 18);
const T = { blue: 'var(--nc-blue)', teal: 'var(--nc-teal)', green: 'var(--nc-green)', orange: 'var(--nc-orange)', pink: 'var(--nc-pink)', purple: 'var(--nc-purple)', red: 'var(--nc-red)', yellow: 'var(--nc-yellow)' };
const POINTER = i('<path d="M4 4l7 17 2.5-7.5L21 11z"/>');

export const HELP_TABS: DialogTab[] = [
  { key: 'keys', label: 'Keyboard', hint: 'Every key, on a map', icon: UI_ICON.keyboard, tone: 'var(--nc-purple)', desc: 'Hover a row to see its keys. Hover a key to see what it does.', body: keyboardMap() },

  { key: 'start', label: 'Tour', hint: 'The basics', icon: UI_ICON.ai, tone: 'var(--nc-pink)', desc: 'Twelve things worth knowing.', body:
    cards('Move around',
      card(PI.folder, T.blue, 'Browse', 'Folders open in place.', keys(['↩', '⌫'])) +
      card(UI_ICON.eye, T.teal, 'Preview', 'Look without leaving.', keys(['Space'])) +
      card(UI_ICON.tab, T.green, 'Tabs', 'Keep places open.', keys(['t', 'w'])) +
      card(PI.bm, T.orange, 'Save', 'A folder for later.', keys(['b']))) +
    cards('Find things',
      card(PI.search, T.purple, 'Filter', 'Narrow this folder.', keys(['/'])) +
      card(UI_ICON.stack, T.pink, 'Palette', 'Any command or place.', keys(['⌘K'])) +
      card(UI_ICON.link, T.blue, 'Go to a path', 'Type or paste one.', keys(['l'])) +
      card(PI.recent, T.teal, 'History', 'Where you have been.', keys(['g 4']))) +
    cards('Make things',
      card(UI_ICON.notes, T.orange, 'Notes', 'Markdown, saved as you type.', keys(['n'])) +
      card(UI_ICON.rename, T.green, 'Edit', 'Any text file you allow.', keys(['e'])) +
      card(UI_ICON.comment, T.yellow, 'Comment', 'On a selection in a doc.', keys(['c'])) +
      card(UI_ICON.ai, T.purple, 'Ask', 'A model reads the file.', keys(['g 6']))) },

  { key: 'mouse', label: 'Mouse', hint: 'Clicks and drags', icon: i('<rect width="12" height="18" x="6" y="3" rx="6"/><path d="M12 7v4"/>'), tone: 'var(--nc-blue)', desc: 'The same gestures work on rows, sidebar items and tabs.', body:
    cards('Gestures',
      card(POINTER, T.blue, 'Click', 'File previews, folder opens.', '<span class="fe-hc-tag">click</span>') +
      card(POINTER, T.teal, 'Double-click', 'Open the file page.', '<span class="fe-hc-tag">2×</span>') +
      card(UI_ICON.tab, T.green, '⌥-click', 'Keep as a background tab.', '<kbd>⌥</kbd>') +
      card(UI_ICON.external, T.orange, 'Middle-click', 'A new Chrome tab.', '<span class="fe-hc-tag">middle</span>') +
      card(UI_ICON.list, T.purple, 'Right-click', 'The item menu.', keys(['x'])) +
      card(UI_ICON.check, T.pink, '⇧ or ⌘-click', 'Pick several.', '<kbd>⇧</kbd><kbd>⌘</kbd>') +
      card(PI.drag, T.yellow, 'Drag', 'Reorder tabs and Saved.', '<span class="fe-hc-tag">drag</span>') +
      card(UI_ICON.rename, T.red, 'Double-click a name', 'Rename in the sidebar.', keys(['F2']))) +
    cards('Panels',
      card(UI_ICON.preview, T.blue, 'Dock the preview', 'Float it, or pin it right.', keys(['d'])) +
      card(UI_ICON.fit, T.teal, 'Resize', 'Drag any edge or corner.', '<span class="fe-hc-tag">drag</span>') +
      card(i('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>'), T.green, 'Sidebar', 'Toggle, or drag its edge.', keys(['\\']))) },

  { key: 'files', label: 'Files', hint: 'What opens as what', icon: UI_ICON.files, tone: 'var(--nc-teal)', desc: 'Files show as pages, with the sidebar and tabs still there.', body:
    cards('Shown as',
      card(UI_ICON.fmtCode, T.blue, 'Code', 'Highlighted, numbered.') +
      card(UI_ICON.table, T.green, 'CSV, TSV', 'A sortable table.') +
      card(i('<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>'), T.orange, 'JSON', 'A tree you can fold.') +
      card(UI_ICON.files, T.purple, 'Markdown', 'Rendered, with diagrams.') +
      card(UI_ICON.image, T.pink, 'Images', 'Fit, zoom, rotate, copy.') +
      card(i('<path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/>'), T.red, 'Media, PDF', 'Played or embedded.')) +
    cards('On a file page',
      card(UI_ICON.contents, T.blue, 'Contents', 'Jump between headings.', keys(['⇧O'])) +
      card(PI.search, T.teal, 'Find', 'Inside this file.', keys(['/'])) +
      card(UI_ICON.fmtCode, T.green, 'Raw', 'See the source.', keys(['r'])) +
      card(i('<path d="M3 12h18M3 6h18M3 18h18"/>'), T.orange, 'Width', 'Full to narrow.', keys(['⇧W']))) },

  { key: 'notes', label: 'Notes and AI', hint: 'Write, ask, comment', icon: UI_ICON.notes, tone: 'var(--nc-orange)', desc: 'Plain Markdown on your disk, and models that read it.', body:
    cards('Notes',
      card(UI_ICON.add, T.orange, 'New note', 'Untitled until you type.', keys(['n'])) +
      card(UI_ICON.check, T.green, 'Autosave', 'A pause saves. So does ⌘S.', keys(['⌘S'])) +
      card(UI_ICON.pin, T.yellow, 'Pin and colour', 'Pinned notes sit on top.') +
      card(UI_ICON.tag, T.pink, 'Tags', 'Filter with #tag.') +
      card(UI_ICON.image, T.blue, 'Images', 'Paste one in.') +
      card(UI_ICON.versions, T.purple, 'Versions', 'Every save, from git.')) +
    cards('AI',
      card(UI_ICON.ai, T.purple, 'Ask', 'Chat about a file or folder.', keys(['g 6'])) +
      card(UI_ICON.bot, T.green, 'On this Mac', 'Local models stay local.') +
      card(i('<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9"/>'), T.blue, 'Gemini', 'Sends the file to Google.')) +
    cards('Comments',
      card(UI_ICON.comment, T.yellow, 'Comment', 'Select words, press c.', keys(['c'])) +
      card(UI_ICON.at, T.teal, 'Mention', '@claude answers in the file.') +
      card(UI_ICON.check, T.green, 'Suggest', 'Accept or reject edits.')) },

  { key: 'how', label: 'How it works', hint: 'The idea, and your data', icon: UI_ICON.info, tone: 'var(--nc-green)', desc: 'Three actions on four things.', body:
    cards('Three actions',
      card(UI_ICON.next, T.blue, 'Go', 'Move to it.', keys(['↩'])) +
      card(UI_ICON.eye, T.teal, 'Look', 'See it, stay put.', keys(['Space'])) +
      card(UI_ICON.pin, T.orange, 'Keep', 'Make it stay.', keys(['t', 'b']))) +
    cards('Four things',
      card(PI.folder, T.blue, 'Place', 'A folder.') +
      card(UI_ICON.file, T.green, 'File', 'Something in it.') +
      card(UI_ICON.notes, T.orange, 'Note', 'A file you write here.') +
      card(UI_ICON.list, T.purple, 'View', 'How a place is shown.')) +
    cards('Where things live',
      card(UI_ICON.data, T.teal, 'Settings, Saved', 'In this browser.') +
      card(UI_ICON.tab, T.pink, 'Tabs', 'In this Chrome tab only.') +
      card(UI_ICON.lock, T.green, 'Your files', 'Never leave the Mac, unless you ask Gemini.')) },
];

/// Make the keyboard map respond: hovering an action lights its keys,
/// hovering a key shows the actions that use it, typing filters both.
export function wireKeyboardMap(root: HTMLElement): void {
  const km = root.querySelector<HTMLElement>('.fe-km');
  if (!km) return;
  const caps = [...km.querySelectorAll<HTMLElement>('.fe-km-cap')];
  const rows = [...km.querySelectorAll<HTMLElement>('.fe-km-i')];
  const q = km.querySelector<HTMLInputElement>('.fe-km-q')!;
  let pinned: string | null = null;
  const light = (ids: string[]) => caps.forEach(c => c.classList.toggle('hl', ids.includes(c.dataset.cap!)));
  const filter = () => {
    const s = q.value.trim().toLowerCase();
    rows.forEach(r => {
      const hit = (!s || r.dataset.q!.includes(s)) && (!pinned || r.dataset.caps!.split(' ').includes(pinned));
      r.hidden = !hit;
    });
    km.querySelectorAll<HTMLElement>('.fe-km-g').forEach(g => { g.hidden = !g.querySelector('.fe-km-i:not([hidden])'); });
    caps.forEach(c => c.classList.toggle('pin', c.dataset.cap === pinned));
  };
  km.addEventListener('mouseover', e => {
    const row = (e.target as Element).closest<HTMLElement>('.fe-km-i');
    const cap = (e.target as Element).closest<HTMLElement>('.fe-km-cap');
    if (row) { light(row.dataset.caps!.split(' ')); rows.forEach(r => r.classList.toggle('on', r === row)); }
    else if (cap) { light([cap.dataset.cap!]); rows.forEach(r => r.classList.toggle('on', r.dataset.caps!.split(' ').includes(cap.dataset.cap!))); }
  });
  km.addEventListener('mouseleave', () => { light([]); rows.forEach(r => r.classList.remove('on')); });
  km.addEventListener('click', e => {
    const cap = (e.target as Element).closest<HTMLElement>('.fe-km-cap.used');
    if (!cap) return;
    pinned = pinned === cap.dataset.cap ? null : cap.dataset.cap!;
    filter();
  });
  q.addEventListener('input', filter);
  q.addEventListener('keydown', e => { if (e.key === 'Escape' && (q.value || pinned)) { e.stopPropagation(); q.value = ''; pinned = null; filter(); } });
}
