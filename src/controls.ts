// The form controls Settings is built from: a row of toggle buttons, a
// slider that steps through set values, and a dropdown that lists options
// with icons. Each is a plain element with a `value` property and a `change`
// event, so the code that reads and saves a setting treats it like a
// <select>. upgradeControls() wires every one under a root, once.
import { esc } from './utils';
import { CHEVRON_DOWN } from './icons';

export interface Opt { value: string; label?: string; icon?: string; hint?: string }

/// A row of buttons where one is on, like a segmented control. Options with
/// an icon and no label show only the icon, with the hint as their tooltip.
export function segHtml(id: string, opts: Opt[], title: string): string {
  return `<div class="fe-seg" id="${id}" role="radiogroup" aria-label="${esc(title)}" title="${esc(title)}">${opts.map(o =>
    `<button type="button" role="radio" class="fe-seg-b${o.label ? '' : ' ico'}" data-v="${esc(o.value)}" aria-checked="false" tabindex="-1" title="${esc(o.hint ?? o.label ?? o.value)}"${o.label ? '' : ` aria-label="${esc(o.hint ?? o.value)}"`}>${o.icon ?? ''}${o.label ? `<span>${esc(o.label)}</span>` : ''}</button>`).join('')}</div>`;
}

/// A slider over a fixed list of values, with the chosen one shown beside it
/// and a tick for each stop. With `names`, each stop shows its name instead
/// of its number.
export function sliderHtml(id: string, values: number[], unit: string, title: string, names?: string[]): string {
  return `<div class="fe-sld" id="${id}" data-values="${values.join(',')}" data-unit="${esc(unit)}"${names ? ` data-names="${esc(names.join('|'))}"` : ''} title="${esc(title)}">
    <input type="range" min="0" max="${values.length - 1}" step="1" aria-label="${esc(title)}" title="${esc(title)}">
    <output></output>
  </div>`;
}

/// A dropdown button whose list shows each option's icon and a short hint.
export function ddHtml(id: string, opts: Opt[], title: string): string {
  return `<div class="fe-dd" id="${id}" data-opts="${esc(JSON.stringify(opts))}">
    <button type="button" class="fe-dd-btn" aria-haspopup="listbox" aria-expanded="false" title="${esc(title)}"><span class="fe-dd-cur"></span>${CHEVRON_DOWN}</button>
  </div>`;
}

/// A list edited as chips: each entry a pill with its own remove button, and
/// a box at the end to add more (Enter, comma or leaving the box adds).
/// The value is the entries joined by ", ".
export function chipsHtml(id: string, placeholder: string, title: string): string {
  return `<div class="fe-chipin" id="${id}" title="${esc(title)}"><input class="fe-chipin-in" placeholder="${esc(placeholder)}" spellcheck="false" aria-label="${esc(title)}"></div>`;
}

type Valued = HTMLElement & { value: string };
const fire = (host: HTMLElement) => host.dispatchEvent(new Event('change', { bubbles: true }));

function upgradeSeg(host: HTMLElement): void {
  const btns = [...host.querySelectorAll<HTMLButtonElement>('.fe-seg-b')];
  let cur = '';
  const paint = () => btns.forEach(b => {
    const on = b.dataset.v === cur;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on || (!cur && b === btns[0]) ? 0 : -1;
  });
  Object.defineProperty(host, 'value', { get: () => cur, set: (v: string) => { cur = String(v); paint(); } });
  btns.forEach((b, i) => {
    b.addEventListener('click', () => { if (cur !== b.dataset.v) { cur = b.dataset.v!; paint(); fire(host); } });
    // Arrows move the choice, as in a radio group; Home and End jump.
    b.addEventListener('keydown', e => {
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? btns.length - 1 : step ? (i + step + btns.length) % btns.length : -1;
      if (to < 0) return;
      e.preventDefault(); e.stopPropagation();
      btns[to].focus(); btns[to].click();
    });
  });
  paint();
}

