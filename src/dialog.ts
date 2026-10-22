// One dialog chrome for Help and Settings: the title and the list of tabs
// down the left, one scrolling pane at a time on the right. A tab with an
// icon gets a coloured tile in the list and a page header (tile, title, a
// line on what the page covers) at the top of its pane. Esc closes, and
// focus goes back to where it was; the preview shares the focus half
// through the two helpers.
import { esc } from './utils';
import { kvGet, kvSet } from './kv';
import { UI_ICON } from './control-icons';
import { openLayer, focusTrap, type Layer } from './layer';
import { bind } from './commands';

// Every mounted dialog; the page keys act on the one that is open.
const mounted: { isOpen: () => boolean; step: (dir: 1 | -1) => void }[] = [];
const openOne = () => mounted.find(d => d.isOpen());
bind('dlg-tabs', key => openOne()?.step(key === '[' ? -1 : 1), () => !!openOne());

export interface DialogTab { key: string; label: string; hint?: string; icon?: string; tone?: string; desc?: string; body: string }
export interface DialogSpec { id: string; mark: string; title: string; subtitle: string; tabs: DialogTab[] }

const tile = (t: DialogTab, size = '') =>
  `<span class="fe-dlg-tile ${size}" style="--tone:${t.tone ?? 'var(--ac)'}" aria-hidden="true">${t.icon}</span>`;

export function renderDialog(d: DialogSpec): string {
  return `
  <div id="${esc(d.id)}" class="fe-dlg" style="display:none">
    <div class="fe-dlg-bg"></div>
    <div class="fe-dlg-box" role="dialog" aria-labelledby="${esc(d.id)}-title" tabindex="-1">
      <div class="fe-dlg-title">
        <span class="fe-dlg-mark">${d.mark}</span>
        <span class="fe-dlg-tx"><b id="${esc(d.id)}-title">${esc(d.title)}</b><i>${esc(d.subtitle)}</i></span>
        <button class="fe-dlg-close" title="Close (Esc)">${UI_ICON.close}</button>
      </div>
      <div class="fe-dlg-tabs" role="tablist">
        ${d.tabs.map(t => `<button class="fe-dlg-tab" role="tab" data-tab="${esc(t.key)}" title="${esc(t.label)} · [ ] switch tabs · Esc closes"><span class="fe-dlg-tab-main">${t.icon ? tile(t) : ''}<b>${esc(t.label)}</b></span>${t.hint ? `<i>${esc(t.hint)}</i>` : ''}</button>`).join('')}
      </div>
      ${d.tabs.map(t => `<div class="fe-dlg-pane" role="tabpanel" data-tab="${esc(t.key)}">${t.icon ? `<header class="fe-dlg-ph">${tile(t, 'lg')}<div class="fe-dlg-ph-tx"><h2>${esc(t.label)}</h2>${t.desc || t.hint ? `<p>${esc(t.desc || t.hint!)}</p>` : ''}</div></header>` : ''}${t.body}</div>`).join('')}
    </div>
  </div>`;
}

// The preview remembers focus here until it opens through the layer service
// too. A stack, not one slot, so nested openings each return to their opener.
const focusStack: (HTMLElement | null)[] = [];
export function rememberFocus(): void {
  focusStack.push(document.activeElement as HTMLElement | null);
}
export function restoreFocus(): void {
  const el = focusStack.pop() ?? null;
  if (el && document.contains(el) && typeof el.focus === 'function') el.focus();
}

export interface Dialog { open(tab?: string): void; close(): void; isOpen(): boolean; show(tab: string): void }

// Wire a rendered dialog: close button and scrim, tab switching (the last
// tab is remembered per dialog), Esc, and focus in and out.
export function mountDialog(id: string, hooks: { onOpen?: () => void; onClose?: () => void } = {}): Dialog {
  const root = document.getElementById(id)!;
  const box = root.querySelector<HTMLElement>('.fe-dlg-box')!;
  const tabs = [...root.querySelectorAll<HTMLElement>('.fe-dlg-tab')];
  const panes = [...root.querySelectorAll<HTMLElement>('.fe-dlg-pane')];
  const memory = `bfb-dialog-tab:${id}`;
  const isOpen = () => root.style.display !== 'none';

  function show(tab: string): void {
    if (!tabs.some(t => t.dataset.tab === tab)) tab = tabs[0]?.dataset.tab ?? '';
    tabs.forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    panes.forEach(p => { p.classList.toggle('on', p.dataset.tab === tab); if (p.dataset.tab === tab) p.scrollTop = 0; });
    try { kvSet(memory, tab); } catch { /* fine */ }
  }
  let layer: Layer | null = null;
  function open(tab?: string): void {
    hooks.onOpen?.();
    let last = '';
    try { last = kvGet(memory) || ''; } catch { /* fine */ }
    show(tab ?? last);
    root.style.display = 'flex';
    if (layer?.open) { box.focus(); return; }
    // Esc and focus going back to the opener come from the layer.
    layer = openLayer(root, { kind: 'dialog', place: 'none', focus: box, backdrop: root.querySelector<HTMLElement>('.fe-dlg-bg'), onClose: () => { root.style.display = 'none'; hooks.onClose?.(); } });
  }
  function close(): void { layer?.close('api'); }

  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab!)));
  root.querySelector('.fe-dlg-close')!.addEventListener('click', close);
  // Tab stays inside the dialog; [ and ] step through its pages.
  focusTrap(box, { when: isOpen });
  const step = (dir: 1 | -1) => {
    const i = tabs.findIndex(t => t.classList.contains('on'));
    show(tabs[(i + dir + tabs.length) % tabs.length].dataset.tab!);
  };
  mounted.push({ isOpen, step });
  return { open, close, isOpen, show };
}
