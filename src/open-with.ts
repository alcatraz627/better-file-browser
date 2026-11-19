// "Open with": a file or folder in another app (Zed, VS Code, Cursor, or shown
// in Finder), or one of the person's own commands run on it, such as `cat`,
// `bash` or `code --add`. The commands come only from Settings, as rows of a
// name, a command and an optional colour; the path is added, quoted, as the last
// argument. A command runs in a new Ghostty window, or in the background.
// Older settings kept them as text, one per line as `Name: command` with `&` for
// the background; that text is still read until the rows are first saved.
import { esc } from './utils';
import { safeColor } from './icons';
import type { Settings } from './types';
import { UI_ICON } from './control-icons';
import { openLayer } from './layer';

export interface OwnCommand { name: string; cmd: string; terminal: boolean; filesOnly?: boolean; color?: string }
export const APPS = [
  { id: 'zed', label: 'Open in Zed' },
  { id: 'vscode', label: 'Open in VS Code' },
  { id: 'cursor', label: 'Open in Cursor' },
  { id: 'finder', label: 'Show in Finder' },
];
export const DEFAULT_COMMANDS = 'Show contents (files): cat\nRun with bash (files): bash\nAdd to VS Code: & code --add';
/// What Settings used to offer: read as today's, so nobody who kept it sees bash offered on a folder.
const OLD_DEFAULT = 'Show contents: cat\nRun with bash: bash\nAdd to VS Code: & code --add';

/** The commands written in Settings; a line without a name or a command is skipped. */
export function parseCommands(text: unknown): OwnCommand[] {
  return (typeof text !== 'string' || text === OLD_DEFAULT ? DEFAULT_COMMANDS : text).split('\n').map(l => l.trim()).filter(Boolean).flatMap(l => {
    const at = l.indexOf(':');
    if (at < 1) return [];
    const label = l.slice(0, at).trim();
    const filesOnly = /\s*\(files\)$/i.test(label);
    const name = label.replace(/\s*\(files\)$/i, '');
    let cmd = l.slice(at + 1).trim();
    const terminal = !cmd.startsWith('&');
    if (!terminal) cmd = cmd.slice(1).trim();
    return name && cmd ? [{ name, cmd, terminal, ...(filesOnly ? { filesOnly } : {}) }] : [];
  });
}

/** The commands in Settings: the rows once saved, else the older text. */
export function ownCommands(s: Pick<Settings, 'openWith' | 'openWithCmds'>): OwnCommand[] {
  if (!Array.isArray(s.openWith)) return parseCommands(s.openWithCmds);
  // A stored row is skipped, not trusted, when it is damaged or cannot run.
  const seen = new Set<string>();
  return s.openWith.filter(c => !!c && typeof c.name === 'string' && typeof c.cmd === 'string' && !commandProblem(c))
    .filter(c => { const k = c.name.trim().toLowerCase(); return !seen.has(k) && !!seen.add(k); })
    .map(c => ({ name: c.name, cmd: c.cmd, terminal: c.terminal !== false, ...(c.filesOnly ? { filesOnly: true } : {}), ...(typeof c.color === 'string' ? { color: c.color } : {}) }));
}

/** What is wrong with a command row, in a few words, or '' when it can run.
 *  `others` are the other rows, so a repeated name is caught. */
export function commandProblem(c: Pick<OwnCommand, 'name' | 'cmd'>, others: Pick<OwnCommand, 'name'>[] = []): string {
  const name = c.name.trim(), cmd = c.cmd.trim();
  if (!name) return 'Needs a name';
  if (!cmd) return 'Needs a command';
  if (/[\n\r]/.test(c.cmd)) return 'Keep it to one line';
  if (cmd.startsWith('&')) return 'Use the Window switch instead of &';
  if (others.some(o => o.name.trim().toLowerCase() === name.toLowerCase())) return 'Another command has this name';
  // The launcher hands the line to zsh, so an open quote would swallow the path.
  // `$'...'` is zsh's quote that takes backslash escapes, so it is read as its own kind.
  let quote = '', comment = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) { if (ch === quote[0]) quote = ''; else if (ch === '\\' && (quote === '"' || quote === "'$")) i++; }
    else if (ch === '\\') { if (i === cmd.length - 1) return 'Ends in a backslash'; i++; }
    else if (ch === '$' && cmd[i + 1] === "'") { quote = "'$"; i++; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(cmd[i - 1]))) { comment = true; break; }
  }
  if (quote) return 'A quote is left open';
  if (comment) return 'A # comment would hide the path';
  if (/[;|&]\s*$/.test(cmd)) return 'Ends in ; | or &, so the path is lost';
  return '';
}

/** The program a command runs, the first word, for the launcher to look up. */
export const commandProgram = (cmd: string) => cmd.trim().split(/\s+/)[0]?.replace(/^['"]|['"]$/g, '') ?? '';

const dot = (c: string) => `<i class="fe-ow-dot" style="--c:${safeColor(c)}" aria-hidden="true"></i>`;

/** Menu rows for the apps and the commands, as `data-act="ow:..."` items. */
export function openWithItems(commands: OwnCommand[], isDir = false): string {
  return APPS.map(a => `<div class="row fe-ctx-item" data-act="ow:${a.id}">${UI_ICON.external}<span>${a.label}</span></div>`).join('')
    + commands.map((c, i) => isDir && c.filesOnly ? '' : `<div class="row fe-ctx-item" data-act="ow:#${i}" title="${esc(c.cmd)} <path>${c.terminal ? ', in Ghostty' : ', in the background'}">${c.color ? dot(c.color) : UI_ICON.terminal}<span>${esc(c.name)}</span></div>`).join('');
}

/** Run a menu pick on `path`, saying so in a toast when it could not be done. */
export function runOpenWith(act: string, path: string, commands: OwnCommand[], toast: (m: string) => void): void {
  const pick = act.replace(/^ow:/, '');
  const own = pick.startsWith('#') ? commands[Number(pick.slice(1))] : null;
  const payload = own ? { action: 'run_with', path, cmd: own.cmd, terminal: own.terminal } : { action: 'open_with', path, target: pick };
  chrome.runtime.sendMessage({ type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload }, res => {
    if (chrome.runtime.lastError || !res?.ok) toast('Could not open it. Is the launcher installed (native/install.sh)?');
    else if (res.response?.success === false) toast(`Could not open it: ${res.response.error}`);
  });
}

/** A split button: the main part opens the file in its default app, the arrow lists the other ways to open it. */
export function openSplitHtml(main: string, more: string): string {
  return `<span class="fe-split"><button type="button" class="btn" data-icon ${main} title="Open in the default app">${UI_ICON.external}</button>`
    + `<button type="button" class="btn fe-split-more" data-icon ${more} title="Other ways to open it" aria-label="Other ways to open it" aria-haspopup="menu">${UI_ICON.chevronDown}</button></span>`;
}

/** The menu under that arrow: other apps, then the person's own commands. */
export function openWithMenu(anchor: HTMLElement, path: string, isDir: boolean, commands: OwnCommand[], toast: (m: string) => void): void {
  const menu = document.createElement('div');
  menu.className = 'fe-ctx fe-export-menu';
  menu.innerHTML = openWithItems(commands, isDir);
  const layer = openLayer(menu, { kind: 'popover', anchor, align: 'end', role: 'menu', group: 'menu', label: 'Open with' });
  menu.addEventListener('click', e => {
    const act = (e.target as Element).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act) return;
    layer.close('pick');
    runOpenWith(act, path, commands, toast);
  });
}