function upgradeSlider(host: HTMLElement): void {
  const values = host.dataset.values!.split(',').map(Number);
  const unit = host.dataset.unit ?? '';
  const names = host.dataset.names?.split('|');
  const range = host.querySelector('input')!;
  const out = host.querySelector('output')!;
  const show = () => {
    const v = values[Number(range.value)];
    out.textContent = names?.[Number(range.value)] ?? `${v}${unit}`;
    if (names) range.setAttribute('aria-valuetext', out.textContent);
    host.style.setProperty('--pct', `${(Number(range.value) / (values.length - 1)) * 100}%`);
  };
  Object.defineProperty(host, 'value', {
    get: () => String(values[Number(range.value)]),
    set: (v: string) => {
      const n = Number(v);
      let best = 0;
      values.forEach((x, i) => { if (Math.abs(x - n) < Math.abs(values[best] - n)) best = i; });
      range.value = String(best); show();
    },
  });
  // Dragging previews live through `input`; letting go saves through `change`.
  range.addEventListener('input', () => { show(); host.dispatchEvent(new Event('input', { bubbles: true })); });
  range.addEventListener('change', e => { e.stopPropagation(); fire(host); });
  show();
}

// One floating list serves every dropdown; it lives on #fe so a dialog's
// scrolling pane cannot clip it.
let list: HTMLElement | null = null;
let closeList: (() => void) | null = null;
function upgradeDd(host: HTMLElement): void {
  const btn = host.querySelector<HTMLButtonElement>('.fe-dd-btn')!;
  const curEl = host.querySelector<HTMLElement>('.fe-dd-cur')!;
  let opts: Opt[] = JSON.parse(host.dataset.opts || '[]');
  let cur = '';
  const paint = () => {
    // Mirrored as an attribute, which pages and tests outside this script can read.
    host.dataset.value = cur;
    const o = opts.find(x => x.value === cur);
    // A saved value missing from the list (a model since removed) still shows.
    curEl.innerHTML = o ? `${o.icon ?? ''}<span>${esc(o.label ?? o.value)}</span>` : cur ? `<span>${esc(cur)}</span>` : '<span class="fe-dd-none">None</span>';
  };
  Object.defineProperty(host, 'value', { get: () => cur, set: (v: string) => { cur = String(v); paint(); } });
  // Options can change after load (the AI model list arrives late).
  (host as HTMLElement & { setOptions: (o: Opt[]) => void }).setOptions = (o: Opt[]) => { opts = o; paint(); };

  function open(): void {
    closeList?.();
    const fe = document.getElementById('fe') ?? document.body;
    list = document.createElement('div');
    list.className = 'fe-dd-list';
    list.setAttribute('role', 'listbox');
    list.innerHTML = opts.map(o => `<div role="option" class="fe-dd-opt${o.value === cur ? ' on' : ''}" data-v="${esc(o.value)}" aria-selected="${o.value === cur}">`
      + `${o.icon ?? ''}<span class="fe-dd-l">${esc(o.label ?? o.value)}</span>${o.hint ? `<span class="fe-dd-h">${esc(o.hint)}</span>` : ''}</div>`).join('');
    fe.appendChild(list);
    const r = btn.getBoundingClientRect();
    list.style.minWidth = `${r.width}px`;
    const h = list.offsetHeight, w = list.offsetWidth;
    list.style.left = `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px`;
    list.style.top = `${r.bottom + h + 8 > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4}px`;
    btn.setAttribute('aria-expanded', 'true');
    const items = [...list.querySelectorAll<HTMLElement>('.fe-dd-opt')];
    let at = Math.max(0, items.findIndex(i => i.dataset.v === cur));
    const mark = () => { items.forEach((it, i) => it.classList.toggle('kb', i === at)); items[at]?.scrollIntoView({ block: 'nearest' }); };
    mark();
    const pick = (v: string) => { const changed = v !== cur; cur = v; paint(); shut(); btn.focus(); if (changed) fire(host); };
    list.addEventListener('click', e => { const it = (e.target as Element).closest<HTMLElement>('.fe-dd-opt'); if (it) pick(it.dataset.v!); });
    list.addEventListener('mousemove', e => { const it = (e.target as Element).closest<HTMLElement>('.fe-dd-opt'); if (it) { at = items.indexOf(it); mark(); } });
    let typed = '', typedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { at = (at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; mark(); }
      else if (e.key === 'Home' || e.key === 'End') { at = e.key === 'Home' ? 0 : items.length - 1; mark(); }
      else if (e.key === 'Enter' || e.key === ' ') { if (items[at]) pick(items[at].dataset.v!); }
      else if (e.key === 'Escape' || e.key === 'Tab') { shut(); if (e.key === 'Escape') btn.focus(); else return; }
      else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        // Typing jumps to the first option starting with what was typed.
        typed = Date.now() - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
        typedAt = Date.now();
        const hit = items.findIndex(it => (it.querySelector('.fe-dd-l')?.textContent ?? '').toLowerCase().startsWith(typed));
        if (hit >= 0) { at = hit; mark(); }
      } else return;
      e.preventDefault(); e.stopPropagation();
    };
    const onDown = (e: MouseEvent) => { if (!list?.contains(e.target as Node) && !host.contains(e.target as Node)) shut(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    function shut(): void {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown, true);
      list?.remove(); list = null; closeList = null;
      btn.setAttribute('aria-expanded', 'false');
    }
    closeList = shut;
  }
  btn.addEventListener('click', () => { if (btn.getAttribute('aria-expanded') === 'true') closeList?.(); else open(); });
  btn.addEventListener('keydown', e => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && btn.getAttribute('aria-expanded') !== 'true') { e.preventDefault(); open(); }
  });
  paint();
}

