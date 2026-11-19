// Settings, Tools, Open with: the person's own commands as rows. Each row has a
// colour (shown as a dot in the Open with menu), a name, the command, whether it
// is kept off folders, and whether it opens a Ghostty window or runs in the
// background. Each command is checked as it is typed: the shape here at once,
// and whether its program exists by asking the launcher, which looks it up in
// the same login shell that will run it.

import { el } from './el';
import { esc } from './utils';
import { UI_ICON } from './control-icons';
import { switchHtml } from './controls';
import { emptyHtml } from './empty-state';
import { safeColor, SWATCHES } from './icons';
import { openLayer, type Layer } from './layer';
import { saveSettings } from './storage';
import { commandProblem, parseCommands, type OwnCommand } from './open-with';
import type { Settings } from './types';

type Toast = (msg: string, ms?: number, action?: { label: string; run: () => void }) => void;

/** What the launcher said about a command's program, cached per command text. */
type Found = { found: boolean; where?: string; program?: string; problem?: string } | null;
const looked = new Map<string, Promise<Found>>();

function lookUp(cmd: string): Promise<Found> {
  const key = cmd.trim();
  let p = looked.get(key);
  if (!p) {
    p = new Promise<Found>(resolve => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve(null);
      chrome.runtime.sendMessage({ type: 'bfb-native-oneshot', host: 'com.better_file_browser.ghostty', payload: { action: 'check_cmd', cmd: key } }, res => {
        // No launcher, or an older one without the check: say nothing rather than guess.
        if (chrome.runtime.lastError || !res?.ok || res.response?.success !== true) return resolve(null);
        resolve(res.response as Found);
      });
    });
    looked.set(key, p);
  }
  return p;
}

const ballHtml = (c?: string) => c
  ? `<i class="fe-ow-ball" style="--c:${safeColor(c)}"></i>`
  : `<i class="fe-ow-ball none"></i>`;

