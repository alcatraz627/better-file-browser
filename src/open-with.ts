// "Open with": a file or folder in another app (Zed, VS Code, Cursor, or shown
// in Finder), or one of the person's own commands run on it, such as `cat`,
// `bash` or `code --add`. The commands come only from Settings, one per line as
// `Name: command`; the path is added, quoted, as the last argument. A command
// runs in a new Ghostty window, or in the background when it starts with `&`.
import { esc } from './utils';
import { UI_ICON } from './control-icons';

export interface OwnCommand { name: string; cmd: string; terminal: boolean }
export const APPS = [
  { id: 'zed', label: 'Open in Zed' },
  { id: 'vscode', label: 'Open in VS Code' },
  { id: 'cursor', label: 'Open in Cursor' },
  { id: 'finder', label: 'Show in Finder' },
];
export const DEFAULT_COMMANDS = 'Show contents: cat\nRun with bash: bash\nAdd to VS Code: & code --add';

/** The commands written in Settings; a line without a name or a command is skipped. */
export function parseCommands(text: string | undefined): OwnCommand[] {
  return (text ?? DEFAULT_COMMANDS).split('\n').map(l => l.trim()).filter(Boolean).flatMap(l => {
    const at = l.indexOf(':');
    if (at < 1) return [];
    const name = l.slice(0, at).trim();
    let cmd = l.slice(at + 1).trim();
    const terminal = !cmd.startsWith('&');
    if (!terminal) cmd = cmd.slice(1).trim();
    return name && cmd ? [{ name, cmd, terminal }] : [];
  });
}

/** Menu rows for the apps and the commands, as `data-act="ow:..."` items. */
export function openWithItems(commands: OwnCommand[]): string {
  return APPS.map(a => `<div class="row fe-ctx-item" data-act="ow:${a.id}">${UI_ICON.external}<span>${a.label}</span></div>`).join('')
    + commands.map((c, i) => `<div class="row fe-ctx-item" data-act="ow:#${i}" title="${esc(c.cmd)} <path>${c.terminal ? ', in Ghostty' : ', in the background'}">${UI_ICON.terminal}<span>${esc(c.name)}</span></div>`).join('');
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