function upgradeChips(host: HTMLElement): void {
  const input = host.querySelector<HTMLInputElement>('.fe-chipin-in')!;
  let items: string[] = [];
  const paint = () => {
    host.querySelectorAll('.fe-chip-x').forEach(c => c.remove());
    input.insertAdjacentHTML('beforebegin', items.map((t, i) =>
      `<span class="fe-chip-x">${esc(t)}<button type="button" data-i="${i}" title="Remove ${esc(t)}" aria-label="Remove ${esc(t)}">×</button></span>`).join(''));
  };
  const commit = () => {
    const add = input.value.split(/[,\s]+/).map(x => x.trim()).filter(Boolean);
    input.value = '';
    if (!add.length) return;
    items = [...items, ...add.filter(a => !items.includes(a))];
    paint(); fire(host);
  };
  Object.defineProperty(host, 'value', {
    get: () => items.join(', '),
    set: (v: string) => { items = String(v).split(',').map(x => x.trim()).filter(Boolean); paint(); },
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !input.value && items.length) { items.pop(); paint(); fire(host); }
  });
  input.addEventListener('blur', commit);
  input.addEventListener('change', e => e.stopPropagation());
  host.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLElement>('.fe-chip-x button');
    if (b) { items.splice(Number(b.dataset.i), 1); paint(); fire(host); input.focus(); }
    else if (e.target === host) input.focus();
  });
}

/// Wire every control under `root` that is not wired yet.
export function upgradeControls(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.fe-seg:not([data-up])').forEach(h => { h.dataset.up = '1'; upgradeSeg(h); });
  root.querySelectorAll<HTMLElement>('.fe-sld:not([data-up])').forEach(h => { h.dataset.up = '1'; upgradeSlider(h); });
  root.querySelectorAll<HTMLElement>('.fe-dd:not([data-up])').forEach(h => { h.dataset.up = '1'; upgradeDd(h); });
  root.querySelectorAll<HTMLElement>('.fe-chipin:not([data-up])').forEach(h => { h.dataset.up = '1'; upgradeChips(h); });
}

export type ValuedEl = Valued;
export type DropdownEl = Valued & { setOptions: (o: Opt[]) => void };