/** Wires the Open with rows once; call the returned function when Settings opens. */
export function initOpenWithSettings(settings: Settings, toast: Toast): () => void {
  const list = el('fe-st-ow-list');
  let rows: OwnCommand[] = [];

  const save = () => { settings.openWith = rows.map(r => ({ ...r })); saveSettings(settings); };

  function rowHtml(c: OwnCommand, i: number): string {
    return `<div class="fe-ow-row" data-idx="${i}">
      <button type="button" class="fe-ow-color" title="Colour in the menu" aria-label="Colour in the menu">${ballHtml(c.color)}</button>
      <input type="text" class="tb fe-ow-name" data-size="lg" value="${esc(c.name)}" placeholder="Name" spellcheck="false" title="Shown in the Open with menu" aria-label="Name">
      <input type="text" class="tb fe-ow-cmd" data-size="lg" data-mono value="${esc(c.cmd)}" placeholder="e.g. code --add" spellcheck="false" title="The path is added last, quoted" aria-label="Command">
      ${switchHtml({ title: c.filesOnly ? 'Files only' : 'Files and folders', label: 'Files only', checked: !!c.filesOnly, small: true, cls: 'fe-ow-files' })}
      ${switchHtml({ title: c.terminal ? 'Opens a Ghostty window' : 'Runs in the background', label: 'Opens a window', checked: c.terminal, small: true, cls: 'fe-ow-win' })}
      <button type="button" class="btn fe-ibtn fe-ow-del" data-icon data-size="sm" data-tone="danger" title="Delete command" aria-label="Delete command">${UI_ICON.trash}</button>
      <span class="fe-ow-st" aria-live="polite"></span>
    </div>`;
  }

  // The status under a row: a problem with its shape first, then what the launcher found.
  function check(i: number): void {
    const row = list.querySelector<HTMLElement>(`.fe-ow-row[data-idx="${i}"]`);
    const c = rows[i];
    if (!row || !c) return;
    const st = row.querySelector<HTMLElement>('.fe-ow-st')!;
    const cmdBox = row.querySelector<HTMLInputElement>('.fe-ow-cmd')!;
    const nameBox = row.querySelector<HTMLInputElement>('.fe-ow-name')!;
    const blank = !c.name.trim() && !c.cmd.trim();
    const problem = blank ? '' : commandProblem(c, rows.filter((_, j) => j !== i));
    const paint = (text: string, tone: '' | 'ok' | 'bad') => {
      st.textContent = text;
      st.dataset.tone = tone;
      row.classList.toggle('bad', tone === 'bad');
    };
    nameBox.toggleAttribute('aria-invalid', /name/i.test(problem));
    cmdBox.toggleAttribute('aria-invalid', !!problem && !/name/i.test(problem));
    if (blank) return paint('', '');
    if (problem) return paint(problem, 'bad');
    paint('', '');
    const cmd = c.cmd;
    void lookUp(cmd).then(f => {
      if (rows[i]?.cmd !== cmd || !f) return;
      if (f.problem) paint(f.problem, 'bad');
      else if (f.found) paint(`Found ${f.where}`, 'ok');
      else { paint(`${f.program} is not installed, or not on the PATH`, 'bad'); cmdBox.setAttribute('aria-invalid', 'true'); }
    });
  }

  function render(): void {
    list.innerHTML = rows.length
      ? `<div class="fe-ow-head" aria-hidden="true"><span></span><span>Name</span><span>Command</span><span>Files only</span><span>Window</span><span></span></div>`
        + rows.map(rowHtml).join('')
      : emptyHtml('empty', 'No commands yet', { inline: true, hint: 'Add one to see it in Open with' });
    rows.forEach((_, i) => check(i));
  }

  const rowAt = (e: Event): number => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.fe-ow-row');
    const i = row ? Number(row.dataset.idx) : -1;
    return i >= 0 && i < rows.length ? i : -1;
  };

  list.addEventListener('input', e => {
    const i = rowAt(e); if (i < 0) return;
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fe-ow-name')) rows[i].name = t.value;
    else if (t.classList.contains('fe-ow-cmd')) rows[i].cmd = t.value;
    else return;
    save();
    // A name change can clear or cause a repeat on another row.
    rows.forEach((_, j) => check(j));
  });
  list.addEventListener('change', e => {
    const i = rowAt(e); if (i < 0) return;
    const t = e.target as HTMLInputElement;
    if (t.classList.contains('fe-ow-files')) { rows[i].filesOnly = t.checked || undefined; t.title = t.checked ? 'Files only' : 'Files and folders'; }
    else if (t.classList.contains('fe-ow-win')) { rows[i].terminal = t.checked; t.title = t.checked ? 'Opens a Ghostty window' : 'Runs in the background'; }
    else return;
    save();
  });
  list.addEventListener('click', e => {
    const i = rowAt(e); if (i < 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('.fe-ow-del')) {
      const before = rows.map(r => ({ ...r }));
      const gone = rows[i].name || 'Command';
      rows.splice(i, 1);
      save(); render();
      toast(`${gone} deleted`, 8000, { label: 'Undo', run: () => { rows = before; save(); render(); } });
    } else if (t.closest('.fe-ow-color')) openColour(i, t.closest<HTMLElement>('.fe-ow-color')!);
  });
  el('fe-st-ow-add').addEventListener('click', () => {
    rows.push({ name: '', cmd: '', terminal: true });
    save(); render();
    list.querySelector<HTMLInputElement>(`.fe-ow-row[data-idx="${rows.length - 1}"] .fe-ow-name`)?.focus();
  });

  // The colour: a swatch, any hex colour, or none (the menu then shows the terminal icon).
  let pop: Layer | null = null;
  function openColour(i: number, anchor: HTMLElement): void {
    pop?.close('api');
    const box = document.createElement('div');
    box.className = 'fe-rule-pop fe-ow-pop';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Colour in the menu');
    const cur = rows[i].color;
    box.innerHTML = `<div class="fe-rp-sec"><span class="fe-rp-l">Colour in the menu</span>
      <div class="fe-rp-sw">
        <button type="button" class="fe-rp-c none${cur ? '' : ' on'}" data-c="" title="No colour" aria-label="No colour"></button>
        ${SWATCHES.map(c => `<button type="button" class="fe-rp-c${c === cur ? ' on' : ''}" data-c="${c}" style="--c:${c}" title="${c}" aria-label="${c}"></button>`).join('')}
        <input type="color" class="fe-ow-pick" value="${cur && /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#4a9eff'}" title="Any colour" aria-label="Any colour">
      </div></div>`;
    const set = (c: string | undefined) => {
      rows[i].color = c || undefined;
      save();
      anchor.innerHTML = ballHtml(rows[i].color);
      box.querySelectorAll('.fe-rp-c').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.c === (c ?? '')));
    };
    box.addEventListener('click', e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.fe-rp-c');
      if (b) set(b.dataset.c || undefined);
    });
    box.addEventListener('input', e => {
      const t = e.target as HTMLInputElement;
      if (t.classList.contains('fe-ow-pick')) set(t.value);
    });
    pop = openLayer(box, { kind: 'popover', anchor, offset: 6, group: 'menu', focus: box.querySelector<HTMLElement>('.fe-rp-c.on') ?? 'first' });
  }

  return () => {
    // The older text is carried over as rows the first time; it is saved as rows only on a change.
    rows = (settings.openWith ?? parseCommands(settings.openWithCmds)).map(r => ({ ...r }));
    render();
  };
}
